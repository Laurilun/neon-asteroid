import { EntityType } from '../types';
import type { Asteroid, Bullet, Ship, Vector } from '../types';
import { compactEntities } from './engine';
import { localToWorld, seededRandom } from './geometry';
import type { BreakupPiece } from './asteroids';

/** The small simulation-to-presentation vocabulary can later feed audio too. */
export type FeelEvent =
  | { kind: 'shot'; bullet: Bullet }
  | { kind: 'impact'; pos: Vector; direction: Vector; material: EntityType; power: number; radius: number; destroyed: boolean }
  | { kind: 'fracture'; asteroid: Asteroid; pieces: BreakupPiece[]; livePieces: boolean }
  | { kind: 'ship-contact'; pos: Vector; normal: Vector; severity: number; material: EntityType }
  | { kind: 'near-miss'; pos: Vector; direction: Vector; radius: number };

export interface FeelEffect {
  kind: 'chunk' | 'spark' | 'dust' | 'ring' | 'impact' | 'near';
  pos: Vector; vel: Vector; angle: number; spin: number;
  age: number; duration: number; size: number; strength: number;
  material: EntityType; vertices?: readonly Vector[]; toBeRemoved: boolean;
}

export const EFFECT_LIMITS = { debris: 120, accents: 100, reducedDebris: 45, reducedAccents: 40 } as const;

/** Owns event-time variation and fixed-tick visual lifetimes, never gameplay.
 * No render-time randomness; independent RNG keeps effects out of loot/spawn rolls.
 */
export class FeelSystem {
  readonly debris: FeelEffect[] = [];
  readonly accents: FeelEffect[] = [];
  readonly recoil = Array<number>(8).fill(0);
  readonly muzzle = Array<number>(8).fill(0);
  readonly heat = Array<number>(8).fill(0);
  reduced = false;
  shake = 0;
  private random = seededRandom(0x71a55);
  private nearState = new WeakMap<Asteroid, { distance: number; lastEvent: number; approaching: boolean }>();

  reset(): void {
    this.debris.length = this.accents.length = 0;
    this.recoil.fill(0); this.muzzle.fill(0); this.heat.fill(0);
    this.shake = 0;
    this.nearState = new WeakMap();
    this.random = seededRandom(0x71a55);
  }

  private add(kind: FeelEffect['kind'], pos: Vector, vel: Vector, material: EntityType,
    size: number, duration: number, angle = 0, strength = 1, vertices?: readonly Vector[], spin = 0): void {
    const list = kind === 'chunk' ? this.debris : this.accents;
    const limit = kind === 'chunk' ? (this.reduced ? EFFECT_LIMITS.reducedDebris : EFFECT_LIMITS.debris) :
      (this.reduced ? EFFECT_LIMITS.reducedAccents : EFFECT_LIMITS.accents);
    if (list.length >= limit) return;
    list.push({ kind, pos: { ...pos }, vel: { ...vel }, material, size, duration, angle,
      strength, vertices, spin, age: 0, toBeRemoved: false });
  }

