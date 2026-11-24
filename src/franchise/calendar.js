// Franchise saves use the league's permanent team keys. Only the match adapter needs their renderer indices.
import { TEAMS, clubIds } from '../sim/teams.js';
import { rand } from '../sim/state.js';

export const clubs = Object.fromEntries(clubIds().map(i => [TEAMS[i].key, TEAMS[i]]));
export const lengths = [14, 28, 56, 82];
export const nextSeed = rng => Math.floor(rand(rng) * 4294967296);

export function schedule(seed, games) {
  const rng = { seed }, ring = Object.keys(clubs);
  for (let i = ring.length - 1; i > 0; i--) {
    const j = Math.floor(rand(rng) * (i + 1));
    [ring[i], ring[j]] = [ring[j], ring[i]];
  }
  const rounds = [];
  for (let r = 0; r < ring.length - 1; r++) {
    rounds.push(ring.slice(0, ring.length / 2).map((a, i) => [a, ring.at(-1 - i)]));
    ring.splice(1, 0, ring.pop());
  }
  // Each block visits every opponent before repeating one.
  const fixtures = [];
  let day = 1;
  for (let r = 0; r < games; r++) {
    for (const [home, away] of rounds[r % rounds.length]) {
      fixtures.push({ id: fixtures.length, day, home, away, seed: nextSeed(rng) });
    }
    day += rand(rng) < 0.22 ? 1 : 2;
  }
  // Alternate venues for every pair. Pairs meeting an odd number of times have one extra home date
  // to assign. Each club plays an even season, so these leftover edges form closed walks. Orienting
  // each walk gives every club as many extra road dates as home dates.
  const meetings = new Map(), edges = new Map(ring.map(k => [k, []]));
  for (const f of fixtures) {
    const pair = [f.home, f.away].sort().join('|');
    if (!meetings.has(pair)) meetings.set(pair, []);
    meetings.get(pair).push(f);
  }
  for (const series of meetings.values()) {
    const f = series[0];
    if (series.length % 2) {
      edges.get(f.home).push(f);
      edges.get(f.away).push(f);
    } else if (f.seed % 2) [f.home, f.away] = [f.away, f.home];
  }
  const used = new Set();
  for (const start of ring) {
    let at = start;
    while (edges.get(at).length) {
      const f = edges.get(at).pop();
      if (used.has(f.id)) continue;
      used.add(f.id);
      if (f.home !== at) [f.home, f.away] = [f.away, f.home];
      at = f.away;
    }
  }
  for (const series of meetings.values()) {
    const { home, away } = series[0];
    series.forEach((f, i) => { f.home = i % 2 ? away : home; f.away = i % 2 ? home : away; });
  }
  return fixtures;
}

export function standings(season) {
  const table = Object.fromEntries(Object.keys(clubs).map(key => [key, { key, w: 0, l: 0, diff: 0, pts: 0, streak: 0 }]));
  for (const { home, away, score, series } of season.fixtures) {
    if (!score || series !== undefined) continue;
    [home, away].forEach((key, side) => {
      const t = table[key], diff = score[side] - score[1 - side], sign = Math.sign(diff);
      t[diff > 0 ? 'w' : 'l']++;
      t.diff += diff;
      t.pts += score[side];
      t.streak = Math.sign(t.streak) === sign ? t.streak + sign : sign;
    });
  }
  const winRate = t => t.w / (t.w + t.l || 1);
  return Object.values(table).sort((a, b) => winRate(b) - winRate(a) || b.w - a.w || b.diff - a.diff || b.pts - a.pts || a.key.localeCompare(b.key));
}

// Schedule one game per live series per date. Winners reach the next round together.
export function advanceBracket(season, bestOf) {
  if (season.cursor !== season.fixtures.length || season.champion) return;
  const order = standings(season).map(row => row.key);
  let series = season.series.filter(s => s.round === season.round);
  const winsNeeded = (bestOf + 1) / 2;
  const alive = series.filter(s => Math.max(...s.wins) < winsNeeded);
  if (alive.length) series = alive;
  else {
    let pairs;
    if (!series.length) {
      pairs = ['East', 'West'].flatMap(conf => {
        const seeds = order.filter(k => clubs[k].conference === conf);
        return [[seeds[0], seeds[3]], [seeds[1], seeds[2]]];
      });
    } else {
      const winners = series.map(s => s.teams[s.wins.indexOf(winsNeeded)]);
      if (winners.length === 1) { season.champion = winners[0]; return; }
      pairs = winners.filter((_, i) => i % 2 === 0).map((a, i) => [a, winners[i * 2 + 1]]);
    }
    season.round++;
    series = pairs.map(teams => {
      teams.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      const s = { id: season.series.length, round: season.round, teams, wins: [0, 0] };
      season.series.push(s);
      return s;
    });
  }
  const day = season.fixtures.at(-1).day + 2;
  for (const s of series) {
    const side = (s.wins[0] + s.wins[1]) % 2;
    season.fixtures.push({ id: season.fixtures.length, series: s.id, day, home: s.teams[side], away: s.teams[1 - side], seed: nextSeed(season) });
  }
}
