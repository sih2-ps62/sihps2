# PolarOps — Feature Guide & Demo Script

Plain-language guide: what each feature does, where to find it, how to show it, and why it matters.

---

## 1. The 30-second story

Polar research stations are thousands of kilometres apart, weather is brutal, and one late supply ship or one
missed radio check-in can turn into an emergency. Today the information sits in different places: spreadsheets,
radio logs, emails.

**PolarOps puts it all on one screen.** Expeditions, cargo, supplies, people and emergencies live in one system,
and it warns you when several small problems pile up at the same station, *before* they become a crisis.

---

## 2. Before you demo

**Start everything (one command):**

```powershell
cd C:\SIH-62\frontend
npm run dev
```

- App: **http://localhost:5183**
- Behind-the-scenes API docs: **http://127.0.0.1:8000/docs**

**Reset the demo data right before presenting.** The sample data is stamped relative to the moment it is created
(for example "last check-in 30 hours ago"). If it is a day old, more people will look overdue and the numbers
below won't match. To reset, stop the app and run:

```powershell
cd C:\SIH-62\backend
venv\Scripts\python seed.py
```

**Sign-ins**

| Person | Email | Password | Can do |
|---|---|---|---|
| Duty Officer | duty.officer@polarops.io | icebreaker26 | view, create, edit |
| Admin | admin@polarops.io | glacieradmin26 | everything, **including delete** |

**Numbers you should see on a fresh reset:** 2 active expeditions · 7 people in the field · 3 low-stock items ·
2 items needing maintenance · 3 open emergencies.

---

## 3. Feature tour

Each feature: **What it does** → **Where** → **Show it** → **Why it's useful**.

### Sign-in and roles
- **What it does:** Only signed-in staff can see or change anything. Two roles: duty officers can work with data,
  only admins can delete.
