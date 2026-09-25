# OWNER: Maisha
# GET /stations
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from models.station import Station
from schemas import StationOut

router = APIRouter(prefix="/stations", tags=["stations"])


@router.get("", response_model=list[StationOut])
def list_stations(db: Session = Depends(get_db)):
    return db.execute(select(Station).order_by(Station.name)).scalars().all()
