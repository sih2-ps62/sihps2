# OWNER: integration (Day 2-3)
# GET, POST /api/inventory - GET, PATCH, DELETE /api/inventory/{id}
# Editing a level re-runs the plan's low-stock rule, so /inventory/alerts and the dashboard stay in step.
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import check_ref, get_db, get_or_404, next_id
from models.inventory import InventoryItem
from models.station import Station
from rules.low_stock import apply_low_stock
from ui_api.common import ListParams, blank_to_none, list_params, paginate, record_audit, require_fields, search
from ui_api.security import Principal, current_user, require_admin
from ui_api.views import inventory_view, is_low_stock, station_index

router = APIRouter(prefix="/inventory", tags=["ui: inventory"], dependencies=[Depends(current_user)])

SORTABLE = ("name", "category", "quantity", "threshold", "created_at")


class InventoryBody(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    category: Optional[str] = None
    station_id: Optional[str] = None
    quantity: Optional[int] = None
    threshold: Optional[int] = None
    unit: Optional[str] = None
    needs_maintenance: Optional[bool] = None


def _non_negative(value: Optional[int], field: str) -> int:
    if value is not None and value < 0:
        raise HTTPException(status_code=400, detail=f"{field} cannot be negative.")
    return value or 0


@router.get("")
def list_inventory(
    category: Optional[str] = None,
    lowStock: Optional[str] = None,
    needsMaintenance: Optional[str] = None,
    params: ListParams = Depends(list_params),
    db: Session = Depends(get_db),
):
    stations = station_index(db)
    items = db.execute(select(InventoryItem).order_by(InventoryItem.id)).scalars().all()
    if category:
        items = [i for i in items if i.category == category]
    if lowStock == "true":
        items = [i for i in items if is_low_stock(i)]
    if needsMaintenance == "true":
        items = [i for i in items if i.needs_maintenance]
    rows = search([inventory_view(i, stations) for i in items], params.q, ("name", "category"))
    return paginate(rows, params, sortable=SORTABLE, default_sort="name")


@router.get("/{inventory_id}")
def get_inventory(inventory_id: str, db: Session = Depends(get_db)):
    return {"data": inventory_view(get_or_404(db, InventoryItem, inventory_id, "Inventory item"), station_index(db))}


@router.post("", status_code=201)
def create_inventory(body: InventoryBody, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    values = body.model_dump()
    require_fields(values, ("name", "category"), "name and category are required.")
    item = InventoryItem(
        id=next_id(db, InventoryItem, "INV"),
        name=values["name"].strip(),
        category=values["category"].strip(),
        station_id=check_ref(db, Station, blank_to_none(values["station_id"]), "station_id"),
        quantity=_non_negative(values["quantity"], "quantity"),
        reorder_threshold=_non_negative(values["threshold"], "threshold"),
        unit=(values["unit"] or "units").strip() or "units",
        needs_maintenance=bool(values["needs_maintenance"]),
    )
    apply_low_stock(item)
    db.add(item)
    record_audit(db, user, "create", "inventory", item.id, f'Added inventory item "{item.name}"')
    db.commit()
    return {"data": inventory_view(item, station_index(db))}


@router.patch("/{inventory_id}")
def update_inventory(inventory_id: str, body: InventoryBody, db: Session = Depends(get_db),
                     user: Principal = Depends(current_user)):
    item = get_or_404(db, InventoryItem, inventory_id, "Inventory item")
    changes = body.model_dump(exclude_unset=True)
    for required in ("name", "category"):
        if required in changes and changes[required] in (None, ""):
            raise HTTPException(status_code=400, detail=f"{required} cannot be empty.")

    if "name" in changes:
        item.name = changes["name"].strip()
    if "category" in changes:
        item.category = changes["category"].strip()
    if "station_id" in changes:
        item.station_id = check_ref(db, Station, blank_to_none(changes["station_id"]), "station_id")
    if "quantity" in changes:
        item.quantity = _non_negative(changes["quantity"], "quantity")
    if "threshold" in changes:
        item.reorder_threshold = _non_negative(changes["threshold"], "threshold")
    if "unit" in changes and changes["unit"]:
        item.unit = changes["unit"].strip()
    if "needs_maintenance" in changes:
        item.needs_maintenance = bool(changes["needs_maintenance"])
    apply_low_stock(item)

    record_audit(db, user, "update", "inventory", item.id,
                 f'Updated inventory item "{item.name}" ({item.quantity}/{item.reorder_threshold} {item.unit})')
    db.commit()
    return {"data": inventory_view(item, station_index(db))}


@router.delete("/{inventory_id}", status_code=204)
def delete_inventory(inventory_id: str, db: Session = Depends(get_db), user: Principal = Depends(require_admin)):
    item = get_or_404(db, InventoryItem, inventory_id, "Inventory item")
    name = item.name
    db.delete(item)
    record_audit(db, user, "delete", "inventory", inventory_id, f'Deleted inventory item "{name}"')
    db.commit()
    return Response(status_code=204)
