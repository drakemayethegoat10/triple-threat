import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARENA, seats, shown, boards, blocks, scoreLines } from '../src/render/layout.js';
import { QUALITY } from '../src/render/quality.js';
import { COURT } from '../src/sim/tuning.js';
import { createMatch } from '../src/sim/state.js';

const HEAD = 1.3;   // metres from a seat up to the top of a seated head
// The space a seated person takes up.
const body = s => ({ min: { x: s.x - 0.3, y: s.y, z: s.z - 0.3 }, max: { x: s.x + 0.3, y: s.y + HEAD, z: s.z + 0.3 } });
const cameras = [-ARENA.camera.maxX, 0, ARENA.camera.maxX].map(x => ({ x, y: ARENA.camera.height, z: ARENA.camera.back }));
// Points of the court the camera must always see: the floor's corners and edges, a head's height above each, and a
// ball six metres up over each hoop.
const sights = [];
for (const x of [-COURT.halfLength, -7, 0, 7, COURT.halfLength]) for (const z of [-COURT.halfWidth, 0, COURT.halfWidth]) sights.push({ x, y: 0, z }, { x, y: 2, z });
sights.push({ x: 12.4, y: 6, z: 0 }, { x: -12.4, y: 6, z: 0 });

test('there are between one and four thousand seats, the same every time, on all four sides', () => {
  const all = seats();
  assert.ok(all.length >= 1000 && all.length <= 4000, `${all.length} seats`);
  assert.deepEqual(seats(), all);
  for (const side of [s => s.z < -ARENA.clearZ, s => s.z > ARENA.clearZ, s => s.x < -ARENA.clearX, s => s.x > ARENA.clearX])
    assert.ok(all.filter(side).length >= 100);
});

test('no seat, board or table stands on the court or its run-off', () => {
  for (const s of seats()) assert.ok(Math.abs(s.x) >= ARENA.clearX || Math.abs(s.z) >= ARENA.clearZ, JSON.stringify(s));
  for (const b of boards().filter(b => b.y < 6)) {           // the hanging scoreboard is overhead
    const nearestX = Math.min(Math.abs(b.box.min.x), Math.abs(b.box.max.x)), nearestZ = Math.min(Math.abs(b.box.min.z), Math.abs(b.box.max.z));
    const spans = b.box.min.x * b.box.max.x < 0 && b.box.min.z * b.box.max.z < 0;   // it straddles the middle both ways
    assert.ok(!spans && (nearestX >= COURT.halfLength + 0.5 || nearestZ >= COURT.halfWidth + 0.5), JSON.stringify(b));
  }
});

test('nothing in the arena comes between the camera and the court, wherever the camera is', () => {
  const things = [...seats().map(body), ...boards().map(b => b.box)];
  for (const from of cameras) for (const to of sights) for (const box of things)
    assert.ok(!blocks(box, from, to), `the view from ${JSON.stringify(from)} to ${JSON.stringify(to)} is blocked by ${JSON.stringify(box)}`);
});

test('a line through a box is blocked, one past it is not', () => {
  const box = { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 2, z: 1 } };
  assert.equal(blocks(box, { x: -5, y: 1, z: 0 }, { x: 5, y: 1, z: 0 }), true);
  assert.equal(blocks(box, { x: -5, y: 3, z: 0 }, { x: 5, y: 3, z: 0 }), false);
  assert.equal(blocks(box, { x: -5, y: 1, z: 0 }, { x: -2, y: 1, z: 0 }), false);          // it stops short
  assert.equal(blocks(box, { x: 0, y: 5, z: 0 }, { x: 0, y: 1, z: 0 }), true);             // straight down into it
});

test('each quality level shows its share of the crowd, always the same people, and a fuller crowd keeps the thinner one', () => {
  const all = seats();
  const at = level => shown(all, QUALITY[level].crowd);
  assert.deepEqual(QUALITY.order.map(level => at(level).length), [0.15, 0.5, 1, 1].map(share => Math.round(all.length * share)));
  assert.deepEqual(at('low'), at('low'));
  const medium = new Set(at('medium'));
  assert.ok(at('low').every(seat => medium.has(seat)));
  for (const side of [s => s.z < -ARENA.clearZ, s => s.x > ARENA.clearX]) assert.ok(at('low').filter(side).length >= 10);   // thin, not empty
});

test('the boards carry only the game\'s own words, and the scoreboard says the score and the period', () => {
  const words = new Set(boards().map(b => b.words));
  for (const word of words) assert.ok(['TRIPLE THREAT', ''].includes(word), word);
  assert.ok(words.has('TRIPLE THREAT'));
  const s = createMatch(); s.score = [28, 26]; s.quarter = 3;
  assert.deepEqual(scoreLines(s), { home: 'WAV 28', away: 'SCO 26', period: '3RD' });
});

// ---------- The building round the stands (arenas Stage 2) ----------

import { upperSeats } from '../src/render/layout.js';
import { ARENAS, LOGOS, arenaOf } from '../src/render/arenas.js';
import { TEAMS } from '../src/sim/teams.js';
import { existsSync } from 'node:fs';
import { boardWords } from '../src/render/videoboard.js';

test('the stands have aisles: no seat stands on a stair, and every stand is crossed by some', () => {
  const { every, wide } = ARENA.aisle;
  const along = s => (Math.abs(s.z) >= ARENA.clearZ && Math.abs(s.x) < ARENA.ring.end ? s.x : s.z);   // along its row
  for (const s of [...seats(), ...upperSeats()]) {
    const at = along(s);
    assert.ok(Math.abs(at - Math.round(at / every) * every) >= wide / 2 - 1e-9, JSON.stringify(s));
  }
});

