// React + simulated DOM + real offscreen Canvas. This is not browser playtesting.
// Usage: node scripts/verify-runtime.mjs <temporary node_modules directory>
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url), modules = process.argv[2];
const { JSDOM } = require(join(modules, 'jsdom'));
const { createCanvas } = require(join(modules, '@napi-rs/canvas'));
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLCanvasElement', 'Event', 'MouseEvent', 'KeyboardEvent']) globalThis[name] = dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const runtimeErrors = [];
window.addEventListener('error', event => runtimeErrors.push(event.error));
let randomSeed = 71;
Math.random = () => { randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0; return randomSeed / 4294967296; };
Object.defineProperty(window, 'innerWidth', { value: 1280 }); Object.defineProperty(window, 'innerHeight', { value: 720 });
document.hasFocus = () => true;
const surfaces = new WeakMap();
HTMLCanvasElement.prototype.getContext = function () {
  if (!surfaces.has(this)) surfaces.set(this, createCanvas(this.width, this.height));
  const native = surfaces.get(this);
  if (native.width !== this.width) native.width = this.width;
  if (native.height !== this.height) native.height = this.height;
  const ctx = native.getContext('2d');
  const draw = ctx.drawImage.bind(ctx);
  return new Proxy(ctx, { get(target, name) {
    if (name === 'drawImage') return (source, ...args) => draw(surfaces.get(source) ?? source, ...args);
    const value = target[name]; return typeof value === 'function' ? value.bind(target) : value;
  }, set(target, name, value) { target[name] = value; return true; } });
};
let frameId = 0, now = 0;
const callbacks = new Map();
globalThis.requestAnimationFrame = fn => { callbacks.set(++frameId, fn); return frameId; };
globalThis.cancelAnimationFrame = id => callbacks.delete(id);
const dir = await mkdtemp(join(tmpdir(), 'neon-runtime-'));
const file = join(dir, 'runtime.mjs');
await build({ stdin: { contents: `export { default as App } from './App'; export { createElement, act } from 'react'; export { createRoot } from 'react-dom/client';`,
  resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', outfile: file,
  define: { 'process.env.NODE_ENV': '"development"' } });
const { App, act, createElement, createRoot } = await import(pathToFileURL(file).href);
const root = createRoot(document.getElementById('root'));
await act(() => root.render(createElement(App)));
const click = async text => {
  const button = [...document.querySelectorAll('button')].find(b => b.textContent.includes(text));
  assert(button, `Missing button ${text}`); await act(() => button.click());
};
const key = async (code, up = false) => act(() => document.querySelector('canvas').dispatchEvent(new KeyboardEvent(up ? 'keyup' : 'keydown', { code, bubbles: true })));
const frames = async count => {
  for (let i = 0; i < count; i++) await act(() => {
    const batch = [...callbacks.values()]; callbacks.clear(); now += 1000 / 60;
    for (const fn of batch) fn(now);
  });
};
const change = async (label, value) => {
  const input = document.querySelector(`[aria-label="${label}"]`);
  assert(input, `Missing field ${label}`);
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set;
  await act(() => { setter.call(input, value); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
};
await frames(2); await click('INITIATE LAUNCH'); await frames(90);
assert(!document.body.textContent.includes('INITIATE LAUNCH'));
await key('ArrowUp'); await key('ArrowRight'); await frames(75); await key('ArrowUp', true); await key('ArrowRight', true);
await key('KeyP'); assert(document.body.textContent.includes('PAUSED'));
await frames(30); await key('KeyP'); assert(!document.body.textContent.includes('PAUSED'));
// Restart component to exercise the developer menu from a clean run.
await act(() => root.render(null)); await act(() => root.render(createElement(App)));
await click('Dev Mode'); await click('Sandbox Mode'); await click('INITIATE LAUNCH'); await frames(2);
assert(document.querySelector('[aria-label="Experiment console"]'));
await change('Split Shot', '5'); await change('Hyper-Cooling', '10'); await change('Magnetic Rails', '6'); await change('Ricochet', '4');
await click('Reset trial'); await frames(150);
assert(!document.body.textContent.includes('CRITICAL FAILURE'));
await key('KeyP');
await mkdir('docs', { recursive: true });
await writeFile('docs/mass-mayhem-runtime.png', surfaces.get(document.querySelector('canvas')).toBuffer('image/png'));
await key('KeyP');
for (const type of ['MOLTEN', 'FROZEN', 'IRON', 'TUNGSTEN']) {
  await change('Material', type); await change('Size', '4'); await click('Reset trial'); await frames(240);
}
await click('Effects: full'); assert(document.body.textContent.includes('Effects: reduced'));
await click('Exit'); assert(document.body.textContent.includes('INITIATE LAUNCH'));
await click('Sandbox Mode');
// Start level overrides still open the ordinary upgrade-selection loop.
const level = document.querySelector('input[type="range"]');
await act(() => { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(level), 'value').set.call(level, '3'); level.dispatchEvent(new Event('input', { bubbles: true })); });
await click('INITIATE LAUNCH');
assert(document.body.textContent.includes('POINTS REMAINING'));
for (let i = 0; i < 2; i++) {
  const upgrade = [...document.querySelectorAll('button')].find(b => b.textContent.includes('LVL UP'));
  assert(upgrade, 'Upgrade choice missing'); await act(() => upgrade.click());
}
await frames(120); assert(!document.body.textContent.includes('POINTS REMAINING'));
await act(() => root.unmount()); assert.equal(callbacks.size, 0);
console.log('PASS: launch, steering, pause/resume, lab equipment/reset, every material, reduced effects, exit, upgrade sequence, RAF cleanup.');
console.log('Canvas-only runtime capture: docs/mass-mayhem-runtime.png. DOM harness does not verify CSS layout or browser input feel.');

assert.deepEqual(runtimeErrors, []);
dom.window.close();
// React's Node scheduler can retain a MessagePort after root cleanup.
process.exit(0);
