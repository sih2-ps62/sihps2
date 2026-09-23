"""Seed script — wipes and repopulates polarops.db with realistic demo data.
Run with: python seed.py
"""
from datetime import timedelta

from database import engine, SessionLocal, Base
import models
from rules import now
from audit import log_action

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

# --------------------------------------------------------------------- Stations
stations = [
    models.Station(id="STN-BHARATI", name="Bharati Station", type="base", lat=-69.4033, lng=76.1897, status="operational"),
    models.Station(id="STN-MAITRI", name="Maitri Station", type="base", lat=-70.7666, lng=11.7333, status="operational"),
    models.Station(id="STN-VESSEL", name="MV Polar Tern", type="ship", lat=-65.50, lng=45.00, status="operational"),
    models.Station(id="STN-CAMP1", name="Forward Camp Alpha", type="camp", lat=-69.90, lng=74.50, status="operational"),
]
db.add_all(stations)
db.flush()

# -------------------------------------------------------------------- Personnel
def per(id_, name, role, station_id, lat, lng, status, last_checkin):
    return models.Personnel(
        id=id_, name=name, role=role, current_station_id=station_id,
        lat=lat, lng=lng, status=status, last_checkin=last_checkin,
    )

personnel = [
    per("PER-001", "Cdr. Arjun Rao", "Expedition Lead", "STN-BHARATI", -69.4033, 76.1897, "at_base", now()),
    per("PER-002", "Dr. Meera Iyer", "Glaciologist", "STN-BHARATI", -69.41, 76.20, "on_expedition", now() - timedelta(minutes=40)),
    per("PER-003", "Rohan Desai", "Field Medic", "STN-MAITRI", -70.7666, 11.7333, "at_base", now()),
    per("PER-004", "Kavya Nair", "Logistics Officer", "STN-BHARATI", -69.4033, 76.1897, "at_base", now() - timedelta(hours=1)),
    per("PER-005", "Wing Cdr. Vikram Singh", "Engineer", "STN-BHARATI", -69.403, 76.19, "in_transit", now() - timedelta(hours=2)),
    per("PER-006", "Ananya Bose", "Comms Officer", "STN-MAITRI", -70.77, 11.73, "at_base", now() - timedelta(minutes=20)),
    per("PER-007", "Suresh Pillai", "Deckhand", "STN-VESSEL", -65.50, 45.00, "on_expedition", now() - timedelta(minutes=15)),
    per("PER-008", "Dr. Priya Menon", "Meteorologist", "STN-MAITRI", -70.77, 11.73, "at_base", now()),
    per("PER-009", "Karan Bhatt", "Field Technician", "STN-CAMP1", -69.90, 74.50, "on_expedition", now() - timedelta(hours=8)),  # overdue demo
    per("PER-010", "Nisha Reddy", "Survey Scientist", "STN-BHARATI", -68.95, 76.55, "on_expedition", now() - timedelta(hours=3)),  # geofence-breach demo (~50km out, stale checkin)
    per("PER-011", "Team Lead — Ops", "Expedition Lead", "STN-MAITRI", -70.7666, 11.7333, "at_base", now()),
    per("PER-012", "Farhan Ali", "Cargo Handler", "STN-VESSEL", -65.50, 45.00, "at_base", now()),
]
db.add_all(personnel)
db.flush()

# ----------------------------------------------------------------------- Assets
assets = [
    models.Asset(id="AST-GEN07", name="Generator GEN-07", type="generator", station_id="STN-BHARATI",
                 health_pct=64, status="warning", runtime_hours=4210, next_maintenance_date="2026-10-05",
                 awaiting_part_cargo_id=None),  # linked after cargo is created
    models.Asset(id="AST-GEN02", name="Generator GEN-02", type="generator", station_id="STN-MAITRI",
                 health_pct=95, status="operational", runtime_hours=1180, next_maintenance_date="2027-01-10"),
    models.Asset(id="AST-VEH01", name="Snow Vehicle SV-01", type="vehicle", station_id="STN-BHARATI",
                 health_pct=85, status="operational", runtime_hours=860, next_maintenance_date="2026-11-20"),
    models.Asset(id="AST-COMM01", name="Comms Tower CT-01", type="communications", station_id="STN-MAITRI",
                 health_pct=35, status="critical", runtime_hours=6100, next_maintenance_date="2026-09-28"),
    models.Asset(id="AST-BOIL01", name="Heating Boiler B-01", type="heating", station_id="STN-VESSEL",
                 health_pct=92, status="operational", runtime_hours=430, next_maintenance_date="2027-02-15"),
]
db.add_all(assets)
db.flush()

# ----------------------------------------------------------------------- Cargo
cargo_items = [
    models.CargoItem(id="CGO-1001", name="Fuel Drums (200L x12)", category="fuel", weight_kg=2400,
                      expedition_id=None, current_station_id="STN-BHARATI", status="stored", is_critical_part=False),
    models.CargoItem(id="CGO-1002", name="GEN-07 Alternator Spare Part", category="spare_part", weight_kg=38,
                      expedition_id=None, current_station_id=None, status="in_transit", is_critical_part=True,
                      eta=now() - timedelta(hours=36)),  # delayed 36h — the correlation demo
    models.CargoItem(id="CGO-1003", name="Dry Food Rations (90-day)", category="food", weight_kg=1800,
                      expedition_id=None, current_station_id="STN-MAITRI", status="delivered", is_critical_part=False),
    models.CargoItem(id="CGO-1004", name="Medical Supplies Kit", category="medical", weight_kg=120,
                      expedition_id=None, current_station_id="STN-BHARATI", status="stored", is_critical_part=False),
    models.CargoItem(id="CGO-1005", name="Scientific Instruments Crate", category="equipment", weight_kg=310,
                      expedition_id=None, current_station_id=None, status="in_transit", is_critical_part=False,
                      eta=now() + timedelta(hours=18)),
    models.CargoItem(id="CGO-1006", name="Winter Clothing Bales", category="supplies", weight_kg=540,
                      expedition_id=None, current_station_id="STN-VESSEL", status="stored", is_critical_part=False),
]
db.add_all(cargo_items)
db.flush()

