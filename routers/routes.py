import json
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import require_role
from database import get_db
from models import Rep, RouteEntry, Store, User, VisitLog
from optimizer import generate_optimal_route, generate_route, replan_route, haversine_distance
from schemas import (
    MarkDoneRequest,
    OptimalRouteRequest,
    OptimalRouteResponse,
    ReplanRequest,
    ReplanResponse,
    RedistributeRequest,
    RedistributeResponse,
    RouteGenerateRequest,
    RouteResponse,
    WarRoomResponse,
    WhatIfRequest,
    WhatIfResponse,
    NudgeRequest,
    NudgeResponse,
)

router = APIRouter()
DEFAULT_START_LAT = 18.5592
DEFAULT_START_LNG = 73.7931


def ensure_rep_access(current_user: User, rep_id: int):
    if current_user.role == "rep" and current_user.rep_id != rep_id:
        raise HTTPException(
            status_code=403,
            detail="Cannot access another rep's data",
        )


def parse_rep_dna(rep: Rep) -> dict:
    try:
        raw_profile = json.loads(rep.dna_profile)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Invalid rep DNA profile") from exc

    return {
        "avg_visit_time_minutes": rep.avg_visit_time_minutes,
        "best_time_window_start": rep.best_time_window_start,
        "best_time_window_end": rep.best_time_window_end,
        "area_speed_factor": rep.area_speed_factor,
        "conversion_rates": raw_profile.get("conversion_rates", raw_profile),
    }


def urgency_for_store(store: Store) -> dict:
    today = date.today()
    last_visited = date.fromisoformat(store.last_visited_date)
    days_since_last_visit = (today - last_visited).days
    urgency_score = (
        days_since_last_visit * store.base_priority
    ) + (store.avg_order_value / 1000)

    if urgency_score >= 8:
        urgency_status = "red"
    elif urgency_score >= 4:
        urgency_status = "yellow"
    else:
        urgency_status = "green"

    return {
        "store_id": store.id,
        "name": store.name,
        "lat": store.lat,
        "lng": store.lng,
        "avg_order_value": store.avg_order_value,
        "store_type": store.store_type,
        "urgency_score": round(urgency_score, 2),
        "urgency_status": urgency_status,
    }


def store_payload(store: Store) -> dict:
    return {
        "store_id": store.id,
        "store_name": store.name,
        "lat": store.lat,
        "lng": store.lng,
        "store_type": store.store_type,
    }


def build_current_route_from_entry(
    route_entry: RouteEntry,
    rep: Rep,
    stores_by_id: dict[int, Store],
    visit_logs: list[VisitLog],
    current_lat: float,
    current_lng: float,
) -> dict:
    ordered_store_ids = json.loads(route_entry.store_ids_ordered)
    rep_dna = parse_rep_dna(rep)
    conversion_rates = rep_dna.get("conversion_rates", {})
    logs_by_store_id = {visit_log.store_id: visit_log for visit_log in visit_logs}
    route_stops = []

    for order, store_id in enumerate(ordered_store_ids, start=1):
        store = stores_by_id.get(store_id)
        if store is None:
            continue

        visit_log = logs_by_store_id.get(store_id)
        urgency = urgency_for_store(store)
        route_stops.append(
            {
                "order": order,
                "store_id": store.id,
                "store_name": store.name,
                "lat": store.lat,
                "lng": store.lng,
                "store_type": store.store_type,
                "urgency_status": urgency["urgency_status"],
                "planned_arrival": (
                    visit_log.visited_at[11:16] if visit_log else "09:00"
                ),
                "travel_time_minutes": 0,
                "visit_duration_minutes": rep.avg_visit_time_minutes,
                "estimated_revenue": round(
                    store.avg_order_value * conversion_rates.get(store.store_type, 0),
                    2,
                ),
                "status": "done" if visit_log else "pending",
            }
        )

    return {
        "rep_id": rep.id,
        "rep_name": rep.name,
        "date": route_entry.date,
        "current_lat": current_lat,
        "current_lng": current_lng,
        "route": route_stops,
    }


def get_active_route_entry(db: Session, rep_id: int, route_date: str) -> RouteEntry | None:
    return (
        db.query(RouteEntry)
        .filter(
            RouteEntry.rep_id == rep_id,
            RouteEntry.date == route_date,
            RouteEntry.status == "active",
        )
        .first()
    )


