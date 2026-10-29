import type { Asteroid, Ship, Vector } from '../types';
import { localToWorld, SHIP_HULL, weaponMounts } from './geometry';

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
  // Legacy circular fixtures retain their forgiving radius; live rocks use their polygons.
  const hitRadius = asteroid.radius * 0.85;
  const dx = ship.pos.x - asteroid.pos.x, dy = ship.pos.y - asteroid.pos.y;
  const bound = asteroid.vertices.length >= 3 ? asteroid.radius : hitRadius;
  if (dx * dx + dy * dy > (ship.radius * 1.3 + bound) ** 2) return false;
  const cos = Math.cos(ship.rotation), sin = Math.sin(ship.rotation);
  if (asteroid.vertices.length >= 3) {
    const cosA = Math.cos(asteroid.rotation), sinA = Math.sin(asteroid.rotation);
    const transform = (v: Vector): Vector => {
      const world = localToWorld(v, ship.pos, ship.rotation, ship.radius);
      const x = world.x - asteroid.pos.x, y = world.y - asteroid.pos.y;
      return { x: x * cosA + y * sinA, y: -x * sinA + y * cosA };
    };
    if (polygonsOverlap(SHIP_HULL.map(transform), asteroid.vertices)) return true;
    for (const m of weaponMounts(ship.stats.multishotTier)) {
      if (polygonsOverlap([
        { x: m.x - 0.55, y: m.y - 0.085 }, { x: m.x, y: m.y - 0.085 },
        { x: m.x, y: m.y + 0.085 }, { x: m.x - 0.55, y: m.y + 0.085 },
      ].map(transform), asteroid.vertices)) return true;
    }
    return false;
  }
  // Transform one target into local space rather than allocating a world polygon.
  const local = { x: (-dx * cos - dy * sin) / ship.radius, y: (dx * sin - dy * cos) / ship.radius };
  if (polygonCircleOverlap(SHIP_HULL, local, hitRadius / ship.radius)) return true;
  // The actual visible barrels participate in the footprint too.
  for (const mount of weaponMounts(ship.stats.multishotTier)) {
    const x = Math.max(mount.x - 0.55, Math.min(mount.x, local.x));
    const y = Math.max(mount.y - 0.085, Math.min(mount.y + 0.085, local.y));
    if ((local.x - x) ** 2 + (local.y - y) ** 2 <= (hitRadius / ship.radius) ** 2) return true;
  }
  return false;
}

function pointInPolygon(point: Vector, vertices: readonly Vector[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[j], b = vertices[i];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function polygonsOverlap(a: readonly Vector[], b: readonly Vector[]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  if (pointInPolygon(a[0], b) || pointInPolygon(b[0], a)) return true;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const p = a[i], q = a[(i + 1) % a.length], r = b[j], s = b[(j + 1) % b.length];
    const dx = q.x - p.x, dy = q.y - p.y, ex = s.x - r.x, ey = s.y - r.y;
    const determinant = dx * ey - dy * ex;
    if (Math.abs(determinant) < 1e-9) {
      if (segmentCircleHit(p, q, r, 1e-7) !== null || segmentCircleHit(p, q, s, 1e-7) !== null) return true;
      continue;
    }
    const t = ((r.x - p.x) * ey - (r.y - p.y) * ex) / determinant;
    const u = ((r.x - p.x) * dy - (r.y - p.y) * dx) / determinant;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
  }
  return false;
}

/** Swept projectile vs a polygon inflated by its radius (edge capsules + interior).
 * Narrow phase runs only after the bounding-circle test, including clipped fragments.
 */
export function sweptCirclePolygonHit(start: Vector, end: Vector, vertices: readonly Vector[], radius: number): number | null {
  if (polygonCircleOverlap(vertices, start, radius)) return 0;
  let nearest = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    const hit = segmentCircleHit(start, end, a, radius);
    if (hit !== null) nearest = Math.min(nearest, hit);
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    if (length < 1e-8) continue;
    const nx = -dy / length, ny = dx / length;
    const initial = (start.x - a.x) * nx + (start.y - a.y) * ny;
    const velocity = (end.x - start.x) * nx + (end.y - start.y) * ny;
    if (Math.abs(velocity) < 1e-9) continue;
    for (const side of [-1, 1]) {
      const t = (side * radius - initial) / velocity;
      if (t < 0 || t > 1 || t >= nearest) continue;
      const x = start.x + (end.x - start.x) * t - a.x;
      const y = start.y + (end.y - start.y) * t - a.y;
      const along = (x * dx + y * dy) / length;
      if (along >= 0 && along <= length) nearest = t;
    }
  }
  return nearest === Infinity ? null : nearest;
}

