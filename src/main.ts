/* Entry point — title screen → game setup → Game instance. */
import { Game, type GameOptions } from './Game';
import { PLAYER_COLORS } from './data';
import { showLeaderboard } from './leaderboard';

// ---------- Title screen state ----------
let length: 'quick' | 'full' = 'quick';
let numPlayers = 1;
let tutorial = true;
const playerNames: string[] = ['P1', 'P2', 'P3', 'P4'];
let currentGame: Game | null = null;

function setupTitleScreen() {
  document.getElementById('title-screen')!.classList.add('active');

  // Segmented control: mission length
  const segLength = document.getElementById('seg-length')!;
  segLength.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      segLength.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      length = btn.dataset.value as 'quick' | 'full';
    });
  });

  // Players
  const segPlayers = document.getElementById('seg-players')!;
  segPlayers.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      segPlayers.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      numPlayers = parseInt(btn.dataset.value!, 10);
      renderPlayerInputs();
    });
  });

  // Tutorial toggle
  const segTut = document.getElementById('seg-tutorial')!;
  segTut.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      segTut.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tutorial = btn.dataset.value === 'on';
    });
  });

  renderPlayerInputs();

  // Start button
  document.getElementById('start-btn')!.addEventListener('click', () => {
    startGame();
  });

  // Restart button
  document.getElementById('restart-btn')!.addEventListener('click', () => {
    location.reload();
  });

  // Fullscreen toggle
  document.getElementById('fullscreen-btn')!.addEventListener('click', toggleFullscreen);

  // Leaderboard button on title screen
  document.getElementById('leaderboard-btn')!.addEventListener('click', () => {
    showLeaderboard({ attractMode: false });
  });
}

function renderPlayerInputs() {
  const wrap = document.getElementById('player-names')!;
  wrap.innerHTML = '<label>NAMES</label><div class="pn-list"></div>';
  const list = wrap.querySelector('.pn-list')!;
  for (let i = 0; i < numPlayers; i++) {
    const div = document.createElement('div');
    div.className = 'pn-input';
    div.innerHTML = `
      <div class="swatch" style="background:${PLAYER_COLORS[i].css}"></div>
      <input type="text" maxlength="8" value="${playerNames[i]}" placeholder="P${i+1}" />
    `;
    const input = div.querySelector('input') as HTMLInputElement;
    input.addEventListener('input', () => {
      playerNames[i] = input.value.trim() || `P${i+1}`;
    });
    list.appendChild(div);
  }
}

function startGame() {
  const opts: GameOptions = {
    totalTurns: length === 'quick' ? 7 : 14,
    numPlayers,
    playerNames: playerNames.slice(0, numPlayers),
    tutorial,
  };
  document.getElementById('title-screen')!.classList.remove('active');
  document.getElementById('hud')!.classList.add('active');
  currentGame = new Game(opts);
  currentGame.start();
}

function toggleFullscreen() {
  const doc = document as any;
  if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
    const el = document.documentElement as any;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  } else {
    (document.exitFullscreen || doc.webkitExitFullscreen)?.call(document);
  }
}

// Prevent pinch-zoom / double-tap-zoom on iOS-like devices
document.addEventListener('touchmove', (e) => {
  if ((e as any).scale && (e as any).scale !== 1) e.preventDefault();
}, { passive: false });
let lastTap = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTap < 300) e.preventDefault();
  lastTap = now;
}, { passive: false });

setupTitleScreen();

// If loaded as game.ssjeremiahobrien.org/scores (or ?scores), jump straight
// to leaderboard in non-attract mode so it stays open until closed.
if (window.location.pathname.endsWith('/scores') ||
    new URLSearchParams(window.location.search).has('scores')) {
  showLeaderboard({ attractMode: false });
}
