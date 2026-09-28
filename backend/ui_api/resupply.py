# OWNER: (feature) smart resupply
# GET /api/resupply-suggestions - ranked "move N units of X from station A" recommendations (resupply.py),
# built from live inventory levels and real station coordinates.
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from models.inventory import InventoryItem
from resupply import StockRow, suggest_transfers
from ui_api.security import current_user
from ui_api.views import station_index

router = APIRouter(prefix="/resupply-suggestions", tags=["ui: resupply"], dependencies=[Depends(current_user)])


@router.get("")
def get_resupply_suggestions(db: Session = Depends(get_db)):
    stations = station_index(db)
    rows = []
    for item in db.execute(select(InventoryItem)).scalars():
        station = stations.get(item.station_id) if item.station_id else None
        if station is None:
            continue  # no coordinates to route by
        rows.append(StockRow(station_id=station.id, station_name=station.name, name=item.name,
                             quantity=item.quantity, threshold=item.reorder_threshold, unit=item.unit,
                             lat=station.lat, lng=station.lng, weather_code=station.weather_code))
    return {"data": suggest_transfers(rows)}
