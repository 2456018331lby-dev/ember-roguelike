import { createRun, createDebugBossFight, updateRun, applyCardChoice, applyForgeChoice, applyShopChoice, applyRestChoice, rerollRewardChoices, getPlayerStats, dash, getDifficultyPresets, getCardPool, enrichRewardChoices } from './game_core.mjs';
import { sfxAttack, sfxCrit, sfxHit, sfxDeath, sfxEnemyDeath, sfxBossDeath, sfxDash, sfxPickup, sfxHeal, sfxRevive, sfxWaveComplete, sfxCardSelect, sfxExtreme, sfxBulletShot, sfxBulletHit, startBGM, stopBGM, resumeAudio } from './audio.mjs';
import { getSave, recordRun, completeTutorial, selectCharacter as saveSelectChar, selectDifficulty as saveSelectDifficulty, getMetaBonuses, buyUpgrade, getUpgradeCost } from './save.mjs';
import { getCharacter, getAllCharacters } from './characters.mjs';
import { buildRunPresentation } from './presentation.mjs';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');

const menuEl = document.querySelector('#menu');
const rewardEl = document.querySelector('#reward');
const gameoverEl = document.querySelector('#gameover');
const charSelectEl = document.querySelector('#charSelect');
const tutorialBox = document.querySelector('#tutorialBox');
const choicesEl = document.querySelector('#choices');
const rerollBtn = document.querySelector('#rerollBtn');
const rewardMeta = document.querySelector('#rewardMeta');
const hpBar = document.querySelector('#hpBar');
const hpText = document.querySelector('#hpText');
const barrierBar = document.querySelector('#barrierBar');
const waveText = document.querySelector('#waveText');
const waveKindText = document.querySelector('#waveKindText');
const scoreText = document.querySelector('#scoreText');
const comboText = document.querySelector('#comboText');
const statsText = document.querySelector('#statsText');
const messageLog = document.querySelector('#messageLog');
const finalStats = document.querySelector('#finalStats');
const gameoverTitle = document.querySelector('#gameoverTitle');
const waveSplash = document.querySelector('#waveSplash');
const dashIndicator = document.querySelector('#dashIndicator');
const doomTimer = document.querySelector('#doomTimer');
const doomTime = document.querySelector('#doomTime');
const joystick = document.querySelector('#joystick');
const knob = document.querySelector('#knob');
const hud = document.querySelector('#hud');
const metaPreview = document.querySelector('#metaPreview');
const metaBtn = document.querySelector('#metaBtn');
const codexBtn = document.querySelector('#codexBtn');
const buildFocusText = document.querySelector('#buildFocusText');
const buildRiskText = document.querySelector('#buildRiskText');
const waveSummaryText = document.querySelector('#waveSummaryText');
const rewardWhyText = document.querySelector('#rewardWhyText');
const decisionPlanEl = document.querySelector('#decisionPlan');
const decisionPlanLabel = document.querySelector('#decisionPlanLabel');
const decisionPlanPriority = document.querySelector('#decisionPlanPriority');
const decisionPlanDetail = document.querySelector('#decisionPlanDetail');
const decisionPlanChips = document.querySelector('#decisionPlanChips');

let run = null;
let gameTime = 0;
let last = performance.now();
let input = { x: 0, y: 0 };
let prevWave = 0;
let selectedCharId = 'warrior';
let selectedDifficultyId = 'standard';
let ambient = [];
let tutorialActive = false;
let tutorialStep = 0;
let tutorialTimer = 0;
let state = 'menu';
const symbolImageCache = new Map();
const HERO_TILE_SIZE = 128;
const ENEMY_TILE_SIZE = 128;
const artAssets = {
  heroes: loadArtImage(new URL('../assets/ember-characters-spritesheet.png', import.meta.url).href),
  arena: loadArtImage(new URL('../assets/arena-ember-fortress.png', import.meta.url).href),
  enemies: loadArtImage(new URL('../assets/ember-enemies-spritesheet.png', import.meta.url).href),
};

const ENEMY_SPRITES = {
  slime: { col: 0, row: 0 },
  bat: { col: 1, row: 0 },
  skeleton: { col: 2, row: 0 },
  golem: { col: 3, row: 0 },
  archer: { col: 0, row: 1 },
  fire_mage: { col: 1, row: 1 },
  healer: { col: 2, row: 1 },
  summoner: { col: 3, row: 1 },
  charger: { col: 0, row: 2 },
  bomber: { col: 1, row: 2 },
  dragon: { col: 2, row: 2 },
  lich: { col: 3, row: 2 },
  demon: { col: 0, row: 3 },
};

const TUTORIAL_STEPS = [
  { text: '拖动左下摇杆移动角色', condition: r => r.gameTime > 2 },
  { text: '双击屏幕或空格可闪避冲刺', condition: r => r.dashCooldown > 0 || r.gameTime > 8 },
  { text: '角色会自动攻击最近敌人', condition: r => r.kills > 0 },
  { text: '击杀敌人会掉落恢复球和余烬', condition: r => r.pickups.length > 0 || r.kills > 3 },
  { text: '每波结束后选择一张卡牌强化自己', condition: r => r.state === 'reward' },
  { text: '教程完成，开始你的献祭之旅', condition: _ => true },
];

function loadArtImage(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img;
}

function isImageReady(img) {
  return img?.complete && img.naturalWidth > 0;
}

function initAmbient() {
  ambient = [];
  for (let i = 0; i < 32; i++) {
    ambient.push({ x: Math.random() * 1280, y: Math.random() * 720, size: Math.random() * 2 + 0.4, speed: Math.random() * 10 + 3, alpha: Math.random() * 0.12 + 0.03 });
  }
}

function hideOverlays() {
  menuEl.classList.add('hidden');
  rewardEl.classList.add('hidden');
  gameoverEl.classList.add('hidden');
  charSelectEl.classList.add('hidden');
}

function showMenu() {
  hideOverlays();
  hud.style.display = 'none';
  tutorialBox.classList.add('hidden');
  state = 'menu';
  stopBGM();
  const save = getSave();
  const menuStats = menuEl.querySelector('.menu-meta');
  if (menuStats) menuStats.textContent = `最高分 ${save.bestScore} · 最远第 ${save.bestWave} 波 · 总击杀 ${save.totalKills}`;
  if (metaPreview) {
    const upg = Object.values(save.metaUpgrades || {}).reduce((a, b) => a + b, 0);
    metaPreview.textContent = `余烬点 ${save.emberCurrency} · 永久升级 ${upg} 项`;
  }
  menuEl.classList.remove('hidden');
}

function getCharacterDossierStats(ch) {
  const attackRate = ch.baseAttackCooldown > 0 ? 1 / ch.baseAttackCooldown : 0;
  return [
    { label: '生命承压', text: `${ch.baseHp}`, fill: clamp(ch.baseHp / 130, 0.08, 1) },
    { label: '位移速度', text: `${ch.baseSpeed}`, fill: clamp(ch.baseSpeed / 320, 0.08, 1) },
    { label: '单击火力', text: `${ch.baseAttack}`, fill: clamp(ch.baseAttack / 22, 0.08, 1) },
    { label: '出手频率', text: `${attackRate.toFixed(1)}/秒`, fill: clamp(attackRate / 2.6, 0.08, 1) },
  ];
}

function renderCharacterDossierStat(stat) {
  const fill = Math.round(stat.fill * 100);
  return `
    <div class="char-dossier-stat" style="--stat-fill:${fill}%">
      <span>${escapeHtml(stat.label)}</span>
      <strong>${escapeHtml(stat.text)}</strong>
      <i></i>
    </div>`;
}

function renderCharacterDossier(ch, difficulty) {
  const spriteCol = ch.sprite?.col ?? 0;
  const stats = getCharacterDossierStats(ch);
  const loadout = (ch.startCards || []).slice(0, 3);
  const routeTags = [
    ch.role || '战术身份',
    ch.attackProfile?.label || '自动攻击',
    ch.weapon || '默认武器',
  ];
  return `
    <div class="char-dossier" data-character="${escapeHtml(ch.id)}" style="--char-color:${ch.color};--char-accent:${ch.accentColor || ch.color}">
      <div class="char-dossier-portrait" style="--sprite-col:${spriteCol};--char-color:${ch.color}"></div>
      <div class="char-dossier-copy">
        <div class="char-dossier-kicker">当前出征者</div>
        <div class="char-dossier-title">
          <h3>${escapeHtml(ch.name)}</h3>
          <span>${escapeHtml(ch.subtitle)}</span>
        </div>
        <p>${escapeHtml(ch.combatNote || ch.desc || '')}</p>
        <div class="char-dossier-tags">
          ${routeTags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}
        </div>
      </div>
      <div class="char-dossier-command">
        <span>本次档位</span>
        <strong>${escapeHtml(difficulty?.name || '标准')}</strong>
        <small>${escapeHtml(difficulty?.desc || '标准压力，推荐初次体验。')}</small>
      </div>
      <div class="char-dossier-loadout">
        <div class="char-dossier-label">起手铭牌</div>
        ${loadout.map(card => `
          <div class="char-dossier-card">
            <strong>${escapeHtml(card.name)}</strong>
            <span>${escapeHtml(typeName(card.type))} · ${escapeHtml(rarityName(card.rarity))}</span>
          </div>
        `).join('')}
      </div>
      <div class="char-dossier-stats">
        ${stats.map(renderCharacterDossierStat).join('')}
      </div>
    </div>`;
}

