"""Explainable, deterministic planning. All stock values are projections, never writes.

Balances may become negative to show unmet demand. A later arrival does not erase
an earlier reserve breach. Travel is only evaluated along an operator-approved link.
"""
import hashlib
import json
from datetime import datetime, timedelta


def stamp(value):
    return value.isoformat(timespec="seconds") + "Z"


def parse(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)


def fingerprint(snapshot):
    return hashlib.sha256(json.dumps(snapshot, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def compatible(source, target):
    return all(str(source[k]).strip().casefold() == str(target[k]).strip().casefold()
               for k in ("name", "unit", "category"))


def project(quantity, rate, reserve, arrivals, horizon):
    """Exact piecewise linear consumption, including the balance BEFORE an arrival."""
    events = {}
    for day, amount in arrivals:
        if 0 < day <= horizon:
            events[day] = events.get(day, 0) + amount
    points = sorted({0.0, float(horizon), *map(float, range(1, horizon + 1)), *events})
    balance, last = float(quantity), 0.0
    reserve_day = 0.0 if balance <= reserve else None
    empty_day = 0.0 if balance <= 0 else None
    minimum = balance
    series = []
    for day in points:
        before = balance - rate * (day - last)
        if reserve_day is None and before <= reserve and rate > 0:
            reserve_day = last + (balance - reserve) / rate
        if empty_day is None and before <= 0 and rate > 0:
            empty_day = last + balance / rate
        minimum = min(minimum, before)
        series.append({"day": round(day, 5), "balance": round(before, 3)})
        balance = before + events.get(day, 0)
        if day in events:
            series.append({"day": round(day, 5), "balance": round(balance, 3)})
        last = day
    return {"reserve_day": round(reserve_day, 4) if reserve_day is not None else None,
            "empty_day": round(empty_day, 4) if empty_day is not None else None,
            "minimum": minimum, "end_balance": round(balance, 3), "series": series}


def asset_problem(snapshot, asset_id, scenario):
    asset = next((a for a in snapshot["assets"] if a["id"] == asset_id), None)
    if not asset:
        return "Transport asset is missing."
    if asset_id == scenario.get("unavailable_asset_id"):
        return f'{asset["name"]} is unavailable in this scenario.'
    if asset["condition"] != "operational":
        return f'{asset["name"]} is {asset["condition"].replace("_", " ")}.'
    if asset_id in snapshot["reserved_assets"]:
        return f'{asset["name"]} is committed to an open incident.'
    return None


def affected_delay(item, scenario):
    target = scenario.get("delay_station_id")
    return scenario.get("delay_hours", 0) if not target or target == item["station_id"] else 0


def forecast(snapshot, scenario, as_of):
    horizon = scenario["horizon_days"]
    result = []
    for item in snapshot["items"]:
        profile = item.get("profile")
        row = {"id": item["id"], "name": item["name"], "station_id": item["station_id"],
               "unit": item["unit"], "quantity": item["quantity"], "warnings": [], "arrivals": []}
        if not profile:
            result.append({**row, "status": "unknown", "reason": "Add a consumption range and protected reserve."})
            continue
        if profile["basis"] == "person" and not profile.get("headcount"):
            result.append({**row, "status": "unknown", "reason": "A verified planning headcount is required."})
            continue
        factor = profile["headcount"] if profile["basis"] == "person" else 1
        low, high = profile["daily_min"] * factor, profile["daily_max"] * factor
        if (as_of - parse(profile["updated_at"])).total_seconds() > 7 * 86400:
            row["warnings"].append("Consumption assumptions are over 7 days old; review them.")
        arrivals = []
        for arrival in snapshot["arrivals"]:
            if arrival["inventory_id"] != item["id"] or arrival["status"] != "expected":
                continue
            eta = parse(arrival["eta"])
            reason = "Original ETA has passed; confirm receipt or revise the ETA." if eta <= as_of else None
            if arrival.get("asset_id"):
                reason = reason or asset_problem(snapshot, arrival["asset_id"], scenario)
            day = (eta - as_of).total_seconds() / 86400 + affected_delay(item, scenario) / 24
            row["arrivals"].append({**arrival, "day": round(day, 4), "excluded_reason": reason})
            if reason:
                row["warnings"].append(f'Arrival {arrival["id"]}: {reason}')
            else:
                arrivals.append((day, arrival["quantity"]))
        conservative = project(item["quantity"], high, profile["reserve"], arrivals, horizon)
        optimistic = project(item["quantity"], low, profile["reserve"], arrivals, horizon)
        row.update(status="critical" if conservative["empty_day"] is not None else
                   "watch" if conservative["reserve_day"] is not None else "covered",
                   daily_min=low, daily_max=high, reserve=profile["reserve"], profile=profile,
                   reserve_days_min=conservative["reserve_day"], reserve_days_max=optimistic["reserve_day"],
                   empty_day=conservative["empty_day"], end_balance=conservative["end_balance"],
                   minimum=round(conservative["minimum"], 4),
                   series=[{"day": p["day"], "low": p["balance"], "high": optimistic["series"][i]["balance"]}
                           for i, p in enumerate(conservative["series"])])
        result.append(row)
    return result


def link_problem(snapshot, link, scenario, by_item):
    source, target = by_item.get(link["source_id"]), by_item.get(link["target_id"])
    if not source or not target:
        return "An inventory item no longer exists."
    if not link["enabled"]:
        return "This transport link is disabled."
    if link["id"] == scenario.get("closed_link_id"):
        return "Transport link is closed for this scenario."
    if not compatible(source, target):
        return "Item name, category or unit no longer matches; review the link."
    if source["station_id"] == target["station_id"]:
        return "Source and destination must be different stations."
    stations = {s["id"]: s for s in snapshot["stations"]}
    for station_id in (source["station_id"], target["station_id"]):
        if station_id not in stations or stations[station_id]["status"] != "operational":
            return "A station on this link is unavailable or degraded; review operating conditions."
    problem = asset_problem(snapshot, link["asset_id"], scenario)
    if problem:
        return problem
    asset = next(a for a in snapshot["assets"] if a["id"] == link["asset_id"])
    if asset["holder_type"] != "station" or asset["holder_id"] != source["station_id"]:
        return "Transport asset is not available at the source station."
    if any(a["asset_id"] == asset["id"] and a["status"] == "expected" for a in snapshot["arrivals"]):
        return "Transport asset is already assigned to an expected arrival."
    return None


def evaluate(snapshot, scenario, as_of):
    baseline_input = {"horizon_days": scenario["horizon_days"], "delay_hours": 0}
    baseline = forecast(snapshot, baseline_input, as_of)
    current = forecast(snapshot, scenario, as_of)
    by_item = {i["id"]: i for i in snapshot["items"]}
    by_forecast = {f["id"]: f for f in current}
    stations = {s["id"]: s for s in snapshot["stations"]}
    station_rows = []
    for station in snapshot["stations"]:
        rows = [f for f in current if f["station_id"] == station["id"]]
        configured = [f for f in rows if f["status"] != "unknown"]
        limiting = min((f for f in configured if f["reserve_days_min"] is not None),
                       key=lambda f: f["reserve_days_min"], default=None)
        unknown = len(rows) - len(configured)
        station_rows.append({**station, "configured": len(configured), "total": len(rows), "unknown": unknown,
                             "limiting_id": limiting["id"] if limiting else None,
                             "reserve_day": limiting["reserve_days_min"] if limiting else None,
                             "status": "watch" if limiting else "unknown" if unknown or not rows else "covered"})
    links, recoveries = [], []
    for link in snapshot["links"]:
        problem = link_problem(snapshot, link, scenario, by_item)
        source, target = by_forecast.get(link["source_id"]), by_forecast.get(link["target_id"])
        option = None
        if not problem and (not source or not target or source["status"] == "unknown" or target["status"] == "unknown"):
            problem = "Cannot assess: consumption and reserve inputs are needed at both stations."
        if not problem and target["reserve_days_min"] is not None:
            # Keep donor above reserve throughout the horizon, using only current stock.
            spare = min(source["quantity"] - source["reserve"], source["minimum"] - source["reserve"])
            amount = round(min(link["capacity"], spare - 0.001), 3)
            arrival_day = link["travel_hours"] / 24 + affected_delay(by_item[target["id"]], scenario) / 24
            if amount <= 0:
                problem = "The donor has no spare stock above its projected protected reserve."
            elif arrival_day >= target["reserve_days_min"]:
                problem = "This transfer cannot arrive before the first projected reserve breach."
            else:
                inbound = [(a["day"], a["quantity"]) for a in target["arrivals"] if not a["excluded_reason"]]
                recovery = project(target["quantity"], target["daily_max"], target["reserve"],
                                   [*inbound, (arrival_day, amount)], scenario["horizon_days"])
                option = {"id": f'transfer:{link["id"]}', "kind": "transfer", "link_id": link["id"],
                          "title": f'Transfer {amount:g} {target["unit"]} of {target["name"]}',
                          "detail": f'{stations[source["station_id"]]["name"]} to {stations[target["station_id"]]["name"]}',
                          "source_id": source["id"], "target_id": target["id"], "amount": amount,
                          "arrival_day": round(arrival_day, 3), "before_day": target["reserve_days_min"],
                          "after_day": recovery["reserve_day"], "series": recovery["series"],
                          "donor_minimum": round(source["minimum"] - amount, 3),
                          "donor_reserve": source["reserve"], "approval_note": link["note"],
                          "assumptions": "One trip; alternatives are evaluated independently. Verify crew, fuel, weather and departure gate before dispatch."}
                recoveries.append(option)
        links.append({**link, "problem": problem, "recovery_id": option["id"] if option else None})

    missions = []
    people = {p["id"]: p for p in snapshot["people"]}
    for mission in snapshot["missions"]:
        issues = []
        for aid in mission["asset_ids"]:
            reason = asset_problem(snapshot, aid, scenario)
            if reason:
                issues.append(reason)
                failed = next((a for a in snapshot["assets"] if a["id"] == aid), None)
                origin = mission["waypoints"][0]["station_id"] if mission["waypoints"] else None
                if failed and origin and mission["status"] == "planned":
                    for candidate in snapshot["assets"]:
                        if (candidate["id"] != aid and candidate["category"] == failed["category"]
                                and candidate["holder_type"] == "station" and candidate["holder_id"] == origin
                                and not asset_problem(snapshot, candidate["id"], scenario)
                                and not any(a["asset_id"] == candidate["id"] and a["status"] == "expected" for a in snapshot["arrivals"])):
                            recoveries.append({"id": f'replacement:{mission["id"]}:{aid}:{candidate["id"]}',
                                               "kind": "replacement", "title": f'Review replacement: {candidate["name"]}',
                                               "detail": f'Same-category candidate at the departure station for {mission["name"]}, replacing {failed["name"]}.',
                                               "assumptions": "Category and availability only: verify task suitability, kit contents, capacity and crew before changing the manifest. No quantified recovery benefit."})
        for pid in mission["personnel_ids"]:
            person = people.get(pid)
            if not person:
                issues.append("An assigned person no longer exists.")
            elif pid == scenario.get("unavailable_person_id") or pid in snapshot["reserved_people"] or person["status"] in ("on_leave", "emergency", "overdue"):
                issues.append(f'{person["name"]} is unavailable or committed to an incident.')
        pending = [w for w in mission["waypoints"] if w["status"] != "reached"]
        for waypoint in pending:
            rows = [f for f in current if f["station_id"] == waypoint["station_id"]]
            if any(f["status"] in ("critical", "watch") for f in rows):
                issues.append(f'{stations.get(waypoint["station_id"], {}).get("name", waypoint["station_id"])} has a projected supply reserve breach within the planning horizon.')
        closed = next((l for l in snapshot["links"] if l["id"] == scenario.get("closed_link_id")), None)
        if closed and closed["source_id"] in by_item and closed["target_id"] in by_item:
            pair = (by_item[closed["source_id"]]["station_id"], by_item[closed["target_id"]]["station_id"])
            route = mission["waypoints"]
            if any((a["station_id"], b["station_id"]) == pair and b["status"] != "reached" for a, b in zip(route, route[1:])):
                issues.append("The route includes the station pair on the closed transport link; confirm the expedition's transport mode.")
        if issues:
            missions.append({**mission, "issues": list(dict.fromkeys(issues))})
            recoveries.append({"id": f'review:{mission["id"]}', "kind": "review", "title":
                               ("Review departure: " if mission["status"] == "planned" else "Contact field team: ") + mission["name"],
                               "detail": ("Consider postponing departure until dependencies are resolved, then rerun departure controls." if mission["status"] == "planned" else "Contact the field team to review supply and resource dependencies against the approved contingency plan."),
                               "issues": list(dict.fromkeys(issues)), "assumptions": "This review action has no quantified recovery benefit."})
    recoveries.sort(key=lambda r: (r["kind"] != "transfer", r.get("after_day") is not None, -(r.get("after_day") or 999)))
    return {"as_of": stamp(as_of), "fingerprint": fingerprint(snapshot), "scenario": scenario,
            "baseline": baseline, "forecast": current, "stations": station_rows, "links": links,
            "missions": missions, "recoveries": recoveries,
            "summary": {"at_risk": sum(s["status"] == "watch" for s in station_rows),
                        "unknown_items": sum(f["status"] == "unknown" for f in current),
                        "affected_missions": len(missions), "transfer_options": sum(r["kind"] == "transfer" for r in recoveries)}}


def training_snapshot(as_of):
    """An isolated fictional exercise; never added to inventory/personnel/expedition tables."""
    def profile(low, high, reserve, basis="station", headcount=None):
        return {"daily_min": low, "daily_max": high, "reserve": reserve, "basis": basis,
                "headcount": headcount, "note": "Fictional exercise assumptions, not observed consumption.", "updated_at": stamp(as_of)}
    return {
        "stations": [{"id": "camp", "name": "Aurora field camp", "status": "operational"},
                     {"id": "hub", "name": "Coastal logistics hub", "status": "operational"}],
        "items": [
            {"id": "camp-fuel", "station_id": "camp", "name": "Diesel", "category": "fuel", "unit": "L", "quantity": 260, "profile": profile(40, 50, 40)},
            {"id": "camp-food", "station_id": "camp", "name": "Rations", "category": "food", "unit": "kg", "quantity": 170, "profile": profile(1, 1.4, 20, "person", 6)},
            {"id": "hub-fuel", "station_id": "hub", "name": "Diesel", "category": "fuel", "unit": "L", "quantity": 2200, "profile": profile(20, 30, 300)},
        ],
        "arrivals": [{"id": "delivery-1", "inventory_id": "camp-fuel", "quantity": 500,
                      "eta": stamp(as_of + timedelta(days=3.5)), "asset_id": None, "status": "expected", "note": "External supply shipment; stock is not included at the hub."}],
        "links": [{"id": "link-1", "source_id": "hub-fuel", "target_id": "camp-fuel", "asset_id": "haul-1",
                   "travel_hours": 12, "capacity": 500, "mode": "surface", "enabled": True, "note": "Exercise-only approved traverse, one 500 L load."}],
        "assets": [{"id": "haul-1", "name": "Supply tractor", "condition": "operational", "category": "vehicle", "holder_type": "station", "holder_id": "hub"},
                   {"id": "snow-1", "name": "Survey snowmobile", "condition": "operational", "category": "vehicle", "holder_type": "expedition", "holder_id": "survey-1"}],
        "people": [{"id": "crew-1", "name": "Exercise field lead", "status": "on_expedition"},
                   {"id": "crew-2", "name": "Exercise medic", "status": "on_expedition"}],
        "missions": [{"id": "survey-1", "name": "Aurora ice survey", "status": "planned", "asset_ids": ["snow-1"],
                      "personnel_ids": ["crew-1", "crew-2"], "waypoints": [{"station_id": "hub", "status": "pending"}, {"station_id": "camp", "status": "pending"}]}],
        "reserved_assets": [], "reserved_people": [],
    }