test('the upper deck has seats on all four sides, above the suites and the ribbon, outside the lower stands\' ring', () => {
  const up = upperSeats();
  assert.ok(up.length >= 1500 && up.length <= 4000, `${up.length} seats`);
  assert.deepEqual(upperSeats(), up);
  for (const s of up) {
    assert.ok(s.y >= ARENA.upper.height && s.y > ARENA.ribbon.high, JSON.stringify(s));
    assert.ok(s.z <= -ARENA.ring.far || s.z >= ARENA.upper.near || Math.abs(s.x) >= ARENA.ring.end, JSON.stringify(s));
  }
  for (const side of [s => s.z < 0 && Math.abs(s.x) < ARENA.ring.end, s => s.z > 0 && Math.abs(s.x) < ARENA.ring.end, s => s.x > ARENA.ring.end, s => s.x < -ARENA.ring.end])
    assert.ok(up.filter(side).length >= 200);
});

test('nothing of the upper deck or the near side\'s building comes between the camera and the court', () => {
  // The near side's suites, ribbon and upper deck begin behind the camera; the near wall stays under its view.
  assert.ok(ARENA.upper.near > ARENA.camera.back);
  const things = upperSeats().map(body);
  for (const from of cameras) for (const to of sights) for (const box of things) assert.ok(!blocks(box, from, to), JSON.stringify(box));
});

test('the home arena is the Waves\' Tidewater Arena, all of it invented, and every team has a mark', () => {
  const look = arenaOf();
  assert.equal(look, ARENAS.tidewater);
  assert.equal(look.team, 0);
  assert.equal(look.name, 'TIDEWATER ARENA');
  assert.equal(LOGOS.length, TEAMS.length);
  // The dev teams' marks are drawn here; the league's are pictures, each in the repository, on a disc of its colour.
  for (const logo of LOGOS.slice(0, 2)) assert.ok(logo.paths.length >= 2 && /^#/.test(logo.disc));
  for (const [id, logo] of LOGOS.entries()) if (id >= 2) {
    assert.ok(existsSync(new URL(`../${logo.image}`, import.meta.url)), logo.image);
    assert.equal(logo.disc, TEAMS[id].colour);
  }
  assert.ok(look.banners.length >= 3);
});

test('every league team has an arena of its own, named for its venue, in its city, with its own banners', () => {
  const names = new Set();
  for (const [id, team] of TEAMS.entries()) {
    const look = arenaOf(id);
    assert.equal(look.team, id, team.name);
    names.add(look.name);
    if (team.dev) continue;
    assert.equal(look, ARENAS[team.key.toLowerCase()]);
    assert.deepEqual([look.name, look.city], [team.venue.name.toUpperCase(), team.city.toUpperCase()]);
    for (const key of Object.keys(ARENAS.tidewater.colour)) assert.ok(key in look.colour, `${team.key}: ${key}`);
    assert.ok(look.banners.length >= 2 && look.banners.length <= 8, team.key);
    assert.ok(look.banners.every(b => b.top.includes(team.nickname.toUpperCase())), team.key);
    assert.ok(['wave', 'angle'].includes(look.trusses));
  }
  assert.equal(names.size, TEAMS.length, 'fifteen arenas, all different');
  assert.equal(arenaOf(99), ARENAS.tidewater, 'a team there is not plays at Tidewater');
});

test('the arenas are after their teams\' real homes: Boston\'s parquet in red oak, Denver\'s mountains, the rafters fullest in Boston and Los Angeles', () => {
  const at = key => ARENAS[key];
  assert.ok(at('bsh').floor.parquet > 1 && at('bsh').floor.tone[0] > at('bsh').floor.tone[2] * 1.5, 'red oak: much redder than it is blue');
  assert.equal(at('bsh').colour.lane, '#007a33');
  assert.equal(at('den').floor.art.kind, 'mountains');
  assert.equal(Object.values(ARENAS).filter(a => a.floor?.parquet).length, 1, 'only Boston plays on parquet');
  const most = Math.max(...Object.values(ARENAS).map(a => a.banners.length));
  assert.deepEqual(Object.keys(ARENAS).filter(k => ARENAS[k].banners.length === most), ['bsh', 'lar']);
  assert.ok(at('bsh').banners.every(b => b.bottom === 'LEAGUE CHAMPIONS'));
});

test('the Scorpions\' home is Red Rock Pavilion: sandstone and rust, a sunset glow, a folded roof, their own court and banners', () => {
  const look = arenaOf(1);
  assert.equal(look, ARENAS.redrock);
  assert.deepEqual([look.team, look.name, look.city, look.trusses], [1, 'RED ROCK PAVILION', 'RED ROCK', 'angle']);
  assert.equal(arenaOf(0), ARENAS.tidewater);
  assert.ok(look.banners.length >= 3 && look.banners.every(b => !/WAVES|HARBOR/.test(b.top)));
  for (const key of Object.keys(ARENAS.tidewater.colour)) assert.ok(key in look.colour, key);
  assert.notEqual(look.colour.lane, ARENAS.tidewater.colour.lane);
});

test('the video board says the teams, their points, the period and the clock', () => {
  const s = createMatch(); s.score = [61, 58]; s.quarter = 3; s.gameClock = 432.2;
  const words = boardWords(s);
  assert.deepEqual([words.home, words.away, words.score, words.period, words.clock], ['WAV', 'SCO', [61, 58], '3RD', '7:13']);
  assert.ok(words.bottom.includes('WAV 61') && words.bottom.includes('SCO 58'));
});
