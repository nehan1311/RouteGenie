import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import require_role
from ai_reporter import generate_day_report
from database import get_db
from models import Rep, RouteEntry, Store, User, VisitLog
from schemas import ReportGenerateRequest

router = APIRouter()


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


def urgency_from_priority(base_priority: int) -> str:
    if base_priority == 3:
        return "red"
    if base_priority == 2:
        return "yellow"
    return "green"


def generate_report_payload(rep_id: int, report_date: str, db: Session) -> dict:
    rep = db.query(Rep).filter(Rep.id == rep_id).first()
    if rep is None:
        raise HTTPException(status_code=404, detail="Rep not found")

    rep_dna = parse_rep_dna(rep)
    visit_log_rows = (
        db.query(VisitLog)
        .filter(
            VisitLog.rep_id == rep_id,
            VisitLog.visited_at.like(f"{report_date}%"),
        )
        .all()
    )
    route_entry = (
        db.query(RouteEntry)
        .filter(RouteEntry.rep_id == rep_id, RouteEntry.date == report_date)
        .order_by(RouteEntry.id.desc())
        .first()
    )

    visit_store_ids = [visit.store_id for visit in visit_log_rows]
    route_store_ids = json.loads(route_entry.store_ids_ordered) if route_entry else []
    store_ids = list({*visit_store_ids, *route_store_ids})
    stores = db.query(Store).filter(Store.id.in_(store_ids)).all() if store_ids else []
    stores_by_id = {store.id: store for store in stores}

    visit_logs = []
    for visit in visit_log_rows:
        store = stores_by_id.get(visit.store_id)
        if store is None:
            continue

        visit_logs.append(
            {
                "store_name": store.name,
                "store_type": store.store_type,
                "outcome": visit.outcome,
                "revenue": visit.revenue or 0,
                "visited_at": visit.visited_at[11:16],
                "notes": visit.notes,
            }
        )

    visited_store_ids = {visit.store_id for visit in visit_log_rows}
    missed_stores = []
    for store_id in route_store_ids:
        if store_id in visited_store_ids:
            continue

        store = stores_by_id.get(store_id)
        if store is None:
            continue

        missed_stores.append(
            {
                "store_name": store.name,
                "store_type": store.store_type,
                "urgency_status": urgency_from_priority(store.base_priority),
                "reason": "Not visited",
            }
        )

    report_text = generate_day_report(
        rep_name=rep.name,
        visit_logs=visit_logs,
        missed_stores=missed_stores,
        rep_dna=rep_dna,
    )
    total_revenue = sum(
        visit["revenue"] for visit in visit_logs if visit["outcome"] == "sale"
    )

    return {
        "rep_id": rep.id,
        "rep_name": rep.name,
        "date": report_date,
        "completed_visits": len(visit_logs),
        "missed_visits": len(missed_stores),
        "total_revenue": total_revenue,
        "report_text": report_text,
        "generated_at": datetime.now().strftime("%H:%M"),
    }


@router.post("/generate")
def generate_report(
    request: ReportGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("rep", "manager")),
):
    ensure_rep_access(current_user, request.rep_id)
    return generate_report_payload(request.rep_id, request.date, db)


@router.get("/{rep_id}/latest")
def latest_report(
    rep_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("rep", "manager")),
):
    ensure_rep_access(current_user, rep_id)
    today = datetime.now().date().isoformat()
    return generate_report_payload(rep_id, today, db)
