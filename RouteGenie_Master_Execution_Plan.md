# RouteGenie — Master Execution Plan (Team of 6)

This is the single reference document. Every person should read Sections 1–4 fully (shared context), then jump to their own section in Part B.

\---

# PART A — SHARED FOUNDATION (everyone reads this first)

## 1\. The Problem \& The Product (30-second version)

FMCG/pharma field sales reps get a static list of stores each day with no personalization, no adaptability when plans change, no live manager visibility, and a manual end-of-day report. RouteGenie fixes all four with a mobile app that has two views:

* **Rep view**: personalized optimized route, live urgency map, instant mid-day replanning, one-tap AI report.
* **Manager view**: live multi-rep map, one-tap redistribution, what-if simulator.

## 2\. Final Feature List (build these six, nothing else)

1. Route DNA — personalized routing per rep
2. Live Replanning — instant re-route on cancellation (hero/demo feature)
3. Sales Pulse Map — red/yellow/green urgency visualization
4. One-Button Manager Report — AI-generated end-of-day summary
5. Manager War Room — multi-rep live dashboard + redistribution
6. What-If Simulator — scenario testing before the day starts

**Not building**: AI photo validation of shelves (V2 only — too risky for 48 hrs).

## 3\. Complete Tech Stack

|Layer|Choice|Why|
|-|-|-|
|Mobile frontend|React Native (Expo)|Single codebase, fast to scaffold, installable APK for live demo, works without app store|
|Backend|FastAPI (Python)|Fast to write, async, auto-generates OpenAPI docs (helps the contract-first workflow below)|
|Route optimization|Google OR-Tools (Python)|Industry-standard TSP/VRP solver, free, well-documented|
|Maps \& directions|Google Maps SDK (React Native) + Google Directions/Distance Matrix API, OR OpenRouteService (free, no billing setup) as fallback|Pick ONE in Hour 1 — don't evaluate both mid-build|
|AI layer|Claude API (Anthropic, `claude-sonnet-4-6`)|Report generation, replan command parsing, route explanations|
|Database|SQLite (file-based, zero setup) for the hackathon. Supabase (Postgres) only if Hour 1–2 setup goes smoothly and team wants live cloud sync|SQLite avoids losing hours to cloud DB config; can migrate later if needed|
|Backend hosting|Railway / Render (free tier) OR ngrok tunnel from a laptop|Have BOTH ready — ngrok as fallback if cloud deploy breaks near demo time|
|State management (frontend)|React Context or Zustand|Lightweight, no boilerplate|
|Version control|GitHub, one repo, `main` + feature branches|Agree on branch naming in Hour 1|

## 4\. Complete Database Schema

Use SQLite. Below is the full schema — copy this directly, do not redesign mid-hackathon.

