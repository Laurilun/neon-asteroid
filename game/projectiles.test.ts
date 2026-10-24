import { describe, expect, it, vi } from 'vitest';
import { BULLET_DAMAGE, BULLET_LIFE, BULLET_RATE, BULLET_SPEED } from '../constants';
import type { Bullet } from '../types';
import { advanceProjectiles, findProjectileHit, PlayerWeapon, resolveProjectileHits, retireProjectiles } from './projectiles';
import { makeAsteroid, makeBullet, makeShard, makeShip } from './testFixtures';
import { batteryDamageMultiplier, cannonMounts, mountPosition } from './hardware';

const bounds = { width: 800, height: 600 };

describe('player weapon', () => {
  it('fires on its original cadence and snapshots range, velocity inheritance and damage', () => {
    const weapon = new PlayerWeapon(), ship = makeShip(), bullets: Bullet[] = [];
    ship.vel.x = 5;
    ship.stats.damageMult = 2;
    for (let i = 0; i < BULLET_RATE - 1; i++) expect(weapon.step(ship, bullets, () => 0.5)).toBe(false);
    expect(weapon.step(ship, bullets, () => 0.5)).toBe(true);
    expect(bullets).toHaveLength(1);
    expect(bullets[0].damage).toBe(BULLET_DAMAGE * 2);
    expect(bullets[0].vel.x).toBe(BULLET_SPEED + 1);
    expect(bullets[0].life).toBe(BULLET_LIFE);
    ship.stats.damageMult = 3;
    expect(bullets[0].damage).toBe(BULLET_DAMAGE * 2);
    weapon.reset();
    expect(weapon.step(ship, bullets)).toBe(false);
  });

  it.each([[0, 1], [1, 2], [2, 3], [3, 4], [6, 7], [8, 7]])('gives tier %i a legible battery of %i full-strength rounds', (tier, count) => {
    const weapon = new PlayerWeapon(), ship = makeShip(), bullets: Bullet[] = [];
    ship.stats.multishotTier = tier;
    ship.stats.ricochetTier = 2;
    for (let i = 0; i < BULLET_RATE; i++) weapon.step(ship, bullets, () => 0.5);
    expect(bullets).toHaveLength(count);
    expect(bullets.every(b => b.damage >= BULLET_DAMAGE)).toBe(true);
    expect(bullets.reduce((total, b) => total + b.damage, 0)).toBeCloseTo(BULLET_DAMAGE * count * batteryDamageMultiplier(tier));
    expect(bullets.every(b => b.bouncesRemaining === 2)).toBe(true);
    expect(bullets.every(b => b.angle === ship.rotation)).toBe(true);
    expect(new Set(bullets.map(b => b.pos.y)).size).toBe(count);
  });

  it.each([0, 1, 2, 6, 12])('fires from the rendered hardpoints at tier %i after rotation', tier => {
    const ship = makeShip(), weapon = new PlayerWeapon(), bullets: Bullet[] = [];
    ship.rotation = 1.234; ship.stats.multishotTier = tier;
    for (let i = 0; i < BULLET_RATE; i++) weapon.step(ship, bullets);
    for (const [i, mount] of cannonMounts(tier).entries()) {
      expect(bullets[i].pos).toEqual(mountPosition(ship, mount));
      expect(bullets[i].mountIndex).toBe(i);
    }
  });

  it('keeps the minimum four-tick cooldown at extreme fire-rate upgrades', () => {
    const weapon = new PlayerWeapon(), ship = makeShip(), bullets: Bullet[] = [];
    ship.stats.fireRateMult = 0.001;
    for (let i = 0; i < 20; i++) weapon.step(ship, bullets, () => 0.5);
    expect(bullets).toHaveLength(5);
  });
});

