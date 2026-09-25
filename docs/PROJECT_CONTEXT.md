# PolarOps — Project Context & Handoff

Integrated Polar Expedition Logistics & Asset Management System (PS 26062).
3-day build, Fri 25 – Sun 27 Sep 2026. This file is the single place to learn
what exists, what changed, and what's left. Endpoint payloads live in
[`API_CONTRACT.md`](API_CONTRACT.md); setup lives in the root `README.md`.

_Last updated: end of Day 1 — backend complete, frontend not started._

---

## 1. Where we are

| Area | Owner(s) | State |
|------|----------|-------|
| Backend API (24 method+route pairs), SQLite persistence | Maisha, Jalak, Param | **Done** |
| Rule engine (low-stock, overdue check-in, route risk, escalation) | Jalak / Param / Maisha | **Done** |
| Seed data, contract doc, backend tests (43) | Param | **Done** |
| Shared UI kit (`components/ui/*`) + `services/api.js` | Shrey | **Not started** (stubs) |
| Expedition Planner, Cargo Tracker, Personnel Tracker | Shrey | **Not started** (stubs) |
| Command Dashboard, Alerts Feed, page shell + nav | Akshit | **Not started** (stubs / old shell) |
| Map, Inventory Manager + Asset tab, Emergency Panel | Tanvi | **Not started** (stubs) |

**The backend is live and stable — frontend work can go straight against the
real API.** There is no need to build against dummy JSON first; the "mock
data" steps in the original plan were only there to unblock parallel work.

---

## 2. What changed since the first version

The repo began as a full working system (first commit), was reset to a clean
per-owner skeleton (scaffold commit), and the backend was then built on the
skeleton. Things you need to know:

### Backend legacy code was deleted
These pre-scaffold files were removed because they duplicated the new
structure (two SQLAlchemy `Base`s, flat `models.py` vs `models/` package):
`database.py`, `models.py`, `rules.py`, `audit.py`, `ids.py`, `reports.py`,
`routers/alerts.py`, `routers/assistant.py`, `routers/audit_log.py`,
`routers/reports_router.py`. They are still in git history
(`git show b41e787:backend/<file>`) if you want to salvage logic.

### Features from the first version that no longer exist
They are not in the 3-day plan, so the clean-slate backend does not have them:

- Geofencing and the simulated GPS/position feed
- Asset health % / telemetry (`pushTelemetry`) — assets now have a `condition` instead
- Cross-system correlated alerts, delay-risk, Mission Readiness score
- Audit log, PDF Situation Report, Command Assistant
- Their endpoints: `/alerts`, `/assistant`, `/audit-log`, `/reports`

Alerts are now assembled **on the frontend** from three existing endpoints
(see §6, Akshit).

### Frontend legacy files are still in the repo (decision needed)
The first version's frontend was **not** removed. It sits next to the new
stubs and is currently what `App.jsx` routes to. See §5 for the list and a
suggested clean-up — please agree who deletes what before Day 2.

### Backend decisions and deviations from the plan
| Topic | What we did | Why |
|-------|-------------|-----|
| Persistence | Went straight to real SQLite for everything | Mock-then-swap only helps parallel humans |
| Escalation window | Restarts from `escalated_at` (one level per 2h) | As written it would jump straight to `high` on the next read |
| Overdue check-in | People in `emergency` are exempt; check-in restores their previous status | Otherwise overdue would mask an emergency, and check-in wouldn't know what to restore |
| Risk score | Follows the plan's rule (+20 if any overdue crew), not the worked example (which shows 8) | The rule text is the spec; the example was illustrative |
| Winter | April–October (Antarctic wintering season) | Plan says `season == "winter"` without defining it |
| Weather | `weather_code` lives on each **station** server-side, not in the API | Contract is frozen; risk endpoint takes `?weather_code=` / `?season=` to simulate live |
| Assets | Moving a non-operational asset onto an expedition returns `409` | Backs the "needs_maintenance drops out of assignment" demo server-side too |
| Emergency personnel | Raising an incident sets the person to `emergency`; resolving their last active incident restores their previous status | Keeps the roster consistent with incidents |

