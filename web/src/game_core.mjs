import { getMetaBonuses } from './save.mjs';

// ============================================================
// 余烬 Ember - 游戏核心逻辑 v4
// 完整重写：敌人AI、弹幕系统、复活限制、数值平衡
// ============================================================

// ---- 卡牌池（40张，5类×4稀有度+特殊） ----
const CARD_POOL = [
  // ===== 攻击牌 =====
  { id: 'strike_plus', name: '锋利斩击', type: 'attack', rarity: 'common', damage: 10, desc: '攻击伤害 +10', sacrifice: { stat: 'health', amount: 0.05 } },
  { id: 'flame_sword', name: '烈焰剑', type: 'attack', rarity: 'rare', damage: 22, desc: '攻击附带烈焰，伤害 +22', sacrifice: { stat: 'speed', amount: 0.1 } },
  { id: 'quick_blade', name: '快刃', type: 'attack', rarity: 'common', attackSpeedBonus: 0.3, desc: '攻速 +30%', sacrifice: { stat: 'attack', amount: 0.05 } },
  { id: 'lightning', name: '闪电链', type: 'attack', rarity: 'rare', damage: 14, chain: 3, desc: '攻击弹射 3 个额外敌人', sacrifice: { stat: 'health', amount: 0.08 } },
  { id: 'poison_dagger', name: '毒匕首', type: 'attack', rarity: 'common', damage: 6, dot: 4, desc: '攻击附带中毒 4/秒', sacrifice: { stat: 'speed', amount: 0.06 } },
  { id: 'bleed_axe', name: '血斧', type: 'attack', rarity: 'rare', damage: 18, bleed: 6, desc: '攻击附带流血 6/秒', sacrifice: { stat: 'attack_speed', amount: 0.08 } },
  { id: 'shadow_blade', name: '暗影之刃', type: 'attack', rarity: 'epic', damage: 30, critChance: 0.25, desc: '25% 暴击率，暴击伤害 x2.5', sacrifice: { stat: 'health', amount: 0.12 } },
  { id: 'frost_staff', name: '冰霜法杖', type: 'attack', rarity: 'rare', damage: 12, slow: 0.5, desc: '攻击减速 50%，持续 2 秒', sacrifice: { stat: 'attack', amount: 0.06 } },
  { id: 'meteor', name: '陨石术', type: 'attack', rarity: 'epic', damage: 45, attackSpeedBonus: -0.3, desc: '超高伤害 +45，但攻速 -30%', sacrifice: { stat: 'speed', amount: 0.12 } },
  { id: 'gatling', name: '加特林', type: 'attack', rarity: 'epic', damage: 3, attackSpeedBonus: 0.7, chain: 1, desc: '高频扫射并附带 1 次弹射，更偏清场构筑', sacrifice: { stat: 'health', amount: 0.1 } },
  { id: 'shock_orb', name: '震荡电球', type: 'attack', rarity: 'rare', damage: 10, chain: 1, slow: 0.25, desc: '补一点首领伤害，同时带少量清场与减速', sacrifice: { stat: 'health', amount: 0.07 } },
  { id: 'hunter_mark', name: '猎手刻印', type: 'passive', rarity: 'rare', attackBonus: 12, armorPierce: 4, desc: '稳定补首领输出与破甲', sacrifice: { stat: 'speed', amount: 0.07 } },

  // ===== 防御牌 =====
  { id: 'iron_wall', name: '铁壁', type: 'defense', rarity: 'common', armorBonus: 6, desc: '护甲 +6', sacrifice: { stat: 'speed', amount: 0.08 } },
  { id: 'dodge_cloak', name: '闪避斗篷', type: 'defense', rarity: 'rare', dodgeChance: 0.18, desc: '18% 几率闪避攻击', sacrifice: { stat: 'attack', amount: 0.08 } },
  { id: 'reflect_shield', name: '反射之盾', type: 'defense', rarity: 'rare', reflect: 0.35, desc: '反弹 35% 受到的伤害', sacrifice: { stat: 'speed', amount: 0.1 } },
  { id: 'barrier', name: '能量屏障', type: 'defense', rarity: 'epic', barrier: 40, desc: '战斗开始时获得 40 护盾', sacrifice: { stat: 'health', amount: 0.1 } },
  { id: 'thorn_skin', name: '荆棘皮肤', type: 'defense', rarity: 'common', thorns: 8, desc: '受击反伤 8', sacrifice: { stat: 'attack_speed', amount: 0.06 } },
  { id: 'heal_aura', name: '治愈光环', type: 'defense', rarity: 'rare', regen: 3, desc: '每秒恢复 3 生命', sacrifice: { stat: 'attack', amount: 0.08 } },
  { id: 'stone_skin', name: '石肤术', type: 'defense', rarity: 'epic', armorBonus: 15, speedPenalty: 60, desc: '护甲 +15，但移速 -60', sacrifice: { stat: 'health', amount: 0.1 } },
  { id: 'phase_shift', name: '相位转移', type: 'defense', rarity: 'epic', dodgeChance: 0.4, desc: '40% 闪避率', sacrifice: { stat: 'attack', amount: 0.15 } },

  // ===== 被动牌 =====
  { id: 'heavy_core', name: '沉重核心', type: 'passive', rarity: 'common', attackBonus: 20, desc: '攻击 +20', sacrifice: { stat: 'speed', amount: 0.12 } },
  { id: 'swift_feet', name: '迅捷脚步', type: 'passive', rarity: 'common', speedBonus: 40, desc: '移速 +40', sacrifice: { stat: 'attack', amount: 0.06 } },
  { id: 'crit_eye', name: '暴击之眼', type: 'passive', rarity: 'rare', critChance: 0.2, desc: '暴击率 +20%', sacrifice: { stat: 'health', amount: 0.08 } },
  { id: 'range_extend', name: '射程延伸', type: 'passive', rarity: 'common', rangeBonus: 100, desc: '攻击范围 +100', sacrifice: { stat: 'speed', amount: 0.05 } },
  { id: 'crit_damage', name: '致命打击', type: 'passive', rarity: 'rare', critDamageBonus: 0.5, desc: '暴击伤害 +50%', sacrifice: { stat: 'attack_speed', amount: 0.08 } },
  { id: 'armor_pierce', name: '破甲', type: 'passive', rarity: 'rare', armorPierce: 5, desc: '无视 5 点敌方护甲', sacrifice: { stat: 'health', amount: 0.06 } },

  // ===== 小丑牌（全局修改器） =====
  { id: 'blood_pact', name: '血之契约', type: 'joker', rarity: 'rare', attackBonus: 15, desc: '攻击 +15，每波开始扣 5% 生命', sacrifice: { stat: 'health', amount: 0.08 } },
  { id: 'glass_cannon', name: '玻璃炮', type: 'joker', rarity: 'epic', damageMultiplier: 2.0, desc: '总伤害 x2，但最大生命 -40%', sacrifice: { stat: 'health', amount: 0.15 } },
  { id: 'vampire_edge', name: '吸血刃', type: 'joker', rarity: 'rare', lifesteal: 0.15, desc: '造成伤害时吸血 15%', sacrifice: { stat: 'speed', amount: 0.06 } },
  { id: 'collector', name: '收藏家', type: 'joker', rarity: 'epic', desc: '每 4 张牌，伤害 +8%', perCardsDamage: 0.08, sacrifice: { stat: 'attack_speed', amount: 0.05 } },
  { id: 'phoenix_ember', name: '凤凰余烬', type: 'joker', rarity: 'legendary', revive: 1, desc: '仅限一次：死亡时以 30% 生命复活', sacrifice: { stat: 'health', amount: 0.15 } },
  { id: 'double_or_nothing', name: '双倍或归零', type: 'joker', rarity: 'epic', damageMultiplier: 2.2, selfDamageChance: 0.15, desc: '伤害 x2.2，15% 几率自伤 20%', sacrifice: { stat: 'health', amount: 0.12 } },
  { id: 'time_warp', name: '时间扭曲', type: 'joker', rarity: 'legendary', attackSpeedBonus: 0.6, desc: '攻速 +60%', sacrifice: { stat: 'speed', amount: 0.12 } },
  { id: 'greed', name: '贪婪', type: 'joker', rarity: 'rare', scoreBonus: 0.6, desc: '击杀得分 +60%', sacrifice: { stat: 'health', amount: 0.06 } },
  { id: 'berserker', name: '狂战士', type: 'joker', rarity: 'legendary', desc: '生命越低伤害越高（最高 x3）', sacrifice: { stat: 'health', amount: 0.2 } },

  // ===== 诅咒牌 =====
  { id: 'doom', name: '末日', type: 'curse', rarity: 'epic', damageMultiplier: 2.8, doomTimer: 45, desc: '伤害 x2.8，但 45 秒后强制死亡', sacrifice: { stat: 'health', amount: 0.2 } },
  { id: 'decay', name: '衰败', type: 'curse', rarity: 'rare', attackBonus: 25, decayRate: 1.5, desc: '攻击 +25，每秒失去 1.5 生命', sacrifice: { stat: 'speed', amount: 0.08 } },
  { id: 'paradox', name: '悖论', type: 'curse', rarity: 'epic', attackBonus: 30, armorBonus: -10, desc: '攻击 +30，但护甲 -10', sacrifice: { stat: 'health', amount: 0.1 } },
];

// ---- 敌人类型（8种+3种Boss） ----
const ENEMY_TYPES = {
  slime: {
    name: '史莱姆', color: '#4CAF50', radius: 14, hpMult: 1, dmgMult: 1, spdMult: 0.9,
    behavior: 'chase', attackType: 'melee', attackCooldown: 1.0, attackRange: 35,
  },
  bat: {
    name: '蝙蝠', color: '#9C27B0', radius: 9, hpMult: 0.5, dmgMult: 0.7, spdMult: 2.0,
    behavior: 'zigzag', attackType: 'melee', attackCooldown: 0.6, attackRange: 25,
  },
  skeleton: {
    name: '骷髅', color: '#E0E0E0', radius: 15, hpMult: 1.3, dmgMult: 1.2, spdMult: 0.85,
    behavior: 'chase', attackType: 'melee', attackCooldown: 1.2, attackRange: 38,
  },
  golem: {
    name: '石像鬼', color: '#795548', radius: 24, hpMult: 4, dmgMult: 2.5, spdMult: 0.35,
    behavior: 'slow_chase', attackType: 'melee', attackCooldown: 2.0, attackRange: 45,
  },
  archer: {
    name: '弓箭手', color: '#FF9800', radius: 12, hpMult: 0.7, dmgMult: 1.0, spdMult: 0.65,
    behavior: 'ranged', attackType: 'projectile',
    attackCooldown: 2.0, attackRange: 350, preferredDist: 200,
    projectileSpeed: 320, projectileRadius: 5, projectileColor: '#FFB74D',
  },
  fire_mage: {
    name: '火焰法师', color: '#F44336', radius: 13, hpMult: 0.8, dmgMult: 1.5, spdMult: 0.55,
    behavior: 'ranged', attackType: 'spread',
    attackCooldown: 2.5, attackRange: 300, preferredDist: 180,
    projectileSpeed: 250, projectileRadius: 6, projectileColor: '#FF5722',
    spreadCount: 3, spreadAngle: 0.3,
  },
  healer: {
    name: '治疗者', color: '#E91E63', radius: 11, hpMult: 0.6, dmgMult: 0.4, spdMult: 0.75,
    behavior: 'support', attackType: 'heal_aura',
    attackCooldown: 3.0, attackRange: 180, healAmount: 8,
  },
  summoner: {
    name: '召唤者', color: '#673AB7', radius: 17, hpMult: 1.8, dmgMult: 0.3, spdMult: 0.45,
    behavior: 'summoner', attackType: 'summon',
    attackCooldown: 6.0, attackRange: 0, summonType: 'slime', summonCount: 2,
  },
};

