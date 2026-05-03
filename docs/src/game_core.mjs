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
  { id: 'gatling', name: '加特林', type: 'attack', rarity: 'epic', damage: 3, attackSpeedBonus: 1.0, desc: '每次攻击只造成 3 伤害，但攻速 x2', sacrifice: { stat: 'health', amount: 0.1 } },

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
      { hpThreshold: 1.0, attackCooldown: 3.0, pattern: 'circle_shot', bulletCount: 12, bulletSpeed: 200 },
      { hpThreshold: 0.6, attackCooldown: 2.0, pattern: 'spiral_shot', bulletCount: 8, bulletSpeed: 250 },
      { hpThreshold: 0.3, attackCooldown: 1.2, pattern: 'aimed_burst', bulletCount: 5, bulletSpeed: 350 },
    ],
  },
  lich: {
    name: '巫妖王·寒冰', color: '#37474F', radius: 33, hpMult: 14, dmgMult: 2, spdMult: 0.5,
    behavior: 'boss_ice', attackType: 'boss_ice_storm',
    phases: [
      { hpThreshold: 1.0, attackCooldown: 3.5, pattern: 'ring_burst', bulletCount: 16, bulletSpeed: 180 },
      { hpThreshold: 0.5, attackCooldown: 2.5, pattern: 'cross_shot', bulletCount: 4, bulletSpeed: 300 },
      { hpThreshold: 0.25, attackCooldown: 1.5, pattern: 'random_rain', bulletCount: 20, bulletSpeed: 220 },
    ],
  },
  demon: {
    name: '恶魔领主·混沌', color: '#B71C1C', radius: 42, hpMult: 25, dmgMult: 4, spdMult: 0.4,
    behavior: 'boss_chaos', attackType: 'boss_chaos',
    phases: [
      { hpThreshold: 1.0, attackCooldown: 2.5, pattern: 'circle_shot', bulletCount: 20, bulletSpeed: 220 },
      { hpThreshold: 0.7, attackCooldown: 2.0, pattern: 'spiral_shot', bulletCount: 12, bulletSpeed: 280 },
      { hpThreshold: 0.4, attackCooldown: 1.0, pattern: 'aimed_burst', bulletCount: 8, bulletSpeed: 400 },
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

// ============================================================
// 创建新游戏
// ============================================================
export function createRun(seed = Date.now(), character = null) {
  // 角色默认值（向后兼容）
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
    state: 'playing',
    wave: 0,
    waveTime: 0,
    waveTransitionTimer: 0,
    totalWaves: 25,
    gameTime: 0,
    rewardChoices: [],
    kills: 0,
    score: 0,
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
      hp: ch.baseHp, maxHp: ch.baseHp,
      baseSpeed: ch.baseSpeed, baseAttack: ch.baseAttack, baseAttackCooldown: ch.baseAttackCooldown,
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
    enemies: [],
    projectiles: [],     // 敌方弹幕
    playerProjectiles: [], // 玩家弹幕（暂未使用，预留给远程build）
    particles: [],
    pickups: [],
    telegraphs: [],      // 攻击预警区域
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
  if (isBoss) {
    const bossKeys = Object.keys(BOSS_TYPES);
    const bossKey = bossKeys[Math.min(Math.floor(run.wave / 10), bossKeys.length - 1)] || bossKeys[0];
    run.waveEnemyQueue.push({ type: bossKey, isBoss: true });
    for (let i = 0; i < 3 + run.wave; i++) {
      const minionKeys = Object.keys(ENEMY_TYPES);
      const available = minionKeys.filter((_, idx) => idx <= Math.min(minionKeys.length - 1, 2 + Math.floor(run.wave / 4)));
      run.waveEnemyQueue.push({ type: available[Math.floor(run.rand() * available.length)], isBoss: false });
    }
  } else {
    const count = Math.min(6 + Math.floor(run.wave * 2.5), 55);
    for (let i = 0; i < count; i++) {
      const keys = Object.keys(ENEMY_TYPES);
      const available = keys.filter((_, idx) => idx <= Math.min(keys.length - 1, 2 + Math.floor(run.wave / 3)));
      run.waveEnemyQueue.push({ type: available[Math.floor(run.rand() * available.length)], isBoss: false });
    }
  }

  // 每波开始：回血 + 小丑牌特殊效果
  const stats = getPlayerStats(run);
  const healAmount = Math.floor(stats.maxHp * 0.08);
  run.player.hp = Math.min(stats.maxHp, run.player.hp + healAmount);
  if (healAmount > 0) run.particles.push({ type: 'heal', x: run.player.x, y: run.player.y - 25, life: 1.2, maxLife: 1.2, value: healAmount });

  // 血之契约：每波扣血
  if (run.jokers.some(j => j.id === 'blood_pact')) {
    const dmg = Math.floor(stats.maxHp * 0.05);
    run.player.hp = Math.max(1, run.player.hp - dmg);
    run.particles.push({ type: 'self_damage', x: run.player.x, y: run.player.y - 25, life: 1, maxLife: 1, value: dmg });
  }
}

// ============================================================
// 生成敌人
// ============================================================
function spawnEnemy(run, typeKey, isBoss) {
  const type = isBoss ? BOSS_TYPES[typeKey] : ENEMY_TYPES[typeKey];
  const side = Math.floor(run.rand() * 4);
  let x, y;
  if (side === 0) { x = 60 + run.rand() * 1160; y = -40; }
  else if (side === 1) { x = 1320; y = 60 + run.rand() * 600; }
  else if (side === 2) { x = 60 + run.rand() * 1160; y = 760; }
  else { x = -40; y = 60 + run.rand() * 600; }

  const waveScale = 1 + run.wave * 0.18;
  const hp = Math.floor((isBoss ? 200 : 25) * type.hpMult * waveScale);
  const damage = Math.floor((isBoss ? 10 : 4) * type.dmgMult * (1 + run.wave * 0.08));
  const speed = (isBoss ? 60 : 80) * type.spdMult * (1 + run.wave * 0.015);

  return {
    id: `${isBoss ? 'boss' : 'e'}_${run.wave}_${run.waveEnemyQueue.length}`,
    typeKey, isBoss,
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
    preferredDist: type.preferredDist || 0,
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
    dotTimer: 0, dotDamage: 0,
    slowTimer: 0, slowAmount: 1,
    hitFlash: 0,
    phased: false, phaseTimer: 0,
    // 攻击预警
    telegraphTimer: 0,
    telegraphType: null,
  };
}

// ============================================================
// 卡牌系统
// ============================================================
export function getCardPool() { return clone(CARD_POOL); }

export function rollCardChoices(run, count = 3) {
  const pool = clone(CARD_POOL);
  // 权重：稀有度越高越难出
  const weights = { common: 4, rare: 3, epic: 1.5, legendary: 0.5 };
  const weighted = [];
  for (const card of pool) {
    const w = weights[card.rarity] || 1;
    for (let i = 0; i < Math.ceil(w * 2); i++) weighted.push(card);
  }
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

export function applyCardChoice(run, card) {
  const c = clone(card);
  run.player.deck.push(c);
  if (c.type === 'joker') {
    if (!run.jokers.some(j => j.id === c.id)) run.jokers.push(c);
  }
  if (c.sacrifice) applySacrifice(run, c.sacrifice);
  if (c.barrier) run.player.barrier += c.barrier;
  if (c.regen) run.player.regen += c.regen;
  run.messages.unshift(`获得【${c.name}】· 代价：${sacrificeText(c.sacrifice)}`);
  if (run.messages.length > 5) run.messages.pop();

  if (run.state === 'reward') {
    run.state = 'playing';
    run.rewardChoices = [];
    startNextWave(run);
  }
}

function sacrificeText(s) {
  if (!s) return '无';
  const names = { speed: '移速', attack: '攻击', health: '生命', attack_speed: '攻速' };
  return `${names[s.stat] ?? s.stat} -${(s.amount * 100).toFixed(0)}%`;
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
      run.messages.unshift(`🔥 极端化觉醒：${name}`);
      run.screenFlash = 0.5;
      run.events.push('extreme');
    }
  }
}

// ============================================================
// 属性计算（核心公式）
// ============================================================
export function getPlayerStats(run) {
  const p = run.player;
  const s = run.sacrifices;

  // 基础属性 × (1 - 牺牲比例)
  let maxHp = p.maxHp * Math.max(0.15, 1 - s.health.amount);
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
        if (dist < e.attackRange && e.attackTimer <= 0) {
          e.attackTimer = e.attackCooldown;
          performMeleeAttack(run, e, stats);
        }
        break;
      }
      case 'zigzag': {
        e.x += dirX * e.speed * spdMult * dt + Math.sin(run.gameTime * 6 + e.x * 0.05) * 80 * dt;
        e.y += dirY * e.speed * spdMult * dt;
        e.attackTimer -= dt;
        if (dist < e.attackRange && e.attackTimer <= 0) {
          e.attackTimer = e.attackCooldown;
          performMeleeAttack(run, e, stats);
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
        // 移动：缓慢追踪+正弦漂移
        e.x += dirX * e.speed * spdMult * dt + Math.sin(run.gameTime * 1.5) * 30 * dt;
        e.y += dirY * e.speed * spdMult * dt + Math.cos(run.gameTime * 1.2) * 25 * dt;
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

    // 碰撞伤害（仅近战行为）
    if (e.attackType === 'melee' || e.attackType === 'heal_aura' || e.attackType === 'summon') {
      const touching = dist < e.radius + run.player.radius;
      e.touchTimer = Math.max(0, (e.touchTimer ?? 0) - dt);
      if (touching && e.touchTimer <= 0) {
        e.touchTimer = 0.5;
        if (Math.random() < stats.dodgeChance) {
          run.particles.push({ type: 'dodge', x: run.player.x, y: run.player.y - 35, life: 0.6, maxLife: 0.6 });
        } else {
          const dmg = Math.max(1, e.baseDamage - Math.max(0, stats.armor - (e.armorPierce || 0)));
          takeDamage(run, dmg);
          if (stats.reflect > 0) {
            const refDmg = Math.floor(dmg * stats.reflect);
            damageEnemy(run, e, refDmg, stats, false);
            run.particles.push({ type: 'reflect', x: e.x, y: e.y, life: 0.5, maxLife: 0.5, value: refDmg });
          }
        }
        if (stats.thorns > 0) damageEnemy(run, e, stats.thorns, stats, false);
      }
    }
  }
  run.enemies = run.enemies.filter(e => e.hp > 0);
}

// ---- 近战攻击 ----
function performMeleeAttack(run, e, stats) {
  // 显示攻击预警
  run.telegraphs.push({
    x: e.x, y: e.y, radius: e.attackRange, angle: 0,
    life: 0.25, maxLife: 0.25, color: 'rgba(255,80,80,0.25)',
    type: 'circle', owner: e.id,
  });
  // 延迟伤害（预警结束后）
  const dist = Math.hypot(run.player.x - e.x, run.player.y - e.y);
  if (dist < e.attackRange + 15) {
    if (Math.random() < stats.dodgeChance) {
      run.particles.push({ type: 'dodge', x: run.player.x, y: run.player.y - 35, life: 0.6, maxLife: 0.6 });
    } else {
      takeDamage(run, Math.max(1, e.baseDamage - stats.armor));
    }
  }
  run.particles.push({ type: 'melee_slash', x: e.x, y: e.y, life: 0.3, maxLife: 0.3, angle: Math.atan2(run.player.y - e.y, run.player.x - e.x), radius: e.attackRange });
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
  run.particles.push({ type: 'shoot_flash', x: e.x + dirX * e.radius, y: e.y + dirY * e.radius, life: 0.15, maxLife: 0.15 });
  run.events.push('bullet_shot');
}

// ---- Boss 弹幕攻击 ----
function performBossAttack(run, boss, phase, dirX, dirY, dist) {
  const { pattern, bulletCount, bulletSpeed } = phase;

  // 攻击预警
  run.telegraphs.push({
    x: boss.x, y: boss.y, radius: boss.radius + 80, angle: 0,
    life: 0.4, maxLife: 0.4, color: 'rgba(255,0,0,0.2)',
    type: 'circle', owner: boss.id,
  });

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
      // 螺旋弹幕（分多波发射）
      for (let wave = 0; wave < 3; wave++) {
        setTimeout(() => {
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
        }, wave * 150);
      }
      break;
    }
    case 'aimed_burst': {
      // 瞄准连射
      const baseAngle = Math.atan2(dirY, dirX);
      for (let i = 0; i < bulletCount; i++) {
        const spread = (Math.random() - 0.5) * 0.4;
        const angle = baseAngle + spread;
        run.projectiles.push({
          x: boss.x + Math.cos(baseAngle) * (boss.radius + 5),
          y: boss.y + Math.sin(baseAngle) * (boss.radius + 5),
          vx: Math.cos(angle) * bulletSpeed,
          vy: Math.sin(angle) * bulletSpeed,
          damage: boss.baseDamage * 1.3, life: 3,
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
        const angle = Math.random() * Math.PI * 2;
        const spd = bulletSpeed * (0.6 + Math.random() * 0.8);
        setTimeout(() => {
          if (run.state !== 'playing') return;
          run.projectiles.push({
            x: boss.x + (Math.random() - 0.5) * 100,
            y: boss.y + (Math.random() - 0.5) * 100,
            vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
            damage: boss.baseDamage * 0.7, life: 3.5,
            radius: 5, color: '#ce93d8', fromEnemy: true,
          });
        }, i * 80);
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

  let damage = Math.round(stats.attack * stats.damageMultiplier);
  let isCrit = false;
  if (Math.random() < stats.critChance) {
    damage = Math.round(damage * (1 + stats.critDamageBonus));
    isCrit = true;
  }

  // 自伤检测
  if (stats.selfDamageChance > 0 && Math.random() < stats.selfDamageChance) {
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
        damageEnemy(run, next, Math.floor(damage * 0.5), stats, false);
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
    const bonus = enemy.isBoss ? 800 : 40;
    run.score += Math.floor(bonus * (1 + stats.scoreBonus));
    // 掉落
    if (Math.random() < 0.35) run.pickups.push({ type: 'heal', x: enemy.x, y: enemy.y, value: Math.floor(8 + run.wave * 1.5), life: 10 });
    if (Math.random() < 0.6) run.pickups.push({ type: 'ember', x: enemy.x + (Math.random() - 0.5) * 20, y: enemy.y + (Math.random() - 0.5) * 20, value: Math.floor(20 + run.wave * 5), life: 10 });
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
      run.messages.unshift('🔥 凤凰余烬燃烧！复活一次。');
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
  run.messages.unshift(msg);
  run.screenShake = 0.6;
  run.screenFlash = 0.5;
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
        if (Math.random() < stats.dodgeChance) {
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

function updateWaveSpawning(run, dt) {
  if (run.waveEnemyQueue.length === 0) return;
  run.spawnTimer -= dt;
  if (run.spawnTimer <= 0) {
    run.spawnTimer = Math.max(0.15, 0.5 - run.wave * 0.01);
    const next = run.waveEnemyQueue.shift();
    run.enemies.push(spawnEnemy(run, next.type, next.isBoss));
  }
}

function checkWaveComplete(run) {
  if (run.state !== 'playing') return;
  if (run.enemies.length === 0 && run.waveEnemyQueue.length === 0) {
    if (run.wave >= run.totalWaves) {
      run.state = 'victory';
      run.screenFlash = 0.8;
      run.messages.unshift('🏆 余烬永不熄灭！通关！');
    } else {
      run.state = 'reward';
      run.rewardChoices = rollCardChoices(run, 3);
      run.messages.unshift(`第 ${run.wave} 波清空，选择献祭奖励。`);
    }
  }
}

export function updateWaveState(run, _dt) { checkWaveComplete(run); }

export function restart(run, seed = Date.now()) { Object.assign(run, createRun(seed)); }

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
