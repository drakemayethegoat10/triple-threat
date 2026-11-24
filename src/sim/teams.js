// Teams, and what a team or a player is like, as data. Nothing in the simulation names a team: the coach, the decision
// maker and the fast engine read only what is here (and the ratings), so a team added to TEAMS plays like any other.
//
// A team: its name and abbreviation, the keys of its playbook, its defence and its coach, and its players in roster
// order (eight for a dev team, ten for the league's, six for Garden State Made; the first three start a three-a-side
// match, the first five a five-a-side one). A player: name, number,
// position, role, the eight ratings, and, if he is unlike his role, his own `tendencies` and `iq` (see tendencies.js).
// And how the team looks, which the simulation never reads: its city and nickname (its name is the two together); its
// colour (its kit, its fans' shirts), and if it likes, a brighter one for the page's edges (`bar`) and a pale one for
// words (`ink`), both mixed from its colour when not given; its mark (`logo`: in a 40-unit square, a disc, its rim,
// and paths each filled or stroked, as an SVG path); and its arena (a key of render/arenas.js's ARENAS). A team's place in TEAMS is
// its id: its players' 3D models are named by it (player-<id>-<number> in assets/players.glb).
import { LEAGUE } from './league.js';
import { GUESTS } from './guests.js';

const f = Object.freeze;

// Ratings in the order inside, mid, three, handle, speed, defence, rebound, stamina (see ratings.js). `own`: what
// else is his, such as his height in metres (as built: assets/source/people.json).
const KEYS = ['inside', 'mid', 'three', 'handle', 'speed', 'defence', 'rebound', 'stamina'];
const player = (name, number, position, role, ratings, own = {}) => f({ name, number, position, role, ratings: f(Object.fromEntries(KEYS.map((k, i) => [k, ratings[i]]))), ...own });

// A team's nickname ('Waves'): its own, or the last word of its name for a team that gives none (a test's).
export const nicknameOf = team => team.nickname ?? team.name.split(' ').pop();