const BOSS_TYPES = {
  dragon: {
    name: '幼龙·烈焰', color: '#D32F2F', radius: 38, hpMult: 18, dmgMult: 3, spdMult: 0.55,
    behavior: 'boss_fire', attackType: 'boss_fire_breath',
    phases: [
      { hpThreshold: 1.0, attackCooldown: 3.2, pattern: 'circle_shot', bulletCount: 10, bulletSpeed: 180 },
      { hpThreshold: 0.6, attackCooldown: 2.2, pattern: 'spiral_shot', bulletCount: 7, bulletSpeed: 230 },
      { hpThreshold: 0.3, attackCooldown: 1.5, pattern: 'aimed_burst', bulletCount: 4, bulletSpeed: 300 },
    ],
  },
  lich: {
    name: '巫妖王·寒冰', color: '#37474F', radius: 33, hpMult: 14, dmgMult: 2, spdMult: 0.5,
    behavior: 'boss_ice', attackType: 'boss_ice_storm',
    phases: [
      { hpThreshold: 1.0, attackCooldown: 3.8, pattern: 'ring_burst', bulletCount: 12, bulletSpeed: 160 },
      { hpThreshold: 0.5, attackCooldown: 2.8, pattern: 'cross_shot', bulletCount: 4, bulletSpeed: 260 },
      { hpThreshold: 0.25, attackCooldown: 1.8, pattern: 'random_rain', bulletCount: 14, bulletSpeed: 190 },
    ],
  },
  demon: {
    name: '恶魔领主·混沌', color: '#B71C1C', radius: 42, hpMult: 18, dmgMult: 3.0, spdMult: 0.44,
    behavior: 'boss_chaos', attackType: 'boss_chaos',
    phases: [
      { hpThreshold: 1.0, attackCooldown: 2.8, pattern: 'circle_shot', bulletCount: 16, bulletSpeed: 200 },
      { hpThreshold: 0.7, attackCooldown: 2.2, pattern: 'spiral_shot', bulletCount: 10, bulletSpeed: 250 },
      { hpThreshold: 0.4, attackCooldown: 1.4, pattern: 'aimed_burst', bulletCount: 6, bulletSpeed: 340 },
    ],
  },
};

// ---- 随机数 ----
function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

const SACRIFICE_NAMES = {
  speed: '移速',
  attack: '攻击',
  health: '生命',
  attack_speed: '攻速',
};

const FOCUS_LABELS = {
  crit: '暴击',
  barrage: '速攻',
  sustain: '续航',
  fortress: '壁垒',
  curse: '诅咒',
  bleed: '流血',
  control: '控场',
  greed: '赏金',
};

