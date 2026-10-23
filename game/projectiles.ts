import {
  BULLET_DAMAGE, BULLET_LIFE, BULLET_RADIUS, BULLET_RATE, BULLET_SPEED,
  COLORS, HIT_FLASH_FRAMES, MULTISHOT_SPREAD, UPGRADE_RANGE_MULT,
} from '../constants';
import { EntityType } from '../types';
import type { Asteroid, Bullet, Ship, ShipStats, TungstenShard } from '../types';
import { advancePeriodicTimer } from './engine';
import { segmentCircleHit } from './collision';
import type { Bounds } from './movement';

type Random = () => number;

/** Owns the player's cooldown and volley rules. Randomness is injectable for tests. */
export class PlayerWeapon {
  private timer = 0;
  reset(): void { this.timer = 0; }

  step(ship: Ship, bullets: Bullet[], random: Random = Math.random): boolean {
    if (ship.toBeRemoved) return false;
    const stats = ship.stats;
    const tick = advancePeriodicTimer(this.timer, 1, Math.max(4, Math.floor(BULLET_RATE * stats.fireRateMult)));
    this.timer = tick.timer;
    if (!tick.elapsed) return false;
    const angles: number[] = [];
    if (stats.multishotTier === 0) angles.push(0);
    else if (stats.multishotTier === 1) angles.push(-MULTISHOT_SPREAD.DOUBLE, MULTISHOT_SPREAD.DOUBLE);
    else if (stats.multishotTier === 2) angles.push(-MULTISHOT_SPREAD.TRIPLE, 0, MULTISHOT_SPREAD.TRIPLE);
    else {
      const count = stats.multishotTier + 1;
      for (let i = 0; i < count; i++) {
        angles.push(-MULTISHOT_SPREAD.DYNAMIC_TOTAL / 2 + MULTISHOT_SPREAD.DYNAMIC_TOTAL * i / (count - 1));
      }
    }
    const damage = BULLET_DAMAGE * (1 + stats.multishotTier * 0.3) / angles.length * stats.damageMult;
    for (const offset of angles) {
      const life = BULLET_LIFE * (1 + stats.rangeTier * UPGRADE_RANGE_MULT) + random() * 6 - 3;
      const angle = ship.rotation + offset + (random() - 0.5) * 0.015;
      bullets.push({
        id: random().toString(), type: EntityType.Bullet,
        pos: { x: ship.pos.x + Math.cos(angle) * ship.radius, y: ship.pos.y + Math.sin(angle) * ship.radius },
        vel: { x: Math.cos(angle) * BULLET_SPEED + ship.vel.x * 0.2, y: Math.sin(angle) * BULLET_SPEED + ship.vel.y * 0.2 },
        radius: BULLET_RADIUS, angle, color: COLORS.BULLET, toBeRemoved: false,
        life, damage, bouncesRemaining: stats.ricochetTier,
      });
    }
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
    if (b.isRicochet && b.trail) {
      b.trail.push({ ...b.pos });
      if (b.trail.length > 8) b.trail.shift();
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
    const t = segmentCircleHit(start, b.pos, asteroid.pos, asteroid.radius + b.radius);
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
  const life = BULLET_LIFE * (1 + stats.rangeTier * 0.25) * 0.7;
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
