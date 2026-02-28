"""
Check what facility types exist in the database for Bangalore area
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

DB_PARAMS = {
    'host': os.getenv("DB_HOST"),
    'port': os.getenv("DB_PORT", 5432),
    'dbname': os.getenv("DB_NAME", "postgres"),
    'user': os.getenv("DB_USER", "postgres"),
    'password': os.getenv("DB_PASSWORD"),
    'sslmode': 'require',
    'connect_timeout': 30,
}

conn = psycopg2.connect(**DB_PARAMS)
cur = conn.cursor(cursor_factory=RealDictCursor)

print("🔍 Checking Facility Types in Database\n")

# Get pincode 560001 centroid
cur.execute("""
    SELECT
        AVG(ST_Y(location::geometry)) AS latitude,
        AVG(ST_X(location::geometry)) AS longitude
    FROM hospitals
    WHERE pincode = '560001'
        AND location IS NOT NULL
""")
pincode = cur.fetchone()
lat, lng = float(pincode['latitude']), float(pincode['longitude'])

print(f"Pincode 560001 Centroid: {lat:.6f}, {lng:.6f}\n")

# Check all facility types within 10km
print("Facility Types within 10km of 560001:")
print("=" * 60)
cur.execute("""
    SELECT
        hospital_care_type,
        COUNT(*) as count,
        MIN((ST_Distance(location, ST_MakePoint(%s, %s)::geography) / 1000)::numeric, 2) as min_distance
    FROM hospitals
    WHERE ST_DWithin(location, ST_MakePoint(%s, %s)::geography, 10000)
        AND location IS NOT NULL
        AND data_quality_norm >= 0.3
    GROUP BY hospital_care_type
    ORDER BY count DESC
""", (lng, lat, lng, lat))

results = cur.fetchall()
for row in results:
    print(f"{row['hospital_care_type'] or 'NULL':40s} Count: {row['count']:3d}  Min Distance: {row['min_distance']} km")

print(f"\nTotal facility types: {len(results)}")

# Check what the severity config expects
print("\n" + "=" * 60)
print("Expected Facility Types by Severity:")
print("=" * 60)
print("Mild:      Dispensary/ Poly Clinic, Health Centre")
print("Moderate:  Hospital, Clinic")
print("High:      Hospital, Medical College / Institute/Hospital")
print("Emergency: Any with emergency_available = TRUE")

# Check if any match
print("\n" + "=" * 60)
print("Checking for Matches:")
print("=" * 60)

for care_type in ['Dispensary/ Poly Clinic', 'Health Centre', 'Hospital', 'Clinic', 'Medical College / Institute/Hospital']:
    cur.execute("""
        SELECT COUNT(*) as count
        FROM hospitals
        WHERE ST_DWithin(location, ST_MakePoint(%s, %s)::geography, 10000)
            AND hospital_care_type = %s
            AND location IS NOT NULL
            AND data_quality_norm >= 0.3
    """, (lng, lat, care_type))
    count = cur.fetchone()['count']
    status = "✅" if count > 0 else "❌"
    print(f"{status} {care_type:45s} {count} facilities")

# Show sample hospitals within 10km
print("\n" + "=" * 60)
print("Sample Hospitals within 10km (any type):")
print("=" * 60)
cur.execute("""
    SELECT
        hospital_name, hospital_care_type, hospital_category,
        (ST_Distance(location, ST_MakePoint($2, $1)::geography) / 1000)::float AS distance_km ST_MakePoint(%s, %s)::geography) / 1000)::numeric, 2) AS distance_km
    FROM hospitals
    WHERE ST_DWithin(location, ST_MakePoint(%s, %s)::geography, 10000)
        AND location IS NOT NULL
        AND data_quality_norm >= 0.3
    ORDER BY location <-> ST_MakePoint(%s, %s)::geography
    LIMIT 10
""", (lng, lat, lng, lat, lng, lat))

hospitals = cur.fetchall()
for idx, h in enumerate(hospitals, 1):
    print(f"{idx}. {h['hospital_name']}")
    print(f"   Type: {h['hospital_care_type'] or 'Not specified'}")
    print(f"   Category: {h['hospital_category'] or 'Not specified'}")
    print(f"   Distance: {h['distance_km']} km\n")

cur.close()
conn.close()