function pushMessage(run, message) {
  run.messages.unshift(message);
  if (run.messages.length > 5) run.messages.pop();
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ============================================================
// 创建新游戏
// ============================================================
export function createRun(seed = Date.now(), character = null) {
  // 角色默认值（向后兼容）
  const meta = getMetaBonuses();
  const ch = character || {
    baseHp: 100, baseSpeed: 250, baseAttack: 15, baseAttackCooldown: 0.5,
    startCards: [
      { id: 'starter_blade', name: '旧剑', type: 'attack', rarity: 'common', damage: 8, desc: '基础伤害 +8' },
      { id: 'starter_guard', name: '护身符', type: 'defense', rarity: 'common', armorBonus: 2, desc: '护甲 +2' },
      { id: 'starter_boots', name: '旧靴', type: 'passive', rarity: 'common', speedBonus: 15, desc: '移速 +15' },
    ],
  };
  const run = {
    seed, rand: mulberry32(seed),
    metaBonuses: meta,
    state: 'playing',
    wave: 0,
    waveTime: 0,
    waveTransitionTimer: 0,
    totalWaves: 25,
    gameTime: 0,
    rewardChoices: [],
    rewardRerolls: meta.rerollCount,
    rewardContext: { choiceCount: 3, rarityBonus: 0 },
    waveProfile: null,
    nextWavePreview: null,
    buildAnalysis: null,
    waveHistory: [],
    kills: 0,
    score: meta.startEmber,
    combo: 0,
    maxCombo: 0,
    comboTimer: 0,
    messages: ['余烬已燃起。'],
    screenShake: 0,
    screenFlash: 0,
    dashCooldown: 0,
    dashTimer: 0,
    reviveUsed: false,
    characterId: ch.id || 'warrior',
    player: {
      x: 640, y: 360, radius: 16,
      hp: ch.baseHp + meta.hpBoost, maxHp: ch.baseHp + meta.hpBoost, baseMaxHp: ch.baseHp + meta.hpBoost,
      baseSpeed: ch.baseSpeed + meta.speedBoost, baseAttack: ch.baseAttack + meta.attackBoost, baseAttackCooldown: ch.baseAttackCooldown,
      attackTimer: 0,
      invuln: 0,
      barrier: 0,
      regen: 0,
      facingAngle: 0,
      deck: clone(ch.startCards),
    },
    sacrifices: {
      speed: { count: 0, amount: 0 },
      attack: { count: 0, amount: 0 },
      health: { count: 0, amount: 0 },
      attack_speed: { count: 0, amount: 0 },
    },
    extremes: [],
    jokers: [],
    synergies: [],
    enemies: [],
    projectiles: [],     // 敌方弹幕
    playerProjectiles: [], // 玩家弹幕（暂未使用，预留给远程build）
    particles: [],
    pickups: [],
    telegraphs: [],      // 攻击预警区域
    scheduledActions: [],
    waveEnemyQueue: [],
    spawnTimer: 0,
    events: [],            // 音效/UI事件队列
  };
  startNextWave(run);
  return run;
}

// ============================================================
// 波次系统
// ============================================================
function startNextWave(run) {
  run.wave += 1;
  run.waveTime = 0;
  run.state = 'wave_transition';
  run.waveTransitionTimer = 1.8;
  run.waveEnemyQueue = [];
  run.spawnTimer = 0;
  run.combo = 0;

  const isBoss = run.wave % 5 === 0;
  const isEventWave = !isBoss && (run.wave === 3 || (run.wave > 8 && (run.wave - 3) % 8 === 0));
  const isEliteWave = !isBoss && !isEventWave && run.wave > 1 && run.wave % 3 === 0;
  const analysis = analyzeBuild(run);
  run.buildAnalysis = analysis;
  run.waveProfile = createWaveProfile(run.wave, { isBoss, isEliteWave, isEventWave, analysis });
  run.waveHistory.push({
    wave: run.wave,
    kind: run.waveProfile.kind,
    label: run.waveProfile.label,
  });
  run.nextWavePreview = null;
  if (isBoss) {
    const bossKeys = Object.keys(BOSS_TYPES);
    const bossKey = bossKeys[Math.min(Math.floor(run.wave / 10), bossKeys.length - 1)] || bossKeys[0];
    run.waveEnemyQueue.push({ type: bossKey, isBoss: true, delay: 0 });
    for (let i = 0; i < run.waveProfile.enemyCount; i++) {
      const minionKeys = Object.keys(ENEMY_TYPES);
      const available = minionKeys.filter((_, idx) => idx <= Math.min(minionKeys.length - 1, run.waveProfile.enemyTierCap));
      const bossIntroDelay = run.wave === 5 ? 2.4 + i * 0.85 : 1.1 + i * 0.35;
      run.waveEnemyQueue.push({
        type: available[Math.floor(run.rand() * available.length)],
        isBoss: false,
        delay: bossIntroDelay,
      });
    }
  } else {
    const count = run.waveProfile.enemyCount;
    for (let i = 0; i < count; i++) {
      const keys = Object.keys(ENEMY_TYPES);
      const available = keys.filter((_, idx) => idx <= Math.min(keys.length - 1, run.waveProfile.enemyTierCap));
      run.waveEnemyQueue.push({ type: available[Math.floor(run.rand() * available.length)], isBoss: false });
    }
    if (isEliteWave && run.waveEnemyQueue.length > 0) {
      const eliteCount = run.waveProfile.eliteCount || 1;
      const pool = [...run.waveEnemyQueue.keys()];
      for (let i = 0; i < eliteCount && pool.length > 0; i++) {
        const pick = Math.floor(run.rand() * pool.length);
        const eliteIndex = pool.splice(pick, 1)[0];
        run.waveEnemyQueue[eliteIndex] = {
          ...run.waveEnemyQueue[eliteIndex],
          elite: true,
        };
      }
      pushMessage(run, `⚔ ${run.waveProfile.label}`);
    }
  }

  // 事件波特殊处理
  if (run.waveProfile.kind === 'event') {
    pushMessage(run, '🔥 余烬锻造：弱敌来袭，击杀后进入锻造选择。');
  }

  // 每波开始：回血 + 小丑牌特殊效果
  const stats = getPlayerStats(run);
  if (stats.barrier > 0) {
    // 护盾牌按“每波开始保底护盾”结算，避免拿牌时一次性吃完后失去意义。
    run.player.barrier = Math.max(run.player.barrier, stats.barrier);
  }
  const healAmount = Math.floor(stats.maxHp * run.waveProfile.healRatio) + run.waveProfile.healFlat;
  run.player.hp = Math.min(stats.maxHp, run.player.hp + healAmount);
  if (healAmount > 0) run.particles.push({ type: 'heal', x: run.player.x, y: run.player.y - 25, life: 1.2, maxLife: 1.2, value: healAmount });

  // Boss 前准备恩惠：Boss 波额外回血
  if (isBoss && run.wave > 5) {
    const graceHeal = Math.floor(stats.maxHp * 0.08);
    run.player.hp = Math.min(stats.maxHp, run.player.hp + graceHeal);
    if (graceHeal > 0) run.particles.push({ type: 'heal', x: run.player.x, y: run.player.y - 35, life: 1, maxLife: 1, value: graceHeal });
  }

  // 血之契约：每波扣血
  if (run.jokers.some(j => j.id === 'blood_pact')) {
    const dmg = Math.floor(stats.maxHp * 0.05);
    run.player.hp = Math.max(1, run.player.hp - dmg);
    run.particles.push({ type: 'self_damage', x: run.player.x, y: run.player.y - 25, life: 1, maxLife: 1, value: dmg });
  }
  pushMessage(run, `${run.waveProfile.label}：${run.waveProfile.summary}`);
}

function createWaveProfile(wave, { isBoss, isEliteWave, isEventWave, analysis }) {
  if (isBoss) {
    const bossStage = Math.floor(wave / 5);
    const introBoss = wave === 5;
    const bossFocus = analysis.primaryFocus === 'fortress' || analysis.primaryFocus === 'sustain' ? 'burst' : 'survival';
    return {
      wave,
      kind: 'boss',
      label: `第 ${wave} 波 Boss 讨伐`,
      danger: introBoss ? 4 : 5,
      rewardBias: introBoss ? 3 : 2,
      spawnInterval: introBoss ? 0.95 : Math.max(0.46, 0.84 - bossStage * 0.05),
      enemyCount: introBoss ? 1 : Math.max(2, Math.min(4, 2 + Math.floor((wave - 5) / 6))),
      enemyTierCap: introBoss ? 1 : Math.min(Object.keys(ENEMY_TYPES).length - 1, 1 + Math.floor(wave / 5)),
      spawnPressure: introBoss ? 0.72 : 0.88,
      enemyHpScale: introBoss ? 0.62 : Math.min(0.9, 0.78 + bossStage * 0.03),
      enemyDamageScale: introBoss ? 0.58 : Math.min(0.88, 0.76 + bossStage * 0.03),
      enemySpeedScale: introBoss ? 0.88 : 0.98,
      healRatio: introBoss ? 0.26 : 0.24,
      healFlat: introBoss ? 11 : 10,
      eliteCount: 0,
      supportDropBonus: introBoss ? 0.32 : 0.18,
      rewardTag: bossFocus,
      rewardGuard: introBoss ? 'survival' : null,
      risk: introBoss ? '首个 Boss 会先单独入场，先看弹幕节奏，再处理延后出现的杂兵。' : 'Boss 与杂兵双线施压，优先保留冲刺处理弹幕窗口。',
      summary: introBoss ? '首个 Boss 波先给读招窗口，再考验你补的生存牌能否接住第二段压力。' : '首领压场，强调爆发、走位与留技能窗口。',
    };
  }
  if (isEventWave) {
    return {
      wave,
      kind: 'event',
      label: `第 ${wave} 波 余烬锻造`,
      danger: 1,
      rewardBias: 3,
      spawnInterval: 1.2,
      enemyCount: Math.min(3 + Math.floor(wave * 0.6), 10),
      enemyTierCap: Math.min(Object.keys(ENEMY_TYPES).length - 1, Math.floor(wave / 3)),
      spawnPressure: 0.5,
      enemyHpScale: 0.55,
      enemyDamageScale: 0.5,
      enemySpeedScale: 0.85,
      healRatio: 0.35,
      healFlat: 15,
      eliteCount: 0,
      supportDropBonus: 0.5,
      rewardTag: 'forge',
      risk: '极弱敌人，击杀后获得锻造奖励，可以升级已有卡牌或获得额外稀有牌。',
      summary: '余烬锻造波：击杀敌人后进入锻造阶段，可选择升级或强化。',
    };
  }
  if (isEliteWave) {
    const doubleElite = wave >= 9 ? 2 : 1;
    return {
      wave,
      kind: 'elite',
      label: `第 ${wave} 波 精英围猎`,
      danger: 4,
      rewardBias: 1,
      spawnInterval: Math.max(0.4, 0.82 - wave * 0.016),
      enemyCount: Math.min(8 + Math.floor(wave * 1.35), 24),
      enemyTierCap: Math.min(Object.keys(ENEMY_TYPES).length - 1, 1 + Math.floor(wave / 3)),
      spawnPressure: 0.82,
      enemyHpScale: 0.88,
      enemyDamageScale: 0.84,
      enemySpeedScale: 0.97,
      healRatio: 0.16,
      healFlat: 6,
      eliteCount: doubleElite,
      supportDropBonus: 0.2,
      rewardTag: analysis.primaryFocus === 'fortress' ? 'tempo' : 'survival',
      risk: doubleElite > 1 ? '双精英会拉高瞬时压力，先清脆皮后风筝重装。' : '精英更抗打也更值钱，注意拉开交战角度。',
      summary: '精英波给更高收益，也会放大 build 的短板。',
    };
  }
  if (wave === 2 || (wave > 6 && wave % 4 === 2)) {
    return {
      wave,
      kind: 'recovery',
      label: `第 ${wave} 波 补给窗口`,
      danger: Math.min(3, 1 + Math.floor(wave / 5)),
      rewardBias: 0,
      spawnInterval: Math.max(0.54, 0.96 - wave * 0.015),
      enemyCount: Math.min(5 + Math.floor(wave * 1.05), 18),
      enemyTierCap: Math.min(Object.keys(ENEMY_TYPES).length - 1, 1 + Math.floor(wave / 4)),
      spawnPressure: 0.7,
      enemyHpScale: 0.76,
      enemyDamageScale: 0.74,
      enemySpeedScale: 0.94,
      healRatio: 0.22,
      healFlat: 8,
      eliteCount: 0,
      supportDropBonus: 0.28,
      rewardTag: 'stabilize',
      risk: '敌人较弱，但要主动吃掉恢复球，为后续高压波做准备。',
      summary: '补给波提供喘息和回收资源的机会。',
    };
  }
  if (wave === 4 || (wave > 7 && wave % 4 === 3)) {
    return {
      wave,
      kind: 'onslaught',
      label: `第 ${wave} 波 猛攻潮`,
      danger: Math.min(5, 2 + Math.floor(wave / 4)),
      rewardBias: 1,
      spawnInterval: Math.max(0.26, 0.56 - wave * 0.012),
      enemyCount: Math.min(9 + Math.floor(wave * 1.55), 28),
      enemyTierCap: Math.min(Object.keys(ENEMY_TYPES).length - 1, 1 + Math.floor(wave / 3)),
      spawnPressure: 0.9,
      enemyHpScale: 0.8,
      enemyDamageScale: 0.8,
      enemySpeedScale: 1.03,
      healRatio: 0.14,
      healFlat: 3,
      eliteCount: 0,
      supportDropBonus: 0.08,
      rewardTag: analysis.primaryFocus === 'barrage' ? 'snowball' : 'aoe',
      risk: '刷怪频率快，清场能力不足时会被包围。',
      summary: '猛攻波强调清怪效率和站位管理。',
    };
  }
  if (wave === 1 || wave % 4 === 1) {
    return {
      wave,
      kind: 'hunt',
      label: `第 ${wave} 波 猎场推进`,
      danger: Math.min(4, 1 + Math.floor(wave / 4)),
      rewardBias: 0,
      spawnInterval: Math.max(0.36, 0.72 - wave * 0.013),
      enemyCount: Math.min(6 + Math.floor(wave * 1.25), 22),
      enemyTierCap: Math.min(Object.keys(ENEMY_TYPES).length - 1, 1 + Math.floor(wave / 3)),
      spawnPressure: 0.8,
      enemyHpScale: 0.84,
      enemyDamageScale: 0.8,
      enemySpeedScale: 0.99,
      healRatio: 0.15,
      healFlat: 4,
      eliteCount: 0,
      supportDropBonus: 0.14,
      rewardTag: analysis.primaryFocus === 'crit' ? 'burst' : 'tempo',
      risk: '标准压力测试，观察 build 是否已经成型。',
      summary: '常规推进波，适合验证当前构筑的主输出循环。',
    };
  }
  return {
    wave,
    kind: 'siege',
    label: `第 ${wave} 波 围杀压境`,
    danger: Math.min(5, 2 + Math.floor(wave / 4)),
    rewardBias: 1,
    spawnInterval: Math.max(0.3, 0.62 - wave * 0.014),
    enemyCount: Math.min(8 + Math.floor(wave * 1.45), 26),
    enemyTierCap: Math.min(Object.keys(ENEMY_TYPES).length - 1, 2 + Math.floor(wave / 3)),
    spawnPressure: 0.88,
    enemyHpScale: 0.86,
    enemyDamageScale: 0.85,
    enemySpeedScale: 1,
    healRatio: 0.13,
    healFlat: 4,
    eliteCount: 0,
    supportDropBonus: 0.1,
    rewardTag: analysis.primaryFocus === 'sustain' ? 'tempo' : 'survival',
    risk: '中等数量配合更高质量敌人，不能只站桩换血。',
    summary: '围杀波会同时考验输出、位移和续航。',
  };
}

function previewNextWaveProfile(run) {
  const nextWave = run.wave + 1;
  const isBoss = nextWave % 5 === 0;
  const isEliteWave = !isBoss && nextWave > 1 && nextWave % 3 === 0;
  const isEventWave = !isBoss && !isEliteWave && (nextWave === 3 || (nextWave > 8 && (nextWave - 3) % 8 === 0));
  return createWaveProfile(nextWave, {
    isBoss,
    isEliteWave,
    isEventWave,
    analysis: analyzeBuild(run),
  });
}

// ============================================================
// 生成敌人
// ============================================================
function spawnEnemy(run, typeKey, isBoss, isElite = false) {
  const type = isBoss ? BOSS_TYPES[typeKey] : ENEMY_TYPES[typeKey];
  const scaling = getEnemyScaling(run);
  let x, y;
  if (isBoss) {
    x = 520 + run.rand() * 240;
    y = run.wave === 5 ? 110 : 90;
  } else {
    const side = Math.floor(run.rand() * 4);
    if (side === 0) { x = 60 + run.rand() * 1160; y = -40; }
    else if (side === 1) { x = 1320; y = 60 + run.rand() * 600; }
    else if (side === 2) { x = 60 + run.rand() * 1160; y = 760; }
    else { x = -40; y = 60 + run.rand() * 600; }
  }

  const waveScale = 1 + run.wave * 0.12;
  const eliteScale = isElite ? 1.7 : 1;
  const bossWave = run.waveProfile?.kind === 'boss';
  const introBoss = run.wave === 5;
  const hpScale = isBoss
    ? (introBoss ? 0.84 : 1)
    : (bossWave ? (introBoss ? 0.68 : 0.82) : 1);
  const damageScale = isBoss
    ? (introBoss ? 0.82 : 1)
    : (bossWave ? (introBoss ? 0.62 : 0.78) : 1);
  const speedScale = isBoss
    ? (introBoss ? 0.94 : 1)
    : (bossWave ? (introBoss ? 0.88 : 0.94) : 1);
  const hp = Math.floor((isBoss ? 200 : 25) * type.hpMult * waveScale * eliteScale * scaling.hpScale * hpScale);
  const damage = Math.floor((isBoss ? 9 : 3) * type.dmgMult * (1 + run.wave * 0.055) * (isElite ? 1.25 : 1) * scaling.damageScale * damageScale);
  const speed = (isBoss ? 58 : 76) * type.spdMult * (1 + run.wave * 0.012) * (isElite ? 1.06 : 1) * scaling.speedScale * speedScale;

  return {
    id: `${isBoss ? 'boss' : 'e'}_${run.wave}_${run.waveEnemyQueue.length}`,
    typeKey, isBoss, isElite,
    name: type.name, color: type.color,
    x, y, radius: type.radius,
    hp, maxHp: hp,
    baseDamage: damage,
    speed: Math.min(speed, isBoss ? 120 : 250),
    behavior: type.behavior,
    attackType: type.attackType,
    attackCooldown: type.attackCooldown || 1.0,
    attackTimer: type.attackCooldown || 1.0,
    attackRange: type.attackRange || 35,
    preferredDist: type.preferredDist || (isBoss ? (run.wave === 5 ? 235 : 210) : 0),
    projectileSpeed: type.projectileSpeed || 0,
    projectileRadius: type.projectileRadius || 5,
    projectileColor: type.projectileColor || '#ff0',
    spreadCount: type.spreadCount || 1,
    spreadAngle: type.spreadAngle || 0,
    healAmount: type.healAmount || 0,
    summonType: type.summonType || 'slime',
    summonCount: type.summonCount || 1,
    // Boss 弹幕阶段
    phases: type.phases || [],
    currentPhaseIdx: 0,
    phaseAttackTimer: 0,
    bulletAngle: 0,       // 螺旋弹幕旋转角度
    // 状态
    touchTimer: 0,
    meleeSwingTimer: 0,
    meleePendingDamage: 0,
    meleePendingRange: type.attackRange || 35,
    dotTimer: 0, dotDamage: 0,
    slowTimer: 0, slowAmount: 1,
    hitFlash: 0,
    phased: false, phaseTimer: 0,
    // 攻击预警
    telegraphTimer: 0,
    telegraphType: null,
    supportDropBonus: scaling.supportDropBonus,
  };
}

// ============================================================
// 卡牌系统
// ============================================================
export function getCardPool() { return clone(CARD_POOL); }

function buildWeightedCardPool(rarityBonus = 0) {
  const pool = clone(CARD_POOL);
  const weights = {
    common: Math.max(1, 4 - rarityBonus * 0.55),
    rare: 3 + rarityBonus * 0.5,
    epic: 1.5 + rarityBonus * 0.45,
    legendary: 0.5 + rarityBonus * 0.18,
  };
  const weighted = [];
  for (const card of pool) {
    const w = weights[card.rarity] || 1;
    for (let i = 0; i < Math.ceil(w * 2); i++) weighted.push(card);
  }
  return weighted;
}

export function rollCardChoices(run, count = 3, rarityBonus = 0) {
  const weighted = buildWeightedCardPool(rarityBonus);
  // Fisher-Yates shuffle
  for (let i = weighted.length - 1; i > 0; i--) {
    const j = Math.floor(run.rand() * (i + 1));
    [weighted[i], weighted[j]] = [weighted[j], weighted[i]];
  }
  // 去重取 count 张
  const result = [];
  const seen = new Set();
  for (const card of weighted) {
    if (!seen.has(card.id) && result.length < count) {
      seen.add(card.id);
      result.push(card);
    }
  }
  return result;
}

function hasPositiveStat(card, key) {
  return Number(card?.[key] || 0) > 0;
}

function isSurvivalCard(card) {
  return Boolean(
    hasPositiveStat(card, 'regen') ||
    hasPositiveStat(card, 'lifesteal') ||
    hasPositiveStat(card, 'barrier') ||
    hasPositiveStat(card, 'armorBonus') ||
    hasPositiveStat(card, 'dodgeChance') ||
    hasPositiveStat(card, 'reflect') ||
    hasPositiveStat(card, 'thorns') ||
    hasPositiveStat(card, 'revive')
  );
}

function isBossPunishCard(card) {
  return Boolean(
    card.selfDamageChance ||
    card.decayRate ||
    card.doomTimer ||
    card.armorBonus < 0 ||
    (card.sacrifice?.stat === 'health' && (card.sacrifice?.amount || 0) >= 0.12)
  );
}

function needsBossPrep(run, targetProfile) {
  if (!targetProfile || targetProfile.kind !== 'boss') return false;
  const analysis = run.buildAnalysis || analyzeBuild(run);
  const focus = analysis?.focusScores || {};
  const stats = getPlayerStats(run);
  const hpRatio = run.player.hp / Math.max(1, stats.maxHp);
  const sustain = focus.sustain || 0;
  const fortress = focus.fortress || 0;
  const defenseLoad = sustain + fortress;
  const hasRevive = run.player.deck.some(card => card.revive && !card.used);
  const hpUnsafe = hpRatio < 0.72;
  const defenseThin = defenseLoad < 4;
  const noSafetyNet = !hasRevive && hpRatio < 0.58;
  return hpUnsafe || defenseThin || noSafetyNet;
}

function pickGuaranteedCard(run, rarityBonus, predicate, excludedIds = new Set()) {
  const weighted = buildWeightedCardPool(rarityBonus);
  for (let i = weighted.length - 1; i > 0; i--) {
    const j = Math.floor(run.rand() * (i + 1));
    [weighted[i], weighted[j]] = [weighted[j], weighted[i]];
  }
  for (const card of weighted) {
    if (!excludedIds.has(card.id) && predicate(card)) return clone(card);
  }
  return null;
}

function getRequiredSurvivalChoices(run, targetProfile) {
  if (!targetProfile) return 0;
  const needsPrep = needsBossPrep(run, targetProfile);
  if (!needsPrep) return 0;

  const stats = getPlayerStats(run);
  const hpRatio = run.player.hp / Math.max(1, stats.maxHp);
  if (targetProfile.kind === 'boss' && hpRatio <= 0.45) return 2;
  if (targetProfile.rewardGuard === 'survival' && hpRatio <= 0.38) return 2;
  return 1;
}

function enforceRewardArchetype(run, cards, targetProfile, rarityBonus) {
  if (!targetProfile) return cards;
  const targetTag = targetProfile.rewardTag || 'tempo';
  const guaranteeSurvival = targetTag === 'survival' || targetTag === 'stabilize' || targetProfile.rewardGuard === 'survival' || needsBossPrep(run, targetProfile);
  if (!guaranteeSurvival) return cards;
  const nextCards = [...cards];
  const requiredSurvivalChoices = Math.min(nextCards.length, Math.max(1, getRequiredSurvivalChoices(run, targetProfile)));
  let survivalCount = nextCards.filter(isSurvivalCard).length;
  if (survivalCount >= requiredSurvivalChoices) return nextCards;

  const excludedIds = new Set(nextCards.map(card => card.id));
  for (let i = nextCards.length - 1; i >= 0 && survivalCount < requiredSurvivalChoices; i--) {
    if (isSurvivalCard(nextCards[i])) continue;
    const guaranteed = pickGuaranteedCard(run, rarityBonus, isSurvivalCard, excludedIds);
    if (!guaranteed) break;
    nextCards[i] = guaranteed;
    excludedIds.add(guaranteed.id);
    survivalCount += 1;
  }
  return nextCards;
}

function buildRewardChoices(run, count, rarityBonus, targetProfile) {
  const base = rollCardChoices(run, count, rarityBonus);
  const enforced = enforceRewardArchetype(run, base, targetProfile, rarityBonus);
  return enrichRewardChoices(run, enforced, targetProfile);
}

export function rerollRewardChoices(run) {
  if (run.state !== 'reward') return false;
  if ((run.rewardRerolls ?? 0) <= 0) return false;
  const count = run.rewardContext?.choiceCount ?? Math.max(3, run.rewardChoices.length || 0);
  const rarityBonus = run.rewardContext?.rarityBonus ?? 0;
  const targetProfile = run.nextWavePreview || run.waveProfile;
  run.rewardChoices = buildRewardChoices(run, count, rarityBonus, targetProfile);
  run.rewardRerolls -= 1;
  pushMessage(run, '命运重铸：新的奖励已出现。');
  return true;
}

export function applyCardChoice(run, card) {
  const c = clone(card);
  run.player.deck.push(c);
  if (c.type === 'joker') {
    if (!run.jokers.some(j => j.id === c.id)) run.jokers.push(c);
  }
  if (c.sacrifice) applySacrifice(run, c.sacrifice);
  if (c.barrier) run.player.barrier += c.barrier;
  if (c.regen) run.player.regen += c.regen;
  pushMessage(run, `获得【${c.name}】· 代价：${sacrificeText(c.sacrifice)}`);
  run.buildAnalysis = analyzeBuild(run);

  if (run.state === 'reward') {
    run.state = 'playing';
    run.rewardChoices = [];
    startNextWave(run);
  }
}

export function enrichRewardChoices(run, cards, targetProfile = null) {
  const analysis = analyzeBuild(run);
  run.buildAnalysis = analysis;
  return cards.map(card => {
    const cloneCard = clone(card);
    cloneCard.fitHint = describeCardFit(cloneCard, analysis);
    cloneCard.fitScore = scoreCardFit(cloneCard, analysis, targetProfile || run.waveProfile);
    return cloneCard;
  }).sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0));
}

