# OWNER: Param
# Evaluated on GET /emergency and GET /dashboard/summary.
#   status == open and open for > 2h  ->  severity bumps one level (low->medium->high), escalated_at = now
# The 2h window restarts from escalated_at, so an incident climbs one level per window instead of
# jumping straight to high on the next read.
import os
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from db import utcnow
from models.emergency import EmergencyIncident

ESCALATE_AFTER_HOURS = float(os.getenv("POLAROPS_ESCALATION_HOURS", "2"))
LEVELS = ["low", "medium", "high"]


def next_level(severity: str) -> str:
    index = LEVELS.index(severity) if severity in LEVELS else 0
    return LEVELS[min(index + 1, len(LEVELS) - 1)]


def should_escalate(status: str, severity: str, timestamp: datetime, escalated_at: datetime | None,
                    now: datetime, hours: float = ESCALATE_AFTER_HOURS) -> bool:
    if status != "open" or severity == "high":
        return False
    return (now - (escalated_at or timestamp)) > timedelta(hours=hours)


def evaluate_escalation(db: Session, now: datetime | None = None) -> int:
    """Escalate stale open incidents and commit. Returns how many were escalated."""
    now = now or utcnow()
    escalated = 0
    for incident in db.execute(select(EmergencyIncident)).scalars():
        if should_escalate(incident.status, incident.severity, incident.timestamp, incident.escalated_at, now):
            incident.severity = next_level(incident.severity)
            incident.escalated_at = now
            escalated += 1
    if escalated:
        db.commit()
    return escalated
