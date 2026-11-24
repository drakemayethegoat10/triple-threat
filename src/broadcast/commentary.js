// The commentator: a line for what the watcher heard, in several wordings, and the rule for which line is said when.
// It makes words only; the page shows them and the browser's voice speaks them.
import { nicknameOf } from '../sim/teams.js';
import { teamLine } from '../sim/stats.js';
import { surname } from '../sim/state.js';

const VIOLATIONS = { travel: 'Travelling', doubleDribble: 'Double dribble', backcourt: 'Backcourt violation', eightSeconds: 'Eight seconds',
  threeSeconds: 'Three seconds in the key', shotClock: 'Shot-clock violation', fiveSeconds: 'Five seconds on the inbound' };
const FOUL_WORDS = { shooting: 'on the shot', reach: 'for reaching in', block: 'for blocking', charge: 'for charging', looseBall: 'on the loose ball', illegalScreen: 'for an illegal screen' };
const ORDINAL = ['first', 'second', 'third', 'fourth'];

// Each kind's wordings. {name}: the player. {team}: his team, {other}: the other. {play}, {pts}, {n}, {off}, {what},
// {score}: as the kind supplies them.
export const LINES = Object.freeze({
  tip: ['{team} win the tip.', 'We are under way, and {team} have the ball.'],
  play: ['{team} set up {play}.', '{play} called for {team}.', 'They go to {play}.'],
  made2: ['{name} scores.', '{name}, good for two.', 'Two more for {name}.', '{name} knocks it down.'],
  madeAssist: ['{name} scores, from {off}.', '{off} finds {name} for two.', 'Nice feed from {off}, and {name} finishes.'],
  windmill: ['A windmill by {name}!', '{name} winds it up and slams it!', '{name} takes off, brings it all the way round, and throws it down!'],
  dunk: ['{name} throws it down!', 'A slam by {name}!', '{name} rises and hammers it home.'],
  layup: ['{name} lays it in.', '{name} goes to the rim, and scores.', 'Off the glass and in for {name}.'],
  made3: ['{name} for three. Good!', 'A three from {name}.', '{name} buries the three.', 'From downtown, {name}.'],
  miss: ['{name} misses.', 'No good from {name}.', 'Off the mark from {name}.', '{name} cannot get it to fall.'],
  rebound: ['Rebound, {name}.', '{name} cleans the glass.', '{name} has the board.'],
  reboundOff: ['{name} keeps it alive on the offensive glass.', 'Second chance: {name} with the rebound.', 'Offensive board, {name}.'],
  steal: ['Stolen by {name}!', '{name} picks his pocket.', '{name} comes up with the steal.'],
  foul: ['Foul on {name}, {what}.', 'Whistle. {name} is called {what}.', '{name} picks up a foul {what}.'],
  foulTeam: ['Foul on {team}, {what}.', 'The whistle goes against {team}, {what}.', '{team} called {what}.'],
  violation: ['{what}. {other} ball.', '{what} on {team}.', 'Whistle: {what}. It goes over to {other}.'],
  out: ['Out of bounds, off {team}.', 'It goes out. {other} ball.', 'Off {team} and out.'],
  timeout: ['Timeout, {team}.', '{team} want to talk it over.', '{team} stop the game.'],
  freeThrow: ['{name} to the line.', '{name} will shoot {n}.', 'Free throws coming for {name}.'],
  sub: ['{name} checks in for {off}.', 'A change for {team}: {name} on, {off} off.', '{off} takes a seat, and here comes {name}.'],
  periodEnd: ['That is the end of the {what} period. {score}.', 'The {what} period is over. {score}.', 'End of the {what}. {score}.'],
  half: ['Half-time. {score}.', 'We have reached the half. {score}.', 'That is the half: {score}.'],
  final: ['That is the game! {score}.', 'It is all over. {score}.', 'Final: {score}.'],
  overtime: ['We are going to overtime! {score}.', 'Level at the buzzer: overtime. {score}.'],
  winner: ['{name} wins it for {team}!', 'The game-winner belongs to {name}!'],
  buzzer: ['{name} at the buzzer! It counts!', 'Beat the buzzer! {name}!', 'At the horn, {name}! Good!'],
  ankle: ['{name} put his man on the floor!', 'Ankle-breaker! {name} leaves him behind.', 'Oh, what a move by {name}!'],
  block: ['Blocked by {name}!', '{name} sends it back!', 'Not in here, says {name}!'],
  blockChase: ['{name} with the chase-down block!', 'He came from behind! {name} with the block!', 'Chased down by {name}!'],
  andOne: ['{name} scores, and the foul!', 'And one! {name} goes to the line for one more.', 'Count it, and a foul! {name}.'],
  poster: ['{name} finishes right over him!', 'Over the top of the defender! {name}!', '{name}, through the contact at the rim!'],
  stealScore: ['Steal and score for {team}!', '{name} turns defence into two points.', 'From the steal to the basket: {name}.'],
  deep: ['{name} from way out! Good!', 'From the logo, {name}!', 'That is deep, and that is good. {name}.'],
  clutch: ['{name}, when it matters most!', 'A huge basket by {name}!', 'Ice in his veins: {name}.'],
  onFire: ['{name} is on fire! Five in a row.', 'He cannot miss! {name} has five straight.', 'Five in a row for {name}. Get him the ball.'],
  heatingUp: ['{name} is heating up.', 'Three in a row for {name}.', '{name} has found his touch.'],
  duo: ['{off} to {name}. The dynamic duo strikes again!', '{off} finds {name}! These two are something else.', 'That two-man game! {off} and {name}.'],
  rivalry: ['A real battle out there: {name}.', 'These two have been going at it all night: {name}.', '{name}. Neither one is backing down.'],
  rattled: ['{name} looks rattled.', '{name} is getting frustrated out there.', 'You can see it on {name}. He is not happy.'],
  run: ['{team} are on a {n} to nothing run.', 'Make it {n} unanswered for {team}.', 'A {n} to nothing run for {team}.'],
  comeback: ['{team} have come all the way back!', 'What a comeback by {team}!', '{team} have wiped out the deficit.'],
  perfect: ['Perfect release from {name}.', 'Nothing but net for {name}.', 'That was pure, {name}.'],
  statLead: ['{name} leads all scorers with {pts}.', '{pts} points so far for {name}.'],
  statShooting: ['{team} are shooting {n} percent from the field.', '{n} percent from the floor for {team}.'],
  statRun: ['{team} have scored the last {n} points.', 'The last {n} points belong to {team}.'],
});

