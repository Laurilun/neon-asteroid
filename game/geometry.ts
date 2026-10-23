import type { Vector } from '../types';

// Normalized gameplay geometry is also the drawing template: a chisel-nosed,
// broad-shouldered hull with two engine nacelles and a recessed stern.
export const SHIP_HULL: readonly Vector[] = [
  { x: 0.82, y: -0.23 }, { x: 0.35, y: -0.55 }, { x: -0.1, y: -0.74 },
  { x: -0.82, y: -0.74 }, { x: -1, y: -0.48 }, { x: -0.85, y: -0.18 },
  { x: -0.85, y: 0.18 }, { x: -1, y: 0.48 }, { x: -0.82, y: 0.74 },
  { x: -0.1, y: 0.74 }, { x: 0.35, y: 0.55 }, { x: 0.82, y: 0.23 },
];

export interface WeaponMount { id: number; x: number; y: number; angle: number }
export const MAX_VISIBLE_CANNONS = 8;
const batteries = new Map<number, readonly WeaponMount[]>();

/** Barrel positions in hull-radius units, shared by firing, drawing and hitboxes.
 * Beyond eight guns, tiers reinforce the existing battery rather than adding noise.
 */
export function weaponMounts(tier: number): readonly WeaponMount[] {
  const count = Math.min(MAX_VISIBLE_CANNONS, Math.max(1, Math.floor(tier) + 1));
  let mounts = batteries.get(count);
  if (!mounts) {
    mounts = Array.from({ length: count }, (_, id) => {
      const y = count === 1 ? 0 : (id / (count - 1) - 0.5) * (count === 2 ? 0.62 : 1.24);
      return { id, x: 1.22 - Math.abs(y) * 0.72, y, angle: -y * 0.045 };
    });
    batteries.set(count, mounts);
  }
  return mounts;
}

export function localToWorld(local: Vector, pos: Vector, angle: number, scale = 1): Vector {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return { x: pos.x + (local.x * cos - local.y * sin) * scale,
    y: pos.y + (local.x * sin + local.y * cos) * scale };
}

export function polygonArea(vertices: readonly Vector[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/** Sutherland-Hodgman half-plane clipping; preserves actual parent boundary edges. */
export function clipPolygon(vertices: readonly Vector[], normal: Vector, offset: number): Vector[] {
  const out: Vector[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    const da = a.x * normal.x + a.y * normal.y - offset;
    const db = b.x * normal.x + b.y * normal.y - offset;
    if (da <= 1e-7) out.push({ ...a });
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

export interface PolygonPiece { vertices: Vector[]; center: Vector; radius: number; area: number }
export function centerPiece(vertices: Vector[]): PolygonPiece {
  // Area centroid, so pieces rotate about their own mass rather than the parent origin.
  let twiceArea = 0, x = 0, y = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    const cross = a.x * b.y - b.x * a.y;
    twiceArea += cross; x += (a.x + b.x) * cross; y += (a.y + b.y) * cross;
  }
  const center = Math.abs(twiceArea) < 1e-8 ? { x: 0, y: 0 } : { x: x / (3 * twiceArea), y: y / (3 * twiceArea) };
  const local = vertices.map(v => ({ x: v.x - center.x, y: v.y - center.y }));
  return { vertices: local, center, radius: Math.max(0, ...local.map(v => Math.hypot(v.x, v.y))), area: Math.abs(twiceArea) / 2 };
}

/** Split across a stress line, then split the largest piece until count is met.
 * Spawn/event-time only; never called while drawing.
 */
export function fracturePolygon(vertices: readonly Vector[], count: number, angle: number): PolygonPiece[] {
  const polygons: Vector[][] = [vertices.map(v => ({ ...v }))];
  for (let n = 1; n < count; n++) {
    let biggest = 0;
    for (let i = 1; i < polygons.length; i++) if (polygonArea(polygons[i]) > polygonArea(polygons[biggest])) biggest = i;
    const source = polygons[biggest], center = centerPiece(source).center;
    const axis = angle + (n - 1) * 1.37;
    const normal = { x: Math.cos(axis), y: Math.sin(axis) };
    const offset = center.x * normal.x + center.y * normal.y;
    const a = clipPolygon(source, normal, offset);
    const b = clipPolygon(source, { x: -normal.x, y: -normal.y }, -offset);
    if (a.length < 3 || b.length < 3 || polygonArea(a) < 0.1 || polygonArea(b) < 0.1) break;
    polygons.splice(biggest, 1, a, b);
  }
  return polygons.map(centerPiece);
}

export function seedFromString(text: string): number {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i++) seed = Math.imul(seed ^ text.charCodeAt(i), 16777619);
  return seed >>> 0;
}

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}

/** Structured, radial rocky boundary, bounded by its gameplay radius. */
export function rockPolygon(radius: number, sides: number, random: () => number = Math.random): Vector[] {
  const phase = random() * Math.PI * 2;
  return Array.from({ length: sides }, (_, i) => {
    const angle = i / sides * Math.PI * 2;
    const r = radius * (0.83 + 0.09 * Math.sin(angle * 3 + phase) + random() * 0.08);
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  });
}
