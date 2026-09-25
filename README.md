# PolarOps — Integrated Polar Expedition Logistics & Asset Management System

PS 26062 · MoES / NCPOR · Smart Automation theme · 3-day build (25–27 Sep 2026).

FastAPI + SQLite backend with a server-side rule engine, and a React + Vite +
Tailwind + Leaflet frontend. Team of six: **Backend** — Maisha, Jalak, Param ·
**Frontend** — Shrey, Akshit, Tanvi.

> **New here?** Read [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) for the
> full handoff (what's built, what changed, what's left per person) and
> [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) for every endpoint and payload.

## Status (end of Day 1)

| Area | State |
|------|-------|
| Backend API — all 24 contract routes | **Done**, persisted in SQLite, 43 automated tests passing |
| Rule engine — low-stock, overdue check-in, route risk score, emergency escalation | **Done** (server-side, plain Python) |
| Seed data — 5 stations, 8 crew, 3 expeditions, cargo, stock, assets, incidents | **Done** — `python backend/seed.py` |
| API contract doc | **Done**, drift log started |
| Frontend — shared UI kit, API adapter, all 8 screens | **Not started** — files are stubs; see the per-person list in `docs/PROJECT_CONTEXT.md` |
| Frontend currently builds | **No** — `services/api.js` is an empty stub and the leftover old pages import from it (fix = Shrey's first task) |

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

API at `http://127.0.0.1:8000` — interactive Swagger docs at
`http://127.0.0.1:8000/docs`.

### Terminal 2 — frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend at `http://localhost:5173`. It reads the API base URL from
`frontend/.env` (`VITE_API_URL=http://localhost:8000`).

> Until Shrey's `services/api.js` lands, the frontend will fail to compile.
> The backend is fully usable on its own through `/docs` in the meantime.

## Tests

```bash
cd backend
python -m pytest
```

Runs against a throwaway SQLite file, so it never touches `polarops.db`.

## Re-seeding

`python backend/seed.py` wipes and repopulates `backend/polarops.db`. Re-run it
any time you want a clean demo state. The seed deliberately includes:

- one expedition on a blizzard route with an overdue crew member (high risk) and one on a calm route (low risk)
- three inventory items already below their reorder threshold
- two assets in `needs_maintenance` and one `retired`
- one resolved incident that had escalated (shows escalation history) and one open incident

## Demo-time knobs

The rules are time-based (6h check-in, 2h escalation), which you cannot wait
for on stage. Shorten them when starting the API:

```bash
# PowerShell
$env:POLAROPS_ESCALATION_HOURS = "0.02"   # ~72 seconds
$env:POLAROPS_OVERDUE_HOURS = "0.05"      # ~3 minutes
uvicorn main:app --port 8000
```

Defaults are 2 and 6 hours. The weather input to the risk score can be changed
live per request: `GET /expeditions/{id}/risk?weather_code=blizzard&season=winter`.

## What's real vs. simulated

- **Real**: expedition / cargo / inventory / asset / personnel / emergency data,
  all persisted in SQLite; the four rules (low-stock, overdue check-in, route
  risk score, emergency auto-escalation) computed server-side on every read or
  write; dashboard aggregation across all modules.
- **Simulated**: the weather feed (each station carries a fixed weather code that
  feeds the risk score, overridable per request); crew check-in times come from
  the seed and the check-in button.
- **Roadmap, not built**: offline-first sync, real GPS / IoT position feeds,
  ML-based predictive risk, authentication, a background scheduler (rules
  are evaluated lazily on reads instead).

## Project layout

```
/backend    FastAPI + SQLite — models/, routers/, rules/ (one file per owner)
/frontend   React + Vite + Tailwind + Leaflet
/docs       API_CONTRACT.md (endpoints + payloads), PROJECT_CONTEXT.md (handoff)
```

## Ground rule

Every file has exactly one owner (named in the first line of the file). If you
didn't write it, ask its owner before editing. Short-lived branches per person
per task (`<person>/<module>`), merged into `develop` at each sync point.
