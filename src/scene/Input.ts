import * as THREE from 'three';
import { SceneManager } from './SceneManager';

/**
 * Unified pointer input — works for mouse, single-touch, and multi-touch.
 * Each pointerdown starts a Track; on move it updates; on up it ends.
 * Drag distinguished from tap by a small threshold.
 */

export type PointerKind = 'mouse' | 'touch' | 'pen';

export type PointerEventInfo = {
  id: number;
  kind: PointerKind;
  startX: number;
  startY: number;
  x: number;
  y: number;
  world: THREE.Vector3 | null;
  startWorld: THREE.Vector3 | null;
  duration: number;
  movedPx: number;
};

export type InputCallbacks = {
  onTap?: (ev: PointerEventInfo) => void;
  onDragStart?: (ev: PointerEventInfo) => void;
  onDragMove?: (ev: PointerEventInfo) => void;
  onDragEnd?: (ev: PointerEventInfo) => void;
};

export class Input {
  private scene: SceneManager;
  private cb: InputCallbacks;
  private active = new Map<number, PointerEventInfo & { startTime: number; dragging: boolean }>();
  private dragThreshold = 12; // px

  constructor(scene: SceneManager, cb: InputCallbacks) {
    this.scene = scene;
    this.cb = cb;
    const el = scene.renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('pointerleave', this.onUp);
    // prevent default touch behaviors at the document level
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('contextmenu', e => e.preventDefault());
  }

  private onDown = (e: PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const world = this.scene.screenToWorld(e.clientX, e.clientY);
    const info = {
      id: e.pointerId,
      kind: e.pointerType as PointerKind,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      world,
      startWorld: world,
      duration: 0,
      movedPx: 0,
      startTime: performance.now(),
      dragging: false,
    };
    this.active.set(e.pointerId, info);
  };

  private onMove = (e: PointerEvent) => {
    const info = this.active.get(e.pointerId);
    if (!info) return;
    info.x = e.clientX;
    info.y = e.clientY;
    info.world = this.scene.screenToWorld(e.clientX, e.clientY);
    info.duration = performance.now() - info.startTime;
    info.movedPx = Math.hypot(e.clientX - info.startX, e.clientY - info.startY);

    if (!info.dragging && info.movedPx > this.dragThreshold) {
      info.dragging = true;
      this.cb.onDragStart?.(info);
    } else if (info.dragging) {
      this.cb.onDragMove?.(info);
    }
  };

  private onUp = (e: PointerEvent) => {
    const info = this.active.get(e.pointerId);
    if (!info) return;
    info.x = e.clientX;
    info.y = e.clientY;
    info.world = this.scene.screenToWorld(e.clientX, e.clientY);
    info.duration = performance.now() - info.startTime;
    info.movedPx = Math.hypot(e.clientX - info.startX, e.clientY - info.startY);

    if (info.dragging) {
      this.cb.onDragEnd?.(info);
    } else {
      this.cb.onTap?.(info);
    }
    this.active.delete(e.pointerId);
  };
}
