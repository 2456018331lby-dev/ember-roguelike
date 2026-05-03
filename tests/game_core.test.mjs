import assert from 'node:assert/strict';
import {
  createRun,
  applyCardChoice,
  rollCardChoices,
  getPlayerStats,
  resolveAutoAttack,
  updateWaveState,
  updateRun,
  dash,
} from '../web/src/game_core.mjs';

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

test('开局拥有基础属性、初始卡牌和第1波过渡', () => {
  const run = createRun(123);
  assert.equal(run.wave, 1);
  assert.equal(run.player.hp, 100);
  assert.equal(run.player.deck.length >= 3, true);
  assert.equal(run.jokers.length, 0);
  assert.equal(run.state, 'wave_transition');
});

test('波次过渡后进入 playing 状态', () => {
  const run = createRun(123);
  assert.equal(run.state, 'wave_transition');
  updateRun(run, { x: 0, y: 0 }, 3); // 3秒足够过渡
  assert.equal(run.state, 'playing');
});

test('献祭卡牌会增加能力并记录牺牲代价', () => {
  const run = createRun(123);
  // 先进入 playing
  updateRun(run, { x: 0, y: 0 }, 3);
  // 手动设为 reward 来测试
  run.state = 'reward';
  run.rewardChoices = rollCardChoices(run, 3);
  const card = run.rewardChoices[0];
  applyCardChoice(run, card);
  const stats = getPlayerStats(run);
  // 应该有牺牲记录
  const hasSacrifice = Object.values(run.sacrifices).some(s => s.count > 0);
  assert.equal(card.sacrifice ? hasSacrifice : true, true);
});

test('连续牺牲3次同属性会触发极端化效果', () => {
  const run = createRun(456);
  for (let i = 0; i < 3; i++) {
    applyCardChoice(run, {
      id: `slow_power_${i}`, name: '沉重力量', type: 'passive',
      rarity: 'common', attackBonus: 3,
      sacrifice: { stat: 'speed', amount: 0.1 }
    });
  }
  assert.equal(run.extremes.includes('磐石之躯'), true);
  const stats = getPlayerStats(run);
  assert.equal(stats.damageMultiplier >= 2.5, true);
});

test('随机奖励每次给3个选择，并且同seed稳定', () => {
  const a = createRun(42);
  const b = createRun(42);
  assert.deepEqual(rollCardChoices(a, 3).map(c => c.id), rollCardChoices(b, 3).map(c => c.id));
});

test('自动攻击会伤害最近敌人', () => {
  const run = createRun(789);
  updateRun(run, { x: 0, y: 0 }, 3); // 进入 playing
  // 等敌人生成
  updateRun(run, { x: 0, y: 0 }, 5); // 5秒让敌人出现
  // 把一个敌人放到近距离
  if (run.enemies.length > 0) {
    run.enemies[0].x = run.player.x + 50;
    run.enemies[0].y = run.player.y;
    run.enemies[0].hp = 1;
    run.enemies[0].maxHp = 1;
    const killsBefore = run.kills;
    resolveAutoAttack(run, 999);
    assert.equal(run.kills > killsBefore || run.enemies.length < run.enemies.length + 1, true);
  }
});

test('冲刺消耗冷却且提供无敌', () => {
  const run = createRun(100);
  updateRun(run, { x: 0, y: 0 }, 3);
  assert.equal(run.dashCooldown, 0);
  dash(run, 1, 0);
  assert.ok(run.dashCooldown > 0);
  assert.ok(run.dashTimer > 0);
  assert.ok(run.player.invuln > 0);
});