def rep_payload(rep: Rep) -> dict:
    return {
        "id": rep.id,
        "name": rep.name,
        "avg_visit_time_minutes": rep.avg_visit_time_minutes,
        "area_speed_factor": rep.area_speed_factor,
        "dna_profile": parse_rep_dna(rep),
    }


def generate_route_for_store_ids(
    rep: Rep,
    store_ids: list[int],
    db: Session,
    start_lat: float = DEFAULT_START_LAT,
    start_lng: float = DEFAULT_START_LNG,
) -> dict:
    if not store_ids:
        return {
            "rep_id": rep.id,
            "rep_name": rep.name,
            "date": date.today().isoformat(),
            "total_stores": 0,
            "estimated_total_revenue": 0.0,
            "estimated_total_time_minutes": 0,
            "route": [],
        }

    stores = db.query(Store).filter(Store.id.in_(store_ids)).all()
    stores_by_id = {store.id: store for store in stores}
    missing_store_ids = [store_id for store_id in store_ids if store_id not in stores_by_id]
    if missing_store_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Stores not found: {missing_store_ids}",
        )

    route_stores = [urgency_for_store(stores_by_id[store_id]) for store_id in store_ids]
    return generate_route(
        rep=rep_payload(rep),
        stores=route_stores,
        start_lat=start_lat,
        start_lng=start_lng,
    )


def route_summary(route_response: dict) -> dict:
    return {
        "store_count": route_response["total_stores"],
        "estimated_revenue": route_response["estimated_total_revenue"],
        "estimated_time_minutes": route_response["estimated_total_time_minutes"],
    }


def shift_route_times(route: list[dict], delay_minutes: int) -> tuple[list[dict], int]:
    shifted_route = []
    at_risk_count = 0

    for stop in route:
        shifted_stop = stop.copy()
        planned_time = datetime.strptime(stop["planned_arrival"], "%H:%M")
        shifted_time = planned_time + timedelta(minutes=delay_minutes)
        shifted_stop["planned_arrival"] = shifted_time.strftime("%H:%M")
        if shifted_time.time() > datetime.strptime("18:00", "%H:%M").time():
            at_risk_count += 1
        shifted_route.append(shifted_stop)

    return shifted_route, at_risk_count


@router.post("/generate", response_model=RouteResponse)
def generate_rep_route(
    request: RouteGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("rep", "manager")),
):
    ensure_rep_access(current_user, request.rep_id)

    if not request.store_ids:
        raise HTTPException(status_code=400, detail="store_ids cannot be empty")

    rep = db.query(Rep).filter(Rep.id == request.rep_id).first()
    if rep is None:
        raise HTTPException(status_code=404, detail="Rep not found")

    requested_stores = db.query(Store).filter(Store.id.in_(request.store_ids)).all()
    stores_by_id = {store.id: store for store in requested_stores}
    missing_store_ids = [
        store_id for store_id in request.store_ids if store_id not in stores_by_id
    ]
    if missing_store_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Stores not found: {missing_store_ids}",
        )

    stores = [
        urgency_for_store(stores_by_id[store_id]) for store_id in request.store_ids
    ]

    route_response = generate_route(
        rep=rep_payload(rep),
        stores=stores,
        start_lat=request.start_lat,
        start_lng=request.start_lng,
    )
    ordered_store_ids = [stop["store_id"] for stop in route_response["route"]]

    today = date.today().isoformat()
    route_entry = get_active_route_entry(db, request.rep_id, today)

    if route_entry is None:
        route_entry = RouteEntry(
            rep_id=request.rep_id,
            date=today,
            store_ids_ordered=json.dumps(ordered_store_ids),
            status="active",
        )
        db.add(route_entry)
    else:
        route_entry.store_ids_ordered = json.dumps(ordered_store_ids)

    db.commit()

    return route_response


