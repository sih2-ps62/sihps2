from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

import models
from database import engine, SessionLocal
from routers import (
    stations, expeditions, cargo, inventory, personnel,
    emergency, assets, alerts, audit_log, dashboard, assistant, reports_router,
)

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="PolarOps API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:])
    message = first.get("msg", "Invalid request")
    detail = f"{field}: {message}" if field else message
    return JSONResponse(status_code=422, content={"detail": detail})


app.include_router(stations.router)
app.include_router(expeditions.router)
app.include_router(cargo.router)
app.include_router(inventory.router)
app.include_router(personnel.router)
app.include_router(emergency.router)
app.include_router(assets.router)
app.include_router(alerts.router)
app.include_router(audit_log.router)
app.include_router(dashboard.router)
app.include_router(assistant.router)
app.include_router(reports_router.router)


@app.get("/health", tags=["health"])
def health():
    db = SessionLocal()
    try:
        seeded = db.query(models.Station).count() > 0
    finally:
        db.close()
    return {"status": "ok", "seeded": seeded}
