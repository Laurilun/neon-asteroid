import type { Ship, Vector } from '../types';

// The same armored perimeter is used by rendering and hull contacts. +X is forward.
export const SHIP_HULL: readonly Vector[] = [
  { x: 1, y: 0 }, { x: .65, y: .36 }, { x: .28, y: .43 },
  { x: .4, y: .62 }, { x: -.62, y: .7 }, { x: -.8, y: .44 },
  { x: -.72, y: 0 }, { x: -.8, y: -.44 }, { x: -.62, y: -.7 },
  { x: .4, y: -.62 }, { x: .28, y: -.43 }, { x: .65, y: -.36 },
];
export interface CannonMount extends Vector { index: number }
const batteries: CannonMount[][] = Array.from({ length: 7 }, (_, tier) => {
  const count = tier + 1;
  return Array.from({ length: count }, (_, index) => {
    const y = count === 1 ? 0 : (index / (count - 1) - .5) * 1.12;
    return { index, x: .96 - Math.abs(y) * 1.1, y };
  });
});
export function cannonMounts(tier: number): readonly CannonMount[] {
  return batteries[Math.min(6, Math.max(0, Math.floor(tier)))];
}
export function mountPosition(ship: Ship, mount: Vector): Vector {
  const c = Math.cos(ship.rotation), s = Math.sin(ship.rotation);
  return { x: ship.pos.x + ship.radius * (mount.x * c - mount.y * s),
    y: ship.pos.y + ship.radius * (mount.x * s + mount.y * c) };
}
/** Seven legible hardpoints; subsequent tiers reinforce the installed battery. */
export function batteryDamageMultiplier(tier: number): number { return 1 + Math.max(0, tier - 6) * .2; }
