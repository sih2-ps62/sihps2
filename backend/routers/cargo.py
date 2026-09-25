# OWNER: Jalak
# GET /cargo, POST /cargo
# PATCH /cargo/{id}
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import check_ref, get_db, get_or_404, next_id
from models.cargo import CargoItem
from models.expedition import Expedition
from models.station import Station
from schemas import CargoCreate, CargoOut, CargoStatus, CargoUpdate

router = APIRouter(prefix="/cargo", tags=["cargo"])


@router.get("", response_model=list[CargoOut])
def list_cargo(
    status: Optional[CargoStatus] = None,
    expedition_id: Optional[str] = None,
    station_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = select(CargoItem).order_by(CargoItem.id)
    if status:
        query = query.where(CargoItem.status == status)
    if expedition_id:
        query = query.where(CargoItem.expedition_id == expedition_id)
    if station_id:
        query = query.where(CargoItem.current_station_id == station_id)
    return db.execute(query).scalars().all()


@router.post("", response_model=CargoOut, status_code=201)
def create_cargo(body: CargoCreate, db: Session = Depends(get_db)):
    item = CargoItem(
        id=next_id(db, CargoItem, "CGO"),
        name=body.name,
        category=body.category,
        weight_kg=body.weight_kg,
        expedition_id=check_ref(db, Expedition, body.expedition_id, "expedition_id"),
        current_station_id=check_ref(db, Station, body.current_station_id, "current_station_id"),
        status=body.status,
    )
    db.add(item)
    db.commit()
    return item


@router.patch("/{cargo_id}", response_model=CargoOut)
def update_cargo(cargo_id: str, body: CargoUpdate, db: Session = Depends(get_db)):
    item = get_or_404(db, CargoItem, cargo_id, "Cargo")
    changes = body.model_dump(exclude_unset=True)
    if changes.get("status") is not None:
        item.status = changes["status"]
    if "current_station_id" in changes:
        item.current_station_id = check_ref(db, Station, changes["current_station_id"], "current_station_id")
    db.commit()
    return item
