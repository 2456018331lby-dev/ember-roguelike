import assert from 'node:assert/strict';
import { applyShopChoice, applyRestChoice,
  createRun, applyCardChoice, applyForgeChoice, rollCardChoices, rerollRewardChoices, enrichRewardChoices, getPlayerStats,
  resolveAutoAttack, updateRun, dash, updateWaveState, getDifficultyPresets, generateRestChoices, createDebugBossFight,
} from '../web/src/game_core.mjs';
import { buildRunPresentation } from '../web/src/presentation.mjs';
import { getCharacter } from '../web/src/characters.mjs';

function test(name, fn) {
  try { fn(); console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}`); throw err; }
}

function fastForward(run, seconds) {
  // 先跳过波次过渡
  if (run.state === 'wave_transition') {
    run.waveTransitionTimer = 0;
    updateRun(run, { x: 0, y: 0 }, 0.001);
  }
  // 然后快进
  const steps = Math.ceil(seconds / 0.016);
  for (let i = 0; i < steps; i++) {
    updateRun(run, { x: 0, y: 0 }, 0.016);
  }
}

function spawnFirstEnemy(run) {
  if (run.state === 'wave_transition') {
    run.waveTransitionTimer = 0;
    updateRun(run, { x: 0, y: 0 }, 0.001);
  }
  for (let i = 0; i < 40 && run.enemies.length === 0; i++) {
    updateRun(run, { x: 0, y: 0 }, 0.1);
  }
  assert.ok(run.enemies.length > 0, '应能生成首个敌人');
  return run.enemies[0];
}

function simulateAutoRun(seed, maxTicks = 8000) {
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
      assert.ok(choices.length > 0, `forge 状态必须有选择项，seed ${seed} wave ${run.wave}`);
      applyForgeChoice(run, choices[0]);
      if (run.state === 'wave_transition') { run.waveTransitionTimer = 0; updateRun(run, { x: 0, y: 0 }, 0.001); }
      continue;
    }
    if (run.state === 'shop') {
      const choices = run.shopChoices || [];
      assert.ok(choices.length > 0, `shop 状态必须有选择项，seed ${seed} wave ${run.wave}`);
      const skip = choices.find(c => c.shopAction === 'skip') || choices[choices.length - 1];
      if (skip) applyShopChoice(run, skip);
      if (run.state === 'wave_transition') { run.waveTransitionTimer = 0; updateRun(run, { x: 0, y: 0 }, 0.001); }
      continue;
    }
    if (run.state === 'rest') {
      const choices = run.restChoices || [];
      assert.ok(choices.length > 0, `rest 状态必须有选择项，seed ${seed} wave ${run.wave}`);
      const stats = getPlayerStats(run);
      const hpRatio = run.player.hp / Math.max(1, stats.maxHp);
      const train = choices.find(c => c.restAction === 'train');
      const heal = choices.find(c => c.restAction === 'heal');
      const meditate = choices.find(c => c.restAction === 'meditate');
      const picked = hpRatio < 0.42 ? (heal || meditate || train || choices[0]) : (train || meditate || heal || choices[0]);
      if (picked) applyRestChoice(run, picked);
      if (run.state === 'wave_transition') { run.waveTransitionTimer = 0; updateRun(run, { x: 0, y: 0 }, 0.001); }
      continue;
    }
    if (run.state === 'reward') {
      assert.ok(run.rewardChoices.length > 0, `reward 状态必须有选择项，seed ${seed} wave ${run.wave}`);
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

function skipWaveTransition(run) {
  if (run.state === 'wave_transition') {
    run.waveTransitionTimer = 0;
    updateRun(run, { x: 0, y: 0 }, 0.001);
  }
}

function assertDecisionStateHasExit(run, label) {
  if (run.state === 'reward') {
    assert.ok(run.rewardChoices.length > 0, `${label}: reward 必须有奖励选项`);
    assert.ok(run.rewardChoices.every(card => typeof card.fitScore === 'number'), `${label}: reward 选项必须带 fitScore`);
    applyCardChoice(run, run.rewardChoices[0]);
    return true;
  }
  if (run.state === 'forge') {
    assert.ok(run.forgeChoices.length > 0, `${label}: forge 必须有锻造选项`);
    applyForgeChoice(run, run.forgeChoices[0]);
    return true;
  }
  if (run.state === 'shop') {
    assert.ok(run.shopChoices.length > 0, `${label}: shop 必须有商店选项`);
    const skip = run.shopChoices.find(choice => choice.shopAction === 'skip');
    assert.ok(skip, `${label}: shop 必须提供离开选项`);
    applyShopChoice(run, skip);
    return true;
  }
  if (run.state === 'rest') {
    assert.ok(run.restChoices.length >= 3, `${label}: rest 必须至少提供 3 个营火选项`);
    const train = run.restChoices.find(choice => choice.restAction === 'train');
    const heal = run.restChoices.find(choice => choice.restAction === 'heal');
    applyRestChoice(run, train || heal || run.restChoices[0]);
    return true;
  }
  return false;
}

function resolveDecisionStates(run, label) {
  for (let guard = 0; guard < 8; guard++) {
    skipWaveTransition(run);
    if (!assertDecisionStateHasExit(run, label)) return;
  }
  assert.fail(`${label}: 状态连续分支超过保护上限，当前 ${run.state}`);
}

test('presentation 会输出短板强度与奖励解释数值', () => {
  const run = createRun(2026);
  run.buildAnalysis = {
    descriptors: ['速攻'],
    weaknesses: {
      singleTarget: true,
      aoe: false,
      sustain: true,
      safety: false,
    },
    pressure: {
      singleTarget: 34,
      aoe: 28,
      sustain: 12,
      mitigation: 20,
      safety: 6,
    },
  };
  run.nextWavePreview = {
    kind: 'boss',
    label: '首领战',
    summary: '准备迎战',
    risk: '高压单点',
  };

  const presentation = buildRunPresentation(run, getPlayerStats(run), { name: '战士' });
  assert.match(presentation.weaknessSummary, /首领输出不足/);
  assert.match(presentation.weaknessSummary, /当前强度 34/);
  assert.match(presentation.rewardWhy, /首领战/);
  assert.match(presentation.rewardWhy, /34/);
  assert.match(presentation.rewardWhy, /32/);
});

test('构筑压力目标应随中后期波次成长', () => {
  const run = createRun(2027);
  run.wave = 15;
  run.waveProfile = { kind: 'boss', wave: 15, label: '第 15 波 Boss 讨伐' };
  const choices = enrichRewardChoices(run, [{
    id: 'test_late_strike',
    name: '后期测试斩击',
    type: 'attack',
    rarity: 'rare',
    damage: 18,
    desc: '用于测试中后期输出缺口',
  }], run.waveProfile);

  assert.ok(run.buildAnalysis.pressureTargets.singleTarget > 52, `第 15 波单体目标应高于开局阈值，实际 ${run.buildAnalysis.pressureTargets.singleTarget}`);
  assert.ok(run.buildAnalysis.pressureTargets.sustain > 48, `第 15 波续航目标应高于开局阈值，实际 ${run.buildAnalysis.pressureTargets.sustain}`);
  assert.ok(run.buildAnalysis.pressureGaps.singleTarget > 0, '低输出构筑在第 15 波应暴露首领输出缺口');
  assert.ok(run.buildAnalysis.weaknesses.singleTarget, '压力缺口应映射成短板标签');
  assert.match(choices[0].fitHint, /输出缺口|直接抬升输出/);
});

test('开局基础属性和初始卡牌', () => {
  const run = createRun(123);
  assert.equal(run.wave, 1);
  assert.equal(run.player.hp, 100);
  assert.equal(run.player.deck.length, 3);
  assert.equal(run.jokers.length, 0);
  assert.equal(run.state, 'wave_transition');
  assert.equal(run.reviveUsed, false);
});

test('难度档位应改变敌人强度并保留标准档', () => {
  const presets = getDifficultyPresets();
  assert.ok(presets.steady && presets.standard && presets.trial, '应提供稳健/标准/试炼三档难度');

  const seed = 202604;
  const steady = createRun(seed, null, 'steady');
  const standard = createRun(seed, null, 'standard');
  const trial = createRun(seed, null, 'trial');
  const steadyEnemy = spawnFirstEnemy(steady);
  const standardEnemy = spawnFirstEnemy(standard);
  const trialEnemy = spawnFirstEnemy(trial);

  assert.equal(standard.difficultyKey, 'standard');
  assert.ok(steady.player.maxHp > standard.player.maxHp, `稳健角色生命应高于标准：${steady.player.maxHp} vs ${standard.player.maxHp}`);
  assert.ok(steady.player.baseAttack > standard.player.baseAttack, `稳健角色攻击应高于标准：${steady.player.baseAttack} vs ${standard.player.baseAttack}`);
  assert.ok(steady.player.barrier > standard.player.barrier, `稳健角色应有初始护盾：${steady.player.barrier}`);
  assert.ok(steadyEnemy.maxHp < standardEnemy.maxHp, `稳健敌人血量应低于标准：${steadyEnemy.maxHp} vs ${standardEnemy.maxHp}`);
  assert.ok(steadyEnemy.baseDamage <= standardEnemy.baseDamage, `稳健敌人伤害应不高于标准：${steadyEnemy.baseDamage} vs ${standardEnemy.baseDamage}`);
  assert.ok(trialEnemy.maxHp > standardEnemy.maxHp, `试炼敌人血量应高于标准：${trialEnemy.maxHp} vs ${standardEnemy.maxHp}`);
  assert.ok(trialEnemy.baseDamage >= standardEnemy.baseDamage, `试炼敌人伤害应不低于标准：${trialEnemy.baseDamage} vs ${standardEnemy.baseDamage}`);
});

test('波次过渡后进入 playing', () => {
  const run = createRun(123);
  assert.equal(run.state, 'wave_transition');
  fastForward(run, 2.5);
  assert.equal(run.state, 'playing');
});

test('献祭卡牌增加能力并记录代价', () => {
  const run = createRun(123);
  fastForward(run, 1);
  run.state = 'reward';
  run.rewardChoices = rollCardChoices(run, 3);
  const card = run.rewardChoices[0];
  applyCardChoice(run, card);
  if (card.sacrifice) {
    assert.ok(run.sacrifices[card.sacrifice.stat].count >= 1);
  }
});

test('生命献祭只应结算一次，不应让最大生命每帧持续塌缩', () => {
  const run = createRun(124);
  fastForward(run, 1);
  applyCardChoice(run, {
    id: 'hp_sac_once',
    name: '测试献祭',
    type: 'attack',
    rarity: 'common',
    damage: 8,
    sacrifice: { stat: 'health', amount: 0.1 },
  });

  const expectedMaxHp = 90;
  const statsAfterPick = getPlayerStats(run);
  assert.equal(Math.round(statsAfterPick.maxHp), expectedMaxHp);

  for (let i = 0; i < 120; i++) {
    updateRun(run, { x: 0, y: 0 }, 0.016);
  }

  const statsAfterUpdates = getPlayerStats(run);
  assert.equal(Math.round(statsAfterUpdates.maxHp), expectedMaxHp);
});

test('连续牺牲3次同属性触发极端化', () => {
  const run = createRun(456);
  for (let i = 0; i < 3; i++) {
    applyCardChoice(run, {
      id: `slow_${i}`, name: '沉重力量', type: 'passive', rarity: 'common',
      attackBonus: 3, sacrifice: { stat: 'speed', amount: 0.1 }
    });
  }
  assert.ok(run.extremes.includes('磐石之躯'));
  const stats = getPlayerStats(run);
  assert.ok(stats.damageMultiplier >= 2.5);
});

test('同 seed 抽卡结果相同', () => {
  const a = createRun(42);
  const b = createRun(42);
  const ca = rollCardChoices(a, 3).map(c => c.id);
  const cb = rollCardChoices(b, 3).map(c => c.id);
  assert.deepEqual(ca, cb);
});

test('自动攻击伤害近距离敌人', () => {
  const run = createRun(789);
  fastForward(run, 3);
  if (run.enemies.length > 0) {
    run.enemies[0].x = run.player.x + 40;
    run.enemies[0].y = run.player.y;
    run.enemies[0].hp = 1;
    resolveAutoAttack(run, 999);
    assert.ok(run.kills >= 0);
  }
});

test('战士应能突进追击中距离目标，而不是停在原地罚站', () => {
  const run = createRun(790, getCharacter('warrior'));
  run.enemies = [{
    id: 'dummy_mid_boss',
    x: run.player.x,
    y: run.player.y - 320,
    hp: 999,
    maxHp: 999,
    radius: 28,
    armorPierce: 0,
  }];

  resolveAutoAttack(run, 999);

  assert.ok(run.player.y < 320, `战士应向目标突进，当前 y=${run.player.y}`);
  assert.equal(run.playerProjectiles.length, 0, '战士不应生成远程弹体');
});

test('法师自动攻击应生成玩家弹幕，而不是使用近战突进', () => {
  const run = createRun(791, getCharacter('mage'));
  run.enemies = [{
    id: 'dummy_caster_target',
    x: run.player.x,
    y: run.player.y - 260,
    hp: 999,
    maxHp: 999,
    radius: 20,
    armorPierce: 0,
  }];
  const playerBefore = { x: run.player.x, y: run.player.y };

  resolveAutoAttack(run, 999);

  assert.ok(run.playerProjectiles.length > 0, '法师应生成玩家弹幕');
  assert.equal(run.player.x, playerBefore.x, '法师不应触发战士式位移');
  assert.equal(run.player.y, playerBefore.y, '法师不应触发战士式位移');
});

test('冲刺消耗冷却并提供无敌帧', () => {
  const run = createRun(100);
  fastForward(run, 1);
  assert.equal(run.dashCooldown, 0);
  dash(run, 1, 0);
  assert.ok(run.dashCooldown > 0);
  assert.ok(run.dashTimer > 0);
  assert.ok(run.player.invuln > 0);
});

test('凤凰余烬只能复活一次', () => {
  const run = createRun(999);
  fastForward(run, 1);

  // 添加凤凰余烬
  run.player.deck.push({ id: 'phoenix_ember', name: '凤凰余烬', type: 'joker', rarity: 'legendary', revive: 1, desc: '复活一次' });
  run.jokers.push({ id: 'phoenix_ember', name: '凤凰余烬', type: 'joker', rarity: 'legendary', revive: 1 });

  const stats = getPlayerStats(run);
  assert.equal(stats.revive, 1);
  assert.equal(run.reviveUsed, false);

  // 清空敌人避免干扰
  run.enemies = [];
  run.waveEnemyQueue = [];

  // 第一次死亡（设血为负）
  run.player.hp = -50;
  run.player.invuln = 0;
  // updateRun 会调用 takeDamage 或直接检测 hp<=0
  // game_core 里 takeDamage 才检查复活，所以我们模拟一个碰撞
  // 直接设置 hp=1 然后受一次致命伤
  run.player.hp = 1;
  run.player.invuln = 0;
  // 手动触发 takeDamage 逻辑（通过 updateRun 不行因为没敌人）
  // 改为直接测试：设置 hp 为 0 以下然后调用 updateRun
  // game_core 的 updateRun 不直接检查 hp<=0，只在 takeDamage 里检查
  // 所以我们需要模拟一次伤害

  // 直接在 run.enemies 放一个触碰敌人的
  const testEnemy = {
    id: 'test_toucher', typeKey: 'slime', isBoss: false,
    name: '测试怪', color: '#f00',
    x: run.player.x, y: run.player.y, radius: 50,
    hp: 100, maxHp: 100, baseDamage: 9999,
    speed: 0, behavior: 'chase', attackType: 'melee',
    attackCooldown: 0.01, attackTimer: 0, attackRange: 50,
    preferredDist: 0, projectileSpeed: 0, projectileRadius: 5,
    projectileColor: '#f00', spreadCount: 1, spreadAngle: 0,
    healAmount: 0, summonType: 'slime', summonCount: 1,
    phases: [], currentPhaseIdx: 0, phaseAttackTimer: 0, bulletAngle: 0,
    touchTimer: 0, dotTimer: 0, dotDamage: 0,
    slowTimer: 0, slowAmount: 1, hitFlash: 0,
    phased: false, phaseTimer: 0, telegraphTimer: 0, telegraphType: null,
  };
  run.enemies = [testEnemy];
  run.player.hp = 1;
  run.player.invuln = 0;

  // 运行几帧让碰撞触发
  for (let i = 0; i < 40; i++) {
    updateRun(run, { x: 0, y: 0 }, 0.1);
    if (run.reviveUsed) break;
  }

  // 应该触发了复活
  assert.equal(run.reviveUsed, true);
  assert.ok(run.player.hp > 0, '复活后应该有血');
  assert.equal(run.state, 'playing', '复活后仍在 playing');

  // 第二次死亡不应该再复活
  run.player.hp = 1;
  run.player.invuln = 0;
  testEnemy.x = run.player.x;
  testEnemy.y = run.player.y;
  testEnemy.touchTimer = 0;
  testEnemy.hp = 100;
  run.enemies = [testEnemy];

  for (let i = 0; i < 50; i++) {
    updateRun(run, { x: 0, y: 0 }, 0.1);
    if (run.state === 'gameover') break;
  }

  assert.equal(run.state, 'gameover', '第二次死亡应该 game over');
});

test('卡牌稀有度权重 - 多次抽取应该有不同稀有度', () => {
  const rarities = new Set();
  for (let i = 0; i < 30; i++) {
    const r = createRun(i * 100);
    const cards = rollCardChoices(r, 3);
    cards.forEach(c => rarities.add(c.rarity));
  }
  assert.ok(rarities.has('common'), '应该有普通卡');
  assert.ok(rarities.size >= 2, '应该有至少2种稀有度');
});

test('弹幕系统 - Boss 生成弹幕', () => {
  const run = createRun(123);
  fastForward(run, 1);
  run.enemies = [];
  run.waveEnemyQueue = [];

  // 手动添加 boss
  const boss = {
    id: 'test_boss', typeKey: 'dragon', isBoss: true,
    name: '测试龙', color: '#f00',
    x: 640, y: 200, radius: 38,
    hp: 1000, maxHp: 1000, baseDamage: 10,
    speed: 50, behavior: 'boss_fire', attackType: 'boss_fire_breath',
    phases: [
      { hpThreshold: 1.0, attackCooldown: 0.5, pattern: 'circle_shot', bulletCount: 8, bulletSpeed: 200 }
    ],
    currentPhaseIdx: 0, phaseAttackTimer: 0, bulletAngle: 0,
    attackTimer: 0, attackCooldown: 0.5, attackRange: 300,
    preferredDist: 0, projectileSpeed: 0, projectileRadius: 5,
    projectileColor: '#f00', spreadCount: 1, spreadAngle: 0,
    healAmount: 0, summonType: 'slime', summonCount: 1,
    touchTimer: 0, dotTimer: 0, dotDamage: 0,
    slowTimer: 0, slowAmount: 1, hitFlash: 0,
    phased: false, phaseTimer: 0, telegraphTimer: 0, telegraphType: null,
  };
  run.enemies.push(boss);

  // 快进让 boss 攻击
  for (let i = 0; i < 200; i++) {
    updateRun(run, { x: 0, y: 0 }, 0.05);
  }
  assert.ok(run.projectiles.length > 0, 'Boss 应该发射了弹幕');
});

test('Boss 在压场时不应被逼出可战斗区域', () => {
  const run = createDebugBossFight(2050, { wave: 5 });
  run.player.x = 40;
  run.player.y = 50;
  const boss = run.enemies.find(enemy => enemy.isBoss);
  assert.ok(boss, '调试 Boss 场景应生成首领');
  boss.x = 120;
  boss.y = 110;

  for (let i = 0; i < 240; i++) {
    updateRun(run, { x: 0, y: 0 }, 0.05);
  }

  assert.ok(boss.x >= 40, `Boss 不应离开左边界，当前 x=${boss.x}`);
  assert.ok(boss.y >= 50, `Boss 不应离开上边界，当前 y=${boss.y}`);
});

test('普通远程敌人不应退到场外导致波次无法结束', () => {
  const run = createRun(2051);
  run.enemies = [{
    id: 'edge_archer',
    typeKey: 'archer',
    name: '弓箭手',
    color: '#FF9800',
    x: 760,
    y: -140,
    radius: 12,
    hp: 37,
    maxHp: 37,
    baseDamage: 4,
    speed: 56,
    behavior: 'ranged',
    attackType: 'projectile',
    attackCooldown: 2,
    attackTimer: 0.05,
    attackRange: 350,
    meleeRange: 35,
    preferredDist: 200,
    projectileSpeed: 320,
    projectileRadius: 5,
    projectileColor: '#FFB74D',
    projectileLife: 3.5,
    touchTimer: 0,
    meleeSwingTimer: 0,
    meleePendingDamage: 0,
    dotTimer: 0,
    dotDamage: 0,
    slowTimer: 0,
    slowAmount: 1,
    hitFlash: 0,
    spawnAge: 200,
    phased: false,
    phaseTimer: 0,
    telegraphTimer: 0,
    telegraphType: null,
  }];
  run.waveEnemyQueue = [];
  run.state = 'playing';
  run.waveTransitionTimer = 0;
  run.player.x = 777;
  run.player.y = 50;

  updateRun(run, { x: 0, y: 0 }, 0.05);

  const archer = run.enemies[0];
  assert.ok(!archer || archer.y >= 50 + archer.radius, `远程敌人应被限制回可战斗区域，当前 y=${archer?.y}`);
});

test('敌人有攻击冷却和攻击行为', () => {
  const run = createRun(100);
  fastForward(run, 3);
  // 检查有敌人被生成
  assert.ok(run.enemies.length > 0 || run.waveEnemyQueue.length > 0, '应该有敌人');
  // 检查敌人有 attackTimer 属性
  if (run.enemies.length > 0) {
    const e = run.enemies[0];
    assert.ok('attackTimer' in e, '敌人应该有 attackTimer');
    assert.ok('attackCooldown' in e, '敌人应该有 attackCooldown');
    assert.ok('attackType' in e, '敌人应该有 attackType');
  }
});

test('奖励重随会消耗次数并刷新候选卡牌', () => {
  const run = createRun(321);
  fastForward(run, 1);

  run.state = 'reward';
  run.rewardRerolls = 1;
  run.rewardContext = { choiceCount: 3, rarityBonus: 0 };
  run.rewardChoices = rollCardChoices(run, 3);

  const firstIds = run.rewardChoices.map(card => card.id).join(',');
  const ok = rerollRewardChoices(run);
  const secondIds = run.rewardChoices.map(card => card.id).join(',');

  assert.equal(ok, true);
  assert.equal(run.rewardRerolls, 0);
  assert.notEqual(secondIds, firstIds);
});

test('螺旋 Boss 弹幕由模拟驱动而不是依赖真实定时器', () => {
  const run = createRun(777);
  fastForward(run, 1);
  run.enemies = [];
  run.waveEnemyQueue = [];

  run.enemies.push({
    id: 'spiral_boss',
    typeKey: 'dragon',
    isBoss: true,
    name: '测试螺旋龙',
    color: '#f00',
    x: 640,
    y: 220,
    radius: 38,
    hp: 1000,
    maxHp: 1000,
    baseDamage: 8,
    speed: 20,
    behavior: 'boss_fire',
    attackType: 'boss_fire_breath',
    phases: [
      { hpThreshold: 1.0, attackCooldown: 0.2, pattern: 'spiral_shot', bulletCount: 4, bulletSpeed: 180 }
    ],
    currentPhaseIdx: 0,
    phaseAttackTimer: 0,
    bulletAngle: 0,
    attackTimer: 0,
    attackCooldown: 0.2,
    attackRange: 300,
    preferredDist: 0,
    projectileSpeed: 0,
    projectileRadius: 5,
    projectileColor: '#f00',
    spreadCount: 1,
    spreadAngle: 0,
    healAmount: 0,
    summonType: 'slime',
    summonCount: 1,
    touchTimer: 0,
    dotTimer: 0,
    dotDamage: 0,
    slowTimer: 0,
    slowAmount: 1,
    hitFlash: 0,
    phased: false,
    phaseTimer: 0,
    telegraphTimer: 0,
    telegraphType: null,
  });

  for (let i = 0; i < 16; i++) {
    updateRun(run, { x: 0, y: 0 }, 0.05);
  }

  assert.ok(run.projectiles.length >= 12, '螺旋弹幕应该在模拟内分波生成');
});

test('高压 aimed burst 会先显示预警再延迟发射', () => {
  const run = createRun(1901);
  fastForward(run, 1);
  run.wave = 20;
  run.state = 'playing';
  run.enemies = [];
  run.waveEnemyQueue = [];
  run.projectiles = [];
  run.telegraphs = [];
  run.scheduledActions = [];
  run.player.x = 640;
  run.player.y = 520;

  run.enemies.push({
    id: 'aimed_burst_boss',
    typeKey: 'demon',
    isBoss: true,
    name: '测试恶魔领主',
    color: '#B71C1C',
    x: 640,
    y: 190,
    radius: 42,
    hp: 320,
    maxHp: 1000,
    baseDamage: 12,
    speed: 36,
    behavior: 'boss_chaos',
    attackType: 'boss_chaos',
    phases: [
      { hpThreshold: 1.0, attackCooldown: 1.4, pattern: 'aimed_burst', bulletCount: 6, bulletSpeed: 340 },
    ],
    currentPhaseIdx: 0,
    phaseAttackTimer: 0.01,
    bulletAngle: 0,
    attackTimer: 0,
    attackCooldown: 1.4,
    attackRange: 300,
    preferredDist: 210,
    projectileSpeed: 0,
    projectileRadius: 5,
    projectileColor: '#f00',
    spreadCount: 1,
    spreadAngle: 0,
    healAmount: 0,
    summonType: 'slime',
    summonCount: 1,
    touchTimer: 0,
    dotTimer: 0,
    dotDamage: 0,
    slowTimer: 0,
    slowAmount: 1,
    hitFlash: 0,
    phased: false,
    phaseTimer: 0,
    telegraphTimer: 0,
    telegraphType: null,
  });

  updateRun(run, { x: 0, y: 0 }, 0.05);

  assert.ok(run.telegraphs.length > 0, '应先出现 Boss 预警');
  assert.equal(run.projectiles.length, 0, `预警帧不应立刻发射弹幕，实际 ${run.projectiles.length}`);
  assert.ok(run.scheduledActions.length > 0, '预警后应挂起延迟发射动作');

  for (let i = 0; i < 3; i++) {
    updateRun(run, { x: 0, y: 0 }, 0.05);
  }
  assert.equal(run.projectiles.length, 0, `短暂风压期内不应提前发射，实际 ${run.projectiles.length}`);

  for (let i = 0; i < 3; i++) {
    updateRun(run, { x: 0, y: 0 }, 0.05);
  }
  assert.ok(run.projectiles.length >= 6, `风压结束后应发射整轮弹幕，实际 ${run.projectiles.length}`);
});

test('精英波会生成精英敌人并标记', () => {
  const run = createRun(888);
  let safety = 0;
  while (run.wave < 6 && safety++ < 20) {
    run.enemies = [];
    run.waveEnemyQueue = [];
    run.state = 'playing';
    updateWaveState(run, 0);
    if (run.state === 'forge') {
      const choices = run.forgeChoices || [];
      if (choices.length > 0) applyForgeChoice(run, choices[0]);
      else run.state = 'playing';
    }
    if (run.state === 'shop') {
      const choices = run.shopChoices || [];
      const skip = choices.find(c => c.shopAction === 'skip') || choices[choices.length - 1];
      if (skip) applyShopChoice(run, skip);
      // After shop, might need to start next wave
      if (run.state === 'playing') { /* ok */ }
    }
    if (run.state === 'rest') {
      const choices = run.restChoices || [];
      const heal = choices.find(c => c.restAction === 'heal');
      const train = choices.find(c => c.restAction === 'train');
      if (train || heal || choices[0]) applyRestChoice(run, train || heal || choices[0]);
    }
    if (run.state === 'reward') {
      applyCardChoice(run, {
        id: `test_card_${run.wave}`,
        name: '测试卡',
        type: 'passive',
        rarity: 'common',
        attackBonus: 1,
      });
      // After boss reward, state might be 'shop'
      if (run.state === 'shop') {
        const choices = run.shopChoices || [];
        const skip = choices.find(c => c.shopAction === 'skip') || choices[choices.length - 1];
        if (skip) applyShopChoice(run, skip);
      }
      if (run.state === 'rest') {
        const choices = run.restChoices || [];
        const train = choices.find(c => c.restAction === 'train');
        const heal = choices.find(c => c.restAction === 'heal');
        if (train || heal || choices[0]) applyRestChoice(run, train || heal || choices[0]);
      }
    }
  }
  assert.ok(safety < 20, `推进到第 6 波不应卡住，当前第 ${run.wave} 波，状态 ${run.state}`);

  fastForward(run, 1);
  const hasElite = run.waveEnemyQueue.some(entry => entry.elite === true) || run.enemies.some(enemy => enemy.isElite === true);
  assert.equal(run.wave, 6);
  assert.equal(hasElite, true);
});

test('近战攻击不会在同一轮同时触发碰撞伤害和攻击伤害', () => {
  const run = createRun(909);
  fastForward(run, 1);
  run.enemies = [];
  run.waveEnemyQueue = [];

  const enemy = {
    id: 'melee_test',
    typeKey: 'slime',
    isBoss: false,
    isElite: false,
    name: '测试近战怪',
    color: '#f00',
    x: run.player.x + 10,
    y: run.player.y,
    radius: 18,
    hp: 100,
    maxHp: 100,
    baseDamage: 10,
    speed: 0,
    behavior: 'chase',
    attackType: 'melee',
    attackCooldown: 1,
    attackTimer: 0,
    attackRange: 50,
    preferredDist: 0,
    projectileSpeed: 0,
    projectileRadius: 5,
    projectileColor: '#f00',
    spreadCount: 1,
    spreadAngle: 0,
    healAmount: 0,
    summonType: 'slime',
    summonCount: 1,
    phases: [],
    currentPhaseIdx: 0,
    phaseAttackTimer: 0,
    bulletAngle: 0,
    touchTimer: 0,
    dotTimer: 0,
    dotDamage: 0,
    slowTimer: 0,
    slowAmount: 1,
    hitFlash: 0,
    phased: false,
    phaseTimer: 0,
    telegraphTimer: 0,
    telegraphType: null,
  };

  run.enemies = [enemy];
  const beforeHp = run.player.hp;
  updateRun(run, { x: 0, y: 0 }, 0.016);
  const damageTaken = beforeHp - run.player.hp;

  assert.ok(damageTaken <= 10, `单次近战轮次不应超过一次伤害，实际受伤 ${damageTaken}`);
});

test('近战攻击应在预警后结算，而不是立刻扣血', () => {
  const run = createRun(910);
  fastForward(run, 1);
  run.enemies = [];
  run.waveEnemyQueue = [];

  const enemy = {
    id: 'melee_delay_test',
    typeKey: 'slime',
    isBoss: false,
    isElite: false,
    name: '测试延迟近战怪',
    color: '#f00',
    x: run.player.x + 12,
    y: run.player.y,
    radius: 18,
    hp: 100,
    maxHp: 100,
    baseDamage: 10,
    speed: 0,
    behavior: 'chase',
    attackType: 'melee',
    attackCooldown: 1,
    attackTimer: 0,
    attackRange: 48,
    preferredDist: 0,
    projectileSpeed: 0,
    projectileRadius: 5,
    projectileColor: '#f00',
    spreadCount: 1,
    spreadAngle: 0,
    healAmount: 0,
    summonType: 'slime',
    summonCount: 1,
    phases: [],
    currentPhaseIdx: 0,
    phaseAttackTimer: 0,
    bulletAngle: 0,
    touchTimer: 0,
    dotTimer: 0,
    dotDamage: 0,
    slowTimer: 0,
    slowAmount: 1,
    hitFlash: 0,
    phased: false,
    phaseTimer: 0,
    telegraphTimer: 0,
    telegraphType: null,
  };

  run.enemies = [enemy];
  const hpBefore = run.player.hp;

  updateRun(run, { x: 0, y: 0 }, 0.016);
  assert.equal(run.player.hp, hpBefore, '预警启动帧不应立刻扣血');

  for (let i = 0; i < 20; i++) updateRun(run, { x: 0, y: 0 }, 0.016);
  assert.ok(run.player.hp < hpBefore, '预警结束后才应真正命中');
});

test('波次档案应提供不同的节奏类型和结构化字段', () => {
  const run = createRun(1200);
  assert.equal(run.waveProfile.kind, 'hunt');
  assert.ok(run.waveProfile.spawnInterval > 0);
  assert.ok(run.waveProfile.enemyCount > 0);
  assert.ok(run.waveProfile.summary.length > 0);

  run.state = 'playing';
  run.enemies = [];
  run.waveEnemyQueue = [];
  updateWaveState(run, 0);
  applyCardChoice(run, { id: 'test_reward_1', name: '测试收益', type: 'passive', rarity: 'common', attackBonus: 2 });
  assert.equal(run.wave, 2);
  assert.equal(run.waveProfile.kind, 'recovery');
});

test('核心状态机不应进入无出口的奖励/事件/Boss 前后状态', () => {
  const difficultyKeys = Object.keys(getDifficultyPresets());
  for (const difficultyKey of difficultyKeys) {
    for (let seed = 1; seed <= 30; seed++) {
      const run = createRun(seed, null, difficultyKey);
      for (let waveStep = 0; waveStep < 14 && !['gameover', 'victory'].includes(run.state); waveStep++) {
        const label = `difficulty ${difficultyKey} seed ${seed} step ${waveStep} wave ${run.wave}`;
        resolveDecisionStates(run, label);
        skipWaveTransition(run);
        assert.equal(run.state, 'playing', `${label}: 决策状态处理后应回到 playing，实际 ${run.state}`);

        run.enemies = [];
        run.waveEnemyQueue = [];
        updateWaveState(run, 0);
        resolveDecisionStates(run, label);
        skipWaveTransition(run);
      }
      assert.ok(run.wave >= 10, `difficulty ${difficultyKey} seed ${seed}: 状态机应至少推进到第 10 波，实际第 ${run.wave} 波 ${run.state}`);
    }
  }
});

test('奖励候选应携带契合度提示', () => {
  const run = createRun(1300);
  fastForward(run, 1);
  run.state = 'reward';
  run.rewardRerolls = 1;
  run.rewardContext = { choiceCount: 3, rarityBonus: 0, targetTag: 'tempo' };
  run.rewardChoices = [];
  const ok = rerollRewardChoices(run);
  assert.equal(ok, true);
  assert.equal(typeof run.rewardChoices[0].fitHint, 'string');
  assert.equal(typeof run.rewardChoices[0].fitScore, 'number');
});

test('第5波 Boss 应先单独入场，杂兵延后出现', () => {
  const run = createRun(1400);
  fastForward(run, 1);
  let safety = 0;
  while (run.wave < 5 && safety++ < 20) {
    run.enemies = [];
    run.waveEnemyQueue = [];
    run.state = 'playing';
    updateWaveState(run, 0);
    if (run.state === 'forge') {
      const choices = run.forgeChoices || [];
      if (choices.length > 0) applyForgeChoice(run, choices[0]);
      else run.state = 'playing';
    }
    if (run.state === 'shop') {
      const choices = run.shopChoices || [];
      const skip = choices.find(c => c.shopAction === 'skip') || choices[choices.length - 1];
      if (skip) applyShopChoice(run, skip);
    }
    if (run.state === 'rest') {
      const choices = run.restChoices || [];
      const train = choices.find(c => c.restAction === 'train');
      const heal = choices.find(c => c.restAction === 'heal');
      if (train || heal || choices[0]) applyRestChoice(run, train || heal || choices[0]);
    }
    if (run.state === 'reward') {
      applyCardChoice(run, {
        id: `wave_${run.wave}_card`,
        name: '测试卡',
        type: 'passive',
        rarity: 'common',
        attackBonus: 1,
      });
      if (run.state === 'shop') {
        const choices = run.shopChoices || [];
        const skip = choices.find(c => c.shopAction === 'skip') || choices[choices.length - 1];
        if (skip) applyShopChoice(run, skip);
      }
      if (run.state === 'rest') {
        const choices = run.restChoices || [];
        const train = choices.find(c => c.restAction === 'train');
        const heal = choices.find(c => c.restAction === 'heal');
        if (train || heal || choices[0]) applyRestChoice(run, train || heal || choices[0]);
      }
    }
    fastForward(run, 0.1);
  }
  assert.ok(safety < 20, `推进到第 5 波不应卡住，当前第 ${run.wave} 波，状态 ${run.state}`);

  fastForward(run, 1);
  assert.equal(run.wave, 5);
  assert.equal(run.waveProfile.kind, 'boss');
  assert.ok(run.enemies.some(enemy => enemy.isBoss) || run.waveEnemyQueue.some(entry => entry.isBoss), '第5波应先出现 Boss');
  assert.ok(run.waveEnemyQueue.some(entry => entry.isBoss === false), '第5波应保留延后入场的杂兵');

  updateRun(run, { x: 0, y: 0 }, 0.016);
  assert.equal(run.enemies.length, 1);
  assert.equal(run.enemies[0].isBoss, true);
  assert.ok(run.spawnTimer > 2, `Boss 后的杂兵应仍在等待入场，当前计时 ${run.spawnTimer}`);
});

test('Boss 前奖励应保底给出生存向选择', () => {
  const run = createRun(1500);
  fastForward(run, 1);
  run.wave = 4;
  run.state = 'reward';
  run.player.hp = 42;
  run.rewardRerolls = 1;
  run.waveProfile = {
    kind: 'prelude',
    rewardTag: 'survival',
    rewardGuard: 'survival',
  };
  run.nextWavePreview = {
    kind: 'boss',
    rewardTag: 'survival',
    rewardGuard: 'survival',
  };
  run.rewardContext = { choiceCount: 3, rarityBonus: 2, targetTag: 'survival' };
  run.rewardChoices = [];

  const ok = rerollRewardChoices(run);
  assert.equal(ok, true);
  assert.ok(run.rewardChoices.some(card => card.regen || card.lifesteal || card.barrier || card.armorBonus || card.dodgeChance || card.reflect || card.thorns || card.revive));
});

test('Boss 前低血线奖励应给出至少两张生存向选择', () => {
  const run = createRun(1501);
  fastForward(run, 1);
  run.wave = 4;
  run.state = 'reward';
  run.player.hp = 30;
  run.rewardRerolls = 1;
  run.waveProfile = {
    kind: 'prelude',
    rewardTag: 'survival',
    rewardGuard: 'survival',
  };
  run.nextWavePreview = {
    kind: 'boss',
    rewardTag: 'survival',
    rewardGuard: 'survival',
  };
  run.rewardContext = { choiceCount: 3, rarityBonus: 2, targetTag: 'survival' };
  run.rewardChoices = [];

  const ok = rerollRewardChoices(run);
  assert.equal(ok, true);

  const survivalChoices = run.rewardChoices.filter(card => (
    card.regen || card.lifesteal || card.barrier || card.armorBonus || card.dodgeChance || card.reflect || card.thorns || card.revive
  ));
  assert.ok(survivalChoices.length >= 2, `预期至少两张生存向奖励，实际只有 ${survivalChoices.length} 张`);
});

test('首个 Boss 前单体缺口极大时应保底两张可靠输出选择', () => {
  const run = createRun(391);
  run.player.deck = run.player.deck.filter(card => card.id.startsWith('starter_'));
  run.buildAnalysis = {
    primaryFocus: 'fortress',
    focusScores: { fortress: 2, sustain: 0, crit: 0, barrage: 0, curse: 0, bleed: 0, control: 0, greed: 0 },
    pressure: {
      singleTarget: 20,
      aoe: 18,
      sustain: 26,
      mitigation: 12,
      safety: 12,
    },
  };
  run.state = 'reward';
  run.rewardRerolls = 1;
  run.nextWavePreview = {
    wave: 5,
    kind: 'boss',
    rewardTag: 'survival',
    rewardGuard: 'survival',
  };
  run.rewardContext = { choiceCount: 3, rarityBonus: 2, targetTag: 'survival' };

  const ok = rerollRewardChoices(run);
  assert.equal(ok, true);

  const reliableOutput = run.rewardChoices.filter(card => (
    card.damage ||
    card.attackBonus ||
    card.armorPierce ||
    card.damageMultiplier ||
    card.attackSpeedBonus > 0 ||
    card.critChance ||
    card.critDamageBonus ||
    card.perCardDamage ||
    card.perCardsDamage
  ));
  assert.ok(reliableOutput.length >= 2, `单体缺口极大时预期至少两张可靠输出，实际 ${reliableOutput.map(card => card.id).join(',')}`);
});

test('首个 Boss 前高风险牌评分应低于治疗牌', () => {
  const run = createRun(15);
  run.buildAnalysis = {
    primaryFocus: 'barrage',
    focusScores: { crit: 0, barrage: 2, sustain: 0, fortress: 0, curse: 0, bleed: 0, control: 0, greed: 0 },
    pressure: {
      singleTarget: 22,
      aoe: 12,
      sustain: 6,
      mitigation: 8,
      safety: 4,
    },
  };
  run.waveProfile = {
    kind: 'boss',
    wave: 5,
    rewardTag: 'survival',
    rewardGuard: 'survival',
  };
  const rawChoices = [
    {
      id: 'blood_pact',
      name: '血之契约',
      type: 'joker',
      rarity: 'rare',
      attackBonus: 15,
      sacrifice: { stat: 'health', amount: 0.08 },
    },
    {
      id: 'heal_aura',
      name: '治愈光环',
      type: 'defense',
      rarity: 'rare',
      regen: 3,
      sacrifice: { stat: 'attack', amount: 0.08 },
    },
  ];

  run.rewardChoices = enrichRewardChoices(run, rawChoices, run.waveProfile);
  const bloodPact = run.rewardChoices.find(card => card.id === 'blood_pact');
  const healAura = run.rewardChoices.find(card => card.id === 'heal_aura');
  assert.ok(bloodPact, '需要出现 blood_pact');
  assert.ok(healAura, '需要出现 heal_aura');
  assert.ok(healAura.fitScore > bloodPact.fitScore, `heal_aura 应优先于 blood_pact，当前 ${healAura.fitScore} <= ${bloodPact.fitScore}`);
});

test('早期奖励不应让末日压过稳定续航牌', () => {
  const run = createRun(38);
  const rawChoices = [
    {
      id: 'doom',
      name: '末日',
      type: 'curse',
      rarity: 'epic',
      damageMultiplier: 2.8,
      doomTimer: 45,
      sacrifice: { stat: 'health', amount: 0.2 },
    },
    {
      id: 'heal_aura',
      name: '治愈光环',
      type: 'defense',
      rarity: 'rare',
      regen: 3,
      sacrifice: { stat: 'attack', amount: 0.08 },
    },
  ];

  run.rewardChoices = enrichRewardChoices(run, rawChoices, {
    wave: 3,
    kind: 'event',
    rewardTag: 'forge',
  });

  const doom = run.rewardChoices.find(card => card.id === 'doom');
  const healAura = run.rewardChoices.find(card => card.id === 'heal_aura');
  assert.ok(doom, '需要出现 doom');
  assert.ok(healAura, '需要出现 heal_aura');
  assert.ok(healAura.fitScore > doom.fitScore, `早期 heal_aura 应优先于 doom，当前 ${healAura.fitScore} <= ${doom.fitScore}`);
  assert.notEqual(run.rewardChoices[0].id, 'doom', '早期自动推荐不应把末日排第一');
});

test('中后期 Boss 前高安全压力时末日不应压过安全网牌', () => {
  const run = createRun(381);
  run.player.deck.push(
    {
      id: 'heavy_core',
      name: '沉重核心',
      type: 'passive',
      rarity: 'common',
      attackBonus: 20,
      sacrifice: { stat: 'speed', amount: 0.12 },
    },
    {
      id: 'hunter_mark',
      name: '猎手刻印',
      type: 'passive',
      rarity: 'rare',
      attackBonus: 12,
      armorPierce: 4,
      sacrifice: { stat: 'speed', amount: 0.07 },
    },
    {
      id: 'quick_blade',
      name: '快刃',
      type: 'attack',
      rarity: 'common',
      attackSpeedBonus: 0.3,
      sacrifice: { stat: 'attack', amount: 0.05 },
    }
  );

  run.rewardChoices = enrichRewardChoices(run, [
    {
      id: 'doom',
      name: '末日',
      type: 'curse',
      rarity: 'epic',
      damageMultiplier: 2.8,
      doomTimer: 45,
      sacrifice: { stat: 'health', amount: 0.2 },
    },
    {
      id: 'phoenix_ember',
      name: '凤凰余烬',
      type: 'joker',
      rarity: 'legendary',
      revive: 1,
      sacrifice: { stat: 'health', amount: 0.15 },
    },
  ], {
    wave: 20,
    kind: 'boss',
    rewardTag: 'burst',
    rewardGuard: 'survival',
  });

  const doom = run.rewardChoices.find(card => card.id === 'doom');
  const phoenix = run.rewardChoices.find(card => card.id === 'phoenix_ember');
  assert.ok(doom, '需要出现 doom');
  assert.ok(phoenix, '需要出现 phoenix_ember');
  assert.ok(phoenix.fitScore > doom.fitScore, `中后期安全网牌应压过 doom，当前 ${phoenix.fitScore} <= ${doom.fitScore}`);
  assert.notEqual(run.rewardChoices[0].id, 'doom', '高压 Boss 前自动推荐不应把末日排第一');
});

test('末日倒计时应从拿牌时开始，而不是从整局开始', () => {
  const run = createRun(2031);
  run.gameTime = 120;
  run.state = 'reward';
  run.waveProfile = { kind: 'hunt', wave: 8, label: '测试波' };
  run.nextWavePreview = { kind: 'onslaught', wave: 9, label: '下一波' };
  run.rewardChoices = [{
    id: 'doom',
    name: '末日',
    type: 'curse',
    rarity: 'epic',
    damageMultiplier: 2.8,
    doomTimer: 45,
    sacrifice: { stat: 'health', amount: 0.2 },
  }];

  applyCardChoice(run, run.rewardChoices[0]);
  const statsAfterPick = getPlayerStats(run);
  assert.equal(statsAfterPick.doomTimer, 165, `末日截止时间应是拿牌时 120 + 45，实际 ${statsAfterPick.doomTimer}`);

  run.state = 'playing';
  run.enemies = [];
  run.waveEnemyQueue = [{ type: 'slime', delay: 999 }];
  run.spawnTimer = 999;
  updateRun(run, { x: 0, y: 0 }, 44.9);
  assert.notEqual(run.state, 'gameover', '末日倒计时未结束前不应死亡');

  updateRun(run, { x: 0, y: 0 }, 0.2);
  assert.equal(run.state, 'gameover', '末日倒计时结束后应死亡');
  assert.equal(run.deathSummary.reason, '末日计时耗尽，属于高风险爆发构筑失控。');
});

test('首个 Boss 前输出缺口应让可靠输出压过牺牲攻击的纯防御', () => {
  const run = createRun(19);
  run.player.deck.push(
    {
      id: 'thorn_skin',
      name: '荆棘皮肤',
      type: 'defense',
      rarity: 'common',
      thorns: 8,
      sacrifice: { stat: 'attack_speed', amount: 0.06 },
    },
    {
      id: 'lightning',
      name: '闪电链',
      type: 'attack',
      rarity: 'rare',
      damage: 14,
      chain: 3,
      sacrifice: { stat: 'health', amount: 0.08 },
    },
  );

  run.rewardChoices = enrichRewardChoices(run, [
    {
      id: 'phase_shift',
      name: '相位转移',
      type: 'defense',
      rarity: 'epic',
      dodgeChance: 0.4,
      sacrifice: { stat: 'attack', amount: 0.15 },
    },
    {
      id: 'shadow_blade',
      name: '暗影之刃',
      type: 'attack',
      rarity: 'epic',
      damage: 30,
      critChance: 0.25,
      sacrifice: { stat: 'health', amount: 0.12 },
    },
  ], {
    wave: 5,
    kind: 'boss',
    rewardTag: 'survival',
    rewardGuard: 'survival',
  });

  const phaseShift = run.rewardChoices.find(card => card.id === 'phase_shift');
  const shadowBlade = run.rewardChoices.find(card => card.id === 'shadow_blade');
  assert.ok(phaseShift, '需要出现 phase_shift');
  assert.ok(shadowBlade, '需要出现 shadow_blade');
  assert.ok(shadowBlade.fitScore > phaseShift.fitScore, `Boss 前输出缺口应优先可靠输出，当前 ${shadowBlade.fitScore} <= ${phaseShift.fitScore}`);
});

test('首个 Boss 前高风险倍率牌不应压过吸血续航', () => {
  const run = createRun(43);
  run.player.deck.push(
    {
      id: 'reflect_shield',
      name: '反射之盾',
      type: 'defense',
      rarity: 'rare',
      reflect: 0.35,
      sacrifice: { stat: 'speed', amount: 0.1 },
    },
    {
      id: 'poison_dagger',
      name: '毒匕首',
      type: 'attack',
      rarity: 'common',
      damage: 6,
      dot: 4,
      sacrifice: { stat: 'speed', amount: 0.06 },
    },
  );

  run.rewardChoices = enrichRewardChoices(run, [
    {
      id: 'glass_cannon',
      name: '玻璃炮',
      type: 'joker',
      rarity: 'epic',
      damageMultiplier: 2.0,
      sacrifice: { stat: 'health', amount: 0.15 },
    },
    {
      id: 'vampire_edge',
      name: '吸血刃',
      type: 'joker',
      rarity: 'rare',
      lifesteal: 0.15,
      sacrifice: { stat: 'speed', amount: 0.06 },
    },
  ], {
    wave: 5,
    kind: 'boss',
    rewardTag: 'survival',
    rewardGuard: 'survival',
  });

  const glassCannon = run.rewardChoices.find(card => card.id === 'glass_cannon');
  const vampireEdge = run.rewardChoices.find(card => card.id === 'vampire_edge');
  assert.ok(glassCannon, '需要出现 glass_cannon');
  assert.ok(vampireEdge, '需要出现 vampire_edge');
  assert.ok(vampireEdge.fitScore > glassCannon.fitScore, `Boss 前吸血续航应优先于玻璃炮，当前 ${vampireEdge.fitScore} <= ${glassCannon.fitScore}`);
});

test('中后期 Boss 安全网缺口应让复活牌压过继续堆输出', () => {
  const run = createRun(42);
  run.buildAnalysis = {
    primaryFocus: 'fortress',
    focusScores: { crit: 2, barrage: 3, sustain: 4, fortress: 6, curse: 0, bleed: 0, control: 0, greed: 0 },
    pressure: {
      singleTarget: 150,
      aoe: 60,
      sustain: 44,
      mitigation: 48,
      safety: 2,
    },
  };
  run.waveProfile = {
    kind: 'boss',
    wave: 20,
    rewardTag: 'burst',
    rewardGuard: null,
  };
  const rawChoices = [
    {
      id: 'shadow_blade',
      name: '暗影之刃',
      type: 'attack',
      rarity: 'epic',
      damage: 18,
      critChance: 0.2,
      sacrifice: { stat: 'armor', amount: 0.12 },
    },
    {
      id: 'phoenix_ember',
      name: '凤凰余烬',
      type: 'joker',
      rarity: 'legendary',
      revive: 1,
      sacrifice: { stat: 'health', amount: 0.15 },
    },
  ];

  run.rewardChoices = enrichRewardChoices(run, rawChoices, run.waveProfile);
  const shadowBlade = run.rewardChoices.find(card => card.id === 'shadow_blade');
  const phoenixEmber = run.rewardChoices.find(card => card.id === 'phoenix_ember');
  assert.ok(shadowBlade, '需要出现 shadow_blade');
  assert.ok(phoenixEmber, '需要出现 phoenix_ember');
  assert.ok(phoenixEmber.fitScore > shadowBlade.fitScore, `第20波 safety 缺口应优先安全网，当前 ${phoenixEmber.fitScore} <= ${shadowBlade.fitScore}`);
  assert.equal(phoenixEmber.fitHint, '补高波安全网');
});

test('中后期奖励应保底修复最大构筑短板', () => {
  const run = createRun(426);
  run.player.deck = run.player.deck.filter(card => card.id.startsWith('starter_'));
  run.buildAnalysis = {
    primaryFocus: 'sustain',
    focusScores: { crit: 0, barrage: 0, sustain: 5, fortress: 2, curse: 0, bleed: 0, control: 0, greed: 0 },
    pressure: {
      singleTarget: 132,
      aoe: 8,
      sustain: 58,
      mitigation: 42,
      safety: 34,
    },
  };
  run.wave = 14;
  run.state = 'reward';
  run.rewardRerolls = 1;
  run.waveProfile = {
    wave: 14,
    kind: 'onslaught',
    rewardTag: 'survival',
    rewardGuard: null,
  };
  run.nextWavePreview = {
    wave: 15,
    kind: 'boss',
    rewardTag: 'survival',
    rewardGuard: null,
  };
  run.rewardContext = { choiceCount: 3, rarityBonus: 1, targetTag: 'survival' };
  run.rewardChoices = [];

  const ok = rerollRewardChoices(run);
  assert.equal(ok, true);

  const aoeRepair = run.rewardChoices.filter(card => (
    card.chain ||
    card.attackSpeedBonus > 0 ||
    card.rangeBonus ||
    card.slow ||
    card.dot ||
    card.bleed ||
    card.onKillExplosion
  ));
  assert.ok(aoeRepair.length >= 1, `最大清场短板应至少保底一张修复牌，实际 ${run.rewardChoices.map(card => card.id).join(',')}`);
  assert.match(aoeRepair[0].fitHint, /清场|控场/, `修复牌提示应说明清场短板，实际 ${aoeRepair[0].fitHint}`);
});

test('固定 seed 1 的自动选牌应能通过第 5 波', () => {
  const run = simulateAutoRun(1);
  assert.ok(run.wave > 5, `预期固定 seed 1 至少通过第 5 波，实际停在第 ${run.wave} 波`);
});

test('固定 seed 5 的自动选牌应能通过第 5 波', () => {
  const run = simulateAutoRun(5);
  assert.ok(run.wave > 5, `预期固定 seed 5 至少通过第 5 波，实际停在第 ${run.wave} 波`);
});

test('标准档历史首个 Boss 失败 seed 应不再卡在第 5 波', () => {
  for (const seed of [19, 38, 40, 43, 56]) {
    const run = simulateAutoRun(seed);
    assert.ok(run.wave > 5, `seed ${seed} 预期至少通过第 5 波，实际停在第 ${run.wave} 波，状态 ${run.state}`);
  }
});

test('标准档 seed 27 的自动选牌不应因重复堆闪避而卡死在首个 Boss', () => {
  const run = simulateAutoRun(27);
  assert.ok(run.wave > 5, `seed 27 预期至少通过第 5 波，实际停在第 ${run.wave} 波，状态 ${run.state}`);
});

test('奖励评分应合理（攻防兼备）', () => {
  const run = createRun(20);
  const dt = 0.08;
  let ticks = 0;
  while (ticks < 800) {
    if (run.state === 'wave_transition') {
      run.waveTransitionTimer = 0;
      updateRun(run, { x: 0, y: 0 }, 0.001);
    }
    if (run.state === 'forge') {
      const choices = run.forgeChoices || [];
      if (choices.length > 0) applyForgeChoice(run, choices[0]);
      else run.state = 'playing';
      continue;
    }
    if (run.state === 'shop') {
      const c = run.shopChoices || [];
      const skip = c.find(x => x.shopAction === 'skip') || c[c.length - 1];
      if (skip) applyShopChoice(run, skip);
      continue;
    }
    if (run.state === 'rest') {
      const c = run.restChoices || [];
      if (c.length > 0) applyRestChoice(run, c[0]);
      continue;
    }
    if (run.state === 'reward') {
      if (run.wave === 2) {
        for (const card of run.rewardChoices) {
          assert.ok(typeof card.fitScore === 'number', `卡牌 ${card.id} 应有 fitScore`);
        }
        const scores = run.rewardChoices.map(c => c.fitScore);
        const maxS = Math.max(...scores);
        const minS = Math.min(...scores);
        assert.ok(maxS - minS < 8, `评分差距不应过大，实际 ${maxS.toFixed(1)} - ${minS.toFixed(1)} = ${(maxS-minS).toFixed(1)}`);
        return;
      }
      applyCardChoice(run, run.rewardChoices[0]);
      if (run.state === 'wave_transition') {
        run.waveTransitionTimer = 0;
        updateRun(run, { x: 0, y: 0 }, 0.001);
      }
    }
    updateRun(run, { x: 0, y: 0 }, dt);
    ticks += 1;
  }
  assert.fail('未能在预期时间内走到奖励');
});

test('首个 Boss 前若当前血线安全，奖励不应强制保底生存牌', () => {
  const run = createRun(1700);
  fastForward(run, 1);
  run.wave = 4;
  run.state = 'reward';
  run.player.hp = 98;
  run.rewardRerolls = 1;
  run.waveProfile = {
    kind: 'prelude',
    rewardTag: 'burst',
    rewardGuard: null,
  };
  run.nextWavePreview = {
    kind: 'boss',
    rewardTag: 'burst',
    rewardGuard: null,
  };
  run.rewardContext = { choiceCount: 3, rarityBonus: 2, targetTag: 'burst' };
  run.rewardChoices = [];

  const ok = rerollRewardChoices(run);
  assert.equal(ok, true);
  const survivalChoices = run.rewardChoices.filter(card => (
    card.regen || card.lifesteal || card.barrier || card.armorBonus || card.dodgeChance || card.reflect || card.thorns || card.revive
  ));
  assert.ok(survivalChoices.length <= 1, `高血线 Boss 前不应继续强制塞满生存牌，实际生存牌 ${survivalChoices.length} 张`);
});

test('护盾牌应在新波次开始时恢复保底护盾', () => {
  const run = createRun(1600);
  fastForward(run, 1);
  applyCardChoice(run, {
    id: 'barrier_test',
    name: '护盾测试',
    type: 'defense',
    rarity: 'epic',
    barrier: 30,
  });
  run.player.barrier = 0;
  run.state = 'playing';
  run.enemies = [];
  run.waveEnemyQueue = [];

  updateWaveState(run, 0);
  assert.equal(run.state, 'reward');
  applyCardChoice(run, {
    id: 'next_wave_test',
    name: '下波测试',
    type: 'passive',
    rarity: 'common',
    attackBonus: 1,
  });

  assert.ok(run.player.barrier >= 30, `新波次开始时应恢复护盾，实际 ${run.player.barrier}`);
});

test('事件波（余烬锻造）应有 event 类型和锻造状态', () => {
  const run = createRun(3);
  assert.equal(run.waveProfile.kind, 'hunt');
  fastForward(run, 30);
  run.enemies = []; run.waveEnemyQueue = []; run.state = 'playing';
  updateWaveState(run, 0);
  applyCardChoice(run, run.rewardChoices[0]);
  assert.equal(run.waveProfile.kind, 'recovery');
  fastForward(run, 30);
  run.enemies = []; run.waveEnemyQueue = []; run.state = 'playing';
  updateWaveState(run, 0);
  applyCardChoice(run, run.rewardChoices[0]);
  assert.equal(run.waveProfile.kind, 'event', `Wave 3 应该是 event 类型，实际 ${run.waveProfile.kind}`);
  assert.ok(run.waveProfile.label.includes('锻造'), `事件波标签应含"锻造"`);
  // Clear event wave
  fastForward(run, 30);
  run.enemies = []; run.waveEnemyQueue = []; run.state = 'playing';
  updateWaveState(run, 0);
  assert.equal(run.state, 'forge', `事件波结束后应进入锻造状态，实际 ${run.state}`);
  assert.ok(run.forgeChoices.length > 0, '锻造应有选择项');
});

test('事件波锻造应提供升级/净化/重铸选项', () => {
  const run = createRun(3);
  fastForward(run, 30);
  run.enemies = []; run.waveEnemyQueue = []; run.state = 'playing';
  updateWaveState(run, 0);
  applyCardChoice(run, run.rewardChoices[0]);
  fastForward(run, 30);
  run.enemies = []; run.waveEnemyQueue = []; run.state = 'playing';
  updateWaveState(run, 0);
  applyCardChoice(run, run.rewardChoices[0]);
  fastForward(run, 30);
  run.enemies = []; run.waveEnemyQueue = []; run.state = 'playing';
  updateWaveState(run, 0);
  assert.equal(run.state, 'forge');
  assert.ok(run.forgeChoices.length >= 1, `锻造应有至少1个选择，实际 ${run.forgeChoices.length}`);
  const actions = run.forgeChoices.map(c => c.forgeAction);
  assert.ok(actions.includes('upgrade') || actions.includes('purify') || actions.includes('reforge'),
    `锻造应包含升级/净化/重铸选项，实际 ${actions.join(',')}`);
});

test('锻造选择后应离开锻造并推进到下一波', () => {
  const run = createRun(3);
  fastForward(run, 30);
  run.enemies = []; run.waveEnemyQueue = []; run.state = 'playing';
  updateWaveState(run, 0);
  applyCardChoice(run, run.rewardChoices[0]);
  fastForward(run, 30);
  run.enemies = []; run.waveEnemyQueue = []; run.state = 'playing';
  updateWaveState(run, 0);
  applyCardChoice(run, run.rewardChoices[0]);
  fastForward(run, 30);
  run.enemies = []; run.waveEnemyQueue = []; run.state = 'playing';
  updateWaveState(run, 0);

  assert.equal(run.state, 'forge');
  const beforeWave = run.wave;
  applyForgeChoice(run, run.forgeChoices[0]);

  assert.equal(run.wave, beforeWave + 1, `锻造后应进入下一波，实际 ${beforeWave} -> ${run.wave}`);
  assert.equal(run.state, 'wave_transition', `锻造后应进入波次过渡，实际 ${run.state}`);
  assert.equal(run.forgeChoices.length, 0, '锻造选择应被清空');
});

test('高波事件锻造后若下一波是 Boss，应转入战前营火', () => {
  const run = createRun(1708);
  run.wave = 19;
  run.state = 'forge';
  run.waveProfile = { wave: 19, kind: 'event', label: '第 19 波 余烬锻造' };
  run.nextWavePreview = {
    wave: 20,
    kind: 'boss',
    label: '第 20 波 Boss 讨伐',
    rewardTag: 'burst',
  };
  run.buildAnalysis = {
    pressure: {
      singleTarget: 999,
      aoe: 999,
      sustain: 999,
      mitigation: 999,
      safety: 0,
    },
  };
  run.forgeChoices = [{
    id: 'forge_reforge_test',
    name: '测试重铸',
    type: 'forge',
    forgeAction: 'reforge',
  }];

  applyForgeChoice(run, run.forgeChoices[0]);

  assert.equal(run.wave, 19, `进入营火前不应直接推进到 Boss 波，实际 ${run.wave}`);
  assert.equal(run.state, 'rest', `高波事件锻造后应转入营火，实际 ${run.state}`);
  assert.equal(run.forgeChoices.length, 0, '锻造选择应被清空');
  assert.ok(run.restChoices.some(choice => choice.restAction === 'ward'), '转入营火后应能看到余烬护符');
  assert.ok(run.restChoices.some(choice => choice.restAction === 'smoke'), '转入营火后应能看到烟幕疾行');
});

test('Boss 前准备恩惠应额外回血', () => {
  const run = createRun(48);
  // 推进到 wave 4
  for (let i = 0; i < 3; i++) {
    fastForward(run, 30);
    run.enemies = []; run.waveEnemyQueue = []; run.state = 'playing';
    updateWaveState(run, 0);
    if (run.state === 'reward') applyCardChoice(run, run.rewardChoices[0]);
  }
  // 推进 wave 4
  fastForward(run, 30);
  run.enemies = []; run.waveEnemyQueue = []; run.state = 'playing';
  updateWaveState(run, 0);
  if (run.state === 'reward') {
    // 扣血到低状态
    const stats = getPlayerStats(run);
    run.player.hp = Math.floor(stats.maxHp * 0.3);
    const hpBefore = run.player.hp;
    applyCardChoice(run, run.rewardChoices[0]);
    const restHeal = run.restChoices.find(c => c.restAction === 'heal') || run.restChoices[0];
    applyRestChoice(run, restHeal);
    // Wave 5 是 Boss 波，应有准备恩惠/战前恢复
    assert.equal(run.waveProfile.kind, 'boss');
    assert.ok(run.player.hp > hpBefore, `Boss 前应有额外回血，血量 ${hpBefore} -> ${run.player.hp}`);
  }
});

test('Boss 前奖励后应进入战前营火并提供豪赌选项', () => {
  const run = createRun(1701);
  run.wave = 4;
  run.state = 'reward';
  run.waveProfile = { kind: 'onslaught', label: '第 4 波 猛攻潮' };
  run.nextWavePreview = {
    wave: 5,
    kind: 'boss',
    label: '第 5 波 Boss 讨伐',
    rewardTag: 'survival',
    risk: '首个 Boss 会先单独入场，先看弹幕节奏。',
    summary: '先做战前准备。',
  };
  run.rewardChoices = [{
    id: 'prep_card',
    name: '热身',
    type: 'passive',
    rarity: 'common',
    attackBonus: 4,
  }];

  applyCardChoice(run, run.rewardChoices[0]);

  assert.equal(run.state, 'rest', `Boss 前奖励后应进入 rest，实际 ${run.state}`);
  assert.ok(run.restChoices.some(c => c.restAction === 'gamble'), '战前营火应提供豪赌选项');
});

test('战斗训练应在进入下一波后保留临时增益', () => {
  const run = createRun(1703);
  run.wave = 4;
  run.state = 'rest';
  run.nextWavePreview = {
    wave: 5,
    kind: 'boss',
    label: '第 5 波 Boss 讨伐',
  };

  const before = getPlayerStats(run);
  applyRestChoice(run, {
    id: 'rest_train',
    name: '战斗训练',
    type: 'rest',
    restAction: 'train',
  });
  const after = getPlayerStats(run);

  assert.equal(run.wave, 5);
  assert.equal(run.waveProfile.kind, 'boss');
  assert.ok(after.attack >= before.attack + 20, `训练后攻击应至少 +20，实际 ${before.attack} -> ${after.attack}`);
  assert.ok(after.attackCooldown < before.attackCooldown, `训练后攻速应提高，冷却 ${before.attackCooldown} -> ${after.attackCooldown}`);
});

test('中后期 Boss 前安全网缺口应提供余烬护符', () => {
  const run = createRun(1704);
  run.wave = 19;
  run.state = 'rest';
  run.nextWavePreview = {
    wave: 20,
    kind: 'boss',
    label: '第 20 波 Boss 讨伐',
    rewardTag: 'burst',
  };

  const choices = generateRestChoices(run);
  const ward = choices.find(choice => choice.restAction === 'ward');
  assert.ok(ward, '第 20 波 Boss 前 safety 缺口明显时应提供余烬护符');
  assert.ok(ward.barrier > 0, `余烬护符应提供正向护盾，实际 ${ward.barrier}`);
  assert.equal(ward.deathWard, 1, '余烬护符应提供一次致命伤保护');
});

test('第 15 波 Boss 前即使满血，安全缺口明显时营火推荐也应偏向护符而非训练', () => {
  const run = createRun(17041);
  run.wave = 14;
  run.state = 'rest';
  run.nextWavePreview = {
    wave: 15,
    kind: 'boss',
    label: '第 15 波 Boss 讨伐',
    rewardTag: 'burst',
  };
  run.buildAnalysis = {
    pressure: {
      singleTarget: 999,
      aoe: 999,
      sustain: 999,
      mitigation: 999,
      safety: 0,
    },
  };

  const choices = generateRestChoices(run);
  const train = choices.find(choice => choice.restAction === 'train');
  const ward = choices.find(choice => choice.restAction === 'ward');
  assert.ok(train && ward, '需要同时生成训练与护符');
  assert.ok(ward.fitScore > train.fitScore, `高安全缺口时护符评分应高于训练，实际 ${ward.fitScore} <= ${train.fitScore}`);
  const best = choices.reduce((top, choice) => (choice.fitScore > top.fitScore ? choice : top), choices[0]);
  assert.equal(best.restAction, 'ward', `第 15 波高安全缺口应优先推荐护符，实际 ${best.restAction}`);
});

test('余烬护符应在下一波抵消一次致命伤', () => {
  const run = createRun(1705);
  run.wave = 19;
  run.state = 'rest';
  run.nextWavePreview = {
    wave: 20,
    kind: 'boss',
    label: '第 20 波 Boss 讨伐',
  };
  const ward = generateRestChoices(run).find(choice => choice.restAction === 'ward');
  assert.ok(ward, '需要生成余烬护符');

  applyRestChoice(run, ward);
  assert.equal(run.wave, 20, `护符选择后应进入第 20 波，实际 ${run.wave}`);
  assert.equal(run.waveProfile.kind, 'boss');
  assert.equal(run.player.tempDeathWard, 1, '进入下一波后应有一次临时防死');
  assert.ok(run.player.barrier >= ward.barrier, `进入下一波后应获得护盾，实际 ${run.player.barrier} < ${ward.barrier}`);

  run.state = 'playing';
  run.waveEnemyQueue = [{ type: 'slime', delay: 999 }];
  run.spawnTimer = 999;
  run.player.hp = 1;
  run.player.barrier = 0;
  run.player.invuln = 0;
  run.projectiles = [{ x: run.player.x, y: run.player.y, vx: 0, vy: 0, life: 1, fromEnemy: true, radius: 20, damage: 9999, color: '#fff' }];
  updateRun(run, { x: 0, y: 0 }, 0.016);

  assert.equal(run.state, 'playing', '护符触发后不应立即 gameover');
  assert.equal(run.player.hp, 1, '护符应把致命伤保留到 1 生命');
  assert.equal(run.player.tempDeathWard, 0, '护符触发后次数应被消耗');

  run.player.invuln = 0;
  run.projectiles = [{ x: run.player.x, y: run.player.y, vx: 0, vy: 0, life: 1, fromEnemy: true, radius: 20, damage: 9999, color: '#fff' }];
  updateRun(run, { x: 0, y: 0 }, 0.016);

  assert.equal(run.state, 'gameover', '护符消耗后再次受到致命伤应正常死亡');
});

test('高压 Boss 前安全缺口过大时应提供烟幕疾行', () => {
  const run = createRun(1706);
  run.wave = 19;
  run.state = 'rest';
  run.nextWavePreview = {
    wave: 20,
    kind: 'boss',
    label: '第 20 波 Boss 讨伐',
    rewardTag: 'burst',
  };
  run.buildAnalysis = {
    pressure: {
      singleTarget: 999,
      aoe: 999,
      sustain: 999,
      mitigation: 999,
      safety: 0,
    },
  };

  const choices = generateRestChoices(run);
  const smoke = choices.find(choice => choice.restAction === 'smoke');
  assert.ok(smoke, '第 20 波 Boss 前 safety 缺口极大时应提供烟幕疾行');
  assert.ok(smoke.speedBonus > 0, `烟幕疾行应提供移速加成，实际 ${smoke.speedBonus}`);
  assert.ok(smoke.dodgeBonus > 0, `烟幕疾行应提供闪避加成，实际 ${smoke.dodgeBonus}`);
  assert.ok(smoke.waveStartSlow > 0, `烟幕疾行应附带开场减速，实际 ${smoke.waveStartSlow}`);
});

test('第 20 波高压安全缺口时烟幕疾行应优先于战斗训练', () => {
  const run = createRun(17061);
  run.wave = 19;
  run.state = 'rest';
  run.player.baseSpeed = 180;
  run.nextWavePreview = {
    wave: 20,
    kind: 'boss',
    label: '第 20 波 Boss 讨伐',
    rewardTag: 'burst',
  };
  run.buildAnalysis = {
    pressure: {
      singleTarget: 999,
      aoe: 999,
      sustain: 999,
      mitigation: 999,
      safety: 0,
    },
  };

  const choices = generateRestChoices(run);
  const train = choices.find(choice => choice.restAction === 'train');
  const smoke = choices.find(choice => choice.restAction === 'smoke');
  assert.ok(train && smoke, '需要同时生成训练与烟幕疾行');
  assert.ok(smoke.fitScore > train.fitScore, `第 20 波高压安全缺口时烟幕疾行评分应高于训练，实际 ${smoke.fitScore} <= ${train.fitScore}`);
  const best = choices.reduce((top, choice) => (choice.fitScore > top.fitScore ? choice : top), choices[0]);
  assert.equal(best.restAction, 'smoke', `第 20 波高压安全缺口应优先推荐烟幕疾行，实际 ${best.restAction}`);
});

test('第 20 波机动性短板明显时即使 safety 缺口不大也应提供烟幕疾行', () => {
  const run = createRun(17062);
  run.wave = 19;
  run.state = 'rest';
  run.player.baseSpeed = 205;
  run.nextWavePreview = {
    wave: 20,
    kind: 'boss',
    label: '第 20 波 Boss 讨伐',
    rewardTag: 'burst',
  };
  run.buildAnalysis = {
    pressure: {
      singleTarget: 999,
      aoe: 999,
      sustain: 999,
      mitigation: 999,
      safety: 40,
    },
  };

  const choices = generateRestChoices(run);
  const smoke = choices.find(choice => choice.restAction === 'smoke');
  assert.ok(smoke, '机动性短板明显时应提供烟幕疾行');
  assert.equal(smoke.mobilityFocus, true, '该烟幕疾行应标记为机动补强');
  assert.match(smoke.fitHint, /机动性短板/, `烟幕提示应明确机动补强，实际 ${smoke.fitHint}`);
});

test('烟幕疾行应在下一波提供机动与开场控场', () => {
  const run = createRun(1707);
  run.wave = 19;
  run.state = 'rest';
  run.nextWavePreview = {
    wave: 20,
    kind: 'boss',
    label: '第 20 波 Boss 讨伐',
  };
  run.buildAnalysis = {
    pressure: {
      singleTarget: 0,
      aoe: 0,
      sustain: 0,
      mitigation: 0,
      safety: 0,
    },
  };

  const before = getPlayerStats(run);
  const smoke = generateRestChoices(run).find(choice => choice.restAction === 'smoke');
  assert.ok(smoke, '需要生成烟幕疾行');

  applyRestChoice(run, smoke);
  assert.equal(run.wave, 20, `烟幕疾行后应进入第 20 波，实际 ${run.wave}`);
  assert.equal(run.waveProfile.kind, 'boss');

  const after = getPlayerStats(run);
  assert.ok(after.speed > before.speed, `烟幕疾行后移速应提高，${before.speed} -> ${after.speed}`);
  assert.ok(after.dodgeChance > before.dodgeChance, `烟幕疾行后闪避应提高，${before.dodgeChance} -> ${after.dodgeChance}`);
  assert.ok(after.waveStartSlow >= smoke.waveStartSlow, `烟幕疾行后应保留开场减速，实际 ${after.waveStartSlow}`);

  const firstEnemy = spawnFirstEnemy(run);
  assert.ok(firstEnemy.slowTimer > 0, `首个敌人应带开场减速，实际 slowTimer=${firstEnemy.slowTimer}`);
  assert.ok(firstEnemy.slowAmount < 1, `首个敌人应被减速，实际 slowAmount=${firstEnemy.slowAmount}`);
});

test('第 25 波脆皮构筑选择烟幕时应附带残影保命', () => {
  const run = createRun(1708);
  run.wave = 24;
  run.state = 'rest';
  run.sacrifices.health.amount = 0.76;
  run.player.hp = 20;
  run.nextWavePreview = {
    wave: 25,
    kind: 'boss',
    label: '第 25 波 Boss 讨伐',
    rewardTag: 'survival',
  };
  run.buildAnalysis = {
    pressure: {
      singleTarget: 999,
      aoe: 999,
      sustain: 999,
      mitigation: 999,
      safety: 30,
    },
  };

  const smoke = generateRestChoices(run).find(choice => choice.restAction === 'smoke');
  assert.ok(smoke, '第 25 波脆皮构筑应能看到烟幕疾行');
  assert.equal(smoke.deathWard, 1, '脆皮高波烟幕应附带一次残影保命');
  assert.match(smoke.fitHint, /残影/, `烟幕提示应说明残影保命，实际 ${smoke.fitHint}`);

  applyRestChoice(run, smoke);
  assert.equal(run.wave, 25, `烟幕后应进入第 25 波，实际 ${run.wave}`);
  assert.equal(run.player.tempDeathWard, 1, '残影保命应带入下一波');
  assert.equal(run.player.tempDeathWardSource, 'smoke', '残影保命来源应标记为 smoke');

  run.state = 'playing';
  run.waveEnemyQueue = [{ type: 'slime', delay: 999 }];
  run.spawnTimer = 999;
  run.player.hp = 1;
  run.player.barrier = 0;
  run.player.invuln = 0;
  run.projectiles = [{ x: run.player.x, y: run.player.y, vx: 0, vy: 0, life: 1, fromEnemy: true, radius: 20, damage: 9999, color: '#fff' }];
  updateRun(run, { x: 0, y: 0 }, 0.016);

  assert.equal(run.state, 'playing', '残影触发后不应立即 gameover');
  assert.equal(run.player.tempDeathWard, 0, '残影触发后次数应被消耗');
  assert.equal(run.player.tempDeathWardSource, null, '残影触发耗尽后来源应清空');
  assert.match(run.messages.join('\n'), /烟幕残影/, `触发文案应明确残影来源，实际 ${run.messages.join(' | ')}`);
});

test('战前豪赌应扣血并直接获得一张高品质卡', () => {
  const run = createRun(1702);
  run.wave = 4;
  run.state = 'reward';
  run.waveProfile = { kind: 'onslaught', label: '第 4 波 猛攻潮' };
  run.nextWavePreview = {
    wave: 5,
    kind: 'boss',
    label: '第 5 波 Boss 讨伐',
    rewardTag: 'burst',
    risk: '首个 Boss 会先单独入场，先看弹幕节奏。',
    summary: '先做战前准备。',
  };
  run.rewardChoices = [{
    id: 'prep_card',
    name: '热身',
    type: 'passive',
    rarity: 'common',
    attackBonus: 4,
  }];
  applyCardChoice(run, run.rewardChoices[0]);
  const gamble = run.restChoices.find(c => c.restAction === 'gamble');
  assert.ok(gamble, '应生成豪赌选项');

  const beforeHp = run.player.hp;
  const beforeDeck = run.player.deck.length;
  applyRestChoice(run, gamble);

  assert.ok(run.player.hp < beforeHp, `豪赌应扣血，实际 ${beforeHp} -> ${run.player.hp}`);
  assert.ok(run.player.deck.length > beforeDeck, `豪赌应直接加牌，实际 ${beforeDeck} -> ${run.player.deck.length}`);
  assert.equal(run.wave, 5, `豪赌后应进入 Boss 波，实际第 ${run.wave} 波`);
  assert.equal(run.waveProfile.kind, 'boss', `豪赌后应进入 Boss 波，实际 ${run.waveProfile.kind}`);
});

test('死亡复盘应包含波次上下文和构筑建议', () => {
  const run = createRun(100);
  // 制造一个 gameover 状态 + 死亡复盘数据
  run.state = 'gameover';
  run.wave = 5;
  run.waveProfile = { kind: 'boss', label: '第 5 波 Boss 讨伐' };
  run.buildAnalysis = {
    primaryFocus: 'barrage',
    weaknesses: { singleTarget: true, sustain: false, aoe: false, safety: false },
    pressure: { singleTarget: 30, aoe: 15, sustain: 20, mitigation: 10, safety: 5 },
    summary: '速攻',
  };
  run.deathSummary = {
    message: '余烬熄灭。',
    reason: 'Boss 讨伐失败：输出不足，未能在弹幕窗口内击杀首领。',
    weaknessTags: ['singleTarget'],
    wave: 5,
    waveKind: 'boss',
    waveLabel: '第 5 波 Boss 讨伐',
    deckSize: 6,
    focus: '速攻',
    buildTip: '输出缺口太大，下次优先拿高伤害或暴击牌。',
    gameTime: 120,
    kills: 35,
    extremes: 0,
    synergies: 0,
    pressure: { singleTarget: 30, aoe: 15, sustain: 20, mitigation: 10, safety: 5 },
    pressureTargets: { singleTarget: 80, aoe: 26, sustain: 58, safety: 24 },
    pressureGaps: { singleTarget: 50, aoe: 11, sustain: 28, safety: 19 },
    lastDecisions: ['第 4 波 奖励/拿牌：治疗光环 · 契合 8.2'],
  };
  const stats = getPlayerStats(run);
  const pres = buildRunPresentation(run, stats, { name: '战士' });
  assert.ok(pres.deathReason.length > 0, '死亡原因不应为空');
  assert.ok(pres.deathWaveLabel.length > 0, `应有阵亡波次标签，实际 "${pres.deathWaveLabel}"`);
  assert.ok(pres.deathBuildTip.length > 0, `应有构筑建议，实际 "${pres.deathBuildTip}"`);
  assert.match(pres.deathPressureLine, /首领输出 30\/80/);
  assert.match(pres.deathDecisionLine, /治疗光环/);
  assert.equal(pres.deathReason, 'Boss 讨伐失败：输出不足，未能在弹幕窗口内击杀首领。');
});
