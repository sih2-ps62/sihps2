# OWNER: integration (Day 2-3)
# GET /api/analytics - the series behind the Analytics page charts.
from collections import Counter, defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from models.cargo import CargoItem
from models.emergency import EmergencyIncident
from models.expedition import Expedition
from models.inventory import InventoryItem
from models.personnel import Personnel
from rules.escalation import evaluate_escalation
from rules.overdue_checkin import evaluate_overdue
from ui_api.common import fmt_date
from ui_api.security import current_user
from ui_api.stats import response_hours
from ui_api.views import expedition_view, personnel_ui_status

router = APIRouter(prefix="/analytics", tags=["ui: analytics"], dependencies=[Depends(current_user)])


@router.get("")
def get_analytics(db: Session = Depends(get_db)):
    evaluate_overdue(db)
    evaluate_escalation(db)

    incidents = db.execute(select(EmergencyIncident)).scalars().all()
    reported = Counter(i.timestamp.date().isoformat() for i in incidents)
    resolved = sorted((i for i in incidents if i.resolved_at), key=lambda i: i.resolved_at)

    cargo_created = Counter(c.created_at.date().isoformat()
                            for c in db.execute(select(CargoItem)).scalars())

    expeditions = sorted(db.execute(select(Expedition)).scalars(), key=lambda e: e.start_date)
    timeline = []
    for exp in expeditions:
        view = expedition_view(exp)
        timeline.append({key: view[key] for key in ("id", "name", "status", "region", "start_date", "end_date")})

    people = Counter(personnel_ui_status(p) for p in db.execute(select(Personnel)).scalars())

    stock = defaultdict(lambda: {"quantity": 0, "items": 0})
    for item in db.execute(select(InventoryItem)).scalars():
        stock[item.category]["quantity"] += item.quantity
        stock[item.category]["items"] += 1

    return {
        "emergenciesByDay": [{"date": day, "count": n} for day, n in sorted(reported.items())],
        "responseTimeTrend": [{"date": fmt_date(i.resolved_at.date()), "hours": round(response_hours(i), 1)}
                              for i in resolved],
        "cargoByDay": [{"date": day, "count": n} for day, n in sorted(cargo_created.items())],
        "expeditionTimeline": timeline,
        "personnelBreakdown": [{"status": status, "count": n} for status, n in sorted(people.items())],
        "inventoryByCategory": [{"category": category, **totals} for category, totals in sorted(stock.items())],
    }
