// Who each player is and how he feels during a match. His personality: traits that never change, from his role, his
// ratings and his name. His mood: confidence (-1 to 1) and frustration (0 to 1), moved by what happens to him and
// drifting back to his usual between. Rivalries: two opponents who keep getting the better of each other. And a team
// on a run lifts its own and gets to the other.
//
// Both engines feed it through the same few calls (the box score's noteRow, a shot's result, a foul) and read it in
// the same places (a player's options before he chooses, a shot's chance, a defender's fouls), so a simulated game
// and a played one feel the same. Everything is plain numbers on the roster entry and on the match (state.rivals), so
// that a franchise mode could keep them from one match to the next.
import { CLOCK, LATE } from './tuning.js';
import { styled } from './styles.js';
import { overall } from './overall.js';

// The person in a court player's place, and the man guarding him, as state.js and matchups.js have them; and the game
// on the line, as late.js's situation has it (clutch). state.js and stats.js import this file, so it imports neither
// them nor what imports them: the one-file build needs the imports to form a tree.
const personOf = (state, player) => state.rosters[player.team][player.person];
const guardOf = (state, player) => state.players.find(o => o.man === player.id);
export const clutchFor = (state, team) => state.quarter >= CLOCK.quarters && state.gameClock <= LATE.clutch
  && Math.abs(state.score[team] - state.score[1 - team]) <= LATE.clutchLead;

const f = Object.freeze;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The traits, each 0 to 1, 0.5 the usual player. composure: how little what happens moves him. swagger: how sure of
// himself he is at rest (his confidence settles at swagger's lean, see restOf). clutch: how much better, or worse, he
// shoots when the game is on the line. fire: how hard he competes: frustration and rivalries grow on him. showman:
// how big he celebrates and plays to the crowd. leader: how much his big plays lift his team-mates.
export const TRAITS = f(['composure', 'swagger', 'clutch', 'fire', 'showman', 'leader']);
// Each role's leaning, in TRAITS' order; a star (STAR) is better in the clutch and more of a
// leader (not more sure of himself: his usage already says how much he shoots); and each player differs from his
// role's by up to `jitter` either way, the same every match (by his name).
const ROLE_TRAITS = f({
  Playmaker: [0.65, 0.55, 0.55, 0.5, 0.45, 0.75], Slasher: [0.45, 0.6, 0.5, 0.65, 0.75, 0.45], 'Rim protector': [0.6, 0.5, 0.45, 0.65, 0.55, 0.5],
  Sharpshooter: [0.5, 0.6, 0.6, 0.45, 0.5, 0.4], 'Stretch big': [0.55, 0.5, 0.5, 0.45, 0.4, 0.45], 'Shot creator': [0.5, 0.75, 0.65, 0.6, 0.65, 0.55],
  'Lockdown wing': [0.65, 0.45, 0.5, 0.75, 0.4, 0.5], Rebounder: [0.55, 0.45, 0.4, 0.7, 0.45, 0.45], 'Two-way wing': [0.6, 0.55, 0.55, 0.65, 0.5, 0.55],
  'Post scorer': [0.55, 0.6, 0.5, 0.6, 0.5, 0.45], 'Glass cleaner': [0.55, 0.4, 0.4, 0.7, 0.4, 0.4], 'Lockdown guard': [0.6, 0.45, 0.5, 0.75, 0.45, 0.5],
  'Role player': [0.55, 0.45, 0.45, 0.5, 0.4, 0.45],
});
export const STAR = f({ at: 83, clutch: 0.1, leader: 0.05, jitter: 0.2 });

