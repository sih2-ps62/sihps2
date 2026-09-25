# OWNER: Maisha
# Route Risk Score — called by GET /expeditions/{id}/risk
#   risk  = weather_severity * 30            (0-1 scale x 30)
#   risk += min(waypoint_count * 5, 20)      (capped)
#   risk += 20 if any overdue personnel on route
#   risk += 10 if winter
#   score = min(round(risk), 100);  band: <34 low, <67 medium, else high
from datetime import date

WEATHER_SEVERITY = {
    "clear": 0.0,
    "cloudy": 0.2,
    "snow": 0.4,
    "high_wind": 0.7,
    "blizzard": 1.0,
}
WINTER_MONTHS = {4, 5, 6, 7, 8, 9, 10}  # Antarctic wintering season, Apr-Oct


def weather_severity(weather_code: str) -> float:
    return WEATHER_SEVERITY.get(weather_code, 0.0)


def worst_weather(weather_codes) -> str:
    """The most severe weather along a route; 'clear' for an empty route."""
    return max(weather_codes, key=weather_severity, default="clear")


def season_for(on: date) -> str:
    return "winter" if on.month in WINTER_MONTHS else "summer"


def risk_band(score: int) -> str:
    return "low" if score < 34 else "medium" if score < 67 else "high"


def compute_risk(
    weather_code: str,
    waypoint_count: int,
    any_overdue_personnel_on_route: bool,
    season: str,
) -> dict:
    """Pure function. Returns {risk_score, risk_band, risk_factors} — factors sum to the score."""
    contributions = [
        ("weather_severity", round(weather_severity(weather_code) * 30)),
        ("waypoint_count", min(waypoint_count * 5, 20)),
        ("overdue_personnel_on_route", 20 if any_overdue_personnel_on_route else 0),
        ("winter_season", 10 if season == "winter" else 0),
    ]
    factors = [{"factor": name, "contribution": value} for name, value in contributions if value]
    score = min(sum(value for _, value in contributions), 100)
    return {"risk_score": score, "risk_band": risk_band(score), "risk_factors": factors}