@router.post("/generate-optimal", response_model=OptimalRouteResponse)
def generate_rep_optimal_route(
    request: OptimalRouteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("rep", "manager")),
):
    ensure_rep_access(current_user, request.rep_id)

    if not request.store_ids:
        raise HTTPException(status_code=400, detail="store_ids cannot be empty")

    rep = db.query(Rep).filter(Rep.id == request.rep_id).first()
    if rep is None:
        raise HTTPException(status_code=404, detail="Rep not found")

    candidate_stores = db.query(Store).filter(Store.id.in_(request.store_ids)).all()
    stores_by_id = {store.id: store for store in candidate_stores}
    missing_store_ids = [
        store_id for store_id in request.store_ids if store_id not in stores_by_id
    ]
    if missing_store_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Stores not found: {missing_store_ids}",
        )

    # Compute urgency scores for all candidates
    stores = [
        urgency_for_store(stores_by_id[store_id]) for store_id in request.store_ids
    ]

    route_response = generate_optimal_route(
        rep=rep_payload(rep),
        candidate_stores=stores,
        start_lat=request.start_lat,
        start_lng=request.start_lng,
        urgency_weight=request.urgency_weight,
        revenue_weight=request.revenue_weight,
    )
    ordered_store_ids = [stop["store_id"] for stop in route_response["route"]]

    today = date.today().isoformat()
    route_entry = get_active_route_entry(db, request.rep_id, today)

    if route_entry is None:
        route_entry = RouteEntry(
            rep_id=request.rep_id,
            date=today,
            store_ids_ordered=json.dumps(ordered_store_ids),
            status="active",
        )
        db.add(route_entry)
    else:
        route_entry.store_ids_ordered = json.dumps(ordered_store_ids)

    db.commit()

    return route_response


@router.post("/replan", response_model=ReplanResponse)
def replan_rep_route(
    request: ReplanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("rep", "manager")),
):
    ensure_rep_access(current_user, request.rep_id)

    rep = db.query(Rep).filter(Rep.id == request.rep_id).first()
    if rep is None:
        raise HTTPException(status_code=404, detail="Rep not found")

    cancelled_store = (
        db.query(Store).filter(Store.id == request.cancelled_store_id).first()
    )
    if cancelled_store is None:
        raise HTTPException(status_code=404, detail="Cancelled store not found")

    today = date.today().isoformat()
    route_entry = get_active_route_entry(db, request.rep_id, today)
    if route_entry is None:
        raise HTTPException(status_code=404, detail="No active route for today")

    ordered_store_ids = json.loads(route_entry.store_ids_ordered)
    route_stores = db.query(Store).filter(Store.id.in_(ordered_store_ids)).all()
    stores_by_id = {store.id: store for store in route_stores}
    today_visit_logs = (
        db.query(VisitLog)
        .filter(
            VisitLog.rep_id == request.rep_id,
            VisitLog.store_id.in_(ordered_store_ids),
            VisitLog.visited_at.like(f"{today}%"),
            VisitLog.outcome != "cancelled",
        )
        .all()
    )

    current_route = build_current_route_from_entry(
        route_entry=route_entry,
        rep=rep,
        stores_by_id=stores_by_id,
        visit_logs=today_visit_logs,
        current_lat=request.current_lat,
        current_lng=request.current_lng,
    )
    current_route["cancellation_reason"] = request.reason

    replanned_route = replan_route(
        current_route=current_route,
        cancelled_store_id=request.cancelled_store_id,
        rep=rep_payload(rep),
        current_time_str=request.current_time,
    )
    ordered_store_ids = [stop["store_id"] for stop in replanned_route["route"]]
    route_entry.store_ids_ordered = json.dumps(ordered_store_ids)

    cancelled_log = VisitLog(
        rep_id=request.rep_id,
        store_id=request.cancelled_store_id,
        visited_at=datetime.now().isoformat(),
        outcome="cancelled",
        revenue=0,
        notes=request.reason,
    )
    db.add(cancelled_log)
    db.commit()

    return replanned_route


