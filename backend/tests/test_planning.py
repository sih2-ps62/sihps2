from copy import deepcopy
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from db import utcnow
from models import InventoryItem
from models.planning import RecoveryDraft
from planning import evaluate, forecast, project, training_snapshot


NOW = datetime(2026, 9, 29, 12)


def scenario(**extra):
    return {"horizon_days": 14, "delay_hours": 0, **extra}


def test_exact_crossing_before_late_arrival_and_fractional_time():
    result = project(100, 20, 30, [(4, 200)], 14)
    assert result["reserve_day"] == 3.5
    assert result["series"][[p["day"] for p in result["series"]].index(4)]["balance"] == 20
    assert result["empty_day"] is None


def test_zero_consumption_and_initial_breach():
    assert project(100, 0, 20, [], 14)["reserve_day"] is None
    assert project(20, 0, 20, [], 14)["reserve_day"] == 0
    assert project(0, 5, 20, [], 14)["empty_day"] == 0


def test_training_delay_and_recovery_preserve_donor_reserve():
    data = training_snapshot(NOW)
    before = deepcopy(data)
    result = evaluate(data, scenario(delay_hours=72), NOW)
    assert result["baseline"][0]["reserve_days_min"] is None
    fuel = result["forecast"][0]
    assert fuel["reserve_days_min"] == 4.4 and fuel["reserve_days_max"] == 5.5
    assert result["forecast"][1]["daily_max"] == pytest.approx(8.4)
    transfer = next(r for r in result["recoveries"] if r["kind"] == "transfer")
    assert transfer["arrival_day"] == 3.5 and transfer["after_day"] is None
    assert transfer["donor_minimum"] > transfer["donor_reserve"]
    assert len(result["missions"]) == 1
    assert data == before  # preview is pure


@pytest.mark.parametrize("fault", ["closed", "failed", "reserved", "elsewhere", "donor", "units", "late", "unknown", "degraded", "arrival_busy"])
def test_infeasible_transfer_never_offered(fault):
    data = training_snapshot(NOW)
    options = scenario(delay_hours=72)
    if fault == "closed": options["closed_link_id"] = "link-1"
    if fault == "failed": options["unavailable_asset_id"] = "haul-1"
    if fault == "reserved": data["reserved_assets"] = ["haul-1"]
    if fault == "elsewhere": data["assets"][0]["holder_id"] = "camp"
    if fault == "donor": data["items"][2]["quantity"] = 400
    if fault == "units": data["items"][2]["unit"] = "kg"
    if fault == "late": options["delay_hours"] = 168
    if fault == "unknown": data["items"][2]["profile"] = None
    if fault == "degraded": data["stations"][1]["status"] = "degraded"
    if fault == "arrival_busy": data["arrivals"][0]["asset_id"] = "haul-1"
    result = evaluate(data, options, NOW)
    assert not any(r["kind"] == "transfer" for r in result["recoveries"])
    assert result["links"][0]["problem"]


def test_missing_inputs_are_unknown_and_do_not_report_station_covered():
    data = training_snapshot(NOW)
    data["items"][0]["profile"] = None
    result = evaluate(data, scenario(), NOW)
    assert result["forecast"][0]["status"] == "unknown"
    assert result["stations"][0]["status"] == "unknown"
    assert result["summary"]["unknown_items"] == 1


@pytest.mark.parametrize("change", ["overdue", "received", "cancelled", "asset_failed"])
def test_uncertain_or_completed_arrivals_are_not_credited(change):
    data = training_snapshot(NOW)
    if change == "overdue": data["arrivals"][0]["eta"] = "2026-09-28T12:00:00Z"
    if change in ("received", "cancelled"): data["arrivals"][0]["status"] = change
    if change == "asset_failed":
        data["arrivals"][0]["asset_id"] = "haul-1"
        data["assets"][0]["condition"] = "needs_maintenance"
    fuel = forecast(data, scenario(), NOW)[0]
    assert fuel["reserve_days_min"] == 4.4
    if change in ("overdue", "asset_failed"): assert fuel["warnings"]


