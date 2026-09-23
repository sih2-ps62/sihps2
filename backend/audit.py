from sqlalchemy.orm import Session
from models import AuditLogEntry
from ids import next_id


def log_action(db: Session, module: str, action_description: str, target_id: str = None,
               actor: str = "operator", status: str = "success"):
    entry = AuditLogEntry(
        id=next_id(db, "ALOG"),
        module=module,
        action_description=action_description,
        target_id=target_id,
        actor=actor,
        status=status,
    )
    db.add(entry)
    return entry
