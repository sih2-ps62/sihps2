# OWNER: (feature) space weather / comms risk
# Real geomagnetic and radio-blackout conditions from NOAA SWPC (services.swpc.noaa.gov) — free, no API key.
# HF radio (still the fallback comms path at remote polar stations) is disrupted by geomagnetic storms and solar
# radio blackouts, and both hit high-latitude stations hardest since the aurora ovals sit over Antarctica and the
# Arctic. This is one global reading, not per-station: space weather affects a whole hemisphere at once, which is
# also why it's exposed as its own endpoint instead of folded into a per-station field.
import time
from typing import Optional

import httpx

SCALES_URL = "https://services.swpc.noaa.gov/products/noaa-scales.json"
REQUEST_TIMEOUT = 3.0
CACHE_SECONDS = 900

_SCALE_LABELS = {"0": "none", "1": "minor", "2": "moderate", "3": "strong", "4": "severe", "5": "extreme"}

_cache: dict = {"reading": None, "fetched_at": 0.0}


def _worst(scale_a: Optional[str], scale_b: Optional[str]) -> tuple[int, str]:
    """Worse of two NOAA scale strings ('0'-'5' or None, when a forecast slot has no estimate yet)."""
    values = [int(s) for s in (scale_a, scale_b) if s is not None]
    top = max(values, default=0)
    return top, _SCALE_LABELS[str(top)]


def fetch_comms_risk() -> Optional[dict]:
    """Today's worst-of geomagnetic (G) / radio-blackout (R) scale, or None if NOAA can't be reached."""
    try:
        response = httpx.get(SCALES_URL, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        today = response.json()["0"]
        level, label = _worst(today["G"]["Scale"], today["R"]["Scale"])
        return {
            "level": level,
            "label": label,
            "geomagnetic_scale": today["G"]["Scale"],
            "geomagnetic_text": today["G"]["Text"],
            "radio_blackout_scale": today["R"]["Scale"],
            "radio_blackout_text": today["R"]["Text"],
        }
    except (httpx.HTTPError, KeyError, ValueError, TypeError):
        return None


def current_comms_risk() -> dict:
    """Cached for CACHE_SECONDS. Falls back to a 'none' reading (not an error) so a flaky feed never blocks
    a page — the very first call, before any successful fetch, also returns this quiet default."""
    now = time.monotonic()
    if _cache["reading"] is None or now - _cache["fetched_at"] >= CACHE_SECONDS:
        reading = fetch_comms_risk()
        if reading is not None:
            _cache["reading"] = reading
            _cache["fetched_at"] = now
        elif _cache["reading"] is None:
            _cache["reading"] = {"level": 0, "label": "none", "geomagnetic_scale": None, "geomagnetic_text": None,
                                  "radio_blackout_scale": None, "radio_blackout_text": None}
    return _cache["reading"]
