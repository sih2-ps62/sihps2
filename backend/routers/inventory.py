from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from ids import next_id
from audit import log_action
from rules import recompute_inventory_status

router = APIRouter(tags=["inventory"])


@router.get("/inventory", response_model=List[schemas.InventoryOut])
def list_inventory(station_id: str = None, db: Session = Depends(get_db)):
    q = db.query(models.InventoryItem)
    if station_id:
        q = q.filter(models.InventoryItem.station_id == station_id)
    items = q.all()
    for item in items:
        recompute_inventory_status(item)
    db.commit()
    return items


@router.post("/inventory", response_model=schemas.InventoryOut, status_code=201)
def create_inventory(payload: schemas.InventoryCreate, db: Session = Depends(get_db)):
    if not db.get(models.Station, payload.station_id):
        raise HTTPException(422, detail=f"station_id '{payload.station_id}' does not exist")
    item = models.InventoryItem(id=next_id(db, "INV"), **payload.model_dump())
    recompute_inventory_status(item)
    db.add(item)
    log_action(db, "inventory", f"Added inventory item '{item.name}'", item.id)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/inventory/{item_id}/adjust", response_model=schemas.InventoryOut)
def adjust_inventory(item_id: str, payload: schemas.InventoryAdjust, db: Session = Depends(get_db)):
    item = db.get(models.InventoryItem, item_id)
    if not item:
        raise HTTPException(404, detail="Inventory item not found")
    if payload.quantity is not None:
        item.quantity = payload.quantity
    elif payload.delta is not None:
        item.quantity = max(0, item.quantity + payload.delta)
    else:
        raise HTTPException(422, detail="Provide either 'quantity' or 'delta'")
    recompute_inventory_status(item)
    log_action(db, "inventory", f"Adjusted '{item.name}' to {item.quantity} {item.unit}", item.id)
    db.commit()
    db.refresh(item)
    return item


@router.get("/inventory/alerts", response_model=List[schemas.InventoryOut])
def inventory_alerts(db: Session = Depends(get_db)):
    items = db.query(models.InventoryItem).all()
    for item in items:
        recompute_inventory_status(item)
    db.commit()
    return [i for i in items if i.status == "low"]
