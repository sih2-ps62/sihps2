# The frontend API (/api) on the demo dataset - what the React app actually calls.
import re
import time
from datetime import datetime, timedelta

import jwt
import pytest

from db import utcnow
from models.emergency import EmergencyIncident
from models.personnel import Personnel
from ui_api import assistant
from ui_api.security import JWT_SECRET, hash_password, verify_password


def rows(response):
    assert response.status_code == 200, response.text
    return response.json()["data"]


def by_id(items):
    return {item["id"]: item for item in items}


# ------------------------------------------------------------------ auth
def test_login_returns_a_token_and_the_user(admin):
    body = admin.post("/api/auth/login", json={"email": "Duty.Officer@polarops.io ", "password": "icebreaker26"}).json()
    assert body["user"] == {"id": 1, "email": "duty.officer@polarops.io", "name": "Duty Officer", "role": "duty_officer"}
    claims = jwt.decode(body["token"], JWT_SECRET, algorithms=["HS256"])
    assert claims["role"] == "duty_officer" and claims["exp"] > time.time()
    assert admin.get("/api/auth/me").json()["user"]["email"] == "admin@polarops.io"


def test_bad_logins_are_rejected_without_saying_which_part_was_wrong(anonymous):
    wrong_password = anonymous.post("/api/auth/login", json={"email": "admin@polarops.io", "password": "nope"})
    unknown_user = anonymous.post("/api/auth/login", json={"email": "nobody@polarops.io", "password": "nope"})
    assert wrong_password.status_code == unknown_user.status_code == 401
    assert wrong_password.json() == unknown_user.json() == {"error": "Invalid email or password.",
                                                            "detail": "Invalid email or password."}
    assert anonymous.post("/api/auth/login", json={"email": "admin@polarops.io"}).status_code == 400
    assert anonymous.post("/api/auth/login", json={}).json()["error"] == "Email and password are required."


@pytest.mark.parametrize("path", ["/api/stations", "/api/stats", "/api/analytics", "/api/audit-log", "/api/expeditions",
                                  "/api/cargo/CGO-0001", "/api/inventory", "/api/personnel", "/api/emergencies"])
def test_every_data_route_needs_a_token(anonymous, path):
    assert anonymous.get(path).status_code == 401
    assert anonymous.post("/api/assistant/chat", json={"message": "hi"}).status_code == 401


