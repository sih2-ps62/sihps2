# OWNER: integration (Day 2-3)
# GET, POST /api/expeditions - GET, PATCH, DELETE /api/expeditions/{id}
# Waypoints travel as a plain list of station ids; the plan's waypoint objects (eta, reached) are kept underneath.
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from db import get_db, get_or_404, next_id
from models.asset import Asset
from models.cargo import CargoItem
from models.expedition import Expedition
from models.personnel import Personnel
from routers.expeditions import _set_waypoints
from rules.overdue_checkin import evaluate_overdue
from schemas import WaypointIn
from ui_api.common import ListParams, list_params, paginate, parse_date, record_audit, require_fields, search
from ui_api.security import Principal, current_user, require_admin
from ui_api.views import EXPEDITION_STATUS_DB, REGIONS, expedition_view

router = APIRouter(prefix="/expeditions", tags=["ui: expeditions"], dependencies=[Depends(current_user)])

SORTABLE = ("name", "status", "region", "start_date")


class ExpeditionBody(BaseModel):
    model_config = ConfigDict(extra="ignore")  # the form also sends origin/destination, folded into `waypoints`
    name: Optional[str] = None
    status: Optional[str] = None
    region: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    team_lead: Optional[str] = None
    waypoints: Optional[list[str]] = None


def _status(label: str) -> str:
    if label not in EXPEDITION_STATUS_DB:
        raise HTTPException(status_code=400, detail=f"status must be one of: {', '.join(EXPEDITION_STATUS_DB)}.")
    return EXPEDITION_STATUS_DB[label]


def _region(value: str) -> str:
    if value not in REGIONS:
        raise HTTPException(status_code=400, detail=f"region must be one of: {', '.join(REGIONS)}.")
    return value


def _lead(db: Session, name: str) -> tuple[Optional[str], str]:
    """A roster member when the name matches one, otherwise just the typed name."""
    name = name.strip()
    person = db.execute(select(Personnel).where(func.lower(Personnel.name) == name.lower())).scalars().first()
    return (person.id, person.name) if person else (None, name)


def _route(exp: Expedition, station_ids: list[str]) -> list[WaypointIn]:
    """Keep a waypoint (and its eta / reached state) when the same station stays at the same position."""
    current = list(exp.waypoints)
    items = []
    for index, station_id in enumerate(s for s in station_ids if s):
        if index < len(current) and current[index].station_id == station_id:
            items.append(WaypointIn(id=current[index].id))
        else:
            items.append(WaypointIn(station_id=station_id))
    return items


def _check_dates(exp: Expedition) -> None:
    if exp.end_date and exp.end_date < exp.start_date:
        raise HTTPException(status_code=400, detail="end_date must not be before start_date.")


@router.get("")
def list_expeditions(
    status: Optional[str] = None,
    region: Optional[str] = None,
    params: ListParams = Depends(list_params),
    db: Session = Depends(get_db),
):
    evaluate_overdue(db)
    rows = [expedition_view(e) for e in db.execute(select(Expedition).order_by(Expedition.id)).scalars()]
    if status:
        rows = [r for r in rows if r["status"] == status]
    if region:
        rows = [r for r in rows if r["region"] == region]
    rows = search(rows, params.q, ("name", "team_lead"))
    return paginate(rows, params, sortable=SORTABLE, default_sort="start_date")


@router.get("/{expedition_id}")
def get_expedition(expedition_id: str, db: Session = Depends(get_db)):
    evaluate_overdue(db)
    return {"data": expedition_view(get_or_404(db, Expedition, expedition_id, "Expedition"))}


@router.post("", status_code=201)
def create_expedition(body: ExpeditionBody, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    values = body.model_dump()
    require_fields(values, ("name", "status", "region", "start_date", "team_lead"),
                   "name, status, region, start_date and team_lead are required.")
    lead_id, lead_name = _lead(db, values["team_lead"])
    exp = Expedition(
        id=next_id(db, Expedition, "EXP"),
        name=values["name"].strip(),
        status=_status(values["status"]),
        region=_region(values["region"]),
        start_date=parse_date(values["start_date"], "start_date"),
        end_date=parse_date(values["end_date"], "end_date"),
        team_lead_id=lead_id,
        team_lead_name=lead_name,
    )
    _check_dates(exp)
    db.add(exp)
    db.flush()
    _set_waypoints(db, exp, _route(exp, values["waypoints"] or []))
    record_audit(db, user, "create", "expedition", exp.id, f'Created expedition "{exp.name}"')
    db.commit()
    db.refresh(exp)
    return {"data": expedition_view(exp)}


@router.patch("/{expedition_id}")
def update_expedition(expedition_id: str, body: ExpeditionBody, db: Session = Depends(get_db),
                      user: Principal = Depends(current_user)):
    exp = get_or_404(db, Expedition, expedition_id, "Expedition")
    changes = body.model_dump(exclude_unset=True)
    for required in ("name", "start_date", "team_lead", "status", "region"):
        if required in changes and changes[required] in (None, ""):
            raise HTTPException(status_code=400, detail=f"{required} cannot be empty.")

    if "name" in changes:
        exp.name = changes["name"].strip()
    if "status" in changes:
        exp.status = _status(changes["status"])
    if "region" in changes:
        exp.region = _region(changes["region"])
    if "start_date" in changes:
        exp.start_date = parse_date(changes["start_date"], "start_date")
    if "end_date" in changes:
        exp.end_date = parse_date(changes["end_date"], "end_date")
    if "team_lead" in changes:
        exp.team_lead_id, exp.team_lead_name = _lead(db, changes["team_lead"])
    _check_dates(exp)
    if changes.get("waypoints") is not None:
        _set_waypoints(db, exp, _route(exp, changes["waypoints"]))

    record_audit(db, user, "update", "expedition", exp.id, f'Updated expedition "{exp.name}"')
    db.commit()
    db.refresh(exp)
    return {"data": expedition_view(exp)}


@router.delete("/{expedition_id}", status_code=204)
def delete_expedition(expedition_id: str, db: Session = Depends(get_db), user: Principal = Depends(require_admin)):
    exp = get_or_404(db, Expedition, expedition_id, "Expedition")
    # Nothing may be left pointing at the expedition: cargo is unassigned, held assets go back to a station.
    held = db.execute(select(Asset).where(Asset.current_holder_type == "expedition",
                                          Asset.current_holder_id == exp.id)).scalars().all()
    if held and not exp.waypoints:
        raise HTTPException(status_code=409, detail=f"{exp.id} still holds assets and has no station to return them to.")
    for asset in held:
        asset.current_holder_type, asset.current_holder_id = "station", exp.waypoints[0].station_id
    for item in db.execute(select(CargoItem).where(CargoItem.expedition_id == exp.id)).scalars():
        item.expedition_id = None
    name = exp.name
    db.delete(exp)
    record_audit(db, user, "delete", "expedition", expedition_id, f'Deleted expedition "{name}"')
    db.commit()
    return Response(status_code=204)
