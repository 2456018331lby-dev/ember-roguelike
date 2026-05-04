import { createRun, updateRun, applyCardChoice, getPlayerStats, dash, restart } from './game_core.mjs';
import { sfxAttack, sfxCrit, sfxHit, sfxDeath, sfxEnemyDeath, sfxBossDeath, sfxDash, sfxPickup, sfxHeal, sfxRevive, sfxWaveComplete, sfxCardSelect, sfxExtreme, sfxBulletShot, sfxBulletHit, sfxCombo, startBGM, stopBGM, resumeAudio } from './audio.mjs';
import { getSave, recordRun, completeTutorial, selectCharacter as saveSelectChar, getMetaBonuses, buyUpgrade, getUpgradeCost } from './save.mjs';
import { getCharacter, getAllCharacters, CHARACTERS } from './characters.mjs';

// ============================================================
// 余烬 Ember - 渲染 + UI + 输入 v5
// ============================================================

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');

// ---- DOM refs ----
const menuEl = document.querySelector('#menu');
const rewardEl = document.querySelector('#reward');
const gameoverEl = document.querySelector('#gameover');
const choicesEl = document.querySelector('#choices');
const hpBar = document.querySelector('#hpBar');
const hpText = document.querySelector('#hpText');
const waveText = document.querySelector('#waveText');
const scoreText = document.querySelector('#scoreText');
const comboText = document.querySelector('#comboText');
const statsText = document.querySelector('#statsText');
const messageLog = document.querySelector('#messageLog');
const finalStats = document.querySelector('#finalStats');
const gameoverTitle = document.querySelector('#gameoverTitle');
const joystick = document.querySelector('#joystick');
const knob = document.querySelector('#knob');
const waveSplash = document.querySelector('#waveSplash');
const dashIndicator = document.querySelector('#dashIndicator');
const barrierBar = document.querySelector('#barrierBar');
const doomTimer = document.querySelector('#doomTimer');
const doomTime = document.querySelector('#doomTime');
const hud = document.querySelector('#hud');
const metaBtn = document.querySelector('#metaBtn');
const codexBtn = document.querySelector('#codexBtn');
const metaPreview = document.querySelector('#metaPreview');

let run = null;
let last = performance.now();
let input = { x: 0, y: 0 };
let prevWave = 0;
let gameTime = 0;
let ambientParticles = [];
let tutorialStep = 0;
let tutorialTimer = 0;
let tutorialActive = false;
let selectedCharId = 'warrior';
let screenState = 'menu'; // menu | char_select | playing

// ---- 环境粒子 ----
function initAmbient() {
  ambientParticles = [];
  for (let i = 0; i < 55; i++) {
    ambientParticles.push({
      x: Math.random() * 1280, y: Math.random() * 720,
      size: Math.random() * 2.5 + 0.3, speed: Math.random() * 12 + 4,
      alpha: Math.random() * 0.22 + 0.03, phase: Math.random() * Math.PI * 2,
    });
  }
}

// ============================================================
// 游戏启动
// ============================================================
function startGame(seed = Date.now()) {
  resumeAudio();
  const ch = getCharacter(selectedCharId);
  run = createRun(seed, ch);
  prevWave = 0; gameTime = 0;
  screenState = 'playing';
  tutorialStep = 0; tutorialTimer = 0;
  const save = getSave();
  tutorialActive = !save.tutorialDone;
  hideAll();
  hud.style.display = 'block';
  startBGM();
  last = performance.now();
}

function hideAll() {
  menuEl.classList.add('hidden');
  rewardEl.classList.add('hidden');
  gameoverEl.classList.add('hidden');
  const charSel = document.querySelector('#charSelect');
  if (charSel) charSel.classList.add('hidden');
}

// ============================================================
// 角色选择界面
// ============================================================
function showCharSelect() {
  hideAll();
  const save = getSave();
  let sel = document.querySelector('#charSelect');
  if (!sel) {
    sel = document.createElement('div');
    sel.id = 'charSelect';
    sel.className = 'overlay';
    document.body.appendChild(sel);
  }
  const chars = getAllCharacters();
  let html = `<div class="panel" style="max-width:900px"><h2 style="color:#ffd58a;margin:0 0 8px">选择角色</h2><p style="color:#8c7d6d;margin:0 0 24px">每个角色有不同的起始属性和卡牌</p><div class="char-grid">`;
  for (const ch of chars) {
    const unlocked = save.unlockedCharacters.includes(ch.id);
    const selected = ch.id === selectedCharId;
    html += `
      <div class="char-card ${selected ? 'char-selected' : ''} ${unlocked ? '' : 'char-locked'}" data-char="${ch.id}" ${unlocked ? '' : 'style="opacity:0.45;pointer-events:none"'}>
        <div class="char-icon" style="background:${ch.color}">
          ${unlocked ? ch.name[0] : '🔒'}
        </div>
        <div class="char-info">
          <div class="char-name">${ch.name}</div>
          <div class="char-sub">${ch.subtitle}</div>
          <div class="char-desc">${ch.desc}</div>
          <div class="char-stats-line">❤${ch.baseHp} ⚡${Math.round(ch.baseSpeed)} ⚔${ch.baseAttack} 🕐${ch.baseAttackCooldown}s</div>
          ${!unlocked ? `<div class="char-unlock">${ch.unlockDesc}</div>` : ''}
        </div>
      </div>`;
  }
  html += `</div><div style="margin-top:24px;display:flex;gap:12px;justify-content:center">
    <button class="btn-primary" id="charStartBtn">⚔ 开始战斗</button>
    <button class="btn-ghost" id="charBackBtn">返回</button>
  </div></div>`;
  sel.innerHTML = html;
  sel.classList.remove('hidden');
  // events
  sel.querySelectorAll('.char-card:not(.char-locked)').forEach(el => {
    el.addEventListener('click', () => {
      selectedCharId = el.dataset.char;
      saveSelectChar(selectedCharId);
      sel.querySelectorAll('.char-card').forEach(c => c.classList.remove('char-selected'));
      el.classList.add('char-selected');
    });
  });
  sel.querySelector('#charStartBtn').addEventListener('click', () => startGame());
  sel.querySelector('#charBackBtn').addEventListener('click', () => { sel.classList.add('hidden'); showMenu(); });
}

