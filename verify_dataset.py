import os
import sys
import json
import sqlite3
from datetime import datetime, date

# Color constants for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

# Fallback for Windows consoles that don't support ANSI colors by default
if os.name == 'nt':
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except Exception:
        # If color activation fails, disable colors
        class Colors:
            HEADER = BLUE = CYAN = GREEN = WARNING = FAIL = ENDC = BOLD = UNDERLINE = ""

def print_section(title):
    print(f"\n{Colors.BOLD}{Colors.HEADER}{'=' * 60}")
    print(f" {title}")
    print(f"{'=' * 60}{Colors.ENDC}")

def print_ok(msg):
    print(f"[{Colors.GREEN}OK{Colors.ENDC}] {msg}")

def print_warn(msg):
    print(f"[{Colors.WARNING}WARNING{Colors.ENDC}] {msg}")

def print_error(msg):
    print(f"[{Colors.FAIL}ERROR{Colors.ENDC}] {msg}")

def verify_database(db_path="./routegenie.db"):
    if not os.path.exists(db_path):
        print_error(f"Database file not found at '{db_path}'.")
        print("Please place your database file in the workspace or pass its path as an argument.")
        print("Example: python verify_dataset.py /path/to/database.db")
        return False

    print_section(f"RouteGenie Dataset Compatibility Check: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
    except Exception as e:
        print_error(f"Failed to connect to the database: {e}")
        return False

    has_errors = False
    has_warnings = False

    # 1. Check Tables Existence
    required_tables = {
        "stores": [
            ("id", "INTEGER"), ("name", "VARCHAR"), ("lat", "FLOAT"), ("lng", "FLOAT"),
            ("avg_order_value", "FLOAT"), ("store_type", "VARCHAR"),
            ("last_visited_date", "VARCHAR"), ("base_priority", "INTEGER"),
            ("stock_depletion_rate", "FLOAT"), ("closed_days", "VARCHAR")
        ],
        "reps": [
            ("id", "INTEGER"), ("name", "VARCHAR"), ("avg_visit_time_minutes", "INTEGER"),
            ("best_time_window_start", "INTEGER"), ("best_time_window_end", "INTEGER"),
            ("area_speed_factor", "FLOAT"), ("dna_profile", "VARCHAR")
        ],
        "route_entries": [
            ("id", "INTEGER"), ("rep_id", "INTEGER"), ("date", "VARCHAR"),
            ("store_ids_ordered", "VARCHAR"), ("status", "VARCHAR")
        ],
        "visit_logs": [
            ("id", "INTEGER"), ("rep_id", "INTEGER"), ("store_id", "INTEGER"),
            ("visited_at", "VARCHAR"), ("outcome", "VARCHAR"), ("revenue", "FLOAT"),
            ("notes", "VARCHAR")
        ]
    }

    print_section("1. Table & Column Existence Validation")
    existing_tables = []
    
    for table, expected_columns in required_tables.items():
        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?;", (table,))
        res = cursor.fetchone()
        if not res:
            print_error(f"Table '{table}' is missing!")
            has_errors = True
            continue
        
        print_ok(f"Table '{table}' exists.")
        existing_tables.append(table)
        
        # Check columns
        cursor.execute(f"PRAGMA table_info({table});")
        columns = {row[1]: row[2] for row in cursor.fetchall()}
        
        for col_name, expected_type in expected_columns:
            if col_name not in columns:
                print_error(f"Table '{table}' is missing required column: '{col_name}'")
                has_errors = True
            else:
                actual_type = columns[col_name].upper()
                # Simple check for general type family compatibility
                if expected_type in ["FLOAT", "REAL"] and actual_type not in ["FLOAT", "REAL", "NUMERIC", "DOUBLE"]:
                    print_warn(f"Table '{table}' column '{col_name}' has type '{actual_type}' but application expects floating-point values.")
                    has_warnings = True
                elif expected_type == "INTEGER" and actual_type not in ["INTEGER", "INT"]:
                    print_warn(f"Table '{table}' column '{col_name}' has type '{actual_type}' but application expects integer values.")
                    has_warnings = True

    if has_errors:
        print_error("Schema checks failed. Fix the table structure before proceeding.")
        conn.close()
        return False

    # 2. Extract Data Counts
    print_section("2. Record Counts Summary")
    counts = {}
    for table in required_tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table};")
        count = cursor.fetchone()[0]
        counts[table] = count
        print(f"   * Table '{table}': {count} records found")

    if counts["stores"] == 0:
        print_warn("No stores found in database. Seed stores before testing routing.")
        has_warnings = True
    if counts["reps"] == 0:
        print_error("No reps found in database. RouteGenie needs at least one sales representative to function.")
        has_errors = True

    # 3. Validate Reps Table Data
    print_section("3. Sales Representatives (Reps) Validation")
    cursor.execute("SELECT id, name, avg_visit_time_minutes, best_time_window_start, best_time_window_end, area_speed_factor, dna_profile FROM reps;")
    reps_data = cursor.fetchall()
    
    rep_ids = set()
    rep_store_types_map = {} # Maps rep_id to list of store_types in their DNA
    
    for rep in reps_data:
        r_id, r_name, r_visit_time, r_start, r_end, r_speed, r_dna = rep
        rep_ids.add(r_id)
        
        print(f"Verifying Rep ID {r_id} ({r_name}):")
        
        # Verify visit time
        if r_visit_time is None or r_visit_time <= 0:
            print_error(f"  - Invalid avg_visit_time_minutes: {r_visit_time}. Must be > 0.")
            has_errors = True
        else:
            print_ok(f"  - avg_visit_time_minutes: {r_visit_time} (Valid)")
            
        # Verify best time window
        if r_start is None or r_end is None:
            print_error("  - Time windows cannot be null.")
            has_errors = True
        elif r_start < 0 or r_start > 24 or r_end < 0 or r_end > 24:
            print_error(f"  - Invalid time window bounds [{r_start}, {r_end}]. Must be between 0 and 24.")
            has_errors = True
        elif r_start >= r_end:
            print_error(f"  - Start time window ({r_start}) must be before end time window ({r_end}).")
            has_errors = True
        else:
            print_ok(f"  - Time window: {r_start}:00 to {r_end}:00 (Valid)")
            
        # Verify area speed factor
        if r_speed is None or r_speed <= 0:
            print_error(f"  - Invalid area_speed_factor: {r_speed}. Must be > 0.")
            has_errors = True
        else:
            print_ok(f"  - Area speed factor: {r_speed} (Valid)")
            
        # Verify DNA Profile JSON
        try:
            profile = json.loads(r_dna) if r_dna else {}
            conversion_rates = profile.get("conversion_rates", profile)
            if not isinstance(conversion_rates, dict):
                print_error("  - DNA profile JSON structure must contain a dictionary of 'conversion_rates'.")
                has_errors = True
            elif len(conversion_rates) == 0:
                print_error("  - DNA profile conversion_rates cannot be empty (causes error in routing summaries).")
                has_errors = True
            else:
                # Validate rates are floats
                invalid_rates = {k: v for k, v in conversion_rates.items() if not isinstance(v, (int, float))}
                if invalid_rates:
                    print_error(f"  - DNA profile conversion rates contain non-numeric values: {invalid_rates}")
                    has_errors = True
                else:
                    rep_store_types_map[r_id] = list(conversion_rates.keys())
                    print_ok(f"  - DNA Profile conversion rates for store types: {list(conversion_rates.keys())} (Valid)")
        except json.JSONDecodeError:
            print_error(f"  - 'dna_profile' is not valid JSON! Contents: '{r_dna}'")
            has_errors = True

    # 4. Validate Stores Table Data
    print_section("4. Stores Validation")
    cursor.execute("SELECT id, name, lat, lng, avg_order_value, store_type, last_visited_date, base_priority, stock_depletion_rate, closed_days FROM stores;")
    stores_data = cursor.fetchall()
    
    store_ids = set()
    store_types_in_db = set()
    
    # Andheri West, Mumbai bounds check
    mumbai_lat_min, mumbai_lat_max = 19.1240, 19.1480
    mumbai_lng_min, mumbai_lng_max = 72.8140, 72.8380
    
    for store in stores_data:
        s_id, s_name, s_lat, s_lng, s_aov, s_type, s_last_visit, s_priority, s_depletion, s_closed = store
        store_ids.add(s_id)
        store_types_in_db.add(s_type)
        
        # Verify coordinates
        if s_lat is None or s_lng is None:
            print_error(f"Store ID {s_id} ({s_name}): Coordinates are null!")
            has_errors = True
        else:
            in_mumbai = (mumbai_lat_min <= s_lat <= mumbai_lat_max) and (mumbai_lng_min <= s_lng <= mumbai_lng_max)
            if not in_mumbai:
                print_error(f"Store ID {s_id} ({s_name}): Coordinates ({s_lat}, {s_lng}) are outside Andheri West, Mumbai bounds ({mumbai_lat_min}-{mumbai_lat_max}, {mumbai_lng_min}-{mumbai_lng_max})!")
                has_errors = True
                    
        # Verify AOV
        if s_aov is None or s_aov < 0:
            print_error(f"Store ID {s_id} ({s_name}): Invalid avg_order_value: {s_aov}. Must be >= 0.")
            has_errors = True
            
        # Verify base priority
        if s_priority is None or not isinstance(s_priority, int):
            print_error(f"Store ID {s_id} ({s_name}): base_priority '{s_priority}' must be an integer.")
            has_errors = True
            
        # Verify last_visited_date
        if not s_last_visit:
            print_error(f"Store ID {s_id} ({s_name}): last_visited_date is empty/null! Application will fail on urgency checks.")
            has_errors = True
        else:
            try:
                date.fromisoformat(s_last_visit)
            except ValueError:
                print_error(f"Store ID {s_id} ({s_name}): last_visited_date '{s_last_visit}' is not in YYYY-MM-DD format! Application will crash at date.fromisoformat().")
                has_errors = True

        # Verify stock depletion rate
        if s_depletion is None:
            print_error(f"Store ID {s_id} ({s_name}): stock_depletion_rate is null!")
            has_errors = True
        elif not isinstance(s_depletion, (int, float)) or not (0.05 <= s_depletion <= 0.20):
            print_error(f"Store ID {s_id} ({s_name}): stock_depletion_rate '{s_depletion}' must be a float between 0.05 and 0.20.")
            has_errors = True

        # Verify closed days
        if s_closed is None:
            print_error(f"Store ID {s_id} ({s_name}): closed_days is null!")
            has_errors = True
        elif not isinstance(s_closed, str):
            print_error(f"Store ID {s_id} ({s_name}): closed_days '{s_closed}' must be a string.")
            has_errors = True

    # Check store types compatibility with reps dna profile
    print("\nVerifying Store Types Mapping with Rep DNA Profiles:")
    for rep_id, rep_store_types in rep_store_types_map.items():
        cursor.execute("SELECT name FROM reps WHERE id=?;", (rep_id,))
        rep_name = cursor.fetchone()[0]
        
        missing_types = store_types_in_db - set(rep_store_types)
        if missing_types:
            print_warn(f"  - Rep '{rep_name}' (ID {rep_id}) is missing conversion rates for store types: {list(missing_types)}")
            print(f"    {Colors.CYAN}Note: Routing will default to a 0% conversion rate for these types, leading to 0 estimated revenue.{Colors.ENDC}")
            has_warnings = True
        else:
            print_ok(f"  - Rep '{rep_name}' (ID {rep_id}) has conversion rates for all store types in database.")

    # 5. Validate Route Entries Data
    if counts["route_entries"] > 0:
        print_section("5. Route Entries Validation")
        cursor.execute("SELECT id, rep_id, date, store_ids_ordered, status FROM route_entries;")
        routes_data = cursor.fetchall()
        
        for route in routes_data:
            rt_id, rt_rep_id, rt_date, rt_store_ids, rt_status = route
            
            # Check foreign key rep_id
            if rt_rep_id not in rep_ids:
                print_error(f"Route ID {rt_id}: rep_id {rt_rep_id} does not exist in reps table.")
                has_errors = True
                
            # Validate date
            try:
                date.fromisoformat(rt_date)
            except ValueError:
                print_error(f"Route ID {rt_id}: date '{rt_date}' is not in YYYY-MM-DD format.")
                has_errors = True
                
            # Validate store_ids_ordered JSON list of ints
            try:
                ordered_ids = json.loads(rt_store_ids)
                if not isinstance(ordered_ids, list):
                    print_error(f"Route ID {rt_id}: store_ids_ordered must be a JSON list.")
                    has_errors = True
                else:
                    invalid_ids = [sid for sid in ordered_ids if not isinstance(sid, int)]
                    if invalid_ids:
                        print_error(f"Route ID {rt_id}: store_ids_ordered contains non-integer elements: {invalid_ids}")
                        has_errors = True
                    else:
                        missing_stores = [sid for sid in ordered_ids if sid not in store_ids]
                        if missing_stores:
                            print_error(f"Route ID {rt_id}: store_ids_ordered contains store IDs that do not exist: {missing_stores}")
                            has_errors = True
            except json.JSONDecodeError:
                print_error(f"Route ID {rt_id}: store_ids_ordered is not valid JSON! Contents: '{rt_store_ids}'")
                has_errors = True

    # 6. Validate Visit Logs Data
    if counts["visit_logs"] > 0:
        print_section("6. Visit Logs Validation")
        cursor.execute("SELECT id, rep_id, store_id, visited_at, outcome, revenue, notes FROM visit_logs;")
        logs_data = cursor.fetchall()
        
        for log in logs_data:
            l_id, l_rep_id, l_store_id, l_visited_at, l_outcome, l_revenue, l_notes = log
            
            # Foreign key checks
            if l_rep_id not in rep_ids:
                print_error(f"Visit Log ID {l_id}: rep_id {l_rep_id} does not exist in reps table.")
                has_errors = True
            if l_store_id not in store_ids:
                print_error(f"Visit Log ID {l_id}: store_id {l_store_id} does not exist in stores table.")
                has_errors = True
                
            # Validate visited_at format (MUST be at least 16 characters for visited_at[11:16] string slicing)
            if not l_visited_at:
                print_error(f"Visit Log ID {l_id}: visited_at is null or empty.")
                has_errors = True
            elif len(l_visited_at) < 16:
                print_error(f"Visit Log ID {l_id}: visited_at value '{l_visited_at}' is too short (length {len(l_visited_at)}). It MUST be in ISO format like 'YYYY-MM-DDTHH:MM:SS' because reports router uses string slicing `visited_at[11:16]` which will extract incorrect data or raise errors.")
                has_errors = True
            else:
                try:
                    # check if the start of the string can be parsed as a datetime
                    # format can be YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD HH:MM:SS
                    # we will replace 'T' with ' ' and check
                    cleaned_dt = l_visited_at.replace('T', ' ')[:19]
                    datetime.strptime(cleaned_dt, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    print_warn(f"Visit Log ID {l_id}: visited_at value '{l_visited_at}' does not follow standard ISO datetime format (YYYY-MM-DDTHH:MM:SS).")
                    has_warnings = True

            # Validate revenue
            if l_revenue is not None and l_revenue < 0:
                print_error(f"Visit Log ID {l_id}: revenue cannot be negative: {l_revenue}")
                has_errors = True

    # Close connection
    conn.close()
    
    print_section("Summary of Verification")
    if has_errors:
        print_error("Validation completed with CRITICAL COMPATIBILITY ERRORS. The database will cause crashes in the RouteGenie application.")
        return False
    elif has_warnings:
        print_warn("Validation completed with WARNINGS. The database is compatible, but some values (like unmatched store types or distant coordinates) might lead to sub-optimal behavior or 0 revenue calculations.")
        return True
    else:
        print_ok("Congratulations! The dataset is 100% compatible and optimized for the RouteGenie application.")
        return True

if __name__ == "__main__":
    db_path = "./routegenie.db"
    if len(sys.argv) > 1:
        db_path = sys.argv[1]
    
    success = verify_database(db_path)
    sys.exit(0 if success else 1)
