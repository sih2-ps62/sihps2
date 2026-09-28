from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db, get_or_404, utcnow
from models.asset import Asset
from models.emergency import EmergencyIncident
from models.safety import CheckInEvent, EmergencyResource
from safety import checkin_view, resource_conflicts
from routers.assets import create_asset, update_asset
from schemas import AssetCreate, AssetUpdate
from ui_api.common import record_audit
from ui_api.security import Principal, current_user

router = APIRouter(tags=["ui: safety"], dependencies=[Depends(current_user)])


@router.get("/assets")
def assets(db: Session = Depends(get_db)):
    reservations = db.execute(select(EmergencyResource, EmergencyIncident).join(EmergencyIncident,
        EmergencyIncident.id == EmergencyResource.incident_id).where(EmergencyIncident.status != "resolved",
        EmergencyResource.resource_type == "asset")).all()
    return {"data": [{"id": a.id, "name": a.name, "category": a.category, "condition": a.condition,
        "holder_type": a.current_holder_type, "holder_id": a.current_holder_id,
        "last_inspected": a.last_inspected.isoformat() if a.last_inspected else None,
        "reserved_by": [i.id for r, i in reservations if r.resource_id == a.id]}
        for a in db.scalars(select(Asset).order_by(Asset.name))]}


@router.post("/assets", status_code=201)
def add_asset(body: AssetCreate, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    asset = create_asset(body, db)
    record_audit(db, user, "create", "asset", asset.id, f"Registered asset {asset.name}")
    db.commit()
    return {"data": {"id": asset.id, "name": asset.name}}


@router.patch("/assets/{asset_id}")
def edit_asset(asset_id: str, body: AssetUpdate, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    asset = update_asset(asset_id, body, db)
    record_audit(db, user, "update", "asset", asset.id, f"Asset condition: {asset.condition}")
    db.commit()
    return {"data": {"id": asset.id, "condition": asset.condition}}


@router.get("/safety/alerts")
def alerts(db: Session = Depends(get_db)):
    events = db.scalars(select(CheckInEvent).where(CheckInEvent.outcome == "deviation",
        CheckInEvent.reviewed_at.is_(None)).order_by(CheckInEvent.timestamp.desc())).all()
    return {"data": {"route_deviations": [checkin_view(db, e) for e in events], "resource_conflicts": resource_conflicts(db)}}


class ReviewBody(BaseModel):
    note: str = Field(min_length=8, max_length=1000)


@router.post("/safety/checkins/{event_id}/review")
def review(event_id: int, body: ReviewBody, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    event = get_or_404(db, CheckInEvent, event_id, "Check-in")
    if event.outcome != "deviation":
        raise HTTPException(400, "Only route deviations need review.")
    if len(body.note.strip()) < 8:
        raise HTTPException(400, "Record how the deviation was verified (at least 8 characters).")
    event.reviewed_at, event.review_note = utcnow(), body.note.strip()
    record_audit(db, user, "review", "expedition", event.expedition_id or event.personnel_id,
                 f"Reviewed route deviation {event.id}: {event.review_note}")
    db.commit()
    return {"data": checkin_view(db, event)}