def test_station_specific_delay_and_failed_crew_propagate():
    data = training_snapshot(NOW)
    result = evaluate(data, scenario(delay_hours=72, delay_station_id="hub", unavailable_person_id="crew-2"), NOW)
    assert result["forecast"][0]["reserve_days_min"] is None
    assert any("Exercise medic" in reason for reason in result["missions"][0]["issues"])


def test_planner_requires_authentication(anonymous):
    assert anonymous.get("/api/planning/context").status_code == 401
    assert anonymous.post("/api/planning/simulate", json={}).status_code == 401
    assert anonymous.get("/api/planning/drafts").status_code == 401


def test_configure_live_forecast_and_cancel_arrival(admin):
    data = admin.get("/api/planning/context").json()["data"]
    item = next(i for i in data["items"] if i["station_id"])
    id = item["id"]
    profile = {"daily_min": 10, "daily_max": 20, "reserve": 20, "note": "Recorded daily usage from station logs"}
    response = admin.post(f"/api/planning/profiles/{id}", json=profile)
    assert response.status_code == 200, response.text
    arrival = {"inventory_id": id, "quantity": 100, "eta": (utcnow() + timedelta(days=2)).isoformat() + "Z",
               "note": "External delivery confirmed by logistics"}
    response = admin.post("/api/planning/arrivals", json=arrival)
    assert response.status_code == 201, response.text
    aid = response.json()["data"]["id"]
    result = admin.post("/api/planning/simulate", json={}).json()["data"]
    row = next(r for r in result["forecast"] if r["id"] == id)
    assert row["daily_max"] == 20 and len(row["arrivals"]) == 1
    assert admin.patch(f"/api/planning/arrivals/{aid}", json={**arrival, "status": "cancelled"}).status_code == 200
    result = admin.post("/api/planning/simulate", json={}).json()["data"]
    assert next(r for r in result["forecast"] if r["id"] == id)["arrivals"] == []


@pytest.mark.parametrize("bad", [{"daily_min": -1}, {"daily_min": 30}, {"basis": "person"}, {"note": "  "}, {"reserve": -1}])
def test_profile_validation(admin, bad):
    item = admin.get("/api/planning/context").json()["data"]["items"][0]
    body = {"daily_min": 10, "daily_max": 20, "reserve": 20, "note": "Station consumption measured for a week", **bad}
    assert admin.post(f'/api/planning/profiles/{item["id"]}', json=body).status_code == 422


def draft_body(result):
    return {"training": True, "scenario": result["scenario"], "as_of": result["as_of"], "fingerprint": result["fingerprint"],
            "option_id": result["recoveries"][0]["id"], "title": "72-hour supply delay recovery",
            "reason": "Review the approved traverse before scheduling dispatch."}


def test_training_draft_is_durable_and_does_not_change_operational_data(admin, session):
    before = admin.get("/api/planning/context").json()["data"]
    result = admin.post("/api/planning/simulate", json={"training": True, "scenario": scenario(delay_hours=72)}).json()["data"]
    response = admin.post("/api/planning/drafts", json=draft_body(result))
    assert response.status_code == 201, response.text
    saved = response.json()["data"]
    assert saved["training"] and saved["snapshot"]["selected_option"]["kind"] == "transfer"
    assert admin.get(f'/api/planning/drafts/{saved["id"]}').json()["data"] == saved
    assert admin.get("/api/planning/context").json()["data"] == before
    assert len(list(session.scalars(select(RecoveryDraft)))) == 1


