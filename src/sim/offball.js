// What a player of the team with the ball does when he does not have it and no play gives him a part: a place that
// suits what he is, taken up in his own time, and the moves he makes from it: a cut, getting out of the way of a
// drive, running a lane on a fast break. The rules never read any of this: it only says where he should go.
import { AI, ARC, FOUL, OFF, RIM, isHuman } from './tuning.js';
import { styled } from './styles.js';
import { attackSign, personOf, rand } from './state.js';
import { choose } from './choose.js';
import { rated } from './ratings.js';
import { guardOf } from './matchups.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const inside = (state, p) => rated(state, p, 'inside') + rated(state, p, 'rebound');
// How far `point` is from the straight line from `a` to `b`, and how far along it the nearest point is (0 to 1).
function off(point, a, b) {
  const lx = b.x - a.x, lz = b.z - a.z, t = Math.min(1, Math.max(0, ((point.x - a.x) * lx + (point.z - a.z) * lz) / (lx * lx + lz * lz || 1)));
  return { far: Math.hypot(point.x - (a.x + lx * t), point.z - (a.z + lz * t)), t };
}

// What he is, for where he stands: one of his team's two best inside men on the floor is a big (one, in three a
// side); a good three-point shooter is a shooter; anyone else is a slasher.
export function kindOf(state, player) {
  if (personOf(state, player).tend?.lowPost) return 'big';   // a guard who posts up waits on the block too (see tendencies.js)
  const team = state.players.filter(p => p.team === player.team).sort((a, b) => inside(state, b) - inside(state, a) || a.slot - b.slot);
  if (team.indexOf(player) < (state.size === 5 ? 2 : 1)) return 'big';
  return rated(state, player, 'three') >= OFF.shooterAt ? 'shooter' : 'slasher';
}

// The side of the court `team`'s ball is on (+1 or -1), changing only when the ball is well past the middle.
function sideOf(state, team) {
  if (state.ball.z * state.side[team] < -OFF.sideHold) state.side[team] = -state.side[team];
  return state.side[team];
}

// A place for every player of `team` but its ball handler, no two the same, by what each is: shooters behind the
// three-point line (the corner on the ball's side first), slashers on the wings and at the top, one big low on the
// weak side and a second at the high post on the ball's side when the ball is on a wing. Returns Map(id -> { x, z }).
export function places(state, team) {
  const sign = attackSign(team), S = sideOf(state, team), holder = state.players[state.ball.holder];
  const at = (along, across) => ({ x: sign * along, z: across * S });
  const onWing = holder?.team === team && Math.abs(holder.z) > 4;
  const lists = {
    shooter: [at(11.9, 7.06), at(7.37, -5.96), at(11.9, -7.06), at(7.37, 5.96), at(5.21, 0)],
    slasher: [at(7.37, 5.96), at(7.37, -5.96), at(5.21, 0), at(11.9, -7.06), at(11.9, 7.06)],
    // In three a side the one big comes up to the high post when the ball is on a wing.
    big: state.size === 3 && onWing ? [at(8.5, 2.7), at(11.3, -3.2)] : [at(11.3, -3.2), onWing ? at(8.5, 2.7) : at(11.3, 3.2), at(8.5, -2.7)],
  };
  const order = { big: 0, shooter: 1, slasher: 2 }, taken = holder?.team === team ? [holder] : [], given = new Map();
  const rest = state.players.filter(p => p.team === team && p !== holder).map(p => ({ p, kind: kindOf(state, p) }))
    .sort((a, b) => order[a.kind] - order[b.kind] || (a.kind === 'big' ? inside(state, b.p) - inside(state, a.p) : rated(state, b.p, 'three') - rated(state, a.p, 'three')) || a.p.slot - b.p.slot);   // the best big and the best shooter choose first
  for (const { p, kind } of rest) {
    const spot = lists[kind].find(s => taken.every(t => dist(s, t) >= OFF.apart)) ?? [...lists.slasher, ...lists.shooter].find(s => taken.every(t => dist(s, t) >= OFF.apart)) ?? lists[kind][0];
    taken.push(spot); given.set(p.id, spot);
  }
  return given;
}

