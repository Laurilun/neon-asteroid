import { EntityType } from '../types';
import type { Asteroid, Vector } from '../types';

/** Material affects the outline as well as shading. Generated once, always inside radius. */
export function rockOutline(radius: number, sides: number, type = EntityType.Asteroid, random = Math.random): Vector[] {
  const iron = type === EntityType.IronAsteroid, ice = type === EntityType.FrozenAsteroid;
  const tungsten = type === EntityType.TungstenAsteroid;
  const count = iron ? 8 : ice ? 9 : tungsten ? 10 : sides;
  const phase = random() * Math.PI * 2;
  return Array.from({ length: count }, (_, i) => {
    const angle = i / count * Math.PI * 2;
    let r = .87 + random() * .12;
    if (ice) r = i % 3 === 0 ? .98 : .72 + random() * .14;
    if (iron) r = .96 - (i % 2) * .06;
    if (tungsten) r = .9 + .06 * Math.sin(i * 1.7 + phase);
    if (type === EntityType.MoltenAsteroid && i % 4 === 0) r *= .78;
    return { x: Math.cos(angle) * radius * r, y: Math.sin(angle) * radius * r * (iron ? .7 : tungsten ? .88 : 1) };
  });
}

export function polygonArea(vertices: readonly Vector[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area / 2);
}

/** Sutherland-Hodgman clipping. Adjacent pieces share the exact cut edge. */
export function clipPolygon(vertices: readonly Vector[], normal: Vector, offset = 0): Vector[] {
  const out: Vector[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    const da = a.x * normal.x + a.y * normal.y - offset;
    const db = b.x * normal.x + b.y * normal.y - offset;
    if (da >= -1e-8) out.push({ ...a });
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}
export interface RockPiece { vertices: Vector[]; center: Vector; radius: number; area: number }
export function fracturePolygon(vertices: readonly Vector[], count: number, angle: number): RockPiece[] {
  if (vertices.length < 3) return [];
  // Cut around the area centroid so recursively fractured, off-center polygons work too.
  let crossSum = 0, cx = 0, cy = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    const cross = a.x * b.y - b.x * a.y;
    crossSum += cross; cx += (a.x + b.x) * cross; cy += (a.y + b.y) * cross;
  }
  if (Math.abs(crossSum) < 1e-6) return [];
  const origin = { x: cx / (3 * crossSum), y: cy / (3 * crossSum) };
  const centered = vertices.map(v => ({ x: v.x - origin.x, y: v.y - origin.y }));
  const pieces: RockPiece[] = [];
  for (let i = 0; i < count; i++) {
    const start = angle + i * Math.PI * 2 / count, end = start + Math.PI * 2 / count;
    let cut = clipPolygon(centered, { x: -Math.sin(start), y: Math.cos(start) });
    if (count > 2) cut = clipPolygon(cut, { x: Math.sin(end), y: -Math.cos(end) });
    const area = polygonArea(cut);
    if (cut.length < 3 || area < .01) continue;
    const center = cut.reduce((sum, v) => ({ x: sum.x + v.x / cut.length, y: sum.y + v.y / cut.length }), { x: 0, y: 0 });
    const local = cut.map(v => ({ x: v.x - center.x, y: v.y - center.y }));
    pieces.push({ vertices: local, center: { x: center.x + origin.x, y: center.y + origin.y },
      radius: Math.max(...local.map(v => Math.hypot(v.x, v.y))), area });
  }
  return pieces;
}
export function pieceMotion(parent: Asteroid, piece: RockPiece, separation = .65) {
  const c = Math.cos(parent.rotation), s = Math.sin(parent.rotation);
  const x = piece.center.x * c - piece.center.y * s, y = piece.center.x * s + piece.center.y * c;
  const length = Math.hypot(x, y) || 1;
  return { pos: { x: parent.pos.x + x, y: parent.pos.y + y },
    vel: { x: parent.vel.x - y * parent.rotationSpeed + x / length * separation,
      y: parent.vel.y + x * parent.rotationSpeed + y / length * separation } };
}

/** Gameplay children keep the parent's material coordinates and cut-edge collision geometry. */
export function fractureAsteroid(parent: Asteroid, childHp: number): Asteroid[] {
  if (parent.sizeCategory === 1) return [];
  const direction = parent.impactDirection ?? { x: 1, y: 0 };
  return fracturePolygon(parent.vertices, parent.sizeCategory === 4 ? 3 : 2,
    Math.atan2(direction.y, direction.x) - parent.rotation + Math.PI / 2).map((piece, index) => ({
      ...parent, ...pieceMotion(parent, piece), id: `${parent.id}.${index}`,
      vertices: piece.vertices, radius: piece.radius, sizeCategory: (parent.sizeCategory - 1) as 1 | 2 | 3,
      hp: childHp, maxHp: childHp, toBeRemoved: false, hitFlash: 0,
      scars: parent.scars?.map(scar => ({ x: scar.x - piece.center.x, y: scar.y - piece.center.y })),
      surface: { vertices: parent.surface?.vertices ?? parent.vertices, radius: parent.surface?.radius ?? parent.radius,
        offset: { x: (parent.surface?.offset.x ?? 0) + piece.center.x, y: (parent.surface?.offset.y ?? 0) + piece.center.y } },
      nearMissed: false, impactDirection: undefined, shardIds: undefined,
    }));
}
