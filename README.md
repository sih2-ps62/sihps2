# PolarOps — Integrated Polar Expedition Logistics & Asset Management System

PS 26062 · MoES / NCPOR · Smart Automation theme · 3-day build (25–27 Sep 2026).

FastAPI + SQLite backend with a server-side rule engine, and a React + Vite +
Tailwind + Leaflet frontend. Team of six: **Backend** — Maisha, Jalak, Param ·
**Frontend** — Shrey, Akshit, Tanvi.

> **Safety and theme update:** see [`docs/SAFETY_CONTROLS.md`](docs/SAFETY_CONTROLS.md) for the enforced
> buddy/launch gate, station route deviations, emergency resource reservations, separately gated medical
> quick-cards, Aurora/Frost effects, test commands and an SIH demonstration walkthrough. Existing databases
> receive additive tables without reseeding.

> **Presenting?** Read [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md): what every feature does, where to find it,
> a 5-minute demo script, and what is real vs. simulated.
> **Developing?** [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) is the handoff and
> [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) lists every endpoint and payload.

## Status (end of Day 3)

| Area | State |
|------|-------|
| Backend — the plan's 24 contract routes | **Done**, persisted in SQLite |
| Backend — frontend API (`/api`): sign-in, roles, audit log, analytics, assistant, pagination | **Done** |
| Rule engine — low-stock, overdue check-in, route risk score, emergency escalation | **Done** (server-side, plain Python) |
| Frontend — every screen (dashboard, map, expeditions, cargo, inventory, personnel, emergency, analytics, audit log, settings), login, assistant, offline-queue simulation | **Done**, wired to the FastAPI backend |
| Automated tests | Backend and frontend regression suites plus Chromium workflow tests; see `docs/SAFETY_CONTROLS.md` |
| Public hosting | Not set up (runs locally) |

## Prerequisites

- Python 3.11+
- Node.js 20.19+ (or 22+)

## Quick start

One-time setup:

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt

cd ../frontend
npm install
```

Then, every time:

```bash
cd frontend
npm run dev
```

That starts **both** servers:

- App: `http://localhost:5183`
- API: `http://127.0.0.1:8000` (Swagger docs at `/docs`)

A brand-new database seeds itself on first start. Sign in with:

| Role | Email | Password |
|------|-------|----------|
| Duty officer | `duty.officer@polarops.io` | `icebreaker26` |
| Admin (can delete) | `admin@polarops.io` | `glacieradmin26` |
| Demo medical officer (separate clinical permission) | `medic@polarops.io` | `polarmedic26` |

To run the pieces separately: `npm run dev:client` (frontend) and, in `backend/`,
`uvicorn main:app --reload --port 8000`.

## Configuration (all optional)

Put backend settings in `backend/.env` (git-ignored) or set them as environment variables:

| Setting | What it does |
|---------|--------------|
| `GEMINI_API_KEY` | Turns on AI answers in the assistant (free key: aistudio.google.com/apikey). Without it the assistant answers from live data with a built-in engine. |
| `GEMINI_MODEL` | Override the Gemini model name. |
| `POLAROPS_JWT_SECRET` (or `JWT_SECRET`) | Secret that signs login sessions. **Set it before any public deployment.** |
| `POLAROPS_CORS_ORIGINS` | Comma-separated browser origins allowed to call the API. Default: the local frontend (`http://localhost:5183`, `http://127.0.0.1:5183`). Set it to your deployed frontend's address; `*` allows any. |
| `POLAROPS_LOGIN_MAX_FAILURES` / `POLAROPS_LOGIN_WINDOW_SECONDS` | Sign-in brake: failures allowed per account and address within the window before a temporary lockout (defaults 5 and 60). |
| `POLAROPS_ESCALATION_HOURS` / `POLAROPS_OVERDUE_HOURS` | Shorten the rule timers for a live demo (defaults 2 and 6). |
| `POLAROPS_AUTOSEED=0` | Start with an empty database instead of seeding demo data. |
| `POLAROPS_DB_URL` | Use a different database file/URL. |

Frontend: `VITE_API_URL` (default `http://localhost:8000/api`) — see `frontend/.env.example`.

## Tests

```bash
cd backend && python -m pytest     # throwaway database
cd frontend && npm test
npm run test:e2e                   # isolated API + Chromium browser workflows
```

Backend tests never touch `polarops.db`.

## Re-seeding

`python backend/seed.py` wipes and repopulates `backend/polarops.db`. Re-run it before a demo: the sample data
is timestamped relative to when it is created, so a stale database shows different numbers.

- `python seed.py` — the **demo** dataset the frontend was designed around: 12 polar stations, 10 people,
  5 expeditions, 6 cargo manifests, 7 stock items, 7 incidents. Three stations have several problems at once
  (low stock + overdue check-in + open incident), which drives the "Compound Risk" cards.
- `python seed.py --profile plan` — the original plan dataset (Bharati, Maitri, a ship, two camps) that the
  Day-1 backend tests run on.

If the API refuses to start saying the schema is out of date, the database file is from an older version:
run `python seed.py` to rebuild it.

## What's real vs. simulated

- **Real**: all data persisted in SQLite; sign-in with roles; the four rules (low-stock, overdue check-in, route
  risk score, emergency auto-escalation) computed server-side on every read or write; the audit log; dashboard
  and analytics aggregation across all modules; assistant answers grounded in the live data.
- **Simulated**: the weather feed (each station carries a fixed weather code); station positions; "Polar
  Blackout Mode" (the server never goes down — changes are queued in the browser and replayed, and the queue does
  not survive a page reload).
- **Roadmap, not built**: true offline-first sync, real GPS / IoT feeds, ML-based predictive risk, email/sound
  notifications, hosted deployment, a background scheduler (rules are evaluated lazily on reads instead).

## Project layout

```
/backend    FastAPI + SQLite
  routers/    the plan's endpoints (one file per module)
  ui_api/     the frontend API mounted at /api (sign-in, lists, audit log, analytics, assistant)
  rules/      the four rules, pure logic
  models/     database tables
  tests/      test_api.py, test_rules.py (plan) + test_ui_api.py (frontend API)
/frontend   React + Vite + Tailwind + Leaflet
  server/     legacy Node demo backend, no longer used (safe to delete)
/docs       DEMO_GUIDE.md, API_CONTRACT.md, PROJECT_CONTEXT.md
```

## Ground rule

Every file has exactly one owner (named in the first line of the file). If you
didn't write it, ask its owner before editing. Short-lived branches per person
per task (`<person>/<module>`), merged into `develop` at each sync point.
