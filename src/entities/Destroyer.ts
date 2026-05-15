import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLAYER_COLORS } from '../data';

// Shared STL hull — loaded once, reused for all 4 destroyers
let sharedDestroyerGeo: THREE.BufferGeometry | null = null;
let destroyerLoadPromise: Promise<THREE.BufferGeometry | null> | null = null;

function loadDestroyerSTL(): Promise<THREE.BufferGeometry | null> {
  if (destroyerLoadPromise) return destroyerLoadPromise;
  destroyerLoadPromise = new Promise((resolve) => {
    const loader = new STLLoader();
    loader.load(
      '/models/fletcher-destroyer.stl',
      (geometry) => {
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const center = new THREE.Vector3();
        box.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        // Scale so ship is ~18 units long (destroyers are longer than liberty ships)
        const size = new THREE.Vector3();
        box.getSize(size);
        const longest = Math.max(size.x, size.y, size.z);
        const scale = 18 / longest;
        geometry.scale(scale, scale, scale);
        geometry.computeBoundingBox();
        geometry.computeVertexNormals();

        sharedDestroyerGeo = geometry;
        console.log(`[Destroyer] STL loaded: ${geometry.attributes.position.count} verts`);
        resolve(geometry);
      },
      undefined,
      (err) => {
        console.warn('[Destroyer] STL load failed, using procedural fallback:', err);
        resolve(null);
      }
    );
  });
  return destroyerLoadPromise;
}