// The spots on the arc a shooter may go to: both corners, both wings above the break, the top. `team` attacking.
function arcSpots(state, team) {
  const sign = attackSign(team), S = sideOf(state, team);
  return [[11.9, 7.06], [11.9, -7.06], [7.37, 5.96], [7.37, -5.96], [5.21, 0]].map(([along, across]) => ({ x: sign * along, z: across * S }));
}

// The most open spot on the arc within `reach` metres of `player`, away from his own team-mates and the ball, and not
// where he stands: the one furthest from any defender, if that is at least ARC.openAt. Null if none is.
function openSpot(state, player, reach) {
  let best = null, room = ARC.openAt;
  for (const spot of arcSpots(state, player.team)) {
    const far = dist(spot, player);
    if (far > reach || far < 1.2) continue;
    if (state.players.some(m => m.team === player.team && m !== player && dist(m, spot) < OFF.apart)) continue;
    const open = Math.min(...state.players.filter(o => o.team !== player.team).map(o => dist(o, spot)));
    if (open > room) { room = open; best = spot; }
  }
  return best;
}

// Whether `player` shoots threes well enough to go looking for one.
const threeMan = (state, player) => rated(state, player, 'three') >= ARC.threeAt;

// Whether the handler is going at the hoop: moving toward it at some pace, from anywhere on the court.
function driving(holder, hoop) {
  const far = dist(holder, hoop) || 1, speed = Math.hypot(holder.vx, holder.vz);
  return speed > OFF.drivePace && (holder.vx * (hoop.x - holder.x) + holder.vz * (hoop.z - holder.z)) / (far * speed) > 0.7;
}

// Whether `player` is beaten off the ball: his defender is far from him, or is further from the hoop than he is,
// and nobody stands on his way to the rim.
function beaten(state, player, hoop) {
  const defender = guardOf(state, player);
  return dist(defender, player) > OFF.cutGap || dist(defender, hoop) > dist(player, hoop) + 0.3;
}

// Whether a cut from where `player` stands can go: he is not already near the rim, and nobody stands on his way to it.
const wayClear = (state, player, hoop) => dist(player, hoop) > OFF.cutFrom && state.players.every(o => o.team === player.team || off(o, player, hoop).far > OFF.cutWidth);

