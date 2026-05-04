// ============================================================
// 余烬 Ember - 存档系统 v3 (局外 Meta Progression)
// ============================================================

const SAVE_KEY = 'ember_save_v3';

const DEFAULT_SAVE = {
  version: 3,
  bestScore: 0,
  bestWave: 0,
  totalRuns: 0,
  totalWins: 0,
  totalKills: 0,
  highCombo: 0,
  tutorialDone: false,
  unlockedCharacters: ['warrior'],
  selectedCharacter: 'warrior',
  emberCurrency: 0, // 局外货币
  metaUpgrades: {
    hpBoost: 0,        // 每级 +5 最大生命
    attackBoost: 0,    // 每级 +1 攻击
    speedBoost: 0,     // 每级 +5 速度
    rerollCount: 0,    // 每级 +1 局内重随次数
    startEmber: 0,     // 每级 +20 初始分数
    potionDrop: 0,     // 每级 +5% 恢复球掉率
  },
  achievements: [],
  unlockedCards: [],
  discoveredSynergies: [],
  sfxVolume: 0.5,
  bgmVolume: 0.12,
  masterVolume: 0.6,
};

const UPGRADE_COSTS = {
  hpBoost: [50, 100, 180, 280, 400],
  attackBoost: [60, 120, 220, 340, 500],
  speedBoost: [40, 90, 160, 250, 360],
  rerollCount: [80, 160, 280],
  startEmber: [30, 80, 150, 240],
  potionDrop: [50, 110, 190, 300],
};

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const data = JSON.parse(raw);
    if (data.version !== 3) return migrateOldSave(data);
    return mergeSave(data);
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

function mergeSave(data) {
  return {
    ...DEFAULT_SAVE,
    ...data,
    metaUpgrades: { ...DEFAULT_SAVE.metaUpgrades, ...(data.metaUpgrades || {}) },
  };
}

function migrateOldSave(data) {
  // v2 -> v3 迁移
  const migrated = {
    ...DEFAULT_SAVE,
    ...data,
    version: 3,
    emberCurrency: data.emberCurrency || 0,
    metaUpgrades: { ...DEFAULT_SAVE.metaUpgrades, ...(data.metaUpgrades || {}) },
    achievements: data.achievements || [],
    unlockedCards: data.unlockedCards || [],
    discoveredSynergies: data.discoveredSynergies || [],
  };
  save(migrated);
  return migrated;
}

function save(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch {}
}

// ---- 基础 API ----
export function getSave() { return load(); }

export function updateSave(patch) {
  const data = load();
  Object.assign(data, patch);
  save(data);
  return data;
}

// ---- 局后结算 ----
export function recordRun(score, wave, kills, maxCombo, won, character) {
  const data = load();
  data.totalRuns += 1;
  if (won) data.totalWins += 1;
  data.totalKills += kills;
  if (score > data.bestScore) data.bestScore = Math.floor(score);
  if (wave > data.bestWave) data.bestWave = wave;
  if (maxCombo > data.highCombo) data.highCombo = maxCombo;

  // 余烬货币奖励公式
  const emberGain = Math.floor(
    20 + wave * 6 + kills * 0.5 + maxCombo * 2 + (won ? 120 : 0)
  );
  data.emberCurrency += emberGain;

  // 角色解锁
  if (won && !data.unlockedCharacters.includes('mage')) data.unlockedCharacters.push('mage');
  if (data.totalRuns >= 5 && !data.unlockedCharacters.includes('rogue')) data.unlockedCharacters.push('rogue');
  if (data.bestWave >= 15 && !data.unlockedCharacters.includes('necro')) data.unlockedCharacters.push('necro');

  // 成就
  if (won && !data.achievements.includes('first_win')) data.achievements.push('first_win');
  if (maxCombo >= 20 && !data.achievements.includes('combo_20')) data.achievements.push('combo_20');
  if (wave >= 25 && !data.achievements.includes('reach_25')) data.achievements.push('reach_25');
  if (score >= 5000 && !data.achievements.includes('score_5000')) data.achievements.push('score_5000');

  save(data);
  return { ...data, emberGain };
}

// ---- 教程/角色 ----
export function completeTutorial() { updateSave({ tutorialDone: true }); }
export function selectCharacter(id) { updateSave({ selectedCharacter: id }); }
export function isCharacterUnlocked(id) { return load().unlockedCharacters.includes(id); }

// ---- Meta 升级 ----
export function getUpgradeCost(key) {
  const data = load();
  const lvl = data.metaUpgrades[key] || 0;
  const costs = UPGRADE_COSTS[key] || [];
  return costs[lvl] ?? null;
}

export function canUpgrade(key) {
  const data = load();
  const cost = getUpgradeCost(key);
  return cost !== null && data.emberCurrency >= cost;
}

export function buyUpgrade(key) {
  const data = load();
  const lvl = data.metaUpgrades[key] || 0;
  const cost = getUpgradeCost(key);
  if (cost === null || data.emberCurrency < cost) return { ok: false, reason: 'not_enough' };
  data.emberCurrency -= cost;
  data.metaUpgrades[key] = lvl + 1;
  save(data);
  return { ok: true, level: data.metaUpgrades[key], emberCurrency: data.emberCurrency };
}

export function getMetaBonuses() {
  const d = load().metaUpgrades;
  return {
    hpBoost: d.hpBoost * 5,
    attackBoost: d.attackBoost * 1,
    speedBoost: d.speedBoost * 5,
    rerollCount: d.rerollCount,
    startEmber: d.startEmber * 20,
    potionDrop: d.potionDrop * 0.05,
  };
}

// ---- 协同图鉴 ----
export function unlockSynergy(name) {
  const data = load();
  if (!data.discoveredSynergies.includes(name)) {
    data.discoveredSynergies.push(name);
    save(data);
    return true;
  }
  return false;
}

// ---- 重置 ----
export function resetSave() { localStorage.removeItem(SAVE_KEY); }
