import type { Asteroid, Ship, Vector } from '../types';

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
  if (dx * dx + dy * dy > (ship.radius + hitRadius) ** 2) return false;
  const cos = Math.cos(ship.rotation), sin = Math.sin(ship.rotation);
  const point = (x: number, y: number): Vector => ({
    x: ship.pos.x + x * cos - y * sin,
    y: ship.pos.y + x * sin + y * cos,
  });
  return triangleCircleOverlap(
    point(ship.radius, 0), point(-ship.radius * 0.6, ship.radius * 0.75),
    point(-ship.radius * 0.6, -ship.radius * 0.75), asteroid.pos, hitRadius,
  );
}
