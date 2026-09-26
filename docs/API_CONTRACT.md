# PolarOps — API Contract

**FROZEN at 09:00 Day 1. No field changes without a two-minute team conversation.**

## Shared rules
- All timestamps: ISO 8601 UTC
- Every 4xx/5xx body: `{"detail": "message"}`
- Frontend always maps field names — no raw DB rows rendered

## Entities

| Entity | Owner | Key fields |
|--------|-------|------------|
| Station | Maisha | id, name, type (base/ship/camp), lat, lng, status |
| Expedition | Maisha | id, name, start_date, end_date, status, team_lead_id, waypoints[], personnel_ids[], cargo_ids[], risk_score, risk_factors[] |
| Waypoint | Maisha | id, expedition_id, station_id, sequence, eta, status (pending/reached) |
| CargoItem | Jalak | id, name, category, weight_kg, expedition_id, current_station_id, status (stored/in_transit/delivered) |
| InventoryItem | Jalak | id, name, category, station_id, quantity, unit, reorder_threshold, status (ok/low) |
| Asset | Jalak | id, name, category (vehicle/comms/shelter/medical/power), condition (operational/needs_maintenance/retired), current_holder_type, current_holder_id, last_inspected |
| Personnel | Param | id, name, role, current_station_id, status (at_base/in_transit/on_expedition/overdue/emergency), last_checkin |
| EmergencyIncident | Param | id, type, personnel_id, station_id, severity (low/medium/high), description, status (open/responding/resolved), timestamp, escalated_at |

> Asset in `needs_maintenance` or `retired` is excluded from any "available for assignment" picker.

## Endpoints — 14 total

| Method | Route | Owner |
|--------|-------|-------|
| GET | /health | Param |
| GET | /stations | Maisha |
| GET, POST | /expeditions | Maisha |
| GET, PATCH | /expeditions/{id} | Maisha |
| GET | /expeditions/{id}/risk | Maisha |
| GET, POST | /cargo | Jalak |
| PATCH | /cargo/{id} | Jalak |
| GET, POST | /inventory | Jalak |
| PATCH | /inventory/{id}/adjust | Jalak |
| GET | /inventory/alerts | Jalak |
| GET, POST | /assets | Jalak |
| PATCH | /assets/{id} | Jalak |
| GET | /assets/maintenance-due | Jalak |
| GET | /personnel | Param |
| POST | /personnel/{id}/checkin | Param |
| GET, POST | /emergency | Param |
| PATCH | /emergency/{id} | Param |
| GET | /dashboard/summary | Param |

## Request / response details

Lists are plain JSON arrays. Create returns `201` with the created object. Errors: `400` bad reference / rule violation, `404` unknown id, `409` state conflict, `422` malformed body — always `{"detail": "message"}`.

**GET /expeditions/{id}** — `waypoints[]` are full waypoint objects ordered by `sequence`; `personnel_ids`, `cargo_ids`, `risk_score`, `risk_factors` are computed on read.

**POST /expeditions** — `{name, start_date, end_date, team_lead_id?, personnel_ids?, cargo_ids?, waypoints?: [{station_id, eta?}]}`. `sequence` follows list order.

**PATCH /expeditions/{id}** — any of `name, start_date, end_date, status, team_lead_id, waypoints, personnel_ids, cargo_ids`. Lists replace the whole list. In `waypoints`, an item with `id` keeps that waypoint and updates only the fields sent (e.g. `{"id": "WPT-0002", "status": "reached"}`); an item without `id` is new (needs `station_id`); waypoints left out are removed; order sets `sequence`. `cargo_ids` writes `cargo.expedition_id`.

**GET /expeditions/{id}/risk** — response per the plan's worked example. Factors listed: `weather_severity`, `waypoint_count`, `overdue_personnel_on_route`, `winter_season` (zero contributions omitted; they sum to `risk_score`). Route weather = worst weather among waypoint stations. Optional simulation params: `?weather_code=clear|cloudy|snow|high_wind|blizzard` and `?season=summer|winter` (this is what "change a weather input live" uses).

