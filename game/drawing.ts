import { ASTEROID_TYPES } from '../constants';
import { EntityType } from '../types';
import type { Asteroid, Bullet, Ship, TungstenShard, Vector } from '../types';
import { ARMOR, cannons } from './gunship';
import type { CombatResponses } from './responses';

type Context = CanvasRenderingContext2D;
export function polygon(ctx: Context, vertices: readonly Vector[]): void {
  ctx.beginPath();
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i]; if (i === 0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y);
  }
  ctx.closePath();
}
function plate(ctx: Context, points: number[][], fill: string, edge?: string): void {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); if (edge) { ctx.strokeStyle = edge; ctx.stroke(); }
}

export function paintGunship(ctx: Context, ship: Ship, responses: CombatResponses, tick: number): void {
  const r = ship.radius;
  ctx.save(); ctx.translate(ship.pos.x, ship.pos.y); ctx.rotate(ship.rotation); ctx.scale(r, r);
  ctx.lineWidth = 1 / r;
  const drive = ship.drive ?? 0;
  for (const side of [-1, 1]) {
    // Two exhaust bells, with a stable shock-diamond pattern driven by engine spool.
    const y = side * .57, flame = drive * (1.05 + .05 * Math.cos(tick * .8));
    if (flame > .03) {
      plate(ctx, [[-.9, y - .15], [-1.05 - flame, y], [-.9, y + .15]], '#327aa2');
      plate(ctx, [[-.92, y - .08], [-1 - flame * .7, y], [-.92, y + .08]], '#b9edff');
      ctx.fillStyle = '#f2fbff'; ctx.fillRect(-1.12, y - .045, .18, .09);
    }
  }
  polygon(ctx, ARMOR); ctx.fillStyle = '#17212d'; ctx.fill(); ctx.strokeStyle = '#768792'; ctx.stroke();
  // Armor skirts, dark separated nacelles, and a blunt command section.
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(1, side);
    plate(ctx, [[-.93, .47], [-.78, .77], [.08, .77], [.3, .49], [.08, .39], [-.72, .39]], side < 0 ? '#c1c7bd' : '#829393', '#e0dfc7');
    ctx.fillStyle = '#273b48'; ctx.fillRect(-.65, .51, .42, .15);
    ctx.fillStyle = '#e7a744'; ctx.fillRect(-.16, .48, .14, .23);
    ctx.fillStyle = '#121e2b'; ctx.fillRect(-.94, .44, .2, .23);
    // Attitude jets oppose the change of angular momentum, including auto braking.
    if ((ship.turnJet ?? 0) * side > .08) {
      const jet = Math.min(.45, Math.abs(ship.turnJet!) * .22);
      plate(ctx, [[.18, -.54], [.03, -.58], [.12, -.6 - jet]], '#a4dfed');
      plate(ctx, [[-.76, .76], [-.62, .76], [-.68, .8 + jet]], '#a4dfed');
    }
    ctx.restore();
  }
  plate(ctx, [[-.78, -.31], [.58, -.3], [.98, -.22], [.98, .22], [.58, .3], [-.78, .31]], '#d3d2ba', '#e4e4d7');
  plate(ctx, [[-.7, -.26], [-.25, -.26], [-.25, .26], [-.7, .26]], '#334753');
  ctx.fillStyle = '#142934';
  for (let i = 0; i < 4; i++) ctx.fillRect(-.65 + i * .095, -.21, .045, .42);
  // The armored canopy stays distinct from the cannon and shoulder machinery.
  plate(ctx, [[-.13, -.19], [.2, -.23], [.46, -.12], [.46, .12], [.2, .23], [-.13, .19]], '#182f3e', '#5f8d9f');
  ctx.fillStyle = ship.isFrozen ? '#c7f5ff' : '#8ccbdc'; ctx.fillRect(.02, -.13, .18, .055);
  ctx.fillStyle = '#9f6b36'; ctx.fillRect(.6, -.22, .1, .44);
  for (const mount of cannons(ship.stats.multishotTier)) {
    const recoil = responses.barrelKick[mount.index], heat = responses.barrelHeat[mount.index];
    ctx.save(); ctx.translate(mount.x, mount.y);
    // Fixed breech, sliding receiver, rail pair and dark muzzle aperture.
    ctx.fillStyle = '#101b26'; ctx.fillRect(-.48, -.12, .43, .24);
    ctx.translate(-recoil * .19, 0);
    ctx.fillStyle = '#7d929c'; ctx.fillRect(-.43, -.095, .48, .19);
    ctx.fillStyle = '#dce2dc'; ctx.fillRect(-.37, -.085, .4, .045);
    ctx.fillStyle = '#263b48'; ctx.fillRect(-.37, .025, .4, .055);
    ctx.fillStyle = '#17222c'; ctx.fillRect(.01, -.09, .055, .18);
    ctx.fillStyle = heat > .55 ? '#ffb45c' : '#9a8256'; ctx.fillRect(-.32, -.045, .09, .09);
    ctx.restore();
    if (recoil > .55) {
      ctx.save(); ctx.translate(mount.x + .06, mount.y);
      ctx.globalAlpha = (recoil - .55) / .45 * (responses.reduced ? .4 : 1);
      plate(ctx, [[0, -.07], [.18, -.16], [.61, 0], [.18, .16], [0, .07]], '#ef9d48');
      plate(ctx, [[0, -.035], [.4, 0], [0, .035]], '#fff5d0'); ctx.restore();
    }
  }
  ctx.restore();
  // Travel marker is separated from the hull: a useful cue during broadside drift.
  const speed = Math.hypot(ship.vel.x, ship.vel.y);
  if (speed > 2) {
    ctx.save(); ctx.translate(ship.pos.x, ship.pos.y); ctx.rotate(Math.atan2(ship.vel.y, ship.vel.x));
    ctx.strokeStyle = '#8298a1'; ctx.globalAlpha = .55; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(r + 7, -3); ctx.lineTo(r + 11, 0); ctx.lineTo(r + 7, 3); ctx.stroke(); ctx.restore();
  }
}

