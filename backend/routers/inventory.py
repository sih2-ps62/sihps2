# OWNER: Jalak
# GET /inventory, POST /inventory
# PATCH /inventory/{id}/adjust
# GET /inventory/alerts
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import check_ref, get_db, get_or_404, next_id
from models.inventory import InventoryItem
from models.station import Station
from rules.low_stock import apply_low_stock
from schemas import InventoryAdjust, InventoryCreate, InventoryOut, InventoryStatus

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("", response_model=list[InventoryOut])
def list_inventory(
    station_id: Optional[str] = None,
    status: Optional[InventoryStatus] = None,
    db: Session = Depends(get_db),
):
    query = select(InventoryItem).order_by(InventoryItem.station_id, InventoryItem.id)
    if station_id:
        query = query.where(InventoryItem.station_id == station_id)
    if status:
        query = query.where(InventoryItem.status == status)
    return db.execute(query).scalars().all()


@router.post("", response_model=InventoryOut, status_code=201)
def create_inventory(body: InventoryCreate, db: Session = Depends(get_db)):
    item = InventoryItem(
        id=next_id(db, InventoryItem, "INV"),
        name=body.name,
        category=body.category,
        station_id=check_ref(db, Station, body.station_id, "station_id"),
        quantity=body.quantity,
        unit=body.unit,
        reorder_threshold=body.reorder_threshold,
    )
    apply_low_stock(item)
    db.add(item)
    db.commit()
    return item


# Declared before any /{id} route so "alerts" is never read as an id.
@router.get("/alerts", response_model=list[InventoryOut])
def inventory_alerts(db: Session = Depends(get_db)):
    """Items below their reorder threshold, most depleted (lowest quantity / threshold) first."""
    low = db.execute(select(InventoryItem).where(InventoryItem.status == "low")).scalars().all()
    return sorted(low, key=lambda i: (i.quantity / i.reorder_threshold if i.reorder_threshold else 0, i.id))


@router.patch("/{inventory_id}/adjust", response_model=InventoryOut)
def adjust_inventory(inventory_id: str, body: InventoryAdjust, db: Session = Depends(get_db)):
    item = get_or_404(db, InventoryItem, inventory_id, "Inventory item")
    new_quantity = body.quantity if body.quantity is not None else item.quantity + body.delta
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail=f"Adjustment would take {item.name} below zero (have {item.quantity})")
    item.quantity = new_quantity
    apply_low_stock(item)
    db.commit()
    return item