- **Where:** `/login` (you are sent here automatically if you're signed out). Sign out is at the bottom of the left menu.
- **Show it:** Try a wrong password (a clear error appears). Sign in as the duty officer, open any record: no
  trash-can icon. Sign out, sign in as admin: the trash-can icon is there.
- **Also:** After signing in you land on the page you were originally trying to reach. Five wrong passwords in a
  minute lock that account for a minute (a brake on password guessing), so don't hammer the wrong password on stage.
- **Why it's useful:** Operational data is safe from casual edits, and dangerous actions are limited to the right people.

### Dashboard — "the whole operation at a glance"
- **What it does:** Five headline numbers (active expeditions, people in the field, low-stock alerts, assets needing
  maintenance, open emergencies), a map of all stations, a live feed of what needs attention, and shortcut tiles to every area.
- **Where:** `/` (first page after sign-in).
- **Show it:** Point at the five numbers, then the feed: it lists open emergencies and low-stock items, newest first.
  Click a feed row and it jumps to that area.
- **Why it's useful:** A duty officer sees in five seconds whether the day is calm or not.

### Station Map
- **What it does:** Shows all 12 stations (Antarctic and Arctic) on a world map, and draws each expedition's route
  as a line: solid blue = active, dashed grey = planned, faint green = completed.
- **Where:** Left menu → **Map** (`/map`).
- **Show it:** Click a station in the right-hand list and the map flies to it and opens its label. Hover a route line
  to see the expedition name and status. "Reset view" zooms back out.
- **Why it's useful:** Everyone can see where people and routes are, and spot a route that passes through trouble.

### Expeditions
- **What it does:** The list of all expeditions with status (Planned / Active / Completed), region, start date and
  team lead. You can filter, search, sort, plan a new one, and open one to see its route step by step.
- **Where:** **Expeditions** (`/expeditions`).
- **Show it:** Click the **Active** filter (2 rows). Type "svalbard" in the search box. Click **New Expedition**, fill
  in a name, start date, team lead, and pick a "From" and "To" station, then **Create**. It appears in the list, and its route
  appears on the Map page.
- **Why it's useful:** Plans, teams and routes stop living in personal notes. New trips take seconds to log.

### Cargo
- **What it does:** A digital manifest of every shipment: what it is, where it's going, its weight, and its status
  (Pending, In Transit, Delivered, Delayed). A chart shows the mix at a glance.
- **Where:** **Cargo** (`/cargo`).
- **Show it:** Click the **Delayed** filter (one shipment: fresh produce for McMurdo). Add a **New Shipment**. Try
  entering the same manifest number twice: the system refuses ("already exists").
- **Why it's useful:** Nobody has to phone around asking "did the fuel arrive?" and delays are visible immediately.

### Inventory (supplies and equipment)
- **What it does:** Stock levels for every supply item, with a "reorder threshold". When an item drops to its threshold
  it is flagged as low stock. Equipment can also be flagged "needs maintenance".
- **Where:** **Inventory** (`/inventory`).
- **Show it:** Use the **Low Stock** filter (3 items) and **Needs Maintenance** filter (2 items). Open **Emergency rations**,
  click the pencil, set the quantity to 250, **Save**. Go back to the Dashboard: Low Stock Alerts dropped from 3 to 2.
- **Why it's useful:** You find out a station is running out of rations *before* they run out, and the whole
  system updates at once.

### Personnel
- **What it does:** The roster of everyone (name, role, station, status: In Field / On Leave / Base) and when they
  last checked in. If a person in the field hasn't checked in for over 24 hours, a red **Overdue** tag appears.
- **Where:** **Personnel** (`/personnel`).
- **Show it:** Open **Dr. Elena Kowalski**: "Last check-in" shows **Overdue**. Click **Check In**: the tag disappears.
  Use the status filters (7 In Field, 1 On Leave, 2 Base). Add a new person (they start as "just checked in", so
  they don't show as overdue).
- **Why it's useful:** A missed check-in is the earliest warning that someone may be in trouble. One click clears it once they are heard from.

### Emergency — the standout feature
- **What it does:** Report incidents, track them (Open → Resolved), and see average response time. Its smartest
  part is the red **Compound Risk** cards: when *several separate problems hit the same station at the same time*
  (low supplies + an overdue person + an open incident), it groups them into one card and rates it **CRITICAL**
  (an open incident is involved) or **HIGH** (low supplies + an overdue person). Two problems are the minimum for a card.
- **Where:** **Emergency** (`/emergency`).
- **Show it:** Point at the cards. **Vostok Station** shows three things at once: low rations, Priya Nair overdue,
  and a generator failure, so it is CRITICAL. Click **Resolve** on the generator failure: refresh, and the card
  drops to HIGH. Then check Priya in (Personnel page) and refresh: the card disappears, because only one problem is
  left there. Finally **Report Emergency** to add a new one.
- **Why it's useful:** Real disasters rarely come from one big failure. They come from small ones stacking up. This
  spots the pile-up that no single list would show.

### Automatic escalation (works quietly in the background)
- **What it does:** An incident left **open** for more than 2 hours is automatically raised one severity level
  (warning → critical), so it can't be forgotten.
- **Where:** You'll see the dot on the Emergency page turn red after a refresh.
- **Show it live (optional):** Stop the app, then start it with a shorter timer so you don't wait 2 hours:
  ```powershell
  $env:POLAROPS_ESCALATION_HOURS = "0.02"      # about 72 seconds
  cd C:\SIH-62\frontend; npm run dev
  ```
  Report a new *Warning*, wait about a minute and a half, refresh the Emergency page: it is now **Critical**.
  (Older warnings jump to critical immediately at this setting.)
- **Why it's useful:** The system nags on your behalf, so a quiet problem can't stay quiet.

### Analytics
- **What it does:** Six charts: emergencies per day, response-time trend, an expedition timeline, cargo shipments per
  day, a personnel breakdown, and stock by category.
- **Where:** **Analytics** (`/analytics`).
- **Show it:** Scroll through the page and explain one or two charts (e.g. "response times are improving").
- **Why it's useful:** Managers see trends and can justify decisions with evidence rather than gut feeling.

### Audit Log
- **What it does:** A permanent record of who created, changed or deleted what, and when. Filter by Created /
  Updated / Deleted, or search by name or keyword.
- **Where:** **Audit Log** (`/audit-log`).
- **Show it:** After doing a few things in the demo, open it: your actions are at the top with your name. Try the
  "Deleted" filter after deleting something as admin.
- **Why it's useful:** Accountability. If a record looks wrong, you can see exactly who changed it and when.

### Assistant (the round sparkle button, bottom right)
- **What it does:** A chat helper that answers questions about the *live* data in plain English: low stock,
  overdue people, open emergencies, expeditions, cargo.
- **Where:** Available on every page after sign-in.
- **Show it:** Click the button, then click a suggestion such as "Which stations have low stock right now?" or
  ask "Are any personnel overdue for check-in?".
- **Why it's useful:** Busy staff can ask a question instead of digging through pages. It only uses your own
  data, so it doesn't make things up. *Without an AI key it answers using a built-in engine and says so; with a
  Gemini key it gives fuller AI-written answers.*

### Polar Blackout Mode (offline simulation)
- **What it does:** Polar stations lose connection often. Blackout Mode shows how PolarOps would cope: changes you
  make while "offline" are queued, then sent automatically when the connection comes back.
- **Where:** The **SYSTEM ONLINE** pill at the top right of every page.
- **Show it:** Click the pill (it turns red: "POLAR BLACKOUT MODE"). Make a change, such as a check-in. A box at the bottom
  right lists it as "waiting to sync". Click the pill again: the queue syncs item by item and shows
  **CONNECTION RESTORED**.
- **Why it's useful:** It demonstrates the idea that field staff can keep working through a signal loss. *(This is
  a simulation, see section 6.)*

### Quick navigation (for speed)
- **Search box / Ctrl+K:** type a page name and press Enter to jump there.
- **Keyboard shortcuts:** press **G**, then a letter: **D** dashboard, **M** map, **E** expeditions, **C** cargo,
  **I** inventory, **P** personnel, **X** emergency.
- Clicking anywhere makes a little snowflake pop. It's purely decorative.
- The app can be installed like a phone/desktop app from the browser's address bar (this works on the production
  build, `npm run build` then `npm run preview`, not on the dev server). Live data is never cached, so an installed
  copy never shows stale numbers.

