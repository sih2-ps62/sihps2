from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from rules import build_alerts, mission_readiness, is_cargo_delayed

router = APIRouter(tags=["assistant"])

SUGGESTIONS = [
    "What are the top risks?",
    "Which cargo needs attention?",
    "Where's the overdue personnel?",
    "Any open emergencies?",
    "What's low on stock?",
    "How are the assets doing?",
    "What's the mission readiness?",
]


@router.post("/assistant/query", response_model=schemas.AssistantQueryOut)
def assistant_query(payload: schemas.AssistantQueryIn, db: Session = Depends(get_db)):
    q = payload.question.lower()

    if any(k in q for k in ["top risk", "risks", "risk queue", "what's wrong", "problems"]):
        alerts = build_alerts(db)[:5]
        if not alerts:
            return schemas.AssistantQueryOut(answer="No active risks right now — every module is green.", data={"alerts": []})
        lines = [f"{i+1}. [{a['severity'].upper()}] {a['message']}" for i, a in enumerate(alerts)]
        return schemas.AssistantQueryOut(answer="Top risks right now:\n" + "\n".join(lines), data={"alerts": alerts})

    if "cargo" in q and any(k in q for k in ["attention", "delay", "risk", "late"]):
        cargo = db.query(models.CargoItem).all()
        flagged = []
        for c in cargo:
            delayed, hours = is_cargo_delayed(c)
            if delayed:
                flagged.append({"id": c.id, "name": c.name, "delayed_hours": hours})
        if not flagged:
            return schemas.AssistantQueryOut(answer="No cargo is currently delayed.", data={"cargo": []})
        lines = [f"- {c['name']} ({c['id']}): delayed {c['delayed_hours']}h" for c in flagged]
        return schemas.AssistantQueryOut(answer="Cargo needing attention:\n" + "\n".join(lines), data={"cargo": flagged})

    if "overdue" in q or ("personnel" in q and "where" in q):
        overdue = db.query(models.Personnel).filter(models.Personnel.status == "overdue").all()
        if not overdue:
            return schemas.AssistantQueryOut(answer="No personnel are overdue on check-in.", data={"personnel": []})
        lines = [f"- {p.name} ({p.role}) at {p.current_station_id}" for p in overdue]
        return schemas.AssistantQueryOut(answer="Overdue personnel:\n" + "\n".join(lines),
                                          data={"personnel": [p.id for p in overdue]})

    if "emergency" in q or "incident" in q:
        open_incidents = db.query(models.EmergencyIncident).filter(
            models.EmergencyIncident.status != "resolved"
        ).all()
        if not open_incidents:
            return schemas.AssistantQueryOut(answer="No open emergencies.", data={"incidents": []})
        lines = [f"- [{i.severity.upper()}] {i.type} at {i.station_id} ({i.status})" for i in open_incidents]
        return schemas.AssistantQueryOut(answer="Open emergencies:\n" + "\n".join(lines),
                                          data={"incidents": [i.id for i in open_incidents]})

    if any(k in q for k in ["stock", "inventory", "low on"]):
        low = db.query(models.InventoryItem).filter(models.InventoryItem.status == "low").all()
        if not low:
            return schemas.AssistantQueryOut(answer="Inventory is healthy — nothing below threshold.", data={"inventory": []})
        lines = [f"- {i.name} at {i.station_id}: {i.quantity}{i.unit} (threshold {i.reorder_threshold})" for i in low]
        return schemas.AssistantQueryOut(answer="Low-stock items:\n" + "\n".join(lines),
                                          data={"inventory": [i.id for i in low]})

    if "asset" in q or "equipment" in q or "health" in q:
        assets = db.query(models.Asset).filter(models.Asset.status.in_(["warning", "critical"])).all()
        if not assets:
            return schemas.AssistantQueryOut(answer="All assets are operational.", data={"assets": []})
        lines = [f"- {a.name}: {a.health_pct:.0f}% ({a.status})" for a in assets]
        return schemas.AssistantQueryOut(answer="Assets needing attention:\n" + "\n".join(lines),
                                          data={"assets": [a.id for a in assets]})

    if "readiness" in q or "summary" in q or "status" in q:
        r = mission_readiness(db)
        return schemas.AssistantQueryOut(
            answer=f"Overall mission readiness is {r['overall']}% "
                   f"(personnel {r['personnel']}%, cargo {r['cargo']}%, inventory {r['inventory']}%, "
                   f"assets {r['assets']}%, emergency {r['emergency']}%).",
            data={"readiness": r},
        )

    return schemas.AssistantQueryOut(
        answer="I can only answer questions grounded in live operational data. Try: "
               + "; ".join(SUGGESTIONS),
        grounded=True,
        data={"suggestions": SUGGESTIONS},
    )
