import { describe, expect, it } from 'vitest';
import { checkShipCollision, segmentCircleHit, triangleCircleOverlap } from './collision';
import { makeAsteroid, makeShip } from './testFixtures';

describe('swept circle geometry', () => {
  it('catches a small target between distant projectile endpoints', () => {
    expect(segmentCircleHit({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, 2)).toBeCloseTo(0.48);
  });
  it('includes tangency and both segment endpoints', () => {
    expect(segmentCircleHit({ x: 0, y: 2 }, { x: 100, y: 2 }, { x: 50, y: 0 }, 2)).toBe(0.5);
    expect(segmentCircleHit({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 12, y: 0 }, 2)).toBe(1);
    expect(segmentCircleHit({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: -2, y: 0 }, 2)).toBe(0);
  });
  it('handles stationary and initially overlapping projectiles', () => {
    expect(segmentCircleHit({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 2)).toBe(0);
    expect(segmentCircleHit({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, 2)).toBeNull();
  });
  it('rejects near misses, targets behind the projectile, and beyond its endpoint', () => {
    const start = { x: 0, y: 0 }, end = { x: 10, y: 0 };
    for (const pos of [{ x: 5, y: 2.01 }, { x: -3, y: 0 }, { x: 13, y: 0 }]) {
      expect(segmentCircleHit(start, end, pos, 2)).toBeNull();
    }
  });
});

describe('contact geometry', () => {
  const a = { x: 10, y: 0 }, b = { x: -6, y: 7.5 }, c = { x: -6, y: -7.5 };
  it('detects a circle touching an edge without touching any vertex or the center', () => {
    expect(triangleCircleOverlap(a, b, c, { x: 2, y: 4.5 }, 1)).toBe(true);
  });
  it('detects containment in both directions and either winding', () => {
    expect(triangleCircleOverlap(a, b, c, { x: 0, y: 0 }, 0.1)).toBe(true);
    expect(triangleCircleOverlap(c, b, a, { x: 0, y: 0 }, 0.1)).toBe(true);
    expect(triangleCircleOverlap(a, b, c, { x: 0, y: 0 }, 100)).toBe(true);
    expect(triangleCircleOverlap(a, b, c, { x: 20, y: 0 }, 1)).toBe(false);
  });
  it('transforms armored ship rotation and includes its forward cannon', () => {
    const ship = makeShip(), rock = makeAsteroid('rock', 100, 1);
    ship.rotation = Math.PI / 2;
    rock.pos.y = 114.5;
    expect(checkShipCollision(ship, rock)).toBe(true);
    rock.pos.y = 117;
    expect(checkShipCollision(ship, rock)).toBe(false);
  });
  it('does not treat a degenerate triangle as containing every point', () => {
    expect(triangleCircleOverlap(a, a, a, { x: 0, y: 0 }, 1)).toBe(false);
  });
});
