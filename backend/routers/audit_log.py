from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(tags=["audit-log"])


@router.get("/audit-log", response_model=List[schemas.AuditLogOut])
def list_audit_log(
    module: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(models.AuditLogEntry).order_by(models.AuditLogEntry.timestamp.desc())
    if module:
        q = q.filter(models.AuditLogEntry.module == module)
    if status:
        q = q.filter(models.AuditLogEntry.status == status)
    return q.offset(offset).limit(limit).all()
