# OWNER: integration (Day 2-3)
# POST /api/assistant/chat - a command assistant grounded in live operational data.
# With GEMINI_API_KEY set the question goes to Gemini together with a snapshot of the data; without a key (or if
# the service is down) a built-in answer engine responds from the same snapshot, so the panel always works.
import json
import os
import time
from datetime import timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db, utcnow
from models.cargo import CargoItem
from models.emergency import EmergencyIncident
from models.expedition import Expedition
from models.inventory import InventoryItem
from models.personnel import Personnel
from rules.escalation import evaluate_escalation
from rules.overdue_checkin import evaluate_overdue
from ui_api.security import current_user
from ui_api.views import (cargo_view, emergency_view, expedition_view, inventory_view, is_low_stock, personnel_view,
                          station_index)

router = APIRouter(prefix="/assistant", tags=["ui: assistant"], dependencies=[Depends(current_user)])

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_ATTEMPTS = 3
# The frontend flags a field person overdue after a day without a check-in; the assistant uses the same line.
OVERDUE_HOURS = float(os.getenv("POLAROPS_UI_OVERDUE_HOURS", "24"))

SYSTEM_PREFIX = (
    "You are the PolarOps Assistant, embedded in a polar research logistics dashboard used by duty officers at "
    "Antarctic and Arctic stations.\n\n"
    "Answer questions using ONLY the operational data provided below - do not invent stations, personnel, "
    "incidents, or numbers that aren't in it. If the data doesn't contain what's being asked, say so plainly "
    "rather than guessing. Keep answers short and operational - a duty officer reading this on a live shift, "
    "not a report. Use plain text, no markdown headers.\n\nCurrent PolarOps data (JSON):\n"
)


class ChatBody(BaseModel):
    model_config = ConfigDict(extra="ignore")
    message: Optional[str] = None


class AssistantUnavailable(Exception):
    """The AI service can't answer right now; the message says why."""


# ------------------------------------------------------------------ the data snapshot both paths answer from
def build_context(db: Session) -> dict:
    evaluate_overdue(db)
    evaluate_escalation(db)
    stations = station_index(db)
    cutoff = utcnow() - timedelta(hours=OVERDUE_HOURS)

    inventory = [inventory_view(i, stations) for i in db.execute(select(InventoryItem)).scalars() if is_low_stock(i)]
    low_stock = [{key: row[key] for key in ("name", "category", "quantity", "threshold", "unit", "station_name")}
                 for row in inventory]

    incidents = [emergency_view(i, stations) for i in db.execute(select(EmergencyIncident)).scalars()
                 if i.status != "resolved"]
    open_emergencies = [{key: row[key] for key in ("title", "severity", "reported_at", "station_name")}
                        for row in incidents]

    overdue = []
    for person in db.execute(select(Personnel)).scalars():
        row = personnel_view(person, stations)
        if row["status"] == "In Field" and person.last_checkin < cutoff:
            overdue.append({key: row[key] for key in ("name", "role", "last_checkin", "station_name")})

    expeditions = [{key: row[key] for key in ("name", "status", "region", "start_date", "end_date", "team_lead")}
                   for row in (expedition_view(e) for e in db.execute(select(Expedition)).scalars())]
    cargo = [{key: row[key] for key in ("manifest_id", "description", "status", "origin", "destination")}
             for row in (cargo_view(c, stations) for c in db.execute(select(CargoItem)).scalars())]

    people = [personnel_view(p, stations) for p in db.execute(select(Personnel)).scalars()]
    return {
        "stats": {
            "activeExpeditions": sum(e["status"] == "Active" for e in expeditions),
            "openEmergencies": len(open_emergencies),
            "lowStockAlerts": len(low_stock),
            "personnelInField": sum(p["status"] == "In Field" for p in people),
        },
        "lowStock": low_stock,
        "openEmergencies": open_emergencies,
        "overduePersonnel": overdue,
        "expeditions": expeditions,
        "cargo": cargo,
    }


# ------------------------------------------------------------------ built-in answers
def _where(row: dict) -> str:
    return row.get("station_name") or "an unassigned station"


def _list(header: str, lines: list[str], none: str) -> str:
    return f"{header} ({len(lines)}):\n" + "\n".join(f"- {line}" for line in lines) if lines else none


