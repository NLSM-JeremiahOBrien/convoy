# Convoy: Battle of the North Atlantic

Educational WWII naval game for the **SS Jeremiah O'Brien** overnight programs.
A wolfpack of German U-boats is stalking a 25-ship convoy of American Liberty
ships bound for Liverpool. Up to 4 players co-pilot escort destroyers, hunt
the subs, and try to save the convoy.

Built with **Three.js + TypeScript + Vite**. 100% procedural assets (no external
textures or 3D models). Touch-first for a 22" landscape kiosk on the ship.

## Quick start

```sh
npm install
npm run dev      # localhost:5173
npm run build    # static files in dist/
npm run preview  # preview the production build
```

## Gameplay

- **Goal:** Get at least 60% of the convoy (15 of 25 ships) safely across.
- **Length:** Quick Mission = 7 turns. Full Mission = 14 turns. Day/night alternates.
- **Players:** 1–4, each commanding one destroyer.
- **Drag** the ocean to move your destroyer. **Tap** action buttons, then tap a
  spot in the ocean (or on a target U-boat) to execute.
- **Sonar** finds submerged U-boats. **Lookouts** spot surfaced ones (mostly
  at night). **Depth Charge** vs submerged. **Deck Gun** vs surfaced. **Ram**
  is high risk / high reward.
- All combat resolves with **visible 2d6 dice** so kids can follow the math.

## Educational hooks

- 5 **real WWII U-boat aces** (Kretschmer, Prien, Schepke, Lüth, Topp) with
  factual biographical pop-ups before each engagement.
- Liberty ship names drawn from the actual fleet, including
  *SS Jeremiah O'Brien* and *SS John W. Brown* — the two operational Libertys
  still afloat.
- End-screen connects the game back to the real ship at Pier 45 in
  San Francisco where the Scouts are sleeping.

## File layout

```
convoy-game/
├── index.html                # Title + HUD shells
├── src/
│   ├── styles.css            # All UI styling (kiosk-tuned)
│   ├── main.ts               # Boot + title screen wiring
│   ├── Game.ts               # Game controller (turns, actions, end state)
│   ├── data.ts               # Ship names, ace commanders, balance constants
│   ├── dice.ts               # 2d6 + animated dice modal
│   ├── scene/
│   │   ├── SceneManager.ts   # Three.js renderer, camera, labels
│   │   └── Input.ts          # Unified pointer (mouse + multi-touch) input
│   ├── entities/
│   │   ├── Ocean.ts          # Shader-displaced wave ocean
│   │   ├── LibertyShip.ts    # Procedural merchant
│   │   ├── Destroyer.ts      # Procedural Fletcher-class destroyer
│   │   ├── UBoat.ts          # Procedural Type VII U-boat
│   │   └── Effects.ts        # Torpedoes, splashes, explosions, tracers
│   ├── ai/UBoatAI.ts         # Per-turn U-boat decision logic
│   └── ui/UI.ts              # Toasts, tutorial, ace fact modal
├── ROADMAP.md                # Phases 2+: CiviCRM mailing list, leaderboards
└── README.md
```

## Roadmap

See [ROADMAP.md](./ROADMAP.md). Phase 2 adds the post-mission registration
form that feeds into the existing CiviCRM at ssjeremiahobrien.org.

## License

Built for the **National Liberty Ship Memorial / SS Jeremiah O'Brien**.
Educational, non-commercial use.