const palettes: Partial<Record<EntityType, string[]>> = {
  [EntityType.Asteroid]: ['#202a32', '#45515a', '#69777e', '#afbbb6'],
  [EntityType.MoltenAsteroid]: ['#2c2228', '#593a38', '#98634d', '#f6ae6d'],
  [EntityType.FrozenAsteroid]: ['#1d3b52', '#426d84', '#78a8c2', '#c4e6f1'],
  [EntityType.IronAsteroid]: ['#2e292b', '#665145', '#a3896b', '#d4c1a0'],
  [EntityType.TungstenAsteroid]: ['#232b35', '#434d60', '#78838e', '#bac2c8'],
};
const rockCache = new WeakMap<Asteroid, HTMLCanvasElement>();

/** Native Canvas texture made once per entity. Broad shelves, beveled edges and
 * material marks stay stable under rotation, rather than flickering each render. */
function rockTexture(rock: Asteroid): HTMLCanvasElement {
  let cache = rockCache.get(rock);
  if (cache) return cache;
  cache = document.createElement('canvas');
  const extent = Math.ceil(rock.radius + 4); cache.width = cache.height = extent * 2;
  const c = cache.getContext('2d')!; c.translate(extent, extent);
  const shades = palettes[rock.type] ?? palettes[EntityType.Asteroid]!;
  if (rock.surfaceSource) {
    const { rock: parent, offset } = rock.surfaceSource, texture = rockTexture(parent);
    c.save(); polygon(c, rock.vertices); c.clip();
    c.drawImage(texture, offset.x - texture.width / 2, offset.y - texture.height / 2); c.restore();
    polygon(c, rock.vertices); c.strokeStyle = shades[2]; c.lineWidth = 1; c.stroke();
    rockCache.set(rock, cache); return cache;
  }
  polygon(c, rock.vertices); c.fillStyle = shades[0]; c.fill(); c.save(); c.clip();
  const light = c.createLinearGradient(-rock.radius, -rock.radius, rock.radius, rock.radius);
  light.addColorStop(0, shades[2]); light.addColorStop(.45, shades[1]); light.addColorStop(1, shades[0]);
  c.fillStyle = light; c.fillRect(-extent, -extent, extent * 2, extent * 2);
  // Offset terraces follow the outer contours; broad geology instead of radial line noise.
  for (let layer = 0; layer < 3; layer++) {
    c.save(); c.translate(-rock.radius * .06 * layer, -rock.radius * .07 * layer);
    c.scale(.85 - layer * .2, .85 - layer * .2);
    // Uneven ledges interrupt the layers; no concentric target-ring effect.
    c.beginPath(); rock.vertices.forEach((v, i) => {
      const wobble = 1 + .15 * Math.sin(i * 2.2 + layer * 1.4);
      if (i === 0) c.moveTo(v.x * wobble, v.y * wobble); else c.lineTo(v.x * wobble, v.y * wobble);
    }); c.closePath(); c.fillStyle = shades[layer === 2 ? 2 : 1]; c.globalAlpha = .6; c.fill();
    c.strokeStyle = shades[3]; c.globalAlpha = .18; c.lineWidth = 1.2; c.stroke(); c.restore();
  }
  for (let i = 0; i < rock.vertices.length; i++) {
    const v = rock.vertices[i], next = rock.vertices[(i + 1) % rock.vertices.length];
    const edgeLight = (v.x + next.x + v.y + next.y) < 0;
    plate(c, [[v.x, v.y], [next.x, next.y], [next.x * .83, next.y * .83], [v.x * .83, v.y * .83]], edgeLight ? shades[2] : shades[0]);
  }
  const r = rock.radius;
  if (rock.type === EntityType.MoltenAsteroid) {
    c.strokeStyle = '#ec8c48'; c.lineWidth = Math.max(1, r * .025);
    for (let i = 1; i < rock.vertices.length; i += 3) {
      const v = rock.vertices[i]; c.beginPath(); c.moveTo(v.x, v.y); c.lineTo(v.x * .5 + 3, v.y * .6); c.lineTo(v.x * .23, v.y * .2 - 3); c.stroke();
    }
  } else if (rock.type === EntityType.FrozenAsteroid) {
    c.globalAlpha = .55;
    for (let i = 0; i < rock.vertices.length; i += 3) {
      const a = rock.vertices[i], b = rock.vertices[(i + 2) % rock.vertices.length];
      plate(c, [[a.x, a.y], [b.x * .7, b.y * .7], [-r * .12, r * .15]], shades[3]);
    }
    c.globalAlpha = 1;
  } else if (rock.type === EntityType.IronAsteroid || rock.type === EntityType.TungstenAsteroid) {
    const spacing = rock.type === EntityType.TungstenAsteroid ? 8 : 13;
    for (let y = -r; y < r; y += spacing) {
      c.strokeStyle = shades[0]; c.lineWidth = 3; c.beginPath(); c.moveTo(-r, y); c.lineTo(r, y + r * .3); c.stroke();
      c.strokeStyle = shades[2]; c.lineWidth = .7; c.stroke();
    }
  } else {
    for (let i = 0; i < Math.min(4, rock.vertices.length); i++) {
      const v = rock.vertices[(i * 3 + 1) % rock.vertices.length];
      const x = v.x * .51, y = v.y * .47, size = Math.max(2, r * (.08 + (i % 2) * .025));
      c.beginPath(); c.ellipse(x, y, size * 1.5, size, -.5, 0, Math.PI * 2); c.fillStyle = shades[0]; c.fill();
      c.beginPath(); c.ellipse(x, y + 1, size * 1.5, size, -.5, .2, 2.8); c.strokeStyle = shades[2]; c.lineWidth = 1.5; c.stroke();
    }
  }
  c.restore(); polygon(c, rock.vertices); c.strokeStyle = shades[2]; c.lineWidth = 1; c.stroke();
  rockCache.set(rock, cache); return cache;
}

