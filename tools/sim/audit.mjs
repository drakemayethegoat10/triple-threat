// Audits the league's simulated box scores: every pairing of the league's teams played by the fast engine (Simulate),
// or a few by the 3D game, and each player's line set beside what he is (position, role, ratings, tendencies).
// Reports whether the ratings and tendencies survive into the numbers (rebounds, shots, threes, assists), the spread
// from game to game, the extreme nights, foul trouble, and whether the box scores add up. A tool: see README.md.
//   node tools/sim/audit.mjs [quick|3d] [games per pairing] [minutes] [save.json]
import { quickMatch } from '../../src/sim/quick/engine.js';
import { createMatch, setLength } from '../../src/sim/state.js';
import { startMatch } from '../../src/sim/rules.js';
import { setStyle } from '../../src/sim/styles.js';
import { step } from '../../src/sim/step.js';
import { aiIntents } from '../../src/sim/ai.js';
import { DT } from '../../src/sim/tuning.js';
import { TEAMS, clubIds } from '../../src/sim/teams.js';
import { teamLine } from '../../src/sim/stats.js';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';

const KEYS = ['pts', 'reb', 'orb', 'ast', 'stl', 'blk', 'tov', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta'];

// One game between team ids `a` and `b` by `engine`: the finished match.
export function play(engine, a, b, seed, minutes) {
  if (engine === 'quick') return quickMatch({ seed, size: 5, minutes, style: 'sim', teams: [a, b] });
  const s = createMatch(seed, 5, [a, b]);
  setLength(s, minutes); setStyle(s, 'sim'); s.humans = []; startMatch(s);
  for (let i = 0; i < 60 * 60 * 60 && s.phase !== 'final'; i++) step(s, aiIntents(s, DT), DT);
  return s;
}

// Every league pairing (the MyLeague teams: see teams.js clubIds), `games` times each (home and away in turn): each player's lines, and each team's.
export function collect(engine, games, minutes, ids = clubIds()) {
  const players = new Map(), teams = [], checks = { games: 0, pointsOff: 0, minutesOff: 0, reboundsOff: 0, assistsOver: 0 };
  let seed = 1;
  for (const a of ids) for (const b of ids) if (a < b) for (let g = 0; g < games; g++) {
    const [x, y] = g % 2 ? [b, a] : [a, b], s = play(engine, x, y, seed++, minutes);
    checks.games++;
    for (const side of [0, 1]) {
      const line = teamLine(s, side), id = s.ids[side];
      teams.push({ id, ...line, opp: teamLine(s, 1 - side), score: s.score[side], poss: s.possessions?.[side] ?? null });
      // The box score adds up: points from the shots, the minutes to five a side, assists no more than baskets.
      if (line.pts !== 2 * line.fgm + line.tpm + line.ftm || s.score[side] !== line.pts) checks.pointsOff++;
      const secs = s.rosters[side].reduce((sum, p) => sum + p.secs, 0), want = 5 * s.quarterLength * 4;
      if (s.quarter <= 4 && Math.abs(secs - want) > 1) checks.minutesOff++;   // (an overtime's length is the style's)
      if (line.ast > line.fgm) checks.assistsOver++;
      s.rosters[side].forEach(person => {
        const key = `${id}/${person.number}`;
        if (!players.has(key)) players.set(key, { team: TEAMS[id].key, name: person.name, position: person.position, role: person.role, ratings: person.ratings, tend: person.tend, games: [] });
        players.get(key).games.push({ min: person.secs / 60, fouls: person.fouls, ...Object.fromEntries(KEYS.map(k => [k, person.stats[k]])) });
      });
    }
    // Rebounds: every miss is somebody's, a team's (out of bounds), or a free throw's (not the last).
    const missed = [0, 1].reduce((sum, side) => { const l = teamLine(s, side); return sum + (l.fga - l.fgm); }, 0);
    const boards = [0, 1].reduce((sum, side) => sum + teamLine(s, side).reb, 0);
    if (boards > missed + [0, 1].reduce((sum, side) => sum + teamLine(s, side).fta - teamLine(s, side).ftm, 0)) checks.reboundsOff++;
  }
  return { players: [...players.values()], teams, checks };
}

export const mean = list => list.reduce((s, v) => s + v, 0) / (list.length || 1);
export const sd = list => { const m = mean(list); return Math.sqrt(mean(list.map(v => (v - m) ** 2))); };
export const corr = (xs, ys) => { const mx = mean(xs), my = mean(ys); const n = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0); return n / Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0)); };
// A player's per-36 rate of `key` over his games, and his minutes a game.
export const per36 = (p, key) => 36 * p.games.reduce((s, g) => s + g[key], 0) / Math.max(1, p.games.reduce((s, g) => s + g.min, 0));
export const mpg = p => mean(p.games.map(g => g.min));
// How far `x(p)` and `y(p)` go together among players of the same position: each measured from his position's mean,
// all positions pooled. The position itself counts for nothing here, only what sets a player apart from his peers.
export function withinPositions(players, x, y) {
  const off = f => { const at = {}; for (const p of players) (at[p.position] ??= []).push(f(p)); const m = Object.fromEntries(Object.entries(at).map(([k, v]) => [k, mean(v)])); return players.map(p => f(p) - m[p.position]); };
  return corr(off(x), off(y));
}

