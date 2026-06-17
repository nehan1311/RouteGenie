from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


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

    model_config = ConfigDict(from_attributes=True)


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