function showCharacterSelect() {
  hideOverlays();
  state = 'char';
  const save = getSave();
  selectedCharId = save.selectedCharacter || selectedCharId;
  selectedDifficultyId = save.selectedDifficulty || selectedDifficultyId;
  const chars = getAllCharacters();
  const difficulties = Object.values(getDifficultyPresets());
  const unlockedIds = new Set(save.unlockedCharacters);
  if (!unlockedIds.has(selectedCharId)) {
    selectedCharId = chars.find(ch => unlockedIds.has(ch.id))?.id || 'warrior';
  }
  const selectedCharacter = chars.find(ch => ch.id === selectedCharId) || chars[0];
  const selectedDifficulty = difficulties.find(diff => diff.id === selectedDifficultyId) || difficulties[0];
  if (selectedCharacter) selectedCharId = selectedCharacter.id;
  if (selectedDifficulty) selectedDifficultyId = selectedDifficulty.id;
  charSelectEl.innerHTML = `
    <div class="panel char-panel">
      <div class="panel-heading">
        <span class="panel-kicker">远征名册</span>
        <h2>选择角色</h2>
        <p>不同起手意味着不同的献祭路线。</p>
      </div>
      <div class="char-select-layout">
        <div id="charDossier">
          ${renderCharacterDossier(selectedCharacter, selectedDifficulty)}
        </div>
        <div class="char-grid">
        ${chars.map(ch => {
          const unlocked = unlockedIds.has(ch.id);
          const selected = ch.id === selectedCharId;
          const badges = [
            ch.role || (ch.baseHp >= 100 ? '高血量' : '脆皮高压'),
            ch.weapon || (ch.baseSpeed >= 260 ? '机动' : '站场'),
            ch.attackProfile?.label || (ch.baseAttackCooldown <= 0.45 ? '高速出手' : '重击节奏'),
          ];
          const spriteCol = ch.sprite?.col ?? 0;
          const loadout = (ch.startCards || []).slice(0, 3).map(card => card.name).join(' · ');
          return `
            <div class="char-card ${selected ? 'char-selected' : ''} ${unlocked ? '' : 'char-locked'}" data-id="${ch.id}" style="--char-color:${ch.color};--char-accent:${ch.accentColor || ch.color}">
              <div class="char-portrait" style="--sprite-col:${spriteCol};--char-color:${ch.color}">
                ${unlocked ? '' : '<span class="char-lockmark">锁</span>'}
              </div>
              <div class="char-info">
                <div class="char-topline">
                  <div class="char-name">${ch.name}</div>
                  <div class="char-unlock-badge">${unlocked ? '已解锁' : '待解锁'}</div>
                </div>
                <div class="char-sub">${ch.subtitle}</div>
                <div class="char-roleline">
                  <span class="char-role-chip">${escapeHtml(ch.role || '战术身份')}</span>
                  <span class="char-weapon-chip">${escapeHtml(ch.weapon || '默认武器')}</span>
                </div>
                <div class="char-desc">${ch.desc}</div>
                <div class="char-badges">${badges.map(tag => `<span class="char-badge">${tag}</span>`).join('')}</div>
                <div class="char-combat-note">${ch.combatNote || ''}</div>
                <div class="char-stats-grid">
                  <span class="char-stat">❤ ${ch.baseHp}</span>
                  <span class="char-stat">⚡ ${ch.baseSpeed}</span>
                  <span class="char-stat">攻 ${ch.baseAttack}</span>
                  <span class="char-stat">⏱ ${ch.baseAttackCooldown}s</span>
                </div>
                <div class="char-loadout"><strong>起手铭牌</strong><span>${loadout}</span></div>
                ${unlocked ? '' : `<div class="char-unlock">${ch.unlockDesc}</div>`}
              </div>
            </div>`;
        }).join('')}
        </div>
      </div>
      <div class="difficulty-panel">
        <div class="difficulty-head">
          <span>难度</span>
          <small>标准推荐；稳健放缓节奏；试炼保留高压。</small>
        </div>
        <div class="difficulty-options">
          ${difficulties.map(diff => `
            <button class="difficulty-option ${diff.id === selectedDifficultyId ? 'difficulty-selected' : ''}" data-id="${diff.id}">
              <span>${diff.name}</span>
              <small>${diff.desc}</small>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="char-actions">
        <button id="charStartBtn" class="btn-primary">开始战斗</button>
        <button id="charBackBtn" class="btn-secondary">返回菜单</button>
      </div>
    </div>`;
  charSelectEl.classList.remove('hidden');
  const updateDossier = () => {
    const ch = chars.find(item => item.id === selectedCharId) || chars[0];
    const diff = difficulties.find(item => item.id === selectedDifficultyId) || difficulties[0];
    const target = charSelectEl.querySelector('#charDossier');
    if (target) target.innerHTML = renderCharacterDossier(ch, diff);
  };
  charSelectEl.querySelectorAll('.char-card:not(.char-locked)').forEach(card => {
    card.addEventListener('click', () => {
      selectedCharId = card.dataset.id;
      saveSelectChar(selectedCharId);
      charSelectEl.querySelectorAll('.char-card').forEach(c => c.classList.remove('char-selected'));
      card.classList.add('char-selected');
      updateDossier();
    });
  });
  charSelectEl.querySelectorAll('.difficulty-option').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDifficultyId = btn.dataset.id || 'standard';
      saveSelectDifficulty(selectedDifficultyId);
      charSelectEl.querySelectorAll('.difficulty-option').forEach(c => c.classList.remove('difficulty-selected'));
      btn.classList.add('difficulty-selected');
      const current = difficulties.find(d => d.id === selectedDifficultyId);
      const startBtn = charSelectEl.querySelector('#charStartBtn');
      if (startBtn && current) startBtn.textContent = `开始战斗 · ${current.name}`;
      updateDossier();
    });
  });
  const currentDifficulty = difficulties.find(d => d.id === selectedDifficultyId);
  if (currentDifficulty) charSelectEl.querySelector('#charStartBtn').textContent = `开始战斗 · ${currentDifficulty.name}`;
  charSelectEl.querySelector('#charStartBtn').onclick = () => startRun();
  charSelectEl.querySelector('#charBackBtn').onclick = () => showMenu();
}

function showMetaPanel() {
  hideOverlays();
  state = 'meta';
  const save = getSave();
  const bonuses = getMetaBonuses();
  const panel = document.createElement('div');
  panel.className = 'panel meta-panel';
  const upgrades = [
    ['hpBoost', '生命强化', `+${bonuses.hpBoost} 最大生命`],
    ['attackBoost', '攻击强化', `+${bonuses.attackBoost} 攻击`],
    ['speedBoost', '速度强化', `+${bonuses.speedBoost} 移速`],
    ['rerollCount', '重随强化', `+${bonuses.rerollCount} 次重随`],
    ['startEmber', '开局赏金', `+${bonuses.startEmber} 初始分数`],
    ['potionDrop', '恢复掉率', `+${Math.round(bonuses.potionDrop * 100)}% 恢复掉率`],
  ];
  charSelectEl.innerHTML = '';
  panel.innerHTML = `
    <div class="panel-heading">
      <span class="panel-kicker">熔炉存档</span>
      <h2>余烬之炉</h2>
      <p>消耗余烬点购买永久升级。</p>
    </div>
    <div class="meta-currency">余烬点：${save.emberCurrency}</div>
    <div class="meta-grid">
      ${upgrades.map(([k,n,d]) => {
        const cost = getUpgradeCost(k);
        const level = save.metaUpgrades[k] || 0;
        return `
          <div class="meta-card">
            <div class="meta-name">${n}<span>Lv.${level}</span></div>
            <div class="meta-desc">${d}</div>
            <div class="meta-cost">${cost === null ? '已满级' : `消耗 ${cost}`}</div>
            <button class="btn-primary meta-buy" data-key="${k}" ${cost === null || save.emberCurrency < cost ? 'disabled' : ''}>升级</button>
          </div>`;
      }).join('')}
    </div>
    <div style="margin-top:20px;text-align:center"><button id="metaBackBtn" class="btn-secondary">返回菜单</button></div>`;
  charSelectEl.appendChild(panel);
  charSelectEl.classList.remove('hidden');
  charSelectEl.querySelectorAll('.meta-buy').forEach(btn => {
    btn.onclick = () => {
      const res = buyUpgrade(btn.dataset.key);
      if (res.ok) showMetaPanel();
    };
  });
  charSelectEl.querySelector('#metaBackBtn').onclick = () => showMenu();
}

function showCodexPanel() {
  hideOverlays();
  state = 'codex';
  const save = getSave();
  const panel = document.createElement('div');
  panel.className = 'panel codex-panel';
  charSelectEl.innerHTML = '';
  panel.innerHTML = `
    <div class="panel-heading">
      <span class="panel-kicker">猎场档案</span>
      <h2>图鉴</h2>
      <p>永久进度、成就与协同记录。</p>
    </div>
    <div class="codex-section"><h3>已解锁角色</h3><div>${save.unlockedCharacters.join('、') || '无'}</div></div>
    <div class="codex-section"><h3>已完成成就</h3><div>${(save.achievements || []).join('、') || '无'}</div></div>
    <div class="codex-section"><h3>已发现协同</h3><div>${(save.discoveredSynergies || []).join('、') || '尚未发现'}</div></div>
    <div style="margin-top:20px;text-align:center"><button id="codexBackBtn" class="btn-secondary">返回菜单</button></div>`;
  charSelectEl.appendChild(panel);
  charSelectEl.classList.remove('hidden');
  charSelectEl.querySelector('#codexBackBtn').onclick = () => showMenu();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderDecisionPlan(presentation, fallback = {}) {
  if (!decisionPlanEl) return;
  const chips = Array.isArray(presentation?.decisionPlanChips) && presentation.decisionPlanChips.length
    ? presentation.decisionPlanChips
    : Array.isArray(fallback.chips) ? fallback.chips : [];
  const plan = {
    label: presentation?.decisionPlanLabel || fallback.label || '',
    priority: presentation?.decisionPlanPriority || fallback.priority || '',
    detail: presentation?.decisionPlanDetail || fallback.detail || '',
    tone: presentation?.decisionPlanTone || fallback.tone || 'normal',
    chips,
  };
  const hasPlan = Boolean(plan.label || plan.priority || plan.detail || plan.chips.length);
  decisionPlanEl.classList.toggle('hidden', !hasPlan);
  if (!hasPlan) return;

  const allowed = new Set(['normal', 'danger', 'boss', 'event', 'elite']);
  const tone = allowed.has(plan.tone) ? plan.tone : 'normal';
  decisionPlanEl.className = `decision-plan decision-plan-${tone}`;
  if (decisionPlanLabel) decisionPlanLabel.textContent = plan.label || '下一波作战计划';
  if (decisionPlanPriority) decisionPlanPriority.textContent = plan.priority || '压力目标基本达标';
  if (decisionPlanDetail) decisionPlanDetail.textContent = plan.detail || '按当前路线补强或选择成长牌。';
  if (decisionPlanChips) {
    decisionPlanChips.innerHTML = plan.chips
      .slice(0, 4)
      .map(chip => `<span>${escapeHtml(chip)}</span>`)
      .join('');
  }
}

function renderStatPills(stats, synergies = [], activeRun = null) {
  const pills = [
    `${stats.attackStyleLabel || '自动攻击'}`,
    `攻击 ${Math.round(stats.attack * stats.damageMultiplier)}`,
    `攻速 ${(1 / stats.attackCooldown).toFixed(1)}`,
    `护甲 ${stats.armor}`,
  ];
  if (stats.attackMode === 'melee_lunge') pills.push(`接敌 ${Math.round(stats.attackEngageRange)}`);
  else pills.push(`射程 ${Math.round(stats.attackRange)}`);
  if ((activeRun?.player?.tempDeathWard || 0) > 0) {
    const wardLabel = activeRun.player.tempDeathWardSource === 'smoke' ? '残影' : '护符';
    pills.push(`${wardLabel} ${activeRun.player.tempDeathWard}`);
  }
  if (stats.critChance > 0) pills.push(`暴击 ${Math.round(stats.critChance * 100)}%`);
  if (stats.dodgeChance > 0) pills.push(`闪避 ${Math.round(stats.dodgeChance * 100)}%`);
  if (synergies?.length) pills.push(`协同 ${synergies.length} 项`);
  return pills.map(pill => `<span class="stat-pill">${escapeHtml(pill)}</span>`).join('');
}

function renderBuildSummary(run, presentation) {
  const character = getCharacter(run.characterId || 'warrior');
  const descriptors = run.buildAnalysis?.descriptors || [];
  const weaknesses = run.buildAnalysis?.weaknesses || {};
  const focusMarkup = descriptors.length
    ? descriptors.map(label => `<span class="focus-chip chip-good">${escapeHtml(label)}</span>`).join('')
    : '<span class="focus-chip chip-neutral">构筑尚未成型</span>';
  const weaknessLabels = [];
  if (weaknesses.singleTarget) weaknessLabels.push('首领输出');
  if (weaknesses.aoe) weaknessLabels.push('清场');
  if (weaknesses.sustain) weaknessLabels.push('续航');
  if (weaknesses.safety) weaknessLabels.push('安全网');
  const weaknessMarkup = weaknessLabels.length
    ? weaknessLabels.map(label => `<span class="focus-chip chip-danger">${escapeHtml(label)}</span>`).join('')
    : '<span class="focus-chip chip-neutral">暂无明显短板</span>';
  return `
    <div class="build-cluster build-cluster-hero">
      <div class="cluster-label">战术身份</div>
      <div class="chip-row">
        <span class="focus-chip chip-accent">${escapeHtml(character.role || character.name)}</span>
        <span class="focus-chip chip-neutral">${escapeHtml(character.attackProfile?.label || '自动攻击')}</span>
      </div>
      <div class="build-panel-copy">${escapeHtml(character.combatNote || character.desc || '')}</div>
    </div>
    <div class="build-cluster">
      <div class="cluster-label">构筑倾向</div>
      <div class="chip-row">${focusMarkup}</div>
    </div>
    <div class="build-cluster">
      <div class="cluster-label">当前短板</div>
      <div class="chip-row">${weaknessMarkup}</div>
    </div>
    <div class="build-panel-copy">${escapeHtml(presentation.waveSummary || '继续围绕明确主轴拿牌。')}</div>
  `;
}

function buildCardTags(card) {
  const tags = [];
  if (card.damage || card.attackBonus) tags.push(['输出', 'good']);
  if (card.chain || card.rangeBonus || card.slow) tags.push(['清场', 'neutral']);
  if (card.regen || card.lifesteal || card.barrier || card.armorBonus || card.dodgeChance || card.reflect || card.revive) tags.push(['生存', 'good']);
  if (card.type === 'joker') tags.push(['改规则', 'accent']);
  if (card.type === 'curse') tags.push(['高风险', 'danger']);
  if (card.sacrifice) tags.push([`献祭 ${costText(card.sacrifice)}`, 'danger']);
  return tags.slice(0, 4).map(([label, tone]) => `<span class="card-tag tone-${tone}">${escapeHtml(label)}</span>`).join('');
}

function cardFitScoreValue(card) {
  const score = Number(card?.fitScore);
  return Number.isFinite(score) ? score : null;
}

function cardRiskLevel(card) {
  let level = 0;
  if (card.type === 'curse') level += 2;
  if ((card.sacrifice?.amount || 0) >= 0.12) level += 1;
  if (card.doomTimer || card.decayRate || card.selfDamageChance || (card.armorBonus || 0) < 0) level += 2;
  if ((card.damageMultiplier || 1) >= 2 && card.sacrifice?.stat === 'health') level += 1;
  return Math.min(3, level);
}

function isStabilizingCard(card) {
  return Boolean(card.regen || card.lifesteal || card.barrier || card.armorBonus || card.dodgeChance || card.reflect || card.thorns || card.revive);
}

function buildCardDecision(card, index, bestScore) {
  const score = cardFitScoreValue(card);
  const risk = cardRiskLevel(card);
  const isBest = score !== null && bestScore !== null && index === 0 && score >= bestScore - 0.001;
  if (isBest && risk >= 2) return { label: '高分豪赌', tone: 'danger', risk };
  if (isBest) return { label: '本轮首选', tone: 'recommended', risk };
  if (risk >= 2) return { label: '豪赌', tone: 'danger', risk };
  if (isStabilizingCard(card)) return { label: '稳血线', tone: 'safe', risk };
  if (score !== null && bestScore !== null && bestScore - score <= 1.2) return { label: '可替代', tone: 'neutral', risk };
  return { label: '备选', tone: 'muted', risk };
}

function buildCardRiskText(card, risk) {
  if (!card.sacrifice && risk === 0) return '无献祭代价';
  const parts = [];
  if (card.sacrifice) parts.push(costText(card.sacrifice));
  if (card.doomTimer) parts.push(`${Math.round(card.doomTimer)} 秒末日`);
  if (card.decayRate) parts.push(`每秒流失 ${card.decayRate}`);
  if (card.selfDamageChance) parts.push(`${Math.round(card.selfDamageChance * 100)}% 自伤`);
  if ((card.armorBonus || 0) < 0) parts.push(`护甲 ${card.armorBonus}`);
  return parts.join(' · ') || '低风险';
}

function startRun(seed = Date.now()) {
  resumeAudio();
  const ch = getCharacter(selectedCharId);
  run = createRun(seed, ch, selectedDifficultyId);
  prevWave = 0;
  gameTime = 0;
  initAmbient();
  tutorialStep = 0;
  tutorialTimer = 0;
  tutorialActive = !getSave().tutorialDone;
  hideOverlays();
  hud.style.display = 'block';
  state = 'playing';
  startBGM();
}

// buttons
menuEl.querySelector('#startBtn').onclick = () => showCharacterSelect();
menuEl.querySelector('#installBtn').onclick = null;
metaBtn?.addEventListener('click', () => showMetaPanel());
codexBtn?.addEventListener('click', () => showCodexPanel());
document.querySelector('#restartBtn').onclick = () => startRun();
document.querySelector('#backMenuBtn').onclick = () => showMenu();

// pwa
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  const btn = document.querySelector('#installBtn');
  btn.hidden = false;
  btn.onclick = async () => { await e.prompt(); btn.hidden = true; };
});

// input
const keys = new Set();
window.addEventListener('keydown', e => {
  keys.add(e.key.toLowerCase());
  if ((e.key === ' ' || e.key === 'Shift') && run && run.state === 'playing') {
    e.preventDefault();
    dash(run, input.x || 0, input.y || 0.01);
  }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
function updateKeyboardInput() {
  let x = 0, y = 0;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('w') || keys.has('arrowup')) y -= 1;
  if (keys.has('s') || keys.has('arrowdown')) y += 1;
  if (x || y) input = { x, y };
}

let joyActive = false, joyId = null;
function setJoy(clientX, clientY) {
  const rect = joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = clientX - cx, dy = clientY - cy;
  const max = rect.width * 0.34;
  const len = Math.hypot(dx, dy);
  if (len > max) { dx = dx / len * max; dy = dy / len * max; }
  knob.style.left = `${35 + dx}px`;
  knob.style.top = `${35 + dy}px`;
  input = { x: dx / max, y: dy / max };
}
function resetJoy() { knob.style.left = '35px'; knob.style.top = '35px'; input = { x: 0, y: 0 }; joyActive = false; }
joystick.addEventListener('pointerdown', e => { joyActive = true; joyId = e.pointerId; joystick.setPointerCapture(e.pointerId); setJoy(e.clientX, e.clientY); });
joystick.addEventListener('pointermove', e => { if (joyActive && e.pointerId === joyId) setJoy(e.clientX, e.clientY); });
joystick.addEventListener('pointerup', resetJoy);
joystick.addEventListener('pointercancel', resetJoy);
let lastTap = 0;
canvas.addEventListener('pointerdown', e => {
  const now = Date.now();
  if (now - lastTap < 300 && run && run.state === 'playing') dash(run, e.clientX - 640, e.clientY - 360 || 0.01);
  lastTap = now;
});

function processAudioEvents() {
  if (!run || !run.events) return;
  for (const ev of run.events) {
    switch (ev) {
      case 'attack': sfxAttack(); break;
      case 'crit': sfxCrit(); break;
      case 'hit': sfxHit(); break;
      case 'enemy_death': sfxEnemyDeath(); break;
      case 'boss_death': sfxBossDeath(); break;
      case 'dash': sfxDash(); break;
      case 'pickup': sfxPickup(); break;
      case 'heal': sfxHeal(); break;
      case 'revive': sfxRevive(); break;
      case 'extreme': sfxExtreme(); break;
      case 'bullet_shot': sfxBulletShot(); break;
      case 'bullet_hit': sfxBulletHit(); break;
    }
  }
  run.events = [];
}

function onStateChange(prevState) {
  if (!run) return;
  syncOverlayForRunState({ playStateSfx: true });
}

function syncOverlayForRunState({ playStateSfx = false, resumeIfPlaying = false } = {}) {
  if (!run) return;

  if (run.state === 'reward') {
    if (playStateSfx) sfxWaveComplete();
    showReward();
    stopBGM();
    return;
  }
  if (run.state === 'forge') {
    if (playStateSfx) sfxWaveComplete();
    showForge();
    stopBGM();
    return;
  }
  if (run.state === 'shop') {
    if (playStateSfx) sfxWaveComplete();
    showShop();
    stopBGM();
    return;
  }
  if (run.state === 'rest') {
    if (playStateSfx) sfxWaveComplete();
    showRest();
    stopBGM();
    return;
  }
  if (run.state === 'gameover') {
    if (playStateSfx) sfxDeath();
    showResult(false);
    stopBGM();
    return;
  }
  if (run.state === 'victory') {
    if (playStateSfx) sfxBossDeath();
    showResult(true);
    stopBGM();
    return;
  }

  if (resumeIfPlaying && (run.state === 'playing' || run.state === 'wave_transition')) {
    rewardEl.classList.add('hidden');
    if (rerollBtn) rerollBtn.style.display = '';
    updateHud();
    startBGM();
  }
}

function showReward() {
  choicesEl.innerHTML = '';
  const stats = getPlayerStats(run);
  const presentation = buildRunPresentation(run, stats, getCharacter(run.characterId));
  const readouts = presentation.rewardCardReadouts || [];
  if (rewardMeta) rewardMeta.textContent = presentation.rewardLine;
  if (waveSummaryText) waveSummaryText.textContent = presentation.waveSummary || '';
  if (rewardWhyText) rewardWhyText.textContent = presentation.rewardWhy || '';
  renderDecisionPlan(presentation);
  if (rerollBtn) {
    rerollBtn.style.display = '';
    rerollBtn.disabled = (run.rewardRerolls ?? 0) <= 0;
    rerollBtn.textContent = (run.rewardRerolls ?? 0) > 0 ? '重铸铭牌' : '重铸耗尽';
    rerollBtn.onclick = () => {
      const ok = rerollRewardChoices(run);
      if (!ok) return;
      sfxCardSelect();
      showReward();
      updateHud();
    };
  }
  const bestScore = (run.rewardChoices || [])
    .map(cardFitScoreValue)
    .filter(score => score !== null)
    .reduce((best, score) => best === null ? score : Math.max(best, score), null);
  (run.rewardChoices || []).forEach((card, index) => {
    const el = document.createElement('button');
    const fallbackDecision = buildCardDecision(card, index, bestScore);
    const readout = readouts[index]?.id === card.id
      ? readouts[index]
      : readouts.find(item => item.id === card.id);
    const decision = readout
      ? { label: readout.decisionLabel, tone: readout.decisionTone, risk: readout.riskLevel, isTop: readout.isTop }
      : fallbackDecision;
    const opportunityTone = readout?.opportunityTone || 'neutral';
    const score = cardFitScoreValue(card);
    const scoreText = score === null ? '--' : score.toFixed(1);
    const isTopChoice = Boolean(readout?.isTop ?? (index === 0 && score !== null));
    const fitRatio = score === null ? 0.08 : Math.max(0.08, Math.min(1, score / 20));
    const opportunityTitle = readout?.opportunityTitle || '路线补强';
    const riskTicks = [0, 1, 2]
      .map(tick => `<span class="${tick < decision.risk ? 'is-on' : ''}"></span>`)
      .join('');
    el.className = `card reward-choice-card ${card.rarity || 'common'} ${isTopChoice ? 'card-recommended' : ''} risk-${decision.risk} opportunity-${opportunityTone}`;
    el.style.setProperty('--card-index', String(index));
    el.style.setProperty('--fit-ratio', fitRatio.toFixed(3));
    el.dataset.fitScore = scoreText;
    el.dataset.decision = decision.label;
    el.dataset.riskLevel = String(decision.risk);
    el.dataset.opportunity = opportunityTitle;
    el.innerHTML = `
      <span class="card-aura" aria-hidden="true"></span>
      <span class="card-glint" aria-hidden="true"></span>
      <div class="card-shell">
        <div class="card-decision-row">
          <span class="card-decision tone-${decision.tone}">${escapeHtml(decision.label)}</span>
          <span class="card-rarity">${escapeHtml(readout?.rarityLabel || rarityName(card.rarity))}</span>
        </div>
        <div class="card-topline">
          <div class="type">${typeIcon(card.type)} ${escapeHtml(typeName(card.type))}</div>
          <div class="card-score ${isTopChoice ? 'is-top' : ''}">契合 ${scoreText}</div>
        </div>
        <div class="card-signal-row">
          <div class="card-fit-meter"><span></span></div>
          <div class="card-risk-meter" data-risk="${decision.risk}">${riskTicks}</div>
        </div>
        <h3>${escapeHtml(card.name)}</h3>
        <div class="desc">${escapeHtml(card.desc || '')}</div>
        <div class="card-tags">${buildCardTags(card)}</div>
        <div class="card-catalyst tone-${opportunityTone}">
          <span>机会</span>
          <strong>${escapeHtml(opportunityTitle)}</strong>
        </div>
        <div class="card-readout fit-line tone-${opportunityTone}">
          <div class="card-readout-title">${escapeHtml(opportunityTitle)}</div>
          <div class="card-readout-detail">${escapeHtml(readout?.opportunityDetail || card.fitHint || '提供通用数值。')}</div>
          <div class="card-readout-hint">建议：${escapeHtml(card.fitHint || '提供通用数值')}</div>
        </div>
      </div>
      <div class="card-foot">
        <div class="cost ${card.sacrifice ? '' : 'no-cost'}">${escapeHtml(readout?.riskLabel || (card.sacrifice ? '代价' : '无献祭'))}：${escapeHtml(readout?.riskText || buildCardRiskText(card, decision.risk))}</div>
        ${run.synergies?.length ? `<div class="combo-hint">当前协同：${escapeHtml(run.synergies.join(' · '))}</div>` : ''}
      </div>`;
    el.onclick = () => {
      sfxCardSelect();
      applyCardChoice(run, card);
      syncOverlayForRunState({ resumeIfPlaying: true });
    };
    choicesEl.appendChild(el);
  });
  rewardEl.classList.remove('hidden');
}

function showForge() {
  choicesEl.innerHTML = '';
  const presentation = buildRunPresentation(run, getPlayerStats(run), getCharacter(run.characterId));
  if (rewardMeta) rewardMeta.textContent = '余烬锻造 — 选择一项强化';
  if (waveSummaryText) waveSummaryText.textContent = '升级已有铭牌、净化献祭代价、或重铸弱牌';
  if (rewardWhyText) rewardWhyText.textContent = '';
  renderDecisionPlan(null);
  if (rerollBtn) rerollBtn.style.display = 'none';
  for (const choice of run.forgeChoices) {
    const el = document.createElement('button');
    el.className = `card ${choice.rarity || 'epic'} forge-card`;
    const actionLabel = { upgrade: '升级', purify: '净化', reforge: '重铸' }[choice.forgeAction] || '锻造';
    el.innerHTML = `
      <div class="card-shell">
        <div class="card-topline">
          <div class="type">${actionLabel}</div>
          <div class="card-score">锻造</div>
        </div>
        <h3>${choice.name}</h3>
        <div class="desc">${choice.forgeDesc || choice.desc || ''}</div>
      </div>`;
    el.onclick = () => {
      sfxCardSelect();
      applyForgeChoice(run, choice);
      syncOverlayForRunState({ resumeIfPlaying: true });
    };
    choicesEl.appendChild(el);
  }
  rewardEl.classList.remove('hidden');
}

function showShop() {
  choicesEl.innerHTML = '';
  const embers = Math.floor(run.score);
  if (rewardMeta) rewardMeta.textContent = `余烬商人 — 余烬 ${embers}`;
  if (waveSummaryText) waveSummaryText.textContent = '花费余烬购买增益，或直接离开';
  if (rewardWhyText) rewardWhyText.textContent = '';
  renderDecisionPlan(null);
  if (rerollBtn) rerollBtn.style.display = 'none';
  for (const choice of run.shopChoices) {
    const el = document.createElement('button');
    const canAfford = embers >= choice.cost;
    el.className = `card ${canAfford ? 'rare' : 'common'} shop-card ${!canAfford ? 'shop-disabled' : ''}`;
    el.innerHTML = `
      <div class="card-shell">
        <div class="card-topline">
          <div class="type">${choice.cost > 0 ? `${choice.cost} 余烬` : '免费'}</div>
          <div class="card-score">${canAfford ? '可购买' : '不足'}</div>
        </div>
        <h3>${choice.name}</h3>
        <div class="desc">${choice.desc || ''}</div>
      </div>`;
    el.onclick = () => {
      if (!canAfford) return;
      sfxCardSelect();
      applyShopChoice(run, choice);
      syncOverlayForRunState({ resumeIfPlaying: true });
    };
    choicesEl.appendChild(el);
  }
  rewardEl.classList.remove('hidden');
}

function showRest() {
  choicesEl.innerHTML = '';
  const presentation = buildRunPresentation(run, getPlayerStats(run), getCharacter(run.characterId));
  const preview = run.nextWavePreview;
  if (rewardMeta) rewardMeta.textContent = preview?.kind === 'boss' ? `${preview.label} 前夜` : '战前营火';
  if (waveSummaryText) waveSummaryText.textContent = '先稳住血线与献祭，或用一次豪赌强行补短板';
  if (rewardWhyText) rewardWhyText.textContent = preview?.risk || '下一波会更危险，先做战前抉择。';
  renderDecisionPlan(presentation);
  if (rerollBtn) rerollBtn.style.display = 'none';
  const bestScore = Math.max(...(run.restChoices || []).map(choice => Number(choice.fitScore) || -Infinity));

  for (const choice of run.restChoices || []) {
    const isRisk = choice.restAction === 'gamble';
    const isWard = choice.restAction === 'ward';
    const isSmoke = choice.restAction === 'smoke';
    const score = Number(choice.fitScore);
    const isBest = Number.isFinite(score) && score >= bestScore - 0.001;
    const el = document.createElement('button');
    el.className = `card ${isRisk ? 'risk-card' : isWard ? 'ward-card' : isSmoke ? 'smoke-card' : 'rest-card'} ${isBest ? 'card-recommended' : ''}`;
    const rewardPreview = choice.rewardCard
      ? `<div class="fit-line">豪赌目标：${choice.rewardCard.name}${choice.rewardCard.fitHint ? ` · ${choice.rewardCard.fitHint}` : ''}</div>`
      : '';
    const typeLabel = {
      heal: '休整',
      meditate: '调息',
      train: '训练',
      ward: '护符',
      smoke: '机动',
      gamble: '豪赌',
    }[choice.restAction] || '休整';
    el.innerHTML = `
      <div class="card-shell">
        <div class="card-topline">
          <div class="type">${typeLabel}</div>
          <div class="card-score">${escapeHtml(choice.decisionLabel || (isRisk ? '高风险' : isWard ? '保命' : '稳节奏'))}</div>
        </div>
        <h3>${choice.name}</h3>
        <div class="desc">${choice.desc || ''}</div>
        <div class="fit-line">建议：${escapeHtml(choice.fitHint || '提供通用战前准备。')}</div>
        ${rewardPreview}
      </div>`;
    el.onclick = () => {
      sfxCardSelect();
      applyRestChoice(run, choice);
      syncOverlayForRunState({ resumeIfPlaying: true });
    };
    choicesEl.appendChild(el);
  }

  rewardEl.classList.remove('hidden');
}

function renderResultTimeline(items = []) {
  if (!items.length) return '';
  const toneClass = tone => {
    const allowed = new Set(['reward', 'forge', 'shop', 'rest', 'combat', 'survival', 'boss', 'danger', 'victory', 'decision']);
    return allowed.has(tone) ? ` timeline-${tone}` : ' timeline-decision';
  };
  const impactClass = tone => {
    const allowed = new Set(['repair', 'risk', 'growth', 'missed', 'neutral']);
    return allowed.has(tone) ? ` impact-${tone}` : ' impact-neutral';
  };
  return `
    <div class="result-section result-timeline">
      <div class="result-section-title">复盘时间线</div>
      <div class="timeline-list">
        ${items.map(item => `
          <div class="timeline-item${toneClass(item.tone)}">
            <div class="timeline-marker">${escapeHtml(item.marker || '路线')}</div>
            <div class="timeline-copy">
              <div class="timeline-title">${escapeHtml(item.title || '关键节点')}</div>
              <div class="timeline-detail">${escapeHtml(item.detail || '这一步改变了后续路线。')}</div>
              ${item.impactLabel ? `
                <div class="timeline-impact${impactClass(item.impactTone)}">
                  <span>路线影响 · ${escapeHtml(item.impactLabel)}</span>
                  <em>${escapeHtml(item.impactDetail || '这一步改变了后续路线。')}</em>
                </div>` : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderDamageSourceReport(sources = [], total = 0, hint = '') {
  if (!sources.length) return '';
  const sourceClass = source => {
    const allowed = new Set(['danger', 'combat', 'boss', 'risk', 'neutral']);
    return allowed.has(source.tone) ? ` damage-${source.tone}` : ' damage-neutral';
  };
  return `
    <div class="damage-report">
      <div class="damage-report-head">
        <span>受击来源</span>
        <strong>累计 ${Math.round(total || sources.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))}</strong>
      </div>
      <div class="damage-source-list">
        ${sources.map(source => `
          <div class="damage-source${sourceClass(source)}">
            <div class="damage-source-meta">
              <span>${escapeHtml(source.label || '未知伤害')}</span>
              <strong>${escapeHtml(source.percentText || `${Math.round((source.percent || 0) * 100)}%`)}</strong>
            </div>
            <div class="damage-source-bar" style="--damage-ratio:${Math.max(0.04, Math.min(1, Number(source.percent) || 0))}"></div>
            <div class="damage-source-detail">${escapeHtml(source.detail || `${source.hits || 1} 次命中 · ${source.amount || 0} 伤害`)}</div>
          </div>`).join('')}
      </div>
      ${hint ? `<div class="positioning-hint">${escapeHtml(hint)}</div>` : ''}
    </div>`;
}

function renderRouteComparison(comparison) {
  if (!comparison || !Array.isArray(comparison.rows) || !comparison.rows.length) return '';
  const toneClass = row => {
    const allowed = new Set(['danger', 'warning', 'stable']);
    return allowed.has(row.tone) ? ` route-${row.tone}` : ' route-stable';
  };
  const focusItems = Array.isArray(comparison.focusItems) && comparison.focusItems.length
    ? comparison.focusItems
    : [comparison.focusText || '均衡'];
  return `
    <div class="route-comparison">
      <div class="route-comparison-head">
        <div>
          <span>路线对比</span>
          <strong>${escapeHtml(comparison.focusLabel || '实际路线')} · ${escapeHtml(comparison.focusText || '均衡')}</strong>
        </div>
        <em>${escapeHtml(comparison.gapLabel || '最终缺口')} · ${escapeHtml(comparison.gapText || '主要压力达标')}</em>
      </div>
      <div class="route-chip-row">
        ${focusItems.map(item => `<span class="route-chip">${escapeHtml(item)}</span>`).join('')}
        ${comparison.topCovered ? `<span class="route-chip route-chip-stable">${escapeHtml(comparison.topCovered.label)}达标</span>` : ''}
        ${comparison.topGap ? `<span class="route-chip route-chip-danger">${escapeHtml(comparison.topGap.label)}缺口</span>` : ''}
      </div>
      <div class="route-pressure-list">
        ${comparison.rows.map(row => `
          <div class="route-pressure${toneClass(row)}">
            <div class="route-pressure-meta">
              <span>${escapeHtml(row.label || '压力')}</span>
              <strong>${escapeHtml(row.valueText || '')}</strong>
            </div>
            <div class="route-pressure-bar" style="--route-ratio:${Math.max(0.04, Math.min(1, Number(row.ratio) || 0))}"></div>
            <div class="route-pressure-foot">
              <span>${escapeHtml(row.status || '')}</span>
              <em>${row.gap > 0 ? `缺 ${Math.round(row.gap)}` : (row.margin > 0 ? `余量 ${Math.round(row.margin)}` : '刚好达标')}</em>
            </div>
          </div>`).join('')}
      </div>
      <div class="route-verdict">${escapeHtml(comparison.verdict || '下一把优先复盘路线和最终短板的关系。')}</div>
    </div>`;
}

function showResult(victory) {
  const save = recordRun(run.score, run.wave, run.kills, run.maxCombo, victory, run.characterId);
  const presentation = buildRunPresentation(run, getPlayerStats(run), getCharacter(run.characterId));
  const character = getCharacter(run.characterId);
  const resultTone = victory ? 'victory' : 'defeat';
  const resultTitle = victory ? '余烬永不熄灭' : '余烬熄灭';
  const panelTitle = victory ? '远征完成' : '战报复盘';
  const resultSubtitle = victory
    ? '整条远征路线已经打通，下一步可以挑战试炼档或追求更高分。'
    : (presentation.deathReason || presentation.resultNextHint || '复盘短板、调整下一轮牌序和战前准备。');
  const deathTip = presentation.deathBuildTip ? `<div class="final-stat hint"><span>复盘建议</span><span>${escapeHtml(presentation.deathBuildTip)}</span></div>` : '';
  const waveContext = presentation.deathWaveLabel ? `<div class="final-stat"><span>阵亡波次</span><span>${escapeHtml(presentation.deathWaveLabel)}</span></div>` : '';
  const gameTime = presentation.deathGameTime ? `<div class="final-stat"><span>存活时间</span><span>${Math.floor(presentation.deathGameTime / 60)}分${presentation.deathGameTime % 60}秒</span></div>` : '';
  const pressureReview = presentation.deathPressureLine ? `<div class="final-stat wide pressure-review"><span>数值缺口</span><span>${escapeHtml(presentation.deathPressureLine)}</span></div>` : '';
  const decisionReview = presentation.deathDecisionLine ? `<div class="final-stat wide decision-review"><span>最后决策</span><span>${escapeHtml(presentation.deathDecisionLine)}</span></div>` : '';
  const collapseTone = ['danger', 'combat', 'survival', 'boss', 'victory', 'neutral'].includes(presentation.resultCollapseTone)
    ? presentation.resultCollapseTone
    : 'neutral';
  const collapsePrefix = victory ? '通关关键' : '崩盘诱因';
  const collapseReview = presentation.resultCollapseDetail ? `
    <div class="final-stat wide collapse-review collapse-${collapseTone}">
      <span>${collapsePrefix} · ${escapeHtml(presentation.resultCollapseLabel || '战斗转折')}</span>
      <span>${escapeHtml(presentation.resultCollapseDetail)}</span>
    </div>` : '';
  const focusText = presentation.buildSummary || '构筑尚未成型';
  const weaknessText = presentation.weaknessSummary || '暂无明显短板';
  const nextPriorityLabel = presentation.resultPriorityLabel || (victory ? '冲分路线' : '路线校准');
  const nextRunHint = presentation.resultNextHint || weaknessText || '下一轮优先补最明显的输出、清场或安全网缺口。';
  const synergies = run.synergies || [];
  const extremes = run.extremes || [];
  const timeline = renderResultTimeline(presentation.resultTimeline);
  const routeComparison = renderRouteComparison(presentation.resultRouteComparison);
  const damageReport = renderDamageSourceReport(
    presentation.resultDamageSources,
    presentation.resultDamageTotal,
    presentation.resultPositioningHint,
  );
  gameoverTitle.textContent = panelTitle;
  finalStats.innerHTML = `
    <div class="result-brief ${resultTone}">
      <div class="result-kicker">${victory ? '远征完成' : '战报复盘'}</div>
      <div class="result-outcome">${escapeHtml(resultTitle)}</div>
      <p>${escapeHtml(resultSubtitle)}</p>
    </div>
    <div class="result-hero-row">
      <div class="result-hero-card primary"><span>到达波次</span><strong>${run.wave} / ${run.totalWaves}</strong></div>
      <div class="result-hero-card"><span>本局分数</span><strong>${Math.floor(run.score)}</strong></div>
      <div class="result-hero-card"><span>击杀</span><strong>${run.kills}</strong></div>
      <div class="result-hero-card reward"><span>余烬奖励</span><strong>+${save.emberGain}</strong></div>
    </div>
    <div class="result-section">
      <div class="result-section-title">路线概览</div>
      <div class="result-stat-grid">
        <div class="final-stat"><span>角色</span><span>${escapeHtml(character.name)}</span></div>
        <div class="final-stat"><span>难度</span><span>${escapeHtml(run.difficulty?.name || '标准')}</span></div>
        ${waveContext}
        ${gameTime}
        <div class="final-stat"><span>最高连击</span><span>${run.maxCombo}</span></div>
        <div class="final-stat"><span>卡牌数</span><span>${run.player.deck.length}</span></div>
      </div>
    </div>
    <div class="result-section build-report">
      <div class="result-section-title">构筑诊断</div>
      <div class="final-stat wide"><span>构筑倾向</span><span>${escapeHtml(focusText)}</span></div>
      <div class="final-stat wide"><span>当前短板</span><span>${escapeHtml(weaknessText)}</span></div>
        <div class="final-stat"><span>协同</span><span>${escapeHtml(synergies.join('、') || '无')}</span></div>
        <div class="final-stat"><span>极端化</span><span>${escapeHtml(extremes.join('、') || '无')}</span></div>
    </div>
    <div class="result-section after-action">
      <div class="result-section-title">阵亡复盘</div>
      <div class="final-stat reason wide"><span>失败原因</span><span>${escapeHtml(presentation.deathReason || (victory ? '已完成远征' : '余烬熄灭'))}</span></div>
      ${collapseReview}
      ${routeComparison}
      ${damageReport}
      ${pressureReview}
      ${decisionReview}
      ${deathTip}
    </div>
    ${timeline}
    <div class="result-next">
      <span>下一把优先级 · ${escapeHtml(nextPriorityLabel)}</span>
      <strong>${escapeHtml(nextRunHint)}</strong>
    </div>`;
  gameoverEl.classList.remove('hidden');
}

function updateHud() {
  if (!run) return;
  const stats = getPlayerStats(run);
  const presentation = buildRunPresentation(run, stats, getCharacter(run.characterId));
  const hpPct = Math.max(0, Math.min(1, run.player.hp / stats.maxHp));
  hpBar.style.width = `${hpPct * 100}%`;
  hpText.textContent = presentation.hpLine;
  barrierBar.classList.toggle('hidden', run.player.barrier <= 0);
  barrierBar.style.width = `${Math.min(100, run.player.barrier / stats.maxHp * 100)}%`;
  waveText.textContent = presentation.topLine;
  if (waveKindText) waveKindText.textContent = presentation.waveKindLine;
  scoreText.textContent = presentation.scoreLine;
  comboText.textContent = presentation.comboLine;
  comboText.classList.toggle('hidden', run.combo < 3);
  let statLine = presentation.statsLine;
  statsText.innerHTML = renderStatPills(stats, run.synergies, run);
  messageLog.innerHTML = presentation.messages.map(m => {
    const tone = m.startsWith('⚠') ? 'warn' : m.startsWith('☠') ? 'danger' : m.startsWith('✨') || m.startsWith('🔥') ? 'good' : 'normal';
    return `<div class="msg-${tone}">${m}</div>`;
  }).join('');
  if (buildFocusText) buildFocusText.innerHTML = renderBuildSummary(run, presentation);
  if (buildRiskText) buildRiskText.innerHTML = `
    <span class="cluster-label">危险提示</span>
    <span class="risk-title">${escapeHtml(run.waveProfile?.label || presentation.topLine || '战场读板')}</span>
    <span class="risk-copy">${escapeHtml(presentation.waveRiskLine || '保持走位，别让怪物叠到脸上。')}</span>
  `;
  if (waveSummaryText) waveSummaryText.textContent = presentation.waveSummary || '';
  if (stats.doomTimer > 0) {
    doomTimer.classList.remove('hidden');
    doomTime.textContent = presentation.doomSeconds;
  } else doomTimer.classList.add('hidden');
  const dashPct = Math.max(0, 1 - run.dashCooldown / 1.8);
  dashIndicator.style.opacity = dashPct >= 1 ? '1' : '0.45';
}

function updateTutorial(dt) {
  if (!tutorialActive || !run) return;
  tutorialTimer += dt;
  if (tutorialStep < TUTORIAL_STEPS.length && TUTORIAL_STEPS[tutorialStep].condition(run)) {
    tutorialStep++;
    tutorialTimer = 0;
    if (tutorialStep >= TUTORIAL_STEPS.length) {
      tutorialActive = false;
      completeTutorial();
      tutorialBox.classList.add('hidden');
      return;
    }
  }
  tutorialBox.textContent = TUTORIAL_STEPS[tutorialStep]?.text || '';
  tutorialBox.classList.toggle('hidden', !tutorialActive);
}

function loop(now) {
  const dt = Math.min(0.04, (now - last) / 1000);
  last = now;
  gameTime += dt;
  resizeCanvas();
  updateKeyboardInput();
  if (run && state === 'playing') {
    const prev = run.state;
    updateRun(run, input, dt);
    processAudioEvents();
    if (run.state === 'wave_transition' && run.wave !== prevWave) {
      showWaveSplash(run.wave);
      prevWave = run.wave;
    }
    if (prev !== run.state) onStateChange(prev);
    updateHud();
    updateTutorial(dt);
  }
  for (const p of ambient) {
    p.y -= p.speed * dt;
    if (p.y < -10) { p.y = 730; p.x = Math.random() * 1280; }
  }
  draw();
  requestAnimationFrame(loop);
}

function showWaveSplash(wave) {
  const label = run?.waveProfile?.label;
  const kind = run?.waveProfile?.kind;
  waveSplash.textContent = label || (wave % 5 === 0 ? `BOSS 第 ${wave} 波` : `第 ${wave} 波`);
  waveSplash.dataset.kind = kind || 'normal';
  waveSplash.classList.remove('hidden');
  waveSplash.classList.add('show');
  setTimeout(() => {
    waveSplash.classList.remove('show');
    waveSplash.classList.add('hidden');
  }, kind === 'boss' ? 1450 : 950);
}

function draw() {
  const s = getScale();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(s.scale, s.scale);
  let ox = 0, oy = 0;
  if (run?.screenShake > 0) {
    ox = (Math.random() - 0.5) * run.screenShake * 14;
    oy = (Math.random() - 0.5) * run.screenShake * 14;
  }
  ctx.translate(s.offsetX + ox, s.offsetY + oy);
  drawArena();
  if (run) {
    drawBossArenaPressure();
    drawTelegraphs();
    drawPickups();
    drawProjectiles();
    drawEnemies();
    drawThreatIndicators();
    drawPlayer();
    drawParticles();
    drawMinimap();
    drawBossHpBar();
    drawWaveProgress();
    if (run.screenFlash > 0) {
      ctx.globalAlpha = run.screenFlash * 0.4;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 1280, 720);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

function drawArena() {
  const waveKind = run?.waveProfile?.kind;
  const heat = waveKind === 'boss' ? 0.26 : waveKind === 'elite' ? 0.18 : waveKind === 'onslaught' ? 0.12 : 0.08;
  const hasArenaArt = isImageReady(artAssets.arena);

  if (hasArenaArt) {
    drawArenaArt(artAssets.arena);
    const shade = ctx.createRadialGradient(640, 360, 120, 640, 360, 760);
    shade.addColorStop(0, 'rgba(255,255,255,0.02)');
    shade.addColorStop(0.72, 'rgba(5,8,13,0.08)');
    shade.addColorStop(1, waveKind === 'boss' ? 'rgba(30,8,8,0.34)' : 'rgba(5,8,13,0.3)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, 1280, 720);
  } else {
    const grd = ctx.createRadialGradient(640, 360, 30, 640, 360, 780);
    grd.addColorStop(0, '#141b28');
    grd.addColorStop(0.7, '#0b0e14');
    grd.addColorStop(1, waveKind === 'boss' ? '#190d0d' : '#0b0e14');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 1280, 720);

    const centerLight = ctx.createRadialGradient(640, 360, 20, 640, 360, 410);
    centerLight.addColorStop(0, 'rgba(96,165,250,0.1)');
    centerLight.addColorStop(0.58, 'rgba(245,158,11,0.035)');
    centerLight.addColorStop(1, 'rgba(15,23,42,0)');
    ctx.fillStyle = centerLight;
    ctx.fillRect(0, 0, 1280, 720);

    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1;
    ctx.setLineDash([14, 18]);
    ctx.strokeRect(90, 82, 1080, 556);
    ctx.restore();
  }

  if (waveKind === 'boss' || waveKind === 'elite' || waveKind === 'onslaught') {
    ctx.save();
    const ring = ctx.createRadialGradient(640, 360, 120, 640, 360, 560);
    ring.addColorStop(0, `rgba(239,68,68,${heat * 0.2})`);
    ring.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(640, 360, 560, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (!hasArenaArt) {
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = '#334155';
    for (let y = 32; y < 720; y += 64) {
      for (let x = 32; x < 1280; x += 64) {
        ctx.strokeRect(x, y, 56, 56);
      }
    }
    ctx.globalAlpha = 1;
  }

  for (const p of ambient) {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = waveKind === 'boss'
    ? (hasArenaArt ? 'rgba(248,113,113,.28)' : '#7f1d1d')
    : (hasArenaArt ? 'rgba(248,215,138,.18)' : '#1e293b');
  ctx.lineWidth = hasArenaArt ? 2 : 4;
  ctx.strokeRect(hasArenaArt ? 52 : 28, hasArenaArt ? 58 : 28, hasArenaArt ? 1176 : 1224, hasArenaArt ? 604 : 664);
  ctx.strokeStyle = waveKind === 'boss'
    ? 'rgba(248,113,113,.38)'
    : (hasArenaArt ? 'rgba(148,163,184,.12)' : 'rgba(148,163,184,.2)');
  ctx.lineWidth = 1;
  ctx.strokeRect(hasArenaArt ? 64 : 38, hasArenaArt ? 70 : 38, hasArenaArt ? 1152 : 1204, hasArenaArt ? 580 : 644);
}

function drawArenaArt(img) {
  const iw = img.naturalWidth || 1280;
  const ih = img.naturalHeight || 720;
  const sourceRatio = iw / ih;
  const targetRatio = 1280 / 720;
  let sx = 0;
  let sy = 0;
  let sw = iw;
  let sh = ih;

  if (sourceRatio > targetRatio) {
    sw = ih * targetRatio;
    sx = (iw - sw) / 2;
  } else if (sourceRatio < targetRatio) {
    sh = iw / targetRatio;
    sy = (ih - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 1280, 720);
}

function drawTelegraphs() {
  for (const t of run.telegraphs) {
    const a = Math.max(0, t.life / t.maxLife);
    ctx.save();
    ctx.globalAlpha = a * 0.35;
    ctx.fillStyle = t.color || 'rgba(239,68,68,.3)';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a * 0.75;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2 + (1 - a) * 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, Math.max(8, t.radius - (1 - a) * t.radius * 0.9), 0, Math.PI * 2);
    ctx.stroke();
    if (t.owner && run.enemies?.some(e => e.id === t.owner && e.isBoss)) {
      ctx.globalAlpha = a * 0.18;
      ctx.strokeStyle = 'rgba(251,146,60,0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawBossArenaPressure() {
  if (run?.waveProfile?.kind !== 'boss') return;
  const boss = run.enemies?.find(e => e.isBoss);
  if (!boss) return;

  const readout = getBossThreatReadout(boss);
  const { phase, charge, pressure } = readout;
  const pulse = (Math.sin(gameTime * (2.2 + pressure * 2.4)) + 1) * 0.5;
  const phaseColor = getBossPatternColor(phase?.pattern, boss.color || '#fb923c');

  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = hexToRgba(phaseColor, 0.16 + pressure * 0.18 + charge * 0.14);
  ctx.lineWidth = 2 + pressure * 4 + pulse * 1.8;
  ctx.strokeRect(72, 78, 1136, 564);

  ctx.globalAlpha = 0.18 + pressure * 0.18;
  ctx.fillStyle = hexToRgba('#7f1d1d', 0.28);
  const corner = 76 + pressure * 42;
  ctx.beginPath();
  ctx.moveTo(72, 78);
  ctx.lineTo(72 + corner, 78);
  ctx.lineTo(72, 78 + corner);
  ctx.moveTo(1208, 78);
  ctx.lineTo(1208 - corner, 78);
  ctx.lineTo(1208, 78 + corner);
  ctx.moveTo(72, 642);
  ctx.lineTo(72 + corner, 642);
  ctx.lineTo(72, 642 - corner);
  ctx.moveTo(1208, 642);
  ctx.lineTo(1208 - corner, 642);
  ctx.lineTo(1208, 642 - corner);
  ctx.fill();

  drawBossPhaseEdgeBands(readout, phaseColor, pulse);

  const radius = 246 + pulse * 10 + pressure * 18;
  ctx.globalAlpha = 0.26 + pressure * 0.26;
  ctx.strokeStyle = hexToRgba(phaseColor, 0.58);
  ctx.lineWidth = 1.5 + pressure * 1.4;
  ctx.setLineDash([18, 16]);
  ctx.beginPath();
  ctx.arc(640, 360, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const spokes = phase?.pattern === 'cross_shot' ? 4 : phase?.pattern === 'ring_burst' ? 12 : 8;
  const rotation = (boss.bulletAngle || 0) + gameTime * 0.18;
  ctx.globalAlpha = 0.18 + pressure * 0.24;
  ctx.strokeStyle = hexToRgba(phaseColor, 0.5);
  ctx.lineWidth = 2;
  for (let i = 0; i < spokes; i++) {
    const a = rotation + (i / spokes) * Math.PI * 2;
    const inner = radius + 22;
    const outer = radius + 68 + charge * 34;
    ctx.beginPath();
    ctx.moveTo(640 + Math.cos(a) * inner, 360 + Math.sin(a) * inner);
    ctx.lineTo(640 + Math.cos(a) * outer, 360 + Math.sin(a) * outer);
    ctx.stroke();
  }

  drawBossPhaseThresholdRing(readout, phaseColor, radius, pulse);

  const panelX = 92;
  const panelY = 134;
  const panelW = 258;
  const panelH = 88;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = 'rgba(15,23,42,0.72)';
  roundRect(panelX, panelY, panelW, panelH, 18);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(phaseColor, 0.55 + charge * 0.35);
  ctx.lineWidth = 1.5 + charge * 1.5;
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('BOSS READ', panelX + 16, panelY + 20);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText(readout.patternLabel, panelX + 16, panelY + 43);
  ctx.fillStyle = hexToRgba(phaseColor, 0.92);
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(readout.phaseLabel || '阶段 1/1', panelX + 16, panelY + 67);

  const barX = panelX + 152;
  const barY = panelY + 66;
  const barW = 88;
  const barH = 8;
  ctx.fillStyle = 'rgba(148,163,184,0.28)';
  roundRect(barX, barY, barW, barH, 6);
  ctx.fill();
  ctx.fillStyle = hexToRgba(phaseColor, 0.86);
  roundRect(barX, barY, barW * charge, barH, 6);
  ctx.fill();
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`蓄力 ${Math.round(charge * 100)}%`, panelX + panelW - 16, panelY + 20);
  ctx.restore();
}

function drawBossPhaseEdgeBands(readout, phaseColor, pulse) {
  const pressure = readout.pressure || 0;
  const charge = readout.charge || 0;
  const intensity = readout.phaseIntensity || 0;
  if (pressure < 0.08 && intensity < 0.12) return;

  const left = 72;
  const top = 78;
  const right = 1208;
  const bottom = 642;
  const width = right - left;
  const height = bottom - top;
  const band = 12 + pressure * 20 + intensity * 24;
  const alpha = 0.06 + pressure * 0.12 + intensity * 0.16 + pulse * 0.03;

  ctx.save();
  const topBand = ctx.createLinearGradient(left, top, left, top + band);
  topBand.addColorStop(0, hexToRgba(phaseColor, alpha));
  topBand.addColorStop(1, hexToRgba(phaseColor, 0));
  ctx.fillStyle = topBand;
  ctx.fillRect(left, top, width, band);

  const bottomBand = ctx.createLinearGradient(left, bottom, left, bottom - band);
  bottomBand.addColorStop(0, hexToRgba(phaseColor, alpha));
  bottomBand.addColorStop(1, hexToRgba(phaseColor, 0));
  ctx.fillStyle = bottomBand;
  ctx.fillRect(left, bottom - band, width, band);

  const leftBand = ctx.createLinearGradient(left, top, left + band, top);
  leftBand.addColorStop(0, hexToRgba(phaseColor, alpha * 0.86));
  leftBand.addColorStop(1, hexToRgba(phaseColor, 0));
  ctx.fillStyle = leftBand;
  ctx.fillRect(left, top, band, height);

  const rightBand = ctx.createLinearGradient(right, top, right - band, top);
  rightBand.addColorStop(0, hexToRgba(phaseColor, alpha * 0.86));
  rightBand.addColorStop(1, hexToRgba(phaseColor, 0));
  ctx.fillStyle = rightBand;
  ctx.fillRect(right - band, top, band, height);

  if (intensity >= 0.32) {
    const marks = 22;
    const markGap = width / marks;
    ctx.globalAlpha = 0.16 + intensity * 0.22 + charge * 0.12;
    ctx.strokeStyle = hexToRgba(phaseColor, 0.72);
    ctx.lineWidth = 2 + intensity * 2;
    ctx.lineCap = 'round';
    for (let i = 0; i <= marks; i++) {
      const x = left + i * markGap + ((gameTime * 22 + i * 17) % markGap) * 0.18;
      const lean = 18 + charge * 30 + pulse * 8;
      ctx.beginPath();
      ctx.moveTo(x, top + 6);
      ctx.lineTo(x + lean, top + band * 0.84);
      ctx.moveTo(x - lean * 0.5, bottom - band * 0.84);
      ctx.lineTo(x + lean * 0.5, bottom - 6);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBossPhaseThresholdRing(readout, phaseColor, baseRadius, pulse) {
  const total = readout.phaseTotal || 0;
  if (total <= 1) return;

  const activeIndex = readout.phaseIndex || 0;
  const intensity = readout.phaseIntensity || 0;
  const radius = baseRadius + 34 + intensity * 18;
  const gap = 0.08;

  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < total; i++) {
    const start = -Math.PI / 2 + (i / total) * Math.PI * 2 + gap;
    const end = -Math.PI / 2 + ((i + 1) / total) * Math.PI * 2 - gap;
    const active = i <= activeIndex;
    ctx.globalAlpha = active ? 0.26 + intensity * 0.28 + pulse * 0.08 : 0.11;
    ctx.strokeStyle = active ? hexToRgba(phaseColor, 0.82) : 'rgba(148,163,184,0.42)';
    ctx.lineWidth = active ? 5 + intensity * 3 : 3;
    ctx.beginPath();
    ctx.arc(640, 360, radius + (active ? pulse * 4 : 0), start, end);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer() {
  const ch = getCharacter(run.characterId || 'warrior');
  const pulse = 1 + Math.sin(gameTime * 6) * 0.03;
  ctx.save();
  const playerGlow = ctx.createRadialGradient(run.player.x, run.player.y, 4, run.player.x, run.player.y, 34);
  playerGlow.addColorStop(0, 'rgba(96,165,250,0.28)');
  playerGlow.addColorStop(1, 'rgba(96,165,250,0)');
  ctx.fillStyle = playerGlow;
  ctx.beginPath();
  ctx.arc(run.player.x, run.player.y, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = run.player.invuln > 0 ? 0.52 : 0.9;
  ctx.fillStyle = 'rgba(15,23,42,.82)';
  ctx.strokeStyle = 'rgba(191,219,254,.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(run.player.x, run.player.y, 26 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const alpha = run.player.invuln > 0 ? 0.7 : 1;
  const drewPlayer = drawHeroSprite(ch, run.player.x, run.player.y, 78 * pulse, alpha);
  if (!drewPlayer) {
    const drewSymbol = drawSymbol(`icon-player-${ch.id}`, run.player.x, run.player.y, 50 * pulse, 50 * pulse, alpha);
    if (!drewSymbol) drawFallbackDisc(run.player.x, run.player.y, 22 * pulse, ch.color || '#60a5fa', '#dbeafe');
  }

  if (run.player.barrier > 0) {
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(run.player.x, run.player.y, 28 + Math.sin(gameTime * 7) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if ((run.player.tempDeathWard || 0) > 0) {
    const wardPulse = 1 + Math.sin(gameTime * 5.4) * 0.08;
    const isSmokeWard = run.player.tempDeathWardSource === 'smoke';
    const wardStroke = isSmokeWard ? 'rgba(125,211,252,0.88)' : 'rgba(253,224,71,0.88)';
    const wardFill = isSmokeWard ? 'rgba(186,230,253,0.86)' : 'rgba(253,224,71,0.82)';
    const wardGlyph = isSmokeWard ? '影' : '护';
    ctx.save();
    ctx.translate(run.player.x, run.player.y);
    ctx.rotate(gameTime * 0.75);
    ctx.globalAlpha = 0.78;
    ctx.strokeStyle = wardStroke;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, 36 * wardPulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = wardFill;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(wardGlyph, 0, -42 * wardPulse);
    ctx.restore();
  }
}

function drawHeroSprite(ch, x, y, size, alpha = 1) {
  const img = artAssets.heroes;
  if (!isImageReady(img)) return false;

  const stats = run ? getPlayerStats(run) : null;
  const attackFrame = stats ? run.player.attackTimer > stats.attackCooldown * 0.72 : false;
  const row = attackFrame || run?.dashTimer > 0 ? 1 : 0;
  const col = ch.sprite?.col ?? 0;
  const sx = col * HERO_TILE_SIZE;
  const sy = row * HERO_TILE_SIZE;
  const facing = run?.player?.facingAngle ?? 0;
  const flip = Math.cos(facing) < -0.15;
  const bob = Math.sin(gameTime * 8) * 1.1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y + bob);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, HERO_TILE_SIZE, HERO_TILE_SIZE, -size / 2, -size / 2, size, size);
  ctx.restore();
  return true;
}

function drawEnemies() {
  for (const e of run.enemies) {
    const symbol = getEnemySymbol(e);
    const visualSize = Math.max(e.isBoss ? e.radius * 2.75 : 34, e.radius * (e.isBoss ? 2.65 : 2.45));
    const symbolSize = visualSize * (e.isBoss ? 0.96 : 0.9);
    const spriteSize = visualSize * (e.isBoss ? 1.28 : 1.34);
    const alpha = e.phased ? 0.35 : 1;

    drawEnemyPresence(e, visualSize);
    drawEnemyStatus(e, visualSize);
    drawEnemyIntent(e, visualSize);
    const drewSprite = drawEnemySprite(e, e.x, e.y, spriteSize, alpha);
    if (!drewSprite) {
      const drewSymbol = drawSymbol(symbol, e.x, e.y, symbolSize, symbolSize, alpha);
      if (!drewSymbol) drawFallbackEnemy(e, visualSize * 0.42);
    }

    if (e.isBoss) drawBossPhaseCrown(e, getBossThreatReadout(e), visualSize);

    if (e.isElite) {
      ctx.save();
      ctx.strokeStyle = 'rgba(250,204,21,.88)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, visualSize * 0.58 + Math.sin(gameTime * 5) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ELITE', e.x, e.y - visualSize * 0.62 - 10);
      ctx.restore();
    }

    drawEnemyHealth(e, visualSize);
  }
}

function drawBossPhaseCrown(e, readout, visualSize) {
  const total = readout.phaseTotal || 0;
  if (!e?.isBoss || total <= 1) return;

  const activeIndex = readout.phaseIndex || 0;
  const color = getBossPatternColor(readout.pattern, e.color || '#fb923c');
  const charge = readout.charge || 0;
  const intensity = readout.phaseIntensity || 0;
  const pulse = (Math.sin(gameTime * (4.2 + intensity * 3.4)) + 1) * 0.5;
  const ringRadius = visualSize * (0.58 + intensity * 0.09) + charge * 8;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.28 + intensity * 0.22 + charge * 0.16;
  ctx.strokeStyle = hexToRgba(color, 0.68 + charge * 0.2);
  ctx.lineWidth = 2 + intensity * 2.5 + charge * 1.8;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.arc(e.x, e.y, ringRadius + pulse * 4, -Math.PI * 0.9, Math.PI * 0.1);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < total; i++) {
    const offset = (i - (total - 1) / 2) * 0.43;
    const a = -Math.PI / 2 + offset;
    const x = e.x + Math.cos(a) * ringRadius;
    const y = e.y + Math.sin(a) * ringRadius - visualSize * 0.04;
    const active = i <= activeIndex;
    const size = active ? 8 + intensity * 4 + pulse * 1.5 : 6;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4 + offset * 0.35);
    ctx.globalAlpha = active ? 0.72 + charge * 0.2 : 0.32;
    ctx.fillStyle = active ? hexToRgba(color, 0.9) : 'rgba(148,163,184,0.55)';
    ctx.strokeStyle = active ? 'rgba(254,243,199,0.82)' : 'rgba(203,213,225,0.36)';
    ctx.lineWidth = active ? 1.5 : 1;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.strokeRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }

  ctx.globalAlpha = 0.72;
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`P${activeIndex + 1}`, e.x, e.y - ringRadius - 14);
  ctx.restore();
}

function drawEnemyIntent(e, visualSize) {
  if (!run?.player) return;
  const dx = run.player.x - e.x;
  const dy = run.player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const angle = Math.atan2(dy, dx);
  const color = e.isBoss ? '#fb923c' : e.isElite ? '#facc15' : e.color || '#ef4444';

  if ((e.meleePendingDamage || 0) > 0 && e.meleeSwingTimer > 0) {
    const windup = clamp(1 - e.meleeSwingTimer / 0.25, 0, 1);
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.25 + windup * 0.55;
    ctx.fillStyle = hexToRgba(color, 0.18 + windup * 0.16);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, (e.meleePendingRange || e.attackRange || 35) + 18, -0.42, 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hexToRgba('#ffffff', 0.28 + windup * 0.35);
    ctx.lineWidth = 2 + windup * 3;
    ctx.beginPath();
    ctx.arc(0, 0, (e.meleePendingRange || e.attackRange || 35) + 10, -0.42, 0.42);
    ctx.stroke();
    ctx.restore();
  }

  if ((e.attackType === 'projectile' || e.attackType === 'spread') && dist < (e.attackRange || 0) + 80) {
    const cooldown = Math.max(0.1, e.attackCooldown || 1);
    const charge = clamp(1 - (e.attackTimer || 0) / cooldown, 0, 1);
    if (charge > 0.68) {
      const lineAlpha = (charge - 0.68) / 0.32;
      const range = Math.min(dist, e.attackRange || dist);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(angle);
      ctx.globalAlpha = 0.16 + lineAlpha * 0.42;
      ctx.strokeStyle = hexToRgba(color, 0.65);
      ctx.lineWidth = e.attackType === 'spread' ? 3 : 2;
      ctx.setLineDash(e.attackType === 'spread' ? [10, 9] : [15, 12]);
      ctx.beginPath();
      ctx.moveTo(visualSize * 0.38, 0);
      ctx.lineTo(range, 0);
      ctx.stroke();
      if (e.attackType === 'spread') {
        ctx.beginPath();
        ctx.moveTo(visualSize * 0.34, 0);
        ctx.lineTo(Math.min(range, 220), -Math.min(range, 220) * 0.18);
        ctx.moveTo(visualSize * 0.34, 0);
        ctx.lineTo(Math.min(range, 220), Math.min(range, 220) * 0.18);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = hexToRgba(color, 0.22 + lineAlpha * 0.28);
      ctx.beginPath();
      ctx.arc(visualSize * 0.42, 0, 9 + lineAlpha * 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  if ((e.attackType === 'heal_aura' || e.attackType === 'summon') && (e.attackTimer || 0) < Math.min(1, e.attackCooldown || 1)) {
    const charge = clamp(1 - (e.attackTimer || 0) / Math.max(0.1, Math.min(1, e.attackCooldown || 1)), 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.18 + charge * 0.36;
    ctx.strokeStyle = e.attackType === 'heal_aura' ? 'rgba(244,114,182,0.72)' : 'rgba(167,139,250,0.76)';
    ctx.lineWidth = 2 + charge * 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, visualSize * (0.78 + charge * 0.38), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([5, 8]);
    ctx.beginPath();
    ctx.arc(e.x, e.y, Math.max(18, (e.attackRange || 120) * 0.45), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (e.isBoss && e.phaseAttackTimer !== undefined) {
    const phase = getCurrentBossPhase(e);
    const cooldown = Math.max(0.4, phase?.attackCooldown || 2.5);
    const warningWindow = Math.min(1.35, cooldown * 0.48);
    const charge = clamp(1 - (e.phaseAttackTimer || 0) / warningWindow, 0, 1);
    if (charge > 0) {
      const radius = visualSize * (0.62 + charge * 0.35);
      ctx.save();
      ctx.globalAlpha = 0.12 + charge * 0.38;
      ctx.strokeStyle = hexToRgba(color, 0.82);
      ctx.lineWidth = 2 + charge * 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.08 + charge * 0.26;
      ctx.fillStyle = hexToRgba(color, 0.24);
      ctx.beginPath();
      ctx.arc(e.x, e.y, radius * 1.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    drawBossPatternPreview(e, phase, charge, color, visualSize);
  }
}

function drawBossPatternPreview(e, phase, charge, color, visualSize) {
  if (!phase || charge <= 0.12 || !run?.player) return;

  const pattern = phase.pattern;
  const alpha = clamp((charge - 0.12) / 0.88, 0, 1);
  const patternColor = getBossPatternColor(pattern, color);
  const dx = run.player.x - e.x;
  const dy = run.player.y - e.y;
  const angleToPlayer = Math.atan2(dy, dx);

  ctx.save();
  ctx.globalAlpha = 0.18 + alpha * 0.55;
  ctx.strokeStyle = hexToRgba(patternColor, 0.76);
  ctx.fillStyle = hexToRgba(patternColor, 0.18 + alpha * 0.12);
  ctx.lineCap = 'round';

  switch (pattern) {
    case 'aimed_burst': {
      const range = Math.min(620, Math.hypot(dx, dy) + 210);
      const width = 18 + alpha * 28;
      ctx.translate(e.x, e.y);
      ctx.rotate(angleToPlayer);
      ctx.beginPath();
      ctx.moveTo(visualSize * 0.36, 0);
      ctx.lineTo(range, -width);
      ctx.lineTo(range, width);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 3 + alpha * 3;
      ctx.setLineDash([18, 13]);
      ctx.beginPath();
      ctx.moveTo(visualSize * 0.42, 0);
      ctx.lineTo(range, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.22 + alpha * 0.34;
      ctx.strokeStyle = hexToRgba(patternColor, 0.9);
      ctx.lineWidth = 2 + alpha * 2;
      ctx.beginPath();
      ctx.arc(run.player.x, run.player.y, 34 + alpha * 10, 0, Math.PI * 2);
      ctx.moveTo(run.player.x - 48, run.player.y);
      ctx.lineTo(run.player.x - 16, run.player.y);
      ctx.moveTo(run.player.x + 16, run.player.y);
      ctx.lineTo(run.player.x + 48, run.player.y);
      ctx.moveTo(run.player.x, run.player.y - 48);
      ctx.lineTo(run.player.x, run.player.y - 16);
      ctx.moveTo(run.player.x, run.player.y + 16);
      ctx.lineTo(run.player.x, run.player.y + 48);
      ctx.stroke();
      ctx.restore();
      return;
    }

    case 'circle_shot':
    case 'ring_burst': {
      const count = Math.max(6, Math.min(18, phase.bulletCount || 10));
      const rings = pattern === 'ring_burst' ? 2 : 1;
      ctx.translate(e.x, e.y);
      for (let ring = 0; ring < rings; ring++) {
        const previewRadius = e.radius + 76 + ring * 34 + alpha * 18;
        ctx.lineWidth = 2 + alpha * 2;
        ctx.setLineDash(ring === 0 ? [13, 10] : [7, 9]);
        ctx.beginPath();
        ctx.arc(0, 0, previewRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + (e.bulletAngle || 0) + alpha * 0.18;
        const inner = e.radius + 54;
        const outer = e.radius + 126 + alpha * 70;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
        ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
        ctx.stroke();
      }
      break;
    }

    case 'spiral_shot': {
      const count = Math.max(7, Math.min(14, phase.bulletCount || 10));
      ctx.translate(e.x, e.y);
      ctx.lineWidth = 2 + alpha * 2.5;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + (e.bulletAngle || 0) + gameTime * 0.45;
        const inner = e.radius + 46;
        const mid = e.radius + 118 + alpha * 40;
        const outer = e.radius + 210 + alpha * 84;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
        ctx.quadraticCurveTo(
          Math.cos(a + 0.32) * mid,
          Math.sin(a + 0.32) * mid,
          Math.cos(a + 0.78) * outer,
          Math.sin(a + 0.78) * outer,
        );
        ctx.stroke();
      }
      break;
    }

    case 'cross_shot': {
      ctx.translate(e.x, e.y);
      ctx.rotate(e.bulletAngle || 0);
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((Math.PI / 2) * i);
        ctx.lineWidth = 20 + alpha * 18;
        ctx.strokeStyle = hexToRgba(patternColor, 0.16 + alpha * 0.12);
        ctx.beginPath();
        ctx.moveTo(-920, 0);
        ctx.lineTo(920, 0);
        ctx.stroke();
        ctx.lineWidth = 2 + alpha * 4;
        ctx.strokeStyle = hexToRgba('#ffffff', 0.32 + alpha * 0.32);
        ctx.setLineDash([22, 16]);
        ctx.beginPath();
        ctx.moveTo(-920, 0);
        ctx.lineTo(920, 0);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }

    case 'random_rain': {
      const count = 6;
      ctx.lineWidth = 2 + alpha * 2;
      for (let i = 0; i < count; i++) {
        const x = 180 + ((i * 173 + gameTime * (18 + i * 2)) % 920);
        const y = 112 + ((i * 137 + gameTime * (13 + i * 1.5)) % 496);
        const r = 28 + ((i % 3) * 9) + alpha * 18;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, r + 8 + alpha * 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }

    default: {
      ctx.lineWidth = 3 + alpha * 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 88 + alpha * 52, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function getBossPatternColor(pattern, fallback) {
  switch (pattern) {
    case 'ring_burst':
    case 'cross_shot':
      return '#67e8f9';
    case 'random_rain':
      return '#c084fc';
    case 'aimed_burst':
      return '#facc15';
    case 'spiral_shot':
      return '#fb923c';
    case 'circle_shot':
      return '#f87171';
    default:
      return fallback || '#fb923c';
  }
}

function getBossPatternLabel(pattern) {
  return {
    circle_shot: '环形喷发',
    spiral_shot: '螺旋弹幕',
    aimed_burst: '定点连射',
    ring_burst: '双环爆发',
    cross_shot: '十字冰枪',
    random_rain: '冰雨覆盖',
  }[pattern] || '高压技能';
}

function getCurrentBossPhase(e) {
  if (!e?.phases?.length) return null;
  const hpRatio = e.maxHp > 0 ? e.hp / e.maxHp : 1;
  let phase = e.phases[0];
  for (const candidate of e.phases) {
    if (hpRatio <= candidate.hpThreshold) phase = candidate;
  }
  return phase;
}

function getBossPhaseInfo(boss, phase, hpRatio) {
  const phases = boss?.phases || [];
  if (!phases.length) {
    return { phaseIndex: 0, phaseTotal: 0, phaseLabel: '', phaseIntensity: 0 };
  }

  const index = Math.max(0, phases.indexOf(phase));
  const phaseDepth = phases.length > 1 ? index / Math.max(1, phases.length - 1) : 0;
  const lateWavePressure = clamp(((run?.wave || 5) - 10) / 15, 0, 1);
  const phaseIntensity = clamp(phaseDepth * 0.52 + (1 - hpRatio) * 0.32 + lateWavePressure * 0.2, 0, 1);

  return {
    phaseIndex: index,
    phaseTotal: phases.length,
    phaseLabel: `阶段 ${index + 1}/${phases.length}`,
    phaseIntensity,
  };
}

function getBossThreatReadout(boss) {
  if (!boss) {
    return {
      phase: null,
      pattern: '',
      patternLabel: '',
      charge: 0,
      pressure: 0,
      hpRatio: null,
      phaseIndex: 0,
      phaseTotal: 0,
      phaseLabel: '',
      phaseIntensity: 0,
    };
  }
  const phase = getCurrentBossPhase(boss);
  const hpRatio = boss.maxHp > 0 ? clamp(boss.hp / boss.maxHp, 0, 1) : 1;
  const cooldown = Math.max(0.4, phase?.attackCooldown || 2.5);
  const warningWindow = Math.min(1.35, cooldown * 0.48);
  const charge = clamp(1 - (boss.phaseAttackTimer || 0) / warningWindow, 0, 1);
  const lateWavePressure = clamp(((run?.wave || 5) - 5) / 20, 0, 1);
  const pressure = clamp((1 - hpRatio) * 0.58 + charge * 0.38 + lateWavePressure * 0.18, 0, 1);
  const pattern = phase?.pattern || '';
  const phaseInfo = getBossPhaseInfo(boss, phase, hpRatio);
  return {
    phase,
    pattern,
    patternLabel: getBossPatternLabel(pattern),
    charge,
    pressure,
    hpRatio,
    ...phaseInfo,
  };
}

function drawEnemySprite(e, x, y, size, alpha = 1) {
  const img = artAssets.enemies;
  const sprite = ENEMY_SPRITES[e.typeKey];
  if (!sprite || !isImageReady(img)) return false;

  const sx = sprite.col * ENEMY_TILE_SIZE;
  const sy = sprite.row * ENEMY_TILE_SIZE;
  const bob = Math.sin(gameTime * (e.isBoss ? 3.2 : 4.6) + e.id.length) * (e.isBoss ? 1.2 : 0.8);
  const hitScale = e.hitFlash > 0 ? 1.08 : 1;
  const attackWindup = e.meleePendingDamage > 0 ? clamp(1 - (e.meleeSwingTimer || 0) / 0.25, 0, 1) : 0;
  const faceAngle = run?.player ? Math.atan2(run.player.y - e.y, run.player.x - e.x) : 0;
  const lean = attackWindup * (e.isBoss ? 8 : 5);
  const flip = Math.cos(faceAngle) < -0.12;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + Math.cos(faceAngle) * lean, y + bob + Math.sin(faceAngle) * lean * 0.35);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(
    img,
    sx, sy, ENEMY_TILE_SIZE, ENEMY_TILE_SIZE,
    (-size * hitScale) / 2, (-size * hitScale) / 2,
    size * hitScale, size * hitScale,
  );
  if (e.hitFlash > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.75, e.hitFlash * 0.55)})`;
    ctx.fillRect(-size / 2, -size / 2, size, size);
  }
  ctx.restore();
  return true;
}