// How his mood moves. hit: what each happening does to his confidence and his frustration, [confidence, frustration],
// before his traits scale it (see feel): his own make (a three, a dunk), miss, shot blocked; an assist, a steal, a
// block, a rebound (an offensive one), a turnover; a foul he commits; a basket scored on him; and what his team's run
// does to him (`run`, on its side; `against`, on the other). half: seconds of play in which half of a mood's distance
// from his usual goes. rest: how far from 0 his confidence rests at the ends of swagger. leader: what a leader's big
// play gives each team-mate on court, at the top of the trait. run: the points in a row that make a run felt.
// settle: the share of the way back to his usual a timeout brings everyone's mood (see settle).
export const MOOD = f({
  hit: f({
    make: f([0.1, -0.06]), three: f([0.14, -0.06]), dunk: f([0.16, -0.08]), miss: f([-0.06, 0.03]), blocked: f([-0.12, 0.1]),
    ast: f([0.05, -0.04]), stl: f([0.08, -0.05]), blk: f([0.1, -0.05]), reb: f([0.02, -0.01]), orb: f([0.04, -0.02]), tov: f([-0.1, 0.12]),
    foul: f([-0.02, 0.08]), scoredOn: f([-0.04, 0.06]), run: f([0.03, -0.02]), against: f([-0.02, 0.04]),
  }),
  half: 75, rest: 0.3, leader: 0.06, run: 8, settle: 0.5,
  // What it does. lean: expected points it adds to his options before he chooses (see lean): to his own shot or move,
  // at full confidence (`self`); to a pass, when he doubts himself (`share`); to his own shot against his rival
  // (`rival`, at full heat); to a pass to a team-mate on a roll (`feed`, at his full confidence against his usual), and
  // from one who is frustrated (`sour`, at its fullest). skill: the rating points his confidence is worth on a shot at its fullest. clutch: those
  // the clutch trait is worth at its ends, when the game is on the line. foul: how much more often a fully frustrated
  // defender's contact is a foul.
  lean: f({ self: 0.08, share: 0.06, rival: 0.08, feed: 0.06, sour: 0.04 }), skill: 1.5, clutch: 5, foul: 0.5,
  // The score's pull (see scorePull): from `from` points ahead a team eases off and the one behind pushes, by up to
  // `ease` and `push` rating points on a shot at `full` points; games between equal sides spread as the league's do.
  lead: f({ from: 8, full: 20, ease: 5, push: 5 }),
  // Rivalries: the heat a basket on him adds, a big one (a three or a dunk), a block and a steal; an answer (the other
  // one getting the better this time) counts `answer` times over, the same one again only `again` times; heat cools by
  // half in `half` seconds of play. At `at`, the two are rivals, and what happens between them moves them up to twice
  // as much. So rivals are two who trade big plays, not any two who guard each other.
  rival: f({ score: 0.05, big: 0.22, block: 0.3, steal: 0.15, answer: 1.5, again: 0.7, half: 240, at: 0.8 }),
  // A duo (a team's `duo`, see guests.js): two team-mates who play off each other. look: expected points a pass from
  // one to the other gains (a small lean: the star pull, decide.stars, already sends them the ball, and most of what
  // the duo does is their two-man game: see plays.js cast). lift: what a basket by one gives the other on court, as
  // an assist's lift (see feel), `big` times over for a dunk or a three.
  duo: f({ look: 0.1, lift: 1, big: 2 }),
});

// A small hash of a name and a word: 0 to 1, the same every time.
function hashOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10007) / 10007;
}

// His traits (see TRAITS), from his role, how good he is and his name, unless he has his own (`own`, any of them).
export function traitsOf(person, own = {}) {
  const prior = ROLE_TRAITS[person.role] ?? ROLE_TRAITS['Role player'], star = overall(person) >= STAR.at;
  return Object.fromEntries(TRAITS.map((trait, i) => {
    const lean = (star ? STAR[trait] ?? 0 : 0) + (hashOf(`${person.name}/${trait}`) - 0.5) * 2 * STAR.jitter;
    return [trait, own[trait] ?? Math.round(clamp(prior[i] + lean, 0, 1) * 100) / 100];
  }));
}

// Where his confidence rests: his swagger's lean from the middle.
export const restOf = traits => (traits.swagger - 0.5) * 2 * MOOD.rest;
// A fresh mood, as a match starts: at rest. `at`: the seconds of play it was last brought up to date.
export const freshMood = traits => ({ confidence: restOf(traits), frustration: 0, at: 0 });

// The seconds of play so far in the match, by the period and its clock: the same in both engines.
export const playedOf = state => (state.quarter - 1) * state.quarterLength + Math.max(0, state.quarterLength - state.gameClock);

// His mood now, drifted toward his usual since it last moved, without changing it.
export function moodOf(state, person) {
  const m = person.mood;
  if (!m) return { confidence: 0, frustration: 0 };
  const keep = 0.5 ** (Math.max(0, playedOf(state) - m.at) / MOOD.half), rest = restOf(person.traits);
  return { confidence: rest + (m.confidence - rest) * keep, frustration: m.frustration * keep };
}

