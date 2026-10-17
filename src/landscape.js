import { hash, noise, fractal, elevation, planLandforms } from './terrain.js';

export const PAPER = '#eef0eb';
export const TILE_WIDTH = 960;
export const SCENE_HEIGHT = 1000;

function stroke(ctx, points, color, width = 1) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function polygon(ctx, points, fill, outline) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = .7;
    ctx.stroke();
  }
}

function pine(ctx, x, y, height, seed, opacity = 1) {
  ctx.save();
  ctx.globalAlpha = opacity;
  stroke(ctx, [[x, y], [x, y - height]], '#365762', .65);
  for (let branch = 0; branch < 9; branch++) {
    const t = branch / 9;
    const yy = y - height + height * t;
    const breadth = height * (.035 + t * .23);
    polygon(ctx, [[x, yy - 2], [x - breadth, yy + height * .19], [x + 1, yy + height * .12],
      [x + breadth * (.7 + hash(branch, seed) * .3), yy + height * .2]], '#365762');
  }
  ctx.restore();
}

function cabin(ctx, x, y, size, seed) {
  polygon(ctx, [[x, y], [x, y - size], [x + size, y - size], [x + size, y]], '#a34f43', '#5c5550');
  polygon(ctx, [[x + size, y], [x + size * 1.55, y - size * .22], [x + size * 1.55, y - size * 1.18], [x + size, y - size]], '#85493f');
  polygon(ctx, [[x - size * .16, y - size], [x + size * .48, y - size * 1.63], [x + size * 1.14, y - size]], '#48575a', '#304f5b');
  polygon(ctx, [[x + size * .48, y - size * 1.63], [x + size * 1.05, y - size * 1.85],
    [x + size * 1.68, y - size * 1.18], [x + size * 1.14, y - size]], '#526268');
  ctx.fillStyle = '#e3ded0';
  ctx.fillRect(x + size * .17, y - size * .76, size * .22, size * .26);
  ctx.fillRect(x + size * .67, y - size * .76, size * .18, size * .26);
  ctx.fillStyle = '#4c4d46';
  ctx.fillRect(x + size * .43, y - size * .44, size * .23, size * .44);
  for (let i = 0; i < 5; i++) {
    const yy = y - size * .12 - i * size * .16;
    stroke(ctx, [[x + 1, yy], [x + size - 1, yy]], '#643f3738', .5);
  }
  stroke(ctx, [[x - 5, y + 2], [x + size * 1.65, y + 2]], '#35515d', 1);
  for (let i = 0; i < 7; i++) {
    const rx = x + hash(i, seed) * size * 1.6;
    stroke(ctx, [[rx, y + 9 + i * 4], [rx + size * (.2 + hash(i + 11, seed)), y + 9 + i * 4]], '#a34f4330', 1.5);
  }
}

function outline(form) {
  const count = Math.ceil(form.width / 4);
  return Array.from({ length: count + 1 }, (_, i) => {
    const x = form.x - form.width / 2 + i / count * form.width;
    return [x, form.base - elevation(form, x)];
  });
}

function geology(ctx, form, points) {
  const { seed, x, width, height, base, layer } = form;
  const r = n => hash(n, seed);
  const shade = ['#789ba325', '#52788825', '#304f5b30', '#304f5b26'][layer];
  const ink = ['#829eab50', '#5e829270', '#3b607080', '#3c5b6560'][layer];
  const peaks = form.profile.filter((point, i, all) => i > 0 && i < all.length - 1
    && point[1] > all[i - 1][1] && point[1] > all[i + 1][1]);
  for (let peak = 0; peak < peaks.length; peak++) {
    const nominal = x + (peaks[peak][0] - .5) * width;
    let summit = nominal;
    for (let xx = nominal - width * .07; xx <= nominal + width * .07; xx += 4) {
      if (elevation(form, xx) > elevation(form, summit)) summit = xx;
    }
    const top = base - elevation(form, summit);
    const lean = (r(peak + 23) > .5 ? 1 : -1) * width * (.08 + r(peak + 24) * .26);
    polygon(ctx, [[summit, top], [summit + lean, base],
      [summit + lean * .26, base - height * .08]], shade);
    const lines = layer === 3 ? 7 : 10 + Math.floor(r(peak + 25) * 16);
    for (let line = 0; line < lines; line++) {
      const offset = (line / lines - .5) * width * (.045 + r(peak + 26) * .08);
      const length = .25 + r(line + peak * 103) * .72;
      const path = [];
      for (let step = 0; step <= 19; step++) {
        const t = step / 19 * length;
        const xx = summit + offset * (.3 + t * 2.3) + lean * Math.pow(t, 1.3)
          + (fractal(t * 5 + line * .08, seed + peak) - .5) * width * .035 * t;
        path.push([xx, top + (base - top) * t + noise(t * 16 + line, seed) * 4]);
      }
      stroke(ctx, path, ink, line % 5 ? .5 : .9);
    }
  }
  const contours = layer === 3 ? 3 : 4 + Math.floor(r(28) * 4);
  for (let band = 0; band < contours; band++) {
    const depth = .22 + band / contours * .65;
    const from = Math.floor(r(band + 310) * points.length * .35);
    const to = Math.ceil(points.length * (.65 + r(band + 320) * .35));
    stroke(ctx, points.slice(from, to).map(([px, py]) => [
      px + Math.sin(depth * 4) * width * .025,
      py * (1 - depth) + base * depth + noise(px / 75, seed + band) * 5,
    ]), ink, .45);
  }
}