// ============================================================
// 主菜单
// ============================================================
function showMenu() {
  hideAll();
  screenState = 'menu';
  hud.style.display = 'none';
  stopBGM();
  const save = getSave();
  const statsEl = menuEl.querySelector('.menu-stats');
  if (statsEl) {
    statsEl.innerHTML = `🏆 最高分 ${save.bestScore} · 最远第 ${save.bestWave} 波 · 总击杀 ${save.totalKills}`;
  }
  if (metaPreview) {
    const upgradeCount = Object.values(save.metaUpgrades || {}).reduce((a, b) => a + b, 0);
    metaPreview.textContent = `余烬点 ${save.emberCurrency} · 永久升级 ${upgradeCount} 项`;
  }
  menuEl.classList.remove('hidden');
}

function showMetaPanel() {
  hideAll();
  let panel = document.querySelector('#metaPanel');
  const save = getSave();
  const bonuses = getMetaBonuses();
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'metaPanel';
    panel.className = 'overlay';
    document.body.appendChild(panel);
  }
  const upgrades = [
    ['hpBoost', '生命强化', `+${bonuses.hpBoost} 最大生命`],
    ['attackBoost', '攻击强化', `+${bonuses.attackBoost} 攻击`],
    ['speedBoost', '速度强化', `+${bonuses.speedBoost} 移速`],
    ['rerollCount', '重随强化', `+${bonuses.rerollCount} 次重随`],
    ['startEmber', '开局赏金', `+${bonuses.startEmber} 初始分数`],
    ['potionDrop', '恢复掉率', `+${Math.round(bonuses.potionDrop * 100)}% 掉率`],
  ];
  panel.innerHTML = `<div class="panel" style="max-width:900px"><h2 style="color:#ffd58a;margin:0 0 8px">⛩ 余烬之炉</h2><p style="color:#8c7d6d;margin:0 0 18px">消耗余烬点购买永久升级</p><div style="font-size:18px;color:#ffd58a;margin-bottom:14px">余烬点：${save.emberCurrency}</div><div class="meta-grid">${upgrades.map(([k,n,d]) => { const cost = getUpgradeCost(k); const lvl = save.metaUpgrades[k] || 0; return `<div class="meta-card"><div class="meta-name">${n} <span>Lv.${lvl}</span></div><div class="meta-desc">${d}</div><div class="meta-cost">${cost === null ? '已满级' : `消耗 ${cost}`}</div><button class="btn-primary meta-buy" data-upg="${k}" ${cost === null || save.emberCurrency < cost ? 'disabled' : ''}>升级</button></div>`; }).join('')}</div><div style="margin-top:20px"><button id="metaBackBtn" class="btn-ghost">返回菜单</button></div></div>`;
  panel.classList.remove('hidden');
  panel.querySelectorAll('.meta-buy').forEach(btn => btn.addEventListener('click', () => {
    const res = buyUpgrade(btn.dataset.upg);
    if (res.ok) showMetaPanel();
  }));
  panel.querySelector('#metaBackBtn').addEventListener('click', () => { panel.classList.add('hidden'); showMenu(); });
}

function showCodexPanel() {
  hideAll();
  let panel = document.querySelector('#codexPanel');
  const save = getSave();
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'codexPanel';
    panel.className = 'overlay';
    document.body.appendChild(panel);
  }
  panel.innerHTML = `<div class="panel" style="max-width:900px"><h2 style="color:#ffd58a;margin:0 0 8px">📘 图鉴</h2><p style="color:#8c7d6d;margin:0 0 18px">已发现的角色、成就与协同</p><div class="codex-section"><h3>角色</h3><div>${save.unlockedCharacters.join('、') || '无'}</div></div><div class="codex-section"><h3>成就</h3><div>${(save.achievements || []).join('、') || '无'}</div></div><div class="codex-section"><h3>协同图鉴</h3><div>${(save.discoveredSynergies || []).join('、') || '尚未发现'}</div></div><div style="margin-top:20px"><button id="codexBackBtn" class="btn-ghost">返回菜单</button></div></div>`;
  panel.classList.remove('hidden');
  panel.querySelector('#codexBackBtn').addEventListener('click', () => { panel.classList.add('hidden'); showMenu(); });
}

// ---- 按钮绑定 ----
document.querySelector('#startBtn').addEventListener('click', () => {
  resumeAudio();
  showCharSelect();
});
metaBtn?.addEventListener('click', () => { resumeAudio(); showMetaPanel(); });
codexBtn?.addEventListener('click', () => { resumeAudio(); showCodexPanel(); });
document.querySelector('#restartBtn').addEventListener('click', () => startGame());
document.querySelector('#backMenuBtn').addEventListener('click', () => showMenu());

// ---- PWA ----
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  const btn = document.querySelector('#installBtn');
  btn.hidden = false;
  btn.onclick = async () => { await e.prompt(); btn.hidden = true; };
});

