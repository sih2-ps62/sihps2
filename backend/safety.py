"""Shared server-side controls, used by both API contracts. No GPS assumptions."""
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import delete, select

from db import check_ref, to_utc_naive, utcnow
from models.asset import Asset
from models.emergency import EmergencyIncident
from models.expedition import Expedition
from models.personnel import Personnel
from models.safety import CheckInEvent, EmergencyResource, ExpeditionManifest
from models.station import Station
from rules.overdue_checkin import OVERDUE_AFTER_HOURS


def serialize_write(db):
    # SQLite has one writer. Acquire its reservation BEFORE reading safety state so concurrent
    # launch / resource-assignment requests cannot both validate an old snapshot.
    if db.bind.dialect.name == "sqlite":
        db.connection().exec_driver_sql("BEGIN IMMEDIATE")


def recent(person, now):
    return bool(person.last_checkin and timedelta(0) <= now - person.last_checkin <= timedelta(hours=OVERDUE_AFTER_HOURS))


def active_crew(exp, now=None):
    now = now or utcnow()
    return [p for p in exp.personnel if p.status in ("on_expedition", "in_transit") and recent(p, now)]


def require_buddy(exp):
    count = len(active_crew(exp))
    if count < 2:
        raise HTTPException(409, f"Buddy rule: at least 2 assigned, active personnel with recent check-ins are required ({count} ready).")


def launch_gate(db, exp):
    now = utcnow()
    crew = list(exp.personnel)
    assets = db.scalars(select(Asset).where(Asset.current_holder_type == "expedition", Asset.current_holder_id == exp.id)).all()
    manifest = db.get(ExpeditionManifest, exp.id)
    kit = next((a for a in assets if manifest and a.id == manifest.emergency_kit_id), None)
    stale = [p.name for p in crew if not recent(p, now)]
    unavailable = [p.name for p in crew if p.status in ("on_leave", "emergency", "overdue")]
    bad_assets = [a.name for a in assets if a.condition != "operational"]
    other_missions = db.scalars(select(Expedition).where(Expedition.status == "in_progress", Expedition.id != exp.id)).all()
    assigned_ids = {p.id for p in crew}
    busy = sorted({p.name for other in other_missions for p in other.personnel if p.id in assigned_ids})
    reserved = db.execute(select(EmergencyResource).join(EmergencyIncident,
        EmergencyIncident.id == EmergencyResource.incident_id).where(EmergencyIncident.status != "resolved")).scalars().all()
    reserved_names = [r.resource_id for r in reserved if (r.resource_type == "asset" and r.resource_id in {a.id for a in assets})
                      or (r.resource_type == "personnel" and r.resource_id in assigned_ids)]
    checks = [
        {"key": "buddy", "label": "Buddy team", "passed": len(active_crew(exp, now)) >= 2,
         "detail": f"{len(active_crew(exp, now))} active crew; 2 required. In Field and checked in within {OVERDUE_AFTER_HOURS:g} hours."},
        {"key": "checkins", "label": "Recent personnel check-ins", "passed": bool(crew) and not stale,
         "detail": "Check in: " + ", ".join(stale) if stale else ("All assigned crew checked in recently." if crew else "Assign a crew first.")},
        {"key": "available", "label": "Crew available for this mission", "passed": not unavailable and not busy,
         "detail": ("Unavailable: " + ", ".join(unavailable + busy)) if unavailable or busy else "No leave, emergency or other active expedition assignments."},
        {"key": "assets", "label": "Assigned assets operational", "passed": not bad_assets,
         "detail": "Needs attention: " + ", ".join(bad_assets) if bad_assets else f"{len(assets)} assigned assets checked."},
        {"key": "kit", "label": "Emergency kit on manifest", "passed": bool(kit and kit.category == "medical" and kit.condition == "operational"),
         "detail": f"{kit.name} attached to the manifest." if kit else "Attach an operational medical kit to this expedition's manifest."},
        {"key": "route", "label": "Planned route", "passed": bool(exp.waypoints), "detail": f"{len(exp.waypoints)} waypoints planned."},
        {"key": "response", "label": "Emergency response commitments", "passed": not reserved_names,
         "detail": "Reserved for an open incident: " + ", ".join(sorted(set(reserved_names))) if reserved_names else "Crew and equipment are free of incident reservations."},
    ]
    return {"can_launch": all(c["passed"] for c in checks), "active_crew_count": len(active_crew(exp, now)),
            "checkin_window_hours": OVERDUE_AFTER_HOURS, "checks": checks, "checked_at": now.isoformat() + "Z"}


