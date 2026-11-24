import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BALL, MOVES } from '../sim/tuning.js';
import { TEAMS, ownModels } from '../sim/teams.js';
import { clone as cloneRig } from 'three/addons/utils/SkeletonUtils.js';
import { onFloor, personOf } from '../sim/state.js';
import { moodOf } from '../sim/mood.js';
import { assetUrl, modelFile } from './assets.js';
import { MOTION, REACTION_CLIPS, legMotion, armMotion, legLook, newMarks, noteChanges, drawnFacing, wholeBody } from './motion.js';
import { BALL_IN_HAND, ballHands, crossFrom, dribbleSpot, moveSpot } from './hands.js';
import { checkGaits, checkMotions, checkFacts, personName, numberSeed, courtPeople, sideId, sized, missingPeople, checkHands, bodiesOf } from './checks.js';
import { easeFacing, leanOf, lookTarget, headTurn, easeHead } from './bearing.js';
import { createAnimator, poseClip } from './animator.js';
import { createFace, faceWants } from './face.js';
import { createSweat } from './sweat.js';
import { ATLAS, KIT, atlasPart, atlasRect, atlasUV, gearColour, kitOps, heightOps, kitColours, kitName, paintKit, paintSocks, sockColour, normalFromHeight } from './kit.js';
import { MATERIALS, kitMaterial, partMaterial, hairMaterial, gearMaterial, skinMaterial, fabricTiles, isPhysical, isDetailed } from './materials.js';
import { QUALITY, modelFor } from './quality.js';

// The size of each garment's painted picture at full quality, in pixels along each side.
const GARMENT = Object.freeze({ jersey: 1024, shorts: 512 });
// The hair styles modelled in the build, named in their material (hair-fade-player-0-4); the rest are the pack's.
const MODELLED = Object.freeze(['buzz', 'fade', 'curls', 'twists', 'locs', 'cornrows']);

const KEEP = 4;   // the most teams whose people are kept made, besides those in use
const IDLE = Object.freeze({ clip: 'idle', rate: 1 });   // what everyone's legs do before and after a match
const UPRIGHT = Object.freeze({ forward: 0, side: 0 }), AHEAD = Object.freeze({ yaw: 0, pitch: 0 });
const hipsOf = root => root.getObjectByProperty('isBone', true);   // the first bone under a root: the others hang from it

// Where the palm of the hand bone `hand` is on the court, { x, y, z }: the wrist's place moved BALL_IN_HAND.palm
// toward the fingers, along the bone's own +y axis. Each person is scaled, so that axis is measured out in metres on
// the court, not in lengths of his bone.
const toFingers = new THREE.Vector3();
function palmOf(hand) {
  hand.updateWorldMatrix(true, false);   // the motion has just moved the bones, and nothing has been drawn since
  const at = hand.matrixWorld.elements;
  toFingers.set(at[4], at[5], at[6]).setLength(BALL_IN_HAND.palm);
  return { x: at[12] + toFingers.x, y: at[13] + toFingers.y, z: at[14] + toFingers.z };
}