export function report({ players, teams, checks }) {
  const out = [];
  const regulars = players.filter(p => mpg(p) >= 12);
  const row = (label, xs, ys) => out.push(`${label.padEnd(44)} r = ${corr(xs, ys).toFixed(2)}`);
  out.push(`games ${checks.games} · players ${players.length} (${regulars.length} with 12+ minutes a game)`);
  out.push(`box scores: points off ${checks.pointsOff}, minutes off ${checks.minutesOff}, rebounds over the misses ${checks.reboundsOff}, assists over baskets ${checks.assistsOver}`);
  out.push('', '-- do the ratings and tendencies survive? (players with 12+ minutes a game)');
  row('rebounds/36 vs rebound rating', regulars.map(p => p.ratings.rebound), regulars.map(p => per36(p, 'reb')));
  for (const pos of ['PG', 'SG', 'SF', 'PF', 'C']) {
    const at = regulars.filter(p => p.position === pos);
    if (at.length > 3) row(`  within ${pos} (${at.length})`, at.map(p => p.ratings.rebound), at.map(p => per36(p, 'reb')));
  }
  out.push(`${'  within positions, pooled'.padEnd(44)} r = ${withinPositions(regulars, p => p.ratings.rebound, p => per36(p, 'reb')).toFixed(2)}`);
  row('offensive rebounds/36 vs crash tendency', regulars.map(p => p.tend.crash), regulars.map(p => per36(p, 'orb')));
  row('shots/36 vs usage tendency', regulars.map(p => p.tend.usage), regulars.map(p => per36(p, 'fga')));
  row('share of shots from three vs three diet', regulars.map(p => p.tend.diet.three), regulars.map(p => per36(p, 'tpa') / Math.max(0.1, per36(p, 'fga'))));
  row('assists/36 vs pass-first tendency', regulars.map(p => p.tend.passFirst), regulars.map(p => per36(p, 'ast')));
  row('assists/36 vs handle rating', regulars.map(p => p.ratings.handle), regulars.map(p => per36(p, 'ast')));
  row('blocks/36 vs defence rating', regulars.map(p => p.ratings.defence), regulars.map(p => per36(p, 'blk')));
  row('three-point % vs three rating (25+ attempts)', ...(l => [l.map(p => p.ratings.three), l.map(p => per36(p, 'tpm') / per36(p, 'tpa'))])(regulars.filter(p => p.games.reduce((s, g) => s + g.tpa, 0) >= 25)));
  out.push('', '-- by position: per 36 minutes (mean of players with 12+ minutes)');
  out.push('pos   n   reb   orb   ast   fga   3pa   blk   stl    pf   mpg   rating(reb)');
  for (const pos of ['PG', 'SG', 'SF', 'PF', 'C']) {
    const at = regulars.filter(p => p.position === pos), f = key => mean(at.map(p => per36(p, key))).toFixed(1).padStart(5);
    out.push(`${pos.padEnd(4)}${String(at.length).padStart(3)} ${f('reb')} ${f('orb')} ${f('ast')} ${f('fga')} ${f('tpa')} ${f('blk')} ${f('stl')} ${f('fouls')} ${mean(at.map(mpg)).toFixed(1).padStart(5)}   ${mean(at.map(p => p.ratings.rebound)).toFixed(0)}`);
  }
  out.push('', '-- the spread from game to game (players with 25+ minutes a game): the share of their mean their games vary by');
  const starters = players.filter(p => mpg(p) >= 25);
  for (const key of ['pts', 'reb', 'ast']) out.push(`${key.padEnd(4)} ${(mean(starters.map(p => sd(p.games.map(g => g[key])) / Math.max(0.5, mean(p.games.map(g => g[key]))))) * 100).toFixed(0)}%`);
  out.push('', '-- extreme nights and foul trouble, per team-game');
  const games = players.flatMap(p => p.games), teamGames = checks.games * 2;
  const freq = (label, test) => out.push(`${label.padEnd(30)} ${(games.filter(test).length / teamGames).toFixed(3)}`);
  freq('40+ points', g => g.pts >= 40);
  freq('20+ rebounds', g => g.reb >= 20);
  freq('15+ assists', g => g.ast >= 15);
  freq('triple-doubles', g => [g.pts, g.reb, g.ast, g.stl, g.blk].filter(v => v >= 10).length >= 3);
  freq('0-for-8 or worse shooting', g => g.fga >= 8 && g.fgm === 0);
  freq('fouled out (6)', g => g.fouls >= 6);
  freq('5+ fouls', g => g.fouls >= 5);
  out.push('', '-- the scoring environment (per team-game)');
  const t = key => mean(teams.map(x => x[key])).toFixed(1);
  out.push(`points ${t('pts')} · FGA ${t('fga')} · FG% ${(100 * mean(teams.map(x => x.fgm / x.fga))).toFixed(1)} · 3PA ${t('tpa')} · 3P% ${(100 * mean(teams.map(x => x.tpm / Math.max(1, x.tpa)))).toFixed(1)} · FTA ${t('fta')} · TOV ${t('tov')} · REB ${t('reb')} · ORB ${t('orb')} · AST ${t('ast')}`);
  out.push(`offensive rebound % ${(100 * mean(teams.map(x => x.orb / Math.max(1, x.orb + (x.opp.reb - x.opp.orb))))).toFixed(1)}`);
  return out.join('\n');
}

