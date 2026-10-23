import { describe, expect, it } from 'vitest';
import { fracturePolygon, localToWorld, polygonArea, rockPolygon, seededRandom, weaponMounts } from './geometry';
import { applyProjectileImpulse, breakupAsteroid, createRockGeometry } from './asteroids';
import { makeAsteroid, makeBullet, makeShip } from './testFixtures';
import { checkShipCollision, polygonsOverlap, shipContactResponse, sweptCirclePolygonHit } from './collision';
import { EntityType } from '../types';

describe('material geometry and breakup', () => {
  it.each([2, 3, 7])('conserves the polygon area across %i clipped pieces', count => {
    const parent = rockPolygon(70, 14, seededRandom(42)), pieces = fracturePolygon(parent, count, 0.42);
    expect(pieces).toHaveLength(count);
    expect(pieces.reduce((sum, piece) => sum + piece.area, 0)).toBeCloseTo(polygonArea(parent), 6);
    for (const piece of pieces) {
      expect(piece.vertices.length).toBeGreaterThanOrEqual(3);
      expect(piece.radius).toBeGreaterThan(0);
      expect(polygonArea(piece.vertices)).toBeCloseTo(piece.area);
    }
  });

  it('preserves world-space boundary placement and inherited motion at fracture time', () => {
    const a = makeAsteroid('parent', 100, 60);
    a.vertices = rockPolygon(60, 12, seededRandom(7)); a.rotation = 0.8; a.rotationSpeed = 0.01; a.vel = { x: 2, y: -1 };
    const pieces = breakupAsteroid(a, 2);
    const area = pieces.reduce((sum, p) => sum + p.area, 0);
    const weighted = pieces.reduce((sum, p) => ({ x: sum.x + p.pos.x * p.area / area, y: sum.y + p.pos.y * p.area / area }), { x: 0, y: 0 });
    // Reconstructed centers preserve the original polygon centroid (not necessarily its circle center).
    const original = fracturePolygon(a.vertices, 1, 0)[0];
    const center = localToWorld(original.center, a.pos, a.rotation);
    expect(weighted.x).toBeCloseTo(center.x);
    expect(weighted.y).toBeCloseTo(center.y);
    expect(pieces[0].vel).not.toEqual(pieces[1].vel);
    expect(pieces.every(p => Math.hypot(p.vel.x - a.vel.x, p.vel.y - a.vel.y) < 3)).toBe(true);
  });

  it('uses distinct deterministic material silhouettes, all bounded by their gameplay radius', () => {
    const types = [EntityType.Asteroid, EntityType.FrozenAsteroid, EntityType.IronAsteroid, EntityType.TungstenAsteroid];
    const shapes = types.map(type => createRockGeometry(50, 12, type, seededRandom(9)));
    expect(new Set(shapes.map(shape => JSON.stringify(shape))).size).toBe(types.length);
    for (const shape of shapes) for (const v of shape) expect(Math.hypot(v.x, v.y)).toBeLessThanOrEqual(50);
    expect(shapes[0]).toEqual(createRockGeometry(50, 12, types[0], seededRandom(9)));
  });

  it('moves small rocks more than large dense rocks and bounds persistent scars', () => {
    const small = makeAsteroid('small', 50, 18), dense = makeAsteroid('dense', 50, 80), bullet = makeBullet();
    dense.type = EntityType.TungstenAsteroid;
    bullet.pos.x = 30;
    applyProjectileImpulse(small, bullet); applyProjectileImpulse(dense, bullet);
    expect(small.vel.x).toBeGreaterThan(dense.vel.x * 10);
    for (let i = 0; i < 30; i++) applyProjectileImpulse(small, bullet);
    expect(small.scars).toHaveLength(7);
    expect(small.impactDirection).toEqual({ x: 1, y: 0 });
  });
});

describe('aligned hull and contact physics', () => {
  it('includes visible side armor and excludes empty fragment corners', () => {
    const ship = makeShip(), a = makeAsteroid('side', 92, 1);
    a.pos.y = 109;
    expect(checkShipCollision(ship, a)).toBe(true);
    a.pos = { x: 100, y: 70 }; a.radius = 30;
    a.vertices = [{ x: -20, y: -5 }, { x: 20, y: -5 }, { x: 0, y: 10 }];
    expect(checkShipCollision(ship, a)).toBe(false);
  });

  it('retains glancing tangential motion and makes head-on contact more severe', () => {
    const head = makeShip(), glance = makeShip(), a = makeAsteroid('a', 130, 40), b = makeAsteroid('b', 130, 40);
    head.vel.x = 6; glance.vel.y = 6;
    const hard = shipContactResponse(head, a), soft = shipContactResponse(glance, b);
    expect(hard.severity).toBeGreaterThan(soft.severity);
    expect(hard.damageScale).toBeGreaterThan(soft.damageScale * 2);
    expect(glance.vel.y).toBe(6);
    expect(Number.isFinite(head.angularVelocity)).toBe(true);
  });

  it('uses the contacted fracture edge normal rather than the parent center direction', () => {
    const ship = makeShip(), a = makeAsteroid('slab', 100, 30);
    a.vertices = [{ x: -25, y: -5 }, { x: 25, y: -5 }, { x: 25, y: 5 }, { x: -25, y: 5 }];
    ship.pos = { x: 115, y: 92 }; ship.vel = { x: 4, y: 3 };
    const contact = shipContactResponse(ship, a);
    expect(contact.normal.x).toBeCloseTo(0); expect(contact.normal.y).toBeCloseTo(-1);
    expect(contact.pos).toEqual({ x: 115, y: 95 });
    expect(ship.vel.x).toBe(4);
    expect(ship.vel.y).toBeLessThan(3);
  });

  it('handles containment, edge contact and separation for polygon pairs', () => {
    const square = [{ x: -5, y: -5 }, { x: 5, y: -5 }, { x: 5, y: 5 }, { x: -5, y: 5 }];
    expect(polygonsOverlap(square, square.map(v => ({ x: v.x * 0.5, y: v.y * 0.5 })))).toBe(true);
    expect(polygonsOverlap(square, square.map(v => ({ x: v.x + 10, y: v.y })))).toBe(true);
    expect(polygonsOverlap(square, square.map(v => ({ x: v.x + 11, y: v.y })))).toBe(false);
    expect(sweptCirclePolygonHit({ x: -10, y: 7 }, { x: 10, y: 7 }, square, 1)).toBeNull();
    expect(sweptCirclePolygonHit({ x: 0, y: 0 }, { x: 0, y: 0 }, square, 1)).toBe(0);
  });

  it('caches a bounded, symmetric battery layout even at extreme upgrade tiers', () => {
    expect(weaponMounts(100)).toBe(weaponMounts(7));
    expect(weaponMounts(100)).toHaveLength(8);
    expect(weaponMounts(0)).toHaveLength(1);
    expect(weaponMounts(7).reduce((sum, mount) => sum + mount.y, 0)).toBeCloseTo(0);
  });
});
