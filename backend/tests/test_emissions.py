# OWNER: (feature) environmental footprint
from types import SimpleNamespace

import emissions


def test_haversine_is_zero_for_the_same_point():
    assert emissions.haversine_km(-90, 0, -90, 0) == 0


def test_haversine_is_symmetric():
    a = emissions.haversine_km(-77.85, 166.67, -90, 0)
    b = emissions.haversine_km(-90, 0, -77.85, 166.67)
    assert round(a, 6) == round(b, 6)


def test_haversine_one_degree_of_longitude_at_the_equator_is_about_111_km():
    distance = emissions.haversine_km(0, 0, 0, 1)
    assert 110 < distance < 112


def test_route_distance_sums_consecutive_legs():
    a = SimpleNamespace(lat=0, lng=0)
    b = SimpleNamespace(lat=0, lng=1)
    c = SimpleNamespace(lat=0, lng=2)
    leg = emissions.haversine_km(0, 0, 0, 1)
    assert round(emissions.route_distance_km([a, b, c]), 6) == round(leg * 2, 6)


def test_route_distance_is_zero_for_fewer_than_two_stations():
    assert emissions.route_distance_km([]) == 0
    assert emissions.route_distance_km([SimpleNamespace(lat=0, lng=0)]) == 0


def test_estimate_footprint_scales_with_weight_and_distance():
    # 2000 kg (2 tonnes) over 100 km at 2.5 kg CO2/tonne-km = 2 * 100 * 2.5 = 500 kg
    assert emissions.estimate_footprint_kg(2000, 100) == 500.0
    assert emissions.estimate_footprint_kg(0, 100) == 0.0
    assert emissions.estimate_footprint_kg(1000, 0) == 0.0
