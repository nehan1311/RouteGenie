import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import require_role, get_current_user
from database import get_db
from models import Rep, User
from schemas import DnaProfile, RepOut, RepSummary, RepCreate, RepUpdate

router = APIRouter(dependencies=[Depends(require_role("rep", "manager"))])


def format_hour(hour: int) -> str:
    suffix = "AM" if hour < 12 else "PM"
    display_hour = hour % 12
    if display_hour == 0:
        display_hour = 12
    return f"{display_hour}:00 {suffix}"


def format_time_window(start_hour: int, end_hour: int, separator: str = " - ") -> str:
    return f"{format_hour(start_hour)}{separator}{format_hour(end_hour)}"


def parse_dna_profile(rep: Rep) -> DnaProfile:
    try:
        raw_profile = json.loads(rep.dna_profile)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Invalid rep DNA profile") from exc

    conversion_rates = raw_profile.get("conversion_rates", raw_profile)

    return DnaProfile(
        avg_visit_time_minutes=rep.avg_visit_time_minutes,
        best_time_window_start=rep.best_time_window_start,
        best_time_window_end=rep.best_time_window_end,
        area_speed_factor=rep.area_speed_factor,
        conversion_rates=conversion_rates,
    )


def build_rep_out(rep: Rep) -> RepOut:
    return RepOut(
        id=rep.id,
        name=rep.name,
        avg_visit_time_minutes=rep.avg_visit_time_minutes,
        best_time_window_start=rep.best_time_window_start,
        best_time_window_end=rep.best_time_window_end,
        area_speed_factor=rep.area_speed_factor,
        dna_profile=parse_dna_profile(rep),
        is_active=rep.is_active,
    )


@router.get("/", response_model=list[RepSummary])
def read_reps(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if include_inactive and current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Not enough permissions")

    query = db.query(Rep)
    if not include_inactive:
        query = query.filter(Rep.is_active == True)
    reps = query.all()
    summaries = []

    for rep in reps:
        dna = parse_dna_profile(rep)
        top_store_type = max(dna.conversion_rates, key=dna.conversion_rates.get)
        summaries.append(
            RepSummary(
                id=rep.id,
                name=rep.name,
                best_time_window=format_time_window(
                    rep.best_time_window_start,
                    rep.best_time_window_end,
                ),
                top_store_type=top_store_type,
                avg_visit_time_minutes=rep.avg_visit_time_minutes,
            )
        )

    return summaries


@router.post("/", response_model=RepOut, status_code=201, dependencies=[Depends(require_role("manager"))])
def create_rep(rep_in: RepCreate, db: Session = Depends(get_db)):
    dna_str = json.dumps(rep_in.dna_profile)
    new_rep = Rep(
        name=rep_in.name,
        avg_visit_time_minutes=rep_in.avg_visit_time_minutes,
        best_time_window_start=rep_in.best_time_window_start,
        best_time_window_end=rep_in.best_time_window_end,
        area_speed_factor=rep_in.area_speed_factor,
        dna_profile=dna_str,
        is_active=True
    )
    db.add(new_rep)
    db.commit()
    db.refresh(new_rep)
    return build_rep_out(new_rep)


@router.put("/{rep_id}", response_model=RepOut, dependencies=[Depends(require_role("manager"))])
def update_rep(rep_id: int, rep_in: RepUpdate, db: Session = Depends(get_db)):
    rep = db.query(Rep).filter(Rep.id == rep_id).first()
    if rep is None:
        raise HTTPException(status_code=404, detail="Rep not found")

    update_data = rep_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "dna_profile":
            rep.dna_profile = json.dumps(value)
        else:
            setattr(rep, field, value)

    db.commit()
    db.refresh(rep)
    return build_rep_out(rep)


@router.delete("/{rep_id}", dependencies=[Depends(require_role("manager"))])
def delete_rep(rep_id: int, db: Session = Depends(get_db)):
    rep = db.query(Rep).filter(Rep.id == rep_id).first()
    if rep is None:
        raise HTTPException(status_code=404, detail="Rep not found")

    if not rep.is_active:
        raise HTTPException(status_code=400, detail="Rep is already inactive")

    rep.is_active = False
    db.commit()
    return {"message": "Rep deactivated", "rep_id": rep.id}


@router.post("/{rep_id}/reactivate", response_model=RepOut, dependencies=[Depends(require_role("manager"))])
def reactivate_rep(rep_id: int, db: Session = Depends(get_db)):
    rep = db.query(Rep).filter(Rep.id == rep_id).first()
    if rep is None:
        raise HTTPException(status_code=404, detail="Rep not found")

    rep.is_active = True
    db.commit()
    db.refresh(rep)
    return build_rep_out(rep)


@router.get("/{rep_id}", response_model=RepOut)
def read_rep(rep_id: int, db: Session = Depends(get_db)):
    rep = db.query(Rep).filter(Rep.id == rep_id).first()
    if rep is None:
        raise HTTPException(status_code=404, detail="Rep not found")

    return build_rep_out(rep)


@router.get("/{rep_id}/dna")
def read_rep_dna(rep_id: int, db: Session = Depends(get_db)):
    rep = db.query(Rep).filter(Rep.id == rep_id).first()
    if rep is None:
        raise HTTPException(status_code=404, detail="Rep not found")

    dna = parse_dna_profile(rep)
    top_store_type, top_conversion_rate = max(
        dna.conversion_rates.items(),
        key=lambda item: item[1],
    )
    conversion_percent = round(top_conversion_rate * 100)
    speed_delta_percent = round(abs(dna.area_speed_factor - 1.0) * 100)
    speed_direction = "faster" if dna.area_speed_factor >= 1.0 else "slower"
    window_for_sentence = format_time_window(
        dna.best_time_window_start,
        dna.best_time_window_end,
        separator=" to ",
    )

    insights = [
        (
            f"{rep.name} converts {conversion_percent}% better at "
            f"{top_store_type} stores - front-load these before "
            f"{format_hour(dna.best_time_window_end)}"
        ),
        (
            f"{rep.name} moves {speed_delta_percent}% {speed_direction} "
            "than average through his area"
        ),
        f"Best deployment window: {window_for_sentence}",
    ]

    return {
        "rep_id": rep.id,
        "name": rep.name,
        "dna": dna,
        "insights": insights,
    }
