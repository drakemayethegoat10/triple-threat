// What the broadcast puts on the screen: a banner for a big moment, a small card above the scorebug, who celebrates,
// and the panels between play. It works from what the watcher heard and from the match; it changes neither.
import { nicknameOf } from '../sim/teams.js';

// Seconds each stays up. lineups: the panel before the tip. period, half: the panels between periods. The match
// waits while a panel is up, and any key takes it down.
export const SHOW = Object.freeze({ banner: 2.6, lower: 4, celebrate: 1.6, lineups: 4, period: 5, half: 9 });
export const PANELS = Object.freeze(['lineups', 'period', 'half']);

export const BANNER_WORDS = Object.freeze({ ankle: 'ANKLE-BREAKER', block: 'BLOCKED', andOne: 'AND ONE', buzzer: 'BUZZER-BEATER', winner: 'GAME-WINNER',
  poster: 'POSTER', stealScore: 'STEAL AND SCORE', deep: 'FROM DEEP', clutch: 'CLUTCH', heatingUp: 'HEATING UP', onFire: 'ON FIRE',
  run: '{n}-0 RUN', comeback: 'COMEBACK', rivalry: 'RIVALRY', duo: 'DYNAMIC DUO', perfect: 'PERFECT RELEASE' });
const BASKETS = ['ankle', 'andOne', 'buzzer', 'poster', 'stealScore', 'deep', 'clutch', 'heatingUp', 'onFire', 'duo', 'perfect'];   // moments that are a basket

const short = (state, team) => nicknameOf(state.teams[team]);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const createDirector = () => ({ banner: null, lower: null, cheer: null, lineupsUntil: null, betweenUntil: null, phase: 'start' });

// What is on the screen at real time `now` (seconds), after what was `heard` this frame:
// { banner: { words, name, team } | null, lower: { title, lines } | null, celebrate: id | null, dejected: id | null }.
export function direct(d, heard, state, now) {
  if (state.phase === 'start' || state.phase === 'final') Object.assign(d, { banner: null, lower: null, cheer: null });
  else for (const h of heard) {
    if (h.moment) {
      // A new moment takes the banner unless a bigger one is still up.
      if (!d.banner || now >= d.banner.until || h.rank <= d.banner.rank) {
        const words = h.kind === 'block' && h.chase ? 'CHASE-DOWN BLOCK' : BANNER_WORDS[h.kind].replace('{n}', h.n);
        d.banner = { words, name: h.name ?? short(state, h.team), team: h.team, rank: h.rank, until: now + SHOW.banner };
      }
      const sc = state.last.score;
      if (BASKETS.includes(h.kind) && sc && state.players[sc.by]) {
        const scorer = state.players[sc.by], rivals = state.players.filter(o => o.team !== scorer.team);
        d.cheer = { celebrate: scorer.id, dejected: rivals.reduce((a, b) => (dist(b, scorer) < dist(a, scorer) ? b : a)).id, until: now + SHOW.celebrate };
      }
    }
    const lower = lowerFor(h, state);
    if (lower) d.lower = { ...lower, until: now + SHOW.lower };
  }
  if (d.banner && now >= d.banner.until) d.banner = null;
  if (d.lower && now >= d.lower.until) d.lower = null;
  if (d.cheer && now >= d.cheer.until) d.cheer = null;
  return {
    banner: d.banner && { words: d.banner.words, name: d.banner.name, team: d.banner.team },
    lower: d.lower && { title: d.lower.title, lines: d.lower.lines },
    celebrate: d.cheer?.celebrate ?? null, dejected: d.cheer?.dejected ?? null,
  };
}

// The small card for a happening, or null: a free-throw shooter, a substitution, a timeout, a scorer reaching ten
// points (and every ten after) or heating up.
function lowerFor(h, state) {
  const stats = h.row === null || h.row === undefined ? null : state.rosters[h.team][h.row].stats;
  const lineOf = s => `${s.pts} PTS · ${s.fgm}/${s.fga} FG · ${s.tpm}/${s.tpa} 3PT`;
  if (h.kind === 'freeThrow') return { title: h.name, lines: [`Free throws ${stats.ftm}/${stats.fta}`] };
  if (h.kind === 'sub') return { title: `IN ${h.name}`, lines: [`OUT ${h.off}`] };
  if (h.kind === 'timeout') return { title: `TIMEOUT ${short(state, h.team)}`, lines: [`${state.teams[0].abbr} ${h.left[0]} left · ${state.teams[1].abbr} ${h.left[1]} left`] };
  if (h.kind === 'heatingUp' || h.kind === 'onFire') return { title: h.name, lines: [lineOf(stats)] };
  if (h.kind === 'made' && stats.pts >= 10 && Math.floor(stats.pts / 10) > Math.floor((stats.pts - h.points) / 10)) return { title: h.name, lines: [lineOf(stats)] };
  return null;
}

// The panel that should be up, or null: 'lineups' for SHOW.lineups seconds from the start of a match; 'period', or
// 'half' after the second period, for its own seconds from the end of a period. The match waits while one is up.
// To be asked every frame. `busy`: something else has the screen first (a replay): the panel's time starts when that is over.
export function panelFor(d, state, now, busy = false) {
  const began = (d.phase === 'start' || d.phase === 'final') && state.phase === 'jumpBall';
  const ended = d.phase !== 'quarterEnd' && state.phase === 'quarterEnd';
  d.phase = state.phase;
  if (began) d.lineupsUntil = now + SHOW.lineups;
  if (ended) d.betweenUntil = now + (state.quarter === 2 ? SHOW.half : SHOW.period);
  if (state.phase !== 'jumpBall') d.lineupsUntil = null;     // the tip has gone up, or the match was left
  if (state.phase !== 'quarterEnd') d.betweenUntil = null;   // the next period has begun, or the match was left
  const DONE = -Infinity;   // it has been up, or was skipped: it does not come back
  if (busy) {
    if (d.lineupsUntil !== null && d.lineupsUntil !== DONE) d.lineupsUntil = now + SHOW.lineups;
    if (d.betweenUntil !== null && d.betweenUntil !== DONE) d.betweenUntil = now + (state.quarter === 2 ? SHOW.half : SHOW.period);
    return null;
  }
  if (d.lineupsUntil !== null && now >= d.lineupsUntil) d.lineupsUntil = DONE;
  if (d.betweenUntil !== null && now >= d.betweenUntil) d.betweenUntil = DONE;
  if (d.lineupsUntil !== null && d.lineupsUntil !== DONE) return 'lineups';
  if (d.betweenUntil !== null && d.betweenUntil !== DONE) return state.quarter === 2 ? 'half' : 'period';
  return null;
}

// Takes the panel that is up down at once (any key). It does not come back.
export const skipPanel = d => { d.lineupsUntil = -Infinity; d.betweenUntil = -Infinity; };
