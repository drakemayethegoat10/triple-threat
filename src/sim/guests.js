// The teams that play only in Exhibition (Team Select), never in MyLeague: written by hand, not imported with the
// league (see league.js). They come after the league in TEAMS, so no team's id moves.
//
// Garden State Made is the owner's own team: the owner and friends, named as they asked (an initial and a surname),
// and rated from how they play. Six players, so a five-a-side game has one man on the bench, and the six play every
// minute between them: rated as the league's starters are, they won 85% of their games against it, so the two stars
// are rated near the league's best and the others below its starters, which makes them a contender rather than the
// league's best. Measured on 2026-11-23 against each league team six times in the 3D game (what Exhibition plays),
// they won 64% in Simulation and 68% in Arcade five a side, 54% and 56% three a side, where the league's best won
// 47% in Arcade. (The fast engine, which Exhibition does not use, has them stronger: 74% and 92% five a side.) Its two
// stars play off each other (`duo`: the numbers of the two, see mood.js). `exhibition`: kept out of MyLeague. `models: false`: its
// players have no models of their own yet, so each stands in a dev body (see render/checks.js bodiesOf).
// `wordmark`: the chest's two lines, on both kits; `splatter`: the paint flung across each kit; `state`: the outline
// behind the numbers (see render/kit.js).
const f = Object.freeze;

// Ratings in the order inside, mid, three, handle, speed, defence, rebound, stamina (see ratings.js).
const KEYS = ['inside', 'mid', 'three', 'handle', 'speed', 'defence', 'rebound', 'stamina'];
const player = (name, number, position, role, height, ratings, own = {}) =>
  f({ name, number, position, role, height, starter: own.starter ?? true, ratings: f(Object.fromEntries(KEYS.map((k, i) => [k, ratings[i]]))), ...own });

export const GUESTS = f([
  f({
    key: 'GSM', name: 'Garden State Made', abbr: 'GSM', city: 'Garden State', nickname: 'Made', exhibition: true, models: false,
    playbook: 'insideOut', defence: 'switchAll', coach: 'steady', coachName: 'Z. Michael Sr.', assistant: 'D. Feaster',
    colour: '#b5121b', secondary: '#111111', accent: '#ffffff', bar: '#e0283a', ink: '#ffc2c7',
    uniforms: f({
      home: f({ jersey: '#ffffff', trim: '#b5121b', letters: '#b5121b', outline: '#111111', splatter: '#b5121b' }),
      road: f({ jersey: '#a30f1b', trim: '#ffffff', letters: '#ffffff', outline: '#111111', splatter: '#ffffff' }),
    }),
    wordmark: f(['GARDEN STATE', 'MADE']),
    // New Jersey's outline, drawn freehand in a unit square (west to east, north to south): behind the jersey's numbers.
    state: f([[0.22, 0], [0.8, 0.17], [0.82, 0.25], [0.78, 0.3], [0.86, 0.36], [0.95, 0.38], [0.9, 0.45], [0.86, 0.6], [0.78, 0.75],
      [0.62, 0.92], [0.52, 1], [0.45, 0.9], [0.3, 0.8], [0.18, 0.72], [0.25, 0.62], [0.38, 0.5], [0.28, 0.42], [0.12, 0.33], [0.13, 0.2]].map(f)),
    arena: 'gsm',
    venue: f({ name: 'Garden State Gym', short: 'The Gym', state: 'NJ', notes: 'A Jersey gym in red and white, paint flung across the apron' }),
    logo: f({ image: 'assets/logos/gsm.png', disc: '#b5121b', rim: '#ffffff' }),
    duo: f(['30', '10']),
    // The first three play a three-a-side match: the duo and the big. P. Jones is the sixth man.
    players: f([
      // Fast, a high flyer with great handles and a good shot.
      player('L. Pryor', '30', 'PF', 'Slasher', 2.01, [96, 86, 82, 92, 94, 81, 79, 91],
        { traits: f({ showman: 0.9, swagger: 0.75, clutch: 0.75 }) }),
      // A point guard who scores like a wing: the post fadeaway, the mid-range, passes with elite IQ; no three.
      player('G. Archundia', '10', 'PG', 'Post scorer', 1.96, [90, 96, 51, 91, 86, 83, 61, 92],
        { tendencies: f({ passFirst: 0.6, post: 0.95, iso: 0.55, lowPost: true, diet: f({ rim: 0.3, mid: 0.64, three: 0.06 }) }), iq: 0.97,
          traits: f({ leader: 0.95, composure: 0.85, clutch: 0.9, swagger: 0.75 }) }),
      // Very physical, strong and tough: he defends the rim, owns the glass and backs men down.
      player('A. Madore', '8', 'C', 'Rim protector', 1.96, [89, 64, 40, 48, 64, 85, 87, 76],
        { tendencies: f({ usage: 0.45, post: 0.75, foul: 0.65 }), traits: f({ fire: 0.95, composure: 0.4, swagger: 0.7 }) }),
      // Fast, with good handles.
      player('Z. Michael Jr.', 'XX', 'SG', 'Slasher', 1.96, [74, 70, 69, 78, 85, 69, 41, 78]),
      // Very shifty, with good handles.
      player('D. Tortu', '32', 'SF', 'Shot creator', 1.98, [72, 75, 71, 82, 80, 66, 48, 76], { tendencies: f({ usage: 0.62 }) }),
      // A rebounder.
      player('P. Jones', '2', 'SG', 'Glass cleaner', 1.96, [72, 65, 63, 61, 72, 70, 82, 78], { starter: false }),
    ]),
  }),
]);
