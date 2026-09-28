from datetime import timedelta

from db import utcnow
from models.emergency import EmergencyIncident


# ------------------------------------------------------------------ contract basics
def test_health_and_stations(client):
    assert client.get("/health").json()["seeded"] is True
    stations = client.get("/stations").json()
    assert {s["id"] for s in stations} >= {"STN-BHARATI", "STN-MAITRI", "STN-POLARRESOLVE"}
    assert set(stations[0]) == {"id", "name", "type", "lat", "lng", "status"}


def test_errors_are_always_a_detail_string(client):
    missing = client.get("/expeditions/EXP-9999")
    assert missing.status_code == 404 and isinstance(missing.json()["detail"], str)
    invalid = client.post("/cargo", json={"name": "", "category": "food", "weight_kg": -1})
    assert invalid.status_code == 422 and isinstance(invalid.json()["detail"], str)


def test_timestamps_are_iso_utc(client):
    checkin = client.get("/personnel").json()[0]["last_checkin"]
    assert checkin.endswith("Z") and "T" in checkin


# ------------------------------------------------------------------ expeditions + risk
def test_create_expedition_with_route_crew_and_cargo(client):
    body = {
        "name": "Test Traverse", "start_date": "2026-12-01", "end_date": "2026-12-10",
        "team_lead_id": "PER-005", "personnel_ids": ["PER-005", "PER-007"], "cargo_ids": ["CGO-0007"],
        "waypoints": [{"station_id": "STN-MAITRI", "eta": "2026-12-02T09:00:00Z"}, {"station_id": "STN-CAMPALPHA"}],
    }
    response = client.post("/expeditions", json=body)
    assert response.status_code == 201
    exp = response.json()
    assert exp["id"] == "EXP-0004" and exp["status"] == "planned"
    assert [w["sequence"] for w in exp["waypoints"]] == [1, 2]
    assert exp["waypoints"][0]["eta"] == "2026-12-02T09:00:00Z"
    assert exp["personnel_ids"] == ["PER-005", "PER-007"] and exp["cargo_ids"] == ["CGO-0007"]
    assert exp["risk_score"] == sum(f["contribution"] for f in exp["risk_factors"])
    assert client.get("/cargo", params={"expedition_id": "EXP-0004"}).json()[0]["id"] == "CGO-0007"


def test_create_rejects_bad_references_and_dates(client):
    base = {"name": "X", "start_date": "2026-12-01", "end_date": "2026-12-10"}
    assert client.post("/expeditions", json={**base, "waypoints": [{"station_id": "STN-NOPE"}]}).status_code == 400
    assert client.post("/expeditions", json={**base, "personnel_ids": ["PER-999"]}).status_code == 400
    assert client.post("/expeditions", json={**base, "team_lead_id": "PER-999"}).status_code == 400
    assert client.post("/expeditions", json={**base, "end_date": "2026-11-01"}).status_code == 422
    assert len(client.get("/expeditions").json()) == 3  # failed creates left nothing behind


def test_patch_waypoint_reached_and_reroute(client):
    exp = client.get("/expeditions/EXP-0001").json()
    first, second = exp["waypoints"]
    patched = client.patch("/expeditions/EXP-0001", json={"waypoints": [{"id": second["id"], "status": "reached"}, {"id": first["id"]}]}).json()
    assert [w["id"] for w in patched["waypoints"]] == [second["id"], first["id"]]  # order follows the list
    assert patched["waypoints"][0]["status"] == "reached" and patched["waypoints"][0]["sequence"] == 1

    rerouted = client.patch("/expeditions/EXP-0001", json={"waypoints": [{"id": first["id"]}, {"station_id": "STN-MAITRI"}]}).json()
    assert len(rerouted["waypoints"]) == 2 and rerouted["waypoints"][1]["station_id"] == "STN-MAITRI"
    assert client.get("/expeditions/EXP-0001").json()["waypoints"] == rerouted["waypoints"]
    assert client.patch("/expeditions/EXP-0001", json={"waypoints": [{"id": "WPT-0003"}]}).status_code == 400


