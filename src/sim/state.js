import { PLAYER_TRACKING } from './player-tracking.js';
import { BALL, CLOCK, FOUL, LINEUP, MATCH, TIP } from './tuning.js';
import { TEAMS } from './teams.js';
import { iqOf, tendenciesOf } from './tendencies.js';
import { freshMood, traitsOf } from './mood.js';
import { emptyLine } from './stats.js';
import { setStyle, styled } from './styles.js';

const RATING_KEYS = ['inside', 'mid', 'three', 'handle', 'speed', 'defence', 'rebound', 'stamina'];   // ratings.js's KEYS: it imports this file, so they are named here too

// A person's surname, as the box score and the broadcast say it: the last word of his name, or the last two when the
// last is a suffix (Z. Michael Jr. is Michael Jr., not Jr.).
const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;
export const surname = person => {
  const words = person.name.split(' ');
  return words.length > 2 && SUFFIX.test(words.at(-1)) ? words.slice(-2).join(' ') : words.at(-1);
};

export const attackSign = team => (team === 0 ? 1 : -1);

// Standing on the floor, not in the middle of a jump.
export const onFloor = p => p.y === 0 && p.vy === 0;

// foul: reach in to foul the ball handler on purpose (only the computer does).
// cross, legs, back, stepBack, fade: the five moves (see moves.js).
export const emptyIntent = () => ({ moveX: 0, moveZ: 0, sprint: false, shoot: false, pass: false, steal: false, switch: false, hold: false, foul: false,
  cross: false, legs: false, back: false, stepBack: false, fade: false, dunk: false });

// What happened in one step, reported to the rules.
export const emptyEvents = () => ({ hitFloor: false, hitRim: false, hitBoard: false, scored: 0,
  travel: null, doubleDribble: null, stealMisses: [], release: null, contacts: [] });

// `points` for `team`: on the total and on the period being played.
export function addPoints(state, team, points) {
  const periods = state.byQuarter[team];
  while (periods.length < state.quarter) periods.push(0);
  periods[state.quarter - 1] += points;
  state.score[team] += points;
  for (const p of state.players) personOf(state, p).pm += p.team === team ? points : -points;   // plus-minus for the ten on court
  state.run[team] += points; state.run[1 - team] = 0;
  const mine = state.teamStats[team];
  mine.lead = Math.max(mine.lead, state.score[team] - state.score[1 - team]); mine.run = Math.max(mine.run, state.run[team]);
  if (points > 1) state.made[team][points - 2]++;
}

// The roster entry a court player currently is.
export const personOf = (state, player) => state.rosters[player.team][player.person];

