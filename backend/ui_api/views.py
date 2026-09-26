# OWNER: integration (Day 2-3)
# Translates database rows into the shapes the frontend expects, and its status vocabulary back to the
# plan's. Only presentation lives here - the rules (overdue, escalation, risk, low stock) stay in rules/.
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.cargo import CargoItem
from models.emergency import EmergencyIncident
from models.expedition import Expedition
from models.inventory import InventoryItem
from models.personnel import Personnel
from models.station import Station
from routers.expeditions import _risk
from ui_api.common import fmt_date, fmt_ts

REGIONS = ("Antarctic", "Arctic")

EXPEDITION_STATUS = {"planned": "Planned", "in_progress": "Active", "completed": "Completed"}
EXPEDITION_STATUS_DB = {label: value for value, label in EXPEDITION_STATUS.items()}

CARGO_STATUS = {"stored": "Pending", "in_transit": "In Transit", "delivered": "Delivered", "delayed": "Delayed"}
CARGO_STATUS_DB = {label: value for value, label in CARGO_STATUS.items()}

PERSONNEL_STATUS_DB = {"In Field": "on_expedition", "On Leave": "on_leave", "Base": "at_base"}

EMERGENCY_SEVERITY_DB = {"critical": "high", "warning": "medium"}


def region_for(lat: float) -> str:
    return "Antarctic" if lat < 0 else "Arctic"


def station_index(db: Session) -> dict[str, Station]:
    return {s.id: s for s in db.execute(select(Station)).scalars()}


def _station_fields(stations: dict[str, Station], station_id: Optional[str], *, with_region: bool = True) -> dict:
    station = stations.get(station_id) if station_id else None
    fields = {"station_id": station_id, "station_name": station.name if station else None}
    if with_region:
        fields["station_region"] = region_for(station.lat) if station else None
    return fields


# ------------------------------------------------------------------ stations
def station_view(station: Station) -> dict:
    return {"id": station.id, "name": station.name, "region": region_for(station.lat), "lat": station.lat,
            "lng": station.lng, "type": station.type, "status": station.status}


# ------------------------------------------------------------------ expeditions
def expedition_view(exp: Expedition) -> dict:
    route = [w.station_id for w in exp.waypoints]
    region = exp.region or (region_for(exp.waypoints[0].station.lat) if exp.waypoints else "Antarctic")
    lead = exp.team_lead.name if exp.team_lead else (exp.team_lead_name or "-")
    risk = _risk(exp)
    return {
        "id": exp.id,
        "name": exp.name,
        "status": EXPEDITION_STATUS[exp.status],
        "region": region,
        "start_date": fmt_date(exp.start_date),
        "end_date": fmt_date(exp.end_date),
        "team_lead": lead,
        "waypoints": route,
        # Extra to the frontend's own fields: the route-risk rule (rules/risk_score.py) is exposed too.
        "risk_score": risk["risk_score"],
        "risk_band": risk["risk_band"],
        "risk_factors": risk["risk_factors"],
    }


# ------------------------------------------------------------------ cargo
def cargo_view(item: CargoItem, stations: dict[str, Station]) -> dict:
    station = stations.get(item.current_station_id) if item.current_station_id else None
    return {
        "id": item.id,
        "manifest_id": item.manifest_id or f"MAN-{item.id.rsplit('-', 1)[-1]}",
        "description": item.name,
        "status": CARGO_STATUS.get(item.status, "Pending"),
        "origin": item.origin or (station.name if station else "-"),
        "destination": item.destination or "-",
        "weight_kg": item.weight_kg,
        "category": item.category,
        "expedition_id": item.expedition_id,
        "created_at": fmt_ts(item.created_at),
        "updated_at": fmt_ts(item.updated_at),
    }


# ------------------------------------------------------------------ inventory
def is_low_stock(item: InventoryItem) -> bool:
    """The frontend's reading of 'low': at or below the threshold. (The plan's /inventory/alerts rule is
    strictly below - the two only differ when quantity equals the threshold.)"""
    return item.quantity <= item.reorder_threshold


def inventory_view(item: InventoryItem, stations: dict[str, Station]) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "category": item.category,
        **_station_fields(stations, item.station_id),
        "quantity": item.quantity,
        "threshold": item.reorder_threshold,
        "unit": item.unit,
        "needs_maintenance": bool(item.needs_maintenance),
        "created_at": fmt_ts(item.created_at),
        "updated_at": fmt_ts(item.updated_at),
    }


# ------------------------------------------------------------------ personnel
def personnel_ui_status(person: Personnel) -> str:
    """In Field / On Leave / Base. Overdue and emergency are overlays on the status held before them."""
    base = person.prior_status if person.status in ("overdue", "emergency") and person.prior_status else person.status
    if base == "at_base":
        return "Base"
    if base == "on_leave":
        return "On Leave"
    return "In Field"  # on_expedition, in_transit, or an overdue/emergency person with no recorded prior status


def personnel_view(person: Personnel, stations: dict[str, Station]) -> dict:
    return {
        "id": person.id,
        "name": person.name,
        "role": person.role,
        **_station_fields(stations, person.current_station_id),
        "status": personnel_ui_status(person),
        "last_checkin": fmt_ts(person.last_checkin),
    }


# ------------------------------------------------------------------ emergencies
def emergency_view(incident: EmergencyIncident, stations: dict[str, Station]) -> dict:
    resolved = incident.status == "resolved"
    return {
        "id": incident.id,
        "title": incident.description or incident.type.replace("_", " ").capitalize(),
        "severity": "resolved" if resolved else ("critical" if incident.severity == "high" else "warning"),
        "status": "Resolved" if resolved else "Open",
        **_station_fields(stations, incident.station_id, with_region=False),
        "reported_at": fmt_ts(incident.timestamp),
        "resolved_at": fmt_ts(incident.resolved_at),
        # Extra to the frontend's own fields: the escalation rule and the incident's subject.
        "escalated_at": fmt_ts(incident.escalated_at),
        "personnel_id": incident.personnel_id,
    }