function waterfall(ctx, form) {
  if (form.layer < 1 || form.layer > 2 || form.height < 280 || hash(501, form.seed) > .34) return;
  const x = form.x + (hash(502, form.seed) - .5) * form.width * .45;
  const top = form.base - elevation(form, x) + 26;
  if (form.base - top < 110) return;
  const paths = 1 + Math.floor(hash(503, form.seed) * 3);
  for (let fall = 0; fall < paths; fall++) {
    const path = [];
    const drift = (hash(504, form.seed) - .5) * 24;
    for (let y = top; y <= form.base - 2; y += 4) {
      const t = (y - top) / (form.base - top);
      path.push([x + fall * 4 + drift * t + Math.sin(t * 12 + fall) * (1 + t * 3), y]);
    }
    stroke(ctx, path, '#edf1e9aa', 1.3 + hash(fall + 505, form.seed) * 1.7);
  }
}

function lighthouse(ctx, x, y, size) {
  polygon(ctx, [[x - size * .2, y], [x - size * .14, y - size], [x + size * .14, y - size], [x + size * .2, y]], '#e8e9de', '#647b81');
  polygon(ctx, [[x - size * .2, y - size], [x, y - size * 1.22], [x + size * .2, y - size]], '#a34f43', '#5d5c54');
  ctx.fillStyle = '#405e68';
  ctx.fillRect(x - size * .08, y - size * .92, size * .16, size * .12);
  stroke(ctx, [[x - size * .17, y - size * .54], [x + size * .17, y - size * .54]], '#a34f43', size * .13);
}

function vegetationAndVillage(ctx, form) {
  const { seed, x, width, base, layer, region } = form;
  if (layer < 1) return;
  const r = n => hash(n, seed);
  const houses = [];
  if (layer >= 2 && width > 135 && r(600) < region.villages) {
    const count = 1 + Math.floor(r(601) ** 1.4 * (region.villages > .35 ? 9 : 3));
    const center = x + (r(602) - .5) * width * .4;
    for (let i = 0; i < count; i++) {
      const size = (layer === 3 ? 10 : 7) + r(610 + i) * 9;
      const px = center + (i - count / 2) * 25;
      if (elevation(form, px) > size * 1.8) houses.push({ x: px, size });
    }
  }
  const trees = Math.floor(width / (layer === 3 ? 9 : 12) * region.forest);
  for (let i = 0; i < trees; i++) {
    const px = x + (r(700 + i) - .5) * width * .92;
    if (houses.some(house => Math.abs(house.x - px) < house.size * 1.6)) continue;
    const surface = base - elevation(form, px);
    const y = Math.max(surface + 2, base - r(900 + i) * Math.min(form.height * .35, 100));
    const height = (layer === 3 ? 13 : 5) + r(1100 + i) * (layer === 3 ? 47 : 27);
    if (base - surface < height * .4) continue;
    pine(ctx, px, y, height, seed + i, layer === 1 ? .25 : .5 + r(i + 1300) * .35);
  }
  for (const house of houses) cabin(ctx, house.x, base - 3, house.size, seed);
  if (houses.length) {
    const pier = houses.at(-1).x + 40;
    stroke(ctx, [[pier, base - 1], [pier + 35, base + 5], [pier + 35, base + 10]], '#375561', 1.2);
  }
  if (layer === 3 && region.forest < .4 && r(1500) < .16 && width > 100) {
    const px = x + width * .18;
    lighthouse(ctx, px, base - elevation(form, px), 22 + r(1501) * 13);
  }
}

