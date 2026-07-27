const SIZE = 56;
const PAD = 5;

function inkPoints(imageData) {
  const points = [];
  const { data, width, height } = imageData;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (data[i + 3] > 30 && (data[i] + data[i + 1] + data[i + 2]) < 600) points.push([x, y]);
    }
  }
  return points;
}

function normalize(points) {
  if (points.length < 20) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const scale = (SIZE - PAD * 2) / Math.max(width, height);
  const offsetX = (SIZE - width * scale) / 2;
  const offsetY = (SIZE - height * scale) / 2;
  const cells = new Set();
  for (const [x, y] of points) {
    const nx = Math.round((x - minX) * scale + offsetX);
    const ny = Math.round((y - minY) * scale + offsetY);
    cells.add(ny * SIZE + nx);
  }
  return [...cells].map(n => [n % SIZE, Math.floor(n / SIZE)]);
}

function renderTemplate(char) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#202137';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "900 200px 'Noto Sans JP', 'Hiragino Sans', sans-serif";
  ctx.fillText(char, 128, 130);
  return normalize(inkPoints(ctx.getImageData(0, 0, 256, 256)));
}

function directedDistance(from, to) {
  if (!from.length || !to.length) return 1;
  let total = 0;
  const sampleStep = Math.max(1, Math.floor(from.length / 550));
  let count = 0;
  for (let i = 0; i < from.length; i += sampleStep) {
    const [x, y] = from[i];
    let best = 100;
    for (const [tx, ty] of to) {
      const distance = (x - tx) ** 2 + (y - ty) ** 2;
      if (distance < best) best = distance;
      if (best === 0) break;
    }
    total += Math.sqrt(best);
    count += 1;
  }
  return total / count / 10;
}

function distance(a, b) {
  return directedDistance(a, b) * .58 + directedDistance(b, a) * .42;
}

export async function recognizeKana(canvas, candidates) {
  if (document.fonts?.ready) await document.fonts.ready;
  const ctx = canvas.getContext('2d');
  const drawn = normalize(inkPoints(ctx.getImageData(0, 0, canvas.width, canvas.height)));
  if (drawn.length < 12) return { status: 'empty', confidence: 0 };
  const ranked = candidates
    .map(candidate => ({ ...candidate, distance: distance(drawn, renderTemplate(candidate.char)) }))
    .sort((a, b) => a.distance - b.distance);
  const best = ranked[0];
  const second = ranked[1];
  const separation = second ? Math.max(0, second.distance - best.distance) : .2;
  const confidence = Math.round(Math.max(12, Math.min(98, 100 - best.distance * 72 + separation * 35)));
  return {
    status: best.distance > .78 ? 'uncertain' : 'recognized',
    char: best.char,
    script: best.script,
    confidence,
    distance: best.distance
  };
}
