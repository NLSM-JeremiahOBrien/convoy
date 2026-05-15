import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export type ShipStatus = 'healthy' | 'damaged' | 'crippled' | 'sunk';

// Shared STL geometry — loaded once, reused for all 25 ships
let sharedSTLGeometry: THREE.BufferGeometry | null = null;
let stlLoadAttempted = false;
let stlLoadPromise: Promise<THREE.BufferGeometry | null> | null = null;

function loadSTLOnce(): Promise<THREE.BufferGeometry | null> {
  if (stlLoadPromise) return stlLoadPromise;
  stlLoadPromise = new Promise((resolve) => {
    if (stlLoadAttempted) { resolve(sharedSTLGeometry); return; }
    stlLoadAttempted = true;
    const loader = new STLLoader();
    loader.load(
      '/models/liberty-ship.stl',
      (geometry) => {
        // Center and normalize the geometry
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const center = new THREE.Vector3();
        box.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        // Scale to our game size (~12 units long to match convoy spacing)
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetLength = 14; // game units
        const scale = targetLength / maxDim;
        geometry.scale(scale, scale, scale);

        // Recompute after transform
        geometry.computeBoundingBox();
        geometry.computeVertexNormals();

        sharedSTLGeometry = geometry;
        console.log(`[Liberty] STL loaded: ${geometry.attributes.position.count} vertices, scaled ${scale.toFixed(4)}`);
        resolve(geometry);
      },
      undefined,
      (err) => {
        console.warn('[Liberty] STL load failed, using procedural fallback:', err);
        resolve(null);
      }
    );
  });
  return stlLoadPromise;
}

/** A Liberty ship (merchant). Uses STL model when available, falls back to procedural. */
export class LibertyShip {
  public group: THREE.Group;
  public name: string;
  public hull = 100;
  public status: ShipStatus = 'healthy';
  public sinkProgress = 0;
  private bobPhase: number;

  constructor(name: string) {
    this.name = name;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.group = new THREE.Group();
    this.group.renderOrder = 1;
    // Start with procedural, then swap in STL when loaded
    this.buildProcedural();
    this.tryLoadSTL();
  }

