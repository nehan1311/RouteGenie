from datetime import date, timedelta
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StoreOut(BaseModel):
    id: int
    name: str
    lat: float
    lng: float
    avg_order_value: float
    store_type: str
    last_visited_date: str
    base_priority: int
    stock_depletion_rate: float
    closed_days: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class StoreCreate(BaseModel):
    name: str
    lat: float
    lng: float
    avg_order_value: float
    store_type: str
    base_priority: int
    last_visited_date: str | None = None
    is_active: bool = True

    @field_validator("store_type")
    @classmethod
    def validate_store_type(cls, v: str) -> str:
        valid_types = ["grocery", "pharmacy", "electronics", "general"]
        if v not in valid_types:
            raise ValueError(f"store_type must be one of {valid_types}")
        return v

    @field_validator("base_priority")
    @classmethod
    def validate_base_priority(cls, v: int) -> int:
        if v not in [1, 2, 3]:
            raise ValueError("base_priority must be 1, 2, or 3")
        return v

    @field_validator("lat")
    @classmethod
    def validate_lat(cls, v: float) -> float:
        if not (6.0 <= v <= 37.0):
            raise ValueError("lat must be within plausible bounds for India (6 to 37)")
        return v

    @field_validator("lng")
    @classmethod
    def validate_lng(cls, v: float) -> float:
        if not (68.0 <= v <= 97.0):
            raise ValueError("lng must be within plausible bounds for India (68 to 97)")
        return v

    @field_validator("avg_order_value")
    @classmethod
    def validate_avg_order_value(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("avg_order_value must be a positive number")
        return v


class StoreUpdate(BaseModel):
    name: str | None = None
    lat: float | None = None
    lng: float | None = None
    avg_order_value: float | None = None
    store_type: str | None = None
    base_priority: int | None = None
    last_visited_date: str | None = None
    is_active: bool | None = None

    @field_validator("store_type")
    @classmethod
    def validate_store_type(cls, v: str | None) -> str | None:
        if v is None:
            return v
        valid_types = ["grocery", "pharmacy", "electronics", "general"]
        if v not in valid_types:
            raise ValueError(f"store_type must be one of {valid_types}")
        return v

    @field_validator("base_priority")
    @classmethod
    def validate_base_priority(cls, v: int | None) -> int | None:
        if v is None:
            return v
        if v not in [1, 2, 3]:
            raise ValueError("base_priority must be 1, 2, or 3")
        return v

    @field_validator("lat")
    @classmethod
    def validate_lat(cls, v: float | None) -> float | None:
        if v is None:
            return v
        if not (6.0 <= v <= 37.0):
            raise ValueError("lat must be within plausible bounds for India (6 to 37)")
        return v

    @field_validator("lng")
    @classmethod
    def validate_lng(cls, v: float | None) -> float | None:
        if v is None:
            return v
        if not (68.0 <= v <= 97.0):
            raise ValueError("lng must be within plausible bounds for India (68 to 97)")
        return v

    @field_validator("avg_order_value")
    @classmethod
    def validate_avg_order_value(cls, v: float | None) -> float | None:
        if v is None:
            return v
        if v <= 0:
            raise ValueError("avg_order_value must be a positive number")
        return v


class VisitLogCreate(BaseModel):
    rep_id: int
    store_id: int
    outcome: str
    revenue: float
    notes: str


class VisitLogOut(BaseModel):
    id: int
    rep_id: int
    store_id: int
    visited_at: str
    outcome: str
    revenue: float
    notes: str

    model_config = ConfigDict(from_attributes=True)


class StoreUrgency(BaseModel):
    store_id: int
    name: str
    lat: float
    lng: float
    store_type: str
    avg_order_value: float
    urgency_score: float
    urgency_status: str
    days_since_last_visit: int


class DnaProfile(BaseModel):
    avg_visit_time_minutes: int
    best_time_window_start: int
    best_time_window_end: int
    area_speed_factor: float
    conversion_rates: dict[str, float]


class RepOut(BaseModel):
    id: int
    name: str
    avg_visit_time_minutes: int
    best_time_window_start: int
    best_time_window_end: int
    area_speed_factor: float
    dna_profile: DnaProfile
    is_active: bool


class RepCreate(BaseModel):
    name: str
    avg_visit_time_minutes: int
    best_time_window_start: int
    best_time_window_end: int
    area_speed_factor: float
    dna_profile: dict[str, Any]

    @field_validator("avg_visit_time_minutes")
    @classmethod
    def validate_avg_visit_time(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("avg_visit_time_minutes must be a positive number")
        return v

    @field_validator("area_speed_factor")
    @classmethod
    def validate_speed_factor(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("area_speed_factor must be a positive number")
        return v

    @field_validator("dna_profile")
    @classmethod
    def validate_dna_profile(cls, v: dict[str, Any]) -> dict[str, Any]:
        if "conversion_rates" not in v:
            raise ValueError("dna_profile must contain 'conversion_rates' key")
        rates = v["conversion_rates"]
        if not isinstance(rates, dict):
            raise ValueError("'conversion_rates' must be a dictionary")
        required_keys = {"grocery", "pharmacy", "electronics", "general"}
        missing_keys = required_keys - set(rates.keys())
        if missing_keys:
            raise ValueError(f"conversion_rates is missing required store types: {list(missing_keys)}")
        for k, val in rates.items():
            if not isinstance(val, (int, float)):
                raise ValueError(f"conversion rate for {k} must be a number")
        return v


class RepUpdate(BaseModel):
    name: str | None = None
    avg_visit_time_minutes: int | None = None
    best_time_window_start: int | None = None
    best_time_window_end: int | None = None
    area_speed_factor: float | None = None
    dna_profile: dict[str, Any] | None = None

    @field_validator("avg_visit_time_minutes")
    @classmethod
    def validate_avg_visit_time(cls, v: int | None) -> int | None:
        if v is None:
            return v
        if v <= 0:
            raise ValueError("avg_visit_time_minutes must be a positive number")
        return v

    @field_validator("area_speed_factor")
    @classmethod
    def validate_speed_factor(cls, v: float | None) -> float | None:
        if v is None:
            return v
        if v <= 0:
            raise ValueError("area_speed_factor must be a positive number")
        return v

    @field_validator("dna_profile")
    @classmethod
    def validate_dna_profile(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        if v is None:
            return v
        if "conversion_rates" not in v:
            raise ValueError("dna_profile must contain 'conversion_rates' key")
        rates = v["conversion_rates"]
        if not isinstance(rates, dict):
            raise ValueError("'conversion_rates' must be a dictionary")
        required_keys = {"grocery", "pharmacy", "electronics", "general"}
        missing_keys = required_keys - set(rates.keys())
        if missing_keys:
            raise ValueError(f"conversion_rates is missing required store types: {list(missing_keys)}")
        for k, val in rates.items():
            if not isinstance(val, (int, float)):
                raise ValueError(f"conversion rate for {k} must be a number")
        return v


class RepSummary(BaseModel):
    id: int
    name: str
    best_time_window: str
    top_store_type: str
    avg_visit_time_minutes: int


class RouteGenerateRequest(BaseModel):
    rep_id: int
    store_ids: list[int]
    start_lat: float
    start_lng: float


class RouteStop(BaseModel):
    order: int
    store_id: int
    store_name: str
    lat: float
    lng: float
    store_type: str
    urgency_status: str
    planned_arrival: str
    travel_time_minutes: int
    visit_duration_minutes: int
    estimated_revenue: float
    status: str


class RouteResponse(BaseModel):
    rep_id: int
    rep_name: str
    date: str
    total_stores: int
    estimated_total_revenue: float
    estimated_total_time_minutes: int
    route: list[RouteStop]


class ReplanRequest(BaseModel):
    rep_id: int
    cancelled_store_id: int
    reason: str
    current_time: str
    current_lat: float
    current_lng: float


class ReplanResponse(BaseModel):
    rep_id: int
    rep_name: str
    date: str
    replanned_at: str
    cancelled_store: dict[str, Any]
    total_stores: int
    completed_stores: int
    remaining_stores: int
    estimated_total_revenue: float
    revenue_impact: float
    estimated_total_time_minutes: int
    route: list[RouteStop]


class MarkDoneRequest(BaseModel):
    store_id: int
    revenue: float
    notes: str


class ReportGenerateRequest(BaseModel):
    rep_id: int
    date: str


class WarRoomRepStatus(BaseModel):
    rep_id: int
    rep_name: str
    status: str
    stores_total: int
    stores_done: int
    stores_remaining: int
    completion_pct: float
    revenue_today: float
    last_active: str
    current_lat: float
    current_lng: float


class WarRoomResponse(BaseModel):
    date: str
    total_reps: int
    reps: list[WarRoomRepStatus]


class RedistributeRequest(BaseModel):
    from_rep_id: int
    to_rep_id: int
    store_ids: list[int]


class RedistributeResponse(BaseModel):
    message: str
    from_rep: dict[str, Any]
    to_rep: dict[str, Any]
    stores_moved: list[int]


class WhatIfRequest(BaseModel):
    rep_id: int
    scenario: Literal["add_stores", "delay_start", "filter_by_value"]
    extra_store_ids: list[int] | None = None
    delay_minutes: int | None = None
    min_order_value: float | None = None


class WhatIfResponse(BaseModel):
    rep_id: int
    rep_name: str
    scenario: str
    original: dict[str, Any]
    simulated: dict[str, Any]
    delta: dict[str, Any]
    recommendation: str
    simulated_route: list[RouteStop]


class UserRegister(BaseModel):
    email: str
    password: str
    role: Literal["rep", "manager"]
    rep_id: int | None = None


class UserLogin(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    rep_id: int | None = None
    name: str


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    rep_id: int | None = None

    model_config = ConfigDict(from_attributes=True)


class OptimalRouteRequest(BaseModel):
    rep_id: int
    store_ids: list[int]
    start_lat: float
    start_lng: float
    urgency_weight: float = 0.6
    revenue_weight: float = 0.4


class DroppedStore(BaseModel):
    store_id: int
    store_name: str
    visit_value: float
    urgency_status: str


class OptimalRouteResponse(BaseModel):
    rep_id: int
    rep_name: str
    date: str
    recommended_visit_count: int
    candidate_count: int
    dropped_count: int
    estimated_total_revenue: float
    estimated_total_time_minutes: int
    selection_weights: dict[str, float]
    route: list[RouteStop]
    dropped_stores: list[DroppedStore]
    fallback_used: bool = False


class NudgeRequest(BaseModel):
    rep_id: int
    message: str | None = None


class NudgeResponse(BaseModel):
    status: str
    message: str


class AutoTuneHistoricalData(BaseModel):
    trips_analyzed: int
    avg_traffic_delay_mins: int
    avg_store_dwell_time_mins: int

class AutoTuneRecommendations(BaseModel):
    new_speed_factor: float
    new_avg_visit_time: int

class AutoTuneAnalysis(BaseModel):
    rep_id: int
    rep_name: str
    historical_data: AutoTuneHistoricalData
    insights: list[str]
    recommendations: AutoTuneRecommendations