**PATCH /inventory/{id}/adjust** — body is exactly one of `{"delta": -50}` (signed change) or `{"quantity": 30}` (absolute). Would-go-negative is `400`. Response is the updated item with recomputed `status`.

**GET /inventory/alerts** — `InventoryItem[]` with `status: "low"`, most depleted first.

**PATCH /assets/{id}** — any of `condition, current_holder_type, current_holder_id, last_inspected`. Moving a non-operational asset to an expedition is `409`.

**POST /personnel/{id}/checkin** — no body. Returns the updated person; overdue is cleared back to the status held before going overdue.

**POST /emergency** — `{type, personnel_id?, station_id?, severity?, description?}`; at least one of `personnel_id` / `station_id`. `station_id` defaults to the person's station. Raising an incident for a person sets them to `emergency`; resolving their last active incident restores their previous status.

**PATCH /emergency/{id}** — `{"status": "responding" | "resolved"}`; moving backwards is `409`. Escalation history (`escalated_at`) is kept after resolution.

**GET /dashboard/summary**
```json
{
  "active_expeditions": 1, "cargo_in_transit": 2, "low_stock_items": 3,
  "overdue_personnel": 1, "active_emergencies": 1,
  "escalated_emergencies": 0, "maintenance_due_assets": 2,
  "generated_at": "2026-09-26T09:30:00Z"
}
```
The first five are the stat-card row. `active_emergencies` = not resolved.

**GET /health** — `{"status": "ok", "seeded": true, "time": "..."}`

Additive list filters (all optional): `/expeditions?status=`, `/cargo?status=&expedition_id=&station_id=`, `/inventory?station_id=&status=`, `/assets?condition=&available=true&holder_type=&holder_id=` (`available=true` = operational only — use it for the assignment picker), `/personnel?status=&station_id=`, `/emergency?status=`.

## Rule thresholds (server-side, env-tunable for demos)
- Overdue check-in: 6h (`POLAROPS_OVERDUE_HOURS`). Personnel in `emergency` are exempt.
- Emergency escalation: 2h (`POLAROPS_ESCALATION_HOURS`); one level per window, the window restarts at `escalated_at`.
- Start the API with e.g. `POLAROPS_ESCALATION_HOURS=0.02 uvicorn main:app` to make escalation happen live in a demo.

## Frontend API (`/api`) — Day 2-3 addition

The React app talks to a second set of routes mounted at `/api`. They run on the same database and rules as the
plan's endpoints above (which are unchanged) and translate to the vocabulary the frontend was designed around.

- **Auth:** every route needs `Authorization: Bearer <token>` except `POST /api/auth/login` and `GET /api/health`.
  Tokens are signed JWTs valid for 12 h. Roles: `duty_officer` (create / edit) and `admin` (also delete → otherwise `403`).
- **Errors:** `{"error": "message", "detail": "message"}` (same text under both keys). The plan endpoints still return only `detail`.
- **Sign-in brake:** 5 failed sign-ins for the same account from the same address within 60 s → `429` with a `Retry-After` header until the window passes.
- **CORS:** only the frontend's origin is allowed by default (`POLAROPS_CORS_ORIGINS` to change).
- **Lists:** `GET /api/<resource>?page=&pageSize=&sort=&order=&q=` → `{"data": [...], "total", "page", "pageSize", "totalPages"}`.
  `pageSize` is capped at 100; an unknown `sort` falls back to the default. Single records and writes return `{"data": {...}}`; deletes return `204`.
- **Timestamps:** `YYYY-MM-DD HH:MM:SS` in UTC with **no** `Z` (the frontend appends it); dates are `YYYY-MM-DD`.

