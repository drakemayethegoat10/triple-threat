// Offensive plays: where the team with the ball goes, moment by moment, while a play is on. A play is called by the
// coach (the computer, for either team) or by you from the play list; the computer's players and your team-mates
// run it. The rules never read a play: it only says where players should go.
import { AI, ARC, CLOCK, FOUL, PLAY, RIM } from './tuning.js';
import { attackSign, onFloor, personOf, rand } from './state.js';
import { guardOf, schemeOf, swap } from './matchups.js';
import { styled } from './styles.js';
import { playWeight, running } from './coach.js';
import { rated, starOf, heatOf } from './ratings.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// The ratings from which a play suits a player: a post scorer's inside, a sharpshooter's three, a handler's handle,
// the three of a big who can pop, and the mid-range of a handler who pulls up off a screen.
const SUIT = Object.freeze({ post: 80, shooter: 85, handle: 80, pop: 75, pullUp: 78 });

// Each play: its name, a line for the player on what to do, the sizes of match it suits, how long it runs at most,
// `ripe` (when the handler may shoot from outside or pass: the seconds into the play, or 'used' for once the screen
// has been used; until then he keeps the ball so that the play can form), `screener` (the part that sets a screen on
// the ball, if one does), `away(c)` (a screen away from the ball: { by, for, spot, to }, the part setting it, the part
// it frees, where it stands and where he goes), `screens` (that screener's part), `afterPass` (the play turns on a pass,
// and goes on after it; any other is over soon after the ball is passed on), and `spots(c)`: where each part should be
// now, as { part: spot }; `ball` is where whoever holds the ball should take it when he has nothing better to do.
// The parts are handler (who held the ball when the play was called), big, big2, wing and shooter. `c` is the
// play's context: see context() below. Distances are along the court from the centre line toward the hoop
// attacked (the hoop is at 12.725, the baseline at 14.325: the NBA's court) and across it toward the play's side.
export const PLAYS = Object.freeze({
  pickRoll: {
    name: 'Pick & Roll', hint: 'Use the screen, then hit the roller or score', sizes: [3, 5], long: 8, ripe: 'used', screener: 'big',
    spots: c => ({
      big: !c.used ? c.screen() : c.sinceUsed < PLAY.roll ? c.at(11.3, 0.5, true) : c.at(11.6, -3.2),
      big2: c.at(7.47, -5.87), wing: c.five ? c.relocate('wing', 11.9, -7.06) : c.relocate('wing', 7.47, -5.87), shooter: c.relocate('shooter', 11.9, 7.06),
      ball: c.handle(c.at(5.21, -0.64)),
    }),
  },
  pickPop: {
    name: 'Pick & Pop', hint: 'Use the screen, then find the big at the arc', sizes: [3, 5], long: 8, ripe: 'used', screener: 'big',
    spots: c => ({
      big: !c.used ? c.screen() : c.at(5.84, -2.36),
      // The big pops out, leaving the paint: a wing who is no shooter fills the dunker spot.
      big2: c.at(11.6, -3.2), wing: c.five ? c.relocate('wing', 11.9, -7.06, true) : c.relocate('wing', 7.47, -5.87, true), shooter: c.relocate('shooter', 11.9, 7.06),
      ball: c.handle(c.at(5.21, -0.64)),
    }),
  },
  iso: {
    name: 'Clear Out', hint: 'Everyone clears: take your man one on one', sizes: [3, 5], long: 7, ripe: 1,
    spots: c => ({
      big: c.five ? c.at(11.6, -3.2) : c.at(11.9, -7.06), big2: c.at(7.47, -5.87), wing: c.five ? c.at(11.9, -7.06) : c.at(7.47, -5.87),
      shooter: c.at(11.9, 7.06),
      ball: c.t < 1 ? c.at(6.34, 2.16) : c.at(11.1, 1.2),
    }),
  },
  horns: {
    name: 'Horns', hint: 'Bigs at the elbows: use the screen on your side', sizes: [5], long: 9, ripe: 'used', screener: 'big',
    spots: c => ({
      big: c.t < 1.6 ? c.at(8.3, 2.6) : !c.used ? c.screen() : c.sinceUsed < PLAY.roll ? c.at(11.3, 0.5, true) : c.at(11.6, 3.2),
      big2: c.used ? c.at(5.42, -1.61) : c.at(8.3, -2.6),
      wing: c.relocate('wing', 11.9, -7.06), shooter: c.relocate('shooter', 11.9, 7.06),
      ball: c.handle(c.at(5.01, 0)),
    }),
  },
  fiveOut: {
    name: '5-Out Motion', hint: 'All five outside: hit the cutter going to the rim', sizes: [5], long: 10, ripe: 1,
    spots(c) {
      // A turn lasts PLAY.cut seconds, on one side then the other: the wing there cuts to the rim and out to the
      // corner, and the corner man lifts to the wing. So the two have changed places by the next turn on that side.
      const turn = Math.floor(c.t / PLAY.cut), into = c.t - turn * PLAY.cut, near = turn % 2 === 0;
      const side = (pair, mine, done) => {
        const [wing, corner] = done % 2 === 0 ? pair : [pair[1], pair[0]], s = mine ? 1 : -1, live = near === mine;
        return {
          [wing]: !live || into < 0.8 ? c.at(7.17, 6.16 * s) : into < 2.3 ? c.at(11.3, 0.6 * s, true) : c.at(11.9, 7.06 * s),
          [corner]: !live || into < 0.8 ? c.at(11.9, 7.06 * s) : c.at(7.17, 6.16 * s),
        };
      };
      return { ...side(['shooter', 'big'], true, Math.ceil(turn / 2)), ...side(['wing', 'big2'], false, Math.floor(turn / 2)), ball: c.at(5.01, 0) };
    },
  },
  postUp: {
    name: 'Post Up', hint: 'Feed the big on the block', sizes: [3, 5], long: 9, ripe: 2, afterPass: true,
    target: c => (c.holds('big') ? null : 'big'),
    spots: c => ({
      big: c.at(11.3, 3.2), big2: c.at(8.5, -2.7), wing: c.at(7.47, -5.87), shooter: c.five ? c.at(5.21, -0.53) : c.at(5.42, -1.61),
      handler: c.at(6.24, 2.58),
      ball: c.holds('big') ? c.at(12, 1.3) : c.at(6.24, 2.58),   // fed from the slot, where the pass goes clear of the handler's defender
    }),
  },
  floppy: {
    name: 'Floppy', hint: 'Shooters come off the screens: hit the open one', sizes: [5], long: 7, ripe: 2.4,
    spots: c => ({
      big: c.at(10.1, 3.4), big2: c.at(10.1, -3.4),
      shooter: c.t < 1.4 ? c.at(12.3, 0.9) : c.at(7.27, 5.96, c.t < 3),
      wing: c.t < 1.4 ? c.at(12.3, -0.9) : c.at(7.27, -5.96, c.t < 3),
      ball: c.at(5.01, 0),
    }),
  },
  spain: {
    name: 'Spain Pick & Roll', hint: 'Pick and roll with a back screen for the roller', sizes: [5], long: 8, ripe: 'used', screener: 'big',
    spots: c => ({
      big: !c.used ? c.screen() : c.sinceUsed < PLAY.roll ? c.at(11.3, 0.5, true) : c.at(11.6, -3.2),
      shooter: !c.used ? c.at(7.9, -0.4) : c.sinceUsed < 1.2 ? c.backScreen('big') : c.at(5.42, -1.28),
      big2: c.at(11.9, -7.06), wing: c.at(11.9, 7.06),
      ball: c.handle(c.at(5.21, -0.64)),
    }),
  },
  giveGo: {
    name: 'Give & Go', hint: 'Pass to the wing, then look for the cutter', sizes: [3, 5], long: 7, ripe: 0.6, afterPass: true,
    target: c => (!c.passed ? (c.five ? 'shooter' : 'wing') : c.sincePass > 0.5 && c.sincePass < 2 ? 'handler' : null),
    spots: c => ({
      [c.five ? 'shooter' : 'wing']: c.at(7.14, 5.13),
      big: c.five ? c.at(11.6, -3.2) : c.at(11.9, -7.06), big2: c.at(7.47, -5.87), ...(c.five ? { wing: c.at(11.9, -7.06) } : {}),
      handler: c.passed && c.sincePass < 2 ? c.at(11.3, 0.6, true) : c.at(11.9, 7.06),
      ball: c.at(5.42, 1.28),
    }),
  },
  ucla: {
    name: 'UCLA Cut', hint: 'Pass to the wing: the cutter rubs off the high post', sizes: [5], long: 9, ripe: 0.8, afterPass: true,
    target: c => (!c.passed ? 'shooter' : c.sincePass > 0.6 && c.sincePass < 2.2 ? 'handler' : null),
    spots: c => ({
      big: c.passed && c.sincePass > 1.5 ? c.screen() : c.at(8.3, 2.7),
      shooter: c.at(7.47, 5.87), wing: c.at(7.47, -5.87), big2: c.at(11.3, -3.2),
      handler: c.at(11.3, 3.1, c.passed && c.sincePass < 1.5),
      ball: c.at(5.21, 0.86),
    }),
  },
  // A dribble handoff into a pick and roll: the handler dribbles at the wing, who comes up for the ball and takes it
  // from him on the move; the big comes up and screens the wing's man, and rolls; the handler spaces out to the corner.
  dho: {
    name: 'Handoff', hint: 'Dribble at the wing, hand it off: the big screens and rolls', sizes: [3, 5], long: 8, ripe: 1, afterPass: true, screener: 'big',
    target: c => (!c.passed && c.t >= 1 && c.near(c.taker, c.state.players[c.state.ball.holder], PLAY.handoff) ? c.taker : null),
    spots: c => ({
      [c.taker]: c.t < 0.8 ? c.at(10.9, 6.2) : c.at(6.5, 2.3, true),
      handler: c.holds('handler') ? c.at(6.9, 3.6) : c.at(11.9, 7.06, c.sincePass < 1),
      big: !c.passed ? c.at(8.6, -2.6) : !c.used ? c.screen() : c.sinceUsed < PLAY.roll ? c.at(11.3, 0.5, true) : c.at(11.6, -3.2),
      ...(c.five ? { big2: c.at(7.47, -5.87), wing: c.relocate('wing', 11.9, -7.06) } : {}),
      ball: c.holds('handler') ? c.at(6.9, 3.6) : c.handle(c.at(6.5, 2.3)),
    }),
  },
  // A flare screen: the big screens the shooter's man away from the ball, and the shooter flares out to the arc on
  // the weak side, his man caught behind the screen; then the big dives.
  flare: {
    name: 'Flare Screen', hint: 'The big screens away from the ball: hit the shooter flaring to the arc', sizes: [3, 5], long: 7, ripe: 1.6, screens: 'big',
    away: c => { const to = c.at(7.4, -6.3); return { by: 'big', for: c.taker, to, spot: c.screenOn(c.taker, to) }; },
    target: c => (c.used && !c.passed && c.near(c.taker, c.at(7.4, -6.3), 1.5) ? c.taker : null),
    spots: c => ({
      big: !c.used || c.sinceUsed < 0.8 ? PLAYS.flare.away(c).spot : c.sinceUsed < 2.4 ? c.at(11.3, -0.9, true) : c.at(11.6, -3.2),
      [c.taker]: c.used ? c.at(7.4, -6.3, true) : c.at(7.9, -3.3),
      ...(c.five ? { big2: c.at(11.6, 3.2), wing: c.at(11.9, 7.06) } : {}),
      handler: c.at(5.6, 1.4), ball: c.holds('handler') ? c.at(5.6, 1.4) : c.at(7.4, -6.3),   // the shooter, fed, stays on the arc
    }),
  },
});

