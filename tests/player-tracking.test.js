import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TEAMS, clubIds } from '../src/sim/teams.js';
import { PLAYER_TRACKING } from '../src/sim/player-tracking.js';
import { createMatch } from '../src/sim/state.js';
import { tendenciesOf } from '../src/sim/tendencies.js';
import { rotationPlan } from '../src/sim/roster.js';

test('all league players feed their own measured shot mix, drives, passing and minutes into the shared match state', () => {
  const tracked = new Set();
  for (const id of clubIds()) {
    const team = TEAMS[id], state = createMatch(1, 5, [id, 0]);
    const plan = rotationPlan(state, 0);
    assert.ok(Math.abs(plan.reduce((total, seconds) => total + seconds, 0) - 20 * state.quarterLength) < 1e-8);
    team.players.forEach((player, row) => {
      const key = team.key + '/' + player.number, profile = PLAYER_TRACKING[key], person = state.rosters[0][row];
      tracked.add(key);
      assert.ok(profile.attempts > 0 && profile.trackedMinutes > 0);
      assert.equal(person.rotationMinutes, profile.minutes);
      const prior = tendenciesOf(person);
      assert.notDeepEqual(person.tend.diet, prior.diet);
      assert.ok(Math.abs(Object.values(person.tend.diet).reduce((a,b) => a + b, 0) - 1) < 1e-8);
      assert.ok(Math.abs(person.tend.drive - profile.drives36 / 25) <= Math.abs(prior.drive - profile.drives36 / 25));
      assert.ok(Math.abs(person.tend.passFirst - profile.pass) <= Math.abs(prior.passFirst - profile.pass));
    });
  }
  assert.deepEqual([...tracked].sort(), Object.keys(PLAYER_TRACKING).sort());
  const dev = createMatch().rosters[0][0];
  assert.deepEqual(dev.tend, tendenciesOf(dev));
  assert.equal(dev.rotationMinutes, undefined);
});
