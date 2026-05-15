import * as THREE from 'three';

/** Pooled visual effects: torpedoes, splashes, explosions, tracers. */
export class EffectsManager {
  private scene: THREE.Scene;
  private active: Effect[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** A torpedo wake — line of bubbles from A to B. */
  torpedo(from: THREE.Vector3, to: THREE.Vector3, speed = 30) {
    const dist = from.distanceTo(to);
    const dur = dist / speed;
    const dir = to.clone().sub(from).normalize();

    // Trailing wake line
    const positions = new Float32Array(60 * 3);
    for (let i = 0; i < 60; i++) {
      positions[i * 3] = from.x;
      positions[i * 3 + 1] = 0.1;
      positions[i * 3 + 2] = from.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);

    const eff: Effect = {
      t: 0,
      dur,
      update: (dt) => {
        eff.t += dt;
        const f = Math.min(1, eff.t / dur);
        const cur = new THREE.Vector3(
          from.x + dir.x * dist * f,
          0.1,
          from.z + dir.z * dist * f,
        );
        // Shift positions: shift back, push new at end
        for (let i = 0; i < 59; i++) {
          positions[i * 3] = positions[(i + 1) * 3];
          positions[i * 3 + 1] = positions[(i + 1) * 3 + 1];
          positions[i * 3 + 2] = positions[(i + 1) * 3 + 2];
        }
        positions[59 * 3] = cur.x;
        positions[59 * 3 + 1] = cur.y;
        positions[59 * 3 + 2] = cur.z;
        geo.attributes.position.needsUpdate = true;
        return f < 1;
      },
      cleanup: () => {
        this.scene.remove(line);
        geo.dispose();
        mat.dispose();
      },
    };
    this.active.push(eff);
    return dur;
  }

  /** Water splash — quick white particles. */
  splash(pos: THREE.Vector3, scale = 1) {
    const count = 18;
    const positions = new Float32Array(count * 3);
    const velocities: number[][] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = pos.z;
      velocities.push([
        (Math.random() - 0.5) * 8 * scale,
        4 + Math.random() * 6 * scale,
        (Math.random() - 0.5) * 8 * scale,
      ]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.8 * scale,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);

    const dur = 1.4;
    const eff: Effect = {
      t: 0, dur,
      update: (dt) => {
        eff.t += dt;
        for (let i = 0; i < count; i++) {
          positions[i * 3]     += velocities[i][0] * dt;
          positions[i * 3 + 1] += velocities[i][1] * dt;
          positions[i * 3 + 2] += velocities[i][2] * dt;
          velocities[i][1] -= 16 * dt;
        }
        mat.opacity = 0.9 * (1 - eff.t / dur);
        geo.attributes.position.needsUpdate = true;
        return eff.t < dur;
      },
      cleanup: () => {
        this.scene.remove(pts);
        geo.dispose();
        mat.dispose();
      },
    };
    this.active.push(eff);
  }

  /** Big explosion — orange flash + smoke particles. */
  explosion(pos: THREE.Vector3, scale = 1) {
    // Flash sphere
    const flashGeo = new THREE.SphereGeometry(2 * scale, 12, 12);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffaa44,
      transparent: true,
      opacity: 1,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(pos);
    flash.position.y = 2;
    this.scene.add(flash);

    // Smoke points
    const count = 30;
    const positions = new Float32Array(count * 3);
    const vels: number[][] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y + 1;
      positions[i * 3 + 2] = pos.z;
      vels.push([
        (Math.random() - 0.5) * 6 * scale,
        2 + Math.random() * 4 * scale,
        (Math.random() - 0.5) * 6 * scale,
      ]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x555555,
      size: 1.6 * scale,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);

    const dur = 2.4;
    const eff: Effect = {
      t: 0, dur,
      update: (dt) => {
        eff.t += dt;
        const f = eff.t / dur;
        // Flash expands and fades fast
        flash.scale.setScalar(1 + f * 4);
        flashMat.opacity = Math.max(0, 1 - f * 3);
        // Smoke
        for (let i = 0; i < count; i++) {
          positions[i * 3]     += vels[i][0] * dt;
          positions[i * 3 + 1] += vels[i][1] * dt;
          positions[i * 3 + 2] += vels[i][2] * dt;
          vels[i][1] -= 1.5 * dt;
        }
        mat.opacity = 0.8 * (1 - f);
        geo.attributes.position.needsUpdate = true;
        return f < 1;
      },
      cleanup: () => {
        this.scene.remove(flash);
        this.scene.remove(pts);
        flashGeo.dispose(); flashMat.dispose();
        geo.dispose(); mat.dispose();
      },
    };
    this.active.push(eff);
  }

  /** Deck gun tracer line. */
  tracer(from: THREE.Vector3, to: THREE.Vector3) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffcc44,
      transparent: true,
      opacity: 1,
      linewidth: 2,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);

    const dur = 0.3;
    const eff: Effect = {
      t: 0, dur,
      update: (dt) => { eff.t += dt; mat.opacity = 1 - eff.t / dur; return eff.t < dur; },
      cleanup: () => { this.scene.remove(line); geo.dispose(); mat.dispose(); },
    };
    this.active.push(eff);
  }

  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      if (!e.update(dt)) {
        e.cleanup();
        this.active.splice(i, 1);
      }
    }
  }
}

type Effect = {
  t: number;
  dur: number;
  update: (dt: number) => boolean;
  cleanup: () => void;
};