// The plays a match of `size` a side can run, in the play list's order.
export const playsFor = size => Object.keys(PLAYS).filter(key => PLAYS[key].sizes.includes(size));

// What a play's spots are worked out from. t: seconds since it was called. five: a five-a-side match.
// at(along, across, sprint): a spot on the court. set: the screener stands set beside the ball handler's defender.
// used, sinceUsed: the handler has gone past the screen, and for how long. passed, sincePass: the ball has left
// the handler for a team-mate, and for how long. holds(part): that part has the ball now.
// variant, reject: how the handler takes a pick play's screen (see start; reject once the screen is set, by the draw
// or because his man has jumped it). taker: the man a handoff or a flare is for (the shooter in five a side, the wing
// in three).
function context(state, play) {
  const sign = attackSign(play.team), S = play.side, hoop = { x: sign * RIM.x, z: 0 };
  const who = part => state.players[play.ids[part]];
  const holder = state.players[state.ball.holder] ?? who('handler');
  // Beside the defender of `on`, across his way: u points from `on` to the hoop, v across it toward the play's side.
  const beside = on => {
    const far = dist(on, hoop) || 1, u = { x: (hoop.x - on.x) / far, z: (hoop.z - on.z) / far };
    let v = { x: -u.z, z: u.x };
    if ((Math.abs(v.z) > 0.2 ? v.z * S : -v.x * sign * S) < 0) v = { x: -v.x, z: -v.z };
    return { u, v, d: guardOf(state, on) };
  };
  const c = {
    state, t: play.t, five: state.size === 5,
    at: (along, across, sprint = false) => ({ x: sign * along, z: across * S, sprint }),
    set: play.setAt !== null, used: play.usedAt !== null, sinceUsed: play.t - (play.usedAt ?? play.t),
    passed: play.passAt !== null, sincePass: play.t - (play.passAt ?? play.t),
    holds: part => holder === who(part),
    variant: play.variant ?? 'normal', reject: !!play.reject, taker: state.size === 5 ? 'shooter' : 'wing',
    // Whether `part` is within `within` of `spot` (a place, or a player).
    near: (part, spot, within) => !!who(part) && !!spot && dist(who(part), spot) < within,
    // The side of the court the ball is going to as the screen is used: the play's side, or the other, rejected or
    // snaked back.
    ballSide() { return play.reject || (play.variant === 'snake' && c.used && c.sinceUsed >= PLAY.snake) ? -1 : 1; },
    // Where the handler of a pick play takes the ball: waiting at `wait` for the screen, then round it (or away from
    // it, rejecting it), then as the variant goes once it is used.
    handle: wait => (c.used ? c.afterScreen() : c.set ? (play.reject ? c.at(9.4, -2.2) : c.past()) : wait),
    afterScreen() {
      if (play.reject) return c.at(11.1, -1.2);
      if (play.variant === 'snake') return c.sinceUsed < PLAY.snake ? c.at(9.6, 3) : c.at(11, -1.4);
      if (play.variant === 'pullup') return c.at(8.7, 2.3);
      return c.at(11.1, 1);
    },
    // A man spotted up at `along`, `wide` on side `across` (1 the play's) as the screen is used: on the side the ball
    // goes he lifts from the corner to the wing, opening the pass back out; on the other a shooter drops from the wing
    // to the corner or stays in it, and a man who is no shooter stays, or (`dunker`, the paint left empty) drifts in
    // along the baseline to the dunker spot.
    relocate(part, along, wide, dunker = false) {
      const across = Math.sign(wide), home = c.at(along, Math.abs(wide) * across), corner = along > 10;
      if (!c.used || c.sinceUsed < PLAY.relocate) return home;
      if (across === c.ballSide()) return corner ? c.at(9.2, 6.6 * across) : home;
      if (who(part) && rated(state, who(part), 'three') >= ARC.threeAt) return c.at(11.9, 7.06 * across);
      return dunker ? c.at(12.9, 3 * across) : home;
    },
    // A screen away from the ball: by the defender of `part`, on his way to `to`.
    screenOn(part, to) {
      const d = guardOf(state, who(part)) ?? who(part), far = dist(d, to) || 1;
      return { x: d.x + ((to.x - d.x) / far) * PLAY.screenGap, z: d.z + ((to.z - d.z) / far) * PLAY.screenGap, sprint: true };
    },
    // Whether the handler's man has jumped the screen: over toward its side by PLAY.cheat or more.
    cheats() { const { v, d } = beside(holder); return !!d && (d.x - holder.x) * v.x + (d.z - holder.z) * v.z >= PLAY.cheat; },
    // Where the screener stands: beside the defender of whoever has the ball, on the play's side.
    screen() { const { u, v, d } = beside(holder); return { x: d.x + v.x * PLAY.screenGap - u.x * 0.1, z: d.z + v.z * PLAY.screenGap - u.z * 0.1, sprint: true }; },
    // Where the handler goes to use the screen: round the outside of the man setting it, never through him. First
    // across, until he is wide of the screener's outside shoulder; then past him; then on toward the hoop.
    past() {
      const { u, v } = beside(holder), part = PLAYS[play.key].screener, spot = c.screen();
      const man = part && who(part) && dist(who(part), spot) < PLAY.setDist ? who(part) : spot;   // the screener himself, if he is where the screen is
      const level = (holder.x - man.x) * u.x + (holder.z - man.z) * u.z;   // how far past the screener he is, toward the hoop
      const out = (holder.x - man.x) * v.x + (holder.z - man.z) * v.z;     // how far wide of him, on the play's side
      const [on, wide] = level >= PLAY.roundBy ? [1.8, 0.8] : out < PLAY.roundGap - 0.15 ? [level, PLAY.roundGap] : [PLAY.roundBy + 0.2, PLAY.roundGap];
      return { x: man.x + v.x * wide + u.x * on, z: man.z + v.z * wide + u.z * on };
    },
    // A screen set behind the defender of `part`, on his way back to the hoop.
    backScreen(part) { const { u, d } = beside(who(part)); return { x: d.x + u.x * PLAY.screenGap, z: d.z + u.z * PLAY.screenGap, sprint: true }; },
  };
  return c;
}

