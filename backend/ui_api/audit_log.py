# OWNER: integration (Day 2-3)
# GET /api/audit-log - who created, changed or deleted what through the frontend.
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from models.audit import AuditLog
from ui_api.common import ListParams, fmt_ts, list_params, paginate, search
from ui_api.security import current_user

router = APIRouter(prefix="/audit-log", tags=["ui: audit log"], dependencies=[Depends(current_user)])

SORTABLE = ("created_at", "user_name", "action", "resource_type")


def _row(entry: AuditLog) -> dict:
    return {"id": entry.id, "user_id": entry.user_id, "user_name": entry.user_name, "action": entry.action,
            "resource_type": entry.resource_type, "resource_id": entry.resource_id, "summary": entry.summary,
            "created_at": fmt_ts(entry.created_at)}


@router.get("")
def list_audit_log(
    resourceType: Optional[str] = None,
    action: Optional[str] = None,
    params: ListParams = Depends(list_params),
    db: Session = Depends(get_db),
):
    # Fed in id order (newest first when descending) so entries from the same second keep their real order.
    query = select(AuditLog).order_by(AuditLog.id.desc() if params.order == "desc" else AuditLog.id)
    rows = [_row(e) for e in db.execute(query).scalars()]
    if resourceType:
        rows = [r for r in rows if r["resource_type"] == resourceType]
    if action:
        rows = [r for r in rows if r["action"] == action]
    rows = search(rows, params.q, ("summary", "user_name"))
    return paginate(rows, params, sortable=SORTABLE, default_sort="created_at")
