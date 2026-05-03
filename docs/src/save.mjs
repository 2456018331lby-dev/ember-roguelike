// ============================================================
// 余烬 Ember - 存档系统 (localStorage)
// ============================================================

const SAVE_KEY = 'ember_save_v2';

const DEFAULT_SAVE = {
  version: 2,
  bestScore: 0,
  bestWave: 0,
  totalRuns: 0,
  totalWins: 0,
  totalKills: 0,
  highCombo: 0,
  tutorialDone: false,
  unlockedCharacters: ['warrior'],
  selectedCharacter: 'warrior',
  sfxVolume: 0.5,
  bgmVolume: 0.12,
  masterVolume: 0.6,
};

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const data = JSON.parse(raw);
    if (data.version !== 2) return { ...DEFAULT_SAVE };
    return { ...DEFAULT_SAVE, ...data };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

function save(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded, ignore */ }
}

// ---- 公开 API ----

export function getSave() {
  return load();
}

export function updateSave(patch) {
  const data = load();
  Object.assign(data, patch);
  save(data);
  return data;
}

export function recordRun(score, wave, kills, maxCombo, won, character) {
  const data = load();
  data.totalRuns += 1;
  if (won) data.totalWins += 1;
  data.totalKills += kills;
  if (score > data.bestScore) data.bestScore = Math.floor(score);
  if (wave > data.bestWave) data.bestWave = wave;
  if (maxCombo > data.highCombo) data.highCombo = maxCombo;

  // 解锁角色条件
  if (won && !data.unlockedCharacters.includes('mage')) {
    data.unlockedCharacters.push('mage');
  }
  if (data.totalRuns >= 5 && !data.unlockedCharacters.includes('rogue')) {
    data.unlockedCharacters.push('rogue');
  }
  if (data.bestWave >= 15 && !data.unlockedCharacters.includes('necro')) {
    data.unlockedCharacters.push('necro');
  }

  save(data);
  return data;
}

export function completeTutorial() {
  updateSave({ tutorialDone: true });
}

export function selectCharacter(id) {
  updateSave({ selectedCharacter: id });
}

export function isCharacterUnlocked(id) {
  return load().unlockedCharacters.includes(id);
}

export function resetSave() {
  localStorage.removeItem(SAVE_KEY);
}