// Gives the play's parts to the team's players on the court, by what each is good at: the handler has the ball; of
// the rest the best inside (inside and rebound together) is the big and the next is big2; of those left the better
// three-point shooter is the shooter and the other the wing. Three a side has a big and a wing. One of a duo with the
// ball plays off the other (see mood.js MOOD.duo): his partner, on court, is the big, who screens for him, rolls and
// posts up: their two-man game.
export function cast(state, holder) {
  const r = (p, key) => rated(state, p, key), inside = p => r(p, 'inside') + r(p, 'rebound');
  const rest = state.players.filter(p => p.team === holder.team && p !== holder).sort((a, b) => inside(b) - inside(a) || a.slot - b.slot);
  const partner = personOf(state, holder).partner, mate = partner === undefined ? null : rest.find(p => p.person === partner);
  if (mate) rest.unshift(...rest.splice(rest.indexOf(mate), 1));
  const ids = { handler: holder.id, big: rest[0].id };
  if (rest.length === 2) { ids.wing = rest[1].id; return ids; }
  const [shooter, wing] = rest.slice(2).sort((a, b) => r(b, 'three') - r(a, 'three') || a.slot - b.slot);
  return { ...ids, big2: rest[1].id, wing: wing.id, shooter: shooter.id };
}

// How well a play suits who is on the floor for `team`, as a weight for the coach's pick: a post-up wants a post
// scorer, Floppy a sharpshooter, a clear-out the star or a hot hand, the pick and rolls a handler, a pick and pop a
// big who can shoot. 1 is a play like any other.
export function suits(state, team, key, ids = null, star = null) {
  const holder = state.players[state.ball.holder];
  if (!holder || holder.team !== team) return 1;
  ids ??= cast(state, holder);
  const r = (id, k) => rated(state, state.players[id], k);
  const pick = r(holder.id, 'handle') >= SUIT.handle ? 2 : 1;
  switch (key) {
    case 'postUp': return r(ids.big, 'inside') >= SUIT.post ? 3 : 0.5;
    case 'floppy': return r(ids.shooter, 'three') >= SUIT.shooter ? 3 : 0.5;
    case 'iso': return (star ?? starOf(state, team)) === holder.person || heatOf(personOf(state, holder)) === 'hot' ? 3 : 1;
    case 'pickPop': return pick * (r(ids.big, 'three') >= SUIT.pop ? 2 : 0.3);
    case 'flare': return r(ids.shooter ?? ids.wing, 'three') >= SUIT.shooter ? 2 : 0.7;
    case 'pickRoll': case 'spain': case 'horns': case 'dho': return pick;
    default: return 1;
  }
}

