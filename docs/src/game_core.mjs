// ============================================================
// 余烬 (Ember) - 游戏核心逻辑
// ============================================================

// ---- 卡牌池 ----
const CARD_POOL = [
  // 攻击牌
  { id: 'strike_plus', name: '锋利斩击', type: 'attack', rarity: 'common', damage: 8, desc: '自动攻击伤害 +8', sacrifice: { stat: 'health', amount: 0.06 } },
  { id: 'flame_sword', name: '烈焰剑', type: 'attack', rarity: 'rare', damage: 18, desc: '自动攻击附带烈焰，伤害 +18', sacrifice: { stat: 'speed', amount: 0.12 } },
  { id: 'quick_blade', name: '快刃', type: 'attack', rarity: 'common', attackSpeedBonus: 0.25, desc: '攻击频率 +25%', sacrifice: { stat: 'attack', amount: 0.06 } },
  { id: 'lightning', name: '闪电链', type: 'attack', rarity: 'rare', damage: 12, chain: 2, desc: '攻击额外弹射 2 个敌人', sacrifice: { stat: 'health', amount: 0.1 } },
  { id: 'poison_dagger', name: '毒匕首', type: 'attack', rarity: 'common', damage: 5, dot: 3, desc: '攻击附带中毒，每秒 3 点持续伤害', sacrifice: { stat: 'speed', amount: 0.08 } },
  { id: 'bleed_axe', name: '血斧', type: 'attack', rarity: 'rare', damage: 15, bleed: 5, desc: '攻击附带流血，每秒 5 点持续伤害', sacrifice: { stat: 'attack_speed', amount: 0.1 } },
  { id: 'shadow_blade', name: '暗影之刃', type: 'attack', rarity: 'epic', damage: 25, critChance: 0.3, desc: '30% 暴击率，暴击伤害 x2', sacrifice: { stat: 'health', amount: 0.15 } },
  { id: 'frost_staff', name: '冰霜法杖', type: 'attack', rarity: 'rare', damage: 10, slow: 0.5, desc: '攻击减速敌人 50%', sacrifice: { stat: 'attack', amount: 0.08 } },
  // 防御牌
  { id: 'iron_wall', name: '铁壁', type: 'defense', rarity: 'common', armorBonus: 4, desc: '护甲 +4', sacrifice: { stat: 'speed', amount: 0.1 } },
  { id: 'dodge_cloak', name: '闪避斗篷', type: 'defense', rarity: 'rare', dodgeChance: 0.15, desc: '15% 几率闪避攻击', sacrifice: { stat: 'attack', amount: 0.1 } },
  { id: 'reflect_shield', name: '反射之盾', type: 'defense', rarity: 'rare', reflect: 0.3, desc: '反弹 30% 受到的伤害', sacrifice: { stat: 'speed', amount: 0.12 } },
  { id: 'barrier', name: '能量屏障', type: 'defense', rarity: 'epic', barrier: 30, desc: '战斗开始时获得 30 点护盾', sacrifice: { stat: 'health', amount: 0.12 } },
  { id: 'thorn_skin', name: '荆棘皮肤', type: 'defense', rarity: 'common', thorns: 5, desc: '碰撞敌人时反伤 +5', sacrifice: { stat: 'attack_speed', amount: 0.08 } },
  { id: 'heal_aura', name: '治愈光环', type: 'defense', rarity: 'rare', regen: 2, desc: '每秒恢复 2 点生命', sacrifice: { stat: 'attack', amount: 0.1 } },
  // 被动牌
  { id: 'heavy_core', name: '沉重核心', type: 'passive', rarity: 'common', attackBonus: 16, desc: '攻击 +16', sacrifice: { stat: 'speed', amount: 0.15 } },
  { id: 'swift_feet', name: '迅捷脚步', type: 'passive', rarity: 'common', speedBonus: 35, desc: '速度 +35', sacrifice: { stat: 'attack', amount: 0.08 } },
  { id: 'crit_eye', name: '暴击之眼', type: 'passive', rarity: 'rare', critChance: 0.2, desc: '暴击率 +20%', sacrifice: { stat: 'health', amount: 0.1 } },
  { id: 'range_extend', name: '射程延伸', type: 'passive', rarity: 'common', rangeBonus: 80, desc: '攻击范围 +80', sacrifice: { stat: 'speed', amount: 0.06 } },
  // 小丑牌
  { id: 'blood_pact', name: '血之契约', type: 'joker', rarity: 'rare', attackBonus: 10, desc: '攻击 +10，每波扣少量生命', sacrifice: { stat: 'health', amount: 0.1 } },
  { id: 'glass_cannon', name: '玻璃炮', type: 'joker', rarity: 'epic', damageMultiplier: 1.8, desc: '总伤害 x1.8', sacrifice: { stat: 'health', amount: 0.2 } },
  { id: 'vampire_edge', name: '吸血刃', type: 'joker', rarity: 'rare', lifesteal: 0.12, desc: '造成伤害时吸血 12%', sacrifice: { stat: 'speed', amount: 0.08 } },
  { id: 'collector', name: '收藏家', type: 'joker', rarity: 'epic', desc: '每有 5 张牌，伤害 +5%', perCardsDamage: 0.05, sacrifice: { stat: 'attack_speed', amount: 0.06 } },
  { id: 'phoenix_ember', name: '凤凰余烬', type: 'joker', rarity: 'legendary', revive: 1, desc: '死亡时复活一次', sacrifice: { stat: 'health', amount: 0.2 } },
  { id: 'double_or_nothing', name: '双倍或归零', type: 'joker', rarity: 'epic', damageMultiplier: 2.0, selfDamageChance: 0.2, desc: '伤害 x2，但 20% 几率自伤', sacrifice: { stat: 'health', amount: 0.15 } },
  { id: 'time_warp', name: '时间扭曲', type: 'joker', rarity: 'legendary', attackSpeedBonus: 0.5, desc: '攻速 +50%', sacrifice: { stat: 'speed', amount: 0.15 } },
  { id: 'greed', name: '贪婪', type: 'joker', rarity: 'rare', scoreBonus: 0.5, desc: '击杀得分 +50%', sacrifice: { stat: 'health', amount: 0.08 } },
  // 诅咒牌
  { id: 'doom', name: '末日', type: 'curse', rarity: 'epic', damageMultiplier: 2.5, doomTimer: 30, desc: '伤害 x2.5，但 30 秒后强制死亡', sacrifice: { stat: 'health', amount: 0.25 } },
  { id: 'decay', name: '衰败', type: 'curse', rarity: 'rare', attackBonus: 20, decayRate: 1, desc: '攻击 +20，但每秒失去 1 点生命', sacrifice: { stat: 'speed', amount: 0.1 } },
];