assets[0].awaiting_part_cargo_id = "CGO-1002"

# ------------------------------------------------------------------- Expeditions
exp1 = models.Expedition(id="EXP-0001", name="Bharati Resupply Run 1", start_date="2026-09-18",
                          end_date="2026-09-28", status="in_progress", team_lead_id="PER-001")
exp2 = models.Expedition(id="EXP-0002", name="Maitri Winter Supply", start_date="2026-10-01",
                          end_date="2026-10-12", status="planned", team_lead_id="PER-011")
exp3 = models.Expedition(id="EXP-0003", name="Coastal Glacier Survey", start_date="2026-09-15",
                          end_date="2026-09-30", status="in_progress", team_lead_id="PER-002")
db.add_all([exp1, exp2, exp3])
db.flush()

waypoints = [
    models.Waypoint(id="WPT-0001", expedition_id="EXP-0001", station_id="STN-BHARATI", sequence=1,
                     eta=now() - timedelta(days=2), status="reached"),
    models.Waypoint(id="WPT-0002", expedition_id="EXP-0001", station_id="STN-CAMP1", sequence=2,
                     eta=now() + timedelta(hours=20), status="pending"),
    models.Waypoint(id="WPT-0003", expedition_id="EXP-0002", station_id="STN-MAITRI", sequence=1,
                     eta=now() + timedelta(days=8), status="pending"),
    models.Waypoint(id="WPT-0004", expedition_id="EXP-0003", station_id="STN-VESSEL", sequence=1,
                     eta=now() - timedelta(days=1), status="reached"),
    models.Waypoint(id="WPT-0005", expedition_id="EXP-0003", station_id="STN-BHARATI", sequence=2,
                     eta=now() - timedelta(hours=10), status="pending"),  # at_risk demo — eta passed, still pending
]
db.add_all(waypoints)

exp1.personnel.extend([personnel[0], personnel[3], personnel[8]])   # PER-001, PER-004, PER-009
exp3.personnel.extend([personnel[1], personnel[9]])                 # PER-002, PER-010
cargo_items[0].expedition_id = "EXP-0001"
cargo_items[1].expedition_id = "EXP-0001"
cargo_items[3].expedition_id = "EXP-0001"
cargo_items[4].expedition_id = "EXP-0003"
db.flush()

# ------------------------------------------------------------------- Inventory
inventory = [
    models.InventoryItem(id="INV-0001", name="Diesel Fuel", category="fuel", station_id="STN-BHARATI",
                          quantity=180, unit="L", reorder_threshold=200, status="low"),
    models.InventoryItem(id="INV-0002", name="Fresh Water Reserve", category="water", station_id="STN-BHARATI",
                          quantity=4200, unit="L", reorder_threshold=1000, status="ok"),
    models.InventoryItem(id="INV-0003", name="Dry Rations", category="food", station_id="STN-MAITRI",
                          quantity=85, unit="kg", reorder_threshold=150, status="low"),
    models.InventoryItem(id="INV-0004", name="First Aid Kits", category="medical", station_id="STN-MAITRI",
                          quantity=22, unit="units", reorder_threshold=10, status="ok"),
    models.InventoryItem(id="INV-0005", name="Spare Batteries", category="equipment", station_id="STN-VESSEL",
                          quantity=14, unit="units", reorder_threshold=20, status="low"),
    models.InventoryItem(id="INV-0006", name="Cooking Gas Canisters", category="fuel", station_id="STN-CAMP1",
                          quantity=30, unit="units", reorder_threshold=12, status="ok"),
]
db.add_all(inventory)

# -------------------------------------------------------------- Emergency (history)
db.add(models.EmergencyIncident(
    id="INC-0001", type="medical", personnel_id="PER-007", station_id="STN-VESSEL",
    severity="low", description="Minor frostbite reported on deck watch; treated on-site.",
    status="resolved", timestamp=now() - timedelta(days=3), auto_generated=False,
    resolution_notes="Assessed by field medic, no evacuation needed. Closed 2026-09-20.",
))

# Seed data above uses hand-picked IDs (PER-001, INC-0001, ...) that follow the
# same PREFIX-NNNN shape next_id() generates. Push each counter well past the
# highest seeded number so future API-created records never collide.
for prefix, baseline in [
    ("EXP", 100), ("WPT", 100), ("CGO", 2000), ("INV", 100),
    ("PER", 100), ("INC", 100), ("AST", 100),
]:
    db.add(models.Counter(prefix=prefix, value=baseline))

log_action(db, "system", "Database seeded with demo dataset", actor="system", status="info")

db.commit()
db.close()

print("Seed complete: 4 stations, 12 personnel, 5 assets, 6 cargo items, 3 expeditions, "
      "5 waypoints, 6 inventory items, 1 emergency record.")