// The heat between two opponents (court players) now, cooled since it last grew; 0 if none. Each pair's entry in
// state.rivals: { heat, at (seconds of play when it last grew), by (who got the better last, as `team:row`) }.
const keyOf = (state, p) => `${p.team}:${p.person}`;
// Side zero always sorts first. Reuse the string for these two roster rows each time someone weighs a shot.
const pairKeys = [];
function pairOf(state, a, b) {
  const first = a.team === 0 ? a : b, second = a.team === 0 ? b : a;
  const row = pairKeys[first.person] ??= [];
  return row[second.person] ??= keyOf(state, first) + '|' + keyOf(state, second);
}
const cooled = (state, entry) => (entry ? entry.heat * 0.5 ** (Math.max(0, playedOf(state) - entry.at) / MOOD.rival.half) : 0);
export const heatBetween = (state, a, b) => (a && b && a.team !== b.team ? cooled(state, state.rivals?.[pairOf(state, a, b)]) : 0);

// Moves `person`'s mood by happening `kind` (see MOOD.hit), `scale` times over: his confidence by his sensitivity
// (less the more composed he is), his frustration as well by his fire when it grows.
export function feel(state, person, kind, scale = 1) {
  const hit = MOOD.hit[kind];
  if (!hit || !person.mood || !person.traits) return;
  const now = moodOf(state, person), t = person.traits, sensitive = 1.5 - t.composure;
  const grow = hit[1] > 0 ? 0.5 + t.fire : 1;
  person.mood = {
    confidence: clamp(now.confidence + hit[0] * sensitive * scale, -1, 1),
    frustration: clamp(now.frustration + hit[1] * sensitive * grow * scale, 0, 1),
    at: playedOf(state),
  };
}

// The box score's happenings (see stats.js noteRow): the person in `row` of `team` did `key`, `n` times.
export function feelNote(state, team, row, key, n) {
  if (n > 0 && key !== 'pts' && MOOD.hit[key]) feel(state, state.rosters[team][row], key);
}

// `a` got the better of `b` (opponents, court players), by `amount` of heat (more if it answers b's last, less if a
// did it last as well, and more the fiercer the two: see MOOD.rival). When the heat first reaches MOOD.rival.at the
// two are rivals, and the match remembers it for the broadcast (state.last.rivals: their [team, row] each, and when).
function heat(state, a, b, amount) {
  if (!a || !b || a.team === b.team) return;
  const rivals = (state.rivals ??= {}), key = pairOf(state, a, b), entry = rivals[key], was = cooled(state, entry), by = keyOf(state, a);
  const turn = !entry ? 1 : entry.by === by ? MOOD.rival.again : MOOD.rival.answer;
  const fierce = 0.5 + (personOf(state, a).traits?.fire ?? 0.5) / 2 + (personOf(state, b).traits?.fire ?? 0.5) / 2;
  rivals[key] = { heat: was + amount * turn * fierce, at: playedOf(state), by };
  if (was < MOOD.rival.at && rivals[key].heat >= MOOD.rival.at) state.last.rivals = { a: [a.team, a.person], b: [b.team, b.person], at: state.time ?? 0 };
}
// How much more a happening between two moves them: up to twice as much, between rivals at full heat.
const between = (state, a, b) => 1 + Math.min(1, heatBetween(state, a, b));

// A shot's result for his mood, his defender's and his team's (a court player each): made or not, how much it was
// worth, whether it was a dunk, and who blocked it (`blocker`) if anyone. The man guarding him feels a basket scored
// on him, and the two grow toward rivals; a leader's big shot lifts his team-mates; a run is felt on both sides.
export function feelShot(state, shooter, made, { value = 2, dunk = false, blocker = null } = {}) {
  const person = personOf(state, shooter), guard = blocker ?? guardOf(state, shooter);
  const scale = between(state, shooter, guard);
  if (blocker) {
    feel(state, person, 'blocked', scale);
    heat(state, blocker, shooter, MOOD.rival.block);
    return;
  }
  if (!made) { feel(state, person, 'miss'); return; }
  const big = dunk || value >= 3;
  feel(state, person, dunk ? 'dunk' : value >= 3 ? 'three' : 'make', scale);
  if (guard) { feel(state, personOf(state, guard), 'scoredOn', scale); heat(state, shooter, guard, big ? MOOD.rival.big : MOOD.rival.score); }
  const mates = state.players.filter(p => p.team === shooter.team && p !== shooter), others = state.players.filter(p => p.team !== shooter.team);
  if (big && person.traits?.leader > 0.5) for (const p of mates) feel(state, personOf(state, p), 'ast', ((person.traits.leader - 0.5) * 2 * MOOD.leader) / MOOD.hit.ast[0]);
  // One of a duo scores: the other, on court with him, feels it as his own.
  const partner = person.partner === undefined ? null : mates.find(p => p.person === person.partner);
  if (partner) feel(state, personOf(state, partner), 'ast', MOOD.duo.lift * (big ? MOOD.duo.big : 1));
  if (state.run[shooter.team] >= MOOD.run) {
    for (const p of [shooter, ...mates]) feel(state, personOf(state, p), 'run');
    for (const p of others) feel(state, personOf(state, p), 'against');
  }
}