function scoreCardFit(card, analysis, waveProfile) {
  let score = 0;
  const focus = analysis?.focusScores || {};
  const pressure = analysis?.pressure || {};
  const wave = waveProfile?.wave ?? 0;
  const needsSurvival = (waveProfile?.kind === 'boss' && ((focus.sustain || 0) + (focus.fortress || 0) < 5)) || waveProfile?.rewardGuard === 'survival';
  const earlyRun = wave > 0 ? wave <= 5 : false;
  const bossPrep = waveProfile?.kind === 'boss' || waveProfile?.rewardGuard === 'survival';
  const sustainScore = (focus.sustain || 0) + (focus.fortress || 0);
  const attackScore = (focus.crit || 0) + (focus.barrage || 0) + (focus.bleed || 0);
  const defenseOverAttack = sustainScore - attackScore;
  const fortressHeavy = sustainScore >= 5;
  const defenseDominated = defenseOverAttack >= 4;
  const sustainCard = hasPositiveStat(card, 'regen') || hasPositiveStat(card, 'lifesteal') || hasPositiveStat(card, 'barrier');
  const fortressCard = hasPositiveStat(card, 'armorBonus') || hasPositiveStat(card, 'dodgeChance') || hasPositiveStat(card, 'reflect') || hasPositiveStat(card, 'thorns');
  const attackCard = Boolean(card.damage || card.attackBonus || card.damageMultiplier || card.critChance || card.critDamageBonus || card.attackSpeedBonus || card.chain || card.dot || card.bleed || card.rangeBonus || card.armorPierce || card.slow);

  // 单体输出缺口：阈值随波次增长，后期需要更多输出
  const singleTargetThreshold = 52 + wave * 4;
  const singleTargetNeed = Math.max(0, singleTargetThreshold - (pressure.singleTarget || 0));
  const aoeNeed = Math.max(0, 20 - (pressure.aoe || 0));
  const sustainNeed = Math.max(0, 48 - ((pressure.sustain || 0) + (pressure.mitigation || 0)));

  // 基础分：攻击牌有基础加成
  if (card.damage || card.attackBonus) score += 1;
  if (card.attackSpeedBonus || card.chain) score += 1;
  if (card.critChance || card.critDamageBonus) score += (focus.crit || 0) * 0.7 + 1;
  // 防御牌：有递减收益，focus 越高加成越少
  const fortressFocusBonus = Math.min((focus.fortress || 0) * 0.5, 3.5);
  const sustainFocusBonus = Math.min((focus.sustain || 0) * 0.5, 3.5);
  if (sustainCard) score += sustainFocusBonus + 1;
  if (fortressCard) score += fortressFocusBonus + 0.8;
  if (card.dot || card.bleed) score += (focus.bleed || 0) * 0.75 + 0.6;
  if (card.type === 'curse') score += (focus.curse || 0) * 0.8;

  // 输出缺口加成：阈值随波次增长，中后期输出牌大幅加分
  if (singleTargetNeed > 0 && (card.damage || card.attackBonus || card.damageMultiplier || card.critChance || card.critDamageBonus)) score += Math.min(4.0, singleTargetNeed * 0.04);
  if (aoeNeed > 0 && (card.chain || card.attackSpeedBonus || card.rangeBonus || card.slow || card.dot || card.bleed)) score += Math.min(1.9, aoeNeed * 0.05);
  if (sustainNeed > 0 && (sustainCard || fortressCard)) score += Math.min(2.2, sustainNeed * 0.04);

  // 波次标签加成
  if ((waveProfile?.rewardTag || '') === 'survival' && (sustainCard || fortressCard)) score += 1.8;
  if ((waveProfile?.rewardTag || '') === 'burst' && (card.damage || card.damageMultiplier || card.critChance)) score += 1.4;
  if ((waveProfile?.rewardTag || '') === 'aoe' && (card.chain || card.attackSpeedBonus || card.rangeBonus)) score += 1.4;
  if ((waveProfile?.rewardTag || '') === 'stabilize' && (sustainCard || hasPositiveStat(card, 'healAmount') || hasPositiveStat(card, 'dodgeChance'))) score += 1.5;
  if ((waveProfile?.rewardTag || '') === 'snowball' && (card.scoreBonus || card.attackSpeedBonus || card.damageMultiplier)) score += 1.2;

  // Boss 相关
  if (waveProfile?.kind === 'boss' && isSurvivalCard(card)) score += needsSurvival ? 2.8 : 1.4;
  if (waveProfile?.kind === 'boss' && card.revive) score += 2.4;
  if (waveProfile?.kind === 'boss' && isBossPunishCard(card) && !isSurvivalCard(card)) score -= 1.5;
  if ((waveProfile?.rewardGuard === 'survival' || waveProfile?.kind === 'boss') && card.id === 'blood_pact') score -= 2.4;
  if ((waveProfile?.rewardGuard === 'survival' || waveProfile?.kind === 'boss') && (card.decayRate || card.doomTimer)) score -= 2.1;
  if (earlyRun && card.id === 'blood_pact') score -= 1.4;

  // 防御堆叠预防：有防御优势时，降低防御牌吸引力，提高攻击牌
  if (defenseOverAttack >= 4 && fortressCard && !sustainCard && !attackCard) {
    score -= 1.2 + Math.min(defenseOverAttack * 0.2, 2.0);
  }
  if (defenseOverAttack >= 4 && attackCard) {
    score += 0.8 + Math.min(defenseOverAttack * 0.15, 1.5);
  }
  if (defenseOverAttack >= 6 && (card.damageMultiplier || card.critChance || card.critDamageBonus || card.attackSpeedBonus || card.chain)) {
    score += 0.8;
  }

  // Boss 前的特定牌加分
  if (bossPrep && fortressHeavy) {
    if (card.id === 'shadow_blade') score += 1.9;
    if (card.id === 'frost_staff' || card.id === 'bleed_axe' || card.id === 'meteor') score += 1.1;
    if (card.attackSpeedBonus > 0) score += 0.6;
  }
  if (bossPrep && sustainScore >= 4) {
    if (attackCard) score += 1.15;
    if (card.damageMultiplier || card.critChance || card.critDamageBonus || card.attackSpeedBonus || card.chain || card.dot || card.bleed || card.rangeBonus || card.armorPierce || card.slow) score += 0.95;
    if (fortressCard && !sustainCard) score -= 1.1;
  }
  if (bossPrep && sustainScore < 4 && sustainCard) score += 1.2;
  // 非 Boss 波但下一波是 Boss 时，如果防御不足，生存牌小幅加分
  if (waveProfile?.kind !== 'boss' && wave % 5 === 4 && sustainScore < 4 && sustainCard) score += 0.5;

  // 牺牲属性与主轴冲突
  if (card.sacrifice?.stat && analysis?.primaryFocus) {
    if ((card.sacrifice.stat === 'speed' && analysis.primaryFocus === 'barrage') ||
      (card.sacrifice.stat === 'health' && analysis.primaryFocus === 'sustain') ||
      (card.sacrifice.stat === 'attack' && analysis.primaryFocus === 'crit') ||
      (card.sacrifice.stat === 'attack_speed' && analysis.primaryFocus === 'barrage')) {
      score -= 0.9;
    }
  }
  return Number(score.toFixed(2));
}

function sacrificeText(s) {
  if (!s) return '无';
  return `${SACRIFICE_NAMES[s.stat] ?? s.stat} -${(s.amount * 100).toFixed(0)}%`;
}

function applySacrifice(run, s) {
  const bucket = run.sacrifices[s.stat];
  if (!bucket) return;
  bucket.count += 1;
  bucket.amount += s.amount;
  if (bucket.count >= 3) {
    const map = { speed: '磐石之躯', attack: '诅咒之王', health: '幽灵血脉', attack_speed: '巨炮节奏' };
    const name = map[s.stat];
    if (name && !run.extremes.includes(name)) {
      run.extremes.push(name);
      pushMessage(run, `🔥 极端化觉醒：${name}`);
      run.screenFlash = 0.5;
      run.events.push('extreme');
    }
  }
}

