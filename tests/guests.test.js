// Garden State Made, the owner's own team (src/sim/guests.js): in Exhibition only, its six players, its duo in both
// engines and on the broadcast, its kits and its gym.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS, ROLES, pickable, clubIds, ownModels } from '../src/sim/teams.js';
import { createMatch, surname } from '../src/sim/state.js';
import { overall } from '../src/sim/overall.js';
import { MOOD, lean, feelShot, moodOf } from '../src/sim/mood.js';
import { cast } from '../src/sim/plays.js';
import { kindOf } from '../src/sim/offball.js';
import { clubs } from '../src/franchise/calendar.js';
import { quickMatch } from '../src/sim/quick/engine.js';
import { KIT, kitOps, kitColours, heightOps } from '../src/render/kit.js';
import { ARENAS, arenaOf } from '../src/render/arenas.js';
import { numberSeed, bodiesOf } from '../src/render/checks.js';
import { MODEL_FILES, LOGO_FILES } from '../src/render/assets.js';
import { createWatch, watchStep } from '../src/broadcast/moments.js';

const GSM = TEAMS.findIndex(t => t.key === 'GSM'), team = TEAMS[GSM];
const row = name => team.players.findIndex(p => p.name === name);

test('Garden State Made is picked in Exhibition and never plays in MyLeague', () => {
  assert.equal(GSM, TEAMS.length - 1, 'after the league, so no team\'s id moves');
  assert.ok(team.exhibition && pickable().includes(GSM));
  assert.ok(!clubIds().includes(GSM) && !('GSM' in clubs));
  assert.equal(Object.keys(clubs).length, 12);
});

test('its six players: an initial and a surname each, their own numbers (XX among them), five starters, the duo and the big first', () => {
  assert.deepEqual(team.players.map(p => p.name), ['L. Pryor', 'G. Archundia', 'A. Madore', 'Z. Michael Jr.', 'D. Tortu', 'P. Jones']);
  assert.deepEqual(team.players.map(p => p.number), ['30', '10', '8', 'XX', '32', '2']);
  assert.deepEqual(team.players.map(p => p.position), ['PF', 'PG', 'C', 'SG', 'SF', 'SG']);
  assert.deepEqual(team.players.map(p => p.starter), [true, true, true, true, true, false]);
  for (const p of team.players) {
    assert.ok(p.role in ROLES, p.name);
    assert.ok(Object.values(p.ratings).every(r => Number.isInteger(r) && r >= 40 && r <= 99), p.name);
  }
  // A contender: two stars near the league's best and the rest below its starters (see guests.js for why).
  assert.deepEqual(team.players.map(overall), [92, 91, 80, 77, 77, 75]);
  // G. Archundia: the mid-range and the post, no three.
  const gio = team.players[row('G. Archundia')];
  assert.ok(gio.ratings.mid >= 95 && gio.ratings.three <= 55 && gio.tendencies.post >= 0.9 && gio.iq >= 0.95);
  assert.equal(team.coachName, 'Z. Michael Sr.');
});

test('a surname keeps its suffix, so Z. Michael Jr. is Michael Jr. on the screen', () => {
  assert.equal(surname({ name: 'Z. Michael Jr.' }), 'Michael Jr.');
  assert.equal(surname({ name: 'Wendell Carton Jr.' }), 'Carton Jr.');
  assert.equal(surname({ name: 'L. Pryor' }), 'Pryor');
  assert.equal(surname({ name: 'Jr.' }), 'Jr.');
});

test('a number of letters gives a face seed of its own; numbers of digits keep theirs', () => {
  assert.deepEqual([numberSeed(0), numberSeed('0'), numberSeed('00'), numberSeed('30'), numberSeed(4)], [0, 0, 100, 30, 4]);
  assert.ok(Number.isInteger(numberSeed('XX')) && numberSeed('XX') >= 200);
});

test('until they have models of their own, the six stand in dev bodies, each a different one', () => {
  assert.ok(!ownModels(team));
  assert.ok(!MODEL_FILES.some(path => path.includes('/gsm-')));
  const bodies = bodiesOf(GSM);
  assert.equal(new Set(bodies.map(b => b.body)).size, 6);
  assert.ok(LOGO_FILES.includes('assets/logos/gsm.png'));
});

