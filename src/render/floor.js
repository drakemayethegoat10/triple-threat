import * as THREE from 'three';
import { reflector } from 'three/tsl';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { COURT, LANE } from '../sim/tuning.js';
import { drawLogo } from './arenas.js';
import { MARKS, courtMarks } from './markings.js';
import { FLOOR_FILES, assetUrl } from './assets.js';
import { QUALITY } from './quality.js';

// length, width: the floor, in metres: the court and the run-off round it. px: pixels of the paint's picture per metre.
// plank: metres one copy of the wood's pictures covers. full: pixels along each side of the wood's pictures as they
// come. paintGloss: how rough the paint is (the wood's own gloss comes from its picture). runOff: the stain on the
// floor outside the court's lines. lift: how far the paint lies above the wood, so the two never fight for the same depth.
// tone: what the wood's colour is multiplied by, to lighten the scanned walnut toward a court's maple.
// mirror: how much of the game's reflection the floor adds to itself, where a level has one. blur: how far that
// reflection is smeared, in pixels, on a level that draws it small.
const FLOOR = Object.freeze({ length: 32, width: 19, px: 64, plank: 1.7, full: 2048, paintGloss: 0.4, runOff: 'rgba(52, 34, 20, 0.6)', lift: 0.004,
  tone: Object.freeze([1.55, 1.45, 1.22]), mirror: 0.3, blur: 3 });

// A five-pointed star of radius `r` pixels at (x, y), on `g`, filled.
function star(g, x, y, r) {
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5, d = k % 2 ? r * 0.42 : r;
    g.lineTo(x + d * Math.cos(a), y + d * Math.sin(a));
  }
  g.closePath(); g.fill();
}