// How much a line matters: a bigger one cuts in on a smaller, and a smaller one is dropped while a line is being said.
export const RANK = Object.freeze({ plain: 0, score: 1, call: 2, moment: 3, star: 4 });
const CALLS = ['foul', 'violation', 'out', 'timeout', 'periodEnd', 'freeThrow'];
export const rankOf = happening => (happening.star ? RANK.star : happening.moment ? RANK.moment
  : CALLS.includes(happening.kind) ? RANK.call : happening.kind === 'made' ? RANK.score : RANK.plain);

const short = (state, team) => nicknameOf(state.teams[team]);   // 'Waves'
const scoreWords = (state, score) => {
  const ahead = score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1;
  return ahead === null ? `${score[0]} all` : `${short(state, ahead)} ${score[ahead]}, ${short(state, 1 - ahead)} ${score[1 - ahead]}`;
};

// last: the wording last used for each kind. rank, until: the line being said, and the real time it is over.
// quiet: the real time of the last line, for a number between plays.
export const createBooth = () => ({ last: {}, rank: -1, until: 0, quiet: 0, stat: 0 });

// The next wording for `key`, never the one used last for it, with the {words} filled in from `facts`.
function worded(booth, key, facts) {
  const list = LINES[key], next = ((booth.last[key] ?? -1) + 1) % list.length;
  booth.last[key] = next;
  return list[next].replace(/\{(\w+)\}/g, (_, word) => facts[word] ?? '');
}

