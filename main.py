from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables BEFORE importing routers
load_dotenv()

from database import create_tables
from routers import reports, reps, routes, stores


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


app = FastAPI(
    title="RouteGenie",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stores.router, prefix="/stores", tags=["stores"])
app.include_router(reps.router, prefix="/reps", tags=["reps"])
app.include_router(routes.router, prefix="/routes", tags=["routes"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "RouteGenie",
    }