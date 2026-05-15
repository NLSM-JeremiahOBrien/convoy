/** UI helper: messages, HUD updates, tutorial, fact modal. */

import { ACE_COMMANDERS, type AceCommander } from '../data';

export type MessageKind = 'info' | 'warn' | 'danger' | 'good';

export function showMessage(text: string, kind: MessageKind = 'info', ttl = 6000) {
  const log = document.getElementById('message-log');
  if (!log) return;
  const div = document.createElement('div');
  div.className = `msg ${kind}`;
  div.textContent = text;
  log.prepend(div);
  setTimeout(() => {
    div.style.transition = 'opacity 0.4s';
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 500);
  }, ttl);
  // cap to 6 messages
  while (log.children.length > 6) log.lastElementChild?.remove();
}

export async function showAceFact(ace: AceCommander): Promise<void> {
  const modal = document.getElementById('fact-modal')!;
  (document.getElementById('fact-name') as HTMLElement).textContent = ace.name;
  (document.getElementById('fact-rank') as HTMLElement).textContent =
    `${ace.rank}  ·  Commanding ${ace.uboat}`;
  (document.getElementById('fact-body') as HTMLElement).textContent = ace.body;
  modal.classList.add('active');
  await new Promise<void>(resolve => {
    const btn = document.getElementById('fact-continue')! as HTMLButtonElement;
    const onClick = () => {
      btn.removeEventListener('click', onClick);
      modal.classList.remove('active');
      resolve();
    };
    btn.addEventListener('click', onClick);
  });
}

export type TutorialStep = { title: string; body: string; highlight?: string };

export class Tutorial {
  private steps: TutorialStep[];
  private idx = 0;
  private overlay: HTMLElement;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;
  private progressEl: HTMLElement;
  private nextBtn: HTMLButtonElement;
  private skipBtn: HTMLButtonElement;
  private resolveFn: (() => void) | null = null;

  constructor(steps: TutorialStep[]) {
    this.steps = steps;
    this.overlay = document.getElementById('tutorial-overlay')!;
    this.titleEl = document.getElementById('tut-title')!;
    this.bodyEl = document.getElementById('tut-body')!;
    this.progressEl = document.getElementById('tut-progress')!;
    this.nextBtn = document.getElementById('tut-next') as HTMLButtonElement;
    this.skipBtn = document.getElementById('tut-skip') as HTMLButtonElement;

    this.nextBtn.addEventListener('click', () => this.next());
    this.skipBtn.addEventListener('click', () => this.finish());
  }

  start(): Promise<void> {
    this.idx = 0;
    this.overlay.classList.add('active');
    this.render();
    return new Promise<void>(res => { this.resolveFn = res; });
  }

  private render() {
    const s = this.steps[this.idx];
    this.titleEl.textContent = s.title;
    this.bodyEl.textContent = s.body;
    this.progressEl.textContent = `${this.idx + 1} / ${this.steps.length}`;
    this.nextBtn.textContent = (this.idx === this.steps.length - 1) ? "LET'S GO ▶" : 'NEXT ▶';
  }

  private next() {
    this.idx++;
    if (this.idx >= this.steps.length) {
      this.finish();
    } else {
      this.render();
    }
  }

  private finish() {
    this.overlay.classList.remove('active');
    if (this.resolveFn) { this.resolveFn(); this.resolveFn = null; }
  }
}

export const DEFAULT_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'WELCOME, COMMANDER',
    body:
      'You command an escort destroyer protecting a convoy of 25 Liberty ships from Halifax to ' +
      'Liverpool. Lurking beneath the waves are German U-boats. Your mission: get most of the ' +
      'ships safely to port.',
  },
  {
    title: 'THE OCEAN',
    body:
      'Your destroyer is the long warship marked with your player color. The smaller ships in ' +
      'formation are the merchant convoy. To MOVE your destroyer, drag your finger across the ' +
      'ocean — it will steam toward where you point.',
  },
  {
    title: 'SONAR PING',
    body:
      'Tap 🔊 SONAR PING to listen for submerged U-boats nearby. Hits will show as green blips ' +
      'on the ocean. Sonar takes a turn to recharge.',
  },
  {
    title: 'LOOKOUT',
    body:
      'Tap 🔭 LOOKOUT to scan the SURFACE. At night, U-boat aces sometimes attack on the surface ' +
      'where they can move fast and shoot accurately — but lookouts can spot them.',
  },
  {
    title: 'ATTACK!',
    body:
      'Once a U-boat is revealed, tap 💣 DEPTH CHARGE (for submerged subs) or 🔫 DECK GUN (for ' +
      'surfaced subs). Then tap on the U-boat to launch your attack. Dice will decide the result.',
  },
  {
    title: 'END TURN',
    body:
      'When your team is done, tap the green END TURN button. The U-boats will then make their ' +
      'move — torpedoes will fly. Survive 7 turns and you win!',
  },
];