def local_answer(message: str, ctx: dict) -> str:
    text = message.lower()
    parts = []

    if any(word in text for word in ("stock", "suppl", "inventory", "fuel", "ration")):
        parts.append(_list("Low stock", [
            f"{r['name']}: {r['quantity']}/{r['threshold']} {r['unit']} at {_where(r)}" for r in ctx["lowStock"]],
            "No inventory is at or below its threshold."))
    if any(word in text for word in ("overdue", "check-in", "check in", "checkin", "missing", "silent")):
        parts.append(_list("Overdue for check-in", [
            f"{r['name']} ({r['role']}) at {_where(r)} - last check-in {r['last_checkin'] or 'never'} UTC"
            for r in ctx["overduePersonnel"]],
            f"Nobody in the field is more than {OVERDUE_HOURS:g}h overdue."))
    if any(word in text for word in ("emergenc", "incident", "alert", "critical", "urgent")):
        parts.append(_list("Open emergencies", [
            f"{r['title']} [{r['severity']}] at {_where(r)} - reported {r['reported_at']} UTC"
            for r in ctx["openEmergencies"]],
            "There are no open emergencies."))
    if any(word in text for word in ("expedition", "route", "traverse", "survey")):
        parts.append(_list("Expeditions", [
            f"{r['name']} - {r['status']}, {r['region']}, led by {r['team_lead']}" for r in ctx["expeditions"]],
            "No expeditions are on record."))
    if any(word in text for word in ("cargo", "shipment", "manifest", "deliver", "delay")):
        moving = [r for r in ctx["cargo"] if r["status"] in ("In Transit", "Delayed", "Pending")]
        parts.append(_list("Cargo not yet delivered", [
            f"{r['manifest_id']} {r['description']}: {r['origin']} -> {r['destination']} ({r['status']})"
            for r in moving], "All cargo has been delivered."))

    if not parts:
        s = ctx["stats"]
        parts.append(
            f"Right now: {s['activeExpeditions']} active expedition(s), {s['personnelInField']} people in the field, "
            f"{s['lowStockAlerts']} low-stock item(s), {len(ctx['overduePersonnel'])} overdue check-in(s) and "
            f"{s['openEmergencies']} open emergency(ies). Ask about stock, check-ins, emergencies, expeditions or cargo "
            "for detail.")
    return "\n\n".join(parts)


# ------------------------------------------------------------------ Gemini
def ask_gemini(system_instruction: str, message: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise AssistantUnavailable("no GEMINI_API_KEY is configured on the server")
    body = {
        "system_instruction": {"parts": [{"text": system_instruction}]},
        "contents": [{"role": "user", "parts": [{"text": message}]}],
    }
    for attempt in range(1, GEMINI_ATTEMPTS + 1):
        try:
            response = httpx.post(f"{GEMINI_URL}/{GEMINI_MODEL}:generateContent", json=body, timeout=30,
                                  headers={"X-goog-api-key": api_key})
        except httpx.HTTPError as exc:
            raise AssistantUnavailable(f"the AI service could not be reached ({type(exc).__name__})")
        if response.status_code == 200:
            candidates = response.json().get("candidates") or [{}]
            text = "".join(part.get("text", "") for part in candidates[0].get("content", {}).get("parts", []))
            if not text:
                raise AssistantUnavailable("the AI service returned an empty response")
            return text
        if response.status_code == 429:
            raise AssistantUnavailable("the AI service is rate-limited right now")
        if response.status_code == 503 and attempt < GEMINI_ATTEMPTS:
            time.sleep(attempt * 1.5)  # "high demand" is usually transient
            continue
        try:
            reason = response.json()["error"]["message"]
        except (ValueError, KeyError, TypeError):
            reason = f"request failed ({response.status_code})"
        raise AssistantUnavailable(f"the AI service replied: {reason}")
    raise AssistantUnavailable("the AI service did not respond")


@router.post("/chat")
def chat(body: ChatBody, db: Session = Depends(get_db)):
    message = (body.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required.")

    ctx = build_context(db)
    try:
        return {"reply": ask_gemini(SYSTEM_PREFIX + json.dumps(ctx), message), "source": "gemini"}
    except AssistantUnavailable as why:
        note = f"\n\n(Answered from live data by the built-in engine - {why}.)"
        return {"reply": local_answer(message, ctx) + note, "source": "local"}
