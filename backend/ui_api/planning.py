"""Authenticated planning inputs, side-effect-free simulation and snapshot-backed drafts."""
from datetime import datetime
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db, get_or_404, to_utc_naive, utcnow
from models import Asset, EmergencyIncident, Expedition, InventoryItem, Personnel, Station
from models.planning import ConsumptionProfile, RecoveryDraft, SupplyArrival, SupplyLink
from models.safety import EmergencyResource
from planning import compatible, evaluate, fingerprint, stamp, training_snapshot
from safety import serialize_write
from ui_api.common import record_audit
from ui_api.security import Principal, current_user

router = APIRouter(prefix="/planning", tags=["ui: mission planning"], dependencies=[Depends(current_user)])


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, str_strip_whitespace=True)


class ProfileBody(Input):
    daily_min: float = Field(ge=0, le=1e9)
    daily_max: float = Field(ge=0, le=1e9)
    reserve: float = Field(ge=0, le=1e12)
    basis: Literal["station", "person"] = "station"
    headcount: int | None = Field(default=None, ge=1, le=10000)
    note: str = Field(min_length=12, max_length=1000)

    @model_validator(mode="after")
    def valid_range(self):
        if self.daily_min > self.daily_max:
            raise ValueError("Minimum daily consumption must not exceed maximum.")
        if self.basis == "person" and self.headcount is None:
            raise ValueError("Enter the verified planning headcount for per-person consumption.")
        return self


class ArrivalBody(Input):
    inventory_id: str
    quantity: float = Field(gt=0, le=1e12)
    eta: datetime
    asset_id: str | None = None
    status: Literal["expected", "received", "cancelled"] = "expected"
    note: str = Field(min_length=12, max_length=1000)


class LinkBody(Input):
    source_id: str
    target_id: str
    asset_id: str
    travel_hours: float = Field(gt=0, le=720)
    capacity: float = Field(gt=0, le=1e12)
    mode: Literal["surface", "air", "sea"] = "surface"
    enabled: bool = True
    note: str = Field(min_length=12, max_length=1000)


class Scenario(Input):
    horizon_days: int = Field(default=14, ge=3, le=30)
    delay_hours: int = Field(default=0, ge=0, le=168)
    delay_station_id: str | None = None
    closed_link_id: str | None = None
    unavailable_asset_id: str | None = None
    unavailable_person_id: str | None = None


class SimulationBody(Input):
    training: bool = False
    scenario: Scenario = Field(default_factory=Scenario)


class DraftBody(SimulationBody):
    as_of: datetime
    fingerprint: str = Field(min_length=64, max_length=64)
    option_id: str
    title: str = Field(min_length=3, max_length=140)
    reason: str = Field(min_length=12, max_length=1500)


def model_view(row):
    return {c.name: stamp(getattr(row, c.name)) if isinstance(getattr(row, c.name), datetime)
            else getattr(row, c.name) for c in row.__table__.columns}


def live_snapshot(db):
    profiles = {p.inventory_id: model_view(p) for p in db.scalars(select(ConsumptionProfile))}
    assets = [{"id": a.id, "name": a.name, "category": a.category, "condition": a.condition,
               "holder_type": a.current_holder_type, "holder_id": a.current_holder_id}
              for a in db.scalars(select(Asset).order_by(Asset.id))]
    open_ids = list(db.scalars(select(EmergencyIncident.id).where(EmergencyIncident.status != "resolved")))
    resources = list(db.scalars(select(EmergencyResource).where(EmergencyResource.incident_id.in_(open_ids))))
    return {
        "stations": [{"id": s.id, "name": s.name, "status": s.status} for s in db.scalars(select(Station).order_by(Station.id))],
        "items": [{"id": i.id, "name": i.name, "category": i.category, "quantity": i.quantity,
                   "station_id": i.station_id, "unit": i.unit, "profile": profiles.get(i.id),
                   "updated_at": stamp(i.updated_at)} for i in db.scalars(select(InventoryItem).order_by(InventoryItem.id))],
        "arrivals": [model_view(a) for a in db.scalars(select(SupplyArrival).order_by(SupplyArrival.id))],
        "links": [model_view(l) for l in db.scalars(select(SupplyLink).order_by(SupplyLink.id))],
        "assets": assets,
        "people": [{"id": p.id, "name": p.name, "status": p.status} for p in db.scalars(select(Personnel).order_by(Personnel.id))],
        "missions": [{"id": e.id, "name": e.name, "status": e.status,
                      "asset_ids": [a["id"] for a in assets if a["holder_type"] == "expedition" and a["holder_id"] == e.id],
                      "personnel_ids": [p.id for p in e.personnel],
                      "waypoints": [{"station_id": w.station_id, "status": w.status} for w in e.waypoints]}
                     for e in db.scalars(select(Expedition).where(Expedition.status != "completed").order_by(Expedition.id))],
        "reserved_assets": sorted(r.resource_id for r in resources if r.resource_type == "asset"),
        "reserved_people": sorted(r.resource_id for r in resources if r.resource_type == "personnel"),
    }


def validate_scenario(snapshot, scenario):
    for field, collection in (("delay_station_id", "stations"), ("closed_link_id", "links"),
                              ("unavailable_asset_id", "assets"), ("unavailable_person_id", "people")):
        if scenario.get(field) and scenario[field] not in {row["id"] for row in snapshot[collection]}:
            raise HTTPException(400, f"The selected {field.replace('_id', '').replace('_', ' ')} no longer exists. Refresh the planner.")


