from sqlalchemy import create_engine
from sqlalchemy import text
from sqlalchemy.orm import declarative_base, sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./routegenie.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    migrate_sqlite_schema()


def migrate_sqlite_schema():
    with engine.begin() as connection:
        rep_columns = {
            row[1] for row in connection.execute(text("PRAGMA table_info(reps)"))
        }
        user_columns = {
            row[1] for row in connection.execute(text("PRAGMA table_info(users)"))
        }

        if "manager_id" not in rep_columns:
            connection.execute(text("ALTER TABLE reps ADD COLUMN manager_id INTEGER"))
        if "manager_id" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN manager_id INTEGER"))
