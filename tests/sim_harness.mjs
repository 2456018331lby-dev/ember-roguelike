import {
  applyCardChoice,
  applyForgeChoice,
  applyRestChoice,
  applyShopChoice,
  createRun,
  dash,
  getPlayerStats,
  updateRun,
} from '../web/src/game_core.mjs';

const DEFAULT_DT = 0.05;

function fastForwardTransition(run) {
  if (run.state !== 'wave_transition') return;
  run.waveTransitionTimer = 0;
  updateRun(run, { x: 0, y: 0 }, 0.001);
}

function hasPositive(card, key) {
  return (card?.[key] || 0) > 0;
}

function isSurvivalCard(card) {
  return hasPositive(card, 'armorBonus') ||
    hasPositive(card, 'dodgeChance') ||
    hasPositive(card, 'regen') ||
    hasPositive(card, 'lifesteal') ||
    hasPositive(card, 'barrier') ||
    hasPositive(card, 'reflect') ||
    Boolean(card?.revive);
}

function chooseBaselineForge(run) {
  return (run.forgeChoices || [])[0] || null;
}

function chooseBaselineShop(run) {
  const choices = run.shopChoices || [];
  return choices.find(choice => choice.shopAction === 'skip') || choices[choices.length - 1] || null;
}

function chooseBaselineRest(run) {
  const choices = run.restChoices || [];
  const stats = getPlayerStats(run);
  const hpRatio = run.player.hp / Math.max(1, stats.maxHp);
  const heal = choices.find(choice => choice.restAction === 'heal');
  const meditate = choices.find(choice => choice.restAction === 'meditate');
  const train = choices.find(choice => choice.restAction === 'train');
  return hpRatio < 0.42 ?
    (heal || meditate || train || choices[0] || null) :
    (train || meditate || heal || choices[0] || null);
}

function chooseBaselineReward(run) {
  return (run.rewardChoices || [])[0] || null;
}

function chooseSmartForge(run) {
  const choices = run.forgeChoices || [];
  const upgradeAttack = choices.find(choice =>
    choice.forgeAction === 'upgrade' &&
    (choice.type === 'attack' || choice.damage || choice.attackBonus)
  );
  const purify = choices.find(choice => choice.forgeAction === 'purify' && choice.sacrifice === null);
  const reforge = choices.find(choice => choice.forgeAction === 'reforge');
  return upgradeAttack || purify || reforge || choices[0] || null;
}

function chooseSmartShop(run) {
  const choices = run.shopChoices || [];
  const stats = getPlayerStats(run);
  const hpRatio = run.player.hp / Math.max(1, stats.maxHp);
  if (hpRatio < 0.4) {
    const heal = choices.find(choice => choice.shopAction === 'heal');
    if (heal) return heal;
  }
  return choices.find(choice => choice.shopAction === 'skip') || choices[0] || null;
}