describe('projectile lifecycle and impacts', () => {
  it('hits a small target between endpoints exactly once, independent of array order', () => {
    const bullet = makeBullet(), near = makeAsteroid('near', 30), far = makeAsteroid('far', 60);
    const impact = vi.fn();
    advanceProjectiles([bullet], bounds);
    resolveProjectileHits([bullet], [far, near], [], makeShip().stats, impact, vi.fn());
    expect(near.hp).toBe(10);
    expect(far.hp).toBe(20);
    expect(bullet.pos.x).toBe(27);
    expect(bullet.toBeRemoved).toBe(true);
    expect(impact).toHaveBeenCalledTimes(1);
  });

  it('consumes one bullet against only one of several overlapping targets', () => {
    const bullet = makeBullet(), a = makeAsteroid('a'), b = makeAsteroid('b');
    advanceProjectiles([bullet], bounds);
    resolveProjectileHits([bullet], [a, b], [], makeShip().stats, vi.fn(), vi.fn());
    expect([a.hp, b.hp]).toEqual([10, 20]);
  });

  it('uses shard collisionRadius and blocks a target behind its defensive shell', () => {
    const bullet = makeBullet(), rock = makeAsteroid(), shard = makeShard();
    advanceProjectiles([bullet], bounds);
    resolveProjectileHits([bullet], [rock], [shard], makeShip().stats, vi.fn(), vi.fn());
    expect(shard.hp).toBe(10);
    expect(rock.hp).toBe(20);
    expect(bullet.pos.x).toBe(24);
  });

  it('does not let a more distant shard intercept a nearer asteroid', () => {
    const bullet = makeBullet(), rock = makeAsteroid('near', 20), shard = makeShard(80);
    advanceProjectiles([bullet], bounds);
    expect(findProjectileHit(bullet, [rock], [shard])?.target).toBe(rock);
  });

  it('gives defensive shards priority at equal contact time', () => {
    const bullet = makeBullet(), shard = makeShard(50), rock = makeAsteroid('rock', 50, shard.collisionRadius);
    advanceProjectiles([bullet], bounds);
    expect(findProjectileHit(bullet, [rock], [shard])?.kind).toBe('shard');
  });

  it('unlinks a destroyed shard from its parent and reports its death once', () => {
    const bullet = makeBullet(), parent = makeAsteroid('parent', 150), shard = makeShard();
    parent.shardIds = [shard.id, 'other'];
    shard.hp = 10;
    const impact = vi.fn();
    advanceProjectiles([bullet], bounds);
    resolveProjectileHits([bullet], [parent], [shard], makeShip().stats, impact, vi.fn());
    expect(shard.toBeRemoved).toBe(true);
    expect(parent.shardIds).toEqual(['other']);
    expect(impact.mock.calls[0][0].destroyed).toBe(true);
  });

  it('does not hit removed targets or the immediate ricochet source', () => {
    const bullet = makeBullet(), removed = makeAsteroid('removed', 20), source = makeAsteroid('source', 30), target = makeAsteroid('target', 60);
    removed.toBeRemoved = true;
    bullet.hitChainIds = ['older', 'source'];
    advanceProjectiles([bullet], bounds);
    expect(findProjectileHit(bullet, [removed, source, target], [])?.target).toBe(target);
  });

  it('defers new ricochets until the next tick, preserving chain damage and older revisits', () => {
    const bullet = makeBullet(), source = makeAsteroid('source', 30), target = makeAsteroid('target', 80);
    bullet.bouncesRemaining = 2;
    bullet.hitChainIds = ['target']; // Revisiting an older chain member is intentional.
    source.hp = 10;
    const bullets = [bullet], destroyed = vi.fn(a => { a.toBeRemoved = true; });
    advanceProjectiles(bullets, bounds);
    resolveProjectileHits(bullets, [source, target], [], makeShip().stats, vi.fn(), destroyed, () => 0.5);
    expect(destroyed).toHaveBeenCalledExactlyOnceWith(source);
    expect(target.hp).toBe(20);
    expect(bullets).toHaveLength(2);
    expect(bullets[1].damage).toBe(5);
    expect(bullets[1].bouncesRemaining).toBe(1);
    expect(bullets[1].hitChainIds).toEqual(['target', 'source']);
    expect(bullets[1].previousPos).toBeUndefined();
    advanceProjectiles(bullets, bounds);
    expect(bullets[1].previousPos).toBeDefined();
  });

  it('allows a final fractional lifetime segment to hit before retirement', () => {
    const bullet = makeBullet(), target = makeAsteroid('target', 20);
    bullet.life = 0.25;
    advanceProjectiles([bullet], bounds);
    expect(bullet.pos.x).toBe(25);
    expect(bullet.toBeRemoved).toBe(false);
    resolveProjectileHits([bullet], [target], [], makeShip().stats, vi.fn(), vi.fn());
    expect(target.hp).toBe(10);
    retireProjectiles([bullet]);
    expect(bullet.toBeRemoved).toBe(true);
  });

  it('clips the final segment to the screen boundary and does not wrap bullets', () => {
    const bullet = makeBullet(), target = makeAsteroid('outside', 850);
    bullet.pos.x = 790;
    advanceProjectiles([bullet], bounds);
    expect(bullet.pos.x).toBe(800);
    expect(findProjectileHit(bullet, [target], [])).toBeNull();
    retireProjectiles([bullet]);
    expect(bullet.toBeRemoved).toBe(true);
  });

  it('caps ricochet trails and ignores already removed or expired bullets', () => {
    const bullet = makeBullet();
    bullet.vel.x = 1;
    bullet.isRicochet = true;
    bullet.trail = [];
    for (let i = 0; i < 12; i++) advanceProjectiles([bullet], bounds);
    expect(bullet.trail).toHaveLength(8);
    expect(bullet.trail.at(-1)?.x).toBe(11);
    bullet.life = 0;
    advanceProjectiles([bullet], bounds);
    expect(bullet.toBeRemoved).toBe(true);
    expect(bullet.pos.x).toBe(12);
  });
});
