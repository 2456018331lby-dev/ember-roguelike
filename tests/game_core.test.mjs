import assert from 'node:assert/strict';
import {
  createRun,
  applyCardChoice,
  rollCardChoices,
  getPlayerStats,
  resolveAutoAttack,
  updateWaveState,
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

test('新开局拥有基础属性、初始卡牌和第1波', () => {
  const run = createRun(123);
  assert.equal(run.wave, 1);
  assert.equal(run.player.hp, 100);
  assert.equal(run.player.deck.length >= 3, true);
  assert.equal(run.jokers.length, 0);
});

test('献祭卡牌会增加能力并记录牺牲代价', () => {
  const run = createRun(123);
  applyCardChoice(run, {
    id: 'flame_sword', name: '烈焰剑', type: 'attack', damage: 18,
    sacrifice: { stat: 'speed', amount: 0.15 }
  });
  const stats = getPlayerStats(run);
  assert.equal(run.sacrifices.speed.count, 1);
  assert.equal(stats.speed < 220, true);
  assert.equal(run.player.deck.some(c => c.id === 'flame_sword'), true);
});

test('连续牺牲3次同属性会触发极端化效果', () => {
  const run = createRun(123);
  for (let i = 0; i < 3; i++) {
    applyCardChoice(run, {
      id: `slow_power_${i}`, name: '沉重力量', type: 'passive', attackBonus: 3,
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

test('自动攻击会伤害最近敌人并触发击杀奖励', () => {
  const run = createRun(123);
  run.player.x = 100; run.player.y = 100;
  run.enemies = [{ id: 'e1', x: 120, y: 100, hp: 5, maxHp: 5, speed: 0, damage: 0, radius: 12 }];
  resolveAutoAttack(run, 999);
  assert.equal(run.enemies.length, 0);
  assert.equal(run.kills, 1);
});

test('波次清空后进入奖励状态，选择奖励后进入下一波', () => {
  const run = createRun(123);
  run.enemies = [];
  updateWaveState(run, 1);
  assert.equal(run.state, 'reward');
  applyCardChoice(run, rollCardChoices(run, 3)[0]);
  assert.equal(run.wave, 2);
  assert.equal(run.state, 'playing');
});