test('in a match the duo knows each other, and nobody else has a partner', () => {
  const s = createMatch(1, 5, [GSM, 2]);
  assert.equal(s.rosters[0][row('L. Pryor')].partner, row('G. Archundia'));
  assert.equal(s.rosters[0][row('G. Archundia')].partner, row('L. Pryor'));
  assert.ok(s.rosters[0].filter(p => 'partner' in p).length === 2 && s.rosters[1].every(p => !('partner' in p)));
});

test('one of the duo looks for the other: a pass to him gains MOOD.duo.look, a pass to anyone else nothing more', () => {
  const s = createMatch(1, 5, [GSM, 2]);
  const pryor = s.players.find(p => p.team === 0 && p.person === row('L. Pryor'));
  const gio = s.players.find(p => p.team === 0 && p.person === row('G. Archundia'));
  const big = s.players.find(p => p.team === 0 && p.person === row('A. Madore'));
  const options = () => [{ key: 'pass', value: 1, to: gio.id }, { key: 'pass', value: 1, to: big.id }];
  const with_ = lean(s, pryor, options());
  const plain = createMatch(1, 5, [{ ...team, duo: undefined }, 2]);
  const without = lean(plain, plain.players.find(p => p.id === pryor.id), options());
  assert.ok(Math.abs((with_[0].value - without[0].value) - MOOD.duo.look) < 1e-9);
  assert.equal(with_[1].value, without[1].value);
});

test('one of the duo with the ball plays his two-man game: the other is the big who screens, rolls and posts', () => {
  for (const size of [3, 5]) {
    const s = createMatch(1, size, [GSM, 2]);
    const gio = s.players.find(p => p.team === 0 && p.person === row('G. Archundia'));
    const pryor = s.players.find(p => p.team === 0 && p.person === row('L. Pryor'));
    assert.equal(cast(s, gio).big, pryor.id, `${size} a side`);
    assert.equal(cast(s, pryor).big, gio.id, `${size} a side`);
    // Without the duo the big is the best inside, A. Madore.
    const plain = createMatch(1, size, [{ ...team, duo: undefined }, 2]);
    assert.equal(plain.players[cast(plain, plain.players[gio.id]).big].person, row('A. Madore'));
  }
});

test('G. Archundia, a point guard who posts up, waits on the block off the ball as a big does', () => {
  for (const size of [3, 5]) {
    const s = createMatch(1, size, [GSM, 2]), on = row => s.players.find(p => p.team === 0 && p.person === row);
    assert.equal(kindOf(s, on(row('G. Archundia'))), 'big', `${size} a side`);
    assert.equal(s.rosters[1].filter(p => p.tend.lowPost).length, 0, 'nobody in the league');
  }
});

test('a basket by one of the duo lifts the other, more for a dunk', () => {
  const lift = dunk => {
    const s = createMatch(1, 5, [GSM, 2]), gio = s.rosters[0][row('G. Archundia')], before = moodOf(s, gio).confidence;
    feelShot(s, s.players.find(p => p.team === 0 && p.person === row('L. Pryor')), true, { value: 2, dunk });
    return moodOf(s, gio).confidence - before;
  };
  assert.ok(lift(false) > 0 && lift(true) > lift(false));
  const s = createMatch(1, 5, [{ ...team, duo: undefined }, 2]), gio = s.rosters[0][row('G. Archundia')], before = moodOf(s, gio).confidence;
  feelShot(s, s.players.find(p => p.team === 0 && p.person === row('L. Pryor')), true, { value: 2, dunk: false });
  assert.ok(moodOf(s, gio).confidence - before < lift(false), 'less without the duo');
});

