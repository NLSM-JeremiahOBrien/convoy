# Requirements: Convoy — Battle of the North Atlantic

**Defined:** 2026-05-17
**Core Value:** Players leave with a memorable connection to what the real Liberty ships and their escorts faced — and a reason to remember the Jeremiah O'Brien.

## v1 Requirements

### Registration Form (Phase 2)

- [ ] **REG-01**: Player can submit name and email after completing a mission
- [ ] **REG-02**: Form includes an opt-in checkbox for the SS Jeremiah O'Brien mailing list (unchecked by default)
- [ ] **REG-03**: Form optionally accepts a Scout troop number when session is in group mode
- [ ] **REG-04**: Form is skippable — "Play Again" bypasses submission entirely
- [ ] **REG-05**: On submit, player sees inline confirmation: "Welcome aboard, [Name]! You saved [X] of 25 ships."

### Backend API (Phase 2)

- [ ] **API-01**: POST /api/missions endpoint accepts name, email, optIn flag, optional troop number, and game stats
- [ ] **API-02**: Endpoint creates or upserts a CiviCRM Contact matched on email via APIv4
- [ ] **API-03**: If optInMailingList is true, contact is added to CiviCRM Group ID 2 (Newsletter Subscribers) with status=Added
- [ ] **API-04**: Game stats are logged as a CiviCRM Activity of type "Convoy Game Completed" (or custom fields — TBD with museum)
- [ ] **API-05**: CiviCRM API key and site key are never exposed to the browser — proxy only
- [ ] **API-06**: Endpoint returns { ok: true, contactId, message } on success
- [ ] **API-07**: GDPR/CAN-SPAM compliance: opt-in language includes "you can unsubscribe at any time" and links to ssjeremiahobrien.org/privacy

### Compliance (Phase 2)

- [ ] **COMP-01**: No pre-checked marketing boxes
- [ ] **COMP-02**: Privacy policy link displayed on registration form
- [ ] **COMP-03**: Email validated client-side before submission

### Analytics (Phase 3)

- [ ] **ANLT-01**: CiviCRM dashboard shows per-session metrics: completion rate, average score, aces defeated, time per session
- [ ] **ANLT-02**: Metrics are filterable by event date

### Leaderboard (Phase 3)

- [ ] **LEAD-01**: Public leaderboard page at game.ssjeremiahobrien.org/scores
- [ ] **LEAD-02**: Leaderboard displays anonymized entries (first name + last initial) for privacy of minors
- [ ] **LEAD-03**: Leaderboard is filterable by Scout troop and event date
- [ ] **LEAD-04**: Kiosk displays leaderboard between games (idle screen)

### After Action Report (Phase 4)

- [ ] **AAR-01**: After the mission ends, players can view an "After Action Report" screen with historical context for the aces and ships that appeared in their session
- [ ] **AAR-02**: Report includes real historical details: which aces appeared, ships they sank in real life, convoy routes
- [ ] **AAR-03**: QR code on the report links to the NLSM donate/membership page

## v2 Requirements

### Localization

- **LOC-01**: Bilingual EN/ES support for SF Bay tourism
- **LOC-02**: Ace commander biographies available in Spanish

### Extended Analytics

- **ANLT-03**: Session replay or heatmap of destroyer movements
- **ANLT-04**: Export metrics as CSV for museum staff

## Out of Scope

| Feature | Reason |
|---------|--------|
| FTSign integration | Separate project, tracked elsewhere |
| Network multiplayer | Kiosk surface is the multiplayer surface |
| Mobile phone version | Kiosk touchscreen is the target form factor |
| OAuth / social login | Email/name capture is sufficient |
| Real-time leaderboard updates | Static refresh is fine for kiosk context |
| Physical podium/button hardware | Out of scope for Phase 2–4 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REG-01 | Phase 2 | Pending |
| REG-02 | Phase 2 | Pending |
| REG-03 | Phase 2 | Pending |
| REG-04 | Phase 2 | Pending |
| REG-05 | Phase 2 | Pending |
| API-01 | Phase 2 | Pending |
| API-02 | Phase 2 | Pending |
| API-03 | Phase 2 | Pending |
| API-04 | Phase 2 | Pending |
| API-05 | Phase 2 | Pending |
| API-06 | Phase 2 | Pending |
| API-07 | Phase 2 | Pending |
| COMP-01 | Phase 2 | Pending |
| COMP-02 | Phase 2 | Pending |
| COMP-03 | Phase 2 | Pending |
| ANLT-01 | Phase 3 | Pending |
| ANLT-02 | Phase 3 | Pending |
| LEAD-01 | Phase 3 | Pending |
| LEAD-02 | Phase 3 | Pending |
| LEAD-03 | Phase 3 | Pending |
| LEAD-04 | Phase 3 | Pending |
| AAR-01 | Phase 4 | Pending |
| AAR-02 | Phase 4 | Pending |
| AAR-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-17*
*Last updated: 2026-05-17 after Phase 1 completion*
