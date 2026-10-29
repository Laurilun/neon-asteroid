import {
  BULLET_DAMAGE, BULLET_LIFE, BULLET_RADIUS, BULLET_RATE, BULLET_SPEED,
  COLORS, HIT_FLASH_FRAMES, UPGRADE_RANGE_MULT,
} from '../constants';
import { EntityType } from '../types';
import type { Asteroid, Bullet, Ship, ShipStats, TungstenShard } from '../types';
import { advancePeriodicTimer } from './engine';
import { segmentCircleHit, sweptCirclePolygonHit } from './collision';
import type { Bounds } from './movement';
import { localToWorld, weaponMounts } from './geometry';
import { applyProjectileImpulse } from './asteroids';

type Random = () => number;

export const weaponInterval = (stats: ShipStats): number => Math.max(4, Math.floor(BULLET_RATE * stats.fireRateMult));
export const cannonDamage = (stats: ShipStats): number => BULLET_DAMAGE *
  (weaponMounts(stats.multishotTier).length === 1 ? 1 : 0.8) * stats.damageMult *
  (1 + Math.max(0, stats.multishotTier - 7) * 0.08);

/** Owns the player's cooldown and volley rules. Randomness is injectable for tests. */
export class PlayerWeapon {
  private timer = 0;
  reset(): void { this.timer = 0; }

  step(ship: Ship, bullets: Bullet[], random: Random = Math.random, onFire?: (bullet: Bullet) => void): boolean {
    if (ship.toBeRemoved) return false;
    const stats = ship.stats;
    const tick = advancePeriodicTimer(this.timer, 1, weaponInterval(stats));
    this.timer = tick.timer;
    if (!tick.elapsed) return false;
    const mounts = weaponMounts(stats.multishotTier);
    // Adding a barrel keeps 80% of a full cannon's damage, instead of dividing
    // the old volley into weaker specks. Beyond the readable battery cap, reinforce it.
    const damage = cannonDamage(stats);
    for (const mount of mounts) {
      const life = BULLET_LIFE * (1 + stats.rangeTier * UPGRADE_RANGE_MULT) + random() * 6 - 3;
      const angle = ship.rotation + mount.angle + (random() - 0.5) * 0.006;
      const bullet: Bullet = {
        id: random().toString(), type: EntityType.Bullet,
        pos: localToWorld(mount, ship.pos, ship.rotation, ship.radius),
        vel: { x: Math.cos(angle) * BULLET_SPEED + ship.vel.x * 0.2, y: Math.sin(angle) * BULLET_SPEED + ship.vel.y * 0.2 },
        radius: BULLET_RADIUS, angle, color: COLORS.BULLET, toBeRemoved: false,
        life, damage, bouncesRemaining: stats.ricochetTier, mountId: mount.id, powerTier: stats.rangeTier,
      };
      bullets.push(bullet);
      onFire?.(bullet);
    }
    const recoil = 0.025 * Math.sqrt(mounts.length);
    ship.vel.x -= Math.cos(ship.rotation) * recoil;
    ship.vel.y -= Math.sin(ship.rotation) * recoil;
    return true;
  }
}

/** Record the swept segment; defer expiry until its final segment has collided. */
export function advanceProjectiles(bullets: Bullet[], bounds: Bounds): void {
  for (const b of bullets) {
    if (b.toBeRemoved) continue;
    if (b.life <= 0 || b.pos.x < 0 || b.pos.x > bounds.width || b.pos.y < 0 || b.pos.y > bounds.height) {
      b.toBeRemoved = true;
      continue;
    }
    if (b.previousPos) { b.previousPos.x = b.pos.x; b.previousPos.y = b.pos.y; }
    else b.previousPos = { ...b.pos };
    if (!b.trail) b.trail = [];
    if (b.trail) {
      b.trail.push({ ...b.pos });
      if (b.trail.length > (b.isRicochet ? 8 : 4)) b.trail.shift();
    }
    let travel = Math.min(1, b.life);
    if (b.vel.x > 0) travel = Math.min(travel, (bounds.width - b.pos.x) / b.vel.x);
    if (b.vel.x < 0) travel = Math.min(travel, -b.pos.x / b.vel.x);
    if (b.vel.y > 0) travel = Math.min(travel, (bounds.height - b.pos.y) / b.vel.y);
    if (b.vel.y < 0) travel = Math.min(travel, -b.pos.y / b.vel.y);
    b.pos.x += b.vel.x * travel;
    b.pos.y += b.vel.y * travel;
    b.life = travel < 1 ? 0 : b.life - 1;
  }
}

export type ProjectileImpact = { bullet: Bullet; destroyed: boolean; fraction: number } & (
  { kind: 'shard'; target: TungstenShard } | { kind: 'asteroid'; target: Asteroid }
);

/** First contact wins; shards win exact ties so their defensive hitbox still blocks.
 * Targets use their current tick position. Full relative-motion CCD is deferred.
 */
