import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ASSETS, MAP_FILES, LOGO_FILES, MODEL_FILES, assetUrl, SOUNDS, soundPath } from '../src/render/assets.js';

test('a file is asked for by its own path when the game is served', () => {
  assert.equal(assetUrl('assets/players.glb'), 'assets/players.glb');
});

test('in the single file the packed copy is used instead', () => {
  globalThis.TT_ASSETS = { 'assets/players.glb': 'blob:null/abc' };
  try { assert.equal(assetUrl('assets/players.glb'), 'blob:null/abc'); }
  finally { delete globalThis.TT_ASSETS; }
});

const FLOOR = ['assets/floor/wood_floor_diff_2k.jpg', 'assets/floor/wood_floor_nor_gl_2k.jpg', 'assets/floor/wood_floor_rough_2k.jpg'];

test('the game needs the players, the motion, the motion facts, the floor\'s three pictures, every sound, the cloth\'s tiles and the league\'s logos, portraits and players', () => {
  const portraits = MODEL_FILES.map(file => file.replace('/players/', '/portraits/').replace('.glb', '.webp'));
  assert.deepEqual([...ASSETS], ['assets/players.glb', 'assets/motion.glb', 'assets/motion.json', ...FLOOR, ...SOUNDS.map(soundPath), ...MAP_FILES, ...LOGO_FILES, ...portraits, ...MODEL_FILES]);
  for (const path of [...MAP_FILES, ...LOGO_FILES, ...portraits, ...MODEL_FILES]) assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), path);
  assert.equal(LOGO_FILES.length, 13);   // one a team of the league, and Garden State Made's: the dev teams' marks are drawn, not pictures
  assert.equal(MODEL_FILES.length, 120);   // a file for each league player: the dev teams' are all in assets/players.glb, and
  // Garden State Made's players stand in dev bodies until they have models of their own (see sim/guests.js)
  assert.ok(MODEL_FILES.includes('assets/players/phi-00.glb') && MODEL_FILES.includes('assets/players/phi-0.glb'), '0 and 00 are two players');
});

test('the floor\'s pictures are in the repository and credited: who made them, where from, under which licence', () => {
  const credits = readFileSync(new URL('../assets/CREDITS.md', import.meta.url), 'utf8');
  for (const path of FLOOR) {
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), path);
    assert.ok(credits.includes(path.split('/').pop()), path);
  }
  for (const word of ['Poly Haven', 'Dimitrios Savva', 'CC0']) assert.ok(credits.includes(word), word);
});