def test_garbage_and_expired_tokens_are_rejected(anonymous):
    assert anonymous.get("/api/stats", headers={"Authorization": "Bearer not-a-token"}).json()["error"] == \
        "Invalid or expired token."
    expired = jwt.encode({"sub": "1", "email": "a@b.c", "name": "A", "role": "admin", "exp": int(time.time()) - 5},
                         JWT_SECRET, algorithm="HS256")
    assert anonymous.get("/api/stats", headers={"Authorization": f"Bearer {expired}"}).status_code == 401
    forged = jwt.encode({"sub": "1", "email": "a@b.c", "name": "A", "role": "admin"}, "another-secret-that-is-long-enough-to-sign", algorithm="HS256")
    assert anonymous.get("/api/stats", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_passwords_are_salted_and_verified():
    first, second = hash_password("icebreaker26"), hash_password("icebreaker26")
    assert first != second and "icebreaker26" not in first
    assert verify_password("icebreaker26", first) and not verify_password("icebreaker27", first)
    assert not verify_password("x", "plaintext-not-a-hash")


def test_only_admins_can_delete(admin, officer):
    assert officer.delete("/api/cargo/CGO-0001").status_code == 403
    assert officer.delete("/api/expeditions/EXP-0001").json()["error"].startswith("You do not have permission")
    assert admin.get("/api/cargo/CGO-0001").status_code == 200  # untouched
    assert admin.delete("/api/cargo/CGO-0001").status_code == 204


# ------------------------------------------------------------------ contract shape
def test_error_bodies_carry_error_on_api_routes_but_stay_detail_only_on_the_plan_routes(admin):
    api_missing = admin.get("/api/expeditions/EXP-9999")
    assert api_missing.status_code == 404 and api_missing.json()["error"] == api_missing.json()["detail"]
    assert admin.post("/api/cargo", content="{oops", headers={"Content-Type": "application/json"}).json()["error"]
    plan_missing = admin.get("/expeditions/EXP-9999")
    assert list(plan_missing.json()) == ["detail"]


def test_list_envelope_detail_envelope_and_station_shape(admin):
    page = admin.get("/api/expeditions", params={"pageSize": 2}).json()
    assert set(page) == {"data", "total", "page", "pageSize", "totalPages"}
    assert (page["total"], page["pageSize"], page["totalPages"], len(page["data"])) == (5, 2, 3, 2)
    assert set(admin.get("/api/expeditions/EXP-0001").json()) == {"data"}
    station = rows(admin.get("/api/stations"))[0]
    assert {"id", "name", "region", "lat", "lng"} <= set(station)
    assert {s["region"] for s in rows(admin.get("/api/stations"))} == {"Antarctic", "Arctic"}


def test_pagination_sorting_and_search_are_forgiving(admin):
    second = admin.get("/api/personnel", params={"page": 2, "pageSize": 4, "sort": "name", "order": "asc"}).json()
    assert second["page"] == 2 and [p["name"] for p in second["data"]] == sorted(p["name"] for p in second["data"])
    assert admin.get("/api/personnel", params={"page": "abc", "pageSize": "9999"}).json()["pageSize"] == 100
    assert admin.get("/api/personnel", params={"page": "-3"}).json()["page"] == 1
    descending = rows(admin.get("/api/personnel", params={"sort": "name", "order": "desc", "pageSize": 100}))
    assert [p["name"] for p in descending] == sorted((p["name"] for p in descending), key=str.lower, reverse=True)
    fallback = rows(admin.get("/api/personnel", params={"sort": "id; DROP TABLE personnel", "pageSize": 100}))
    assert len(fallback) == 10  # an unknown sort key falls back to the default instead of erroring
    assert [p["name"] for p in rows(admin.get("/api/personnel", params={"q": "GLACIO"}))] == ["Anders Solberg"]
    assert admin.get("/api/cargo", params={"q": "vostok"}).json()["total"] == 1  # searches origin / destination


def test_timestamps_have_no_z_so_the_frontend_can_append_one(admin):
    person = rows(admin.get("/api/personnel"))[0]
    assert re.fullmatch(r"\d{4}-\d\d-\d\d \d\d:\d\d:\d\d", person["last_checkin"])
    incident = rows(admin.get("/api/emergencies"))[0]
    assert re.fullmatch(r"\d{4}-\d\d-\d\d \d\d:\d\d:\d\d", incident["reported_at"])
    assert re.fullmatch(r"\d{4}-\d\d-\d\d", rows(admin.get("/api/expeditions"))[0]["start_date"])


# ------------------------------------------------------------------ expeditions
def test_expeditions_use_the_frontends_vocabulary_and_expose_the_risk_rule(admin):
    ross = admin.get("/api/expeditions/EXP-0001").json()["data"]
    assert ross["status"] == "Active" and ross["region"] == "Antarctic" and ross["end_date"] is None
    assert ross["team_lead"] == "Dr. Elena Kowalski" and ross["waypoints"] == ["mcmurdo", "vostok"]
    assert ross["risk_band"] == "high" and ross["risk_score"] == sum(f["contribution"] for f in ross["risk_factors"])
    assert {e["status"] for e in rows(admin.get("/api/expeditions"))} == {"Active", "Planned", "Completed"}
    assert [e["id"] for e in rows(admin.get("/api/expeditions", params={"status": "Planned", "sort": "start_date"}))] \
        == ["EXP-0002", "EXP-0005"]
    assert [e["id"] for e in rows(admin.get("/api/expeditions", params={"region": "Arctic", "sort": "name"}))] \
        == ["EXP-0004", "EXP-0002"]


def test_create_expedition_from_the_modal_payload(admin):
    payload = {"name": "Smoke Traverse", "status": "Planned", "region": "Antarctic", "start_date": "2026-12-01",
               "team_lead": "dr. marco rinaldi", "origin": "mcmurdo", "destination": "vostok",
               "waypoints": ["mcmurdo", "vostok"]}
    response = admin.post("/api/expeditions", json=payload)
    assert response.status_code == 201
    created = response.json()["data"]
    assert created["id"] == "EXP-0006" and created["waypoints"] == ["mcmurdo", "vostok"]
    assert created["team_lead"] == "Dr. Marco Rinaldi" and created["end_date"] is None
    plan_view = admin.get("/expeditions/EXP-0006").json()  # the plan's endpoint sees the same record
    assert plan_view["team_lead_id"] == "PER-003" and [w["sequence"] for w in plan_view["waypoints"]] == [1, 2]

    outsider = admin.post("/api/expeditions", json={**payload, "team_lead": "Someone Unlisted", "waypoints": []}).json()["data"]
    assert outsider["team_lead"] == "Someone Unlisted" and outsider["waypoints"] == []
    assert admin.get(f"/expeditions/{outsider['id']}").json()["team_lead_id"] is None


def test_create_expedition_validation(admin):
    base = {"name": "X", "status": "Planned", "region": "Arctic", "start_date": "2026-12-01", "team_lead": "Lead"}
    assert admin.post("/api/expeditions", json={**base, "name": ""}).json()["error"].startswith("name, status")
    assert admin.post("/api/expeditions", json={**base, "status": "Soon"}).status_code == 400
    assert admin.post("/api/expeditions", json={**base, "region": "Mars"}).status_code == 400
    assert admin.post("/api/expeditions", json={**base, "start_date": "01/12/2026"}).status_code == 400
    assert admin.post("/api/expeditions", json={**base, "end_date": "2026-11-01"}).status_code == 400
    assert admin.post("/api/expeditions", json={**base, "waypoints": ["atlantis"]}).status_code == 400
    assert rows(admin.get("/api/expeditions", params={"pageSize": 100})) and admin.get("/api/expeditions").json()["total"] == 5


def test_patching_the_route_keeps_reached_waypoints_in_place(admin):
    before = admin.get("/expeditions/EXP-0001").json()["waypoints"]
    assert before[0]["status"] == "reached"
    patched = admin.patch("/api/expeditions/EXP-0001", json={"waypoints": ["mcmurdo", "concordia", "vostok"],
                                                             "status": "Completed", "end_date": "2026-10-01"})
    assert patched.json()["data"]["waypoints"] == ["mcmurdo", "concordia", "vostok"]
    after = admin.get("/expeditions/EXP-0001").json()
    assert after["waypoints"][0]["id"] == before[0]["id"] and after["waypoints"][0]["status"] == "reached"
    assert after["status"] == "completed" and after["end_date"] == "2026-10-01"
    assert admin.patch("/api/expeditions/EXP-0001", json={"end_date": None}).json()["data"]["end_date"] is None
    assert admin.patch("/api/expeditions/EXP-0001", json={"name": ""}).status_code == 400
    assert admin.patch("/api/expeditions/EXP-9999", json={"name": "x"}).status_code == 404


def test_deleting_an_expedition_leaves_nothing_pointing_at_it(admin):
    assert admin.get("/assets", params={"holder_id": "EXP-0001"}).json()[0]["id"] == "AST-0004"
    assert admin.delete("/api/expeditions/EXP-0001").status_code == 204
    assert admin.get("/api/expeditions/EXP-0001").status_code == 404
    asset = admin.get("/assets", params={"condition": "operational"}).json()
    assert {a["id"]: a for a in asset}["AST-0004"]["current_holder_type"] == "station"
    assert by_id(rows(admin.get("/api/cargo", params={"pageSize": 100})))["CGO-0001"]["expedition_id"] is None
    assert admin.get("/personnel").status_code == 200  # crew untouched


def test_plan_endpoints_cope_with_open_ended_expeditions(admin):
    assert by_id(admin.get("/expeditions").json())["EXP-0001"]["end_date"] is None
    assert admin.patch("/expeditions/EXP-0001", json={"name": "Renamed"}).json()["name"] == "Renamed"


# ------------------------------------------------------------------ cargo
def test_cargo_speaks_pending_in_transit_delivered_delayed(admin):
    assert {c["status"] for c in rows(admin.get("/api/cargo", params={"pageSize": 100}))} == \
        {"Pending", "In Transit", "Delivered", "Delayed"}
    delayed = rows(admin.get("/api/cargo", params={"status": "Delayed"}))
    assert [c["manifest_id"] for c in delayed] == ["MAN-1043"]
    assert [c["id"] for c in admin.get("/cargo", params={"status": "delayed"}).json()] == ["CGO-0002"]  # plan side


def test_cargo_lifecycle_and_audit_trail(admin):
    body = {"manifest_id": "MAN-2001", "description": "Ration crates", "status": "Pending", "origin": "Hobart",
            "destination": "McMurdo Station", "weight_kg": 90}
    created = admin.post("/api/cargo", json=body).json()["data"]
    assert created["id"] == "CGO-0007" and created["status"] == "Pending" and created["weight_kg"] == 90
    assert admin.post("/api/cargo", json={**body, "manifest_id": "man-2001"}).status_code == 409
    assert admin.post("/api/cargo", json={**body, "manifest_id": "MAN-2002", "status": "Lost"}).status_code == 400
    assert admin.post("/api/cargo", json={**body, "manifest_id": "MAN-2002", "weight_kg": -1}).status_code == 400
    assert admin.post("/api/cargo", json={"description": "no manifest"}).status_code == 400

    moved = admin.patch(f"/api/cargo/{created['id']}", json={"status": "In Transit", "weight_kg": 95}).json()["data"]
    assert moved["status"] == "In Transit" and moved["weight_kg"] == 95
    assert admin.get(f"/cargo").json()[-1]["status"] == "in_transit"  # the plan endpoint agrees
    assert admin.patch(f"/api/cargo/{created['id']}", json={"manifest_id": "MAN-1042"}).status_code == 409

    log = rows(admin.get("/api/audit-log", params={"sort": "created_at", "order": "desc"}))
    assert log[0]["summary"] == 'Updated cargo manifest "MAN-2001" (In Transit)' and log[0]["user_name"] == "Ops Admin"
    assert log[1]["summary"] == 'Created cargo manifest "MAN-2001"'
    assert admin.delete(f"/api/cargo/{created['id']}").status_code == 204
    assert admin.delete(f"/api/cargo/{created['id']}").status_code == 404


def test_cargo_created_on_the_plan_side_still_renders(admin):
    plan_made = admin.post("/cargo", json={"name": "Spare tent", "category": "shelter", "weight_kg": 10,
                                           "current_station_id": "mcmurdo"}).json()
    shown = admin.get(f"/api/cargo/{plan_made['id']}").json()["data"]
    assert shown["status"] == "Pending" and shown["origin"] == "McMurdo Station"
    assert shown["manifest_id"] == f"MAN-{plan_made['id'][-4:]}" and shown["destination"] == "-"


# ------------------------------------------------------------------ inventory
def test_inventory_shape_filters_and_the_at_or_below_threshold_rule(admin):
    items = by_id(rows(admin.get("/api/inventory", params={"pageSize": 100})))
    phones = items["INV-0004"]
    assert phones["threshold"] == 5 and phones["station_name"] == "McMurdo Station"
    assert phones["needs_maintenance"] is False and items["INV-0002"]["needs_maintenance"] is True
    assert {i["name"] for i in rows(admin.get("/api/inventory", params={"lowStock": "true"}))} == \
        {"Emergency rations", "Satellite phones", "Weather balloons"}
    assert {i["name"] for i in rows(admin.get("/api/inventory", params={"needsMaintenance": "true"}))} == \
        {"Snowmobiles", "Generator units"}
    assert [i["name"] for i in rows(admin.get("/api/inventory", params={"category": "Fuel"}))] == ["Diesel fuel"]

    # Equal to the threshold: low for the frontend, still fine for the plan's alert rule (strictly below).
    admin.patch("/api/inventory/INV-0001", json={"quantity": 5000, "threshold": 5000})
    assert "Diesel fuel" in {i["name"] for i in rows(admin.get("/api/inventory", params={"lowStock": "true"}))}
    assert "INV-0001" not in {i["id"] for i in admin.get("/inventory/alerts").json()}


def test_inventory_edits_rerun_the_plan_low_stock_rule(admin):
    assert admin.patch("/api/inventory/INV-0001", json={"quantity": 100}).json()["data"]["quantity"] == 100
    assert "INV-0001" in {i["id"] for i in admin.get("/inventory/alerts").json()}
    admin.patch("/api/inventory/INV-0001", json={"quantity": 9000})
    assert "INV-0001" not in {i["id"] for i in admin.get("/inventory/alerts").json()}
    assert admin.patch("/api/inventory/INV-0001", json={"quantity": -1}).status_code == 400
    assert admin.patch("/api/inventory/INV-0001", json={"station_id": "atlantis"}).status_code == 400
    assert admin.patch("/api/inventory/INV-0001", json={"station_id": ""}).json()["data"]["station_id"] is None
    assert admin.get("/inventory").status_code == 200  # the plan endpoint copes with unassigned stock


def test_create_inventory_without_a_station_like_the_modal_does(admin):
    created = admin.post("/api/inventory", json={"name": "Flares", "category": "Safety", "quantity": 2, "threshold": 6,
                                                 "unit": "boxes", "needs_maintenance": True}).json()["data"]
    assert created["station_id"] is None and created["station_name"] is None and created["needs_maintenance"] is True
    assert "INV-0008" in {i["id"] for i in admin.get("/inventory/alerts").json()}
    assert admin.post("/api/inventory", json={"name": "No category"}).status_code == 400
    assert admin.delete("/api/inventory/INV-0008").status_code == 204


# ------------------------------------------------------------------ personnel
def test_personnel_show_in_field_on_leave_base_with_overdue_as_an_overlay(admin):
    people = by_id(rows(admin.get("/api/personnel", params={"pageSize": 100})))
    assert people["PER-001"]["status"] == "In Field"  # overdue underneath, still deployed
    assert admin.get("/personnel").json()[0]["status"] == "overdue"
    assert people["PER-004"]["status"] == "On Leave" and people["PER-009"]["status"] == "Base"
    in_field = {p["id"] for p in rows(admin.get("/api/personnel", params={"status": "In Field", "pageSize": 100}))}
    assert {"PER-001", "PER-006"} <= in_field and "PER-004" not in in_field and len(in_field) == 7
    assert people["PER-001"]["station_region"] == "Antarctic"


def test_check_in_clears_overdue_and_refreshes_the_timestamp(admin):
    before = admin.get("/api/personnel/PER-001").json()["data"]["last_checkin"]
    person = admin.post("/api/personnel/PER-001/checkin").json()["data"]
    assert person["status"] == "In Field" and person["last_checkin"] > before
    assert by_id(admin.get("/personnel").json())["PER-001"]["status"] == "on_expedition"  # overdue lifted underneath
    assert admin.post("/api/personnel/PER-999/checkin").status_code == 404


def test_people_on_leave_never_go_overdue(admin, session):
    session.get(Personnel, "PER-004").last_checkin = utcnow() - timedelta(days=5)
    session.commit()
    assert [p["id"] for p in rows(admin.get("/api/personnel", params={"status": "On Leave"}))] == ["PER-004"]
    assert by_id(admin.get("/personnel").json())["PER-004"]["status"] == "on_leave"
    assert admin.get("/dashboard/summary").json()["overdue_personnel"] == 2  # Elena and Priya only


def test_create_and_edit_personnel_like_the_forms_do(admin):
    created = admin.post("/api/personnel", json={"name": "Ada Ice", "role": "Medic", "station_id": "", "status": "On Leave"})
    assert created.status_code == 201
    person = created.json()["data"]
    assert person["id"] == "PER-011" and person["station_id"] is None and person["status"] == "On Leave"
    assert (utcnow() - datetime.strptime(person["last_checkin"], "%Y-%m-%d %H:%M:%S")).total_seconds() < 60
    edited = admin.patch("/api/personnel/PER-011", json={"status": "In Field", "station_id": "vostok"}).json()["data"]
    assert edited["status"] == "In Field" and edited["station_name"] == "Vostok Station"
    assert admin.post("/api/personnel", json={"name": "X", "role": "Y", "status": "Sleeping"}).status_code == 400
    assert admin.post("/api/personnel", json={"name": "X", "role": "Y", "status": "Base", "station_id": "atlantis"}).status_code == 400


def test_editing_an_overdue_person_changes_what_they_return_to(admin):
    admin.patch("/api/personnel/PER-001", json={"status": "Base"})
    assert admin.get("/api/personnel/PER-001").json()["data"]["status"] == "Base"
    assert by_id(admin.get("/personnel").json())["PER-001"]["status"] == "overdue"  # the overlay stays
    admin.post("/api/personnel/PER-001/checkin")
    assert by_id(admin.get("/personnel").json())["PER-001"]["status"] == "at_base"


def test_deleting_a_person_releases_everything_that_referenced_them(admin):
    incident = admin.post("/emergency", json={"type": "medical", "personnel_id": "PER-002"}).json()["id"]
    assert admin.delete("/api/personnel/PER-002").status_code == 204
    assert admin.get("/expeditions/EXP-0002").json()["team_lead_id"] is None
    assert admin.get("/expeditions/EXP-0002").json()["personnel_ids"] == []
    assert {i["id"]: i for i in admin.get("/emergency").json()}[incident]["personnel_id"] is None
    assert admin.get("/api/expeditions/EXP-0002").json()["data"]["team_lead"] == "Anders Solberg"  # name is kept


# ------------------------------------------------------------------ emergencies
def test_emergencies_use_critical_warning_resolved_and_open_resolved(admin):
    items = by_id(rows(admin.get("/api/emergencies", params={"pageSize": 100})))
    assert items["INC-0001"]["severity"] == "critical" and items["INC-0001"]["status"] == "Open"
    assert items["INC-0002"]["severity"] == "warning" and items["INC-0003"]["severity"] == "resolved"
    assert items["INC-0003"]["status"] == "Resolved" and items["INC-0003"]["resolved_at"]
    assert items["INC-0001"]["station_name"] == "Vostok Station"
    assert {i["id"] for i in rows(admin.get("/api/emergencies", params={"status": "Open"}))} == \
        {"INC-0001", "INC-0002", "INC-0004"}


def test_reporting_and_resolving_an_emergency(admin):
    warning = admin.post("/api/emergencies", json={"title": "Radio dropout", "severity": "warning", "station_id": ""}).json()["data"]
    critical = admin.post("/api/emergencies", json={"title": "Fire", "severity": "critical", "station_id": "alert"}).json()["data"]
    assert warning["station_id"] is None and critical["station_name"] == "Alert"
    plan_side = by_id(admin.get("/emergency").json())
    assert plan_side[warning["id"]]["severity"] == "medium" and plan_side[critical["id"]]["severity"] == "high"
    assert plan_side[critical["id"]]["description"] == "Fire"
    assert admin.post("/api/emergencies", json={"title": "x", "severity": "meh"}).status_code == 400
    assert admin.post("/api/emergencies", json={"severity": "warning"}).status_code == 400

    resolved = admin.patch(f"/api/emergencies/{critical['id']}", json={"status": "Resolved"}).json()["data"]
    assert resolved["status"] == "Resolved" and resolved["severity"] == "resolved" and resolved["resolved_at"]
    assert admin.patch(f"/api/emergencies/{critical['id']}", json={"status": "Open"}).status_code == 409
    assert admin.patch(f"/api/emergencies/{critical['id']}", json={"status": "Bogus"}).status_code == 400
    assert admin.patch("/api/emergencies/INC-9999", json={"status": "Resolved"}).status_code == 404
    assert admin.patch(f"/api/emergencies/{warning['id']}", json={"title": "Radio restored"}).json()["data"]["title"] == "Radio restored"


def test_the_escalation_rule_reaches_the_frontend_as_critical(admin, session):
    warning = admin.post("/api/emergencies", json={"title": "Slow leak", "severity": "warning"}).json()["data"]
    session.get(EmergencyIncident, warning["id"]).timestamp = utcnow() - timedelta(hours=2, minutes=30)
    session.commit()
    escalated = by_id(rows(admin.get("/api/emergencies", params={"pageSize": 100})))[warning["id"]]
    assert escalated["severity"] == "critical" and escalated["escalated_at"]
    assert admin.get("/dashboard/summary").json()["escalated_emergencies"] == 1


def test_resolving_through_the_frontend_releases_the_person_like_the_plan_does(admin):
    incident = admin.post("/emergency", json={"type": "medical", "personnel_id": "PER-005"}).json()["id"]
    assert by_id(admin.get("/personnel").json())["PER-005"]["status"] == "emergency"
    assert by_id(rows(admin.get("/api/personnel", params={"pageSize": 100})))["PER-005"]["status"] == "In Field"
    admin.patch(f"/api/emergencies/{incident}", json={"status": "Resolved"})
    assert by_id(admin.get("/personnel").json())["PER-005"]["status"] == "on_expedition"
    assert admin.get(f"/api/emergencies/{incident}").json()["data"]["resolved_at"]


def test_resolving_via_the_plan_endpoint_stamps_resolved_at_too(admin):
    admin.patch("/emergency/INC-0001", json={"status": "resolved"})
    assert admin.get("/api/emergencies/INC-0001").json()["data"]["resolved_at"]


# ------------------------------------------------------------------ stats and analytics
def test_stats_on_the_demo_dataset(admin):
    stats = admin.get("/api/stats").json()
    assert stats["dashboard"] == {"activeExpeditions": 2, "personnelInField": 7, "lowStockAlerts": 3,
                                  "assetsNeedingMaintenance": 2, "openEmergencies": 3}
    assert stats["cargo"] == {"totalShipments": 6, "inTransit": 2, "delivered": 2, "delayed": 1}
    assert stats["inventory"] == {"totalSkus": 7, "lowStock": 3, "outOfStock": 0, "categories": 7}
    assert stats["personnel"] == {"totalStaff": 10, "inField": 7, "onLeave": 1, "stations": 12}
    assert stats["emergency"]["openEmergencies"] == 3 and stats["emergency"]["resolvedLast30d"] == 4
    assert stats["emergency"]["avgResponseTimeHours"] == 8.1  # mean of 13.5, 6, 3.5, 9.2


def test_stats_follow_the_data(admin):
    admin.patch("/api/emergencies/INC-0001", json={"status": "Resolved"})
    admin.patch("/api/inventory/INV-0003", json={"quantity": 0})
    admin.post("/api/personnel/PER-001/checkin")
    stats = admin.get("/api/stats").json()
    assert stats["emergency"]["openEmergencies"] == 2 and stats["dashboard"]["openEmergencies"] == 2
    assert stats["inventory"]["outOfStock"] == 1 and stats["inventory"]["lowStock"] == 2
    assert stats["dashboard"]["lowStockAlerts"] == 3  # the empty item still counts as an alert


def test_average_response_time_is_null_until_something_is_resolved(admin):
    for incident in ("INC-0003", "INC-0005", "INC-0006", "INC-0007"):
        assert admin.delete(f"/api/emergencies/{incident}").status_code == 204
    assert admin.get("/api/stats").json()["emergency"]["avgResponseTimeHours"] is None


def test_analytics_series(admin):
    data = admin.get("/api/analytics").json()
    assert set(data) == {"emergenciesByDay", "responseTimeTrend", "cargoByDay", "expeditionTimeline",
                         "personnelBreakdown", "inventoryByCategory"}
    assert [p["hours"] for p in data["responseTimeTrend"]] == [13.5, 6.0, 3.5, 9.2]
    assert sum(p["count"] for p in data["emergenciesByDay"]) == 7
    assert sum(p["count"] for p in data["cargoByDay"]) == 6 and len(data["cargoByDay"]) > 3
    assert {p["status"]: p["count"] for p in data["personnelBreakdown"]} == {"In Field": 7, "On Leave": 1, "Base": 2}
    assert [e["name"] for e in data["expeditionTimeline"]][0] == "Greenland Traverse North"  # oldest start first
    assert {"id", "name", "status", "region", "start_date", "end_date"} == set(data["expeditionTimeline"][0])
    assert {c["category"] for c in data["inventoryByCategory"]} >= {"Fuel", "Power"}


# ------------------------------------------------------------------ audit log
def test_audit_log_records_who_did_what_and_can_be_filtered(admin, officer):
    officer.post("/api/personnel/PER-002/checkin")
    admin.delete("/api/inventory/INV-0001")
    officer.patch("/api/cargo/CGO-0002", json={"status": "Delivered"})

    newest = rows(admin.get("/api/audit-log", params={"sort": "created_at", "order": "desc"}))[:3]
    assert [(e["user_name"], e["action"], e["resource_type"]) for e in newest] == [
        ("Duty Officer", "update", "cargo"), ("Ops Admin", "delete", "inventory"), ("Duty Officer", "update", "personnel")]
    assert {e["action"] for e in rows(admin.get("/api/audit-log", params={"action": "delete"}))} == {"delete"}
    assert rows(admin.get("/api/audit-log", params={"resourceType": "inventory", "action": "delete"}))[0]["summary"] == \
        'Deleted inventory item "Diesel fuel"'
    assert admin.get("/api/audit-log", params={"q": "jonas"}).json()["total"] == 1  # the seeded history is searchable
    assert admin.get("/api/audit-log", params={"pageSize": 3}).json()["totalPages"] > 1


def test_failed_writes_leave_no_audit_entry(admin):
    before = admin.get("/api/audit-log").json()["total"]
    assert admin.post("/api/cargo", json={"description": "incomplete"}).status_code == 400
    assert admin.delete("/api/cargo/CGO-9999").status_code == 404
    assert admin.get("/api/audit-log").json()["total"] == before


# ------------------------------------------------------------------ assistant
def test_assistant_answers_from_live_data_when_no_ai_key_is_set(admin):
    reply = admin.post("/api/assistant/chat", json={"message": "Which stations have low stock right now?"}).json()
    assert reply["source"] == "local"
    assert "Emergency rations: 180/200 kits at Vostok Station" in reply["reply"]
    assert "GEMINI_API_KEY" in reply["reply"]

    overdue = admin.post("/api/assistant/chat", json={"message": "Are any personnel overdue for check-in?"}).json()["reply"]
    assert "Dr. Elena Kowalski" in overdue and "Priya Nair" in overdue and "Kirsten Bruun" not in overdue

    emergencies = admin.post("/api/assistant/chat", json={"message": "What emergencies are currently open?"}).json()["reply"]
    assert "Generator failure" in emergencies and "Medical evacuation" not in emergencies

    overview = admin.post("/api/assistant/chat", json={"message": "hello"}).json()["reply"]
    assert "2 active expedition(s)" in overview and "3 open emergency" in overview


def test_assistant_rejects_an_empty_message(admin):
    assert admin.post("/api/assistant/chat", json={"message": "   "}).status_code == 400
    assert admin.post("/api/assistant/chat", json={}).json()["error"] == "message is required."


class _Reply:
    def __init__(self, status, body):
        self.status_code, self._body = status, body

    def json(self):
        return self._body


def _gemini(monkeypatch, *replies):
    calls = []

    def fake_post(url, json=None, headers=None, timeout=None):
        calls.append({"url": url, "json": json, "headers": headers})
        return replies[min(len(calls), len(replies)) - 1]

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(assistant.httpx, "post", fake_post)
    monkeypatch.setattr(assistant.time, "sleep", lambda _: None)
    return calls


def test_assistant_uses_gemini_with_the_live_snapshot_when_configured(admin, monkeypatch):
    ok = _Reply(200, {"candidates": [{"content": {"parts": [{"text": "Vostok is low on rations."}]}}]})
    calls = _gemini(monkeypatch, ok)
    reply = admin.post("/api/assistant/chat", json={"message": "What is low?"}).json()
    assert reply == {"reply": "Vostok is low on rations.", "source": "gemini"}
    sent = calls[0]
    assert sent["headers"]["X-goog-api-key"] == "test-key"
    assert "Emergency rations" in sent["json"]["system_instruction"]["parts"][0]["text"]  # grounded in the snapshot
    assert sent["json"]["contents"][0]["parts"][0]["text"] == "What is low?"


def test_assistant_retries_a_busy_service_then_falls_back_when_it_stays_down(admin, monkeypatch):
    busy = _Reply(503, {"error": {"message": "high demand"}})
    ok = _Reply(200, {"candidates": [{"content": {"parts": [{"text": "second try"}]}}]})
    calls = _gemini(monkeypatch, busy, ok)
    assert admin.post("/api/assistant/chat", json={"message": "hi"}).json()["reply"] == "second try"
    assert len(calls) == 2

    calls = _gemini(monkeypatch, busy)
    down = admin.post("/api/assistant/chat", json={"message": "low stock?"}).json()
    assert len(calls) == 3 and down["source"] == "local" and "high demand" in down["reply"]


def test_assistant_falls_back_on_rate_limits_and_empty_answers(admin, monkeypatch):
    _gemini(monkeypatch, _Reply(429, {}))
    limited = admin.post("/api/assistant/chat", json={"message": "cargo?"}).json()
    assert limited["source"] == "local" and "rate-limited" in limited["reply"] and "MAN-1043" in limited["reply"]
    _gemini(monkeypatch, _Reply(200, {"candidates": []}))
    assert admin.post("/api/assistant/chat", json={"message": "cargo?"}).json()["source"] == "local"


# ------------------------------------------------------------------ seeding and the database file
def test_both_seed_profiles_build_and_the_demo_one_is_the_default(admin):
    import seed
    from db import SessionLocal
    from models.user import User
    from sqlalchemy import func, select

    seed.seed(profile="plan")
    with SessionLocal() as db:
        assert db.execute(select(func.count()).select_from(User)).scalar_one() == 2
    assert {s["id"] for s in admin.get("/stations").json()} >= {"STN-BHARATI", "STN-POLARRESOLVE"}
    seed.seed()
    assert {s["id"] for s in admin.get("/stations").json()} >= {"vostok", "mcmurdo"}
    with pytest.raises(ValueError):
        seed.seed(profile="nope")


def test_an_outdated_database_file_is_reported_with_the_fix(tmp_path, monkeypatch):
    import db as database
    from sqlalchemy import create_engine, text

    old = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with old.begin() as conn:
        conn.execute(text("CREATE TABLE cargo_items (id VARCHAR PRIMARY KEY, name VARCHAR)"))
    monkeypatch.setattr(database, "engine", old)
    drift = database.schema_drift()
    assert "cargo_items.manifest_id" in drift and "cargo_items.status" in drift
    with pytest.raises(RuntimeError, match="python seed.py"):
        database.init_db()


def test_a_brand_new_database_seeds_itself_on_startup(monkeypatch):
    from fastapi.testclient import TestClient

    from db import Base, engine
    from main import app

    Base.metadata.drop_all(engine)
    with TestClient(app) as fresh:
        signed_in = fresh.post("/api/auth/login", json={"email": "admin@polarops.io", "password": "glacieradmin26"})
        assert signed_in.status_code == 200
        assert fresh.get("/health").json()["seeded"] is True

    monkeypatch.setenv("POLAROPS_AUTOSEED", "0")
    Base.metadata.drop_all(engine)
    with TestClient(app) as empty:
        assert empty.get("/health").json()["seeded"] is False
        assert empty.post("/api/auth/login", json={"email": "admin@polarops.io", "password": "glacieradmin26"}).status_code == 401