function evaluateSynergies(run) {
  const deck = run.player.deck;
  const ids = deck.map(c => c.id);
  const stats = {
    damageMultiplier: 1, attackSpeedBonus: 0, lifesteal: 0, dodgeChance: 0, critChance: 0, chain: 0, regen: 0,
    names: []
  };

  // 套装/关键词协同
  if (ids.includes('flame_sword') && ids.includes('meteor')) {
    stats.damageMultiplier *= 1.35;
    stats.names.push('烈焰共鸣');
  }
  if (ids.includes('quick_blade') && ids.includes('gatling')) {
    stats.attackSpeedBonus += 0.4;
    stats.names.push('速射核心');
  }
  if (ids.includes('poison_dagger') && ids.includes('bleed_axe')) {
    stats.damageMultiplier *= 1.2;
    stats.names.push('腐血瘟疫');
  }
  if (ids.includes('dodge_cloak') && ids.includes('phase_shift')) {
    stats.dodgeChance += 0.1;
    stats.names.push('虚空步');
  }
  if (ids.includes('vampire_edge') && ids.includes('berserker')) {
    stats.lifesteal += 0.08;
    stats.names.push('血怒汲取');
  }
  if (ids.includes('lightning') && ids.includes('crit_eye')) {
    stats.chain += 1;
    stats.critChance += 0.08;
    stats.names.push('雷暴视界');
  }
  if (ids.includes('heal_aura') && ids.includes('barrier')) {
    stats.regen += 2;
    stats.names.push('圣愈庇护');
  }
  if (ids.includes('shadow_blade') && ids.includes('crit_eye')) {
    stats.critChance += 0.06;
    stats.critDamageBonus += 0.3;
    stats.names.push('暗影暴击');
  }
  if (ids.includes('iron_wall') && ids.includes('stone_skin')) {
    stats.armorBonus = (stats.armorBonus || 0) + 4;
    stats.names.push('不破铁壁');
  }
  if (ids.includes('reflect_shield') && ids.includes('thorn_skin')) {
    stats.reflect = (stats.reflect || 0) + 0.08;
    stats.thorns = (stats.thorns || 0) + 4;
    stats.names.push('反弹荆棘');
  }
  if (ids.includes('decay') && ids.includes('doom')) {
    stats.damageMultiplier *= 1.15;
    stats.names.push('命定之死');
  }
  if (ids.includes('frost_staff') && ids.includes('shock_orb')) {
    stats.slow = (stats.slow || 0) + 0.1;
    stats.chain += 1;
    stats.names.push('冰雷双控');
  }
  if (ids.includes('heavy_core') && ids.includes('swift_feet')) {
    stats.attackBonus = (stats.attackBonus || 0) + 6;
    stats.speedBonus = (stats.speedBonus || 0) + 18;
    stats.names.push('均衡之力');
  }
  if (ids.includes('collector') && ids.includes('greed')) {
    stats.scoreBonus = (stats.scoreBonus || 0) + 0.25;
    stats.damageMultiplier *= 1.08;
    stats.names.push('财富即力量');
  }

  // 关键词三连
  const attackCards = deck.filter(c => c.type === 'attack').length;
  const defenseCards = deck.filter(c => c.type === 'defense').length;
  const jokerCards = deck.filter(c => c.type === 'joker').length;
  const curseCards = deck.filter(c => c.type === 'curse').length;
  if (attackCards >= 5) { stats.damageMultiplier *= 1.15; stats.names.push('武备压制'); }
  if (defenseCards >= 4) { stats.regen += 1; stats.names.push('钢铁防线'); }
  if (jokerCards >= 3) { stats.critChance += 0.05; stats.names.push('赌徒狂喜'); }
  if (curseCards >= 3) { stats.damageMultiplier *= 1.12; stats.decayRate = (stats.decayRate || 0) + 0.4; stats.names.push('诅咒亲和'); }

  return stats;
}

function analyzeBuild(run) {
  const deck = run.player.deck || [];
  const focus = {
    crit: 0,
    barrage: 0,
    sustain: 0,
    fortress: 0,
    curse: 0,
    bleed: 0,
    control: 0,
    greed: 0,
  };

  const pressure = {
    singleTarget: 0,
    aoe: 0,
    sustain: 0,
    mitigation: 0,
    safety: 0,
  };

  for (const card of deck) {
    if (card.critChance || card.critDamageBonus) focus.crit += 2;
    if ((card.attackSpeedBonus ?? 0) > 0 || card.chain || card.rangeBonus) focus.barrage += 2;
    if (card.regen || card.lifesteal || card.barrier) focus.sustain += 2;
    if (card.armorBonus || card.dodgeChance || card.reflect || card.thorns) focus.fortress += 2;
    if (card.type === 'curse' || card.decayRate || card.doomTimer) focus.curse += 2;
    if (card.dot || card.bleed) focus.bleed += 2;
    if (card.slow || card.chain) focus.control += 1;
    if (card.scoreBonus) focus.greed += 2;
    if (card.type === 'attack') focus.barrage += 0.6;
    if (card.type === 'defense') focus.fortress += 0.6;
    if (card.type === 'joker') focus.curse += 0.4;

    pressure.singleTarget += (card.damage || 0) + (card.attackBonus || 0) + ((card.damageMultiplier || 1) > 1 ? 14 : 0) + ((card.critChance || 0) * 18) + ((card.critDamageBonus || 0) * 10);
    pressure.aoe += (card.chain || 0) * 16 + ((card.attackSpeedBonus || 0) > 0 ? 8 : 0) + (card.rangeBonus || 0) * 0.05 + (card.slow ? 6 : 0);
    pressure.sustain += (card.regen || 0) * 10 + (card.lifesteal || 0) * 80 + (card.barrier || 0) * 0.25;
    pressure.mitigation += Math.max(0, card.armorBonus || 0) * 2 + (card.dodgeChance || 0) * 40 + (card.reflect || 0) * 22 + (card.thorns || 0) * 0.8;
    pressure.safety += (card.revive || 0) * 40 + (card.barrier || 0) * 0.18 + (card.dodgeChance || 0) * 24;
  }

  for (const name of run.extremes || []) {
    if (name === '磐石之躯') { focus.fortress += 3; pressure.singleTarget += 18; pressure.mitigation += 22; }
    if (name === '诅咒之王') { focus.curse += 3; pressure.aoe += 22; pressure.singleTarget += 12; }
    if (name === '幽灵血脉') { focus.sustain += 2; pressure.sustain += 24; pressure.safety += 12; }
    if (name === '巨炮节奏') { focus.barrage += 3; pressure.singleTarget += 28; }
  }

  const ranked = Object.entries(focus).sort((a, b) => b[1] - a[1]);
  const top = ranked.filter(([, value]) => value > 0).slice(0, 3);
  const primaryFocus = top[0]?.[0] || 'barrage';
  const secondaryFocus = top[1]?.[0] || null;
  const descriptors = top.map(([key]) => FOCUS_LABELS[key]).filter(Boolean);
  return {
    primaryFocus,
    secondaryFocus,
    descriptors,
    focusScores: focus,
    pressure,
    summary: descriptors.length ? descriptors.join(' / ') : '均衡',
    weaknesses: {
      singleTarget: pressure.singleTarget < 52,
      aoe: pressure.aoe < 20,
      sustain: (pressure.sustain + pressure.mitigation) < 48,
      safety: pressure.safety < 18,
    },
  };
}

function describeCardFit(card, analysis) {
  const reasons = [];
  const focus = analysis?.focusScores || {};
  const pressure = analysis?.pressure || {};
  if ((card.critChance || card.critDamageBonus) && (focus.crit || 0) >= 2) reasons.push('补强暴击主轴');
  if ((card.attackSpeedBonus || card.chain || card.rangeBonus) && (focus.barrage || 0) >= 2) reasons.push('提升清场节奏');
  if ((card.regen || card.lifesteal || card.barrier) && (focus.sustain || 0) >= 2) reasons.push('增强续航稳定性');
  if ((card.armorBonus || card.dodgeChance || card.reflect || card.thorns) && (focus.fortress || 0) >= 2) reasons.push('巩固生存下限');
  if ((card.dot || card.bleed) && (focus.bleed || 0) >= 2) reasons.push('放大持续伤害');
  if ((card.type === 'curse' || card.decayRate || card.doomTimer) && (focus.curse || 0) >= 2) reasons.push('强化高风险爆发');
  if (reasons.length === 0 && pressure.singleTarget < 45 && (card.damage || card.attackBonus || card.critChance || card.damageMultiplier)) reasons.push('补首领输出缺口');
  if (reasons.length === 0 && pressure.aoe < 18 && (card.chain || card.attackSpeedBonus || card.rangeBonus || card.slow)) reasons.push('补清场与控场');
  if (reasons.length === 0 && pressure.sustain + pressure.mitigation < 42 && (card.regen || card.lifesteal || card.barrier || card.armorBonus || card.dodgeChance || card.reflect)) reasons.push('补容错短板');
  if (reasons.length === 0 && card.type === 'attack') reasons.push('直接抬升输出');
  if (reasons.length === 0 && card.type === 'defense') reasons.push('补当前容错');
  if (reasons.length === 0 && card.type === 'joker') reasons.push('改变战斗节奏');
  if (reasons.length === 0) reasons.push('提供通用数值');
  return reasons[0];
}

// ============================================================
// 属性计算（核心公式）
// ============================================================
export function getPlayerStats(run) {
  const p = run.player;
  const s = run.sacrifices;

  // 基础属性 × (1 - 牺牲比例)
  let maxHp = (p.baseMaxHp ?? p.maxHp) * Math.max(0.15, 1 - s.health.amount);
  let speed = p.baseSpeed * Math.max(0.12, 1 - s.speed.amount);
  let attack = p.baseAttack * Math.max(0.15, 1 - s.attack.amount);
  let cooldown = p.baseAttackCooldown * (1 + s.attack_speed.amount);

  // 累加卡牌属性
  let armor = 0, thorns = 0, lifesteal = 0, damageMultiplier = 1, revive = 0;
  let critChance = 0, critDamageBonus = 0.5; // 基础暴击伤害 +50%
  let dodgeChance = 0, reflect = 0, rangeBonus = 0;
  let attackSpeedBonus = 0, chain = 0, slow = 0, dot = 0, bleed = 0;
  let scoreBonus = 0, selfDamageChance = 0, doomTimer = 0, decayRate = 0;
  let regen = 0, barrier = 0;
  let armorPierce = 0, speedPenalty = 0;

  for (const card of p.deck) {
    attack += card.damage ?? 0;
    attack += card.attackBonus ?? 0;
    armor += card.armorBonus ?? 0;
    speed += card.speedBonus ?? 0;
    thorns += card.thorns ?? 0;
    lifesteal += card.lifesteal ?? 0;
    revive += card.revive ?? 0;
    critChance += card.critChance ?? 0;
    critDamageBonus += card.critDamageBonus ?? 0;
    dodgeChance += card.dodgeChance ?? 0;
    reflect += card.reflect ?? 0;
    rangeBonus += card.rangeBonus ?? 0;
    attackSpeedBonus += card.attackSpeedBonus ?? 0;
    chain += card.chain ?? 0;
    slow += card.slow ?? 0;
    dot += card.dot ?? 0;
    bleed += card.bleed ?? 0;
    scoreBonus += card.scoreBonus ?? 0;
    selfDamageChance += card.selfDamageChance ?? 0;
    doomTimer += card.doomTimer ?? 0;
    decayRate += card.decayRate ?? 0;
    regen += card.regen ?? 0;
    barrier += card.barrier ?? 0;
    armorPierce += card.armorPierce ?? 0;
    speedPenalty += card.speedPenalty ?? 0;
    if (card.damageMultiplier) damageMultiplier *= card.damageMultiplier;
    if (card.perCardsDamage) damageMultiplier *= (1 + Math.floor(p.deck.length / 4) * card.perCardsDamage);
  }

  // 玻璃炮：最大生命 -40%
  if (run.jokers.some(j => j.id === 'glass_cannon')) maxHp *= 0.6;

  // 极端化效果
  if (run.extremes.includes('磐石之躯')) { damageMultiplier *= 2.8; speed *= 0.3; }
  if (run.extremes.includes('幽灵血脉')) { maxHp = Math.max(1, maxHp * 0.35); speed += 120; dodgeChance += 0.15; }
  if (run.extremes.includes('巨炮节奏')) { cooldown *= 2.0; damageMultiplier *= 2.5; }
  if (run.extremes.includes('诅咒之王')) { attack *= 0.4; damageMultiplier *= 2.2; chain += 2; }

  // 狂战士：生命越低伤害越高
  if (run.jokers.some(j => j.id === 'berserker')) {
    const hpRatio = p.hp / Math.max(1, maxHp);
    damageMultiplier *= (1 + (1 - hpRatio) * 2); // 满血x1，空血x3
  }

  // 套装/关键词协同
  const syn = evaluateSynergies(run);
  damageMultiplier *= syn.damageMultiplier;
  attackSpeedBonus += syn.attackSpeedBonus;
  lifesteal += syn.lifesteal;
  dodgeChance += syn.dodgeChance;
  critChance += syn.critChance;
  chain += syn.chain;
  regen += syn.regen;
  if (syn.armorBonus) armor += syn.armorBonus;
  if (syn.reflect) reflect += syn.reflect;
  if (syn.thorns) thorns += syn.thorns;
  if (syn.slow) slow += syn.slow;
  if (syn.scoreBonus) scoreBonus += syn.scoreBonus;
  if (syn.speedBonus) speed += syn.speedBonus;
  if (syn.attackBonus) attack += syn.attackBonus;
  if (syn.decayRate) decayRate += syn.decayRate;
  run.synergies = syn.names;

  // 攻速计算
  if (attackSpeedBonus > 0) cooldown /= (1 + attackSpeedBonus);
  else if (attackSpeedBonus < 0) cooldown *= (1 - attackSpeedBonus); // 负攻速=减速

  speed -= speedPenalty;

  return {
    maxHp: Math.max(1, Math.round(maxHp)),
    speed: Math.max(30, speed),
    attack: Math.max(1, Math.round(attack)),
    attackCooldown: Math.max(0.08, cooldown),
    armor: Math.max(0, armor),
    thorns, lifesteal, damageMultiplier, revive,
    critChance: Math.min(0.8, critChance),
    critDamageBonus: Math.min(3, critDamageBonus),
    dodgeChance: Math.min(0.65, dodgeChance),
    reflect: Math.min(0.8, reflect),
    rangeBonus, chain, slow, dot, bleed,
    scoreBonus, selfDamageChance, doomTimer, decayRate,
    regen, barrier, armorPierce,
  };
}

