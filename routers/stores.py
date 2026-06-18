from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import require_role, get_current_user
from database import get_db
from models import Store, VisitLog, User
from schemas import StoreOut, StoreUrgency, VisitLogCreate, StoreCreate, StoreUpdate

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
def read_stores(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if include_inactive and current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Not enough permissions")

    query = db.query(Store)
    if not include_inactive:
        query = query.filter(Store.is_active == True)
    return query.all()


@router.get("/urgency")
def get_store_urgency(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if include_inactive and current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Not enough permissions")

    today = date.today()
    query = db.query(Store)
    if not include_inactive:
        query = query.filter(Store.is_active == True)
    stores = query.all()
    
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


@router.post("/", response_model=StoreOut, status_code=201, dependencies=[Depends(require_role("manager"))])
def create_store(store_in: StoreCreate, db: Session = Depends(get_db)):
    last_visited = store_in.last_visited_date or (date.today() - timedelta(days=3)).isoformat()
    
    new_store = Store(
        name=store_in.name,
        lat=store_in.lat,
        lng=store_in.lng,
        avg_order_value=store_in.avg_order_value,
        store_type=store_in.store_type,
        base_priority=store_in.base_priority,
        last_visited_date=last_visited,
        is_active=store_in.is_active,
        stock_depletion_rate=0.1,
        closed_days="None"
    )
    db.add(new_store)
    db.commit()
    db.refresh(new_store)
    return new_store


@router.put("/{store_id}", response_model=StoreOut, dependencies=[Depends(require_role("manager"))])
def update_store(store_id: int, store_in: StoreUpdate, db: Session = Depends(get_db)):
    store = db.query(Store).filter(Store.id == store_id).first()
    if store is None:
        raise HTTPException(status_code=404, detail="Store not found")

    update_data = store_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(store, field, value)

    db.commit()
    db.refresh(store)
    return store


@router.delete("/{store_id}", dependencies=[Depends(require_role("manager"))])
def delete_store(store_id: int, db: Session = Depends(get_db)):
    store = db.query(Store).filter(Store.id == store_id).first()
    if store is None:
        raise HTTPException(status_code=404, detail="Store not found")

    if not store.is_active:
        raise HTTPException(status_code=400, detail="Store is already inactive")

    store.is_active = False
    db.commit()
    return {"message": "Store deactivated", "store_id": store.id}


@router.post("/{store_id}/reactivate", response_model=StoreOut, dependencies=[Depends(require_role("manager"))])
def reactivate_store(store_id: int, db: Session = Depends(get_db)):
    store = db.query(Store).filter(Store.id == store_id).first()
    if store is None:
        raise HTTPException(status_code=404, detail="Store not found")

    store.is_active = True
    db.commit()
    db.refresh(store)
    return store


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
