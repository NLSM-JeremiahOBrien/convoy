# Roadmap: Convoy — Battle of the North Atlantic

## Overview

Phase 1 (core game) is complete and shipped. Phases 2–4 build out player registration and CiviCRM integration, an analytics dashboard and leaderboard, and a historical After Action Report screen that deepens the educational mission.

## Phases

- [x] **Phase 1: Core Game** - Shipped — procedural 3D ocean, U-boats, destroyers, turn-based combat, educational content
- [ ] **Phase 2: Player Registration + CiviCRM Integration** - Post-game form captures player contact info and feeds it into the museum's CiviCRM mailing list
- [ ] **Phase 3: Analytics and Leaderboard** - Museum staff dashboard in CiviCRM plus anonymized public leaderboard on the kiosk
- [ ] **Phase 4: Educational After Action Report** - Historical context screen for each session's aces and ships, with QR code to museum membership page

## Phase Details

### Phase 1: Core Game
**Goal**: Playable, touch-first, multi-player browser game running on the 22" kiosk aboard the SS Jeremiah O'Brien
**Depends on**: Nothing
**Requirements**: N/A (pre-GSD)
**Success Criteria** (what must be TRUE):
  1. Up to 4 players can co-pilot escort destroyers on one touchscreen
  2. All combat resolves with visible 2d6 dice
  3. 5 real WWII U-boat aces appear with biographical pop-ups
  4. Game runs fully offline on the kiosk
**Plans**: Pre-GSD

Plans:
- [x] Phase 1 complete (pre-GSD)

### Phase 2: Player Registration + CiviCRM Integration
**Goal**: Capture player contact info after each completed mission and feed it into the museum's CiviCRM — growing the mailing list and logging game participation
**Depends on**: Phase 1
**Requirements**: REG-01, REG-02, REG-03, REG-04, REG-05, API-01, API-02, API-03, API-04, API-05, API-06, API-07, COMP-01, COMP-02, COMP-03
**Success Criteria** (what must be TRUE):
  1. After completing a mission, players see a "Log Your Mission" form with name, email, opt-in checkbox (unchecked), and optional troop number
  2. Submitting the form creates or updates a contact in CiviCRM and (if opted in) adds them to Group ID 2
  3. Game stats appear as a CiviCRM Activity on the contact record
  4. The form is skippable via "Play Again" with no data submitted
  5. CiviCRM credentials never appear in browser network traffic
  6. Opt-in language and privacy link satisfy CAN-SPAM/GDPR requirements
**Plans**: 3 plans

Plans:
- [ ] 02-01: Frontend registration form — post-game UI, validation, skip flow, inline confirmation
- [ ] 02-02: Backend API proxy — Fastify endpoint, CiviCRM APIv4 contact upsert, Group ID 2 opt-in
- [ ] 02-03: CiviCRM Activity logging — "Convoy Game Completed" activity type with game stats

### Phase 3: Analytics and Leaderboard
**Goal**: Give museum staff visibility into game participation metrics and display an anonymized leaderboard on the kiosk between sessions
**Depends on**: Phase 2
**Requirements**: ANLT-01, ANLT-02, LEAD-01, LEAD-02, LEAD-03, LEAD-04
**Success Criteria** (what must be TRUE):
  1. CiviCRM dashboard shows completion rate, average score, aces defeated, and time-per-session filterable by date
  2. Public leaderboard page at game.ssjeremiahobrien.org/scores shows anonymized results (first name + last initial)
  3. Leaderboard is filterable by Scout troop and event date
  4. Kiosk displays the leaderboard on idle (between games)
**Plans**: 3 plans

Plans:
- [ ] 03-01: CiviCRM report and dashboard setup for game metrics
- [ ] 03-02: Leaderboard API endpoint — sorted, anonymized, filterable scores
- [ ] 03-03: Frontend leaderboard page and kiosk idle screen integration

### Phase 4: Educational After Action Report
**Goal**: Deepen the educational impact by showing players real historical context for the aces and ships from their session, with a QR code linking to the museum's membership page
**Depends on**: Phase 3
**Requirements**: AAR-01, AAR-02, AAR-03
**Success Criteria** (what must be TRUE):
  1. After the victory/defeat screen, players can open an After Action Report with real historical details for each ace and Liberty ship from their session
  2. Report includes ace biography highlights, ships sunk in real life, and convoy route context
  3. A QR code on the report links to the NLSM donate/membership page
  4. Report is accessible on both the kiosk and public URL
**Plans**: 2 plans

Plans:
- [ ] 04-01: Historical data expansion — per-ace engagements and ship histories added to data.ts
- [ ] 04-02: After Action Report UI — session summary, historical context panels, QR code

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Game | pre-GSD | Complete | 2026-05-17 |
| 2. Player Registration + CiviCRM Integration | 0/3 | Not started | - |
| 3. Analytics and Leaderboard | 0/3 | Not started | - |
| 4. Educational After Action Report | 0/2 | Not started | - |
