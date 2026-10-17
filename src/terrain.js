export const REGION_WIDTH = 2400;
export const MAX_LANDFORM_RADIUS = 900;

const REGIONS = [
  { type: 'alpine', label: 'Alpine fjords', height: 1, density: .92, islands: .25, forest: .35, snow: .9, villages: .24, shapes: ['alpine', 'needle', 'valley'] },
  { type: 'skerries', label: 'Skerries', height: .3, density: .25, islands: .92, forest: .16, snow: 0, villages: .46, shapes: ['rounded', 'cliff'] },
  { type: 'plateau', label: 'Mountain plateaus', height: .85, density: .82, islands: .18, forest: .2, snow: .55, villages: .12, shapes: ['plateau', 'cliff'] },
  { type: 'woodland', label: 'Forest fjords', height: .58, density: .72, islands: .6, forest: .95, snow: .05, villages: .55, shapes: ['rounded', 'valley'] },
  { type: 'open-coast', label: 'Open coast', height: .4, density: .13, islands: .3, forest: .04, snow: 0, villages: .16, shapes: ['cliff', 'rounded'] },
  { type: 'glacial', label: 'Glacial valleys', height: 1.05, density: .86, islands: .12, forest: .27, snow: 1, villages: .16, shapes: ['valley', 'alpine', 'plateau'] },
];

