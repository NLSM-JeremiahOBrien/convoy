/** Phase 3 — leaderboard display + attract-mode countdown. */

export interface LeaderboardEntry {
  rank:       number;
  name:       string;
  score:      number;
  shipsSaved: number;
  uboatsSunk: number;
  outcome:    string;
  troop?:     string;
  date:       string;
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  stats: {
    totalGames:    number;
    victoryRate:   number;
    avgScore:      number;
    avgShipsSaved: number;
  };
}

const ATTRACT_SECONDS = 30; // auto-dismiss in attract mode
const MEDAL = ['🥇', '🥈', '🥉'];

async function fetchLeaderboard(params?: { date?: string; troop?: string; limit?: number }): Promise<LeaderboardData | null> {
  try {
    const apiBase = (window as any).__CONVOY_API__ ?? '/api';
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.date)  qs.set('date',  params.date);
    if (params?.troop) qs.set('troop', params.troop);
    const res = await fetch(`${apiBase}/leaderboard?${qs}`);
    const data = await res.json() as { ok: boolean } & LeaderboardData;
    return data.ok ? data : null;
  } catch {
    return null;
  }
}

function renderRows(entries: LeaderboardEntry[]): string {
  if (entries.length === 0) {
    return '<tr><td colspan="6" class="lb-empty">No missions logged yet. Be the first!</td></tr>';
  }
  return entries.map(e => {
    const medal  = e.rank <= 3 ? MEDAL[e.rank - 1] : `#${e.rank}`;
    const outcomeClass = e.outcome === 'victory' ? 'lb-victory' : 'lb-defeat';
    const troop  = e.troop ? `<span class="lb-troop">${esc(e.troop)}</span>` : '';
    return `
      <tr class="${outcomeClass}">
        <td class="lb-rank">${medal}</td>
        <td class="lb-name">${esc(e.name)}${troop}</td>
        <td class="lb-score">${e.score.toLocaleString()}</td>
        <td class="lb-ships">${e.shipsSaved}/25</td>
        <td class="lb-subs">${e.uboatsSunk}</td>
        <td class="lb-date">${e.date.slice(5)}</td>
      </tr>`;
  }).join('');
}

function renderStats(stats: LeaderboardData['stats']): string {
  const pct = Math.round(stats.victoryRate * 100);
  return `
    <div class="lb-stat"><div class="lb-stat-val">${stats.totalGames}</div><div class="lb-stat-lbl">MISSIONS</div></div>
    <div class="lb-stat"><div class="lb-stat-val">${pct}%</div><div class="lb-stat-lbl">VICTORY RATE</div></div>
    <div class="lb-stat"><div class="lb-stat-val">${stats.avgScore.toLocaleString()}</div><div class="lb-stat-lbl">AVG SCORE</div></div>
    <div class="lb-stat"><div class="lb-stat-val">${stats.avgShipsSaved}</div><div class="lb-stat-lbl">AVG SHIPS SAVED</div></div>
  `;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Show the leaderboard screen.
 *
 * attractMode = true: auto-dismiss after ATTRACT_SECONDS with a countdown.
 * attractMode = false: user must tap the close button (used for on-demand view).
 */
export async function showLeaderboard(opts: {
  attractMode?: boolean;
  filterTroop?: string;
  filterDate?:  string;
} = {}): Promise<void> {
  const { attractMode = true, filterTroop, filterDate } = opts;

  const screen      = document.getElementById('leaderboard-screen')!;
  const bodyEl      = document.getElementById('lb-tbody')!;
  const statsEl     = document.getElementById('lb-stats-bar')!;
  const countdownEl = document.getElementById('lb-countdown')!;
  const closeBtn    = document.getElementById('lb-close')    as HTMLButtonElement;
  const filterBar   = document.getElementById('lb-filters')!;

  // Populate filter bar date options — today + last 6 days
  filterBar.innerHTML = buildFilterBar(filterTroop, filterDate);

  // Loading state
  bodyEl.innerHTML = '<tr><td colspan="6" class="lb-loading">Loading…</td></tr>';
  statsEl.innerHTML = '';
  screen.classList.add('active');

  const data = await fetchLeaderboard({ limit: 20, date: filterDate, troop: filterTroop });

  if (data) {
    bodyEl.innerHTML  = renderRows(data.entries);
    statsEl.innerHTML = renderStats(data.stats);
  } else {
    bodyEl.innerHTML = '<tr><td colspan="6" class="lb-empty">Could not load leaderboard.</td></tr>';
  }

  // Wire filter buttons
  filterBar.querySelectorAll<HTMLButtonElement>('.lb-filter-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      filterBar.querySelectorAll('.lb-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const d = btn.dataset.date;
      bodyEl.innerHTML = '<tr><td colspan="6" class="lb-loading">Loading…</td></tr>';
      const filtered = await fetchLeaderboard({ limit: 20, date: d, troop: filterTroop });
      bodyEl.innerHTML = filtered ? renderRows(filtered.entries) : '<tr><td colspan="6" class="lb-empty">No results.</td></tr>';
    });
  });

  return new Promise<void>((resolve) => {
    let secondsLeft = ATTRACT_SECONDS;
    let timer: ReturnType<typeof setInterval> | null = null;

    function done() {
      if (timer) clearInterval(timer);
      screen.classList.remove('active');
      resolve();
    }

    closeBtn.onclick = done;

    if (attractMode) {
      countdownEl.style.display = 'block';
      countdownEl.textContent   = `${secondsLeft}s`;
      timer = setInterval(() => {
        secondsLeft--;
        countdownEl.textContent = `${secondsLeft}s`;
        if (secondsLeft <= 0) done();
      }, 1000);
      // Tap anywhere on the screen resets the timer (keeps it open)
      screen.addEventListener('pointerdown', () => {
        secondsLeft = ATTRACT_SECONDS;
        countdownEl.textContent = `${secondsLeft}s`;
      }, { passive: true });
    } else {
      countdownEl.style.display = 'none';
    }
  });
}

function buildFilterBar(activeTroop?: string, activeDate?: string): string {
  const today = new Date();
  const dates: { label: string; value: string }[] = [
    { label: 'All Time', value: '' },
  ];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : iso.slice(5);
    dates.push({ label, value: iso });
  }
  return dates.map(d =>
    `<button class="lb-filter-btn${d.value === (activeDate ?? '') ? ' active' : ''}"
             data-date="${d.value}">${d.label}</button>`
  ).join('');
}