// Where `player`, whose team has the ball, should be now, and why: { x, z, sprint, why }. In this order: a cut he
// is making; out of the way of a drive; on a fast break, his lane; else his place, taken up only at his own moments,
// from which he may start a cut. Null for the ball handler and for the player you control.
export function offBallSpot(state, player) {
  const team = player.team, sign = attackSign(team), hoop = { x: sign * RIM.x, z: 0 }, holder = state.players[state.ball.holder];
  if (holder === player || (isHuman(state, team) && player.id === state.controlled)) return null;
  const { ai } = player, mine = holder?.team === team;

  const cut = state.cut[team];
  if (cut && state.time >= cut.until) state.cut[team] = null;
  if (state.cut[team]?.id === player.id) return { x: sign * OFF.rimAt, z: 0.6 * Math.sign(player.z || 1), sprint: true, why: 'cut' };
  // A screen away from the ball (see screenFor): the screener's spot, or the shooter's run off it once it is set.
  const screen = screening(state, team, holder);
  if (screen?.by === player.id) return { ...screen.spot, sprint: true, why: 'screen' };
  if (screen?.for === player.id) return screen.arrived !== undefined ? { ...screen.to, sprint: false, why: 'offScreen' }
    : screen.used ? { ...screen.to, sprint: true, why: 'offScreen' } : { x: player.x, z: player.z, sprint: false, why: 'waitScreen' };

  if (mine && driving(holder, hoop)) {
    // Off the handler's line to the hoop, to the side he is already on.
    const { far, t } = off(player, holder, hoop);
    if (far < OFF.clear && t > 0) {
      const lx = hoop.x - holder.x, lz = hoop.z - holder.z, long = Math.hypot(lx, lz) || 1;
      const way = (player.x - holder.x) * -lz + (player.z - holder.z) * lx >= 0 ? 1 : -1;
      return { x: player.x + (-lz / long) * way * OFF.clearTo, z: player.z + (lx / long) * way * OFF.clearTo, sprint: true, why: 'clear' };
    }
    // A shooter near the arc drifts or lifts to the open spot on it, for the pass back out (where the style has it).
    if (styled(state, 'off.drift') && threeMan(state, player)) {
      const spot = openSpot(state, player, ARC.driftReach);
      if (spot) return { ...spot, sprint: true, why: 'drift' };
    }
  }

  // A fast break: the handler is ahead of every defender. The two quickest run wide of him and ahead; the rest trail.
  if (mine && sign * holder.x < OFF.breakUntil && state.players.every(o => o.team === team || dist(o, hoop) > dist(holder, hoop) + AI.breakLead)) {
    const rest = state.players.filter(p => p.team === team && p !== holder).sort((a, b) => rated(state, b, 'speed') - rated(state, a, 'speed') || a.slot - b.slot);
    const lane = rest.indexOf(player);
    if (lane < 2) return { x: sign * OFF.rimAt, z: (lane === 0 ? 1 : -1) * OFF.breakWide * (holder.z >= 0 ? 1 : -1), sprint: true, why: 'break' };   // all the way, wide of the ball
    return { x: holder.x - sign * OFF.breakTrail, z: player.z * 0.5, sprint: true, why: 'break' };
  }

  // His place, read again only at his own moments, so that no two of a team move at once.
  if (ai.place === undefined || state.time >= ai.placeAt) {
    ai.place = places(state, team).get(player.id);
    ai.placeAt = state.time + OFF.every[0] + rand(state) * (OFF.every[1] - OFF.every[0]) + (ai.placeAt === undefined ? player.slot * 0.6 : 0);
    // At such a moment he may cut instead: to the rim, or, a shooter, to an open spot on the arc. It is a choice (see
    // choose.js): a cut is worth more the further his man is beaten, the more that man watches the ball instead of him,
    // if he has just passed, and the more he likes to attack; staying is worth the possession going on.
    const passed = ai.passedAt !== undefined && state.time - ai.passedAt < OFF.giveAndGo;
    if (mine && !driving(holder, hoop)) {
      const defender = guardOf(state, player), watching = 1 - (personOf(state, defender).iq ?? 0.7);
      const tend = personOf(state, player).tend;
      const kind = kindOf(state, player), lost = beaten(state, player, hoop);
      const options = [];
      // A cut to the rim, if nobody else is cutting and his way there is clear.
      if (!state.cut[team] && wayClear(state, player, hoop))
        options.push({ key: 'cut', value: 0.7 + (lost ? 0.5 : 0) + 0.6 * watching + (passed ? 0.5 : 0) + (kind === 'slasher' ? 0.15 : 0) + 0.2 * (tend.drive - 0.5) });
      // A cut for three: a man who shoots them, with his man on him, gets to an open spot on the arc (where the style
      // has it). Worth more the better he shoots them, the closer his man is, and the more that man watches the ball.
      const spot = threeMan(state, player) ? openSpot(state, player, ARC.relocateReach) : null;
      const near = dist(defender, player) < OFF.cutGap;
      if (spot) options.push({ key: 'three', spot, value: styled(state, 'off.threeCut') * (0.8 + (rated(state, player, 'three') - ARC.threeAt) / 30 + (near ? 0.35 : 0) + 0.5 * watching + (passed ? 0.3 : 0)) });
      // A screen for a shooter whose man is on him: a big goes and stands by that man, and the shooter runs off it.
      const freeing = kind === 'big' && !state.screen[team] && !state.cut[team] ? screenFor(state, player, holder) : null;
      if (freeing) options.push({ key: 'screen', value: OFF.screen.value + (rated(state, freeing.shooter, 'three') - ARC.threeAt) / 30, ...freeing });
      // A shooter spotted up where he shoots from is worth something where he is, more with his man off him.
      options.push({ key: 'stay', value: kind === 'shooter' ? 1.35 + (lost ? 0.3 : 0) : 1 });
      const go = options.length > 1 ? choose(state, options, personOf(state, player).iq) : options[0];
      if (go.key === 'screen') {
        state.screen[team] = { by: player.id, for: go.shooter.id, spot: go.spot, to: go.to, until: state.time + OFF.screen.lasts, used: false };
        return { ...go.spot, sprint: true, why: 'screen' };
      }
      if (go.key === 'cut') {
        state.cut[team] = { id: player.id, until: state.time + OFF.cutFor };
        return { x: sign * OFF.rimAt, z: 0.6 * Math.sign(player.z || 1), sprint: true, why: 'cut' };
      }
      if (go.key === 'three') ai.place = { ...go.spot, sprint: true, why: 'three' };   // his place until his next moment
    }
  }
  return ai.place ? { sprint: false, why: 'place', ...ai.place } : null;
}

