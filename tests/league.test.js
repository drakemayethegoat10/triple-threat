import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEAGUE } from '../src/sim/league.js';
import { TEAMS, ROLES, pickable, clubIds } from '../src/sim/teams.js';
import { GUESTS } from '../src/sim/guests.js';
import { overall } from '../src/sim/ratings.js';
import { bodiesOf, modelled, personName } from '../src/render/checks.js';
import { readCsv, roleOf, ratingsOf } from '../tools/league/import.mjs';

const RATINGS = ['inside', 'mid', 'three', 'handle', 'speed', 'defence', 'rebound', 'stamina'];

test('the league is twelve teams, six East and six West, after the two dev teams, who are the only ones not pickable', () => {
  assert.equal(LEAGUE.length, 12);
  assert.deepEqual(LEAGUE.map(t => t.conference), [...Array(6).fill('East'), ...Array(6).fill('West')]);
  // After the league, the teams that play in Exhibition only: pickable there, never in MyLeague.
  assert.deepEqual(TEAMS.slice(2), [...LEAGUE, ...GUESTS]);
  assert.deepEqual(TEAMS.map(t => !!t.dev), [true, true, ...Array(12 + GUESTS.length).fill(false)]);
  assert.deepEqual(pickable(), TEAMS.map((t, id) => id).slice(2));
  assert.deepEqual(clubIds(), TEAMS.map((t, id) => id).slice(2, 14));
  assert.equal(new Set(TEAMS.map(t => t.abbr)).size, TEAMS.length, 'every abbreviation its own');
});

test('each team has ten players with ten numbers, its five starters first, each with a role the game knows and ratings it can use', () => {
  for (const team of LEAGUE) {
    assert.equal(team.players.length, 10, team.key);
    assert.equal(new Set(team.players.map(p => p.number)).size, 10, team.key);
    assert.deepEqual(team.players.map(p => p.starter), [...Array(5).fill(true), ...Array(5).fill(false)], team.key);
    for (const p of team.players) {
      assert.ok(p.role in ROLES, `${p.name}: ${p.role}`);
      assert.deepEqual(Object.keys(p.ratings), RATINGS, p.name);
      assert.ok(Object.values(p.ratings).every(r => Number.isInteger(r) && r >= 40 && r <= 99), p.name);
      assert.ok(p.height > 1.7 && p.height < 2.35, `${p.name}: ${p.height} m`);
      assert.ok(['PG', 'SG', 'SF', 'PF', 'C'].includes(p.position), p.name);
    }
    for (const key of ['colour', 'secondary', 'accent', 'logo']) assert.ok(team[key], `${team.key}: ${key}`);
    for (const kit of ['home', 'road']) assert.match(team.uniforms[kit].jersey, /^#[0-9a-f]{6}$/, `${team.key}: ${kit}`);
  }
});

test('only the parodies are kept: no field of the files that names the real players and teams', () => {
  const teamKeys = ['key', 'name', 'abbr', 'city', 'nickname', 'conference', 'playbook', 'defence', 'coach', 'coachName', 'colour', 'secondary', 'accent',
    'uniforms', 'arena', 'venue', 'logo', 'players'];
  for (const team of LEAGUE) {
    assert.deepEqual(Object.keys(team), teamKeys, team.key);
    for (const p of team.players) assert.deepEqual(Object.keys(p), ['name', 'number', 'position', 'role', 'archetype', 'height', 'starter', 'ratings'], p.name);
  }
  assert.doesNotMatch(readFileSync(new URL('../src/sim/league.js', import.meta.url), 'utf8'), /nba|equivalent/i);
});

test('a row\'s ratings are moved together so that its overall, as the game counts it, is the file\'s', () => {
  const row = { position: 'C', overall: '84', inside_scoring: '88', midrange: '70', three_point: '45', ball_handling: '55', speed: '60',
    perimeter_defense: '62', rim_protection: '92', rebounding: '90', stamina: '80' };
  const ratings = ratingsOf(row);
  assert.equal(overall({ ratings }), 84);
  // A big's defence is mostly his rim protection; a guard's his perimeter defence.
  assert.ok(ratings.defence > ratingsOf({ ...row, position: 'PG' }).defence);
  assert.equal(ratingsOf({ ...row, position: 'PG', overall: '40' }).three, 40, 'never under 40');
});

test('a file\'s quoted fields may hold commas, quotes and line breaks', () => {
  assert.deepEqual(readCsv('a,b\n"x, y","say ""hi""\nthere"\n1,2\n'), [{ a: 'x, y', b: 'say "hi"\nthere' }, { a: '1', b: '2' }]);
});

test('a role comes from the archetype\'s words, and the position where the words say less', () => {
  assert.deepEqual([roleOf('Rim protector', 'C'), roleOf('Three-and-D wing', 'SG'), roleOf('Three-and-D wing', 'SF'), roleOf('Glass cleaner', 'C'), roleOf('Who knows', 'PG')],
    ['Rim protector', 'Lockdown guard', 'Two-way wing', 'Rebounder', 'Role player']);
});

test('a league player whose own model cannot be loaded stands in a dev body, a different one for each of his team, at his position, scaled to his height', () => {
  for (const [id, team] of TEAMS.entries()) {
    const bodies = bodiesOf(id);
    assert.deepEqual(bodies.map(b => b.number), team.players.map(p => p.number));
    if (modelled(id)) { assert.deepEqual(bodies.map(b => b.body), team.players.map(p => personName(id, p.number))); continue; }
    assert.equal(new Set(bodies.map(b => b.body)).size, team.players.length, team.key);
    bodies.forEach((b, row) => {
      const [, devTeam, number] = b.body.split('-').map(Number), dev = TEAMS[devTeam].players.find(p => p.number === number);
      assert.ok(modelled(devTeam), b.body);
      assert.equal(dev.position, team.players[row].position, `${team.players[row].name} in ${b.body}`);
      assert.ok(Math.abs(b.size * dev.height - team.players[row].height) < 1e-9 && b.size > 0.9 && b.size < 1.12, `${team.players[row].name}: ${b.size}`);
    });
  }
});

test('a number is kept as it is worn: Philadelphia has a 0 and a 00, and the 00 is lettered 00', async () => {
  const { kitOps } = await import('../src/render/kit.js');
  const phi = TEAMS.findIndex(t => t.key === 'PHI'), numbers = TEAMS[phi].players.map(p => p.number);
  assert.ok(numbers.includes('0') && numbers.includes('00'), numbers.join());
  assert.ok(LEAGUE.every(t => t.players.every(p => /^\d{1,2}$/.test(p.number))));
  assert.deepEqual(kitOps('jersey', '00', phi).filter(o => o.text === '00').length, 2, 'on the chest and the back');
  assert.notEqual(personName(phi, '0'), personName(phi, '00'));
});
