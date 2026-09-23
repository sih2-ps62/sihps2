from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from database import get_db
from reports import build_situation_report

router = APIRouter(tags=["reports"])


@router.get("/reports/situation")
def situation_report(db: Session = Depends(get_db)):
    pdf_bytes = build_situation_report(db)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=polarops_situation_report.pdf"},
    )