// Whether `team` can start a play now: it has the ball in live play in its front court, with time to run one.
function ready(state, team) {
  const holder = state.players[state.ball.holder];
  return state.phase === 'live' && holder?.team === team && !holder.inbounder && !holder.shooting && onFloor(holder)
    && attackSign(team) * holder.x > PLAY.startX && Math.min(state.shotClock, state.gameClock) > PLAY.minClock;
}

function start(state, team, key) {
  const holder = state.players[state.ball.holder];
  const side = Math.abs(holder.z) > 1 ? Math.sign(holder.z) : rand(state) < 0.5 ? 1 : -1;
  const variant = PLAYS[key].ripe === 'used' ? variantFor(state, holder) : 'normal';
  state.plays[team] = { key, team, t: 0, side, ids: cast(state, holder), setAt: null, usedAt: null, passAt: null, variant, reject: false };
}

// How the handler of a pick play will take its screen, drawn by PLAY.variants: to the rim, rejecting it, snaking, or
// pulling up at the elbow (only a man with SUIT.pullUp at mid-range: anyone else goes to the rim instead).
function variantFor(state, handler) {
  const weights = { ...PLAY.variants };
  if (rated(state, handler, 'mid') < SUIT.pullUp) { weights.normal += weights.pullup; weights.pullup = 0; }
  let at = rand(state) * Object.values(weights).reduce((a, b) => a + b, 0);
  return Object.keys(weights).find(k => (at -= weights[k]) < 0) ?? 'normal';
}

