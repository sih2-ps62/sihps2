# OWNER: Param
# Seeds the database (wipes everything first). Two datasets:
#   demo (default) - what the frontend was designed around: 12 polar stations, 10 people, 5 expeditions, and the
#                    overdue check-in + low stock + open incident that land on the same stations (compound risk).
#   plan           - the original plan dataset (Bharati, Maitri, a ship, two camps); the backend tests run on it.
# Both create the two sign-in accounts. Run: python seed.py [--profile demo|plan]
import argparse
from datetime import date, datetime, timedelta

from db import Base, SessionLocal, engine, utcnow
from models import (Asset, AuditLog, CargoItem, EmergencyIncident, Expedition, InventoryItem, Personnel, Station,
                    User, Waypoint)
from rules.low_stock import compute_status
from ui_api.security import hash_password

# Demo sign-ins (shown on the frontend's login page).
USERS = [
    ("duty.officer@polarops.io", "icebreaker26", "Duty Officer", "duty_officer"),
    ("admin@polarops.io", "glacieradmin26", "Ops Admin", "admin"),
]


def _plan_dataset(now: datetime) -> dict:
    today = now.date()

    def ago(**delta) -> datetime:
        return now - timedelta(**delta)

    def at(days: int, hour: int) -> datetime:
        day = today + timedelta(days=days)
        return datetime(day.year, day.month, day.day, hour)

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
                          resolved_at=ago(hours=20),
                          description="Suspected frostbite on left hand during ice-core drilling; evacuated to Bharati."),
        EmergencyIncident(id="INC-0002", type="equipment_failure", personnel_id=None, station_id="STN-MAITRI",
                          severity="low", status="open", timestamp=ago(minutes=30), escalated_at=None,
                          description="Backup generator tripped during load test; primary supply unaffected."),
    ]

    return {"stations": stations, "people": people, "expeditions": expeditions,
            "rest": waypoints + cargo + inventory + assets + incidents, "audit": []}


