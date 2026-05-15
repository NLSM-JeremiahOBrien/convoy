/* Dice & RNG — visible 2d6 rolls with target-number resolution. */

export type DiceRollResult = {
  rolls: number[];
  total: number;
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
 * Shows N dice rolling, then settles on the actual values,
 * shows outcome, waits for user to click CONTINUE.
 */
export async function showDiceRoll(opts: {
  title: string;
  numDice: number;
  target: number;       // sum needed to succeed
  bonus?: number;       // added to total
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

  // Roll
  const rolls = rollNd6(opts.numDice);
  const bonus = opts.bonus ?? 0;
  const total = rolls.reduce((a, b) => a + b, 0) + bonus;
  const success = total >= opts.target;

  // Build dice DOM, animate
  const dieEls: HTMLElement[] = [];
  for (let i = 0; i < opts.numDice; i++) {
    const d = document.createElement('div');
    d.className = 'die rolling';
    d.textContent = String(1 + Math.floor(Math.random() * 6));
    container.appendChild(d);
    dieEls.push(d);
  }

  // Animate flickering values for a moment
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

  // Settle to final values
  for (let i = 0; i < dieEls.length; i++) {
    dieEls[i].textContent = String(rolls[i]);
    dieEls[i].classList.remove('rolling');
    dieEls[i].classList.add(success ? 'hit' : 'miss');
  }

  outcomeEl.textContent =
    `Rolled ${rolls.join(' + ')}${bonus ? ' +' + bonus : ''} = ${total} (need ${opts.target}+). ` +
    (success ? opts.successText : opts.failureText);
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

  return { rolls, total, target: opts.target, success };
}

/** Quick non-modal probability check. */
export function rollCheck(target: number, numDice = 2, bonus = 0): boolean {
  const rolls = rollNd6(numDice);
  const total = rolls.reduce((a, b) => a + b, 0) + bonus;
  return total >= target;
}
