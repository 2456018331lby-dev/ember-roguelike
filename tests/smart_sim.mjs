
import { createRun, applyCardChoice, updateRun, getPlayerStats } from '../web/src/game_core.mjs';

function simulateAutoRun(seed, maxTicks = 10000) {
  const run = createRun(seed);
  const dt = 0.05;
  let ticks = 0;
  while (!['gameover', 'victory'].includes(run.state) && ticks < maxTicks) {
    if (run.state === 'wave_transition') {
      run.waveTransitionTimer = 0;
      updateRun(run, { x: 0, y: 0 }, 0.001);
    }
    if (run.state === 'reward') {
      // Smart pick: if boss next, prefer survival; if already tanky, prefer attack
      const choices = run.rewardChoices || [];
      const analysis = run.buildAnalysis || {};
      const weaknesses = analysis.weaknesses || {};
      const nextPreview = run.nextWavePreview;
      const isBossNext = nextPreview?.kind === 'boss';
      
      // Pick best card based on context
      let bestIdx = 0;
      if (choices.length > 1) {
        // If boss next and low HP, pick highest survival score
        const stats = getPlayerStats(run);
        const hpRatio = run.player.hp / Math.max(1, stats.maxHp);
        if (isBossNext && hpRatio < 0.6) {
          // Find the best survival card
          for (let i = 1; i < choices.length; i++) {
            const c = choices[i];
            const isSurv = c.armorBonus > 0 || c.dodgeChance > 0 || c.regen > 0 || c.lifesteal > 0 || c.barrier > 0 || c.reflect > 0 || c.revive;
            const bestC = choices[bestIdx];
            const bestIsSurv = bestC.armorBonus > 0 || bestC.dodgeChance > 0 || bestC.regen > 0 || bestC.lifesteal > 0 || bestC.barrier > 0 || bestC.reflect > 0 || bestC.revive;
            if (isSurv && !bestIsSurv) bestIdx = i;
          }
        }
      }
      applyCardChoice(run, choices[bestIdx] || choices[0]);
      if (run.state === 'wave_transition') {
        run.waveTransitionTimer = 0;
        updateRun(run, { x: 0, y: 0 }, 0.001);
      }
    }
    
    // Smarter input: move toward nearest enemy to kill faster
    let input = { x: 0, y: 0 };
    if (run.enemies.length > 0 && run.state === 'playing') {
      let nearest = null, nearestDist = Infinity;
      for (const e of run.enemies) {
        const d = Math.hypot(e.x - run.player.x, e.y - run.player.y);
        if (d < nearestDist) { nearestDist = d; nearest = e; }
      }
      if (nearest) {
        // If boss, try to stay at medium range; if minion, chase
        if (nearest.isBoss) {
          const idealDist = 200;
          const dx = nearest.x - run.player.x;
          const dy = nearest.y - run.player.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist > idealDist + 50) {
            input = { x: dx / dist, y: dy / dist };
          } else if (dist < idealDist - 50) {
            input = { x: -dx / dist, y: -dy / dist };
          } else {
            // Strafe
            input = { x: -dy / dist * 0.7, y: dx / dist * 0.7 };
          }
          // Dodge incoming projectiles
          for (const p of run.projectiles) {
            if (p.fromEnemy) {
              const pd = Math.hypot(p.x - run.player.x, p.y - run.player.y);
              if (pd < 120) {
                const pdx = run.player.x - p.x;
                const pdy = run.player.y - p.y;
                const pl = Math.hypot(pdx, pdy) || 1;
                input = { x: pdx / pl, y: pdy / pl };
                break;
              }
            }
          }
        } else {
          const dx = nearest.x - run.player.x;
          const dy = nearest.y - run.player.y;
          const dist = Math.hypot(dx, dy) || 1;
          input = { x: dx / dist, y: dy / dist };
        }
      }
    }
    
    updateRun(run, input, dt);
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
