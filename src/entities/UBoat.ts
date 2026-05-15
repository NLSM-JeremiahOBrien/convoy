import * as THREE from 'three';
import type { AceCommander } from '../data';

export type UBoatState = 'submerged' | 'surfaced' | 'spotted' | 'destroyed';

/** A WWII Type VII U-boat. Default = hidden (submerged). */
export class UBoat {
  public group: THREE.Group;
  public id: string;
  public state: UBoatState = 'submerged';
  public hull = 30;
  public ace: AceCommander | null;
  public revealed = false;     // when player has visually spotted it
  public turnsSubmerged = 0;
  public lastFireTurn = -10;
  public sinkProgress = 0;
  // Running depth in feet — randomised at creation, changes when evading
  public depthFeet: number = 100;  // 100 | 200 | 300 | 400 (aces can go to 500)

  private bobPhase = Math.random() * Math.PI * 2;
  private periscopeMesh: THREE.Mesh | null = null;
  private spotLight: THREE.PointLight | null = null;
  private markerSprite: THREE.Sprite | null = null;

  constructor(id: string, ace: AceCommander | null) {
    this.id = id;
    this.ace = ace;
    this.group = new THREE.Group();
    this.group.renderOrder = 2;
    this.build();
    this.setVisualState();
  }

  private build() {
    const g = this.group;
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });
    const conMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });

    // Cigar-shaped hull (cylinder with cone ends)
    const hullGeo = new THREE.CylinderGeometry(0.9, 0.9, 9, 14);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.rotation.z = Math.PI / 2;
    g.add(hull);

    // Bow cone
    const bowCone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 14), hullMat);
    bowCone.rotation.z = -Math.PI / 2;
    bowCone.position.x = 5.6;
    g.add(bowCone);
    // Stern cone
    const sternCone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.0, 14), hullMat);
    sternCone.rotation.z = Math.PI / 2;
    sternCone.position.x = -5.5;
    g.add(sternCone);

    // Conning tower — bright red so it's visible when surfaced
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0xcc2222, emissive: 0xcc2222, emissiveIntensity: 0.6, roughness: 0.4,
    });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.3), towerMat);
    tower.position.set(0.5, 1.0, 0);
    g.add(tower);
    // Tower fairing
    const fair = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.6, 1.5), towerMat);
    fair.position.set(0.4, 0.5, 0);
    g.add(fair);

    // Bright point light on the conning tower (visible when surfaced)
    this.spotLight = new THREE.PointLight(0xff4444, 0, 50);
    this.spotLight.position.set(0.5, 3.5, 0);
    g.add(this.spotLight);

    // Floating marker sprite above the U-boat (like a red diamond)
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    // Red diamond
    ctx.fillStyle = '#ff2222';
    ctx.beginPath();
    ctx.moveTo(32, 4);
    ctx.lineTo(60, 32);
    ctx.lineTo(32, 60);
    ctx.lineTo(4, 32);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    // "U" label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('U', 32, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    this.markerSprite = new THREE.Sprite(spriteMat);
    this.markerSprite.scale.set(5, 5, 1);
    this.markerSprite.position.set(0, 8, 0);
    this.markerSprite.visible = false;
    g.add(this.markerSprite);

    // Periscope
    const psGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6);
    const psMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    this.periscopeMesh = new THREE.Mesh(psGeo, psMat);
    this.periscopeMesh.position.set(0.7, 1.8, 0);
    g.add(this.periscopeMesh);

    // Deck gun
    const gun = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.3, 6),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
    );
    gun.rotation.z = Math.PI / 2;
    gun.position.set(2.5, 0.9, 0);
    g.add(gun);
  }

  /** Update mesh visibility/depth based on state. */
  setVisualState() {
    switch (this.state) {
      case 'submerged':
        this.group.position.y = -5;
        this.group.visible = this.revealed;
        // Show only periscope when revealed but submerged
        for (const child of this.group.children) {
          child.visible = (child === this.periscopeMesh);
        }
        if (this.revealed && this.periscopeMesh) {
          this.periscopeMesh.position.y = 5.0; // periscope above water
        }
        if (this.revealed) this.group.visible = true;
        if (this.spotLight) this.spotLight.intensity = 0;
        if (this.markerSprite) this.markerSprite.visible = false;
        break;
      case 'surfaced':
        this.group.position.y = 8.0;  // well above water
        this.group.visible = true;
        for (const child of this.group.children) child.visible = true;
        if (this.periscopeMesh) this.periscopeMesh.position.y = 1.8;
        if (this.spotLight) this.spotLight.intensity = 8;
        if (this.markerSprite) this.markerSprite.visible = true;
        break;
      case 'spotted':
        this.group.position.y = 7.0;  // partially above water
        this.group.visible = true;
        for (const child of this.group.children) child.visible = true;
        if (this.periscopeMesh) this.periscopeMesh.position.y = 1.8;
        if (this.spotLight) this.spotLight.intensity = 4;
        if (this.markerSprite) this.markerSprite.visible = true;
        break;
      case 'destroyed':
        this.group.visible = true;
        for (const child of this.group.children) child.visible = true;
        if (this.spotLight) this.spotLight.intensity = 0;
        if (this.markerSprite) this.markerSprite.visible = false;
        break;
    }
  }

  /** Pick a random running depth on spawn or after evading. */
  randomiseDepth() {
    const levels = this.ace ? [100, 200, 300, 400, 500] : [100, 200, 300, 400];
    this.depthFeet = levels[Math.floor(Math.random() * levels.length)];
  }

  /** Pick a new evasive depth (different from current). */
  evadeDepth() {
    const levels = this.ace ? [100, 200, 300, 400, 500] : [100, 200, 300, 400];
    const others = levels.filter(d => d !== this.depthFeet);
    this.depthFeet = others[Math.floor(Math.random() * others.length)];
  }

  damage(n: number) {
    if (this.state === 'destroyed') return;
    this.hull -= n;
    if (this.hull <= 0) {
      this.state = 'destroyed';
      this.hull = 0;
    }
  }

  update(t: number, dt: number) {
    if (this.state === 'destroyed') {
      // Sink visibly
      if (this.sinkProgress < 1) {
        this.sinkProgress = Math.min(1, this.sinkProgress + dt * 0.18);
        this.group.position.y -= dt * 1.5;
        this.group.rotation.z = this.sinkProgress * 0.8;
      }
      return;
    }
    if (this.state === 'surfaced') {
      this.group.position.y = 8.0 + Math.sin(t * 0.9 + this.bobPhase) * 0.1;
      this.group.rotation.z = Math.sin(t * 0.6 + this.bobPhase) * 0.02;
    }
  }
}
