# OWNER: (feature) SITREP
# GET /api/sitrep - a one-click daily situation report, the same document a duty officer would otherwise compile
# by hand from five different screens. Built from the exact same live snapshot the AI Assistant already uses
# (ui_api.assistant.build_context) plus comms risk and Mission Readiness, so the numbers never disagree between
# the assistant, the dashboard and this report. Gemini turns the snapshot into prose when it's available; the
# local renderer produces a fully structured report on its own, so this endpoint never has a "the AI is down"
# failure mode - it just quietly stops being prose.
import json
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db, utcnow
from spaceweather import current_comms_risk
from ui_api.assistant import AssistantUnavailable, ask_gemini, build_context
from ui_api.security import current_user
from ui_api.stations import station_readiness_rows

router = APIRouter(prefix="/sitrep", tags=["ui: sitrep"], dependencies=[Depends(current_user)])

SITREP_SYSTEM = (
    "You are the PolarOps Assistant, embedded in a polar research logistics dashboard used by duty officers at "
    "Antarctic and Arctic stations. Write today's situation report (SITREP) for the duty officer coming on shift, "
    "using ONLY the live operational data provided below - never invent a station, person, incident or number. "
    "Use these exact section headers, each on its own line, in this order: OPERATIONAL SUMMARY, STATION "
    "READINESS, WEATHER & COMMS, CARGO & INVENTORY, PERSONNEL, EMERGENCIES, EXPEDITIONS. Under each header write "
    "2-4 short sentences, plain text, no markdown, no bullet points. If a section has nothing to report, write "
    "'Nothing to report.' under it.\n\nCurrent PolarOps data (JSON):\n"
)


def _readiness_summary(rows: list[dict]) -> list[dict]:
    worst = sorted(rows, key=lambda r: r["readiness_score"])[:5]
    return [{"name": r["name"], "readiness_score": r["readiness_score"], "readiness_band": r["readiness_band"],
            "weather_code": r["weather_code"]} for r in worst]


def build_sitrep_data(db: Session) -> dict:
    context = build_context(db)
    context["date"] = date.today().isoformat()
    context["commsRisk"] = current_comms_risk()
    context["stationReadiness"] = _readiness_summary(station_readiness_rows(db))
    return context


def render_local_sitrep(data: dict) -> str:
    s = data["stats"]
    comms = data["commsRisk"]
    lines = [f"SITUATION REPORT — {data['date']}", ""]

    lines += ["OPERATIONAL SUMMARY",
             f"{s['activeExpeditions']} active expedition(s), {s['personnelInField']} personnel in the field, "
             f"{s['lowStockAlerts']} low-stock item(s), {s['openEmergencies']} open emergency(ies).", ""]

    lines += ["STATION READINESS"]
    if data["stationReadiness"]:
        for r in data["stationReadiness"]:
            lines.append(f"- {r['name']}: {r['readiness_score']}/100 ({r['readiness_band']}), weather {r['weather_code']}.")
    else:
        lines.append("Nothing to report.")
    lines.append("")

    lines += ["WEATHER & COMMS",
             f"Comms risk: {comms['label']}"
             + (f" (geomagnetic {comms['geomagnetic_text']}, radio blackout {comms['radio_blackout_text']})."
                if comms["level"] else " — nominal, no active geomagnetic storm or radio blackout."), ""]

    lines += ["CARGO & INVENTORY"]
    moving = [c for c in data["cargo"] if c["status"] in ("In Transit", "Delayed", "Pending")]
    if moving:
        for c in moving:
            lines.append(f"- {c['manifest_id']} {c['description']}: {c['origin']} -> {c['destination']} ({c['status']}).")
    else:
        lines.append("All cargo delivered.")
    if data["lowStock"]:
        for item in data["lowStock"]:
            lines.append(f"- Low stock: {item['name']} {item['quantity']}/{item['threshold']} {item['unit']} at "
                         f"{item.get('station_name') or 'an unassigned station'}.")
    lines.append("")

    lines += ["PERSONNEL"]
    if data["overduePersonnel"]:
        for p in data["overduePersonnel"]:
            lines.append(f"- Overdue: {p['name']} ({p['role']}) at {p.get('station_name') or 'an unassigned station'}, "
                         f"last check-in {p['last_checkin'] or 'never'}.")
    else:
        lines.append("No overdue check-ins.")
    lines.append("")

    lines += ["EMERGENCIES"]
    if data["openEmergencies"]:
        for e in data["openEmergencies"]:
            lines.append(f"- {e['title']} [{e['severity']}] at {e.get('station_name') or 'an unassigned station'}, "
                         f"reported {e['reported_at']}.")
    else:
        lines.append("No open emergencies.")
    lines.append("")

    lines += ["EXPEDITIONS"]
    if data["expeditions"]:
        for e in data["expeditions"]:
            lines.append(f"- {e['name']}: {e['status']}, {e['region']}, led by {e['team_lead']}.")
    else:
        lines.append("No expeditions on record.")

    return "\n".join(lines)


@router.get("")
def get_sitrep(db: Session = Depends(get_db)):
    data = build_sitrep_data(db)
    try:
        text = ask_gemini(SITREP_SYSTEM + json.dumps(data, default=str), "Generate today's SITREP.")
        return {"generated_at": utcnow(), "text": text, "source": "gemini"}
    except AssistantUnavailable as why:
        text = render_local_sitrep(data) + f"\n\n(Generated from live data by the built-in engine — {why}.)"
        return {"generated_at": utcnow(), "text": text, "source": "local"}
