# OWNER: Param
# GET /dashboard/summary — read-only aggregation across every module's tables.
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from db import get_db, utcnow
from models.asset import Asset
from models.cargo import CargoItem
from models.emergency import EmergencyIncident
from models.expedition import Expedition
from models.inventory import InventoryItem
from models.personnel import Personnel
from rules.escalation import evaluate_escalation
from rules.overdue_checkin import evaluate_overdue
from schemas import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _count(db: Session, model, *conditions) -> int:
    return db.execute(select(func.count()).select_from(model).where(*conditions)).scalar_one()


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db)):
    evaluate_overdue(db)
    evaluate_escalation(db)
    return DashboardSummary(
        active_expeditions=_count(db, Expedition, Expedition.status == "in_progress"),
        cargo_in_transit=_count(db, CargoItem, CargoItem.status == "in_transit"),
        low_stock_items=_count(db, InventoryItem, InventoryItem.status == "low"),
        overdue_personnel=_count(db, Personnel, Personnel.status == "overdue"),
        active_emergencies=_count(db, EmergencyIncident, EmergencyIncident.status != "resolved"),
        escalated_emergencies=_count(
            db, EmergencyIncident, EmergencyIncident.status != "resolved", EmergencyIncident.escalated_at.is_not(None)
        ),
        maintenance_due_assets=_count(db, Asset, Asset.condition == "needs_maintenance"),
        generated_at=utcnow(),
    )
