# OWNER: Maisha
# GET /expeditions, POST /expeditions
# GET /expeditions/{id}, PATCH /expeditions/{id}
# GET /expeditions/{id}/risk
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import check_ref, get_db, get_or_404, next_id, to_utc_naive, utcnow
from models.cargo import CargoItem
from models.expedition import Expedition
from models.personnel import Personnel
from models.station import Station
from models.waypoint import Waypoint
from rules.overdue_checkin import evaluate_overdue
from rules.risk_score import WEATHER_SEVERITY, compute_risk, season_for, worst_weather
from schemas import (ExpeditionCreate, ExpeditionOut, ExpeditionStatus, ExpeditionUpdate, RiskOut,
                     WaypointIn)

router = APIRouter(prefix="/expeditions", tags=["expeditions"])


def _risk(exp: Expedition, weather_code: Optional[str] = None, season: Optional[str] = None) -> dict:
    """Risk for an expedition. Route weather defaults to the worst weather among its waypoint stations."""
    route_weather = weather_code or worst_weather(w.station.weather_code for w in exp.waypoints)
    crew = list(exp.personnel) + ([exp.team_lead] if exp.team_lead else [])
    overdue = any(p.status == "overdue" for p in crew)
    return compute_risk(route_weather, len(exp.waypoints), overdue, season or season_for(exp.start_date))


def _serialize(exp: Expedition) -> ExpeditionOut:
    risk = _risk(exp)
    return ExpeditionOut(
        id=exp.id,
        name=exp.name,
        start_date=exp.start_date,
        end_date=exp.end_date,
        status=exp.status,
        team_lead_id=exp.team_lead_id,
        waypoints=exp.waypoints,
        personnel_ids=[p.id for p in exp.personnel],
        cargo_ids=[c.id for c in exp.cargo_items],
        risk_score=risk["risk_score"],
        risk_factors=risk["risk_factors"],
    )


def _set_personnel(db: Session, exp: Expedition, personnel_ids: list[str]):
    unique = list(dict.fromkeys(personnel_ids))
    people = db.execute(select(Personnel).where(Personnel.id.in_(unique))).scalars().all()
    missing = set(unique) - {p.id for p in people}
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown personnel_id: {', '.join(sorted(missing))}")
    exp.personnel = people


def _set_cargo(db: Session, exp: Expedition, cargo_ids: list[str]):
    """Cargo owns the link, so assignment writes cargo.expedition_id (full replace of this expedition's cargo)."""
    unique = list(dict.fromkeys(cargo_ids))
    items = db.execute(select(CargoItem).where(CargoItem.id.in_(unique))).scalars().all()
    missing = set(unique) - {c.id for c in items}
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown cargo_id: {', '.join(sorted(missing))}")
    for current in db.execute(select(CargoItem).where(CargoItem.expedition_id == exp.id)).scalars():
        if current.id not in unique:
            current.expedition_id = None
    for item in items:
        item.expedition_id = exp.id


def _set_waypoints(db: Session, exp: Expedition, items: list[WaypointIn]):
    """Replace the route. Items with an id keep that waypoint (updating supplied fields); others are new.
    Waypoints left out are removed; sequence follows list order."""
    existing = {w.id: w for w in exp.waypoints}
    route: list[Waypoint] = []
    for item in items:
        if item.id:
            waypoint = existing.get(item.id)
            if waypoint is None:
                raise HTTPException(status_code=400, detail=f"Waypoint {item.id} does not belong to {exp.id}")
            if item.station_id:
                waypoint.station_id = check_ref(db, Station, item.station_id, "station_id")
            if "eta" in item.model_fields_set:
                waypoint.eta = to_utc_naive(item.eta) if item.eta else None
            if item.status:
                waypoint.status = item.status
        else:
            if not item.station_id:
                raise HTTPException(status_code=400, detail="New waypoints need a station_id")
            waypoint = Waypoint(
                id=next_id(db, Waypoint, "WPT"),
                expedition_id=exp.id,
                station_id=check_ref(db, Station, item.station_id, "station_id"),
                sequence=0,
                eta=to_utc_naive(item.eta) if item.eta else None,
                status=item.status or "pending",
            )
            db.add(waypoint)
            db.flush()
        route.append(waypoint)
    for sequence, waypoint in enumerate(route, start=1):
        waypoint.sequence = sequence
    exp.waypoints = route


