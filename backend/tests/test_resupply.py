# OWNER: (feature) smart resupply
from resupply import StockRow, is_short, is_surplus, suggest_transfers


def _row(station_id, name="Diesel fuel", quantity=100, threshold=50, lat=0, lng=0, weather="clear"):
    return StockRow(station_id=station_id, station_name=station_id.title(), name=name, quantity=quantity,
                    threshold=threshold, unit="L", lat=lat, lng=lng, weather_code=weather)


def test_is_short_and_is_surplus_boundaries():
    assert is_short(_row("a", quantity=50, threshold=50))  # equal counts as short
    assert not is_short(_row("a", quantity=51, threshold=50))
    assert not is_surplus(_row("a", quantity=75, threshold=50))  # exactly 1.5x is not yet surplus
    assert is_surplus(_row("a", quantity=76, threshold=50))
    assert not is_surplus(_row("a", quantity=1000, threshold=0))  # a zero threshold never counts as surplus


def test_suggests_the_nearest_surplus_station_for_a_shortage():
    short = _row("near-empty", quantity=10, threshold=50, lat=0, lng=0)
    far_surplus = _row("far", quantity=200, threshold=50, lat=0, lng=50)
    near_surplus = _row("near", quantity=200, threshold=50, lat=0, lng=1)

    suggestions = suggest_transfers([short, far_surplus, near_surplus])

    assert len(suggestions) == 1
    assert suggestions[0]["from_station_id"] == "near"
    assert suggestions[0]["to_station_id"] == "near-empty"


def test_move_quantity_is_capped_by_what_the_source_can_spare():
    short = _row("low", quantity=10, threshold=50)  # deficit of 40
    tight_surplus = _row("tight", quantity=80, threshold=50, lng=1)  # only 30 to spare

    suggestions = suggest_transfers([short, tight_surplus])

    assert suggestions[0]["quantity"] == 30


def test_no_suggestion_without_a_matching_surplus_elsewhere():
    short = _row("alone", quantity=10, threshold=50)
    different_item = _row("other", name="Satellite phones", quantity=200, threshold=50, lng=1)

    assert suggest_transfers([short, different_item]) == []


def test_stations_that_are_not_short_generate_no_suggestions():
    fine = _row("fine", quantity=60, threshold=50)
    surplus = _row("surplus", quantity=200, threshold=50, lng=1)

    assert suggest_transfers([fine, surplus]) == []
