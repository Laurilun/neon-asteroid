import type { Asteroid, Ship, Vector } from '../types';
import { EntityType } from '../types';
import { shipFootprint, worldPoint } from './gunship';
import { rockMass } from './rockwork';

/** Earliest swept point/circle contact, as a fraction of the segment. */
export function segmentCircleHit(start: Vector, end: Vector, center: Vector, radius: number): number | null {
  const sx = start.x - center.x, sy = start.y - center.y;
  const c = sx * sx + sy * sy - radius * radius;
  if (c <= 0) return 0;
  const dx = end.x - start.x, dy = end.y - start.y;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = sx * dx + sy * dy;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : null;
}

/** Includes edge contacts and circles fully contained in the triangle. */
export function triangleCircleOverlap(a: Vector, b: Vector, c: Vector, center: Vector, radius: number): boolean {
  if (segmentCircleHit(a, b, center, radius) !== null ||
      segmentCircleHit(b, c, center, radius) !== null ||
      segmentCircleHit(c, a, center, radius) !== null) return true;
  if ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) === 0) return false;
  const cross = (p: Vector, q: Vector) =>
    (q.x - p.x) * (center.y - p.y) - (q.y - p.y) * (center.x - p.x);
  const ab = cross(a, b), bc = cross(b, c), ca = cross(c, a);
  return (ab >= 0 && bc >= 0 && ca >= 0) || (ab <= 0 && bc <= 0 && ca <= 0);
}

export function insidePolygon(p: Vector, polygon: readonly Vector[]): boolean {
  let crossings = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < a.x + (p.y - a.y) / (b.y - a.y) * (b.x - a.x)) crossings++;
  }
  return crossings % 2 === 1;
}

/** A moving disc against edge rectangles and vertex discs, plus containment. */
export function sweepOutline(start: Vector, end: Vector, polygon: readonly Vector[], radius: number): number | null {
  if (insidePolygon(start, polygon)) return 0;
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const vertex = segmentCircleHit(start, end, a, radius);
    if (vertex !== null) best = Math.min(best, vertex);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < .000001) continue;
    const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length;
    const sx = (start.x - a.x) * ux + (start.y - a.y) * uy;
    const sy = -(start.x - a.x) * uy + (start.y - a.y) * ux;
    const vx = (end.x - start.x) * ux + (end.y - start.y) * uy;
    const vy = -(end.x - start.x) * uy + (end.y - start.y) * ux;
    let entry = 0, exit = 1;
    for (const [pos, delta, low, high] of [[sx, vx, 0, length], [sy, vy, -radius, radius]]) {
      if (Math.abs(delta) < 1e-10) { if (pos < low || pos > high) exit = -1; }
      else { const t1 = (low - pos) / delta, t2 = (high - pos) / delta;
        entry = Math.max(entry, Math.min(t1, t2)); exit = Math.min(exit, Math.max(t1, t2)); }
    }
    if (entry <= exit) best = Math.min(best, entry);
  }
  return best <= 1 ? best : null;
}

export function checkShipCollision(ship: Ship, asteroid: Asteroid): boolean {
  if (Math.hypot(ship.pos.x - asteroid.pos.x, ship.pos.y - asteroid.pos.y) > ship.radius * 1.35 + asteroid.radius) return false;
  const hulls = shipFootprint(ship.stats.multishotTier).map(outline => outline.map(v => worldPoint(v, ship.pos, ship.rotation, ship.radius)));
  if (asteroid.vertices.length < 3) {
    return hulls.some(hull => sweepOutline(asteroid.pos, asteroid.pos, hull, asteroid.radius * .85) !== null);
  }
  // Compare the actual silhouettes, including the thin edges of fractured slabs.
  const rock = asteroid.vertices.map(v => worldPoint(v, asteroid.pos, asteroid.rotation));
  return hulls.some(hull => insidePolygon(rock[0], hull) || insidePolygon(hull[0], rock) ||
    hull.some((v, i) => sweepOutline(v, hull[(i + 1) % hull.length], rock, .3) !== null));
}

export function collideShip(ship: Ship, rock: Asteroid) {
  const dx = ship.pos.x - rock.pos.x, dy = ship.pos.y - rock.pos.y;
  const len = Math.hypot(dx, dy) || 1;
  const normal = { x: len === 1 && dx === 0 && dy === 0 ? -Math.cos(ship.rotation) : dx / len,
    y: len === 1 && dx === 0 && dy === 0 ? -Math.sin(ship.rotation) : dy / len };
  // Flat fractured faces should push along the contact face, not the old center.
  if (rock.vertices.length >= 3) {
    const local = worldPoint({ x: dx, y: dy }, { x: 0, y: 0 }, -rock.rotation);
    let closest = Infinity, contact = { x: 0, y: 0 };
    for (let i = 0; i < rock.vertices.length; i++) {
      const a = rock.vertices[i], b = rock.vertices[(i + 1) % rock.vertices.length];
      const ex = b.x - a.x, ey = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((local.x - a.x) * ex + (local.y - a.y) * ey) / Math.max(1e-8, ex * ex + ey * ey)));
      const p = { x: a.x + ex * t, y: a.y + ey * t };
      const distance = Math.hypot(local.x - p.x, local.y - p.y);
      if (distance < closest) { closest = distance; contact = p; }
    }
    if (closest > .0001 && Number.isFinite(closest)) {
      const sign = insidePolygon(local, rock.vertices) ? -1 : 1;
      const direction = worldPoint({ x: (local.x - contact.x) / closest * sign, y: (local.y - contact.y) / closest * sign }, { x: 0, y: 0 }, rock.rotation);
      normal.x = direction.x; normal.y = direction.y;
    }
  }
  const closing = Math.max(0, -(ship.vel.x - rock.vel.x) * normal.x - (ship.vel.y - rock.vel.y) * normal.y);
  const severity = Math.min(1, closing / 7);
  const mass = Math.max(.3, rockMass(rock) * .36);
  const impulse = (.9 + closing * 1.55) * mass / (mass + .35) * (rock.type === EntityType.IronAsteroid ? 1.35 : 1);
  ship.vel.x += normal.x * impulse; ship.vel.y += normal.y * impulse;
  rock.vel.x -= normal.x * impulse / mass * .25; rock.vel.y -= normal.y * impulse / mass * .25;
  ship.spin = (ship.spin ?? 0) + Math.sin(Math.atan2(normal.y, normal.x) - ship.rotation) * severity * .025;
  return { normal, severity, damageFactor: .35 + severity * .9 };
}
