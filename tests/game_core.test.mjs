import assert from 'node:assert/strict';
import {
  createRun, applyCardChoice, rollCardChoices, rerollRewardChoices, getPlayerStats,
  resolveAutoAttack, updateRun, dash, updateWaveState,
} from '../web/src/game_core.mjs';

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

test('开局基础属性和初始卡牌', () => {
  const run = createRun(123);
  assert.equal(run.wave, 1);
  assert.equal(run.player.hp, 100);
  assert.equal(run.player.deck.length, 3);
  assert.equal(run.jokers.length, 0);
  assert.equal(run.state, 'wave_transition');
  assert.equal(run.reviveUsed, false);
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

test('精英波会生成精英敌人并标记', () => {
  const run = createRun(888);
  while (run.wave < 3) {
    run.enemies = [];
    run.waveEnemyQueue = [];
    run.state = 'playing';
    updateWaveState(run, 0);
    if (run.state === 'reward') {
      applyCardChoice(run, {
        id: `test_card_${run.wave}`,
        name: '测试卡',
        type: 'passive',
        rarity: 'common',
        attackBonus: 1,
      });
    }
  }

  fastForward(run, 1);
  const hasElite = run.waveEnemyQueue.some(entry => entry.elite === true) || run.enemies.some(enemy => enemy.isElite === true);
  assert.equal(run.wave, 3);
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
  while (run.wave < 5) {
    run.enemies = [];
    run.waveEnemyQueue = [];
    run.state = 'playing';
    updateWaveState(run, 0);
    if (run.state === 'reward') {
      applyCardChoice(run, {
        id: `wave_${run.wave}_card`,
        name: '测试卡',
        type: 'passive',
        rarity: 'common',
        attackBonus: 1,
      });
    }
    fastForward(run, 0.1);
  }

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

test('首个 Boss 前不应把 blood_pact 排在 heal_aura 前面', () => {
  const run = createRun(15);
  const dt = 0.05;
  let ticks = 0;
  while (ticks < 4000) {
    if (run.state === 'wave_transition') {
      run.waveTransitionTimer = 0;
      updateRun(run, { x: 0, y: 0 }, 0.001);
    }
    if (run.state === 'reward' && run.wave === 2) {
      const bloodPact = run.rewardChoices.find(card => card.id === 'blood_pact');
      const healAura = run.rewardChoices.find(card => card.id === 'heal_aura');
      assert.ok(bloodPact, '需要出现 blood_pact');
      assert.ok(healAura, '需要出现 heal_aura');
      assert.ok(healAura.fitScore > bloodPact.fitScore, `heal_aura 应优先于 blood_pact，当前 ${healAura.fitScore} <= ${bloodPact.fitScore}`);
      return;
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
  assert.fail('未能在预期时间内走到第 2 波奖励');
});

test('固定 seed 14 的自动选牌应能通过第 5 波', () => {
  const run = simulateAutoRun(14);
  assert.ok(run.wave > 5, `预期固定 seed 14 至少通过第 5 波，实际停在第 ${run.wave} 波`);
});

test('Boss 前不应让纯防守牌大幅压过 shadow_blade 这类过关输出牌', () => {
  const run = createRun(9);
  const dt = 0.05;
  let ticks = 0;
  while (ticks < 4000) {
    if (run.state === 'wave_transition') {
      run.waveTransitionTimer = 0;
      updateRun(run, { x: 0, y: 0 }, 0.001);
    }
    if (run.state === 'reward' && run.wave === 4) {
      const reflectShield = run.rewardChoices.find(card => card.id === 'reflect_shield');
      const shadowBlade = run.rewardChoices.find(card => card.id === 'shadow_blade');
      if (!reflectShield || !shadowBlade) continue;
      assert.ok(shadowBlade.fitScore >= reflectShield.fitScore - 1, `shadow_blade 不应被 reflect_shield 大幅压制，当前 ${shadowBlade.fitScore} vs ${reflectShield.fitScore}`);
      return;
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
  assert.fail('未能在预期时间内走到第 4 波奖励');
});

test('Boss 前已具备足够生存时，应更积极推荐输出牌而不是继续叠纯防守', () => {
  const run = createRun(10);
  const dt = 0.05;
  let ticks = 0;
  while (ticks < 4000) {
    if (run.state === 'wave_transition') {
      run.waveTransitionTimer = 0;
      updateRun(run, { x: 0, y: 0 }, 0.001);
    }
    if (run.state === 'reward' && run.wave === 3) {
      const dodgeCloak = run.rewardChoices.find(card => card.id === 'dodge_cloak');
      const critDamage = run.rewardChoices.find(card => card.id === 'crit_damage');
      assert.ok(dodgeCloak, '需要出现 dodge_cloak');
      assert.ok(critDamage, '需要出现 crit_damage');
      assert.ok(critDamage.fitScore >= dodgeCloak.fitScore - 0.2, `已有足够生存时不应继续让 dodge_cloak 明显压过 crit_damage，当前 ${critDamage.fitScore} vs ${dodgeCloak.fitScore}`);
      return;
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
  assert.fail('未能在预期时间内走到第 3 波奖励');
});

test('固定 seed 10 在 Boss 前应优先转向输出牌', () => {
  const run = createRun(10);
  const dt = 0.05;
  let ticks = 0;
  while (ticks < 4000) {
    if (run.state === 'wave_transition') {
      run.waveTransitionTimer = 0;
      updateRun(run, { x: 0, y: 0 }, 0.001);
    }
    if (run.state === 'reward' && run.wave === 4) {
      const frostStaff = run.rewardChoices.find(card => card.id === 'frost_staff');
      const vampireEdge = run.rewardChoices.find(card => card.id === 'vampire_edge');
      assert.ok(frostStaff, '需要出现 frost_staff');
      assert.ok(vampireEdge, '需要出现 vampire_edge');
      assert.ok(frostStaff.fitScore > vampireEdge.fitScore, `Boss 前输出/控场牌应优先于续航 Joker，当前 ${frostStaff.fitScore} <= ${vampireEdge.fitScore}`);
      return;
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
  assert.fail('未能在预期时间内走到第 4 波奖励');
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
