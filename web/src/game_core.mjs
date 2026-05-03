const CARD_POOL = [
  { id: 'strike_plus', name: '锋利斩击', type: 'attack', damage: 8, desc: '自动攻击伤害 +8', sacrifice: { stat: 'health', amount: 0.08 } },
  { id: 'flame_sword', name: '烈焰剑', type: 'attack', damage: 18, desc: '自动攻击附带烈焰，伤害 +18', sacrifice: { stat: 'speed', amount: 0.15 } },
  { id: 'quick_blade', name: '快刃', type: 'attack', attackSpeedBonus: 0.25, desc: '攻击频率 +25%', sacrifice: { stat: 'attack', amount: 0.08 } },
  { id: 'iron_wall', name: '铁壁', type: 'passive', armorBonus: 4, desc: '护甲 +4', sacrifice: { stat: 'speed', amount: 0.12 } },
  { id: 'blood_pact', name: '血之契约', type: 'joker', attackBonus: 10, desc: '攻击 +10，每波扣少量生命', sacrifice: { stat: 'health', amount: 0.12 } },
  { id: 'thorn_skin', name: '荆棘皮肤', type: 'passive', thorns: 5, desc: '碰撞敌人时反伤 +5', sacrifice: { stat: 'attack_speed', amount: 0.12 } },
  { id: 'glass_cannon', name: '玻璃炮', type: 'joker', damageMultiplier: 1.8, desc: '总伤害 x1.8', sacrifice: { stat: 'health', amount: 0.25 } },
  { id: 'vampire_edge', name: '吸血刃', type: 'attack', lifesteal: 0.12, desc: '造成伤害时吸血 12%', sacrifice: { stat: 'speed', amount: 0.1 } },
  { id: 'collector', name: '收藏家', type: 'joker', desc: '每有5张牌，伤害 +5%', perCardsDamage: 0.05, sacrifice: { stat: 'attack_speed', amount: 0.08 } },
  { id: 'heavy_core', name: '沉重核心', type: 'passive', attackBonus: 16, desc: '攻击 +16', sacrifice: { stat: 'speed', amount: 0.18 } },
  { id: 'swift_feet', name: '迅捷脚步', type: 'passive', speedBonus: 35, desc: '速度 +35', sacrifice: { stat: 'attack', amount: 0.1 } },
  { id: 'phoenix_ember', name: '凤凰余烬', type: 'joker', revive: 1, desc: '死亡时复活一次', sacrifice: { stat: 'health', amount: 0.28 } },
];

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