All additive changes are in the drift log at the bottom of
[`API_CONTRACT.md`](API_CONTRACT.md) and are **pending team acknowledgement**.

---

## 3. Repo layout

```
/backend
  main.py            app wiring, CORS, error handlers, /health   (Param)
  db.py              engine, session, id + UTC helpers            (Param)
  schemas.py         Pydantic request/response shapes             (Param)
  seed.py            wipes + repopulates demo data                (Param)
  models/            one ORM file per entity                      (owner in file header)
  routers/           one file per module, matches the contract
  rules/             one file per rule, pure logic + evaluators
  tests/             test_rules.py (pure), test_api.py (end-to-end)
  conftest.py        throwaway-DB test fixtures
/frontend            React + Vite + Tailwind + Leaflet
/docs                API_CONTRACT.md, PROJECT_CONTEXT.md
```

Every file's first line names its owner. If it isn't yours, ask before editing.

---

## 4. Backend — what's built

Run: `cd backend && python seed.py && uvicorn main:app --reload --port 8000`.
Swagger UI at `/docs` lists everything and lets you try calls.

### Modules and endpoints
| Module | Owner | Endpoints |
|--------|-------|-----------|
| Health | Param | `GET /health` |
| Stations | Maisha | `GET /stations` |
| Expeditions | Maisha | `GET, POST /expeditions` · `GET, PATCH /expeditions/{id}` · `GET /expeditions/{id}/risk` |
| Cargo | Jalak | `GET, POST /cargo` · `PATCH /cargo/{id}` |
| Inventory | Jalak | `GET, POST /inventory` · `PATCH /inventory/{id}/adjust` · `GET /inventory/alerts` |
| Assets | Jalak | `GET, POST /assets` · `PATCH /assets/{id}` · `GET /assets/maintenance-due` |
| Personnel | Param | `GET /personnel` · `POST /personnel/{id}/checkin` |
| Emergency | Param | `GET, POST /emergency` · `PATCH /emergency/{id}` |
| Dashboard | Param | `GET /dashboard/summary` |

### The four rules
| Rule | File | Runs when | Logic |
|------|------|-----------|-------|
| Low stock | `rules/low_stock.py` | on inventory create + adjust | `quantity < reorder_threshold` → `low`, else `ok` (equal is `ok`) |
| Overdue check-in | `rules/overdue_checkin.py` | lazily on `GET /personnel`, dashboard, expedition reads | no check-in for >6h → `overdue` |
| Route risk | `rules/risk_score.py` | on expedition reads and `/risk` | weather×30 + min(waypoints×5, 20) + 20 if overdue crew + 10 if winter; band <34 low, <67 medium, else high |
| Escalation | `rules/escalation.py` | lazily on `GET /emergency` and dashboard | open >2h → severity +1 level, `escalated_at` set |

Rules are evaluated on reads, so the dashboard and lists are always current
without a background worker.

### Seed data (what you'll see on a fresh `seed.py`)
- Stations: Bharati, Maitri (bases), MV Polar Resolve (ship), Camp Alpha, Camp Bravo (camps)
- `EXP-0001` in progress, blizzard route, one overdue crew member → risk **high**
- `EXP-0002` planned, calm route → risk **low**; `EXP-0003` completed
- 3 low-stock items, 2 assets `needs_maintenance` + 1 `retired`, 2 cargo `in_transit`
- `INC-0001` resolved (had escalated → shows history), `INC-0002` open

### Known limitations
- No authentication; CORS is open (`*`) — fine for a demo, not for production
- Stations are read-only (no create endpoint in the contract)
- No delete endpoints
- Emergency incidents have **no resolution-notes field** — see open questions
- Ids are generated as max+1; two simultaneous creates could clash (not an issue at demo scale)