@pytest.mark.parametrize("fault", ["hash", "expired", "missing_option", "future"])
def test_invalid_drafts_rejected(admin, fault):
    result = admin.post("/api/planning/simulate", json={"training": True, "scenario": scenario(delay_hours=72)}).json()["data"]
    body = draft_body(result)
    if fault == "hash": body["fingerprint"] = "a" * 64
    if fault == "expired": body["as_of"] = (utcnow() - timedelta(minutes=11)).isoformat() + "Z"
    if fault == "future": body["as_of"] = (utcnow() + timedelta(days=1)).isoformat() + "Z"
    if fault == "missing_option": body["option_id"] = "transfer:made-up"
    assert admin.post("/api/planning/drafts", json=body).status_code == 409


def test_live_data_change_invalidates_snapshot_before_draft(admin, session):
    # A review option is produced by an explicitly unavailable assigned crew member.
    context = admin.get("/api/planning/context").json()["data"]
    mission = next(m for m in context["missions"] if m["personnel_ids"])
    result = admin.post("/api/planning/simulate", json={"scenario": scenario(unavailable_person_id=mission["personnel_ids"][0])}).json()["data"]
    body = {**draft_body(result), "training": False}
    item = session.get(InventoryItem, context["items"][0]["id"])
    item.quantity += 1
    session.commit()
    response = admin.post("/api/planning/drafts", json=body)
    assert response.status_code == 409 and "changed" in response.json()["error"]


def test_unknown_scenario_selection_is_rejected(admin):
    assert admin.post("/api/planning/simulate", json={"scenario": {"closed_link_id": "missing"}}).status_code == 400
    assert admin.post("/api/planning/simulate", json={"scenario": {"delay_hours": 200}}).status_code == 422


def test_replacement_candidates_need_location_condition_and_availability():
    data = training_snapshot(NOW)
    options = scenario(unavailable_asset_id="snow-1")
    result = evaluate(data, options, NOW)
    assert any(r["kind"] == "replacement" for r in result["recoveries"])
    data["reserved_assets"] = ["haul-1"]
    assert not any(r["kind"] == "replacement" for r in evaluate(data, options, NOW)["recoveries"])


def test_link_validation_and_reassessment_after_inventory_change(admin):
    context = admin.get("/api/planning/context").json()["data"]
    stations = [s for s in context["stations"] if s["status"] == "operational"]
    def create(path, body):
        response = admin.post(path, json=body)
        assert response.status_code == 201, response.text
        return response.json()["data"]
    source = create("/api/inventory", {"name": "Planning fuel", "category": "fuel", "station_id": stations[0]["id"], "quantity": 2000, "unit": "L"})
    target = create("/api/inventory", {"name": "Planning fuel", "category": "fuel", "station_id": stations[1]["id"], "quantity": 100, "unit": "kg"})
    vehicle = create("/api/assets", {"name": "Planning tractor", "category": "vehicle", "current_holder_type": "station", "current_holder_id": stations[0]["id"]})
    body = {"source_id": source["id"], "target_id": target["id"], "asset_id": vehicle["id"], "travel_hours": 12, "capacity": 200,
            "note": "Approved test traverse, fictional operating assumptions"}
    assert admin.post("/api/planning/links", json=body).status_code == 400
    admin.patch(f'/api/inventory/{target["id"]}', json={"unit": "L"})
    link = create("/api/planning/links", body)
    for item in (source, target):
        assert admin.post(f'/api/planning/profiles/{item["id"]}', json={"daily_min": 10, "daily_max": 20, "reserve": 20, "note": "Fictional measured daily use for test"}).status_code == 200
    result = admin.post("/api/planning/simulate", json={}).json()["data"]
    assert any(r["id"] == f'transfer:{link["id"]}' for r in result["recoveries"])
    admin.patch(f'/api/inventory/{target["id"]}', json={"unit": "kg"})
    result = admin.post("/api/planning/simulate", json={}).json()["data"]
    assert not any(r["kind"] == "transfer" for r in result["recoveries"])
    assert "unit" in result["links"][0]["problem"]
