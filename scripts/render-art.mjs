// Optional verification tool. Usage: node scripts/render-art.mjs <canvas module directory>
// The game itself has no dependency on this renderer or its output.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { createCanvas } = require(process.argv[2] || '@napi-rs/canvas');
const temp = await mkdtemp(join(tmpdir(), 'neon-art-'));
const bundle = join(temp, 'art.mjs');
await build({ stdin: { contents: `export * from './game/drawing'; export * from './game/rockwork';
  export * from './game/responses'; export * from './game/testFixtures'; export * from './types';`,
  resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', outfile: bundle });
const art = await import(pathToFileURL(bundle).href);
globalThis.document = { createElement: () => createCanvas(1, 1) };
const canvas = createCanvas(1280, 760), ctx = canvas.getContext('2d');
ctx.fillStyle = '#080e17'; ctx.fillRect(0, 0, 1280, 760);
const label = (text, x, y, color = '#849aaa', size = 12) => {
  ctx.fillStyle = color; ctx.font = `${size}px monospace`; ctx.fillText(text, x, y);
};
label('NEON VOID / MASS & MAYHEM', 32, 40, '#e7d5b4', 22);
label('PROCEDURAL ART CHECK · 1:1 gameplay scale · staged scene, not a browser capture', 32, 64);
const response = new art.CombatResponses();
const ship = art.makeShip(); ship.pos = { x: 260, y: 250 }; ship.radius = 19; ship.drive = .9; ship.turnJet = -.7;
ship.stats.multishotTier = 2; ship.vel = { x: 3, y: 1 };
for (let i = 0; i < 3; i++) response.emit({ type: 'discharge', mount: i });
const makeRock = (x, y, radius, type, id) => {
  const rock = art.makeAsteroid(id, x, radius); rock.pos.y = y; rock.type = type;
  rock.sizeCategory = radius > 80 ? 4 : radius > 50 ? 3 : radius > 25 ? 2 : 1;
  let seed = 42 + x;
  rock.vertices = art.rockOutline(radius, radius > 50 ? 14 : 10, type, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;
  });
  return rock;
};
const rock = makeRock(604, 238, 99, art.EntityType.Asteroid, 'impact'); rock.hp = 8; rock.maxHp = 40;
rock.wounds = [{ x: -88, y: -9, angle: 0 }];
const frozen = makeRock(905, 195, 45, art.EntityType.FrozenAsteroid, 'ice');
const molten = makeRock(1080, 355, 64, art.EntityType.MoltenAsteroid, 'lava');
const parent = makeRock(770, 365, 48, art.EntityType.Asteroid, 'break');
response.emit({ type: 'break', rock: parent, fragments: art.cleaveRock(parent, 5), solid: false });
response.emit({ type: 'strike', point: { x: 514, y: 229 }, velocity: { x: 13, y: 0 }, damage: 24, material: art.EntityType.Asteroid });
for (let i = 0; i < 9; i++) response.tick();
response.emit({ type: 'discharge', mount: 1 });
// Rendering must not sample randomness or advance simulation.
Math.random = () => { throw new Error('Render sampled randomness'); };
art.paintRock(ctx, rock, 120, false); art.paintRock(ctx, frozen, 120, false); art.paintRock(ctx, molten, 120, false);
art.paintGunship(ctx, ship, response, 120); art.paintResponses(ctx, response);
for (const x of [340, 418, 488]) {
  const bullet = art.makeBullet(); bullet.pos = { x, y: 248 }; bullet.vel = { x: 13, y: 0 }; bullet.rail = 2;
  art.paintSlug(ctx, bullet);
}
label('HEAVY ESCORT / THREE-GUN BANK', 170, 310);
label('PARENT-SHAPE BREAKUP', 680, 460);
ctx.fillStyle = '#142331'; ctx.fillRect(32, 504, 1216, 1);
label('BATTERY EVOLUTION · ACTUAL SIZE', 32, 536, '#d8c19d');
for (let tier = 0; tier < 6; tier++) {
  ship.pos = { x: 90 + tier * 100, y: 600 }; ship.rotation = -.7; ship.stats.multishotTier = tier; ship.drive = 0; ship.turnJet = 0;
  response.clear(); art.paintGunship(ctx, ship, response, 0); label(`${tier + 1} GUN${tier ? 'S' : ''}`, 65 + tier * 100, 650);
}
label('MATERIAL SILHOUETTES', 710, 536, '#d8c19d');
const materials = [art.EntityType.Asteroid, art.EntityType.MoltenAsteroid, art.EntityType.FrozenAsteroid, art.EntityType.IronAsteroid, art.EntityType.TungstenAsteroid];
for (let i = 0; i < materials.length; i++) {
  const a = makeRock(750 + i * 105, 600, 30, materials[i], `sample-${i}`);
  art.paintRock(ctx, a, 0, true);
  label(['ROCK', 'MOLTEN', 'FROZEN', 'IRON', 'TUNGSTEN'][i], 720 + i * 105, 650);
}
label('Blue propulsion / cream armor / steel machinery / heated ballistic rounds', 32, 716);
await mkdir('docs', { recursive: true });
await writeFile('docs/mass-mayhem-art.png', canvas.toBuffer('image/png'));
console.log('Saved docs/mass-mayhem-art.png; rendering consumed no randomness.');

// A software-Canvas stress probe, not a browser FPS claim. Warm every texture,
// then time the cached render path at the declared entity/effect limits.
const stressRocks = Array.from({ length: 120 }, (_, i) => makeRock(40 + (i % 15) * 85,
  35 + Math.floor(i / 15) * 88, 28 + (i % 4) * 12, materials[i % materials.length], `stress-${i}`));
const rounds = Array.from({ length: 256 }, (_, i) => {
  const b = art.makeBullet(); b.pos = { x: i * 47 % 1280, y: i * 23 % 760 }; b.vel = { x: 13, y: 2 }; return b;
});
response.clear();
for (let i = 0; i < 180; i++) response.emit({ type: 'strike', point: { x: i * 61 % 1280, y: i * 47 % 760 }, velocity: { x: 13, y: 0 }, material: art.EntityType.Asteroid, damage: 16 });
const renderStress = () => {
  ctx.fillStyle = '#080e17'; ctx.fillRect(0, 0, 1280, 760);
  for (const a of stressRocks) art.paintRock(ctx, a, 120, false);
  for (const b of rounds) art.paintSlug(ctx, b);
  art.paintResponses(ctx, response);
};
renderStress();
const start = performance.now();
for (let frame = 0; frame < 60; frame++) renderStress();
console.log(`Software-Canvas cached stress render: ${((performance.now() - start) / 60).toFixed(2)} ms/frame (120 rocks, 256 rounds, 180 effects).`);