/** Player-controlled escort destroyer. Loads Fletcher-class STL hull + procedural details. */
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
    // Build procedural immediately, swap in STL hull when loaded
    this.buildProcedural();
    this.tryLoadSTL();
  }

  private async tryLoadSTL() {
    const geo = await loadDestroyerSTL();
    if (!geo) return;

    // Find and remove just the hull mesh (first child = hull box from procedural)
    const oldHull = this.group.getObjectByName('proc-hull');
    if (oldHull) this.group.remove(oldHull);

    const color = PLAYER_COLORS[this.playerIndex].hex;
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x3a4a5a,   // Navy gray
      roughness: 0.7,
      metalness: 0.15,
    });

    const hullMesh = new THREE.Mesh(geo.clone(), hullMat);
    hullMesh.name = 'stl-hull';

    // Fletcher STL is Z-up (3D print). Rotate to Y-up, bow along +X
    // Try: X-up rotation first (most common for Blender-exported STLs)
    hullMesh.rotation.x = -Math.PI / 2;

    // Add player color highlight to the deck
    const accentMat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.3, roughness: 0.4,
    });
    const deckStripe = new THREE.Mesh(new THREE.BoxGeometry(16, 0.1, 1.6), accentMat);
    deckStripe.position.set(0, 1.6, 0);
    deckStripe.name = 'deck-stripe';

    this.group.add(hullMesh);

    // The procedural details (guns, masts, stacks, flag) stay on top
    // — they're already added by buildProcedural()
  }

  private buildProcedural() {
    const g = this.group;
    const color = PLAYER_COLORS[this.playerIndex].hex;
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.7 });
    const accentMat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.35, roughness: 0.4,
    });
    const supMat = new THREE.MeshStandardMaterial({ color: 0x88a0b0, roughness: 0.5 });
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 0.3 });

    // Hull — placeholder until STL loads
    const hull = new THREE.Mesh(new THREE.BoxGeometry(18, 1.8, 2.4), hullMat);
    hull.name = 'proc-hull';
    hull.position.y = 0;
    g.add(hull);

    // Pointed bow
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.5, 4), hullMat);
    bow.rotation.z = -Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(10.5, 0.2, 0);
    bow.scale.set(1, 0.75, 0.5);
    g.add(bow);

    // Colored deck stripe (player identifier)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(17, 0.1, 2.1), accentMat);
    deck.position.y = 0.95;
    g.add(deck);

    // Bridge superstructure
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 1.8), supMat);
    bridge.position.set(1.5, 2.0, 0);
    g.add(bridge);
    const pilothouse = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 1.5), supMat);
    pilothouse.position.set(1.5, 3.3, 0);
    g.add(pilothouse);

    // Two funnels (Fletchers had 2 stacks)
    const stkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const stk1 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 2.0, 10), stkMat);
    stk1.position.set(-0.5, 2.8, 0);
    g.add(stk1);
    const stk2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 2.0, 10), stkMat);
    stk2.position.set(-2.4, 2.8, 0);
    g.add(stk2);

    // 5" gun mounts — Fletchers had 5 total (3 fwd, 2 aft)
    // Mount 1 (bow)
    this.addGunMount(g, gunMat, 6.5, 1.3, 0, 0);
    // Mount 2 (fwd of bridge, elevated)
    this.addGunMount(g, gunMat, 4.0, 2.2, 0, 0.3);
    // Mount 3 (aft of stacks)
    this.addGunMount(g, gunMat, -4.5, 1.3, 0, Math.PI);
    // Mount 4 (aft, elevated)
    this.addGunMount(g, gunMat, -6.5, 2.0, 0, Math.PI);
    // Mount 5 (stern)
    this.addGunMount(g, gunMat, -8.5, 1.3, 0, Math.PI);

    // Torpedo tubes (quintuple mount amidships — Fletcher's signature)
    const torpMat = new THREE.MeshStandardMaterial({ color: 0x303030, roughness: 0.5 });
    const torpMount = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 1.0), torpMat);
    torpMount.position.set(-0.5, 1.2, 0);
    g.add(torpMount);
    for (let i = -2; i <= 2; i++) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.0, 6), torpMat);
      tube.rotation.z = Math.PI / 2;
      tube.position.set(-0.5, 1.5, i * 0.18);
      g.add(tube);
    }

    // Mast (forward fire control mast)
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5.5, 6), mastMat);
    mast.position.set(1.5, 5.0, 0);
    g.add(mast);
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.2), mastMat);
    crossbar.position.set(1.5, 7.2, 0);
    g.add(crossbar);

    // Depth charge racks (stern)
    const dcMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.6), dcMat);
    rack.position.set(-9.0, 1.1, 0);
    g.add(rack);

    // Player color flag
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 3.5, 6),
      new THREE.MeshStandardMaterial({ color: 0xcccccc })
    );
    pole.position.set(-3.5, 4.5, 0);
    g.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.8),
      new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.4 })
    );
    flag.position.set(-2.8, 5.8, 0);
    g.add(flag);

    // Wake plane
    const wakeGeo = new THREE.PlaneGeometry(16, 3.2);
    const wakeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false,
    });
    const wake = new THREE.Mesh(wakeGeo, wakeMat);
    wake.rotation.x = -Math.PI / 2;
    wake.position.set(-13, 0.06, 0);
    g.add(wake);
  }

  private addGunMount(
    g: THREE.Group,
    mat: THREE.Material,
    x: number, y: number, z: number,
    rotY: number,
  ) {
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.8, 0.6, 10), mat);
    turret.position.set(x, y, z);
    g.add(turret);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8), mat);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(x + Math.cos(rotY) * 1.2, y + 0.15, z);
    g.add(barrel);
  }

  damage(n: number) { this.hull = Math.max(0, this.hull - n); }

  startTurn() {
    if (this.sonarCooldown > 0) this.sonarCooldown--;
    if (this.deckGunCooldown > 0) this.deckGunCooldown--;
    this.sonarPingsLeft = 5;
    this.armedAction = null;
    this.moveTokens = 1;
  }

  isAlive() { return this.hull > 0; }

  update(t: number, dt: number) {
    // Gentle bob — stays above ocean surface
    this.group.position.y = 1.5 + Math.sin(t * 0.9 + this.bobPhase) * 0.12;
    this.group.rotation.z = Math.sin(t * 0.6 + this.bobPhase) * 0.012;

    // Move toward target
    if (this.targetWorldPos) {
      const cur = this.group.position;
      const dx = this.targetWorldPos.x - cur.x;
      const dz = this.targetWorldPos.z - cur.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.5) {
        this.targetWorldPos = null;
      } else {
        const speed = 18;
        const step = Math.min(dist, speed * dt);
        cur.x += (dx / dist) * step;
        cur.z += (dz / dist) * step;
        const targetAngle = Math.atan2(-dz, dx);
        let dAng = targetAngle - this.group.rotation.y;
        while (dAng > Math.PI) dAng -= 2 * Math.PI;
        while (dAng < -Math.PI) dAng += 2 * Math.PI;
        this.group.rotation.y += dAng * Math.min(1, dt * 3);
      }
    }
  }
}
