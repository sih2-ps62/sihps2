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
from routers.expeditions import _set_personnel, _set_waypoints
from models.safety import CheckInEvent, ExpeditionManifest
from safety import checkin_view, enforce_expedition_write, launch_gate, serialize_write, set_manifest
from rules.overdue_checkin import evaluate_overdue
from rules.risk_score import compute_risk, season_for, worst_weather
from schemas import WaypointIn
from ui_api.common import ListParams, list_params, paginate, parse_date, record_audit, require_fields, search
from ui_api.security import Principal, current_user, require_admin
from ui_api.views import EXPEDITION_STATUS_DB, REGIONS, expedition_view
from weather import station_forecast

TREND_SAMPLE_HOURS = 6  # one point every 6 hours keeps a 3-day trend to a readable ~12 points

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
    personnel_ids: Optional[list[str]] = None
    asset_ids: Optional[list[str]] = None
    emergency_kit_id: Optional[str] = None


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
    exp = get_or_404(db, Expedition, expedition_id, "Expedition")
    assets = db.scalars(select(Asset).where(Asset.current_holder_type == "expedition", Asset.current_holder_id == exp.id)).all()
    manifest = db.get(ExpeditionManifest, exp.id)
    events = db.scalars(select(CheckInEvent).where(CheckInEvent.expedition_id == exp.id).order_by(CheckInEvent.timestamp.desc()).limit(50)).all()
    unresolved = db.scalars(select(CheckInEvent).where(CheckInEvent.expedition_id == exp.id,
        CheckInEvent.outcome == "deviation", CheckInEvent.reviewed_at.is_(None)).order_by(CheckInEvent.timestamp.desc())).all()
    return {"data": {**expedition_view(exp), "departure_gate": launch_gate(db, exp),
        "personnel_ids": [p.id for p in exp.personnel], "asset_ids": [a.id for a in assets],
        "emergency_kit_id": manifest.emergency_kit_id if manifest else None,
        "route_steps": [{"id": w.id, "station_id": w.station_id, "station_name": w.station.name,
                         "sequence": w.sequence, "status": w.status} for w in exp.waypoints],
        "checkins": [checkin_view(db, e) for e in events], "route_deviations": [checkin_view(db, e) for e in unresolved]}}


@router.post("/{expedition_id}/waypoints/{waypoint_id}/reach")
def reach_waypoint(expedition_id: str, waypoint_id: str, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    serialize_write(db)
    exp = get_or_404(db, Expedition, expedition_id, "Expedition")
    if exp.status != "in_progress":
        raise HTTPException(409, "Launch the expedition before marking a waypoint reached.")
    waypoint = next((w for w in exp.waypoints if w.id == waypoint_id), None)
    if waypoint is None:
        raise HTTPException(404, "Waypoint not found on this expedition.")
    next_stop = next((w for w in exp.waypoints if w.status == "pending"), None)
    if waypoint.status != "reached" and waypoint != next_stop:
        raise HTTPException(409, "Reach waypoints in planned order.")
    from safety import require_buddy
    require_buddy(exp)
    waypoint.status = "reached"
    record_audit(db, user, "update", "expedition", exp.id, f"Reached waypoint {waypoint.id}; buddy rule verified")
    db.commit()
    return {"data": {"id": waypoint.id, "status": waypoint.status}}


@router.get("/{expedition_id}/risk-trend")
def get_expedition_risk_trend(expedition_id: str, db: Session = Depends(get_db)):
    """Route risk over the next 3 days using the weather forecast instead of just today's reading — lets a duty
    officer see 'depart now = medium risk, wait 18h for this front to pass = low' instead of only a snapshot."""
    exp = get_or_404(db, Expedition, expedition_id, "Expedition")
    stations = [w.station for w in exp.waypoints]
    if not stations:
        return {"data": []}

    forecasts = [station_forecast(s) for s in stations]
    length = min((len(f) for f in forecasts), default=0)
    if length == 0:
        return {"data": []}  # the forecast service is unreachable right now

    crew = list(exp.personnel) + ([exp.team_lead] if exp.team_lead else [])
    overdue = any(p.status == "overdue" for p in crew)

    trend = []
    for hour in range(0, length, TREND_SAMPLE_HOURS):
        route_weather = worst_weather(f[hour]["code"] for f in forecasts)
        risk = compute_risk(route_weather, len(exp.waypoints), overdue, season_for(exp.start_date))
        trend.append({
            "time": forecasts[0][hour]["time"],
            "weather_code": route_weather,
            "risk_score": risk["risk_score"],
            "risk_band": risk["risk_band"],
        })
    return {"data": trend}


@router.post("", status_code=201)
def create_expedition(body: ExpeditionBody, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    serialize_write(db)
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
    _set_personnel(db, exp, body.personnel_ids or [])
    set_manifest(db, exp, body.asset_ids or [], body.emergency_kit_id)
    enforce_expedition_write(db, exp)
    record_audit(db, user, "create", "expedition", exp.id, f'Created expedition "{exp.name}"')
    db.commit()
    db.refresh(exp)
    return {"data": expedition_view(exp)}


@router.patch("/{expedition_id}")
def update_expedition(expedition_id: str, body: ExpeditionBody, db: Session = Depends(get_db),
                      user: Principal = Depends(current_user)):
    serialize_write(db)
    exp = get_or_404(db, Expedition, expedition_id, "Expedition")
    previous_status = exp.status
    previously_reached = {w.id for w in exp.waypoints if w.status == "reached"}
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
    if body.personnel_ids is not None:
        _set_personnel(db, exp, body.personnel_ids)
    if body.asset_ids is not None:
        set_manifest(db, exp, body.asset_ids, body.emergency_kit_id)
    elif "emergency_kit_id" in changes:
        raise HTTPException(400, "Send asset_ids with emergency_kit_id to update the manifest.")
    enforce_expedition_write(db, exp, previous_status, previously_reached, body.personnel_ids is not None)

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
    db.query(ExpeditionManifest).filter_by(expedition_id=exp.id).delete()
    db.query(CheckInEvent).filter_by(expedition_id=exp.id).update({"expedition_id": None})
    db.delete(exp)
    record_audit(db, user, "delete", "expedition", expedition_id, f'Deleted expedition "{name}"')
    db.commit()
    return Response(status_code=204)
