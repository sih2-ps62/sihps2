# OWNER: (feature) polar day/night
# Whether a station is in continuous daylight ("midnight sun"), continuous darkness ("polar night"), or a
# normal day/night cycle right now — genuinely a polar-specific condition, not a generic logistics detail.
# Pure astronomy: the sun's position is fully determined by date and latitude, no external service needed.
import math
from datetime import date


def solar_declination(day_of_year: int) -> float:
    """Degrees. A standard approximation, accurate enough to place a date within days of a polar sunrise/set."""
    return 23.44 * math.sin(math.radians(360 / 365 * (day_of_year - 81)))


def day_night_state(lat: float, on: date) -> str:
    """'polar_day' (sun never sets), 'polar_night' (sun never rises), or 'normal' (has both) for this date."""
    declination = solar_declination(on.timetuple().tm_yday)
    value = -math.tan(math.radians(lat)) * math.tan(math.radians(declination))
    if value > 1:
        return "polar_night"
    if value < -1:
        return "polar_day"
    return "normal"
