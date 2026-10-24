import { EntityType } from '../types';
import type { Asteroid, Vector } from '../types';
import type { RockPiece } from './rockwork';
import { compactEntities } from './engine';

export type CombatEvent =
  | { type: 'discharge'; mount: number }
  | { type: 'strike'; point: Vector; velocity: Vector; material: EntityType; damage: number }
  | { type: 'break'; rock: Asteroid; fragments: RockPiece[]; solid: boolean }
  | { type: 'collision'; point: Vector; normal: Vector; severity: number }
  | { type: 'pass'; point: Vector; velocity: Vector };

export interface Fleck {
  source?: { rock: Asteroid; offset: Vector };
  pos: Vector; vel: Vector; outline?: Vector[]; angle: number; spin: number;
  life: number; duration: number; size: number; color: string;
  kind: 'chip' | 'flare' | 'wake'; toBeRemoved: boolean;
}
export const RESPONSE_CAP = 180;
const fragmentColor = (type: EntityType) => type === EntityType.FrozenAsteroid ? '#8cbfd4' :
  type === EntityType.MoltenAsteroid ? '#ba7151' : type === EntityType.IronAsteroid ? '#ae8b68' : '#83919b';

/** Presentation only. The event boundary can also feed a future audio consumer. */
export class CombatResponses {
  readonly flecks: Fleck[] = [];
  readonly barrelKick = [0, 0, 0, 0, 0, 0];
  readonly barrelHeat = [0, 0, 0, 0, 0, 0];
  reduced = false;
  shake = { x: 0, y: 0 };
  private seed = 12345;
  private random(): number { this.seed = (Math.imul(this.seed, 1103515245) + 12345) >>> 0; return this.seed / 4294967296; }
  clear(): void { this.flecks.length = 0; this.barrelKick.fill(0); this.barrelHeat.fill(0); this.shake = { x: 0, y: 0 }; }
  private add(f: Omit<Fleck, 'toBeRemoved' | 'life'>, important = false): void {
    if (this.flecks.length >= (this.reduced ? 60 : RESPONSE_CAP)) {
      if (!important) return;
      // A massive breakup gets room even when small impact chips fill the budget.
      const expendable = this.flecks.findIndex(fleck => !fleck.source);
      this.flecks.splice(Math.max(0, expendable), 1);
    }
    this.flecks.push({ ...f, life: f.duration, toBeRemoved: false });
  }
  emit(event: CombatEvent): void {
    if (event.type === 'discharge') {
      this.barrelKick[event.mount] = 1;
      this.barrelHeat[event.mount] = Math.min(1, this.barrelHeat[event.mount] + .3);
    } else if (event.type === 'strike') {
      const angle = Math.atan2(event.velocity.y, event.velocity.x);
      const power = Math.min(2.2, Math.sqrt(event.damage / 16));
      this.add({ kind: 'flare', pos: { ...event.point }, vel: { x: 0, y: 0 }, angle,
        spin: 0, size: 8 * power, duration: this.reduced ? 3 : 5, color: '#ffe8b0' });
      for (let i = 0; i < (this.reduced ? 2 : 6); i++) {
        const direction = angle + Math.PI + (this.random() - .5) * 2.6;
        const speed = (1 + this.random() * 3) * power;
        const size = 1.5 + this.random() * 3;
        this.add({ kind: 'chip', pos: { ...event.point }, vel: { x: Math.cos(direction) * speed, y: Math.sin(direction) * speed },
          angle: direction, spin: (this.random() - .5) * .2, size, duration: 18 + this.random() * 25, color: fragmentColor(event.material),
          outline: [{ x: -size, y: -size * .5 }, { x: size, y: -size * .2 }, { x: size * .5, y: size * .65 }, { x: -size * .8, y: size * .4 }] });
      }
    } else if (event.type === 'break') {
      if (!event.solid) for (const piece of event.fragments) this.add({
        kind: 'chip', pos: { ...piece.pos }, vel: { ...piece.vel }, outline: piece.vertices,
        angle: piece.rotation, spin: piece.spin, size: piece.radius, duration: 36 + event.rock.sizeCategory * 9,
        color: fragmentColor(event.rock.type),
        source: { rock: event.rock, offset: {
          x: (event.rock.pos.x - piece.pos.x) * Math.cos(piece.rotation) + (event.rock.pos.y - piece.pos.y) * Math.sin(piece.rotation),
          y: -(event.rock.pos.x - piece.pos.x) * Math.sin(piece.rotation) + (event.rock.pos.y - piece.pos.y) * Math.cos(piece.rotation),
        } },
      }, true);
      const d = event.rock.lastImpact ?? { x: 0, y: 1 };
      const kick = event.rock.sizeCategory * .8;
      this.shake.x = Math.max(-5, Math.min(5, this.shake.x + d.x * kick));
      this.shake.y = Math.max(-5, Math.min(5, this.shake.y + d.y * kick));
    } else if (event.type === 'collision') {
      this.shake.x = event.normal.x * (2 + event.severity * 5);
      this.shake.y = event.normal.y * (2 + event.severity * 5);
      this.emit({ type: 'strike', point: event.point, velocity: { x: -event.normal.x, y: -event.normal.y }, material: EntityType.IronAsteroid, damage: 20 + event.severity * 35 });
    } else {
      this.add({ kind: 'wake', pos: { ...event.point }, vel: { x: event.velocity.x * .25, y: event.velocity.y * .25 },
        angle: Math.atan2(event.velocity.y, event.velocity.x), spin: 0, size: 22, duration: 15, color: '#9babb6' });
    }
  }
  tick(): void {
    this.shake.x *= -.7; this.shake.y *= -.7;
    for (let i = 0; i < 6; i++) { this.barrelKick[i] *= .78; this.barrelHeat[i] *= .96; }
    for (const f of this.flecks) {
      f.pos.x += f.vel.x; f.pos.y += f.vel.y; f.angle += f.spin;
      if (--f.life <= 0) f.toBeRemoved = true;
    }
    compactEntities(this.flecks, this.reduced ? 60 : RESPONSE_CAP);
  }
}