---

## 4. Behind the scenes (show to technical judges)

Open **http://127.0.0.1:8000/docs**. This is the API the app is built on. Four "smart rules" run on the server:

1. **Low stock:** an item below its reorder level is flagged automatically, both when it's created and each time it's changed.
2. **Overdue check-in:** anyone silent for more than 6 hours is marked overdue, and a check-in clears it.
3. **Route risk score:** each expedition gets a 0–100 risk score from weather along the route, number of stops, overdue
   crew, and season. *The score is calculated and available in the API but is not shown on the current screens.*
4. **Escalation:** open incidents get more severe over time (see above).

**Live risk-score demo in the docs page:** open `GET /expeditions/{expedition_id}/risk`, use `EXP-0001`, run it
(score about **70, high**), then run it again with `weather_code` set to `clear`: the score drops to about **40, medium**. Change the
weather and the risk moves.

Also there: `GET /dashboard/summary` (the headline numbers), `GET /assets/maintenance-due` (equipment needing
service), and `GET /assets?available=true` (only equipment that is fit to assign).

---

## 5. A 5-minute demo script

| Time | Do this | Say this |
|---|---|---|
| 0:00 | Sign in as **Duty Officer**. Show the Dashboard. | "One screen for the entire operation: 2 active expeditions, 7 people in the field, and 3 things running low." |
| 0:45 | **Map** page. Click a station. | "Every station and every route, live." |
| 1:15 | **Expeditions** → New Expedition → create one. Show it on the Map. | "Planning a trip takes seconds and everyone sees it." |
| 2:00 | **Inventory** → Emergency rations → quantity 250 → Save. Return to Dashboard. | "Restock, and the alert count drops immediately, everywhere." |
| 2:30 | **Personnel** → Elena Kowalski → **Check In**. | "She'd missed her check-in. One click and she's safe." |
| 3:00 | **Emergency** → the red Compound Risk cards. Resolve the Vostok generator failure. | "This is the key idea: it connects small problems at one station before they become a disaster." |
| 3:45 | Click the **Assistant** → ask "What emergencies are currently open?" | "Ask in plain English, answers come from live data." |
| 4:15 | Click **SYSTEM ONLINE** → make a change → click again. | "Lose signal? Work continues and syncs when you're back." |
| 4:45 | **Audit Log** (and a glance at Analytics). | "Everything is recorded and trends are visible. Full accountability." |

Have a screenshot or screen recording ready as a backup in case the venue's internet fails (the map's background images need internet).

---

## 6. What is real, what is simulated

| | |
|---|---|
| **Real** | Everything you create or change is saved in a database. Sign-in and roles. The four smart rules. The audit log. Search, sorting and paging. Assistant answers built from your real data. |
| **Simulated** | **Blackout Mode** (the server never actually goes down; queued changes vanish if you reload the page). **Weather** (each station has a fixed weather value). **Station positions** are fixed (no live GPS). |
| **Not built (roadmap)** | True offline-first sync, real GPS/sensor feeds, predictive (ML) risk, sending emails or sounds (the two switches on the Settings page only remember a preference), public hosting. |
| **Small gaps to know about** | "Last synced —" in the top bar is a placeholder. The route risk score is not yet shown on the screens (only in the API). |

---

## 7. If something goes wrong

| Problem | Fix |
|---|---|
| "Cannot reach the PolarOps server" | The backend isn't running. Run `npm run dev` from the `frontend` folder. |
| Numbers don't match this guide | Reset the data: `cd backend`, then `venv\Scripts\python seed.py`, and refresh. |
| Sign-in fails with the right password | Same reset as above (the accounts are recreated by the seed). |
| Port 5183 or 8000 already in use | Close the other window/terminal running the app, then start again. |
| Assistant mentions "built-in engine" | Normal without an AI key. Add `GEMINI_API_KEY` to `backend/.env` for AI answers. |
| Map shows markers but a blank background | No internet: the background tiles need it. The demo still works. |
| Kicked back to the sign-in page | Your session expired (12 hours). Sign in again. |
