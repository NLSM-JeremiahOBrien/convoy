import * as THREE from 'three';
import { PLAYER_COLORS } from '../data';

/** Player-controlled Fletcher-class escort destroyer — fully procedural. */
export class Destroyer {
  public group: THREE.Group;
  public name: string;
  public playerIndex: number;
  public initials: string;
  public hull = 100;
  public depthCharges: number;
  public sonarCooldown = 0;
  public sonarPingsLeft = 5;
  public deckGunCooldown = 0;
  public depthChargeUsedThisTurn = false;
  public armedAction: 'sonar' | 'depthcharge' | 'deckgun' | 'ram' | 'lookout' | null = null;
  public targetWorldPos: THREE.Vector3 | null = null;
  public moveTokens = 1;

  private bobPhase = Math.random() * Math.PI * 2;

  constructor(name: string, playerIndex: number, initials: string, depthCharges = 12) {
    this.name = name;
    this.playerIndex = playerIndex;
    this.initials = initials;
    this.depthCharges = depthCharges;
    this.group = new THREE.Group();
    this.group.renderOrder = 2;
    this.build();
  }

  private build() {
    const g = this.group;
    const color = PLAYER_COLORS[this.playerIndex].hex;

    // ── Materials ──────────────────────────────────────────────
    const hullMat   = new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.7, metalness: 0.15 });
    const deckMat   = new THREE.MeshStandardMaterial({ color: 0x2e3d4c, roughness: 0.8 });
    const supMat    = new THREE.MeshStandardMaterial({ color: 0x7a8a96, roughness: 0.6 });
    const gunMat    = new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.4 });
    const stackMat  = new THREE.MeshStandardMaterial({ color: 0x111518, roughness: 0.5 });
    const mastMat   = new THREE.MeshStandardMaterial({ color: 0x666e78, roughness: 0.5 });
    const accentMat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.5, roughness: 0.3,
    });
    const flagMat   = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.6, side: THREE.DoubleSide,
    });

    // ── Hull ───────────────────────────────────────────────────
    // Fletcher: 376 ft long, 40 ft beam → scale: 22 × 2.4 units
    // Hull built from three overlapping shapes for taper

    // Main hull body — slightly trapezoidal cross-section
    const hullGeo = this.makeHullShape();
    const hullMesh = new THREE.Mesh(hullGeo, hullMat);
    g.add(hullMesh);

    // Forecastle (raised bow deck — front 35% of ship)
    const forecastle = new THREE.Mesh(
      new THREE.BoxGeometry(8.0, 0.5, 2.0), deckMat
    );
    forecastle.position.set(5.5, 1.1, 0);
    g.add(forecastle);

    // Main deck (aft 65%)
    const mainDeck = new THREE.Mesh(
      new THREE.BoxGeometry(13.0, 0.3, 2.15), deckMat
    );
    mainDeck.position.set(-1.5, 0.85, 0);
    g.add(mainDeck);

    // Player color deck stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(20, 0.05, 0.3), accentMat);
    stripe.position.set(0, 0.92, 0.8);
    g.add(stripe);

    // ── Superstructure ─────────────────────────────────────────
    // Forward superstructure block (bridge complex)
    const fwdSup = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 1.7), supMat);
    fwdSup.position.set(2.8, 2.0, 0);
    g.add(fwdSup);

    // Bridge wings
    const bWingL = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 0.6), supMat);
    bWingL.position.set(2.8, 2.75, 1.15);
    g.add(bWingL);
    const bWingR = bWingL.clone();
    bWingR.position.z = -1.15;
    g.add(bWingR);

    // Pilothouse (top of bridge)
    const pilot = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.4), supMat);
    pilot.position.set(3.0, 3.15, 0);
    g.add(pilot);

    // Aft deckhouse
    const aftHouse = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.5), supMat);
    aftHouse.position.set(-3.8, 1.55, 0);
    g.add(aftHouse);

    // ── Funnels (Fletchers had 2) ──────────────────────────────
    const stk1 = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 2.2, 10), stackMat);
    stk1.position.set(0.8, 2.85, 0);
    g.add(stk1);
    // Funnel cap (slightly wider at top)
    const cap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.2, 10), stackMat);
    cap1.position.set(0.8, 3.95, 0);
    g.add(cap1);

    const stk2 = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 2.2, 10), stackMat);
    stk2.position.set(-0.9, 2.75, 0);
    g.add(stk2);
    const cap2 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.2, 10), stackMat);
    cap2.position.set(-0.9, 3.85, 0);
    g.add(cap2);

    // ── 5-inch Gun Mounts (Fletcher had 5 × Mk 30) ────────────
    // Mount 1 — bow (forecastle, facing forward)
    this.addGunMount(g, gunMat, 8.8, 1.4, 0, 0);
    // Mount 2 — forecastle aft, superfiring (slightly higher)
    this.addGunMount(g, gunMat, 6.2, 2.0, 0, 0);
    // Mount 3 — aft of stacks
    this.addGunMount(g, gunMat, -2.5, 1.2, 0, Math.PI);
    // Mount 4 — superfiring aft
    this.addGunMount(g, gunMat, -5.2, 1.85, 0, Math.PI);
    // Mount 5 — stern
    this.addGunMount(g, gunMat, -9.2, 1.1, 0, Math.PI);

    // ── Quintuple Torpedo Tube Mount ──────────────────────────
    // Fletcher's signature: 2 × quintuple 21" TT mounts amidships
    for (const xOff of [1.8, -1.4]) {
      const mount = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 1.8), gunMat);
      mount.position.set(xOff, 1.35, 0);
      g.add(mount);
      for (let ti = -2; ti <= 2; ti++) {
        const tube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.07, 1.85, 6), gunMat
        );
        tube.rotation.z = Math.PI / 2;
        tube.position.set(xOff, 1.55, ti * 0.32);
        g.add(tube);
      }
    }

    // ── Bofors 40mm AA twin mounts (4 × twin) ─────────────────
    for (const [x, z] of [[4.5, 0.9], [4.5, -0.9], [-7.0, 0.9], [-7.0, -0.9]]) {
      const boforsMat = new THREE.MeshStandardMaterial({ color: 0x252d35, roughness: 0.5 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.35, 8), boforsMat);
      base.position.set(x, 1.2, z);
      g.add(base);
      for (const dz of [-0.12, 0.12]) {
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.045, 0.9, 6), boforsMat
        );
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(x + 0.5, 1.45, z + dz);
        g.add(barrel);
      }
    }

    // ── Depth charge racks (K-gun launchers on stern) ─────────
    const dcMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a });
    for (const z of [-0.9, 0.9]) {
      const kgun = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), dcMat);
      kgun.position.set(-10.0, 1.05, z);
      g.add(kgun);
    }
    const dcRack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 1.6), dcMat);
    dcRack.position.set(-10.5, 1.0, 0);
    g.add(dcRack);

    // ── Forward fire control mast ──────────────────────────────
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.07, 6.5, 6), mastMat
    );
    mast.position.set(2.8, 5.6, 0);
    g.add(mast);
    // Rangefinder platform
    const platform = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 0.9), mastMat);
    platform.position.set(2.8, 8.7, 0);
    g.add(platform);
    // Cross-yard
    const yard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 2.6), mastMat);
    yard.position.set(2.8, 8.0, 0);
    g.add(yard);
    // Aft mast (lighter)
    const aftMast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 4.0, 6), mastMat
    );
    aftMast.position.set(-5.5, 4.8, 0);
    g.add(aftMast);

    // ── Player color pennant flag ──────────────────────────────
    const flagPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6),
      new THREE.MeshStandardMaterial({ color: 0xdddddd })
    );
    flagPole.position.set(2.8, 9.1, 0);
    g.add(flagPole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), flagMat);
    flag.position.set(3.6, 10.1, 0);
    g.add(flag);

    // ── Bow wake ──────────────────────────────────────────────
    const wakeGeo = new THREE.PlaneGeometry(18, 3.5);
    const wakeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false,
    });
    const wake = new THREE.Mesh(wakeGeo, wakeMat);
    wake.rotation.x = -Math.PI / 2;
    wake.position.set(-14, 0.08, 0);
    g.add(wake);
  }

  /**
   * Create a tapered hull BufferGeometry — proper knife bow, rounded bilge.
   * Cross-sections along the X axis (bow→stern).
   */
  private makeHullShape(): THREE.BufferGeometry {
    // Define cross-sections [x, halfWidth, halfHeight, deckY]
    // x: position along ship (bow=+11, stern=-11)
    const sections: [number, number, number][] = [
      [ 11.0, 0.05, 0.3 ],  // knife bow
      [  9.5, 0.55, 0.65],
      [  8.0, 0.90, 0.80],
      [  6.0, 1.05, 0.85],
      [  3.0, 1.10, 0.90],
      [  0.0, 1.10, 0.90],
      [ -3.0, 1.08, 0.88],
      [ -6.0, 1.05, 0.85],
      [ -9.0, 0.85, 0.75],
      [-10.5, 0.55, 0.60],
      [-11.0, 0.25, 0.45],  // tapered stern
    ];

    const positions: number[] = [];
    const normals: number[]   = [];
    const indices: number[]   = [];

    // Build quads between adjacent cross-sections
    // Each cross-section = 6 verts (deck-port, mid-port, keel-port, keel-stbd, mid-stbd, deck-stbd)
    const verts: THREE.Vector3[][] = sections.map(([x, hw, hh]) => [
      new THREE.Vector3(x,  hh,  hw),   // 0 deck port
      new THREE.Vector3(x,  0,   hw * 1.05),  // 1 mid port (flare)
      new THREE.Vector3(x, -hh,  hw * 0.7),   // 2 keel port
      new THREE.Vector3(x, -hh, -hw * 0.7),   // 3 keel stbd
      new THREE.Vector3(x,  0,  -hw * 1.05),  // 4 mid stbd
      new THREE.Vector3(x,  hh, -hw),   // 5 deck stbd
    ]);

    let idx = 0;
    const pushQuad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
      const n = new THREE.Vector3().crossVectors(
        new THREE.Vector3().subVectors(b, a),
        new THREE.Vector3().subVectors(c, a)
      ).normalize();
      for (const v of [a, b, c, d]) {
        positions.push(v.x, v.y, v.z);
        normals.push(n.x, n.y, n.z);
      }
      indices.push(idx, idx+1, idx+2, idx, idx+2, idx+3);
      idx += 4;
    };

    for (let i = 0; i < verts.length - 1; i++) {
      const cur = verts[i], nxt = verts[i + 1];
      // Side panels: connect each edge of adjacent cross-sections
      for (let e = 0; e < 5; e++) {
        pushQuad(cur[e], nxt[e], nxt[e+1], cur[e+1]);
      }
    }

    // Bow cap (triangle fan from knife point)
    const tip = verts[0];
    const second = verts[1];
    for (let e = 0; e < 5; e++) {
      const a = tip[0], b = second[e], c = second[e+1];
      const n = new THREE.Vector3().crossVectors(
        new THREE.Vector3().subVectors(b, a),
        new THREE.Vector3().subVectors(c, a)
      ).normalize();
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      normals.push(n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z);
      indices.push(idx, idx+1, idx+2);
      idx += 3;
    }

    // Stern cap
    const sternVerts = verts[verts.length - 1];
    const sternCenter = new THREE.Vector3(
      sternVerts[0].x,
      (sternVerts[0].y + sternVerts[2].y) / 2,
      0
    );
    positions.push(sternCenter.x, sternCenter.y, sternCenter.z);
    normals.push(-1, 0, 0);
    const sternIdx = idx++;
    for (let e = 0; e < 5; e++) {
      const v = sternVerts[e];
      positions.push(v.x, v.y, v.z);
      normals.push(-1, 0, 0);
    }
    for (let e = 0; e < 5; e++) {
      indices.push(sternIdx, sternIdx + 1 + e, sternIdx + 1 + ((e+1) % 5));
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals,   3));
    geo.setIndex(indices);
    geo.computeVertexNormals(); // smooth everything out
    return geo;
  }

  private addGunMount(g: THREE.Group, mat: THREE.Material, x: number, y: number, z: number, rotY: number) {
    // Gun tub/shield
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.55, 10), mat);
    shield.position.set(x, y, z);
    g.add(shield);
    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8), mat);
    barrel.rotation.z = Math.PI / 2;
    const bx = x + Math.cos(rotY) * 1.3;
    barrel.position.set(bx, y + 0.1, z + Math.sin(rotY) * 1.3);
    g.add(barrel);
  }

  damage(n: number) { this.hull = Math.max(0, this.hull - n); }

  startTurn() {
    if (this.sonarCooldown > 0) this.sonarCooldown--;
    if (this.deckGunCooldown > 0) this.deckGunCooldown--;
    this.sonarPingsLeft = 5;
    this.depthChargeUsedThisTurn = false;
    this.armedAction = null;
    this.moveTokens = 1;
  }

  isAlive() { return this.hull > 0; }

  update(t: number, dt: number) {
    this.group.position.y = 8.0 + Math.sin(t * 0.9 + this.bobPhase) * 0.12;
    this.group.rotation.z = Math.sin(t * 0.6 + this.bobPhase) * 0.012;

    if (this.targetWorldPos) {
      const cur = this.group.position;
      const dx = this.targetWorldPos.x - cur.x;
      const dz = this.targetWorldPos.z - cur.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.5) {
        this.targetWorldPos = null;
      } else {
        const step = Math.min(dist, 18 * dt);
        cur.x += (dx / dist) * step;
        cur.z += (dz / dist) * step;
        const targetAngle = Math.atan2(-dz, dx);
        let dAng = targetAngle - this.group.rotation.y;
        while (dAng >  Math.PI) dAng -= 2 * Math.PI;
        while (dAng < -Math.PI) dAng += 2 * Math.PI;
        this.group.rotation.y += dAng * Math.min(1, dt * 3);
      }
    }
  }
}
