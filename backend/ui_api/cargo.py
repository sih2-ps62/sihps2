# OWNER: integration (Day 2-3)
# GET, POST /api/cargo - GET, PATCH, DELETE /api/cargo/{id}
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from db import get_db, get_or_404, next_id
from models.cargo import CargoItem
from ui_api.common import ListParams, list_params, paginate, record_audit, require_fields, search
from ui_api.security import Principal, current_user, require_admin
from ui_api.views import CARGO_STATUS_DB, cargo_view, station_index

router = APIRouter(prefix="/cargo", tags=["ui: cargo"], dependencies=[Depends(current_user)])

SORTABLE = ("manifest_id", "description", "status", "weight_kg", "created_at")


class CargoBody(BaseModel):
    model_config = ConfigDict(extra="ignore")
    manifest_id: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    weight_kg: Optional[float] = None


def _status(label: str) -> str:
    if label not in CARGO_STATUS_DB:
        raise HTTPException(status_code=400, detail=f"status must be one of: {', '.join(CARGO_STATUS_DB)}.")
    return CARGO_STATUS_DB[label]


def _weight(value: Optional[float]) -> float:
    if value is not None and value < 0:
        raise HTTPException(status_code=400, detail="weight_kg cannot be negative.")
    return value or 0


def _unique_manifest(db: Session, manifest_id: str, own_id: Optional[str] = None) -> str:
    manifest_id = manifest_id.strip()
    clash = db.execute(select(CargoItem.id).where(func.lower(CargoItem.manifest_id) == manifest_id.lower())).scalars().first()
    if clash and clash != own_id:
        raise HTTPException(status_code=409, detail=f"Manifest {manifest_id} already exists.")
    return manifest_id


@router.get("")
def list_cargo(status: Optional[str] = None, params: ListParams = Depends(list_params), db: Session = Depends(get_db)):
    stations = station_index(db)
    rows = [cargo_view(c, stations) for c in db.execute(select(CargoItem).order_by(CargoItem.id)).scalars()]
    if status:
        rows = [r for r in rows if r["status"] == status]
    rows = search(rows, params.q, ("description", "manifest_id", "origin", "destination"))
    return paginate(rows, params, sortable=SORTABLE, default_sort="created_at")


@router.get("/{cargo_id}")
def get_cargo(cargo_id: str, db: Session = Depends(get_db)):
    return {"data": cargo_view(get_or_404(db, CargoItem, cargo_id, "Cargo record"), station_index(db))}


@router.post("", status_code=201)
def create_cargo(body: CargoBody, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    values = body.model_dump()
    require_fields(values, ("manifest_id", "description", "status", "origin", "destination"),
                   "manifest_id, description, status, origin and destination are required.")
    item = CargoItem(
        id=next_id(db, CargoItem, "CGO"),
        name=values["description"].strip(),
        category="general",
        weight_kg=_weight(values["weight_kg"]),
        manifest_id=_unique_manifest(db, values["manifest_id"]),
        origin=values["origin"].strip(),
        destination=values["destination"].strip(),
        status=_status(values["status"]),
    )
    db.add(item)
    record_audit(db, user, "create", "cargo", item.id, f'Created cargo manifest "{item.manifest_id}"')
    db.commit()
    return {"data": cargo_view(item, station_index(db))}


@router.patch("/{cargo_id}")
def update_cargo(cargo_id: str, body: CargoBody, db: Session = Depends(get_db), user: Principal = Depends(current_user)):
    item = get_or_404(db, CargoItem, cargo_id, "Cargo record")
    changes = body.model_dump(exclude_unset=True)
    for required in ("manifest_id", "description", "status", "origin", "destination"):
        if required in changes and changes[required] in (None, ""):
            raise HTTPException(status_code=400, detail=f"{required} cannot be empty.")

    if "manifest_id" in changes:
        item.manifest_id = _unique_manifest(db, changes["manifest_id"], own_id=item.id)
    if "description" in changes:
        item.name = changes["description"].strip()
    if "status" in changes:
        item.status = _status(changes["status"])
    if "origin" in changes:
        item.origin = changes["origin"].strip()
    if "destination" in changes:
        item.destination = changes["destination"].strip()
    if "weight_kg" in changes:
        item.weight_kg = _weight(changes["weight_kg"])

    view = cargo_view(item, station_index(db))
    record_audit(db, user, "update", "cargo", item.id, f'Updated cargo manifest "{view["manifest_id"]}" ({view["status"]})')
    db.commit()
    return {"data": cargo_view(item, station_index(db))}


@router.delete("/{cargo_id}", status_code=204)
def delete_cargo(cargo_id: str, db: Session = Depends(get_db), user: Principal = Depends(require_admin)):
    item = get_or_404(db, CargoItem, cargo_id, "Cargo record")
    label = cargo_view(item, station_index(db))["manifest_id"]
    db.delete(item)
    record_audit(db, user, "delete", "cargo", cargo_id, f'Deleted cargo manifest "{label}"')
    db.commit()
    return Response(status_code=204)
