# OWNER: integration (Day 2-3)
# GET /api/stats - the numbers behind every stat strip in the frontend.
# The rules run first (overdue check-in, escalation) so the counts are current without a background worker.
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db, utcnow
from models.cargo import CargoItem
from models.emergency import EmergencyIncident
from models.expedition import Expedition
from models.inventory import InventoryItem
from models.personnel import Personnel
from models.station import Station
from rules.escalation import evaluate_escalation
from rules.overdue_checkin import evaluate_overdue
from ui_api.security import current_user
from ui_api.views import is_low_stock, personnel_ui_status

router = APIRouter(prefix="/stats", tags=["ui: stats"], dependencies=[Depends(current_user)])


def _all(db: Session, model) -> list:
    return db.execute(select(model)).scalars().all()


def response_hours(incident: EmergencyIncident) -> float:
    return (incident.resolved_at - incident.timestamp).total_seconds() / 3600


@router.get("")
def get_stats(db: Session = Depends(get_db)):
    evaluate_overdue(db)
    evaluate_escalation(db)
    now = utcnow()

    expeditions = _all(db, Expedition)
    cargo = _all(db, CargoItem)
    inventory = _all(db, InventoryItem)
    people = [personnel_ui_status(p) for p in _all(db, Personnel)]
    incidents = _all(db, EmergencyIncident)
    station_count = len(_all(db, Station))

    open_incidents = [i for i in incidents if i.status != "resolved"]
    timed = [response_hours(i) for i in incidents if i.resolved_at]
    recent_cutoff = now - timedelta(days=30)

    return {
        "dashboard": {
            "activeExpeditions": sum(e.status == "in_progress" for e in expeditions),
            "personnelInField": people.count("In Field"),
            "lowStockAlerts": sum(is_low_stock(i) for i in inventory),
            "assetsNeedingMaintenance": sum(bool(i.needs_maintenance) for i in inventory),
            "openEmergencies": len(open_incidents),
        },
        "cargo": {
            "totalShipments": len(cargo),
            "inTransit": sum(c.status == "in_transit" for c in cargo),
            "delivered": sum(c.status == "delivered" for c in cargo),
            "delayed": sum(c.status == "delayed" for c in cargo),
        },
        "inventory": {
            "totalSkus": len(inventory),
            "lowStock": sum(is_low_stock(i) and i.quantity > 0 for i in inventory),
            "outOfStock": sum(i.quantity == 0 for i in inventory),
            "categories": len({i.category for i in inventory}),
        },
        "personnel": {
            "totalStaff": len(people),
            "inField": people.count("In Field"),
            "onLeave": people.count("On Leave"),
            "stations": station_count,
        },
        "emergency": {
            "openEmergencies": len(open_incidents),
            "avgResponseTimeHours": round(sum(timed) / len(timed), 1) if timed else None,
            "resolvedLast30d": sum(1 for i in incidents if i.status == "resolved" and i.resolved_at
                                   and i.resolved_at >= recent_cutoff),
        },
    }