def enforce_expedition_write(db, exp, previous_status=None, previously_reached=None, crew_changed=False):
    if exp.status == "in_progress" and previous_status != "in_progress":
        gate = launch_gate(db, exp)
        if not gate["can_launch"]:
            blockers = [c["label"] + ": " + c["detail"] for c in gate["checks"] if not c["passed"]]
            raise HTTPException(409, "NO-GO. " + " ".join(blockers))
    reached = {w.id for w in exp.waypoints if w.status == "reached"}
    if reached - (previously_reached or set()) or (crew_changed and exp.status == "in_progress"):
        require_buddy(exp)
    if crew_changed and exp.status == "in_progress":
        availability = next(c for c in launch_gate(db, exp)["checks"] if c["key"] == "available")
        if not availability["passed"]:
            raise HTTPException(409, availability["detail"])


def set_manifest(db, exp, asset_ids, emergency_kit_id):
    ids = set(asset_ids)
    assets = db.scalars(select(Asset).where(Asset.id.in_(ids))).all()
    if {a.id for a in assets} != ids:
        raise HTTPException(400, "One or more assigned assets do not exist.")
    if emergency_kit_id and emergency_kit_id not in ids:
        raise HTTPException(400, "The emergency kit must also be an assigned asset.")
    for asset in assets:
        same_holder = asset.current_holder_type == "expedition" and asset.current_holder_id == exp.id
        if not same_holder and asset.current_holder_type == "expedition":
            raise HTTPException(409, f"{asset.name} is already assigned to {asset.current_holder_id}.")
        if not same_holder and asset.condition != "operational":
            raise HTTPException(409, f"{asset.name} is not operational.")
        if asset.id == emergency_kit_id and asset.category != "medical":
            raise HTTPException(400, "Select a medical asset as the emergency kit.")
    held = db.scalars(select(Asset).where(Asset.current_holder_type == "expedition", Asset.current_holder_id == exp.id)).all()
    for asset in held:
        if asset.id not in ids:
            if not exp.waypoints:
                raise HTTPException(409, "Set a route before returning assets to the departure station.")
            asset.current_holder_type, asset.current_holder_id = "station", exp.waypoints[0].station_id
    for asset in assets:
        asset.current_holder_type, asset.current_holder_id = "expedition", exp.id
    manifest = db.get(ExpeditionManifest, exp.id)
    if manifest is None:
        manifest = ExpeditionManifest(expedition_id=exp.id)
        db.add(manifest)
    manifest.emergency_kit_id = emergency_kit_id
    db.flush()


def record_checkin(db, person, station_id=None, observed_at=None):
    now = utcnow()
    observed = to_utc_naive(observed_at) if observed_at else now
    if observed > now + timedelta(minutes=5):
        raise HTTPException(400, "Check-in time cannot be in the future. Check your device clock.")
    observed = min(observed, now)
    delayed = now - observed > timedelta(minutes=5)
    if station_id:
        check_ref(db, Station, station_id, "station_id")
        if not person.last_checkin or observed >= person.last_checkin:
            person.current_station_id = station_id
    person.last_checkin = max(person.last_checkin, observed) if person.last_checkin else observed
    if person.status == "overdue" and recent(person, now):
        person.status, person.prior_status = person.prior_status or "at_base", None
    missions = db.scalars(select(Expedition).where(Expedition.status == "in_progress", Expedition.personnel.any(id=person.id))).all()
    events = []
    for exp in missions or [None]:
        waypoint = next((w for w in exp.waypoints if w.status == "pending"), None) if exp else None
        outcome = "location_unreported" if not station_id else "no_route"
        if station_id and waypoint:
            outcome = "on_route" if station_id == waypoint.station_id else "deviation"
        if delayed:
            # The route may have advanced while this offline report waited. Do not invent a historical
            # route comparison or treat arrival at the server as a new personnel check-in.
            outcome = "delayed_report"
        event = CheckInEvent(personnel_id=person.id, expedition_id=exp.id if exp else None,
                             station_id=station_id, expected_station_id=waypoint.station_id if waypoint else None,
                             expected_waypoint_id=waypoint.id if waypoint else None, outcome=outcome, timestamp=observed)
        db.add(event)
        events.append(event)
    db.flush()
    return events


