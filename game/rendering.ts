import { EntityType } from '../types';
import type { Asteroid, Bullet, Ship, TungstenShard, Vector } from '../types';
import { cannonMounts, SHIP_HULL } from './hardware';
import { material } from './feel';
import type { FeelResponses } from './feel';

export function polygonPath(ctx: CanvasRenderingContext2D, points: readonly Vector[]) {
  ctx.beginPath();
  if (!points.length) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}
const pathCache = new WeakMap<readonly Vector[], Path2D>();
function paintPolygon(ctx: CanvasRenderingContext2D, points: readonly Vector[], action: 'fill' | 'stroke' | 'clip') {
  if (typeof Path2D === 'undefined') { polygonPath(ctx, points); ctx[action](); return; }
  let path = pathCache.get(points);
  if (!path) {
    path = new Path2D();
    if (points.length) {
      path.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) path.lineTo(points[i].x, points[i].y);
      path.closePath();
    }
    pathCache.set(points, path);
  }
  ctx[action](path);
}
const hullPanels = [
  [{ x: -.65, y: -.6 }, { x: -.05, y: -.6 }, { x: .25, y: -.29 }, { x: -.58, y: -.28 }],
  [{ x: -.65, y: .6 }, { x: -.05, y: .6 }, { x: .25, y: .29 }, { x: -.58, y: .28 }],
  [{ x: -.49, y: -.25 }, { x: .53, y: -.21 }, { x: .88, y: 0 }, { x: .53, y: .21 }, { x: -.49, y: .25 }],
];

/** A restrained slipstream makes the difference between heading and travel visible while coasting. */
export function drawVelocityWake(ctx: CanvasRenderingContext2D, ship: Ship) {
  const speed = Math.hypot(ship.vel.x, ship.vel.y);
  if (speed < 1.5 || (ship.throttle ?? 0) > .5) return;
  ctx.save(); ctx.translate(ship.pos.x, ship.pos.y); ctx.rotate(Math.atan2(ship.vel.y, ship.vel.x));
  ctx.strokeStyle = '#77919b'; ctx.globalAlpha = Math.min(.25, speed * .035); ctx.lineWidth = .8;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(-ship.radius - 4, side * 5); ctx.lineTo(-ship.radius - 4 - Math.min(22, speed * 3), side * 7); ctx.stroke();
  }
  ctx.restore();
}