// ============================================================
// 输入系统
// ============================================================
const keys = new Set();
window.addEventListener('keydown', e => {
  keys.add(e.key.toLowerCase());
  if ((e.key === ' ' || e.key === 'Shift') && run && run.state === 'playing') {
    e.preventDefault(); dash(run, input.x || 0, input.y || 0.01);
  }
  if (e.key === 'Escape' && run && run.state === 'playing') {
    // 暂停/恢复用 gameover overlay 模拟
  }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

function keyInput() {
  let x = 0, y = 0;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('w') || keys.has('arrowup')) y -= 1;
  if (keys.has('s') || keys.has('arrowdown')) y += 1;
  if (x || y) input = { x, y };
}

// 摇杆
let joyActive = false, joyId = null;
function setJoy(cx, cy) {
  const r = joystick.getBoundingClientRect();
  const jCx = r.left + r.width / 2, jCy = r.top + r.height / 2;
  let dx = cx - jCx, dy = cy - jCy;
  const mx = r.width * 0.34, len = Math.hypot(dx, dy);
  if (len > mx) { dx = dx / len * mx; dy = dy / len * mx; }
  knob.style.left = `${38 + dx}px`; knob.style.top = `${38 + dy}px`;
  input = { x: dx / mx, y: dy / mx };
}
function resetJoy() { knob.style.left = '38px'; knob.style.top = '38px'; input = { x: 0, y: 0 }; joyActive = false; }
joystick.addEventListener('pointerdown', e => { joyActive = true; joyId = e.pointerId; joystick.setPointerCapture(e.pointerId); setJoy(e.clientX, e.clientY); });
joystick.addEventListener('pointermove', e => { if (joyActive && e.pointerId === joyId) setJoy(e.clientX, e.clientY); });
joystick.addEventListener('pointerup', resetJoy);
joystick.addEventListener('pointercancel', resetJoy);

// 双击冲刺
let lastTap = 0;
canvas.addEventListener('pointerdown', e => {
  const now = Date.now();
  if (now - lastTap < 300 && run && run.state === 'playing') dash(run, e.clientX - 640, e.clientY - 360 || 0.01);
  lastTap = now;
});

// ============================================================
// 主循环
// ============================================================
function loop(now) {
  const dt = Math.min(0.04, (now - last) / 1000);
  last = now; gameTime += dt;
  resizeCanvas(); keyInput();

  if (run && screenState === 'playing') {
    const before = run.state;
    updateRun(run, input, dt);
    processAudioEvents();
    if (run.state === 'wave_transition' && run.wave !== prevWave) { showWaveSplash(run.wave); prevWave = run.wave; }
    if (before !== run.state) onStateChange();
    updateHud();
    updateTutorial(dt);
  }

  for (const p of ambientParticles) {
    p.y -= p.speed * dt; p.x += Math.sin(gameTime * 0.7 + p.phase) * 6 * dt;
    if (p.y < -10) { p.y = 730; p.x = Math.random() * 1280; }
  }

  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ============================================================
// 音效事件
// ============================================================
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
  if (run.combo > 2 && run.combo % 5 === 0) sfxCombo(run.combo);
  run.events = [];
}

// ============================================================
// 新手引导
// ============================================================
const TUTORIAL_STEPS = [
  { text: '用左下摇杆移动角色', condition: (r) => r.gameTime > 3 },
  { text: '双击屏幕或按空格冲刺闪避', condition: (r) => r.dashCooldown > 0 || r.gameTime > 10 },
  { text: '自动攻击最近的敌人', condition: (r) => r.kills > 0 },
  { text: '击杀敌人掉落恢复球和余烬碎片', condition: (r) => r.kills > 3 },
  { text: '每波结束后选择卡牌奖励', condition: (r) => r.state === 'reward' },
  { text: '🔥 教程完成！祝你好运', condition: (r) => true },
];

function updateTutorial(dt) {
  if (!tutorialActive) return;
  tutorialTimer += dt;
  if (tutorialStep < TUTORIAL_STEPS.length && TUTORIAL_STEPS[tutorialStep].condition(run)) {
    tutorialStep++;
    tutorialTimer = 0;
    if (tutorialStep >= TUTORIAL_STEPS.length) {
      tutorialActive = false;
      completeTutorial();
    }
  }
}

function drawTutorial() {
  if (!tutorialActive || tutorialStep >= TUTORIAL_STEPS.length) return;
  const text = TUTORIAL_STEPS[tutorialStep].text;
  const alpha = Math.min(1, tutorialTimer * 2) * Math.min(1, Math.max(0, 5 - tutorialTimer) * 0.5 + 0.5);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(200, 30, 880, 50);
  ctx.fillStyle = '#ffd58a';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 640, 62);
  ctx.restore();
}

// ============================================================
// 状态变化
// ============================================================
function onStateChange() {
  if (!run) return;
  if (run.state === 'reward') { showReward(); sfxWaveComplete(); stopBGM(); }
  if (run.state === 'gameover') { showGameOver(false); sfxDeath(); stopBGM(); }
  if (run.state === 'victory') { showGameOver(true); sfxWaveComplete(); stopBGM(); }
}

function showWaveSplash(n) {
  if (!waveSplash) return;
  waveSplash.textContent = n % 5 === 0 ? `⚔ BOSS 第 ${n} 波 ⚔` : `第 ${n} 波`;
  waveSplash.className = 'wave-splash show';
  setTimeout(() => { waveSplash.className = 'wave-splash hidden'; }, 2000);
}

function showReward() {
  choicesEl.innerHTML = '';
  for (const card of run.rewardChoices) {
    const el = document.createElement('button');
    el.className = `card ${card.rarity || 'common'}`;
    const sacNames = { speed: '移速', attack: '攻击', health: '生命', attack_speed: '攻速' };
    const sacText = card.sacrifice ? `${sacNames[card.sacrifice.stat] ?? card.sacrifice.stat} -${(card.sacrifice.amount * 100).toFixed(0)}%` : '无';
    el.innerHTML = `
      <div><div class="type">${typeIcon(card.type)} ${typeName(card.type)} · ${rarityName(card.rarity)}</div>
      <h3>${card.name}</h3><div class="desc">${card.desc ?? ''}</div>
      <div class="stats-line">${cardStatsLine(card)}</div></div>
      <div class="cost">☠ 代价：${sacText}</div>
      ${run.extremes.length > 0 ? `<div class="combo-hint">🔥 ${run.extremes.join(' + ')}</div>` : ''}`;
    el.onclick = () => { sfxCardSelect(); applyCardChoice(run, card); rewardEl.classList.add('hidden'); startBGM(); };
    choicesEl.appendChild(el);
  }
  rewardEl.classList.remove('hidden');
}

