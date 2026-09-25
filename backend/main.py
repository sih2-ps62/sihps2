# OWNER: Param
# Written ONCE at 09:00 Day 1 — nobody edits this file after scaffolding.
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from db import get_db, init_db, utcnow
from models.station import Station
from routers import assets, cargo, dashboard, emergency, expeditions, inventory, personnel, stations
from schemas import HealthOut


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="PolarOps", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(expeditions.router)
app.include_router(stations.router)
app.include_router(cargo.router)
app.include_router(inventory.router)
app.include_router(assets.router)
app.include_router(personnel.router)
app.include_router(emergency.router)
app.include_router(dashboard.router)


@app.get("/health", response_model=HealthOut, tags=["health"])
def health(db: Session = Depends(get_db)):
    seeded = db.execute(select(func.count()).select_from(Station)).scalar_one() > 0
    return HealthOut(status="ok", seeded=seeded, time=utcnow())


# Contract: every 4xx/5xx body is {"detail": "message"} — a plain string, never FastAPI's default list.
@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError):
    messages = []
    for error in exc.errors():
        where = ".".join(str(part) for part in error["loc"] if part not in ("body", "query", "path"))
        messages.append(f"{where}: {error['msg']}" if where else error["msg"])
    return JSONResponse(status_code=422, content={"detail": "; ".join(messages)})


@app.exception_handler(Exception)
async def unhandled_error_handler(_: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
