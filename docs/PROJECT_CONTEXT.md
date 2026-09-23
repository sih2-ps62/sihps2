# PolarOps — Project Context

Integrated Polar Expedition Logistics & Asset Management System (PS 26062).

## Repo layout

```
/backend    FastAPI + SQLite — all business logic and the rule engine
/frontend   React + Vite + Tailwind + Leaflet
/docs       API_CONTRACT.md (frozen contract), this file
```

## Running locally

See root `README.md` for the two-terminal quick start.

## Backend structure

- `main.py` — app wiring, CORS, error handlers, router registration
- `database.py` — SQLAlchemy engine/session (SQLite file `polarops.db`)
- `models.py` — ORM models for all 9 entities
- `schemas.py` — Pydantic request/response shapes (the contract)
- `rules.py` — the rule engine: low-stock, overdue, asset-health, geofence,
  correlation, delay-risk, auto-incident creation, Mission Readiness scoring
- `audit.py` — writes one `AuditLogEntry` per mutation
- `ids.py` — sequential human-readable ID generation (`EXP-0001`, ...)
- `reports.py` — PDF situation report (ReportLab)
- `routers/*.py` — one file per module, matching `docs/API_CONTRACT.md`
- `seed.py` — wipes and repopulates demo data; **run this after any schema
  change**, since it also resets the ID counters

## Frontend structure

- `src/services/api.js` — the only file that calls `fetch()`; every screen
  goes through it
- `src/hooks/useFetch.js` — shared loading/error/data pattern
- `src/components/` — Navbar, StatusBadge, States (loading/empty/error),
  StatCard, ReadinessBar, PolarMap (Leaflet), Assistant (chat panel)
- `src/pages/` — one file per screen: Dashboard, Expeditions, Cargo,
  Inventory, Personnel, Emergency, Assets, AuditLog
- Routing is a plain `?page=` query param (see `App.jsx`) — no router
  dependency, matching the quick-start URLs below

## Conventions

- IDs are prefixed strings (`STN-`, `EXP-`, `CGO-`, `INV-`, `PER-`, `INC-`,
  `AST-`, `WPT-`, `ALOG-`). Stations and seeded assets use descriptive slugs
  (`STN-BHARATI`, `AST-GEN07`); everything created via the API gets a
  sequential number from `ids.next_id()`.
- Every screen renders three states beyond its data: loading, empty, error
  (with retry) — never a blank crash.
- Nothing in the UI is hardcoded; if a screen would need a field the backend
  doesn't return, that's a contract change in `docs/API_CONTRACT.md` first.
- Position feed and weather are the two explicitly simulated inputs; every
  other number comes from the live SQLite database.

## Quick URLs once both servers are running

```
http://127.0.0.1:8000/docs                    Swagger UI
http://localhost:5173/?page=dashboard
http://localhost:5173/?page=expeditions
http://localhost:5173/?page=cargo
http://localhost:5173/?page=inventory
http://localhost:5173/?page=personnel
http://localhost:5173/?page=emergency
http://localhost:5173/?page=assets
http://localhost:5173/?page=audit
```
