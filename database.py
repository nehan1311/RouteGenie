from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./routegenie.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    import os
    import sqlite3
    import models  # noqa: F401

    Base.metadata.create_all(bind=engine)

    try:
        # Dynamically inspect and migrate columns for sqlite databases
        url_str = str(engine.url)
        db_path = url_str.replace("sqlite:///./", "").replace("sqlite:///", "")
        if db_path and os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Check stores table
            cursor.execute("PRAGMA table_info(stores);")
            store_cols = [col[1] for col in cursor.fetchall()]
            if "is_active" not in store_cols:
                cursor.execute("ALTER TABLE stores ADD COLUMN is_active BOOLEAN DEFAULT 1;")
            if "stock_depletion_rate" not in store_cols:
                cursor.execute("ALTER TABLE stores ADD COLUMN stock_depletion_rate FLOAT DEFAULT 0.1;")
            if "closed_days" not in store_cols:
                cursor.execute("ALTER TABLE stores ADD COLUMN closed_days TEXT DEFAULT 'None';")

            cursor.execute(
                "UPDATE stores SET stock_depletion_rate = 0.1 WHERE stock_depletion_rate IS NULL;"
            )
            cursor.execute(
                "UPDATE stores SET closed_days = 'None' WHERE closed_days IS NULL OR closed_days = '';"
            )
            cursor.execute(
                "UPDATE stores SET is_active = 1 WHERE is_active IS NULL;"
            )
                
            # Check reps table
            cursor.execute("PRAGMA table_info(reps);")
            rep_cols = [col[1] for col in cursor.fetchall()]
            if "is_active" not in rep_cols:
                cursor.execute("ALTER TABLE reps ADD COLUMN is_active BOOLEAN DEFAULT 1;")
                
            # Inspect coordinates
            cursor.execute("SELECT id, name, lat, lng FROM stores LIMIT 10;")
            db_info = cursor.fetchall()
            with open("db_info.txt", "w") as f:
                f.write(f"DB Path: {db_path}\n")
                f.write("Stores:\n")
                for s in db_info:
                    f.write(f"  ID {s[0]} - {s[1]}: ({s[2]}, {s[3]})\n")
                
            conn.commit()
            conn.close()
    except Exception as e:
        print(f"Error during inline table migration: {e}")
        with open("db_info.txt", "w") as f:
            f.write(f"Error: {e}\n")

def ensure_rep_users(db):
    """Keep login emails aligned with rep IDs from seed.py (Raj=1, Priya=2, Anil=3)."""
    import models
    from passlib.context import CryptContext

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    accounts = [
        ("manager@routegenie.com", "manager", None),
        ("raj@routegenie.com", "rep", 1),
        ("priya@routegenie.com", "rep", 2),
        ("anil@routegenie.com", "rep", 3),
    ]
    for email, role, rep_id in accounts:
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            user.role = role
            user.rep_id = rep_id
        else:
            db.add(
                models.User(
                    email=email,
                    hashed_password=pwd_context.hash("manager123" if role == "manager" else "rep123"),
                    role=role,
                    rep_id=rep_id,
                    created_at="2026-06-18T00:00:00",
                )
            )
    db.commit()


def seed():
    import models
    from passlib.context import CryptContext
    import json
    
    db = SessionLocal()
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    # Check if we need to seed demo reps/stores
    if db.query(models.User).count() == 0:
        print("Seeding database...")
        # Reps
        reps_data = [
            {"id": 1, "name": "Priya Sharma", "avg_visit_time_minutes": 15, "best_time_window_start": 9, "best_time_window_end": 17, "area_speed_factor": 1.1, "dna_profile": json.dumps({"conversion_rates": {"grocery": 0.62, "pharmacy": 0.41, "electronics": 0.38, "general": 0.55}}), "is_active": True},
            {"id": 2, "name": "Rahul Mehta", "avg_visit_time_minutes": 18, "best_time_window_start": 10, "best_time_window_end": 18, "area_speed_factor": 0.95, "dna_profile": json.dumps({"conversion_rates": {"grocery": 0.58, "pharmacy": 0.52, "electronics": 0.44, "general": 0.48}}), "is_active": True},
            {"id": 3, "name": "Raj", "avg_visit_time_minutes": 14, "best_time_window_start": 9, "best_time_window_end": 16, "area_speed_factor": 1.05, "dna_profile": json.dumps({"conversion_rates": {"grocery": 0.66, "pharmacy": 0.47, "electronics": 0.35, "general": 0.51}}), "is_active": True},
        ]
        for r in reps_data:
            if not db.query(models.Rep).filter(models.Rep.id == r["id"]).first():
                db.add(models.Rep(**r))
        
        # Stores
        stores_data = [
            {"id": 101, "name": "Apollo Pharmacy", "lat": 19.117, "lng": 72.865, "avg_order_value": 8200.0, "store_type": "pharmacy", "base_priority": 3, "is_active": True, "last_visited_date": "2026-06-10", "stock_depletion_rate": 0.12, "closed_days": "None"},
            {"id": 102, "name": "Ganesh Kirana", "lat": 19.121, "lng": 72.871, "avg_order_value": 4500.0, "store_type": "grocery", "base_priority": 2, "is_active": True, "last_visited_date": "2026-06-12", "stock_depletion_rate": 0.10, "closed_days": "None"},
            {"id": 103, "name": "TechZone Mobiles", "lat": 19.109, "lng": 72.878, "avg_order_value": 12500.0, "store_type": "electronics", "base_priority": 2, "is_active": True, "last_visited_date": "2026-06-08", "stock_depletion_rate": 0.08, "closed_days": "Sunday"},
            {"id": 104, "name": "City General Store", "lat": 19.115, "lng": 72.882, "avg_order_value": 3100.0, "store_type": "general", "base_priority": 1, "is_active": True, "last_visited_date": "2026-06-14", "stock_depletion_rate": 0.15, "closed_days": "None"},
            {"id": 105, "name": "Wellness Plus", "lat": 19.125, "lng": 72.859, "avg_order_value": 6700.0, "store_type": "pharmacy", "base_priority": 3, "is_active": True, "last_visited_date": "2026-06-11", "stock_depletion_rate": 0.11, "closed_days": "None"},
        ]
        for s in stores_data:
            existing = db.query(models.Store).filter(models.Store.id == s["id"]).first()
            if existing is None:
                db.add(models.Store(**s))
            else:
                for key, value in s.items():
                    if key != "id" and getattr(existing, key, None) in (None, ""):
                        setattr(existing, key, value)
        
        # Users seeded via ensure_rep_users below
            
        db.commit()

    ensure_rep_users(db)
    db.close()
