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

## Contract drift log
| Date | Change | Approved by |
|------|--------|-------------|
| | | |
