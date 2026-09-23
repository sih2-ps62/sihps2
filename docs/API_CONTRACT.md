# PolarOps API Contract

Single source of truth for the backend (FastAPI) and frontend (React). This
reflects what is actually implemented in `/backend` — not aspirational.

Base URL (local dev): `http://localhost:8000`

## Shared rules

- Time: ISO 8601 UTC everywhere.
- Errors: every 4xx/5xx body is `{"detail": "message"}`.
- Low-stock rule: `quantity < reorder_threshold` → `status = "low"`.
- Overdue rule: `now - last_checkin > 6h` → personnel `status = "overdue"`.
- Asset health rule: `health_pct < 70` → `warning`; `< 40` → `critical`.
- Geofence rule: distance(personnel, home station) `> 15km` with no check-in
  in the last hour → auto-creates/escalates an emergency incident and flips
  personnel status to `emergency`.
- Correlation rule: an asset in `warning`/`critical` whose
  `awaiting_part_cargo_id` points to delayed cargo emits **one** merged
  `correlated_risk` alert, not two.
- Delay-risk rule: waypoint `eta` passed while `status = pending` → flips to
  `at_risk`.
- Cargo delay: cargo `status = in_transit` with `eta` in the past is "delayed".
- Audit rule: every POST/PATCH writes one `AuditLogEntry`.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Liveness + seed status |
| GET | `/stations` | List bases/ships/camps |
| GET/POST | `/expeditions` | List / create expeditions |
| GET/PATCH | `/expeditions/{id}` | Detail view / update |
| GET/POST | `/cargo` | List / register cargo |
| PATCH | `/cargo/{id}` | Update status / station |
| GET/POST | `/inventory` | List / add stock item |
| PATCH | `/inventory/{id}/adjust` | Adjust quantity (`delta` or `quantity`) |
| GET | `/inventory/alerts` | Items below threshold |
| GET | `/personnel` | Roster with live status |
| POST | `/personnel` | Add personnel |
| POST | `/personnel/{id}/checkin` | Record check-in |
| GET/POST | `/emergency` | List / raise incident |
| PATCH | `/emergency/{id}` | Update status/severity/notes |
| GET/POST | `/assets` | List / register asset |
| PATCH | `/assets/{id}/telemetry` | Push simulated health/runtime reading |
| GET | `/alerts` | Merged, prioritized risk feed |
| GET | `/audit-log` | Filterable, paginated write log |
| GET | `/dashboard/summary` | Aggregated counts + Mission Readiness |
| GET | `/reports/situation` | PDF snapshot of live status |
| POST | `/assistant/query` | Template-matched Q&A over live data |

## Core entities

Station, Expedition, Waypoint, Personnel, CargoItem, InventoryItem,
EmergencyIncident, Asset, AuditLogEntry — see `backend/models.py` for exact
fields. `backend/schemas.py` defines the request/response shapes the frontend
renders.

## Example: correlated alert

```json
{
  "id": "ALT-CORR-AST-GEN07",
  "type": "correlated_risk",
  "severity": "high",
  "message": "Generator GEN-07 at 64% health (WARNING); its replacement part is on cargo CGO-1002, delayed 36.0h.",
  "linked": { "asset_id": "AST-GEN07", "cargo_id": "CGO-1002" },
  "created_at": "2026-09-23T17:32:40Z"
}
```

If the entity list or endpoint shapes change, update this file and the
routers/schemas together in the same change.