```sql
-- ============================
-- REPS
-- ============================
CREATE TABLE reps (
    rep\\\_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    phone           TEXT,
    home\\\_lat        REAL,
    home\\\_lng        REAL,
    daily\\\_target\\\_visits INTEGER DEFAULT 13,
    created\\\_at      DATETIME DEFAULT CURRENT\\\_TIMESTAMP
);

-- ============================
-- REP DNA PROFILE (one row per rep)
-- ============================
CREATE TABLE rep\\\_dna\\\_profiles (
    profile\\\_id              INTEGER PRIMARY KEY AUTOINCREMENT,
    rep\\\_id                  INTEGER NOT NULL REFERENCES reps(rep\\\_id),
    avg\\\_visit\\\_minutes       REAL DEFAULT 15,         -- baseline time per store
    best\\\_time\\\_window\\\_start  TEXT DEFAULT '09:00',    -- HH:MM, when rep performs best
    best\\\_time\\\_window\\\_end    TEXT DEFAULT '11:00',
    area\\\_speed\\\_factor       REAL DEFAULT 1.0,        -- <1 = faster than avg, >1 = slower
    notes                   TEXT
);

-- ============================
-- REP STORE-TYPE CONVERSION (many rows per rep — one per store\\\_type)
-- ============================
CREATE TABLE rep\\\_conversion\\\_rates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    rep\\\_id          INTEGER NOT NULL REFERENCES reps(rep\\\_id),
    store\\\_type      TEXT NOT NULL,                   -- e.g. 'kirana', 'supermarket', 'medical', 'distributor'
    conversion\\\_rate REAL DEFAULT 0.5                  -- 0.0 - 1.0, used to weight priority
);

-- ============================
-- STORES
-- ============================
CREATE TABLE stores (
    store\\\_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT NOT NULL,
    lat                REAL NOT NULL,
    lng                REAL NOT NULL,
    store\\\_type         TEXT NOT NULL,                -- 'kirana', 'supermarket', 'medical', 'distributor'
    avg\\\_order\\\_value    REAL DEFAULT 5000,
    base\\\_priority       INTEGER DEFAULT 1,            -- 1 (low) - 5 (high), set by business rules
    last\\\_visited\\\_date  DATE,
    stock\\\_depletion\\\_rate REAL DEFAULT 0.1,            -- fraction depleted per day, used in urgency score
    closed\\\_days        TEXT                            -- comma-separated, e.g. 'Tuesday' (optional, for "ghost store" style logic later)
);

-- ============================
-- DAILY ROUTES (one row per rep per day)
-- ============================
CREATE TABLE routes (
    route\\\_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    rep\\\_id          INTEGER NOT NULL REFERENCES reps(rep\\\_id),
    route\\\_date      DATE NOT NULL,
    status          TEXT DEFAULT 'active',            -- active, completed
    total\\\_revenue\\\_opportunity REAL DEFAULT 0,
    created\\\_at      DATETIME DEFAULT CURRENT\\\_TIMESTAMP
);

-- ============================
-- ROUTE STOPS (ordered list of stores within a route)
-- ============================
CREATE TABLE route\\\_stops (
    stop\\\_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    route\\\_id        INTEGER NOT NULL REFERENCES routes(route\\\_id),
    store\\\_id        INTEGER NOT NULL REFERENCES stores(store\\\_id),
    sequence\\\_order  INTEGER NOT NULL,                 -- 1, 2, 3... order in route
    planned\\\_eta     TEXT,                              -- HH:MM
    urgency\\\_score   REAL,                              -- computed at generation time
    urgency\\\_color   TEXT,                              -- 'red', 'yellow', 'green'
    status          TEXT DEFAULT 'pending'             -- pending, visited, skipped, cancelled
);

-- ============================
-- VISIT LOG (actual outcomes, filled as rep completes visits)
-- ============================
CREATE TABLE visit\\\_logs (
    log\\\_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    rep\\\_id          INTEGER NOT NULL REFERENCES reps(rep\\\_id),
    store\\\_id        INTEGER NOT NULL REFERENCES stores(store\\\_id),
    route\\\_id        INTEGER NOT NULL REFERENCES routes(route\\\_id),
    visit\\\_timestamp DATETIME DEFAULT CURRENT\\\_TIMESTAMP,
    outcome         TEXT,                              -- 'order\\\_placed', 'closed', 'no\\\_answer', 'skipped'
    revenue         REAL DEFAULT 0,
    notes           TEXT
);
```

**Seed data target**: 18–20 stores in one real area (e.g. Baner/Pune or your demo city), 3 reps (Raj, Priya, Anil) each with a distinct DNA profile and conversion rates. Person 2 owns this seed script — see Part B.

## 5\. API Contract (lock this in Hour 1–2, do not change after)

All endpoints return JSON. Base URL agreed in Hour 1 (e.g. `http://localhost:8000` for local dev, swapped to deployed URL later).

