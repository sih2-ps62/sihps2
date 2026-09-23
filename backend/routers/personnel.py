from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from ids import next_id
from audit import log_action
from rules import recompute_personnel_overdue, haversine_km, now

router = APIRouter(tags=["personnel"])


def _out(db: Session, person: models.Personnel) -> schemas.PersonnelOut:
    out = schemas.PersonnelOut.model_validate(person)
    station = db.get(models.Station, person.current_station_id) if person.current_station_id else None
    if station and person.lat is not None and person.lng is not None:
        out.distance_from_station_km = round(
            haversine_km(person.lat, person.lng, station.lat, station.lng) or 0, 1
        )
    return out


@router.get("/personnel", response_model=List[schemas.PersonnelOut])
def list_personnel(db: Session = Depends(get_db)):
    people = db.query(models.Personnel).all()
    for p in people:
        recompute_personnel_overdue(p)
    db.commit()
    return [_out(db, p) for p in people]


@router.post("/personnel", response_model=schemas.PersonnelOut, status_code=201)
def create_personnel(payload: schemas.PersonnelCreate, db: Session = Depends(get_db)):
    person = models.Personnel(id=next_id(db, "PER"), status="at_base", last_checkin=now(), **payload.model_dump())
    db.add(person)
    log_action(db, "personnel", f"Added personnel '{person.name}'", person.id)
    db.commit()
    db.refresh(person)
    return _out(db, person)


@router.post("/personnel/{person_id}/checkin", response_model=schemas.PersonnelOut)
def checkin(person_id: str, db: Session = Depends(get_db)):
    person = db.get(models.Personnel, person_id)
    if not person:
        raise HTTPException(404, detail="Personnel not found")
    person.last_checkin = now()
    if person.status in ("overdue", "emergency"):
        person.status = "at_base"
    log_action(db, "personnel", f"'{person.name}' checked in", person.id)
    db.commit()
    db.refresh(person)
    return _out(db, person)
