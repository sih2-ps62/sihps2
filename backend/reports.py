import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from rules import mission_readiness, build_alerts, now

NAVY = colors.HexColor("#0b1220")
ACCENT = colors.HexColor("#4f46e5")


def build_situation_report(db) -> bytes:
    readiness = mission_readiness(db)
    alerts = build_alerts(db)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleBig", parent=styles["Title"], textColor=NAVY)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], textColor=ACCENT)
    body = styles["BodyText"]

    elements = []
    elements.append(Paragraph("PolarOps — Situation Report", title_style))
    elements.append(Paragraph(f"Generated: {now().strftime('%Y-%m-%d %H:%M UTC')}", body))
    elements.append(Spacer(1, 10 * mm))

    elements.append(Paragraph("Mission Readiness", h2))
    readiness_data = [["Module", "Readiness %"]] + [
        [k.capitalize(), f"{v}%"] for k, v in readiness.items()
    ]
    t = Table(readiness_data, colWidths=[100 * mm, 40 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 10 * mm))

    elements.append(Paragraph(f"Open Risks ({len(alerts)})", h2))
    if not alerts:
        elements.append(Paragraph("No active risks at report time.", body))
    else:
        risk_data = [["Severity", "Type", "Message"]] + [
            [a["severity"].upper(), a["type"], a["message"]] for a in alerts
        ]
        rt = Table(risk_data, colWidths=[22 * mm, 32 * mm, 106 * mm])
        rt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
        ]))
        elements.append(rt)

    elements.append(Spacer(1, 10 * mm))
    elements.append(Paragraph(
        "This report reflects live operational data at generation time. Position feed and "
        "weather fields are simulated for this demo; all other figures are pulled directly "
        "from the operational database.",
        ParagraphStyle("Footnote", parent=styles["Italic"], fontSize=8, textColor=colors.grey),
    ))

    doc.build(elements)
    return buf.getvalue()