function chooseSmartRest(run) {
  const choices = run.restChoices || [];
  if (choices.length === 0) return null;
  const stats = getPlayerStats(run);
  const hpRatio = run.player.hp / Math.max(1, stats.maxHp);
  if (hpRatio < 0.4) {
    return choices.find(choice => choice.restAction === 'heal') || choices[0] || null;
  }

  const scored = [...choices]
    .map(choice => {
      let score = Number(choice.fitScore || 0);
      if (choice.restAction === 'gamble' && hpRatio < 0.82) score -= 2.2;
      if (choice.restAction === 'gamble' && run.nextWavePreview?.kind === 'boss') score -= 1.1;
      if (choice.restAction === 'heal' && hpRatio > 0.88) score -= 0.7;
      if (choice.restAction === 'meditate' && run.nextWavePreview?.kind === 'boss' && hpRatio < 0.7) score -= 0.5;
      return { choice, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.choice || choices[0] || null;
}

function chooseSmartReward(run) {
  const choices = run.rewardChoices || [];
  if (choices.length === 0) return null;
  let bestIdx = 0;
  const stats = getPlayerStats(run);
  const hpRatio = run.player.hp / Math.max(1, stats.maxHp);
  if (run.nextWavePreview?.kind === 'boss' && hpRatio < 0.6) {
    for (let i = 1; i < choices.length; i++) {
      if (isSurvivalCard(choices[i]) && !isSurvivalCard(choices[bestIdx])) {
        bestIdx = i;
      }
    }
  }
  return choices[bestIdx];
}

function chooseSmartInput(run) {
  let input = { x: 0, y: 0 };
  if (run.enemies.length === 0 || run.state !== 'playing') return input;

  let boss = null;
  let bossDist = Infinity;
  let nearest = null;
  let nearestDist = Infinity;
  for (const enemy of run.enemies) {
    const dist = Math.hypot(enemy.x - run.player.x, enemy.y - run.player.y);
    if (enemy.isBoss && dist < bossDist) {
      bossDist = dist;
      boss = enemy;
    }
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = enemy;
    }
  }

  let dodgeDir = null;
  let closestBullet = Infinity;
  for (const projectile of run.projectiles) {
    if (!projectile.fromEnemy) continue;
    const projectileDist = Math.hypot(projectile.x - run.player.x, projectile.y - run.player.y);
    if (projectileDist >= 100 || projectileDist >= closestBullet) continue;
    closestBullet = projectileDist;
    const bulletAngle = Math.atan2(projectile.vy, projectile.vx);
    const toPlayer = Math.atan2(run.player.y - projectile.y, run.player.x - projectile.x);
    const cross = Math.sin(toPlayer - bulletAngle);
    const perpAngle = bulletAngle + (cross > 0 ? -Math.PI / 2 : Math.PI / 2);
    dodgeDir = { x: Math.cos(perpAngle), y: Math.sin(perpAngle) };
  }

  if (dodgeDir && closestBullet < 80) {
    input = dodgeDir;
    if (closestBullet < 50 && run.dashCooldown <= 0) dash(run, dodgeDir.x, dodgeDir.y);
    return input;
  }

  if (boss) {
    const dx = boss.x - run.player.x;
    const dy = boss.y - run.player.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > 220) input = { x: dx / dist, y: dy / dist };
    else if (dist < 160) input = { x: -dx / dist, y: -dy / dist };
    else input = { x: -dy / dist, y: dx / dist };

    if (nearest && !nearest.isBoss && nearestDist < 100) {
      const mdx = nearest.x - run.player.x;
      const mdy = nearest.y - run.player.y;
      const md = Math.hypot(mdx, mdy) || 1;
      input = { x: mdx / md, y: mdy / md };
    }
    return input;
  }

  if (nearest) {
    const dx = nearest.x - run.player.x;
    const dy = nearest.y - run.player.y;
    const dist = Math.hypot(dx, dy) || 1;
    input = { x: dx / dist, y: dy / dist };
  }
  return input;
}

const STRATEGIES = {
  baseline: {
    maxTicks: 8000,
    chooseForge: chooseBaselineForge,
    chooseShop: chooseBaselineShop,
    chooseRest: chooseBaselineRest,
    chooseReward: chooseBaselineReward,
    chooseInput: () => ({ x: 0, y: 0 }),
  },
  smart: {
    maxTicks: 10000,
    chooseForge: chooseSmartForge,
    chooseShop: chooseSmartShop,
    chooseRest: chooseSmartRest,
    chooseReward: chooseSmartReward,
    chooseInput: chooseSmartInput,
  },
};

function resolveStrategy(strategy) {
  if (typeof strategy === 'string') {
    const config = STRATEGIES[strategy];
    if (!config) throw new Error(`Unknown simulation strategy: ${strategy}`);
    return config;
  }
  return strategy;
}

function handleDecisionState(run, strategy) {
  if (run.state === 'forge') {
    const picked = strategy.chooseForge(run);
    if (picked) applyForgeChoice(run, picked);
    fastForwardTransition(run);
    return 'continue';
  }

  if (run.state === 'shop') {
    const picked = strategy.chooseShop(run);
    if (picked) applyShopChoice(run, picked);
    fastForwardTransition(run);
    return 'continue';
  }

  if (run.state === 'rest') {
    const picked = strategy.chooseRest(run);
    if (picked) applyRestChoice(run, picked);
    fastForwardTransition(run);
    return 'continue';
  }

  if (run.state === 'reward') {
    const picked = strategy.chooseReward(run);
    if (picked) applyCardChoice(run, picked);
    fastForwardTransition(run);
    return 'fallthrough';
  }

  return 'none';
}

export function simulateRun(seed, options = {}) {
  const strategy = resolveStrategy(options.strategy || 'baseline');
  const run = createRun(seed, null, options.difficultyKey || 'standard');
  const maxTicks = options.maxTicks ?? strategy.maxTicks ?? 8000;
  const dt = options.dt ?? DEFAULT_DT;
  let ticks = 0;

  while (!['gameover', 'victory'].includes(run.state) && ticks < maxTicks) {
    fastForwardTransition(run);
    const decisionFlow = handleDecisionState(run, strategy);
    if (decisionFlow === 'continue') continue;

    const input = strategy.chooseInput(run);
    updateRun(run, input, dt);
    ticks += 1;
  }

  return run;
}

export function simulateSeeds(options = {}) {
  const seedStart = options.seedStart ?? 0;
  const seedCount = options.seedCount ?? 60;
  const results = [];
  for (let seed = seedStart; seed < seedStart + seedCount; seed++) {
    results.push(toRunResult(seed, simulateRun(seed, options)));
  }
  return results;
}

export function toRunResult(seed, run) {
  return {
    seed,
    wave: run.wave,
    state: run.state,
    waveKind: run.waveProfile?.kind || run.deathSummary?.waveKind || '',
    waveLabel: run.waveProfile?.label || run.deathSummary?.waveLabel || '',
    deathReason: run.deathSummary?.reason || '',
    weaknessTags: run.deathSummary?.weaknessTags || [],
    pressureGaps: run.deathSummary?.pressureGaps || run.buildAnalysis?.pressureGaps || {},
    focus: run.deathSummary?.focus || run.buildAnalysis?.summary || '',
    deckSize: run.player?.deck?.length || run.deathSummary?.deckSize || 0,
    gameTime: Math.floor(run.gameTime || run.deathSummary?.gameTime || 0),
    kills: run.kills || run.deathSummary?.kills || 0,
  };
}

export function summarizeRuns(results) {
  const waves = results.map(result => result.wave);
  const avg = (waves.reduce((sum, wave) => sum + wave, 0) / waves.length).toFixed(2);
  const dist = {};
  for (const wave of waves) dist[wave] = (dist[wave] || 0) + 1;
  return {
    avgWave: Number(avg),
    best: Math.max(...waves),
    worst: Math.min(...waves),
    dist,
    wave5failSeeds: results.filter(result => result.wave === 5).map(result => result.seed),
  };
}

export function summarizeBossCheckpoints(results, checkpoints = [5, 10, 15, 20, 25]) {
  const checkpointSummary = {};
  for (const checkpoint of checkpoints) {
    const reached = results.filter(result => result.wave >= checkpoint);
    const cleared = reached.filter(result => result.wave > checkpoint || result.state === 'victory');
    const died = results.filter(result => result.state === 'gameover' && result.wave === checkpoint);
    checkpointSummary[checkpoint] = {
      reached: reached.length,
      cleared: cleared.length,
      died: died.length,
      deathSeeds: died.map(result => result.seed),
    };
  }

  const bossDeathsByWave = {};
  const weaknessCounts = {};
  const deathReasons = {};
  for (const result of results) {
    if (result.state !== 'gameover') continue;
    if (result.wave % 5 === 0) {
      bossDeathsByWave[result.wave] = (bossDeathsByWave[result.wave] || 0) + 1;
    }
    for (const tag of result.weaknessTags || []) {
      weaknessCounts[tag] = (weaknessCounts[tag] || 0) + 1;
    }
    if (result.deathReason) {
      deathReasons[result.deathReason] = (deathReasons[result.deathReason] || 0) + 1;
    }
  }

  return {
    checkpoints: checkpointSummary,
    bossDeathsByWave,
    weaknessCounts,
    deathReasons,
    maxTickStops: results.filter(result => !['gameover', 'victory'].includes(result.state)).map(result => result.seed),
  };
}
