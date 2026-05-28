
import { createRun, applyCardChoice, updateRun } from '../web/src/game_core.mjs';

function simulateAutoRun(seed, maxTicks = 8000) {
  const run = createRun(seed);
  const dt = 0.05;
  let ticks = 0;
  while (!['gameover', 'victory'].includes(run.state) && ticks < maxTicks) {
    if (run.state === 'wave_transition') {
      run.waveTransitionTimer = 0;
      updateRun(run, { x: 0, y: 0 }, 0.001);
    }
    if (run.state === 'reward') {
      applyCardChoice(run, run.rewardChoices[0]);
      if (run.state === 'wave_transition') {
        run.waveTransitionTimer = 0;
        updateRun(run, { x: 0, y: 0 }, 0.001);
      }
    }
    updateRun(run, { x: 0, y: 0 }, dt);
    ticks += 1;
  }
  return run;
}

const results = [];
for (let seed = 0; seed < 60; seed++) {
  const run = simulateAutoRun(seed);
  results.push({ seed, wave: run.wave, state: run.state });
}

const waves = results.map(r => r.wave);
const avg = (waves.reduce((a,b) => a+b, 0) / waves.length).toFixed(2);
const best = Math.max(...waves);
const worst = Math.min(...waves);
const dist = {};
for (const w of waves) dist[w] = (dist[w] || 0) + 1;

const wave5fails = results.filter(r => r.wave === 5).map(r => r.seed);

console.log(JSON.stringify({ avgWave: +avg, best, worst, dist, wave5failSeeds: wave5fails }, null, 2));
