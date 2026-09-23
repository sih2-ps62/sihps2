from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from ids import next_id
from audit import log_action
from rules import now

router = APIRouter(tags=["emergency"])

VALID_STATUSES = {"open", "responding", "resolved"}
VALID_SEVERITIES = {"low", "medium", "high", "critical"}


@router.get("/emergency", response_model=List[schemas.EmergencyOut])
def list_emergency(db: Session = Depends(get_db)):
    return db.query(models.EmergencyIncident).order_by(models.EmergencyIncident.timestamp.desc()).all()


@router.post("/emergency", response_model=schemas.EmergencyOut, status_code=201)
def create_emergency(payload: schemas.EmergencyCreate, db: Session = Depends(get_db)):
    if payload.severity not in VALID_SEVERITIES:
        raise HTTPException(422, detail=f"severity must be one of {sorted(VALID_SEVERITIES)}")
    inc = models.EmergencyIncident(
        id=next_id(db, "INC"),
        status="open",
        timestamp=now(),
        auto_generated=False,
        **payload.model_dump(),
    )
    db.add(inc)
    if inc.personnel_id:
        person = db.get(models.Personnel, inc.personnel_id)
        if person:
            person.status = "emergency"
    log_action(db, "emergency", f"Raised {inc.severity} {inc.type} incident", inc.id, status="warning")
    db.commit()
    db.refresh(inc)
    return inc


@router.patch("/emergency/{incident_id}", response_model=schemas.EmergencyOut)
def update_emergency(incident_id: str, payload: schemas.EmergencyUpdate, db: Session = Depends(get_db)):
    inc = db.get(models.EmergencyIncident, incident_id)
    if not inc:
        raise HTTPException(404, detail="Incident not found")
    if payload.status is not None:
        if payload.status not in VALID_STATUSES:
            raise HTTPException(422, detail=f"status must be one of {sorted(VALID_STATUSES)}")
        inc.status = payload.status
        if payload.status == "resolved" and inc.personnel_id:
            person = db.get(models.Personnel, inc.personnel_id)
            if person and person.status == "emergency":
                person.status = "at_base"
    if payload.severity is not None:
        if payload.severity not in VALID_SEVERITIES:
            raise HTTPException(422, detail=f"severity must be one of {sorted(VALID_SEVERITIES)}")
        inc.severity = payload.severity
    if payload.resolution_notes is not None:
        inc.resolution_notes = payload.resolution_notes
    log_action(db, "emergency", f"Incident {inc.id} -> {inc.status}", inc.id,
               status="success" if inc.status == "resolved" else "info")
    db.commit()
    db.refresh(inc)
    return inc
