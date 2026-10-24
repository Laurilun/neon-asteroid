import { EntityType } from '../types';
import type { Asteroid, Ship, Vector } from '../types';
import { fracturePolygon, pieceMotion } from './fracture';

export type FeelEvent =
  | { kind: 'fired'; ship: Ship }
  | { kind: 'impact'; pos: Vector; direction: Vector; power: number; material: EntityType; ricochet: boolean }
  | { kind: 'fracture'; rock: Asteroid; solidPieces: boolean }
  | { kind: 'collision'; pos: Vector; direction: Vector; severity: number }
  | { kind: 'nearMiss'; pos: Vector; direction: Vector };
export interface FeelEffect {
  kind: 'chip' | 'spark' | 'flash' | 'chunk' | 'wake';
  pos: Vector; vel: Vector; angle: number; spin: number;
  age: number; duration: number; size: number; color: string; vertices?: Vector[];
}
export const EFFECT_CAP = 220;
export const MATERIALS: Partial<Record<EntityType, { body: string; facet: string; edge: string; cut: string }>> = {
  [EntityType.Asteroid]: { body: '#343d48', facet: '#52616c', edge: '#8e9b9e', cut: '#b1b4a7' },
  [EntityType.MoltenAsteroid]: { body: '#332b2b', facet: '#59413b', edge: '#b17c58', cut: '#ffa249' },
  [EntityType.FrozenAsteroid]: { body: '#26404d', facet: '#477584', edge: '#a3ccd0', cut: '#d0f5ef' },
  [EntityType.IronAsteroid]: { body: '#473c34', facet: '#78604b', edge: '#c49d70', cut: '#f5c487' },
  [EntityType.TungstenAsteroid]: { body: '#353335', facet: '#5c5652', edge: '#a4957a', cut: '#ddc6a0' },
  [EntityType.TungstenShard]: { body: '#4a423a', facet: '#7b6d57', edge: '#b8a27c', cut: '#ddc6a0' },
};
export function material(type: EntityType) { return MATERIALS[type] ?? MATERIALS[EntityType.Asteroid]!; }

/** Immediate event sink, fixed-tick lifetimes, hard budgets. No gameplay is driven by this state. */
export class FeelResponses {
  effects: FeelEffect[] = [];
  reduced = false;
  shake = 0;
  shakeDirection: Vector = { x: 1, y: 0 };
  tick = 0;
  private nearMissCooldown = 0;
  reset() { this.effects.length = 0; this.shake = 0; this.tick = 0; this.nearMissCooldown = 0; }
  private add(effect: FeelEffect) {
    const cap = this.reduced ? 90 : EFFECT_CAP;
    if (this.effects.length < cap) this.effects.push(effect);
  }
  private kick(amount: number, direction: Vector) {
    if (amount > this.shake) { this.shake = Math.min(5, amount); this.shakeDirection = { ...direction }; }
  }
  emit(event: FeelEvent, random = Math.random): void {
    if (event.kind === 'fired') {
      event.ship.cannonRecoil = 1;
      event.ship.cannonHeat = Math.min(1, (event.ship.cannonHeat ?? 0) + .24);
      return;
    }
    if (event.kind === 'fracture') {
      const rock = event.rock, palette = material(rock.type);
      const direction = rock.impactDirection ?? { x: 1, y: 0 };
      if (!event.solidPieces) {
        const pieces = fracturePolygon(rock.vertices, rock.sizeCategory > 2 ? 5 : 3,
          Math.atan2(direction.y, direction.x) - rock.rotation);
        for (const piece of pieces) {
          const motion = pieceMotion(rock, piece, 1.1);
          this.add({ kind: 'chunk', ...motion, angle: rock.rotation, spin: rock.rotationSpeed + (random() - .5) * .025,
            age: 0, duration: 38 + random() * 15, size: piece.radius, color: palette.facet, vertices: piece.vertices });
        }
      }
      this.kick(Math.min(3.5, rock.radius / 28), direction);
      // Large breakup gets a brief, local pressure arc, never a full-screen flash.
      this.add({ kind: 'flash', pos: { ...rock.pos }, vel: { x: 0, y: 0 }, angle: Math.atan2(direction.y, direction.x),
        spin: 0, age: 0, duration: 12, size: Math.min(65, rock.radius * .7), color: palette.cut });
      return;
    }
    if (event.kind === 'nearMiss') {
      if (this.nearMissCooldown > 0) return;
      this.nearMissCooldown = 60;
      this.add({ kind: 'wake', pos: { ...event.pos }, vel: { x: event.direction.x * .3, y: event.direction.y * .3 },
        angle: Math.atan2(event.direction.y, event.direction.x), spin: 0, age: 0, duration: 18, size: 12, color: '#94b4bc' });
      return;
    }
    const collision = event.kind === 'collision';
    const palette = material(collision ? EntityType.IronAsteroid : event.material);
    const power = collision ? event.severity * 16 : event.power;
    const angle = Math.atan2(event.direction.y, event.direction.x);
    if (collision) this.kick(event.severity * 3.5, event.direction);
    this.add({ kind: 'flash', pos: { ...event.pos }, vel: { x: 0, y: 0 }, angle,
      spin: 0, age: 0, duration: this.reduced ? 3 : 5, size: Math.min(15, 4 + Math.sqrt(power)),
      color: !collision && event.ricochet ? '#9be6e1' : '#ffe0a0' });
    const count = this.reduced ? 3 : Math.min(10, 3 + Math.floor(power / 8));
    for (let i = 0; i < count; i++) {
      const eject = angle + Math.PI + (random() - .5) * 2.1;
      const speed = .8 + random() * Math.min(4, 1 + Math.sqrt(power) * .4);
      this.add({ kind: i % 3 === 0 ? 'spark' : 'chip', pos: { ...event.pos },
        vel: { x: Math.cos(eject) * speed, y: Math.sin(eject) * speed }, angle: eject,
        spin: (random() - .5) * .2, age: 0, duration: 14 + random() * 20,
        size: 1.2 + random() * 2, color: i % 3 === 0 ? palette.cut : palette.facet });
    }
  }
  step(ship?: Ship | null) {
    this.tick++;
    this.nearMissCooldown = Math.max(0, this.nearMissCooldown - 1);
    this.shake *= .83;
    if (ship) {
      ship.cannonRecoil = Math.max(0, (ship.cannonRecoil ?? 0) - .16);
      ship.cannonHeat = Math.max(0, (ship.cannonHeat ?? 0) - .013);
    }
    let write = 0;
    const cap = this.reduced ? 90 : EFFECT_CAP;
    for (const effect of this.effects) {
      effect.age++;
      if (effect.age >= effect.duration || write >= cap) continue;
      effect.pos.x += effect.vel.x; effect.pos.y += effect.vel.y;
      effect.angle += effect.spin;
      effect.vel.x *= .985; effect.vel.y *= .985;
      this.effects[write++] = effect;
    }
    this.effects.length = write;
  }
}
