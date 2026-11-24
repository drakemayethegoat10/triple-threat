// How the players react to what happens, for the people renderer (see render/motion.js): the scorer of a big basket
// celebrates as his personality has it, the man he beat drops his head, a leader claps his team on, a player who has
// boiled over or been called for a foul shows it, and team-mates slap hands when they come together: the scorer and
// the man who passed to him, a free-throw shooter and the team-mate who comes in from the lane. Worked out from what
// the broadcast heard and from the match; it changes neither. Times are real seconds, as the broadcast's are.
import { personOf } from '../sim/state.js';
import { guardOf } from '../sim/matchups.js';
import { moodOf } from '../sim/mood.js';

// How long each reaction is shown, in seconds: a gesture as long as its motion (see tools/blender/poses.py), the clap
// and the dropped head for a while of their looping motions.
export const SHOWN = Object.freeze({ fistPump: 1.1, armsUp: 1.6, flex: 1.5, goggles: 1.3, chestThump: 1.0, clap: 1.2, highFive: 0.8, highFiveLeft: 0.8,
  dejected: 1.8, headHands: 1.6, complain: 1.3 });
// The celebrations: the face shouts with them (see face.js).
export const CELEBRATIONS = Object.freeze(['fistPump', 'armsUp', 'flex', 'goggles', 'chestThump']);
// showman, fire, leader: the traits (0 to 1, see mood.js) from which a player celebrates big, celebrates hard, and
// claps his team on. boil: the frustration from which a beaten man puts his hands on his head, and a fouler argues.
// again: real seconds before the same man celebrates an ordinary three or dunk again (a big moment always gets one).
// reach: metres apart two team-mates slap hands from. meet: seconds after an assisted basket in which the scorer and
// his passer may still come together.
export const REACT = Object.freeze({ showman: 0.6, fire: 0.6, leader: 0.65, boil: 0.5, again: 40, reach: 1.3, meet: 3 });

// The moments that make a basket big, and among them those that leave the man scored on hurt.
const BIG = new Set(['andOne', 'buzzer', 'ankle', 'poster', 'stealScore', 'deep', 'clutch', 'heatingUp', 'onFire', 'winner', 'duo']);
const HURTS = new Set(['poster', 'ankle', 'winner', 'buzzer', 'andOne', 'clutch']);
const CLINCH = new Set(['winner', 'buzzer', 'clutch']);

// on: what each player (by id) is doing, { clip, from, until }. last: when each last celebrated. meet: pairs of
// team-mates to slap hands when they come together, { a, b, until }. five: the free throw's high five last looked for.
export const createReactions = () => ({ on: {}, last: {}, meet: [], five: null });

const traitsOf = (state, p) => personOf(state, p).traits ?? {};
const playerOf = (state, team, row) => state.players.find(p => p.team === team && p.person === row) ?? null;
const apart = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// The celebration of a man who has just scored a big basket, or null for none: the clinching ones with both arms up
// (a man of fire beats his chest), a dunk or an and-one flexed (a showman) or chest-thumped (a man of fire), any other
// big moment with a fist pump; a three that is no moment only by a showman (the goggles) or a man of fire (a fist
// pump): anyone else jogs back.
export function celebrationOf(traits, kinds, points, finish) {
  const showman = (traits.showman ?? 0) >= REACT.showman, fire = (traits.fire ?? 0) >= REACT.fire;
  if (kinds.some(k => CLINCH.has(k))) return fire && !showman ? 'chestThump' : 'armsUp';
  if (finish === 'dunk' || kinds.includes('andOne') || kinds.includes('poster')) return showman ? 'flex' : fire ? 'chestThump' : 'fistPump';
  if (kinds.length) return points === 3 && showman ? 'goggles' : 'fistPump';
  if (points === 3) return showman ? 'goggles' : fire ? 'fistPump' : null;
  return null;
}

// Starts `clip` for `p` now, unless he is already in a reaction (or `over`: whatever he is in).
function start(r, p, clip, now, over = false) {
  if (!p) return;
  const was = r.on[p.id];
  if (was && now < was.until && !over) return;
  r.on[p.id] = { clip, from: now, until: now + SHOWN[clip] };
}