|Method|Endpoint|Purpose|Owner|
|-|-|-|-|
|GET|`/reps`|List all reps|Person 1|
|GET|`/reps/{rep\\\_id}/route?date=YYYY-MM-DD`|Get today's route for a rep, with stops, urgency colors, ETAs|Person 1|
|POST|`/routes/generate`|Generate a new optimized route for a rep on a date (uses OR-Tools + DNA profile)|Person 1|
|POST|`/replan`|Body: `{route\\\_id, cancelled\\\_store\\\_id, current\\\_lat, current\\\_lng}` → returns updated route stops|Person 1|
|POST|`/simulate`|Body: `{route\\\_id, change\\\_type, change\\\_payload}` → returns simulated new route + deltas (visits, time, revenue)|Person 1|
|GET|`/reps/all-status?date=YYYY-MM-DD`|For War Room — all reps' progress, location, status color|Person 2|
|POST|`/redistribute`|Body: `{from\\\_rep\\\_id, store\\\_ids\\\[]}` → reassigns stores to best-fit nearby reps, returns updated routes for all affected reps|Person 1/2 (joint)|
|POST|`/visits/log`|Body: `{rep\\\_id, store\\\_id, route\\\_id, outcome, revenue, notes}` → logs a completed/skipped visit|Person 2|
|POST|`/report/generate`|Body: `{rep\\\_id, route\\\_id}` → pulls visit logs, calls Claude API, returns formatted text summary|Person 2|
|GET|`/stores`|List all stores (for map rendering, debug)|Person 1|

**Response shape example for `/reps/{rep\\\_id}/route`:**

```json
{
  "route\\\_id": 12,
  "rep\\\_id": 1,
  "date": "2026-06-16",
  "total\\\_revenue\\\_opportunity": 210000,
  "stops": \\\[
    {
      "stop\\\_id": 101,
      "store\\\_id": 5,
      "name": "D-Mart Baner",
      "lat": 18.5601,
      "lng": 73.7779,
      "sequence\\\_order": 1,
      "planned\\\_eta": "09:15",
      "urgency\\\_score": 8.2,
      "urgency\\\_color": "red",
      "status": "pending"
    }
  ]
}
```

Person 5 (Full-Stack Connector) builds a mock JSON server / static fixture matching this exact shape on Hour 1 so frontend devs (3, 4) never wait on backend.

\---

# PART B — INDIVIDUAL ASSIGNMENTS (detailed, hour-by-hour)

## Person 1 — Backend Lead (Optimization Engine)

**Owns**: route generation, replan, simulate, redistribute (core algorithm), urgency scoring formula.

**Hour-by-hour:**