export function createRun(seed = Date.now()) {
  const run = {
    seed,
    rand: mulberry32(seed),
    state: 'playing',
    wave: 1,
    waveTime: 0,
    rewardChoices: [],
    kills: 0,
    score: 0,
    messages: ['余烬已燃起。'],
    player: {
      x: 640, y: 360, radius: 15,
      hp: 100, maxHp: 100,
      baseSpeed: 220, baseAttack: 12, baseAttackCooldown: 0.62,
      attackTimer: 0,
      invuln: 0,
      deck: [
        { id: 'starter_blade', name: '旧剑', type: 'attack', damage: 6, desc: '基础伤害 +6' },
        { id: 'starter_guard', name: '护身符', type: 'passive', armorBonus: 1, desc: '护甲 +1' },
        { id: 'starter_spark', name: '火星', type: 'attack', damage: 4, desc: '基础伤害 +4' },
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
    particles: [],
  };
  spawnWave(run);
  return run;
}

export function getCardPool() {
  return clone(CARD_POOL);
}

export function rollCardChoices(run, count = 3) {
  const pool = clone(CARD_POOL);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(run.rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function applyCardChoice(run, card) {
  const c = clone(card);
  run.player.deck.push(c);
  if (c.type === 'joker' && !run.jokers.some(j => j.id === c.id)) run.jokers.push(c);
  if (c.sacrifice) applySacrifice(run, c.sacrifice);
  run.messages.unshift(`获得【${c.name}】，献祭${sacrificeText(c.sacrifice)}`);
  if (run.messages.length > 5) run.messages.pop();
  if (run.state === 'reward') {
    run.wave += 1;
    run.waveTime = 0;
    run.state = 'playing';
    run.rewardChoices = [];
    spawnWave(run);
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

export function getPlayerStats(run) {
  let maxHp = run.player.maxHp * Math.max(0.25, 1 - run.sacrifices.health.amount);
  let speed = run.player.baseSpeed * Math.max(0.2, 1 - run.sacrifices.speed.amount);
  let attack = run.player.baseAttack * Math.max(0.25, 1 - run.sacrifices.attack.amount);
  let cooldown = run.player.baseAttackCooldown * (1 + run.sacrifices.attack_speed.amount);
  let armor = 0;
  let thorns = 0;
  let lifesteal = 0;
  let damageMultiplier = 1;
  let revive = 0;

  for (const card of run.player.deck) {
    attack += card.damage ?? 0;
    attack += card.attackBonus ?? 0;
    armor += card.armorBonus ?? 0;
    speed += card.speedBonus ?? 0;
    thorns += card.thorns ?? 0;
    lifesteal += card.lifesteal ?? 0;
    revive += card.revive ?? 0;
    if (card.attackSpeedBonus) cooldown /= (1 + card.attackSpeedBonus);
    if (card.damageMultiplier) damageMultiplier *= card.damageMultiplier;
    if (card.perCardsDamage) damageMultiplier *= (1 + Math.floor(run.player.deck.length / 5) * card.perCardsDamage);
  }
  if (run.extremes.includes('磐石之躯')) damageMultiplier *= 2.5;
  if (run.extremes.includes('幽灵血脉')) { maxHp = Math.max(1, maxHp * 0.45); speed += 80; }
  if (run.extremes.includes('巨炮节奏')) { cooldown *= 1.7; damageMultiplier *= 2.2; }
  if (run.extremes.includes('诅咒之王')) { attack *= 0.6; damageMultiplier *= 1.9; }

  return {
    maxHp: Math.max(1, Math.round(maxHp)),
    speed: Math.max(40, speed),
    attack: Math.max(1, attack),
    attackCooldown: Math.max(0.12, cooldown),
    armor,
    thorns,
    lifesteal,
    damageMultiplier,
    revive,
  };
}

export function spawnWave(run) {
  run.enemies = [];
  const count = Math.min(6 + run.wave * 2, 44);
  const boss = run.wave % 5 === 0;
  for (let i = 0; i < count; i++) run.enemies.push(makeEnemy(run, false, i));
  if (boss) run.enemies.push(makeEnemy(run, true, 999));
}

function makeEnemy(run, boss, index) {
  const side = Math.floor(run.rand() * 4);
  let x = 0, y = 0;
  if (side === 0) { x = run.rand() * 1280; y = -30; }
  if (side === 1) { x = 1310; y = run.rand() * 720; }
  if (side === 2) { x = run.rand() * 1280; y = 750; }
  if (side === 3) { x = -30; y = run.rand() * 720; }
  const hp = boss ? 220 + run.wave * 65 : 18 + run.wave * 7 + run.rand() * run.wave * 3;
  return {
    id: `${boss ? 'boss' : 'e'}_${run.wave}_${index}`,
    boss,
    x, y,
    radius: boss ? 30 : 13,
    hp, maxHp: hp,
    speed: boss ? 48 + run.wave * 2 : 55 + run.wave * 4 + run.rand() * 45,
    damage: boss ? 18 + run.wave * 3 : 4 + run.wave * 1.2,
    touchTimer: 0,
  };
}

export function updateRun(run, input, dt) {
  if (run.state !== 'playing') return;
  run.waveTime += dt;
  const stats = getPlayerStats(run);
  run.player.maxHp = stats.maxHp;
  if (run.player.hp > stats.maxHp) run.player.hp = stats.maxHp;
  movePlayer(run, input, dt, stats);
  updateEnemies(run, dt, stats);
  resolveAutoAttack(run, dt);
  updateParticles(run, dt);
  updateWaveState(run, dt);
}

function movePlayer(run, input, dt, stats) {
  const len = Math.hypot(input.x, input.y) || 1;
  const nx = input.x / len, ny = input.y / len;
  run.player.x = clamp(run.player.x + nx * stats.speed * dt, 30, 1250);
  run.player.y = clamp(run.player.y + ny * stats.speed * dt, 45, 675);
  run.player.invuln = Math.max(0, run.player.invuln - dt);
}

function updateEnemies(run, dt, stats) {
  for (const e of run.enemies) {
    const dx = run.player.x - e.x, dy = run.player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.x += dx / d * e.speed * dt;
    e.y += dy / d * e.speed * dt;
    const touching = d < e.radius + run.player.radius;
    e.touchTimer = Math.max(0, (e.touchTimer ?? 0) - dt);
    if (touching && e.touchTimer <= 0) {
      e.touchTimer = 0.55;
      takeDamage(run, Math.max(1, e.damage - stats.armor));
      if (stats.thorns > 0) damageEnemy(run, e, stats.thorns);
    }
  }
  run.enemies = run.enemies.filter(e => e.hp > 0);
}

export function resolveAutoAttack(run, dt) {
  const stats = getPlayerStats(run);
  run.player.attackTimer -= dt;
  if (run.player.attackTimer > 0 || run.enemies.length === 0) return;
  let nearest = null;
  let best = Infinity;
  for (const e of run.enemies) {
    const d = Math.hypot(e.x - run.player.x, e.y - run.player.y);
    if (d < best) { best = d; nearest = e; }
  }
  if (!nearest || best > 360) return;
  const damage = Math.round(stats.attack * stats.damageMultiplier);
  damageEnemy(run, nearest, damage);
  run.enemies = run.enemies.filter(e => e.hp > 0);
  if (stats.lifesteal > 0) run.player.hp = Math.min(stats.maxHp, run.player.hp + damage * stats.lifesteal);
  run.particles.push({ type: 'slash', x: nearest.x, y: nearest.y, life: 0.22, maxLife: 0.22, damage });
  run.player.attackTimer = stats.attackCooldown;
}

function damageEnemy(run, enemy, amount) {
  enemy.hp -= amount;
  run.score += Math.max(1, Math.floor(amount));
  if (enemy.hp <= 0) {
    run.kills += 1;
    run.score += enemy.boss ? 250 : 20;
  }
}

function takeDamage(run, amount) {
  if (run.player.invuln > 0) return;
  run.player.hp -= amount;
  run.player.invuln = 0.25;
  run.particles.push({ type: 'hit', x: run.player.x, y: run.player.y, life: 0.35, maxLife: 0.35, damage: Math.round(amount) });
  if (run.player.hp <= 0) {
    const stats = getPlayerStats(run);
    const reviveCard = run.player.deck.find(c => c.revive && !c.used);
    if (stats.revive > 0 && reviveCard) {
      reviveCard.used = true;
      run.player.hp = Math.max(1, Math.round(stats.maxHp * 0.35));
      run.messages.unshift('凤凰余烬燃烧：复活一次。');
    } else {
      run.state = 'gameover';
      run.messages.unshift('余烬熄灭。');
    }
  }
}

export function updateWaveState(run, _dt) {
  if (run.state !== 'playing') return;
  if (run.enemies.length === 0) {
    run.state = 'reward';
    run.rewardChoices = rollCardChoices(run, 3);
    run.messages.unshift(`第 ${run.wave} 波清空，选择一次献祭奖励。`);
  }
}

function updateParticles(run, dt) {
  for (const p of run.particles) p.life -= dt;
  run.particles = run.particles.filter(p => p.life > 0);
}

export function restart(run, seed = Date.now()) {
  Object.assign(run, createRun(seed));
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
