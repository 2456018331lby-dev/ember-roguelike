
import { createRun, applyCardChoice, applyForgeChoice, applyShopChoice, applyRestChoice, updateRun, getPlayerStats, dash } from '../web/src/game_core.mjs';

function simulateAutoRun(seed, maxTicks = 10000) {
  const run = createRun(seed);
  const dt = 0.05;
  let ticks = 0;

  while (!['gameover', 'victory'].includes(run.state) && ticks < maxTicks) {
    if (run.state === 'wave_transition') {
      run.waveTransitionTimer = 0;
      updateRun(run, { x: 0, y: 0 }, 0.001);
    }
    if (run.state === 'forge') {
      const choices = run.forgeChoices || [];
      let picked = null;
      const upgradeAttack = choices.find(c => c.forgeAction === 'upgrade' && (c.type === 'attack' || c.damage || c.attackBonus));
      const purify = choices.find(c => c.forgeAction === 'purify' && c.sacrifice === null);
      const reforge = choices.find(c => c.forgeAction === 'reforge');
      if (upgradeAttack) picked = upgradeAttack;
      else if (purify) picked = purify;
      else if (reforge) picked = reforge;
      else picked = choices[0];
      if (picked) applyForgeChoice(run, picked);
      if (run.state === 'wave_transition') { run.waveTransitionTimer = 0; updateRun(run, { x: 0, y: 0 }, 0.001); }
      continue;
    }
    if (run.state === 'shop') {
      const choices = run.shopChoices || [];
      const stats = getPlayerStats(run);
      const hpRatio = run.player.hp / Math.max(1, stats.maxHp);
      let picked = choices.find(c => c.shopAction === 'skip');
      // Only buy if HP is critical
      if (hpRatio < 0.4) {
        const heal = choices.find(c => c.shopAction === 'heal');
        if (heal) picked = heal;
      }
      if (picked) applyShopChoice(run, picked);
      if (run.state === 'wave_transition') { run.waveTransitionTimer = 0; updateRun(run, { x: 0, y: 0 }, 0.001); }
      continue;
    }
    if (run.state === 'rest') {
      const choices = run.restChoices || [];
      const stats = getPlayerStats(run);
      const hpRatio = run.player.hp / Math.max(1, stats.maxHp);
      let picked;
      if (hpRatio < 0.4) {
        picked = choices.find(c => c.restAction === 'heal');
      } else {
        // Prefer meditate to reduce sacrifice costs permanently
        picked = choices.find(c => c.restAction === 'meditate');
      }
      if (!picked) picked = choices[0];
      if (picked) applyRestChoice(run, picked);
      if (run.state === 'wave_transition') { run.waveTransitionTimer = 0; updateRun(run, { x: 0, y: 0 }, 0.001); }
      continue;
    }
    if (run.state === 'reward') {
      const choices = run.rewardChoices || [];
      let bestIdx = 0;
      if (choices.length > 1) {
        const stats = getPlayerStats(run);
        const hpRatio = run.player.hp / Math.max(1, stats.maxHp);
        const isBossNext = run.nextWavePreview?.kind === 'boss';
        if (isBossNext && hpRatio < 0.6) {
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
      if (run.state === 'wave_transition') { run.waveTransitionTimer = 0; updateRun(run, { x: 0, y: 0 }, 0.001); }
    }

    let input = { x: 0, y: 0 };
    if (run.enemies.length > 0 && run.state === 'playing') {
      let boss = null, bossDist = Infinity;
      let nearest = null, nearestDist = Infinity;
      for (const e of run.enemies) {
        const d = Math.hypot(e.x - run.player.x, e.y - run.player.y);
        if (e.isBoss && d < bossDist) { bossDist = d; boss = e; }
        if (d < nearestDist) { nearestDist = d; nearest = e; }
      }
      let dodgeDir = null, closestBullet = Infinity;
      for (const p of run.projectiles) {
        if (p.fromEnemy) {
          const pd = Math.hypot(p.x - run.player.x, p.y - run.player.y);
          if (pd < 100 && pd < closestBullet) {
            closestBullet = pd;
            const bAngle = Math.atan2(p.vy, p.vx);
            const toPlayer = Math.atan2(run.player.y - p.y, run.player.x - p.x);
            const cross = Math.sin(toPlayer - bAngle);
            const perpAngle = bAngle + (cross > 0 ? -Math.PI / 2 : Math.PI / 2);
            dodgeDir = { x: Math.cos(perpAngle), y: Math.sin(perpAngle) };
          }
        }
      }
      if (dodgeDir && closestBullet < 80) {
        input = dodgeDir;
        if (closestBullet < 50 && run.dashCooldown <= 0) dash(run, dodgeDir.x, dodgeDir.y);
      } else if (boss) {
        const dx = boss.x - run.player.x, dy = boss.y - run.player.y, dist = Math.hypot(dx, dy) || 1;
        if (dist > 220) input = { x: dx / dist, y: dy / dist };
        else if (dist < 160) input = { x: -dx / dist, y: -dy / dist };
        else input = { x: -dy / dist, y: dx / dist };
        if (nearest && !nearest.isBoss && nearestDist < 100) {
          const mdx = nearest.x - run.player.x, mdy = nearest.y - run.player.y, md = Math.hypot(mdx, mdy) || 1;
          input = { x: mdx / md, y: mdy / md };
        }
      } else if (nearest) {
        const dx = nearest.x - run.player.x, dy = nearest.y - run.player.y, dist = Math.hypot(dx, dy) || 1;
        input = { x: dx / dist, y: dy / dist };
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
const avg = (waves.reduce((a, b) => a + b, 0) / waves.length).toFixed(2);
const best = Math.max(...waves);
const worst = Math.min(...waves);
const dist = {};
for (const w of waves) dist[w] = (dist[w] || 0) + 1;
const wave5fails = results.filter(r => r.wave === 5).map(r => r.seed);
console.log(JSON.stringify({ avgWave: +avg, best, worst, dist, wave5failSeeds: wave5fails }, null, 2));
