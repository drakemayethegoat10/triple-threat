import { isFoulCall } from '../sim/fouls.js';
// Watching the match for what a broadcast would mark: the big moments, and the plain happenings a commentator calls.
// It only reads the match; nothing here changes it.
import { CLOCK } from '../sim/tuning.js';
import { attackSign, surname } from '../sim/state.js';
import { rimCentre } from '../sim/ball.js';
import { playOn } from '../sim/plays.js';
import { moodOf } from '../sim/mood.js';

// ankleWithin: seconds after a stumble in which a basket by the handler, or set up by him, makes it an ankle-breaker.
// stealWithin: seconds after a steal for a basket to count with it. deep: metres beyond which a three is from deep.
// clutchClock, winnerClock: seconds left in the fourth period or overtime. buzzer: seconds left in any period when
// the ball left the hand. poster, posterNear: for a dunk (not a layup, even one that began as a dunk), metres from the
// hoop, and to the nearest defender. run: points in a row
// that make a run, and runStep: each further step of it. comeback: the deficit a comeback comes back from.
// perfect: metres from which your own green shot is marked. slow: the speed the picture slows to for a buzzer-beater
// or a game-winner, over the last slowWithin metres of the ball's flight. rattled, calmed: the frustration at which a
// player is said to be rattled (see mood.js), and below which he may be said to be again.
export const MOMENT = Object.freeze({ ankleWithin: 4, stealWithin: 5, deep: 8.5, clutchClock: 60, winnerClock: 10, buzzer: 1, poster: 1.5,
  posterNear: 1, run: 8, runStep: 4, comeback: 10, perfect: 7, slow: 0.25, slowWithin: 0.5, rattled: 0.75, calmed: 0.4 });

// The moments, biggest first. The stars get a replay.
export const KINDS = Object.freeze(['winner', 'buzzer', 'ankle', 'block', 'andOne', 'poster', 'stealScore', 'deep', 'clutch', 'onFire',
  'heatingUp', 'run', 'comeback', 'rivalry', 'duo', 'perfect']);
export const STARS = new Set(['winner', 'buzzer', 'ankle', 'block', 'andOne', 'poster']);

const late = (state, clock, within) => state.quarter >= CLOCK.quarters && clock <= within;
// The run a team is credited with: 8, then every 4 more. 0 below 8.
const reached = run => (run >= MOMENT.run ? MOMENT.run + MOMENT.runStep * Math.floor((run - MOMENT.run) / MOMENT.runStep) : 0);

// What the watcher remembers from step to step. `seen` is null until its first look, which marks nothing.
export const createWatch = () => ({ seen: null, behind: [0, 0], runAt: [0, 0], winner: null, board: false, rattled: {} });

function look(state) {
  return { score: state.last.score, block: state.last.block, steal: state.last.steal, rivals: state.last.rivals, call: state.call, phase: state.phase, quarter: state.quarter,
    points: [...state.score], plays: [state.plays[0]?.key ?? null, state.plays[1]?.key ?? null], persons: state.players.map(p => p.person),
    freeThrow: state.freeThrow, holder: state.ball.holder };
}