async function json(path) {
  const response = await fetch(assetUrl(path));
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

// Loads the generated players and their motions. Resolves to ten groups, one per court player, a `prepare` that makes
// the people of the teams a match is between (each in his own body or a stand-in's: see bodiesOf), an `update` that
// places each from the match, puts the model of whoever plays there in it and plays the motions his state calls for,
// and a `setQuality` that dresses them for a quality level. Each is drawn in full near `camera` and as his far
// model, one mesh in one picture, beyond (see modelFor). Rejects if a file is missing or incomplete.
export async function loadPeople(camera) {
  const loader = new GLTFLoader();
  const [players, motion, facts] = await Promise.all([
    loader.loadAsync(assetUrl('assets/players.glb')),
    loader.loadAsync(assetUrl('assets/motion.glb')),
    json('assets/motion.json'),
  ]);
  const roots = players.scene.children.filter(o => o.name.startsWith('player-'));
  const rootOf = Object.fromEntries(roots.map(root => [root.name, root]));
  const missing = missingPeople(roots.map(root => root.name));
  if (missing.length) throw new Error(`assets/players.glb lacks ${missing.join(', ')}`);
  const clips = Object.fromEntries(motion.animations.map(clip => [clip.name, clip]));
  checkMotions(Object.keys(clips));
  checkGaits(facts);
  checkFacts(facts);
  const hipHeight = hipsOf(motion.scene).position.y;   // of the player the motions were made on, standing at rest

  const tiles = fabricTiles(path => new THREE.TextureLoader().load(assetUrl(path)));

  // What is made for one person, to be let go of with him: `dressed`, [mesh, its material at each quality level] for
  // each of his meshes; the `textures` and `geometries` made for him; and `pending`, his pictures still being made.
  const madeFor = () => ({ dressed: [], textures: [], geometries: [], pending: [] });

  // A picture painted with `ops` in `colours`, `size` pixels each way, as a texture: handed over as an image made off
  // the main thread, so that showing a player for the first time does not stall. Kept in `own` (see madeFor).
  function picture(ops, colours, size, own) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    paintKit(canvas.getContext('2d'), size, ops, colours);
    const made = new THREE.Texture();
    made.flipY = false;   // as in the file, where the top row of a picture is v = 0
    made.colorSpace = THREE.SRGBColorSpace;
    made.anisotropy = 4;
    own.textures.push(made);
    own.pending.push(createImageBitmap(canvas).then(image => { made.image = image; made.needsUpdate = true; }));
    return made;
  }

  // The file's shoes' picture (`map`) with his socks repainted in `colour` (see paintSocks), as a texture of his own:
  // the file's is shared with every other copy of the body.
  function socked(map, colour, own) {
    const image = map?.image;
    if (!image) return map;
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const g = canvas.getContext('2d');
    g.drawImage(image, 0, 0);
    paintSocks(g, image, [0, 0, canvas.width, canvas.height], colour);
    const made = new THREE.Texture();
    Object.assign(made, { flipY: map.flipY, colorSpace: map.colorSpace, wrapS: map.wrapS, wrapT: map.wrapT, anisotropy: 4 });
    own.textures.push(made);
    own.pending.push(createImageBitmap(canvas).then(bitmap => { made.image = bitmap; made.needsUpdate = true; }));
    return made;
  }

  // What stands out of a garment (its lettering and stitching) in `kit`, as a normal map.
  function raised(part, number, team, own, kit) {
    const size = KIT.size, canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    paintKit(g, size, heightOps(part, number, team, kit), kitColours(0));
    const made = new THREE.DataTexture(normalFromHeight(g.getImageData(0, 0, size, size).data, size), size, size, THREE.RGBAFormat);
    made.flipY = false;
    made.colorSpace = THREE.NoColorSpace;
    made.magFilter = THREE.LinearFilter; made.minFilter = THREE.LinearMipmapLinearFilter; made.generateMipmaps = true;
    made.needsUpdate = true;
    own.textures.push(made);
    return made;
  }

  // A mesh's material at each quality level: plain, detailed and physical, each shared by the levels that use it.
  const atEachLevel = make => {
    const made = {};
    return Object.fromEntries(QUALITY.order.map(level => {
      const kind = isPhysical(level) ? 'physical' : isDetailed(level) ? 'detailed' : 'plain';
      made[kind] ??= make(level);
      return [level, made[kind]];
    }));
  };

  // His far model's one picture at `scale` times ATLAS.size: the skin, hair and shoes of the file (his socks repainted:
  // see paintSocks) and his `kit` in `colours` (see kitColours), each drawn in its own place (see ATLAS). `drawn` is
  // { part: the file's picture of it }. A garment's cell is filled to its edges first, its gutter too, so that nothing
  // clear is blended into its picture's edges when it is shrunk (the picture is drawn only where it is opaque).
  function onePicture(drawn, team, number, colours, scale, own, kit) {
    const canvas = document.createElement('canvas'), size = Math.round(ATLAS.size * scale);
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    for (const part of Object.keys(ATLAS.cells)) {
      const [x, y, w, h] = atlasRect(part).map(n => n * size);
      if (part === 'jersey' || part === 'shorts') {
        const [cx, cy, cw, ch] = ATLAS.cells[part].map(n => n * size);
        g.fillStyle = colours.team; g.fillRect(cx, cy, cw, ch);
        g.save();
        g.translate(x, y); g.scale(w / KIT.size, h / KIT.size);
        paintKit(g, KIT.size, kitOps(part, number, team, kit), colours);
        g.restore();
      } else if (part === 'gear') {
        KIT.gear.order.forEach((colour, k) => { g.fillStyle = gearColour(colour, team); g.fillRect(x + (k * w) / 3, y, w / 3, h); });
      } else if (drawn[part]) {
        g.drawImage(drawn[part], x, y, w, h);
        if (part === 'shoes') paintSocks(g, drawn[part], [x, y, w, h], sockColour(colours));
      }
    }
    const made = new THREE.Texture();
    made.flipY = false;
    made.colorSpace = THREE.SRGBColorSpace;
    made.anisotropy = 4;
    own.textures.push(made);
    own.pending.push(createImageBitmap(canvas).then(image => { made.image = image; made.needsUpdate = true; }));
    return made;
  }

  // How rough each part of the far model is, as a tiny picture laid out like ATLAS.cells (quarters across, halves
  // down): the green of a pixel is the roughness there.
  const roughness = (() => {
    const rough = { skin: MATERIALS.skin, jersey: MATERIALS.rough.jersey, shorts: MATERIALS.rough.shorts, hair: MATERIALS.hair, shoes: MATERIALS.shoes };
    const canvas = document.createElement('canvas');
    canvas.width = 4; canvas.height = 2;
    const g = canvas.getContext('2d');
    for (const [part, [x, y, w, h]] of Object.entries(ATLAS.cells)) {
      g.fillStyle = `rgb(0, ${Math.round(rough[part] * 255)}, 0)`;
      g.fillRect(x * 4, y * 2, w * 4, h * 2);
    }
    const made = new THREE.CanvasTexture(canvas);
    made.flipY = false;
    made.magFilter = made.minFilter = THREE.NearestFilter;
    made.generateMipmaps = false;
    return made;
  })();

  // The far model: `parts` ([mesh, its place in ATLAS, its material's name in the file]) joined into one mesh on the same skeleton, wearing one picture.
  // Each part is one more thing to draw in every pass; joined, the whole player is drawn at once.
  function farModel(parts, drawn, team, number, colours, own, kit) {
    const whole = mergeGeometries(parts.map(([part, place, name]) => {
      const from = part.geometry, uv = from.getAttribute('uv'), geometry = new THREE.BufferGeometry();
      // Every part's numbers in the same form, so that they can be joined; its picture's points moved to its place.
      const floats = (attribute, size) => new THREE.Float32BufferAttribute(Float32Array.from({ length: attribute.count * size }, (_, i) => attribute.getComponent(Math.floor(i / size), i % size)), size);
      geometry.setAttribute('position', floats(from.getAttribute('position'), 3));
      geometry.setAttribute('normal', floats(from.getAttribute('normal'), 3));
      // Gear has no picture: all of a piece takes the swatch of its colour (gear-<item>-<colour>-...).
      const swatch = place === 'gear' ? (KIT.gear.order.indexOf(name.split('-')[2]) + 0.5) / 3 : null;
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(Array.from({ length: uv.count }, (_, i) => (swatch === null ? atlasUV(place, uv.getX(i), uv.getY(i)) : atlasUV('gear', swatch, 0.5))).flat(), 2));
      const joints = from.getAttribute('skinIndex');
      geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from({ length: joints.count * 4 }, (_, i) => joints.getComponent(Math.floor(i / 4), i % 4)), 4));
      geometry.setAttribute('skinWeight', floats(from.getAttribute('skinWeight'), 4));
      geometry.setIndex(Array.from(from.getIndex().array));
      return geometry;
    }));
    if (!whole) throw new Error('the parts of a player could not be joined');
    own.geometries.push(whole);
    const byScale = {};
    // Cut-outs instead of blending for the hair: no sorting artefacts, and it writes depth like everything else.
    const made = Object.fromEntries(QUALITY.order.map(level => [level, byScale[QUALITY[level].textures] ??= new THREE.MeshStandardMaterial({
      map: onePicture(drawn, team, number, colours, QUALITY[level].textures, own, kit), roughnessMap: roughness, roughness: 1, metalness: 0, alphaTest: MATERIALS.cutout, side: THREE.DoubleSide,
    })]));
    const [first] = parts[0], far = new THREE.SkinnedMesh(whole, made[level]);
    far.name = 'far';
    far.bind(first.skeleton, first.bindMatrix);
    far.castShadow = true;
    far.frustumCulled = false;
    far.visible = false;
    first.parent.add(far);
    own.dressed.push([far, made]);
    return far;
  }

  // One model and animator per person, made once for as long as his team is kept: a substitution only changes who is
  // shown. `model` is his own copy of a body from the file, `size` times as tall as it is drawn; `index` tells him
  // from the others; `kit` is the kit he wears (see kitName). His skin, kit, hair and shoes are meshes of their own on his skeleton, each in its own material:
  // that is his near model. His far model is the same parts joined. The body's shapes and the file's pictures are
  // shared with every other copy of it; what is made for him alone is in `own` (see madeFor).
  function person(model, team, number, index, size = 1, kit = 'own') {
    const near = [], parts = [], drawn = {}, simplified = [], own = madeFor(), colours = kitColours(team, kit);
    model.scale.multiplyScalar(size);   // simplified: the parts of his far level of detail in the file
    // A mesh of the file's far level of detail: under the node named <player>-far.
    const ofFar = mesh => { for (let o = mesh; o && o !== model; o = o.parent) if (o.name.endsWith('-far')) return true; return false; };
    let skin = null;   // the mesh that carries his expressions
    const wet = [];    // the sweat uniforms of his materials (see sweat.js)
    model.traverse(part => {
      // GLTFLoader numbers the bone names that repeat in the file (mixamorigHips_1); the motions look for the plain ones.
      if (part.isBone) part.name = THREE.PropertyBinding.sanitizeNodeName(part.userData.name);
      if (!part.isMesh) return;
      const kind = part.material.name.split('-')[0];
      const place = atlasPart(part.material.name);
      if (ofFar(part)) { if (place) simplified.push([part, place, part.material.name]); return; }
      if (place) parts.push([part, place, part.material.name]);
      if (place && part.material.map) drawn[place] = part.material.map.image;
      let made;
      if (kind === 'jersey' || kind === 'shorts') {
        const normal = raised(kind, number, team, own, kit), sizes = {};
        made = atEachLevel(level => {
          const pixels = Math.round(GARMENT[kind] * QUALITY[level].textures);
          sizes[pixels] ??= picture(kitOps(kind, number, team, kit), colours, pixels, own);
          return kitMaterial(level, { part: kind, map: sizes[pixels], normal, fabric: kind === 'jersey' ? tiles.knit : tiles.twill });
        });
      } else if (kind === 'skin') {
        made = atEachLevel(level => skinMaterial(level, { map: part.material.map, normalMap: part.material.normalMap, pores: tiles.pores.normal }));
      } else if (kind === 'gear') {
        const colour = gearColour(part.material.name.split('-')[2], team);
        made = atEachLevel(level => gearMaterial(level, colour));
      } else if (kind === 'hair' && MODELLED.includes(part.material.name.split('-')[1])) {
        made = atEachLevel(level => hairMaterial(level, { map: part.material.map, strands: tiles.strands }));
      } else if (kind === 'shoes') {
        const map = socked(part.material.map, sockColour(colours), own);
        made = atEachLevel(level => partMaterial(level, kind, map, part.material.normalMap));
      } else made = atEachLevel(level => partMaterial(level, kind, part.material.map, part.material.normalMap));
      part.material = made[level];   // the file's own material is shared with the body's other copies, and left as it is
      part.castShadow = kind !== 'cornea';
      part.frustumCulled = false;   // its bounds are those of the rest pose, not of where the motion puts it
      own.dressed.push([part, made]);
      near.push(part);
      for (const m of new Set(Object.values(made))) if (m.userData.sweat?.isNode) wet.push(m.userData.sweat);
      // The file gives every part the expressions' targets, all still but the skin's: only the skin keeps them.
      if (kind === 'skin') skin = part;
      else if (part.morphTargetInfluences) { part.geometry.morphAttributes = {}; part.morphTargetInfluences = undefined; part.morphTargetDictionary = undefined; }
    });
    if (!parts.length) throw new Error(`${model.name} has nothing to draw`);
    // His far model is made from the file's simplified parts (or, in a file without them, from these).
    const far = farModel(simplified.length ? simplified : parts, drawn, team, number, colours, own, kit);
    for (const [mesh] of simplified) mesh.removeFromParent();   // their shapes are the body's, shared with its other copies
    // His body's size against the player the motions were made on: what the motions are fitted to. Scaled by `size`
    // on top, his strides cover that much more ground.
    const scale = hipsOf(model).position.y / hipHeight;
    const hands = { left: model.getObjectByName('mixamorigLeftHand'), right: model.getObjectByName('mixamorigRightHand') };
    checkHands(model.name, hands);   // so a broken file falls back to capsules at load, not on the first possession
    // arms: the arm motion he was given on the last frame, or null when his arms followed his legs.
    return { team, number, kit, outfit: outfitOf(team, kit), model, scale, hands, near, far, wet, own, drawnAs: 'near', face: createFace(skin, team * 100 + numberSeed(number)), animator: createAnimator(model, clips, facts, scale, index), gaits: sized(facts.gaits, scale * size), last: 'idle', arms: null };
  }
  // Lets go of a person: his model leaves the court, and what was made for him alone is freed.
  function drop(he) {
    he.model.removeFromParent();
    for (const [, made] of he.own.dressed) for (const material of new Set(Object.values(made))) material.dispose();
    for (const texture of he.own.textures) texture.dispose();
    for (const geometry of he.own.geometries) geometry.dispose();
    he.model.traverse(part => part.skeleton?.dispose());
  }
  // Shows his `which` model ('near' or 'far') and hides the other.
  const wear = (he, which) => {
    if (he.drawnAs === which) return;
    for (const mesh of he.near) mesh.visible = which === 'near';
    he.far.visible = which === 'far';
    he.drawnAs = which;
  };
  let level = 'high';   // the quality level the players are dressed for
  const sweat = createSweat();
  // A team in one of its kits (see kitName), 'id/kit': its people are made, kept and let go of together.
  const outfitOf = (id, kit) => `${id}/${kit}`;
  const keyOf = (id, number, kit) => `${personName(id, number)}/${kit}`;
  // The outfits of a match between teams `ids` (by side) with side `home` at home.
  const outfitsOf = (ids, home) => ids.map((id, side) => [id, kitName(id, side, home)]);
  const people = new Map();   // every person made, by keyOf
  const used = new Map();     // when each outfit with people made was last used, by `clock`
  const making = new Map();   // the people being made, by keyOf: the promise of each
  const holds = new Map();    // how many pictures of an outfit's people are out (see portrait)
  let clock = 0, queue = Promise.resolve(), preparing = null;
  const touch = outfit => used.set(outfit, ++clock);
  const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));
  // A league player's own model, from his own file (see modelFile), loaded once while he is kept: the promise of
  // { root, gltf }, or of null when the file is missing or broken (he then stands in another's body: see bodiesOf).
  const files = new Map();   // by personName
  function fileOf(id, number) {
    const name = personName(id, number);
    if (!files.has(name)) {
      const file = modelFile(TEAMS[id], number);
      files.set(name, loader.loadAsync(assetUrl(file)).then(gltf => {
        const root = gltf.scene.children.find(o => o.name.startsWith('player-'));
        if (!root) throw new Error(`${file} has no player`);
        return { root, gltf };
      }).catch(error => { console.warn(`${file} could not be loaded; he stands in another's body.`, error); return null; }));
    }
    return files.get(name);
  }
  // Frees his file's shapes and pictures once neither of his kits is kept (each copy of him shared them).
  function unload(he) {
    const name = personName(he.team, he.number);
    if (!ownModels(TEAMS[he.team]) || [...people.values()].some(o => o.team === he.team && o.number === he.number) || [...making.keys()].some(k => k.startsWith(`${name}/`))) return;
    const file = files.get(name);
    files.delete(name);
    file?.then(loaded => loaded?.gltf.scene.traverse(part => {
      part.geometry?.dispose();
      for (const material of [part.material ?? []].flat()) {
        for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
        material.dispose();
      }
    }));
  }
  // Makes the player numbered `number` of team `id` in `kit`, once; resolves to him: in his own model, or for a team
  // without models (or one whose file failed) in a stand-in's body. People are made one at a time, each in a task of
  // his own, so that frames are drawn in between; a league player's file is fetched meanwhile.
  function make(id, number, kit) {
    const key = keyOf(id, number, kit);
    if (people.has(key)) return Promise.resolve(people.get(key));
    if (!making.has(key)) {
      const own = ownModels(TEAMS[id]) ? fileOf(id, number) : null;
      const made = queue.then(nextTask).then(async () => {
        const row = TEAMS[id].players.findIndex(p => p.number === number), file = await own;
        const { body, size } = file ? { body: null, size: 1 } : bodiesOf(id)[row];
        const he = person(cloneRig(file ? file.root : rootOf[body]), id, number, id * 10 + row, size, kit);
        await Promise.all(he.own.pending);
        people.set(key, he);
        touch(he.outfit);
        return he;
      }).finally(() => making.delete(key));
      queue = made.catch(() => {});
      making.set(key, made);
    }
    return making.get(key);
  }

  const models = Array.from({ length: 10 }, () => new THREE.Group());   // one for each player a match can have; a smaller match uses the first of them
  const shown = [];   // the person whose model is in each group
  // How each group's player was drawn on the last frame: the heading the group was turned to (null before the first),
  // how far his body tipped, where his head looked, and his velocity { vx, vz }.
  const bearings = models.map(() => ({ heading: null, lean: UPRIGHT, head: AHEAD, was: null }));
  let marks = newMarks();   // what is remembered from frame to frame, for one match
  let cross = null;   // a dribbled ball crossing from one hand to the other, as crossFrom remembers it; null when none is
  // The hands its holder carries the ball in on this frame, as ballHands gives them, or null when nobody holds it and
  // on the start and final screens, where it is not drawn in them.
  const handsOf = state => {
    const id = state.ball.holder;
    return id === null || state.phase === 'start' || state.phase === 'final' || !shown[id] ? null : ballHands(shown[id].arms.clip);
  };
  // Lets go of the people of the outfits used longest ago while more than KEEP have people made; never of the outfits
  // `keep`, those on the court, or those with a picture out.
  function trim(keep) {
    const busy = new Set([...keep, ...shown.filter(Boolean).map(he => he.outfit), ...[...holds].filter(([, n]) => n > 0).map(([outfit]) => outfit)]);
    const spare = [...used].filter(([outfit]) => !busy.has(outfit)).sort((a, b) => a[1] - b[1]);
    for (const [outfit] of spare.slice(0, Math.max(0, used.size - KEEP))) {
      for (const [key, he] of people) if (he.outfit === outfit) { drop(he); people.delete(key); unload(he); }
      used.delete(outfit);
    }
  }

  return {
    models,
    // Makes every player not made yet of a match between the teams `ids` (team ids, by side), side `home` at home,
    // each in his side's kit, one at a time between frames, and resolves once all are; then lets go of the outfits used
    // longest ago (see trim). Asked again for the same match, it is the same.
    prepare(ids, home = 0) {
      const outfits = outfitsOf(ids, home), key = outfits.join();
      if (preparing?.key !== key || preparing.failed) {
        const done = Promise.all(outfits.flatMap(([id, kit]) => TEAMS[id].players.map(p => make(id, p.number, kit)))).then(() => trim(outfits.map(([id, kit]) => outfitOf(id, kit))));
        preparing = { key, done };
        done.catch(() => { preparing.failed = true; });
      }
      return preparing.done;
    },
    // Whether every player of such a match is made.
    ready: (ids, home = 0) => outfitsOf(ids, home).every(([id, kit]) => TEAMS[id].players.every(p => people.has(keyOf(id, p.number, kit)))),
    // How many of such a match's players are made: { done, total }.
    count(ids, home = 0) {
      const all = outfitsOf(ids, home).flatMap(([id, kit]) => TEAMS[id].players.map(p => keyOf(id, p.number, kit)));
      return { done: all.filter(key => people.has(key)).length, total: all.length };
    },
    // A copy of the player numbered `number` of team `id` (its place in TEAMS) in his `where` kit ('home' or 'road'),
    // standing in the idle motion, for a picture of him off the court (see studio.js); or null while he is still being
    // made (asking makes him). Returns { model, mixer, release }: the copy, what moves it, to be moved on each frame,
    // and what lets go of it. The copy shares his geometry and his pictures, so his outfit is kept while it is out.
    portrait(id, number, where = 'home') {
      const kit = kitName(id, where === 'home' ? 0 : 1, 0), he = people.get(keyOf(id, number, kit));
      if (!he) { make(id, number, kit).catch(error => console.warn(error)); return null; }
      const model = cloneRig(he.model);
      model.traverse(part => { if (part.isMesh) part.visible = part.name !== 'far'; });
      model.position.set(0, 0, 0); model.rotation.set(0, 0, 0);
      const mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(poseClip(clips.idle, he.scale)).play();
      touch(he.outfit);
      holds.set(he.outfit, (holds.get(he.outfit) ?? 0) + 1);
      return { model, mixer, release() { holds.set(he.outfit, holds.get(he.outfit) - 1); model.traverse(part => part.skeleton?.dispose()); } };
    },
    // level: one of QUALITY.order. The bench changes too, so a substitute comes on in the right pictures.
    setQuality(now) {
      level = now;
      for (const he of people.values()) for (const [mesh, made] of he.own.dressed) mesh.material = made[level];
    },
    // dt: the time that passed this frame, in seconds (zero while paused, so the motion pauses too).
    // `show`: who the broadcast has celebrating and dejected, { celebrate, dejected } by player id, or null.
    update(state, dt, show = null) {
      // Before and after a match nobody moves, whatever speed the last step left him with: everyone stands, and
      // nothing of that match is remembered into the next.
      const standing = state.phase === 'start' || state.phase === 'final';
      if (!standing) noteChanges(marks, state, dt);
      else if (marks.was) marks = newMarks();
      marks.show = show;
      sweat.update(state);
      courtPeople(state).forEach((who, i) => {
        const player = state.players[i], group = models[i], side = player.team;
        const he = people.get(`${who}/${kitName(sideId(state, side), side, state.home ?? 0)}`);
        // Someone not made yet (see prepare) is not drawn.
        if (!he) {
          if (shown[i]?.model.parent === group) group.remove(shown[i].model);
          shown[i] = null;
          return;
        }
        if (used.has(he.outfit)) used.set(he.outfit, clock);
        // The first frame, a substitution, or a match of another size, whose players stand in other places: he
        // comes on standing. (A model can be in one place only: adding it here takes it from where it was.)
        if (shown[i] !== he || he.model.parent !== group) {
          if (shown[i] && shown[i].model.parent === group) group.remove(shown[i].model);
          group.add(he.model);
          he.animator.reset();
          he.face.reset();
          he.last = 'idle';
          shown[i] = he;
        }
        // The heading he is drawn with turns toward the way he faces, or toward his man, at a bounded rate; his body
        // tips with his speeding up, stopping and turning, and his head turns to what he watches. Before and after a
        // match he faces the way he does, upright, with the motion's own head.
        const bearing = bearings[i], now = { vx: player.vx, vz: player.vz };
        if (standing) Object.assign(bearing, { heading: player.facing, lean: UPRIGHT, head: AHEAD });
        else {
          const wanted = drawnFacing(state, player, marks);
          bearing.heading = easeFacing(bearing.heading ?? wanted, wanted, dt);
          bearing.lean = leanOf(bearing.lean, bearing.was ?? now, now, bearing.heading, dt, onFloor(player));
          bearing.head = easeHead(bearing.head, headTurn(player, bearing.heading, lookTarget(state, player)), dt);
        }
        bearing.was = now;
        const look = standing ? null : { ...legLook(state, player, marks), facing: bearing.heading };
        const legs = standing ? IDLE : legMotion(player, he.gaits, he.last, look);
        he.last = legs.clip;
        group.position.set(player.x, player.y, player.z);
        // From the camera as the last frame placed it: a frame late, a step of a few centimetres at most.
        wear(he, modelFor(level, camera ? camera.position.distanceTo(group.position) : Infinity));
        // The model faces +z, with his left toward +x; a heading is measured from +x toward +z.
        group.rotation.y = Math.PI / 2 - bearing.heading;
        // The model tips inside the group, about his feet, so the number over his head stays where it is.
        he.model.rotation.set(bearing.lean.forward, 0, -bearing.lean.side);
        he.arms = standing ? null : armMotion(player, state, marks, facts);
        // A downloaded clip of the whole body (a move, a stumble) is played by the legs as well, as is a reaction of the
        // whole body (a fall, a huddle), whose feet are not held to the court: they move with it.
        const reacting = he.arms && REACTION_CLIPS.includes(he.arms.clip);
        const whole = he.arms && ('at' in he.arms || reacting) && wholeBody(facts.clips, he.arms.clip) ? he.arms : null;
        he.animator.update(whole ?? legs, he.arms, dt, standing ? null : bearing.head, !standing && onFloor(player) && !(whole && reacting));
        he.face.update(dt, standing ? {} : faceWants(player, marks, { mood: moodOf(state, personOf(state, player)), defending: player.team !== state.possession, dead: state.phase !== 'live' }));
        for (const u of he.wet) u.value = sweat.of(who);
      });
    },
    // Forgets what is remembered from frame to frame (see actors.cut).
    cut() { marks = newMarks(); cross = null; for (const he of people.values()) he.animator.unplant(); },
    // The hands the holder carries the ball in on this frame (see handsOf). To be asked after `update`.
    hands: handsOf,
    // Where the ball is in its holder's hands on this frame, { x, y, z }, or null when nobody holds it and on the
    // start and final screens. `drawn` is where the ball was drawn on the last frame. To be asked once a frame, after
    // `update`, which puts the hands where they are. The rules never read it.
    heldBall(state, drawn) {
      const side = handsOf(state), id = state.ball.holder;
      // A dribble that has just changed hands: the ball is on its way across from where it was when it changed.
      const crossing = side === 'left' || side === 'right' ? marks.switched[id] / MOTION.handSwitch : Infinity;
      cross = crossing < 1 ? crossFrom(cross, id, side, crossing, drawn) : null;
      if (!side) return null;
      const { hands, arms, animator } = shown[id], move = state.players[id].move;
      // In a dribble move it goes from the hand the move began in to the other, by the floor.
      if (side === 'move' && move) {
        const began = marks.hand[id] === 'left' ? 'left' : 'right', other = began === 'left' ? 'right' : 'left';
        const body = { x: state.players[id].x, z: state.players[id].z, heading: bearings[id].heading };
        return moveSpot(move.kind, Math.min(1, move.t / MOVES[move.kind].time), palmOf(hands[began]), palmOf(hands[other]), body, BALL.radius);
      }
      // In the jump of a finish it is in the finishing hand.
      if (side === 'carryRight' || side === 'carryLeft') return palmOf(hands[side === 'carryRight' ? 'right' : 'left']);
      if (side === 'both' || side === 'move') {
        const left = palmOf(hands.left), right = palmOf(hands.right);
        return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2, z: (left.z + right.z) / 2 };
      }
      return dribbleSpot(palmOf(hands[side]), animator.phase(arms.clip), facts.clips.dribble, BALL.radius, cross, crossing);
    },
  };
}