// The court's paint: every line, and a darker stain over the run-off; and the home arena's (`look`, see arenas.js): the
// lanes and the centre circle stained in its colours, its floor's apron, rings and art, its team's mark at centre
// court, its city along the baselines and its name along the sidelines. With `wood` the playing surface and the
// run-off are painted as wood-coloured blocks under the lines (the floor of the game before it had real wood, and
// still the floor if the wood's pictures cannot be loaded); without it everything but the paint is clear.
function paintCourt(wood, look) {
  const c = document.createElement('canvas');
  c.width = FLOOR.length * FLOOR.px; c.height = FLOOR.width * FLOOR.px;
  const g = c.getContext('2d'), PX = FLOOR.px, F = look.floor ?? {};
  const X = x => (x + FLOOR.length / 2) * PX, Z = z => (z + FLOOR.width / 2) * PX;
  const court = [X(-COURT.halfLength), Z(-COURT.halfWidth), 2 * COURT.halfLength * PX, 2 * COURT.halfWidth * PX];

  // The run-off: stained darker, or painted in the arena's apron colour (a little of the wood showing through).
  if (wood) {
    g.fillStyle = F.apron ?? '#5b4632'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#c99a5b'; g.fillRect(...court);                           // playing surface
  } else {
    g.globalAlpha = F.apron ? 0.94 : 1;
    g.fillStyle = F.apron ?? FLOOR.runOff; g.fillRect(0, 0, c.width, c.height);
    g.globalAlpha = 1;
    g.clearRect(...court);
  }
  // A parquet floor's seams, round every block.
  if (F.parquet) {
    g.strokeStyle = 'rgba(46, 24, 12, 0.4)'; g.lineWidth = 2;
    for (let x = -Math.floor(FLOOR.length / 2 / F.parquet) * F.parquet; x <= FLOOR.length / 2; x += F.parquet) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), c.height); g.stroke(); }
    for (let z = -Math.floor(FLOOR.width / 2 / F.parquet) * F.parquet; z <= FLOOR.width / 2; z += F.parquet) { g.beginPath(); g.moveTo(0, Z(z)); g.lineTo(c.width, Z(z)); g.stroke(); }
  }

  // The lanes stained in the home team's colour; the rings round the centre circle, and the circle itself.
  const L = COURT.halfLength, W = COURT.halfWidth;
  g.globalAlpha = look.colour.laneShade; g.fillStyle = look.colour.lane;
  for (const s of [1, -1]) g.fillRect(Math.min(X(s * L), X(s * (L - LANE.depth))), Z(-LANE.halfWidth), LANE.depth * PX, 2 * LANE.halfWidth * PX);
  if (F.ring) {
    g.strokeStyle = F.ring.colour; g.lineWidth = F.ring.width * PX;
    for (let k = 0; k < (F.ring.count ?? 1); k++) { g.beginPath(); g.arc(X(0), Z(0), (F.ring.r + k * (F.ring.gap ?? 0)) * PX, 0, 2 * Math.PI); g.stroke(); }
  }
  if (F.centre !== 'wood') { g.fillStyle = F.centre ?? look.colour.lane; g.beginPath(); g.arc(X(0), Z(0), LANE.centre * PX, 0, 2 * Math.PI); g.fill(); }
  g.globalAlpha = 1;
  const runEnd = (FLOOR.length / 2 + L) / 2, runSide = (FLOOR.width / 2 + W) / 2;
  // The art: stars beside the words (along each sideline and behind each baseline), or a mountain skyline behind each
  // baseline, its peaks toward the court.
  if (F.art?.kind === 'stars') {
    g.fillStyle = F.art.colour;
    for (const s of [1, -1]) for (const at of [7.2, 8.6, 10]) for (const t of [1, -1]) star(g, X(t * at), Z(s * runSide), 0.34 * PX);
    for (const s of [1, -1]) for (const at of [6.9, 8.3]) for (const t of [1, -1]) star(g, X(s * runEnd), Z(t * at), 0.34 * PX);
  }
  if (F.art?.kind === 'mountains') {
    const edge = FLOOR.length / 2, deep = edge - L, peaks = [0.35, 0.8, 0.5, 0.95, 0.6, 0.3, 0.75, 1, 0.55, 0.85, 0.4, 0.7, 0.45, 0.9, 0.5];
    for (const s of [1, -1]) {
      g.beginPath(); g.moveTo(X(s * edge), Z(-FLOOR.width / 2));
      peaks.forEach((h, k) => g.lineTo(X(s * (edge - deep * 0.92 * h)), Z(-FLOOR.width / 2 + ((k + 0.5) * FLOOR.width) / peaks.length)));
      g.lineTo(X(s * edge), Z(FLOOR.width / 2)); g.closePath();
      g.fillStyle = F.art.colour; g.fill();
      if (F.art.edge) { g.strokeStyle = F.art.edge; g.lineWidth = 0.06 * PX; g.stroke(); }
    }
  }
  // Or paint flung across the run-off: drops, a few of them big, on all four sides, thickest toward the corners. The
  // same drops every time (a seeded draw).
  if (F.art?.kind === 'splatter') {
    let seed = 4099;
    const next = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    g.fillStyle = F.art.colour;
    for (let k = 0; k < 480; k++) {
      const along = next() * 2 - 1, corner = Math.sign(along) * Math.abs(along) ** 0.6, side = next() < 0.5 ? -1 : 1, out = next();
      const [x, z] = k % 2 ? [side * (L + (FLOOR.length / 2 - L) * out), corner * (FLOOR.width / 2)] : [corner * (FLOOR.length / 2), side * (W + (FLOOR.width / 2 - W) * out)];
      g.beginPath(); g.arc(X(x), Z(z), (0.03 + 0.14 * next() ** 3) * PX, 0, 2 * Math.PI); g.fill();
    }
  }
  // The city along the run-off behind each baseline, read from the court; the arena's name along each sideline's.
  const words = (text, x, z, turn, high) => {
    g.save(); g.translate(X(x), Z(z)); g.rotate(turn);
    g.font = `italic 900 ${Math.round(high * PX)}px "Arial Narrow", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = F.words ?? look.colour.lane; g.globalAlpha = 0.85; g.fillText(text, 0, 0, 12 * PX); g.restore();
  };
  for (const s of [1, -1]) {
    words(look.city, s * runEnd, 0, s * Math.PI / 2, 1.0);
    words(look.name, 0, s * runSide, 0, 0.9);
  }
  g.globalAlpha = 1;

  // The lines and blocks of an NBA floor (see markings.js), in white.
  g.strokeStyle = g.fillStyle = '#ffffff'; g.lineWidth = MARKS.line * PX;
  for (const mark of courtMarks()) {
    g.beginPath();
    if (mark.kind === 'block') {
      const [[x1, z1], [x2, z2]] = [mark.from, mark.to];
      g.fillRect(Math.min(X(x1), X(x2)), Math.min(Z(z1), Z(z2)), Math.abs(X(x2) - X(x1)), Math.abs(Z(z2) - Z(z1)));
      continue;
    }
    g.setLineDash(mark.dashed ? [MARKS.dash * PX, MARKS.dash * PX] : []);
    if (mark.kind === 'line') { g.moveTo(X(mark.from[0]), Z(mark.from[1])); g.lineTo(X(mark.to[0]), Z(mark.to[1])); }
    else g.arc(X(mark.at[0]), Z(mark.at[1]), mark.r * PX, mark.from, mark.to);
    g.stroke();
  }
  g.setLineDash([]);
  // The home team's mark at centre court, over the lines, inside the circle.
  drawLogo(g, look.team, X(0), Z(0), 2 * (LANE.centre - 0.25) * PX);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// The floor as parquet: a sheet the size of the floor cut into blocks `block` metres square (from the middle of the
// court), each laid with the wood's pictures as the plain sheet has them (see wood) or, every other block, turned a
// quarter: under the pictures' repeat and turn, a block's coordinates are turned about its middle by M = [[0, -W/L],
// [L/W, 0]] (L, W: the floor's length and width).
function parquet(block) {
  const L = FLOOR.length, W = FLOOR.width, position = [], uv = [], index = [];
  const cuts = half => [-half, ...Array.from({ length: 2 * Math.ceil(half / block) + 1 }, (_, k) => (k - Math.ceil(half / block)) * block).filter(at => at > -half && at < half), half];
  const xs = cuts(L / 2), ys = cuts(W / 2);
  for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < ys.length; j++) {
    const [x0, x1, y0, y1] = [xs[i], xs[i + 1], ys[j], ys[j + 1]];
    const turned = ((Math.floor((x0 + x1) / 2 / block) + Math.floor((y0 + y1) / 2 / block)) % 2 + 2) % 2 === 1;
    const cu = (x0 + x1) / 2 / L + 0.5, cv = (y0 + y1) / 2 / W + 0.5, first = position.length / 3;
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) {
      const du = x / L + 0.5 - cu, dv = y / W + 0.5 - cv;
      position.push(x, y, 0);
      uv.push(...(turned ? [cu - (W / L) * dv, cv + (L / W) * du] : [cu + du, cv + dv]));
    }
    index.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(position.map((_, k) => (k % 3 === 2 ? 1 : 0)), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}

// A flat sheet the size of the floor, `lift` metres above the ground, that takes shadows.
function sheet(material, lift = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR.length, FLOOR.width), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = lift;
  mesh.receiveShadow = true;
  return mesh;
}

// One of the wood's pictures, repeated every FLOOR.plank metres, with the planks running along the court's length.
async function wood(path, colour) {
  const picture = await new THREE.TextureLoader().loadAsync(assetUrl(path));
  picture.wrapS = picture.wrapT = THREE.RepeatWrapping;
  picture.rotation = Math.PI / 2;   // as they come the planks run across the court
  picture.repeat.set(FLOOR.width / FLOOR.plank, FLOOR.length / FLOOR.plank);
  picture.anisotropy = 8;
  if (colour) picture.colorSpace = THREE.SRGBColorSpace;
  return picture;
}

// A copy of `picture` at `size` pixels a side, alike in everything else. The browser makes the smaller image a moment
// later; until then the copy shows the original's.
function shrunk(picture, size) {
  const copy = picture.clone();
  createImageBitmap(picture.image, { resizeWidth: size, resizeHeight: size, resizeQuality: 'high' }).then(image => {
    copy.source = new THREE.TextureSource(image);
    copy.needsUpdate = true;
  });
  return copy;
}

// The hall's floor, added to `scene`: scanned wood under the court's paint, dressed for the home arena (`look`, see
// arenas.js). Resolves to { setQuality(level), dress(look) }: the wood's pictures for a quality level (one of
// QUALITY.order), and the paint of another arena. If the wood's pictures cannot be loaded the floor is the painted one
// the game had before, and the game plays on.
export async function createFloor(scene, look) {
  let pictures;
  try {
    pictures = await Promise.all([wood(FLOOR_FILES.colour, true), wood(FLOOR_FILES.bumps), wood(FLOOR_FILES.gloss)]);
  } catch (error) {
    console.warn('The floor\'s wood could not be loaded; using the painted floor.', error);
    const painted = new THREE.MeshStandardMaterial({ map: paintCourt(true, look), roughness: 0.55 });
    scene.add(sheet(painted));
    return { setQuality: () => null, dress: to => { painted.map.dispose(); painted.map = paintCourt(true, to); painted.needsUpdate = true; } };
  }
  // Each picture at each size a level asks for: the full ones as they came, the smaller ones made here.
  const sizes = new Map([[FLOOR.full, pictures]]);
  for (const level of QUALITY.order) {
    const size = QUALITY[level].floor;
    if (!sizes.has(size)) sizes.set(size, pictures.map(picture => shrunk(picture, size)));
  }
  const planks = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(...FLOOR.tone), roughness: 1, metalness: 0 });
  const paint = new THREE.MeshStandardMaterial({ map: paintCourt(false, look), transparent: true, depthWrite: false, roughness: FLOOR.paintGloss });
  const boards = sheet(planks), plain = boards.geometry, blocks = {};
  scene.add(boards, sheet(paint, FLOOR.lift));
  // The wood as the arena `to` has it: its tone, and plain or parquet.
  const lay = to => {
    planks.color.setRGB(...(to.floor?.tone ?? FLOOR.tone));
    const block = to.floor?.parquet;
    boards.geometry = block ? (blocks[block] ??= parquet(block)) : plain;
  };
  lay(look);
  let mirror = null, smear = null;   // the floor's reflection of the game, on the levels that have one, and its blur
  return {
    // The court's paint for the arena `to`.
    dress(to) { paint.map.dispose(); paint.map = paintCourt(false, to); paint.needsUpdate = true; lay(to); },
    // The wood's pictures and the mirror of a level. Returns the words for what could not be done here, or null.
    setQuality(level) {
      [planks.map, planks.normalMap, planks.roughnessMap] = sizes.get(QUALITY[level].floor);
      if (mirror) { boards.remove(mirror.target); mirror.dispose(); smear?.dispose(); mirror = smear = null; planks.emissiveNode = null; }
      let failed = null;
      const size = QUALITY[level].mirror;
      if (size > 0) {
        try {
          // The scene is drawn again as the floor would mirror it, and that picture is added to the wood's own light.
          mirror = reflector({ resolutionScale: size });
          boards.add(mirror.target);
          smear = size < 1 ? gaussianBlur(mirror, null, FLOOR.blur) : null;
          planks.emissiveNode = (smear ?? mirror).rgb.mul(FLOOR.mirror);
        } catch (error) {
          console.warn('No floor reflections here.', error);
          if (mirror) boards.remove(mirror.target);
          mirror = smear = null; planks.emissiveNode = null; failed = 'floor reflections';
        }
      }
      planks.needsUpdate = true;
      return failed;
    },
  };
}