// One step of watching. Returns what happened in it, the moments first and biggest first, then the plain happenings.
// A moment: { kind, moment: true, star, rank, team, row, name, at, ... }. A plain happening: { kind, moment: false,
// team, row, name, at, ... } with kind 'made', 'miss', 'rebound', 'steal', 'foul', 'violation', 'out', 'timeout',
// 'periodEnd', 'tip', 'play', 'sub', 'freeThrow' or 'rattled' (a player's frustration has boiled over: see mood.js).
// `row` and `name` are null when it is a team's and nobody's. A rivalry's `name` is both players', its `rival` the other's.
export function watchStep(watch, state, events = null) {
  const was = watch.seen, now = look(state), out = [];
  watch.seen = now;
  if (!was) { watch.board = state.board; return out; }
  const at = state.time;
  const who = (team, row) => ({ team, row, name: row === null || row === undefined ? null : surname(state.rosters[team][row]) });
  const moment = (kind, team, row, more = {}) => out.push({ kind, moment: true, star: STARS.has(kind), rank: KINDS.indexOf(kind), ...who(team, row), at, ...more });
  const plain = (kind, team, row, more = {}) => out.push({ kind, moment: false, star: false, rank: KINDS.length, ...who(team, row), at, ...more });

  // A basket from the floor.
  const sc = now.score;
  if (sc && sc !== was.score) {
    plain('made', sc.team, sc.row, { points: sc.points, far: sc.far, finish: sc.finish ?? null, flair: sc.flair ?? null, assist: sc.assist === null ? null : surname(state.rosters[sc.team][sc.assist]) });
    if (sc.fouled) moment('andOne', sc.team, sc.row);
    if (sc.clock <= MOMENT.buzzer) moment('buzzer', sc.team, sc.row);
    const stumble = state.last.stumble, steal = now.steal;
    if (stumble && sc.at - stumble.at <= MOMENT.ankleWithin && state.players[stumble.by]?.team === sc.team
      && (stumble.by === sc.by || state.players[stumble.by].person === sc.assist)) moment('ankle', sc.team, state.players[stumble.by].person);
    if (sc.finish === 'dunk' && sc.far <= MOMENT.poster && sc.gap <= MOMENT.posterNear) moment('poster', sc.team, sc.row);
    if (steal && state.players[steal.by]?.team === sc.team && sc.at - steal.at <= MOMENT.stealWithin) moment('stealScore', sc.team, sc.row);
    if (sc.points === 3 && sc.far > MOMENT.deep) moment('deep', sc.team, sc.row);
    // One of a duo (see sim/mood.js) feeds the other for a dunk, a three or an and-one.
    if (sc.assist !== null && sc.assist === state.rosters[sc.team][sc.row].partner && (sc.finish === 'dunk' || sc.points === 3 || sc.fouled))
      moment('duo', sc.team, sc.row, { off: surname(state.rosters[sc.team][sc.assist]) });
    if ((sc.tied || sc.lead) && late(state, sc.clock, MOMENT.clutchClock)) moment('clutch', sc.team, sc.row);
    const streak = state.rosters[sc.team][sc.row].streak;
    if (streak === 5) moment('onFire', sc.team, sc.row); else if (streak === 3) moment('heatingUp', sc.team, sc.row);
    if (sc.team === 0 && sc.green && sc.far >= MOMENT.perfect && sc.by === state.controlled) moment('perfect', sc.team, sc.row);
    // The lead taken with seconds left: a game-winner if it stands. It is announced when the match ends.
    if (sc.lead && late(state, sc.clock, MOMENT.winnerClock)) watch.winner = { team: sc.team, row: sc.row };
  }
  // Any points for the other side end a would-be winner.
  for (const team of [0, 1]) if (now.points[team] > was.points[team] && watch.winner && watch.winner.team !== team) watch.winner = null;

  if (now.block && now.block !== was.block) {
    const blocker = state.players[now.block.by];
    moment('block', blocker.team, blocker.person, { chase: now.block.chase });
  }
  if (now.steal && now.steal !== was.steal) { const thief = state.players[now.steal.by]; plain('steal', thief.team, thief.person); }

  // Two opponents become rivals; a player on court is rattled (said once, until he has calmed down).
  if (now.rivals && now.rivals !== was.rivals) {
    const { a: [ta, ra], b: [tb, rb] } = now.rivals, them = [surname(state.rosters[ta][ra]), surname(state.rosters[tb][rb])];
    moment('rivalry', ta, ra, { name: `${them[0]} vs ${them[1]}`, rival: them[1] });
  }
  for (const p of state.players) {
    const key = `${p.team}:${p.person}`, { frustration } = moodOf(state, state.rosters[p.team][p.person]);
    if (frustration >= MOMENT.rattled && !watch.rattled[key]) { watch.rattled[key] = true; plain('rattled', p.team, p.person); }
    else if (frustration < MOMENT.calmed) watch.rattled[key] = false;
  }

  // Runs and comebacks, from the score alone, so that free throws count.
  for (const team of [0, 1]) {
    const run = reached(state.run[team]);
    if (state.run[team] === 0) watch.runAt[team] = 0;
    else if (run > watch.runAt[team]) { watch.runAt[team] = run; moment('run', team, null, { n: run }); }
    const gap = now.points[1 - team] - now.points[team];
    if (watch.behind[team] >= MOMENT.comeback && gap <= 0) { watch.behind[team] = 0; moment('comeback', team, null); }
    else watch.behind[team] = Math.max(watch.behind[team], gap);
  }

  // A miss, and who takes the rebound.
  if (state.board && !watch.board && state.ball.info) plain('miss', state.ball.info.team, state.ball.info.row);
  if (!state.board && watch.board && now.holder !== null && was.holder === null && state.phase !== 'dead') {
    const taker = state.players[now.holder];
    plain('rebound', taker.team, taker.person, { own: state.ball.info?.team === taker.team });
  }
  watch.board = state.board;

  // Whistles.
  const call = now.call;
  if (call && call !== was.call) {
    if (call.kind === 'timeout') plain('timeout', call.team, null, { left: [...state.timeouts] });
    else if (isFoulCall(call.kind)) plain('foul', call.team, null, { what: call.kind, fouler: call.name ? surname(call) : null, shots: call.shots });
    else plain(call.kind === 'out' ? 'out' : 'violation', call.team, null, { what: call.kind });
  }
  if (now.freeThrow && now.freeThrow !== was.freeThrow) { const shooter = state.players[now.freeThrow.shooter]; plain('freeThrow', shooter.team, shooter.person, { shots: now.freeThrow.total }); }

  // The tip, a play called, a substitution, the end of a period.
  if (was.phase === 'jumpBall' && now.phase === 'live') plain('tip', state.tipWinner ?? state.possession, null);
  for (const team of [0, 1]) if (now.plays[team] && now.plays[team] !== was.plays[team]) plain('play', team, null, { play: playOn(state, team).name });
  state.players.forEach((p, i) => {
    if (was.persons[i] !== undefined && was.persons[i] !== p.person && was.persons.length === now.persons.length) plain('sub', p.team, p.person, { off: surname(state.rosters[p.team][was.persons[i]]) });
  });
  const ended = (now.phase === 'quarterEnd' || now.phase === 'final') && was.phase !== 'quarterEnd' && was.phase !== 'final' && was.phase !== 'start';
  if (ended) plain('periodEnd', null, null, { quarter: was.quarter, final: now.phase === 'final', score: [...state.score] });
  if (now.phase === 'final' && was.phase !== 'final' && watch.winner && state.score[watch.winner.team] > state.score[1 - watch.winner.team]) {
    moment('winner', watch.winner.team, watch.winner.row);
    watch.winner = null;
  }
  return out.sort((a, b) => a.rank - b.rank);
}

// How fast the picture should run: slowed for the last of the flight of a shot that is going in and is a
// buzzer-beater or would win the game. The match clock slows with it, so nothing is gained or lost.
export function slowFor(state) {
  const { ball } = state, info = ball.info;
  if (ball.mode !== 'shot' || !ball.made || !info) return 1;
  const rim = rimCentre(attackSign(info.team));
  if (Math.hypot(ball.x - rim.x, ball.y - rim.y, ball.z - rim.z) > MOMENT.slowWithin) return 1;
  const mine = state.score[info.team], theirs = state.score[1 - info.team];
  const wins = late(state, info.clock, MOMENT.winnerClock) && mine <= theirs && mine + info.value > theirs;
  return info.clock <= MOMENT.buzzer || wins ? MOMENT.slow : 1;
}
