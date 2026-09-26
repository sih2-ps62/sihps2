# OWNER: integration (Day 2-3)
# GET /api/stations
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from models.station import Station
from ui_api.security import current_user
from ui_api.views import station_view

router = APIRouter(prefix="/stations", tags=["ui: stations"], dependencies=[Depends(current_user)])


@router.get("")
def list_stations(db: Session = Depends(get_db)):
    return {"data": [station_view(s) for s in db.execute(select(Station).order_by(Station.name)).scalars()]}
