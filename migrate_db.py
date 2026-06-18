import sqlite3
import os

def migrate_database(db_path):
    if not os.path.exists(db_path):
        print(f"Database {db_path} does not exist. Skipping.")
        return
        
    print(f"Migrating {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check existing columns in stores
    cursor.execute("PRAGMA table_info(stores);")
    store_cols = [col[1] for col in cursor.fetchall()]
    if "is_active" not in store_cols:
        print("Adding is_active column to stores...")
        cursor.execute("ALTER TABLE stores ADD COLUMN is_active BOOLEAN DEFAULT 1;")
    else:
        print("stores table already has is_active column.")
        
    # Check existing columns in reps
    cursor.execute("PRAGMA table_info(reps);")
    rep_cols = [col[1] for col in cursor.fetchall()]
    if "is_active" not in rep_cols:
        print("Adding is_active column to reps...")
        cursor.execute("ALTER TABLE reps ADD COLUMN is_active BOOLEAN DEFAULT 1;")
    else:
        print("reps table already has is_active column.")
        
    conn.commit()
    conn.close()
    print(f"Migration completed for {db_path}!")

if __name__ == "__main__":
    migrate_database("routegenie.db")
    migrate_database("test-routegenie.sqlite")
