from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from ids import next_id
from audit import log_action
from rules import is_cargo_delayed

router = APIRouter(tags=["cargo"])

VALID_STATUSES = {"stored", "in_transit", "delivered"}


def _out(cargo: models.CargoItem) -> schemas.CargoOut:
    out = schemas.CargoOut.model_validate(cargo)
    delayed, hours = is_cargo_delayed(cargo)
    out.is_delayed = delayed
    out.delayed_hours = hours
    return out


@router.get("/cargo", response_model=List[schemas.CargoOut])
def list_cargo(expedition_id: str = None, station_id: str = None, db: Session = Depends(get_db)):
    q = db.query(models.CargoItem)
    if expedition_id:
        q = q.filter(models.CargoItem.expedition_id == expedition_id)
    if station_id:
        q = q.filter(models.CargoItem.current_station_id == station_id)
    return [_out(c) for c in q.all()]


@router.post("/cargo", response_model=schemas.CargoOut, status_code=201)
def create_cargo(payload: schemas.CargoCreate, db: Session = Depends(get_db)):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(422, detail=f"status must be one of {sorted(VALID_STATUSES)}")
    cargo = models.CargoItem(id=next_id(db, "CGO"), **payload.model_dump())
    db.add(cargo)
    log_action(db, "cargo", f"Registered cargo '{cargo.name}'", cargo.id)
    db.commit()
    db.refresh(cargo)
    return _out(cargo)


@router.patch("/cargo/{cargo_id}", response_model=schemas.CargoOut)
def update_cargo(cargo_id: str, payload: schemas.CargoUpdate, db: Session = Depends(get_db)):
    cargo = db.get(models.CargoItem, cargo_id)
    if not cargo:
        raise HTTPException(404, detail="Cargo item not found")
    if payload.status is not None:
        if payload.status not in VALID_STATUSES:
            raise HTTPException(422, detail=f"status must be one of {sorted(VALID_STATUSES)}")
        cargo.status = payload.status
    if payload.current_station_id is not None:
        cargo.current_station_id = payload.current_station_id
    if payload.eta is not None:
        cargo.eta = payload.eta
    if payload.expedition_id is not None:
        cargo.expedition_id = payload.expedition_id
    log_action(db, "cargo", f"Updated cargo '{cargo.name}' -> {cargo.status}", cargo.id)
    db.commit()
    db.refresh(cargo)
    return _out(cargo)
