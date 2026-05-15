/* ============================================================
   Convoy: Battle of the North Atlantic — main game controller
   Wires scene + entities + turn engine + UI together.
   ============================================================ */
import * as THREE from 'three';
import { SceneManager } from './scene/SceneManager';
import { Input, type PointerEventInfo } from './scene/Input';
import { LibertyShip } from './entities/LibertyShip';
import { Destroyer } from './entities/Destroyer';
import { UBoat } from './entities/UBoat';
import { EffectsManager } from './entities/Effects';
import { planUBoatTurn, type AIAction } from './ai/UBoatAI';
import { showDiceRoll, rollCheck, rollNd6 } from './dice';
import { showMessage, showAceFact, Tutorial, DEFAULT_TUTORIAL_STEPS } from './ui/UI';
import {
  LIBERTY_SHIP_NAMES,
  DESTROYER_NAMES,
  PLAYER_COLORS,
  ACE_COMMANDERS,
  GAME_CONFIG,
  type AceCommander,
} from './data';

export type GameOptions = {
  totalTurns: number;       // 7 or 14
  numPlayers: number;       // 1-4
  playerNames: string[];    // [P1, P2, ...]
  tutorial: boolean;
};

type PlayerControl = {
  destroyer: Destroyer;
  panelEl: HTMLElement;
  hullFillEl: HTMLElement;
  hullTextEl: HTMLElement;
  buttons: Record<string, HTMLButtonElement>;
};

export class Game {
  private scene: SceneManager;
  private input!: Input;
  private effects: EffectsManager;
  private opts: GameOptions;
  private aaPhaseActive = false;
  private aaScore = 0;
  private aaTimeLeft = 0;
  private aaPlanes: { mesh: THREE.Group; hp: number; speed: number; bombing: boolean }[] = [];
  private aaInterval: number | null = null;
  private aaCrosshairEl: HTMLElement | null = null;

  // World state
  private convoy: LibertyShip[] = [];
  private uboats: UBoat[] = [];
  private destroyers: Destroyer[] = [];
  private convoyOrigin = new THREE.Vector3(0, 0, 0);
  private convoyDistance = 0;            // how far convoy has traveled
  private turn = 1;
  private isNight = false;
  private uboatsKnown = 0;
  private uboatsSunk = 0;
  private gameOver = false;
  private playerControls: PlayerControl[] = [];
  private rafId: number | null = null;
  private clock = new THREE.Clock();

  constructor(opts: GameOptions) {
    this.opts = opts;
    const container = document.getElementById('app')!;
    this.scene = new SceneManager(container);
    this.effects = new EffectsManager(this.scene.scene);
  }

  async start() {
    this.buildConvoy();
    this.buildDestroyers();
    this.buildUBoats();
    this.setupUI();
    this.installInput();
    this.startRenderLoop();

    // Set initial phase
    this.applyPhase();

    if (this.opts.tutorial) {
      const tut = new Tutorial(DEFAULT_TUTORIAL_STEPS);
      await tut.start();
    }

    showMessage(`Mission underway. Get ${Math.ceil(GAME_CONFIG.CONVOY_SIZE * GAME_CONFIG.VICTORY_RATIO)} of ${GAME_CONFIG.CONVOY_SIZE} ships to port.`, 'info', 8000);
    showMessage('Drag the ocean to move your destroyer. Tap actions to attack.', 'info', 8000);
  }

  // ---------- Build world ----------