export function polygonCircleOverlap(vertices: readonly Vector[], center: Vector, radius: number): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[j], b = vertices[i];
    if (segmentCircleHit(a, b, center, radius) !== null) return true;
    if ((a.y > center.y) !== (b.y > center.y) && center.x < (b.x - a.x) * (center.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Relative normal speed determines severity: glances retain tangential drift. */
export function shipContactResponse(ship: Ship, asteroid: Asteroid, impulseScale = 1) {
  const dx = ship.pos.x - asteroid.pos.x, dy = ship.pos.y - asteroid.pos.y;
  const distance = Math.hypot(dx, dy);
  let nx = distance > 0.001 ? dx / distance : -Math.cos(ship.rotation);
  let ny = distance > 0.001 ? dy / distance : -Math.sin(ship.rotation);
  let contactPos = { x: ship.pos.x - nx * ship.radius * 0.7, y: ship.pos.y - ny * ship.radius * 0.7 };
  if (asteroid.vertices.length >= 3) {
    const cos = Math.cos(asteroid.rotation), sin = Math.sin(asteroid.rotation);
    const local = { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
    let closest = Infinity, px = 0, py = 0;
    for (let i = 0; i < asteroid.vertices.length; i++) {
      const a = asteroid.vertices[i], b = asteroid.vertices[(i + 1) % asteroid.vertices.length];
      const ex = b.x - a.x, ey = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((local.x - a.x) * ex + (local.y - a.y) * ey) / Math.max(1e-8, ex * ex + ey * ey)));
      const x = a.x + ex * t, y = a.y + ey * t;
      const d = (x - local.x) ** 2 + (y - local.y) ** 2;
      if (d < closest) { closest = d; px = x; py = y; }
    }
    if (closest > 1e-8 && Number.isFinite(closest)) {
      const sign = pointInPolygon(local, asteroid.vertices) ? -1 : 1;
      const lx = (local.x - px) / Math.sqrt(closest) * sign;
      const ly = (local.y - py) / Math.sqrt(closest) * sign;
      nx = lx * cos - ly * sin; ny = lx * sin + ly * cos;
      contactPos = localToWorld({ x: px, y: py }, asteroid.pos, asteroid.rotation);
    }
  }
  const closing = Math.max(0, -((ship.vel.x - asteroid.vel.x) * nx + (ship.vel.y - asteroid.vel.y) * ny));
  const severity = Math.min(1, closing / 6);
  const massRatio = Math.min(1, (asteroid.radius / 36) ** 2);
  const impulse = (0.9 + closing * 0.72) * (0.55 + massRatio * 0.45) * impulseScale;
  ship.vel.x += nx * impulse;
  ship.vel.y += ny * impulse;
  // A bounded spin impulse gives the contact a mechanical reaction without taking control away.
  const side = Math.cos(ship.rotation) * ny - Math.sin(ship.rotation) * nx;
  ship.angularVelocity += Math.max(-0.025, Math.min(0.025, side * closing * 0.004));
  asteroid.vel.x -= nx * impulse * 0.045 / Math.max(0.6, (asteroid.radius / 18) ** 2);
  asteroid.vel.y -= ny * impulse * 0.045 / Math.max(0.6, (asteroid.radius / 18) ** 2);
  return { normal: { x: nx, y: ny }, severity, damageScale: 0.42 + severity * 0.83,
    pos: contactPos };
}