function getEnemyScaling(run) {
  const profile = run.waveProfile || {};
  return {
    hpScale: profile.enemyHpScale ?? 1,
    damageScale: profile.enemyDamageScale ?? 1,
    speedScale: profile.enemySpeedScale ?? 1,
    supportDropBonus: profile.supportDropBonus ?? 0,
  };
}

// ============================================================
// 主更新循环
// ============================================================
export function updateRun(run, input, dt) {
  if (run.state === 'wave_transition') {
    run.waveTransitionTimer -= dt;
    if (run.waveTransitionTimer <= 0) run.state = 'playing';
    return;
  }
  if (run.state !== 'playing') return;

  run.gameTime += dt;
  run.waveTime += dt;
  run.screenShake = Math.max(0, run.screenShake - dt * 8);
  run.screenFlash = Math.max(0, run.screenFlash - dt * 4);
  run.dashCooldown = Math.max(0, run.dashCooldown - dt);

  const stats = getPlayerStats(run);
  run.player.maxHp = stats.maxHp;
  if (run.player.hp > stats.maxHp) run.player.hp = stats.maxHp;

  // 再生
  if (stats.regen > 0) run.player.hp = Math.min(stats.maxHp, run.player.hp + stats.regen * dt);

  // 衰败
  if (stats.decayRate > 0) {
    run.player.hp -= stats.decayRate * dt;
    if (run.player.hp <= 0) { die(run, '衰败吞噬了你。'); return; }
  }

  // 末日计时
  if (stats.doomTimer > 0 && run.gameTime >= stats.doomTimer) {
    die(run, '末日降临。'); return;
  }

  // 连击计时
  if (run.combo > 0) {
    run.comboTimer -= dt;
    if (run.comboTimer <= 0) { run.combo = 0; }
  }

  // 冲刺
  if (run.dashTimer > 0) {
    run.dashTimer -= dt;
    run.player.invuln = Math.max(run.player.invuln, run.dashTimer);
  }

  movePlayer(run, input, dt, stats);
  updateTelegraphs(run, dt);
  updateScheduledActions(run, dt);
  updateEnemies(run, dt, stats);
  resolveAutoAttack(run, dt);
  updateProjectiles(run, dt, stats);
  updateParticles(run, dt);
  updatePickups(run, dt);
  updateWaveSpawning(run, dt);
  checkWaveComplete(run);
}

// ============================================================
// 冲刺
// ============================================================
export function dash(run, dirX, dirY) {
  if (run.dashCooldown > 0 || run.state !== 'playing') return;
  const len = Math.hypot(dirX, dirY) || 1;
  const dist = 140;
  const targetX = clamp(run.player.x + (dirX / len) * dist, 40, 1240);
  const targetY = clamp(run.player.y + (dirY / len) * dist, 50, 670);
  // 冲刺残影
  run.particles.push({ type: 'dash_trail', x: run.player.x, y: run.player.y, life: 0.3, maxLife: 0.3 });
  run.player.x = targetX;
  run.player.y = targetY;
  run.dashCooldown = 1.8;
  run.dashTimer = 0.15;
  run.player.invuln = 0.2;
  run.screenShake = 0.2;
  run.events.push('dash');
}

// ============================================================
// 移动
// ============================================================
function movePlayer(run, input, dt, stats) {
  if (run.dashTimer > 0) return;
  const len = Math.hypot(input.x, input.y);
  if (len > 0.1) {
    const nx = input.x / len, ny = input.y / len;
    run.player.x = clamp(run.player.x + nx * stats.speed * dt, 40, 1240);
    run.player.y = clamp(run.player.y + ny * stats.speed * dt, 50, 670);
    run.player.facingAngle = Math.atan2(ny, nx);
  }
  run.player.invuln = Math.max(0, run.player.invuln - dt);
}

// ============================================================
// 敌人AI（核心重写：真正的攻击行为）
// ============================================================
function updateEnemies(run, dt, stats) {
  for (const e of run.enemies) {
    e.hitFlash = Math.max(0, e.hitFlash - dt * 10);
    e.slowTimer = Math.max(0, e.slowTimer - dt);
    const spdMult = e.slowTimer > 0 ? e.slowAmount : 1;

    // 持续伤害
    if (e.dotDamage > 0) {
      e.dotTimer -= dt;
      if (e.dotTimer <= 0) {
        e.dotTimer = 1;
        damageEnemy(run, e, e.dotDamage, stats, false);
      }
    }

    const dx = run.player.x - e.x, dy = run.player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const dirX = dx / dist, dirY = dy / dist;

    // ---- 行为逻辑 ----
    switch (e.behavior) {
      case 'chase':
      case 'slow_chase': {
        // 移向玩家
        e.x += dirX * e.speed * spdMult * dt;
        e.y += dirY * e.speed * spdMult * dt;
        // 到达攻击范围后攻击
        e.attackTimer -= dt;
        if (dist < e.attackRange && e.attackTimer <= 0 && (e.meleePendingDamage ?? 0) <= 0) {
          e.attackTimer = e.attackCooldown;
          startMeleeAttack(run, e, stats);
        }
        break;
      }
      case 'zigzag': {
        e.x += dirX * e.speed * spdMult * dt + Math.sin(run.gameTime * 6 + e.x * 0.05) * 80 * dt;
        e.y += dirY * e.speed * spdMult * dt;
        e.attackTimer -= dt;
        if (dist < e.attackRange && e.attackTimer <= 0 && (e.meleePendingDamage ?? 0) <= 0) {
          e.attackTimer = e.attackCooldown;
          startMeleeAttack(run, e, stats);
        }
        break;
      }
      case 'ranged': {
        // 保持距离
        if (dist < e.preferredDist - 30) {
          e.x -= dirX * e.speed * spdMult * dt;
          e.y -= dirY * e.speed * spdMult * dt;
        } else if (dist > e.preferredDist + 50) {
          e.x += dirX * e.speed * spdMult * dt;
          e.y += dirY * e.speed * spdMult * dt;
        } else {
          // 横向移动
          e.x += (-dirY) * e.speed * 0.5 * spdMult * dt;
          e.y += dirX * e.speed * 0.5 * spdMult * dt;
        }
        // 射击
        e.attackTimer -= dt;
        if (e.attackTimer <= 0 && dist < e.attackRange) {
          e.attackTimer = e.attackCooldown;
          performRangedAttack(run, e);
        }
        break;
      }
      case 'support': {
        // 治疗附近友军
        e.attackTimer -= dt;
        if (e.attackTimer <= 0) {
          e.attackTimer = e.attackCooldown;
          for (const other of run.enemies) {
            if (other !== e && Math.hypot(other.x - e.x, other.y - e.y) < e.attackRange) {
              other.hp = Math.min(other.maxHp, other.hp + e.healAmount);
              run.particles.push({ type: 'heal', x: other.x, y: other.y - other.radius - 5, life: 0.8, maxLife: 0.8, value: e.healAmount });
            }
          }
        }
        // 保持距离
        if (dist < 120) {
          e.x -= dirX * e.speed * spdMult * dt;
          e.y -= dirY * e.speed * spdMult * dt;
        } else {
          e.x += dirX * e.speed * 0.3 * spdMult * dt;
          e.y += dirY * e.speed * 0.3 * spdMult * dt;
        }
        break;
      }
      case 'summoner': {
        e.attackTimer -= dt;
        if (e.attackTimer <= 0) {
          e.attackTimer = e.attackCooldown;
          for (let i = 0; i < e.summonCount; i++) {
            const angle = (i / e.summonCount) * Math.PI * 2;
            const minion = spawnEnemy(run, e.summonType, false);
            minion.x = e.x + Math.cos(angle) * 50;
            minion.y = e.y + Math.sin(angle) * 50;
            run.enemies.push(minion);
          }
          run.particles.push({ type: 'summon', x: e.x, y: e.y, life: 0.8, maxLife: 0.8 });
        }
        // 缓慢靠近
        e.x += dirX * e.speed * spdMult * dt;
        e.y += dirY * e.speed * spdMult * dt;
        break;
      }
      case 'boss_fire':
      case 'boss_ice':
      case 'boss_chaos': {
        // Boss 行为：根据血量比例切换弹幕模式
        const hpRatio = e.hp / e.maxHp;
        let phase = e.phases[0];
        for (const p of e.phases) {
          if (hpRatio <= p.hpThreshold) phase = p;
        }
        // Boss 维持中距离压场，避免首个 Boss 贴脸追击把读招窗口吃掉。
        const preferred = e.preferredDist || 210;
        const driftX = Math.sin(run.gameTime * 1.5) * 26 * dt;
        const driftY = Math.cos(run.gameTime * 1.2) * 22 * dt;
        if (dist < preferred - 40) {
          e.x -= dirX * e.speed * spdMult * dt * 0.85;
          e.y -= dirY * e.speed * spdMult * dt * 0.85;
        } else if (dist > preferred + 70) {
          e.x += dirX * e.speed * spdMult * dt * 0.72;
          e.y += dirY * e.speed * spdMult * dt * 0.72;
        } else {
          e.x += (-dirY) * e.speed * spdMult * dt * 0.55;
          e.y += dirX * e.speed * spdMult * dt * 0.55;
        }
        e.x += driftX;
        e.y += driftY;
        // 弹幕攻击
        e.phaseAttackTimer -= dt;
        if (e.phaseAttackTimer <= 0) {
          e.phaseAttackTimer = phase.attackCooldown;
          performBossAttack(run, e, phase, dirX, dirY, dist);
        }
        e.bulletAngle += dt * 2;
        break;
      }
    }

    updateEnemyAttackResolution(run, e, dt, stats);
  }
  run.enemies = run.enemies.filter(e => e.hp > 0);
}

function updateEnemyAttackResolution(run, e, dt, stats) {
  if (e.attackType === 'melee') {
    e.meleeSwingTimer = Math.max(0, (e.meleeSwingTimer ?? 0) - dt);
    if (e.meleePendingDamage > 0 && e.meleeSwingTimer <= 0) {
      resolveMeleeAttack(run, e, stats);
      e.meleePendingDamage = 0;
    }
  }
}

