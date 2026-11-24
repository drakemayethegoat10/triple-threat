# Triple Threat: instructions for coding agents

Triple Threat is a basketball game for the browser: three on three or five on five, in 3D with Three.js, played on a
website on GitHub Pages (https://drakemayethegoat10.github.io/triple-threat/) from a school Chromebook and a home
computer. It has two styles, Arcade and Simulation; a 3D match you play or watch; and Simulate, a fast engine that
plays a whole match in a second with no picture. The league is twelve parody teams of ten players each (plus two dev
teams), each with its own arena, kits and built 3D players. Garden State Made, the owner's own team (the owner and
friends, six players), plays in Exhibition only, never in MyLeague.

This file is the project's rules and its state, written for whichever agent works on it next (Claude Code wrote it on
2026-11-17 to hand over to Codex for a while). Read it first, then the newest entries of `docs/HANDOFF.md`.

## Running it

```bash
npm test                 # every test (node --test); about 80-120 s on the owner's machine
npm start                # serves the game at http://localhost:5173 (python3 http.server); open index.html there
npm run site             # builds dist/site, the website (GitHub Actions does this on every push to main)
npm run single           # builds dist/triple-threat.html, the one-file game (it leaves out the league's players)
```

Node is the only runtime; the one dependency is `three` 0.187.0. There is no bundler: the browser loads the ES modules
in `src/` as they are. No TypeScript. Add no dependency without asking the owner.

