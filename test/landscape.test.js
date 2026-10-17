import test from 'node:test';
import assert from 'node:assert/strict';
import { drawTile, TILE_WIDTH, SCENE_HEIGHT } from '../src/landscape.js';
import { hash, noise, fractal, elevation, regionAt, planLandforms, REGION_WIDTH, MAX_LANDFORM_RADIUS } from '../src/terrain.js';

test('seeded randomness is deterministic and bounded at positive and negative coordinates', () => {
  for (let x = -200; x <= 200; x++) {
    assert.equal(hash(x, 42), hash(x, 42));
    assert.ok(hash(x, 42) >= 0 && hash(x, 42) < 1);
  }
  assert.notEqual(hash(7, 42), hash(7, 43));
});

test('noise and regional parameters stay continuous across world and tile boundaries', () => {
  for (const x of [-TILE_WIDTH, -1, 0, 1, TILE_WIDTH, TILE_WIDTH * 10]) {
    assert.ok(Math.abs(noise(x - .0001, 42) - noise(x + .0001, 42)) < .001);
    assert.ok(Math.abs(fractal(x - .0001, 42) - fractal(x + .0001, 42)) < .001);
  }
  for (let x = -REGION_WIDTH * 7; x <= REGION_WIDTH * 7; x += 5) {
    const a = regionAt(x, 42);
    const b = regionAt(x + .001, 42);
    for (const key of ['height', 'density', 'islands', 'snow', 'forest', 'villages']) {
      assert.ok(Math.abs(a[key] - b[key]) < .001, `${key} jumps at ${x}`);
    }
  }
});

test('landform planning is deterministic, independent of viewport size, order, and tile boundaries', () => {
  for (const seed of [0, 42, 427, 2147483647]) {
    const world = planLandforms(-6000, 6000, seed);
    const byId = new Map(world.map(form => [form.id, form]));
    for (const start of [0, -960, 2880, -4800, 960]) {
      const forms = planLandforms(start, start + TILE_WIDTH, seed);
      assert.equal(new Set(forms.map(form => form.id)).size, forms.length);
      for (const form of forms) assert.deepEqual(form, byId.get(form.id));
      const expected = world.filter(form => form.x + form.width / 2 + 80 >= start
        && form.x - form.width / 2 - 80 <= start + TILE_WIDTH);
      assert.deepEqual(forms, expected);
    }
  }
});

test('silhouettes have bounded support and continuous, finite geometry at any world position', () => {
  for (const start of [-1e8, -10000, -960, 0, 960, 10000, 1e8]) {
    const forms = planLandforms(start, start + TILE_WIDTH, 427);
    for (const form of forms) {
      assert.ok(form.width / 2 + 80 <= MAX_LANDFORM_RADIUS);
      assert.equal(elevation(form, form.x - form.width), 0);
      assert.equal(elevation(form, form.x + form.width), 0);
      for (let i = 0; i <= 40; i++) {
        const x = form.x + (i / 40 - .5) * form.width;
        const height = elevation(form, x);
        assert.ok(Number.isFinite(height) && height >= 0 && height < SCENE_HEIGHT);
        assert.ok(Math.abs(height - elevation(form, x + .0001)) < .01);
      }
    }
  }
});

test('scrolling changes composition, not just small ridge details', () => {
  for (const seed of [0, 42, 427, 2147483647]) {
    const regions = new Set();
    const shapes = new Set();
    const coverages = [];
    const heights = [];
    const counts = [];
    for (let start = 0; start < REGION_WIDTH * 6; start += 1200) {
      regions.add(regionAt(start + 600, seed).type);
      const forms = planLandforms(start, start + 1200, seed)
        .filter(form => form.x + form.width / 2 > start && form.x - form.width / 2 < start + 1200);
      forms.forEach(form => shapes.add(form.shape));
      const samples = [];
      for (let x = start; x < start + 1200; x += 20) {
        samples.push(Math.max(0, ...forms.filter(form => form.layer < 3).map(form => elevation(form, x))));
      }
      heights.push(Math.max(...samples));
      coverages.push(samples.filter(height => height > 30).length / samples.length);
      counts.push(forms.length);
    }
    assert.equal(regions.size, 6, `Seed ${seed} should visit all six coastal regions`);
    assert.ok(shapes.size >= 5, `Seed ${seed} needs distinct mountain morphologies`);
    assert.ok(Math.max(...heights) - Math.min(...heights) > 250, `Seed ${seed} needs tall and low scenery`);
    assert.ok(Math.max(...coverages) - Math.min(...coverages) > .55, `Seed ${seed} needs open sea and enclosed fjords`);
    assert.ok(Math.max(...counts) - Math.min(...counts) >= 3, `Seed ${seed} needs different landform densities`);
  }
});

test('new seeds change landform placement and region sequences', () => {
  const signatures = new Set();
  for (let seed = 0; seed < 25; seed++) {
    signatures.add(JSON.stringify(planLandforms(0, TILE_WIDTH * 2, seed)));
  }
  assert.equal(signatures.size, 25);
});

test('the entire renderer produces finite geometry for either direction and different seeds', () => {
  let paths = 0;
  const context = new Proxy({}, {
    get(_, name) {
      if (name === 'createLinearGradient') return () => ({ addColorStop() {} });
      return (...args) => {
        for (const arg of args) {
          if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${name} received invalid geometry`);
        }
        paths++;
      };
    },
    set() { return true; },
  });
  for (const seed of [0, 42, 2147483647]) {
    for (const tile of [-2, 0, 2, 6, 10, 14]) drawTile(context, tile, seed);
  }
  assert.ok(paths > 100000);
});
