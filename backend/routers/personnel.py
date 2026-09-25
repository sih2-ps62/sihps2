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
from schemas import PersonnelOut, PersonnelStatus

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
def check_in(personnel_id: str, db: Session = Depends(get_db)):
    person = get_or_404(db, Personnel, personnel_id, "Personnel")
    person.last_checkin = utcnow()
    if person.status == "overdue":
        person.status = person.prior_status or "at_base"
        person.prior_status = None
    db.commit()
    return person
