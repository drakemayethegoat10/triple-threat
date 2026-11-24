# Handoff log

Every agent that works on Triple Threat adds an entry here at the end of each task, newest first, so the next one
(another agent, or the same one after a break) knows what happened without the conversation. Keep each entry short:

- **Date, agent, branch** (and whether it is merged).
- **What changed**, in a few lines.
- **Gate numbers**: the suite, Arcade's band, Simulation's table, anything else measured.
- **Not verified, or left undone**, and anything that looked wrong.
- **Decisions the owner made** (their words where it matters), and any change to the rules in `AGENTS.md`.

---

## 2026-11-23 · Claude Code · `feat/garden-state-made` · awaiting merge

- **Garden State Made**, the owner's own team (the owner and friends), in Exhibition only: hand-written in
  `src/sim/guests.js` after the league (no id moves), kept out of MyLeague by `exhibition: true` and `clubIds()` in
  `teams.js`. Six players named by initial and surname: L. Pryor, G. Archundia, A. Madore, Z. Michael Jr. (wears "XX"),
  D. Tortu, P. Jones (sixth man). Coaches Z. Michael Sr. and D. Feaster are in the data, but nothing outside MyLeague
  shows a coach, so neither appears on screen.
- **Ratings.** Rated like league starters, six men playing every minute won 85% against the league, so the stars are
  92 and 91 and the others 80, 77, 77, 75. In 3D (6 games against each team) they won 64% Simulation / 68% Arcade at
  five a side, 54% / 56% at three a side; OKC won 47% in 3D Arcade. The fast engine has them at 74% / 92% five a side,
  but Exhibition never uses it.
- **The duo** (Pryor and Archundia): each looks for the other on a pass (`MOOD.duo.look`, which alone moved nothing
  measurable), a basket by one lifts the other, and with one on the ball the other takes the big's part in a play
  (`plays.js` cast: their two-man game). In 3D Simulation five a side, on the final code against the same team without
  the duo: baskets fed by each other 16% vs 13%, Pryor's dunks 3.7 vs 2.4 a game, wins 64% vs 54%. Three a side Arcade:
  19% vs 18%, no real difference. The broadcast marks a fed dunk, three or and-one as DYNAMIC DUO.
- **G. Archundia's post-up.** A point guard, he never went to the block, so the post fade the owner asked for did not
  happen. A per-player `lowPost` tendency (only he has it) sends him to the block off the ball: 27 shots a game, more of
  them close in, threes down to 1.0. His fadeaway is still rare (0.4 a game): the fade trails his best option by about
  0.6 expected points, mostly because a pass to a star is worth so much. A preference of +0.09 did nothing and was taken
  out. Making it common needs a change to how the fade is valued: an owner decision.
- **Kits, logo, gym.** The kit painter has data-driven splatter (spikes off the side seams and drops, in place of side
  panels), a two-line wordmark (GARDEN STATE over a slanted MADE) and New Jersey's outline behind the numbers. Home:
  white with red paint; road: red with white. The logo is cut from the owner's avatar screenshot
  (`tools/league/guest_logo.py`), soft at 512 px. The Garden State Gym: black apron with red paint flung across it,
  white centre circle with the logo, two banners that claim no titles.
