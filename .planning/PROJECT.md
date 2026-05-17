# Convoy: Battle of the North Atlantic

## What This Is

An educational WWII naval browser game built for the SS Jeremiah O'Brien overnight Scout programs at Pier 35, San Francisco. Up to 4 players co-pilot escort destroyers, hunt German U-boats, and try to get at least 60% of a 25-ship Liberty convoy safely to Liverpool. Phase 1 (the core game) is fully shipped.

## Core Value

Players leave with a memorable connection to what the real Liberty ships and their escorts faced — and a reason to remember the Jeremiah O'Brien.

## Requirements

### Validated

- ✓ Three.js animated ocean with shader-based wave displacement — Phase 1
- ✓ Procedural Liberty ships (25), escort destroyers (1–4), Type VII U-boats — Phase 1
- ✓ Day/night cycle with proper lighting — Phase 1
- ✓ Turn-based engine with visible 2d6 dice rolls — Phase 1
- ✓ 5 real WWII U-boat ace commanders with biographical pop-ups — Phase 1
- ✓ Touch-first controls (drag-to-move, tap-to-target, ≥60px targets) — Phase 1
- ✓ 1–4 player multi-touch split-screen — Phase 1
- ✓ Quick Mission (7 turns) and Full Mission (14 turns) — Phase 1
- ✓ Step-by-step tutorial overlay — Phase 1
- ✓ Fullscreen/kiosk mode toggle — Phase 1
- ✓ Victory/defeat screen referencing the real Jeremiah O'Brien at Pier 35 — Phase 1
- ✓ Pure procedural assets, fully offline-capable — Phase 1
- ✓ Fw 200 Condor top-down SVG in AA phase — Phase 1 (updated)

### Active

- [ ] Post-game "Log Your Mission" registration form
- [ ] Contact capture feeds into CiviCRM mailing list at ssjeremiahobrien.org
- [ ] Game stats logged as CiviCRM Activity per completed mission
- [ ] Thin backend API proxy (Express/Fastify) keeps CiviCRM credentials server-side
- [ ] GDPR/CAN-SPAM compliant opt-in (unchecked by default)
- [ ] Per-session analytics in CiviCRM dashboards
- [ ] Optional anonymized public leaderboard on the kiosk
- [ ] After Action Report screen with deeper historical context
- [ ] QR code linking to NLSM donate/membership page

### Out of Scope

- FTSign integration — separate project, tracked elsewhere
- Mobile phone version — kiosk touchscreen is the target form factor
- Network multiplayer — the kiosk surface IS the multiplayer surface
- Realistic naval physics / hydrodynamics
- Story/campaign mode beyond historical fact pop-ups
- Bilingual EN/ES support — deferred to Phase 4+

## Context

- **Hosting target:** `game.ssjeremiahobrien.org` (static), `api.ssjeremiahobrien.org` (Node proxy)
- **CiviCRM:** Existing install at ssjeremiahobrien.org, APIv4 REST endpoint, Group ID 2 = Newsletter Subscribers
- **Kiosk:** 22" landscape touchscreen aboard the ship; also accessible via public URL
- **Scout Troop mode:** Optional troop number field when session is started in group mode
- **Stack:** Three.js + TypeScript + Vite (frontend), Express or Fastify (API proxy), CiviCRM APIv4

## Constraints

- **Credentials:** CiviCRM API key + site key must never reach the browser — server-side proxy only
- **Assets:** No external textures or 3D models — procedural only (offline-capable)
- **Compliance:** CAN-SPAM + GDPR — no pre-checked marketing boxes, unsubscribe link required
- **Kiosk UX:** All tap targets ≥60px; form must be skippable ("Play Again" bypass)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Thin Express/Fastify proxy for CiviCRM | Never expose API keys to browser | — Pending |
| CiviCRM Group ID 2 for newsletter | Museum's existing group | — Pending |
| Stats as CiviCRM Activity type | TBD with museum staff — may use custom fields instead | — Pending |
| Anonymized leaderboard (first name + last initial) | Privacy for minors | — Pending |

---
*Last updated: 2026-05-17 after Phase 1 completion, initializing Phase 2–4 planning*
