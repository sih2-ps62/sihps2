from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from ids import next_id
from audit import log_action
from rules import recompute_asset_status

router = APIRouter(tags=["assets"])


@router.get("/assets", response_model=List[schemas.AssetOut])
def list_assets(station_id: str = None, db: Session = Depends(get_db)):
    q = db.query(models.Asset)
    if station_id:
        q = q.filter(models.Asset.station_id == station_id)
    assets = q.all()
    for a in assets:
        recompute_asset_status(a)
    db.commit()
    return assets


@router.post("/assets", response_model=schemas.AssetOut, status_code=201)
def create_asset(payload: schemas.AssetCreate, db: Session = Depends(get_db)):
    asset = models.Asset(id=next_id(db, "AST"), status="operational", **payload.model_dump())
    recompute_asset_status(asset)
    db.add(asset)
    log_action(db, "assets", f"Registered asset '{asset.name}'", asset.id)
    db.commit()
    db.refresh(asset)
    return asset


@router.patch("/assets/{asset_id}/telemetry", response_model=schemas.AssetOut)
def push_telemetry(asset_id: str, payload: schemas.AssetTelemetry, db: Session = Depends(get_db)):
    asset = db.get(models.Asset, asset_id)
    if not asset:
        raise HTTPException(404, detail="Asset not found")
    if payload.health_pct is not None:
        asset.health_pct = max(0, min(100, payload.health_pct))
    if payload.runtime_hours is not None:
        asset.runtime_hours = payload.runtime_hours
    recompute_asset_status(asset)
    log_action(db, "assets", f"Telemetry update for '{asset.name}' -> {asset.health_pct:.0f}% ({asset.status})",
               asset.id, status="warning" if asset.status != "operational" else "success")
    db.commit()
    db.refresh(asset)
    return asset