- **Fixes on the way.** A surname keeps its suffix (Michael Jr., and the league's Carton Jr., which showed as "Jr.").
  A lettered number gets a face seed of its own (`numberSeed`).
- **Gates.** Every report matched `main` exactly on the same seeds (league and dev teams play as before): Arcade
  −3.7% / −3.0% / +0.8% (3v3 points, PPP, seconds) and −3.1% / −3.2% / −0.2% (5v5); Simulation 3D / fast per 48:
  96.9 / 100.6 possessions, 117.2 / 115.0 points, 34.6 / 36.3 threes; star usage 21.9–32.7%. `npm test` with the
  machine idle: 1,316 passed, 0 failed, 1 skipped, 1 to-do. The copy-timing test failed twice while other work ran,
  then passed alone three times on both checkouts at the same speed. Both builds passed.
- **Not verified.** Nobody has seen the team in a match on screen: the browser pane was hidden and the session not on
  screen. The real kit and floor painters were run on a real canvas in the page (no errors; about a fifth of each
  jersey is paint); the look of the kits on a body was only checked from an offline drawing of the same paint ops.
  The six stand in dev bodies until the owner sends a line per player (tone, hair, facial hair, build).
- **Owner decisions:** Exhibition only; contender; just the six; P. Jones sixth man; "XX" is Z. Michael Jr.'s real
  number; initial and surname everywhere in the code and on screen (the repository is public); own Jersey gym; red
  road kit with white paint; the owner will describe each player's look.

## 2026-11-18 · Codex · `codex/player-tracking-fouls` · awaiting merge

- Loose-ball fouls and illegal screens now have scoreboard labels, broadcast commentary and crowd foul reactions. The rules already emitted both calls and the HUD had no labels for them. The new HUD also gives an unknown call a generic whistle label.
- All 120 league players use their own measured shooting, drive, pass and minutes inputs in both engines. Data coverage is 114 from 2025–26, one from 2024–25 and five from an early 2026–27 snapshot. The source export, fallback choices and formulas are in [Player tracking profiles](PLAYER-TRACKING.md).
- Before and after standard reports matched. Arcade points/PPP/seconds were −3.7%/−3.0%/+0.8% at 3v3 and −3.1%/−3.2%/−0.2% at 5v5. Simulation 3D/fast per 48 were 96.9/100.6 possessions, 117.2/115.0 points, 87.3/88.6 FGA, 34.6/36.3 3PA, 24.6/23.6 FTA and 14.2/14.8 turnovers. Star usage was 21.9–32.7%. Twelve paired league-roster fixtures averaged 114.54/113.42 points per team before and 115.75/112.96 after.
- Both builds passed. The full suite returned 1,301 passes, zero failures, one speed skip and one existing TODO. Final focused checks included the additional tracking test and both foul labels. The isolated 10 ms quick-engine guard measured 11.88 ms on main and 11.15 ms on the branch. A live browser foul and physical Chromebook gameplay remain unverified.

## 2026-11-18 · Codex · `codex/myleague-views` · awaiting merge

- Rebuilt Roster with selectable player cards and 120 WebP portraits rendered from the existing Triple Threat GLBs. Schedule now uses selectable home, away and off days with contextual Play, Watch, Simulate and Simulate Through actions. League → Playoffs and the season archive show a connected bracket with seeds, series wins and the champion.
- Arcade 30-seed deviations (points, PPP, seconds) were −3.7%/−3.0%/+0.8% at 3v3 and −3.1%/−3.2%/−0.2% at 5v5. Simulation 3D/fast per 48 were 96.9/100.6 possessions, 117.2/115.0 points, 87.3/88.6 shots, 34.6/36.3 three attempts, 24.6/23.6 free throws attempted and 14.2/14.8 turnovers. These reports matched main. Star usage was 21.9–32.7%.
- Both builds passed. The two-worker full suite recorded 1,301 passes, zero failures, one speed skip and one existing TODO. Default parallel load tripped the replay-copy timing check, which passed alone. The 10 ms quick-engine guard skipped in the suite and missed when run alone on both main (10.28 ms) and the branch (10.36–11.32 ms).
- Firefox verified player selection and calendar simulation through the franchise controller, and layouts were inspected at 390 and 1280 px. A live 3D match started from the calendar and a physical Chromebook remain unverified.

## 2026-11-18 · Codex · `codex/dynamic-universe` · awaiting merge

- Milestone 2 adds saved player identities, age, potential, offseason skill development and coaching decisions. Roster exposes development, starters and the owner's Compete/Develop choice. League shows all twelve plans. Both engines use the franchise roster and coach. Existing saves and separate archives translate their statistical and rivalry keys.
- Three matched seeds over ten seasons each produced 3,031 dynamic fixtures and 3,037 fixed-roster fixtures. Across 30 titles the most successful team won seven versus nine, repeat titles were six versus five, and shooting was 46.84% versus 46.13%. All exported universes validated.
- Standard reports matched the baseline. Arcade points/PPP/seconds deviations were −3.7%/−3.0%/+0.8% (3v3) and −3.1%/−3.2%/−0.2% (5v5). Simulation 3D/fast per 48: 96.9/100.6 possessions, 117.2/115.0 points, 87.3/88.6 shots, 34.6/36.3 three attempts, 24.6/23.6 free throws attempted and 14.2/14.8 turnovers. Star usage 21.9–32.7%.
- Both builds passed. Full suite: 1,300 passed, zero failures, one timing check skipped under load (passed alone), one existing TODO. Firefox exercised franchise creation, changing priority, saving and reopening through the dialog. A physical Chromebook and a full browser match with a developed roster remain unverified.

## 2026-11-18 · Codex · `codex/franchise-scorers` · awaiting merge

- MyLeague accents use the managed club's primary color. The main menu omits the standalone Simulate and Teams choices. Exhibition team selection and franchise simulation remain available.
- Franchise receivers use their preferred shot range and defender position to attack the near paint, probe an elbow or create space along the arc. A regression test follows three players with different diets from the same catch. [Film notes and measured scoring shares](SCORER-READS.md).
- Against main, all four standard gate reports matched. Arcade deviations (points, PPP, seconds) were −3.7%, −3.0%, +0.8% at 3v3 and −3.1%, −3.2%, −0.2% at 5v5. Simulation 3D/fast per 48 were 96.9/100.6 possessions, 117.2/115.0 points, 87.3/88.6 shots, 34.6/36.3 threes attempted, 24.6/23.6 free throws attempted and 14.2/14.8 turnovers. Star usage was 21.9–32.7%.
- Twelve paired franchise fixtures, one per managed club, averaged 112.1 points per team on main and 114.5 on the branch in 3D, against 113.4 in the fast engine. Both builds passed. The suite had 1,298 passes, zero failures, one load-related speed skip (passed alone) and one existing TODO.
- Reviewed sampled footage from three videos. Visual feel in a live browser match and physical Chromebook performance remain unverified.

## 2026-11-17 · Codex · `codex/franchise-hub` · awaiting merge

- Rebuilt the franchise dashboard around the owner's blueprint. Six navigation tabs, weekly advancement, a three-story spotlight, team jersey graphic, matchup, standings, results and local fan reactions use the current save.
- Checked Firefox layouts at 1280 and 390 pixels wide. Both builds passed. Parallel test runs were interrupted under load. The full single-process run passed 1,298 tests with zero failures and one existing TODO.
- Arcade points/PPP/seconds deviations were −3.7%/−3.0%/+0.8% for 3v3 and −3.1%/−3.2%/−0.2% for 5v5. Simulation scored 117.2 points per 48 versus 115.0 fast, and star usage ranged from 21.9% to 32.7%.
- Physical Chromebook performance and a browser playthrough of the new controls remain unverified. Trades and free agency remain scheduled for the front-office milestone.

## 2026-11-17 · Codex · `codex/myleague` · awaiting merge

- **Milestone 1.** Create a named slot with any league team. Play, watch or simulate a seeded season, track standings and box scores, finish a best-of series and archive the year. Opponents alternate venues. Both engines share the fixture, final score, confidence and rivalries. Website simulation runs in a worker. IndexedDB keeps revisions, a recovery checkpoint and immutable season archives. [Architecture, defaults and roadmap](MYLEAGUE.md).
- **Gates.** `npm test` passed all 109 files. The detailed test run had 1,297 passes, zero failures, one speed skip and one existing calibration TODO. Both builds passed. Arcade over 30 seeds (points, PPP, seconds) was −3.7%, −3.0%, +0.8% at 3v3 and −3.1%, −3.2%, −0.2% at 5v5. Simulation per 48 (3D / fast) was 96.9/100.6 possessions, 117.2/115.0 points, 87.3/88.6 FGA, 34.6/36.3 3PA, 24.6/23.6 FTA and 14.2/14.8 turnovers. Star usage was 21.9–32.7%. All four balance reports matched the baseline checkout's figures on these seeds.
- **Timing.** The replay file failed under concurrent lab load, then passed all 14 tests alone. The quick-engine guard missed at 11.37 ms on main and 11.09 ms on the branch (12.16 ms when filtered). After profiling the rivalry keys, ratings and unused shot-meter work, it passed at 9.60 ms against 10 ms. Two hundred games matched main on score, RNG, player lines, moods, rivalries, period totals and possessions.
- **Franchise lab.** Across 100 ten-season universes, 101,346 games produced 12 different champions and 162 repeat titles. OKC won 378. Two 25-season universes added 5,074 games. The largest export was 1,413,581 bytes. All saves validated. These runs use three-minute quarters, 14 games per club and the original rosters.
- **Verification limits.** A road fixture reached the final in the headless 3D engine. The worker matched the local engine. The storage adapter passed injected failure and stale-writer tests. Local browser access was declined, leaving visual play, native IndexedDB, controller input and Chromebook frame times unverified.
- **Owner decisions.** Review and merge each playable milestone separately. For players changing clubs, keep faces and generate matching kits.

## 2026-11-17 · Claude Code · `chore/codex-handoff`

Handing over to Codex until the owner's Claude limit resets (Friday).

- **State of `main`:** the overhaul's stages 1-4 are merged and live (see `AGENTS.md`, "Where things stand"); the last
  merge is f7136f3 (stage 4, the broadcast's close-ups).
- **Added for the handoff:** `AGENTS.md` (the rules and the state), this log, `CLAUDE.md` (points Claude Code here),
  and `tools/sim/gates/` (the scripts behind the balance tests).
- **Gates at the last merge:** the full suite passed (1,288 of 1,290; one skipped as the machine was busy, one to
  do), in about 80 s. Arcade over 30 seeds: 3 on 3 points -3.7%, 5 on 5 -3.1% against the baseline (limit 10%).
  Simulation's 3D game: 117.2 points, 34.6 threes a game (targets 116 and 37, limit 15%); the fast engine agrees.
- **Not verified:** nobody has played a match with a controller since stage 1; a scorer's close-up (stage 4) was
  seen only in headless matches, not in the browser.
- **Next, the owner's choice:** MyLeague (franchise mode), from the owner's own brief; then stage 5, the Chromebook
  performance pass.