// ---- 敌人类型 ----
const ENEMY_TYPES = {
  slime: { name: '史莱姆', color: '#4CAF50', radius: 12, hpMult: 1, dmgMult: 1, spdMult: 1, behavior: 'chase' },
  bat: { name: '蝙蝠', color: '#9C27B0', radius: 8, hpMult: 0.6, dmgMult: 0.8, spdMult: 1.8, behavior: 'zigzag' },
  skeleton: { name: '骷髅', color: '#EEEEEE', radius: 14, hpMult: 1.2, dmgMult: 1.3, spdMult: 0.9, behavior: 'chase' },
  golem: { name: '石像鬼', color: '#795548', radius: 22, hpMult: 3, dmgMult: 2, spdMult: 0.4, behavior: 'slow_chase' },
  archer: { name: '弓箭手', color: '#FF9800', radius: 11, hpMult: 0.8, dmgMult: 1.5, spdMult: 0.7, behavior: 'ranged', attackRange: 250, shootCooldown: 2 },
  healer: { name: '治疗者', color: '#E91E63', radius: 10, hpMult: 0.7, dmgMult: 0.5, spdMult: 0.8, behavior: 'healer', healAmount: 5, healCooldown: 3 },
  summoner: { name: '召唤者', color: '#673AB7', radius: 16, hpMult: 1.5, dmgMult: 0.3, spdMult: 0.5, behavior: 'summoner', summonCooldown: 5 },
  ghost: { name: '幽灵', color: '#00BCD4', radius: 10, hpMult: 0.5, dmgMult: 1.2, spdMult: 1.5, behavior: 'phase', phaseCooldown: 3 },
};

// ---- Boss 类型 ----
const BOSS_TYPES = {
  dragon: { name: '幼龙', color: '#F44336', radius: 35, hpMult: 15, dmgMult: 3, spdMult: 0.6, behavior: 'boss_charge', phases: 3 },
  lich: { name: '巫妖王', color: '#607D8B', radius: 30, hpMult: 12, dmgMult: 4, spdMult: 0.5, behavior: 'boss_summon', phases: 3 },
  demon: { name: '恶魔领主', color: '#B71C1C', radius: 40, hpMult: 20, dmgMult: 5, spdMult: 0.4, behavior: 'boss_aoe', phases: 3 },
};

