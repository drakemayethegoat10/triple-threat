// The teams' arenas: each team's home, as its building, its court and its banners look. Plain data, no Three.js; the
// building (building.js), the floor (floor.js) and the video board (videoboard.js) are made from it. The dev teams'
// names are invented; the league's are parodies (see sim/league.js).
import { TEAMS } from '../sim/teams.js';
import { assetUrl } from './assets.js';

const f = Object.freeze;

// Each team's mark (see sim/teams.js), by team id.
export const LOGOS = Object.freeze(TEAMS.map(team => team.logo));

// The pictures of the marks that are pictures (the league's: see sim/teams.js), by team id, once loadLogos has them.
const pictures = {};

// Loads every mark that is a picture. Resolves when they have all loaded (a missing one is left out: its team's mark
// is then drawn as a plain disc in its colour). In the browser only.
export function loadLogos() {
  return Promise.all(LOGOS.map((logo, team) => logo.image && new Promise(done => {
    const img = new Image();
    img.onload = () => { pictures[team] = img; done(); };
    img.onerror = () => done();
    img.src = assetUrl(logo.image);
  })));
}

// Draws team `team`'s mark on the 2D canvas context `g`, `size` pixels across, centred on (x, y): its picture, or its
// disc and paths. In the browser only (it needs Path2D).
export function drawLogo(g, team, x, y, size) {
  const logo = LOGOS[team], k = size / 40;
  if (logo.image && pictures[team]) { g.drawImage(pictures[team], x - size / 2, y - size / 2, size, size); return; }
  g.save();
  g.translate(x - size / 2, y - size / 2); g.scale(k, k);
  g.beginPath(); g.arc(20, 20, 18, 0, 2 * Math.PI);
  g.fillStyle = logo.disc; g.fill();
  g.lineWidth = 2; g.strokeStyle = logo.rim; g.stroke();
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const p of logo.paths ?? []) {
    const path = new Path2D(p.d);
    if (p.fill) { g.fillStyle = p.fill; g.fill(path); }
    if (p.stroke) { g.strokeStyle = p.stroke; g.lineWidth = p.width; g.stroke(path); }
  }
  g.restore();
}