// mulberry32: small seeded generator so a match replays identically from its seed.
export function rand(state) {
  let t = (state.seed = (state.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Does `player` jump the tip-off? Each team's jumper is the one in the place TIP.slot gives for the match's size.
export const isJumper = (state, player) => player.slot === TIP.slot[state.size];

// Player `id` of a match of `size` a side: the first `size` are team 0. He starts in the place and as the person of
// his number in his team's order.
function createPlayer(id, size) {
  return {
    id, team: id < size ? 0 : 1, slot: id % size, person: id % size,
    x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, facing: 0,
    shooting: false, jumpT: 0, inbounder: false, stealCooldown: 0,
    shotT: 0, letGo: false, takeoff: 0,   // seconds since he pressed shoot; the key came up during the gather; the speed he last left the floor at
    held: false, steps: 0, keyT: 0, setT: 0, foulCooldown: 0,
    calling: false, closing: false,   // he has a hand up for the ball; he is closing out on a shooter (see ai.js)
    // move: the move he is in, { kind, t, dx, dz, cx, cz, push }, or null (see moves.js). moveWait: seconds until he may
    // start another. moved: when his last ended. lateT: seconds he cannot steer, beaten by a move. stumbleT: seconds
    // left of a stumble. fading: his shot is a fade. shotKey: the key his shot is held on, 'shoot', 'fade' or 'dunk'.
    // finish: his shot is a finish at the rim, 'layup' or 'dunk' (see finish.js), or null. flair: how the finish he
    // last began is made, 'windmill' or null.
    move: null, moveWait: 0, moved: -Infinity, lateT: 0, stumbleT: 0, fading: false, shotKey: 'shoot', finish: null, flair: null,
    fed: null,   // the pass he caught last: { row, at }, the passer's roster row and when; null if the ball came some other way
    downT: 0, fallOnLanding: false,   // seconds left of being down on the floor; he goes down as he lands (see together.js)
    man: (id + size) % (2 * size), switchWait: 0,   // the id of the opponent he guards (see matchups.js); seconds until he may be switched again
    prev: emptyIntent(),
    ai: { timer: 0, targetX: 0, targetZ: 0, sprint: false, action: null },
  };
}

// Stand both teams in lines either side of centre court, facing each other.
export function lineUp(state) {
  for (const p of state.players) {
    const s = attackSign(p.team);
    Object.assign(p, {
      x: -2 * s, z: (p.slot - (state.size - 1) / 2) * LINEUP.gap[state.size], y: 0, vx: 0, vz: 0, vy: 0,
      facing: s === 1 ? 0 : Math.PI,
      shooting: false, shotT: 0, letGo: false, jumpT: 0, inbounder: false,
      held: false, steps: 0, keyT: 0, setT: 0,
      move: null, moveWait: 0, lateT: 0, stumbleT: 0, fading: false, shotKey: 'shoot', finish: null, flair: null, downT: 0, fallOnLanding: false,
    });
  }
}

// Makes a match not yet started one of `minutes`-minute quarters, with the foul limits that go with that length.
// A length the game does not have leaves it as it is.
export function setLength(state, minutes) {
  if (!MATCH.minutes.includes(minutes)) return;
  Object.assign(state, { quarterLength: minutes * 60, gameClock: minutes * 60, foulLimit: MATCH.fouls[minutes], bonus: MATCH.bonus[minutes] });
}

// The two sides of a match, as team data: each given as its place in TEAMS or as a team of its own (a test's).
const sidesOf = teams => teams.map(t => (typeof t === 'number' ? TEAMS[t] : t));

// A match of `size` a side: 3 or 5. Any other size is 3. `teams`: which teams play, the one a person plays first.
// Which of them is at home is the match's `home` (the first, unless it is set).
export function createMatch(seed = 1, size = 3, teams = [0, 1]) {
  if (size !== 5) size = 3;
  const state = {
    size,
    difficulty: 'allstar',   // one of DIFFICULTY.order
    quarterLength: CLOCK.quarter, foulLimit: FOUL.limit, bonus: FOUL.bonus,   // seconds in a quarter, and the fouls that go with a match of that length (see setLength)
    seed, time: 0,
    phase: 'start', phaseT: 0,
    quarter: 1, gameClock: CLOCK.quarter, shotClock: CLOCK.shot,
    score: [0, 0],
    byQuarter: [[], []],   // each team's points in each period played so far; overtime periods follow the fourth
    possession: 0, lastTouch: null, controlled: 0, lastControlled: 0,
    // possessions counted where they end (see possessions.js): each team's count, and [seconds used, how many]
    possessions: [0, 0], lengths: [[0, 0], [0, 0]], owner: null, ownerClock: 0, ownerQuarter: 1, lastEnded: null,
    inboundSpot: { x: 0, z: 0 },
    // manual: you brought him on yourself, so the automatic substitutions leave him alone until he comes off
    // ratings: what he is good at (see ratings.js). streak: his makes in a row from the floor, or his misses if negative.
    rosters: sidesOf(teams).map(t => t.players.map(p => ({ number: p.number, name: p.name, position: p.position, role: p.role,
      ratings: Object.fromEntries(RATING_KEYS.map(key => [key, p.ratings[key]])), streak: 0, energy: 1, fouls: 0, manual: false, stats: emptyLine(), secs: 0, pm: 0, onAt: 0 }))),   // stats: his line in the box score (see stats.js); secs: seconds on court; pm: plus-minus
    teams: sidesOf(teams),   // the data of each side: playbook, defence, coach (see teams.js)
    ids: teams.map((t, i) => (typeof t === 'number' ? t : i)),   // each side's place in TEAMS: whose kit, mark and 3D players it has
    subQueue: [], autoSubs: [true, true], teamFouls: [0, 0], lateFouls: [0, 0],
    stoppages: 0, planned: [-1, -1],   // how many times play has stopped; the stoppage each coach last planned his rotation at
    call: null, freeThrow: null, pendingFoul: null, tipWinner: null, clockRuns: false,
    timeouts: [0, 0], lastTimeout: -Infinity,   // each team's timeouts left (set below, from the style); when the last was called
    run: [0, 0],              // each team's points since the other last scored
    made: [[0, 0], [0, 0]],   // each team's baskets from the floor: [twos, threes]
    passer: null,             // the player who threw the last pass
    // What last happened, for whoever watches the match (the rules never read it). by, on: player ids. at: match time.
    // stumble: { by, on, at }. block: { by, on, at, chase }. steal: { by, on, at }.
    // score: a basket from the floor, { team, by, row, points, at, shotAt, clock, x, z, far, gap, green, assist, fouled,
    // tied, lead }: row his roster row; shotAt and clock the match time and the game clock when it left his hand; far
    // metres from the hoop; gap metres to the nearest opponent then; assist the roster row of who fed him, or null.
    last: { stumble: null, score: null, block: null, steal: null, rivals: null, foul: null },   // foul: the last called, { by, kind, at }
    down: null,     // a man knocked down and the team-mate who helps him up: { id, helper } (see together.js)
    huddle: null,   // the huddle of a timeout: { centres: [team 0's, team 1's] }, each { x, z }, while it is on
    rivals: {},   // the heat between opponents who keep getting the better of each other, by their pair (see mood.js)
    teamStats: [{ lead: 0, run: 0, tov: 0 }, { lead: 0, run: 0, tov: 0 }],   // each team's biggest lead, longest run, and turnovers that are nobody's
    board: false,             // a missed or blocked shot is loose: whoever takes it has a rebound
    boardTeam: null,          // the team whose miss it is: a rebound by them is offensive
    tempo: { clock: 0, wait: 0, fed: false },   // how patient this possession is, and the shot clock when that was last looked at (see ai.js)
    side: [1, 1],             // the side of the court each team's offence is set to (see offball.js)
    cut: [null, null],        // each team's player cutting to the hoop, { id, until }, or null
    screen: [null, null],     // each team's screen away from the ball: { by, for, spot, to, until, used, arrived? }, or null (see offball.js)
    plays: [null, null],      // the play each team is running (see plays.js), or null
    coach: [null, null],      // each team's coach (see coach.js), made when first asked for
    humans: [0],              // the teams a person plays: [0] in Play, [] in a match with nobody playing
    home: 0,                  // the team at home (0 or 1): its arena and its crowd. It changes nothing in the play.
    ato: null,                // the team that has just called a timeout with the ball: its coach calls what has worked
    playCall: [null, null],   // the play asked for and not yet started, by its key
    playWait: [0, 0],         // seconds until each team's coach may call another
    switches: 0,   // how many times men have been changed, by a screen or when getting back
    switchesBy: [0, 0],   // of those on a screen, by each team
    shot: null,   // how the last shot was let go, as the rules judged it; null from the next press until its release
    frontcourt: false, backcourtT: 0, inboundT: 0, controlTeam: null,
    players: Array.from({ length: 2 * size }, (_, id) => createPlayer(id, size)),
    ball: {
      x: 0, y: BALL.radius, z: 0, vx: 0, vy: 0, vz: 0,
      holder: null, mode: 'loose', shooter: null, shotValue: 0,
      noPickupId: null, noPickupT: 0,
      made: false,    // whether the last throw at a hoop was on target
      info: null,     // the shot in the air, for the box score: { id, team, row, value, at, clock, x, z, far, gap, green, assist }
      target: null,   // the id of the team-mate a pass in the air is for
    },
  };
  // What each player likes to do and how well he decides (see tendencies.js), from his role and ratings or his own;
  // who he is (his traits) and how he feels, fresh for the match (see mood.js).
  sidesOf(teams).forEach((side, t) => side.players.forEach((p, row) => {
    const person = state.rosters[t][row];
    const tracking = PLAYER_TRACKING[side.key + '/' + p.number];
    person.tend = tendenciesOf(person, p.tendencies, tracking);
    if (tracking) {
      person.rotationMinutes = tracking.minutes;
      person.rotationWeight = 0.25 * tracking.trackedMinutes / (tracking.trackedMinutes + 360);
    }
    person.iq = iqOf(person, p.iq);
    person.traits = traitsOf(person, p.traits);
    person.mood = freshMood(person.traits);
    // One of a team's duo (two who play off each other, see mood.js): the roster row of the other.
    const partner = side.duo?.includes(p.number) ? side.players.findIndex(q => q.number !== p.number && side.duo.includes(q.number)) : -1;
    if (partner >= 0) person.partner = partner;
  }));
  setStyle(state);   // Arcade with every slider at 50 until the page says otherwise (see styles.js)
  state.timeouts = [styled(state, 'timeout.each'), styled(state, 'timeout.each')];
  lineUp(state);
  return state;
}