// The hand a man slaps a team-mate's with: the right if the other is on his right (or straight ahead), the left if on
// his left. Neither turns to the other: they may be running.
const fiveFor = (p, other) => (Math.cos(p.facing) * (other.z - p.z) - Math.sin(p.facing) * (other.x - p.x) < 0 ? 'highFiveLeft' : 'highFive');

// One frame: what was `heard` since the last (see moments.js), the match as it is, real time `now`. Returns each
// reacting player's reaction, { clip, t }, by id: `t` the seconds it has run.
export function react(r, heard, state, now) {
  if (state.phase === 'start' || state.phase === 'final') { r.on = {}; r.meet = []; return {}; }
  const kinds = heard.filter(h => h.moment).map(h => h.kind);
  for (const h of heard) {
    if (h.kind === 'made') {
      const scorer = playerOf(state, h.team, h.row), sc = state.last.score;
      if (!scorer) continue;
      const mine = kinds.filter(k => BIG.has(k));
      const big = mine.length > 0 || h.points === 3 || h.finish === 'dunk';
      const clip = big && (mine.length > 0 || now - (r.last[scorer.id] ?? -Infinity) >= REACT.again) ? celebrationOf(traitsOf(state, scorer), mine, h.points, h.finish) : null;
      if (clip) {
        start(r, scorer, clip, now, true);
        r.last[scorer.id] = now;
        // The man he scored on, if it hurt: hands on his head if he is boiling, else on his hips.
        if (mine.some(k => HURTS.has(k))) {
          const beaten = guardOf(state, scorer) ?? state.players.filter(o => o.team !== scorer.team).reduce((a, b) => (apart(b, scorer) < apart(a, scorer) ? b : a));
          const boiling = moodOf(state, personOf(state, beaten)).frustration >= REACT.boil || mine.includes('poster') || mine.includes('ankle');
          start(r, beaten, boiling ? 'headHands' : 'dejected', now);
        }
        // After a big moment his team's leader claps them on.
        const leader = mine.length > 0 && state.players.filter(p => p.team === scorer.team && p !== scorer && (traitsOf(state, p).leader ?? 0) >= REACT.leader)
          .sort((a, b) => traitsOf(state, b).leader - traitsOf(state, a).leader)[0];
        if (leader) start(r, leader, 'clap', now);
      }
      // The man who passed to him comes to slap his hand (see ai.js: he goes to him).
      const passer = sc && sc.assist !== null && sc.by === scorer.id ? playerOf(state, scorer.team, sc.assist) : null;
      if (passer) r.meet.push({ a: passer.id, b: scorer.id, until: now + REACT.meet });
    } else if (h.kind === 'block') {
      const blocker = playerOf(state, h.team, h.row), t = blocker ? traitsOf(state, blocker) : {};
      start(r, blocker, (t.showman ?? 0) >= REACT.showman ? 'flex' : (t.fire ?? 0) >= REACT.fire ? 'chestThump' : 'fistPump', now, true);
    } else if (h.kind === 'rattled') start(r, playerOf(state, h.team, h.row), 'headHands', now);
    else if (h.kind === 'foul' && state.last.foul) {
      const fouler = state.players[state.last.foul.by];
      const hot = fouler && ((traitsOf(state, fouler).fire ?? 0) >= REACT.fire || moodOf(state, personOf(state, fouler)).frustration >= REACT.boil);
      if (hot) start(r, fouler, 'complain', now);
    }
  }
  // A free-throw shooter and the team-mate who comes in from the lane (see freethrow.js).
  const five = state.freeThrow?.five;
  if (five && five !== r.five) { r.five = five; r.meet.push({ a: five.by, b: state.freeThrow.shooter, until: now + REACT.meet }); }
  // Team-mates who have come together slap hands.
  r.meet = r.meet.filter(m => {
    const a = state.players[m.a], b = state.players[m.b];
    if (now >= m.until || !a || !b) return false;
    if (apart(a, b) > REACT.reach || state.ball.holder === a.id || state.ball.holder === b.id) return true;
    start(r, a, fiveFor(a, b), now, true);
    start(r, b, fiveFor(b, a), now, true);
    return false;
  });
  const out = {};
  for (const [id, on] of Object.entries(r.on)) {
    if (now >= on.until) delete r.on[id];
    else out[id] = { clip: on.clip, t: now - on.from };
  }
  return out;
}