export function findProjectileHit(b: Bullet, asteroids: Asteroid[], shards: TungstenShard[]): ProjectileImpact | null {
  let nearest = Infinity;
  let hit: ProjectileImpact | null = null;
  const start = b.previousPos ?? b.pos;
  for (const shard of shards) {
    if (shard.toBeRemoved) continue;
    const t = segmentCircleHit(start, b.pos, shard.pos, shard.collisionRadius + b.radius);
    if (t !== null && t < nearest) {
      nearest = t;
      hit = { kind: 'shard', target: shard, bullet: b, destroyed: false, fraction: t };
    }
  }
  const source = b.hitChainIds?.[b.hitChainIds.length - 1];
  for (const asteroid of asteroids) {
    if (asteroid.toBeRemoved || asteroid.id === source) continue;
    let t = segmentCircleHit(start, b.pos, asteroid.pos, asteroid.radius + b.radius);
    if (t !== null && asteroid.vertices.length >= 3) {
      const cos = Math.cos(asteroid.rotation), sin = Math.sin(asteroid.rotation);
      const transform = (p: { x: number; y: number }) => ({
        x: (p.x - asteroid.pos.x) * cos + (p.y - asteroid.pos.y) * sin,
        y: -(p.x - asteroid.pos.x) * sin + (p.y - asteroid.pos.y) * cos,
      });
      t = sweptCirclePolygonHit(transform(start), transform(b.pos), asteroid.vertices, b.radius);
    }
    if (t !== null && t < nearest) {
      nearest = t;
      hit = { kind: 'asteroid', target: asteroid, bullet: b, destroyed: false, fraction: t };
    }
  }
  return hit;
}

function spawnRicochet(b: Bullet, source: Asteroid, asteroids: Asteroid[], bullets: Bullet[], stats: ShipStats, random: Random): void {
  if (b.bouncesRemaining <= 0) return;
  // Preserve the existing ricochet range and ability to revisit older chain members.
  const life = BULLET_LIFE * (1 + stats.rangeTier * UPGRADE_RANGE_MULT) * 0.7;
  const range = life * BULLET_SPEED;
  // Reservoir sampling chooses uniformly without allocating a target array.
  let target: Asteroid | null = null;
  let count = 0;
  for (const other of asteroids) {
    if (other === source || other.toBeRemoved) continue;
    if (Math.hypot(b.pos.x - other.pos.x, b.pos.y - other.pos.y) - other.radius < range) {
      if (random() * ++count < 1) target = other;
    }
  }
  if (!target) return;
  const angle = Math.atan2(target.pos.y - b.pos.y, target.pos.x - b.pos.x);
  const depth = (b.bounceDepth ?? 0) + 1;
  const colors = ['#ffffff', '#e0ffff', '#b0ffff', '#80ffff', '#00ffff'];
  bullets.push({
    id: random().toString(), type: EntityType.Bullet, pos: { ...b.pos },
    vel: { x: Math.cos(angle) * BULLET_SPEED, y: Math.sin(angle) * BULLET_SPEED },
    radius: Math.max(1, b.radius * 0.85), angle, color: colors[Math.min(depth, colors.length - 1)],
    toBeRemoved: false, life, damage: b.damage * 0.5, bouncesRemaining: b.bouncesRemaining - 1,
    hitChainIds: [...(b.hitChainIds ?? []), source.id], isRicochet: true,
    bounceDepth: depth, trail: [{ ...b.pos }],
    powerTier: b.powerTier,
  });
}

/** Owns damage, consumption, shard parent links, and deferred ricochet creation.
 * Hooks expose presentation and the still-integrated asteroid death/loot system.
 */
export function resolveProjectileHits(
  bullets: Bullet[], asteroids: Asteroid[], shards: TungstenShard[], stats: ShipStats,
  onImpact: (impact: ProjectileImpact) => void, onAsteroidDestroyed: (asteroid: Asteroid) => void,
  random: Random = Math.random,
): void {
  const count = bullets.length; // New ricochets start simulating on the next tick.
  for (let i = 0; i < count; i++) {
    const b = bullets[i];
    if (b.toBeRemoved) continue;
    const hit = findProjectileHit(b, asteroids, shards);
    if (!hit) continue;
    const start = b.previousPos ?? b.pos;
    b.pos.x = start.x + (b.pos.x - start.x) * hit.fraction;
    b.pos.y = start.y + (b.pos.y - start.y) * hit.fraction;
    b.toBeRemoved = true;
    hit.target.hp -= b.damage;
    hit.target.hitFlash = HIT_FLASH_FRAMES;
    if (hit.kind === 'asteroid') applyProjectileImpulse(hit.target, b);
    hit.destroyed = hit.target.hp <= 0;
    if (hit.kind === 'shard' && hit.destroyed) {
      hit.target.toBeRemoved = true;
      const parent = asteroids.find(a => a.id === hit.target.parentId);
      if (parent?.shardIds) parent.shardIds = parent.shardIds.filter(id => id !== hit.target.id);
    }
    if (hit.kind === 'asteroid') spawnRicochet(b, hit.target, asteroids, bullets, stats, random);
    onImpact(hit);
    if (hit.kind === 'asteroid' && hit.destroyed) onAsteroidDestroyed(hit.target);
  }
}

export function retireProjectiles(bullets: Bullet[]): void {
  for (const b of bullets) if (b.life <= 0) b.toBeRemoved = true;
}
