import json
from datetime import date, timedelta
from fastapi.testclient import TestClient

from main import app
from database import SessionLocal, create_tables
from models import User, Store, Rep
from auth import get_password_hash

# Initialize test client
client = TestClient(app)

def run_tests():
    print("Initializing Database & Running Inline Migration...")
    create_tables()
    db = SessionLocal()
    
    # Ensure manager and rep users exist for testing
    print("Ensuring users are seeded...")
    manager_email = "manager@routegenie.com"
    rep_email = "raj@routegenie.com"
    
    manager = db.query(User).filter(User.email == manager_email).first()
    if not manager:
        manager = User(
            email=manager_email,
            hashed_password=get_password_hash("manager123"),
            role="manager",
            created_at="2026-06-18T00:00:00"
        )
        db.add(manager)
        
    rep = db.query(User).filter(User.email == rep_email).first()
    if not rep:
        # Check if Raj rep exists
        raj_rep = db.query(Rep).filter(Rep.name == "Raj").first()
        raj_rep_id = raj_rep.id if raj_rep else 1
        rep = User(
            email=rep_email,
            hashed_password=get_password_hash("rep123"),
            role="rep",
            rep_id=raj_rep_id,
            created_at="2026-06-18T00:00:00"
        )
        db.add(rep)
    db.commit()
    db.close()

    print("\n--- AUTHENTICATION ---")
    # Login as Manager
    response = client.post("/auth/login", data={"username": manager_email, "password": "manager123"})
    assert response.status_code == 200, f"Manager login failed: {response.text}"
    manager_token = response.json()["access_token"]
    manager_headers = {"Authorization": f"Bearer {manager_token}"}
    print("Logged in as Manager successfully.")

    # Login as Rep (Raj)
    response = client.post("/auth/login", data={"username": rep_email, "password": "rep123"})
    assert response.status_code == 200, f"Rep login failed: {response.text}"
    rep_token = response.json()["access_token"]
    rep_headers = {"Authorization": f"Bearer {rep_token}"}
    print("Logged in as Rep (Raj) successfully.")

    # ==========================================
    # STORES CRUD TEST SEQUENCE
    # ==========================================
    print("\n--- STORES TEST SEQUENCE ---")

    # 1. POST /stores with a new valid store
    new_store_data = {
        "name": "Test General Store",
        "lat": 19.135,
        "lng": 72.825,
        "avg_order_value": 1500.0,
        "store_type": "general",
        "base_priority": 2
    }
    response = client.post("/stores/", json=new_store_data, headers=manager_headers)
    assert response.status_code in [200, 201], f"Create store failed: {response.text}"
    store = response.json()
    store_id = store["id"]
    assert store["is_active"] is True
    assert store["name"] == "Test General Store"
    print(f"Step 1 Passed: Store created successfully with ID {store_id} and is_active: {store['is_active']}")

    # 2. GET /stores -> confirm the new store appears
    response = client.get("/stores/", headers=manager_headers)
    assert response.status_code == 200
    stores = response.json()
    found = any(s["id"] == store_id for s in stores)
    assert found is True
    print("Step 2 Passed: New store appears in normal /stores listing.")

    # 3. PUT /stores/{new_id} changing just avg_order_value
    update_data = {
        "avg_order_value": 2500.0
    }
    response = client.put(f"/stores/{store_id}", json=update_data, headers=manager_headers)
    assert response.status_code == 200
    updated_store = response.json()
    assert updated_store["avg_order_value"] == 2500.0
    assert updated_store["name"] == "Test General Store"  # Unchanged
    print("Step 3 Passed: Partial update successfully updated only avg_order_value.")

    # 4. DELETE /stores/{new_id} -> soft delete
    response = client.delete(f"/stores/{store_id}", headers=manager_headers)
    assert response.status_code == 200
    assert response.json() == {"message": "Store deactivated", "store_id": store_id}
    print("Step 4 Passed: Store soft-deactivated successfully.")

    # Try deleting it again (should raise 400)
    response = client.delete(f"/stores/{store_id}", headers=manager_headers)
    assert response.status_code == 400
    print("Step 4b Passed: Re-deactivation rejected with 400.")

    # 5. GET /stores -> confirm the deactivated store no longer appears
    response = client.get("/stores/", headers=manager_headers)
    assert response.status_code == 200
    stores = response.json()
    found = any(s["id"] == store_id for s in stores)
    assert found is False
    print("Step 5 Passed: Deactivated store does not appear in normal listing.")

    # 6. GET /stores?include_inactive=true -> confirm it does appear, with is_active: false
    response = client.get("/stores/?include_inactive=true", headers=manager_headers)
    assert response.status_code == 200
    stores = response.json()
    matching_store = next((s for s in stores if s["id"] == store_id), None)
    assert matching_store is not None
    assert matching_store["is_active"] is False
    print("Step 6 Passed: Deactivated store appears when include_inactive=true with is_active: false.")

    # Reactivate store for completeness
    response = client.post(f"/stores/{store_id}/reactivate", headers=manager_headers)
    assert response.status_code == 200
    assert response.json()["is_active"] is True
    print("Step 6b Passed: Store reactivated successfully.")

    # 7. POST /stores with an invalid store_type (e.g. "electronics2") -> confirm rejected
    invalid_store_data = new_store_data.copy()
    invalid_store_data["store_type"] = "electronics2"
    response = client.post("/stores/", json=invalid_store_data, headers=manager_headers)
    assert response.status_code == 422
    print("Step 7 Passed: Invalid store_type rejected with 422 validation error.")

    # Check invalid lat bounds
    invalid_store_data = new_store_data.copy()
    invalid_store_data["lat"] = 2.0
    response = client.post("/stores/", json=invalid_store_data, headers=manager_headers)
    assert response.status_code == 422
    print("Step 7b Passed: Invalid lat coordinate bounds rejected with 422.")


    # ==========================================
    # REPS CRUD TEST SEQUENCE
    # ==========================================
    print("\n--- REPS TEST SEQUENCE ---")

    # 8. POST /reps with a new valid rep
    new_rep_data = {
        "name": "Vikram",
        "avg_visit_time_minutes": 20,
        "best_time_window_start": 9,
        "best_time_window_end": 12,
        "area_speed_factor": 1.1,
        "dna_profile": {
            "conversion_rates": {
                "grocery": 0.5,
                "pharmacy": 0.4,
                "electronics": 0.3,
                "general": 0.6
            }
        }
    }
    response = client.post("/reps/", json=new_rep_data, headers=manager_headers)
    assert response.status_code in [200, 201], f"Create rep failed: {response.text}"
    rep_obj = response.json()
    rep_id = rep_obj["id"]
    assert rep_obj["is_active"] is True
    assert rep_obj["name"] == "Vikram"
    print(f"Step 8.1 Passed: Rep created successfully with ID {rep_id} and is_active: {rep_obj['is_active']}")

    # GET /reps -> confirm new rep appears in summary list
    response = client.get("/reps/", headers=manager_headers)
    assert response.status_code == 200
    reps = response.json()
    found = any(r["id"] == rep_id for r in reps)
    assert found is True
    print("Step 8.2 Passed: New rep appears in normal /reps summary listing.")

    # PUT /reps/{new_id} changing just area_speed_factor
    update_rep_data = {
        "area_speed_factor": 1.5
    }
    response = client.put(f"/reps/{rep_id}", json=update_rep_data, headers=manager_headers)
    assert response.status_code == 200
    updated_rep = response.json()
    assert updated_rep["area_speed_factor"] == 1.5
    assert updated_rep["name"] == "Vikram"  # Unchanged
    print("Step 8.3 Passed: Partial update successfully updated only area_speed_factor.")

    # DELETE /reps/{new_id} -> soft delete
    response = client.delete(f"/reps/{rep_id}", headers=manager_headers)
    assert response.status_code == 200
    assert response.json() == {"message": "Rep deactivated", "rep_id": rep_id}
    print("Step 8.4 Passed: Rep soft-deactivated successfully.")

    # GET /reps -> confirm deactivated rep no longer appears
    response = client.get("/reps/", headers=manager_headers)
    assert response.status_code == 200
    reps = response.json()
    found = any(r["id"] == rep_id for r in reps)
    assert found is False
    print("Step 8.5 Passed: Deactivated rep does not appear in normal summary listing.")

    # GET /reps?include_inactive=true -> confirm it does appear, with is_active: false
    response = client.get("/reps/?include_inactive=true", headers=manager_headers)
    assert response.status_code == 200
    reps = response.json()
    matching_rep = next((r for r in reps if r["id"] == rep_id), None)
    assert matching_rep is not None
    print("Step 8.6 Passed: Deactivated rep appears when include_inactive=true.")

    # Reactivate rep
    response = client.post(f"/reps/{rep_id}/reactivate", headers=manager_headers)
    assert response.status_code == 200
    assert response.json()["is_active"] is True
    print("Step 8.7 Passed: Rep reactivated successfully.")

    # POST /reps with invalid dna_profile (missing general store type) -> confirm rejected
    invalid_rep_data = new_rep_data.copy()
    invalid_rep_data["dna_profile"] = {
        "conversion_rates": {
            "grocery": 0.5,
            "pharmacy": 0.4,
            "electronics": 0.3
            # missing general
        }
    }
    response = client.post("/reps/", json=invalid_rep_data, headers=manager_headers)
    assert response.status_code == 422
    print("Step 8.8 Passed: Invalid dna_profile conversion rates keys rejected with 422.")


    # ==========================================
    # AUTHORIZATION TEST SEQUENCE
    # ==========================================
    print("\n--- AUTHORIZATION TEST SEQUENCE ---")

    # 9. Confirm a non-manager (Raj's rep token) gets 403 on all of these new endpoints
    # Stores POST
    response = client.post("/stores/", json=new_store_data, headers=rep_headers)
    assert response.status_code == 403
    # Stores PUT
    response = client.put(f"/stores/{store_id}", json=update_data, headers=rep_headers)
    assert response.status_code == 403
    # Stores DELETE
    response = client.delete(f"/stores/{store_id}", headers=rep_headers)
    assert response.status_code == 403
    # Stores Reactivate
    response = client.post(f"/stores/{store_id}/reactivate", headers=rep_headers)
    assert response.status_code == 403
    # Stores GET ?include_inactive=true
    response = client.get("/stores/?include_inactive=true", headers=rep_headers)
    assert response.status_code == 403

    # Reps POST
    response = client.post("/reps/", json=new_rep_data, headers=rep_headers)
    assert response.status_code == 403
    # Reps PUT
    response = client.put(f"/reps/{rep_id}", json=update_rep_data, headers=rep_headers)
    assert response.status_code == 403
    # Reps DELETE
    response = client.delete(f"/reps/{rep_id}", headers=rep_headers)
    assert response.status_code == 403
    # Reps Reactivate
    response = client.post(f"/reps/{rep_id}/reactivate", headers=rep_headers)
    assert response.status_code == 403
    # Reps GET ?include_inactive=true
    response = client.get("/reps/?include_inactive=true", headers=rep_headers)
    assert response.status_code == 403

    print("Step 9 Passed: Non-manager rep token gets 403 on all manager-only endpoints.")

    print("\n==========================================")
    print(" ALL TESTS PASSED SUCCESSFULLY! ")
    print("==========================================")

if __name__ == "__main__":
    run_tests()
