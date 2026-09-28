# OWNER: Param
# GET /personnel
# POST /personnel/{id}/checkin
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db, get_or_404, utcnow
from models.personnel import Personnel
from rules.overdue_checkin import evaluate_overdue
from schemas import CheckInBody, PersonnelOut, PersonnelStatus
from safety import record_checkin, serialize_write

router = APIRouter(prefix="/personnel", tags=["personnel"])


@router.get("", response_model=list[PersonnelOut])
def list_personnel(
    status: Optional[PersonnelStatus] = None,
    station_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    evaluate_overdue(db)
    query = select(Personnel).order_by(Personnel.id)
    if status:
        query = query.where(Personnel.status == status)
    if station_id:
        query = query.where(Personnel.current_station_id == station_id)
    return db.execute(query).scalars().all()


@router.post("/{personnel_id}/checkin", response_model=PersonnelOut)
def check_in(personnel_id: str, body: Optional[CheckInBody] = None, db: Session = Depends(get_db)):
    serialize_write(db)
    person = get_or_404(db, Personnel, personnel_id, "Personnel")
    record_checkin(db, person, body.station_id if body else None, body.observed_at if body else None)
    db.commit()
    return person
