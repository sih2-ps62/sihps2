# OWNER: Param
# GET /emergency, POST /emergency
# PATCH /emergency/{id}
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import check_ref, get_db, get_or_404, next_id, utcnow
from models.emergency import EmergencyIncident
from models.personnel import Personnel
from models.station import Station
from rules.escalation import evaluate_escalation
from schemas import EmergencyCreate, EmergencyOut, EmergencyUpdate, IncidentStatus

router = APIRouter(prefix="/emergency", tags=["emergency"])

STATUS_ORDER = {"open": 0, "responding": 1, "resolved": 2}


def _flag_personnel(person: Personnel):
    if person.status == "emergency":
        return
    if person.status != "overdue":  # an overdue person keeps the status they had before going overdue
        person.prior_status = person.status
    person.status = "emergency"


def _release_personnel(db: Session, incident: EmergencyIncident):
    person = db.get(Personnel, incident.personnel_id) if incident.personnel_id else None
    if person is None or person.status != "emergency":
        return
    still_active = db.execute(
        select(EmergencyIncident.id).where(
            EmergencyIncident.personnel_id == person.id,
            EmergencyIncident.status != "resolved",
            EmergencyIncident.id != incident.id,
        )
    ).first()
    if still_active is None:
        person.status = person.prior_status or "at_base"
        person.prior_status = None


@router.get("", response_model=list[EmergencyOut])
def list_incidents(status: Optional[IncidentStatus] = None, db: Session = Depends(get_db)):
    evaluate_escalation(db)
    query = select(EmergencyIncident).order_by(EmergencyIncident.timestamp.desc(), EmergencyIncident.id.desc())
    if status:
        query = query.where(EmergencyIncident.status == status)
    return db.execute(query).scalars().all()


@router.post("", response_model=EmergencyOut, status_code=201)
def raise_incident(body: EmergencyCreate, db: Session = Depends(get_db)):
    person = None
    if body.personnel_id:
        check_ref(db, Personnel, body.personnel_id, "personnel_id")
        person = db.get(Personnel, body.personnel_id)
    station_id = body.station_id or (person.current_station_id if person else None)
    incident = EmergencyIncident(
        id=next_id(db, EmergencyIncident, "INC"),
        type=body.type,
        personnel_id=body.personnel_id,
        station_id=check_ref(db, Station, station_id, "station_id"),
        severity=body.severity,
        description=body.description,
        status="open",
        timestamp=utcnow(),
    )
    db.add(incident)
    if person:
        _flag_personnel(person)
    db.commit()
    return incident


@router.patch("/{incident_id}", response_model=EmergencyOut)
def update_incident(incident_id: str, body: EmergencyUpdate, db: Session = Depends(get_db)):
    incident = get_or_404(db, EmergencyIncident, incident_id, "Incident")
    if STATUS_ORDER[body.status] < STATUS_ORDER[incident.status]:
        raise HTTPException(status_code=409, detail=f"Cannot move incident from {incident.status} back to {body.status}")
    incident.status = body.status
    if body.status == "resolved":
        if incident.resolved_at is None:
            incident.resolved_at = utcnow()
        _release_personnel(db, incident)
    db.commit()
    return incident
