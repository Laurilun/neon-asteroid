import type { Asteroid, Ship, Vector } from '../types';
import { SHIP_HULL } from './hardware';

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

export function checkShipCollision(ship: Ship, asteroid: Asteroid): boolean {
  // Keep the existing forgiving 85% asteroid hull-contact radius.
  const hitRadius = asteroid.radius * 0.85;
  const dx = ship.pos.x - asteroid.pos.x, dy = ship.pos.y - asteroid.pos.y;
  if (dx * dx + dy * dy > (ship.radius + asteroid.radius) ** 2) return false;
  const cos = Math.cos(ship.rotation), sin = Math.sin(ship.rotation);
  const point = (x: number, y: number): Vector => ({
    x: ship.pos.x + x * cos - y * sin,
    y: ship.pos.y + x * sin + y * cos,
  });
  if (asteroid.vertices.length >= 3) {
    // Use actual cut faces after fracture. Slightly inset the rock for arcade forgiveness.
    const local = (v: Vector) => toRockLocal(v, asteroid, .96);
    for (let i = 0; i < SHIP_HULL.length; i++) {
      const a = SHIP_HULL[i], b = SHIP_HULL[(i + 1) % SHIP_HULL.length];
      if (segmentPolygonHit(local(point(a.x * ship.radius, a.y * ship.radius)),
        local(point(b.x * ship.radius, b.y * ship.radius)), asteroid.vertices, 0) !== null) return true;
    }
    const v = asteroid.vertices[0], c = Math.cos(asteroid.rotation), s = Math.sin(asteroid.rotation);
    const world = { x: asteroid.pos.x + .96 * (v.x * c - v.y * s), y: asteroid.pos.y + .96 * (v.x * s + v.y * c) };
    const dx = world.x - ship.pos.x, dy = world.y - ship.pos.y;
    return pointInPolygon({ x: (dx * cos + dy * sin) / ship.radius, y: (-dx * sin + dy * cos) / ship.radius }, SHIP_HULL);
  }
  for (let i = 0; i < SHIP_HULL.length; i++) {
    const a = SHIP_HULL[i], b = SHIP_HULL[(i + 1) % SHIP_HULL.length];
    if (triangleCircleOverlap(ship.pos, point(a.x * ship.radius, a.y * ship.radius),
      point(b.x * ship.radius, b.y * ship.radius), asteroid.pos, hitRadius)) return true;
  }
  return false;
}

export function toRockLocal(point: Vector, rock: Asteroid, scale = 1): Vector {
  const dx = point.x - rock.pos.x, dy = point.y - rock.pos.y;
  const c = Math.cos(rock.rotation), s = Math.sin(rock.rotation);
  return { x: (dx * c + dy * s) / scale, y: (-dx * s + dy * c) / scale };
}
export function pointInPolygon(point: Vector, polygon: readonly Vector[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
/** Swept circle against polygon edges (capsules), including concave cut outlines. */
export function segmentPolygonHit(start: Vector, end: Vector, polygon: readonly Vector[], radius: number): number | null {
  if (pointInPolygon(start, polygon)) return 0;
  let nearest = Infinity;
  const dx = end.x - start.x, dy = end.y - start.y;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const vertexHit = segmentCircleHit(start, end, a, radius);
    if (vertexHit !== null) nearest = Math.min(nearest, vertexHit);
    const ex = b.x - a.x, ey = b.y - a.y, length = Math.hypot(ex, ey);
    if (length < 1e-8) continue;
    const tx = ex / length, ty = ey / length, nx = -ty, ny = tx;
    const sx = start.x - a.x, sy = start.y - a.y;
    const distance = sx * nx + sy * ny, speed = dx * nx + dy * ny;
    const projection = sx * tx + sy * ty;
    if (Math.abs(distance) <= radius && projection >= 0 && projection <= length) return 0;
    if (Math.abs(speed) < 1e-10) continue;
    for (const side of [-1, 1]) {
      const time = (side * radius - distance) / speed;
      if (time < 0 || time > 1) continue;
      const along = projection + time * (dx * tx + dy * ty);
      if (along >= 0 && along <= length) nearest = Math.min(nearest, time);
    }
  }
  return nearest === Infinity ? null : nearest;
}

/** Normal approach speed distinguishes a grazing contact from a head-on strike. */
export function shipContact(ship: Ship, asteroid: Asteroid) {
  const dx = ship.pos.x - asteroid.pos.x, dy = ship.pos.y - asteroid.pos.y;
  const d = Math.hypot(dx, dy);
  const normal = d > 1e-6 ? { x: dx / d, y: dy / d } : { x: -Math.cos(ship.rotation), y: -Math.sin(ship.rotation) };
  const approach = Math.max(0, -((ship.vel.x - asteroid.vel.x) * normal.x + (ship.vel.y - asteroid.vel.y) * normal.y));
  return { normal, approach, severity: Math.min(1.35, .45 + approach * .13),
    point: { x: ship.pos.x - normal.x * ship.radius * .7, y: ship.pos.y - normal.y * ship.radius * .7 } };
}
