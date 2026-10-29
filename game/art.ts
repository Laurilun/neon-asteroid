import { ASTEROID_TYPES } from '../constants';
import { EntityType } from '../types';
import type { Asteroid, Bullet, Ship, TungstenShard, Vector } from '../types';
import { seedFromString, seededRandom, SHIP_HULL, weaponMounts } from './geometry';
import type { FeelEffect, FeelSystem } from './feel';

type DrawingContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

// A shared material language: opaque mass, one light edge, restrained emissive accents.
export const MATERIALS = {
  [EntityType.Asteroid]: { dark: '#252b30', mid: '#474e50', light: '#89918a', edge: '#afb3a0', energy: '#e9c990' },
  [EntityType.MoltenAsteroid]: { dark: '#211d20', mid: '#4a3230', light: '#80503a', edge: '#be8359', energy: '#ff923d' },
  [EntityType.FrozenAsteroid]: { dark: '#233f4b', mid: '#507888', light: '#89b8c5', edge: '#c6e3e4', energy: '#a6eff1' },
  [EntityType.IronAsteroid]: { dark: '#342d2c', mid: '#65534b', light: '#a28365', edge: '#d0aa7b', energy: '#edc480' },
  [EntityType.TungstenAsteroid]: { dark: '#27292e', mid: '#454953', light: '#767d84', edge: '#b5b7ad', energy: '#c0d2dc' },
  [EntityType.TungstenShard]: { dark: '#27292e', mid: '#555c63', light: '#919999', edge: '#bdc6c0', energy: '#d0e1e5' },
};
export function material(type: EntityType) { return MATERIALS[type as keyof typeof MATERIALS] ?? MATERIALS[EntityType.Asteroid]; }

function path(ctx: DrawingContext, vertices: readonly Vector[], scale = 1): void {
  ctx.beginPath();
  if (vertices.length) {
    ctx.moveTo(vertices[0].x * scale, vertices[0].y * scale);
    for (let i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i].x * scale, vertices[i].y * scale);
  }
  ctx.closePath();
}

interface RockSurface {
  center: Vector;
  texture?: CanvasImageSource;
  textureAttempted?: boolean;
  core: Vector[];
  ridges: Vector[][];
  pits: { x: number; y: number; radius: number }[];
}
const surfaces = new WeakMap<object, RockSurface>();

/** Generated once per rock, then retained only while its entity is alive. */
export function prepareRockSurface(rock: Pick<Asteroid, 'id' | 'vertices' | 'radius'>): RockSurface {
  let surface = surfaces.get(rock);
  if (surface) return surface;
  const rand = seededRandom(seedFromString(rock.id));
  // Surface center lies inside the polygon even for recentered fracture pieces.
  const center = rock.vertices.reduce((p, v) => ({ x: p.x + v.x / rock.vertices.length, y: p.y + v.y / rock.vertices.length }), { x: 0, y: 0 });
  const ridges: Vector[][] = [];
  for (let i = 0; i < rock.vertices.length; i += 2) {
    const v = rock.vertices[i];
    const mid = { x: center.x + (v.x - center.x) * (0.35 + rand() * 0.2),
      y: center.y + (v.y - center.y) * (0.35 + rand() * 0.2) };
    ridges.push([{ x: v.x * 0.94, y: v.y * 0.94 }, mid,
      { x: center.x + (rand() - 0.5) * rock.radius * 0.34, y: center.y + (rand() - 0.5) * rock.radius * 0.34 }]);
  }
  const pits = Array.from({ length: rock.radius < 24 ? 1 : Math.min(5, Math.floor(rock.radius / 15)) }, () => {
    const v = rock.vertices[Math.floor(rand() * Math.max(1, rock.vertices.length))] ?? center;
    const t = 0.18 + rand() * 0.4;
    return { x: center.x + (v.x - center.x) * t, y: center.y + (v.y - center.y) * t,
      radius: rock.radius * (0.07 + rand() * 0.07) };
  });
  const core = rock.vertices.map(v => {
    const scale = 0.44 + rand() * 0.16;
    return { x: center.x + (v.x - center.x) * scale, y: center.y + (v.y - center.y) * scale };
  });
  surface = { center, core, ridges, pits };
  surfaces.set(rock, surface);
  return surface;
}

