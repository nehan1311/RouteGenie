from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import require_role
from database import get_db
from models import Store, VisitLog
from schemas import StoreOut, StoreUrgency, VisitLogCreate

router = APIRouter(dependencies=[Depends(require_role("rep", "manager"))])


def calculate_urgency(store: Store, today: date) -> StoreUrgency:
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

    return StoreUrgency(
        store_id=store.id,
        name=store.name,
        lat=store.lat,
        lng=store.lng,
        store_type=store.store_type,
        avg_order_value=store.avg_order_value,
        urgency_score=round(urgency_score, 2),
        urgency_status=urgency_status,
        days_since_last_visit=days_since_last_visit,
    )


@router.get("/", response_model=list[StoreOut])
def read_stores(db: Session = Depends(get_db)):
    return db.query(Store).all()


@router.get("/urgency")
def get_store_urgency(db: Session = Depends(get_db)):
    today = date.today()
    stores = db.query(Store).all()
    urgency_stores = [calculate_urgency(store, today) for store in stores]
    urgency_stores.sort(key=lambda store: store.urgency_score, reverse=True)

    return {
        "red_count": sum(
            1 for store in urgency_stores if store.urgency_status == "red"
        ),
        "yellow_count": sum(
            1 for store in urgency_stores if store.urgency_status == "yellow"
        ),
        "green_count": sum(
            1 for store in urgency_stores if store.urgency_status == "green"
        ),
        "stores": urgency_stores,
    }


@router.post("/visit")
def log_visit(visit: VisitLogCreate, db: Session = Depends(get_db)):
    store = db.query(Store).filter(Store.id == visit.store_id).first()
    if store is None:
        raise HTTPException(status_code=404, detail="Store not found")

    today = date.today()
    visit_log = VisitLog(
        rep_id=visit.rep_id,
        store_id=visit.store_id,
        visited_at=datetime.now().isoformat(),
        outcome=visit.outcome,
        revenue=visit.revenue,
        notes=visit.notes,
    )

    store.last_visited_date = today.isoformat()
    db.add(visit_log)
    db.commit()
    db.refresh(visit_log)

    return {"message": "Visit logged", "visit_id": visit_log.id}


@router.get("/{store_id}", response_model=StoreOut)
def read_store(store_id: int, db: Session = Depends(get_db)):
    store = db.query(Store).filter(Store.id == store_id).first()
    if store is None:
        raise HTTPException(status_code=404, detail="Store not found")

    return store