function getEnemySymbol(e) {
  if (e.isBoss) return 'icon-boss';
  return {
    slime: 'icon-slime',
    bat: 'icon-bat',
    skeleton: 'icon-skeleton',
    golem: 'icon-golem',
    archer: 'icon-archer',
    fire_mage: 'icon-archer',
    healer: 'icon-healer',
    summoner: 'icon-summoner',
  }[e.typeKey] || 'icon-slime';
}

function drawEnemyPresence(e, visualSize) {
  const color = e.isBoss ? '#ef4444' : e.color || '#ef4444';
  const r = visualSize * 0.5;
  const intro = Math.max(0, 1 - (e.spawnAge || 0) / 0.7);
  const alpha = e.phased ? 0.35 : 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  const glow = ctx.createRadialGradient(e.x, e.y, 4, e.x, e.y, r * 2.2);
  glow.addColorStop(0, hexToRgba(color, e.isBoss ? 0.34 : 0.24));
  glow.addColorStop(0.55, hexToRgba(color, e.isBoss ? 0.12 : 0.08));
  glow.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(e.x, e.y, r * 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = alpha * 0.38;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + r * 0.68, r * 0.78, Math.max(5, r * 0.24), 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(6,10,16,.82)';
  ctx.strokeStyle = e.hitFlash > 0 ? 'rgba(255,255,255,.96)' : hexToRgba(color, e.isBoss ? 0.95 : 0.82);
  ctx.lineWidth = e.hitFlash > 0 ? 4 : e.isBoss ? 3.5 : 2.5;
  ctx.beginPath();
  ctx.arc(e.x, e.y, r * 0.78, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (intro > 0) {
    ctx.globalAlpha = intro * 0.75;
    ctx.strokeStyle = hexToRgba(color, 0.95);
    ctx.lineWidth = 2 + intro * 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * (1.1 + (1 - intro) * 0.65), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnemyStatus(e, visualSize) {
  const radius = visualSize * 0.54;
  const pulse = (Math.sin(gameTime * 7 + e.x * 0.03) + 1) * 0.5;

  if ((e.slowTimer || 0) > 0) {
    ctx.save();
    ctx.globalAlpha = 0.28 + pulse * 0.18;
    ctx.strokeStyle = 'rgba(125,211,252,0.82)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(e.x, e.y, radius + 5 + pulse * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(56,189,248,0.08)';
    ctx.beginPath();
    ctx.arc(e.x, e.y, radius + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if ((e.dotDamage || 0) > 0) {
    ctx.save();
    ctx.globalAlpha = 0.22 + pulse * 0.22;
    ctx.strokeStyle = 'rgba(74,222,128,0.74)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, radius + 10 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(34,197,94,0.08)';
    for (let i = 0; i < 4; i++) {
      const ang = gameTime * 1.6 + i * Math.PI * 0.5;
      ctx.beginPath();
      ctx.arc(e.x + Math.cos(ang) * (radius + 13), e.y + Math.sin(ang) * (radius + 13), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawFallbackEnemy(e, r) {
  const color = e.isBoss ? '#ef4444' : e.color || '#ef4444';
  drawFallbackDisc(e.x, e.y, r, color, '#fff7ed');
  ctx.save();
  ctx.fillStyle = 'rgba(5,8,12,.88)';
  ctx.beginPath();
  ctx.arc(e.x - r * 0.32, e.y - r * 0.1, Math.max(2, r * 0.14), 0, Math.PI * 2);
  ctx.arc(e.x + r * 0.32, e.y - r * 0.1, Math.max(2, r * 0.14), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFallbackDisc(x, y, r, color, eyeColor) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.15, Math.max(2, r * 0.14), 0, Math.PI * 2);
  ctx.arc(x + r * 0.35, y - r * 0.15, Math.max(2, r * 0.14), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemyHealth(e, visualSize) {
  const bw = Math.max(e.isBoss ? 96 : 42, visualSize * (e.isBoss ? 1.18 : 1.05));
  const bh = e.isBoss ? 8 : 5;
  const by = e.y - visualSize * 0.58 - (e.isBoss ? 16 : 10);
  const pct = Math.max(0, Math.min(1, e.hp / e.maxHp));

  ctx.save();
  ctx.fillStyle = 'rgba(3,7,12,.78)';
  roundRect(e.x - bw / 2, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.fillStyle = e.isBoss ? '#f97316' : e.isElite ? '#facc15' : '#ef4444';
  roundRect(e.x - bw / 2, by, bw * pct, bh, bh / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = 1;
  roundRect(e.x - bw / 2, by, bw, bh, bh / 2);
  ctx.stroke();
  ctx.restore();
}

function drawThreatIndicators() {
  if (!run?.enemies?.length) return;
  for (const e of run.enemies) {
    const inView = e.x >= 48 && e.x <= 1232 && e.y >= 48 && e.y <= 672;
    if (inView) continue;

    const color = e.isBoss ? '#f97316' : e.isElite ? '#facc15' : '#ef4444';
    const x = clamp(e.x, 58, 1222);
    const y = clamp(e.y, 58, 662);
    const angle = Math.atan2(e.y - run.player.y, e.x - run.player.x);
    const pulse = 1 + Math.sin(gameTime * 8 + e.x * 0.02) * 0.12;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = hexToRgba(color, 0.18);
    ctx.beginPath();
    ctx.arc(0, 0, 19 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(18 * pulse, 0);
    ctx.lineTo(-8 * pulse, -9 * pulse);
    ctx.lineTo(-3 * pulse, 0);
    ctx.lineTo(-8 * pulse, 9 * pulse);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawProjectileSet(projectiles, isPlayer = false) {
  for (const p of projectiles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = isPlayer ? 0.34 : 0.25;
    ctx.fillStyle = p.trailColor || p.color || '#f59e0b';
    ctx.beginPath();
    ctx.arc(-p.vx * 0.015, -p.vy * 0.015, p.radius * (isPlayer ? 2.1 : 1.8), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = isPlayer ? 0.26 : 0.18;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * (isPlayer ? 2.9 : 2.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.color || '#f59e0b';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    if (isPlayer) {
      ctx.strokeStyle = hexToRgba(p.trailColor || '#ffffff', 0.72);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawProjectiles() {
  drawProjectileSet(run.playerProjectiles || [], true);
  drawProjectileSet(run.projectiles || [], false);
}

function drawPickups() {
  for (const p of run.pickups) {
    ctx.save();
    ctx.translate(p.x, p.y + Math.sin(gameTime * 3 + p.x * 0.1) * 3);
    if (p.type === 'heal') {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', 0, 1);
    } else {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(3, -3); ctx.lineTo(10, 0); ctx.lineTo(3, 3); ctx.lineTo(0, 10); ctx.lineTo(-3, 3); ctx.lineTo(-10, 0); ctx.lineTo(-3, -3); ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of run.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    const progress = 1 - a;
    ctx.save();
    ctx.globalAlpha = a;
    switch (p.type) {
      case 'slash':
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);
        ctx.strokeStyle = p.isCrit ? '#fde047' : '#f59e0b';
        ctx.lineWidth = p.isCrit ? 7 : 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -0.55, 0.55);
        ctx.stroke();
        ctx.rotate(-(p.angle || 0));
        ctx.fillStyle = p.isCrit ? '#fde047' : '#f8fafc';
        ctx.font = `bold ${p.isCrit ? 26 : 18}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.floor(p.damage)}`, 0, -28 - (1 - a) * 28);
        break;
      case 'melee_slash': {
        const radius = p.radius || 42;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);
        ctx.globalAlpha = a * 0.78;
        ctx.fillStyle = 'rgba(239,68,68,0.16)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius + (1 - a) * 18, -0.58, 0.58);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,237,213,0.85)';
        ctx.lineWidth = 2 + a * 4;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.9 + (1 - a) * 24, -0.52, 0.52);
        ctx.stroke();
        break;
      }
      case 'shoot_flash': {
        const pulse = 1 - a;
        const flashColor = p.color || '#fbbf24';
        const flash = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 30 + pulse * 18);
        flash.addColorStop(0, 'rgba(255,255,255,0.88)');
        flash.addColorStop(0.32, hexToRgba(flashColor, 0.52));
        flash.addColorStop(1, hexToRgba(flashColor, 0));
        ctx.fillStyle = flash;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 30 + pulse * 18, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'chain': {
        const fromX = p.fromX ?? p.x;
        const fromY = p.fromY ?? p.y;
        const color = p.color || '#60a5fa';
        ctx.globalAlpha = a * 0.85;
        ctx.strokeStyle = hexToRgba(color, 0.28);
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.strokeStyle = hexToRgba('#e0f2fe', 0.82);
        ctx.lineWidth = 2.4;
        ctx.setLineDash([8, 8]);
        ctx.lineDashOffset = -gameTime * 42;
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = hexToRgba(color, 0.35);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14 + progress * 16, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'explosion': {
        const radius = 18 + progress * 58;
        const blast = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, radius);
        blast.addColorStop(0, 'rgba(255,255,255,0.78)');
        blast.addColorStop(0.18, 'rgba(251,191,36,0.42)');
        blast.addColorStop(0.52, 'rgba(249,115,22,0.22)');
        blast.addColorStop(1, 'rgba(127,29,29,0)');
        ctx.fillStyle = blast;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(254,215,170,${a * 0.72})`;
        ctx.lineWidth = 2 + a * 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'bullet_hit': {
        const color = p.color || '#f59e0b';
        const radius = 8 + progress * 24;
        ctx.fillStyle = hexToRgba(color, 0.28 * a);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hexToRgba('#ffffff', 0.72 * a);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5 + progress * 18, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 5; i++) {
          const ang = i * Math.PI * 0.4 + gameTime;
          ctx.fillStyle = hexToRgba(color, 0.72 * a);
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(ang) * radius * 0.58, p.y + Math.sin(ang) * radius * 0.58, 1.8 * a, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'summon': {
        const radius = 30 + (1 - a) * 26;
        ctx.translate(p.x, p.y);
        ctx.rotate(gameTime * 1.8);
        ctx.strokeStyle = 'rgba(167,139,250,0.82)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(221,214,254,0.62)';
        ctx.setLineDash([7, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(196,181,253,0.8)';
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * radius, Math.sin(ang) * radius, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'hit':
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`-${p.damage}`, p.x, p.y - 16 - (1 - a) * 26);
        ctx.strokeStyle = `rgba(248,113,113,${a * 0.64})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 18 + progress * 22, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'self_damage':
        ctx.fillStyle = '#fb7185';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`自伤 -${p.value}`, p.x, p.y - progress * 22);
        break;
      case 'barrier_hit':
        ctx.fillStyle = '#67e8f9';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`护盾 -${p.value}`, p.x, p.y - 22 - progress * 18);
        ctx.strokeStyle = `rgba(34,211,238,${a * 0.72})`;
        ctx.lineWidth = 2 + a * 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y + 12, 22 + progress * 30, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'heal':
      case 'lifesteal':
      case 'ember_pickup':
        ctx.fillStyle = p.type === 'ember_pickup' ? '#f59e0b' : '#22c55e';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`+${p.value}`, p.x, p.y - (1 - a) * 24);
        break;
      case 'dodge':
        ctx.fillStyle = '#22d3ee';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('闪避', p.x, p.y - (1 - a) * 24);
        break;
      case 'reflect':
        ctx.fillStyle = '#fb923c';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`反弹 ${p.value}`, p.x, p.y - (1 - a) * 24);
        break;
      case 'dash_trail': {
        const radius = 18 + progress * 32;
        ctx.fillStyle = `rgba(96,165,250,${a * 0.12})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 10, radius * 1.4, radius * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(191,219,254,${a * 0.44})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'revive': {
        const radius = 36 + progress * 92;
        const flame = ctx.createRadialGradient(p.x, p.y, 3, p.x, p.y, radius);
        flame.addColorStop(0, 'rgba(255,255,255,0.72)');
        flame.addColorStop(0.18, 'rgba(253,224,71,0.42)');
        flame.addColorStop(0.48, 'rgba(249,115,22,0.24)');
        flame.addColorStop(1, 'rgba(239,68,68,0)');
        ctx.fillStyle = flame;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(253,224,71,${a * 0.78})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 26 + progress * 46, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(254,243,199,${a})`;
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('复燃', p.x, p.y - 40 - progress * 18);
        break;
      }
      case 'death': {
        const color = p.color || '#ef4444';
        const radius = 18 + progress * 48;
        const burst = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, radius);
        burst.addColorStop(0, hexToRgba('#ffffff', 0.5 * a));
        burst.addColorStop(0.26, hexToRgba(color, 0.32 * a));
        burst.addColorStop(1, hexToRgba(color, 0));
        ctx.fillStyle = burst;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(color, 0.7 * a);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 12 + progress * 34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = color;
        for (let i = 0; i < 10; i++) {
          const ang = i / 10 * Math.PI * 2 + gameTime * 0.3;
          const dist = progress * (24 + i % 3 * 8);
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, Math.max(0.7, 2.5 * a), 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
        break;
    }
    ctx.restore();
  }
}

function drawBossHpBar() {
  const boss = run.enemies.find(e => e.isBoss);
  if (!boss) return;
  const x = 200, y = 12, w = 880, h = 18;
  // Background
  ctx.fillStyle = 'rgba(0,0,0,.7)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  // HP bar
  const hpPct = Math.max(0, boss.hp / boss.maxHp);
  const grd = ctx.createLinearGradient(x, y, x + w * hpPct, y);
  grd.addColorStop(0, '#ef4444');
  grd.addColorStop(0.5, '#f97316');
  grd.addColorStop(1, '#fbbf24');
  ctx.fillStyle = grd;
  ctx.fillRect(x, y, w * hpPct, h);
  if (boss.phases?.length > 1) {
    ctx.save();
    for (const phase of boss.phases) {
      const threshold = Number(phase.hpThreshold);
      if (!(threshold > 0 && threshold < 1)) continue;
      const tx = x + w * threshold;
      const active = hpPct <= threshold;
      ctx.strokeStyle = active ? 'rgba(254,243,199,.88)' : 'rgba(254,243,199,.45)';
      ctx.lineWidth = active ? 2 : 1.2;
      ctx.beginPath();
      ctx.moveTo(tx, y - 4);
      ctx.lineTo(tx, y + h + 4);
      ctx.stroke();
      ctx.fillStyle = active ? 'rgba(254,243,199,.88)' : 'rgba(254,243,199,.38)';
      ctx.beginPath();
      ctx.moveTo(tx, y + h + 7);
      ctx.lineTo(tx - 5, y + h + 13);
      ctx.lineTo(tx + 5, y + h + 13);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  // Border
  ctx.strokeStyle = '#7f1d1d';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
  // Boss name
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(boss.name, x + w / 2, y + 13);
  // HP text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.ceil(Math.max(0, boss.hp))} / ${boss.maxHp}`, x + w - 6, y + 13);
}

function drawWaveProgress() {
  const x = 20, y = 690, w = 120, h = 6;
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(x, y, w, h);
  const pct = Math.min(1, run.wave / run.totalWaves);
  const grd = ctx.createLinearGradient(x, y, x + w * pct, y);
  grd.addColorStop(0, '#6366f1');
  grd.addColorStop(1, '#a78bfa');
  ctx.fillStyle = grd;
  ctx.fillRect(x, y, w * pct, h);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${run.wave}/${run.totalWaves}`, x + w + 8, y + 6);
}

function drawMinimap() {
  const x = 1120, y = 590, w = 130, h = 96;
  ctx.fillStyle = 'rgba(10,14,20,.7)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,.06)';
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(x + run.player.x / 1280 * w, y + run.player.y / 720 * h, 3, 0, Math.PI * 2);
  ctx.fill();
  for (const e of run.enemies) {
    ctx.fillStyle = e.isBoss ? '#fde047' : '#ef4444';
    ctx.beginPath();
    ctx.arc(x + e.x / 1280 * w, y + e.y / 720 * h, e.isBoss ? 3 : 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function hexToRgba(hex, alpha) {
  const value = String(hex || '').trim().replace('#', '');
  const normalized = value.length === 3
    ? value.split('').map(ch => ch + ch).join('')
    : value;
  const n = Number.parseInt(normalized, 16);
  if (!Number.isFinite(n)) return `rgba(248,113,113,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundRect(x, y, w, h, r) {
  if (w <= 0 || h <= 0) {
    ctx.beginPath();
    return;
  }
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawSymbol(id, x, y, w, h, alpha = 1) {
  let img = symbolImageCache.get(id);
  if (!img) {
    const source = document.getElementById(id);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('viewBox', source?.getAttribute('viewBox') || '0 0 64 64');
    svg.setAttribute('width', 64);
    svg.setAttribute('height', 64);
    if (source) {
      for (const child of source.children) svg.appendChild(child.cloneNode(true));
    } else {
      const fallback = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      fallback.setAttribute('cx', '32');
      fallback.setAttribute('cy', '32');
      fallback.setAttribute('r', '22');
      fallback.setAttribute('fill', '#ef4444');
      svg.appendChild(fallback);
    }
    const xml = new XMLSerializer().serializeToString(svg);
    img = new Image();
    img.decoding = 'async';
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    symbolImageCache.set(id, img);
  }
  if (!img.complete || img.naturalWidth === 0) return false;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  ctx.restore();
  return true;
}

function typeIcon(t) { return { attack: '攻', defense: '御', passive: '仪', joker: '变', curse: '咒' }[t] || '·'; }
function typeName(t) { return { attack: '攻击', defense: '防御', passive: '被动', joker: '小丑', curse: '诅咒' }[t] || t; }
function rarityName(r) { return { common: '普通', rare: '精良', epic: '史诗', legendary: '传说' }[r] || r; }
function costText(s) {
  if (!s) return '无';
  const names = { speed: '移速', attack: '攻击', health: '生命', attack_speed: '攻速' };
  return `${names[s.stat] || s.stat} -${Math.round(s.amount * 100)}%`;
}

function enableDebugHooks() {
  const params = new URLSearchParams(window.location.search);
  const localDebugHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  if (!params.has('debug') || !localDebugHost) return;
  window.__EMBER_DEBUG__ = {
    getSnapshot() {
      const boss = run?.enemies?.find(e => e.isBoss);
      const bossReadout = getBossThreatReadout(boss);
      return {
        state: run?.state || state,
        wave: run?.wave || 0,
        waveKind: run?.waveProfile?.kind || '',
        bossCount: run?.enemies?.filter(e => e.isBoss).length || 0,
        projectileCount: run?.projectiles?.filter(p => p.fromEnemy).length || 0,
        telegraphCount: run?.telegraphs?.length || 0,
        bossPhaseAttackTimer: boss?.phaseAttackTimer ?? null,
        bossPattern: bossReadout.pattern,
        bossPatternLabel: bossReadout.patternLabel,
        bossCharge: bossReadout.charge,
        bossPressure: bossReadout.pressure,
        bossHpRatio: boss?.maxHp > 0 ? boss.hp / boss.maxHp : null,
        bossPhaseIndex: bossReadout.phaseIndex,
        bossPhaseTotal: bossReadout.phaseTotal,
        bossPhaseLabel: bossReadout.phaseLabel,
        bossPhaseIntensity: bossReadout.phaseIntensity,
        ward: run?.player?.tempDeathWard || 0,
        barrier: run?.player?.barrier || 0,
      };
    },
    showReward(seed = 2026) {
      const character = getCharacter('warrior');
      run = createRun(seed, character, 'standard');
      selectedCharId = 'warrior';
      selectedDifficultyId = 'standard';
      run.wave = 4;
      run.kills = 28;
      run.score = 1240;
      run.waveProfile = {
        kind: 'onslaught',
        wave: 4,
        label: '第 4 波 · 猛攻余波',
        danger: 3,
        summary: '上一波已经清空，下一波会进入首领战。',
        risk: '首领战即将开始，优先保证稳定输出与容错。',
        rewardTag: 'survival',
      };
      run.nextWavePreview = {
        kind: 'boss',
        wave: 5,
        label: '第 5 波 Boss',
        danger: 5,
        summary: '首领战前最后一次补强，选择会直接影响第 5 波生存窗口。',
        risk: '如果没有续航或安全网，高倍率献祭牌会放大翻车概率。',
        rewardTag: 'survival',
        rewardGuard: 'survival',
      };
      run.rewardContext = { choiceCount: 3, rarityBonus: 2, targetTag: 'survival' };
      const pool = new Map(getCardPool().map(card => [card.id, card]));
      const rawChoices = ['heal_aura', 'shadow_blade', 'doom']
        .map(id => pool.get(id))
        .filter(Boolean);
      run.rewardChoices = enrichRewardChoices(run, rawChoices, run.nextWavePreview);
      run.state = 'reward';
      state = 'playing';
      prevWave = run.wave;
      gameTime = 0;
      initAmbient();
      hideOverlays();
      hud.style.display = 'block';
      tutorialBox.classList.add('hidden');
      updateHud();
      showReward();
      stopBGM();
      return {
        cards: run.rewardChoices.map(card => ({ id: card.id, fitScore: card.fitScore, fitHint: card.fitHint })),
      };
    },
    showHighWaveBoss(seed = 2048, wave = 20) {
      const character = getCharacter('warrior');
      run = createDebugBossFight(seed, { wave, difficultyKey: 'standard', character });
      selectedCharId = 'warrior';
      selectedDifficultyId = 'standard';
      state = 'playing';
      prevWave = run.wave;
      gameTime = run.gameTime || 0;
      initAmbient();
      hideOverlays();
      hud.style.display = 'block';
      tutorialBox.classList.add('hidden');
      updateHud();
      startBGM();
      return window.__EMBER_DEBUG__.getSnapshot();
    },
    showResult(victory = false) {
      const character = getCharacter('warrior');
      run = createRun(9001, character, 'standard');
      selectedCharId = 'warrior';
      selectedDifficultyId = 'standard';
      run.wave = 20;
      run.kills = 276;
      run.score = 18240;
      run.maxCombo = 18;
      run.gameTime = 734;
      run.player.deck = run.player.deck.concat(getCardPool().filter(card => [
        'quick_blade',
        'gatling',
        'thorn_skin',
        'phoenix_ember',
        'time_rift',
      ].includes(card.id)).map(card => ({ ...card })));
      run.synergies = ['钢铁防线', '武备压制'];
      run.extremes = ['巨炮节奏'];
      run.buildAnalysis = {
        descriptors: ['壁垒', '速攻', '暴击'],
        pressure: { singleTarget: 108, aoe: 42, sustain: 82, mitigation: 24, safety: 9 },
        pressureTargets: { singleTarget: 132, aoe: 44, sustain: 78, safety: 34 },
        pressureGaps: { singleTarget: 24, aoe: 2, sustain: 0, safety: 25 },
        weaknesses: { singleTarget: true, aoe: true, sustain: false, safety: true },
      };
      run.decisionLog = [
        { wave: 14, type: 'reward', name: '加特林', action: 'pick', cardId: 'gatling', fitScore: 15.4, fitHint: '补清场和攻速节奏' },
        { wave: 19, type: 'forge', name: '快刃', action: 'upgrade' },
        { wave: 19, type: 'rest', name: '战斗训练', action: 'train', fitScore: 8.1, fitHint: '输出缺口更明显，适合压缩 Boss 战时长。', decisionLabel: '可替代' },
      ];
      run.combatLog = [
        {
          type: 'boss_late_phase',
          wave: 20,
          waveKind: 'boss',
          waveLabel: '第 20 波 Boss 讨伐',
          time: 726,
          title: '首领进入终局弹幕',
          detail: '恶魔领主·混沌 被压到 38%，但弹幕密度也进入最高段。',
          tone: 'boss',
        },
        {
          type: 'heavy_hit',
          wave: 20,
          waveKind: 'boss',
          waveLabel: '第 20 波 Boss 讨伐',
          time: 729,
          title: '被瞄准连射命中',
          detail: '恶魔领主·混沌造成 31 伤害，剩余 49/128；这类命中会快速兑现安全网缺口。',
          tone: 'danger',
        },
        {
          type: 'low_hp',
          wave: 20,
          waveKind: 'boss',
          waveLabel: '第 20 波 Boss 讨伐',
          time: 731,
          title: '血线跌入危险区',
          detail: '连续弹幕后只剩 18/128，安全网缺口开始兑现。',
          tone: 'combat',
        },
      ];
      run.damageTaken = {
        total: 74,
        sources: {
          'boss_projectile:demon:aimed_burst': {
            key: 'boss_projectile:demon:aimed_burst',
            label: '瞄准连射',
            category: 'boss',
            sourceName: '恶魔领主·混沌',
            patternLabel: '瞄准连射',
            isBoss: true,
            amount: 46,
            hits: 2,
            lastWave: 20,
            lastTime: 729,
          },
          'projectile:archer': {
            key: 'projectile:archer',
            label: '弓箭手弹幕',
            category: 'projectile',
            sourceName: '弓箭手',
            amount: 18,
            hits: 2,
            lastWave: 20,
            lastTime: 701,
          },
          'melee:charger': {
            key: 'melee:charger',
            label: '冲锋者近身攻击',
            category: 'melee',
            sourceName: '冲锋者',
            amount: 10,
            hits: 1,
            lastWave: 20,
            lastTime: 713,
          },
        },
      };
      run.deathSummary = {
        reason: victory ? '已完成远征。' : 'Boss 讨伐失败：走位和弹幕处理还需优化。',
        waveLabel: victory ? '第 25 波 · 最终清算' : '第 20 波 Boss 讨伐',
        waveKind: 'boss',
        buildTip: victory ? '保留本轮输出节奏，下一次可以尝试更高风险的献祭路线。' : '安全网缺口过大，下次 Boss 前优先选择余烬护符或烟幕疾行。',
        pressure: run.buildAnalysis.pressure,
        pressureTargets: run.buildAnalysis.pressureTargets,
        pressureGaps: run.buildAnalysis.pressureGaps,
        lastDecisions: ['第14波 奖励：加特林', '第19波 锻造：快刃', '第19波 营火：战斗训练'],
        deckSize: run.player.deck.length,
        focus: '壁垒 / 速攻 / 暴击',
        gameTime: run.gameTime,
        kills: run.kills,
        extremes: run.extremes.length,
        combatLog: run.combatLog,
        damageTakenTotal: run.damageTaken.total,
        damageSources: Object.values(run.damageTaken.sources).map(source => ({
          ...source,
          percent: source.amount / Math.max(1, run.damageTaken.total),
        })),
      };
      run.state = victory ? 'victory' : 'gameover';
      state = 'result';
      hideOverlays();
      hud.style.display = 'none';
      tutorialBox.classList.add('hidden');
      showResult(Boolean(victory));
      return { state: run.state, title: gameoverTitle.textContent };
    },
  };
}

function resizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.floor(innerWidth * dpr), h = Math.floor(innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
  }
}
function getScale() {
  const portrait = canvas.height > canvas.width * 1.35;
  const baseScale = Math.min(canvas.width / 1280, canvas.height / 720);
  const portraitRatio = portrait ? canvas.height / Math.max(1, canvas.width) : 1;
  const portraitBias = portrait ? clamp((portraitRatio - 1.35) / 0.9, 0, 1) : 0;
  const scale = portrait ? baseScale * (1 + portraitBias * 0.16) : baseScale;
  const logicalWidth = canvas.width / scale;
  const logicalHeight = canvas.height / scale;
  const offsetX = (logicalWidth - 1280) / 2;
  const freeY = Math.max(0, logicalHeight - 720);
  const offsetY = portrait ? freeY * (0.32 - portraitBias * 0.08) : freeY / 2;
  return { scale, offsetX, offsetY };
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
enableDebugHooks();
showMenu();
requestAnimationFrame(loop);