---

## 5. Frontend — current state

### What exists
- Vite + React 18 + Tailwind + `react-leaflet` are installed and configured
  (`frontend/package.json`); dark palette is in `tailwind.config.js`
- **Recharts is NOT installed** (the plan calls for it): `npm install recharts`
- `frontend/.env` → `VITE_API_URL=http://localhost:8000`

### New per-owner stubs (comment-only, return `null`)
`components/ui/{Card,Empty,Error,Loading,StatusBadge,Table}.jsx`,
`services/api.js`, and `pages/{Dashboard,AlertsFeed,Map,ExpeditionPlanner,CargoTracker,Personnel,InventoryManager,Emergency}.jsx`.
These are what you are building — each has its owner and component notes in
the header.

### Legacy files from the first version (still present)
| File | What it is | Suggested handling |
|------|-----------|--------------------|
| `services/api.js` (old, in git history: `git show b41e787:frontend/src/services/api.js`) | Fetch wrapper with timeout + `{detail}` error handling — **good base for Shrey's adapter** | Port the `request()` core, rewrite the method list for the current contract |
| `hooks/useFetch.js` | Loading/data/error/reload hook — **works as-is**, keep | Keep, everyone can use it |
| `components/States.jsx`, `StatusBadge.jsx`, `StatCard.jsx` | Old loading/empty/error, badge, stat card | Port into `components/ui/*` (Shrey), then delete |
| `components/Navbar.jsx`, `App.jsx` | Working `?page=` shell + sidebar | Akshit: keep the pattern, repoint to the new pages and nav labels |
| `components/PolarMap.jsx` | Leaflet map with markers/polylines | Tanvi: reference for `pages/Map.jsx` |
| `pages/Cargo.jsx`, `Expeditions.jsx`, `Inventory.jsx`, `Assets.jsx` | Full old screens | Reference for `CargoTracker`, `ExpeditionPlanner`, `InventoryManager` (+ Asset tab) |
| `pages/AuditLog.jsx`, `components/Assistant.jsx`, `components/ReadinessBar.jsx` | Depend on removed features | **Delete** |

**Important:** the old pages call the *old* API (`api.getAlerts`,
`api.pushTelemetry`, `api.getAuditLog`, `api.askAssistant`, …) and import
`{ api }` from `services/api.js`. Until `services/api.js` exports a working
`api`, **the frontend does not compile** (verified end of Day 1:
`npm run build` fails with `"api" is not exported by "src/services/api.js"`).
Treat the old pages as reference code only and check every field against
`API_CONTRACT.md` before reusing.

---

## 6. What's left

### Frontend (nobody has started — start against the live API)

**Shrey — shared kit first, everyone is waiting on it**
1. `npm install recharts`; write `services/api.js` (base URL from `VITE_API_URL`, always surface the `detail` string as the error message, export a single `api` object). This unblocks the whole frontend.
2. Shared UI kit: `StatusBadge` (must colour all status values: stored/in_transit/delivered, ok/low, operational/needs_maintenance/retired, at_base/in_transit/on_expedition/overdue/emergency, open/responding/resolved, low/medium/high), `Card`, `Table`, `Loading`/`Empty`/`Error` (Error needs a retry button). Also export a `riskBand(score)` helper — see gotchas.
3. **Expedition Planner** — filterable list, create/edit form (waypoint sequence picker, personnel/cargo assignment), detail with waypoint timeline, status controls, risk-score badge.
4. **Cargo Tracker** — board/table by status, detail card, create/update form, filter by expedition or station.
5. **Personnel Tracker** — roster, one-click check-in that visibly clears overdue, five status badges.
6. Day 2: loading/empty/error on all three, dark-theme pass.

