# OWNER: integration (Day 2-3)
# Shared plumbing for the frontend-facing /api routes: list params, pagination, formats, audit trail.
import math
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Iterable, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.audit import AuditLog
from ui_api.security import Principal

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 10


def fmt_ts(value: Optional[datetime]) -> Optional[str]:
    """UTC 'YYYY-MM-DD HH:MM:SS' with no 'Z' - the shape the frontend's date helpers append a 'Z' to."""
    return value.strftime("%Y-%m-%d %H:%M:%S") if value else None


def fmt_date(value: Optional[date]) -> Optional[str]:
    return value.isoformat() if value else None


def parse_date(value: Any, field: str) -> Optional[date]:
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field} must be a date like 2026-10-15.")


def blank_to_none(value: Any) -> Any:
    """Form selects send '' for 'no choice'."""
    return None if value in ("", None) else value


def require_fields(values: dict, names: Iterable[str], message: str) -> None:
    if any(values.get(name) in (None, "") for name in names):
        raise HTTPException(status_code=400, detail=message)


# ------------------------------------------------------------------ list queries
@dataclass(frozen=True)
class ListParams:
    page: int
    page_size: int
    sort: Optional[str]
    order: str
    q: Optional[str]


def _int(raw: Optional[str]) -> int:
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 0


def list_params(
    page: Optional[str] = None,
    pageSize: Optional[str] = None,
    sort: Optional[str] = None,
    order: Optional[str] = None,
    q: Optional[str] = None,
) -> ListParams:
    """Forgiving like the frontend expects: bad numbers fall back to defaults instead of a 422."""
    return ListParams(
        page=max(1, _int(page) or 1),
        page_size=min(MAX_PAGE_SIZE, max(1, _int(pageSize) or DEFAULT_PAGE_SIZE)),
        sort=sort,
        order="desc" if str(order or "asc").lower() == "desc" else "asc",
        q=q.strip() if q and q.strip() else None,
    )


def search(rows: list[dict], q: Optional[str], fields: Iterable[str]) -> list[dict]:
    if not q:
        return rows
    needle = q.lower()
    return [row for row in rows if any(needle in str(row.get(field) or "").lower() for field in fields)]


def _sort_key(value: Any):
    if value is None:
        return (0, "")
    return (1, value.lower() if isinstance(value, str) else value)


def paginate(rows: list[dict], params: ListParams, *, sortable: Iterable[str], default_sort: str) -> dict:
    sort = params.sort if params.sort in set(sortable) else default_sort
    ordered = sorted(rows, key=lambda row: _sort_key(row.get(sort)), reverse=params.order == "desc")
    start = (params.page - 1) * params.page_size
    return {
        "data": ordered[start:start + params.page_size],
        "total": len(ordered),
        "page": params.page,
        "pageSize": params.page_size,
        "totalPages": max(1, math.ceil(len(ordered) / params.page_size)),
    }


# ------------------------------------------------------------------ audit trail
def record_audit(db: Session, user: Principal, action: str, resource_type: str, resource_id: Any, summary: str) -> None:
    """Queue an audit row on the caller's session - it commits together with the change it describes."""
    db.add(AuditLog(user_id=user.id, user_name=user.name, action=action, resource_type=resource_type,
                    resource_id=str(resource_id), summary=summary))