// A screen `big` may set away from the ball: for the best shooter of his team-mates (not the man with the ball) whose
// man is on him (within OFF.cutGap) and who has an open spot on the arc to run to. The big stands by that man, on the
// side the shooter will run, so that the man, following him, runs into the big. { shooter, spot, to }, or null.
function screenFor(state, big, holder) {
  const shooters = state.players.filter(m => m.team === big.team && m !== big && m !== holder && threeMan(state, m) && dist(m, big) <= OFF.screen.reach);
  for (const shooter of shooters.sort((a, b) => rated(state, b, 'three') - rated(state, a, 'three'))) {
    const man = guardOf(state, shooter);
    if (!man || dist(man, shooter) > OFF.cutGap) continue;
    const to = openSpot(state, shooter, ARC.relocateReach);
    if (!to) continue;
    const far = Math.hypot(to.x - man.x, to.z - man.z) || 1;
    return { shooter, to: { x: to.x, z: to.z }, spot: { x: man.x + ((to.x - man.x) / far) * OFF.screen.beside, z: man.z + ((to.z - man.z) / far) * OFF.screen.beside } };
  }
  return null;
}

// The team's screen away from the ball, kept up to date: over once its time is up, the ball is lost or the shooter or
// the screener has it, or the shooter has stood OFF.screen.look seconds at his spot uncalled for; used (the shooter
// runs) once the screener is set by his spot, and `arrived` (the time) once the shooter is there. A pass between
// team-mates does not end it: the ball moved round is how the shooter gets it.
function screening(state, team, holder) {
  const s = state.screen[team];
  if (!s) return null;
  const by = state.players[s.by], shooter = state.players[s.for];
  const ours = holder ? holder.team === team : state.ball.mode === 'pass' && state.lastTouch === team;
  const over = s.arrived !== undefined ? state.time >= s.arrived + OFF.screen.look : state.time >= s.until;
  if (over || !ours || holder === shooter || holder === by) { state.screen[team] = null; return null; }
  if (!s.used && dist(by, s.spot) <= OFF.screen.set && by.setT >= FOUL.setTime) s.used = true;
  if (s.used && s.arrived === undefined && dist(shooter, s.to) < OFF.screen.done) s.arrived = state.time;
  return s;
}

// The shooter a screen away from the ball has just freed, at his spot: the man `holder` looks for (see ai.js), or null.
export function freedBy(state, holder) {
  const s = state.screen[holder.team];
  return s && s.arrived !== undefined && s.for !== holder.id ? state.players[s.for] : null;
}

// The point guard of `team` on the floor: who comes to take the inbound and brings the ball up (see ai.js). Its best
// handler, a pass-first man before a scorer: his handle and OFF.point.pass by his passFirst. Only a team nobody plays
// has one: a person brings the ball up as he likes. Null for his.
export function pointOf(state, team) {
  if (isHuman(state, team)) return null;
  const worth = m => rated(state, m, 'handle') + OFF.point.pass * personOf(state, m).tend.passFirst;
  return state.players.filter(m => m.team === team).reduce((a, b) => (worth(b) > worth(a) ? b : a));
}

// Who an inbounder throws it to: his point guard, close enough to take it, or else his nearest team-mate.
export function inboundTo(state, inbounder) {
  const point = pointOf(state, inbounder.team), mates = state.players.filter(m => m.team === inbounder.team && m !== inbounder);
  if (point && point !== inbounder && dist(point, inbounder) <= OFF.point.inbound) return point;
  return mates.reduce((a, b) => (dist(b, inbounder) < dist(a, inbounder) ? b : a));
}

// Whoever has just passed looks at once for the ball back: his next moment to move is now.
export function passed(state, player) {
  player.ai.passedAt = state.time;
  player.ai.placeAt = state.time;
}