/** Procedural surfaces are rasterized once at native scale. Damage, auras and
 * contact flashes stay dynamic; no external images or asset pipeline is involved.
 */
function rockTexture(a: Asteroid, surface: RockSurface): CanvasImageSource | undefined {
  if (surface.textureAttempted) return surface.texture;
  surface.textureAttempted = true;
  const size = Math.ceil(a.radius * 2 + 8);
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) :
    typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: size, height: size }) : null;
  const ctx = canvas?.getContext('2d') as DrawingContext | null;
  if (!ctx || !canvas) return;
  ctx.translate(a.radius + 4, a.radius + 4);
  drawRockSurface(ctx, a, surface);
  surface.texture = canvas;
  return surface.texture;
}

function drawRockSurface(ctx: DrawingContext, a: Asteroid, surface: RockSurface): void {
  const palette = material(a.type);
  const frozen = a.type === EntityType.FrozenAsteroid, molten = a.type === EntityType.MoltenAsteroid;
  path(ctx, a.vertices); ctx.fillStyle = palette.dark; ctx.fill();
  // Broad planes build volume; shared boundary vertices make the facets structural.
  for (let i = 0; i < a.vertices.length; i++) {
    const v = a.vertices[i], next = a.vertices[(i + 1) % a.vertices.length];
    ctx.beginPath(); ctx.moveTo(surface.center.x, surface.center.y); ctx.lineTo(v.x, v.y); ctx.lineTo(next.x, next.y); ctx.closePath();
    const light = Math.cos(Math.atan2(v.y + next.y, v.x + next.x) + 2.3);
    ctx.fillStyle = light > 0.35 ? palette.light : light > -0.35 ? palette.mid : palette.dark;
    ctx.globalAlpha = frozen ? 0.88 : 0.7; ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Clip surface layers so ridges/strata never float beyond fractured silhouettes.
  ctx.save(); path(ctx, a.vertices); ctx.clip();
  if (!frozen) {
    path(ctx, surface.core); ctx.fillStyle = palette.mid; ctx.globalAlpha = 0.72; ctx.fill();
    ctx.strokeStyle = palette.light; ctx.lineWidth = 0.75; ctx.globalAlpha = 0.2; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (a.type === EntityType.IronAsteroid || a.type === EntityType.TungstenAsteroid) {
    ctx.strokeStyle = palette.dark; ctx.lineWidth = a.type === EntityType.TungstenAsteroid ? 3 : 2;
    const step = Math.max(9, a.radius * 0.25);
    for (let y = -a.radius; y < a.radius; y += step) {
      ctx.beginPath(); ctx.moveTo(-a.radius, y - a.radius * 0.22); ctx.lineTo(a.radius, y + a.radius * 0.14); ctx.stroke();
      ctx.strokeStyle = palette.light; ctx.globalAlpha = 0.28;
      ctx.beginPath(); ctx.moveTo(-a.radius, y - a.radius * 0.22 + 2); ctx.lineTo(a.radius, y + a.radius * 0.14 + 2); ctx.stroke();
      ctx.strokeStyle = palette.dark; ctx.globalAlpha = 1;
    }
  } else if (!frozen && !molten) {
    for (const pit of surface.pits) {
      ctx.fillStyle = palette.dark;
      ctx.beginPath(); ctx.ellipse(pit.x, pit.y, pit.radius * 1.4, pit.radius, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = palette.light; ctx.lineWidth = 1; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.ellipse(pit.x, pit.y + 1, pit.radius * 1.4, pit.radius, -0.4, 0.2, 2.6); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  for (const ridge of surface.ridges) {
    ctx.beginPath(); ctx.moveTo(ridge[0].x, ridge[0].y); ctx.lineTo(ridge[1].x, ridge[1].y); ctx.lineTo(ridge[2].x, ridge[2].y);
    ctx.strokeStyle = molten ? palette.energy : frozen ? palette.edge : palette.dark;
    ctx.lineWidth = molten ? 1.6 : frozen ? 1 : 1.4;
    ctx.globalAlpha = molten ? 0.8 : 0.45; ctx.stroke();
    if (frozen) {
      ctx.beginPath(); ctx.moveTo(ridge[1].x, ridge[1].y); ctx.lineTo(ridge[1].x + a.radius * 0.2, ridge[1].y - a.radius * 0.25);
      ctx.strokeStyle = palette.edge; ctx.globalAlpha = 0.7; ctx.stroke();
    }
  }
  ctx.restore();
  path(ctx, a.vertices); ctx.strokeStyle = palette.edge; ctx.lineWidth = a.radius > 50 ? 1.4 : 1; ctx.globalAlpha = 0.7; ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawAsteroid(ctx: DrawingContext, a: Asteroid, tick: number, reduced: boolean): void {
  const palette = material(a.type), surface = prepareRockSurface(a);
  const frozen = a.type === EntityType.FrozenAsteroid, molten = a.type === EntityType.MoltenAsteroid;
  // Thin, readable hazard boundaries represent the actual aura rather than generic bloom.
  const config = frozen ? ASTEROID_TYPES.FROZEN : molten ? ASTEROID_TYPES.MOLTEN : null;
  if (config?.hasAura && config.auraRange) {
    const radius = config.auraRange * (1 + (a.sizeCategory - 1) * (config.auraSizeScale || 0)) + a.radius;
    ctx.save(); ctx.translate(a.pos.x, a.pos.y);
    ctx.strokeStyle = palette.energy; ctx.lineWidth = 1;
    ctx.globalAlpha = reduced ? 0.22 : 0.23 + Math.sin(tick * 0.035 + a.pulsateOffset) * 0.045;
    ctx.setLineDash(frozen ? [6, 10] : [16, 5, 2, 5]);
    ctx.lineDashOffset = frozen ? tick * 0.06 : -tick * 0.09;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    if (!reduced) {
      ctx.globalAlpha = 0.025; ctx.fillStyle = palette.energy;
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  ctx.save(); ctx.translate(a.pos.x, a.pos.y); ctx.rotate(a.rotation);
  const texture = rockTexture(a, surface);
  if (texture) ctx.drawImage(texture, -a.radius - 4, -a.radius - 4);
  else drawRockSurface(ctx, a, surface);
  ctx.save(); path(ctx, a.vertices); ctx.clip();
  // Damage persists at the entry points and grows with lost hull, not random lines.
  const damage = Math.max(0, 1 - a.hp / a.maxHp);
  for (const scar of a.scars ?? []) {
    const length = a.radius * Math.min(0.9, 0.12 + damage * 0.65 + scar.strength * 0.15);
    ctx.save(); ctx.translate(scar.pos.x, scar.pos.y); ctx.rotate(scar.angle);
    ctx.strokeStyle = '#13191d'; ctx.lineWidth = 2.4; ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(length * 0.4, 2); ctx.lineTo(length * 0.7, -2); ctx.lineTo(length, 0); ctx.stroke();
    ctx.strokeStyle = molten ? palette.energy : palette.edge; ctx.lineWidth = 0.65; ctx.globalAlpha = 0.7;
    ctx.stroke(); ctx.restore();
  }
  ctx.restore();
  if (a.hitFlash > 0 && !reduced) {
    // Edge response only; localized impact effects carry the bright flash.
    path(ctx, a.vertices);
    ctx.globalAlpha = Math.min(0.6, a.hitFlash / 12); ctx.strokeStyle = '#eee7d3'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}

export function drawShard(ctx: DrawingContext, shard: TungstenShard, tick: number): void {
  ctx.save(); ctx.translate(shard.pos.x, shard.pos.y); ctx.rotate(shard.rotation);
  const p = material(EntityType.TungstenShard);
  // Render the defensive volume too, rather than leaving a large invisible blocker.
  path(ctx, shard.vertices, shard.collisionRadius / Math.max(1, shard.radius)); ctx.fillStyle = p.mid; ctx.fill();
  ctx.strokeStyle = shard.hitFlash > 0 ? p.energy : p.edge; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-shard.radius * 0.5, -shard.radius * 0.25); ctx.lineTo(shard.radius * 0.55, shard.radius * 0.1);
  ctx.strokeStyle = p.dark; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
  if (shard.isThrown) {
    ctx.strokeStyle = '#d6b687'; ctx.globalAlpha = 0.3; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(shard.pos.x, shard.pos.y); ctx.lineTo(shard.pos.x - shard.vel.x * 3, shard.pos.y - shard.vel.y * 3); ctx.stroke(); ctx.globalAlpha = 1;
  }
}

export function drawProjectile(ctx: DrawingContext, b: Bullet): void {
  const power = Math.min(5, b.powerTier ?? 0), ricochet = b.isRicochet;
  const accent = ricochet ? '#8adddf' : b.mountId === undefined ? '#d9bc8c' : '#edc987';
  ctx.save();
  if (b.trail && b.trail.length > 1) {
    ctx.strokeStyle = accent; ctx.lineWidth = ricochet ? 1.4 : 1; ctx.lineCap = 'butt';
    for (let i = 1; i < b.trail.length; i++) {
      ctx.globalAlpha = (i / b.trail.length) * (ricochet ? 0.6 : 0.25);
      ctx.beginPath(); ctx.moveTo(b.trail[i - 1].x, b.trail[i - 1].y); ctx.lineTo(b.trail[i].x, b.trail[i].y); ctx.stroke();
    }
  }
  ctx.translate(b.pos.x, b.pos.y); ctx.rotate(Math.atan2(b.vel.y, b.vel.x));
  ctx.globalAlpha = Math.min(1, b.life / 4);
  const length = 12 + power * 1.1;
  ctx.fillStyle = '#111a20'; ctx.fillRect(-length - 1, -2.8, length + 4, 5.6);
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-1, -1.7); ctx.lineTo(-length, -1.2); ctx.lineTo(-length - 2, 0); ctx.lineTo(-length, 1.2); ctx.lineTo(-1, 1.7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff6dc'; ctx.fillRect(-length * 0.45, -0.65, length * 0.5 + 1, 1.3);
  if (power > 0 || ricochet) {
    ctx.strokeStyle = accent; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-length - 4, -2.2); ctx.lineTo(-length - 1, 0); ctx.lineTo(-length - 4, 2.2); ctx.stroke();
  }
  ctx.restore();
}

export function drawShip(ctx: DrawingContext, ship: Ship, feel: FeelSystem, tick: number): void {
  const r = ship.radius, speed = Math.hypot(ship.vel.x, ship.vel.y);
  // A subtle velocity chevron distinguishes travel direction from the gun's facing.
  if (speed > 1.5) {
    ctx.save(); ctx.translate(ship.pos.x, ship.pos.y); ctx.rotate(Math.atan2(ship.vel.y, ship.vel.x));
    ctx.strokeStyle = '#a8b3b4'; ctx.globalAlpha = Math.min(0.45, speed / 18); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(r + 5, -3); ctx.lineTo(r + 9, 0); ctx.lineTo(r + 5, 3); ctx.stroke(); ctx.restore();
  }
  ctx.save(); ctx.translate(ship.pos.x, ship.pos.y); ctx.rotate(ship.rotation); ctx.scale(r, r);
  ctx.lineWidth = 1 / r;
  // Actual engine spool controls plume length; no uncaused render jitter.
  for (const y of [-0.48, 0.48]) {
    const plume = ship.throttle * (0.65 + 0.035 * Math.sin(tick * 0.65));
    if (plume > 0.02) {
      ctx.fillStyle = '#b87739'; ctx.globalAlpha = 0.35 + ship.throttle * 0.35;
      ctx.beginPath(); ctx.moveTo(-0.88, y - 0.13); ctx.lineTo(-1.07 - plume, y); ctx.lineTo(-0.88, y + 0.13); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe1a4'; ctx.globalAlpha = 0.95;
      ctx.beginPath(); ctx.moveTo(-0.9, y - 0.065); ctx.lineTo(-1.02 - plume * 0.58, y); ctx.lineTo(-0.9, y + 0.065); ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // Guns are drawn from the same cached mount positions that launch the rounds.
  for (const m of weaponMounts(ship.stats.multishotTier)) {
    const recoil = feel.recoil[m.id] * 0.13, heat = feel.heat[m.id];
    ctx.fillStyle = '#161e25'; ctx.fillRect(m.x - 0.65, m.y - 0.14, 0.43, 0.28);
    ctx.fillStyle = '#53616a'; ctx.fillRect(m.x - 0.57 - recoil, m.y - 0.082, 0.57, 0.164);
    ctx.fillStyle = '#cad0c6'; ctx.fillRect(m.x - 0.15 - recoil, m.y - 0.085, 0.15, 0.17);
    ctx.fillStyle = '#1b252c'; ctx.fillRect(m.x - 0.04 - recoil, m.y - 0.045, 0.05, 0.09);
    // A warming jacket conveys sustained cycling; the geometry remains legible.
    ctx.fillStyle = heat > 0.6 ? '#d6a563' : '#849394';
    for (let slot = 0; slot < 3; slot++) ctx.fillRect(m.x - 0.46 + slot * 0.08 - recoil, m.y - 0.06, 0.025, 0.12);
  }
  path(ctx, SHIP_HULL); ctx.fillStyle = '#1b252e'; ctx.fill(); ctx.strokeStyle = '#a3b0af'; ctx.stroke();
  // Broad, contrasting shoulder armor and a raised central spine.
  for (const side of [-1, 1]) {
    path(ctx, [{ x: -0.84, y: 0.37 * side }, { x: -0.72, y: 0.65 * side }, { x: -0.13, y: 0.65 * side }, { x: 0.2, y: 0.42 * side }]);
    ctx.fillStyle = side < 0 ? '#78868a' : '#4b5b64'; ctx.fill(); ctx.strokeStyle = '#26333c'; ctx.stroke();
    ctx.fillStyle = '#d3bb85'; ctx.fillRect(-0.48, (side < 0 ? -0.66 : 0.49), 0.12, 0.17);
    ctx.fillStyle = '#141f27'; ctx.fillRect(-0.82, side * 0.48 - 0.08, 0.17, 0.16);
    // RCS jets appear only for actual steering commands.
    if (ship.steering === side) {
      ctx.fillStyle = '#c6e2dc'; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(0.05, -side * 0.57); ctx.lineTo(-0.12, -side * 0.57); ctx.lineTo(-0.1, -side * 0.91); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  path(ctx, [{ x: 0.72, y: -0.16 }, { x: 0.24, y: -0.34 }, { x: -0.65, y: -0.25 }, { x: -0.66, y: 0.25 }, { x: 0.24, y: 0.34 }, { x: 0.72, y: 0.16 }]);
  ctx.fillStyle = ship.isFrozen ? '#638b98' : '#52636d'; ctx.fill(); ctx.strokeStyle = '#92a4aa'; ctx.stroke();
  ctx.fillStyle = '#112c37';
  path(ctx, [{ x: 0.4, y: 0 }, { x: 0.06, y: -0.17 }, { x: -0.21, y: -0.13 }, { x: -0.21, y: 0.13 }, { x: 0.06, y: 0.17 }]); ctx.fill();
  ctx.strokeStyle = '#9bdbd7'; ctx.beginPath(); ctx.moveTo(-0.16, -0.1); ctx.lineTo(0.02, -0.11); ctx.lineTo(0.22, -0.02); ctx.stroke();
  ctx.fillStyle = '#17232b';
  for (let i = 0; i < 3; i++) ctx.fillRect(-0.62 + i * 0.1, -0.15, 0.04, 0.3);
  // Discharge and recovery are tied to the firing event, attached to the actual barrel.
  for (const m of weaponMounts(ship.stats.multishotTier)) {
    const flash = feel.muzzle[m.id];
    if (flash < 0.04) continue;
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.angle);
    ctx.globalAlpha = flash * (feel.reduced ? 0.45 : 0.9);
    const length = (feel.reduced ? 0.23 : 0.5) * flash;
    ctx.fillStyle = '#e4b26a';
    path(ctx, [{ x: 0, y: -0.07 }, { x: length * 0.4, y: -0.18 * flash }, { x: length, y: 0 }, { x: length * 0.4, y: 0.18 * flash }, { x: 0, y: 0.07 }]); ctx.fill();
    ctx.fillStyle = '#fff2ce'; ctx.fillRect(0, -0.035, length * 0.6, 0.07);
    ctx.restore();
  }
  ctx.restore();
}

export function drawFeelEffects(ctx: DrawingContext, effects: readonly FeelEffect[], behind: boolean): void {
  for (const e of effects) {
    if ((e.kind === 'dust') !== behind) continue;
    const progress = e.age / e.duration, palette = material(e.material);
    ctx.save(); ctx.translate(e.pos.x, e.pos.y); ctx.rotate(e.angle);
    ctx.globalAlpha = Math.min(1, (1 - progress) * (e.kind === 'chunk' ? 3 : 1));
    if (e.kind === 'chunk' && e.vertices) {
      path(ctx, e.vertices); ctx.fillStyle = palette.mid; ctx.fill();
      ctx.strokeStyle = palette.light; ctx.lineWidth = 0.8; ctx.stroke();
      if (e.vertices.length > 2) {
        ctx.beginPath(); ctx.moveTo(e.vertices[0].x, e.vertices[0].y); ctx.lineTo(0, 0); ctx.lineTo(e.vertices[1].x, e.vertices[1].y);
        ctx.fillStyle = palette.dark; ctx.fill();
      }
    } else if (e.kind === 'dust') {
      ctx.globalAlpha = (1 - progress) * 0.11; ctx.fillStyle = palette.light;
      ctx.beginPath(); ctx.arc(0, 0, e.size * (0.7 + progress), 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === 'spark') {
      ctx.strokeStyle = palette.energy; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-Math.hypot(e.vel.x, e.vel.y) * 2, 0); ctx.stroke();
    } else if (e.kind === 'impact') {
      ctx.fillStyle = palette.energy;
      const length = e.size * (1 - progress);
      path(ctx, [{ x: -length, y: 0 }, { x: 0, y: -length * 0.45 }, { x: length * 0.45, y: 0 }, { x: 0, y: length * 0.45 }]); ctx.fill();
      ctx.fillStyle = '#fff0d1'; ctx.fillRect(-length * 0.3, -1, length * 0.6, 2);
    } else if (e.kind === 'near') {
      ctx.strokeStyle = '#bcc8c1'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, e.size + progress * 3, -0.18, 0.18); ctx.stroke();
    } else {
      ctx.strokeStyle = palette.light; ctx.lineWidth = 1;
      ctx.globalAlpha *= 0.45;
      ctx.beginPath(); ctx.ellipse(0, 0, e.size * (1 + progress * 1.5), e.size * (0.75 + progress), 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}