function showGameOver(victory) {
  const save = recordRun(run.score, run.wave, run.kills, run.maxCombo, victory, run.characterId);
  gameoverTitle.textContent = victory ? '🏆 余烬永不熄灭' : '余烬熄灭';
  const best = save.bestScore;
  finalStats.innerHTML = `
    <div class="final-stat">波次 <span>${run.wave} / ${run.totalWaves}</span></div>
    <div class="final-stat">击杀 <span>${run.kills}</span></div>
    <div class="final-stat">分数 <span>${Math.floor(run.score)}</span> ${run.score >= best ? '🏆 新纪录!' : ''}</div>
    <div class="final-stat">最高连击 <span>${run.maxCombo}</span></div>
    <div class="final-stat">卡牌 <span>${run.player.deck.length}</span></div>
    <div class="final-stat">极端化 <span>${run.extremes.join('、') || '无'}</span></div>
    <div class="final-stat">协同 <span>${run.synergies?.join('、') || '无'}</span></div>
    <div class="final-stat">复活 <span>${run.reviveUsed ? '已使用' : '未使用'}</span></div>`;
  gameoverEl.classList.remove('hidden');
  // 检查新解锁
  const newUnlocks = [];
  const oldSave = getSave();
  if (victory && oldSave.unlockedCharacters.length > save.unlockedCharacters.length - 1) newUnlocks.push('法师');
  if (save.totalRuns >= 5) newUnlocks.push('游侠');
  if (save.bestWave >= 15) newUnlocks.push('死灵法师');
}

function updateHud() {
  const stats = getPlayerStats(run);
  const hpPct = Math.max(0, Math.min(1, run.player.hp / stats.maxHp));
  hpBar.style.width = `${hpPct * 100}%`;
  hpBar.style.background = hpPct < 0.2 ? 'linear-gradient(90deg,#b71c1c,#e53935)' : hpPct < 0.45 ? 'linear-gradient(90deg,#e65100,#ff9800)' : 'linear-gradient(90deg,#ff6d00,#ffd58a)';
  hpText.textContent = `${Math.ceil(Math.max(0, run.player.hp))} / ${stats.maxHp}`;
  if (barrierBar) { barrierBar.style.display = run.player.barrier > 0 ? 'block' : 'none'; barrierBar.style.width = `${Math.min(100, run.player.barrier / stats.maxHp * 100)}%`; }
  waveText.textContent = `第 ${run.wave} / ${run.totalWaves} 波`;
  scoreText.textContent = `分数 ${Math.floor(run.score)} · 击杀 ${run.kills}`;
  if (run.combo > 2) { comboText.textContent = `x${run.combo}`; comboText.style.display = 'inline'; } else comboText.style.display = 'none';
  if (stats.doomTimer > 0) { const rem = Math.max(0, stats.doomTimer - run.gameTime); doomTimer.style.display = 'flex'; doomTime.textContent = Math.ceil(rem); doomTimer.style.color = rem < 10 ? '#ff1744' : '#ffd58a'; } else doomTimer.style.display = 'none';
  if (dashIndicator) { const pct = Math.max(0, 1 - run.dashCooldown / 1.8); const ring = dashIndicator.querySelector('.dash-ring'); if (ring) ring.style.strokeDashoffset = `${100 * (1 - pct)}`; dashIndicator.style.opacity = pct >= 1 ? '1' : '0.5'; }
  let h = `⚔ ${Math.round(stats.attack * stats.damageMultiplier)} · ${(1 / stats.attackCooldown).toFixed(1)}/s`;
  if (stats.critChance > 0) h += ` · 暴击${(stats.critChance * 100).toFixed(0)}%`;
  if (stats.lifesteal > 0) h += ` · 吸血${(stats.lifesteal * 100).toFixed(0)}%`;
  if (stats.thorns > 0) h += ` · 反伤${stats.thorns}`;
  if (stats.dodgeChance > 0) h += ` · 闪避${(stats.dodgeChance * 100).toFixed(0)}%`;
  if (stats.chain > 0) h += ` · 链击${stats.chain}`;
  h += ` · 🛡${stats.armor}`;
  if (run.extremes.length > 0) h += `<br>🔥 ${run.extremes.join(' + ')}`;
  if (run.synergies?.length) h += `<br>✨ ${run.synergies.join(' · ')}`;
  statsText.innerHTML = h;
  messageLog.innerHTML = run.messages.slice(0, 3).map(m => `<div>${m}</div>`).join('');
}

// ============================================================
// 渲染系统
// ============================================================
function draw() {
  const s = getScale();
  ctx.save(); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.scale(s.scale, s.scale);
  let sx = 0, sy = 0;
  if (run && run.screenShake > 0.01) { sx = (Math.random() - 0.5) * run.screenShake * 20; sy = (Math.random() - 0.5) * run.screenShake * 20; }
  ctx.translate(s.offsetX + sx, s.offsetY + sy);
  drawArena();
  if (run) {
    drawTelegraphs();
    drawPickups();
    drawProjectiles();
    drawEnemies();
    drawPlayer();
    drawParticles();
    drawMinimap();
    drawTutorial();
    if (run.screenFlash > 0.01) { ctx.globalAlpha = run.screenFlash * 0.4; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1280, 720); ctx.globalAlpha = 1; }
  }
  ctx.restore();
}

// ---- 竞技场 ----
function drawArena() {
  const grd = ctx.createRadialGradient(640, 360, 30, 640, 360, 780);
  grd.addColorStop(0, '#1e1530'); grd.addColorStop(0.4, '#140e1f'); grd.addColorStop(1, '#08060d');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 1280, 720);
  // 石砖
  ctx.globalAlpha = 0.035; ctx.strokeStyle = '#a08060'; ctx.lineWidth = 1;
  for (let r = 0; r < 12; r++) for (let c = 0; c < 21; c++) {
    const x = c * 64 + (r % 2 ? 32 : 0) - 32, y = r * 64 - 16;
    ctx.strokeRect(x + 2, y + 2, 60, 60);
  }
  ctx.globalAlpha = 1;
  // 环境粒子
  for (const p of ambientParticles) { ctx.globalAlpha = p.alpha; ctx.fillStyle = '#ffd58a'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  // 边框
  ctx.save(); ctx.strokeStyle = '#3a2510'; ctx.lineWidth = 8; ctx.strokeRect(26, 31, 1228, 658);
  ctx.strokeStyle = '#ff6d00'; ctx.lineWidth = 3; ctx.shadowColor = '#ff6d00'; ctx.shadowBlur = 14;
  ctx.strokeRect(30, 35, 1220, 650); ctx.shadowBlur = 0; ctx.restore();
  // 火把
  for (const [cx, cy] of [[35, 40], [1245, 40], [35, 680], [1245, 680]]) drawTorch(cx, cy);
  // 墙影
  const sg1 = ctx.createLinearGradient(30, 35, 30, 72); sg1.addColorStop(0, 'rgba(0,0,0,0.3)'); sg1.addColorStop(1, 'transparent');
  ctx.fillStyle = sg1; ctx.fillRect(30, 35, 1220, 37);
}