def inventory(db, inventory_id):
    item = get_or_404(db, InventoryItem, inventory_id, "Inventory item")
    if not item.station_id or not db.get(Station, item.station_id):
        raise HTTPException(400, "Assign this inventory item to a station before configuring planning inputs.")
    return item


@router.get("/context")
def context(response: Response, training: bool = False, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return {"data": training_snapshot(utcnow().replace(microsecond=0)) if training else live_snapshot(db)}


@router.post("/simulate")
def simulate(body: SimulationBody, response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    now = utcnow().replace(microsecond=0)
    snapshot = training_snapshot(now) if body.training else live_snapshot(db)
    scenario = body.scenario.model_dump()
    validate_scenario(snapshot, scenario)
    return {"data": {**evaluate(snapshot, scenario, now), "training": body.training}}


@router.post("/profiles/{inventory_id}")
def save_profile(inventory_id: str, body: ProfileBody, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    serialize_write(db)
    inventory(db, inventory_id)
    row = db.get(ConsumptionProfile, inventory_id) or ConsumptionProfile(inventory_id=inventory_id)
    for key, value in body.model_dump().items():
        setattr(row, key, value)
    row.updated_at = utcnow()
    db.add(row)
    record_audit(db, user, "update", "planning", inventory_id, "Updated consumption assumptions and protected reserve")
    db.commit()
    return {"data": model_view(row)}


def write_arrival(db, user, body, row):
    inventory(db, body.inventory_id)
    if body.asset_id:
        get_or_404(db, Asset, body.asset_id, "Transport asset")
    for key, value in body.model_dump().items():
        setattr(row, key, to_utc_naive(value) if key == "eta" else value)
    row.updated_at = utcnow()
    db.add(row)
    record_audit(db, user, "update", "planning", row.id, f"Saved expected supply arrival ({row.status}); operational stock unchanged")
    db.commit()
    return {"data": model_view(row)}


@router.post("/arrivals", status_code=201)
def add_arrival(body: ArrivalBody, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    serialize_write(db)
    return write_arrival(db, user, body, SupplyArrival(id="ARR-" + uuid4().hex[:12]))


@router.patch("/arrivals/{arrival_id}")
def edit_arrival(arrival_id: str, body: ArrivalBody, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    serialize_write(db)
    return write_arrival(db, user, body, get_or_404(db, SupplyArrival, arrival_id, "Supply arrival"))


def write_link(db, user, body, row):
    source, target = inventory(db, body.source_id), inventory(db, body.target_id)
    if source.station_id == target.station_id or not compatible(model_view(source), model_view(target)):
        raise HTTPException(400, "A link requires matching item names, categories and units at two different stations.")
    asset = get_or_404(db, Asset, body.asset_id, "Transport asset")
    if asset.category != "vehicle":
        raise HTTPException(400, "Select a vehicle as the transport asset.")
    for key, value in body.model_dump().items():
        setattr(row, key, value)
    row.updated_at = utcnow()
    db.add(row)
    record_audit(db, user, "update", "planning", row.id, "Saved approved supply link and declared trip capacity")
    db.commit()
    return {"data": model_view(row)}


@router.post("/links", status_code=201)
def add_link(body: LinkBody, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    serialize_write(db)
    return write_link(db, user, body, SupplyLink(id="LNK-" + uuid4().hex[:12]))


@router.patch("/links/{link_id}")
def edit_link(link_id: str, body: LinkBody, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    serialize_write(db)
    return write_link(db, user, body, get_or_404(db, SupplyLink, link_id, "Supply link"))


@router.post("/drafts", status_code=201)
def save_draft(body: DraftBody, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    serialize_write(db)
    as_of = to_utc_naive(body.as_of)
    age = (utcnow() - as_of).total_seconds()
    if age < -5 or age > 600:
        raise HTTPException(409, "This forecast is over 10 minutes old. Recalculate before saving a draft.")
    snapshot = training_snapshot(as_of) if body.training else live_snapshot(db)
    if fingerprint(snapshot) != body.fingerprint:
        raise HTTPException(409, "Planning data changed since this forecast. Refresh and review the updated options.")
    scenario = body.scenario.model_dump()
    validate_scenario(snapshot, scenario)
    result = evaluate(snapshot, scenario, as_of)
    option = next((r for r in result["recoveries"] if r["id"] == body.option_id), None)
    if not option:
        raise HTTPException(409, "That recovery option is no longer available. Recalculate the scenario.")
    row = RecoveryDraft(id="PLAN-" + uuid4().hex[:12], title=body.title, reason=body.reason,
                        created_by=user.name, training=body.training,
                        snapshot={"inputs": snapshot, "evaluation": result, "selected_option": option})
    db.add(row)
    record_audit(db, user, "create", "planning", row.id,
                 f'Created {"training " if body.training else ""}recovery draft: {body.title}')
    db.commit()
    return {"data": model_view(row)}


@router.get("/drafts")
def drafts(db: Session = Depends(get_db)):
    rows = db.scalars(select(RecoveryDraft).order_by(RecoveryDraft.created_at.desc()).limit(50))
    return {"data": [{"id": r.id, "title": r.title, "reason": r.reason, "created_by": r.created_by,
                      "created_at": stamp(r.created_at), "training": r.training,
                      "option_title": r.snapshot["selected_option"]["title"]} for r in rows]}


@router.get("/drafts/{draft_id}")
def draft(draft_id: str, response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return {"data": model_view(get_or_404(db, RecoveryDraft, draft_id, "Recovery draft"))}
