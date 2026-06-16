import json
from datetime import date, timedelta

from database import SessionLocal, create_tables
from models import Rep, Store


def seed_data():
    create_tables()

    db = SessionLocal()
    try:
        if db.query(Store).first() or db.query(Rep).first():
            print("Already seeded")
            return

        reps = [
            Rep(
                name="Raj",
                avg_visit_time_minutes=20,
                best_time_window_start=9,
                best_time_window_end=13,
                area_speed_factor=1.1,
                dna_profile=json.dumps(
                    {
                        "conversion_rates": {
                            "grocery": 0.45,
                            "pharmacy": 0.30,
                            "electronics": 0.20,
                            "general": 0.35,
                        }
                    }
                ),
            ),
            Rep(
                name="Priya",
                avg_visit_time_minutes=15,
                best_time_window_start=10,
                best_time_window_end=14,
                area_speed_factor=1.3,
                dna_profile=json.dumps(
                    {
                        "conversion_rates": {
                            "grocery": 0.30,
                            "pharmacy": 0.50,
                            "electronics": 0.40,
                            "general": 0.35,
                        }
                    }
                ),
            ),
            Rep(
                name="Anil",
                avg_visit_time_minutes=25,
                best_time_window_start=8,
                best_time_window_end=12,
                area_speed_factor=0.9,
                dna_profile=json.dumps(
                    {
                        "conversion_rates": {
                            "grocery": 0.35,
                            "pharmacy": 0.25,
                            "electronics": 0.50,
                            "general": 0.40,
                        }
                    }
                ),
            ),
        ]

        today = date.today()
        store_specs = [
            ("Andheri Fresh Mart", 19.1136, 72.8697, 1200, "grocery", 2, 3),
            ("Andheri Wellness Pharmacy", 19.1197, 72.8464, 1800, "pharmacy", 4, 2),
            ("Vijay Electronics Andheri", 19.1214, 72.8531, 4600, "electronics", 6, 3),
            ("Metro General Store", 19.1105, 72.8720, 950, "general", 8, 1),
            ("Bandra Bazaar Grocery", 19.0596, 72.8295, 1500, "grocery", 5, 2),
            ("Bandra Care Chemist", 19.0642, 72.8357, 2200, "pharmacy", 9, 3),
            ("Linking Road Electronics", 19.0669, 72.8339, 5000, "electronics", 12, 2),
            ("Hill Road General Traders", 19.0551, 72.8404, 1100, "general", 15, 1),
            ("Kurla Daily Needs", 19.0726, 72.8845, 800, "grocery", 7, 1),
            ("Kurla Medico", 19.0691, 72.8798, 1700, "pharmacy", 11, 2),
            ("Phoenix Tech Corner", 19.0863, 72.8888, 4300, "electronics", 3, 3),
            ("Kurla General Depot", 19.0759, 72.8827, 1300, "general", 14, 2),
            ("Vile Parle Fresh Foods", 19.0997, 72.8445, 1400, "grocery", 2, 3),
            ("Parle Pharmacy Plus", 19.1013, 72.8498, 2100, "pharmacy", 10, 2),
            ("Parle Gadget Hub", 19.1046, 72.8519, 4800, "electronics", 13, 3),
            ("Parle General Stores", 19.0969, 72.8534, 1000, "general", 6, 1),
            ("Jogeshwari Super Grocer", 19.1364, 72.8485, 1600, "grocery", 4, 2),
            ("Jogeshwari Life Care", 19.1392, 72.8421, 1900, "pharmacy", 8, 3),
            ("Jogeshwari Electronics Point", 19.1430, 72.8552, 4500, "electronics", 11, 2),
            ("Jogeshwari General Mart", 19.1325, 72.8507, 900, "general", 15, 1),
        ]

        stores = [
            Store(
                name=name,
                lat=lat,
                lng=lng,
                avg_order_value=avg_order_value,
                store_type=store_type,
                last_visited_date=(today - timedelta(days=days_ago)).isoformat(),
                base_priority=base_priority,
            )
            for (
                name,
                lat,
                lng,
                avg_order_value,
                store_type,
                days_ago,
                base_priority,
            ) in store_specs
        ]

        db.add_all(reps)
        db.add_all(stores)
        db.commit()

        print(f"Seeded {len(stores)} stores and {len(reps)} reps")
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