/** Local ship coordinates; the integration supplies translation and rotation. */
export function drawGunship(ctx: CanvasRenderingContext2D, ship: Ship, tick: number) {
  const r = ship.radius, throttle = ship.throttle ?? 0, recoil = ship.cannonRecoil ?? 0;
  const heat = ship.cannonHeat ?? 0;
  ctx.save();
  ctx.scale(r, r);
  ctx.lineWidth = 1 / r;
  // Twin engines: attached exhaust responds to spool state, never random frame noise.
  for (const side of [-1, 1]) {
    const y = side * .48;
    if (throttle > .015) {
      const length = (.22 + throttle * .83) * (1 + .04 * Math.sin(tick * .8));
      ctx.fillStyle = '#688c9a'; ctx.globalAlpha = .35 * throttle;
      ctx.beginPath(); ctx.moveTo(-.72, y - .13); ctx.lineTo(-.83 - length, y); ctx.lineTo(-.72, y + .13); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#c7e6df';
      ctx.beginPath(); ctx.moveTo(-.75, y - .055); ctx.lineTo(-.85 - length * .62, y); ctx.lineTo(-.75, y + .055); ctx.fill();
    }
  }
  polygonPath(ctx, SHIP_HULL); ctx.fillStyle = '#293740'; ctx.fill();
  ctx.strokeStyle = ship.isFrozen ? '#83b9c8' : '#b6c4c4'; ctx.stroke();
  hullPanels.forEach((panel, index) => {
    polygonPath(ctx, panel); ctx.fillStyle = index === 2 ? '#899da4' : index === 0 ? '#647983' : '#455b67'; ctx.fill();
    ctx.strokeStyle = '#15232c'; ctx.stroke();
  });
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#17232d'; ctx.fillRect(-.73, side * .48 - .09, .38, .18);
    ctx.fillStyle = '#9db5ba'; ctx.fillRect(-.76, side * .48 - .075, .06, .15);
    ctx.fillStyle = '#d2a15c'; ctx.fillRect(-.22, side * .51 - .035, .16, .07);
    ctx.fillStyle = '#223641'; ctx.fillRect(-.48, side * .21 - .03, .15, .06);
  }
  // Armored cockpit, sharply contrasted with the load-bearing center spine.
  ctx.fillStyle = '#112b36'; ctx.fillRect(-.22, -.13, .35, .26);
  ctx.fillStyle = '#9bd0d0'; ctx.fillRect(.015, -.105, .065, .21);
  ctx.fillStyle = '#d5dddd'; ctx.fillRect(-.24, -.15, .33, .035);
  for (const mount of cannonMounts(ship.stats.multishotTier)) {
    const retract = recoil * .13;
    const width = cannonMounts(ship.stats.multishotTier).length > 5 ? .072 : .105;
    ctx.fillStyle = '#111d25'; ctx.fillRect(mount.x - .37, mount.y - width, .32, width * 2);
    ctx.fillStyle = '#7c9097'; ctx.fillRect(mount.x - .3 - retract, mount.y - width * .56, .3, width * 1.12);
    ctx.fillStyle = '#d7d7bf'; ctx.fillRect(mount.x - .06 - retract, mount.y - width * .65, .06, width * 1.3);
    ctx.fillStyle = `rgba(236,153,68,${.2 + heat * .8})`;
    ctx.fillRect(mount.x - .27, mount.y - width * .4, .08, width * .8);
    if (ship.stats.rangeTier > 0) {
      ctx.fillStyle = '#b8ccc5'; ctx.fillRect(mount.x - .26, mount.y - width, .2, .025);
    }
    if (recoil > .65) {
      const flash = (recoil - .65) / .35;
      ctx.fillStyle = '#ffc779'; ctx.globalAlpha = flash * .7;
      ctx.beginPath(); ctx.moveTo(mount.x, mount.y - .11 * flash);
      ctx.lineTo(mount.x + .35 * flash, mount.y); ctx.lineTo(mount.x, mount.y + .11 * flash); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff0ce';
      ctx.fillRect(mount.x, mount.y - .035, .15 * flash, .07);
    }
  }
  // Paired reaction jets show acceleration AND braking of rotation.
  const steering = ship.steeringJet ?? 0;
  if (Math.abs(steering) > .04) {
    const side = Math.sign(steering), strength = Math.abs(steering);
    ctx.fillStyle = '#b9d7d8'; ctx.globalAlpha = strength;
    for (const end of [-1, 1]) {
      const x = end * .44, y = -end * side * .55;
      ctx.beginPath(); ctx.moveTo(x - .055, y); ctx.lineTo(x, y - end * side * .24 * strength); ctx.lineTo(x + .055, y); ctx.fill();
    }
  }
  ctx.restore();
}

interface RockGeometry { facets: Vector[][]; craters: { x: number; y: number; r: number }[]; core: Vector }
const rockCache = new WeakMap<Vector[], RockGeometry>();
function rockGeometry(vertices: Vector[], radius: number): RockGeometry {
  const cached = rockCache.get(vertices); if (cached) return cached;
  const core = vertices.reduce((c, v) => ({ x: c.x + v.x / vertices.length, y: c.y + v.y / vertices.length }), { x: 0, y: 0 });
  const inner = vertices.map((v, i) => ({ x: core.x + (v.x - core.x) * (.48 + .08 * Math.sin(i * 3.1)), y: core.y + (v.y - core.y) * .54 }));
  const facets = vertices.map((v, i) => [v, vertices[(i + 1) % vertices.length], inner[(i + 1) % vertices.length], inner[i]]);
  const craters = Array.from({ length: Math.min(4, Math.floor(radius / 15)) }, (_, i) => {
    const angle = i * 2.39 + vertices[0].x;
    return { x: core.x + Math.cos(angle) * radius * .34, y: core.y + Math.sin(angle) * radius * .32, r: radius * (.09 + (i % 2) * .055) };
  });
  const geometry = { facets, craters, core }; rockCache.set(vertices, geometry); return geometry;
}