| Route | Notes |
|-------|-------|
| `POST /api/auth/login` · `GET /api/auth/me` | `{email, password}` → `{token, user}` |
| `GET /api/stations` | `{data: [{id, name, region, lat, lng, type, status}]}` (region derived from latitude) |
| `/api/expeditions` (+ `/{id}`) | filters `status`, `region`; waypoints are a list of station ids; also returns `risk_score`, `risk_band`, `risk_factors` |
| `/api/cargo` (+ `/{id}`) | filter `status`; `manifest_id` is unique (`409`) |
| `/api/inventory` (+ `/{id}`) | filters `category`, `lowStock=true`, `needsMaintenance=true`; PATCH re-runs the low-stock rule |
| `/api/personnel` (+ `/{id}`, `POST /{id}/checkin`) | filter `status` |
| `/api/emergencies` (+ `/{id}`) | filter `status`; PATCH `{"status": "Resolved"}`; a resolved incident cannot be reopened (`409`) |
| `GET /api/stats` · `GET /api/analytics` | numbers and chart series for the stat strips and Analytics page |
| `GET /api/audit-log` | filters `action`, `resourceType`, `q`; every `/api` create / update / delete is recorded |
| `POST /api/assistant/chat` | `{message}` → `{reply, source}`; Gemini when `GEMINI_API_KEY` is set, built-in engine otherwise |

**Vocabulary mapping** (frontend ↔ plan):

| | Frontend | Plan |
|---|---|---|
| Expedition status | Planned · Active · Completed | planned · in_progress · completed |
| Cargo status | Pending · In Transit · Delivered · Delayed | stored · in_transit · delivered · delayed |
| Personnel status | In Field · On Leave · Base | on_expedition/in_transit · on_leave · at_base (`overdue` and `emergency` stay underneath as overlays on the status held before them) |
| Emergency severity | critical · warning · resolved | high · low/medium · (status resolved) |
| Emergency status | Open · Resolved | open/responding · resolved |

Where this differs from the frontend team's own handoff document (`frontend/docs/PolarOps-Handoff-Guide.pdf`, written for their
Node backend): every route except sign-in needs a token (theirs left GETs public); the assistant answers with the built-in engine
and `200` when Gemini is unavailable (theirs returned `502`); `GET /api/emergencies/{id}` exists; and a new person starts
"just checked in" (theirs left `last_checkin` empty, which showed as overdue immediately).

"Low stock" in the frontend means quantity **at or below** the threshold; the plan's `/inventory/alerts` rule is
strictly **below**. The two only differ when quantity equals the threshold.

## Contract drift log
| Date | Change | Approved by |
|------|--------|-------------|
| 2026-09-25 | Added optional query filters on list endpoints (see above) — additive, no field changes | pending team ack |
| 2026-09-25 | `/expeditions/{id}/risk` accepts optional `weather_code` / `season` simulation params — additive | pending team ack |
| 2026-09-25 | `/dashboard/summary` and `/inventory/{id}/adjust` request/response shapes fixed (plan left them open) | pending team ack |
| 2026-09-25 | `Station.weather_code` exists server-side only (simulated feed for risk score); not returned by `/stations` | pending team ack |
| 2026-09-26 | `/api` frontend API added (above) — new routes only, no change to existing routes | Day 2-3 integration |
| 2026-09-26 | `CargoStatus` gains `delayed`; `PersonnelStatus` gains `on_leave` (exempt from the overdue rule) — additive values | Day 2-3 integration |
| 2026-09-26 | `ExpeditionOut.end_date` and `InventoryOut.station_id` may now be `null` (open-ended expeditions, unassigned stock) | Day 2-3 integration |
| 2026-09-26 | New columns behind the scenes: expeditions `region`, `team_lead_name`; cargo `manifest_id`, `origin`, `destination`, timestamps; inventory `needs_maintenance`, timestamps; emergency `resolved_at` (set by both PATCH paths). Not returned by the plan endpoints. | Day 2-3 integration |
| 2026-09-26 | New tables `users`, `audit_log`. An outdated `polarops.db` now stops startup with "run python seed.py"; an empty database seeds itself (`POLAROPS_AUTOSEED=0` to disable). | Day 2-3 integration |
| 2026-09-26 | `cargo_items.manifest_id` is now `UNIQUE` in the database (nulls allowed); `/api/cargo` still answers a clash with `409` | Day 2-3 integration |
| 2026-09-26 | CORS default narrowed from `*` to the frontend origin; `/api/auth/login` throttled (429); `JWT_SECRET` accepted as an alias of `POLAROPS_JWT_SECRET`; `/api/audit-log` lists newest first by default | Day 2-3 integration |
