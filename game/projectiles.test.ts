import { describe, expect, it, vi } from 'vitest';
import { BULLET_DAMAGE, BULLET_LIFE, BULLET_RATE, BULLET_SPEED, MAX_BULLETS } from '../constants';
import { compactEntities } from './engine';
import type { Bullet } from '../types';
import { advanceProjectiles, findProjectileHit, PlayerWeapon, resolveProjectileHits, retireProjectiles } from './projectiles';
import { makeAsteroid, makeBullet, makeShard, makeShip } from './testFixtures';

const bounds = { width: 800, height: 600 };

describe('player weapon', () => {
  it('fires twin rounds from separate physical mounts after rotating the hull', () => {
    const ship = makeShip(), weapon = new PlayerWeapon(), bullets: Bullet[] = [], fired = vi.fn();
    ship.stats.multishotTier = 1; ship.rotation = Math.PI / 2;
    for (let i = 0; i < BULLET_RATE; i++) weapon.step(ship, bullets, () => 0.5, fired);
    expect(bullets.map(b => b.pos.x).sort((a, b) => a - b)).toEqual([95.66, 104.34]);
    for (const bullet of bullets) expect(bullet.pos.y).toBeCloseTo(113.9552);
    expect(fired).toHaveBeenCalledTimes(2);
    expect(ship.vel.y).toBeLessThan(0); // Physical firing recoil opposes the barrels.
  });

  it('never reduces total volley damage when adding or reinforcing a battery', () => {
    let previous = 0;
    for (let tier = 0; tier <= 20; tier++) {
      const ship = makeShip(), weapon = new PlayerWeapon(), bullets: Bullet[] = [];
      ship.stats.multishotTier = tier;
      for (let i = 0; i < BULLET_RATE; i++) weapon.step(ship, bullets, () => 0.5);
      const damage = bullets.reduce((sum, b) => sum + b.damage, 0);
      expect(damage).toBeGreaterThan(previous);
      expect(bullets.length).toBeLessThanOrEqual(8);
      expect(bullets.every(b => b.damage >= BULLET_DAMAGE * 0.8)).toBe(true);
      previous = damage;
    }
  });
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

  it.each([[0, 1], [1, 2], [2, 3], [3, 4], [8, 8]])('equips tier %i as %i physical cannons without splitting away their damage', (tier, count) => {
    const weapon = new PlayerWeapon(), ship = makeShip(), bullets: Bullet[] = [];
    ship.stats.multishotTier = tier;
    ship.stats.ricochetTier = 2;
    for (let i = 0; i < BULLET_RATE; i++) weapon.step(ship, bullets, () => 0.5);
    expect(bullets).toHaveLength(count);
    expect(bullets.reduce((total, b) => total + b.damage, 0)).toBeCloseTo(BULLET_DAMAGE * (tier === 0 ? 1 : 0.8 * count * (tier > 7 ? 1 + (tier - 7) * 0.08 : 1)));
    expect(bullets.every(b => b.bouncesRemaining === 2)).toBe(true);
    expect(bullets[0].angle).toBeCloseTo(-bullets.at(-1)!.angle);
  });

  it('keeps the minimum four-tick cooldown at extreme fire-rate upgrades', () => {
    const weapon = new PlayerWeapon(), ship = makeShip(), bullets: Bullet[] = [];
    ship.stats.fireRateMult = 0.001;
    for (let i = 0; i < 20; i++) weapon.step(ship, bullets, () => 0.5);
    expect(bullets).toHaveLength(5);
  });

  it('keeps an eight-cannon rail battery in flight without silently capping its range', () => {
    const ship = makeShip(), weapon = new PlayerWeapon(), bullets: Bullet[] = [];
    ship.stats.multishotTier = 7; ship.stats.fireRateMult = 0.001; ship.stats.rangeTier = 6;
    let peak = 0;
    for (let i = 0; i < 360; i++) {
      weapon.step(ship, bullets, () => 0.5);
      advanceProjectiles(bullets, { width: 100000, height: 100000 });
      retireProjectiles(bullets);
      const live = bullets.filter(b => !b.toBeRemoved).length;
      compactEntities(bullets, MAX_BULLETS);
      expect(bullets.length).toBe(live);
      peak = Math.max(peak, live);
    }
    expect(peak).toBeGreaterThan(100);
    expect(peak).toBeLessThanOrEqual(MAX_BULLETS);
  });
});

describe('projectile lifecycle and impacts', () => {
  it('passes through empty space inside a fragment bounding circle', () => {
    const b = makeBullet(), a = makeAsteroid('triangle', 50, 30);
    a.vertices = [{ x: -20, y: -10 }, { x: 20, y: -10 }, { x: 0, y: 20 }];
    b.pos.y = 80;
    advanceProjectiles([b], bounds);
    expect(findProjectileHit(b, [a], [])).toBeNull();
  });

  it('localizes contacts against rotated polygon surfaces', () => {
    const b = makeBullet(), a = makeAsteroid('slab', 50, 21);
    a.vertices = [{ x: -20, y: -3 }, { x: 20, y: -3 }, { x: 20, y: 3 }, { x: -20, y: 3 }];
    a.rotation = Math.PI / 2; b.pos.y = 110;
    advanceProjectiles([b], bounds);
    const hit = findProjectileHit(b, [a], []);
    expect(hit?.fraction).toBeCloseTo(0.46);
  });
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
