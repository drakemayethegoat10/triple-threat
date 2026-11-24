import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMMENTARY, LINES, RANK, createBooth, lineFor, nextCommentary, quietLine, rankOf, say, secondsFor } from '../src/broadcast/commentary.js';
import { KINDS, createWatch, watchStep } from '../src/broadcast/moments.js';
import { createBroadcast } from '../src/broadcast/broadcast.js';
import { createVoice } from '../src/broadcast/voice.js';
import { createMatch } from '../src/sim/state.js';
import { startMatch } from '../src/sim/rules.js';
import { step } from '../src/sim/step.js';
import { aiIntents } from '../src/sim/ai.js';
import { DT, ROSTER } from '../src/sim/tuning.js';

const h = (kind, more = {}) => ({ kind, moment: KINDS.includes(kind), star: false, rank: 14, team: 0, row: 0, name: 'Cross', at: 0, ...more });
// One of every happening the watcher can return, with what each carries.
const SAMPLES = [
  h('tip', { row: null, name: null }), h('play', { row: null, name: null, play: 'Horns' }), h('made', { points: 2, assist: null }),
  h('made', { points: 2, assist: 'Marsh' }), h('made', { points: 3, assist: null }), h('miss'), h('rebound', { own: false }), h('rebound', { own: true }),
  h('steal'), h('foul', { row: null, name: null, what: 'shooting', fouler: 'Mercer', shots: 2 }), h('foul', { row: null, name: null, what: 'reach', fouler: null, shots: 0 }),
  h('violation', { row: null, name: null, what: 'travel' }), h('violation', { row: null, name: null, what: 'shotClock' }), h('out', { row: null, name: null, what: 'out' }),
  h('timeout', { row: null, name: null, left: [2, 3] }), h('freeThrow', { shots: 2 }), h('sub', { off: 'Marsh' }),
  h('periodEnd', { team: null, row: null, name: null, quarter: 1, final: false, score: [12, 10] }),
  h('periodEnd', { team: null, row: null, name: null, quarter: 2, final: false, score: [22, 22] }),
  h('periodEnd', { team: null, row: null, name: null, quarter: 4, final: false, score: [50, 50] }),
  h('periodEnd', { team: null, row: null, name: null, quarter: 4, final: true, score: [58, 61] }),
  ...KINDS.map(kind => h(kind, kind === 'run' ? { n: 12, row: null, name: null } : kind === 'comeback' ? { row: null, name: null } : kind === 'block' ? { chase: false } : kind === 'duo' ? { off: 'Marsh' } : {})),
  h('block', { chase: true }),
];

test('every kind has at least two wordings, most three', () => {
  for (const [key, list] of Object.entries(LINES)) {
    assert.ok(list.length >= 2, key);
    assert.equal(new Set(list).size, list.length, `${key} repeats a wording`);
  }
  assert.ok(Object.values(LINES).filter(list => list.length >= 3).length >= Object.keys(LINES).length - 6);
});

test('every happening gets a line with every word filled in, whichever wording comes up', () => {
  const s = createMatch(), booth = createBooth();
  for (const sample of SAMPLES) for (let i = 0; i < 4; i++) {
    const text = lineFor(booth, sample, s);
    assert.ok(text.length > 4 && !/[{}]/.test(text) && !/undefined|null/.test(text) && !/ {2}|^ | [,.!]/.test(text), `${sample.kind}: "${text}"`);
  }
});

test('the lines name only the game\'s own players and teams', () => {
  const allowed = new Set([...ROSTER.names.flat().flatMap(name => name.split(' ')), 'Waves', 'Scorpions', 'Horns']);
  const s = createMatch(), booth = createBooth();
  // Any capitalised word that is not the first of its sentence must be one of the game's names.
  for (const sample of SAMPLES) for (let i = 0; i < 4; i++) {
    const text = lineFor(booth, sample, s);
    for (const [, word] of text.matchAll(/(?<![.!?:] |^)\b([A-Z][a-z]+)\b/g)) assert.ok(allowed.has(word), `"${word}" in "${text}"`);
  }
});

test('the same wording is never used twice running for one kind', () => {
  const s = createMatch(), booth = createBooth();
  let last = null;
  for (let i = 0; i < 20; i++) {
    const text = lineFor(booth, h('miss'), s);
    assert.notEqual(text, last);
    last = text;
  }
});

