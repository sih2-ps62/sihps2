# OWNER: (feature) polar day/night
from datetime import date

import daynight


def test_south_pole_flips_between_polar_night_and_polar_day():
    assert daynight.day_night_state(-90, date(2026, 6, 21)) == "polar_night"  # Antarctic winter
    assert daynight.day_night_state(-90, date(2026, 12, 21)) == "polar_day"  # Antarctic midnight sun


def test_equator_is_always_normal():
    assert daynight.day_night_state(0, date(2026, 6, 21)) == "normal"
    assert daynight.day_night_state(0, date(2026, 12, 21)) == "normal"


def test_mid_latitude_is_always_normal():
    assert daynight.day_night_state(45, date(2026, 6, 21)) == "normal"
    assert daynight.day_night_state(-45, date(2026, 12, 21)) == "normal"


def test_high_arctic_flips_with_the_seasons():
    assert daynight.day_night_state(82.5, date(2026, 6, 21)) == "polar_day"  # Arctic midnight sun
    assert daynight.day_night_state(82.5, date(2026, 12, 21)) == "polar_night"  # Arctic winter
