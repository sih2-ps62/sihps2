from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from db import utcnow
from main import app
from models.asset import Asset
from models.personnel import Personnel
from models.safety import CheckInEvent, MedicalAccessGrant, MedicalPermission, MedicalProfile
from models.user import User


def ready_mission(client, name="Safety traverse"):
    crew = [client.post("/api/personnel", json={"name": f"Test crew {n}", "role": "Field researcher",
        "status": "In Field", "station_id": "mcmurdo"}).json()["data"]["id"] for n in (1, 2)]
    kit = client.post("/api/assets", json={"name": "Dedicated emergency kit", "category": "medical",
        "current_holder_type": "station", "current_holder_id": "mcmurdo"}).json()["data"]["id"]
    response = client.post("/api/expeditions", json={"name": name, "status": "Planned", "region": "Antarctic",
        "start_date": "2026-12-01", "team_lead": "Test crew 1", "waypoints": ["mcmurdo", "vostok"],
        "personnel_ids": crew, "asset_ids": [kit], "emergency_kit_id": kit})
    assert response.status_code == 201, response.text
    return response.json()["data"]["id"], crew, kit


def incident(client, **extra):
    response = client.post("/api/emergencies", json={"title": "Test rescue", "severity": "critical", "station_id": "mcmurdo", **extra})
    assert response.status_code == 201, response.text
    return response.json()["data"]["id"]


def medic_client():
    client = TestClient(app)
    login = client.post("/api/auth/login", json={"email": "medic@polarops.io", "password": "polarmedic26"})
    assert login.status_code == 200
    client.headers["Authorization"] = "Bearer " + login.json()["token"]
    return client


def unlock(client, scope):
    response = client.post("/api/medical/access", json={"scope": scope, "password": "polarmedic26", "reason": "Responding to this incident"})
    assert response.status_code == 200, response.text
    return {"X-Medical-Access": response.json()["data"]["access_token"]}


def test_valid_launch_and_waypoint_progress(admin):
    id, crew, kit = ready_mission(admin)
    before = admin.get(f"/api/expeditions/{id}").json()["data"]
    assert before["departure_gate"]["can_launch"] and before["emergency_kit_id"] == kit
    assert admin.patch(f"/api/expeditions/{id}", json={"status": "Active"}).status_code == 200
    first, second = before["route_steps"]
    assert admin.post(f"/api/expeditions/{id}/waypoints/{second['id']}/reach").status_code == 409
    assert admin.post(f"/api/expeditions/{id}/waypoints/{first['id']}/reach").status_code == 200
    assert admin.post(f"/api/expeditions/{id}/waypoints/{second['id']}/reach").status_code == 200


@pytest.mark.parametrize("fault", ["solo", "duplicate", "stale", "leave", "emergency", "maintenance", "retired", "kit", "unheld_kit", "route"])
def test_launch_blocks_each_failed_requirement_atomically(admin, session, fault):
    id, crew, kit = ready_mission(admin)
    body = {"status": "Active"}
    if fault == "solo": body["personnel_ids"] = crew[:1]
    if fault == "duplicate": body["personnel_ids"] = [crew[0], crew[0]]
    if fault == "kit": body.update(asset_ids=[kit], emergency_kit_id=None)
    if fault == "route": body["waypoints"] = []
    if fault in ("maintenance", "retired", "unheld_kit"):
        asset = session.get(Asset, kit)
        if fault == "unheld_kit": asset.current_holder_type, asset.current_holder_id = "station", "mcmurdo"
        else: asset.condition = "needs_maintenance" if fault == "maintenance" else "retired"
    if fault in ("stale", "leave", "emergency"):
        person = session.get(Personnel, crew[1])
        if fault == "stale": person.last_checkin = utcnow() - timedelta(hours=7)
        else: person.status = "on_leave" if fault == "leave" else "emergency"
    session.commit()
    result = admin.patch(f"/api/expeditions/{id}", json=body)
    assert result.status_code == 409, result.text
    after = admin.get(f"/api/expeditions/{id}").json()["data"]
    assert after["status"] == "Planned" and after["personnel_ids"] == crew


def test_legacy_create_and_patch_cannot_bypass_gate(admin):
    response = admin.post("/expeditions", json={"name": "Bypass", "start_date": "2026-12-01", "end_date": "2026-12-02", "status": "in_progress"})
    assert response.status_code == 409
    id, crew, kit = ready_mission(admin)
    assert admin.patch(f"/expeditions/{id}", json={"status": "in_progress", "personnel_ids": crew[:1]}).status_code == 409
    assert admin.patch(f"/expeditions/{id}", json={"status": "in_progress"}).status_code == 200