`tools/blender/` builds the 3D players and the motions with Blender 4.5 (`blender-4.5`); `assets/source/README.md`
says how. The motion clips from Mixamo are not in the repository (only on the owner's machine), so a motion rebuild
works only there. Prefer work that needs no rebuild of `assets/`.

## The map

- `src/sim/`: the match itself, no Three.js. `state.js` (the match state: plain data), `step.js` (one 1/60 s step),
  `rules.js` (whistles, fouls, clocks, inbounds), `players.js` (movement, shots, passes), `ai.js` (the computer's
  players), `offball.js`, `plays.js`, `matchups.js`, `coach.js`, `late.js` (the end of a game), `mood.js`
  (personalities, confidence, rivalries), `together.js` (the team's moments between plays), `shooting.js`,
  `fouls.js`, `freethrow.js`, `stats.js`, `teams.js` and `league.js` (the teams and players, generated: see
  `tools/league/`), `guests.js` (the teams that play in Exhibition only, written by hand), `tuning.js` (every number),
  `styles.js` (Arcade and Simulation).
- `src/sim/quick/`: the fast engine (Simulate): a match possession by possession with the same rules, coach, ratings,
  shot model and box score, and no positions.
- `src/render/`: the picture: the arena, the players and their motions (`people.js`, `animator.js`, `motion.js`), the
  crowd (`fans.js`, `crowd.js`), the HUD (`hud.js`), the camera (`framing.js`, `scene.js`), the quality levels
  (`quality.js`). `motion.js`, `life.js` and `checks.js` are logic with no Three.js, tested in Node.
- `src/broadcast/`: what the broadcast shows and says, from what happens: big moments (`moments.js`), banners and
  panels (`director.js`), commentary, the players' reactions (`reactions.js`) and the close-ups (`cinema.js`).
- `src/main.js` (the page's loop), `menu.js`, `pause.js`, `playlist.js`, `tutorial.js`, `replay.js`, `prefs.js`.
- `tests/`: one file per area. `tests/watch.js` plays 3D matches headless in worker threads; `tests/fixtures/` pins
  the Arcade numbers and baseline.
- `tools/sim/`: measuring tools (`measure.mjs`, `audit.mjs`) and `gates/`, the scripts behind the balance tests (see
  `tools/sim/README.md`). `tools/site.mjs`, `tools/single-file.mjs`: the two builds. `tools/league/`: the league's data
  and player models from the owner's files.
- `docs/superpowers/`: the design specs and plans of past work, by date.

## How the code works (what trips people up)

- **Two styles.** A rule or number that differs between Arcade and Simulation is read with `styled(state, key)`; a new
  key needs an entry in `KINDS`, `ARCADE` and `SIM` in `src/sim/styles.js`. Everything else is in `tuning.js`.
- **Arcade's numbers are pinned.** `tests/fixtures/arcade-tuning.json` holds every export of `tuning.js`; a change
  to any number must update only that entry there, with a line in the comment above the test in
  `tests/arcade.test.js` saying what changed and why. Adding a new entry is the same.
- **Two engines, one game.** The 3D game and the fast engine must agree on Simulation (`tests/simplay.test.js`): a
  change to the 3D game's basketball may need the fast engine to follow (`src/sim/quick/`), and the reverse.
- **Outcomes come from play.** No result is set directly: scores, shares and stats come out of the players'
  decisions, the ratings and the dice (`rand(state)`, seeded: the same seed plays the same game).
- **The one-file build needs the imports to form a tree**: no import cycles (`tests/single-file.test.js`). The sim
  must not import the renderer.
- **The match state stays plain data** (numbers, strings, arrays, plain objects), so it can be copied for replays
  (`replay.js`) and saved later (MyLeague, below).
- **Comments** say in plain English what the code does and why, in full sentences, as the existing ones do. Match
  the surrounding style; keep functions small and named for what they do.

## The owner's rules

1. **Branches.** Work on a feature branch (yours: `codex/<what>`), never on `main`. Push the branch. One agent on a
   branch at a time.
2. **Merging only when the owner says "Merge".** Then `git merge --no-ff` into `main` with a message saying what the
   branch did, push `main`, wait for the Pages deploy (`gh run watch <id> --exit-status`), and check the live site
   loads (all its players, no console errors).
3. **Commits.** Stage files by name (never `git add -A` or `git add .`). The author is
   `208887162+drakemayethegoat10@users.noreply.github.com` (already the repository's `user.email`). The owner's own
   email address must never appear in a commit, a file or a message: check `git log origin/main..HEAD --format=%ae`
   before pushing. Commit messages say what changed and why, in plain English.
4. **No real NBA names, logos, wordmarks or likenesses** in the game or the repository. The league is the owner's
   parody teams. Players' faces are generated, never modelled on real people or photos; photos the owner sends are
   reference only. Keep Nike and NBA marks off the kits.
5. **The gates** (below) hold for every change. Never weaken a test to make it pass. When a test is fragile, fix
   its cause rather than raise its sample or loosen its limit. Report every result honestly, including the ones
   that missed.
6. **Ask before** anything the owner has not asked for that changes the game's feel, a big scope decision, a new
   dependency, or anything outward-facing. The owner answers questions with short choices.
7. **Finish every task** with: what changed, the gate numbers, what was skipped or not verified, and one question
   with its choices (usually "Merge or Not yet?"). Then add an entry to `docs/HANDOFF.md`.

## The gates

| What | Where it is asserted | How to measure it |
|---|---|---|
| Every test passes | `npm test` | (a timing test, "a copy of the match takes well under a millisecond", can fail on a busy machine: rerun it alone) |
| Arcade within 10% of its baseline in points, points per possession, seconds a possession | `tests/arcade.test.js` (seeds 1-10) | `node tools/sim/gates/arcade-band.mjs 30` |
| Simulation within 15% of the 2025-26 averages | `tests/simplay.test.js` | `node tools/sim/gates/sim-table.mjs 16` |
| The 3D game and the fast engine agree | `tests/simplay.test.js` | `sim-table.mjs` beside `fast-table.mjs` |
| The fast engine's own calibration | `tests/calibration.test.js` | `fast-table.mjs` |
| Stars use over 20% of their team's plays | `tests/simplay.test.js` | `star-usage.mjs` |
| Feet do not glide; each team plays to its identity | `tests/glide.test.js`, `tests/identity.test.js` | |

Measure before and after a change on the same machine at the same time (`ROOT=<other checkout>`): the machine's
speed and the dice both move numbers.

## Where things stand (2026-11-17)

- The **overhaul** asked for by the owner ("inspired by NBA 2K and classic basketball games") has five stages; four are
  merged and live: 1 personalities, moods and rivalries; 2 a smarter AI (last shots, mismatches, screens away from
  the ball, a point guard, varied plays, handoffs and flares); 3 animations (celebrations, frustration, high-fives,
  helping a man up, timeout huddles, a cheering bench, a smoother blend); 4 the broadcast's close-ups in dead time.
  The owner's rules for it: both styles get the smarter AI (Arcade kept in its band); cinematics only in dead time,
  and any key skips them; players celebrate big plays only.
- **Stage 5, a Chromebook performance pass, is not started.** The Low and Medium quality levels are for the
  Chromebook; frame time is what matters there.
- **Known thin margins:** one star (a rim protector) sits at 20.1% usage against the 20% line on the test's seeds;
  5-a-side Arcade's numbers move several points between seed sets.

## MyLeague (franchise mode): the owner's next big feature

The owner has a written brief for it, which they will give you. What is already settled:

- The owner calls it **"MyLeague"**.
- Rivalries and confidence (`mood.js`: each person's `traits` and `mood`, the match's `rivals`) reset each match
  today on purpose; in MyLeague they carry between games. The match state was kept plain data for this.
- A season's games that the player does not play can be played by the fast engine (`quickMatch` in
  `src/sim/quick/engine.js`: a seeded match in about a second, with a full box score), which is already calibrated
  to the same numbers as the 3D game.
- Teams and players come from `src/sim/league.js` (generated by `tools/league/import.mjs`); a team's identity
  (names, colours, logo, arena, kits) must come from the team, never from its index 0 or 1. MyLeague's teams are
  `clubIds()` in `teams.js`: never a dev team or a guest (`exhibition: true`, from `guests.js`).
- Nothing saves today: MyLeague will be the first save (the browser's storage). Keep saves small and versioned.

## Testing in the browser

`npm start`, then open http://localhost:5173. `game` is a global (its `state` is the match); sim modules can be
imported from the console (`await import('/src/sim/rules.js')`) to put a match in a situation. The browser caches
modules and assets hard: after a change, reload each changed file with `fetch(path, { cache: 'reload' })` before
reloading the page. Opening the site with `#dev` on the link shows the two dev teams.