def test_patch_status_assignments_and_cargo_replace(client):
    blocked = client.patch("/expeditions/EXP-0002", json={"status": "in_progress", "personnel_ids": ["PER-006"], "cargo_ids": []})
    assert blocked.status_code == 409 and "Buddy team" in blocked.json()["detail"]
    # Planning may have one person; launching may not. Failed launch did not persist any partial changes.
    assert client.get("/expeditions/EXP-0002").json()["status"] == "planned"
    updated = client.patch("/expeditions/EXP-0002", json={"personnel_ids": ["PER-006"], "cargo_ids": []}).json()
    assert updated["status"] == "planned" and updated["personnel_ids"] == ["PER-006"] and updated["cargo_ids"] == []
    assert client.get("/cargo", params={"expedition_id": "EXP-0002"}).json() == []
    assert client.patch("/expeditions/EXP-0002", json={"status": "flying"}).status_code == 422
    assert client.patch("/expeditions/EXP-0002", json={"end_date": "2000-01-01"}).status_code == 400
    assert len(client.get("/expeditions", params={"status": "in_progress"}).json()) == 1


def test_risk_differs_between_bad_weather_and_calm_routes(client):
    bad = client.get("/expeditions/EXP-0001/risk").json()
    calm = client.get("/expeditions/EXP-0002/risk").json()
    assert bad["risk_band"] == "high" and calm["risk_band"] == "low"
    assert bad["risk_score"] > calm["risk_score"]
    assert set(bad) == {"expedition_id", "risk_score", "risk_band", "risk_factors", "generated_at"}


def test_weather_override_moves_score_live(client):
    clear = client.get("/expeditions/EXP-0002/risk", params={"weather_code": "clear"}).json()["risk_score"]
    storm = client.get("/expeditions/EXP-0002/risk", params={"weather_code": "blizzard"}).json()["risk_score"]
    assert storm - clear == 30
    assert client.get("/expeditions/EXP-0002/risk", params={"weather_code": "meteors"}).status_code == 400
    assert client.get("/expeditions/EXP-0002/risk", params={"season": "monsoon"}).status_code == 400


def test_overdue_personnel_raise_route_risk_and_checkin_lowers_it(client):
    before = client.get("/expeditions/EXP-0001/risk").json()
    assert "overdue_personnel_on_route" in {f["factor"] for f in before["risk_factors"]}
    client.post("/personnel/PER-004/checkin")
    after = client.get("/expeditions/EXP-0001/risk").json()
    assert before["risk_score"] - after["risk_score"] == 20


# ------------------------------------------------------------------ cargo
def test_cargo_lifecycle(client):
    created = client.post("/cargo", json={"name": "Crampons", "category": "equipment", "weight_kg": 12.5, "current_station_id": "STN-MAITRI"})
    assert created.status_code == 201 and created.json()["status"] == "stored" and created.json()["id"] == "CGO-0009"
    moved = client.patch("/cargo/CGO-0009", json={"status": "in_transit", "current_station_id": "STN-BHARATI"}).json()
    assert moved["status"] == "in_transit" and moved["current_station_id"] == "STN-BHARATI"
    assert client.get("/dashboard/summary").json()["cargo_in_transit"] == 3
    assert client.patch("/cargo/CGO-0009", json={"status": "lost"}).status_code == 422
    assert client.patch("/cargo/CGO-0009", json={"current_station_id": "STN-NOPE"}).status_code == 400
    assert client.patch("/cargo/CGO-9999", json={"status": "stored"}).status_code == 404
    assert client.post("/cargo", json={"name": "x", "category": "y", "weight_kg": 1, "expedition_id": "EXP-9999"}).status_code == 400


def test_cargo_filters(client):
    assert {c["id"] for c in client.get("/cargo", params={"status": "delivered"}).json()} == {"CGO-0005", "CGO-0008"}
    assert {c["id"] for c in client.get("/cargo", params={"station_id": "STN-MAITRI"}).json()} == {"CGO-0006", "CGO-0007"}


# ------------------------------------------------------------------ inventory + low-stock rule
def test_adjust_below_threshold_raises_alert_and_restocking_clears_it(client):
    assert "INV-0001" not in {i["id"] for i in client.get("/inventory/alerts").json()}
    low = client.patch("/inventory/INV-0001/adjust", json={"delta": -11000}).json()
    assert low["quantity"] == 7000 and low["status"] == "low"
    assert "INV-0001" in {i["id"] for i in client.get("/inventory/alerts").json()}
    assert client.get("/dashboard/summary").json()["low_stock_items"] == 4

    boundary = client.patch("/inventory/INV-0001/adjust", json={"quantity": 8000}).json()
    assert boundary["status"] == "ok"  # exactly at threshold is not low
    assert "INV-0001" not in {i["id"] for i in client.get("/inventory/alerts").json()}


