import { describe, expect, it, vi } from 'vitest';
import { EntityType } from '../types';
import { EFFECT_CAP, FeelResponses } from './feel';
import { makeAsteroid, makeBullet, makeShip } from './testFixtures';
import { fractureAsteroid, fracturePolygon, pieceMotion, polygonArea, rockOutline } from './fracture';
import { createLabTargets, DEFAULT_LAB, equipLabShip } from './lab';
import { checkShipCollision, segmentPolygonHit, shipContact } from './collision';
import { advanceProjectiles, resolveProjectileHits } from './projectiles';
import { SimulationClock } from './engine';
import { stepShipMovement } from './movement';
import { drawGunship, drawRock, drawRound, drawResponses } from './rendering';

const square = [{ x: -30, y: -30 }, { x: 30, y: -30 }, { x: 30, y: 30 }, { x: -30, y: 30 }];
describe('real polygon fracture', () => {
  it.each([2, 3, 5])('conserves area across %i pieces and retains the original world outline', count => {
    const parent = makeAsteroid('parent', 100, 45);
    parent.vertices = square; parent.rotation = .7; parent.vel = { x: 2, y: -1 };
    const pieces = fracturePolygon(square, count, .2);
    expect(pieces).toHaveLength(count);
    expect(pieces.reduce((area, piece) => area + piece.area, 0)).toBeCloseTo(polygonArea(square));
    for (const piece of pieces) {
      expect(piece.radius).toBeGreaterThan(0);
      const motion = pieceMotion(parent, piece, 0);
      expect(motion.vel).toEqual(parent.vel);
      for (const vertex of piece.vertices) {
        expect(Math.abs(vertex.x + piece.center.x)).toBeLessThanOrEqual(30.000001);
        expect(Math.abs(vertex.y + piece.center.y)).toBeLessThanOrEqual(30.000001);
      }
    }
  });
  it('recursively fractures offset polygons without missing material or making NaNs', () => {
    const rock = createLabTargets({ width: 1280, height: 720 }, { ...DEFAULT_LAB, size: 4 })[0];
    const pieces = fracturePolygon(rock.vertices, 3, 1.7);
    for (const piece of pieces) {
      const children = fracturePolygon(piece.vertices, 2, .33);
      expect(children.reduce((area, child) => area + child.area, 0)).toBeCloseTo(piece.area);
      expect(children.every(c => Number.isFinite(c.radius))).toBe(true);
    }
    expect(fracturePolygon([], 2, 0)).toEqual([]);
  });
  it('inherits parent angular velocity as tangential fragment motion', () => {
    const parent = makeAsteroid(); parent.rotationSpeed = .1;
    const piece = fracturePolygon(square, 2, 0)[0];
    const result = pieceMotion(parent, piece, 0);
    expect(result.vel.x).toBeCloseTo(-piece.center.y * .1);
    expect(result.vel.y).toBeCloseTo(piece.center.x * .1);
  });
  it('keeps surface features anchored to the same parent through successive gameplay splits', () => {
    const rock = makeAsteroid(); rock.vertices = square; rock.sizeCategory = 3; rock.scars = [{ x: 10, y: 5 }];
    const children = fractureAsteroid(rock, 30);
    expect(children).toHaveLength(2);
    for (const child of children) {
      expect(child.surface!.vertices).toBe(square);
      expect(child.scars![0].x + child.surface!.offset.x).toBeCloseTo(10);
      expect(child.scars![0].y + child.surface!.offset.y).toBeCloseTo(5);
      for (const grandchild of fractureAsteroid(child, 15)) {
        expect(grandchild.surface!.vertices).toBe(square);
        expect(grandchild.scars![0].x + grandchild.surface!.offset.x).toBeCloseTo(10);
        expect(grandchild.scars![0].y + grandchild.surface!.offset.y).toBeCloseTo(5);
        expect(fractureAsteroid(grandchild, 1)).toEqual([]);
      }
    }
  });
  it('materials have distinct bounded silhouettes instead of palette swaps', () => {
    const types = [EntityType.Asteroid, EntityType.MoltenAsteroid, EntityType.FrozenAsteroid, EntityType.IronAsteroid, EntityType.TungstenAsteroid];
    const outlines = types.map(type => rockOutline(50, 12, type, () => .5));
    expect(new Set(outlines.map(outline => JSON.stringify(outline))).size).toBe(5);
    expect(outlines.flat().every(v => Math.hypot(v.x, v.y) <= 50)).toBe(true);
  });
});

