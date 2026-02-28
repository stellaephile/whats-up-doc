"""
MediRoute — CSV Import Script
Loads hospitals_enhanced.csv into AWS RDS PostgreSQL

Usage:
    pip install psycopg2-binary python-dotenv
    python import_hospitals.py

.env file needed:
    DB_HOST=your-rds-endpoint.ap-south-1.rds.amazonaws.com
    DB_PORT=5432
    DB_NAME=postgres
    DB_USER=postgres
    DB_PASSWORD=your-password
"""

import csv
import ast
import os
import re
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv()

DB_PARAMS = dict(
    host=os.getenv("DB_HOST"),
    port=os.getenv("DB_PORT", 5432),
    dbname=os.getenv("DB_NAME", "postgres"),
    user=os.getenv("DB_USER", "postgres"),
    password=os.getenv("DB_PASSWORD"),
    sslmode="require",
    # ── Keepalive: prevents RDS dropping idle connection ──────
    keepalives=1,
    keepalives_idle=30,       # send keepalive after 30s idle
    keepalives_interval=10,   # retry every 10s
    keepalives_count=5,       # give up after 5 failed probes
    connect_timeout=30,
)

def get_conn():
    conn = psycopg2.connect(**DB_PARAMS)
    conn.autocommit = False
    return conn

conn = get_conn()
cur = conn.cursor()
print("✅ Connected to AWS RDS")


# ── Helpers ───────────────────────────────────────────────────

def clean_str(val):
    """Return None if empty/zero, else stripped string."""
    if not val or str(val).strip() in ('0', '', 'nan', 'None', 'NaN'):
        return None
    return str(val).strip()

def clean_int(val, max_val=2147483647):
    """Return None if empty or out of safe range, else integer."""
    try:
        v = float(str(val).strip())
        if v <= 0 or v > max_val:
            return None  # catches garbage like phone numbers in beds column
        return int(v)
    except:
        return None

def clean_float(val):
    """Return None if empty/zero, else float."""
    try:
        v = float(str(val).strip())
        return v if v != 0.0 else None
    except:
        return None

def clean_bool(val):
    """Parse True/False strings."""
    return str(val).strip().lower() == 'true'

def parse_list_field(val):
    """
    Parse fields like "['Cardiology', 'Neurology']" into a Python list.
    Cleans up the \\n artifacts in the data.
    """
    if not val or str(val).strip() in ('0', '', '[]', 'nan'):
        return []
    try:
        # Remove the escaped newline artifacts from the CSV
        cleaned = re.sub(r"\\\\n\s*", " ", str(val))
        cleaned = re.sub(r"\\n\s*", " ", cleaned)
        result = ast.literal_eval(cleaned)
        if isinstance(result, list):
            # Clean each item: strip whitespace, remove leading backslashes
            return [
                re.sub(r'^[\s\\n]+', '', str(item)).strip()
                for item in result
                if str(item).strip() not in ('', '0')
            ]
        return []
    except:
        # Fallback: split by comma if not a valid list literal
        return [x.strip() for x in str(val).split(',') if x.strip() and x.strip() != '0']

def parse_anomaly_flags(val):
    """Parse anomaly_flags column into array."""
    return parse_list_field(val)

def clean_phone(val):
    """Return None if clearly not a phone number."""
    v = clean_str(val)
    if not v:
        return None
    # Remove if it's just zeros or clearly invalid
    digits_only = re.sub(r'\D', '', v)
    if len(digits_only) < 5:
        return None
    return v


# ── Step 1: Populate states and districts ────────────────────
print("\n📍 Loading states and districts...")

