require('dotenv').config();

const pool = require('./db');
const { LocationClient, SearchPlaceIndexForTextCommand } = require('@aws-sdk/client-location');

const locationClient = new LocationClient({
  region: process.env.AWS_REGION || 'ap-south-1'
});

const BATCH_SIZE = 10;       // hospitals processed in parallel
const DELAY_MS   = 200;      // delay between batches (avoid rate limiting)
const MAX_RETRY  = 2;        // retries per hospital

// ── Geocode a single hospital ─────────────────────────────────
async function geocodeHospital(hospital) {
  // Build best possible search text
  const parts = [
    hospital.hospital_name,
    hospital.address,
    hospital.pincode,
    hospital.district,
    hospital.state,
    'India'
  ].filter(Boolean);

  // Try from most specific to least specific
  const searchTexts = [
    `${hospital.hospital_name}, ${hospital.pincode}, India`,
    `${hospital.pincode}, ${hospital.district}, India`,
    `${hospital.district}, ${hospital.state}, India`
  ];

  for (const text of searchTexts) {
    try {
      const command = new SearchPlaceIndexForTextCommand({
        IndexName:       process.env.AWS_LOCATION_INDEX,
        Text:            text,
        MaxResults:      1,
        FilterCountries: ['IND'],
        Key:             process.env.AWS_LOCATION_API_KEY
      });

      const response = await locationClient.send(command);

      if (response.Results?.length > 0) {
        const [lng, lat] = response.Results[0].Place.Geometry.Point;
        return { lat, lng, searchText: text };
      }
    } catch (err) {
      console.error(`❌ Geocode error for hospital ${hospital.id}: ${err.message}`);
    }
  }

  return null;
}

// ── Update hospital coordinates in DB ────────────────────────
async function updateHospitalLocation(id, lat, lng) {
  await pool.query(`
    UPDATE hospitals
    SET location = ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
    WHERE id = $3
  `, [lat, lng, id]);
}

// ── Sleep helper ──────────────────────────────────────────────
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ── Main geocoding runner ─────────────────────────────────────
async function geocodeAllMissing() {
  console.log('🚀 Starting geocoding for hospitals with missing coordinates...\n');

  // Count total missing
  const countResult = await pool.query(`
    SELECT COUNT(*) FROM hospitals WHERE location IS NULL
  `);
  const total = parseInt(countResult.rows[0].count);
  console.log(`📊 Total hospitals missing coordinates: ${total}\n`);

  if (total === 0) {
    console.log('✅ All hospitals already have coordinates!');
    await pool.end();
    return;
  }

  let processed = 0;
  let success   = 0;
  let failed    = 0;

  // Process in batches
  while (true) {
    // Fetch next batch
    const result = await pool.query(`
      SELECT id, hospital_name, address, pincode, district, state
      FROM hospitals
      WHERE location IS NULL
      LIMIT $1
    `, [BATCH_SIZE]);

    if (result.rows.length === 0) break;

    console.log(`\n📦 Processing batch of ${result.rows.length} hospitals...`);

    // Process batch in parallel
    await Promise.all(result.rows.map(async (hospital) => {
      let geo = null;

      for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
        geo = await geocodeHospital(hospital);
        if (geo) break;
        if (attempt < MAX_RETRY) await sleep(500);
      }

      if (geo) {
        await updateHospitalLocation(hospital.id, geo.lat, geo.lng);
        success++;
        console.log(`  ✅ [${hospital.id}] ${hospital.hospital_name} → ${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)} (via "${geo.searchText}")`);
      } else {
        failed++;
        console.log(`  ❌ [${hospital.id}] ${hospital.hospital_name} — could not geocode`);
      }

      processed++;
    }));

    // Progress report
    const pct = ((processed / total) * 100).toFixed(1);
    console.log(`\n📈 Progress: ${processed}/${total} (${pct}%) | ✅ ${success} success | ❌ ${failed} failed`);

    // Delay between batches
    await sleep(DELAY_MS);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏁 Geocoding complete!');
  console.log(`   ✅ Successfully geocoded : ${success}`);
  console.log(`   ❌ Failed                : ${failed}`);
  console.log(`   📊 Total processed       : ${processed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await pool.end();
}

// ── Run ───────────────────────────────────────────────────────
geocodeAllMissing().catch(err => {
  console.error('💥 Fatal error:', err);
  pool.end();
  process.exit(1);
});