function landform(ctx, form) {
  const { x, width, base, layer, region } = form;
  const points = outline(form);
  const land = [...points, [x + width / 2, base + 3], [x - width / 2, base + 3]];
  const colors = ['#d0dce0', '#aec3cb', '#829fab', region.forest > .5 ? '#758f8d' : '#819497'];
  const inks = ['#a8bdc570', '#8aa5b199', '#45677699', '#3c5b6599'];
  ctx.save();
  polygon(ctx, land, colors[layer], inks[layer]);
  ctx.clip();
  geology(ctx, form, points);
  if (region.snow > .15 && form.height > 260) {
    const snowline = base - form.height * (.55 + (1 - region.snow) * .3);
    const snow = [...points];
    for (let i = points.length - 1; i >= 0; i--) {
      const [px, py] = points[i];
      snow.push([px, py + Math.max(0, snowline - py) * (.4 + noise(px / 25, form.seed) * .5)]);
    }
    polygon(ctx, snow, '#edf0e8d9');
  }
  waterfall(ctx, form);
  ctx.restore();
  stroke(ctx, [[x - width / 2, base + 3], [x + width / 2, base + 3]], inks[layer], .7);
  vegetationAndVillage(ctx, form);
}

function boat(ctx, x, y, seed) {
  const size = .65 + hash(8, seed) * .75;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  polygon(ctx, [[0, 0], [22, 0], [17, 5], [5, 5]], '#405e68');
  if (hash(9, seed) < .65) {
    stroke(ctx, [[12, 0], [12, -26]], '#526d75', .8);
    polygon(ctx, [[11, -25], [11, -3], [-1, -3]], '#f4f3eccc', '#82999d');
  } else {
    polygon(ctx, [[6, 0], [6, -6], [15, -6], [15, 0]], '#e1e7df', '#526d75');
  }
  stroke(ctx, [[-11, 10], [32, 10]], '#6e8a9338', .7);
  ctx.restore();
}

export function drawTile(ctx, tile, seed) {
  const origin = tile * TILE_WIDTH;
  const forms = planLandforms(origin, origin + TILE_WIDTH, seed);
  ctx.save();
  ctx.translate(-origin, 0);
  const sky = ctx.createLinearGradient(0, 100, 0, 870);
  sky.addColorStop(0, PAPER);
  sky.addColorStop(.65, '#e5ece8');
  sky.addColorStop(1, PAPER);
  ctx.fillStyle = sky;
  ctx.fillRect(origin, 0, TILE_WIDTH, SCENE_HEIGHT);

  for (const form of forms) {
    ctx.save();
    ctx.translate(0, form.base);
    ctx.scale(1, -.26);
    ctx.translate(0, -form.base);
    ctx.globalAlpha = .06 + form.layer * .022;
    polygon(ctx, [...outline(form), [form.x + form.width / 2, form.base], [form.x - form.width / 2, form.base]], '#668d9a');
    ctx.restore();
  }
  for (let cell = Math.floor((origin - 140) / 16); cell < (origin + TILE_WIDTH) / 16; cell++) {
    const x = cell * 16 + hash(cell, seed + 444) * 20;
    const y = 638 + hash(cell, seed + 449) * 250;
    const width = 5 + hash(cell, seed + 441) * 96;
    stroke(ctx, [[x, y], [x + width * .5, y - .4], [x + width, y]], '#5f869329', .5 + hash(cell, seed) * .4);
  }
  for (const form of forms) landform(ctx, form);

  for (let cell = Math.floor((origin - 160) / 1800); cell <= (origin + TILE_WIDTH + 160) / 1800; cell++) {
    const s = seed + cell * 1301;
    const x = (cell + .1 + hash(cell, seed + 9) * .8) * 1800;
    const y = 753 + hash(cell, seed + 78) * 67;
    if (hash(cell, seed + 8) < .5 && !forms.some(form => y <= form.base + 5 && y >= form.base - elevation(form, x) - 5)) {
      boat(ctx, x, y, s);
    }
    const birds = Math.floor(hash(cell, seed + 14) * 6);
    for (let bird = 0; bird < birds; bird++) {
      const bx = x + bird * 17 + hash(cell, seed) * 110;
      const by = 280 + hash(cell + bird, seed + 35) * 190;
      stroke(ctx, [[bx - 4, by + 1], [bx, by], [bx + 3, by + 2], [bx + 6, by], [bx + 10, by + 1]], '#42616e80', .8);
    }
  }
  for (let i = 0; i < 14000; i++) {
    const x = origin + hash(i, seed + tile * 109) * TILE_WIDTH;
    const y = hash(i, seed + tile * 109 + 17) * SCENE_HEIGHT;
    ctx.fillStyle = i % 2 ? '#304f5b09' : '#ffffff26';
    ctx.fillRect(x, y, .7, .7);
  }
  ctx.restore();
}
