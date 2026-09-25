# OWNER: Param
# SQLite database connection, session setup and small helpers shared by every router.
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent
DATABASE_URL = os.getenv("POLAROPS_DB_URL", f"sqlite:///{BASE_DIR / 'polarops.db'}")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

ID_WIDTH = {"EXP": 4, "WPT": 4, "CGO": 4, "INV": 4, "AST": 4, "PER": 3, "INC": 4}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    import models  # noqa: F401  (registers every table on Base.metadata)

    Base.metadata.create_all(engine)


def utcnow() -> datetime:
    """Naive UTC 'now' — SQLite stores naive datetimes; the API serialises them with a Z."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_utc_naive(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def next_id(db: Session, model, prefix: str) -> str:
    """Next sequential id like EXP-0004. Ignores non-numeric ids such as STN-BHARATI."""
    top = 0
    for existing in db.execute(select(model.id).where(model.id.like(f"{prefix}-%"))).scalars():
        suffix = existing[len(prefix) + 1:]
        if suffix.isdigit():
            top = max(top, int(suffix))
    return f"{prefix}-{top + 1:0{ID_WIDTH.get(prefix, 4)}d}"


def get_or_404(db: Session, model, pk: str, label: str):
    row = db.get(model, pk)
    if row is None:
        raise HTTPException(status_code=404, detail=f"{label} {pk} not found")
    return row


def check_ref(db: Session, model, pk, field: str):
    """Validate a foreign-key style field from a request body. None passes through."""
    if pk is None:
        return None
    if db.get(model, pk) is None:
        raise HTTPException(status_code=400, detail=f"Unknown {field}: {pk}")
    return pk
