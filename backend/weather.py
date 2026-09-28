# OWNER: (feature) live weather
# Real current weather for each station, replacing the seed data's fixed weather_code. Read by
# rules/risk_score.py through Station.weather_code, so nothing else needs to change to use it.
# Uses Open-Meteo (open-meteo.com) — free, no API key — and fails soft: any network problem just keeps
# the station's last-known weather_code instead of breaking the request that triggered the refresh.
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

import httpx

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
REQUEST_TIMEOUT = 3.0
CACHE_SECONDS = 900  # real weather doesn't change fast enough to refetch on every request

# WMO weather codes (open-meteo.com/en/docs) collapsed onto the four values rules/risk_score.py understands.
_SNOW_CODES = {71, 73, 75, 77, 85, 86}
_CLOUDY_CODES = {1, 2, 3, 45, 48}

_last_fetch: dict[str, float] = {}


def _map_conditions(wmo_code: int, wind_kmh: float) -> str:
    if wmo_code in _SNOW_CODES:
        return "blizzard" if wind_kmh >= 50 else "snow"
    if wind_kmh >= 45:
        return "high_wind"
    if wmo_code in _CLOUDY_CODES:
        return "cloudy"
    return "clear"


def fetch_live_weather_code(lat: float, lng: float) -> Optional[str]:
    """None on any failure — callers keep the station's existing weather_code rather than erroring."""
    try:
        response = httpx.get(OPEN_METEO_URL, timeout=REQUEST_TIMEOUT,
                             params={"latitude": lat, "longitude": lng, "current": "weather_code,wind_speed_10m"})
        response.raise_for_status()
        current = response.json()["current"]
        return _map_conditions(int(current["weather_code"]), float(current["wind_speed_10m"]))
    except (httpx.HTTPError, KeyError, ValueError, TypeError):
        return None


def refresh_stale_stations(db, stations) -> None:
    """Best-effort refresh of any station not checked within CACHE_SECONDS. Commits only if something changed,
    and a fetch failure still marks the station as checked so a down weather service can't stall every request."""
    now = time.monotonic()
    changed = False
    stale = []
    for station in stations:
        if now - _last_fetch.get(station.id, 0) < CACHE_SECONDS:
            continue
        _last_fetch[station.id] = now
        stale.append(station)
    # Network calls run concurrently; ORM objects and the session stay on this request's thread.
    # A first visit must not wait for twelve sequential weather timeouts.
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [(station, pool.submit(fetch_live_weather_code, station.lat, station.lng)) for station in stale]
        readings = [(station, future.result()) for station, future in futures]
    for station, code in readings:
        if code and code != station.weather_code:
            station.weather_code = code
            changed = True
    if changed:
        db.commit()


# ---------------------------------------------------------------- forecast (predictive risk trend)
FORECAST_DAYS = 3

_forecast_cache: dict[str, tuple[float, list[dict]]] = {}


def fetch_forecast_codes(lat: float, lng: float) -> Optional[list[dict]]:
    """Hourly weather_code out to FORECAST_DAYS, or None on failure. Same WMO mapping as the live reading, so a
    forecast hour and a current reading are directly comparable to rules/risk_score.py."""
    try:
        response = httpx.get(OPEN_METEO_URL, timeout=REQUEST_TIMEOUT, params={
            "latitude": lat, "longitude": lng,
            "hourly": "weather_code,wind_speed_10m", "forecast_days": FORECAST_DAYS,
        })
        response.raise_for_status()
        hourly = response.json()["hourly"]
        return [
            {"time": t, "code": _map_conditions(int(c), float(w))}
            for t, c, w in zip(hourly["time"], hourly["weather_code"], hourly["wind_speed_10m"])
        ]
    except (httpx.HTTPError, KeyError, ValueError, TypeError, IndexError):
        return None


def station_forecast(station) -> list[dict]:
    """Cached hourly forecast for one station; [] if the service has never been reachable for it."""
    now = time.monotonic()
    cached = _forecast_cache.get(station.id)
    if cached and now - cached[0] < CACHE_SECONDS:
        return cached[1]
    forecast = fetch_forecast_codes(station.lat, station.lng)
    if forecast is None:
        forecast = cached[1] if cached else []
    _forecast_cache[station.id] = (now, forecast)
    return forecast