**Akshit — shell, dashboard, alerts**
1. Page shell + nav: keep `?page=` routing in `App.jsx`, repoint `PAGES` and `Navbar` to the new pages (Dashboard, Expedition Planner, Cargo Tracker, Inventory Manager, Personnel, Emergency; drop Audit).
2. **Command Dashboard** — the 5 stat cards from `GET /dashboard/summary` (`active_expeditions`, `cargo_in_transit`, `low_stock_items`, `overdue_personnel`, `active_emergencies`), embeds Tanvi's `Map`, quick-nav into each module.
3. **Alerts Feed** — merge three sources client-side: `GET /inventory/alerts` (low stock), `GET /personnel?status=overdue`, `GET /emergency` filtered to not-resolved. Escalated incidents (`escalated_at != null`) go to the **top**.
4. Day 2: live data only, consistent green/amber/red for risk bands and statuses across Dashboard + Map, dark theme + responsive pass.

**Tanvi — map, inventory + assets, emergency**
1. **Map** — markers from `GET /stations` (`lat`, `lng`, `type`), route polylines from each expedition's `waypoints[]` (look up each `station_id` in the stations list, join in `sequence` order), colour by risk band. Reference: `components/PolarMap.jsx`.
2. **Inventory Manager** — per-station stock table, amber/red rows for `status: "low"`, adjust form (send `{"delta": n}` or `{"quantity": n}`).
3. **Asset tab** — table with condition, holder, last inspected; condition-change action; maintenance-due filter (`GET /assets/maintenance-due`); the assignment picker must use `GET /assets?available=true`.
4. **Emergency Panel** — raise form, active list with open → responding → resolved workflow, escalated incidents visually distinct, de-emphasised dismiss (= `PATCH` straight to `resolved`).
5. Day 2: everything live, full emergency workflow.

### Backend (small — mostly Day 2 polish)
- **Maisha** — calibrate risk weights with Akshit/Tanvi once the badge is on screen (constants at the top of `rules/risk_score.py`); waypoint-timeline polish if the Planner needs another field.
- **Jalak** — responsive check with Shrey; `GET /inventory/rebalance-suggestions` is **optional and first on the cut list** — do not let it into required scope.
- **Param** — keep `API_CONTRACT.md` current as drift appears; get the drift-log items acknowledged; final README setup steps on Day 3.
- **Everyone** — answer frontend questions quickly; if the frontend needs a field the API doesn't have, that's a contract conversation, not a quiet change.

### Team-wide
- Sync #1 (13:00), #2 (18:00) today; #3 and #4 on Day 2; bug-bash Day 3 09:00, feature freeze 11:00.
- Decide who deletes the legacy frontend files (§5) before Day 2.
- Pitch deck needs the REAL / SIMULATED / ROADMAP slide — the honesty table is in the root `README.md`.

---

## 7. Gotchas for the frontend (read before wiring)

- **Field names are snake_case**; the plan says the service layer maps them — do it once in `api.js`, not in components.
- **Timestamps** are ISO 8601 UTC ending in `Z` (`last_checkin`, `eta`, `timestamp`, `escalated_at`, `generated_at`). **Dates** (`start_date`, `end_date`, `last_inspected`) are plain `YYYY-MM-DD`.
- **Errors** are always `{"detail": "message"}` — a plain string, including validation failures (`422`). Show it as-is. `409` means a rule conflict (e.g. assigning a needs-maintenance asset, moving an incident backwards).
- **`GET /expeditions` returns `risk_score` and `risk_factors` but no `risk_band`.** Compute the band client-side: `<34` low, `<67` medium, else high. `GET /expeditions/{id}/risk` does return `risk_band`.
- **Expedition `cargo_ids` / `personnel_ids` are full replace** when sent in a `PATCH`. Send the complete list, not a diff. Setting `cargo_ids` reassigns cargo to that expedition.
- **Waypoint edits go through `PATCH /expeditions/{id}`** — send the whole `waypoints` array; items with an `id` are kept (only supplied fields change, e.g. `{"id":"WPT-0002","status":"reached"}`), items without one are new, omitted ones are deleted. List order sets `sequence`.
- **Personnel and incident state is computed on read** — refetch after a check-in / status change instead of patching local state.
- **Filters** are optional query params: `/expeditions?status=`, `/cargo?status=&expedition_id=&station_id=`, `/inventory?station_id=&status=`, `/assets?condition=&available=true&holder_type=&holder_id=`, `/personnel?status=&station_id=`, `/emergency?status=`.
- **Live demo of "change weather, watch the score move":** call `GET /expeditions/{id}/risk?weather_code=blizzard` (values: `clear, cloudy, snow, high_wind, blizzard`; optional `season=summer|winter`).
- **Id formats:** `EXP-0001`, `WPT-0001`, `CGO-0001`, `INV-0001`, `AST-0001`, `INC-0001`, `PER-001`; stations are slugs like `STN-BHARATI`.

