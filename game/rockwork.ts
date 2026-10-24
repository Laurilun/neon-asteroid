import { EntityType } from '../types';
import type { Asteroid, Bullet, Vector } from '../types';
import { worldPoint } from './gunship';

export const density = (type: EntityType) => type === EntityType.TungstenAsteroid ? 4 : type === EntityType.IronAsteroid ? 2.5 : type === EntityType.FrozenAsteroid ? .7 : 1;

export function rockMass(rock: Asteroid): number {
  let area = 0;
  if (rock.vertices.length >= 3) for (let i = 0; i < rock.vertices.length; i++) {
    const a = rock.vertices[i], b = rock.vertices[(i + 1) % rock.vertices.length];
    area += a.x * b.y - a.y * b.x;
  }
  const surface = rock.vertices.length >= 3 ? Math.abs(area) / 2 : Math.PI * rock.radius ** 2;
  return Math.max(.3, surface / (Math.PI * 324)) * density(rock.type);
}

/** Materials differ in contour as well as surface treatment. All stay within
 * their broad-phase radius; radial ordering also supports our sector fracture. */
export function rockOutline(radius: number, count: number, type: EntityType, random = Math.random): Vector[] {
  const phase = random() * Math.PI * 2;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i + (random() - .5) * .28) * Math.PI * 2 / count;
    let reach = Math.min(1, .82 + .1 * Math.sin(angle * 2 + phase) + .07 * Math.sin(angle * 5 - phase) + random() * .05);
    if (type === EntityType.FrozenAsteroid) reach *= i % 2 === 0 ? 1 : .74;
    if (type === EntityType.IronAsteroid) reach *= .78 + .22 * Math.abs(Math.cos(angle));
    if (type === EntityType.TungstenAsteroid) reach = .91 + random() * .04;
    return { x: Math.cos(angle) * radius * reach, y: Math.sin(angle) * radius * reach };
  });
}

export function strikeRock(rock: Asteroid, bullet: Bullet): void {
  const speed = Math.hypot(bullet.vel.x, bullet.vel.y) || 1;
  const d = { x: bullet.vel.x / speed, y: bullet.vel.y / speed };
  const mass = rockMass(rock);
  const push = Math.min(.9, bullet.damage * .035 / mass);
  rock.vel.x += d.x * push; rock.vel.y += d.y * push;
  rock.lastImpact = d;
  const hit = worldPoint({ x: bullet.pos.x + d.x * bullet.radius - rock.pos.x,
    y: bullet.pos.y + d.y * bullet.radius - rock.pos.y }, { x: 0, y: 0 }, -rock.rotation);
  const localDirection = worldPoint(d, { x: 0, y: 0 }, -rock.rotation);
  rock.rotationSpeed += Math.max(-.004, Math.min(.004, (hit.x * localDirection.y - hit.y * localDirection.x) * push / Math.max(1, rock.radius ** 2)));
  const wounds = rock.wounds ?? (rock.wounds = []);
  if (wounds.length === 6) wounds.shift();
  wounds.push({ ...hit, angle: Math.atan2(d.y, d.x) - rock.rotation });
}

export interface RockPiece { vertices: Vector[]; pos: Vector; vel: Vector; radius: number; rotation: number; spin: number }

/** Radial fracture along existing boundary vertices. The fan partitions the
 * parent's polygon exactly; no new unrelated outlines are substituted. */
export function cleaveRock(rock: Asteroid, requested: number): RockPiece[] {
  const n = rock.vertices.length;
  if (n < 3) return [];
  const count = Math.min(requested, Math.floor(n / 2));
  const pieces: RockPiece[] = [];
  const impact = rock.lastImpact ?? { x: 1, y: 0 };
  for (let sector = 0; sector < count; sector++) {
    const first = Math.floor(sector * n / count), last = Math.floor((sector + 1) * n / count);
    const raw = [{ x: 0, y: 0 }];
    for (let i = first; i <= last; i++) raw.push({ ...rock.vertices[i % n] });
    // Area-weighted center computed from the constituent fan triangles.
    let area = 0, cx = 0, cy = 0;
    for (let i = 1; i < raw.length - 1; i++) {
      const a = raw[i], b = raw[i + 1], weight = a.x * b.y - a.y * b.x;
      area += weight; cx += (a.x + b.x) * weight / 3; cy += (a.y + b.y) * weight / 3;
    }
    if (Math.abs(area) < .001) continue;
    const center = { x: cx / area, y: cy / area };
    const vertices = raw.map(v => ({ x: v.x - center.x, y: v.y - center.y }));
    const offset = worldPoint(center, { x: 0, y: 0 }, rock.rotation);
    const r = Math.hypot(offset.x, offset.y) || 1;
    pieces.push({ vertices, pos: { x: rock.pos.x + offset.x, y: rock.pos.y + offset.y },
      vel: { x: rock.vel.x + offset.x / r * 1.1 - offset.y * rock.rotationSpeed + impact.x * .25,
        y: rock.vel.y + offset.y / r * 1.1 + offset.x * rock.rotationSpeed + impact.y * .25 },
      radius: Math.max(...vertices.map(v => Math.hypot(v.x, v.y))), rotation: rock.rotation,
      spin: rock.rotationSpeed + (sector % 2 ? .012 : -.012) });
  }
  return pieces;
}
