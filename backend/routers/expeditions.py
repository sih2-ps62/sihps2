from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from ids import next_id
from audit import log_action

router = APIRouter(tags=["expeditions"])


def _detail(db: Session, exp: models.Expedition) -> schemas.ExpeditionDetailOut:
    waypoints = sorted(exp.waypoints, key=lambda w: w.sequence)
    cargo_ids = [c.id for c in db.query(models.CargoItem).filter(models.CargoItem.expedition_id == exp.id).all()]
    personnel_ids = [p.id for p in exp.personnel]
    out = schemas.ExpeditionDetailOut.model_validate(exp)
    out.waypoints = [schemas.WaypointOut.model_validate(w) for w in waypoints]
    out.cargo_ids = cargo_ids
    out.personnel_ids = personnel_ids
    return out


@router.get("/expeditions", response_model=List[schemas.ExpeditionOut])
def list_expeditions(db: Session = Depends(get_db)):
    return db.query(models.Expedition).all()


@router.post("/expeditions", response_model=schemas.ExpeditionOut, status_code=201)
def create_expedition(payload: schemas.ExpeditionCreate, db: Session = Depends(get_db)):
    if payload.team_lead_id and not db.get(models.Personnel, payload.team_lead_id):
        raise HTTPException(422, detail=f"team_lead_id '{payload.team_lead_id}' does not exist")

    exp = models.Expedition(
        id=next_id(db, "EXP"),
        name=payload.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        team_lead_id=payload.team_lead_id,
        status="planned",
    )
    db.add(exp)
    db.flush()

    for wp in payload.waypoints:
        if not db.get(models.Station, wp.station_id):
            raise HTTPException(422, detail=f"station_id '{wp.station_id}' does not exist")
        db.add(models.Waypoint(
            id=next_id(db, "WPT"),
            expedition_id=exp.id,
            station_id=wp.station_id,
            sequence=wp.sequence,
            eta=wp.eta,
        ))

    for cid in payload.cargo_ids:
        cargo = db.get(models.CargoItem, cid)
        if not cargo:
            raise HTTPException(422, detail=f"cargo_id '{cid}' does not exist")
        cargo.expedition_id = exp.id

    for pid in payload.personnel_ids:
        person = db.get(models.Personnel, pid)
        if not person:
            raise HTTPException(422, detail=f"personnel_id '{pid}' does not exist")
        exp.personnel.append(person)

    log_action(db, "expeditions", f"Created expedition '{exp.name}'", exp.id)
    db.commit()
    db.refresh(exp)
    return exp


@router.get("/expeditions/{expedition_id}", response_model=schemas.ExpeditionDetailOut)
def get_expedition(expedition_id: str, db: Session = Depends(get_db)):
    exp = db.get(models.Expedition, expedition_id)
    if not exp:
        raise HTTPException(404, detail="Expedition not found")
    return _detail(db, exp)


@router.patch("/expeditions/{expedition_id}", response_model=schemas.ExpeditionDetailOut)
def update_expedition(expedition_id: str, payload: schemas.ExpeditionUpdate, db: Session = Depends(get_db)):
    exp = db.get(models.Expedition, expedition_id)
    if not exp:
        raise HTTPException(404, detail="Expedition not found")

    valid_statuses = {"planned", "in_progress", "completed"}
    if payload.status is not None:
        if payload.status not in valid_statuses:
            raise HTTPException(422, detail=f"status must be one of {sorted(valid_statuses)}")
        exp.status = payload.status
    if payload.name is not None:
        exp.name = payload.name
    if payload.start_date is not None:
        exp.start_date = payload.start_date
    if payload.end_date is not None:
        exp.end_date = payload.end_date
    if payload.team_lead_id is not None:
        exp.team_lead_id = payload.team_lead_id

    if payload.waypoints is not None:
        for wp in list(exp.waypoints):
            db.delete(wp)
        db.flush()
        for wp in payload.waypoints:
            db.add(models.Waypoint(
                id=next_id(db, "WPT"),
                expedition_id=exp.id,
                station_id=wp.station_id,
                sequence=wp.sequence,
                eta=wp.eta,
            ))

    if payload.cargo_ids is not None:
        for cargo in db.query(models.CargoItem).filter(models.CargoItem.expedition_id == exp.id).all():
            cargo.expedition_id = None
        for cid in payload.cargo_ids:
            cargo = db.get(models.CargoItem, cid)
            if cargo:
                cargo.expedition_id = exp.id

    if payload.personnel_ids is not None:
        exp.personnel = [db.get(models.Personnel, pid) for pid in payload.personnel_ids if db.get(models.Personnel, pid)]

    log_action(db, "expeditions", f"Updated expedition '{exp.name}'", exp.id)
    db.commit()
    db.refresh(exp)
    return _detail(db, exp)