describe('physical contacts', () => {
  it('sweeps against cut edges rather than hitting the empty part of a bounding circle', () => {
    const narrow = [{ x: -2, y: -30 }, { x: 2, y: -30 }, { x: 2, y: 30 }, { x: -2, y: 30 }];
    expect(segmentPolygonHit({ x: -100, y: 0 }, { x: 100, y: 0 }, narrow, 1)).toBeCloseTo(.485);
    expect(segmentPolygonHit({ x: 20, y: -100 }, { x: 20, y: 100 }, narrow, 1)).toBeNull();
    expect(segmentPolygonHit({ x: 0, y: 0 }, { x: 0, y: 0 }, narrow, 1)).toBe(0);
    expect(segmentPolygonHit({ x: 3, y: -10 }, { x: 3, y: 10 }, narrow, 1)).toBe(0);
  });
  it('ship collision follows a rotated fragment cut face', () => {
    const ship = makeShip(); const rock = makeAsteroid('cut', 100, 80);
    rock.vertices = [{ x: 40, y: -20 }, { x: 70, y: -20 }, { x: 70, y: 20 }, { x: 40, y: 20 }];
    expect(checkShipCollision(ship, rock)).toBe(false);
    rock.pos.x = 50;
    expect(checkShipCollision(ship, rock)).toBe(true);
    rock.rotation = Math.PI / 2;
    expect(checkShipCollision(ship, rock)).toBe(false);
  });
  it('head-on contacts are stronger than glancing contacts, with finite coincident centers', () => {
    const ship = makeShip(), rock = makeAsteroid('rock', 150, 40);
    ship.vel = { x: 6, y: 0 }; const headOn = shipContact(ship, rock);
    ship.vel = { x: .1, y: 6 }; const glancing = shipContact(ship, rock);
    expect(headOn.severity).toBeGreaterThan(glancing.severity * 2);
    expect(headOn.normal).toEqual({ x: -1, y: 0 });
    rock.pos = { ...ship.pos };
    expect(Number.isFinite(shipContact(ship, rock).normal.x)).toBe(true);
  });
  it('small rocks receive larger impulses and only five stable scars survive repeated hits', () => {
    const ship = makeShip(), small = makeAsteroid('small', 50, 10), large = makeAsteroid('large', 50, 70);
    for (const target of [small, large]) {
      target.hp = 1000;
      for (let i = 0; i < 8; i++) {
        const bullet = makeBullet();
        advanceProjectiles([bullet], { width: 800, height: 600 });
        resolveProjectileHits([bullet], [target], [], ship.stats, () => {}, () => {});
      }
      expect(target.scars).toHaveLength(5);
    }
    expect(small.vel.x).toBeGreaterThan(large.vel.x * 5);
  });
});