// ---- 近战攻击 ----
function startMeleeAttack(run, e, stats) {
  // 显示攻击预警
  run.telegraphs.push({
    x: e.x, y: e.y, radius: e.attackRange, angle: 0,
    life: 0.25, maxLife: 0.25, color: 'rgba(255,80,80,0.25)',
    type: 'circle', owner: e.id,
  });
  e.meleeSwingTimer = 0.25;
  e.meleePendingDamage = e.baseDamage;
  e.meleePendingRange = e.attackRange;
  run.particles.push({ type: 'melee_slash', x: e.x, y: e.y, life: 0.3, maxLife: 0.3, angle: Math.atan2(run.player.y - e.y, run.player.x - e.x), radius: e.attackRange });
}

function resolveMeleeAttack(run, e, stats) {
  const dist = Math.hypot(run.player.x - e.x, run.player.y - e.y);
  if (dist < (e.meleePendingRange || e.attackRange) + 15) {
    if (run.rand() < stats.dodgeChance) {
      run.particles.push({ type: 'dodge', x: run.player.x, y: run.player.y - 35, life: 0.6, maxLife: 0.6 });
    } else {
      const dmg = Math.max(1, (e.meleePendingDamage || e.baseDamage) - Math.max(0, stats.armor - (e.armorPierce || 0)));
      takeDamage(run, dmg);
      if (stats.reflect > 0) {
        const refDmg = Math.floor(dmg * stats.reflect);
        damageEnemy(run, e, refDmg, stats, false);
        run.particles.push({ type: 'reflect', x: e.x, y: e.y, life: 0.5, maxLife: 0.5, value: refDmg });
      }
    }
  }
  if (stats.thorns > 0) damageEnemy(run, e, stats.thorns, stats, false);
  e.meleeSwingTimer = 0;
}

// ---- 远程射击 ----
function performRangedAttack(run, e) {
  const dx = run.player.x - e.x, dy = run.player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const dirX = dx / dist, dirY = dy / dist;

  if (e.spreadCount > 1) {
    // 扇形弹幕
    const baseAngle = Math.atan2(dirY, dirX);
    for (let i = 0; i < e.spreadCount; i++) {
      const offset = (i - (e.spreadCount - 1) / 2) * e.spreadAngle;
      const angle = baseAngle + offset;
      run.projectiles.push({
        x: e.x + Math.cos(angle) * (e.radius + 5),
        y: e.y + Math.sin(angle) * (e.radius + 5),
        vx: Math.cos(angle) * e.projectileSpeed,
        vy: Math.sin(angle) * e.projectileSpeed,
        damage: e.baseDamage, life: 3.5,
        radius: e.projectileRadius, color: e.projectileColor,
        fromEnemy: true,
      });
    }
  } else {
    // 单发
    run.projectiles.push({
      x: e.x + dirX * (e.radius + 5),
      y: e.y + dirY * (e.radius + 5),
      vx: dirX * e.projectileSpeed,
      vy: dirY * e.projectileSpeed,
      damage: e.baseDamage, life: 3.5,
      radius: e.projectileRadius, color: e.projectileColor,
      fromEnemy: true,
    });
  }
  if (e.typeKey === 'archer') pushMessage(run, '⚠ 弓箭手拉弓，准备侧移。');
  if (e.typeKey === 'fire_mage') pushMessage(run, '⚠ 火焰法师准备扇形弹幕。');
  run.particles.push({ type: 'shoot_flash', x: e.x + dirX * e.radius, y: e.y + dirY * e.radius, life: 0.15, maxLife: 0.15 });
  run.events.push('bullet_shot');
}

// ---- Boss 弹幕攻击 ----
function performBossAttack(run, boss, phase, dirX, dirY, dist) {
  let { pattern, bulletCount, bulletSpeed } = phase;
  if (run.wave === 5) {
    bulletCount = Math.max(3, Math.floor(bulletCount * 0.62));
    bulletSpeed *= 0.76;
  }

  // 攻击预警
  run.telegraphs.push({
    x: boss.x, y: boss.y, radius: boss.radius + 80, angle: 0,
    life: run.wave === 5 ? 0.52 : 0.4, maxLife: run.wave === 5 ? 0.52 : 0.4, color: 'rgba(255,0,0,0.2)',
    type: 'circle', owner: boss.id,
  });
  pushMessage(run, `⚠ ${boss.name} 即将发动 ${bossAttackLabel(pattern)}。`);

  switch (pattern) {
    case 'circle_shot': {
      // 圆形弹幕
      for (let i = 0; i < bulletCount; i++) {
        const angle = (i / bulletCount) * Math.PI * 2 + boss.bulletAngle;
        run.projectiles.push({
          x: boss.x + Math.cos(angle) * (boss.radius + 5),
          y: boss.y + Math.sin(angle) * (boss.radius + 5),
          vx: Math.cos(angle) * bulletSpeed,
          vy: Math.sin(angle) * bulletSpeed,
          damage: boss.baseDamage, life: 4,
          radius: 7, color: boss.color, fromEnemy: true,
        });
      }
      break;
    }
    case 'spiral_shot': {
      // 螺旋弹幕（分多波发射，使用模拟内调度而不是真实定时器）
      const spiralBursts = run.wave === 5 ? 2 : 3;
      for (let wave = 0; wave < spiralBursts; wave++) {
        scheduleAction(run, wave * 0.15, () => {
          for (let i = 0; i < bulletCount; i++) {
            const angle = (i / bulletCount) * Math.PI * 2 + boss.bulletAngle + wave * 0.3;
            run.projectiles.push({
              x: boss.x + Math.cos(angle) * (boss.radius + 5),
              y: boss.y + Math.sin(angle) * (boss.radius + 5),
              vx: Math.cos(angle) * bulletSpeed,
              vy: Math.sin(angle) * bulletSpeed,
              damage: boss.baseDamage, life: 4.5,
              radius: 6, color: boss.color, fromEnemy: true,
            });
          }
        });
      }
      break;
    }
    case 'aimed_burst': {
      // 瞄准连射
      const baseAngle = Math.atan2(dirY, dirX);
      for (let i = 0; i < bulletCount; i++) {
        const spread = (run.rand() - 0.5) * 0.4;
        const angle = baseAngle + spread;
        run.projectiles.push({
          x: boss.x + Math.cos(baseAngle) * (boss.radius + 5),
          y: boss.y + Math.sin(baseAngle) * (boss.radius + 5),
          vx: Math.cos(angle) * bulletSpeed,
          vy: Math.sin(angle) * bulletSpeed,
          damage: boss.baseDamage * (run.wave === 5 ? 1.08 : 1.3), life: 3,
          radius: 8, color: '#ff0', fromEnemy: true,
        });
      }
      break;
    }
    case 'ring_burst': {
      // 双层环形弹幕
      for (let ring = 0; ring < 2; ring++) {
        const offset = ring * Math.PI / bulletCount;
        for (let i = 0; i < bulletCount; i++) {
          const angle = (i / bulletCount) * Math.PI * 2 + offset;
          const spd = bulletSpeed * (ring === 0 ? 1 : 0.7);
          run.projectiles.push({
            x: boss.x + Math.cos(angle) * (boss.radius + 5),
            y: boss.y + Math.sin(angle) * (boss.radius + 5),
            vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
            damage: boss.baseDamage, life: 5,
            radius: 5, color: '#80deea', fromEnemy: true,
          });
        }
      }
      break;
    }
    case 'cross_shot': {
      // 十字弹幕旋转
      for (let i = 0; i < 4; i++) {
        const baseAngle = boss.bulletAngle + (i * Math.PI / 2);
        for (let j = 0; j < bulletCount; j++) {
          const spd = bulletSpeed * (0.8 + j * 0.15);
          run.projectiles.push({
            x: boss.x, y: boss.y,
            vx: Math.cos(baseAngle) * spd, vy: Math.sin(baseAngle) * spd,
            damage: boss.baseDamage, life: 4,
            radius: 6, color: '#b3e5fc', fromEnemy: true,
          });
        }
      }
      break;
    }
    case 'random_rain': {
      // 随机弹雨
      for (let i = 0; i < bulletCount; i++) {
        const angle = run.rand() * Math.PI * 2;
        const spd = bulletSpeed * (0.6 + run.rand() * 0.8);
        scheduleAction(run, i * 0.08, () => {
          if (run.state !== 'playing') return;
          run.projectiles.push({
            x: boss.x + (run.rand() - 0.5) * 100,
            y: boss.y + (run.rand() - 0.5) * 100,
            vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
            damage: boss.baseDamage * 0.7, life: 3.5,
            radius: 5, color: '#ce93d8', fromEnemy: true,
          });
        });
      }
      break;
    }
  }

  run.screenShake = Math.max(run.screenShake, 0.3);
}

// ============================================================
// 自动攻击
// ============================================================
export function resolveAutoAttack(run, dt) {
  const stats = getPlayerStats(run);
  run.player.attackTimer -= dt;
  if (run.player.attackTimer > 0 || run.enemies.length === 0) return;

  let nearest = null, best = Infinity;
  for (const e of run.enemies) {
    const d = Math.hypot(e.x - run.player.x, e.y - run.player.y);
    if (d < best) { best = d; nearest = e; }
  }
  if (!nearest || best > 280 + stats.rangeBonus) return;

  let damage = Math.round((stats.attack + run.wave * 0.75) * stats.damageMultiplier);
  let isCrit = false;
  if (run.rand() < stats.critChance) {
    damage = Math.round(damage * (1 + stats.critDamageBonus));
    isCrit = true;
  }

  // 自伤检测
  if (stats.selfDamageChance > 0 && run.rand() < stats.selfDamageChance) {
    const selfDmg = Math.floor(damage * 0.2);
    takeDamage(run, selfDmg);
    run.particles.push({ type: 'self_damage', x: run.player.x, y: run.player.y - 25, life: 0.5, maxLife: 0.5, value: selfDmg });
  }

  damageEnemy(run, nearest, damage, stats, isCrit);
  run.player.facingAngle = Math.atan2(nearest.y - run.player.y, nearest.x - run.player.x);

  // 链式攻击
  if (stats.chain > 0) {
    let targets = [nearest];
    for (let i = 0; i < stats.chain; i++) {
      let next = null, nextBest = Infinity;
      for (const e of run.enemies) {
        if (targets.includes(e)) continue;
        const d = Math.hypot(e.x - targets[targets.length - 1].x, e.y - targets[targets.length - 1].y);
        if (d < nextBest && d < 200) { nextBest = d; next = e; }
      }
      if (next) {
        targets.push(next);
        damageEnemy(run, next, Math.floor(damage * 0.65), stats, false);
        run.particles.push({ type: 'chain', x: next.x, y: next.y, life: 0.2, maxLife: 0.2, fromX: targets[targets.length - 2].x, fromY: targets[targets.length - 2].y });
      }
    }
  }

  // 减速 / 中毒 / 流血
  if (stats.slow > 0) { nearest.slowTimer = 2; nearest.slowAmount = 1 - stats.slow; }
  if (stats.dot > 0) { nearest.dotDamage = stats.dot; nearest.dotTimer = 1; }
  if (stats.bleed > 0) { nearest.dotDamage += stats.bleed; }

  // 吸血
  if (stats.lifesteal > 0) {
    const heal = Math.max(1, Math.floor(damage * stats.lifesteal));
    run.player.hp = Math.min(stats.maxHp, run.player.hp + heal);
    run.particles.push({ type: 'lifesteal', x: run.player.x, y: run.player.y - 25, life: 0.5, maxLife: 0.5, value: heal });
  }

  run.enemies = run.enemies.filter(e => e.hp > 0);
  run.particles.push({
    type: 'slash', x: nearest.x, y: nearest.y,
    life: 0.2, maxLife: 0.2, damage, isCrit,
    angle: Math.atan2(nearest.y - run.player.y, nearest.x - run.player.x),
  });
  run.player.attackTimer = stats.attackCooldown;
  run.screenShake = Math.max(run.screenShake, isCrit ? 0.5 : 0.12);
  if (isCrit) run.screenFlash = 0.15;
  run.events.push(isCrit ? 'crit' : 'attack');
}

