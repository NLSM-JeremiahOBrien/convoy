# Roadmap: Convoy — Battle of the North Atlantic

**Milestone:** Phases 2–4 — Registration, Analytics, After Action Report
**Phase 1:** Complete ✓ (core game shipped)

---

## Phase 2 — Player Registration + CiviCRM Integration

**Goal:** Capture player contact info after each completed mission and feed it into the existing CiviCRM at ssjeremiahobrien.org — growing the museum's mailing list and logging game participation.

**Requirements:** REG-01, REG-02, REG-03, REG-04, REG-05, API-01, API-02, API-03, API-04, API-05, API-06, API-07, COMP-01, COMP-02, COMP-03

**Success Criteria:**
1. After completing a mission, players see a "Log Your Mission" form with name, email, opt-in checkbox (unchecked), and optional troop number
2. Submitting the form creates or updates a contact in CiviCRM and (if opted in) adds them to Group ID 2
3. Game stats appear as a CiviCRM Activity on the contact record
4. The form is skippable via "Play Again" with no data submitted
5. CiviCRM credentials never appear in browser network traffic
6. Opt-in language and privacy link satisfy CAN-SPAM/GDPR requirements

**Plans:**
- `plan-01-registration-form.md` — Frontend: post-game form UI, validation, skip flow, inline confirmation
- `plan-02-api-proxy.md` — Backend: Fastify/Express endpoint, CiviCRM APIv4 integration, credential security
- `plan-03-civicrm-activity.md` — CiviCRM Activity type setup and stats logging

---

## Phase 3 — Analytics & Leaderboard

**Goal:** Give museum staff visibility into game participation and display an anonymized leaderboard on the kiosk between sessions.

**Requirements:** ANLT-01, ANLT-02, LEAD-01, LEAD-02, LEAD-03, LEAD-04

**Success Criteria:**
1. CiviCRM dashboard shows completion rate, average score, aces defeated, and time-per-session, filterable by date
2. Public leaderboard page at game.ssjeremiahobrien.org/scores shows anonymized results (first name + last initial)
3. Leaderboard is filterable by Scout troop and event date
4. Kiosk displays the leaderboard on idle (between games)

**Plans:**
- `plan-01-civicrm-dashboard.md` — CiviCRM report/dashboard setup for game metrics
- `plan-02-leaderboard-api.md` — Leaderboard endpoint (scores sorted, anonymized, filterable)
- `plan-03-leaderboard-ui.md` — Frontend leaderboard page + kiosk idle screen integration

---

## Phase 4 — Educational After Action Report

**Goal:** Deepen the educational impact by showing players historical context for the specific aces and ships from their session, with a QR code link to support the museum.

**Requirements:** AAR-01, AAR-02, AAR-03

**Success Criteria:**
1. After the victory/defeat screen, players can open an "After Action Report" showing real historical details for each ace and Liberty ship from their session
2. Report includes at minimum: ace biography highlights, ships they sank in real life, real convoy routes
3. A QR code on the report links to the NLSM donate/membership page
4. Report is accessible on both kiosk and public URL

**Plans:**
- `plan-01-historical-data.md` — Expand data.ts with per-ace historical engagements and ship histories
- `plan-02-aar-screen.md` — After Action Report UI: session summary + historical context + QR code

---

## Out of Scope (Phases 2–4)

- FTSign integration — separate project
- Bilingual EN/ES support — v2
- Physical kiosk hardware (WebSerial podium) — future
- Network multiplayer — architectural decision, kiosk is the surface
