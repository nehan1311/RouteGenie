from sqlalchemy import Column, Float, ForeignKey, Integer, String

from database import Base


class Store(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    avg_order_value = Column(Float)
    store_type = Column(String)
    last_visited_date = Column(String)
    base_priority = Column(Integer)
    stock_depletion_rate = Column(Float)
    closed_days = Column(String)


class Rep(Base):
    __tablename__ = "reps"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    avg_visit_time_minutes = Column(Integer)
    best_time_window_start = Column(Integer)
    best_time_window_end = Column(Integer)
    area_speed_factor = Column(Float)
    dna_profile = Column(String)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String)
    role = Column(String)
    rep_id = Column(Integer, ForeignKey("reps.id"), nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(String)


class RouteEntry(Base):
    __tablename__ = "route_entries"

    id = Column(Integer, primary_key=True, index=True)
    rep_id = Column(Integer, ForeignKey("reps.id"))
    date = Column(String)
    store_ids_ordered = Column(String)
    status = Column(String)


class VisitLog(Base):
    __tablename__ = "visit_logs"

    id = Column(Integer, primary_key=True, index=True)
    rep_id = Column(Integer, ForeignKey("reps.id"))
    store_id = Column(Integer, ForeignKey("stores.id"))
    visited_at = Column(String)
    outcome = Column(String)
    revenue = Column(Float)
    notes = Column(String)