with open('backend/hospitals_enhanced.csv', newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

states = {}
districts = {}

for row in rows:
    sid = clean_int(row['State_ID'])
    sname = clean_str(row['State'])
    if sid and sname and sid not in states:
        states[sid] = sname

    did = clean_int(row['District_ID'])
    dname = clean_str(row['District'])
    if did and dname and did not in districts:
        districts[did] = (dname, sid)

# Insert states
for sid, sname in states.items():
    cur.execute("""
        INSERT INTO states (id, name)
        VALUES (%s, %s)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    """, (sid, sname))

# Insert districts
for did, (dname, sid) in districts.items():
    cur.execute("""
        INSERT INTO districts (id, name, state_id)
        VALUES (%s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    """, (did, dname, sid))

conn.commit()
print(f"   ✅ {len(states)} states, {len(districts)} districts loaded")


# ── Step 2: Import hospitals ──────────────────────────────────
print(f"\n🏥 Importing {len(rows)} hospital records...")

# ── Resume: find highest sr_no already in DB ─────────────────
cur.execute("SELECT COALESCE(MAX(sr_no), 0) FROM hospitals")
last_sr_no = cur.fetchone()[0]
if last_sr_no > 0:
    print(f"   ⏩ Resuming from Sr_No > {last_sr_no} ({last_sr_no} rows already imported)")

inserted = 0
skipped  = 0
errors   = 0
BATCH_SIZE = 100   # smaller batches = less data lost if connection drops

def build_row(row):
    specialties   = parse_list_field(row.get('specialties_list', ''))
    facilities    = parse_list_field(row.get('Facilities', ''))
    anomaly_flags = parse_anomaly_flags(row.get('anomaly_flags', ''))
    lat     = clean_float(row['latitude'])
    lng     = clean_float(row['longitude'])
    quality = clean_float(row['data_quality_score']) or 0
    return (
        clean_int(row['Sr_No']),
        clean_str(row['hospital_name_clean']) or 'Unknown',
        clean_str(row['Hospital_Category']),
        clean_str(row['Hospital_Care_Type']),
        clean_str(row['Discipline_Systems_of_Medicine']),
        'ayush' in str(row.get('Discipline_Systems_of_Medicine', '')).lower()
            or 'ayush' in str(row.get('Ayush', '')).lower(),
        clean_str(row['address_clean']),
        clean_str(row['Pincode_str']),
        clean_str(row['Town']),
        clean_str(row['Village']),
        clean_str(row['Subdistrict']),
        clean_str(row['District']),
        clean_str(row['State']),
        clean_int(row['District_ID']),
        clean_int(row['State_ID']),
        lat, lng,
        clean_phone(row['Telephone']),
        clean_phone(row['Mobile_Number']),
        clean_phone(row['Emergency_Num']),
        clean_phone(row['Ambulance_Phone_No']),
        clean_phone(row['Bloodbank_Phone_No']),
        clean_phone(row['Helpline']),
        clean_phone(row['Tollfree']),
        clean_str(row['Hospital_Primary_Email_Id']),
        clean_str(row['Hospital_Secondary_Email_Id']),
        clean_str(row['Website']),
        clean_str(row['Specialties']),
        specialties if specialties else None,
        clean_str(row['Facilities']),
        facilities if facilities else None,
        clean_int(row['Total_Num_Beds'],          max_val=50000),  # >50k = phone number in disguise
        clean_int(row['Number_Private_Wards'],    max_val=50000),
        clean_int(row['Num_Bed_for_Eco_Weaker_Sec'], max_val=50000),
        clean_int(row['Number_Doctor'],           max_val=10000),
        clean_int(row['Num_Mediconsultant_or_Expert']),
        clean_int(row['Establised_Year']),
        clean_str(row['Miscellaneous_Facilities']),
        quality,
        anomaly_flags if anomaly_flags else None,
    )

INSERT_SQL = """
    INSERT INTO hospitals (
        sr_no, hospital_name,
        hospital_category, hospital_care_type, discipline, ayush,
        address, pincode, town, village, subdistrict,
        district, state, district_id, state_id,
        latitude, longitude,
        telephone, mobile_number,
        emergency_num, ambulance_phone, bloodbank_phone,
        helpline, tollfree,
        email_primary, email_secondary, website,
        specialties_raw, specialties_array,
        facilities_raw, facilities_array,
        total_beds, private_wards, ews_beds,
        num_doctors, num_consultants,
        established_year, miscellaneous,
        data_quality_score, anomaly_flags
    ) VALUES %s
    ON CONFLICT (sr_no) DO NOTHING
"""

batch = []

for i, row in enumerate(rows):
    sr = clean_int(row['Sr_No']) or 0
    if sr <= last_sr_no:
        skipped += 1
        continue

    try:
        batch.append(build_row(row))
    except Exception as e:
        errors += 1
        if errors <= 5:
            print(f"   ⚠️  Row {i+1} build error: {e}")
        continue

    # Flush batch
    if len(batch) >= BATCH_SIZE:
        retry = 0
        while retry < 3:
            try:
                execute_values(cur, INSERT_SQL, batch)
                conn.commit()
                inserted += len(batch)
                print(f"   ... {inserted + skipped}/{len(rows)} processed ({inserted} inserted)")
                batch = []
                break
            except psycopg2.OperationalError as e:
                retry += 1
                print(f"   🔄 Connection lost, reconnecting... (attempt {retry})")
                try:
                    conn.close()
                except: pass
                import time; time.sleep(2 * retry)
                conn = get_conn()
                cur  = conn.cursor()

# Flush remaining rows
if batch:
    try:
        execute_values(cur, INSERT_SQL, batch)
        conn.commit()
        inserted += len(batch)
    except Exception as e:
        print(f"   ⚠️  Final batch error: {e}")

# ── Step 3: Log the sync ──────────────────────────────────────
cur.execute("""
    INSERT INTO sync_logs (source, records_fetched, records_inserted, records_skipped, status)
    VALUES (%s, %s, %s, %s, %s)
""", ('hospitals_enhanced.csv', len(rows), inserted, errors, 'success'))
conn.commit()


# ── Step 4: Summary ───────────────────────────────────────────
print(f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  Import Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total rows in CSV  : {len(rows)}
Inserted           : {inserted}
Errors skipped     : {errors}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""")

# Quick verification queries
print("📊 Verification:")
cur.execute("SELECT COUNT(*) FROM hospitals")
print(f"   Total hospitals in DB     : {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM hospitals WHERE location IS NOT NULL")
print(f"   With valid coordinates    : {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM hospitals WHERE emergency_available = TRUE")
print(f"   Emergency available       : {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM hospitals WHERE specialties_array IS NOT NULL")
print(f"   With specialties          : {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM hospitals WHERE data_quality_norm >= 0.3")
print(f"   Quality score >= 0.3      : {cur.fetchone()[0]}")

cur.execute("SELECT hospital_category, COUNT(*) FROM hospitals GROUP BY 1 ORDER BY 2 DESC")
print(f"\n   By category:")
for row in cur.fetchall():
    print(f"   {row[0] or 'Unknown':35s} {row[1]}")

cur.execute("SELECT state, COUNT(*) FROM hospitals GROUP BY 1 ORDER BY 2 DESC LIMIT 5")
print(f"\n   Top 5 states by hospital count:")
for row in cur.fetchall():
    print(f"   {row[0] or 'Unknown':35s} {row[1]}")

cur.close()
conn.close()
print("\n🔒 Connection closed.")