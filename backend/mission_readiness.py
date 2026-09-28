# OWNER: (feature) mission readiness
# Mission Readiness Score - one 0-100 number per station, the inverse of a risk score: 100 is fully ready,
# 0 is critical. Fuses the same signals a duty officer already scans across four different screens (an open
# emergency, an overdue crew member, a low-stock item, today's weather) plus the global comms-risk reading into
# one glanceable number, colour-coded on the map and dashboard instead of making someone check each screen.
from rules.risk_score import weather_severity

CRITICAL_MAX = 40
WATCH_MAX = 70


def readiness_band(score: int) -> str:
    return "critical" if score < CRITICAL_MAX else "watch" if score < WATCH_MAX else "ready"


def compute_readiness(
    *,
    has_open_emergency: bool,
    overdue_or_emergency_count: int,
    has_low_stock: bool,
    weather_code: str,
    comms_risk_level: int,
) -> dict:
    """Pure function. Returns {readiness_score, readiness_band}."""
    penalty = 0
    penalty += 25 if has_open_emergency else 0
    penalty += min(overdue_or_emergency_count * 15, 30)
    penalty += 20 if has_low_stock else 0
    penalty += round(weather_severity(weather_code) * 15)
    penalty += comms_risk_level * 4
    score = max(0, 100 - penalty)
    return {"readiness_score": score, "readiness_band": readiness_band(score)}