/** Local asteroid coordinates. Geometry is cached by its immutable vertex array. */
export function drawRock(ctx: CanvasRenderingContext2D, rock: Asteroid | TungstenShard, tick: number, reduced: boolean, detailed = true) {
  if (rock.vertices.length < 3) return;
  const surface = 'surface' in rock ? rock.surface : undefined;
  const source = surface?.vertices ?? rock.vertices, radius = surface?.radius ?? rock.radius;
  const palette = material(rock.type), geometry = rockGeometry(source, radius);
  const compact = !detailed || rock.radius < 24 || reduced;
  ctx.save();
  ctx.fillStyle = palette.body; paintPolygon(ctx, rock.vertices, 'fill');
  ctx.strokeStyle = palette.edge; ctx.lineWidth = 1.2; paintPolygon(ctx, rock.vertices, 'stroke');
  paintPolygon(ctx, rock.vertices, 'clip');
  ctx.save();
  if (surface) ctx.translate(-surface.offset.x, -surface.offset.y);
  geometry.facets.forEach((facet, i) => {
    if (compact && i % 3 !== 0) return;
    const v = source[i];
    const light = .28 + .36 * Math.max(0, Math.cos(Math.atan2(v.y, v.x) + rock.rotation + 2.3));
    ctx.fillStyle = palette.facet; ctx.globalAlpha = light + (i % 3) * .1; paintPolygon(ctx, facet, 'fill');
    if (!compact) { ctx.globalAlpha = .35; ctx.strokeStyle = palette.edge; ctx.lineWidth = .65; paintPolygon(ctx, facet, 'stroke'); }
  });
  ctx.globalAlpha = 1;
  if (rock.type === EntityType.Asteroid) {
    for (const [index, crater] of geometry.craters.entries()) {
      if (compact && index > 0) break;
      ctx.fillStyle = '#252e38'; ctx.beginPath(); ctx.ellipse(crater.x, crater.y, crater.r, crater.r * .73, -.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#65747b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(crater.x, crater.y, crater.r, crater.r * .73, -.5, .2, 2.7); ctx.stroke();
    }
  } else if (rock.type === EntityType.IronAsteroid || rock.type === EntityType.TungstenAsteroid || rock.type === EntityType.TungstenShard) {
    // Compression strata in metal; wide and sparse, not random hatch noise.
    ctx.strokeStyle = palette.edge; ctx.globalAlpha = .25; ctx.lineWidth = rock.type === EntityType.IronAsteroid ? 2.5 : 1.3;
    for (let i = -1; i <= 1; i++) {
      const y = i * radius * .32;
      ctx.beginPath(); ctx.moveTo(-radius, y - radius * .25); ctx.lineTo(radius, y + radius * .25); ctx.stroke();
    }
  } else {
    // Ice cleavage and molten fissures share structural seams but differ in material.
    ctx.strokeStyle = palette.cut; ctx.lineWidth = rock.type === EntityType.MoltenAsteroid ? 2 : 1;
    ctx.globalAlpha = rock.type === EntityType.MoltenAsteroid ? .7 + .1 * Math.sin(tick * .04 + ('pulsateOffset' in rock ? rock.pulsateOffset : 0)) : .45;
    for (let i = 0; i < source.length; i += 3) {
      const v = source[i], next = source[(i + 1) % source.length];
      ctx.beginPath(); ctx.moveTo(v.x * .87, v.y * .87); ctx.lineTo(next.x * .4, next.y * .4); ctx.lineTo(geometry.core.x, geometry.core.y); ctx.stroke();
    }
  }
  ctx.restore();
  if ('scars' in rock && rock.scars) {
    const damage = Number.isFinite(rock.maxHp) ? Math.max(0, 1 - rock.hp / rock.maxHp) : 0;
    for (const scar of rock.scars) {
      const end = { x: scar.x * (1 - damage * .85), y: scar.y * (1 - damage * .85) };
      ctx.globalAlpha = .9; ctx.strokeStyle = '#151c23'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(scar.x, scar.y); ctx.lineTo(end.x + scar.y * .08, end.y - scar.x * .08); ctx.lineTo(end.x * .85, end.y * .85); ctx.stroke();
      ctx.strokeStyle = palette.cut; ctx.globalAlpha = .45; ctx.lineWidth = .7; ctx.stroke();
    }
  }
  if (rock.hitFlash > 0) {
    polygonPath(ctx, rock.vertices); ctx.fillStyle = palette.cut;
    ctx.globalAlpha = (reduced ? .05 : .16) * Math.min(1, rock.hitFlash / 4); ctx.fill();
  }
  ctx.restore();
}

export function drawRound(ctx: CanvasRenderingContext2D, bullet: Bullet) {
  ctx.save();
  const power = Math.min(3, bullet.railTier ?? 0), tail = 10 + power * 2;
  if (bullet.isRicochet && bullet.trail && bullet.trail.length > 1) {
    ctx.strokeStyle = '#8fcac9'; ctx.globalAlpha = .4; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bullet.trail[0].x, bullet.trail[0].y);
    for (const point of bullet.trail) ctx.lineTo(point.x, point.y);
    ctx.lineTo(bullet.pos.x, bullet.pos.y); ctx.stroke();
  }
  ctx.translate(bullet.pos.x, bullet.pos.y); ctx.rotate(Math.atan2(bullet.vel.y, bullet.vel.x));
  ctx.globalAlpha = Math.min(1, bullet.life / 4);
  const r = Math.min(2.5, bullet.radius);
  ctx.fillStyle = bullet.isRicochet ? '#75bcbd' : '#b98c51';
  ctx.beginPath(); ctx.moveTo(-3, -r * .6); ctx.lineTo(-tail - 5, 0); ctx.lineTo(-3, r * .6); ctx.fill();
  ctx.fillStyle = bullet.isRicochet ? '#c8f2e9' : '#ffe4a9';
  ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-1.5, -r * .65); ctx.lineTo(-7 - power, -r * .65);
  ctx.lineTo(-7 - power, r * .65); ctx.lineTo(-1.5, r * .65); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff8df'; ctx.fillRect(-6, -.5, 5, 1);
  if (power > 0) { ctx.fillStyle = '#8cb1b0'; ctx.fillRect(-7 - power, -r, 2, r * 2); }
  ctx.restore();
}