test('the score is read out with the team ahead first, or as level', () => {
  const s = createMatch(), booth = createBooth();
  assert.match(lineFor(booth, h('periodEnd', { quarter: 1, final: false, score: [12, 10] }), s), /Waves 12, Scorpions 10/);
  assert.match(lineFor(booth, h('periodEnd', { quarter: 4, final: true, score: [58, 61] }), s), /Scorpions 61, Waves 58/);
  assert.match(lineFor(booth, h('periodEnd', { quarter: 4, final: false, score: [50, 50] }), s), /overtime.*50 all/i);
  assert.match(lineFor(booth, h('periodEnd', { quarter: 2, final: false, score: [22, 20] }), s), /[Hh]alf/);
});

test('how much a line matters: stars over moments over whistles over baskets over the rest', () => {
  assert.equal(rankOf(h('block', { star: true, moment: true })), RANK.star);
  assert.equal(rankOf(h('deep')), RANK.moment);
  assert.equal(rankOf(h('foul')), RANK.call);
  assert.equal(rankOf(h('made')), RANK.score);
  assert.equal(rankOf(h('rebound')), RANK.plain);
});

test('a line is dropped while one as big is being said, and a bigger one cuts in', () => {
  const booth = createBooth();
  assert.equal(say(booth, 'Cross scores.', RANK.score, 10), 'Cross scores.');
  assert.equal(say(booth, 'Rebound, Stone.', RANK.plain, 10.5), null);
  assert.equal(say(booth, 'Marsh scores.', RANK.score, 10.5), null);
  assert.equal(say(booth, 'Blocked by Stone!', RANK.star, 10.6), 'Blocked by Stone!');
  assert.equal(say(booth, 'Travelling.', RANK.call, 10.7), null);
  assert.equal(say(booth, 'Rebound, Stone.', RANK.plain, 10.6 + secondsFor('Blocked by Stone!') + 0.01), 'Rebound, Stone.');
});

test('a short line takes 1.6 s to say and no line more than 5', () => {
  assert.equal(secondsFor('Good!'), 1.6);
  assert.equal(secondsFor('x'.repeat(200)), 5);
  assert.ok(Math.abs(secondsFor('x'.repeat(40)) - 2.6) < 1e-9);
});

test('a number is offered only at a stoppage after six quiet seconds, and only when there is one worth saying', () => {
  const s = createMatch(), booth = createBooth();
  s.phase = 'dead';
  assert.equal(quietLine(booth, s, 10), null);                         // nobody has scored
  s.rosters[1][0].stats.pts = 14;
  assert.match(quietLine(booth, s, 20), /Mercer.*14|14.*Mercer/);
  assert.equal(quietLine(booth, s, 22), null);                         // two seconds later
  s.phase = 'live';
  assert.equal(quietLine(booth, s, 40), null);
});

test('the setting goes round voice, captions, off; without a voice, captions and off', () => {
  assert.deepEqual(COMMENTARY, ['voice', 'captions', 'off']);
  assert.deepEqual(['voice', 'captions', 'off'].map(v => nextCommentary(v, true)), ['captions', 'off', 'voice']);
  assert.deepEqual(['voice', 'captions', 'off'].map(v => nextCommentary(v, false)), ['captions', 'off', 'captions']);
});

// ---------- the voice ----------

const fakeSynth = voices => ({ said: [], cancelled: 0, getVoices: () => voices, speak(line) { this.said.push(line); }, cancel() { this.cancelled++; } });
function Line(text) { this.text = text; }

test('the voice is an English one if there is one, speaks a little fast, and each line replaces the last', () => {
  const synth = fakeSynth([{ lang: 'fr-FR', name: 'f' }, { lang: 'en-GB', name: 'a' }]), voice = createVoice(synth, Line);
  assert.equal(voice.available, true);
  voice.speak('Cross scores.');
  assert.deepEqual([synth.said.length, synth.said[0].text, synth.said[0].voice.name, synth.said[0].rate, synth.cancelled], [1, 'Cross scores.', 'a', 1.15, 1]);
  voice.stop();
  assert.equal(synth.cancelled, 2);
});

test('with no voices listed it still speaks, with the device\'s default', () => {
  const synth = fakeSynth([]), voice = createVoice(synth, Line);
  voice.speak('Good.');
  assert.deepEqual([voice.available, synth.said.length, synth.said[0].voice], [true, 1, undefined]);
});

test('where the browser has no voice nothing is said and nothing throws', () => {
  for (const voice of [createVoice(undefined, undefined), createVoice({}, Line), createVoice(fakeSynth([]), undefined)]) {
    assert.equal(voice.available, false);
    voice.speak('Good.'); voice.stop();
  }
  const broken = createVoice({ speak() { throw new Error('no'); }, cancel() { throw new Error('no'); }, getVoices: () => [] }, Line);
  broken.speak('Good.'); broken.stop();
});

