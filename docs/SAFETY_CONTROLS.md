# PolarOps safety controls and SIH demonstration

The React app uses `/api` on FastAPI. The older unprefixed API shares the same SQLite models. Launch, buddy and check-in controls live in `backend/safety.py` and are applied by both expedition/check-in APIs. They are server decisions: changing a disabled button or making a direct HTTP request cannot bypass them.

## What was added

| Control | Behavior | Where to demonstrate |
| --- | --- | --- |
| Buddy enforcement | Launch and a new reached waypoint require at least two distinct assigned people whose operational status is `on_expedition` or `in_transit`, with a recent check-in. Overdue, emergency and on-leave people do not count. An active expedition cannot save a crew reduction below two. | Expedition detail → Departure control / Waypoint progress |
| Go/No-Go gate | All assigned people must have recent check-ins and be available, all assigned assets must be operational, a medical asset must explicitly be designated as the emergency kit on the manifest, and a route must exist. Crew cannot launch on another active expedition or while reserved for an incident. | Expedition detail → Crew & equipment manifest |
| Route deviation | A station report is compared with the next pending waypoint on each active expedition assigned to that person. A mismatch becomes a persisted, reviewable alert with expected/actual station and timestamp. It never moves a waypoint automatically. | Personnel detail → Report a station check-in; then expedition, dashboard feed or Emergency |
| Resource conflicts | An asset or responder cannot be assigned to two open/responding incidents. UI shows the competing incident IDs; the server rejects the conflicting write with `409`. Resolution releases reservations while preserving assignment history. SQLite write reservations serialize concurrent requests. | Open case → Response resources |
| Critical-info card | Blood type, allergies and conditions are only served through a separate medical-access gate, never ordinary personnel/incident APIs, analytics, assistant context or general audit values. | Personnel detail for registration; person-specific open incident for quick-card |

The default check-in window is **6 hours**, shared with the existing overdue rule. `POLAROPS_OVERDUE_HOURS` changes it for a deployment or accelerated demo. These are prototype operating rules, not a claim of statutory compliance or a replacement for an approved expedition safety plan.

## Theme behavior

- Frost: small white snowflakes drift down on pointer clicks and disappear within two seconds.
- Aurora: a dark polar sky, slowly moving green/violet curtains, stars, and mint/lilac/blue click stars.
- The suggestion appears after **6 seconds**, hides after 18 seconds, and appears once more at **3 minutes** if the visitor has not acted on it. Choosing a theme, changing it manually, or dismissing the suggestion stops reminders for that browser session.
- Theme choice persists locally. Reduced-motion preferences disable falling particles and curtain movement. Decorations do not capture clicks or keyboard focus.

## Medical access

Newly seeded databases include a separate **demo medical account**:

`medic@polarops.io` / `medic123`

Admin and duty-officer accounts have **no medical permission** by default. Medical access requires all of:

1. An independent `medical_permissions` record, provisioned outside the web admin role.
2. Password confirmation and a meaningful access reason.
3. A five-minute grant tied to that user and that exact personnel profile or incident.
4. For an incident, an affected person and an incident that is still open/responding.

Only the grant's hash is stored on the server. The browser holds the token and card in component memory, clears them when the window loses focus, the page is hidden, the user locks it, the component closes, or the grant expires. The server rechecks permissions, expiry and incident status on each clinical request. Revocation takes effect immediately. Clinical responses use `Cache-Control: no-store`; medical requests and credentials never enter the offline queue. Access, changes and denials are audited without clinical field values.

For an **existing database**, preserve current records and provision the demo medical account with:

```powershell
cd backend
.\venv\Scripts\python.exe manage_medical_access.py demo-medic
```

Deployment owners can grant/revoke this separate permission for an existing account:

```powershell
.\venv\Scripts\python.exe manage_medical_access.py grant --email authorized.operator@example.org
.\venv\Scripts\python.exe manage_medical_access.py revoke --email authorized.operator@example.org
```

The new tables are additive and are created on startup. **No reseed is required.** No medical facts are invented for existing people; use fictional data when demonstrating registration.

## Five-minute demonstration

1. Open a planned expedition. Show NO-GO and the exact missing requirements. In Inventory → Asset readiness, register an operational medical kit if needed.
2. Assign two crew members and the kit on the expedition manifest. Explicitly select the kit in the manifest dropdown. Save. Confirm each crew member active and checked in only after verification. Click Recheck; launch becomes available when every check passes.
3. Change an assigned asset to Needs maintenance in Inventory. Recheck a planned expedition to show launch is blocked. Restore it to operational and launch. Mark the first waypoint reached.
4. Open a crew member and report a station other than the next waypoint. Show the expected/actual mismatch on the expedition and Emergency screen. Enter a radio-verification note to mark the alert reviewed; the event remains in check-in history.
5. Report two incidents. Reserve the same snowmobile or responder for both. The second case displays the conflicting incident and cannot save the assignment. Resolve the first case; assignment to the second now succeeds.
6. Sign in as the medical demo account. Register fictional critical info on a personnel record. Report an incident for that person and unlock its quick-card with a reason/password. Lock it. Sign in as admin to show that admin cannot access those values.

## Tests

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest -q
cd ../frontend
npm test
npm run build
npm run lint
npx playwright install chromium
npm run test:e2e
```

Backend tests and browser tests use disposable databases. Browser tests start dedicated servers on ports 8001/5184; they never reseed `backend/polarops.db`. They cover the theme timing/particles, manifest → launch → waypoint → deviation flow, conflicting resources, medical registration/locking, and mobile overflow.

## Operational boundaries and next priorities

- Station check-ins are operator-reported evidence, not live GPS or proof of physical co-location. No location means no route comparison. Reports delayed more than five minutes are marked `delayed_report` because the historical route may have changed. Offline reports preserve their observed time and cannot refresh stale crew just by arriving at the server later.
- Launches, incident writes, asset writes and clinical access require live confirmation. Blackout mode remains a simulated connectivity switch with persisted browser writes for other modules; background sync and full multi-device conflict resolution remain future work.
- Current SQLite deployment is a demonstration. Before handling real medical data: encrypted storage/backups and key management, HTTPS, stronger authentication, consent/retention policies, a medical-data custodian workflow, and a full authorization review of legacy unprefixed APIs are priorities. Browser access gates do not protect direct access to the database file.
- Real GPS/radio ingestion, authenticated field check-ins, delivered alert notifications, approved emergency escalation procedures and multi-operator load testing are the next operational integrations. Email/sound settings are explicitly labeled as saved preferences until delivery is connected.
