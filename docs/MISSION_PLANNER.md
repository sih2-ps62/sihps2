# Mission Planner: endurance and disruption recovery

Open **Mission Planner** in the sidebar or from Inventory. The page has three sections: Scenario lab, Planning inputs, and Saved drafts. Both themes and reduced-motion preferences are supported.

This release implements the first two proposed additions: station endurance forecasting and a What-If Mission Planner. Backup coverage rules and full mission decision replay remain a later phase. Saved recovery drafts do preserve their own inputs and calculations.

## A two-minute SIH demonstration

1. Open Mission Planner and select **Training**. The clearly labelled exercise uses fictional records in memory, independently of operational inventory, people and missions. No reseed is needed.
2. Click **Reset to baseline**. Aurora field camp has 260 L of fuel, a 40 L protected reserve, 40–50 L/day consumption and a 500 L delivery expected on day 3.5. The baseline stays above reserve for the 14-day horizon.
3. Click **72h delay**, or move the delay slider. The arrival moves to day 6.5. Fuel reaches reserve on day **4.4** at maximum consumption, or **5.5** at minimum consumption. A later delivery does not erase that earlier breach.
4. Select **Transfer 500 L of Diesel**. The approved 12-hour traverse, plus the simulated 72-hour delay, arrives on day 3.5. A third line previews the recovery. The donor stays above its reserve throughout the horizon. No transfer has been executed.
5. Try **Route closure**, or make the Supply tractor unavailable. The transfer option disappears and the reason appears on the supply connection. Make the Survey snowmobile unavailable to see the expedition dependency and a same-category replacement candidate for review.
6. Restore **72h delay**, select a transfer, enter a draft title and reason, and click **Save recovery draft**. Open it in Saved drafts. Its original assumptions remain available after refreshing. **Download plan** exports a Markdown handover document.

## Configure operations

Existing databases receive four new tables on backend startup. No existing inventory, expedition or personnel data is rewritten. Operations initially shows unknown forecasts until inputs are configured.

- **Consumption & reserves:** select a station inventory item, enter minimum/maximum daily use in its own units, protected reserve, and a source/assumption note. For per-person rates enter a verified planning headcount. Occupancy stays constant for this forecast; station check-ins are not treated as proof of physical presence. Assumptions older than seven days are flagged for review.
- **External arrivals:** record quantity, ETA in UTC, an optional transport asset and a source note. These are external supplies not already included in another station's current stock. Past-due arrivals are excluded until their ETA is revised or receipt is confirmed. Received/cancelled entries are excluded. Update operational stock separately in Inventory on receipt; this planning screen does not receive stock automatically.
- **Approved supply links:** choose matching inventory names, categories and units at two different stations, a vehicle, mode, declared travel time, one-trip capacity and an approval reference. Explicitly enable the approved link. Links can be edited or disabled. The system uses entered transport approval; it does not infer safe travel from coordinates.

Scenario controls support 7/14/30-day horizons, 0–168 hours of delay, a selected delay destination (or all), one closed link, one unavailable asset and one unavailable person. Multiple types of disruption can be combined. Delay affects external arrivals and proposed transfer travel to affected destinations. Link closure affects the proposed transport link; external arrivals have their own ETA and optional asset assignment, not an inferred route. A closed station pair also raises a mission route-review warning without assuming the expedition uses the same transport mode.

## Calculation rules

The engine integrates linear consumption exactly between dated arrivals, sampling daily and immediately before/after each delivery. It reports the **first** reserve crossing at both consumption bounds, and the first stockout under maximum consumption. The range is an input sensitivity range, not a statistical confidence interval. A null crossing means no crossing within the chosen horizon, never unlimited supplies. Zero consumption is supported; missing consumption is **unknown**, not zero.

Projected balances can be negative to represent unmet demand. Outstanding demand remains in the arithmetic after an arrival; a shipment cannot retroactively satisfy a missed reserve requirement. These are conditional projections, not guarantees of delivery or survival.

Transfer alternatives require:

- A matching, enabled, operator-approved link and operational endpoint stations.
- An operational vehicle currently held at the source station, available in the scenario, not reserved for an open emergency, and not assigned to another expected arrival.
- Consumption and reserve inputs at both ends.
- A quantity within the recorded one-trip capacity and current donor stock, preserving the donor's reserve at every point in the forecast.
- Arrival strictly before the first projected destination reserve breach, with the simulated destination delay included.

Alternatives are assessed **independently**, not as a simultaneous dispatch programme. Selecting one overlays its target-stock forecast. Options do not reserve stock or vehicles. Crew availability for a transfer, driver qualifications, task suitability, vehicle fuel burn, terrain, sea ice, route-specific weather limits and multiple-trip scheduling are not modelled and must be checked before dispatch. Same-category asset replacements are labelled candidates for review, not certified substitutes. Mission warnings cover supply/resource dependencies across the horizon, not precise exposure at each waypoint ETA; launch decisions remain with existing departure controls.

## Draft integrity and access

All `/api/planning` endpoints require sign-in. Configuration writes are audited. Simulation reads operational records without mutating them. It does not read medical profiles or clinical grants.

Saving a draft recomputes the selected option on the server. It rejects an altered data fingerprint, missing option, or forecast older than ten minutes with HTTP 409. SQLite write serialization prevents a concurrent operational update between the final comparison and draft commit. The persisted JSON snapshot contains planning inputs, scenario, calculation, selected option, officer name and review reason. Training drafts are explicitly tagged and remain separate proposals. They never create operational inventory or reservations.

The UI never queues planner writes or calculations in simulated blackout mode. Failures are shown and no queued request is represented as a completed forecast or draft. Saved drafts are records for review, not cryptographically tamper-proof evidence, approvals or executed transfers.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/planning/context?training=false` | Current planning inputs and relevant operational resources |
| `POST /api/planning/simulate` | `{training, scenario}` → baseline, scenario, station outlook, dependencies and options |
| `POST /api/planning/profiles/{inventory_id}` | Upsert consumption assumptions |
| `POST /api/planning/arrivals` / `PATCH /api/planning/arrivals/{id}` | Create/edit external supply ETA and status |
| `POST /api/planning/links` / `PATCH /api/planning/links/{id}` | Create/edit approved transport link |
| `POST /api/planning/drafts` | Save a revalidated option with title, reason, scenario, timestamp and input fingerprint |
| `GET /api/planning/drafts` / `GET /api/planning/drafts/{id}` | Recent draft summaries / original saved snapshot |

## Verification

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest -q
cd ../frontend
npm test
npm run lint
npm run build
npm run test:e2e
```

Tests use temporary databases. Planning tests cover exact pre-arrival crossings, uncertainty ranges, missing/zero inputs, delayed/completed arrivals, donor reserve protection, unit mismatch, failed/reserved/elsewhere transport, replacement candidates, authentication, input validation, stale snapshots, durable drafts and non-mutation of operations. Browser tests configure actual inputs, simulate and compare recovery, reject a stale save, persist/reopen/download a draft, and check both themes and mobile overflow.