@router.get("", response_model=list[ExpeditionOut])
def list_expeditions(status: Optional[ExpeditionStatus] = None, db: Session = Depends(get_db)):
    evaluate_overdue(db)
    query = select(Expedition).order_by(Expedition.id)
    if status:
        query = query.where(Expedition.status == status)
    return [_serialize(exp) for exp in db.execute(query).scalars()]


@router.post("", response_model=ExpeditionOut, status_code=201)
def create_expedition(body: ExpeditionCreate, db: Session = Depends(get_db)):
    exp = Expedition(
        id=next_id(db, Expedition, "EXP"),
        name=body.name,
        start_date=body.start_date,
        end_date=body.end_date,
        status=body.status,
        team_lead_id=check_ref(db, Personnel, body.team_lead_id, "team_lead_id"),
    )
    db.add(exp)
    db.flush()
    _set_waypoints(db, exp, body.waypoints)
    _set_personnel(db, exp, body.personnel_ids)
    _set_cargo(db, exp, body.cargo_ids)
    db.commit()
    db.refresh(exp)
    return _serialize(exp)


@router.get("/{expedition_id}", response_model=ExpeditionOut)
def get_expedition(expedition_id: str, db: Session = Depends(get_db)):
    evaluate_overdue(db)
    return _serialize(get_or_404(db, Expedition, expedition_id, "Expedition"))


@router.patch("/{expedition_id}", response_model=ExpeditionOut)
def update_expedition(expedition_id: str, body: ExpeditionUpdate, db: Session = Depends(get_db)):
    exp = get_or_404(db, Expedition, expedition_id, "Expedition")
    changes = body.model_dump(exclude_unset=True)

    for field in ("name", "start_date", "end_date", "status"):
        if changes.get(field) is not None:
            setattr(exp, field, changes[field])
    if exp.end_date and exp.end_date < exp.start_date:
        raise HTTPException(status_code=400, detail="end_date must not be before start_date")
    if "team_lead_id" in changes:
        exp.team_lead_id = check_ref(db, Personnel, changes["team_lead_id"], "team_lead_id")
    if body.waypoints is not None:
        _set_waypoints(db, exp, body.waypoints)
    if body.personnel_ids is not None:
        _set_personnel(db, exp, body.personnel_ids)
    if body.cargo_ids is not None:
        _set_cargo(db, exp, body.cargo_ids)

    db.commit()
    db.refresh(exp)
    return _serialize(exp)


@router.get("/{expedition_id}/risk", response_model=RiskOut)
def get_expedition_risk(
    expedition_id: str,
    weather_code: Optional[str] = Query(default=None, description="Simulate route weather: " + ", ".join(WEATHER_SEVERITY)),
    season: Optional[str] = Query(default=None, description="Simulate season: summer or winter"),
    db: Session = Depends(get_db),
):
    if weather_code is not None and weather_code not in WEATHER_SEVERITY:
        raise HTTPException(status_code=400, detail=f"weather_code must be one of: {', '.join(WEATHER_SEVERITY)}")
    if season is not None and season not in ("summer", "winter"):
        raise HTTPException(status_code=400, detail="season must be summer or winter")
    evaluate_overdue(db)
    exp = get_or_404(db, Expedition, expedition_id, "Expedition")
    return RiskOut(expedition_id=exp.id, generated_at=utcnow(), **_risk(exp, weather_code, season))
