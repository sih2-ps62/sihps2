# PolarOps — Integrated Polar Expedition Logistics & Asset Management System

PS 26062 · MoES / NCPOR · Smart Automation theme.

A working local build: FastAPI + SQLite backend with a real rule engine
(low-stock, overdue check-in, asset health, geofencing, cross-system
correlation, delay-risk), and a React + Vite + Tailwind + Leaflet frontend
across 8 screens. See `docs/API_CONTRACT.md` and `docs/PROJECT_CONTEXT.md`
for the full spec this was built against.

## Prerequisites

- Python 3.11+
- Node.js 18+

## Quick start (two terminals)

### Terminal 1 — backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
python seed.py
uvicorn main:app --reload --port 8000
```

Backend runs at `http://127.0.0.1:8000` — Swagger docs at
`http://127.0.0.1:8000/docs`.

### Terminal 2 — frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## What's real vs. simulated

- **Real**: expedition/cargo/inventory/personnel/emergency/asset CRUD, all
  persisted to SQLite; the full rule engine (low-stock, overdue check-in,
  asset health, geofencing, cross-system correlated alerts, delay-risk);
  Mission Readiness scoring; the Audit Log; the PDF Situation Report; the
  Command Assistant (template-matched over live data, not an LLM).
- **Simulated**: live GPS/position feed (seeded + manually adjustable via
  the Assets telemetry buttons and Personnel check-ins), weather data (not
  used in this cut). This is stated explicitly in the UI.
- **Roadmap, not built**: production offline-first sync, real IoT/GPS
  hardware integration, true ML-based predictive risk.

## Re-seeding

`python backend/seed.py` wipes and repopulates `polarops.db` with a
realistic dataset, including one asset deliberately seeded in WARNING state
with a delayed spare-part cargo (to demo the correlated-alert rule), one
overdue check-in, and one geofence breach. Re-run it any time you want a
clean demo state.

## Project layout

```
/backend    FastAPI + SQLite — see docs/PROJECT_CONTEXT.md
/frontend   React + Vite + Tailwind + Leaflet
/docs       API_CONTRACT.md, PROJECT_CONTEXT.md
```