  private buildConvoy() {
    const cfg = GAME_CONFIG;
    const cols = cfg.CONVOY_COLS;
    const rows = cfg.CONVOY_ROWS;
    const spacing = cfg.CONVOY_SPACING;

    let nameIdx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const name = LIBERTY_SHIP_NAMES[nameIdx % LIBERTY_SHIP_NAMES.length];
        nameIdx++;
        const ship = new LibertyShip(name);
        // Center the formation around origin, convoy heads +X (east → Liverpool)
        ship.group.position.set(
          (c - (cols - 1) / 2) * spacing - 80,  // offset behind destroyer
          0,
          (r - (rows - 1) / 2) * spacing,
        );
        ship.group.rotation.y = -Math.PI / 2; // face -Z? actually face +X (heading)
        ship.group.rotation.y = 0; // bow already points +X
        this.scene.scene.add(ship.group);
        // Label
        this.scene.addLabel(ship.group, name, 'ship-label', 9);
        this.convoy.push(ship);
      }
    }
  }

  private buildDestroyers() {
    for (let i = 0; i < this.opts.numPlayers; i++) {
      const initials = (this.opts.playerNames[i] || `P${i + 1}`).slice(0, 3).toUpperCase();
      const name = DESTROYER_NAMES[i % DESTROYER_NAMES.length];
      const dd = new Destroyer(name, i, initials, GAME_CONFIG.DEPTH_CHARGES_PER_PLAYER);
      // Position destroyers around the convoy perimeter
      const angle = (i / this.opts.numPlayers) * Math.PI * 2;
      dd.group.position.set(
        Math.cos(angle) * 60 + 20,
        0,
        Math.sin(angle) * 50,
      );
      this.scene.scene.add(dd.group);
      // Player label
      const labelText = `${PLAYER_COLORS[i].name}: ${initials}`;
      const labelObj = this.scene.addLabel(dd.group, labelText, 'ship-label player', 8);
      (labelObj.element as HTMLElement).style.borderLeft = `3px solid ${PLAYER_COLORS[i].css}`;
      this.destroyers.push(dd);
    }
  }

  private buildUBoats() {
    const cfg = GAME_CONFIG;
    const count = this.opts.totalTurns <= 7 ? cfg.UBOATS_QUICK : cfg.UBOATS_FULL;
    const acePool = [...ACE_COMMANDERS];
    // Shuffle pool
    for (let i = acePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [acePool[i], acePool[j]] = [acePool[j], acePool[i]];
    }

    for (let i = 0; i < count; i++) {
      const isAce = Math.random() < cfg.ACE_CHANCE && acePool.length > 0;
      const ace = isAce ? acePool.shift()! : null;
      const ub = new UBoat(`U-${100 + Math.floor(Math.random() * 900)}`, ace);
      ub.randomiseDepth();  // assign random running depth
      const ang = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 120;
      ub.group.position.set(Math.cos(ang) * dist + 40, -5, Math.sin(ang) * dist);
      ub.setVisualState();
      this.scene.scene.add(ub.group);
      this.uboats.push(ub);
    }
  }

  // ---------- UI plumbing ----------

  private setupUI() {
    document.body.classList.add(`players-${this.opts.numPlayers}`);

    const corners = document.querySelectorAll<HTMLElement>('.player-corner');
    // Hide all
    corners.forEach(c => c.classList.remove('active'));

    // Activate one per player
    for (let i = 0; i < this.opts.numPlayers; i++) {
      const panel = corners[i];
      panel.classList.add('active');

      // Inject template if not the first
      if (i > 0 && panel.innerHTML.trim() === '') {
        panel.innerHTML = corners[0].innerHTML;
      }

      const dd = this.destroyers[i];
      const pcolor = PLAYER_COLORS[i];

      const tag = panel.querySelector('.player-tag') as HTMLElement;
      tag.textContent = `${pcolor.name} · ${dd.initials} · ${dd.name}`;
      tag.style.borderColor = pcolor.css;
      tag.style.color = pcolor.css;

      const hullFill = panel.querySelector('.health-fill') as HTMLElement;
      const hullText = panel.querySelector('.player-hull-row span:first-child') as HTMLElement;

      const buttons: Record<string, HTMLButtonElement> = {};
      panel.querySelectorAll<HTMLButtonElement>('.action-btn').forEach(btn => {
        const action = btn.dataset.action!;
        buttons[action] = btn;
        btn.addEventListener('click', () => this.onActionButton(i, action));
      });

      this.playerControls.push({
        destroyer: dd, panelEl: panel,
        hullFillEl: hullFill, hullTextEl: hullText, buttons
      });
    }

    // End turn button
    const endBtn = document.getElementById('btn-end-turn') as HTMLButtonElement;
    endBtn.addEventListener('click', () => this.onEndTurn());

    this.refreshHUD();
    this.refreshConvoyGrid();
  }

  private installInput() {
    this.input = new Input(this.scene, {
      onDragEnd: (ev) => this.handleDragEnd(ev),
      onTap:     (ev) => this.handleTap(ev),
    });
  }

  /** Find the active player whose destroyer is closest to the start of a drag. */
  private playerForPointer(ev: PointerEventInfo): number {
    if (!ev.startWorld) return 0;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.destroyers.length; i++) {
      const d = this.destroyers[i];
      if (!d.isAlive()) continue;
      const dx = d.group.position.x - ev.startWorld.x;
      const dz = d.group.position.z - ev.startWorld.z;
      const dist = Math.hypot(dx, dz);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    return best;
  }

  private handleDragEnd(ev: PointerEventInfo) {
    if (this.gameOver || !ev.world) return;
    const pIdx = this.playerForPointer(ev);
    const dd = this.destroyers[pIdx];
    if (!dd.isAlive() || dd.moveTokens <= 0) {
      showMessage(`${PLAYER_COLORS[pIdx].name} destroyer already moved this turn.`, 'warn', 3000);
      return;
    }
    // Constrain target within reasonable range
    const max = 60;
    const cur = dd.group.position;
    const dx = ev.world.x - cur.x;
    const dz = ev.world.z - cur.z;
    const dist = Math.hypot(dx, dz);
    const clampDist = Math.min(dist, max);
    dd.targetWorldPos = new THREE.Vector3(
      cur.x + (dx / dist) * clampDist,
      0,
      cur.z + (dz / dist) * clampDist,
    );
    dd.moveTokens = 0;
    showMessage(`${PLAYER_COLORS[pIdx].name} destroyer steaming to new position.`, 'info', 2500);
  }

  private handleTap(ev: PointerEventInfo) {
    if (this.gameOver || !ev.world) return;
    // If any player has an armed action, resolve it against this tap location
    for (let i = 0; i < this.destroyers.length; i++) {
      const dd = this.destroyers[i];
      if (!dd.isAlive()) continue;
      if (dd.armedAction) {
        this.executeAction(i, dd.armedAction, ev.world);
        dd.armedAction = null;
        this.refreshHUD();
        return;
      }
    }
  }

  private onActionButton(playerIdx: number, action: string) {
    const dd = this.destroyers[playerIdx];
    if (!dd.isAlive()) return;

    // Toggle off if same action already armed
    if (dd.armedAction === action) {
      dd.armedAction = null;
      this.refreshHUD();
      return;
    }

    // Validate cost/cooldowns
    if (action === 'sonar' && dd.sonarPingsLeft <= 0) {
      showMessage('No sonar pings remaining this turn.', 'warn');
      return;
    }
    if (action === 'depthcharge' && dd.depthCharges <= 0) {
      showMessage('Out of depth charges!', 'danger');
      return;
    }
    if (action === 'depthcharge' && dd.depthChargeUsedThisTurn) {
      showMessage('Depth charges already deployed this turn — wait for next turn.', 'warn');
      return;
    }
    if (action === 'deckgun' && dd.deckGunCooldown > 0) {
      showMessage('Deck gun reloading.', 'warn');
      return;
    }

    dd.armedAction = action as any;
    // Clear other players' armed actions to avoid confusion
    for (let i = 0; i < this.destroyers.length; i++) {
      if (i !== playerIdx) this.destroyers[i].armedAction = null;
    }
    const msg: Record<string, string> = {
      sonar:       'Tap where to ping with sonar.',
      lookout:     'Tap a direction to scan with lookouts.',
      depthcharge: 'Tap to drop depth charges (be close to a submerged U-boat).',
      deckgun:     'Tap a surfaced U-boat to fire deck gun.',
      ram:         'Tap a surfaced U-boat to attempt to ram it.',
    };
    showMessage(`${PLAYER_COLORS[playerIdx].name}: ${msg[action]}`, 'info', 4000);
    this.refreshHUD();
  }

  // ---------- Action execution ----------

  private async executeAction(playerIdx: number, action: string, target: THREE.Vector3) {
    const dd = this.destroyers[playerIdx];
    switch (action) {
      case 'sonar': return this.actionSonar(dd, target);
      case 'lookout': return this.actionLookout(dd, target);
      case 'depthcharge': return this.actionDepthCharge(dd, target);
      case 'deckgun': return this.actionDeckGun(dd, target);
      case 'ram': return this.actionRam(dd, target);
    }
  }

  private actionSonar(dd: Destroyer, target: THREE.Vector3) {
    // Visual ping
    const screen = this.scene.worldToScreen(target);
    const ping = document.getElementById('sonar-display')!;
    ping.style.left = `${screen.x}px`;
    ping.style.top = `${screen.y}px`;
    ping.classList.remove('active');
    void ping.offsetWidth; // reflow
    ping.classList.add('active');

    // Reveal submerged U-boats within range
    let found = 0;
    for (const ub of this.uboats) {
      if (ub.state !== 'submerged' || ub.state === undefined) continue;
      const d = ub.group.position.distanceTo(target);
      if (d < GAME_CONFIG.SONAR_RANGE) {
        // Aces partially evade
        const evade = ub.ace ? ub.ace.evadeBonus : 0;
        if (rollCheck(7 + evade, 2, 0)) {
          ub.revealed = true;
          ub.setVisualState();
          found++;
        }
      }
    }
    dd.sonarPingsLeft--;
    showMessage(
      found > 0
        ? `🔊 Sonar contact! ${found} submerged U-boat(s) detected. (${dd.sonarPingsLeft} pings left)`
        : `🔊 Sonar ping — no contacts in range. (${dd.sonarPingsLeft} pings left)`,
      found > 0 ? 'good' : 'info',
    );
  }

  private actionLookout(dd: Destroyer, target: THREE.Vector3) {
    let found = 0;
    for (const ub of this.uboats) {
      if (ub.state !== 'surfaced') continue;
      const d = ub.group.position.distanceTo(target);
      if (d < GAME_CONFIG.SONAR_RANGE * 1.2) {
        ub.revealed = true;
        ub.setVisualState();
        found++;
      }
    }
    showMessage(
      found > 0
        ? `🔭 Lookout spotted ${found} surfaced U-boat(s)!`
        : '🔭 Horizon clear.',
      found > 0 ? 'good' : 'info',
    );
  }

  /** Show depth selector UI; returns chosen depth in feet or null if cancelled. */
  private showDepthSelector(): Promise<number | null> {
    return new Promise((resolve) => {
      const depths = [100, 200, 300, 400];
      const modal = document.createElement('div');
      modal.id = 'depth-selector';
      modal.innerHTML = `
        <div class="depth-modal">
          <div class="depth-title">⚙ SET DEPTH CHARGE DEPTH</div>
          <div class="depth-subtitle">Your sonar gives you a bearing — but not the depth.<br>Choose wrong and the charges explode harmlessly.</div>
          <div class="depth-buttons">
            ${depths.map(d => `<button class="depth-btn" data-depth="${d}">${d} ft</button>`).join('')}
          </div>
          <button class="depth-cancel">Cancel</button>
        </div>
      `;
      // Style
      const style = document.createElement('style');
      style.id = 'depth-selector-style';
      style.textContent = `
        #depth-selector {
          position:fixed;inset:0;z-index:3000;
          background:rgba(0,0,0,0.75);
          display:flex;align-items:center;justify-content:center;
        }
        .depth-modal {
          background:#0d1f2d;border:2px solid #3a6a8a;
          border-radius:12px;padding:28px 32px;
          text-align:center;max-width:420px;width:90%;
          box-shadow:0 0 40px rgba(0,120,200,0.3);
        }
        .depth-title {
          font-size:22px;font-weight:900;color:#ffcc44;
          text-transform:uppercase;letter-spacing:2px;
          margin-bottom:10px;
        }
        .depth-subtitle {
          font-size:14px;color:#99b8cc;margin-bottom:22px;line-height:1.5;
        }
        .depth-buttons {
          display:flex;gap:12px;justify-content:center;flex-wrap:wrap;
          margin-bottom:16px;
        }
        .depth-btn {
          background:#1a3a5a;border:2px solid #4a8aaa;color:#fff;
          font-size:20px;font-weight:700;padding:16px 20px;
          border-radius:8px;cursor:pointer;min-width:80px;
          transition:background 0.15s,transform 0.1s;
        }
        .depth-btn:hover,.depth-btn:active {
          background:#2a5a8a;transform:scale(1.06);
        }
        .depth-cancel {
          background:none;border:1px solid #445;color:#778;
          padding:8px 20px;border-radius:6px;cursor:pointer;font-size:14px;
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(modal);

      modal.querySelectorAll<HTMLButtonElement>('.depth-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          modal.remove(); style.remove();
          resolve(parseInt(btn.dataset.depth!));
        });
      });
      modal.querySelector('.depth-cancel')!.addEventListener('click', () => {
        modal.remove(); style.remove();
        resolve(null);
      });
    });
  }

  private async actionDepthCharge(dd: Destroyer, target: THREE.Vector3) {
    if (dd.depthCharges <= 0) return;

    // ── Step 1: Player sets depth ────────────────────────────────────────────
    const chosenDepth = await this.showDepthSelector();
    if (chosenDepth === null) return;

    dd.depthCharges--;
    dd.depthChargeUsedThisTurn = true;

    // ── Step 2: Find revealed U-boats within XZ blast radius ─────────────────
    // Must have been pinged by sonar first (revealed=true)
    const candidates: UBoat[] = [];
    for (const ub of this.uboats) {
      if (ub.state === 'destroyed' || ub.state === 'surfaced') continue;
      const xzDist = Math.hypot(
        ub.group.position.x - target.x,
        ub.group.position.z - target.z,
      );
      if (xzDist < GAME_CONFIG.DEPTH_CHARGE_RANGE && ub.revealed) {
        candidates.push(ub);
      }
    }

    // ── Step 3: Visual drop ──────────────────────────────────────────────────
    for (let i = 0; i < 4; i++) {
      const offset = new THREE.Vector3(
        target.x + (Math.random() - 0.5) * 10,
        0,
        target.z + (Math.random() - 0.5) * 10,
      );
      setTimeout(() => this.effects.splash(offset, 1.4), i * 180);
    }
    showMessage(`💣 Depth charges set to ${chosenDepth} ft — away!`, 'info');
    await sleep(900);

    if (candidates.length === 0) {
      showMessage('💣 Detonated — no sonar contacts in range. Ping sonar over the target first.', 'warn');
      this.refreshHUD();
      return;
    }

    // ── Step 4: Resolve per U-boat ───────────────────────────────────────────
    for (const ub of candidates) {
      if (ub.ace && !ub.revealed) {
        ub.revealed = true; ub.setVisualState();
        await showAceFact(ub.ace);
      }

      // Depth match check — within 100 ft above OR below = kill zone
      // Depth levels are 100ft apart so this means: exact match OR one level off
      const depthDiff = Math.abs(chosenDepth - ub.depthFeet);
      const inKillZone = depthDiff <= 100;  // ±100 ft tolerance

      if (!inKillZone) {
        ub.evadeDepth();
        const dir = chosenDepth < ub.depthFeet ? 'too shallow' : 'too deep';
        showMessage(
          `💣 Charges at ${chosenDepth} ft — ${dir}! ${ub.id} is outside the kill zone and changes depth.`,
          'warn',
        );
        continue;
      }

      // In kill zone — roll 4d6, each 5-6 = hit
      const evadeBonus = ub.ace ? ub.ace.evadeBonus : 0;
      const hitTarget  = 5 + evadeBonus;  // 5+ normally, 6+ vs aces with evade
      const result = await showDiceRoll({
        title: `DEPTH CHARGES vs ${ub.id}${ub.ace ? ' · ' + ub.ace.name : ''} @ ${ub.depthFeet} ft`,
        numDice: 4,
        hitTarget,
        countMode: true,
        successText: `DEPTH CORRECT — charges bracket the sub!`,
        failureText: `${ub.id} slips through the pattern.`,
      });

      const hits = result.hits ?? 0;

      if (hits >= 2) {
        ub.damage(35);
        this.effects.explosion(ub.group.position, 1.8);
        if (ub.state === 'destroyed') {
          this.uboatsSunk++;
          showMessage(`💀 ${ub.id}${ub.ace ? ' (' + ub.ace.name + ')' : ''} SUNK by depth charges!`, 'good');
        } else {
          // Roll to force surface (5-6 on d6)
          const surfaceRoll = Math.ceil(Math.random() * 6);
          if (surfaceRoll >= 5) {
            ub.state = 'surfaced'; ub.revealed = true; ub.setVisualState();
            showMessage(`💥 ${ub.id} DAMAGED and FORCED TO SURFACE — open fire with deck guns!`, 'good');
          } else {
            ub.evadeDepth();
            showMessage(`💥 ${ub.id} damaged (Hull: ${ub.hull}) — dives to new depth.`, 'good');
          }
        }
      } else if (hits === 1) {
        ub.damage(12); ub.evadeDepth();
        showMessage(`💣 Near miss — ${ub.id} shaken, changes depth. Hull: ${ub.hull}`, 'warn');
      } else {
        ub.evadeDepth();
        showMessage(`${ub.id} avoids the pattern — changes depth.`, 'warn');
      }
    }
    this.refreshHUD();
    this.checkWinLoss();
  }

  private async actionDeckGun(dd: Destroyer, target: THREE.Vector3) {
    // Find nearest surfaced & revealed U-boat to tap point
    let best: UBoat | null = null;
    let bestDist = 25;
    for (const ub of this.uboats) {
      if (ub.state !== 'surfaced') continue;
      if (!ub.revealed) continue;
      const d = ub.group.position.distanceTo(target);
      if (d < bestDist) { bestDist = d; best = ub; }
    }
    if (!best) {
      showMessage('🔫 No surfaced target. Use lookouts first.', 'warn');
      return;
    }

    // Tracer from destroyer to target
    const from = dd.group.position.clone(); from.y = 1.5;
    const to = best.group.position.clone(); to.y = 1;
    this.effects.tracer(from, to);

    if (best.ace && !best.revealed) {
      best.revealed = true;
      await showAceFact(best.ace);
    }

    const evade = best.ace ? best.ace.evadeBonus : 0;
    const result = await showDiceRoll({
      title: `DECK GUN — vs ${best.id}${best.ace ? ' (' + best.ace.name + ')' : ''}`,
      numDice: 2,
      target: 6 + evade,
      successText: 'Direct hit on the conning tower!',
      failureText: 'Shells splash wide.',
    });
    if (result.success) {
      best.damage(15);
      this.effects.explosion(best.group.position, 1.2);
      if (best.state === 'destroyed') {
        this.uboatsSunk++;
        showMessage(`🔫 ${best.id}${best.ace ? ' (' + best.ace.name + ')' : ''} destroyed!`, 'good');
      } else {
        showMessage(`🔫 ${best.id} hit! Hull: ${best.hull}`, 'good');
      }
    } else {
      showMessage(`${best.id} maneuvers away.`, 'warn');
    }
    dd.deckGunCooldown = 1;
    this.refreshHUD();
    this.checkWinLoss();
  }

  private async actionRam(dd: Destroyer, target: THREE.Vector3) {
    // Only works on surfaced revealed U-boats within close range
    let best: UBoat | null = null;
    let bestDist = 30;
    for (const ub of this.uboats) {
      if (ub.state !== 'surfaced') continue;
      if (!ub.revealed) continue;
      const d = ub.group.position.distanceTo(target);
      if (d < bestDist) { bestDist = d; best = ub; }
    }
    if (!best) {
      showMessage('💥 No nearby surfaced target to ram.', 'warn');
      return;
    }

    if (best.ace && !best.revealed) {
      best.revealed = true;
      await showAceFact(best.ace);
    }

    const result = await showDiceRoll({
      title: `RAMMING ATTACK — vs ${best.id}`,
      numDice: 2,
      target: 9,
      successText: 'RAMMING SPEED! U-boat cut in half — but destroyer takes damage.',
      failureText: 'You miss the ram, scrape the side, take heavy damage.',
    });
    if (result.success) {
      best.damage(100);
      this.uboatsSunk++;
      this.effects.explosion(best.group.position, 2.2);
      dd.damage(30);
      showMessage(`💥 ${best.id} destroyed by ramming! Your hull: ${dd.hull}`, 'good');
    } else {
      dd.damage(50);
      showMessage(`💥 Ramming failed! Heavy damage. Hull: ${dd.hull}`, 'danger');
      this.effects.explosion(dd.group.position, 1.0);
    }
    this.refreshHUD();
    this.checkWinLoss();
  }

  // ---------- Turn engine ----------

  private async onEndTurn() {
    if (this.gameOver) return;
    const endBtn = document.getElementById('btn-end-turn') as HTMLButtonElement;
    endBtn.disabled = true;

    // 1. Move convoy forward
    const adv = GAME_CONFIG.CONVOY_SPEED;
    this.convoyDistance += adv;
    for (const s of this.convoy) {
      s.group.position.x += adv;
    }
    // Destroyers also drift forward (they're escorting)
    for (const d of this.destroyers) {
      d.group.position.x += adv;
    }
    // U-boats stay put (or move per AI below)
    // Move camera target forward
    this.scene.cameraTarget.x += adv;

    // 2. U-boat AI turn
    showMessage('U-boats moving...', 'warn', 2500);
    await sleep(600);
    await this.uboatAITurn();

    // 3. Check end conditions
    if (this.checkWinLoss()) {
      endBtn.disabled = false;
      return;
    }

    // 4. Advance turn / phase
    this.turn++;
    this.isNight = !this.isNight;
    this.applyPhase();

    // 5. Reset per-player state
    for (const d of this.destroyers) d.startTurn();

    // 6. Decrement uboat cooldowns
    for (const u of this.uboats) u.lastFireTurn--;

    this.refreshHUD();

    if (this.turn > this.opts.totalTurns) {
      // Before victory screen, launch AA phase!
      await this.startAAPhase();
      this.endGame(this.computeSurvivors() >= Math.ceil(GAME_CONFIG.CONVOY_SIZE * GAME_CONFIG.VICTORY_RATIO));
    } else {
      endBtn.disabled = false;
      showMessage(`Turn ${this.turn} — ${this.isNight ? '🌙 NIGHT' : '☀ DAY'}.`, 'info');
    }
  }

  private async uboatAITurn() {
    for (const ub of this.uboats) {
      if (ub.state === 'destroyed') continue;
      const plans = planUBoatTurn(ub, this.isNight, this.convoy, this.destroyers);
      for (const action of plans) {
        await this.resolveAIAction(action);
      }
    }
  }

  private async resolveAIAction(action: AIAction) {
    switch (action.kind) {
      case 'move':
        action.uboat.group.position.copy(action.to);
        break;
      case 'surface':
        action.uboat.state = 'surfaced';
        action.uboat.setVisualState();
        if (action.uboat.ace) {
          showMessage(`⚠ U-boat surfacing in the dark!`, 'danger');
        }
        break;
      case 'submerge':
        action.uboat.state = 'submerged';
        action.uboat.revealed = false;
        action.uboat.setVisualState();
        break;
      case 'torpedo':
        await this.resolveTorpedo(action);
        break;
      case 'evade':
        break;
    }
  }

  private async resolveTorpedo(action: Extract<AIAction, { kind: 'torpedo' }>) {
    const { uboat, target, hit, damage } = action;
    uboat.lastFireTurn = 0;

    // If this is an ace and player hasn't seen the bio yet, reveal it now
    if (uboat.ace && !uboat.revealed) {
      uboat.revealed = true;
      uboat.setVisualState();
      await showAceFact(uboat.ace);
    }

    // Visual torpedo
    const from = uboat.group.position.clone();
    from.y = 0;
    const to = target.group.position.clone();
    to.y = 0;
    showMessage(`⚠ Torpedo from ${uboat.id}${uboat.ace ? ' (' + uboat.ace.name + ')' : ''}!`, 'danger');
    const flight = this.effects.torpedo(from, to, 26);
    await sleep(flight * 900);

    if (hit) {
      this.effects.explosion(target.group.position, 1.8);
      target.damage(damage);
      if (target.status === 'sunk') {
        showMessage(`💀 ${target.name} TORPEDOED AND SUNK!`, 'danger');
      } else {
        showMessage(`💥 ${target.name} hit by torpedo. Hull: ${target.hull}`, 'danger');
      }
    } else {
      this.effects.splash(target.group.position.clone().add(new THREE.Vector3(8, 0, 0)), 1.0);
      showMessage(`Torpedo from ${uboat.id} misses ${target.name}.`, 'warn');
    }
    this.refreshHUD();
    this.refreshConvoyGrid();
  }

  // ---------- HUD / refresh ----------

  private applyPhase() {
    this.scene.setNight(this.isNight);
  }

  private refreshHUD() {
    (document.getElementById('turn-display') as HTMLElement).textContent =
      `${this.turn}/${this.opts.totalTurns}`;
    (document.getElementById('phase-display') as HTMLElement).textContent =
      this.isNight ? '🌙 NIGHT' : '☀ DAY';

    const progress = Math.min(100, Math.round((this.turn - 1) / this.opts.totalTurns * 100));
    (document.getElementById('progress-display') as HTMLElement).textContent = `${progress}%`;
    (document.getElementById('progress-fill') as HTMLElement).style.width = `${progress}%`;

    const alive = this.computeSurvivors();
    (document.getElementById('convoy-alive') as HTMLElement).textContent = String(alive);
    (document.getElementById('uboat-display') as HTMLElement).textContent =
      `${this.uboatsSunk}/${this.uboats.length}`;

    for (let i = 0; i < this.playerControls.length; i++) {
      const pc = this.playerControls[i];
      const dd = pc.destroyer;
      const pct = Math.max(0, Math.round(dd.hull));
      pc.hullFillEl.style.width = `${pct}%`;
      pc.hullFillEl.className = 'health-fill ' + (pct > 60 ? 'good' : pct > 30 ? 'warn' : '');
      pc.hullTextEl.textContent = `HULL ${pct}%`;

      // Update button statuses
      const updateStatus = (action: string, text: string, disabled = false) => {
        const btn = pc.buttons[action];
        if (!btn) return;
        const st = btn.querySelector('.action-status') as HTMLElement;
        if (st) st.textContent = text;
        btn.disabled = disabled || !dd.isAlive();
        btn.classList.toggle('armed', dd.armedAction === action);
      };
      updateStatus('sonar', dd.sonarPingsLeft > 0 ? `×${dd.sonarPingsLeft}` : 'EMPTY', dd.sonarPingsLeft <= 0);
      updateStatus('lookout', 'READY');
      updateStatus('depthcharge', dd.depthChargeUsedThisTurn ? 'USED' : `×${dd.depthCharges}`, dd.depthCharges <= 0 || dd.depthChargeUsedThisTurn);
      updateStatus('deckgun', dd.deckGunCooldown > 0 ? 'RELOAD' : 'READY', dd.deckGunCooldown > 0);
      updateStatus('ram', 'RISKY');
    }
  }

  private refreshConvoyGrid() {
    const grid = document.getElementById('convoy-grid')!;
    grid.innerHTML = '';
    for (const ship of this.convoy) {
      const cell = document.createElement('div');
      cell.className = 'ship-icon ' + (
        ship.status === 'sunk' ? 'sunk'
        : ship.status === 'crippled' ? 'crippled'
        : ship.status === 'damaged' ? 'damaged' : ''
      );
      cell.title = `${ship.name} — ${ship.status} (${ship.hull})`;
      grid.appendChild(cell);
    }
  }

  // ---------- End conditions ----------

  private computeSurvivors() {
    return this.convoy.filter(s => s.status !== 'sunk').length;
  }

  private checkWinLoss(): boolean {
    if (this.gameOver) return true;
    const survivors = this.computeSurvivors();
    const need = Math.ceil(GAME_CONFIG.CONVOY_SIZE * GAME_CONFIG.VICTORY_RATIO);

    // All destroyers dead = defeat
    const anyDD = this.destroyers.some(d => d.isAlive());
    if (!anyDD) { this.endGame(false); return true; }

    // Convoy below threshold = defeat
    if (survivors < need) { this.endGame(false); return true; }

    // Turns exhausted handled by onEndTurn
    return false;
  }

  private endGame(victory: boolean) {
    this.gameOver = true;
    const survivors = this.computeSurvivors();
    const screen = document.getElementById('end-screen') as HTMLElement;
    const title = document.getElementById('end-title') as HTMLElement;
    const stats = document.getElementById('end-stats') as HTMLElement;
    title.textContent = victory ? '⚓ MISSION ACCOMPLISHED ⚓' : '☠ CONVOY LOST ☠';
    title.className = victory ? 'victory' : 'defeat';
    const need = Math.ceil(GAME_CONFIG.CONVOY_SIZE * GAME_CONFIG.VICTORY_RATIO);
    const score = survivors * 100 + this.uboatsSunk * 200;
    stats.innerHTML = `
      <div class="row"><span>Ships saved</span><span class="val">${survivors} / ${GAME_CONFIG.CONVOY_SIZE}</span></div>
      <div class="row"><span>Ships sunk</span><span class="val">${GAME_CONFIG.CONVOY_SIZE - survivors}</span></div>
      <div class="row"><span>U-boats destroyed</span><span class="val">${this.uboatsSunk} / ${this.uboats.length}</span></div>
      <div class="row"><span>Turns played</span><span class="val">${Math.min(this.turn, this.opts.totalTurns)} / ${this.opts.totalTurns}</span></div>
      <div class="row"><span>Victory threshold</span><span class="val">${need} ships</span></div>
      <div class="row"><span>Final score</span><span class="val">${score}</span></div>
    `;
    screen.classList.add('active');
  }

  // ---------- Render ----------

  private startRenderLoop() {
    const loop = () => {
      const dt = this.scene.update();
      const t = this.clock.elapsedTime;
      for (const s of this.convoy) s.update(t, dt);
      for (const d of this.destroyers) d.update(t, dt);
      for (const u of this.uboats) u.update(t, dt);
      this.effects.update(dt);

      // Center camera on convoy centroid
      let cx = 0, cz = 0, n = 0;
      for (const s of this.convoy) {
        if (s.status === 'sunk') continue;
        cx += s.group.position.x; cz += s.group.position.z; n++;
      }
      if (n > 0) {
        this.scene.cameraTarget.x += ((cx / n) - this.scene.cameraTarget.x) * 0.02;
        this.scene.cameraTarget.z += ((cz / n) - this.scene.cameraTarget.z) * 0.02;
      }

      this.rafId = requestAnimationFrame(loop);
    };
    this.clock.start();
    loop();
  }

  dispose() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  // ==================== AA OERLIKON PHASE ====================

  private async startAAPhase(): Promise<void> {
    // Historical: Fw 200 Condors attacked convoys from the air.
    // The O'Brien has 8 Oerlikon 20mm cannons. Let the player use them!
    this.aaPhaseActive = true;
    this.aaScore = 0;

    // Show AA overlay
    const overlay = document.createElement('div');
    overlay.id = 'aa-overlay';
    overlay.innerHTML = `
      <div class="aa-header">
        <div class="aa-title">⚠ AIR ATTACK! ⚠</div>
        <div class="aa-subtitle">Fw 200 Condors inbound! Man the Oerlikon 20mm cannons!</div>
        <div class="aa-info">The SS Jeremiah O'Brien carries 8 Oerlikon 20mm anti-aircraft cannons — tap the planes to shoot them down!</div>
        <div class="aa-stats">
          <span id="aa-timer">30s</span>
          <span id="aa-score">Score: 0</span>
          <span id="aa-planes-left">Planes: 6</span>
        </div>
      </div>
      <div id="aa-crosshair" class="aa-crosshair">+</div>
    `;
    document.body.appendChild(overlay);
    this.aaCrosshairEl = document.getElementById('aa-crosshair')!;

    // Style it
    const style = document.createElement('style');
    style.id = 'aa-styles';
    style.textContent = `
      #aa-overlay {
        position: fixed; inset: 0; z-index: 2000;
        pointer-events: none;
      }
      .aa-header {
        position: absolute; top: 0; left: 0; right: 0;
        text-align: center; padding: 12px;
        background: linear-gradient(180deg, rgba(120,0,0,0.85) 0%, transparent 100%);
        pointer-events: none;
      }
      .aa-title {
        font-size: 32px; font-weight: 900; color: #ff4444;
        text-shadow: 0 0 20px #ff0000, 0 2px 4px rgba(0,0,0,0.8);
        animation: aa-pulse 0.5s ease-in-out infinite alternate;
      }
      @keyframes aa-pulse { from { opacity: 0.8; } to { opacity: 1; } }
      .aa-subtitle { font-size: 18px; color: #ffcc44; margin-top: 4px; }
      .aa-info { font-size: 14px; color: #ddd; margin-top: 4px; font-style: italic; }
      .aa-stats {
        display: flex; gap: 30px; justify-content: center; margin-top: 10px;
        font-size: 22px; font-weight: 700; color: white;
      }
      .aa-crosshair {
        position: fixed; font-size: 48px; color: #ff4444;
        pointer-events: none; transform: translate(-50%, -50%);
        text-shadow: 0 0 10px #ff0000;
        font-family: monospace; font-weight: 900;
      }
      .aa-plane {
        position: fixed; pointer-events: all; cursor: crosshair;
        font-size: 48px; z-index: 2001;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
        transition: transform 0.1s;
        user-select: none;
      }
      .aa-plane:hover { transform: scale(1.15); }
      .aa-plane.hit {
        color: orange !important;
        animation: aa-hit 0.3s ease-out;
      }
      @keyframes aa-hit {
        0% { transform: scale(1.3); filter: brightness(3); }
        100% { transform: scale(1); filter: brightness(1); }
      }
      .aa-plane.destroyed {
        animation: aa-destroy 0.8s ease-out forwards;
      }
      @keyframes aa-destroy {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.5) rotate(45deg); opacity: 0.7; filter: brightness(3) hue-rotate(-30deg); }
        100% { transform: scale(0.3) rotate(180deg) translateY(200px); opacity: 0; }
      }
      .aa-muzzle-flash {
        position: fixed; width: 30px; height: 30px;
        background: radial-gradient(circle, #ffff00 0%, #ff8800 40%, transparent 70%);
        border-radius: 50%; pointer-events: none; z-index: 2002;
        transform: translate(-50%, -50%);
        animation: aa-flash 0.15s ease-out forwards;
      }
      @keyframes aa-flash {
        from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        to { opacity: 0; transform: translate(-50%, -50%) scale(2.5); }
      }
      .aa-tracer {
        position: fixed; width: 3px; height: 3px;
        background: #ffff44; border-radius: 50%;
        pointer-events: none; z-index: 2002;
        box-shadow: 0 0 6px #ffff00, 0 0 12px #ff8800;
      }
    `;
    document.head.appendChild(style);

    // Move crosshair with pointer
    const onMove = (e: PointerEvent | TouchEvent) => {
      const x = 'touches' in e ? e.touches[0].clientX : (e as PointerEvent).clientX;
      const y = 'touches' in e ? e.touches[0].clientY : (e as PointerEvent).clientY;
      if (this.aaCrosshairEl) {
        this.aaCrosshairEl.style.left = x + 'px';
        this.aaCrosshairEl.style.top = y + 'px';
      }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('touchmove', onMove, { passive: true });

    // Spawn planes
    const totalPlanes = 6;
    let planesAlive = totalPlanes;
    let planesSpawned = 0;
    const planeEls: HTMLElement[] = [];
    const planeState: { hp: number; el: HTMLElement; alive: boolean; x: number; y: number; vx: number; vy: number }[] = [];

    const spawnPlane = () => {
      if (planesSpawned >= totalPlanes) return;
      planesSpawned++;
      const el = document.createElement('div');
      el.className = 'aa-plane';
      el.textContent = '✈️';
      // Random start from edges
      const side = Math.floor(Math.random() * 4);
      const w = window.innerWidth, h = window.innerHeight;
      let sx = 0, sy = 0, vx = 0, vy = 0;
      const speed = 1.5 + Math.random() * 2;
      switch (side) {
        case 0: sx = -60; sy = Math.random() * h; vx = speed; vy = (Math.random() - 0.5) * 1.2; break;
        case 1: sx = w + 60; sy = Math.random() * h; vx = -speed; vy = (Math.random() - 0.5) * 1.2; break;
        case 2: sx = Math.random() * w; sy = -60; vx = (Math.random() - 0.5) * 1.2; vy = speed; break;
        case 3: sx = Math.random() * w; sy = h + 60; vx = (Math.random() - 0.5) * 1.2; vy = -speed; break;
      }
      el.style.left = sx + 'px';
      el.style.top = sy + 'px';
      // Mirror plane if going right
      if (vx < 0) el.style.transform = 'scaleX(-1)';
      document.body.appendChild(el);
      planeEls.push(el);
      const state = { hp: 3, el, alive: true, x: sx, y: sy, vx, vy };
      planeState.push(state);

      // Click/tap to shoot
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!state.alive) return;

        // Muzzle flash at click location
        const flash = document.createElement('div');
        flash.className = 'aa-muzzle-flash';
        flash.style.left = e.clientX + 'px';
        flash.style.top = e.clientY + 'px';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 200);

        // Tracer burst (3 tracers)
        for (let i = 0; i < 3; i++) {
          const tracer = document.createElement('div');
          tracer.className = 'aa-tracer';
          const startX = window.innerWidth / 2 + (Math.random() - 0.5) * 40;
          const startY = window.innerHeight - 20;
          tracer.style.left = startX + 'px';
          tracer.style.top = startY + 'px';
          document.body.appendChild(tracer);
          const tx = state.x + (Math.random() - 0.5) * 30;
          const ty = state.y + (Math.random() - 0.5) * 30;
          const duration = 150 + i * 50;
          tracer.animate([
            { left: startX + 'px', top: startY + 'px', opacity: '1' },
            { left: tx + 'px', top: ty + 'px', opacity: '0.3' },
          ], { duration, fill: 'forwards' });
          setTimeout(() => tracer.remove(), duration + 50);
        }

        state.hp--;
        if (state.hp > 0) {
          el.classList.add('hit');
          setTimeout(() => el.classList.remove('hit'), 300);
          showMessage(`🔫 Hit! Condor taking damage (${state.hp} HP left)`, 'good', 1500);
        } else {
          state.alive = false;
          planesAlive--;
          this.aaScore += 100;
          el.classList.add('destroyed');
          setTimeout(() => el.remove(), 900);
          const scoreEl = document.getElementById('aa-score');
          if (scoreEl) scoreEl.textContent = `Score: ${this.aaScore}`;
          const planeCountEl = document.getElementById('aa-planes-left');
          if (planeCountEl) planeCountEl.textContent = `Planes: ${planesAlive}`;
          showMessage(`✈️💥 Condor shot down! ${planesAlive} remaining.`, 'good', 2000);
          // If a plane gets through, damage a random merchant
        }
      });
    };

    // Spawn planes in waves
    spawnPlane();
    spawnPlane();
    const spawnTimer = setInterval(() => {
      if (planesSpawned < totalPlanes) spawnPlane();
    }, 4000);

    // Animate planes
    const animatePlanes = () => {
      for (const p of planeState) {
        if (!p.alive) continue;
        p.x += p.vx;
        p.y += p.vy;
        p.el.style.left = p.x + 'px';
        p.el.style.top = p.y + 'px';
        // If plane crosses screen, it bombs a ship
        const w = window.innerWidth, h = window.innerHeight;
        if (p.x < -100 || p.x > w + 100 || p.y < -100 || p.y > h + 100) {
          if (p.alive) {
            p.alive = false;
            planesAlive--;
            p.el.remove();
            // Bomb a random merchant
            const living = this.convoy.filter(s => s.status !== 'sunk');
            if (living.length > 0) {
              const victim = living[Math.floor(Math.random() * living.length)];
              victim.damage(30);
              this.effects.explosion(victim.group.position, 1.2);
              showMessage(`💣 Condor bombed ${victim.name}! ${victim.status === 'sunk' ? 'SUNK!' : 'Hull: ' + victim.hull}`, 'danger', 3000);
              this.refreshConvoyGrid();
            }
            const planeCountEl = document.getElementById('aa-planes-left');
            if (planeCountEl) planeCountEl.textContent = `Planes: ${planesAlive}`;
          }
        }
      }
    };
    const animInterval = setInterval(animatePlanes, 16);

    // Countdown timer: 30 seconds
    this.aaTimeLeft = 30;
    const timerEl = document.getElementById('aa-timer')!;
    const countdownInterval = setInterval(() => {
      this.aaTimeLeft--;
      timerEl.textContent = `${this.aaTimeLeft}s`;
    }, 1000);

    // Wait for all planes dealt with or timer runs out
    return new Promise<void>((resolve) => {
      const checkDone = setInterval(() => {
        if (planesAlive <= 0 || this.aaTimeLeft <= 0) {
          clearInterval(checkDone);
          clearInterval(spawnTimer);
          clearInterval(animInterval);
          clearInterval(countdownInterval);
          document.removeEventListener('pointermove', onMove);
          // Clean up remaining planes (they escape)
          for (const p of planeState) {
            if (p.alive) {
              p.el.remove();
              // Escaped planes bomb ships
              const living = this.convoy.filter(s => s.status !== 'sunk');
              if (living.length > 0) {
                const victim = living[Math.floor(Math.random() * living.length)];
                victim.damage(20);
              }
            }
          }
          this.refreshConvoyGrid();

          // Show AA results
          const destroyed = planeState.filter(p => p.hp <= 0).length;
          overlay.innerHTML = `
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);">
              <div style="text-align:center;color:white;">
                <div style="font-size:36px;font-weight:900;color:#ffcc44;">⚓ AA DEFENSE COMPLETE ⚓</div>
                <div style="font-size:20px;margin-top:12px;">Oerlikon 20mm cannons — 8 guns blazing!</div>
                <div style="font-size:48px;margin:16px 0;">${destroyed} / ${totalPlanes} Condors shot down</div>
                <div style="font-size:16px;color:#aaa;margin-top:8px;font-style:italic;">
                  The SS Jeremiah O\u2019Brien\u2019s Oerlikons defended Liberty ships across the Atlantic and at Normandy on D-Day.
                </div>
              </div>
            </div>
          `;
          overlay.style.pointerEvents = 'all';
          overlay.style.cursor = 'pointer';
          overlay.addEventListener('click', () => {
            overlay.remove();
            style.remove();
            this.aaPhaseActive = false;
            resolve();
          }, { once: true });

          // Auto-advance after 8 seconds
          setTimeout(() => {
            if (overlay.parentElement) {
              overlay.remove();
              style.remove();
              this.aaPhaseActive = false;
              resolve();
            }
          }, 8000);
        }
      }, 200);
    });
  }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