* H1–2: Set up FastAPI project, SQLite connection, create all tables from Section 4 schema. Confirm API contract with Person 2 and Person 5.
* H2–4: Implement urgency score function: `urgency = (days\\\_since\\\_last\\\_visit \\\* base\\\_priority) + (stock\\\_depletion\\\_rate \\\* 10)`. Implement `/routes/generate` using OR-Tools VRP (single vehicle = TSP per rep) with DNA profile adjustments (reorder stops to front-load high-conversion store types within rep's best time window).
* H4–6: Implement `/replan`: remove cancelled stop, re-run OR-Tools on remaining stops + nearby unvisited candidates within radius, return new sequence.
* H6–8: Implement `/simulate`: accept change payload (add stores / shift start time / filter by min order value), re-run generation logic without persisting, return route + deltas.
* H8–10: Implement `/redistribute` jointly with Person 2 — given a rep and their remaining stores, find nearby reps with capacity, split stores by proximity, re-run route generation for affected reps.
* H10–12 (Day 1 end): Test all endpoints with Postman/curl against seed data. Hand working endpoints to Person 5 for integration.
* Day 2 H1–4: Bug fixes from integration testing, performance tuning (route generation should return in <2 sec for demo).
* Day 2 H4–8: Support War Room/simulator integration, fix edge cases (e.g. replanning when no candidate stores remain).
* Day 2 H8–10: Final demo rehearsal — be ready to manually trigger backend if anything needs a live fix.

## Person 2 — Backend Support (Data \& AI Integration)

**Owns**: schema implementation + seed data, DNA profile logic, Claude API integration.

**Hour-by-hour:**

* H1–2: Create seed data script — 18–20 stores (real lat/lng in chosen demo area), 3 reps with distinct DNA profiles and conversion rates (per Section 4 schema). Insert via script, not manually.
* H2–4: Implement DNA profile read logic — function that takes rep\_id and returns weighting adjustments to pass into Person 1's route generator. Pair with Person 1 on the interface between these two pieces.
* H4–6: Build `/visits/log` endpoint and `/reps/all-status` endpoint for War Room.
* H6–8: Build the Claude API integration for `/report/generate`. Write the structured prompt (see Section 6 below). Test with mock visit log data to ensure output format is consistent and short.
* H8–10: Build Claude-assisted replan command parsing if doing natural language input (e.g. rep types "Shop B cancelled" as free text) — parse store name to store\_id, call `/replan`. If short on time, use a button/dropdown instead of free text — this is a safe scope cut.
* H10–12: Help Person 1 test `/redistribute`, assist with integration handoff to Person 5.
* Day 2: Support report generation polish, WhatsApp message formatting (Person 5 owns the deep link itself), help test edge cases, assist demo data refinement with Person 6.

## Person 3 — Frontend Lead (Rep View)

**Owns**: mobile map UI, route display, pulse map colors, replan trigger UI, route redraw animation.

**Hour-by-hour:**

* H1–2: Set up React Native (Expo) project. Install map library (`react-native-maps`). Confirm API contract and get mock JSON fixture from Person 5.
* H2–5: Build the main Rep Home screen — map with store pins, route polyline, pins colored by `urgency\\\_color` from the route response.
* H5–7: Build the stop list view (ordered list below/beside map) showing sequence, ETA, urgency color.
* H7–9: Build the "mark unavailable" interaction — tap a pin/stop → button "Mark Cancelled" → calls `/replan` (via Person 5's integration layer) → animate route redraw (polyline transitions, revenue counter ticks down then up).
* H9–10: Polish revenue opportunity counter display at top of screen, connect to live data.
* Day 2 H1–3: Build end-of-day report screen — "Generate Report" button → calls `/report/generate` → displays formatted text + "Send via WhatsApp" button (uses WhatsApp deep link `whatsapp://send?text=...`).
* Day 2 H3–6: Polish animations, loading states, error states (e.g. no network).
* Day 2 H6–9: Full integration testing with real backend, fix visual bugs.
* Day 2 H9–10: Demo rehearsal — be the one operating the rep-side phone live on stage.

## Person 4 — Frontend Support (Manager View)

**Owns**: War Room dashboard, redistribute UI, What-If Simulator UI.

**Hour-by-hour:**

* H1–2: Set up Manager View navigation (separate tab/screen in same Expo app or separate screen flow). Get mock fixture for `/reps/all-status` from Person 5.
* H2–5: Build War Room map — multiple rep pins (different colors/icons per rep), status cards below/beside map showing visits-completed-vs-target per rep.
* H5–7: Build tap-to-expand rep detail (remaining stores) and "Redistribute" button calling `/redistribute`.
* H7–9: Build What-If Simulator screen — simple controls (add N stores / shift start time slider / min order value filter) → calls `/simulate` → displays delta (visits, time, revenue) and recommendation text.
* H9–10: Polish status color logic (on-track/behind thresholds), connect to live data feed (poll every few seconds, or manual refresh button for demo reliability).
* Day 2 H1–4: Integration testing with real backend.
* Day 2 H4–7: Visual polish, make sure War Room map is legible with all rep pins at once (this is judge-facing — clarity matters more than density).
* Day 2 H7–9: Full run-through with Person 3's flow, fix bugs.
* Day 2 H9–10: Demo rehearsal — be the one operating the manager-side device/screen on stage.

## Person 5 — Full-Stack Connector

**Owns**: the glue. Mock API layer early, real integration later, end-to-end flow ownership, WhatsApp deep link, cross-team bug triage.

**Hour-by-hour:**

* H1–2: Read the API contract (Section 5) the moment it's agreed. Build a mock server (e.g. a simple FastAPI stub or `json-server`) returning fixture data matching exact response shapes for every endpoint. Hand URLs to Person 3 and Person 4 immediately so they never block on real backend.
* H2–6: While 1 \& 2 build real endpoints, keep mock server as fallback. Start writing the frontend API client layer (fetch/axios wrapper) that both Person 3 and Person 4 will import — single source of truth for base URL and request formatting.
* H6–10: As Person 1's real endpoints come online, swap mock calls for real ones one endpoint at a time, testing each swap (route generation, then replan). Keep mock server running in parallel as instant fallback if a real endpoint breaks near demo time.
* Day 2 H1–3: Wire up `/redistribute` and `/simulate` once available. Build the WhatsApp deep link integration for the end-of-day report (`/report/generate` response → formatted WhatsApp share intent).
* Day 2 H3–6: Own end-to-end testing — walk the FULL demo arc (Section "Demo Arc" in original plan) manually at least 5 times, logging every break.
* Day 2 H6–9: Triage and fix bugs reported by Person 3/4, prioritizing anything that affects the live demo path (route load → cancel → replan → report).
* Day 2 H9–10: Be the dedicated "demo safety net" — sit near the stage with a laptop running the backend locally + ngrok tunnel as backup in case deployed hosting fails.

## Person 6 — Demo, Data \& Presentation

**Owns**: realistic demo dataset content, UI polish pass, pitch deck, rehearsal direction.

**Hour-by-hour:**

* H1–2: Decide the demo city/area and finalize the list of 18–20 real (or realistic-sounding) store names, types, and approximate locations for Person 2's seed script. Decide the 3 rep personas (names, personalities) consistent with the pitch narrative.
* H2–5: Draft the pitch deck skeleton — problem slide, solution overview, the 6 features, tech stack slide, team slide, "ask"/closing slide. Use the analogies from the plan (postman/operations manager) for the problem slide.
* H5–8: Start a "judge FAQ" doc — anticipate questions like "how is this different from Badger Maps/Salesforce Maps?" and prepare crisp answers (this is the differentiation Route DNA + Live Replanning provide).
* H8–12: Float — assist whichever team member is behind. Likely candidates: helping Person 2 refine seed data realism, or helping Person 3/4 with copy text/microcopy in the UI.
* Day 2 H1–5: Continue floating support. Begin writing the literal demo script word-for-word (who says what, who taps what, in what order) for the "Shop B cancelled" moment and the full 4-act arc.
* Day 2 H5–7: Finalize pitch deck with real screenshots from the working app (take these once Person 3/4 have stable UI).
* Day 2 H7–10: Run rehearsal sessions — minimum 10–15 full run-throughs of the live demo with Person 3 (rep device) and Person 4 (manager device). Time it. Identify and smooth every awkward pause.

\---

# PART C — CRITICAL SUCCESS RULES (read before starting)

1. **Lock the API contract in Hour 1–2 and do not change endpoint shapes after that.** Every hour spent renegotiating the contract later is an hour stolen from polish and rehearsal.
2. **Mock data unblocks everyone.** Person 5's mock server is not optional — it is what lets frontend and backend work in true parallel instead of frontend waiting on backend.
3. **Cut scope before cutting rehearsal time.** The "What-If Simulator" or "Redistribute" logic can be simplified (e.g. simpler nearest-neighbor instead of full re-optimization) if time runs short — but the Hour 9–10 demo rehearsal block on both days is non-negotiable.
4. **One person (Person 5) must know the entire system end-to-end** so there's always someone who can debug a cross-layer issue fast during the final hours.
5. **Have an offline fallback for the live demo.** If WiFi fails on stage, Person 5's local backend + ngrok tunnel (or even a pre-recorded screen capture of the replan moment as backup) prevents a total demo failure.
6. **Rehearse the cancellation moment more than anything else.** It is the single highest-leverage 10 seconds of the entire presentation.