// Team `team`'s mark as the inside of an SVG with a 0 0 40 40 view box, for the page.
export function logoSvg(team) {
  const logo = LOGOS[team];
  if (logo.image) return `<image href="${assetUrl(logo.image)}" x="0" y="0" width="40" height="40"/>`;
  const paths = logo.paths.map(p => `<path d="${p.d}" fill="${p.fill ?? 'none'}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.width}" stroke-linecap="round" stroke-linejoin="round"` : ''}/>`);
  return `<circle cx="20" cy="20" r="18" fill="${logo.disc}" stroke="${logo.rim}" stroke-width="2"/>${paths.join('')}`;
}

// name, city: on the sidelines and the baselines. team: whose home it is. colour: the building's fascia, its accent
// (the ribbon's frame, the railings' tops, the tunnel signs), the stands' concrete (the seats' colour), the steel of
// the roof, the tint of the railings' glass, the suites' glow, the roof's underside, the court's lane (`laneShade`: how
// strongly the lane's colour stains the wood), and the roof's lights ([r, g, b], brighter than white so they bloom
// before LOOK.glow, see arena.js). trusses: the roof's shape, 'wave' (rolling) or 'angle' (folded into sharp ridges).
// banners: what hangs from the roof, eight at most. floor (see floor.js; each may be left out): `tone`, what the wood's
// colour is multiplied by; `parquet`, the side of a parquet block in metres, its strips turned from block to block;
// `apron`, the colour the floor outside the lines is painted; `words`, the colour of the city and the name on it (else
// the lane's); `centre`, the centre circle's colour (else the lane's), or 'wood' for none; `ring`, rings round it, {
// r, width, colour, count, gap }; `art`, what is painted behind the baselines and beside the words, { kind: 'stars' or
// 'mountains' or 'splatter' (paint flung across the run-off, thickest at the corners), colour, edge }.
const DEV = f({
  tidewater: f({
    name: 'TIDEWATER ARENA', city: 'HARBOR CITY', team: 0,
    colour: f({ fascia: '#0b2a52', accent: '#18a8a8', concrete: '#1b2232', steel: '#7d8794', glass: '#9fd4e6', warm: '#ffcf8a',
      ceiling: '#05070c', lane: '#1d4fb8', laneShade: 0.9, lights: f([1, 0.97, 0.92]) }),
    trusses: 'wave',
    banners: f([
      f({ top: 'HARBOR CITY WAVES', big: '2014', bottom: 'CONFERENCE CHAMPIONS' }),
      f({ top: 'HARBOR CITY WAVES', big: '2011', bottom: 'DIVISION CHAMPIONS' }),
      f({ top: 'HARBOR CITY WAVES', big: '2017', bottom: 'DIVISION CHAMPIONS' }),
      f({ top: 'WAVES LEGEND', big: '7', bottom: 'RETIRED' }),
    ]),
  }),
  redrock: f({
    name: 'RED ROCK PAVILION', city: 'RED ROCK', team: 1,
    colour: f({ fascia: '#80492c', accent: '#ff8a2a', concrete: '#46332a', steel: '#9a7660', glass: '#ffb37a', warm: '#ff9a48',
      ceiling: '#0d0605', lane: '#a3301e', laneShade: 0.85, lights: f([1, 0.84, 0.66]) }),
    trusses: 'angle',
    banners: f([
      f({ top: 'RED ROCK SCORPIONS', big: '2016', bottom: 'CONFERENCE CHAMPIONS' }),
      f({ top: 'RED ROCK SCORPIONS', big: '2009', bottom: 'DIVISION CHAMPIONS' }),
      f({ top: 'RED ROCK SCORPIONS', big: '2019', bottom: 'DIVISION CHAMPIONS' }),
      f({ top: 'SCORPIONS LEGEND', big: '23', bottom: 'RETIRED' }),
    ]),
  }),
});

// A league team's arena, by its key ('NYE'): its name and city from the team (its venue), its banners from its
// history ({ titles, finals, retired }: the years of its championships and its conference titles, and its retired
// numbers, all invented), and the rest as given.
function league(key, { history, colour, ...look }) {
  const id = TEAMS.findIndex(t => t.key === key), t = TEAMS[id], name = t.name.toUpperCase();
  const banners = [
    ...history.titles.map(year => f({ top: name, big: String(year), bottom: 'LEAGUE CHAMPIONS' })),
    ...(history.finals ?? []).map(year => f({ top: name, big: String(year), bottom: 'CONFERENCE CHAMPIONS' })),
    ...(history.retired ?? []).map(n => f({ top: `${t.nickname.toUpperCase()} LEGEND`, big: String(n), bottom: 'RETIRED' })),
  ].slice(0, 8);
  return f({ name: t.venue.name.toUpperCase(), city: t.city.toUpperCase(), team: id, colour: f({ ceiling: '#06070b', laneShade: 0.88, ...colour }),
    ...look, floor: f(look.floor ?? {}), banners: f(banners) });
}

// The league's arenas, each after the home of the team it parodies: its look, not a copy of it.
const LEAGUE_ARENAS = f({
  // The Garden of the city: a dark bowl and theatre light on a blue-laned court with an orange ring, an old-school
  // navy apron, and two old championships in the rafters.
  nye: league('NYE', {
    colour: { fascia: '#101522', accent: '#f58426', concrete: '#1c1f2b', steel: '#5a6270', glass: '#9fb6d8', warm: '#ffb066', ceiling: '#030407',
      lane: '#1d428a', lights: [1, 0.9, 0.78] },
    trusses: 'wave',
    floor: { apron: '#14213d', words: '#f58426', ring: { r: 2.35, width: 0.3, colour: '#f58426' } },
    history: { titles: [1972, 1975], finals: [1994, 1999], retired: [10, 33] },
  }),
  // The Garden of the shamrocks: a red-oak parquet floor, green lanes, green rafters, and the most banners of all.
  bsh: league('BSH', {
    colour: { fascia: '#0b3d23', accent: '#ba9653', concrete: '#24272c', steel: '#1d6b40', glass: '#b8d8c4', warm: '#ffd9a0',
      lane: '#007a33', laneShade: 0.92, lights: [1, 0.95, 0.86] },
    trusses: 'angle',
    floor: { tone: [1.5, 1.08, 0.82], parquet: 1.524, centre: 'wood', ring: { r: 2.05, width: 0.22, colour: '#007a33' } },
    history: { titles: [1958, 1962, 1965, 1968, 1974, 1981, 1987, 2010] },
  }),
  // Red-white-and-blue under cool light: a broad centre court ringed in red, and stars down the sidelines.
  phi: league('PHI', {
    colour: { fascia: '#0d1f4a', accent: '#ed174c', concrete: '#1b2a5c', steel: '#7d8896', glass: '#9ec5ff', warm: '#ff7a7a',
      lane: '#006bb6', lights: [0.96, 0.97, 1.04] },
    trusses: 'angle',
    floor: { ring: { r: 3.1, width: 0.55, colour: '#ed174c' }, art: { kind: 'stars', colour: '#006bb6' } },
    history: { titles: [1968, 1984], finals: [2002], retired: [11, 32] },
  }),
  // On the water: a black apron with the team's red, red seats, and neon glass round the bowl.
  mia: league('MIA', {
    colour: { fascia: '#0b0b0d', accent: '#ff3d8b', concrete: '#8e1022', steel: '#4a4f58', glass: '#5ff2e0', warm: '#ff5fa2', ceiling: '#050206',
      lane: '#98002e', lights: [1, 0.92, 1.0] },
    trusses: 'wave',
    floor: { apron: '#0b0b0d', words: '#d0103a' },
    history: { titles: [2007, 2013, 2014], finals: [2021] },
  }),
  // The motor house: bare steel overhead, bold red seats, a blue apron and a red centre.
  det: league('DET', {
    colour: { fascia: '#1f2329', accent: '#1d42ba', concrete: '#b01226', steel: '#a8b0bb', glass: '#c8d4e6', warm: '#ffc98a',
      lane: '#1d42ba', lights: [0.97, 0.98, 1.0] },
    trusses: 'angle',
    floor: { apron: '#14306e', words: '#ffffff', centre: '#c8102e' },
    history: { titles: [1990, 1991, 2005], finals: [1988] },
  }),
  // Out in orbit: a black apron strewn with stars, orbits round the centre circle, blue seats and cool blue light.
  orl: league('ORL', {
    colour: { fascia: '#07090d', accent: '#2fa8ff', concrete: '#0b4f9e', steel: '#3a4250', glass: '#7fc4ff', warm: '#7fb6ff', ceiling: '#020306',
      lane: '#0077c0', lights: [0.88, 0.95, 1.1] },
    trusses: 'wave',
    floor: { apron: '#07090d', words: '#2fa8ff', centre: '#07090d', ring: { r: 2.3, width: 0.06, colour: '#c4ced4', count: 3, gap: 0.45 },
      art: { kind: 'stars', colour: '#c4ced4' } },
    history: { titles: [], finals: [1996, 2010], retired: [32] },
  }),
  // The palace: bright maple, a gold lane, a purple apron and bowl, and the rafters full.
  lar: league('LAR', {
    colour: { fascia: '#2a1245', accent: '#fdb927', concrete: '#3b1d5c', steel: '#6c5a86', glass: '#e8d08a', warm: '#ffcf6a',
      lane: '#fdb927', laneShade: 0.9, lights: [1, 0.95, 0.84] },
    trusses: 'angle',
    floor: { tone: [1.7, 1.6, 1.36], apron: '#552583', words: '#fdb927', centre: '#552583' },
    history: { titles: [1951, 1955, 1973, 1981, 1986, 1989, 2001, 2011] },
  }),
  // The storm: blue seats, a navy apron with the sunset orange, and orange light glowing from the suites.
  okc: league('OKC', {
    colour: { fascia: '#002d62', accent: '#ef3b24', concrete: '#0a3d7a', steel: '#56606e', glass: '#7fc0ff', warm: '#ff9a52',
      lane: '#007ac1', lights: [0.95, 0.98, 1.05] },
    trusses: 'wave',
    floor: { apron: '#002d62', words: '#ef3b24', centre: '#ef3b24' },
    history: { titles: [2024], finals: [2013] },
  }),
  // By the bay: pale modern steel, a sweeping roof, navy and gold, a gold centre on a blue-apron court.
  gsg: league('GSG', {
    colour: { fascia: '#16213f', accent: '#ffc72c', concrete: '#22283a', steel: '#c9ced6', glass: '#ffe08a', warm: '#ffd36b',
      lane: '#1d428a', lights: [1, 0.95, 0.86] },
    trusses: 'wave',
    floor: { apron: '#1d428a', words: '#ffc72c', centre: '#ffc72c' },
    history: { titles: [1976, 2016, 2018, 2023], finals: [2019] },
  }),
  // Silver and black: a black lane on clean maple, a dark grey apron, black seats and plain white light.
  sas: league('SAS', {
    colour: { fascia: '#26292e', accent: '#c4ced4', concrete: '#1a1a1c', steel: '#b8bec6', glass: '#dfe5ea', warm: '#f2efe8',
      lane: '#000000', laneShade: 0.94, lights: [1, 1, 1] },
    trusses: 'angle',
    floor: { apron: '#2b2e33', words: '#c4ced4', centre: 'wood', ring: { r: 2.05, width: 0.2, colour: '#000000' } },
    history: { titles: [2000, 2004, 2006, 2008, 2015] },
  }),
  // The mine: a mountain skyline behind each baseline, navy lanes, gold everywhere else.
  den: league('DEN', {
    colour: { fascia: '#0e2240', accent: '#fec524', concrete: '#0e2a5a', steel: '#6b7380', glass: '#9fc8ff', warm: '#ffc75a',
      lane: '#0e2240', lights: [1, 0.96, 0.86] },
    trusses: 'angle',
    floor: { words: '#fec524', art: { kind: 'mountains', colour: '#0e2240', edge: '#fec524' } },
    history: { titles: [2022], finals: [2010] },
  }),
  // Lone star: a navy apron with silver stars, blue lanes and silver-blue trim.
  dal: league('DAL', {
    colour: { fascia: '#002b5e', accent: '#b8c4ca', concrete: '#0b2f5e', steel: '#9aa6b2', glass: '#cfe0f0', warm: '#e9eef5',
      lane: '#00538c', lights: [0.96, 0.98, 1.04] },
    trusses: 'wave',
    floor: { apron: '#002b5e', words: '#b8c4ca', centre: '#002b5e', art: { kind: 'stars', colour: '#b8c4ca' } },
    history: { titles: [2012], finals: [2007, 2025] },
  }),
});

// The arenas of the teams that play in Exhibition only (see sim/guests.js): their name and city from the team, their
// banners as given, and the rest as a league arena's.
function guest(key, { banners, colour, ...look }) {
  const id = TEAMS.findIndex(t => t.key === key), t = TEAMS[id];
  return f({ name: t.venue.name.toUpperCase(), city: t.city.toUpperCase(), team: id, colour: f({ ceiling: '#06070b', laneShade: 0.88, ...colour }),
    ...look, floor: f(look.floor ?? {}), banners: f(banners.map(f)) });
}
const GUEST_ARENAS = f({
  // Garden State Made's Jersey gym: black steel and red seats under plain white light, a black apron with red paint
  // flung across it, the team's mark on a white centre circle, and banners of its own (nothing it has not won).
  gsm: guest('GSM', {
    colour: { fascia: '#111111', accent: '#b5121b', concrete: '#8e0f19', steel: '#3a3a3e', glass: '#ffd0d4', warm: '#fff1e8', ceiling: '#050505',
      lane: '#b5121b', laneShade: 0.9, lights: [1, 0.98, 0.96] },
    trusses: 'angle',
    floor: { apron: '#111111', words: '#ffffff', centre: '#ffffff', ring: { r: 2.05, width: 0.2, colour: '#b5121b' }, art: { kind: 'splatter', colour: '#b5121b' } },
    banners: [
      { top: 'GARDEN STATE MADE', big: 'GSM', bottom: 'NEW JERSEY' },
      { top: 'GARDEN STATE MADE', big: '30 & 10', bottom: 'THE DYNAMIC DUO' },
    ],
  }),
});

// Every arena, by the key a team names (its `arena`).
export const ARENAS = f({ ...DEV, ...LEAGUE_ARENAS, ...GUEST_ARENAS });

// The arena a match is played in: the home team's (`home`, its id); Tidewater for a team there is not.
export const arenaOf = (home = 0) => ARENAS[TEAMS[home]?.arena] ?? ARENAS.tidewater;