---

## 8. Acceptance matrix rows 11–15 and the demo script

Backend support status for the extended test matrix (all have automated tests in `backend/tests/test_api.py`):

| # | Test | Backend | Frontend must |
|---|------|---------|---------------|
| 11 | Asset → `needs_maintenance` disappears from assignment list | Done (`?available=true`, `409` guard) | Use `?available=true` for every asset picker |
| 12 | `/assets/maintenance-due` only returns `needs_maintenance` | Done | Asset tab maintenance-due filter |
| 13 | Risk differs for bad-weather vs calm route | Done (`EXP-0001` high vs `EXP-0002` low) | Show the score + colour badge |
| 14 | Open incident past threshold escalates, `escalated_at` set, tops the feed | Done (shorten with `POLAROPS_ESCALATION_HOURS`) | Sort escalated to top of Alerts Feed |
| 15 | Resolved-after-escalation stays resolved, history visible | Done | Show `escalated_at` on resolved incidents |

Demo order (from the plan) → what drives each step: 1 honesty slide → 2 dashboard
(`/dashboard/summary`) → 3 create expedition + `/risk?weather_code=` → 4 cargo
`PATCH` status → 5 inventory `adjust` → 6 asset `PATCH` condition → 7 overdue
check-in (shorten `POLAROPS_OVERDUE_HOURS`) → 8 emergency raise → escalate →
resolve → 9 back to dashboard. Keep the backup video ready for steps 3 and 6.

---

## 9. Open questions for the team

1. **Resolution notes** — the Emergency Panel spec mentions them, but `EmergencyIncident` has no such field. Either drop from the UI or add `resolution_notes` to the contract (Param, ~10 min backend change).
2. **Drift log** — four additive items need a "yes" from the frontend trio (filters, `/risk` simulation params, dashboard/adjust shapes, server-side weather).
3. **Legacy frontend clean-up** — who deletes which files, and when (§5).
4. **Where assets get assigned to an expedition in the UI** — the plan only specifies the Asset tab's condition-change action; decide whether the holder change also lives there.

---

## 10. Conventions

- One owner per file; heads-up in team chat before touching anyone else's file. Conflicts on a shared file are resolved by that file's owner.
- Branches: `<person>/<module>`, short-lived, merged into `develop` at each sync; `main` only gets merges from `develop` at end of day (tags `day1-eod`, `day2-eod`, `day3-final`).
- Never commit `venv/`, `node_modules/`, `__pycache__/`, `*.db`, `.env`.
- Every screen renders three states beyond its data: **loading, empty, error (with retry)**.
- Nothing in the UI is hardcoded; if a screen needs a field the backend doesn't return, that's a contract change in `API_CONTRACT.md` first.
- Contract is frozen: no field changes without a two-minute conversation, and log it in the drift log.

## 11. Quick URLs (both servers running)

```
http://127.0.0.1:8000/docs                    Swagger UI (try any endpoint)
http://127.0.0.1:8000/health
http://localhost:5173/?page=dashboard
```