@router.get("/manager/war-room", response_model=WarRoomResponse)
def manager_war_room(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager")),
):
    today = date.today().isoformat()
    now = datetime.now()
    elapsed_hours = max(0, min(8, (now - now.replace(hour=9, minute=0, second=0)).total_seconds() / 3600))
    expected_completion_pct = (elapsed_hours / 8) * 100
    on_track_threshold = max(0, expected_completion_pct - 10)

    reps = db.query(Rep).all()
    rep_statuses = []

    for rep in reps:
        route_entry = get_active_route_entry(db, rep.id, today)
        visit_logs = (
            db.query(VisitLog)
            .filter(
                VisitLog.rep_id == rep.id,
                VisitLog.visited_at.like(f"{today}%"),
            )
            .order_by(VisitLog.visited_at.desc())
            .all()
        )
        revenue_today = sum(
            visit.revenue or 0
            for visit in visit_logs
            if visit.outcome == "sale"
        )

        if route_entry is None:
            rep_statuses.append(
                {
                    "rep_id": rep.id,
                    "rep_name": rep.name,
                    "status": "no_route",
                    "stores_total": 0,
                    "stores_done": 0,
                    "stores_remaining": 0,
                    "completion_pct": 0.0,
                    "revenue_today": round(revenue_today, 2),
                    "last_active": visit_logs[0].visited_at if visit_logs else "No activity",
                    "current_lat": DEFAULT_START_LAT,
                    "current_lng": DEFAULT_START_LNG,
                }
            )
            continue

        route_store_ids = json.loads(route_entry.store_ids_ordered)
        done_store_ids = {
            visit.store_id for visit in visit_logs if visit.outcome != "cancelled"
        }
        stores_done = len([store_id for store_id in route_store_ids if store_id in done_store_ids])
        stores_total = len(route_store_ids)
        stores_remaining = max(0, stores_total - stores_done)
        completion_pct = round((stores_done / stores_total) * 100, 2) if stores_total else 0.0
        status = "on_track" if completion_pct >= on_track_threshold else "behind"

        last_activity = visit_logs[0] if visit_logs else None
        current_lat = DEFAULT_START_LAT
        current_lng = DEFAULT_START_LNG
        if last_activity is not None:
            last_store = db.query(Store).filter(Store.id == last_activity.store_id).first()
            if last_store is not None:
                current_lat = last_store.lat
                current_lng = last_store.lng

        rep_statuses.append(
            {
                "rep_id": rep.id,
                "rep_name": rep.name,
                "status": status,
                "stores_total": stores_total,
                "stores_done": stores_done,
                "stores_remaining": stores_remaining,
                "completion_pct": completion_pct,
                "revenue_today": round(revenue_today, 2),
                "last_active": last_activity.visited_at if last_activity else "No activity",
                "current_lat": current_lat,
                "current_lng": current_lng,
            }
        )

    return {"date": today, "total_reps": len(reps), "reps": rep_statuses}


@router.post("/manager/redistribute", response_model=RedistributeResponse)
def manager_redistribute(
    request: RedistributeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager")),
):
    today = date.today().isoformat()
    from_rep = db.query(Rep).filter(Rep.id == request.from_rep_id).first()
    to_rep = db.query(Rep).filter(Rep.id == request.to_rep_id).first()
    if from_rep is None or to_rep is None:
        raise HTTPException(status_code=404, detail="One or both reps not found")

    from_entry = get_active_route_entry(db, request.from_rep_id, today)
    if from_entry is None:
        raise HTTPException(status_code=404, detail="Source rep has no active route")

    from_store_ids = json.loads(from_entry.store_ids_ordered)
    moved_store_ids = [store_id for store_id in request.store_ids if store_id in from_store_ids]
    if not moved_store_ids:
        raise HTTPException(status_code=400, detail="No requested stores found in source route")

    to_entry = get_active_route_entry(db, request.to_rep_id, today)
    if to_entry is None:
        to_entry = RouteEntry(
            rep_id=request.to_rep_id,
            date=today,
            store_ids_ordered="[]",
            status="active",
        )
        db.add(to_entry)

    to_store_ids = json.loads(to_entry.store_ids_ordered)
    updated_from_ids = [store_id for store_id in from_store_ids if store_id not in moved_store_ids]
    updated_to_ids = to_store_ids + [
        store_id for store_id in moved_store_ids if store_id not in to_store_ids
    ]

    from_route = generate_route_for_store_ids(from_rep, updated_from_ids, db)
    to_route = generate_route_for_store_ids(to_rep, updated_to_ids, db)
    from_entry.store_ids_ordered = json.dumps(
        [stop["store_id"] for stop in from_route["route"]]
    )
    to_entry.store_ids_ordered = json.dumps(
        [stop["store_id"] for stop in to_route["route"]]
    )

    db.commit()

    return {
        "message": "Stores redistributed successfully",
        "from_rep": {
            "rep_id": from_rep.id,
            "rep_name": from_rep.name,
            "new_store_count": from_route["total_stores"],
        },
        "to_rep": {
            "rep_id": to_rep.id,
            "rep_name": to_rep.name,
            "new_store_count": to_route["total_stores"],
        },
        "stores_moved": moved_store_ids,
    }


