from sqlalchemy.orm import Session
from models import Counter

PREFIX_WIDTH = {
    "EXP": 4, "CGO": 4, "INV": 4, "PER": 3, "INC": 4,
    "AST": 3, "ALOG": 5, "WPT": 4, "STN": 3,
}


def next_id(db: Session, prefix: str) -> str:
    width = PREFIX_WIDTH.get(prefix, 4)
    counter = db.get(Counter, prefix)
    if counter is None:
        counter = Counter(prefix=prefix, value=0)
        db.add(counter)
    counter.value += 1
    db.flush()
    return f"{prefix}-{counter.value:0{width}d}"