export function paintRock(ctx: Context, rock: Asteroid, tick: number, reduced: boolean): void {
  const config = rock.type === EntityType.MoltenAsteroid ? ASTEROID_TYPES.MOLTEN : rock.type === EntityType.FrozenAsteroid ? ASTEROID_TYPES.FROZEN : null;
  if (config) {
    ctx.save(); ctx.strokeStyle = config.color; ctx.lineWidth = 1; ctx.globalAlpha = .38;
    ctx.setLineDash(rock.type === EntityType.FrozenAsteroid ? [3, 9] : [12, 6]);
    ctx.lineDashOffset = tick * .13;
    ctx.beginPath(); ctx.arc(rock.pos.x, rock.pos.y, rock.radius + config.auraRange! * (1 + (rock.sizeCategory - 1) * (config.auraSizeScale || 0)), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  ctx.save(); ctx.translate(rock.pos.x, rock.pos.y); ctx.rotate(rock.rotation);
  const texture = rockTexture(rock); ctx.drawImage(texture, -texture.width / 2, -texture.height / 2);
  polygon(ctx, rock.vertices); ctx.save(); ctx.clip();
  for (const wound of rock.wounds ?? []) {
    ctx.save(); ctx.translate(wound.x, wound.y); ctx.rotate(wound.angle);
    const length = rock.radius * (.25 + (1 - Math.max(0, rock.hp / rock.maxHp)) * .7);
    ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(length * .3, 2); ctx.lineTo(length * .6, -3); ctx.lineTo(length, 1);
    ctx.strokeStyle = '#101820'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = rock.type === EntityType.MoltenAsteroid ? '#ffb358' : '#aab9bb'; ctx.lineWidth = .6; ctx.stroke(); ctx.restore();
  }
  ctx.restore();
  if (rock.hitFlash > 0 && !reduced) {
    polygon(ctx, rock.vertices); ctx.strokeStyle = '#e7e9d5'; ctx.globalAlpha = rock.hitFlash * .12; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}

export function paintSlug(ctx: Context, bullet: Bullet): void {
  ctx.save(); const color = bullet.isRicochet ? '#7be2dc' : '#ffc178';
  if (bullet.trail && bullet.trail.length > 1) {
    ctx.beginPath(); bullet.trail.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.lineTo(bullet.pos.x, bullet.pos.y);
    ctx.lineWidth = bullet.isRicochet ? 1.7 : 1; ctx.strokeStyle = color; ctx.globalAlpha = .32; ctx.stroke();
  }
  ctx.globalAlpha = Math.min(1, bullet.life / 3); ctx.translate(bullet.pos.x, bullet.pos.y); ctx.rotate(Math.atan2(bullet.vel.y, bullet.vel.x));
  const length = 10 + Math.min(6, bullet.rail ?? 0);
  plate(ctx, [[2, 0], [-2, -2], [-length, -1.4], [-length - 2, 0], [-length, 1.4], [-2, 2]], '#253e4c', '#070d13');
  ctx.fillStyle = color; ctx.fillRect(-length + 1, -1.2, length - 1, 2.4);
  ctx.fillStyle = '#fff4d5'; ctx.fillRect(-3, -1.3, 3, 2.6);
  if ((bullet.rail ?? 0) > 0) { ctx.fillStyle = '#edb57d'; ctx.fillRect(-length - 5, -.6, 3, 1.2); }
  ctx.restore();
}

export function paintShard(ctx: Context, shard: TungstenShard): void {
  ctx.save(); ctx.translate(shard.pos.x, shard.pos.y); ctx.rotate(shard.rotation);
  // Visible defensive shell explains its intentionally generous blocking radius.
  ctx.beginPath(); ctx.arc(0, 0, shard.collisionRadius, 0, Math.PI * 2); ctx.strokeStyle = '#637486'; ctx.globalAlpha = .24; ctx.lineWidth = .7; ctx.stroke();
  ctx.globalAlpha = 1; polygon(ctx, shard.vertices); ctx.fillStyle = '#657481'; ctx.fill(); ctx.strokeStyle = shard.hitFlash ? '#e4d8bf' : '#9aaab0'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

export function paintResponses(ctx: Context, responses: CombatResponses): void {
  for (const f of responses.flecks) {
    ctx.save(); ctx.translate(f.pos.x, f.pos.y); ctx.rotate(f.angle);
    ctx.globalAlpha = Math.min(1, f.life / Math.min(14, f.duration));
    if (f.outline) {
      polygon(ctx, f.outline);
      if (f.source) {
        const texture = rockTexture(f.source.rock); ctx.save(); ctx.clip();
        ctx.drawImage(texture, f.source.offset.x - texture.width / 2, f.source.offset.y - texture.height / 2); ctx.restore();
      } else { ctx.fillStyle = f.color; ctx.fill(); }
      polygon(ctx, f.outline); ctx.strokeStyle = '#899ba1'; ctx.lineWidth = .7; ctx.stroke();
    } else if (f.kind === 'flare') {
      const r = f.size * f.life / f.duration;
      plate(ctx, [[-r * .6, 0], [0, -r], [r * .3, 0], [0, r]], f.color);
      ctx.fillStyle = '#fff7dd'; ctx.fillRect(-2, -2, 4, 4);
    } else {
      ctx.strokeStyle = f.color; ctx.lineWidth = 1; ctx.globalAlpha *= .5;
      ctx.beginPath(); ctx.moveTo(-f.size, -3); ctx.lineTo(0, 0); ctx.lineTo(-f.size, 3); ctx.stroke();
    }
    ctx.restore();
  }
}