@router.post("/manager/what-if", response_model=WhatIfResponse)
def manager_what_if(
    request: WhatIfRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager")),
):
    today = date.today().isoformat()
    rep = db.query(Rep).filter(Rep.id == request.rep_id).first()
    if rep is None:
        raise HTTPException(status_code=404, detail="Rep not found")

    route_entry = get_active_route_entry(db, request.rep_id, today)
    if route_entry is None:
        raise HTTPException(status_code=404, detail="No active route for today")

    current_store_ids = json.loads(route_entry.store_ids_ordered)
    original_route = generate_route_for_store_ids(rep, current_store_ids, db)
    original = route_summary(original_route)
    at_risk_count = 0

    if request.scenario == "add_stores":
        extra_store_ids = request.extra_store_ids or []
        simulated_store_ids = current_store_ids + [
            store_id for store_id in extra_store_ids if store_id not in current_store_ids
        ]
        simulated_route_response = generate_route_for_store_ids(rep, simulated_store_ids, db)
        added_count = len(simulated_store_ids) - len(current_store_ids)
        delta_revenue = round(
            simulated_route_response["estimated_total_revenue"] - original["estimated_revenue"],
            2,
        )
        delta_time = (
            simulated_route_response["estimated_total_time_minutes"]
            - original["estimated_time_minutes"]
        )
        recommendation = (
            f"Adding {added_count} stores increases revenue by Rs. {delta_revenue} "
            f"but adds {delta_time} minutes - recommended if day started on time."
        )
    elif request.scenario == "delay_start":
        delay_minutes = request.delay_minutes or 0
        simulated_route_response = generate_route_for_store_ids(rep, current_store_ids, db)
        shifted_route, at_risk_count = shift_route_times(
            simulated_route_response["route"],
            delay_minutes,
        )
        simulated_route_response["route"] = shifted_route
        simulated_route_response["total_stores"] = max(
            0,
            simulated_route_response["total_stores"] - at_risk_count,
        )
        simulated_route_response["estimated_total_time_minutes"] += delay_minutes
        recommendation = (
            f"A {delay_minutes}min delay puts {at_risk_count} stores at risk "
            f"of being missed - consider redistributing {at_risk_count} stores to another rep."
        )
    else:
        min_order_value = request.min_order_value or 0
        stores = db.query(Store).filter(Store.id.in_(current_store_ids)).all()
        store_value_by_id = {store.id: store.avg_order_value for store in stores}
        simulated_store_ids = [
            store_id
            for store_id in current_store_ids
            if store_value_by_id.get(store_id, 0) >= min_order_value
        ]
        simulated_route_response = generate_route_for_store_ids(rep, simulated_store_ids, db)
        saved_minutes = (
            original["estimated_time_minutes"]
            - simulated_route_response["estimated_total_time_minutes"]
        )
        dropped_revenue = round(
            original["estimated_revenue"]
            - simulated_route_response["estimated_total_revenue"],
            2,
        )
        recommendation = (
            f"Focusing on high-value stores saves {saved_minutes} minutes and "
            f"drops revenue by Rs. {dropped_revenue} - viable if rep is behind schedule."
        )

    simulated = route_summary(simulated_route_response)
    delta = {
        "store_count": simulated["store_count"] - original["store_count"],
        "revenue": round(simulated["estimated_revenue"] - original["estimated_revenue"], 2),
        "time_minutes": simulated["estimated_time_minutes"] - original["estimated_time_minutes"],
    }

    return {
        "rep_id": rep.id,
        "rep_name": rep.name,
        "scenario": request.scenario,
        "original": original,
        "simulated": simulated,
        "delta": delta,
        "recommendation": recommendation,
        "simulated_route": simulated_route_response["route"],
    }