def _demo_dataset(now: datetime) -> dict:
    today = now.date()

    def ago(**delta) -> datetime:
        return now - timedelta(**delta)

    def day(offset: int) -> date:
        return today + timedelta(days=offset)

    def at(days: int, hour: int) -> datetime:
        d = day(days)
        return datetime(d.year, d.month, d.day, hour)

    stations = [
        Station(id=i, name=n, type="base", lat=lat, lng=lng, status="operational", weather_code=w)
        for i, n, lat, lng, w in [
            ("amundsen-scott", "Amundsen-Scott South Pole Station", -89.9, 0.0, "cloudy"),
            ("mcmurdo", "McMurdo Station", -77.85, 166.67, "snow"),
            ("palmer", "Palmer Station", -64.77, -64.05, "cloudy"),
            ("halley", "Halley VI Research Station", -75.6, -26.21, "high_wind"),
            ("concordia", "Concordia Station", -75.1, 123.35, "clear"),
            ("vostok", "Vostok Station", -78.46, 106.84, "blizzard"),
            ("bharati", "Bharati Research Station", -69.4083, 76.1867, "snow"),
            ("maitri", "Maitri Research Station", -70.7667, 11.7333, "clear"),
            ("ny-alesund", "Ny-Ålesund Research Station", 78.92, 11.93, "snow"),
            ("alert", "Alert", 82.5, -62.35, "clear"),
            ("summit-camp", "Summit Camp", 72.58, -38.46, "high_wind"),
            ("barentsburg", "Barentsburg", 78.06, 14.23, "cloudy"),
        ]
    ]

    # Two crew are more than a day silent (Elena at McMurdo, Priya at Vostok) - the seed for the compound-risk cards.
    def person(i, name, role, station, status, checked_in, prior=None):
        return Personnel(id=f"PER-{i:03d}", name=name, role=role, current_station_id=station, status=status,
                         last_checkin=checked_in, prior_status=prior)

    people = [
        person(1, "Dr. Elena Kowalski", "Expedition Lead", "mcmurdo", "overdue", ago(hours=30), "on_expedition"),
        person(2, "Anders Solberg", "Glaciologist", "ny-alesund", "on_expedition", ago(hours=3)),
        person(3, "Dr. Marco Rinaldi", "Ice Core Specialist", "concordia", "on_expedition", ago(hours=5)),
        person(4, "Kirsten Bruun", "Logistics Officer", "summit-camp", "on_leave", ago(hours=50)),
        person(5, "Sam Whitfield", "Field Medic", "palmer", "on_expedition", ago(hours=2)),
        person(6, "Priya Nair", "Comms Officer", "vostok", "overdue", ago(hours=28), "on_expedition"),
        person(7, "Jonas Berg", "Mechanic", "alert", "on_expedition", ago(hours=4)),
        person(8, "Dr. Wei Chen", "Atmospheric Scientist", "halley", "on_expedition", ago(hours=5)),
        person(9, "Suresh Pillai", "Station Manager", "maitri", "at_base", ago(minutes=15)),
        person(10, "Dr. Kavya Nair", "Field Physician", "bharati", "at_base", ago(minutes=25)),
    ]
    by_id = {p.id: p for p in people}

    expeditions = [
        Expedition(id="EXP-0001", name="Ross Ice Shelf Traverse", status="in_progress", region="Antarctic",
                   start_date=day(-56), end_date=None, team_lead_id="PER-001", team_lead_name="Dr. Elena Kowalski",
                   personnel=[by_id["PER-001"], by_id["PER-006"]]),
        Expedition(id="EXP-0002", name="Svalbard Glacier Survey", status="planned", region="Arctic",
                   start_date=day(19), end_date=None, team_lead_id="PER-002", team_lead_name="Anders Solberg",
                   personnel=[by_id["PER-002"]]),
        Expedition(id="EXP-0003", name="Dome C Ice Core Recovery", status="in_progress", region="Antarctic",
                   start_date=day(-68), end_date=None, team_lead_id="PER-003", team_lead_name="Dr. Marco Rinaldi",
                   personnel=[by_id["PER-003"], by_id["PER-006"]]),
        Expedition(id="EXP-0004", name="Greenland Traverse North", status="completed", region="Arctic",
                   start_date=day(-148), end_date=day(-108), team_lead_id="PER-004", team_lead_name="Kirsten Bruun",
                   personnel=[by_id["PER-004"], by_id["PER-007"]]),
        Expedition(id="EXP-0005", name="Weddell Sea Coastal Survey", status="planned", region="Antarctic",
                   start_date=day(36), end_date=None, team_lead_id="PER-001", team_lead_name="Dr. Elena Kowalski",
                   personnel=[by_id["PER-008"]]),
    ]

    routes = [  # (expedition, [(station, eta, status), ...])
        ("EXP-0001", [("mcmurdo", at(-56, 8), "reached"), ("vostok", at(4, 10), "pending")]),
        ("EXP-0002", [("ny-alesund", at(19, 9), "pending"), ("barentsburg", at(21, 14), "pending")]),
        ("EXP-0003", [("concordia", at(-68, 7), "reached"), ("vostok", at(6, 12), "pending")]),
        ("EXP-0004", [("summit-camp", at(-148, 8), "reached"), ("alert", at(-130, 11), "reached")]),
        ("EXP-0005", [("halley", at(36, 9), "pending"), ("palmer", at(40, 13), "pending")]),
    ]
    waypoints, n = [], 0
    for expedition_id, stops in routes:
        for sequence, (station_id, eta, status) in enumerate(stops, start=1):
            n += 1
            waypoints.append(Waypoint(id=f"WPT-{n:04d}", expedition_id=expedition_id, station_id=station_id,
                                      sequence=sequence, eta=eta, status=status))

    def cargo_row(i, manifest, description, status, origin, destination, kg, category, station, exp, days_ago):
        created = ago(days=days_ago)
        return CargoItem(id=f"CGO-{i:04d}", name=description, category=category, weight_kg=kg, expedition_id=exp,
                         current_station_id=station, status=status, manifest_id=manifest, origin=origin,
                         destination=destination, created_at=created, updated_at=created)

    cargo = [
        cargo_row(1, "MAN-1042", "Fuel drums (diesel)", "in_transit", "McMurdo Station", "Vostok Station", 4200,
                  "fuel", "mcmurdo", "EXP-0001", 9),
        cargo_row(2, "MAN-1043", "Resupply — fresh produce", "delayed", "Christchurch", "McMurdo Station", 850,
                  "food", None, None, 7),
        cargo_row(3, "MAN-1044", "Scientific equipment", "delivered", "Ny-Ålesund", "Barentsburg", 320,
                  "scientific", "barentsburg", None, 6),
        cargo_row(4, "MAN-1045", "Medical supplies", "delivered", "Palmer Station", "Halley VI Station", 140,
                  "medical", "halley", None, 5),
        cargo_row(5, "MAN-1046", "Ice core sample containers", "stored", "Concordia Station", "Hobart", 610,
                  "scientific", "concordia", "EXP-0003", 3),
        cargo_row(6, "MAN-1047", "Generator parts", "in_transit", "Alert", "Summit Camp", 275, "equipment", "alert",
                  None, 1),
    ]

    # (name, category, station, quantity, unit, threshold, needs_maintenance)
    stock = [
        ("Diesel fuel", "Fuel", "mcmurdo", 12000, "L", 5000, False),
        ("Snowmobiles", "Vehicles", "palmer", 4, "units", 3, True),
        ("Emergency rations", "Food", "vostok", 180, "kits", 200, False),
        ("Satellite phones", "Comms", "mcmurdo", 4, "units", 5, False),
        ("Weather balloons", "Research", "summit-camp", 22, "units", 25, False),
        ("Generator units", "Power", "alert", 6, "units", 4, True),
        ("Cold-weather suits", "Safety", "halley", 40, "sets", 30, False),
    ]
    inventory = [
        InventoryItem(id=f"INV-{i:04d}", name=name, category=category, station_id=station, quantity=quantity,
                      unit=unit, reorder_threshold=threshold, status=compute_status(quantity, threshold),
                      needs_maintenance=maintenance, created_at=ago(days=14), updated_at=ago(hours=i * 3))
        for i, (name, category, station, quantity, unit, threshold, maintenance) in enumerate(stock, start=1)
    ]

    assets = [
        Asset(id="AST-0001", name="Snowmobile fleet", category="vehicle", condition="operational",
              current_holder_type="station", current_holder_id="palmer", last_inspected=day(-12)),
        Asset(id="AST-0002", name="Generator set A", category="power", condition="needs_maintenance",
              current_holder_type="station", current_holder_id="alert", last_inspected=day(-80)),
        Asset(id="AST-0003", name="Iridium satellite terminal", category="comms", condition="operational",
              current_holder_type="station", current_holder_id="mcmurdo", last_inspected=day(-20)),
        Asset(id="AST-0004", name="Field shelter", category="shelter", condition="operational",
              current_holder_type="expedition", current_holder_id="EXP-0001", last_inspected=day(-9)),
        Asset(id="AST-0005", name="Trauma module", category="medical", condition="operational",
              current_holder_type="station", current_holder_id="palmer", last_inspected=day(-30)),
    ]

    def incident(i, title, kind, severity, status, station, reported, resolved=None, escalated=None):
        return EmergencyIncident(id=f"INC-{i:04d}", type=kind, description=title, severity=severity, status=status,
                                 station_id=station, timestamp=reported, resolved_at=resolved, escalated_at=escalated)

    incidents = [
        incident(1, "Generator failure — backup power engaged", "equipment_failure", "high", "open", "vostok",
                 ago(minutes=95)),
        incident(2, "Overdue check-in — field team", "overdue_checkin", "medium", "open", "summit-camp",
                 ago(minutes=40)),
        incident(3, "Medical evacuation completed", "medical", "high", "resolved", "palmer", ago(days=11),
                 ago(days=11) + timedelta(hours=13.5)),
        incident(4, "Fuel leak contained", "spill", "medium", "open", "mcmurdo", ago(minutes=70)),
        incident(5, "Whiteout — team sheltered in place", "weather", "medium", "resolved", "alert", ago(days=8),
                 ago(days=8) + timedelta(hours=6)),
        incident(6, "Frostbite case treated at station", "medical", "low", "resolved", "palmer", ago(days=5),
                 ago(days=5) + timedelta(hours=3.5)),
        incident(7, "Crevasse fall — rescue completed", "rescue", "high", "resolved", "concordia", ago(days=2),
                 ago(days=2) + timedelta(hours=9.2), ago(days=2) + timedelta(hours=2.5)),
    ]

    history = [  # (days ago, user, action, resource, id, summary)
        (10, "Ops Admin", "create", "expedition", "EXP-0002", 'Created expedition "Svalbard Glacier Survey"'),
        (9, "Duty Officer", "create", "cargo", "CGO-0001", 'Created cargo manifest "MAN-1042"'),
        (7, "Duty Officer", "update", "cargo", "CGO-0002", 'Updated cargo manifest "MAN-1043" (Delayed)'),
        (5, "Duty Officer", "create", "emergency", "INC-0006",
         'Reported emergency "Frostbite case treated at station" (warning)'),
        (2, "Ops Admin", "update", "inventory", "INV-0003", 'Updated inventory item "Emergency rations" (180/200 kits)'),
        (1, "Duty Officer", "update", "personnel", "PER-007", 'Check-in recorded for "Jonas Berg"'),
    ]
    audit = [AuditLog(user_id=1 if user == "Duty Officer" else 2, user_name=user, action=action,
                      resource_type=resource, resource_id=rid, summary=summary, created_at=ago(days=days))
             for days, user, action, resource, rid, summary in history]

    return {"stations": stations, "people": people, "expeditions": expeditions,
            "rest": waypoints + cargo + inventory + assets + incidents, "audit": audit}


