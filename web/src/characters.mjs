// ============================================================
// 余烬 Ember - 角色定义
// ============================================================

export const CHARACTERS = {
  warrior: {
    id: 'warrior',
    name: '战士',
    subtitle: '钢铁之躯',
    desc: '高血量高护甲，适合近身肉搏',
    unlockDesc: '默认角色',
    color: '#42a5f5',
    accentColor: '#1565c0',
    baseHp: 120,
    baseSpeed: 230,
    baseAttack: 18,
    baseAttackCooldown: 0.55,
    startCards: [
      { id: 'starter_blade', name: '旧剑', type: 'attack', rarity: 'common', damage: 10, desc: '基础伤害 +10' },
      { id: 'starter_guard', name: '护身符', type: 'defense', rarity: 'common', armorBonus: 3, desc: '护甲 +3' },
      { id: 'starter_boots', name: '旧靴', type: 'passive', rarity: 'common', speedBonus: 20, desc: '移速 +20' },
    ],
  },
  mage: {
    id: 'mage',
    name: '法师',
    subtitle: '元素之怒',
    desc: '高攻速高暴击，但血量低',
    unlockDesc: '通关一次后解锁',
    color: '#ce93d8',
    accentColor: '#7b1fa2',
    baseHp: 70,
    baseSpeed: 260,
    baseAttack: 12,
    baseAttackCooldown: 0.35,
    startCards: [
      { id: 'starter_wand', name: '学徒法杖', type: 'attack', rarity: 'common', damage: 6, attackSpeedBonus: 0.2, desc: '攻速 +20%，伤害 +6' },
      { id: 'starter_orb', name: '魔力球', type: 'attack', rarity: 'common', critChance: 0.1, desc: '暴击率 +10%' },
      { id: 'starter_cloak', name: '学徒斗篷', type: 'defense', rarity: 'common', dodgeChance: 0.08, desc: '闪避率 +8%' },
    ],
  },
  rogue: {
    id: 'rogue',
    name: '游侠',
    subtitle: '暗影之刃',
    desc: '极高暴击和闪避，适合走位流',
    unlockDesc: '累计5局后解锁',
    color: '#ffab40',
    accentColor: '#e65100',
    baseHp: 80,
    baseSpeed: 300,
    baseAttack: 14,
    baseAttackCooldown: 0.42,
    startCards: [
      { id: 'starter_dagger', name: '匕首', type: 'attack', rarity: 'common', damage: 8, critChance: 0.08, desc: '暴击率 +8%，伤害 +8' },
      { id: 'starter_cloak2', name: '隐身斗篷', type: 'defense', rarity: 'common', dodgeChance: 0.12, desc: '闪避率 +12%' },
      { id: 'starter_ring', name: '速度之戒', type: 'passive', rarity: 'common', speedBonus: 30, desc: '移速 +30' },
    ],
  },
  necro: {
    id: 'necro',
    name: '死灵法师',
    subtitle: '亡者之力',
    desc: '吸血+反伤+诅咒牌加成',
    unlockDesc: '到达第15波后解锁',
    color: '#90a4ae',
    accentColor: '#37474f',
    baseHp: 90,
    baseSpeed: 220,
    baseAttack: 10,
    baseAttackCooldown: 0.6,
    startCards: [
      { id: 'starter_scythe', name: '小镰刀', type: 'attack', rarity: 'common', damage: 7, lifesteal: 0.05, desc: '吸血 5%，伤害 +7' },
      { id: 'starter_bone', name: '骨盾', type: 'defense', rarity: 'common', thorns: 5, desc: '反伤 +5' },
      { id: 'starter_curse', name: '厄运种子', type: 'curse', rarity: 'common', attackBonus: 8, decayRate: 0.3, desc: '攻击 +8，每秒扣 0.3 血' },
    ],
  },
};

export function getCharacter(id) {
  return CHARACTERS[id] || CHARACTERS.warrior;
}

export function getAllCharacters() {
  return Object.values(CHARACTERS);
}