// Asks for a play for `team`: it starts as soon as the team can run it, in place of any play then on. Returns
// whether the match has that play.
export function callPlay(state, team, key) {
  if (!playsFor(state.size).includes(key)) return false;
  state.playCall[team] = key;
  return true;
}

// Moves the plays on by dt: ends one that is over, notes when its screen is set and used and when the ball is
// passed on, and starts the next: the one asked for, or after a moment one the coach picks.
export function stepPlays(state, dt) {
  const holder = state.players[state.ball.holder];
  for (const team of [0, 1]) {
    const play = state.plays[team];
    const has = state.phase === 'live' && (holder ? holder.team === team : state.ball.mode === 'pass' && state.lastTouch === team);
    if (play) {
      play.t += dt;
      // A play that does not turn on a pass is over soon after the ball is passed on: the offence is read from there.
      const over = !has || play.t > PLAYS[play.key].long || state.shotClock < AI.panicClock || holder?.shooting
        || (play.passAt !== null && !PLAYS[play.key].afterPass && play.t - play.passAt > PLAY.afterPass);
      if (over || (state.playCall[team] && ready(state, team))) { state.plays[team] = null; state.playWait[team] = over ? PLAY.wait : 0; }
      else {
        if (holder && holder.id !== play.ids.handler) play.passAt ??= play.t;
        const part = PLAYS[play.key].screener, screener = part && state.players[play.ids[part]];
        if (screener && holder && screener !== holder) {
          const c = context(state, play), sign = attackSign(team);
          if (play.setAt === null && dist(screener, c.screen()) < PLAY.setDist && screener.setT >= FOUL.setTime) {
            play.setAt = play.t;
            play.reject = play.variant === 'reject' || (PLAYS[play.key].ripe === 'used' && c.cheats());   // his man has jumped it: he goes the other way
          }
          if (play.setAt !== null && play.usedAt === null && (sign * holder.x > sign * screener.x + 0.3 || play.t - play.setAt > PLAY.useBy)) play.usedAt = play.t;
        }
        // A screen away from the ball: set once its screener stands by the man it is on, or after PLAY.flareBy however
        // it is; the man it frees goes at once.
        const away = PLAYS[play.key].away;
        if (away && play.setAt === null) {
          const a = away(context(state, play)), by = state.players[play.ids[a.by]];
          if ((by && dist(by, a.spot) < PLAY.setDist && by.setT >= FOUL.setTime) || play.t > PLAY.flareBy) play.setAt = play.usedAt = play.t;
        }
        continue;
      }
    }
    state.playWait[team] = Math.max(0, state.playWait[team] - dt);
    if (!ready(state, team)) continue;
    const list = playsFor(state.size);
    let key = state.playCall[team];
    // The coach lets the ball be walked up and the offence set before he calls anything; a play you ask for starts at once.
    if (!key && state.playWait[team] <= 0 && CLOCK.shot - state.shotClock >= styled(state, 'play.startAt')) {
      // The coach's pick: any play the match has, the likelier the better it suits who is on the floor, the more his
      // playbook calls it, the bigger the mismatch it hunts and the more it has scored (see coach.js).
      const ids = cast(state, state.players[state.ball.holder]);
      const weights = list.map(play => suits(state, team, play, ids) * playWeight(state, team, play, ids));
      let at = rand(state) * weights.reduce((sum, w) => sum + w, 0);
      key = list.find((_, i) => (at -= weights[i]) < 0) ?? list[list.length - 1];
    }
    if (key) { start(state, team, key); state.playCall[team] = null; running(state, team, key); if (state.ato === team) state.ato = null; }
  }
}

