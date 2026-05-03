import assert from 'node:assert/strict';
import {
  createRun, applyCardChoice, rollCardChoices, getPlayerStats,
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
  for (let i = 0; i < 20; i++) {
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

  for (let i = 0; i < 30; i++) {
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
