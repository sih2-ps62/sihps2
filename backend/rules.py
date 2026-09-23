"""Rule engine — plain Python, no ML. Every function here is a checkable,
deterministic rule computed server-side, matching API_CONTRACT.md section
'Shared contract rules'.
"""
import math
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

import models

OVERDUE_HOURS = 6
GEOFENCE_KM = 15
GEOFENCE_CHECKIN_WINDOW_HOURS = 1
ASSET_WARNING_PCT = 70
ASSET_CRITICAL_PCT = 40

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def now():
    return datetime.now(timezone.utc)


def as_aware(dt):
    """SQLite loses tzinfo on round-trip; treat naive datetimes as UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def haversine_km(lat1, lng1, lat2, lng2):
    if None in (lat1, lng1, lat2, lng2):
        return None
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# ---------------------------------------------------------------------------
# Per-record recompute rules — called right after any write touches a record
# ---------------------------------------------------------------------------

def recompute_inventory_status(item: models.InventoryItem):
    item.status = "low" if item.quantity < item.reorder_threshold else "ok"
    return item


def recompute_personnel_overdue(person: models.Personnel):
    last = as_aware(person.last_checkin)
    if last and person.status not in ("emergency",):
        overdue = (now() - last) > timedelta(hours=OVERDUE_HOURS)
        if overdue and person.status != "overdue":
            person.status = "overdue"
        elif not overdue and person.status == "overdue":
            person.status = "at_base"
    return person


def recompute_asset_status(asset: models.Asset):
    if asset.health_pct < ASSET_CRITICAL_PCT:
        asset.status = "critical"
    elif asset.health_pct < ASSET_WARNING_PCT:
        asset.status = "warning"
    else:
        asset.status = "operational"
    return asset


def recompute_waypoint_status(wp: models.Waypoint):
    eta = as_aware(wp.eta)
    if wp.status == "pending" and eta and eta < now():
        wp.status = "at_risk"
    return wp


def is_cargo_delayed(cargo: models.CargoItem):
    eta = as_aware(cargo.eta)
    if cargo.status == "in_transit" and eta and eta < now():
        hours = (now() - eta).total_seconds() / 3600
        return True, round(hours, 1)
    return False, 0


def geofence_breach(person: models.Personnel, station: models.Station):
    if not station or person.lat is None or person.lng is None:
        return False, None
    dist = haversine_km(person.lat, person.lng, station.lat, station.lng)
    if dist is None:
        return False, None
    last = as_aware(person.last_checkin)
    stale_checkin = (not last) or (now() - last) > timedelta(hours=GEOFENCE_CHECKIN_WINDOW_HOURS)
    if dist > GEOFENCE_KM and stale_checkin:
        return True, round(dist, 1)
    return False, round(dist, 1) if dist is not None else None


def escalate_severity(current: str) -> str:
    order = ["low", "medium", "high", "critical"]
    idx = order.index(current) if current in order else 0
    return order[min(idx + 1, len(order) - 1)]


# ---------------------------------------------------------------------------
# Sweep — run across the whole DB (called on-demand by GET endpoints so the
# demo never needs a background scheduler)
# ---------------------------------------------------------------------------

def sweep_all(db: Session):
    for item in db.query(models.InventoryItem).all():
        recompute_inventory_status(item)
    for person in db.query(models.Personnel).all():
        recompute_personnel_overdue(person)
    for asset in db.query(models.Asset).all():
        recompute_asset_status(asset)
    for wp in db.query(models.Waypoint).all():
        recompute_waypoint_status(wp)
    db.commit()


# ---------------------------------------------------------------------------
# Auto-incident creation — geofence breaches and critical correlated risks
# raise a real EmergencyIncident, not just a dashboard alert
# ---------------------------------------------------------------------------

def sync_auto_incidents(db: Session):
    from ids import next_id

    for person in db.query(models.Personnel).all():
        station = db.get(models.Station, person.current_station_id) if person.current_station_id else None
        breach, dist = geofence_breach(person, station)
        existing = db.query(models.EmergencyIncident).filter(
            models.EmergencyIncident.personnel_id == person.id,
            models.EmergencyIncident.type == "geofence_breach",
            models.EmergencyIncident.status != "resolved",
        ).first()
        if breach:
            if existing:
                existing.severity = escalate_severity(existing.severity)
            else:
                db.add(models.EmergencyIncident(
                    id=next_id(db, "INC"),
                    type="geofence_breach",
                    personnel_id=person.id,
                    station_id=person.current_station_id,
                    severity="medium",
                    description=f"{person.name} is {dist}km from home station with no recent check-in.",
                    status="open",
                    timestamp=now(),
                    auto_generated=True,
                ))
            if person.status not in ("overdue",):
                person.status = "emergency"
        elif existing:
            existing.status = "resolved"

    db.commit()


# ---------------------------------------------------------------------------
# Alerts — merged, prioritized feed
# ---------------------------------------------------------------------------

def build_alerts(db: Session):
    sweep_all(db)
    sync_auto_incidents(db)
    alerts = []

    # Low stock
    for item in db.query(models.InventoryItem).filter(models.InventoryItem.status == "low").all():
        alerts.append({
            "id": f"ALT-LOW-{item.id}",
            "type": "low_stock",
            "severity": "medium" if item.quantity > 0 else "high",
            "message": f"{item.name} at {item.station_id} is below reorder threshold "
                       f"({item.quantity} {item.unit} < {item.reorder_threshold}).",
            "linked": {"inventory_id": item.id, "station_id": item.station_id},
            "created_at": now().isoformat(),
        })

    # Overdue check-ins
    for person in db.query(models.Personnel).filter(models.Personnel.status == "overdue").all():
        alerts.append({
            "id": f"ALT-OVD-{person.id}",
            "type": "overdue_checkin",
            "severity": "high",
            "message": f"{person.name} ({person.role}) has not checked in for over "
                       f"{OVERDUE_HOURS}h.",
            "linked": {"personnel_id": person.id},
            "created_at": now().isoformat(),
        })

    # Asset health (skip ones covered by a correlated alert below)
    correlated_asset_ids = set()
    assets = db.query(models.Asset).filter(models.Asset.status.in_(["warning", "critical"])).all()
    for asset in assets:
        cargo = None
        if asset.awaiting_part_cargo_id:
            cargo = db.get(models.CargoItem, asset.awaiting_part_cargo_id)
        delayed, hours = (False, 0)
        if cargo:
            delayed, hours = is_cargo_delayed(cargo)
        if delayed:
            correlated_asset_ids.add(asset.id)
            alerts.append({
                "id": f"ALT-CORR-{asset.id}",
                "type": "correlated_risk",
                "severity": "critical" if asset.status == "critical" else "high",
                "message": f"{asset.name} at {asset.health_pct:.0f}% health "
                           f"({asset.status.upper()}); its replacement part is on cargo "
                           f"{cargo.id}, delayed {hours}h.",
                "linked": {"asset_id": asset.id, "cargo_id": cargo.id},
                "created_at": now().isoformat(),
            })

    for asset in assets:
        if asset.id in correlated_asset_ids:
            continue
        alerts.append({
            "id": f"ALT-AST-{asset.id}",
            "type": "asset_health",
            "severity": "critical" if asset.status == "critical" else "medium",
            "message": f"{asset.name} at {asset.station_id} is at {asset.health_pct:.0f}% "
                       f"health ({asset.status.upper()}).",
            "linked": {"asset_id": asset.id},
            "created_at": now().isoformat(),
        })

    # Delay-risk waypoints
    for wp in db.query(models.Waypoint).filter(models.Waypoint.status == "at_risk").all():
        alerts.append({
            "id": f"ALT-WPT-{wp.id}",
            "type": "delay_risk",
            "severity": "medium",
            "message": f"Waypoint {wp.sequence} of expedition {wp.expedition_id} "
                       f"(station {wp.station_id}) has passed its ETA and is still pending.",
            "linked": {"waypoint_id": wp.id, "expedition_id": wp.expedition_id},
            "created_at": now().isoformat(),
        })

    # Geofence breaches
    for person in db.query(models.Personnel).all():
        station = db.get(models.Station, person.current_station_id) if person.current_station_id else None
        breach, dist = geofence_breach(person, station)
        if breach:
            alerts.append({
                "id": f"ALT-GEO-{person.id}",
                "type": "geofence_breach",
                "severity": "high",
                "message": f"{person.name} is {dist}km from home station "
                           f"{person.current_station_id} with no recent check-in.",
                "linked": {"personnel_id": person.id},
                "created_at": now().isoformat(),
            })

    # Open emergencies
    for inc in db.query(models.EmergencyIncident).filter(models.EmergencyIncident.status != "resolved").all():
        alerts.append({
            "id": f"ALT-EMG-{inc.id}",
            "type": "emergency",
            "severity": inc.severity,
            "message": f"{inc.type} incident ({inc.severity}) is {inc.status} at "
                       f"{inc.station_id or 'unknown station'}.",
            "linked": {"incident_id": inc.id},
            "created_at": inc.timestamp.isoformat() if inc.timestamp else now().isoformat(),
        })

    alerts.sort(key=lambda a: SEVERITY_ORDER.get(a["severity"], 4))
    return alerts


# ---------------------------------------------------------------------------
# Mission readiness composite
# ---------------------------------------------------------------------------

def mission_readiness(db: Session):
    sweep_all(db)
    sync_auto_incidents(db)

    personnel = db.query(models.Personnel).all()
    personnel_pct = 100 if not personnel else round(
        100 * sum(1 for p in personnel if p.status not in ("overdue", "emergency")) / len(personnel)
    )

    cargo = db.query(models.CargoItem).all()
    delayed_count = sum(1 for c in cargo if is_cargo_delayed(c)[0])
    cargo_pct = 100 if not cargo else round(100 * (len(cargo) - delayed_count) / len(cargo))

    inventory = db.query(models.InventoryItem).all()
    inventory_pct = 100 if not inventory else round(
        100 * sum(1 for i in inventory if i.status == "ok") / len(inventory)
    )

    assets = db.query(models.Asset).all()
    assets_pct = 100 if not assets else round(
        100 * sum(1 for a in assets if a.status == "operational") / len(assets)
    )

    open_emergencies = db.query(models.EmergencyIncident).filter(
        models.EmergencyIncident.status != "resolved"
    ).count()
    emergency_pct = max(0, 100 - open_emergencies * 18)

    overall = round((personnel_pct + cargo_pct + inventory_pct + assets_pct + emergency_pct) / 5)

    return {
        "personnel": personnel_pct,
        "cargo": cargo_pct,
        "inventory": inventory_pct,
        "assets": assets_pct,
        "emergency": emergency_pct,
        "overall": overall,
    }
