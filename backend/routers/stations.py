from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(tags=["stations"])


@router.get("/stations", response_model=List[schemas.StationOut])
def list_stations(db: Session = Depends(get_db)):
    return db.query(models.Station).all()