describe('presentation budgets and timing', () => {
  const impact = { kind: 'impact' as const, pos: { x: 10, y: 10 }, direction: { x: 1, y: 0 }, power: 100, material: EntityType.IronAsteroid, ricochet: false };
  it('bounds dense impacts at creation, caps shake, expires everything and resets cleanly', () => {
    const feel = new FeelResponses();
    for (let i = 0; i < 2000; i++) feel.emit(impact, () => .5);
    expect(feel.effects).toHaveLength(EFFECT_CAP);
    feel.emit({ kind: 'collision', pos: impact.pos, direction: impact.direction, severity: 100 });
    expect(feel.shake).toBeLessThanOrEqual(5);
    for (let i = 0; i < 80; i++) feel.step();
    expect(feel.effects).toHaveLength(0);
    feel.reset(); expect(feel.shake).toBe(0); expect(feel.tick).toBe(0);
  });
  it('reduced effects changes decoration without changing simulation damage or motion', () => {
    const feel = new FeelResponses(); feel.reduced = true;
    for (let i = 0; i < 1000; i++) feel.emit(impact);
    expect(feel.effects.length).toBeLessThanOrEqual(90);
    const ship = makeShip(), original = structuredClone(ship);
    feel.emit({ kind: 'fired', ship });
    expect(ship.vel).toEqual(original.vel);
    expect(ship.stats).toEqual(original.stats);
    expect(ship.cannonRecoil).toBe(1);
    for (let i = 0; i < 10; i++) feel.step(ship);
    expect(ship.cannonRecoil).toBe(0);
  });
  it('uses a global near-miss cooldown rather than spamming close rocks', () => {
    const feel = new FeelResponses();
    for (let i = 0; i < 100; i++) feel.emit({ kind: 'nearMiss', pos: impact.pos, direction: impact.direction });
    expect(feel.effects).toHaveLength(1);
  });
  it('generates chunks from the actual parent and retires all breakup geometry', () => {
    const feel = new FeelResponses(), rock = makeAsteroid('parent', 100, 45); rock.vertices = square;
    feel.emit({ kind: 'fracture', rock, solidPieces: false }, () => .5);
    const pieces = feel.effects.filter(e => e.kind === 'chunk');
    expect(pieces.reduce((sum, e) => sum + polygonArea(e.vertices!), 0)).toBeCloseTo(polygonArea(square));
    for (let i = 0; i < 100; i++) feel.step();
    expect(feel.effects).toEqual([]);
  });
  it('produces identical handling and effect state at 30, 60 and 144 Hz', () => {
    const run = (hz: number) => {
      const ship = makeShip(), feel = new FeelResponses(), clock = new SimulationClock();
      for (let i = 0; i <= hz * 2; i++) clock.advance(i * 1000 / hz, true, () => {
        feel.step(ship); stepShipMovement(ship, { up: true, left: false, right: true }, { width: 800, height: 600 });
        if (feel.tick % 20 === 0) feel.emit(impact, () => .5);
      });
      return { ship, effects: feel.effects };
    };
    expect(run(30)).toEqual(run(60)); expect(run(144)).toEqual(run(60));
  });
  it('rendering uses no randomness and does not advance gameplay or effects', () => {
    const ctx = new Proxy({}, { get: () => () => {}, set: () => true }) as CanvasRenderingContext2D;
    const feel = new FeelResponses(), ship = makeShip(), bullet = makeBullet();
    const rocks = createLabTargets({ width: 1280, height: 720 }, DEFAULT_LAB);
    feel.emit(impact, () => .5); const before = JSON.stringify({ ship, bullet, rocks, feel });
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('render randomness'); });
    try {
      for (let i = 0; i < 3; i++) {
        drawGunship(ctx, ship, 10); rocks.forEach(rock => drawRock(ctx, rock, 10, false));
        drawRound(ctx, bullet); drawResponses(ctx, feel);
      }
      expect(JSON.stringify({ ship, bullet, rocks, feel })).toBe(before);
    } finally { random.mockRestore(); }
  });
});

describe('experiment lab', () => {
  it('makes repeatable destructible targets and immediately equips and removes upgrades', () => {
    const bounds = { width: 1280, height: 720 };
    expect(createLabTargets(bounds, DEFAULT_LAB)).toEqual(createLabTargets(bounds, DEFAULT_LAB));
    expect(createLabTargets(bounds, DEFAULT_LAB).every(a => Number.isFinite(a.hp) && a.hp > 0)).toBe(true);
    const ship = makeShip(); equipLabShip(ship, { ...DEFAULT_LAB, split: 6, rails: 3, cooling: 8, ricochet: 3 });
    expect(ship.stats.multishotTier).toBe(6); expect(ship.stats.damageMult).toBeGreaterThan(1);
    equipLabShip(ship, DEFAULT_LAB);
    expect(ship.stats.multishotTier).toBe(0); expect(ship.stats.damageMult).toBe(1); expect(ship.stats.fireRateMult).toBe(1);
  });
});
