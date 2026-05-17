/** Phase 2 — "Log Your Mission" form shown after game end. */

export interface MissionStats {
  shipsSaved:   number;
  shipsSunk:    number;
  uboatsSunk:   number;
  uboatsTotal:  number;
  turnsPlayed:  number;
  totalTurns:   number;
  outcome:      'victory' | 'defeat';
  score:        number;
  date:         string;
}

/**
 * Show the mission-log form overlay.  Resolves when the user submits
 * successfully, encounters a network error (non-blocking), or skips.
 */
export function showMissionLog(stats: MissionStats): Promise<void> {
  return new Promise((resolve) => {
    const overlay   = document.getElementById('mission-log')!;
    const savedEl   = document.getElementById('ml-ships-saved');
    const form      = document.getElementById('mission-log-form') as HTMLFormElement;
    const nameInput = document.getElementById('ml-name')   as HTMLInputElement;
    const emailInput= document.getElementById('ml-email')  as HTMLInputElement;
    const optinCheck= document.getElementById('ml-optin')  as HTMLInputElement;
    const troopInput= document.getElementById('ml-troop')  as HTMLInputElement;
    const submitBtn = document.getElementById('ml-submit') as HTMLButtonElement;
    const skipBtn   = document.getElementById('ml-skip')   as HTMLButtonElement;
    const statusEl  = document.getElementById('ml-status')!;

    if (savedEl) savedEl.textContent = String(stats.shipsSaved);

    overlay.classList.add('active');

    function done() {
      overlay.classList.remove('active');
      resolve();
    }

    skipBtn.addEventListener('click', done);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name  = nameInput.value.trim();
      const email = emailInput.value.trim();

      if (!name) {
        setStatus(statusEl, 'error', 'Please enter your name.');
        return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus(statusEl, 'error', 'Please enter a valid email address.');
        return;
      }

      submitBtn.disabled = true;
      setStatus(statusEl, '', 'Logging your mission…');

      try {
        // __CONVOY_API__ is injected by the kiosk deployment; falls back to
        // the Vite proxy in development (proxies /api → localhost:3001).
        const apiBase = (window as any).__CONVOY_API__ ?? '/api';
        const res = await fetch(`${apiBase}/missions`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            name,
            email,
            optInMailingList: optinCheck.checked,
            scoutTroop: troopInput.value.trim() || undefined,
            stats,
          }),
        });

        const data = await res.json() as { ok: boolean; message?: string; error?: string };

        if (data.ok) {
          setStatus(statusEl, 'success',
            data.message ??
            `Welcome aboard, ${name.split(' ')[0]}! You saved ${stats.shipsSaved} of 25 ships.`
          );
          submitBtn.style.display = 'none';
          skipBtn.textContent = 'Play Again →';
          setTimeout(done, 4000);
        } else {
          setStatus(statusEl, 'error', data.error ?? 'Something went wrong. Try again.');
          submitBtn.disabled = false;
        }
      } catch {
        // Network failure — don't block the player
        setStatus(statusEl, 'warn',
          'Could not reach the server right now. Your mission was still great, Commander!'
        );
        setTimeout(done, 3000);
      }
    });
  });
}

function setStatus(el: HTMLElement, kind: string, text: string) {
  el.className = kind ? `ml-status ${kind}` : 'ml-status';
  el.textContent = text;
}
