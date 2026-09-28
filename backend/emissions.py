# OWNER: (feature) environmental footprint
# Estimated CO2 footprint of moving an expedition's cargo along its real route — station-to-station distance
# from real coordinates (haversine), times the cargo weight actually assigned to that expedition, times a
# standard logistics emission factor. NCPOR operates under the Antarctic Treaty's environmental protocols, so
# the cost of a resupply run is a real operational number here, not just an analytics curiosity.
import math

EARTH_RADIUS_KM = 6371.0
# kg CO2 per tonne-km — a blended estimate for small-aircraft / icebreaker polar resupply, which runs higher
# than road or rail freight because polar logistics has no cheaper alternative. Stated here as a named,
# adjustable assumption rather than baked into the arithmetic, so it can be swapped for a station-specific or
# transport-mode-specific factor later without touching the callers.
EMISSION_FACTOR_KG_PER_TONNE_KM = 2.5


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def route_distance_km(stations: list) -> float:
    """Total distance along an ordered list of objects with .lat/.lng; 0 for fewer than two stations."""
    return sum(haversine_km(a.lat, a.lng, b.lat, b.lng) for a, b in zip(stations, stations[1:]))


def estimate_footprint_kg(total_weight_kg: float, distance_km: float) -> float:
    return round((total_weight_kg / 1000) * distance_km * EMISSION_FACTOR_KG_PER_TONNE_KM, 1)
