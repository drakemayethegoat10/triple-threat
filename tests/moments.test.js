import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, MOMENT, STARS, createWatch, slowFor, watchStep } from '../src/broadcast/moments.js';
import { createMatch } from '../src/sim/state.js';
import { startMatch } from '../src/sim/rules.js';
import { step } from '../src/sim/step.js';
import { aiIntents } from '../src/sim/ai.js';
import { rimCentre } from '../src/sim/ball.js';
import { DT } from '../src/sim/tuning.js';

// A match in live play that the watcher has looked at once, so that only what changes next counts.
function watched(set = {}) {
  const s = createMatch(1, 3);
  Object.assign(s, { phase: 'live', time: 100, quarter: 2, gameClock: 90 }, set);
  const watch = createWatch();
  assert.deepEqual(watchStep(watch, s), []);
  return [s, watch];
}
// A basket by player `by` of team 0, with whatever else is said of it. The score goes up as the rules would have it.
function basket(s, more = {}) {
  const points = more.points ?? 2;
  const sc = { team: 0, by: 0, row: 0, points, at: s.time, shotAt: s.time - 1, clock: s.gameClock, x: 9, z: 0, far: 4, gap: 3, green: false,
    assist: null, fouled: false, tied: false, lead: false, ...more };
  s.score[sc.team] += points; s.run[sc.team] += points; s.run[1 - sc.team] = 0;
  s.last.score = sc;
  return sc;
}
const kinds = list => list.map(h => h.kind);
const moments = list => list.filter(h => h.moment).map(h => h.kind);

test('the moments are listed biggest first, and six of them are stars', () => {
  assert.equal(KINDS.length, 16);   // duo (see mood.js) the newest
  assert.deepEqual([...STARS].sort(), ['andOne', 'ankle', 'block', 'buzzer', 'poster', 'winner']);
  for (const kind of STARS) assert.ok(KINDS.includes(kind));
});

test('the first look marks nothing, and a step in which nothing happens returns nothing', () => {
  const [s, watch] = watched();
  assert.deepEqual(watchStep(watch, s), []);
});

test('a plain basket is a happening and no moment', () => {
  const [s, watch] = watched();
  basket(s);
  const heard = watchStep(watch, s);
  assert.deepEqual(kinds(heard), ['made']);
  assert.deepEqual([heard[0].team, heard[0].row, heard[0].name, heard[0].points, heard[0].moment], [0, 0, 'Cross', 2, false]);
  assert.deepEqual(watchStep(watch, s), []);                           // once
});

test('an and-one, a deep three, a poster (a dunk over a defender): each when its condition is met and not when it just misses', () => {
  const one = (more, set) => { const [s, watch] = watched(set); basket(s, more); return moments(watchStep(watch, s)); };
  assert.deepEqual(one({ fouled: true }), ['andOne']);
  assert.deepEqual(one({ points: 3, far: 8.6 }), ['deep']);
  assert.deepEqual(one({ points: 3, far: 8.4 }), []);
  assert.deepEqual(one({ points: 2, far: 8.6 }), []);
  assert.deepEqual(one({ far: 1.2, gap: 0.8, finish: 'dunk' }), ['poster']);
  assert.deepEqual(one({ far: 1.2, gap: 1.3, finish: 'dunk' }), []);
  assert.deepEqual(one({ far: 1.8, gap: 0.8, finish: 'dunk' }), []);
  // A layup is never a poster: not one he went up to dunk and laid up instead, nor any other shot from there.
  assert.deepEqual(one({ far: 1.2, gap: 0.8, finish: 'layup' }), []);
  assert.deepEqual(one({ far: 1.2, gap: 0.8 }), []);
});

test('a basket that is two things is both, the bigger first', () => {
  const [s, watch] = watched();
  basket(s, { fouled: true, points: 3, far: 9 });
  const heard = watchStep(watch, s);
  assert.deepEqual(moments(heard), ['andOne', 'deep']);
  assert.deepEqual(heard.map(h => h.star), [true, false, false]);      // and the plain basket last
});

test('a buzzer-beater left the hand in the last second of any period', () => {
  const [s, watch] = watched({ gameClock: 0 });
  basket(s, { clock: 0.8 });
  assert.deepEqual(moments(watchStep(watch, s)), ['buzzer']);
  const [t, w] = watched({ gameClock: 0 });
  basket(t, { clock: 1.2 });
  assert.deepEqual(moments(watchStep(w, t)), []);
});

test('clutch is a tie or the lead in the last minute of the fourth period or overtime', () => {
  const one = (more, set) => { const [s, watch] = watched(set); basket(s, more); return moments(watchStep(watch, s)); };
  assert.deepEqual(one({ lead: true, clock: 45 }, { quarter: 4, gameClock: 45 }), ['clutch']);
  assert.deepEqual(one({ tied: true, clock: 45 }, { quarter: 5, gameClock: 45 }), ['clutch']);
  assert.deepEqual(one({ lead: true, clock: 61 }, { quarter: 4, gameClock: 61 }), []);
  assert.deepEqual(one({ lead: true, clock: 45 }, { quarter: 3, gameClock: 45 }), []);
  assert.deepEqual(one({ clock: 45 }, { quarter: 4, gameClock: 45 }), []);   // a basket that changes nothing
});

