import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Rep
from schemas import DnaProfile, RepOut, RepSummary

router = APIRouter()


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
    )


@router.get("/", response_model=list[RepSummary])
def read_reps(db: Session = Depends(get_db)):
    reps = db.query(Rep).all()
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
