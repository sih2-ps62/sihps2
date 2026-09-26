# OWNER: Param
# Evaluated lazily on GET /personnel, GET /dashboard/summary and the expedition read paths.
#   (now - last_checkin) > 6h and status != overdue  ->  status "overdue"
# Personnel in an active emergency are exempt — that status must not be masked — and so is anyone on leave,
# who is not expected to check in.
import os
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from db import utcnow
from models.personnel import Personnel

OVERDUE_AFTER_HOURS = float(os.getenv("POLAROPS_OVERDUE_HOURS", "6"))


def should_flag_overdue(status: str, last_checkin: datetime, now: datetime,
                        hours: float = OVERDUE_AFTER_HOURS) -> bool:
    if status in ("overdue", "emergency", "on_leave"):
        return False
    return (now - last_checkin) > timedelta(hours=hours)


def evaluate_overdue(db: Session, now: datetime | None = None) -> int:
    """Flip stale personnel to overdue and commit. Returns how many were flipped."""
    now = now or utcnow()
    flipped = 0
    for person in db.execute(select(Personnel)).scalars():
        if should_flag_overdue(person.status, person.last_checkin, now):
            person.prior_status = person.status
            person.status = "overdue"
            flipped += 1
    if flipped:
        db.commit()
    return flipped
