# OWNER: (feature) smart resupply
# Cross-references low-stock items against surplus of the exact same item at other stations, ranked by real
# station-to-station distance (emissions.py's haversine) — turns "we're low on X" into "move N units of X from
# station A, Y km away" instead of leaving that judgment call entirely to the duty officer.
from dataclasses import dataclass

from emissions import haversine_km

SURPLUS_MARGIN = 1.5  # a station counts as having surplus once its stock is 50% above its own threshold


@dataclass(frozen=True)
class StockRow:
    station_id: str
    station_name: str
    name: str
    quantity: int
    threshold: int
    unit: str
    lat: float
    lng: float
    weather_code: str


def is_surplus(row: StockRow) -> bool:
    return row.threshold > 0 and row.quantity > row.threshold * SURPLUS_MARGIN


def is_short(row: StockRow) -> bool:
    return row.quantity <= row.threshold


def suggest_transfers(rows: list[StockRow], *, limit_per_item: int = 1) -> list[dict]:
    """One suggestion per low-stock row (its nearest real surplus match of the same item), nearest overall first."""
    suggestions = []
    for low in rows:
        if not is_short(low):
            continue
        candidates = [r for r in rows if r.name == low.name and r.station_id != low.station_id and is_surplus(r)]
        candidates.sort(key=lambda r: haversine_km(low.lat, low.lng, r.lat, r.lng))
        for source in candidates[:limit_per_item]:
            deficit = low.threshold - low.quantity
            available = source.quantity - source.threshold
            move_qty = min(max(deficit, 1), available)
            distance = round(haversine_km(low.lat, low.lng, source.lat, source.lng), 1)
            suggestions.append({
                "item": low.name,
                "unit": low.unit,
                "quantity": move_qty,
                "from_station_id": source.station_id,
                "from_station_name": source.station_name,
                "from_weather_code": source.weather_code,
                "to_station_id": low.station_id,
                "to_station_name": low.station_name,
                "distance_km": distance,
            })
    suggestions.sort(key=lambda s: s["distance_km"])
    return suggestions