def test_alerts_list_most_depleted_first(client):
    alerts = client.get("/inventory/alerts").json()
    ratios = [a["quantity"] / a["reorder_threshold"] for a in alerts]
    assert ratios == sorted(ratios) and all(a["status"] == "low" for a in alerts)


def test_adjust_validation(client):
    assert client.patch("/inventory/INV-0001/adjust", json={}).status_code == 422
    assert client.patch("/inventory/INV-0001/adjust", json={"delta": 1, "quantity": 5}).status_code == 422
    assert client.patch("/inventory/INV-0001/adjust", json={"delta": -999999}).status_code == 400
    assert client.patch("/inventory/INV-9999/adjust", json={"delta": 1}).status_code == 404


def test_create_inventory_computes_status(client):
    body = {"name": "Skis", "category": "equipment", "station_id": "STN-MAITRI", "quantity": 2, "unit": "pairs", "reorder_threshold": 5}
    created = client.post("/inventory", json=body)
    assert created.status_code == 201 and created.json()["status"] == "low"
    assert client.post("/inventory", json={**body, "station_id": "STN-NOPE"}).status_code == 400
    assert {i["station_id"] for i in client.get("/inventory", params={"station_id": "STN-MAITRI"}).json()} == {"STN-MAITRI"}


# ------------------------------------------------------------------ assets
def test_needs_maintenance_asset_drops_out_of_assignment_pool(client):
    created = client.post("/assets", json={"name": "Sledge", "category": "vehicle", "current_holder_type": "station", "current_holder_id": "STN-MAITRI"}).json()
    assert created["condition"] == "operational"
    assert created["id"] in {a["id"] for a in client.get("/assets", params={"available": True}).json()}

    patched = client.patch(f"/assets/{created['id']}", json={"condition": "needs_maintenance", "last_inspected": "2026-09-26"})
    assert patched.status_code == 200 and patched.json()["last_inspected"] == "2026-09-26"
    assert created["id"] not in {a["id"] for a in client.get("/assets", params={"available": True}).json()}
    due = client.get("/assets/maintenance-due").json()
    assert created["id"] in {a["id"] for a in due} and {a["condition"] for a in due} == {"needs_maintenance"}


def test_retired_assets_are_never_available(client):
    available = {a["id"] for a in client.get("/assets", params={"available": True}).json()}
    assert "AST-0008" not in available and "AST-0004" not in available and "AST-0001" in available


def test_non_operational_asset_cannot_be_assigned_to_an_expedition(client):
    blocked = client.patch("/assets/AST-0004", json={"current_holder_type": "expedition", "current_holder_id": "EXP-0001"})
    assert blocked.status_code == 409 and "needs_maintenance" in blocked.json()["detail"]
    fixed = client.patch("/assets/AST-0004", json={"condition": "operational", "current_holder_type": "expedition", "current_holder_id": "EXP-0001"})
    assert fixed.status_code == 200 and fixed.json()["current_holder_id"] == "EXP-0001"


def test_asset_holder_must_exist(client):
    body = {"name": "Radio", "category": "comms", "current_holder_type": "station", "current_holder_id": "EXP-0001"}
    assert client.post("/assets", json=body).status_code == 400  # an expedition id is not a station
    assert client.patch("/assets/AST-0001", json={"current_holder_id": "STN-NOPE"}).status_code == 400
    assert client.patch("/assets/AST-9999", json={"condition": "retired"}).status_code == 404


# ------------------------------------------------------------------ personnel + overdue rule
def test_stale_checkin_is_overdue_and_checkin_restores_prior_status(client):
    roster = {p["id"]: p for p in client.get("/personnel").json()}
    assert roster["PER-004"]["status"] == "overdue" and roster["PER-001"]["status"] == "on_expedition"
    checked_in = client.post("/personnel/PER-004/checkin")
    assert checked_in.status_code == 200 and checked_in.json()["status"] == "on_expedition"
    assert client.get("/dashboard/summary").json()["overdue_personnel"] == 0
    assert client.post("/personnel/PER-999/checkin").status_code == 404