DATASETS = {"demo": _demo_dataset, "plan": _plan_dataset}


def seed(now: datetime | None = None, profile: str = "demo"):
    if profile not in DATASETS:
        raise ValueError(f"unknown profile {profile!r}; choose from {', '.join(DATASETS)}")
    now = now or utcnow()
    data = DATASETS[profile](now)

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    users = [User(email=email, password_hash=hash_password(password), name=name, role=role, created_at=now)
             for email, password, name, role in USERS]
    with SessionLocal() as db:
        db.add_all(users)
        db.add_all(data["stations"])
        db.add_all(data["people"])
        db.flush()
        db.add_all(data["expeditions"])
        db.flush()
        db.add_all(data["rest"])
        db.add_all(data["audit"])
        db.commit()

    tally = {}
    for row in data["rest"]:
        tally[type(row).__name__] = tally.get(type(row).__name__, 0) + 1
    others = ", ".join(f"{count} {name}" for name, count in sorted(tally.items()) if name != "Waypoint")
    print(
        f"Seeded the {profile} dataset: {len(data['stations'])} stations, {len(data['people'])} personnel, "
        f"{len(data['expeditions'])} expeditions, {others}; {len(users)} sign-in accounts."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Wipe and re-seed backend/polarops.db")
    parser.add_argument("--profile", choices=sorted(DATASETS), default="demo",
                        help="demo = the frontend's dataset (default); plan = the original plan dataset")
    seed(profile=parser.parse_args().profile)
