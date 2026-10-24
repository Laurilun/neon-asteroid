import type { Ship, Vector } from '../types';

// The same silhouette is used for rendering and collision. Units are ship radii.
export const ARMOR: readonly Vector[] = [
  { x: 1, y: -.28 }, { x: .38, y: -.52 }, { x: .12, y: -.82 },
  { x: -.83, y: -.82 }, { x: -1, y: -.58 }, { x: -.88, y: 0 },
  { x: -1, y: .58 }, { x: -.83, y: .82 }, { x: .12, y: .82 },
  { x: .38, y: .52 }, { x: 1, y: .28 },
];
export interface Cannon { x: number; y: number; index: number }
// At six barrels, additional upgrades improve the bank's ammunition, not its width.
const banks: readonly Cannon[][] = Array.from({ length: 6 }, (_, tier) =>
  Array.from({ length: tier + 1 }, (_, index) => {
    const y = tier === 0 ? 0 : (index / tier - .5) * 1.25;
    return { x: 1.08 - Math.abs(y) * .55, y, index };
  }));
export function cannons(tier: number): readonly Cannon[] { return banks[Math.min(5, Math.max(0, Math.floor(tier)))]; }
const footprints = banks.map(bank => [ARMOR, ...bank.map(m => [
  { x: m.x - .48, y: m.y - .12 }, { x: m.x + .065, y: m.y - .12 },
  { x: m.x + .065, y: m.y + .12 }, { x: m.x - .48, y: m.y + .12 },
])]);
export function shipFootprint(tier: number): readonly (readonly Vector[])[] { return footprints[cannons(tier).length - 1]; }
export function worldPoint(point: Vector, origin: Vector, angle: number, scale = 1): Vector {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: origin.x + (point.x * c - point.y * s) * scale, y: origin.y + (point.x * s + point.y * c) * scale };
}
export function muzzle(ship: Ship, cannon: Cannon): Vector { return worldPoint({ x: cannon.x + .065, y: cannon.y }, ship.pos, ship.rotation, ship.radius); }
export const batteryMultiplier = (tier: number) => 1 + Math.max(0, tier - 5) * .12;