// A steal: the man it was taken from and the thief grow toward rivals (the thief's own lift is the box score's).
export const feelSteal = (state, thief, victim) => heat(state, thief, victim, MOOD.rival.steal);

// A timeout settles everyone: each player's mood goes `MOOD.settle` of the way back to his usual (a coach calls one
// to stop a run, and it does: the run's lift and its sting both fade).
export function settle(state) {
  for (const roster of state.rosters) for (const person of roster) {
    if (!person.mood || !person.traits) continue;
    const now = moodOf(state, person), rest = restOf(person.traits);
    person.mood = { confidence: rest + (now.confidence - rest) * (1 - MOOD.settle), frustration: now.frustration * (1 - MOOD.settle), at: playedOf(state) };
  }
}

// A foul he committed (a court player).
export function feelFoul(state, fouler) {
  const person = personOf(state, fouler);
  feel(state, person, 'foul', person.fouls >= state.foulLimit - 2 ? 1.5 : 1);   // and more so in foul trouble
}

// The kinds of option that are his own shot or move, in either engine.
const SELF = new Set(['shoot', 'drive', 'move', 'fade', 'step', 'post']);
// Leans `player`'s options (see choose.js) by his mood, before he chooses: the surer and the angrier he is, the more he
// looks for his own shot (against his rival more again); the more he doubts himself, the more he passes; an angry
// player passes less. And by his team-mates': a pass goes more to a man on a roll and less to one who is frustrated (a
// pass option names its man by `to`: an id in the 3D game, the player in the fast engine), and more to his partner in
// a duo (see MOOD.duo). The style's mood.strength scales it all (0: as if no one felt anything). Returns the options.
export function lean(state, player, options) {
  const k = styled(state, 'mood.strength');
  if (!k) return options;
  const me = personOf(state, player), { confidence, frustration } = moodOf(state, me);
  const rival = Math.min(1, heatBetween(state, player, guardOf(state, player)));
  const self = k * (MOOD.lean.self * (confidence + 0.6 * frustration) + MOOD.lean.rival * rival);
  const share = k * MOOD.lean.share * (Math.max(0, -confidence) - 0.6 * frustration);
  for (const o of options) {
    if (o.value === -Infinity) continue;
    if (SELF.has(o.key)) o.value += self;
    else if (o.key === 'pass') {
      o.value += share;
      const m = typeof o.to === 'number' ? state.players[o.to] : o.to;
      if (m) {
        const them = personOf(state, m), feel = moodOf(state, them), rest = them.traits ? restOf(them.traits) : 0;
        o.value += k * (MOOD.lean.feed * Math.max(0, feel.confidence - rest) - MOOD.lean.sour * feel.frustration);
        if (me.partner !== undefined && me.partner === m.person && m.team === player.team) o.value += k * MOOD.duo.look;
      }
    }
  }
  return options;
}

// The rating points his mood is worth on a shot (see shooting.js skillOf): his confidence against where it rests (a
// sure player is no better a shooter for it, only a player on a roll is), and with the game on the line his clutch
// trait, either way.
export function moodSkill(state, player) {
  const k = styled(state, 'mood.strength');
  if (!k) return 0;
  const person = personOf(state, player), { confidence } = moodOf(state, person);
  const clutch = person.traits && clutchFor(state, player.team) ? (person.traits.clutch - 0.5) * 2 * MOOD.clutch : 0;
  return k * (MOOD.skill * (confidence - restOf(person.traits ?? { swagger: 0.5 })) + clutch + scorePull(state, player.team));
}

// The score's pull: a team well ahead eases off and one well behind pushes, from MOOD.lead.from points to its full at
// MOOD.lead.full; in rating points on a shot, less for the team ahead, more for the one behind.
export function scorePull(state, team) {
  const lead = state.score[team] - state.score[1 - team], { from, full, ease, push } = MOOD.lead;
  const share = Math.min(1, Math.max(0, (Math.abs(lead) - from) / (full - from)));
  return share === 0 ? 0 : lead > 0 ? -ease * share : push * share;
}

// How much more often a defender's contact is a foul, by his frustration.
export function foulLean(state, player) {
  const k = styled(state, 'mood.strength');
  return k ? 1 + k * MOOD.foul * moodOf(state, personOf(state, player)).frustration : 1;
}