export function drawResponses(ctx: CanvasRenderingContext2D, responses: FeelResponses) {
  for (const e of responses.effects) {
    const life = 1 - e.age / e.duration;
    ctx.save(); ctx.translate(e.pos.x, e.pos.y); ctx.rotate(e.angle);
    ctx.globalAlpha = e.kind === 'chunk' ? Math.min(.8, life * 2) : life;
    ctx.fillStyle = e.color; ctx.strokeStyle = e.color; ctx.lineWidth = 1;
    if (e.kind === 'chunk' && e.vertices) {
      polygonPath(ctx, e.vertices); ctx.fill(); ctx.strokeStyle = '#a39b84'; ctx.stroke();
      ctx.globalAlpha *= .3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(e.vertices[0].x, e.vertices[0].y); ctx.stroke();
    } else if (e.kind === 'chip') {
      ctx.beginPath(); ctx.moveTo(e.size, 0); ctx.lineTo(0, -e.size * .6); ctx.lineTo(-e.size, e.size * .5); ctx.lineTo(e.size * .4, e.size * .7); ctx.fill();
    } else if (e.kind === 'spark') {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-e.size * 3, 0); ctx.stroke();
    } else if (e.kind === 'wake') {
      ctx.globalAlpha *= .45; ctx.beginPath(); ctx.ellipse(0, 0, e.size * (2 - life), e.size * .6, 0, 1.8, 4.5); ctx.stroke();
    } else {
      ctx.globalAlpha *= .65; ctx.beginPath(); ctx.ellipse(0, 0, e.size * (1.4 - life), e.size * (1.4 - life) * .55, 0, .7, 5.5); ctx.stroke();
      if (e.age < 3) { ctx.fillStyle = '#ffe9bf'; ctx.fillRect(-2, -1, 5 * life, 2); }
    }
    ctx.restore();
  }
}