export function hash(value, seed = 0) {
  let n = Math.imul(value ^ seed, 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = t => t * t * (3 - 2 * t);

export function noise(x, seed) {
  const i = Math.floor(x);
  return mix(hash(i, seed), hash(i + 1, seed), smoothstep(x - i));
}

export function fractal(x, seed, octaves = 4) {
  let value = 0;
  let weight = 0;
  let amplitude = 1;
  for (let i = 0; i < octaves; i++) {
    value += noise(x, seed + i * 1013) * amplitude;
    weight += amplitude;
    amplitude *= .48;
    x *= 2.13;
  }
  return value / weight;
}

function regionDefinition(index, seed) {
  const block = Math.floor(index / REGIONS.length);
  const bag = [...REGIONS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(hash(block * 31 + i, seed + 301) * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag[index - block * REGIONS.length];
}

function regionBoundary(index, seed) {
  return index * REGION_WIDTH + (hash(index, seed + 907) - .5) * 700;
}

export function regionAt(x, seed) {
  let index = Math.floor(x / REGION_WIDTH);
  while (x < regionBoundary(index, seed)) index--;
  while (x >= regionBoundary(index + 1, seed)) index++;
  const region = regionDefinition(index, seed);
  const left = regionBoundary(index, seed);
  const right = regionBoundary(index + 1, seed);
  const transition = 420;
  const neighbor = x - left < transition ? index - 1 : index + 1;
  const distance = Math.min(x - left, right - x);
  const t = distance < transition ? .5 * (1 - smoothstep(distance / transition)) : 0;
  const other = regionDefinition(neighbor, seed);
  const blended = { ...region };
  for (const key of ['height', 'density', 'islands', 'forest', 'snow', 'villages']) {
    blended[key] = mix(region[key], other[key], t);
  }
  return blended;
}

function profile(shape, seed) {
  const r = n => hash(n, seed);
  if (shape === 'plateau' || shape === 'cliff') {
    const edge = shape === 'cliff' ? .04 + r(1) * .09 : .14 + r(1) * .12;
    return [[0, 0], [edge, .82], [.32, .88 + r(2) * .12], [.57, .83 + r(3) * .17],
      [.76, .8 + r(4) * .12], [.91, .12 + r(5) * .5], [1, 0]];
  }
  if (shape === 'valley') {
    return [[0, 0], [.1, .32], [.21 + r(1) * .06, .85 + r(2) * .15],
      [.4, .23 + r(3) * .1], [.53, .15], [.64, .23], [.78 + r(4) * .07, .8 + r(5) * .2],
      [.95, .28], [1, 0]];
  }
  if (shape === 'needle') {
    return [[0, 0], [.15, .12], [.32, .32], [.43 + r(1) * .2, 1],
      [.69, .36 + r(2) * .15], [.86, .18], [1, 0]];
  }
  const count = shape === 'rounded' ? 5 : 7 + Math.floor(r(1) * 5);
  const points = [[0, 0]];
  const summit = 1 + Math.floor(r(2) * (count - 2));
  for (let i = 1; i < count; i++) {
    const t = (i + (r(i + 10) - .5) * .55) / count;
    points.push([t, i === summit ? 1 : Math.pow(Math.sin(t * Math.PI), .6) * (.28 + r(i + 30) * .65)]);
  }
  return [...points, [1, 0]];
}

export function elevation(form, x) {
  const u = (x - form.x) / form.width + .5;
  if (u <= 0 || u >= 1) return 0;
  const envelope = Math.sin(u * Math.PI);
  const warped = Math.max(0, Math.min(1, u + (fractal(u * 5, form.seed) - .5) * .14 * envelope));
  const points = form.profile;
  let i = 1;
  while (i < points.length - 1 && points[i][0] < warped) i++;
  const [ax, ay] = points[i - 1];
  const [bx, by] = points[i];
  let t = (warped - ax) / (bx - ax);
  if (form.shape === 'rounded' || form.shape === 'valley') t = smoothstep(t);
  const detail = (fractal(x / 46, form.seed + 53, 3) - .5) * form.roughness * envelope;
  return Math.max(0, mix(ay, by, t) * form.height + detail);
}

// Every candidate belongs to a world cell, not a render tile. Query order cannot change the coast.
export function planLandforms(start, end, seed) {
  const forms = [];
  const layers = [
    { spacing: 760, base: 619, height: .59, width: 1.35, density: .95 },
    { spacing: 950, base: 670, height: .86, width: 1.25, density: .88 },
    { spacing: 1120, base: 735, height: 1.04, width: 1.03, density: .8 },
    { spacing: 460, base: 811, height: .2, width: .63, density: 1 },
  ];
  for (let layer = 0; layer < layers.length; layer++) {
    const settings = layers[layer];
    const first = Math.floor((start - MAX_LANDFORM_RADIUS) / settings.spacing) - 1;
    const last = Math.ceil((end + MAX_LANDFORM_RADIUS) / settings.spacing) + 1;
    for (let cell = first; cell <= last; cell++) {
      const s = (seed + layer * 104729) | 0;
      const r = n => hash(cell * 97 + n, s);
      const x = (cell + .12 + r(1) * .76) * settings.spacing;
      const region = regionAt(x, seed);
      const island = layer === 3;
      const density = island ? region.islands : region.density * settings.density;
      if (r(2) > density) continue;
      let width = (330 + r(3) * 730) * settings.width;
      let height = (240 + r(4) * 380) * region.height * settings.height;
      let shape = region.shapes[Math.floor(r(5) * region.shapes.length)];
      if (island) {
        width = 65 + r(3) ** 1.6 * 610;
        height = 10 + r(4) ** 2 * 105;
        shape = r(5) < .8 ? 'rounded' : 'cliff';
      } else if (shape === 'needle') {
        width *= .7;
      } else if (shape === 'plateau' || shape === 'valley') {
        width *= 1.2;
      }
      const base = settings.base + (r(6) - .5) * (island ? 62 : 46);
      height = Math.min(height, base - 115);
      const form = {
        id: `${layer}:${cell}`, seed: Math.floor(r(7) * 0x7fffffff),
        x, width, height, base, layer, shape, region,
        roughness: island ? 7 : 10 + r(8) * (shape === 'rounded' ? 12 : 43),
      };
      form.profile = profile(shape, form.seed);
      if (x + width / 2 + 80 >= start && x - width / 2 - 80 <= end) forms.push(form);
    }
  }
  return forms.sort((a, b) => a.base - b.base || a.layer - b.layer || a.x - b.x);
}