def test_lazy_evaluation_flips_a_person_who_goes_stale(client, session):
    from models.personnel import Personnel

    person = session.get(Personnel, "PER-003")
    person.last_checkin = utcnow() - timedelta(hours=6, minutes=5)
    session.commit()
    assert {p["id"] for p in client.get("/personnel", params={"status": "overdue"}).json()} == {"PER-003", "PER-004"}
    assert client.post("/personnel/PER-003/checkin").json()["status"] == "at_base"


# ------------------------------------------------------------------ emergency + escalation rule
def _raise(client, **overrides):
    body = {"type": "medical", "personnel_id": "PER-002", "severity": "low", "description": "test"}
    return client.post("/emergency", json={**body, **overrides})


def test_raise_incident_flags_personnel_and_defaults_station(client):
    incident = _raise(client)
    assert incident.status_code == 201
    data = incident.json()
    assert data["id"] == "INC-0003" and data["status"] == "open" and data["escalated_at"] is None
    assert data["station_id"] == "STN-CAMPBRAVO"  # taken from the person
    assert {p["id"]: p for p in client.get("/personnel").json()}["PER-002"]["status"] == "emergency"
    assert client.post("/emergency", json={"type": "fire"}).status_code == 422  # needs a subject
    assert _raise(client, personnel_id="PER-999").status_code == 400


def test_open_incident_escalates_one_level_per_window(client, session):
    incident_id = _raise(client).json()["id"]
    row = session.get(EmergencyIncident, incident_id)
    row.timestamp = utcnow() - timedelta(hours=2, minutes=30)
    session.commit()

    first = {i["id"]: i for i in client.get("/emergency").json()}[incident_id]
    assert first["severity"] == "medium" and first["escalated_at"] is not None
    again = {i["id"]: i for i in client.get("/emergency").json()}[incident_id]
    assert again["severity"] == "medium" and again["escalated_at"] == first["escalated_at"]  # no runaway escalation
    assert client.get("/dashboard/summary").json()["escalated_emergencies"] == 1


def test_resolve_sticks_keeps_history_and_releases_personnel(client, session):
    incident_id = _raise(client).json()["id"]
    session.get(EmergencyIncident, incident_id).timestamp = utcnow() - timedelta(hours=3)
    session.commit()
    assert client.get("/emergency").status_code == 200  # escalates

    assert client.patch(f"/emergency/{incident_id}", json={"status": "responding"}).json()["status"] == "responding"
    resolved = client.patch(f"/emergency/{incident_id}", json={"status": "resolved"}).json()
    assert resolved["status"] == "resolved"

    after_refresh = {i["id"]: i for i in client.get("/emergency").json()}[incident_id]
    assert after_refresh["status"] == "resolved" and after_refresh["escalated_at"] is not None
    assert {p["id"]: p for p in client.get("/personnel").json()}["PER-002"]["status"] == "on_expedition"
    assert client.patch(f"/emergency/{incident_id}", json={"status": "open"}).status_code == 409
    assert client.patch("/emergency/INC-9999", json={"status": "resolved"}).status_code == 404


def test_personnel_stays_in_emergency_while_another_incident_is_active(client):
    first = _raise(client).json()["id"]
    second = _raise(client, type="equipment_failure").json()["id"]
    client.patch(f"/emergency/{first}", json={"status": "resolved"})
    assert {p["id"]: p for p in client.get("/personnel").json()}["PER-002"]["status"] == "emergency"
    client.patch(f"/emergency/{second}", json={"status": "resolved"})
    assert {p["id"]: p for p in client.get("/personnel").json()}["PER-002"]["status"] == "on_expedition"


def test_incident_filter_by_status(client):
    assert {i["id"] for i in client.get("/emergency", params={"status": "resolved"}).json()} == {"INC-0001"}
    assert {i["id"] for i in client.get("/emergency", params={"status": "open"}).json()} == {"INC-0002"}


# ------------------------------------------------------------------ dashboard
def test_dashboard_summary_counts_the_seed(client):
    summary = client.get("/dashboard/summary").json()
    assert summary["active_expeditions"] == 1
    assert summary["cargo_in_transit"] == 2
    assert summary["low_stock_items"] == 3
    assert summary["overdue_personnel"] == 1
    assert summary["active_emergencies"] == 1
    assert summary["escalated_emergencies"] == 0
    assert summary["maintenance_due_assets"] == 2
    assert summary["generated_at"].endswith("Z")
