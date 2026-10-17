import { drawTile, PAPER, TILE_WIDTH, SCENE_HEIGHT } from './landscape.js';
import { regionAt } from './terrain.js';

const canvas = document.querySelector('#landscape');
const ctx = canvas.getContext('2d');
const status = document.querySelector('#status');
const params = new URLSearchParams(location.search);
const initialSeed = Number(params.get('seed'));
let seed = params.has('seed') && Number.isSafeInteger(initialSeed) && initialSeed >= 0 && initialSeed <= 0x7fffffff
  ? initialSeed : randomSeed();
let position = Number(params.get('x')) || 0;
position = Math.max(-1e8, Math.min(1e8, position));
let width = 0;
let height = 0;
let scale = 1;
let frame = 0;
let urlTimer;
let statusTimer;
let drag;
const cache = new Map();
const MAX_TILES = 8;

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;
}

function notify(message) {
  clearTimeout(statusTimer);
  status.textContent = message;
  statusTimer = setTimeout(() => { status.textContent = ''; }, 5500);
}

function persist() {
  const url = new URL(location.href);
  url.searchParams.set('seed', seed);
  url.searchParams.set('x', Math.round(position));
  history.replaceState(null, '', url);
}

function tileAt(index) {
  if (cache.has(index)) {
    const tile = cache.get(index);
    cache.delete(index);
    cache.set(index, tile);
    return tile;
  }
  const tile = document.createElement('canvas');
  tile.width = TILE_WIDTH * 2;
  tile.height = SCENE_HEIGHT * 2;
  const tileContext = tile.getContext('2d');
  tileContext.scale(2, 2);
  drawTile(tileContext, index, seed);
  cache.set(index, tile);
  if (cache.size > MAX_TILES) cache.delete(cache.keys().next().value);
  return tile;
}

function render() {
  frame = 0;
  const dpr = canvas.width / width;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);
  scale = Math.max(height / SCENE_HEIGHT, .62);
  const offsetY = (height - SCENE_HEIGHT * scale) * .40;
  const first = Math.floor(position / TILE_WIDTH);
  const last = Math.floor((position + width / scale) / TILE_WIDTH);
  for (let i = first; i <= last; i++) {
    const left = (i * TILE_WIDTH - position) * scale;
    const right = ((i + 1) * TILE_WIDTH - position) * scale;
    ctx.drawImage(tileAt(i), left, offsetY, right - left + .3, SCENE_HEIGHT * scale);
  }
  const kilometers = Math.round(position / 160) / 10;
  document.querySelector('#distance').textContent = `${kilometers.toFixed(1)} km`;
  document.querySelector('#place-name').textContent = regionAt(position + width / scale / 2, seed).label;
}

function scheduleRender() {
  if (!frame) frame = requestAnimationFrame(render);
}

function move(delta) {
  position = Math.max(-1e8, Math.min(1e8, position + delta));
  scheduleRender();
  clearTimeout(urlTimer);
  urlTimer = setTimeout(persist, 250);
}

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  scheduleRender();
}

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  drag = { id: event.pointerId, x: event.clientX };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('dragging');
  canvas.focus({ preventScroll: true });
});
canvas.addEventListener('pointermove', event => {
  if (!drag || drag.id !== event.pointerId) return;
  move((drag.x - event.clientX) / scale);
  drag.x = event.clientX;
});
function endDrag(event) {
  if (!drag || drag.id !== event.pointerId) return;
  drag = undefined;
  canvas.classList.remove('dragging');
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('lostpointercapture', endDrag);
canvas.addEventListener('wheel', event => {
  if (event.ctrlKey) return;
  event.preventDefault();
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? width : 1;
  move(delta * unit / scale);
}, { passive: false });

document.querySelector('#go-left').addEventListener('click', () => move(-width * .6 / scale));
document.querySelector('#go-right').addEventListener('click', () => move(width * .6 / scale));
document.querySelector('#new-landscape').addEventListener('click', () => {
  seed = randomSeed();
  position = 0;
  cache.clear();
  persist();
  scheduleRender();
});

const about = document.querySelector('#about');
document.querySelector('#about-open').addEventListener('click', () => about.showModal());
document.querySelector('#about-close').addEventListener('click', () => about.close());
about.addEventListener('click', event => {
  const box = about.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) about.close();
});
document.addEventListener('keydown', event => {
  if (about.open || event.altKey || event.metaKey || event.ctrlKey) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    move((event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 360 : 90));
  } else if (event.key === 'Home') {
    event.preventDefault();
    move(-position);
  }
});

document.querySelector('#save').addEventListener('click', async () => {
  try {
    if (frame) {
      cancelAnimationFrame(frame);
      render();
    }
    const blob = await new Promise((resolve, reject) => canvas.toBlob(
      result => result ? resolve(result) : reject(new Error('The browser could not encode the drawing.')),
      'image/png',
    ));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `infinite-fjords-${seed}-${Math.round(position)}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    notify('Download started.');
  } catch (error) {
    console.error('Drawing export failed:', error);
    notify('Could not save the drawing. Try again or take a screenshot.');
  }
});
window.addEventListener('resize', resize);
persist();
resize();