// Where the play sends `player` now ({ x, z, sprint }), or null when his team has no play on or it gives him no spot.
export function playSpot(state, player) {
  const play = state.plays[player.team];
  if (!play) return null;
  const part = Object.keys(play.ids).find(name => play.ids[name] === player.id);
  const spots = PLAYS[play.key].spots(context(state, play));
  return (state.ball.holder === player.id ? spots.ball ?? spots[part] : spots[part]) ?? null;
}

// The play `team` is running: { key, name, hint }, or null.
export function playOn(state, team) {
  const play = state.plays[team];
  return play ? { key: play.key, name: PLAYS[play.key].name, hint: PLAYS[play.key].hint } : null;
}

// Whether `player` should keep the ball for now: he is the handler of a play that has not yet formed. He may still
// take it to the rim; he does not shoot from outside or pass until the play is ripe, or has run for PLAY.ripeBy.
export function playHolds(state, player) {
  const play = state.plays[player.team];
  if (!play || play.ids.handler !== player.id || state.ball.holder !== player.id || play.t >= PLAY.ripeBy) return false;
  const { ripe } = PLAYS[play.key];
  return ripe === 'used' ? play.usedAt === null : play.t < ripe;
}

// Whether `team`'s play has done its work: its screen on the ball has been used. The offence has then been run.
export const playRan = (state, team) => (state.plays[team]?.usedAt ?? null) !== null;

