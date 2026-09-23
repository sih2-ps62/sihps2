from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import schemas
from database import get_db
from rules import build_alerts

router = APIRouter(tags=["alerts"])


@router.get("/alerts", response_model=List[schemas.AlertOut])
def get_alerts(db: Session = Depends(get_db)):
    return build_alerts(db)