// ============================================================
// 伤害系统
// ============================================================
function damageEnemy(run, enemy, amount, stats, isCrit) {
  const finalDmg = Math.max(1, amount - Math.max(0, (enemy.armor || 0) - stats.armorPierce));
  enemy.hp -= finalDmg;
  enemy.hitFlash = 1;
  run.score += Math.max(1, Math.floor(finalDmg * (1 + stats.scoreBonus)));
  run.combo += 1;
  run.comboTimer = 2.5;
  run.maxCombo = Math.max(run.maxCombo, run.combo);
  if (run.combo > 0 && run.combo % 5 === 0) run.events.push('combo');

  if (enemy.hp <= 0) {
    run.kills += 1;
    const bonus = enemy.isBoss ? 800 : enemy.isElite ? 160 : 40;
    run.score += Math.floor(bonus * (1 + stats.scoreBonus));
    // 掉落
    const metaDrop = run.metaBonuses?.potionDrop || 0;
    const healChance = clamp((enemy.isElite ? 0.85 : 0.45) + metaDrop + (enemy.supportDropBonus || 0), 0, 1);
    const emberChance = clamp((enemy.isElite ? 1 : 0.7) + (enemy.supportDropBonus || 0) * 0.5, 0, 1);
    if (run.rand() < healChance) run.pickups.push({ type: 'heal', x: enemy.x, y: enemy.y, value: Math.floor(12 + run.wave * 2 + (enemy.isElite ? 14 : 0)), life: 10 });
    if (run.rand() < emberChance) run.pickups.push({ type: 'ember', x: enemy.x + (run.rand() - 0.5) * 20, y: enemy.y + (run.rand() - 0.5) * 20, value: Math.floor(24 + run.wave * 6 + (enemy.isElite ? 36 : 0)), life: 10 });
    run.particles.push({ type: 'death', x: enemy.x, y: enemy.y, life: 0.6, maxLife: 0.6, color: enemy.color });
    run.screenShake = Math.max(run.screenShake, enemy.isBoss ? 1.0 : 0.15);
    if (enemy.isBoss) run.screenFlash = 0.4;
    run.events.push(enemy.isBoss ? 'boss_death' : 'enemy_death');
  }
}

function takeDamage(run, amount) {
  if (run.player.invuln > 0 || amount <= 0) return;

  // 护盾吸收
  if (run.player.barrier > 0) {
    const absorbed = Math.min(run.player.barrier, amount);
    run.player.barrier -= absorbed;
    amount -= absorbed;
    if (absorbed > 0) run.particles.push({ type: 'barrier_hit', x: run.player.x, y: run.player.y - 15, life: 0.3, maxLife: 0.3, value: absorbed });
  }
  if (amount <= 0) return;

  run.player.hp -= amount;
  run.player.invuln = 0.35;
  run.combo = 0;
  run.screenShake = Math.max(run.screenShake, 0.35);
  run.screenFlash = Math.max(run.screenFlash, 0.2);
  run.particles.push({ type: 'hit', x: run.player.x, y: run.player.y, life: 0.4, maxLife: 0.4, damage: Math.round(amount) });
  run.events.push('hit');

  if (run.player.hp <= 0) {
    const stats = getPlayerStats(run);
    if (stats.revive > 0 && !run.reviveUsed) {
      // 凤凰余烬：仅限一次
      run.reviveUsed = true;
      run.player.hp = Math.max(1, Math.round(stats.maxHp * 0.3));
      run.player.invuln = 2.5;
      run.screenShake = 0.8;
      run.screenFlash = 0.6;
      pushMessage(run, '🔥 凤凰余烬燃烧！复活一次。');
      run.events.push('revive');
      // 标记卡牌为已使用
      const reviveCard = run.player.deck.find(c => c.revive && !c.used);
      if (reviveCard) reviveCard.used = true;
      run.particles.push({ type: 'revive', x: run.player.x, y: run.player.y, life: 2, maxLife: 2 });
    } else {
      die(run, '余烬熄灭。');
    }
  }
}

function die(run, msg) {
  run.state = 'gameover';
  const analysis = run.buildAnalysis || analyzeBuild(run);
  const weaknesses = analysis?.weaknesses || {};
  const stats = getPlayerStats(run);
  const waveProfile = run.waveProfile || {};
  let reason = '余烬熄灭。';
  if (stats.doomTimer > 0 && run.gameTime >= stats.doomTimer) {
    reason = '末日计时耗尽，属于高风险爆发构筑失控。';
  } else if (waveProfile.kind === 'boss') {
    if (weaknesses.singleTarget) {
      reason = 'Boss 讨伐失败：输出不足，未能在弹幕窗口内击杀首领。';
    } else if (weaknesses.sustain) {
      reason = 'Boss 讨伐失败：容错不够，一次失误就再难回正。';
    } else {
      reason = 'Boss 讨伐失败：走位和弹幕处理还需优化。';
    }
  } else if (waveProfile.kind === 'elite') {
    reason = '精英波失利：精英敌人抗打且输出高，当前构筑吃不住集中火力。';
  } else if (waveProfile.kind === 'onslaught' || waveProfile.kind === 'siege') {
    if (weaknesses.aoe) {
      reason = '被围杀压垮：清场能力不足，被怪群消耗致死。';
    } else if (weaknesses.sustain) {
      reason = '被围杀压垮：续航不足，持续消耗下血线崩盘。';
    } else {
      reason = '被围杀压垮：站位管理失误，被多路夹击。';
    }
  } else if (weaknesses.singleTarget && !weaknesses.sustain) {
    reason = '你撑住了血线，但首领处理速度不足。';
  } else if (weaknesses.sustain && !weaknesses.singleTarget) {
    reason = '你的输出已成型，但容错与续航不足。';
  } else if (weaknesses.aoe) {
    reason = '你更像单挑构筑，清场与控场能力不足。';
  } else if (weaknesses.safety) {
    reason = '构筑缺少安全网，失误后很难回正。';
  }

  // 构筑回顾
  const deckSize = run.player.deck.length;
  const focus = analysis?.summary || '均衡';
  const buildTip = getBuildTip(analysis);

  run.deathSummary = {
    message: msg,
    reason,
    weaknessTags: Object.entries(weaknesses).filter(([,v]) => v).map(([k]) => k),
    wave: run.wave,
    waveKind: waveProfile.kind,
    waveLabel: waveProfile.label,
    deckSize,
    focus,
    buildTip,
    gameTime: Math.floor(run.gameTime),
    kills: run.kills,
    extremes: run.extremes?.length || 0,
    synergies: run.synergies?.length || 0,
  };
  pushMessage(run, msg);
  pushMessage(run, `☠ ${reason}`);
  if (buildTip) pushMessage(run, `💡 ${buildTip}`);
  run.screenShake = 0.6;
  run.screenFlash = 0.5;
}

function getBuildTip(analysis) {
  if (!analysis) return null;
  const w = analysis.weaknesses || {};
  const focus = analysis.primaryFocus;
  if (w.singleTarget && w.sustain) return '下次尝试在攻击和防御之间更均衡地分配牌选择。';
  if (w.singleTarget) return '输出缺口太大，下次优先拿高伤害或暴击牌。';
  if (w.sustain) return '容错太低，下次补一些回血/护盾/闪避牌。';
  if (w.aoe) return '清场能力不足，下次拿链击/范围/减速牌。';
  if (w.safety) return '缺少安全网，凤凰余烬或屏障牌可以救命。';
  if (focus === 'fortress') return '防御堆太满会缺输出，下次在 Boss 前补一些攻击牌。';
  if (focus === 'barrage') return '速攻构筑需要配合控制，考虑加减速或链击。';
  if (focus === 'crit') return '暴击流需要足够的攻击基础，确保底攻不低。';
  return null;
}

// ============================================================
// 弹幕系统
// ============================================================
function updateProjectiles(run, dt, stats) {
  for (const p of run.projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    // 超出边界
    if (p.x < -50 || p.x > 1330 || p.y < -50 || p.y > 770) p.life = 0;
    // 碰撞玩家
    if (p.fromEnemy) {
      const d = Math.hypot(p.x - run.player.x, p.y - run.player.y);
      if (d < p.radius + run.player.radius) {
        if (run.rand() < stats.dodgeChance) {
          run.particles.push({ type: 'dodge', x: run.player.x, y: run.player.y - 35, life: 0.6, maxLife: 0.6 });
        } else {
          const dmg = Math.max(1, p.damage - stats.armor);
          takeDamage(run, dmg);
        }
        p.life = 0;
        run.particles.push({ type: 'bullet_hit', x: p.x, y: p.y, life: 0.2, maxLife: 0.2, color: p.color });
        run.events.push('bullet_hit');
      }
    }
  }
  run.projectiles = run.projectiles.filter(p => p.life > 0);
}

// ============================================================
// 其他系统
// ============================================================
function updateTelegraphs(run, dt) {
  for (const t of run.telegraphs) t.life -= dt;
  run.telegraphs = run.telegraphs.filter(t => t.life > 0);
}

function scheduleAction(run, delay, fn) {
  run.scheduledActions.push({ delay, fn });
}

function updateScheduledActions(run, dt) {
  for (const action of run.scheduledActions) action.delay -= dt;
  const ready = run.scheduledActions.filter(action => action.delay <= 0);
  run.scheduledActions = run.scheduledActions.filter(action => action.delay > 0);
  for (const action of ready) action.fn();
}

function updateParticles(run, dt) {
  for (const p of run.particles) {
    p.life -= dt;
    if (['heal', 'lifesteal', 'dot', 'dodge', 'reflect', 'barrier_hit', 'self_damage', 'ember_pickup'].includes(p.type)) {
      p.y -= 45 * dt;
    }
  }
  run.particles = run.particles.filter(p => p.life > 0);
}

function updatePickups(run, dt) {
  for (const p of run.pickups) {
    p.life -= dt;
    const d = Math.hypot(p.x - run.player.x, p.y - run.player.y);
    if (d < 50) {
      if (p.type === 'heal') {
        const stats = getPlayerStats(run);
        run.player.hp = Math.min(stats.maxHp, run.player.hp + p.value);
        run.particles.push({ type: 'heal', x: run.player.x, y: run.player.y - 25, life: 0.8, maxLife: 0.8, value: p.value });
        run.events.push('heal');
      } else if (p.type === 'ember') {
        run.score += p.value;
        run.particles.push({ type: 'ember_pickup', x: run.player.x, y: run.player.y - 25, life: 0.6, maxLife: 0.6, value: p.value });
        run.events.push('pickup');
      }
      p.life = 0;
    }
  }
  run.pickups = run.pickups.filter(p => p.life > 0);
}

function bossAttackLabel(pattern) {
  return {
    circle_shot: '环形喷发',
    spiral_shot: '螺旋弹幕',
    aimed_burst: '定点连射',
    ring_burst: '双环爆发',
    cross_shot: '十字冰枪',
    random_rain: '冰雨覆盖',
  }[pattern] || '高压技能';
}

function updateWaveSpawning(run, dt) {
  if (run.waveEnemyQueue.length === 0) return;
  run.spawnTimer -= dt;
  if (run.spawnTimer <= 0) {
    const next = run.waveEnemyQueue[0];
    if ((next?.delay ?? 0) > 0) {
      run.spawnTimer = next.delay;
      next.delay = 0;
      return;
    }
    run.waveEnemyQueue.shift();
    run.spawnTimer = run.waveProfile?.spawnInterval ?? Math.max(0.22, 0.58 - run.wave * 0.012);
    run.enemies.push(spawnEnemy(run, next.type, next.isBoss, next.elite === true));
  }
}

function checkWaveComplete(run) {
  if (run.state !== 'playing') return;
  if (run.enemies.length === 0 && run.waveEnemyQueue.length === 0) {
    if (run.wave >= run.totalWaves) {
      run.state = 'victory';
      run.screenFlash = 0.8;
      pushMessage(run, '🏆 余烬永不熄灭！通关！');
    } else {
      run.state = 'reward';
      run.nextWavePreview = previewNextWaveProfile(run);
      const eventBonus = run.waveProfile?.kind === 'event' ? 2 : 0;
      run.rewardContext = {
        choiceCount: run.waveProfile?.kind === 'event' ? 4 : 3,
        rarityBonus: Math.floor(run.wave / 6) + (run.waveProfile?.rewardBias || 0) + (run.nextWavePreview?.rewardBias || 0) + eventBonus,
        targetTag: run.waveProfile?.kind === 'event' ? 'forge' : (run.nextWavePreview?.rewardTag || run.waveProfile?.rewardTag || 'tempo'),
      };
      run.rewardChoices = buildRewardChoices(run, run.rewardContext.choiceCount, run.rewardContext.rarityBonus, run.nextWavePreview);
      pushMessage(run, `${run.waveProfile?.label || `第 ${run.wave} 波`} 已清空，选择献祭奖励。`);
    }
  }
}

export function updateWaveState(run, _dt) { checkWaveComplete(run); }

export function restart(run, seed = Date.now()) { Object.assign(run, createRun(seed)); }