def checkin_view(db, event):
    person = db.get(Personnel, event.personnel_id)
    actual = db.get(Station, event.station_id) if event.station_id else None
    expected = db.get(Station, event.expected_station_id) if event.expected_station_id else None
    return {"id": event.id, "personnel_id": event.personnel_id, "personnel_name": person.name if person else event.personnel_id,
            "expedition_id": event.expedition_id, "station_id": event.station_id,
            "station_name": actual.name if actual else None, "expected_station_id": event.expected_station_id,
            "expected_station_name": expected.name if expected else None, "outcome": event.outcome,
            "timestamp": event.timestamp.isoformat() + "Z", "reviewed": event.reviewed_at is not None,
            "review_note": event.review_note}


def resource_conflicts(db, incident_id=None, proposed=None):
    rows = db.execute(select(EmergencyResource, EmergencyIncident).join(EmergencyIncident,
        EmergencyIncident.id == EmergencyResource.incident_id).where(EmergencyIncident.status != "resolved")).all()
    grouped = {}
    for assignment, incident in rows:
        if proposed is not None and incident.id == incident_id:
            continue
        grouped.setdefault((assignment.resource_type, assignment.resource_id), []).append(incident.id)
    if proposed is not None:
        for key in proposed:
            grouped.setdefault(key, []).append(incident_id)
    conflicts = []
    for (kind, resource_id), incidents in grouped.items():
        if len(incidents) < 2 or (incident_id and incident_id not in incidents):
            continue
        resource = db.get(Asset if kind == "asset" else Personnel, resource_id)
        conflicts.append({"resource_type": kind, "resource_id": resource_id,
                          "resource_name": resource.name if resource else resource_id, "incident_ids": sorted(incidents)})
    return conflicts


def assign_resources(db, incident, asset_ids, personnel_ids):
    if incident.status == "resolved":
        raise HTTPException(409, "Resources cannot be assigned to a resolved incident.")
    proposed = {("asset", id) for id in asset_ids} | {("personnel", id) for id in personnel_ids}
    for kind, id in proposed:
        model = Asset if kind == "asset" else Personnel
        check_ref(db, model, id, kind + "_id")
        resource = db.get(model, id)
        if kind == "asset" and resource.condition != "operational":
            raise HTTPException(409, f"{resource.name} is not operational.")
        if kind == "personnel" and (resource.status in ("emergency", "on_leave", "overdue") or not recent(resource, utcnow())):
            raise HTTPException(409, f"{resource.name} is unavailable. Check their status and check-in.")
        if kind == "personnel" and id == incident.personnel_id:
            raise HTTPException(409, "The affected person cannot be assigned as their own responder.")
    conflicts = resource_conflicts(db, incident.id, proposed)
    if conflicts:
        detail = "; ".join(f"{c['resource_name']} is needed by {', '.join(c['incident_ids'])}" for c in conflicts)
        raise HTTPException(409, "Resource conflict: " + detail + ". Release it from the other incident before assigning.")
    db.execute(delete(EmergencyResource).where(EmergencyResource.incident_id == incident.id))
    db.add_all([EmergencyResource(incident_id=incident.id, resource_type=kind, resource_id=id) for kind, id in proposed])
    db.flush()


def incident_resources(db, incident):
    assigned = db.scalars(select(EmergencyResource).where(EmergencyResource.incident_id == incident.id)).all()
    return {"asset_ids": [r.resource_id for r in assigned if r.resource_type == "asset"],
            "responder_ids": [r.resource_id for r in assigned if r.resource_type == "personnel"],
            "resource_conflicts": resource_conflicts(db, incident.id) if incident.status != "resolved" else []}
