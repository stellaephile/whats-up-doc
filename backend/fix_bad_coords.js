/**
 * fix_bad_coords.js
 *
 * 1. Finds hospitals with coordinates outside India's bounding box
 * 2. Geocodes their address using AWS Location Services
 * 3. Updates the DB with corrected coordinates
 *
 * Usage:
 *   node fix_bad_coords.js --dry-run       # preview only, no DB writes
 *   node fix_bad_coords.js                 # fix all bad coords
 *   node fix_bad_coords.js --limit 100     # fix first 100 bad records
 *
 * Requirements:
 *   npm install @aws-sdk/client-location pg dotenv
 *   AWS credentials must have access to Amazon Location Service
 *   Create a Place Index in AWS Console → Location Services → Place indexes
 *   Set LOCATION_INDEX_NAME in .env
 */

require('dotenv').config();

const { LocationClient, SearchPlaceIndexForTextCommand } = require('@aws-sdk/client-location');
const { Pool } = require('pg');

// ── Config ────────────────────────────────────────────────────
const INDIA_BOUNDS = {
  minLat: 6.0,  maxLat: 37.5,
  minLng: 68.0, maxLng: 97.5
};

const LOCATION_INDEX  = process.env.AWS_LOCATION_INDEX || 'whatsupdoc-place-index';
const AWS_REGION      = process.env.AWS_REGION           || 'ap-south-1';
const BATCH_SIZE      = 10;   // concurrent geocode requests
const DELAY_MS        = 200;  // ms between batches (avoid throttling)
const MIN_CONFIDENCE  = 0.5;  // skip geocode results below this relevance

const args      = process.argv.slice(2);
const DRY_RUN   = args.includes('--dry-run');
const LIMIT     = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '99999');

// ── Clients ───────────────────────────────────────────────────
const db = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'postgres',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const locationClient = new LocationClient({ region: AWS_REGION });

