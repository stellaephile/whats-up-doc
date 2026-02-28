"""
Test the exact query being used in the backend
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

lat = 13.165667326086956
lng = 77.42541050869563
radius_metres = 3000  # 3km
care_types = ['Dispensary/ Poly Clinic', 'Health Centre']

print(f"Testing query with:")
print(f"  Lat: {lat}")
print(f"  Lng: {lng}")
print(f"  Radius: {radius_metres}m ({radius_metres/1000}km)")
print(f"  Care types: {care_types}")
print()

# Test the exact query from backend
query = """
SELECT
    id, hospital_name, hospital_category, hospital_care_type,
    ROUND((ST_Distance(location, ST_MakePoint(%s, %s)::geography) / 1000)::numeric, 2) AS distance_km
FROM hospitals
WHERE ST_DWithin(location, ST_MakePoint(%s, %s)::geography, %s)
    AND location IS NOT NULL
    AND data_quality_norm >= 0.3
    AND (hospital_care_type = ANY(%s) OR hospital_care_type IS NULL)
ORDER BY location <-> ST_MakePoint(%s, %s)::geography
LIMIT 20
"""

print("Query with NULL handling:")
print("=" * 60)
cur.execute(query, (lng, lat, lng, lat, radius_metres, care_types, lng, lat))
results = cur.fetchall()
print(f"Found {len(results)} hospitals\n")

if results:
    for idx, h in enumerate(results, 1):
        print(f"{idx}. {h['hospital_name']}")
        print(f"   Care Type: {h['hospital_care_type']}")
        print(f"   Category: {h['hospital_category']}")
        print(f"   Distance: {h['distance_km']} km\n")
else:
    print("No results. Let's try without care_type filter...\n")
    
    # Try without care_type filter
    query2 = """
    SELECT
        id, hospital_name, hospital_category, hospital_care_type,
        ROUND((ST_Distance(location, ST_MakePoint(%s, %s)::geography) / 1000)::numeric, 2) AS distance_km
    FROM hospitals
    WHERE ST_DWithin(location, ST_MakePoint(%s, %s)::geography, %s)
        AND location IS NOT NULL
        AND data_quality_norm >= 0.3
    ORDER BY location <-> ST_MakePoint(%s, %s)::geography
    LIMIT 20
    """
    
    cur.execute(query2, (lng, lat, lng, lat, radius_metres, lng, lat))
    results2 = cur.fetchall()
    print(f"Without care_type filter: Found {len(results2)} hospitals\n")
    
    if results2:
        for idx, h in enumerate(results2, 1):
            print(f"{idx}. {h['hospital_name']}")
            print(f"   Care Type: {h['hospital_care_type']}")
            print(f"   Distance: {h['distance_km']} km\n")
    else:
        print("Still no results. Let's try 10km...\n")
        
        cur.execute(query2, (lng, lat, lng, lat, 10000, lng, lat))
        results3 = cur.fetchall()
        print(f"10km radius: Found {len(results3)} hospitals\n")
        
        for idx, h in enumerate(results3, 1):
            print(f"{idx}. {h['hospital_name']} - {h['distance_km']} km")

cur.close()
conn.close()
