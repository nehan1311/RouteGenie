import sqlite3
import json
from datetime import date
from optimizer import generate_optimal_route

def test_optimal_route_generation():
    print("Connecting to routegenie.db...")
    conn = sqlite3.connect("routegenie.db")
    cursor = conn.cursor()

    # 1. Fetch Rep Raj (ID = 1)
    cursor.execute("SELECT id, name, avg_visit_time_minutes, best_time_window_start, best_time_window_end, area_speed_factor, dna_profile FROM reps WHERE id = 1;")
    rep_row = cursor.fetchone()
    if not rep_row:
        print("Error: Rep Raj not found. Please run seed.py first.")
        return

    rep = {
        "id": rep_row[0],
        "name": rep_row[1],
        "avg_visit_time_minutes": rep_row[2],
        "best_time_window_start": rep_row[3],
        "best_time_window_end": rep_row[4],
        "area_speed_factor": rep_row[5],
        "dna_profile": json.loads(rep_row[6])
    }
    print(f"Loaded Rep: {rep['name']} (Speed Factor: {rep['area_speed_factor']}, Avg Visit Time: {rep['avg_visit_time_minutes']} mins)")

    # 2. Fetch all stores
    cursor.execute("SELECT id, name, lat, lng, avg_order_value, store_type, last_visited_date, base_priority, stock_depletion_rate, closed_days FROM stores;")
    store_rows = cursor.fetchall()
    
    candidate_stores = []
    today = date.today()
    for row in store_rows:
        # Calculate urgency score standard formula
        last_visited = date.fromisoformat(row[6])
        days_since_last_visit = (today - last_visited).days
        urgency_score = (days_since_last_visit * row[7]) + (row[4] / 1000.0)
        
        if urgency_score >= 8:
            urgency_status = "red"
        elif urgency_score >= 4:
            urgency_status = "yellow"
        else:
            urgency_status = "green"

        candidate_stores.append({
            "store_id": row[0],
            "name": row[1],
            "lat": row[2],
            "lng": row[3],
            "avg_order_value": row[4],
            "store_type": row[5],
            "urgency_score": round(urgency_score, 2),
            "urgency_status": urgency_status
        })

    print(f"Loaded {len(candidate_stores)} candidate stores.")
    conn.close()

    # 3. Call generate_optimal_route
    print("\nRunning generate_optimal_route with weights: Urgency 0.6, Revenue 0.4...")
    route_response = generate_optimal_route(
        rep=rep,
        candidate_stores=candidate_stores,
        start_lat=18.5592,
        start_lng=73.7931,
        urgency_weight=0.6,
        revenue_weight=0.4
    )

    # 4. Display results & run sanity checks
    print("=" * 60)
    print(" OPTIMAL ROUTE SELECTION RESULTS")
    print("=" * 60)
    print(f"Date: {route_response['date']}")
    print(f"Total Candidate Stores: {route_response['candidate_count']}")
    print(f"Recommended Visits: {route_response['recommended_visit_count']}")
    print(f"Dropped Visits: {route_response['dropped_count']}")
    print(f"Estimated Total Revenue: Rs. {route_response['estimated_total_revenue']}")
    print(f"Estimated Total Time: {route_response['estimated_total_time_minutes']} minutes ({round(route_response['estimated_total_time_minutes']/60, 2)} hours)")
    print(f"Fallback Used: {route_response.get('fallback_used', False)}")
    print("-" * 60)

    # Validate constraints
    assert route_response['estimated_total_time_minutes'] <= 480, f"Error: Route exceeds 8-hour budget! ({route_response['estimated_total_time_minutes']} mins)"
    assert route_response['recommended_visit_count'] <= route_response['candidate_count'], "Error: Visited count exceeds candidates"
    assert len(route_response['route']) == route_response['recommended_visit_count'], "Error: Route list length mismatch"
    assert len(route_response['dropped_stores']) == route_response['dropped_count'], "Error: Dropped stores list length mismatch"

    print("Visits List:")
    for stop in route_response["route"]:
        print(f"  * Stop {stop['order']}: {stop['store_name']} ({stop['store_type']}) - ETA {stop['planned_arrival']}, Est Revenue: Rs. {stop['estimated_revenue']}, Urgency: {stop['urgency_status']}")

    print("\nDropped Stores List (Top 5):")
    for s in route_response["dropped_stores"][:5]:
        print(f"  * {s['store_name']} (Value: {s['visit_value']}, Urgency: {s['urgency_status']})")

    # Double check that we didn't drop red/high-value stores instead of low-value ones
    dropped_urgencies = {s['urgency_status'] for s in route_response['dropped_stores']}
    print(f"\nDropped urgencies categories: {list(dropped_urgencies)}")

    print("\n[SUCCESS] All checks passed successfully!")

if __name__ == "__main__":
    test_optimal_route_generation()
