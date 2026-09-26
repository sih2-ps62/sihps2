from datetime import date, datetime, timedelta

from rules.escalation import next_level, should_escalate
from rules.low_stock import compute_status
from rules.overdue_checkin import should_flag_overdue
from rules.risk_score import compute_risk, risk_band, season_for, worst_weather

NOW = datetime(2026, 9, 26, 12, 0)


# ------------------------------------------------------------------ risk score
def test_calm_summer_route_is_low():
    result = compute_risk("clear", 2, False, "summer")
    assert result["risk_score"] == 10
    assert result["risk_band"] == "low"
    assert result["risk_factors"] == [{"factor": "waypoint_count", "contribution": 10}]


def test_blizzard_winter_overdue_route_is_high():
    result = compute_risk("blizzard", 4, True, "winter")
    assert result["risk_score"] == 80  # 30 + 20 + 20 + 10
    assert result["risk_band"] == "high"


def test_changing_weather_moves_the_score():
    scores = [compute_risk(code, 2, False, "summer")["risk_score"]
              for code in ("clear", "cloudy", "snow", "high_wind", "blizzard")]
    assert scores == sorted(scores) and len(set(scores)) == 5


def test_waypoint_contribution_is_capped_at_20():
    assert compute_risk("clear", 4, False, "summer")["risk_score"] == 20
    assert compute_risk("clear", 40, False, "summer")["risk_score"] == 20


def test_band_boundaries():
    assert [risk_band(s) for s in (0, 33, 34, 66, 67, 100)] == ["low", "low", "medium", "medium", "high", "high"]


def test_factors_sum_to_score_and_zero_factors_are_omitted():
    result = compute_risk("snow", 3, True, "winter")
    assert sum(f["contribution"] for f in result["risk_factors"]) == result["risk_score"]
    assert all(f["contribution"] > 0 for f in result["risk_factors"])


def test_unknown_weather_counts_as_clear():
    assert compute_risk("mystery", 0, False, "summer")["risk_score"] == 0


def test_worst_weather_and_season():
    assert worst_weather(["clear", "blizzard", "snow"]) == "blizzard"
    assert worst_weather([]) == "clear"
    assert season_for(date(2026, 7, 1)) == "winter"
    assert season_for(date(2026, 12, 1)) == "summer"


# ------------------------------------------------------------------ low stock
def test_low_stock_boundary():
    assert compute_status(9, 10) == "low"
    assert compute_status(10, 10) == "ok"
    assert compute_status(0, 0) == "ok"


# ------------------------------------------------------------------ overdue check-in
def test_overdue_after_six_hours_only():
    assert should_flag_overdue("on_expedition", NOW - timedelta(hours=6, minutes=1), NOW)
    assert not should_flag_overdue("on_expedition", NOW - timedelta(hours=6), NOW)
    assert not should_flag_overdue("on_expedition", NOW - timedelta(hours=1), NOW)


def test_overdue_skips_already_overdue_and_emergency():
    stale = NOW - timedelta(hours=10)
    assert not should_flag_overdue("overdue", stale, NOW)
    assert not should_flag_overdue("emergency", stale, NOW)


def test_overdue_skips_people_on_leave():
    assert not should_flag_overdue("on_leave", NOW - timedelta(days=5), NOW)


# ------------------------------------------------------------------ escalation
def test_next_level_caps_at_high():
    assert [next_level(s) for s in ("low", "medium", "high")] == ["medium", "high", "high"]


def test_open_incident_escalates_after_two_hours():
    assert should_escalate("open", "low", NOW - timedelta(hours=2, minutes=1), None, NOW)
    assert not should_escalate("open", "low", NOW - timedelta(hours=1), None, NOW)


def test_only_open_and_non_high_incidents_escalate():
    old = NOW - timedelta(hours=5)
    assert not should_escalate("responding", "low", old, None, NOW)
    assert not should_escalate("resolved", "low", old, None, NOW)
    assert not should_escalate("open", "high", old, None, NOW)


def test_escalation_window_restarts_from_last_escalation():
    old = NOW - timedelta(hours=5)
    assert not should_escalate("open", "medium", old, NOW - timedelta(minutes=5), NOW)
    assert should_escalate("open", "medium", old, NOW - timedelta(hours=3), NOW)
