/* Dice & RNG — visible roll modals with sum-mode and count-mode. */

export type DiceRollResult = {
  rolls: number[];
  total: number;
  hits: number;         // count of dice >= hitTarget (countMode)
  target: number;
  success: boolean;
};

export function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

export function rollNd6(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(rollDie());
  return out;
}

/**
 * Animated dice roll modal.
 *
 * Two modes:
 *  - Default (sum mode): total of all dice must reach `target` to succeed.
 *  - countMode: each die >= `hitTarget` counts as a hit; success = hits >= 2.
 *    Pass `hitTarget` alongside `countMode: true`.
 */
export async function showDiceRoll(opts: {
  title: string;
  numDice: number;
  target?: number;       // sum needed (sum mode)
  hitTarget?: number;    // per-die threshold (count mode)
  countMode?: boolean;   // count hits per die instead of summing
  bonus?: number;
  successText: string;
  failureText: string;
}): Promise<DiceRollResult> {
  const modal = document.getElementById('dice-modal')!;
  const titleEl = document.getElementById('dice-title')!;
  const container = document.getElementById('dice-container')!;
  const outcomeEl = document.getElementById('dice-outcome')!;
  const closeBtn = document.getElementById('dice-close')! as HTMLButtonElement;

  titleEl.textContent = opts.title;
  container.innerHTML = '';
  outcomeEl.textContent = '';
  outcomeEl.className = 'dice-outcome';
  closeBtn.style.display = 'none';
  modal.classList.add('active');

  const rolls = rollNd6(opts.numDice);
  const bonus = opts.bonus ?? 0;
  const total = rolls.reduce((a, b) => a + b, 0) + bonus;

  const countMode = opts.countMode ?? false;
  const hitTarget = opts.hitTarget ?? 5;
  const hits = countMode ? rolls.filter(r => r >= hitTarget).length : 0;
  const success = countMode ? hits >= 2 : total >= (opts.target ?? 7);

  // Build dice DOM
  const dieEls: HTMLElement[] = [];
  for (let i = 0; i < opts.numDice; i++) {
    const d = document.createElement('div');
    d.className = 'die rolling';
    d.textContent = String(rollDie());
    container.appendChild(d);
    dieEls.push(d);
  }

  // Flicker animation
  const flickerStart = performance.now();
  await new Promise<void>(resolve => {
    const interval = window.setInterval(() => {
      for (const d of dieEls) d.textContent = String(rollDie());
      if (performance.now() - flickerStart > 700) {
        clearInterval(interval);
        resolve();
      }
    }, 70);
  });

  // Settle — colour each die by hit/miss
  for (let i = 0; i < dieEls.length; i++) {
    dieEls[i].textContent = String(rolls[i]);
    dieEls[i].classList.remove('rolling');
    if (countMode) {
      dieEls[i].classList.add(rolls[i] >= hitTarget ? 'hit' : 'miss');
    } else {
      dieEls[i].classList.add(success ? 'hit' : 'miss');
    }
  }

  // Outcome text
  if (countMode) {
    outcomeEl.textContent =
      `${hits} hit${hits !== 1 ? 's' : ''} (need ${hitTarget}+ on each die, 2+ hits to damage). ` +
      (success ? opts.successText : opts.failureText);
  } else {
    outcomeEl.textContent =
      `Rolled ${rolls.join(' + ')}${bonus ? ' +' + bonus : ''} = ${total} (need ${opts.target}+). ` +
      (success ? opts.successText : opts.failureText);
  }
  outcomeEl.classList.add(success ? 'success' : 'failure');

  closeBtn.style.display = 'inline-block';

  await new Promise<void>(resolve => {
    const handler = () => {
      closeBtn.removeEventListener('click', handler);
      modal.classList.remove('active');
      resolve();
    };
    closeBtn.addEventListener('click', handler);
  });

  return { rolls, total, hits, target: opts.target ?? hitTarget, success };
}

/** Quick non-modal probability check. */
export function rollCheck(target: number, numDice = 2, bonus = 0): boolean {
  const rolls = rollNd6(numDice);
  const total = rolls.reduce((a, b) => a + b, 0) + bonus;
  return total >= target;
}
