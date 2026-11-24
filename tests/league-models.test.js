import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readGlb, primitivesUnder, nodesUnder } from './glb.js';
import { TEAMS, ownModels } from '../src/sim/teams.js';
import { modelFile } from '../src/render/assets.js';

// The league players' recipes (made by tools/league/import.mjs from the appearance file) and their models (built from
// them by tools/blender/build_players.py, each in a file of his own).
const recipes = JSON.parse(readFileSync('assets/source/league-people.json', 'utf8')).people;
const STYLES = ['buzz', 'fade', 'curls', 'afro', 'twists', 'locs', 'cornrows', 'short'];
const league = TEAMS.map((team, id) => ({ team, id })).filter(({ team }) => ownModels(team));

test('every league player has a recipe: his team, number and height as the league has them, and nothing that names anyone', () => {
  assert.equal(recipes.length, 120);
  for (const { team, id } of league) for (const p of team.players) {
    const r = recipes.find(q => q.team === id && q.number === p.number);
    assert.ok(r, `${team.key} ${p.number}: no recipe`);
    assert.deepEqual([r.key, r.height, r.colour], [team.key.toLowerCase(), p.height, team.colour]);
    assert.deepEqual(Object.keys(r), ['team', 'key', 'number', 'height', 'build', 'skin', 'skinHex', 'hairStyle', 'hair', 'hairColour', 'beard', 'face', 'seed', 'gear', 'colour']);
    assert.ok(['slim', 'athletic', 'strong'].includes(r.build) && STYLES.includes(r.hairStyle), `${team.key} ${p.number}`);
    assert.equal(r.hair !== null, ['afro', 'short'].includes(r.hairStyle), `${team.key} ${p.number}: ${r.hairStyle} with ${r.hair}`);
    assert.ok([null, 'stubble', 'mustache', 'goatee', 'short', 'full'].includes(r.beard));
    assert.match(r.skinHex, /^#[0-9a-f]{6}$/);
  }
  assert.equal(new Set(recipes.map(r => r.face)).size, 120, 'every face its own');
});

test('each league player\'s file holds him alone: skinned, his height, his kit, hair and shoes, his face\'s expressions, a far model', () => {
  for (const { team, id } of league) for (const p of team.players) {
    const file = modelFile(team, p.number), gltf = readGlb(file).json, name = `player-${id}-${p.number}`;
    const roots = gltf.scenes[gltf.scene ?? 0].nodes.map(i => gltf.nodes[i].name);
    assert.deepEqual(roots, [name], `${file}: ${roots}`);
    const near = primitivesUnder(gltf, name), far = primitivesUnder(gltf, name, 'far'), kind = q => gltf.materials[q.material].name.split('-')[0];
    const triangles = list => list.reduce((sum, q) => sum + gltf.accessors[q.indices].count / 3, 0);
    assert.ok(triangles(near) > 2000 && triangles(near) <= 45000 && triangles(far) <= 18000, `${file}: ${triangles(near)} and ${triangles(far)} triangles`);
    for (const part of ['skin', 'jersey', 'shorts', 'hair', 'shoes', 'eyes', 'mouth']) assert.ok(near.some(q => kind(q) === part), `${file}: no ${part}`);
    assert.ok(near.every(q => 'JOINTS_0' in q.attributes), `${file}: a mesh is not skinned`);
    // His height: the top of his head, or of the hair where the scalp under it is gone; his feet on the floor.
    const top = Math.max(...near.filter(q => ['skin', 'hair'].includes(kind(q))).map(q => gltf.accessors[q.attributes.POSITION].max[1]));
    const feet = Math.min(...near.map(q => gltf.accessors[q.attributes.POSITION].min[1]));
    assert.ok(top > p.height - 0.01 && top < p.height + 0.15 && Math.abs(feet) < 0.03, `${file}: from ${feet.toFixed(3)} to ${top.toFixed(3)} m, ${p.height} m tall`);
    const mesh = nodesUnder(gltf, gltf.nodes.findIndex(n => n.name === name)).map(i => gltf.nodes[i]).find(n => n.mesh !== undefined && !n.name.endsWith('-far'));
    assert.deepEqual(gltf.meshes[mesh.mesh].extras?.targetNames, ['blink', 'effort', 'shout', 'dejected'], file);
    assert.ok(gltf.images.every(image => image.mimeType === 'image/webp'), file);
  }
});