// The team-mate the play wants the ball passed to now, or null: the big on the block, the cutter going to the rim.
export function playTarget(state, player) {
  const play = state.plays[player.team], want = play && PLAYS[play.key].target?.(context(state, play));
  const mate = want ? state.players[play.ids[want]] : null;
  return mate && mate !== player ? mate : null;
}

// The man setting the screen on the ball in `team`'s play, while that screen is still to come or has just been used
// (within `after` seconds): his id, or null. For a defence that drops its big off him (see ai.js).
export function screenerOn(state, team, after = 1.2) {
  const play = state.plays[team], part = play && PLAYS[play.key].screener;
  if (!part || (play.usedAt !== null && play.t - play.usedAt > after)) return null;
  const id = play.ids[part] ?? null;
  return id === state.ball.holder ? null : id;   // a handoff's handler is no screener while he still has the ball
}

// A switching team swaps on the screen itself: the moment the ball handler uses a play's screen, his defender and the
// screener's take each other's men (unless either has just swapped). Teams that go over or drop do not.
export function schemeSwitches(state) {
  for (const team of [0, 1]) {
    const play = state.plays[team], part = play && PLAYS[play.key].screener;
    if (!part || play.usedAt === null || play.switched) continue;
    play.switched = true;
    // Whoever uses the screen: the man with the ball (in a handoff, the one he gave it to), not the screener.
    const holder = state.players[state.ball.holder], screener = state.players[play.ids[part]];
    const handler = holder && holder.team === team && holder !== screener ? holder : state.players[play.ids.handler];
    const a = guardOf(state, handler), b = screener && guardOf(state, screener);
    if (!a || !b || a === b || schemeOf(state, a.team).screen !== 'switch' || a.switchWait > 0 || b.switchWait > 0) continue;
    swap(state, a, b);
  }
}