def test_crew_change_and_reached_waypoint_cannot_bypass_buddy_rule(admin, session):
    id, crew, kit = ready_mission(admin)
    assert admin.patch(f"/api/expeditions/{id}", json={"status": "Active"}).status_code == 200
    assert admin.patch(f"/api/expeditions/{id}", json={"personnel_ids": crew[:1]}).status_code == 409
    waypoint = admin.get(f"/api/expeditions/{id}").json()["data"]["route_steps"][0]
    session.get(Personnel, crew[1]).last_checkin = utcnow() - timedelta(hours=8)
    session.commit()
    assert admin.post(f"/api/expeditions/{id}/waypoints/{waypoint['id']}/reach").status_code == 409
    assert admin.patch(f"/expeditions/{id}", json={"waypoints": [{"id": waypoint["id"], "status": "reached"}]}).status_code == 409
    after = admin.get(f"/api/expeditions/{id}").json()["data"]
    assert after["route_steps"][0]["status"] == "pending" and len(after["route_steps"]) == 2


def test_station_checkins_detect_reviewable_deviations_without_advancing_route(admin):
    id, crew, kit = ready_mission(admin)
    admin.patch(f"/api/expeditions/{id}", json={"status": "Active"})
    match = admin.post(f"/api/personnel/{crew[0]}/checkin", json={"station_id": "mcmurdo"}).json()["checkins"][0]
    assert match["outcome"] == "on_route"
    mismatch = admin.post(f"/api/personnel/{crew[0]}/checkin", json={"station_id": "vostok"}).json()["checkins"][0]
    assert mismatch["outcome"] == "deviation" and mismatch["expected_station_id"] == "mcmurdo"
    assert admin.get(f"/api/expeditions/{id}").json()["data"]["route_steps"][0]["status"] == "pending"
    assert any(e["id"] == mismatch["id"] for e in admin.get("/api/safety/alerts").json()["data"]["route_deviations"])
    assert admin.post(f"/api/safety/checkins/{mismatch['id']}/review", json={"note": "Checked"}).status_code == 422
    assert admin.post(f"/api/safety/checkins/{mismatch['id']}/review", json={"note": "Radio confirmed approved diversion"}).status_code == 200
    assert not admin.get("/api/safety/alerts").json()["data"]["route_deviations"]
    assert admin.get(f"/api/expeditions/{id}").json()["data"]["checkins"][0]["reviewed"]
    no_location = admin.post(f"/api/personnel/{crew[0]}/checkin").json()["checkins"][0]
    assert no_location["outcome"] == "location_unreported" and no_location["station_id"] is None
    assert admin.post(f"/api/personnel/{crew[0]}/checkin", json={"station_id": "unknown"}).status_code == 400


def test_legacy_station_checkin_uses_same_detection(admin, session):
    id, crew, _ = ready_mission(admin)
    admin.patch(f"/api/expeditions/{id}", json={"status": "Active"})
    assert admin.post(f"/personnel/{crew[0]}/checkin", json={"station_id": "vostok"}).status_code == 200
    assert session.scalars(select(CheckInEvent).where(CheckInEvent.personnel_id == crew[0])).first().outcome == "deviation"


def test_replayed_old_checkin_does_not_make_stale_crew_ready(admin, session):
    id, crew, _ = ready_mission(admin)
    person = session.get(Personnel, crew[0])
    person.last_checkin = utcnow() - timedelta(hours=9)
    person.status, person.prior_status = "overdue", "on_expedition"
    session.commit()
    response = admin.post(f"/api/personnel/{crew[0]}/checkin", json={"station_id": "mcmurdo", "observed_at": (utcnow() - timedelta(hours=8)).isoformat() + "Z"})
    assert response.status_code == 200 and response.json()["data"]["operational_status"] == "overdue"
    assert response.json()["checkins"][0]["outcome"] == "delayed_report"
    assert admin.patch(f"/api/expeditions/{id}", json={"status": "Active"}).status_code == 409