test('a game-winner is called when the match ends, if the lead it took still stands', () => {
  const [s, watch] = watched({ quarter: 4, gameClock: 6, score: [60, 61] });
  basket(s, { lead: true, clock: 6 });
  assert.deepEqual(moments(watchStep(watch, s)), ['clutch']);          // at the basket it is only clutch
  s.phase = 'final';
  const heard = watchStep(watch, s);
  assert.deepEqual(kinds(heard), ['winner', 'periodEnd']);
  assert.deepEqual([heard[0].name, heard[0].star, heard[1].final], ['Cross', true, true]);

  const [t, w] = watched({ quarter: 4, gameClock: 6, score: [60, 61] });
  basket(t, { lead: true, clock: 6 });
  watchStep(w, t);
  t.score[1] += 2; watchStep(w, t);                                     // the other side answers
  t.phase = 'final';
  assert.deepEqual(kinds(watchStep(w, t)), ['periodEnd']);

  const [u, x] = watched({ quarter: 4, gameClock: 11, score: [60, 61] });
  basket(u, { lead: true, clock: 11 });                                 // a second too soon
  watchStep(x, u); u.phase = 'final';
  assert.deepEqual(kinds(watchStep(x, u)), ['periodEnd']);
});

test('an ankle-breaker needs the stumble, and the handler\'s basket or assist within four seconds', () => {
  const after = (gap, more = {}) => {
    const [s, watch] = watched();
    s.last.stumble = { by: 0, on: 3, at: s.time - gap };
    basket(s, more);
    return watchStep(watch, s);
  };
  const heard = after(3.9);
  assert.deepEqual(moments(heard), ['ankle']);
  assert.equal(heard[0].name, 'Cross');
  assert.deepEqual(moments(after(4.1)), []);
  assert.deepEqual(moments(after(2, { by: 1, row: 1 })), []);           // a team-mate scored, not off his pass
  const fed = after(2, { by: 1, row: 1, assist: 0 });
  assert.deepEqual([moments(fed), fed[0].name], [['ankle'], 'Cross']);  // off his pass: his moment
});

test('a block is a moment for the blocker, and says when it was a chase-down', () => {
  const [s, watch] = watched();
  s.last.block = { by: 4, on: 0, at: s.time, chase: true };
  const heard = watchStep(watch, s);
  assert.deepEqual([moments(heard), heard[0].team, heard[0].row, heard[0].chase, heard[0].star], [['block'], 1, 1, true, true]);
});

test('a steal is a happening; a basket by the stealing team within five seconds is steal-and-score', () => {
  const [s, watch] = watched();
  s.last.steal = { by: 1, on: 4, at: s.time };
  assert.deepEqual(kinds(watchStep(watch, s)), ['steal']);
  s.time += 4.9; basket(s);
  assert.deepEqual(moments(watchStep(watch, s)), ['stealScore']);
  const [t, w] = watched();
  t.last.steal = { by: 1, on: 4, at: t.time }; watchStep(w, t);
  t.time += 5.1; basket(t);
  assert.deepEqual(moments(watchStep(w, t)), []);
});

test('heating up at a third make in a row, on fire at a fifth, nothing at a second or a fourth', () => {
  for (const [streak, expected] of [[2, []], [3, ['heatingUp']], [4, []], [5, ['onFire']]]) {
    const [s, watch] = watched();
    s.rosters[0][0].streak = streak; basket(s);
    assert.deepEqual(moments(watchStep(watch, s)), expected, `streak ${streak}`);
  }
});

test('a run is marked at 8 points in a row and at every 4 after, and starts again once the other side scores', () => {
  const [s, watch] = watched();
  const marks = [];
  for (const points of [2, 3, 2, 2, 1, 2, 2]) {                         // 2 5 7 9 10 12 14
    s.score[0] += points; s.run[0] += points;
    marks.push(...watchStep(watch, s).filter(h => h.kind === 'run').map(h => `${h.n} at ${s.run[0]}`));
  }
  assert.deepEqual(marks, ['8 at 9', '12 at 12']);
  s.score[1] += 2; s.run[1] = 2; s.run[0] = 0; watchStep(watch, s);
  s.score[0] += 8; s.run[0] = 8; s.run[1] = 0;
  assert.deepEqual(watchStep(watch, s).filter(h => h.kind === 'run').map(h => h.n), [8]);
});

test('a comeback is marked once when a team that was ten behind draws level; nine behind is not a comeback', () => {
  const [s, watch] = watched({ score: [20, 30] });
  watchStep(watch, s);
  s.score = [30, 30];
  assert.deepEqual(moments(watchStep(watch, s)).filter(k => k === 'comeback'), ['comeback']);
  s.score = [32, 30];
  assert.deepEqual(moments(watchStep(watch, s)).filter(k => k === 'comeback'), []);
  const [t, w] = watched({ score: [21, 30] });
  watchStep(w, t);
  t.score = [31, 30];
  assert.deepEqual(moments(watchStep(w, t)).filter(k => k === 'comeback'), []);
});