// ── Helpers ───────────────────────────────────────────────────
function isOutsideIndia(lat, lng) {
  return (
    lat == null || lng == null ||
    lat < INDIA_BOUNDS.minLat || lat > INDIA_BOUNDS.maxLat ||
    lng < INDIA_BOUNDS.minLng || lng > INDIA_BOUNDS.maxLng
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildAddress(hospital) {
  // Build the best possible address string for geocoding
  const parts = [
    hospital.address,
    hospital.district,
    hospital.state,
    'India'
  ].filter(Boolean);
  return parts.join(', ');
}

async function geocode(addressText) {
  try {
    const cmd = new SearchPlaceIndexForTextCommand({
      IndexName: LOCATION_INDEX,
      Text: addressText,
      MaxResults: 1,
      FilterCountries: ['IND'], // restrict to India
    });

    const response = await locationClient.send(cmd);
    const result   = response.Results?.[0];

    if (!result) return null;

    const [lng, lat] = result.Place.Geometry.Point;
    const relevance  = result.Relevance || 0;

    return { lat, lng, relevance, label: result.Place.Label };
  } catch (err) {
    console.error(`  ❌ Geocode error for "${addressText}": ${err.message}`);
    return null;
  }
}

// ── Step 1: Find bad records ──────────────────────────────────
async function findBadCoords() {
  console.log('🔍 Scanning for hospitals outside India bounding box...\n');

  const result = await db.query(`
    SELECT
      id,
      hospital_name,
      address,
      district,
      state,
      pincode,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng
    FROM hospitals
    WHERE location IS NOT NULL
      AND (
        ST_Y(location::geometry) < $1 OR ST_Y(location::geometry) > $2 OR
        ST_X(location::geometry) < $3 OR ST_X(location::geometry) > $4
      )
    ORDER BY id
    LIMIT $5
  `, [
    INDIA_BOUNDS.minLat, INDIA_BOUNDS.maxLat,
    INDIA_BOUNDS.minLng, INDIA_BOUNDS.maxLng,
    LIMIT
  ]);

  // Also find hospitals with NULL location but have an address
  const nullResult = await db.query(`
    SELECT
      id, hospital_name, address, district, state, pincode,
      NULL AS lat, NULL AS lng
    FROM hospitals
    WHERE location IS NULL
      AND (address IS NOT NULL OR district IS NOT NULL)
    ORDER BY id
    LIMIT $1
  `, [LIMIT]);

  const bad = [...result.rows, ...nullResult.rows];
  console.log(`Found ${result.rows.length} hospitals with bad coordinates`);
  console.log(`Found ${nullResult.rows.length} hospitals with NULL location\n`);
  return bad;
}

// ── Step 2: Geocode + update ──────────────────────────────────
async function fixHospital(hospital) {
  const addressText = buildAddress(hospital);
  console.log(`  📍 [${hospital.id}] ${hospital.hospital_name}`);
  console.log(`     Address: ${addressText}`);
  console.log(`     Current: lat=${hospital.lat}, lng=${hospital.lng}`);

  const geo = await geocode(addressText);

  if (!geo) {
    console.log(`     ⚠️  No geocode result — skipping\n`);
    return { status: 'no_result', id: hospital.id };
  }

  if (geo.relevance < MIN_CONFIDENCE) {
    console.log(`     ⚠️  Low confidence (${geo.relevance.toFixed(2)}) — skipping\n`);
    return { status: 'low_confidence', id: hospital.id, relevance: geo.relevance };
  }

  if (isOutsideIndia(geo.lat, geo.lng)) {
    console.log(`     ⚠️  Geocoded result still outside India (${geo.lat}, ${geo.lng}) — skipping\n`);
    return { status: 'bad_geocode', id: hospital.id };
  }

  console.log(`     ✅ New coords: lat=${geo.lat.toFixed(6)}, lng=${geo.lng.toFixed(6)} (confidence: ${geo.relevance.toFixed(2)})`);
  console.log(`     Label: ${geo.label}\n`);

  if (!DRY_RUN) {
    await db.query(`
      UPDATE hospitals
      SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)
      WHERE id = $3
    `, [geo.lng, geo.lat, hospital.id]);
  }

  return { status: 'fixed', id: hospital.id, lat: geo.lat, lng: geo.lng };
}

// ── Step 3: Process in batches ────────────────────────────────
async function processBatches(hospitals) {
  const stats = { fixed: 0, no_result: 0, low_confidence: 0, bad_geocode: 0, error: 0 };

  for (let i = 0; i < hospitals.length; i += BATCH_SIZE) {
    const batch      = hospitals.slice(i, i + BATCH_SIZE);
    const batchNum   = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatch = Math.ceil(hospitals.length / BATCH_SIZE);

    console.log(`\n── Batch ${batchNum}/${totalBatch} (records ${i + 1}–${Math.min(i + BATCH_SIZE, hospitals.length)}) ──`);

    const results = await Promise.all(batch.map(h => fixHospital(h).catch(err => {
      console.error(`  ❌ Error processing ${h.id}: ${err.message}`);
      return { status: 'error', id: h.id };
    })));

    results.forEach(r => stats[r.status] = (stats[r.status] || 0) + 1);

    if (i + BATCH_SIZE < hospitals.length) {
      await sleep(DELAY_MS);
    }
  }

  return stats;
}

// ── Step 4: Verify pincode medians after fix ──────────────────
async function verifyPincodes(pincodes) {
  console.log('\n📊 Verifying pincode coordinate medians after fix...\n');

  for (const pincode of pincodes.slice(0, 10)) { // check first 10
    const r = await db.query(`
      SELECT
        pincode,
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE ST_Y(location::geometry) BETWEEN 6 AND 37.5
            AND ST_X(location::geometry) BETWEEN 68 AND 97.5
        ) AS valid,
        PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY ST_Y(location::geometry)
        ) FILTER (
          WHERE ST_Y(location::geometry) BETWEEN 6 AND 37.5
            AND ST_X(location::geometry) BETWEEN 68 AND 97.5
        ) AS median_lat,
        PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY ST_X(location::geometry)
        ) FILTER (
          WHERE ST_X(location::geometry) BETWEEN 68 AND 97.5
            AND ST_Y(location::geometry) BETWEEN 6 AND 37.5
        ) AS median_lng
      FROM hospitals
      WHERE pincode = $1 AND location IS NOT NULL
      GROUP BY pincode
    `, [pincode]);

    if (r.rows[0]) {
      const row = r.rows[0];
      console.log(`  Pincode ${row.pincode}: ${row.valid}/${row.total} valid | median lat=${parseFloat(row.median_lat).toFixed(4)}, lng=${parseFloat(row.median_lng).toFixed(4)}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('════════════════════════════════════════════════');
  console.log('  What\'s Up Doc — Bad Coordinate Fixer');
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (no DB writes)' : '✏️  LIVE (will update DB)'}`);
  console.log(`  AWS Region: ${AWS_REGION}`);
  console.log(`  Location Index: ${LOCATION_INDEX}`);
  console.log('════════════════════════════════════════════════\n');

  try {
    // Test DB connection
    await db.query('SELECT 1');
    console.log('✅ Database connected\n');

    // Find bad records
    const badHospitals = await findBadCoords();

    if (badHospitals.length === 0) {
      console.log('🎉 No bad coordinates found! Database looks clean.');
      return;
    }

    // Get unique pincodes for verification later
    const pincodes = [...new Set(badHospitals.map(h => h.pincode).filter(Boolean))];

    console.log(`\nWill process ${badHospitals.length} hospitals across ${pincodes.length} pincodes`);
    if (DRY_RUN) console.log('(DRY RUN — no changes will be made)\n');

    // Process
    const stats = await processBatches(badHospitals);

    // Summary
    console.log('\n════════════════════════════════════════════════');
    console.log('  Results Summary');
    console.log('════════════════════════════════════════════════');
    console.log(`  ✅ Fixed:           ${stats.fixed}`);
    console.log(`  ⚠️  No result:       ${stats.no_result}`);
    console.log(`  ⚠️  Low confidence:  ${stats.low_confidence}`);
    console.log(`  ⚠️  Bad geocode:     ${stats.bad_geocode}`);
    console.log(`  ❌ Errors:          ${stats.error}`);
    console.log(`  Total processed:    ${badHospitals.length}`);

    if (!DRY_RUN && stats.fixed > 0) {
      await verifyPincodes(pincodes);
    }

  } finally {
    await db.end();
    console.log('\n✅ Done.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});