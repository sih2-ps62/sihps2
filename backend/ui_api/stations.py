# OWNER: integration (Day 2-3)
# GET /api/stations
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from mission_readiness import compute_readiness
from models.emergency import EmergencyIncident
from models.inventory import InventoryItem
from models.personnel import Personnel
from models.station import Station
from rules.escalation import evaluate_escalation
from rules.overdue_checkin import evaluate_overdue
from spaceweather import current_comms_risk
from ui_api.security import current_user
from ui_api.views import is_low_stock, station_view
from weather import refresh_stale_stations

router = APIRouter(prefix="/stations", tags=["ui: stations"], dependencies=[Depends(current_user)])


def station_readiness_rows(db: Session) -> list[dict]:
    """Every station's view plus its Mission Readiness score - shared by GET /stations and the SITREP, so the
    two never disagree about which stations are least ready."""
    evaluate_overdue(db)
    evaluate_escalation(db)
    stations = db.execute(select(Station).order_by(Station.name)).scalars().all()
    refresh_stale_stations(db, stations)

    inventory = db.execute(select(InventoryItem)).scalars().all()
    people = db.execute(select(Personnel)).scalars().all()
    incidents = db.execute(select(EmergencyIncident)).scalars().all()
    comms = current_comms_risk()

    rows = []
    for station in stations:
        readiness = compute_readiness(
            has_open_emergency=any(i.station_id == station.id and i.status != "resolved" for i in incidents),
            overdue_or_emergency_count=sum(
                1 for p in people if p.current_station_id == station.id and p.status in ("overdue", "emergency")
            ),
            has_low_stock=any(i.station_id == station.id and is_low_stock(i) for i in inventory),
            weather_code=station.weather_code,
            comms_risk_level=comms["level"],
        )
        rows.append({**station_view(station), **readiness})
    return rows


@router.get("")
def list_stations(db: Session = Depends(get_db)):
    return {"data": station_readiness_rows(db)}
