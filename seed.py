import json
import random
from datetime import date, datetime, timedelta

from auth import get_password_hash
from database import SessionLocal, create_tables
from models import Rep, Store, User


def seed_users(db):
    existing_manager = (
        db.query(User)
        .filter(User.email == "manager@routegenie.com")
        .first()
    )
    if existing_manager and db.query(User).count() >= 4:
        reps_without_manager = db.query(Rep).filter(Rep.manager_id.is_(None)).all()
        for rep in reps_without_manager:
            rep.manager_id = existing_manager.id
        db.commit()
        print("Users already seeded; manager team links verified")
        return

    reps = db.query(Rep).all()
    manager = existing_manager or User(
        email="manager@routegenie.com",
        hashed_password=get_password_hash("manager123"),
        role="manager",
        rep_id=None,
        manager_id=None,
        created_at=datetime.now().isoformat(),
    )
    if existing_manager is None:
        db.add(manager)
        db.commit()
        db.refresh(manager)

    users = []

    for rep in reps:
        rep.manager_id = manager.id
        if db.query(User).filter(User.rep_id == rep.id).first():
            continue
        users.append(
            User(
                email=f"{rep.name.lower()}@routegenie.com",
                hashed_password=get_password_hash("rep123"),
                role="rep",
                rep_id=rep.id,
                manager_id=manager.id,
                created_at=datetime.now().isoformat(),
            )
        )

    db.add_all(users)
    db.commit()
    print(f"Seeded {len(users)} users")


def seed_data():
    create_tables()

    db = SessionLocal()
    try:
        if db.query(Store).first() or db.query(Rep).first():
            print("Already seeded")
            seed_users(db)
            return

        reps = [
            Rep(
                name="Raj",
                avg_visit_time_minutes=12,
                best_time_window_start=9,
                best_time_window_end=11,
                area_speed_factor=0.9,
                dna_profile=json.dumps(
                    {
                        "conversion_rates": {
                            "kirana": 0.60,
                            "medical": 0.25,
                            "supermarket": 0.30,
                            "distributor": 0.20
                        }
                    }
                ),
            ),
            Rep(
                name="Priya",
                avg_visit_time_minutes=15,
                best_time_window_start=10,
                best_time_window_end=12,
                area_speed_factor=1.0,
                dna_profile=json.dumps(
                    {
                        "conversion_rates": {
                            "kirana": 0.20,
                            "medical": 0.35,
                            "supermarket": 0.65,
                            "distributor": 0.40
                        }
                    }
                ),
            ),
            Rep(
                name="Anil",
                avg_visit_time_minutes=18,
                best_time_window_start=11,
                best_time_window_end=13,
                area_speed_factor=1.2,
                dna_profile=json.dumps(
                    {
                        "conversion_rates": {
                            "kirana": 0.15,
                            "medical": 0.70,
                            "supermarket": 0.25,
                            "distributor": 0.30
                        }
                    }
                ),
            ),
        ]

        # Generate 20 stores deterministically using same algorithm as build_routegenie_db.py
        lat_min, lat_max = 19.1240, 19.1480
        lng_min, lng_max = 72.8140, 72.8380
        
        random.seed(42)

        def gen_coordinate():
            lat = random.uniform(lat_min, lat_max)
            lng = random.uniform(lng_min, lng_max)
            return round(lat, 5), round(lng, 5)

        store_types_to_generate = (
            ["kirana"] * 8 +
            ["medical"] * 5 +
            ["supermarket"] * 4 +
            ["distributor"] * 3
        )
        
        name_prefixes = {
            "kirana": ["Aapla", "Shree", "Ganesh", "Sai", "Balaji", "Krishna", "Venkatesh", "Maruti", "Pooja", "Laxmi"],
            "medical": ["Wellness", "Apollo", "Noble", "Plus", "Metropolis", "Care", "Life", "Jeevan", "Metikart"],
            "supermarket": ["Reliance Smart", "D-Mart", "Star", "Dorabjee's", "Nature's Basket", "More", "Fresh Mart"],
            "distributor": ["Maharashtra Traders", "Mumbai FMCG Wholesalers", "Western Pharma Dist", "Balaji Enterprises", "Sahyadri Distributors"]
        }
        
        aov_by_type = {
            "kirana": 1200.0,
            "medical": 2200.0,
            "supermarket": 4500.0,
            "distributor": 12000.0
        }
        
        closed_days_choices = ["Sunday", "None", "Sunday", "Monday", "None"]
        stores = []
        used_names = set()

        for idx, stype in enumerate(store_types_to_generate, start=1):
            lat, lng = gen_coordinate()
            
            prefix_pool = name_prefixes[stype]
            prefix_idx = (idx * 7) % len(prefix_pool)
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
                name = name + f" {idx}"
            
            if stype == "kirana":
                base_priority = 1
            elif stype == "medical":
                base_priority = 2
            else:
                base_priority = 3
                
            days_ago = 1 + (idx * 3) % 14
            last_visited = (date.today() - timedelta(days=days_ago)).isoformat()
            
            depletion_rate = round(0.05 + ((idx * 13) % 16) * 0.01, 2)
            closed_days = closed_days_choices[idx % len(closed_days_choices)]
            
            stores.append(
                Store(
                    name=store_name,
                    lat=lat,
                    lng=lng,
                    avg_order_value=aov_by_type[stype],
                    store_type=stype,
                    last_visited_date=last_visited,
                    base_priority=base_priority,
                    stock_depletion_rate=depletion_rate,
                    closed_days=closed_days
                )
            )

        db.add_all(reps)
        db.add_all(stores)
        db.commit()

        print(f"Seeded {len(stores)} stores and {len(reps)} reps")
        seed_users(db)
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