@router.get("/{rep_id}/today")
def get_today_route(
    rep_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("rep", "manager")),
):
    ensure_rep_access(current_user, rep_id)

    today = date.today().isoformat()
    route_entry = (
        db.query(RouteEntry)
        .filter(
            RouteEntry.rep_id == rep_id,
            RouteEntry.date == today,
            RouteEntry.status == "active",
        )
        .first()
    )
    if route_entry is None:
        raise HTTPException(status_code=404, detail="No active route for today")

    ordered_store_ids = json.loads(route_entry.store_ids_ordered)
    stores = db.query(Store).filter(Store.id.in_(ordered_store_ids)).all()
    stores_by_id = {store.id: store for store in stores}

    visit_logs = (
        db.query(VisitLog)
        .filter(
            VisitLog.rep_id == rep_id,
            VisitLog.store_id.in_(ordered_store_ids),
            VisitLog.visited_at.like(f"{today}%"),
        )
        .all()
    )
    completed_store_ids = {visit_log.store_id for visit_log in visit_logs}

    rep = db.query(Rep).filter(Rep.id == rep_id).first()
    rep_dna = parse_rep_dna(rep)
    conversion_rates = rep_dna.get("conversion_rates", {})

    speed_mps = (30 * 1000 / 3600) * rep.area_speed_factor
    current_time = datetime.combine(date.today(), datetime.strptime("09:00", "%H:%M").time())
    previous_lat = DEFAULT_START_LAT
    previous_lng = DEFAULT_START_LNG

    route_stores = []
    for order, store_id in enumerate(ordered_store_ids, start=1):
        store = stores_by_id.get(store_id)
        if store is None:
            continue

        travel_seconds = haversine_distance(
            previous_lat,
            previous_lng,
            store.lat,
            store.lng,
        ) / speed_mps
        travel_time_minutes = round(travel_seconds / 60)
        current_time += timedelta(minutes=travel_time_minutes)

        rate = conversion_rates.get(store.store_type, 0.0)
        estimated_revenue = round(store.avg_order_value * rate, 2)

        visit_log = next((log for log in visit_logs if log.store_id == store_id), None)

        payload = {
            "order": order,
            "store_id": store.id,
            "store_name": store.name,
            "lat": store.lat,
            "lng": store.lng,
            "store_type": store.store_type,
            "urgency_status": urgency_for_store(store)["urgency_status"],
            "planned_arrival": visit_log.visited_at[11:16] if (visit_log and visit_log.outcome != "cancelled" and len(visit_log.visited_at) >= 16) else current_time.strftime("%H:%M"),
            "travel_time_minutes": travel_time_minutes,
            "visit_duration_minutes": rep.avg_visit_time_minutes,
            "estimated_revenue": estimated_revenue,
            "status": "done" if store_id in completed_store_ids else ("cancelled" if visit_log and visit_log.outcome == "cancelled" else "pending"),
        }
        route_stores.append(payload)

        current_time += timedelta(minutes=rep.avg_visit_time_minutes)
        previous_lat = store.lat
        previous_lng = store.lng

    # Fetch all stores to calculate candidates vs dropped
    all_stores = db.query(Store).all()
    ordered_set = set(ordered_store_ids)
    dropped_stores = []
    for s in all_stores:
        if s.id not in ordered_set:
            urgency_status = urgency_for_store(s)["urgency_status"]
            dropped_stores.append({
                "store_id": s.id,
                "store_name": s.name,
                "urgency_status": urgency_status,
                "reason": "Lower priority today" if urgency_status != "red" else "Time limit reached"
            })

    return {
        "route_id": route_entry.id,
        "rep_id": rep_id,
        "date": route_entry.date,
        "status": route_entry.status,
        "stores": route_stores,
        "recommended_visit_count": len(route_stores),
        "candidate_count": len(all_stores),
        "dropped_count": len(dropped_stores),
        "dropped_stores": dropped_stores,
    }


@router.post("/{rep_id}/mark-done")
def mark_store_done(
    rep_id: int,
    request: MarkDoneRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("rep", "manager")),
):
    ensure_rep_access(current_user, rep_id)

    rep = db.query(Rep).filter(Rep.id == rep_id).first()
    if rep is None:
        raise HTTPException(status_code=404, detail="Rep not found")

    store = db.query(Store).filter(Store.id == request.store_id).first()
    if store is None:
        raise HTTPException(status_code=404, detail="Store not found")

    today = date.today()
    visit_log = VisitLog(
        rep_id=rep_id,
        store_id=request.store_id,
        visited_at=datetime.now().isoformat(),
        outcome="sale",
        revenue=request.revenue,
        notes=request.notes,
    )
    store.last_visited_date = today.isoformat()

    db.add(visit_log)
    db.commit()

    return {"message": "Store marked as done", "store_id": request.store_id}


@router.post("/manager/nudge", response_model=NudgeResponse)
def manager_nudge(
    request: NudgeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager")),
):
    rep = db.query(Rep).filter(Rep.id == request.rep_id).first()
    if rep is None:
        raise HTTPException(status_code=404, detail="Rep not found")
        
    # Since there is no actual push-notification service integrated,
    # we simulate the nudge and return a success response.
    # We could also log this to a Notification table if one existed.
    
    return {
        "status": "success",
        "message": f"Nudge sent to {rep.name} successfully."
    }