// ---- 随机数生成器 ----
function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ---- 创建新游戏 ----
export function createRun(seed = Date.now()) {
  const run = {
    seed,
    rand: mulberry32(seed),
    state: 'playing', // playing, reward, gameover, paused, wave_transition
    wave: 0,
    waveTime: 0,
    waveTransitionTimer: 0,
    totalWaves: 20,
    rewardChoices: [],
    kills: 0,
    score: 0,
    scoreMultiplier: 1,
    combo: 0,
    maxCombo: 0,
    messages: ['余烬已燃起。'],
    screenShake: 0,
    dashCooldown: 0,
    dashTimer: 0,
    player: {
      x: 640, y: 360, radius: 16,
      hp: 100, maxHp: 100,
      baseSpeed: 240, baseAttack: 12, baseAttackCooldown: 0.55,
      attackTimer: 0,
      invuln: 0,
      barrier: 0,
      regen: 0,
      deck: [
        { id: 'starter_blade', name: '旧剑', type: 'attack', rarity: 'common', damage: 6, desc: '基础伤害 +6' },
        { id: 'starter_guard', name: '护身符', type: 'defense', rarity: 'common', armorBonus: 1, desc: '护甲 +1' },
        { id: 'starter_spark', name: '火星', type: 'attack', rarity: 'common', damage: 4, desc: '基础伤害 +4' },
      ],
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
    projectiles: [],
    particles: [],
    pickups: [],
    waveEnemiesRemaining: 0,
    waveEnemiesSpawned: 0,
    waveEnemyQueue: [],
    spawnTimer: 0,
    hitFlash: 0,
  };
  startNextWave(run);
  return run;
}

// ---- 开始下一波 ----
function startNextWave(run) {
  run.wave += 1;
  run.waveTime = 0;
  run.state = 'wave_transition';
  run.waveTransitionTimer = 2.0;
  run.waveEnemiesSpawned = 0;
  run.waveEnemyQueue = [];
  run.spawnTimer = 0;
  run.combo = 0;
  run.hitFlash = 0;

  // 生成敌人队列
  const isBoss = run.wave % 5 === 0;
  if (isBoss) {
    // Boss 波
    const bossKeys = Object.keys(BOSS_TYPES);
    const bossKey = bossKeys[Math.floor(run.rand() * bossKeys.length)];
    run.waveEnemyQueue.push({ type: bossKey, isBoss: true });
    // 加一些小怪
    const minionCount = 5 + run.wave;
    for (let i = 0; i < minionCount; i++) {
      const minionKeys = Object.keys(ENEMY_TYPES);
      const minionKey = minionKeys[Math.floor(run.rand() * minionKeys.length)];
      run.waveEnemyQueue.push({ type: minionKey, isBoss: false });
    }
  } else {
    // 普通波
    const count = Math.min(8 + run.wave * 2, 50);
    for (let i = 0; i < count; i++) {
      const keys = Object.keys(ENEMY_TYPES);
      // 根据波次解锁敌人类型
      const availableKeys = keys.filter((_, idx) => idx <= Math.min(keys.length - 1, 2 + Math.floor(run.wave / 3)));
      const key = availableKeys[Math.floor(run.rand() * availableKeys.length)];
      run.waveEnemyQueue.push({ type: key, isBoss: false });
    }
  }
  run.waveEnemiesRemaining = run.waveEnemyQueue.length;

  // 每波开始时回复少量生命
  const healAmount = Math.floor(run.player.maxHp * 0.05);
  run.player.hp = Math.min(run.player.maxHp, run.player.hp + healAmount);
  if (healAmount > 0) {
    run.particles.push({ type: 'heal', x: run.player.x, y: run.player.y - 20, life: 1, maxLife: 1, value: healAmount });
  }
}

// ---- 创建敌人 ----
function spawnEnemy(run, typeKey, isBoss) {
  const type = isBoss ? BOSS_TYPES[typeKey] : ENEMY_TYPES[typeKey];
  const side = Math.floor(run.rand() * 4);
  let x, y;
  if (side === 0) { x = run.rand() * 1280; y = -30; }
  else if (side === 1) { x = 1310; y = run.rand() * 720; }
  else if (side === 2) { x = run.rand() * 1280; y = 750; }
  else { x = -30; y = run.rand() * 720; }

  const waveScale = 1 + run.wave * 0.15;
  const hp = Math.floor(30 * type.hpMult * waveScale * (isBoss ? 1 : 1));
  const damage = Math.floor(5 * type.dmgMult * waveScale);
  const speed = 80 * type.spdMult * (1 + run.wave * 0.02);

  return {
    id: `${isBoss ? 'boss' : 'e'}_${run.wave}_${run.waveEnemiesSpawned}`,
    typeKey,
    isBoss,
    name: type.name,
    color: type.color,
    x, y,
    radius: type.radius,
    hp, maxHp: hp,
    baseDamage: damage,
    speed,
    behavior: type.behavior,
    touchTimer: 0,
    attackTimer: 0,
    shootTimer: type.shootCooldown || 0,
    phaseTimer: type.phaseCooldown || 0,
    phased: false,
    healTimer: type.healCooldown || 0,
    summonTimer: type.summonCooldown || 0,
    bossPhase: 1,
    bossPhaseTimer: 0,
    dotTimer: 0,
    dotDamage: 0,
    slowTimer: 0,
    slowAmount: 1,
    hitFlash: 0,
  };
}

// ---- 获取卡牌池 ----
export function getCardPool() {
  return clone(CARD_POOL);
}

// ---- 随机抽取卡牌 ----
export function rollCardChoices(run, count = 3) {
  const pool = clone(CARD_POOL);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(run.rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

// ---- 应用卡牌选择 ----
export function applyCardChoice(run, card) {
  const c = clone(card);
  run.player.deck.push(c);
  if (c.type === 'joker' && !run.jokers.some(j => j.id === c.id)) run.jokers.push(c);
  if (c.sacrifice) applySacrifice(run, c.sacrifice);
  if (c.barrier) run.player.barrier += c.barrier;
  if (c.regen) run.player.regen += c.regen;
  run.messages.unshift(`获得【${c.name}】，献祭${sacrificeText(c.sacrifice)}`);
  if (run.messages.length > 5) run.messages.pop();

  if (run.state === 'reward') {
    run.state = 'playing';
    run.rewardChoices = [];
    startNextWave(run);
  }
}

function sacrificeText(sacrifice) {
  if (!sacrifice) return '无';
  const names = { speed: '速度', attack: '攻击', health: '生命', attack_speed: '攻速' };
  return `${names[sacrifice.stat] ?? sacrifice.stat} ${(sacrifice.amount * 100).toFixed(0)}%`;
}

function applySacrifice(run, sacrifice) {
  const bucket = run.sacrifices[sacrifice.stat];
  if (!bucket) return;
  bucket.count += 1;
  bucket.amount += sacrifice.amount;
  if (bucket.count >= 3) {
    const extremeMap = {
      speed: '磐石之躯',
      attack: '诅咒之王',
      health: '幽灵血脉',
      attack_speed: '巨炮节奏',
    };
    const name = extremeMap[sacrifice.stat];
    if (name && !run.extremes.includes(name)) {
      run.extremes.push(name);
      run.messages.unshift(`极端化觉醒：${name}`);
    }
  }
}

// ---- 获取玩家属性 ----
export function getPlayerStats(run) {
  let maxHp = run.player.maxHp * Math.max(0.2, 1 - run.sacrifices.health.amount);
  let speed = run.player.baseSpeed * Math.max(0.15, 1 - run.sacrifices.speed.amount);
  let attack = run.player.baseAttack * Math.max(0.2, 1 - run.sacrifices.attack.amount);
  let cooldown = run.player.baseAttackCooldown * (1 + run.sacrifices.attack_speed.amount);
  let armor = 0, thorns = 0, lifesteal = 0, damageMultiplier = 1, revive = 0;
  let critChance = 0, dodgeChance = 0, reflect = 0, rangeBonus = 0;
  let attackSpeedBonus = 0, chain = 0, slow = 0, dot = 0, bleed = 0;
  let scoreBonus = 0, selfDamageChance = 0, doomTimer = 0, decayRate = 0;

  for (const card of run.player.deck) {
    attack += card.damage ?? 0;
    attack += card.attackBonus ?? 0;
    armor += card.armorBonus ?? 0;
    speed += card.speedBonus ?? 0;
    thorns += card.thorns ?? 0;
    lifesteal += card.lifesteal ?? 0;
    revive += card.revive ?? 0;
    critChance += card.critChance ?? 0;
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
    if (card.damageMultiplier) damageMultiplier *= card.damageMultiplier;
    if (card.perCardsDamage) damageMultiplier *= (1 + Math.floor(run.player.deck.length / 5) * card.perCardsDamage);
  }

  // 应用极端化效果
  if (run.extremes.includes('磐石之躯')) damageMultiplier *= 2.5;
  if (run.extremes.includes('幽灵血脉')) { maxHp = Math.max(1, maxHp * 0.4); speed += 100; }
  if (run.extremes.includes('巨炮节奏')) { cooldown *= 1.8; damageMultiplier *= 2.2; }
  if (run.extremes.includes('诅咒之王')) { attack *= 0.5; damageMultiplier *= 2.0; }

  // 应用攻速加成
  if (attackSpeedBonus > 0) cooldown /= (1 + attackSpeedBonus);

  return {
    maxHp: Math.max(1, Math.round(maxHp)),
    speed: Math.max(30, speed),
    attack: Math.max(1, attack),
    attackCooldown: Math.max(0.1, cooldown),
    armor, thorns, lifesteal, damageMultiplier, revive,
    critChance: Math.min(0.8, critChance),
    dodgeChance: Math.min(0.6, dodgeChance),
    reflect: Math.min(0.8, reflect),
    rangeBonus, chain, slow, dot, bleed,
    scoreBonus, selfDamageChance, doomTimer, decayRate,
  };
}

// ---- 更新游戏状态 ----
export function updateRun(run, input, dt) {
  if (run.state === 'wave_transition') {
    run.waveTransitionTimer -= dt;
    if (run.waveTransitionTimer <= 0) {
      run.state = 'playing';
    }
    return;
  }
  if (run.state !== 'playing') return;

  run.waveTime += dt;
  run.screenShake = Math.max(0, run.screenShake - dt * 10);
  run.hitFlash = Math.max(0, run.hitFlash - dt * 5);
  run.dashCooldown = Math.max(0, run.dashCooldown - dt);

  const stats = getPlayerStats(run);
  run.player.maxHp = stats.maxHp;
  if (run.player.hp > stats.maxHp) run.player.hp = stats.maxHp;

  // 再生
  if (run.player.regen > 0) {
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + run.player.regen * dt);
  }

  // 衰败诅咒
  if (stats.decayRate > 0) {
    run.player.hp -= stats.decayRate * dt;
    if (run.player.hp <= 0) {
      run.state = 'gameover';
      run.messages.unshift('衰败吞噬了你。');
      return;
    }
  }

  // 末日计时
  if (stats.doomTimer > 0) {
    run.waveTime += dt;
    if (run.waveTime >= stats.doomTimer) {
      run.state = 'gameover';
      run.messages.unshift('末日降临。');
      return;
    }
  }

  // 冲刺
  if (run.dashTimer > 0) {
    run.dashTimer -= dt;
    run.player.invuln = Math.max(run.player.invuln, run.dashTimer);
  }

  movePlayer(run, input, dt, stats);
  updateEnemies(run, dt, stats);
  resolveAutoAttack(run, dt);
  updateProjectiles(run, dt, stats);
  updateParticles(run, dt);
  updatePickups(run, dt);
  updateWaveSpawning(run, dt);
  updateWaveState(run, dt);
}

// ---- 冲刺 ----
export function dash(run, dirX, dirY) {
  if (run.dashCooldown > 0 || run.state !== 'playing') return;
  const len = Math.hypot(dirX, dirY) || 1;
  run.player.x += (dirX / len) * 120;
  run.player.y += (dirY / len) * 120;
  run.player.x = clamp(run.player.x, 30, 1250);
  run.player.y = clamp(run.player.y, 45, 675);
  run.dashCooldown = 2.0;
  run.dashTimer = 0.2;
  run.player.invuln = 0.25;
  run.screenShake = 0.3;
  run.particles.push({ type: 'dash', x: run.player.x, y: run.player.y, life: 0.3, maxLife: 0.3 });
}

// ---- 移动玩家 ----
function movePlayer(run, input, dt, stats) {
  if (run.dashTimer > 0) return; // 冲刺中不接受移动输入
  const len = Math.hypot(input.x, input.y) || 1;
  const nx = input.x / len, ny = input.y / len;
  run.player.x = clamp(run.player.x + nx * stats.speed * dt, 30, 1250);
  run.player.y = clamp(run.player.y + ny * stats.speed * dt, 45, 675);
  run.player.invuln = Math.max(0, run.player.invuln - dt);
}

// ---- 更新敌人 ----
function updateEnemies(run, dt, stats) {
  for (const e of run.enemies) {
    e.hitFlash = Math.max(0, e.hitFlash - dt * 8);
    e.slowTimer = Math.max(0, e.slowTimer - dt);

    // 持续伤害
    if (e.dotDamage > 0) {
      e.dotTimer -= dt;
      if (e.dotTimer <= 0) {
        e.hp -= e.dotDamage;
        e.dotTimer = 1;
        run.particles.push({ type: 'dot', x: e.x, y: e.y - e.radius, life: 0.5, maxLife: 0.5, value: e.dotDamage });
      }
    }

    const dx = run.player.x - e.x, dy = run.player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const speedMult = e.slowTimer > 0 ? e.slowAmount : 1;

    // 行为逻辑
    switch (e.behavior) {
      case 'chase':
      case 'slow_chase':
        e.x += (dx / d) * e.speed * speedMult * dt;
        e.y += (dy / d) * e.speed * speedMult * dt;
        break;
      case 'zigzag':
        e.x += (dx / d) * e.speed * speedMult * dt + Math.sin(run.waveTime * 5 + e.x * 0.1) * 60 * dt;
        e.y += (dy / d) * e.speed * speedMult * dt;
        break;
      case 'ranged':
        if (d < e.attackRange) {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            e.shootTimer = ENEMY_TYPES[e.typeKey]?.shootCooldown || 2;
            run.projectiles.push({
              x: e.x, y: e.y,
              vx: (dx / d) * 300, vy: (dy / d) * 300,
              damage: e.baseDamage, life: 3, radius: 6, color: '#FF9800', fromEnemy: true,
            });
          }
        } else {
          e.x += (dx / d) * e.speed * speedMult * dt;
          e.y += (dy / d) * e.speed * speedMult * dt;
        }
        break;
      case 'healer':
        // 治疗附近敌人
        e.healTimer -= dt;
        if (e.healTimer <= 0) {
          e.healTimer = ENEMY_TYPES[e.typeKey]?.healCooldown || 3;
          for (const other of run.enemies) {
            if (other !== e && Math.hypot(other.x - e.x, other.y - e.y) < 200) {
              other.hp = Math.min(other.maxHp, other.hp + ENEMY_TYPES[e.typeKey]?.healAmount || 5);
              run.particles.push({ type: 'heal', x: other.x, y: other.y - other.radius, life: 0.8, maxLife: 0.8, value: ENEMY_TYPES[e.typeKey]?.healAmount || 5 });
            }
          }
        }
        e.x += (dx / d) * e.speed * speedMult * dt;
        e.y += (dy / d) * e.speed * speedMult * dt;
        break;
      case 'summoner':
        e.summonTimer -= dt;
        if (e.summonTimer <= 0) {
          e.summonTimer = ENEMY_TYPES[e.typeKey]?.summonCooldown || 5;
          const minion = spawnEnemy(run, 'slime', false);
          minion.x = e.x + (Math.random() - 0.5) * 60;
          minion.y = e.y + (Math.random() - 0.5) * 60;
          run.enemies.push(minion);
          run.particles.push({ type: 'summon', x: e.x, y: e.y, life: 0.6, maxLife: 0.6 });
        }
        e.x += (dx / d) * e.speed * speedMult * dt;
        e.y += (dy / d) * e.speed * speedMult * dt;
        break;
      case 'phase':
        e.phaseTimer -= dt;
        if (e.phaseTimer <= 0) {
          e.phaseTimer = ENEMY_TYPES[e.typeKey]?.phaseCooldown || 3;
          e.phased = !e.phased;
        }
        if (!e.phased) {
          e.x += (dx / d) * e.speed * speedMult * dt;
          e.y += (dy / d) * e.speed * speedMult * dt;
        }
        break;
      case 'boss_charge':
        e.bossPhaseTimer -= dt;
        if (e.bossPhaseTimer <= 0) {
          e.bossPhaseTimer = 3;
          // 冲向玩家
          e.x += (dx / d) * 400 * dt;
          e.y += (dy / d) * 400 * dt;
        } else {
          e.x += (dx / d) * e.speed * speedMult * dt;
          e.y += (dy / d) * e.speed * speedMult * dt;
        }
        break;
      case 'boss_summon':
        e.summonTimer -= dt;
        if (e.summonTimer <= 0) {
          e.summonTimer = 4;
          for (let i = 0; i < 3; i++) {
            const minion = spawnEnemy(run, 'skeleton', false);
            minion.x = e.x + (Math.random() - 0.5) * 100;
            minion.y = e.y + (Math.random() - 0.5) * 100;
            run.enemies.push(minion);
          }
          run.particles.push({ type: 'summon', x: e.x, y: e.y, life: 0.8, maxLife: 0.8 });
        }
        e.x += (dx / d) * e.speed * speedMult * dt;
        e.y += (dy / d) * e.speed * speedMult * dt;
        break;
      case 'boss_aoe':
        e.bossPhaseTimer -= dt;
        if (e.bossPhaseTimer <= 0) {
          e.bossPhaseTimer = 4;
          // AOE 攻击
          if (d < 200) {
            takeDamage(run, e.baseDamage * 1.5);
            run.screenShake = 0.5;
            run.particles.push({ type: 'aoe', x: run.player.x, y: run.player.y, life: 0.5, maxLife: 0.5, radius: 200 });
          }
        }
        e.x += (dx / d) * e.speed * speedMult * dt;
        e.y += (dy / d) * e.speed * speedMult * dt;
        break;
    }

    // 碰撞检测
    const touching = d < e.radius + run.player.radius && !e.phased;
    e.touchTimer = Math.max(0, (e.touchTimer ?? 0) - dt);
    if (touching && e.touchTimer <= 0 && e.behavior !== 'ranged' && e.behavior !== 'healer') {
      e.touchTimer = 0.5;
      // 闪避检测
      if (Math.random() < stats.dodgeChance) {
        run.particles.push({ type: 'dodge', x: run.player.x, y: run.player.y - 30, life: 0.6, maxLife: 0.6 });
      } else {
        const dmg = Math.max(1, e.baseDamage - stats.armor);
        takeDamage(run, dmg);
        // 反射
        if (stats.reflect > 0) {
          const reflectDmg = Math.floor(dmg * stats.reflect);
          e.hp -= reflectDmg;
          run.particles.push({ type: 'reflect', x: e.x, y: e.y, life: 0.4, maxLife: 0.4, value: reflectDmg });
        }
      }
      if (stats.thorns > 0) damageEnemy(run, e, stats.thorns, stats);
    }
  }
  run.enemies = run.enemies.filter(e => e.hp > 0);
}

// ---- 自动攻击 ----
export function resolveAutoAttack(run, dt) {
  const stats = getPlayerStats(run);
  run.player.attackTimer -= dt;
  if (run.player.attackTimer > 0 || run.enemies.length === 0) return;

  let nearest = null, best = Infinity;
  for (const e of run.enemies) {
    const d = Math.hypot(e.x - run.player.x, e.y - run.player.y);
    if (d < best) { best = d; nearest = e; }
  }
  if (!nearest || best > 300 + stats.rangeBonus) return;

  let damage = Math.round(stats.attack * stats.damageMultiplier);
  let isCrit = false;
  if (Math.random() < stats.critChance) {
    damage *= 2;
    isCrit = true;
  }

  // 自伤检测
  if (stats.selfDamageChance > 0 && Math.random() < stats.selfDamageChance) {
    takeDamage(run, Math.floor(damage * 0.3));
    run.particles.push({ type: 'self_damage', x: run.player.x, y: run.player.y - 20, life: 0.5, maxLife: 0.5, value: Math.floor(damage * 0.3) });
  }

  damageEnemy(run, nearest, damage, stats, isCrit);

  // 链式攻击
  if (stats.chain > 0) {
    let chainTargets = [nearest];
    for (let i = 0; i < stats.chain; i++) {
      let nextTarget = null, nextBest = Infinity;
      for (const e of run.enemies) {
        if (chainTargets.includes(e)) continue;
        const d = Math.hypot(e.x - chainTargets[chainTargets.length - 1].x, e.y - chainTargets[chainTargets.length - 1].y);
        if (d < nextBest && d < 200) { nextBest = d; nextTarget = e; }
      }
      if (nextTarget) {
        chainTargets.push(nextTarget);
        damageEnemy(run, nextTarget, Math.floor(damage * 0.6), stats, false);
      }
    }
  }

  // 减速
  if (stats.slow > 0) {
    nearest.slowTimer = 2;
    nearest.slowAmount = 1 - stats.slow;
  }

  // 中毒
  if (stats.dot > 0) {
    nearest.dotDamage = stats.dot;
    nearest.dotTimer = 1;
  }

  // 流血
  if (stats.bleed > 0) {
    nearest.dotDamage += stats.bleed;
  }

  // 吸血
  if (stats.lifesteal > 0) {
    const heal = Math.floor(damage * stats.lifesteal);
    run.player.hp = Math.min(stats.maxHp, run.player.hp + heal);
    if (heal > 0) run.particles.push({ type: 'lifesteal', x: run.player.x, y: run.player.y - 20, life: 0.5, maxLife: 0.5, value: heal });
  }

  run.enemies = run.enemies.filter(e => e.hp > 0);
  run.particles.push({
    type: 'slash', x: nearest.x, y: nearest.y,
    life: 0.2, maxLife: 0.2, damage, isCrit,
    angle: Math.atan2(nearest.y - run.player.y, nearest.x - run.player.x),
  });
  run.player.attackTimer = stats.attackCooldown;
  run.screenShake = Math.max(run.screenShake, isCrit ? 0.4 : 0.15);
}

// ---- 伤害敌人 ----
function damageEnemy(run, enemy, amount, stats, isCrit = false) {
  enemy.hp -= amount;
  enemy.hitFlash = 1;
  run.score += Math.max(1, Math.floor(amount * (1 + stats.scoreBonus)));
  run.combo += 1;
  run.maxCombo = Math.max(run.maxCombo, run.combo);

  if (enemy.hp <= 0) {
    run.kills += 1;
    run.score += Math.floor((enemy.isBoss ? 500 : 50) * (1 + stats.scoreBonus));
    // 掉落恢复球
    if (Math.random() < 0.3) {
      run.pickups.push({ type: 'heal', x: enemy.x, y: enemy.y, value: 10, life: 8 });
    }
    // 掉落余烬（分数）
    if (Math.random() < 0.5) {
      run.pickups.push({ type: 'ember', x: enemy.x, y: enemy.y, value: 25, life: 8 });
    }
    run.particles.push({ type: 'death', x: enemy.x, y: enemy.y, life: 0.5, maxLife: 0.5, color: enemy.color });
    run.screenShake = Math.max(run.screenShake, enemy.isBoss ? 0.8 : 0.2);
  }
}

// ---- 受到伤害 ----
function takeDamage(run, amount) {
  if (run.player.invuln > 0) return;

  // 护盾吸收
  if (run.player.barrier > 0) {
    const absorbed = Math.min(run.player.barrier, amount);
    run.player.barrier -= absorbed;
    amount -= absorbed;
    if (absorbed > 0) run.particles.push({ type: 'barrier_hit', x: run.player.x, y: run.player.y, life: 0.3, maxLife: 0.3, value: absorbed });
  }

  if (amount <= 0) return;

  run.player.hp -= amount;
  run.player.invuln = 0.3;
  run.combo = 0;
  run.hitFlash = 1;
  run.particles.push({ type: 'hit', x: run.player.x, y: run.player.y, life: 0.4, maxLife: 0.4, damage: Math.round(amount) });
  run.screenShake = Math.max(run.screenShake, 0.3);

  if (run.player.hp <= 0) {
    const stats = getPlayerStats(run);
    const reviveCard = run.player.deck.find(c => c.revive && !c.used);
    if (stats.revive > 0 && reviveCard) {
      reviveCard.used = true;
      run.player.hp = Math.max(1, Math.round(stats.maxHp * 0.3));
      run.player.invuln = 2;
      run.screenShake = 0.6;
      run.messages.unshift('凤凰余烬燃烧：复活一次。');
      run.particles.push({ type: 'revive', x: run.player.x, y: run.player.y, life: 1.5, maxLife: 1.5 });
    } else {
      run.state = 'gameover';
      run.messages.unshift('余烬熄灭。');
    }
  }
}

// ---- 更新弹幕 ----
function updateProjectiles(run, dt, stats) {
  for (const p of run.projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;

    if (p.fromEnemy) {
      const d = Math.hypot(p.x - run.player.x, p.y - run.player.y);
      if (d < p.radius + run.player.radius) {
        if (Math.random() < stats.dodgeChance) {
          run.particles.push({ type: 'dodge', x: run.player.x, y: run.player.y - 30, life: 0.6, maxLife: 0.6 });
        } else {
          takeDamage(run, Math.max(1, p.damage - stats.armor));
        }
        p.life = 0;
      }
    }
  }
  run.projectiles = run.projectiles.filter(p => p.life > 0);
}

// ---- 更新粒子 ----
function updateParticles(run, dt) {
  for (const p of run.particles) {
    p.life -= dt;
    if (p.type === 'heal' || p.type === 'lifesteal' || p.type === 'dot' || p.type === 'dodge' || p.type === 'reflect' || p.type === 'barrier_hit' || p.type === 'self_damage') {
      p.y -= 40 * dt;
    }
  }
  run.particles = run.particles.filter(p => p.life > 0);
}

// ---- 更新拾取物 ----
function updatePickups(run, dt) {
  for (const p of run.pickups) {
    p.life -= dt;
    const d = Math.hypot(p.x - run.player.x, p.y - run.player.y);
    if (d < 40) {
      if (p.type === 'heal') {
        run.player.hp = Math.min(run.player.maxHp, run.player.hp + p.value);
        run.particles.push({ type: 'heal', x: run.player.x, y: run.player.y - 20, life: 0.8, maxLife: 0.8, value: p.value });
      } else if (p.type === 'ember') {
        run.score += p.value;
        run.particles.push({ type: 'ember_pickup', x: run.player.x, y: run.player.y - 20, life: 0.6, maxLife: 0.6, value: p.value });
      }
      p.life = 0;
    }
  }
  run.pickups = run.pickups.filter(p => p.life > 0);
}

// ---- 波次生成 ----
function updateWaveSpawning(run, dt) {
  if (run.waveEnemyQueue.length === 0) return;
  run.spawnTimer -= dt;
  if (run.spawnTimer <= 0) {
    run.spawnTimer = 0.3;
    const next = run.waveEnemyQueue.shift();
    const enemy = spawnEnemy(run, next.type, next.isBoss);
    run.enemies.push(enemy);
    run.waveEnemiesSpawned++;
  }
}

// ---- 波次状态 ----
export function updateWaveState(run, _dt) {
  if (run.state !== 'playing') return;
  if (run.enemies.length === 0 && run.waveEnemyQueue.length === 0) {
    if (run.wave >= run.totalWaves) {
      run.state = 'victory';
      run.messages.unshift('余烬永不熄灭！通关！');
    } else {
      run.state = 'reward';
      run.rewardChoices = rollCardChoices(run, 3);
      run.messages.unshift(`第 ${run.wave} 波清空，选择一次献祭奖励。`);
    }
  }
}

// ---- 重新开始 ----
export function restart(run, seed = Date.now()) {
  Object.assign(run, createRun(seed));
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
