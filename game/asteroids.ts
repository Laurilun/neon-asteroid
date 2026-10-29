import type { Asteroid, Bullet, Vector } from '../types';
import { EntityType } from '../types';
import { fracturePolygon, localToWorld, rockPolygon, type PolygonPiece } from './geometry';

export function createRockGeometry(radius: number, sides: number, type: EntityType, random: () => number = Math.random): Vector[] {
  if (type === EntityType.IronAsteroid || type === EntityType.TungstenAsteroid) {
    const outline = type === EntityType.IronAsteroid ?
      [[0.96, -0.08], [0.48, -0.58], [-0.34, -0.66], [-0.84, -0.24], [-0.68, 0.49], [0.24, 0.64]] :
      [[0.78, -0.46], [0.22, -0.89], [-0.51, -0.71], [-0.88, -0.22], [-0.73, 0.58], [-0.15, 0.86], [0.64, 0.58], [0.9, 0.02]];
    return outline.map(([x, y]) => { const scale = radius * (0.92 + random() * 0.08); return { x: x * scale, y: y * scale }; });
  }
  const vertices = rockPolygon(radius, type === EntityType.FrozenAsteroid ? 8 : sides, random);
  if (type === EntityType.FrozenAsteroid) return vertices.map((v, i) => ({ x: v.x * (i % 2 ? 0.75 : 1), y: v.y * (i % 2 ? 0.75 : 1) }));
  return vertices;
}

export function materialDensity(type: EntityType): number {
  return type === EntityType.TungstenAsteroid ? 3.8 : type === EntityType.IronAsteroid ? 2.6 :
    type === EntityType.FrozenAsteroid ? 0.8 : 1;
}

export function asteroidMass(asteroid: Pick<Asteroid, 'radius' | 'type'>): number {
  return Math.max(0.45, (asteroid.radius / 18) ** 2 * materialDensity(asteroid.type));
}

/** Momentum and localized damage data are simulation state; visuals only read it. */
export function applyProjectileImpulse(asteroid: Asteroid, bullet: Bullet): void {
  const speed = Math.hypot(bullet.vel.x, bullet.vel.y) || 1;
  const direction = { x: bullet.vel.x / speed, y: bullet.vel.y / speed };
  const impulse = Math.min(0.65, bullet.damage * 0.022 / asteroidMass(asteroid));
  asteroid.vel.x += direction.x * impulse;
  asteroid.vel.y += direction.y * impulse;
  asteroid.impactDirection = direction;
  const dx = bullet.pos.x + direction.x * bullet.radius - asteroid.pos.x;
  const dy = bullet.pos.y + direction.y * bullet.radius - asteroid.pos.y;
  const cos = Math.cos(asteroid.rotation), sin = Math.sin(asteroid.rotation);
  const local = { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
  asteroid.rotationSpeed += Math.max(-0.003, Math.min(0.003,
    (dx * direction.y - dy * direction.x) * impulse / (asteroid.radius * asteroid.radius)));
  const scars = asteroid.scars ?? (asteroid.scars = []);
  scars.push({ pos: local, angle: Math.atan2(direction.y, direction.x) - asteroid.rotation,
    strength: Math.min(1, bullet.damage / Math.max(1, asteroid.maxHp) * 4) });
  if (scars.length > 7) scars.shift();
}

export interface BreakupPiece extends PolygonPiece { pos: Vector; vel: Vector; rotation: number; rotationSpeed: number }
/** Exact clipped geometry, inherited translation and tangential rotation. */
export function breakupAsteroid(asteroid: Asteroid, count: number): BreakupPiece[] {
  const impact = asteroid.impactDirection ?? { x: Math.cos(asteroid.rotation), y: Math.sin(asteroid.rotation) };
  const cut = Math.atan2(impact.y, impact.x) - asteroid.rotation + Math.PI / 2;
  const pieces = fracturePolygon(asteroid.vertices, count, cut);
  return pieces.map((piece, i) => {
    const offset = localToWorld(piece.center, { x: 0, y: 0 }, asteroid.rotation);
    const distance = Math.hypot(offset.x, offset.y) || 1;
    const separation = 0.55 + Math.min(0.7, asteroid.radius / 100);
    return { ...piece,
      pos: { x: asteroid.pos.x + offset.x, y: asteroid.pos.y + offset.y },
      vel: { x: asteroid.vel.x + offset.x / distance * separation - offset.y * asteroid.rotationSpeed + impact.x * 0.12,
        y: asteroid.vel.y + offset.y / distance * separation + offset.x * asteroid.rotationSpeed + impact.y * 0.12 },
      rotation: asteroid.rotation,
      rotationSpeed: asteroid.rotationSpeed + (i % 2 === 0 ? -1 : 1) * 0.008 / Math.max(1, piece.radius / 18),
    };
  });
}