def test_emergency_resource_conflict_blocks_both_assets_and_responders_and_releases(admin):
    _, crew, kit = ready_mission(admin)
    first, second = incident(admin), incident(admin)
    assert admin.patch(f"/api/emergencies/{first}", json={"asset_ids": [kit], "responder_ids": [crew[0]]}).status_code == 200
    for body in ({"asset_ids": [kit]}, {"responder_ids": [crew[0]]}):
        blocked = admin.patch(f"/api/emergencies/{second}", json=body)
        assert blocked.status_code == 409 and first in blocked.json()["error"]
    assert admin.get(f"/api/emergencies/{second}").json()["data"]["asset_ids"] == []
    admin.patch(f"/api/emergencies/{first}", json={"status": "Responding"})
    assert admin.patch(f"/api/emergencies/{second}", json={"asset_ids": [kit]}).status_code == 409
    admin.patch(f"/api/emergencies/{first}", json={"status": "Resolved"})
    assert admin.patch(f"/api/emergencies/{second}", json={"asset_ids": [kit], "responder_ids": [crew[0]]}).status_code == 200


def test_simultaneous_resource_assignments_have_only_one_winner(admin):
    _, _, kit = ready_mission(admin)
    ids = [incident(admin), incident(admin)]
    def assign(id):
        with TestClient(app, headers=dict(admin.headers)) as client:
            return client.patch(f"/api/emergencies/{id}", json={"asset_ids": [kit]}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(assign, ids)) == [200, 409]


def test_emergency_reservations_prevent_launch(admin):
    id, crew, kit = ready_mission(admin)
    rescue = incident(admin)
    admin.patch(f"/api/emergencies/{rescue}", json={"asset_ids": [kit]})
    assert admin.patch(f"/api/expeditions/{id}", json={"status": "Active"}).status_code == 409


def test_medical_requires_independent_permission_even_for_admin(admin, officer):
    case = incident(admin, personnel_id="PER-001")
    assert not admin.get("/api/medical/permission").json()["data"]["permitted"]
    for client in (admin, officer):
        assert client.get(f"/api/medical/records/incident/{case}").status_code == 403
        assert client.post("/api/medical/access", json={"scope": f"incident:{case}", "password": "glacieradmin26", "reason": "Urgent case response"}).status_code == 403


def test_medical_registration_quick_card_scope_expiry_revocation_and_no_leaks(admin, session):
    medic = medic_client()
    profile_headers = unlock(medic, "profile:PER-001")
    saved = medic.patch("/api/medical/records/profile/PER-001", headers=profile_headers,
        json={"blood_type": "O+", "allergies": "SENSITIVE_ALLERGY", "known_conditions": "SENSITIVE_CONDITION"})
    assert saved.status_code == 200 and "no-store" in saved.headers["cache-control"]
    case = incident(admin, personnel_id="PER-001")
    assert medic.get(f"/api/medical/records/incident/{case}", headers=profile_headers).status_code == 403
    headers = unlock(medic, f"incident:{case}")
    card = medic.get(f"/api/medical/records/incident/{case}", headers=headers)
    assert card.json()["data"]["allergies"] == "SENSITIVE_ALLERGY" and "no-store" in card.headers["cache-control"]
    assert admin.get(f"/api/medical/records/incident/{case}", headers=headers).status_code == 403
    for path in ("/api/personnel", "/personnel", f"/api/personnel/PER-001", "/api/emergencies", "/emergency", f"/api/emergencies/{case}", "/api/audit-log"):
        content = admin.get(path).text
        assert "SENSITIVE_ALLERGY" not in content and "SENSITIVE_CONDITION" not in content
    grant = session.scalars(select(MedicalAccessGrant).where(MedicalAccessGrant.scope == f"incident:{case}")).first()
    grant.expires_at = utcnow() - timedelta(seconds=1)
    session.commit()
    assert medic.get(f"/api/medical/records/incident/{case}", headers=headers).status_code == 403
    headers = unlock(medic, f"incident:{case}")
    medical_user = session.scalars(select(User).where(User.email == "medic@polarops.io")).one()
    session.delete(session.get(MedicalPermission, medical_user.id)); session.commit()
    assert medic.get(f"/api/medical/records/incident/{case}", headers=headers).status_code == 403


def test_medical_lock_and_incident_resolution_invalidate_access(admin):
    medic = medic_client()
    case = incident(admin, personnel_id="PER-001")
    assert medic.post("/api/medical/access", json={"scope": f"incident:{case}", "password": "wrong", "reason": "Responding to incident"}).status_code == 403
    headers = unlock(medic, f"incident:{case}")
    assert medic.post("/api/medical/lock", headers=headers).status_code == 200
    assert medic.get(f"/api/medical/records/incident/{case}", headers=headers).status_code == 403
    headers = unlock(medic, f"incident:{case}")
    admin.patch(f"/api/emergencies/{case}", json={"status": "Resolved"})
    assert medic.get(f"/api/medical/records/incident/{case}", headers=headers).status_code == 403