  emit(event: FeelEvent): void {
    const rand = this.random;
    if (event.kind === 'shot') {
      const id = event.bullet.mountId;
      if (id !== undefined && id < this.recoil.length) {
        this.recoil[id] = 1; this.muzzle[id] = 1;
        this.heat[id] = Math.min(1, this.heat[id] + 0.32);
      }
      return;
    }
    if (event.kind === 'impact') {
      const angle = Math.atan2(event.direction.y, event.direction.x);
      const energy = Math.min(2.4, 0.55 + event.power / 22);
      this.add('impact', event.pos, { x: 0, y: 0 }, event.material, 4 + energy * 2, this.reduced ? 3 : 6, angle, energy);
      const count = this.reduced ? 2 : Math.min(7, Math.ceil(energy * 3));
      for (let i = 0; i < count; i++) {
        // Eject mostly back out of the entry face, with material-specific chips.
        const eject = angle + Math.PI + (rand() - 0.5) * 1.9;
        const speed = 0.7 + rand() * (1.5 + energy);
        const size = 1.4 + rand() * 2.6;
        const vertices = [{ x: -size, y: -size * 0.4 }, { x: size * 0.8, y: -size * 0.6 }, { x: size * 0.5, y: size * 0.7 }];
        this.add('chunk', event.pos, { x: Math.cos(eject) * speed, y: Math.sin(eject) * speed }, event.material, size,
          18 + rand() * 22, rand() * 6, 1, vertices, (rand() - 0.5) * 0.18);
        if (!this.reduced && i < 3) this.add('spark', event.pos,
          { x: Math.cos(eject) * speed * 1.6, y: Math.sin(eject) * speed * 1.6 }, event.material, 1, 10 + rand() * 7, eject);
      }
      if (!event.destroyed) this.shake = Math.min(2, this.shake + energy * 0.16);
    } else if (event.kind === 'fracture') {
      const { asteroid: a } = event;
      if (!event.livePieces) {
        for (const piece of event.pieces) {
          this.add('chunk', piece.pos, piece.vel, a.type, piece.radius, 38 + Math.min(40, a.radius * 0.4),
            piece.rotation, 1, piece.vertices, piece.rotationSpeed);
        }
      }
      // Edge chips preserve parent geometry while live gameplay pieces carry the bulk.
      const count = this.reduced ? 3 : Math.min(12, 4 + a.sizeCategory * 2);
      for (let i = 0; i < count && a.vertices.length; i++) {
        const index = Math.floor(rand() * a.vertices.length);
        const v = a.vertices[index], next = a.vertices[(index + 1) % a.vertices.length];
        const center = { x: (v.x + next.x) * 0.46, y: (v.y + next.y) * 0.46 };
        const scale = 0.2 + rand() * 0.25;
        const vertices = [{ x: (v.x - center.x) * scale, y: (v.y - center.y) * scale },
          { x: (next.x - center.x) * scale, y: (next.y - center.y) * scale }, { x: -center.x * 0.1, y: -center.y * 0.1 }];
        const pos = localToWorld(center, a.pos, a.rotation);
        const angle = Math.atan2(pos.y - a.pos.y, pos.x - a.pos.x);
        const velocity = 1 + rand() * 2;
        this.add('chunk', pos, { x: a.vel.x + Math.cos(angle) * velocity, y: a.vel.y + Math.sin(angle) * velocity },
          a.type, 4, 32 + rand() * 32, a.rotation, 1, vertices, (rand() - 0.5) * 0.12);
      }
      this.add('ring', a.pos, a.vel, a.type, a.radius * 0.55, 20, 0, a.sizeCategory);
      if (!this.reduced) {
        for (let i = 0; i < 4; i++) {
          const angle = rand() * Math.PI * 2;
          this.add('dust', a.pos, { x: a.vel.x + Math.cos(angle) * 0.7, y: a.vel.y + Math.sin(angle) * 0.7 },
            a.type, a.radius * (0.22 + rand() * 0.2), 26 + rand() * 14);
        }
      }
      this.shake = Math.min(5, this.shake + a.sizeCategory * 0.75);
    } else if (event.kind === 'ship-contact') {
      const direction = { x: -event.normal.x, y: -event.normal.y };
      this.emit({ kind: 'impact', pos: event.pos, direction, material: event.material,
        power: 12 + event.severity * 24, radius: 8, destroyed: false });
      this.shake = Math.min(6, 1.5 + event.severity * 4);
    } else {
      this.add('near', event.pos, { x: 0, y: 0 }, EntityType.Asteroid, event.radius, 16,
        Math.atan2(event.direction.y, event.direction.x));
    }
  }

  step(): void {
    this.shake *= 0.84;
    for (let i = 0; i < this.recoil.length; i++) {
      this.recoil[i] *= 0.76; this.muzzle[i] *= 0.42; this.heat[i] *= 0.955;
    }
    for (const effects of [this.debris, this.accents]) {
      for (const e of effects) {
        e.age++;
        e.pos.x += e.vel.x; e.pos.y += e.vel.y;
        e.angle += e.spin;
        if (e.kind === 'spark' || e.kind === 'dust') { e.vel.x *= 0.96; e.vel.y *= 0.96; }
        if (e.age >= e.duration) e.toBeRemoved = true;
      }
      compactEntities(effects, effects === this.debris ?
        (this.reduced ? EFFECT_LIMITS.reducedDebris : EFFECT_LIMITS.debris) :
        (this.reduced ? EFFECT_LIMITS.reducedAccents : EFFECT_LIMITS.accents));
    }
  }

  trackNearMisses(ship: Ship, asteroids: Asteroid[], tick: number): void {
    if (Math.hypot(ship.vel.x, ship.vel.y) < 3) return;
    for (const a of asteroids) {
      if (a.toBeRemoved) continue;
      const distance = Math.hypot(ship.pos.x - a.pos.x, ship.pos.y - a.pos.y);
      let state = this.nearState.get(a);
      if (!state) { state = { distance, lastEvent: -200, approaching: false }; this.nearState.set(a, state); }
      const gap = distance - a.radius - ship.radius * 1.25;
      // Fire once at the closest approach, only for a genuine near contact, never an impact.
      if (state.approaching && distance >= state.distance && gap > 1 && gap < 16 && tick - state.lastEvent > 120) {
        this.emit({ kind: 'near-miss', pos: a.pos, direction: { x: ship.pos.x - a.pos.x, y: ship.pos.y - a.pos.y }, radius: a.radius + 5 });
        state.lastEvent = tick;
      }
      state.approaching = distance < state.distance;
      state.distance = distance;
    }
  }
}

