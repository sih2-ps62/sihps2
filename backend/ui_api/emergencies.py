# OWNER: integration (Day 2-3)
# GET, POST /api/emergencies - PATCH, DELETE /api/emergencies/{id}
# Severity is critical / warning here. The plan's escalation rule keeps running underneath: a stale open
# warning is bumped up a level and shows as critical.
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import check_ref, get_db, get_or_404, next_id, utcnow
from models.emergency import EmergencyIncident
from models.station import Station
from routers.emergency import _release_personnel
from rules.escalation import evaluate_escalation
from ui_api.common import ListParams, blank_to_none, list_params, paginate, record_audit, require_fields, search
from ui_api.security import Principal, current_user, require_admin
from ui_api.views import EMERGENCY_SEVERITY_DB, emergency_view, station_index

router = APIRouter(prefix="/emergencies", tags=["ui: emergencies"], dependencies=[Depends(current_user)])

SORTABLE = ("title", "severity", "status", "reported_at")


class EmergencyBody(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: Optional[str] = None
    severity: Optional[str] = None
    station_id: Optional[str] = None
    status: Optional[str] = None


def _severity(label: str) -> str:
    if label not in EMERGENCY_SEVERITY_DB:
        raise HTTPException(status_code=400, detail=f"severity must be one of: {', '.join(EMERGENCY_SEVERITY_DB)}.")
    return EMERGENCY_SEVERITY_DB[label]


@router.get("")
def list_emergencies(status: Optional[str] = None, params: ListParams = Depends(list_params),
                     db: Session = Depends(get_db)):
    evaluate_escalation(db)
    stations = station_index(db)
    rows = [emergency_view(i, stations) for i in db.execute(select(EmergencyIncident).order_by(EmergencyIncident.id)).scalars()]
    if status:
        rows = [r for r in rows if r["status"] == status]
    rows = search(rows, params.q, ("title",))
    return paginate(rows, params, sortable=SORTABLE, default_sort="reported_at")


@router.get("/{incident_id}")
def get_emergency(incident_id: str, db: Session = Depends(get_db)):
    evaluate_escalation(db)
    return {"data": emergency_view(get_or_404(db, EmergencyIncident, incident_id, "Emergency"), station_index(db))}


@router.post("", status_code=201)
def report_emergency(body: EmergencyBody, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    values = body.model_dump()
    require_fields(values, ("title", "severity"), "title and severity are required.")
    incident = EmergencyIncident(
        id=next_id(db, EmergencyIncident, "INC"),
        type="reported",
        description=values["title"].strip(),
        severity=_severity(values["severity"]),
        station_id=check_ref(db, Station, blank_to_none(values["station_id"]), "station_id"),
        status="open",
        timestamp=utcnow(),
    )
    db.add(incident)
    record_audit(db, user, "create", "emergency", incident.id,
                 f'Reported emergency "{incident.description}" ({values["severity"]})')
    db.commit()
    return {"data": emergency_view(incident, station_index(db))}


@router.patch("/{incident_id}")
def update_emergency(incident_id: str, body: EmergencyBody, db: Session = Depends(get_db),
                     user: Principal = Depends(current_user)):
    incident = get_or_404(db, EmergencyIncident, incident_id, "Emergency")
    changes = body.model_dump(exclude_unset=True)
    if "title" in changes:
        if not changes["title"]:
            raise HTTPException(status_code=400, detail="title cannot be empty.")
        incident.description = changes["title"].strip()
    if "severity" in changes:
        incident.severity = _severity(changes["severity"])
    if "station_id" in changes:
        incident.station_id = check_ref(db, Station, blank_to_none(changes["station_id"]), "station_id")

    resolving = False
    if "status" in changes:
        if changes["status"] == "Resolved":
            resolving = incident.status != "resolved"
            if resolving:
                incident.status = "resolved"
                incident.resolved_at = utcnow()
                _release_personnel(db, incident)
        elif changes["status"] == "Open":
            if incident.status == "resolved":
                raise HTTPException(status_code=409, detail="A resolved emergency cannot be reopened.")
        else:
            raise HTTPException(status_code=400, detail="status must be one of: Open, Resolved.")

    title = incident.description or incident.type
    record_audit(db, user, "update", "emergency", incident.id,
                 f'Resolved emergency "{title}"' if resolving else f'Updated emergency "{title}"')
    db.commit()
    return {"data": emergency_view(incident, station_index(db))}


@router.delete("/{incident_id}", status_code=204)
def delete_emergency(incident_id: str, db: Session = Depends(get_db), user: Principal = Depends(require_admin)):
    incident = get_or_404(db, EmergencyIncident, incident_id, "Emergency")
    if incident.status != "resolved":
        _release_personnel(db, incident)
    title = incident.description or incident.type
    db.delete(incident)
    record_audit(db, user, "delete", "emergency", incident_id, f'Deleted emergency "{title}"')
    db.commit()
    return Response(status_code=204)
