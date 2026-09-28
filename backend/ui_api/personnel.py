# OWNER: integration (Day 2-3)
# GET, POST /api/personnel - GET, PATCH, DELETE /api/personnel/{id} - POST /api/personnel/{id}/checkin
# Status is In Field / On Leave / Base here; the plan's overdue and emergency states stay underneath as overlays.
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from db import check_ref, get_db, get_or_404, next_id, utcnow
from models.emergency import EmergencyIncident
from models.expedition import Expedition, expedition_personnel
from models.personnel import Personnel
from models.station import Station
from rules.overdue_checkin import evaluate_overdue
from ui_api.common import ListParams, blank_to_none, list_params, paginate, record_audit, require_fields, search
from ui_api.security import Principal, current_user, require_admin
from ui_api.views import PERSONNEL_STATUS_DB, personnel_ui_status, personnel_view, station_index
from schemas import CheckInBody
from safety import checkin_view, record_checkin, serialize_write
from models.safety import CheckInEvent, EmergencyResource, MedicalAccessGrant, MedicalProfile

router = APIRouter(prefix="/personnel", tags=["ui: personnel"], dependencies=[Depends(current_user)])

SORTABLE = ("name", "role", "status")


class PersonnelBody(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    role: Optional[str] = None
    station_id: Optional[str] = None
    status: Optional[str] = None


def _status(label: str) -> str:
    if label not in PERSONNEL_STATUS_DB:
        raise HTTPException(status_code=400, detail=f"status must be one of: {', '.join(PERSONNEL_STATUS_DB)}.")
    return PERSONNEL_STATUS_DB[label]


@router.get("")
def list_personnel(status: Optional[str] = None, params: ListParams = Depends(list_params),
                   db: Session = Depends(get_db)):
    evaluate_overdue(db)
    stations = station_index(db)
    rows = [personnel_view(p, stations) for p in db.execute(select(Personnel).order_by(Personnel.id)).scalars()]
    if status:
        rows = [r for r in rows if r["status"] == status]
    rows = search(rows, params.q, ("name", "role"))
    return paginate(rows, params, sortable=SORTABLE, default_sort="name")


@router.get("/{personnel_id}")
def get_personnel(personnel_id: str, db: Session = Depends(get_db)):
    evaluate_overdue(db)
    return {"data": personnel_view(get_or_404(db, Personnel, personnel_id, "Personnel record"), station_index(db))}


@router.post("", status_code=201)
def create_personnel(body: PersonnelBody, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    values = body.model_dump()
    require_fields(values, ("name", "role", "status"), "name, role and status are required.")
    person = Personnel(
        id=next_id(db, Personnel, "PER"),
        name=values["name"].strip(),
        role=values["role"].strip(),
        current_station_id=check_ref(db, Station, blank_to_none(values["station_id"]), "station_id"),
        status=_status(values["status"]),
        last_checkin=utcnow(),  # a new joiner starts checked in
    )
    db.add(person)
    record_audit(db, user, "create", "personnel", person.id, f'Added personnel "{person.name}" ({person.role})')
    db.commit()
    return {"data": personnel_view(person, station_index(db))}


@router.patch("/{personnel_id}")
def update_personnel(personnel_id: str, body: PersonnelBody, db: Session = Depends(get_db),
                     user: Principal = Depends(current_user)):
    person = get_or_404(db, Personnel, personnel_id, "Personnel record")
    changes = body.model_dump(exclude_unset=True)
    for required in ("name", "role", "status"):
        if required in changes and changes[required] in (None, ""):
            raise HTTPException(status_code=400, detail=f"{required} cannot be empty.")

    if "name" in changes:
        person.name = changes["name"].strip()
    if "role" in changes:
        person.role = changes["role"].strip()
    if "station_id" in changes:
        person.current_station_id = check_ref(db, Station, blank_to_none(changes["station_id"]), "station_id")
    if "status" in changes:
        new_status = _status(changes["status"])
        if person.status in ("overdue", "emergency"):
            person.prior_status = new_status  # the overlay stays until it clears, then restores to this
        else:
            person.status = new_status

    record_audit(db, user, "update", "personnel", person.id,
                 f'Updated personnel "{person.name}" ({personnel_ui_status(person)})')
    db.commit()
    return {"data": personnel_view(person, station_index(db))}


@router.post("/{personnel_id}/checkin")
def check_in(personnel_id: str, body: Optional[CheckInBody] = None, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    serialize_write(db)
    person = get_or_404(db, Personnel, personnel_id, "Personnel record")
    events = record_checkin(db, person, body.station_id if body else None, body.observed_at if body else None)
    record_audit(db, user, "update", "personnel", person.id, f'Check-in recorded for "{person.name}"')
    for event in events:
        if event.outcome == "deviation":
            record_audit(db, user, "alert", "expedition", event.expedition_id,
                         f"Route deviation: {person.id} checked in at {event.station_id}; expected {event.expected_station_id}")
    db.commit()
    return {"data": personnel_view(person, station_index(db)), "checkins": [checkin_view(db, e) for e in events]}


@router.delete("/{personnel_id}", status_code=204)
def delete_personnel(personnel_id: str, db: Session = Depends(get_db), user: Principal = Depends(require_admin)):
    person = get_or_404(db, Personnel, personnel_id, "Personnel record")
    if db.scalars(select(Expedition).where(Expedition.status == "in_progress", Expedition.personnel.any(id=person.id))).first():
        raise HTTPException(409, "Unassign this person from active expeditions before removing their record.")
    if db.get(MedicalProfile, person.id):
        raise HTTPException(409, "This person has a restricted medical registration. Contact the medical data custodian before deletion.")
    db.query(CheckInEvent).filter_by(personnel_id=person.id).delete()
    db.query(MedicalProfile).filter_by(personnel_id=person.id).delete()
    db.query(MedicalAccessGrant).filter_by(scope=f"profile:{person.id}").delete()
    db.query(EmergencyResource).filter_by(resource_type="personnel", resource_id=person.id).delete()
    # Release everything that points at this person before removing them.
    db.execute(update(Expedition).where(Expedition.team_lead_id == person.id).values(team_lead_id=None))
    db.execute(update(EmergencyIncident).where(EmergencyIncident.personnel_id == person.id).values(personnel_id=None))
    db.execute(expedition_personnel.delete().where(expedition_personnel.c.personnel_id == person.id))
    name = person.name
    db.delete(person)
    record_audit(db, user, "delete", "personnel", personnel_id, f'Removed personnel "{name}"')
    db.commit()
    return Response(status_code=204)
