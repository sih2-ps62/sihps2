# OWNER: Param
# Written at 09:00 Day 1; Day 2-3 added the frontend API (/api) and its `error` field on error bodies.
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

from db import SessionLocal, get_db, init_db, utcnow
from models.station import Station
from models.user import User
from routers import assets, cargo, dashboard, emergency, expeditions, inventory, personnel, stations
from schemas import HealthOut
from ui_api import router as ui_router
from ui_api.security import warn_if_dev_secret


def seed_if_new():
    """A brand-new database has no accounts, so nobody could sign in: seed the demo dataset once.
    Set POLAROPS_AUTOSEED=0 to start empty instead."""
    if os.getenv("POLAROPS_AUTOSEED", "1") == "0":
        return
    with SessionLocal() as db:
        accounts = db.execute(select(func.count()).select_from(User)).scalar_one()
        stations = db.execute(select(func.count()).select_from(Station)).scalar_one()
    if accounts == 0 and stations == 0:
        import seed

        seed.seed()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    seed_if_new()
    warn_if_dev_secret()
    yield


app = FastAPI(title="PolarOps", lifespan=lifespan)

DEFAULT_CORS_ORIGINS = "http://localhost:5183,http://127.0.0.1:5183"


def cors_origins() -> list[str]:
    """Browser origins allowed to call the API. Set POLAROPS_CORS_ORIGINS (comma separated) for a deployed
    frontend, or '*' to allow any origin (the Day-1 behaviour)."""
    raw = os.getenv("POLAROPS_CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app.add_middleware(CORSMiddleware, allow_origins=cors_origins(), allow_methods=["*"], allow_headers=["*"])

app.include_router(expeditions.router)
app.include_router(stations.router)
app.include_router(cargo.router)
app.include_router(inventory.router)
app.include_router(assets.router)
app.include_router(personnel.router)
app.include_router(emergency.router)
app.include_router(dashboard.router)
app.include_router(ui_router)


@app.get("/health", response_model=HealthOut, tags=["health"])
def health(db: Session = Depends(get_db)):
    seeded = db.execute(select(func.count()).select_from(Station)).scalar_one() > 0
    return HealthOut(status="ok", seeded=seeded, time=utcnow())


# Contract: every 4xx/5xx body is {"detail": "message"} — a plain string, never FastAPI's default list.
# The frontend API (/api) reads its message from `error`, so those bodies carry the same text under both keys.
def _error_body(request: Request, message) -> dict:
    body = {"detail": message}
    if request.url.path.startswith("/api"):
        body["error"] = message
    return body


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content=_error_body(request, exc.detail),
                        headers=getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    messages = []
    for error in exc.errors():
        where = ".".join(str(part) for part in error["loc"] if part not in ("body", "query", "path"))
        messages.append(f"{where}: {error['msg']}" if where else error["msg"])
    return JSONResponse(status_code=422, content=_error_body(request, "; ".join(messages)))


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content=_error_body(request, "Internal server error"))
