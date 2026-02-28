"""
Test database connection and query for pincode 560001 (Bangalore) with fever symptoms
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

def test_connection():
    print("🔍 Testing Database Connection...\n")
    print("Configuration:")
    print(f"   Host: {DB_PARAMS['host']}")
    print(f"   Port: {DB_PARAMS['port']}")
    print(f"   Database: {DB_PARAMS['dbname']}")
    print(f"   User: {DB_PARAMS['user']}")
    print(f"   Password: ***{DB_PARAMS['password'][-4:] if DB_PARAMS['password'] else 'NOT SET'}")
    print()

    try:
        print("Attempting to connect...")
        conn = psycopg2.connect(**DB_PARAMS)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        print("✅ Connected successfully!\n")

        # Test 1: Basic query
        print("Test 1: Basic Connection")
        print("------------------------")
        cur.execute("SELECT NOW(), version()")
        result = cur.fetchone()
        print(f"✅ Timestamp: {result['now']}")
        print(f"   PostgreSQL: {result['version'].split(',')[0]}\n")

        # Test 2: PostGIS
        print("Test 2: PostGIS Extension")
        print("------------------------")
        cur.execute("SELECT PostGIS_Version()")
        result = cur.fetchone()
        print(f"✅ PostGIS Version: {result['postgis_version']}\n")

        # Test 3: Database stats
        print("Test 3: Database Statistics")
        print("------------------------")
        cur.execute("""
            SELECT
                COUNT(*)                                              AS total,
                COUNT(*) FILTER (WHERE location IS NOT NULL)          AS with_coordinates,
                COUNT(*) FILTER (WHERE emergency_available = TRUE)    AS emergency,
                COUNT(*) FILTER (WHERE ayush = TRUE)                  AS ayush,
                COUNT(*) FILTER (WHERE hospital_category ILIKE '%gov%' 
                                    OR hospital_category ILIKE '%public%') AS government,
                COUNT(*) FILTER (WHERE data_quality_norm >= 0.3)      AS quality_passed
            FROM hospitals
        """)
        stats = cur.fetchone()
        print(f"✅ Total Hospitals: {stats['total']}")
        print(f"   With Coordinates: {stats['with_coordinates']}")
        print(f"   Emergency (24x7): {stats['emergency']}")
        print(f"   Government: {stats['government']}")
        print(f"   AYUSH: {stats['ayush']}")
        print(f"   Quality Passed (>=0.3): {stats['quality_passed']}\n")

        # Test 4: Pincode 560001 lookup
        print("Test 4: Pincode 560001 (Bangalore) Lookup")
        print("------------------------")
        cur.execute("""
            SELECT
                pincode,
                state,
                district,
                AVG(ST_Y(location::geometry)) AS latitude,
                AVG(ST_X(location::geometry)) AS longitude,
                COUNT(*) AS hospital_count
            FROM hospitals
            WHERE pincode = %s
                AND location IS NOT NULL
            GROUP BY pincode, state, district
            LIMIT 1
        """, ('560001',))
        
        pincode_data = cur.fetchone()
        
        if not pincode_data:
            print("❌ Pincode 560001 not found in database\n")
            return
        
        print(f"✅ Pincode: {pincode_data['pincode']}")
        print(f"   State: {pincode_data['state']}")
        print(f"   District: {pincode_data['district']}")
        print(f"   Centroid: {pincode_data['latitude']:.6f}, {pincode_data['longitude']:.6f}")
        print(f"   Hospitals in this pincode: {pincode_data['hospital_count']}\n")

        lat = float(pincode_data['latitude'])
        lng = float(pincode_data['longitude'])

        # Test 5: Fever search (mild severity) - 3km radius
        print("Test 5: Fever Search (Mild Severity)")
        print("------------------------")
        print("Severity: Mild (1-3)")
        print("Facility Types: Dispensary/Poly Clinic, Health Centre")
        print(f"Center: {lat:.6f}, {lng:.6f}")
        print("Initial Radius: 3km")
        print()

        # Try 3km first
        cur.execute("""
            SELECT
                id, hospital_name, hospital_category, hospital_care_type,
                discipline, ayush,
                state, district, pincode, address,
                specialties_array, facilities_array,
                emergency_available, emergency_num, ambulance_phone, bloodbank_phone,
                telephone, mobile_number,
                total_beds, data_quality_norm,
                ST_X(location::geometry) AS longitude,
                ST_Y(location::geometry) AS latitude,
                (ST_Distance(location, ST_MakePoint($2, $1)::geography) / 1000)::float AS distance_km ST_MakePoint(%s, %s)::geography) / 1000)::numeric, 2) AS distance_km
            FROM hospitals
            WHERE ST_DWithin(location, ST_MakePoint(%s, %s)::geography, %s)
                AND hospital_care_type = ANY(%s)
                AND location IS NOT NULL
                AND data_quality_norm >= 0.3
            ORDER BY location <-> ST_MakePoint(%s, %s)::geography
            LIMIT 10
        """, (lng, lat, lng, lat, 3000, ['Dispensary/ Poly Clinic', 'Health Centre'], lng, lat))
        
        results = cur.fetchall()
        
        if results:
            print(f"✅ Found {len(results)} facilities within 3km:\n")
            for idx, hospital in enumerate(results, 1):
                print(f"{idx}. {hospital['hospital_name']}")
                print(f"   Type: {hospital['hospital_care_type']}")
                print(f"   Category: {hospital['hospital_category'] or 'N/A'}")
                print(f"   Distance: {hospital['distance_km']} km")
                print(f"   Address: {hospital["address"] or (hospital["district"] + ", " + hospital["state"])}")
                if hospital['telephone'] or hospital['mobile_number']:
                    print(f"   Phone: {hospital['telephone'] or hospital['mobile_number']}")
                if hospital['specialties_array']:
                    specs = ', '.join(hospital['specialties_array'][:3])
                    print(f"   Specialties: {specs}")
                if hospital['emergency_available']:
                    print(f"   🚨 24x7 Emergency Available")
                if hospital['total_beds']:
                    print(f"   🛏️  Beds: {hospital['total_beds']}")
                print()
        else:
            print("⚠️  No facilities found within 3km. Trying 5km...\n")
            
            # Try 5km
            cur.execute("""
                SELECT
                    hospital_name, hospital_care_type, hospital_category,
                    address, district, state,
                    telephone, mobile_number,
                    (ST_Distance(location, ST_MakePoint($2, $1)::geography) / 1000)::float AS distance_km ST_MakePoint(%s, %s)::geography) / 1000)::numeric, 2) AS distance_km
                FROM hospitals
                WHERE ST_DWithin(location, ST_MakePoint(%s, %s)::geography, %s)
                    AND hospital_care_type = ANY(%s)
                    AND location IS NOT NULL
                    AND data_quality_norm >= 0.3
                ORDER BY location <-> ST_MakePoint(%s, %s)::geography
                LIMIT 10
            """, (lng, lat, lng, lat, 5000, ['Dispensary/ Poly Clinic', 'Health Centre'], lng, lat))
            
            results_5km = cur.fetchall()
            
            if results_5km:
                print(f"✅ Found {len(results_5km)} facilities within 5km (expanded search):\n")
                for idx, hospital in enumerate(results_5km, 1):
                    print(f"{idx}. {hospital['hospital_name']}")
                    print(f"   Type: {hospital['hospital_care_type']}")
                    print(f"   Distance: {hospital['distance_km']} km")
                    print(f"   Address: {hospital["address"] or (hospital["district"] + ", " + hospital["state"])}")
                    print()
            else:
                print("⚠️  No facilities found even within 5km")
                print("Trying 10km for any hospital type...\n")
                
                # Try 10km with any hospital type
                cur.execute("""
                    SELECT
                        hospital_name, hospital_care_type,
                        (ST_Distance(location, ST_MakePoint($2, $1)::geography) / 1000)::float AS distance_km ST_MakePoint(%s, %s)::geography) / 1000)::numeric, 2) AS distance_km
                    FROM hospitals
                    WHERE ST_DWithin(location, ST_MakePoint(%s, %s)::geography, %s)
                        AND location IS NOT NULL
                        AND data_quality_norm >= 0.3
                    ORDER BY location <-> ST_MakePoint(%s, %s)::geography
                    LIMIT 5
                """, (lng, lat, lng, lat, 10000, lng, lat))
                
                results_10km = cur.fetchall()
                if results_10km:
                    print(f"✅ Found {len(results_10km)} facilities within 10km (any type):\n")
                    for idx, hospital in enumerate(results_10km, 1):
                        print(f"{idx}. {hospital['hospital_name']} - {hospital['hospital_care_type']} ({hospital['distance_km']} km)")

        print("\n✅ All tests completed successfully!")

        cur.close()
        conn.close()
        print("🔌 Connection closed")

    except psycopg2.OperationalError as e:
        print(f"❌ Connection failed: {e}")
        print("\n💡 Troubleshooting:")
        print("   - Check if RDS is publicly accessible")
        print("   - Verify security group allows your IP")
        print("   - Check if you need VPN access")
        print("   - Verify the hostname is correct")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_connection()
