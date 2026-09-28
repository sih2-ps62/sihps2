# OWNER: (feature) live weather
from types import SimpleNamespace

import weather


def test_snow_becomes_blizzard_above_the_wind_threshold():
    assert weather._map_conditions(73, 20) == "snow"
    assert weather._map_conditions(73, 55) == "blizzard"


def test_strong_wind_without_snow_is_high_wind():
    assert weather._map_conditions(1, 50) == "high_wind"


def test_cloudy_and_clear_fall_through():
    assert weather._map_conditions(2, 5) == "cloudy"
    assert weather._map_conditions(0, 5) == "clear"


def test_fetch_returns_none_on_network_failure(monkeypatch):
    def boom(*args, **kwargs):
        raise weather.httpx.ConnectError("no network")

    monkeypatch.setattr(weather.httpx, "get", boom)
    assert weather.fetch_live_weather_code(-90, 0) is None


def test_refresh_updates_a_changed_station_and_commits(monkeypatch):
    weather._last_fetch.clear()
    monkeypatch.setattr(weather, "fetch_live_weather_code", lambda lat, lng: "blizzard")
    station = SimpleNamespace(id="STN-TEST", lat=-90, lng=0, weather_code="clear")
    committed = []
    db = SimpleNamespace(commit=lambda: committed.append(True))

    weather.refresh_stale_stations(db, [station])

    assert station.weather_code == "blizzard"
    assert committed == [True]


def test_refresh_skips_a_station_checked_within_the_cache_window(monkeypatch):
    weather._last_fetch.clear()
    calls = []
    monkeypatch.setattr(weather, "fetch_live_weather_code", lambda lat, lng: calls.append(1) or "snow")
    station = SimpleNamespace(id="STN-TEST-2", lat=-90, lng=0, weather_code="clear")
    db = SimpleNamespace(commit=lambda: None)

    weather.refresh_stale_stations(db, [station])
    weather.refresh_stale_stations(db, [station])  # second call lands inside the 15-minute cache window

    assert len(calls) == 1


def test_refresh_does_not_commit_when_nothing_changed(monkeypatch):
    weather._last_fetch.clear()
    monkeypatch.setattr(weather, "fetch_live_weather_code", lambda lat, lng: None)
    station = SimpleNamespace(id="STN-TEST-3", lat=-90, lng=0, weather_code="clear")
    committed = []
    db = SimpleNamespace(commit=lambda: committed.append(True))

    weather.refresh_stale_stations(db, [station])

    assert station.weather_code == "clear"
    assert committed == []


def test_forecast_fetch_returns_none_on_network_failure(monkeypatch):
    def boom(*args, **kwargs):
        raise weather.httpx.ConnectError("no network")

    monkeypatch.setattr(weather.httpx, "get", boom)
    assert weather.fetch_forecast_codes(-90, 0) is None


def test_station_forecast_caches_and_falls_back_to_the_previous_value(monkeypatch):
    weather._forecast_cache.clear()
    calls = []

    def fake_fetch(lat, lng):
        calls.append(1)
        return None if len(calls) > 1 else [{"time": "2026-01-01T00:00", "code": "snow"}]

    monkeypatch.setattr(weather, "fetch_forecast_codes", fake_fetch)
    station = SimpleNamespace(id="STN-FORECAST", lat=-90, lng=0)

    first = weather.station_forecast(station)
    assert first == [{"time": "2026-01-01T00:00", "code": "snow"}]

    weather._forecast_cache["STN-FORECAST"] = (0.0, first)  # force the cache stale without waiting 15 minutes
    second = weather.station_forecast(station)  # fetch fails this time — keeps the last-known forecast
    assert second == first
    assert len(calls) == 2
