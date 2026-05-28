const META_KEY = 'ember-meta-bonuses';

const defaultMetaBonuses = {
  hpBoost: 0,
  speedBoost: 0,
  attackBoost: 0,
  rerollCount: 0,
  startEmber: 0,
  potionDrop: 0,
};

function hasStorage() {
  return typeof globalThis !== 'undefined' && typeof globalThis.localStorage !== 'undefined';
}

export function getMetaBonuses() {
  if (!hasStorage()) return { ...defaultMetaBonuses };

  try {
    const raw = globalThis.localStorage.getItem(META_KEY);
    if (!raw) return { ...defaultMetaBonuses };
    const parsed = JSON.parse(raw);
    return {
      hpBoost: Number(parsed.hpBoost ?? parsed.hpBonus) || 0,
      speedBoost: Number(parsed.speedBoost ?? parsed.speedBonus) || 0,
      attackBoost: Number(parsed.attackBoost ?? parsed.attackBonus) || 0,
      rerollCount: Number(parsed.rerollCount) || 0,
      startEmber: Number(parsed.startEmber) || 0,
      potionDrop: Number(parsed.potionDrop) || 0,
    };
  } catch {
    return { ...defaultMetaBonuses };
  }
}

export function setMetaBonuses(nextBonuses) {
  const safeBonuses = {
    hpBoost: Number(nextBonuses?.hpBoost ?? nextBonuses?.hpBonus) || 0,
    speedBoost: Number(nextBonuses?.speedBoost ?? nextBonuses?.speedBonus) || 0,
    attackBoost: Number(nextBonuses?.attackBoost ?? nextBonuses?.attackBonus) || 0,
    rerollCount: Number(nextBonuses?.rerollCount) || 0,
    startEmber: Number(nextBonuses?.startEmber) || 0,
    potionDrop: Number(nextBonuses?.potionDrop) || 0,
  };

  if (hasStorage()) {
    globalThis.localStorage.setItem(META_KEY, JSON.stringify(safeBonuses));
  }

  return safeBonuses;
}

export function resetMetaBonuses() {
  if (hasStorage()) {
    globalThis.localStorage.removeItem(META_KEY);
  }
  return { ...defaultMetaBonuses };
}