function drawTorch(cx, cy) {
  const t = gameTime * 3;
  ctx.fillStyle = '#5a3a10'; ctx.fillRect(cx - 4, cy - 2, 8, 8);
  for (let i = 0; i < 3; i++) {
    const fh = 14 + Math.sin(t + i * 2) * 5, fw = 4 + Math.sin(t * 1.3 + i) * 2;
    ctx.globalAlpha = 0.5 - i * 0.12;
    ctx.fillStyle = ['#ff6d00', '#ffab00', '#ffd54f'][i];
    ctx.beginPath(); ctx.ellipse(cx + Math.sin(t + i) * 1.5, cy - fh / 2 - i * 3, fw, fh / 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const glow = ctx.createRadialGradient(cx, cy - 8, 0, cx, cy - 8, 50);
  glow.addColorStop(0, 'rgba(255,109,0,0.1)'); glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow; ctx.fillRect(cx - 50, cy - 58, 100, 100);
}

// ---- 预警 ----
function drawTelegraphs() {
  for (const tg of run.telegraphs) {
    const a = Math.max(0, tg.life / tg.maxLife);
    ctx.save(); ctx.globalAlpha = a * 0.5; ctx.fillStyle = tg.color || 'rgba(255,80,80,0.25)';
    ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.radius * (1 - a * 0.3), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,80,80,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.radius * (1 - a * 0.3), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

// ---- 弹幕 ----
function drawProjectiles() {
  for (const p of run.projectiles) {
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.globalAlpha = 0.25; ctx.fillStyle = p.color || '#ff9800';
    ctx.beginPath(); ctx.arc(-p.vx * 0.015, -p.vy * 0.015, p.radius * 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, p.radius * 2);
    pg.addColorStop(0, '#fff'); pg.addColorStop(0.4, p.color || '#ff9800'); pg.addColorStop(1, 'transparent');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, p.radius * 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color || '#ff9800'; ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ---- 拾取物 ----
function drawPickups() {
  for (const p of run.pickups) {
    ctx.save(); ctx.translate(p.x, p.y);
    const pulse = 1 + Math.sin(gameTime * 5) * 0.12, bob = Math.sin(gameTime * 3 + p.x * 0.1) * 3;
    ctx.translate(0, bob); ctx.scale(pulse, pulse);
    if (p.type === 'heal') {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 13);
      g.addColorStop(0, '#a5d6a7'); g.addColorStop(0.6, '#43a047'); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', 0, 1);
    } else {
      ctx.fillStyle = '#ffd58a'; ctx.globalAlpha = 0.85;
      drawStar(0, 0, 5, 11, 5); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

// ---- 玩家 ----
function drawPlayer() {
  const p = run.player, stats = getPlayerStats(run), t = gameTime;
  ctx.save(); ctx.translate(p.x, p.y);
  if (run.screenFlash > 0.1) { ctx.globalAlpha = run.screenFlash * 0.3; ctx.fillStyle = '#ff1744'; ctx.beginPath(); ctx.arc(0, 0, p.radius + 12, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  if (run.dashTimer > 0) { ctx.globalAlpha = 0.2; ctx.fillStyle = '#48b7ff'; ctx.beginPath(); ctx.arc(0, 0, p.radius + 18, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  const alpha = p.invuln > 0 ? 0.45 + Math.sin(t * 14) * 0.45 : 1;
  ctx.globalAlpha = alpha;
  if (p.barrier > 0) { ctx.save(); ctx.strokeStyle = '#00bcd4'; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.3 + Math.sin(t * 4) * 0.15; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.arc(0, 0, p.radius + 11, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
  // 影子
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(0, p.radius + 5, p.radius * 0.75, 4, 0, 0, Math.PI * 2); ctx.fill();
  drawPlayerSprite(0, 0, p.radius, t, stats);
  ctx.restore();
  if (stats.regen > 0) { ctx.save(); ctx.globalAlpha = 0.1 + Math.sin(t * 3) * 0.06; ctx.strokeStyle = '#66bb6a'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]); ctx.lineDashOffset = t * 20; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 20 + Math.sin(t * 2) * 3, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
}

function drawPlayerSprite(x, y, r, t, stats) {
  const breathe = Math.sin(t * 2.5) * 1.5;
  const ch = getCharacter(run.characterId || 'warrior');
  // 光晕
  const og = ctx.createRadialGradient(x, y, r - 4, x, y, r + 14);
  og.addColorStop(0, `${ch.color}20`); og.addColorStop(1, 'transparent');
  ctx.fillStyle = og; ctx.beginPath(); ctx.arc(x, y, r + 14, 0, Math.PI * 2); ctx.fill();
  // 身体
  const bg = ctx.createRadialGradient(x - 2, y - 3, 0, x, y, r);
  bg.addColorStop(0, adjustColor(ch.color, 60)); bg.addColorStop(0.55, ch.color); bg.addColorStop(1, ch.accentColor);
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x, y, r - 1 + breathe * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ch.accentColor; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r - 1 + breathe * 0.3, 0, Math.PI * 2); ctx.stroke();
  // 斗篷
  ctx.fillStyle = ch.accentColor; ctx.globalAlpha = 0.55;
  ctx.beginPath(); ctx.moveTo(x - r * 0.7, y - r * 0.2);
  ctx.quadraticCurveTo(x - r * 1.2, y + r * 0.5, x - r * 0.5, y + r * 0.9 + Math.sin(t * 3) * 2);
  ctx.lineTo(x - r * 0.1, y + r * 0.3); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  // 面罩
  ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.ellipse(x, y - r * 0.25, r * 0.55, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  // 眼睛
  for (const ex of [-4, 4]) {
    const eg = ctx.createRadialGradient(x + ex, y - r * 0.25, 0, x + ex, y - r * 0.25, 7);
    eg.addColorStop(0, adjustColor(ch.color, 40)); eg.addColorStop(0.5, ch.color); eg.addColorStop(1, 'transparent');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(x + ex, y - r * 0.25, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 4, y - r * 0.25 - 1, 2, 0, Math.PI * 2); ctx.arc(x + 4, y - r * 0.25 - 1, 2, 0, Math.PI * 2); ctx.fill();
  // 武器
  const wa = Math.sin(t * 8) * 0.3 + 0.5;
  ctx.save(); ctx.translate(x + r * 0.5, y - r * 0.1); ctx.rotate(wa);
  ctx.fillStyle = '#b0bec5'; ctx.fillRect(-1.5, -15, 3, 15);
  ctx.fillStyle = '#cfd8dc'; ctx.beginPath(); ctx.moveTo(-2.5, -15); ctx.lineTo(0, -21); ctx.lineTo(2.5, -15); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#795548'; ctx.fillRect(-3.5, 0, 7, 3);
  if (stats.attackCooldown < 0.3) { ctx.globalAlpha = 0.35 + Math.sin(t * 10) * 0.2; ctx.fillStyle = '#ffd58a'; ctx.fillRect(-2, -15, 4, 15); ctx.globalAlpha = 1; }
  ctx.restore();
  // 脚
  const wp = Math.sin(t * 10) * 3;
  ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.arc(x - 4, y + r * 0.7 + wp, 3, 0, Math.PI * 2); ctx.arc(x + 4, y + r * 0.7 - wp, 3, 0, Math.PI * 2); ctx.fill();
}

// ---- 敌人 ----
function drawEnemies() {
  for (const e of run.enemies) {
    ctx.save(); ctx.translate(e.x, e.y);
    if (e.phased) ctx.globalAlpha = 0.25;
    const flash = e.hitFlash > 0.1, t = gameTime;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(0, e.radius + 4, e.radius * 0.65, 3, 0, 0, Math.PI * 2); ctx.fill();
    if (e.isBoss) { ctx.save(); ctx.globalAlpha = 0.15; const bg = ctx.createRadialGradient(0, 0, e.radius * 0.5, 0, 0, e.radius + 28); bg.addColorStop(0, 'rgba(255,0,0,0.15)'); bg.addColorStop(1, 'transparent'); ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, e.radius + 28, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = e.color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.25; for (let i = 0; i < 4; i++) { const a = t * 1.2 + i * Math.PI / 2; ctx.beginPath(); ctx.arc(Math.cos(a) * (e.radius + 16), Math.sin(a) * (e.radius + 16), 5, 0, Math.PI * 2); ctx.stroke(); } ctx.restore(); }
    drawEnemySprite(e, flash, t);
    if (e.hp < e.maxHp) { const bw = e.radius * 2.6, bh = e.isBoss ? 7 : 4, by = -e.radius - 14; ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(-bw / 2 - 1, by - 1, bw + 2, bh + 2); const pct = Math.max(0, e.hp / e.maxHp); ctx.fillStyle = pct > 0.5 ? '#66bb6a' : pct > 0.25 ? '#ffa726' : '#ef5350'; ctx.fillRect(-bw / 2, by, bw * pct, bh); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(-bw / 2, by, bw * pct, bh / 2); }
    if (e.isBoss) { ctx.fillStyle = '#ffd58a'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.fillText(e.name, 0, -e.radius - 20); ctx.shadowBlur = 0; ctx.fillStyle = '#b0bec5'; ctx.font = '11px sans-serif'; ctx.fillText(`${Math.ceil(e.hp)} / ${e.maxHp}`, 0, -e.radius - 8); }
    if (e.dotDamage > 0) { ctx.globalAlpha = 0.25 + Math.sin(t * 8) * 0.2; ctx.strokeStyle = '#76ff03'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.lineDashOffset = t * 20; ctx.beginPath(); ctx.arc(0, 0, e.radius + 5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    if (e.slowTimer > 0) { ctx.globalAlpha = 0.25; ctx.fillStyle = '#80deea'; ctx.beginPath(); ctx.arc(0, 0, e.radius + 5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
  }
}

function drawEnemySprite(e, flash, t) {
  const r = e.radius, base = flash ? '#ffffff' : e.color, dark = flash ? '#ddd' : adjustColor(e.color, -40);
  switch (e.behavior) {
    case 'chase': case 'slow_chase': {
      const sq = 1 + Math.sin(t * 6 + e.x * 0.1) * 0.08;
      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r); g.addColorStop(0, flash ? '#fff' : adjustColor(e.color, 30)); g.addColorStop(1, dark);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r * sq, r / sq, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-r * 0.25, -r * 0.15, r * 0.18, r * 0.22, 0, 0, Math.PI * 2); ctx.ellipse(r * 0.25, -r * 0.15, r * 0.18, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      const toP = Math.atan2(run.player.y - e.y, run.player.x - e.x); ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(-r * 0.25 + Math.cos(toP) * r * 0.05, -r * 0.15 + Math.sin(toP) * r * 0.05, r * 0.08, 0, Math.PI * 2); ctx.arc(r * 0.25 + Math.cos(toP) * r * 0.05, -r * 0.15 + Math.sin(toP) * r * 0.05, r * 0.08, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'zigzag': {
      const wf = Math.sin(t * 12) * 0.5; ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.6, r, 0, 0, Math.PI * 2); ctx.fill();
      for (const side of [-1, 1]) { ctx.save(); ctx.rotate(side * (-0.4 + wf * side)); ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(side * r * 0.3, 0); ctx.quadraticCurveTo(side * r * 1.5, -r * 0.8, side * r * 1.3, r * 0.2); ctx.lineTo(side * r * 0.3, r * 0.3); ctx.closePath(); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.2, 2.5, 0, Math.PI * 2); ctx.arc(r * 0.2, -r * 0.2, 2.5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'ranged': case 'support': case 'summoner': {
      ctx.fillStyle = base; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.5; ctx.stroke();
      if (e.behavior === 'ranged') { ctx.fillStyle = adjustColor(e.color, -20); ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.65, Math.PI, 0); ctx.fill(); const aim = Math.atan2(run.player.y - e.y, run.player.x - e.x); ctx.save(); ctx.rotate(aim); ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 0.9, -0.6, 0.6); ctx.stroke(); ctx.restore(); }
      if (e.behavior === 'support') { ctx.fillStyle = '#fff'; ctx.fillRect(-1.5, -r * 0.35, 3, r * 0.7); ctx.fillRect(-r * 0.35, -1.5, r * 0.7, 3); }
      if (e.behavior === 'summoner') { const toP = Math.atan2(run.player.y - e.y, run.player.x - e.x); ctx.fillStyle = '#e1bee7'; ctx.beginPath(); ctx.ellipse(0, -r * 0.1, r * 0.4, r * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#4a148c'; ctx.beginPath(); ctx.arc(Math.cos(toP) * r * 0.1, -r * 0.1 + Math.sin(toP) * r * 0.1, r * 0.15, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'boss_fire': case 'boss_ice': case 'boss_chaos': {
      const bg = ctx.createRadialGradient(-r * 0.15, -r * 0.15, 0, 0, 0, r); bg.addColorStop(0, flash ? '#fff' : adjustColor(e.color, 30)); bg.addColorStop(1, dark);
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = adjustColor(e.color, -20); for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * r * 0.5, -r * 0.7); ctx.lineTo(sx * r * 0.3, -r * 1.3); ctx.lineTo(sx * r * 0.8, -r * 0.6); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.ellipse(-r * 0.25, -r * 0.1, r * 0.12, r * 0.08, 0, 0, Math.PI * 2); ctx.ellipse(r * 0.25, -r * 0.1, r * 0.12, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(-r * 0.25, -r * 0.1, r * 0.06, r * 0.06, 0, 0, Math.PI * 2); ctx.ellipse(r * 0.25, -r * 0.1, r * 0.06, r * 0.06, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, r * 0.15, r * 0.2, 0, Math.PI); ctx.stroke();
      break;
    }
    default: {
      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r); g.addColorStop(0, flash ? '#fff' : adjustColor(e.color, 25)); g.addColorStop(1, dark);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
}

// ---- 粒子 ----
function drawParticles() {
  for (const p of run.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.save(); ctx.globalAlpha = a;
    switch (p.type) {
      case 'slash': { ctx.translate(p.x, p.y); ctx.rotate(p.angle || 0); ctx.strokeStyle = p.isCrit ? '#ff0' : '#ffd58a'; ctx.lineWidth = p.isCrit ? 8 : 4; ctx.shadowColor = p.isCrit ? '#ff0' : '#ff6d00'; ctx.shadowBlur = p.isCrit ? 22 : 14; const sw = (1 - a) * Math.PI * 0.9 + 0.2; ctx.beginPath(); ctx.arc(0, 0, 32, -sw / 2, sw / 2); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = a; ctx.rotate(-(p.angle || 0)); ctx.fillStyle = p.isCrit ? '#ff0' : '#ffd58a'; ctx.font = `bold ${p.isCrit ? 32 : 22}px sans-serif`; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 6; ctx.fillText((p.isCrit ? '暴击! ' : '') + p.damage, 0, -34 - (1 - a) * 38); ctx.shadowBlur = 0; break; }
      case 'hit': { ctx.translate(p.x, p.y); ctx.fillStyle = '#ff1744'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 6; ctx.fillText(`-${p.damage}`, 0, -24 - (1 - a) * 48); ctx.shadowBlur = 0; break; }
      case 'heal': case 'lifesteal': case 'ember_pickup': { ctx.translate(p.x, p.y); ctx.fillStyle = { heal: '#66bb6a', lifesteal: '#ff4081', ember_pickup: '#ffd58a' }[p.type]; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.fillText(`+${p.value}`, 0, -(1 - a) * 40); ctx.shadowBlur = 0; break; }
      case 'dodge': { ctx.translate(p.x, p.y); ctx.fillStyle = '#00e5ff'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('闪避!', 0, -(1 - a) * 34); break; }
      case 'reflect': { ctx.translate(p.x, p.y); ctx.fillStyle = '#ff9800'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`反弹 ${p.value}`, 0, -(1 - a) * 28); break; }
      case 'death': { ctx.translate(p.x, p.y); ctx.fillStyle = p.color || '#f44336'; for (let i = 0; i < 8; i++) { const angle = (i / 8) * Math.PI * 2 + gameTime * 2; ctx.globalAlpha = a * 0.55; ctx.beginPath(); ctx.arc(Math.cos(angle) * (1 - a) * 38, Math.sin(angle) * (1 - a) * 38, 3 * a, 0, Math.PI * 2); ctx.fill(); } break; }
      case 'dash_trail': { ctx.translate(p.x, p.y); ctx.fillStyle = '#48b7ff'; ctx.globalAlpha = a * 0.25; ctx.beginPath(); ctx.arc(0, 0, (1 - a) * 55, 0, Math.PI * 2); ctx.fill(); break; }
      case 'revive': { ctx.translate(p.x, p.y); ctx.strokeStyle = '#ffd58a'; ctx.lineWidth = 6; ctx.shadowColor = '#ff6d00'; ctx.shadowBlur = 30; ctx.beginPath(); ctx.arc(0, 0, (1 - a) * 100, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; break; }
      case 'summon': { ctx.translate(p.x, p.y); ctx.fillStyle = '#9c27b0'; ctx.globalAlpha = a * 0.4; for (let i = 0; i < 6; i++) { const angle = (i / 6) * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(angle) * (1 - a) * 45, Math.sin(angle) * (1 - a) * 45, 4 * a, 0, Math.PI * 2); ctx.fill(); } break; }
      case 'melee_slash': { ctx.translate(p.x, p.y); ctx.rotate(p.angle || 0); ctx.strokeStyle = 'rgba(255,100,100,0.6)'; ctx.lineWidth = 3; const sw2 = (1 - a) * Math.PI * 0.6; ctx.beginPath(); ctx.arc(0, 0, p.radius || 30, -sw2 / 2, sw2 / 2); ctx.stroke(); break; }
      case 'bullet_hit': { ctx.translate(p.x, p.y); ctx.fillStyle = p.color || '#ff0'; ctx.globalAlpha = a * 0.5; ctx.beginPath(); ctx.arc(0, 0, (1 - a) * 12, 0, Math.PI * 2); ctx.fill(); break; }
      case 'shoot_flash': { ctx.translate(p.x, p.y); ctx.fillStyle = '#fff'; ctx.globalAlpha = a * 0.6; ctx.beginPath(); ctx.arc(0, 0, 8 * a, 0, Math.PI * 2); ctx.fill(); break; }
      case 'chain': { ctx.strokeStyle = '#ffd58a'; ctx.lineWidth = 2; ctx.globalAlpha = a * 0.6; ctx.beginPath(); ctx.moveTo(p.fromX, p.fromY); ctx.lineTo(p.x, p.y); ctx.stroke(); break; }
      case 'barrier_hit': { ctx.translate(p.x, p.y); ctx.fillStyle = '#00bcd4'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`-${p.value} 护盾`, 0, -(1 - a) * 28); break; }
      case 'self_damage': { ctx.translate(p.x, p.y); ctx.fillStyle = '#ff5722'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`自伤 -${p.value}`, 0, -(1 - a) * 28); break; }
      case 'dot': { ctx.translate(p.x, p.y); ctx.fillStyle = '#76ff03'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${p.value}`, 0, -(1 - a) * 22); break; }
    }
    ctx.restore();
  }
}

// ---- 小地图 ----
function drawMinimap() {
  const mx = 1280 - 140, my = 720 - 120, mw = 130, mh = 110;
  ctx.save(); ctx.globalAlpha = 0.5;
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#3a2510'; ctx.lineWidth = 1; ctx.strokeRect(mx, my, mw, mh);
  ctx.fillStyle = '#48b7ff'; ctx.beginPath(); ctx.arc(mx + (run.player.x / 1280) * mw, my + (run.player.y / 720) * mh, 3.5, 0, Math.PI * 2); ctx.fill();
  for (const e of run.enemies) { ctx.fillStyle = e.isBoss ? '#ffd58a' : '#ef5350'; ctx.beginPath(); ctx.arc(mx + (e.x / 1280) * mw, my + (e.y / 720) * mh, e.isBoss ? 3.5 : 1.8, 0, Math.PI * 2); ctx.fill(); }
  for (const p of run.pickups) { ctx.fillStyle = p.type === 'heal' ? '#66bb6a' : '#ffd58a'; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(mx + (p.x / 1280) * mw, my + (p.y / 720) * mh, 1.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// ---- 工具 ----
function drawStar(cx, cy, sp, or, ir) { let rot = -Math.PI / 2, step = Math.PI / sp; ctx.beginPath(); for (let i = 0; i < sp; i++) { ctx.lineTo(cx + Math.cos(rot) * or, cy + Math.sin(rot) * or); rot += step; ctx.lineTo(cx + Math.cos(rot) * ir, cy + Math.sin(rot) * ir); rot += step; } ctx.closePath(); ctx.fill(); }
function resizeCanvas() { const d = Math.min(2, devicePixelRatio || 1), w = Math.floor(innerWidth * d), h = Math.floor(innerHeight * d); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } }
function getScale() { const s = Math.min(canvas.width / 1280, canvas.height / 720); return { scale: s, offsetX: (canvas.width / s - 1280) / 2, offsetY: (canvas.height / s - 720) / 2 }; }
function typeIcon(t) { return { attack: '⚔', defense: '🛡', passive: '🔮', joker: '🃏', curse: '💀' }[t] ?? '?'; }
function typeName(t) { return { attack: '攻击', defense: '防御', passive: '被动', joker: '小丑', curse: '诅咒' }[t] ?? t; }
function rarityName(r) { return { common: '普通', rare: '精良', epic: '史诗', legendary: '传说' }[r] ?? r; }
function cardStatsLine(c) { const p = []; if (c.damage) p.push(`伤害+${c.damage}`); if (c.armorBonus) p.push(`护甲+${c.armorBonus}`); if (c.speedBonus) p.push(`移速+${c.speedBonus}`); if (c.critChance) p.push(`暴击+${(c.critChance*100).toFixed(0)}%`); if (c.lifesteal) p.push(`吸血${(c.lifesteal*100).toFixed(0)}%`); if (c.chain) p.push(`链击${c.chain}`); if (c.regen) p.push(`回血+${c.regen}/s`); if (c.barrier) p.push(`护盾+${c.barrier}`); if (c.damageMultiplier) p.push(`伤害x${c.damageMultiplier}`); if (c.dodgeChance) p.push(`闪避+${(c.dodgeChance*100).toFixed(0)}%`); if (c.thorns) p.push(`反伤${c.thorns}`); if (c.slow) p.push(`减速${(c.slow*100).toFixed(0)}%`); if (c.dot) p.push(`中毒${c.dot}/s`); if (c.bleed) p.push(`流血${c.bleed}/s`); return p.join(' · '); }
function adjustColor(hex, amt) { let r = parseInt(hex.slice(1, 3), 16) + amt, g = parseInt(hex.slice(3, 5), 16) + amt, b = parseInt(hex.slice(5, 7), 16) + amt; r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b)); return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`; }

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

// 初始化菜单统计
showMenu();