// The players most unlike what they are: the best and worst rebounders for their position, side by side.
export function rebounders(players, n = 6) {
  const regulars = players.filter(p => mpg(p) >= 12).map(p => ({ ...p, rpg36: per36(p, 'reb') }));
  const out = ['name                      pos  role             reb  crash  mpg  reb/36  orb/36'];
  for (const p of [...regulars].sort((a, b) => b.ratings.rebound - a.ratings.rebound).filter((p, i, all) => i < n || i >= all.length - n)) {
    out.push(`${p.name.padEnd(26)}${p.position.padEnd(5)}${p.role.padEnd(17)}${String(p.ratings.rebound).padStart(3)}  ${p.tend.crash.toFixed(2)}  ${mpg(p).toFixed(1).padStart(4)}  ${p.rpg36.toFixed(1).padStart(6)}  ${per36(p, 'orb').toFixed(1).padStart(6)}`);
  }
  return out.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [engine = 'quick', games = '4', minutes = '12', save] = process.argv.slice(2);
  const started = Date.now(), data = collect(engine, Number(games), Number(minutes));
  if (save) writeFileSync(save, JSON.stringify(data));   // to compare the engines
  console.log(report(data));
  console.log('', '-- the highest and lowest rated rebounders');
  console.log(rebounders(data.players));
  console.log(`\n${((Date.now() - started) / 1000).toFixed(0)} s`);
}
