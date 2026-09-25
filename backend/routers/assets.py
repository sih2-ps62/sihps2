# OWNER: Jalak
# GET /assets, POST /assets
# PATCH /assets/{id}
# GET /assets/maintenance-due
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db, get_or_404, next_id
from models.asset import Asset
from models.expedition import Expedition
from models.station import Station
from schemas import AssetCondition, AssetCreate, AssetOut, AssetUpdate, HolderType

router = APIRouter(prefix="/assets", tags=["assets"])


def _check_holder(db: Session, holder_type: str, holder_id: str):
    model = Station if holder_type == "station" else Expedition
    if db.get(model, holder_id) is None:
        raise HTTPException(status_code=400, detail=f"Unknown {holder_type} for current_holder_id: {holder_id}")


@router.get("", response_model=list[AssetOut])
def list_assets(
    condition: Optional[AssetCondition] = None,
    available: Optional[bool] = None,
    holder_type: Optional[HolderType] = None,
    holder_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """`available=true` is the assignment picker: operational assets only."""
    query = select(Asset).order_by(Asset.id)
    if condition:
        query = query.where(Asset.condition == condition)
    if available is True:
        query = query.where(Asset.condition == "operational")
    if holder_type:
        query = query.where(Asset.current_holder_type == holder_type)
    if holder_id:
        query = query.where(Asset.current_holder_id == holder_id)
    return db.execute(query).scalars().all()


@router.post("", response_model=AssetOut, status_code=201)
def create_asset(body: AssetCreate, db: Session = Depends(get_db)):
    _check_holder(db, body.current_holder_type, body.current_holder_id)
    asset = Asset(id=next_id(db, Asset, "AST"), **body.model_dump())
    db.add(asset)
    db.commit()
    return asset


# Declared before any /{id} route so "maintenance-due" is never read as an id.
@router.get("/maintenance-due", response_model=list[AssetOut])
def maintenance_due(db: Session = Depends(get_db)):
    query = select(Asset).where(Asset.condition == "needs_maintenance").order_by(Asset.last_inspected, Asset.id)
    return db.execute(query).scalars().all()


@router.patch("/{asset_id}", response_model=AssetOut)
def update_asset(asset_id: str, body: AssetUpdate, db: Session = Depends(get_db)):
    asset = get_or_404(db, Asset, asset_id, "Asset")
    changes = body.model_dump(exclude_unset=True)

    holder_type = changes.get("current_holder_type") or asset.current_holder_type
    holder_id = changes.get("current_holder_id") or asset.current_holder_id
    condition = changes.get("condition") or asset.condition
    if "current_holder_type" in changes or "current_holder_id" in changes:
        _check_holder(db, holder_type, holder_id)
        if holder_type == "expedition" and condition != "operational":
            raise HTTPException(status_code=409, detail=f"{asset.id} is {condition} and cannot be assigned to an expedition")

    asset.current_holder_type = holder_type
    asset.current_holder_id = holder_id
    asset.condition = condition
    if "last_inspected" in changes:
        asset.last_inspected = changes["last_inspected"]
    db.commit()
    return asset
