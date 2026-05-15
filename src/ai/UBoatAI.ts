import * as THREE from 'three';
import { UBoat } from '../entities/UBoat';
import { LibertyShip } from '../entities/LibertyShip';
import { Destroyer } from '../entities/Destroyer';
import { rollNd6 } from '../dice';
import { GAME_CONFIG } from '../data';

export type AIAction =
  | { kind: 'move'; uboat: UBoat; from: THREE.Vector3; to: THREE.Vector3 }
  | { kind: 'surface'; uboat: UBoat }
  | { kind: 'submerge'; uboat: UBoat }
  | { kind: 'torpedo'; uboat: UBoat; target: LibertyShip; hit: boolean; damage: number }
  | { kind: 'evade'; uboat: UBoat };

/** Per-turn decision: each surviving U-boat acts. Always moves, may surface/attack. */
export function planUBoatTurn(
  uboat: UBoat,
  isNight: boolean,
  convoy: LibertyShip[],
  destroyers: Destroyer[],
): AIAction[] {
  const actions: AIAction[] = [];
  if (uboat.state === 'destroyed') return actions;

  const livingConvoy = convoy.filter(s => s.status !== 'sunk');
  if (livingConvoy.length === 0) return actions;

  const upos = uboat.group.position;

  // Sort merchants by distance
  livingConvoy.sort((a, b) =>
    a.group.position.distanceToSquared(upos) - b.group.position.distanceToSquared(upos)
  );
  const target = livingConvoy[0];
  const distToTarget = upos.distanceTo(target.group.position);

  // Nearest destroyer threat distance
  const liveDD = destroyers.filter(d => d.isAlive());
  let nearestDDDist = Infinity;
  for (const d of liveDD) {
    const dd = upos.distanceTo(d.group.position);
    if (dd < nearestDDDist) nearestDDDist = dd;
  }

  // ---- SURFACE / SUBMERGE DECISION ----
  // At night: random chance to surface (bolder behavior, harder for player)
  // Aces are bolder; standard U-boats also surface sometimes
  if (isNight && uboat.state === 'submerged') {
    const surfaceChance = uboat.ace ? 0.50 : 0.25; // aces 50%, standard 25%
    // Less likely to surface near destroyers
    const ddPenalty = nearestDDDist < 40 ? 0.6 : 1.0;
    if (Math.random() < surfaceChance * ddPenalty) {
      actions.push({ kind: 'surface', uboat });
      uboat.state = 'surfaced';
    }
  }
  // During day: submerge if surfaced and near destroyer
  if (!isNight && uboat.state === 'surfaced') {
    actions.push({ kind: 'submerge', uboat });
    uboat.state = 'submerged';
    uboat.revealed = false;
  }
  // At night, if surfaced and a destroyer gets close — dive!
  if (isNight && uboat.state === 'surfaced' && nearestDDDist < 30) {
    actions.push({ kind: 'submerge', uboat });
    uboat.state = 'submerged';
    uboat.revealed = false;
  }

  // ---- ALWAYS MOVE ----
  const speed = uboat.state === 'surfaced'
    ? GAME_CONFIG.UBOAT_SPEED_SURFACED
    : GAME_CONFIG.UBOAT_SPEED_SUBMERGED;

  // Move toward the nearest merchant, but with some lateral jitter
  // so they don't all converge on the same point
  const dir = new THREE.Vector3().subVectors(target.group.position, upos);
  dir.y = 0;
  if (dir.length() > 0.1) {
    dir.normalize();
    // Add random lateral offset for wolfpack spread
    const jitter = new THREE.Vector3(
      (Math.random() - 0.5) * 0.6,
      0,
      (Math.random() - 0.5) * 0.6,
    );
    dir.add(jitter).normalize();

    // Move at full speed every turn
    const moveDist = speed + Math.random() * 2;
    const to = upos.clone().addScaledVector(dir, moveDist);
    to.y = uboat.state === 'surfaced' ? -0.2 : -5;
    actions.push({ kind: 'move', uboat, from: upos.clone(), to });
  }

  // ---- TORPEDO ATTACK ----
  const torpedoRange = 45;
  if (distToTarget < torpedoRange && uboat.lastFireTurn <= -2) {
    const bonus = uboat.ace ? uboat.ace.attackBonus : 0;
    const rolls = rollNd6(2);
    const total = rolls[0] + rolls[1] + bonus;
    const hit = total >= 8;
    const damage = hit ? (uboat.ace ? 60 : 45) : 0;
    actions.push({ kind: 'torpedo', uboat, target, hit, damage });
  }

  return actions;
}
