# Convoy: Battle of the North Atlantic — Roadmap

Educational maritime warfare game for the SS Jeremiah O'Brien overnight program.
Live build phases below.

---

## Phase 1 — Core Game ✅ (CURRENT)

Goal: a playable, touch-first, multi-player browser game that runs on the 22"
touchscreen kiosk aboard the ship and on a public URL.

**Delivered:**

- Three.js animated ocean (shader-based wave displacement, sun lighting, fog)
- Procedural Liberty ships (25), escort destroyers (1–4), and Type VII U-boats
- Day / night cycle with proper lighting and atmosphere
- Turn-based engine with visible 2d6 dice rolls and target-number resolution
- 5 real WWII U-boat ace commanders with biographical fact pop-ups
- Touch-first controls: drag-to-move, tap-to-target, ≥60px tap targets
- 1–4 player multi-touch split-screen with per-player corner control zones
- Quick Mission (7 turns) and Full Mission (14 turns) options
- Step-by-step tutorial overlay for first-time players
- Fullscreen / kiosk mode toggle
- Victory / defeat screen referencing the real Jeremiah O'Brien at Pier 45
- Pure procedural assets — no external textures/models — fully offline-capable
- Vite + TypeScript build, deployable as static files

---

## Phase 2 — Player Registration + CiviCRM Mailing List Integration

**Goal:** Capture player contact info after each completed mission and feed it
into the existing CiviCRM at ssjeremiahobrien.org for the museum's mailing
list and visitor analytics.

### Frontend (game)

After the victory/defeat screen, show a "Log Your Mission" form:

| Field | Required | Notes |
|---|---|---|
| Name | ✅ | First + last |
| Email | ✅ | Validated client-side |
| **☐ Add me to the SS Jeremiah O'Brien mailing list** | opt-in, default UNCHECKED | Clear consent language |
| Scout Troop # | optional | Shown contextually when session was started in "Scout Group" mode |
| Submit button | — | "Record My Mission" |

Behavior:
- Form is **skippable** — a "Play Again" link bypasses submission entirely
- On submit, show inline confirmation:
  *"Welcome aboard, [Name]! You saved [X] of 25 ships."*
- GDPR / CAN-SPAM compliant:
  - Clear opt-in language ("you can unsubscribe at any time")
  - Privacy link to ssjeremiahobrien.org/privacy
  - No prechecked marketing boxes (EU/CA compliance)

### Backend (new service)

Small Express or Fastify endpoint, deploy under
`api.ssjeremiahobrien.org` or `game.ssjeremiahobrien.org/api`:

```
POST /api/missions
{
  "name": "...",
  "email": "...",
  "optInMailingList": true|false,
  "scoutTroop": "...optional...",
  "stats": {
    "shipsSaved": 18,
    "shipsSunk": 7,
    "uboatsSunk": 4,
    "turnsPlayed": 7,
    "outcome": "victory",
    "score": 1850,
    "date": "2026-05-15T..."
  }
}
```

The service:
1. Creates / upserts a CiviCRM **Contact** via the existing REST/APIv4 at
   ssjeremiahobrien.org (match on email)
2. If `optInMailingList` → adds the contact to **CiviCRM Group ID 2**
   (Newsletter Subscribers), with `status=Added`
3. Logs the game stats as a CiviCRM **Activity** of a new custom type
   "Convoy Game Completed" — or as custom fields on the contact. (TBD with
   museum staff.)
4. Returns `{ ok: true, contactId, message: "Welcome aboard..." }`

### Hosting

- Static game files: `game.ssjeremiahobrien.org` (CloudFront or nginx on the
  existing .85 box, staging-first per project policy)
- API: same box, Node service behind nginx reverse-proxy, secured with a
  shared secret for the CiviCRM creds (never exposed to the browser)

### Auth note

CiviCRM API key + site key live ONLY on the server. The browser POSTs to our
thin Express/Fastify proxy; the proxy calls CiviCRM. No CORS exposure of
CRM credentials.

---

## Phase 3 — Analytics & Leaderboard

- Per-session metrics in CiviCRM dashboards: completion rate, average score,
  ace commanders defeated, time per session.
- Optional public leaderboard at game.ssjeremiahobrien.org/scores filtered by
  Scout troop / event date.
- Anonymized leaderboard (first name + last initial) for public display on
  the kiosk between games.

---

## Phase 4 — Educational Companion

- **"After Action Report"** screen with deeper history of the encounters in
  that session (which aces appeared, real ships sunk by them, where).
- QR code linking to the National Liberty Ship Memorial donate / membership
  page.
- Bilingual EN/ES support for SF Bay tourism.

---

## Phase 5 — On-Ship Integration

- Game results feed the digital signage in the visitor center (top scores,
  scout troop honors).
- Tie-in to existing FTSign for "Convoy Honor Roll" between cast videos.
- Optional: physical podium / button hardware via WebSerial for a more
  immersive bridge-watch feel.

---

## Out of Scope (for now)

- Realistic naval physics / actual hydrodynamics
- Multiplayer over network (the touchscreen IS the multiplayer surface)
- Story / campaign mode beyond historical fact pop-ups
- Mobile phone version — kiosk is the target form factor