test('the broadcast marks the duo when one feeds the other for a dunk, a three or an and-one, and not for anyone else\'s pass', () => {
  const marked = more => {
    const s = createMatch(1, 3, [GSM, 2]);
    Object.assign(s, { phase: 'live', time: 100, quarter: 2, gameClock: 90 });
    const watch = createWatch();
    watchStep(watch, s);
    const points = more.points ?? 2;
    s.score[0] += points;
    s.last.score = { team: 0, by: 0, row: row('L. Pryor'), points, at: s.time, shotAt: s.time - 1, clock: s.gameClock, x: 9, z: 0, far: 4, gap: 3,
      green: false, assist: null, fouled: false, tied: false, lead: false, ...more };
    return watchStep(watch, s).filter(h => h.kind === 'duo');
  };
  const [duo] = marked({ assist: row('G. Archundia'), finish: 'dunk', far: 0.5 });
  assert.deepEqual([duo.name, duo.off, duo.moment], ['Pryor', 'Archundia', true]);
  assert.equal(marked({ assist: row('G. Archundia'), points: 3, far: 7.5 }).length, 1);
  assert.equal(marked({ assist: row('G. Archundia') }).length, 0, 'a plain two is not marked');
  assert.equal(marked({ assist: row('A. Madore'), finish: 'dunk', far: 0.5 }).length, 0);
});

test('both engines play its matches to the end, three and five a side, with six men', () => {
  for (const size of [3, 5]) for (const style of ['arcade', 'sim']) {
    const s = quickMatch({ seed: 4, size, style, teams: [GSM, 5] });
    assert.equal(s.phase, 'final');
    assert.ok(s.score[0] > 40 && s.score[1] > 40, `${size} ${style}: ${s.score}`);
    assert.equal(s.rosters[0].length, 6);
  }
});

test('its kits: white with red paint flung across it at home, red with white away, the wordmark and New Jersey behind the numbers', () => {
  const home = kitColours(GSM, 'home'), road = kitColours(GSM, 'road');
  assert.deepEqual([home.team, home.splatter, home.letters], ['#ffffff', '#b5121b', '#b5121b']);
  assert.deepEqual([road.team, road.splatter, road.letters], ['#a30f1b', '#ffffff', '#ffffff']);
  for (const kit of ['home', 'road']) {
    const ops = kitOps('jersey', 'XX', GSM, kit);
    assert.ok(!ops.some(o => o.fill === 'panel' || (o.fill === 'piping' && o.rect)), 'no side panels under the paint');
    assert.ok(ops.filter(o => o.poly).length > 4 * KIT.splatter.spikes && ops.some(o => o.dots?.length > 20));
    assert.deepEqual(ops.filter(o => o.text && o.text.length > 1).map(o => o.text), ['MADE', 'XX', 'XX']);
    assert.equal(ops.filter(o => o.text?.length === 1).map(o => o.text).join(''), 'GARDEN STATE');
    assert.equal(ops.filter(o => o.path).length, 2, 'New Jersey on the front and the back');
    // Every op stays on the picture (a little past its edge at most), and the same paint each time.
    for (const o of ops) for (const [x, y] of o.poly ?? o.dots ?? o.path ?? []) assert.ok(x > -0.05 && x < 1.05 && y >= 0 && y <= 1, `${x}, ${y}`);
    assert.deepEqual(kitOps('jersey', 'XX', GSM, kit), ops);
  }
  assert.ok(kitOps('shorts', '30', GSM, 'home').some(o => o.dots));
  // The lettering stands out of the cloth; the paint is printed, flat.
  assert.ok(heightOps('jersey', '30', GSM, 'home').every(o => !o.poly && !o.dots));
  // A league kit is as it was: side panels and no paint.
  assert.ok(kitOps('jersey', '11', 2, 'home').some(o => o.fill === 'panel') && !kitOps('jersey', '11', 2, 'home').some(o => o.dots));
});

test('its gym: its own, in its colours, paint flung across the apron, and banners that claim nothing won', () => {
  const look = arenaOf(GSM);
  assert.equal(look, ARENAS.gsm);
  assert.deepEqual([look.name, look.city, look.team], ['GARDEN STATE GYM', 'GARDEN STATE', GSM]);
  assert.equal(look.floor.art.kind, 'splatter');
  assert.ok(look.banners.every(b => !/CHAMPIONS/.test(b.bottom)));
});
