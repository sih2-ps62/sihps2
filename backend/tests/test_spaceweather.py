# OWNER: (feature) space weather / comms risk
import spaceweather


def test_worst_of_two_scales_picks_the_higher_number():
    assert spaceweather._worst("1", "3") == (3, "strong")
    assert spaceweather._worst(None, "2") == (2, "moderate")
    assert spaceweather._worst(None, None) == (0, "none")


def test_fetch_returns_none_on_network_failure(monkeypatch):
    def boom(*args, **kwargs):
        raise spaceweather.httpx.ConnectError("no network")

    monkeypatch.setattr(spaceweather.httpx, "get", boom)
    assert spaceweather.fetch_comms_risk() is None


def test_current_comms_risk_caches_a_successful_reading(monkeypatch):
    spaceweather._cache["reading"] = None
    spaceweather._cache["fetched_at"] = 0.0
    calls = []
    monkeypatch.setattr(spaceweather, "fetch_comms_risk",
                        lambda: calls.append(1) or {"level": 3, "label": "strong"})

    first = spaceweather.current_comms_risk()
    second = spaceweather.current_comms_risk()  # within the cache window, should not re-fetch

    assert first == second == {"level": 3, "label": "strong"}
    assert len(calls) == 1


def test_current_comms_risk_falls_back_to_quiet_when_never_reachable(monkeypatch):
    spaceweather._cache["reading"] = None
    spaceweather._cache["fetched_at"] = 0.0
    monkeypatch.setattr(spaceweather, "fetch_comms_risk", lambda: None)

    reading = spaceweather.current_comms_risk()

    assert reading["level"] == 0 and reading["label"] == "none"