// The two dev teams first (ids 0 and 1: the game's own tests and tools play them, and they are shown only on a link
// ending #dev), then the league (league.js), East then West, then the teams that play in Exhibition only (guests.js).
export const TEAMS = f([
  f({
    name: 'Harbor City Waves', abbr: 'WAV', playbook: 'paceSpace', defence: 'switchAll', coach: 'steady', dev: true,
    city: 'Harbor City', nickname: 'Waves', colour: '#2f6fe0', bar: '#4f97ff', ink: '#a9c8ff', arena: 'tidewater',
    logo: f({ disc: '#1d4fb8', rim: '#e6ecf5', paths: f([
      f({ d: 'M5 24c4-7 9-7 13 0s9 7 17-2v6c-7 7-13 6-17 0s-8-5-13 2z', fill: '#ffffff' }),
      f({ d: 'M8 17c3-5 7-5 10 0s7 5 13-1', stroke: '#9cc4ff', width: 2.4 }),
    ]) }),
    players: f([
      player('Jalen Cross', 4, 'PG', 'Playmaker', [78, 88, 84, 94, 90, 72, 48, 84], { height: 1.96 }),
      player('Theo Marsh', 7, 'SF', 'Slasher', [90, 70, 58, 80, 88, 74, 64, 78], { height: 1.88 }),
      player('Darius Stone', 11, 'C', 'Rim protector', [86, 74, 42, 50, 62, 92, 90, 78], { height: 2.03 }),
      player('Sam Okoro', 15, 'SG', 'Sharpshooter', [60, 88, 94, 78, 75, 58, 62, 80], { height: 1.93 }),
      player('Andre Volkov', 23, 'PF', 'Stretch big', [80, 78, 84, 58, 56, 74, 84, 70], { height: 2.08 }),
      player('Marcus Bell', 1, 'PG', 'Shot creator', [68, 86, 76, 84, 76, 52, 58, 66], { height: 1.9 }),
      player('Noah Vance', 13, 'SF', 'Lockdown wing', [63, 55, 70, 60, 76, 90, 60, 86], { height: 2.0 }),
      player('Idris Kane', 32, 'C', 'Rebounder', [82, 62, 40, 54, 50, 76, 92, 68], { height: 2.07 }),
    ]),
  }),
  f({
    name: 'Red Rock Scorpions', abbr: 'SCO', playbook: 'insideOut', defence: 'dropBig', coach: 'aggressive', dev: true,
    city: 'Red Rock', nickname: 'Scorpions', colour: '#d83a3a', bar: '#ff5a5a', ink: '#ffb0b0', arena: 'redrock',
    logo: f({ disc: '#8f1717', rim: '#f1e2e2', paths: f([
      f({ d: 'M13 29c-5-5-5-13 1-17 5-3 12-1 13 4', stroke: '#ffffff', width: 3.2 }),
      f({ d: 'M27 16l4-6-1 8z', fill: '#ffffff' }),
      f({ d: 'M19.2 29a3.2 3.2 0 1 1-6.4 0a3.2 3.2 0 1 1 6.4 0z', fill: '#ffffff' }),
      f({ d: 'M19 28l7 2M19 30l6 4', stroke: '#ffffff', width: 2 }),
    ]) }),
    players: f([
      player('Kai Mercer', 5, 'PG', 'Shot creator', [83, 94, 90, 92, 86, 58, 62, 78], { height: 1.85 }),
      player('Luca Reyes', 8, 'SF', 'Two-way wing', [78, 72, 84, 60, 80, 88, 66, 80], { height: 1.98 }),
      player('Viktor Lund', 10, 'C', 'Post scorer', [94, 80, 45, 55, 52, 78, 88, 75], { height: 2.01 }),
      player('Devon Hale', 21, 'SG', 'Sharpshooter', [62, 84, 92, 73, 76, 62, 44, 90], { height: 1.91 }),
      player('Emeka Bright', 33, 'PF', 'Glass cleaner', [80, 60, 44, 52, 70, 84, 92, 74], { height: 2.06 }),
      player('Rafael Ortiz', 2, 'PG', 'Lockdown guard', [62, 64, 52, 76, 86, 90, 58, 74], { height: 1.87 }),
      player('Jamal Whitaker', 14, 'SF', 'Slasher', [86, 62, 50, 74, 84, 69, 62, 72], { height: 1.99 }),
      player('Bogdan Ilic', 30, 'C', 'Rim protector', [76, 62, 50, 44, 48, 88, 86, 68], { height: 2.05 }),
    ]),
  }),
  ...LEAGUE,
  ...GUESTS,
]);

// The teams a player may pick in Exhibition: the league and the guests, and the dev teams too when `dev` (the link
// ends #dev).
export const pickable = (dev = false) => TEAMS.map((team, id) => id).filter(id => dev || !TEAMS[id].dev);
// The teams of MyLeague: the league's, never a dev team or one that plays in Exhibition only.
export const clubIds = () => pickable().filter(id => !TEAMS[id].exhibition);
// Whether a team's players have models of their own (a file each: see render/assets.js): the league's do; a dev
// team's are in assets/players.glb, and a team that has none yet (`models: false`) stands in dev bodies.
export const ownModels = team => !team.dev && team.models !== false;

// What each role is for, as starting tendencies (each 0 to 1; see tendencies.js for what they mean and how a
// player's ratings move them) and a starting IQ. 'Role player' stands in for a role not listed.
const role = (usage, rim, mid, three, passFirst, drive, post, iso, crash, gamble, help, foul, iq) =>
  f({ usage, diet: f({ rim, mid, three }), passFirst, drive, post, iso, crash, gamble, help, foul, iq });