test('a perfect release is your own green shot from seven metres or more', () => {
  const one = more => { const [s, watch] = watched(); s.controlled = 0; basket(s, { points: 3, ...more }); return moments(watchStep(watch, s)); };
  assert.deepEqual(one({ green: true, far: 7.2 }), ['perfect']);
  assert.deepEqual(one({ green: true, far: 6.9 }), []);
  assert.deepEqual(one({ green: false, far: 7.2 }), []);
  assert.deepEqual(one({ green: true, far: 7.2, by: 1, row: 1 }), []);          // your team-mate's, not yours
  assert.deepEqual(one({ green: true, far: 7.2, team: 1, by: 3 }), []);         // theirs
});

test('whistles, free throws, a timeout and the end of a period are happenings', () => {
  const [s, watch] = watched();
  s.call = { kind: 'travel', team: 0, ball: 1, number: null, shots: 0 };
  assert.deepEqual(watchStep(watch, s).map(h => [h.kind, h.what]), [['violation', 'travel']]);
  s.call = { kind: 'shooting', team: 1, ball: 0, number: 5, name: 'Kai Mercer', shots: 2 };
  s.freeThrow = { shooter: 0, total: 2, left: 2 };
  const heard = watchStep(watch, s);
  assert.deepEqual(kinds(heard), ['foul', 'freeThrow']);
  assert.deepEqual([heard[0].fouler, heard[0].shots, heard[1].name], ['Mercer', 2, 'Cross']);
  for (const kind of ['looseBall', 'illegalScreen']) {
    s.call = { kind, team: 1, ball: 0, number: 5, name: 'Kai Mercer', shots: 0 };
    assert.deepEqual(watchStep(watch, s).map(h => [h.kind, h.what]), [['foul', kind]]);
  }
  s.call = { kind: 'timeout', team: 1, ball: 0, number: null, shots: 0 };
  assert.deepEqual(kinds(watchStep(watch, s)), ['timeout']);
  s.call = { kind: 'out', team: 0, ball: 1, number: null, shots: 0 };
  assert.deepEqual(kinds(watchStep(watch, s)), ['out']);
  s.phase = 'quarterEnd';
  const end = watchStep(watch, s);
  assert.deepEqual([kinds(end), end[0].quarter, end[0].final], [['periodEnd'], 2, false]);
  assert.deepEqual(watchStep(watch, s), []);
});

test('a substitution names who comes on and who goes off', () => {
  const [s, watch] = watched();
  s.players[1].person = 5;
  const heard = watchStep(watch, s);
  assert.deepEqual([kinds(heard), heard[0].name, heard[0].off], [['sub'], 'Bell', 'Marsh']);
});

test('the picture slows only for the end of a shot that is going in and is a buzzer-beater or would win the game', () => {
  const rim = rimCentre(1);
  const flying = (set, info, ball = {}) => {
    const s = createMatch(1, 3);
    Object.assign(s, { phase: 'live', quarter: 4, gameClock: 0, score: [60, 61] }, set);
    Object.assign(s.ball, { holder: null, mode: 'shot', made: true, x: rim.x - 0.3, y: rim.y + 0.3, z: 0, info: { id: 0, team: 0, row: 0, value: 2, clock: 0.5, ...info }, ...ball });
    return s;
  };
  assert.equal(slowFor(flying()), MOMENT.slow);                                   // a buzzer-beater
  assert.equal(slowFor(flying({}, {}, { made: false })), 1);                      // not going in
  assert.equal(slowFor(flying({}, {}, { x: rim.x - 2 })), 1);                     // not there yet
  assert.equal(slowFor(flying({}, { clock: 8 })), MOMENT.slow);                   // would take the lead with 8 s left
  assert.equal(slowFor(flying({ score: [60, 63] }, { clock: 8 })), 1);            // would not
  assert.equal(slowFor(flying({ quarter: 2 }, { clock: 8 })), 1);                 // not late in the match
  assert.equal(slowFor(flying({}, {}, { mode: 'loose' })), 1);
});

test('watching changes nothing in the match, through a whole one, and every moment it returns is one it knows', () => {
  const s = createMatch(3, 3), twin = createMatch(3, 3), watch = createWatch();
  startMatch(s); startMatch(twin);
  const counts = {};
  let steps = 0;
  while (s.phase !== 'final' && steps++ < 60 * 60 * 40) {
    const events = step(s, aiIntents(s, DT), DT);
    step(twin, aiIntents(twin, DT), DT);
    for (const h of watchStep(watch, s, events)) {
      counts[h.kind] = (counts[h.kind] ?? 0) + 1;
      if (h.moment) assert.ok(KINDS.includes(h.kind), h.kind);
    }
    if (steps % 600 === 0) assert.equal(JSON.stringify(s), JSON.stringify(twin), `step ${steps}`);
  }
  assert.equal(JSON.stringify(s), JSON.stringify(twin));
  assert.ok(counts.made > 10 && counts.miss > 5 && counts.rebound > 5 && counts.periodEnd >= 4 && counts.tip === 1, JSON.stringify(counts));
});
