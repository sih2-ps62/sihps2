# OWNER: (feature) mission readiness
from mission_readiness import compute_readiness, readiness_band


def _baseline(**overrides):
    values = dict(has_open_emergency=False, overdue_or_emergency_count=0, has_low_stock=False,
                 weather_code="clear", comms_risk_level=0)
    values.update(overrides)
    return compute_readiness(**values)


def test_nothing_wrong_is_fully_ready():
    result = _baseline()
    assert result == {"readiness_score": 100, "readiness_band": "ready"}


def test_open_emergency_is_the_single_biggest_penalty():
    result = _baseline(has_open_emergency=True)
    assert result["readiness_score"] == 75


def test_overdue_count_caps_at_two_people():
    two = _baseline(overdue_or_emergency_count=2)["readiness_score"]
    five = _baseline(overdue_or_emergency_count=5)["readiness_score"]
    assert two == five == 70


def test_severe_weather_and_comms_storm_stack():
    result = _baseline(weather_code="blizzard", comms_risk_level=5)
    assert result["readiness_score"] == 100 - 15 - 20  # weather_severity(blizzard)=1.0*15, comms 5*4


def test_everything_at_once_floors_at_zero():
    result = _baseline(has_open_emergency=True, overdue_or_emergency_count=5, has_low_stock=True,
                       weather_code="blizzard", comms_risk_level=5)
    assert result["readiness_score"] == 0
    assert result["readiness_band"] == "critical"


def test_band_boundaries():
    assert [readiness_band(s) for s in (0, 39, 40, 69, 70, 100)] == \
        ["critical", "critical", "watch", "watch", "ready", "ready"]