export const ROLES = f({
  'Playmaker':      role(0.55, 0.35, 0.35, 0.30, 0.85, 0.60, 0.05, 0.40, 0.15, 0.40, 0.40, 0.35, 0.90),
  'Slasher':        role(0.60, 0.60, 0.25, 0.15, 0.35, 0.90, 0.15, 0.50, 0.45, 0.45, 0.45, 0.50, 0.65),
  'Rim protector':  role(0.30, 0.75, 0.20, 0.05, 0.40, 0.20, 0.50, 0.10, 0.70, 0.25, 0.90, 0.60, 0.70),
  'Sharpshooter':   role(0.55, 0.15, 0.30, 0.55, 0.45, 0.25, 0.05, 0.30, 0.15, 0.35, 0.35, 0.35, 0.72),
  'Stretch big':    role(0.45, 0.30, 0.25, 0.45, 0.50, 0.25, 0.35, 0.20, 0.45, 0.30, 0.60, 0.50, 0.72),
  'Shot creator':   role(0.80, 0.30, 0.40, 0.30, 0.30, 0.65, 0.15, 0.90, 0.20, 0.40, 0.35, 0.40, 0.75),
  'Lockdown wing':  role(0.30, 0.35, 0.25, 0.40, 0.55, 0.35, 0.10, 0.15, 0.30, 0.55, 0.80, 0.55, 0.72),
  'Rebounder':      role(0.30, 0.80, 0.15, 0.05, 0.45, 0.15, 0.45, 0.10, 0.85, 0.25, 0.70, 0.60, 0.62),
  'Two-way wing':   role(0.50, 0.30, 0.30, 0.40, 0.50, 0.50, 0.15, 0.35, 0.35, 0.50, 0.70, 0.45, 0.75),
  'Post scorer':    role(0.70, 0.55, 0.35, 0.10, 0.35, 0.30, 0.95, 0.40, 0.60, 0.25, 0.55, 0.55, 0.72),
  'Glass cleaner':  role(0.30, 0.80, 0.15, 0.05, 0.45, 0.20, 0.40, 0.10, 0.90, 0.30, 0.75, 0.60, 0.65),
  'Lockdown guard': role(0.35, 0.35, 0.30, 0.35, 0.65, 0.45, 0.05, 0.20, 0.20, 0.70, 0.70, 0.50, 0.75),
  'Role player':    role(0.45, 0.40, 0.30, 0.30, 0.50, 0.45, 0.20, 0.30, 0.40, 0.40, 0.55, 0.50, 0.70),
});

// How a team plays with the ball. plays: how often its coach calls each play, against 1 for a play like any other.
// pace: how quickly it gets into its offence (above 1, quicker). threes: its appetite for threes against shots
// inside. run: how often it pushes the ball after a stop. crash: how much of the team goes to the offensive glass
// rather than back on defence (0 to 1).
export const PLAYBOOKS = f({
  paceSpace: f({ plays: f({ pickRoll: 3, pickPop: 2.2, iso: 0.8, horns: 1.2, fiveOut: 2.2, postUp: 0.4, floppy: 1.2, spain: 1.6, giveGo: 1.2, ucla: 0.8, dho: 1.6, flare: 1.2 }),
    pace: 1.1, threes: 1.25, run: 1.35, crash: 0.25 }),
  insideOut: f({ plays: f({ pickRoll: 1.3, pickPop: 0.6, iso: 2.2, horns: 1.8, fiveOut: 0.6, postUp: 3, floppy: 1.2, spain: 0.8, giveGo: 0.9, ucla: 1.4, dho: 0.8, flare: 0.8 }),
    pace: 0.92, threes: 0.8, run: 0.8, crash: 0.6 }),
  balanced: f({ plays: f({}), pace: 1, threes: 1, run: 1, crash: 0.4 }),
});

// How a team defends. screen: what the two defenders do when the ball is screened: 'switch' (swap men), 'drop' (the
// big sits back between the ball and the rim while the ball's defender goes over), or 'over' (fight over, and swap
// only if a man is lost: the game's own). help: how far off the ball they sag and how eagerly they help (0 to 1).
// postDouble: a strong post scorer catching deep draws a second defender. pressure: what the on-ball gap is
// divided by (above 1, tighter).
export const DEFENCES = f({
  switchAll: f({ screen: 'switch', help: 0.5, postDouble: false, pressure: 1.05 }),
  dropBig: f({ screen: 'drop', help: 0.7, postDouble: true, pressure: 0.95 }),
  standard: f({ screen: 'over', help: 0.6, postDouble: false, pressure: 1 }),
});

// How a coach coaches. adapt: how far he changes what his team does to what is happening (against 1). timeouts: how
// readily he calls one (against 1). depth: how many of his players he means to use.
export const COACHES = f({
  steady: f({ adapt: 0.8, timeouts: 1, depth: 8 }),
  aggressive: f({ adapt: 1.2, timeouts: 1.2, depth: 8 }),
});