// The line for something the watcher heard (see watchStep).
export function lineFor(booth, h, state) {
  const facts = { name: h.name, team: h.team === null ? '' : short(state, h.team), other: h.team === null ? '' : short(state, 1 - h.team), n: h.n, off: h.off, play: h.play };
  let key = h.kind;
  if (h.kind === 'made') { key = h.points === 3 ? 'made3' : h.finish === 'dunk' ? (h.flair === 'windmill' ? 'windmill' : 'dunk') : h.finish === 'layup' ? 'layup' : h.assist ? 'madeAssist' : 'made2'; facts.off = h.assist; }
  else if (h.kind === 'rebound') key = h.own ? 'reboundOff' : 'rebound';
  else if (h.kind === 'block') key = h.chase ? 'blockChase' : 'block';
  else if (h.kind === 'foul') { key = h.fouler ? 'foul' : 'foulTeam'; facts.name = h.fouler; facts.what = FOUL_WORDS[h.what] ?? ''; }
  else if (h.kind === 'violation') facts.what = VIOLATIONS[h.what] ?? 'Violation';
  else if (h.kind === 'freeThrow') facts.n = h.shots === 1 ? 'one' : h.shots === 3 ? 'three' : 'two';
  else if (h.kind === 'periodEnd') {
    const level = h.score[0] === h.score[1];
    key = h.final ? 'final' : h.quarter === 2 ? 'half' : h.quarter >= 4 && level ? 'overtime' : 'periodEnd';
    facts.what = ORDINAL[h.quarter - 1] ?? 'overtime'; facts.score = scoreWords(state, h.score);
  }
  return worded(booth, key, facts);
}

// Seconds a line takes to say.
export const secondsFor = text => Math.min(5, Math.max(1.6, text.length * 0.065));

// Offers `text` of rank `rank` at real time `now` (seconds). Returns it if it is to be shown and spoken, else null: a
// line is dropped while one of the same or a higher rank is still being said, and a higher one cuts in.
export function say(booth, text, rank, now) {
  if (now < booth.until && rank <= booth.rank) return null;
  Object.assign(booth, { rank, until: now + secondsFor(text), quiet: now + secondsFor(text) });
  return text;
}

// A number for a quiet moment: at a stoppage when nothing has been said for 6 s. Null when there is nothing to say.
export function quietLine(booth, state, now) {
  if (state.phase !== 'dead' || now - booth.quiet < 6) return null;
  booth.quiet = now;
  const order = ['statLead', 'statShooting', 'statRun'];
  for (let i = 0; i < order.length; i++) {
    const key = order[(booth.stat + i) % order.length];
    let facts = null;
    if (key === 'statLead') {
      const best = state.rosters.flatMap((roster, team) => roster.map(person => ({ person, team }))).reduce((a, b) => (b.person.stats.pts > a.person.stats.pts ? b : a));
      if (best.person.stats.pts >= 6) facts = { name: surname(best.person), pts: best.person.stats.pts };
    } else if (key === 'statShooting') {
      const team = state.possession, line = teamLine(state, team);
      if (line.fga >= 8) facts = { team: short(state, team), n: Math.round((100 * line.fgm) / line.fga) };
    } else if (key === 'statRun') {
      const team = state.run[0] > state.run[1] ? 0 : 1;
      if (state.run[team] >= 6) facts = { team: short(state, team), n: state.run[team] };
    }
    if (facts) { booth.stat = (booth.stat + i + 1) % order.length; return worded(booth, key, facts); }
  }
  return null;
}

// The Commentary setting, round: with a voice, voice and captions, captions only, off; without one, captions and off.
export const COMMENTARY = Object.freeze(['voice', 'captions', 'off']);
export function nextCommentary(now, hasVoice) {
  const next = COMMENTARY[(COMMENTARY.indexOf(now) + 1) % COMMENTARY.length];
  return next === 'voice' && !hasVoice ? 'captions' : next;
}