// ---------- the whole broadcast ----------

const quiet = () => ({ available: true, said: [], stops: 0, speak(text) { this.said.push(text); }, stop() { this.stops++; } });
// A computer match with the broadcast listening, a frame every step. Returns the captions shown, in order.
function aired(commentary, voice = quiet(), seed = 1, seconds = 240) {   // a match in which a rebound is called as well as baskets
  const s = createMatch(seed, 3), air = createBroadcast(voice), captions = [];
  startMatch(s);
  let last = null;
  for (let t = 0; t < seconds && s.phase !== 'final'; t += DT) {
    air.hear(s, step(s, aiIntents(s, DT), DT));
    const shown = air.frame(s, t, commentary);
    if (shown.caption && shown.caption !== last) captions.push(shown.caption);
    last = shown.caption;
  }
  return { captions, voice, state: s };
}

test('through a match the commentator calls it in captions and the voice says each one once', () => {
  const { captions, voice } = aired('voice');
  assert.ok(captions.length > 25, `${captions.length} captions`);
  for (const text of captions) assert.ok(!/[{}]|undefined|null/.test(text), text);
  assert.deepEqual(voice.said, captions);
  assert.ok(captions.some(text => /scores|two|three/i.test(text)));
  // A rebound is called when nothing bigger is being said: in one of a few matches at least, whichever way they go.
  assert.ok([1, 2, 3, 4].some(seed => aired('captions', quiet(), seed).captions.some(text => /[Rr]ebound|glass|board/.test(text))), 'no rebound was called in four matches');
  for (let i = 1; i < captions.length; i++) assert.notEqual(captions[i], captions[i - 1]);
});

test('on captions only the voice says nothing; on off there is no caption either', () => {
  const only = aired('captions');
  assert.ok(only.captions.length > 25);
  assert.equal(only.voice.said.length, 0);
  const off = aired('off');
  assert.deepEqual([off.captions.length, off.voice.said.length], [0, 0]);
});

test('the commentator changes nothing in the match', () => {
  const a = aired('voice', quiet(), 5, 120).state, b = createMatch(5, 3);
  startMatch(b);
  for (let t = 0; t < 120 && b.phase !== 'final'; t += DT) step(b, aiIntents(b, DT), DT);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('a new match starts the broadcast afresh: nothing of the last one is said or shown', () => {
  const voice = quiet(), air = createBroadcast(voice), s = createMatch(1, 3);
  startMatch(s); s.phase = 'live';
  air.hear(s, null);
  s.last.block = { by: 4, on: 0, at: 1, chase: false };
  air.hear(s, null);
  assert.equal(air.frame(s, 1, 'voice').banner.words, 'BLOCKED');
  const next = createMatch(2, 3);
  const shown = air.frame(next, 1.1, 'voice');
  assert.deepEqual([shown.banner, shown.caption, shown.lower], [null, null, null]);
  assert.ok(voice.stops >= 1);
});

test('a dunk and a layup are called as what they were, with the scorer named', () => {
  const s = createMatch(), booth = createBooth();
  const made = finish => ({ kind: 'made', team: 0, name: 'Cross', points: 2, assist: null, finish });
  for (let i = 0; i < 4; i++) {
    const dunk = lineFor(booth, made('dunk'), s), layup = lineFor(booth, made('layup'), s);
    assert.ok(LINES.dunk.some(line => line.replace('{name}', 'Cross') === dunk), dunk);
    assert.ok(LINES.layup.some(line => line.replace('{name}', 'Cross') === layup), layup);
    assert.ok(!/[{}]/.test(dunk + layup));
  }
  assert.ok(LINES.made2.some(line => line.replace('{name}', 'Cross') === lineFor(booth, made(null), s)));
  assert.equal(LINES.dunk.length, 3); assert.equal(LINES.layup.length, 3);
  assert.equal(rankOf(made('dunk')), rankOf(made(null)));                 // an ordinary basket's rank
});

test('a windmill is called a windmill', () => {
  const s = createMatch(), booth = createBooth();
  const line = lineFor(booth, { kind: 'made', team: 0, name: 'Cross', points: 2, assist: null, finish: 'dunk', flair: 'windmill' }, s);
  assert.ok(LINES.windmill.some(text => text.replace('{name}', 'Cross') === line), line);
  assert.equal(LINES.windmill.length, 3);
});
