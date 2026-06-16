import os
import json
import sqlite3
import random
import csv
from datetime import datetime, timedelta

def build_database(csv_path="source_dataset.csv", db_path="routegenie.db"):
    print(f"Reading source dataset from '{csv_path}'...")
    if not os.path.exists(csv_path):
        print(f"Error: Source file '{csv_path}' not found.")
        print("Please export your spreadsheet to CSV format and place it at 'source_dataset.csv'.")
        return False

    # 1. Parse CSV and aggregate data
    # We will gather:
    # - Sales Person statistics (revenue, number of sales)
    # - Customer / Channel statistics (revenue per order, counts)
    # - Representative names (we will map them to Raj, Priya, and Anil as required)
    transactions = []
    
    try:
        with open(csv_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                transactions.append(row)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return False

    print(f"Successfully loaded {len(transactions)} transaction records.")

    # Calculate average order values by sales channel/customer type from source data
    # Source Columns might be Sales_Channel or Customer_Type
    channel_sales = {}
    channel_counts = {}
    
    for tx in transactions:
        # Resolve sales channel / store type
        # Check standard headers or fallback
        channel = tx.get("Sales_Channel") or tx.get("Customer_Type") or "General"
        channel = channel.lower().strip()
        
        # Resolve revenue
        revenue_str = tx.get("Net_Revenue_USD") or tx.get("Gross_Sales_USD") or tx.get("Gross_Sale") or "0"
        try:
            revenue = float(revenue_str.replace(",", ""))
        except ValueError:
            revenue = 0.0
            
        if channel not in channel_sales:
            channel_sales[channel] = 0.0
            channel_counts[channel] = 0
            
        channel_sales[channel] += revenue
        channel_counts[channel] += 1

    # Print source aggregates
    print("\nSource Dataset Sales Channel Aggregates:")
    for chan, tot_sales in channel_sales.items():
        avg = tot_sales / channel_counts[chan] if channel_counts[chan] > 0 else 0
        print(f"  * {chan}: {channel_counts[chan]} orders, Avg: ${avg:.2f} USD")

    # Map source channels to RouteGenie's 4 store types:
    # - kirana (8)
    # - medical (5)
    # - supermarket (4)
    # - distributor (3)
    # We will calculate a scaling factor to convert USD to INR (e.g., 1 USD = 80 INR) for realistic pricing in Rs.
    usd_to_inr = 80.0
    
    # Defaults in case source categories don't match
    default_aov = {
        "kirana": 1200.0,
        "medical": 2200.0,
        "supermarket": 4500.0,
        "distributor": 12000.0
    }
    
    # Calculate AOV for each store type from CSV data
    supermarket_revs = []
    distributor_revs = []
    medical_revs = []
    kirana_revs = []
    
    for tx in transactions:
        rev_str = tx.get("Net_Revenue_USD") or "0"
        try:
            revenue = float(rev_str.replace(",", ""))
        except ValueError:
            revenue = 0.0
            
        channel = tx.get("Sales_Channel")
        cust_type = tx.get("Customer_Type")
        category = tx.get("Product_Category")
        
        if channel == "Modern Trade":
            supermarket_revs.append(revenue)
        if channel == "Distributor":
            distributor_revs.append(revenue)
        if category == "Personal Care":
            medical_revs.append(revenue)
        if category in ["Snacks", "Beverages", "Dairy & Breakfast"] and cust_type in ["B2B", "B2C"]:
            kirana_revs.append(revenue)
            
    aov_by_type = {
        "supermarket": round((sum(supermarket_revs) / len(supermarket_revs)) * usd_to_inr, 2) if supermarket_revs else 4500.0,
        "distributor": round((sum(distributor_revs) / len(distributor_revs)) * usd_to_inr, 2) if distributor_revs else 12000.0,
        "medical": round((sum(medical_revs) / len(medical_revs)) * usd_to_inr, 2) if medical_revs else 2200.0,
        "kirana": round((sum(kirana_revs) / len(kirana_revs)) * usd_to_inr, 2) if kirana_revs else 1200.0
    }

    print("\nCalculated INR Order Values for Target Store Types:")
    for stype, aov in aov_by_type.items():
        print(f"  * {stype}: Rs. {aov:.2f}")

    # Define Baner, Pune bounding coordinates
    # Center: 18.5592, 73.7931
    # Bounding Box: Lat [18.545, 18.575], Lng [73.785, 73.815]
    lat_min, lat_max = 18.545, 18.575
    lng_min, lng_max = 73.785, 73.815
    
    random.seed(42) # Seed for reproducible coordinates

    def gen_coordinate():
        lat = random.uniform(lat_min, lat_max)
        lng = random.uniform(lng_min, lng_max)
        return round(lat, 5), round(lng, 5)

    # 2. Synthesize 20 Stores (8 kirana, 5 medical, 4 supermarket, 3 distributor)
    store_types_to_generate = (
        ["kirana"] * 8 +
        ["medical"] * 5 +
        ["supermarket"] * 4 +
        ["distributor"] * 3
    )
    
    # Store name pools
    name_prefixes = {
        "kirana": ["Aapla", "Shree", "Ganesh", "Sai", "Balaji", "Krishna", "Venkatesh", "Maruti", "Pooja", "Laxmi"],
        "medical": ["Wellness", "Apollo", "Noble", "Plus", "Metropolis", "Care", "Life", "Jeevan", "Medikart"],
        "supermarket": ["Reliance Smart", "D-Mart", "Star", "Dorabjee's", "Nature's Basket", "More", "Fresh Mart"],
        "distributor": ["Maharashtra Traders", "Pune FMCG Wholesalers", "Western Pharma Dist", "Balaji Enterprises", "Sahyadri Distributors"]
    }
    
    store_specs = []
    used_names = set()
    
    # Stock depletion rates and closed days pools for realistic variety
    closed_days_choices = ["Sunday", "None", "Sunday", "Monday", "None"] # deterministic cycling
    
    for idx, stype in enumerate(store_types_to_generate, start=1):
        lat, lng = gen_coordinate()
        
        # Select unique name
        prefix_pool = name_prefixes[stype]
        prefix_idx = (idx * 7) % len(prefix_pool) # deterministic choice
        name = prefix_pool[prefix_idx]
        while True:
            if stype == "kirana":
                store_name = f"{name} Kirana & General Store"
            elif stype == "medical":
                store_name = f"{name} Pharmacy & Wellness"
            elif stype == "supermarket":
                store_name = f"{name} Supermarket" if "Mart" not in name and "Basket" not in name else name
            else:
                store_name = name
                
            if store_name not in used_names:
                used_names.add(store_name)
                break
            # Fallback if duplicate name
            name = name + f" {idx}"
        
        # Base priority based on AOV category (tier 1, 2, or 3)
        if stype == "kirana":
            base_priority = 1
        elif stype == "medical":
            base_priority = 2
        else:
            base_priority = 3
            
        # Last visited date (simulate 1 to 14 days ago)
        days_ago = 1 + (idx * 3) % 14
        last_visited = (datetime.now() - timedelta(days=days_ago)).date().isoformat()
        
        # stock depletion rate (between 0.05 and 0.20)
        depletion_rate = round(0.05 + ((idx * 13) % 16) * 0.01, 2)
        
        # closed days
        closed_days = closed_days_choices[idx % len(closed_days_choices)]
        
        store_specs.append({
            "id": idx,
            "name": store_name,
            "lat": lat,
            "lng": lng,
            "avg_order_value": aov_by_type[stype],
            "store_type": stype,
            "last_visited_date": last_visited,
            "base_priority": base_priority,
            "stock_depletion_rate": depletion_rate,
            "closed_days": closed_days
        })

    # 3. Create Reps & DNA Profiles (Raj, Priya, Anil)
    reps_specs = [
        {
            "id": 1,
            "name": "Raj",
            "avg_visit_time_minutes": 12,
            "best_time_window_start": 9,
            "best_time_window_end": 11,
            "area_speed_factor": 0.9,
            "dna_profile": json.dumps({
                "conversion_rates": {
                    "kirana": 0.60,
                    "medical": 0.25,
                    "supermarket": 0.30,
                    "distributor": 0.20
                }
            })
        },
        {
            "id": 2,
            "name": "Priya",
            "avg_visit_time_minutes": 15,
            "best_time_window_start": 10,
            "best_time_window_end": 12,
            "area_speed_factor": 1.0,
            "dna_profile": json.dumps({
                "conversion_rates": {
                    "kirana": 0.20,
                    "medical": 0.35,
                    "supermarket": 0.65,
                    "distributor": 0.40
                }
            })
        },
        {
            "id": 3,
            "name": "Anil",
            "avg_visit_time_minutes": 18,
            "best_time_window_start": 11,
            "best_time_window_end": 13,
            "area_speed_factor": 1.2,
            "dna_profile": json.dumps({
                "conversion_rates": {
                    "kirana": 0.15,
                    "medical": 0.70,
                    "supermarket": 0.25,
                    "distributor": 0.30
                }
            })
        }
    ]

    # 4. Generate visit logs from historical transactional data (matching reps to stores)
    visit_logs_specs = []
    
    historical_txs = [tx for tx in transactions if tx.get("Order_Date")]
    # Sort by date
    try:
        historical_txs.sort(key=lambda x: x.get("Order_Date", ""))
    except Exception:
        pass
        
    log_count = min(len(historical_txs), 500)
    
    for idx in range(log_count):
        tx = historical_txs[idx]
        
        # Map source dates (usually MM/DD/YYYY or similar) to YYYY-MM-DDTHH:MM:SS
        raw_date = tx.get("Order_Date", "")
        parsed_dt = None
        for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%d-%m-%Y"):
            try:
                parsed_dt = datetime.strptime(raw_date, fmt)
                break
            except ValueError:
                continue
        
        if not parsed_dt:
            parsed_dt = datetime.now() - timedelta(days=1 + (idx % 10))
            
        visit_hour = 9 + (idx % 9)
        visit_minute = (idx * 7) % 60
        visit_dt = parsed_dt.replace(hour=visit_hour, minute=visit_minute, second=0, microsecond=0)
        visited_at_str = visit_dt.strftime("%Y-%m-%dT%H:%M:%S")

        # Specialty matching
        channel = tx.get("Sales_Channel")
        cust_type = tx.get("Customer_Type")
        category = tx.get("Product_Category")
        
        if category == "Personal Care":
            store_id = 9 + (idx % 5)
            rep_id = 3 # Anil
        elif channel == "Modern Trade":
            store_id = 14 + (idx % 4)
            rep_id = 2 # Priya
        elif channel == "Distributor":
            store_id = 18 + (idx % 3)
            rep_id = 1 + (idx % 3)
        else:
            store_id = 1 + (idx % 8)
            rep_id = 1 # Raj
            
        rev_str = tx.get("Net_Revenue_USD") or "0"
        try:
            usd_rev = float(rev_str.replace(",", ""))
            if usd_rev < 0:
                usd_rev = 0.0
            inr_rev = round(usd_rev * usd_to_inr, 2)
        except ValueError:
            inr_rev = 0.0
            
        outcome = "sale" if inr_rev > 0 else "no_sale"
        
        product_name = tx.get("Product_Name", "goods")
        brand = tx.get("Brand", "FMCG")
        notes = f"Pitched {product_name} ({brand}). "
        if outcome == "sale":
            notes += f"Order placed for {tx.get('Units_Sold', '1')} units."
        else:
            notes += "Store owner busy, requested visit next week."

        visit_logs_specs.append({
            "id": idx + 1,
            "rep_id": rep_id,
            "store_id": store_id,
            "visited_at": visited_at_str,
            "outcome": outcome,
            "revenue": inr_rev if outcome == "sale" else 0.0,
            "notes": notes
        })

    # 5. Populate SQLite database
    print(f"\nSeeding database '{db_path}'...")
    
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except OSError as e:
            print(f"Warning: Could not remove old database file: {e}. Attempting table resets instead.")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Enable foreign keys
        cursor.execute("PRAGMA foreign_keys = ON;")
        
        # Recreate tables (standard structures from models.py)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS stores (
            id INTEGER PRIMARY KEY,
            name TEXT,
            lat REAL,
            lng REAL,
            avg_order_value REAL,
            store_type TEXT,
            last_visited_date TEXT,
            base_priority INTEGER,
            stock_depletion_rate REAL,
            closed_days TEXT
        );
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS reps (
            id INTEGER PRIMARY KEY,
            name TEXT,
            avg_visit_time_minutes INTEGER,
            best_time_window_start INTEGER,
            best_time_window_end INTEGER,
            area_speed_factor REAL,
            dna_profile TEXT
        );
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS route_entries (
            id INTEGER PRIMARY KEY,
            rep_id INTEGER,
            date TEXT,
            store_ids_ordered TEXT,
            status TEXT,
            FOREIGN KEY(rep_id) REFERENCES reps(id)
        );
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS visit_logs (
            id INTEGER PRIMARY KEY,
            rep_id INTEGER,
            store_id INTEGER,
            visited_at TEXT,
            outcome TEXT,
            revenue REAL,
            notes TEXT,
            FOREIGN KEY(rep_id) REFERENCES reps(id),
            FOREIGN KEY(store_id) REFERENCES stores(id)
        );
        """)
        
        # Clear existing rows
        cursor.execute("DELETE FROM visit_logs;")
        cursor.execute("DELETE FROM route_entries;")
        cursor.execute("DELETE FROM stores;")
        cursor.execute("DELETE FROM reps;")
        
        # Insert reps
        for r in reps_specs:
            cursor.execute("""
            INSERT INTO reps (id, name, avg_visit_time_minutes, best_time_window_start, best_time_window_end, area_speed_factor, dna_profile)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """, (r["id"], r["name"], r["avg_visit_time_minutes"], r["best_time_window_start"], r["best_time_window_end"], r["area_speed_factor"], r["dna_profile"]))
            
        # Insert stores
        for s in store_specs:
            cursor.execute("""
            INSERT INTO stores (id, name, lat, lng, avg_order_value, store_type, last_visited_date, base_priority, stock_depletion_rate, closed_days)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (s["id"], s["name"], s["lat"], s["lng"], s["avg_order_value"], s["store_type"], s["last_visited_date"], s["base_priority"], s["stock_depletion_rate"], s["closed_days"]))
            
        # Insert visit logs
        for vl in visit_logs_specs:
            cursor.execute("""
            INSERT INTO visit_logs (id, rep_id, store_id, visited_at, outcome, revenue, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """, (vl["id"], vl["rep_id"], vl["store_id"], vl["visited_at"], vl["outcome"], vl["revenue"], vl["notes"]))
            
        conn.commit()
        conn.close()
        print(f"Database successfully generated!")
        print(f"  * Seeded {len(reps_specs)} Sales Representatives (Raj, Priya, Anil)")
        print(f"  * Seeded {len(store_specs)} Stores in Baner, Pune (8 kirana, 5 medical, 4 supermarket, 3 distributor)")
        print(f"  * Seeded {len(visit_logs_specs)} Historical Visit Logs mapped to source transactions")
        return True
    except Exception as e:
        print(f"Database generation failed: {e}")
        return False

if __name__ == "__main__":
    import sys
    csv_file = "source_dataset.csv"
    if len(sys.argv) > 1:
        csv_file = sys.argv[1]
    
    success = build_database(csv_file)
    if success:
        # Run verification check immediately
        print("\n" + "="*50)
        print("Running verify_dataset.py on newly built database...")
        print("="*50)
        from verify_dataset import verify_database
        verify_database("routegenie.db")
