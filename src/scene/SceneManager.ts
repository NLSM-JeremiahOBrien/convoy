import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Ocean } from '../entities/Ocean';

/** Wraps Three.js boilerplate: renderer, camera, lights, ocean. */
export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public labelRenderer: CSS2DRenderer;
  public ocean: Ocean;

  // Camera follows a target point (the convoy centroid).
  public cameraTarget = new THREE.Vector3(0, 0, 0);
  private cameraOffsetDay = new THREE.Vector3(0, 90, 110);
  private cameraOffsetNight = new THREE.Vector3(0, 80, 100);
  private currentOffset = this.cameraOffsetDay.clone();
  private isNight = false;
  private clock = new THREE.Clock();

  constructor(container: HTMLElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x4aa8e8);
    this.scene.fog = new THREE.FogExp2(0x7ec8f0, 0.0008);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    // CSS2D label renderer (for ship names)
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.left = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    this.labelRenderer.domElement.style.zIndex = '20';
    container.appendChild(this.labelRenderer.domElement);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      55, window.innerWidth / window.innerHeight, 1, 2500
    );
    this.camera.position.set(0, 90, 120);
    this.camera.lookAt(0, 0, 0);

    // Lights — start in day mode
    const sun = new THREE.DirectionalLight(0xfff8e8, 1.4);
    sun.position.set(80, 120, 60);
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0x90b8d0, 0.7));

    // Ocean
    this.ocean = new Ocean();
    this.scene.add(this.ocean.mesh);

    // Resize handler
    window.addEventListener('resize', this.onResize);
  }

  setNight(night: boolean) {
    this.isNight = night;

    // Update ocean shader colors
    this.ocean.setNight(night);

    if (night) {
      // Dark moonlit North Atlantic night
      this.scene.background = new THREE.Color(0x0a1020);
      this.scene.fog = new THREE.Fog(0x0a1020, 80, 400);
      this.renderer.setClearColor(0x0a1020);
      // Dim the sun, cool blue ambient
      const sun = this.scene.children.find(c => c instanceof THREE.DirectionalLight) as THREE.DirectionalLight | undefined;
      if (sun) { sun.color.set(0x304060); sun.intensity = 0.3; }
      const amb = this.scene.children.find(c => c instanceof THREE.AmbientLight) as THREE.AmbientLight | undefined;
      if (amb) { amb.color.set(0x102030); amb.intensity = 0.4; }
    } else {
      // Bright sunny Atlantic day — clear sky blue
      this.scene.background = new THREE.Color(0x4aa8e8);
      this.scene.fog = new THREE.FogExp2(0x7ec8f0, 0.0008);
      this.renderer.setClearColor(0x4aa8e8);
      // Full daylight sun, warm white
      const sun = this.scene.children.find(c => c instanceof THREE.DirectionalLight) as THREE.DirectionalLight | undefined;
      if (sun) { sun.color.set(0xfff8e8); sun.intensity = 1.4; }
      const amb = this.scene.children.find(c => c instanceof THREE.AmbientLight) as THREE.AmbientLight | undefined;
      if (amb) { amb.color.set(0x90b8d0); amb.intensity = 0.7; }
    }
  }

  /** Project screen (px) to world point on y=0 plane. */
  screenToWorld(sx: number, sy: number): THREE.Vector3 | null {
    const ndc = new THREE.Vector2(
      (sx / window.innerWidth) * 2 - 1,
      -(sy / window.innerHeight) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    // Intersect y=0 plane
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const out = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, out)) return out;
    return null;
  }

  /** Project world point to screen pixels. */
  worldToScreen(world: THREE.Vector3): { x: number; y: number } {
    const v = world.clone().project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  /** Per-frame update: follow camera, animate ocean. */
  update() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.ocean.update(dt);

    // Smoothly follow target
    const desired = this.cameraTarget.clone().add(this.currentOffset);
    this.camera.position.lerp(desired, 0.06);
    this.camera.lookAt(this.cameraTarget);

    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
    return dt;
  }

  addLabel(parent: THREE.Object3D, text: string, className = 'ship-label', yOffset = 8): CSS2DObject {
    const div = document.createElement('div');
    div.className = className;
    div.textContent = text;
    const obj = new CSS2DObject(div);
    obj.position.set(0, yOffset, 0);
    parent.add(obj);
    return obj;
  }

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
  };
}
