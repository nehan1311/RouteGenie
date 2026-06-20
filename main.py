from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables BEFORE importing routers
load_dotenv()

from database import create_tables, seed
from routers import auth, reports, reps, routes, stores


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    seed()
    yield


app = FastAPI(
    title="RouteGenie",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://localhost:8082",
        "http://localhost:19006",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:8082",
        "http://127.0.0.1:19006",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stores.router, prefix="/stores", tags=["stores"])
app.include_router(reps.router, prefix="/reps", tags=["reps"])
app.include_router(routes.router, prefix="/routes", tags=["routes"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "RouteGenie",
    }