  private async tryLoadSTL() {
    const geo = await loadSTLOnce();
    if (!geo) return; // keep procedural fallback

    // Remove only Mesh children (procedural geometry) — preserve CSS2DObject labels
    const toRemove = this.group.children.filter(c => !(c instanceof CSS2DObject));
    for (const child of toRemove) {
      this.group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
    }

    // Create mesh from STL with Liberty ship materials
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,       // Dark gray hull (wartime gray)
      roughness: 0.75,
      metalness: 0.2,
    });

    const mesh = new THREE.Mesh(geo.clone(), hullMat);

    // The STL model may need rotation to align properly
    // STL from Thingiverse 3D print models are often Z-up, we need Y-up
    // and bow pointing along +X
    mesh.rotation.x = -Math.PI / 2;  // Z-up → Y-up

    // Compute the bounding box after rotation to figure out orientation
    const tempBox = new THREE.Box3().setFromObject(mesh);
    const tempSize = new THREE.Vector3();
    tempBox.getSize(tempSize);

    // If the ship is taller than wide after rotation, it needs a different axis flip
    if (tempSize.y > tempSize.x && tempSize.y > tempSize.z) {
      // Try different rotation
      mesh.rotation.x = 0;
      mesh.rotation.z = -Math.PI / 2;
    }

    this.group.add(mesh);

    // Add color accents on top of the STL:
    // Superstructure highlight (warm white)
    const supMat = new THREE.MeshStandardMaterial({ color: 0xc8c0a8, roughness: 0.6 });
    const sup = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 1.6), supMat);
    sup.position.set(-0.5, 2.2, 0);
    // Only add if STL is small enough that we need to supplement
    // (the STL already has superstructure detail, so skip this)

    // Smokestack red band (visual identifier)
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x882020, emissive: 0x441010, emissiveIntensity: 0.3 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 8), bandMat);
    // Position near the top of the superstructure area
    band.position.set(-0.8, 3.5, 0);
    this.group.add(band);

    // Name flag pennant (tiny colored square)
    const flagMat = new THREE.MeshBasicMaterial({
      color: this.name === "JEREMIAH O'BRIEN" ? 0xff4444 : 0x446688,
      side: THREE.DoubleSide,
    });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), flagMat);
    flag.position.set(2, 4.0, 0);
    this.group.add(flag);
  }

  /** Procedural fallback — used while STL loads or if load fails */
  private buildProcedural() {
    const g = this.group;
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x3a3020, roughness: 0.7 });
    const supMat  = new THREE.MeshStandardMaterial({ color: 0xc8c0a8, roughness: 0.6 });
    const stkMat  = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });

    // Hull (lower)
    const hull = new THREE.Mesh(new THREE.BoxGeometry(12, 2.0, 3.2), hullMat);
    hull.position.y = -0.2;
    g.add(hull);

    // Hull (upper, slightly narrower)
    const hull2 = new THREE.Mesh(new THREE.BoxGeometry(12.5, 1.4, 2.6), hullMat);
    hull2.position.y = 1.2;
    g.add(hull2);

    // Bow (triangle prism approx)
    const bowGeo = new THREE.ConeGeometry(1.6, 2.5, 4);
    const bow = new THREE.Mesh(bowGeo, hullMat);
    bow.rotation.z = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(7.2, 0.5, 0);
    bow.scale.set(1, 1, 0.8);
    g.add(bow);

    // Deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.15, 2.5), deckMat);
    deck.position.y = 1.95;
    g.add(deck);

    // Superstructure (amidships bridge)
    const sup = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.2), supMat);
    sup.position.set(-0.5, 3.1, 0);
    g.add(sup);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 1.8), supMat);
    bridge.position.set(-0.5, 4.6, 0);
    g.add(bridge);

    // Stack
    const stk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 2.2, 10), stkMat);
    stk.position.set(-1.2, 5.5, 0);
    g.add(stk);
    const bandProcedural = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.56, 0.3, 10),
      new THREE.MeshStandardMaterial({ color: 0x882020 })
    );
    bandProcedural.position.set(-1.2, 6.4, 0);
    g.add(bandProcedural);

    // Masts
    const mast1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 5, 6), stkMat);
    mast1.position.set(3, 4.5, 0);
    g.add(mast1);
    const mast2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 5, 6), stkMat);
    mast2.position.set(-4, 4.5, 0);
    g.add(mast2);

    // Cargo hatches
    for (let i = -1; i <= 1; i += 2) {
      const hatch = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 1.8), deckMat);
      hatch.position.set(i * 3, 2.25, 0);
      g.add(hatch);
    }
  }

  damage(amount: number) {
    if (this.status === 'sunk') return;
    this.hull -= amount;
    if (this.hull <= 0) {
      this.status = 'sunk';
      this.hull = 0;
    } else if (this.hull <= 30) {
      this.status = 'crippled';
    } else if (this.hull <= 65) {
      this.status = 'damaged';
    }
  }

  /** Per-frame visual update — bobbing and sinking animation. */
  update(t: number, dt: number) {
    if (this.status === 'sunk') {
      if (this.sinkProgress < 1) {
        this.sinkProgress = Math.min(1, this.sinkProgress + dt * 0.12);
        this.group.position.y = -this.sinkProgress * 8;
        this.group.rotation.z = this.sinkProgress * 0.5;
      }
      return;
    }
    // Float well above ocean surface
    this.group.position.y = 8.0 + Math.sin(t * 0.8 + this.bobPhase) * 0.15;
    this.group.rotation.z = Math.sin(t * 0.5 + this.bobPhase) * 0.015;
    this.group.rotation.x = Math.sin(t * 0.7 + this.bobPhase + 1) * 0.008;
  }
}
