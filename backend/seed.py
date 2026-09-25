# OWNER: Param
# Seeds the database with demo data (wipes everything first).
# Stations: Bharati (base), Maitri (base), one resupply vessel (ship), two field camps
# Run: python seed.py
from datetime import date, datetime, timedelta

from db import Base, SessionLocal, engine, utcnow
from models import (Asset, CargoItem, EmergencyIncident, Expedition, InventoryItem, Personnel, Station,
                    Waypoint)
from rules.low_stock import compute_status


def seed(now: datetime | None = None):
    now = now or utcnow()
    today = now.date()

    def ago(**delta) -> datetime:
        return now - timedelta(**delta)

    def at(days: int, hour: int) -> datetime:
        day = today + timedelta(days=days)
        return datetime(day.year, day.month, day.day, hour)

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    stations = [
        Station(id="STN-BHARATI", name="Bharati Research Station", type="base", lat=-69.4083, lng=76.1867,
                status="operational", weather_code="snow"),
        Station(id="STN-MAITRI", name="Maitri Research Station", type="base", lat=-70.7667, lng=11.7333,
                status="operational", weather_code="clear"),
        Station(id="STN-POLARRESOLVE", name="MV Polar Resolve (resupply vessel)", type="ship", lat=-63.5,
                lng=42.0, status="operational", weather_code="high_wind"),
        Station(id="STN-CAMPALPHA", name="Camp Alpha - Schirmacher Ridge", type="camp", lat=-70.65, lng=11.5,
                status="operational", weather_code="cloudy"),
        Station(id="STN-CAMPBRAVO", name="Camp Bravo - Larsemann Ice Edge", type="camp", lat=-69.55, lng=76.35,
                status="degraded", weather_code="blizzard"),
    ]

    people = [
        Personnel(id="PER-001", name="Dr. Anjali Verma", role="Expedition Leader", current_station_id="STN-BHARATI",
                  status="on_expedition", last_checkin=ago(minutes=40)),
        Personnel(id="PER-002", name="Rohan Mehta", role="Glaciologist", current_station_id="STN-CAMPBRAVO",
                  status="on_expedition", last_checkin=ago(minutes=80)),
        Personnel(id="PER-003", name="Dr. Kavya Nair", role="Field Physician", current_station_id="STN-BHARATI",
                  status="at_base", last_checkin=ago(minutes=25)),
        Personnel(id="PER-004", name="Imran Sheikh", role="Comms Engineer", current_station_id="STN-CAMPBRAVO",
                  status="overdue", prior_status="on_expedition", last_checkin=ago(hours=7)),
        Personnel(id="PER-005", name="Suresh Pillai", role="Station Manager", current_station_id="STN-MAITRI",
                  status="at_base", last_checkin=ago(minutes=15)),
        Personnel(id="PER-006", name="Neha Kapoor", role="Logistics Officer", current_station_id="STN-POLARRESOLVE",
                  status="in_transit", last_checkin=ago(hours=2)),
        Personnel(id="PER-007", name="Arjun Reddy", role="Vehicle Mechanic", current_station_id="STN-MAITRI",
                  status="at_base", last_checkin=ago(minutes=50)),
        Personnel(id="PER-008", name="Meera Kulkarni", role="Atmospheric Scientist",
                  current_station_id="STN-CAMPALPHA", status="on_expedition", last_checkin=ago(hours=3)),
    ]
    by_id = {p.id: p for p in people}

    expeditions = [
        Expedition(id="EXP-0001", name="Larsemann Hills Ice-Core Survey", start_date=today - timedelta(days=3),
                   end_date=today + timedelta(days=18), status="in_progress", team_lead_id="PER-001",
                   personnel=[by_id["PER-001"], by_id["PER-002"], by_id["PER-004"]]),
        Expedition(id="EXP-0002", name="Schirmacher Oasis Resupply", start_date=today + timedelta(days=10),
                   end_date=today + timedelta(days=25), status="planned", team_lead_id="PER-005",
                   personnel=[by_id["PER-005"], by_id["PER-007"], by_id["PER-008"]]),
        Expedition(id="EXP-0003", name="Bharati Coastal Survey (Season 45)", start_date=today - timedelta(days=210),
                   end_date=today - timedelta(days=190), status="completed", team_lead_id="PER-003",
                   personnel=[by_id["PER-003"]]),
    ]

    waypoints = [
        Waypoint(id="WPT-0001", expedition_id="EXP-0001", station_id="STN-BHARATI", sequence=1,
                 eta=at(-3, 8), status="reached"),
        Waypoint(id="WPT-0002", expedition_id="EXP-0001", station_id="STN-CAMPBRAVO", sequence=2,
                 eta=at(1, 10), status="pending"),
        Waypoint(id="WPT-0003", expedition_id="EXP-0002", station_id="STN-MAITRI", sequence=1,
                 eta=at(10, 9), status="pending"),
        Waypoint(id="WPT-0004", expedition_id="EXP-0002", station_id="STN-CAMPALPHA", sequence=2,
                 eta=at(11, 14), status="pending"),
        Waypoint(id="WPT-0005", expedition_id="EXP-0003", station_id="STN-POLARRESOLVE", sequence=1,
                 eta=at(-210, 7), status="reached"),
        Waypoint(id="WPT-0006", expedition_id="EXP-0003", station_id="STN-BHARATI", sequence=2,
                 eta=at(-205, 12), status="reached"),
    ]

    cargo = [
        CargoItem(id="CGO-0001", name="Ice-core drilling rig", category="equipment", weight_kg=640,
                  expedition_id="EXP-0001", current_station_id="STN-BHARATI", status="in_transit"),
        CargoItem(id="CGO-0002", name="Sample cold-storage cases", category="scientific", weight_kg=120,
                  expedition_id="EXP-0001", current_station_id="STN-BHARATI", status="stored"),
        CargoItem(id="CGO-0003", name="Expedition rations (14-day)", category="food", weight_kg=380,
                  expedition_id="EXP-0002", current_station_id="STN-POLARRESOLVE", status="stored"),
        CargoItem(id="CGO-0004", name="Diesel drums (20 x 200 L)", category="fuel", weight_kg=3200,
                  expedition_id="EXP-0002", current_station_id="STN-POLARRESOLVE", status="in_transit"),
        CargoItem(id="CGO-0005", name="Trauma and medical kit", category="medical", weight_kg=45,
                  expedition_id="EXP-0001", current_station_id="STN-CAMPBRAVO", status="delivered"),
        CargoItem(id="CGO-0006", name="Portable Iridium comms set", category="comms", weight_kg=18,
                  expedition_id="EXP-0002", current_station_id="STN-MAITRI", status="stored"),
        CargoItem(id="CGO-0007", name="Spare Arctic shelter tent", category="shelter", weight_kg=210,
                  expedition_id=None, current_station_id="STN-MAITRI", status="stored"),
        CargoItem(id="CGO-0008", name="Coastal survey instruments", category="scientific", weight_kg=95,
                  expedition_id="EXP-0003", current_station_id="STN-BHARATI", status="delivered"),
    ]

    stock = [
        ("INV-0001", "Diesel fuel", "fuel", "STN-BHARATI", 18000, "L", 8000),
        ("INV-0002", "Rations", "food", "STN-BHARATI", 1200, "kg", 1500),
        ("INV-0003", "Antibiotic course kits", "medical", "STN-BHARATI", 40, "kits", 25),
        ("INV-0004", "Lithium batteries", "power", "STN-BHARATI", 24, "units", 30),
        ("INV-0005", "Diesel fuel", "fuel", "STN-MAITRI", 9500, "L", 8000),
        ("INV-0006", "Rations", "food", "STN-MAITRI", 2600, "kg", 1500),
        ("INV-0007", "Water purification tablets", "medical", "STN-MAITRI", 300, "boxes", 100),
        ("INV-0008", "Diesel fuel", "fuel", "STN-POLARRESOLVE", 60000, "L", 20000),
        ("INV-0009", "Rations", "food", "STN-POLARRESOLVE", 900, "kg", 800),
        ("INV-0010", "Emergency ration packs", "food", "STN-CAMPBRAVO", 90, "packs", 60),
        ("INV-0011", "Propane cylinders", "fuel", "STN-CAMPBRAVO", 6, "cylinders", 10),
    ]
    inventory = [
        InventoryItem(id=i, name=n, category=c, station_id=s, quantity=q, unit=u, reorder_threshold=t,
                      status=compute_status(q, t))
        for i, n, c, s, q, u, t in stock
    ]

    def inspected(days_ago: int) -> date:
        return today - timedelta(days=days_ago)

    assets = [
        Asset(id="AST-0001", name="Pistenbully 300 tracked vehicle", category="vehicle", condition="operational",
              current_holder_type="station", current_holder_id="STN-BHARATI", last_inspected=inspected(20)),
        Asset(id="AST-0002", name="Hagglunds BV206 all-terrain carrier", category="vehicle",
              condition="operational", current_holder_type="expedition", current_holder_id="EXP-0001",
              last_inspected=inspected(12)),
        Asset(id="AST-0003", name="Iridium satellite terminal", category="comms", condition="operational",
              current_holder_type="station", current_holder_id="STN-MAITRI", last_inspected=inspected(30)),
        Asset(id="AST-0004", name="HF radio base set", category="comms", condition="needs_maintenance",
              current_holder_type="station", current_holder_id="STN-BHARATI", last_inspected=inspected(95)),
        Asset(id="AST-0005", name="Arctic field shelter", category="shelter", condition="operational",
              current_holder_type="expedition", current_holder_id="EXP-0001", last_inspected=inspected(8)),
        Asset(id="AST-0006", name="Field trauma module", category="medical", condition="operational",
              current_holder_type="station", current_holder_id="STN-BHARATI", last_inspected=inspected(15)),
        Asset(id="AST-0007", name="60 kVA diesel generator", category="power", condition="needs_maintenance",
              current_holder_type="station", current_holder_id="STN-MAITRI", last_inspected=inspected(70)),
        Asset(id="AST-0008", name="Portable solar array", category="power", condition="retired",
              current_holder_type="station", current_holder_id="STN-MAITRI", last_inspected=inspected(400)),
        Asset(id="AST-0009", name="Snow scooter", category="vehicle", condition="operational",
              current_holder_type="station", current_holder_id="STN-MAITRI", last_inspected=inspected(25)),
    ]

    incidents = [
        EmergencyIncident(id="INC-0001", type="medical", personnel_id="PER-002", station_id="STN-CAMPBRAVO",
                          severity="high", status="resolved", timestamp=ago(hours=26), escalated_at=ago(hours=22),
                          description="Suspected frostbite on left hand during ice-core drilling; evacuated to Bharati."),
        EmergencyIncident(id="INC-0002", type="equipment_failure", personnel_id=None, station_id="STN-MAITRI",
                          severity="low", status="open", timestamp=ago(minutes=30), escalated_at=None,
                          description="Backup generator tripped during load test; primary supply unaffected."),
    ]

    with SessionLocal() as db:
        db.add_all(stations)
        db.add_all(people)
        db.flush()
        db.add_all(expeditions)
        db.flush()
        db.add_all(waypoints + cargo + inventory + assets + incidents)
        db.commit()
    print(
        f"Seeded {len(stations)} stations, {len(people)} personnel, {len(expeditions)} expeditions, "
        f"{len(cargo)} cargo items, {len(inventory)} inventory items, {len(assets)} assets, "
        f"{len(incidents)} incidents."
    )


if __name__ == "__main__":
    seed()
