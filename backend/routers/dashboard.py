from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from rules import mission_readiness, now, is_cargo_delayed

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/summary", response_model=schemas.DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db)):
    readiness = mission_readiness(db)

    active_expeditions = db.query(models.Expedition).filter(
        models.Expedition.status == "in_progress"
    ).count()
    personnel_in_field = db.query(models.Personnel).filter(
        models.Personnel.status.in_(["in_transit", "on_expedition"])
    ).count()
    cargo_in_transit = db.query(models.CargoItem).filter(
        models.CargoItem.status == "in_transit"
    ).count()
    low_stock_alerts = db.query(models.InventoryItem).filter(
        models.InventoryItem.status == "low"
    ).count()
    open_emergencies = db.query(models.EmergencyIncident).filter(
        models.EmergencyIncident.status != "resolved"
    ).count()
    overdue_checkins = db.query(models.Personnel).filter(
        models.Personnel.status == "overdue"
    ).count()
    assets = db.query(models.Asset).all()
    assets_operational_pct = 100 if not assets else round(
        100 * sum(1 for a in assets if a.status == "operational") / len(assets)
    )

    return schemas.DashboardSummary(
        active_expeditions=active_expeditions,
        personnel_in_field=personnel_in_field,
        cargo_in_transit=cargo_in_transit,
        low_stock_alerts=low_stock_alerts,
        open_emergencies=open_emergencies,
        overdue_checkins=overdue_checkins,
        assets_operational_pct=assets_operational_pct,
        mission_readiness=readiness,
        generated_at=now().isoformat(),
    )
