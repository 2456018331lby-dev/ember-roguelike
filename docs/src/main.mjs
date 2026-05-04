import { createRun, updateRun, applyCardChoice, getPlayerStats, dash } from './game_core.mjs';
import { sfxAttack, sfxCrit, sfxHit, sfxDeath, sfxEnemyDeath, sfxBossDeath, sfxDash, sfxPickup, sfxHeal, sfxRevive, sfxWaveComplete, sfxCardSelect, sfxExtreme, sfxBulletShot, sfxBulletHit, startBGM, stopBGM, resumeAudio } from './audio.mjs';
import { getSave, recordRun, completeTutorial, selectCharacter as saveSelectChar, getMetaBonuses, buyUpgrade, getUpgradeCost } from './save.mjs';
import { getCharacter, getAllCharacters } from './characters.mjs';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');

const menuEl = document.querySelector('#menu');
const rewardEl = document.querySelector('#reward');
const gameoverEl = document.querySelector('#gameover');
const charSelectEl = document.querySelector('#charSelect');
const tutorialBox = document.querySelector('#tutorialBox');
const choicesEl = document.querySelector('#choices');
const hpBar = document.querySelector('#hpBar');
const hpText = document.querySelector('#hpText');
const barrierBar = document.querySelector('#barrierBar');
const waveText = document.querySelector('#waveText');
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

let run = null;
let gameTime = 0;
let last = performance.now();
let input = { x: 0, y: 0 };
let prevWave = 0;
let selectedCharId = 'warrior';
let ambient = [];
let tutorialActive = false;
let tutorialStep = 0;
let tutorialTimer = 0;
let state = 'menu';

const TUTORIAL_STEPS = [
  { text: '拖动左下摇杆移动角色', condition: r => r.gameTime > 2 },
  { text: '双击屏幕或空格可闪避冲刺', condition: r => r.dashCooldown > 0 || r.gameTime > 8 },
  { text: '角色会自动攻击最近敌人', condition: r => r.kills > 0 },
  { text: '击杀敌人会掉落恢复球和余烬', condition: r => r.pickups.length > 0 || r.kills > 3 },
  { text: '每波结束后选择一张卡牌强化自己', condition: r => r.state === 'reward' },
  { text: '教程完成，开始你的献祭之旅', condition: _ => true },
];

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

function showCharacterSelect() {
  hideOverlays();
  state = 'char';
  const save = getSave();
  const chars = getAllCharacters();
  charSelectEl.innerHTML = `
    <div class="panel">
      <h2 style="margin:0 0 8px;color:#f8fafc">选择角色</h2>
      <p style="margin:0 0 18px;color:#94a3b8">每个角色拥有不同的基础属性和起始卡牌</p>
      <div class="char-grid">
        ${chars.map(ch => {
          const unlocked = save.unlockedCharacters.includes(ch.id);
          const selected = ch.id === selectedCharId;
          return `
            <div class="char-card ${selected ? 'char-selected' : ''} ${unlocked ? '' : 'char-locked'}" data-id="${ch.id}" ${unlocked ? '' : 'style="opacity:.45;pointer-events:none"'}>
              <div class="char-icon" style="background:${ch.color}">${unlocked ? ch.name[0] : '🔒'}</div>
              <div class="char-info">
                <div class="char-name">${ch.name}</div>
                <div class="char-sub">${ch.subtitle}</div>
                <div class="char-desc">${ch.desc}</div>
                <div class="char-stats-line">❤${ch.baseHp} ⚡${ch.baseSpeed} ⚔${ch.baseAttack} ⏱${ch.baseAttackCooldown}s</div>
                ${unlocked ? '' : `<div class="char-unlock">${ch.unlockDesc}</div>`}
              </div>
            </div>`;
        }).join('')}
      </div>
      <div style="margin-top:20px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button id="charStartBtn" class="btn-primary">开始战斗</button>
        <button id="charBackBtn" class="btn-secondary">返回菜单</button>
      </div>
    </div>`;
  charSelectEl.classList.remove('hidden');
  charSelectEl.querySelectorAll('.char-card:not(.char-locked)').forEach(card => {
    card.addEventListener('click', () => {
      selectedCharId = card.dataset.id;
      saveSelectChar(selectedCharId);
      charSelectEl.querySelectorAll('.char-card').forEach(c => c.classList.remove('char-selected'));
      card.classList.add('char-selected');
    });
  });
  charSelectEl.querySelector('#charStartBtn').onclick = () => startRun();
  charSelectEl.querySelector('#charBackBtn').onclick = () => showMenu();
}

function showMetaPanel() {
  hideOverlays();
  state = 'meta';
  const save = getSave();
  const bonuses = getMetaBonuses();
  const panel = document.createElement('div');
  panel.className = 'panel';
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
    <h2 style="margin:0 0 8px;color:#f8fafc">余烬之炉</h2>
    <p style="margin:0 0 16px;color:#94a3b8">消耗余烬点购买永久升级</p>
    <div style="font-size:18px;color:#f59e0b;margin-bottom:16px">余烬点：${save.emberCurrency}</div>
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
  panel.className = 'panel';
  charSelectEl.innerHTML = '';
  panel.innerHTML = `
    <h2 style="margin:0 0 8px;color:#f8fafc">图鉴</h2>
    <p style="margin:0 0 16px;color:#94a3b8">永久进度、成就与协同记录</p>
    <div class="codex-section"><h3>已解锁角色</h3><div>${save.unlockedCharacters.join('、') || '无'}</div></div>
    <div class="codex-section"><h3>已完成成就</h3><div>${(save.achievements || []).join('、') || '无'}</div></div>
    <div class="codex-section"><h3>已发现协同</h3><div>${(save.discoveredSynergies || []).join('、') || '尚未发现'}</div></div>
    <div style="margin-top:20px;text-align:center"><button id="codexBackBtn" class="btn-secondary">返回菜单</button></div>`;
  charSelectEl.appendChild(panel);
  charSelectEl.classList.remove('hidden');
  charSelectEl.querySelector('#codexBackBtn').onclick = () => showMenu();
}

function startRun(seed = Date.now()) {
  resumeAudio();
  const ch = getCharacter(selectedCharId);
  run = createRun(seed, ch);
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
  if (run.state === 'reward') { showReward(); sfxWaveComplete(); stopBGM(); }
  if (run.state === 'gameover') { showResult(false); sfxDeath(); stopBGM(); }
  if (run.state === 'victory') { showResult(true); sfxBossDeath(); stopBGM(); }
}

function showReward() {
  choicesEl.innerHTML = '';
  for (const card of run.rewardChoices) {
    const el = document.createElement('button');
    el.className = `card ${card.rarity || 'common'}`;
    el.innerHTML = `
      <div>
        <div class="type">${typeIcon(card.type)} ${typeName(card.type)} · ${rarityName(card.rarity)}</div>
        <h3>${card.name}</h3>
        <div class="desc">${card.desc || ''}</div>
        <div class="stats-line">${cardStatsLine(card)}</div>
      </div>
      <div class="cost">☠ 代价：${costText(card.sacrifice)}</div>
      ${run.synergies?.length ? `<div class="combo-hint">✨ 当前协同：${run.synergies.join(' · ')}</div>` : ''}`;
    el.onclick = () => {
      sfxCardSelect();
      applyCardChoice(run, card);
      rewardEl.classList.add('hidden');
      startBGM();
    };
    choicesEl.appendChild(el);
  }
  rewardEl.classList.remove('hidden');
}

function showResult(victory) {
  const save = recordRun(run.score, run.wave, run.kills, run.maxCombo, victory, run.characterId);
  gameoverTitle.textContent = victory ? '🏆 余烬永不熄灭' : '余烬熄灭';
  finalStats.innerHTML = `
    <div class="final-stat"><span>角色</span><span>${getCharacter(run.characterId).name}</span></div>
    <div class="final-stat"><span>波次</span><span>${run.wave} / ${run.totalWaves}</span></div>
    <div class="final-stat"><span>击杀</span><span>${run.kills}</span></div>
    <div class="final-stat"><span>分数</span><span>${Math.floor(run.score)}</span></div>
    <div class="final-stat"><span>最高连击</span><span>${run.maxCombo}</span></div>
    <div class="final-stat"><span>协同</span><span>${run.synergies?.join('、') || '无'}</span></div>
    <div class="final-stat"><span>极端化</span><span>${run.extremes.join('、') || '无'}</span></div>
    <div class="final-stat"><span>余烬奖励</span><span>+${save.emberGain}</span></div>`;
  gameoverEl.classList.remove('hidden');
}

function updateHud() {
  if (!run) return;
  const stats = getPlayerStats(run);
  const hpPct = Math.max(0, Math.min(1, run.player.hp / stats.maxHp));
  hpBar.style.width = `${hpPct * 100}%`;
  hpText.textContent = `${Math.ceil(Math.max(0, run.player.hp))} / ${stats.maxHp}`;
  barrierBar.classList.toggle('hidden', run.player.barrier <= 0);
  barrierBar.style.width = `${Math.min(100, run.player.barrier / stats.maxHp * 100)}%`;
  waveText.textContent = `第 ${run.wave} / ${run.totalWaves} 波`;
  scoreText.textContent = `分数 ${Math.floor(run.score)} · 击杀 ${run.kills}`;
  comboText.textContent = `x${run.combo}`;
  comboText.classList.toggle('hidden', run.combo < 3);
  let statLine = `攻击 ${Math.round(stats.attack * stats.damageMultiplier)} · 攻速 ${(1 / stats.attackCooldown).toFixed(1)} · 护甲 ${stats.armor}`;
  if (stats.critChance > 0) statLine += ` · 暴击 ${Math.round(stats.critChance * 100)}%`;
  if (stats.dodgeChance > 0) statLine += ` · 闪避 ${Math.round(stats.dodgeChance * 100)}%`;
  if (run.synergies?.length) statLine += `<br>协同：${run.synergies.join(' · ')}`;
  statsText.innerHTML = statLine;
  messageLog.innerHTML = run.messages.slice(0, 3).map(m => `<div>${m}</div>`).join('');
  if (stats.doomTimer > 0) {
    doomTimer.classList.remove('hidden');
    doomTime.textContent = Math.ceil(Math.max(0, stats.doomTimer - run.gameTime));
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
requestAnimationFrame(loop);

function showWaveSplash(wave) {
  waveSplash.textContent = wave % 5 === 0 ? `⚔ BOSS 第 ${wave} 波` : `第 ${wave} 波`;
  waveSplash.classList.remove('hidden');
  waveSplash.classList.add('show');
  setTimeout(() => {
    waveSplash.classList.remove('show');
    waveSplash.classList.add('hidden');
  }, 1800);
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
    drawTelegraphs();
    drawPickups();
    drawProjectiles();
    drawEnemies();
    drawPlayer();
    drawParticles();
    drawMinimap();
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
  const grd = ctx.createRadialGradient(640, 360, 30, 640, 360, 780);
  grd.addColorStop(0, '#141b28');
  grd.addColorStop(1, '#0b0e14');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = '#334155';
  for (let y = 32; y < 720; y += 64) {
    for (let x = 32; x < 1280; x += 64) {
      ctx.strokeRect(x, y, 56, 56);
    }
  }
  ctx.globalAlpha = 1;
  for (const p of ambient) {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  ctx.strokeRect(28, 28, 1224, 664);
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
    ctx.restore();
  }
}

function drawPlayer() {
  const ch = getCharacter(run.characterId || 'warrior');
  drawSymbol(`icon-player-${ch.id}`, run.player.x, run.player.y, 46, 46, run.player.invuln > 0 ? 0.7 : 1);
  if (run.player.barrier > 0) {
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(run.player.x, run.player.y, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawEnemies() {
  for (const e of run.enemies) {
    const symbol = e.isBoss ? 'icon-boss' : {
      slime: 'icon-slime', bat: 'icon-bat', skeleton: 'icon-skeleton', golem: 'icon-golem',
      archer: 'icon-archer', fire_mage: 'icon-archer', healer: 'icon-healer', summoner: 'icon-summoner'
    }[e.typeKey] || 'icon-slime';
    drawSymbol(symbol, e.x, e.y, e.radius * 2.2, e.radius * 2.2, e.phased ? 0.35 : 1);
    // hp bar
    if (e.hp < e.maxHp) {
      const bw = e.radius * 2.2, bh = e.isBoss ? 6 : 4, by = e.y - e.radius - 14;
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(e.x - bw / 2, by, bw, bh);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(e.x - bw / 2, by, bw * Math.max(0, e.hp / e.maxHp), bh);
    }
  }
}

function drawProjectiles() {
  for (const p of run.projectiles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = p.color || '#f59e0b';
    ctx.beginPath();
    ctx.arc(-p.vx * 0.015, -p.vy * 0.015, p.radius * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.color || '#f59e0b';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
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
      case 'hit':
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`-${p.damage}`, p.x, p.y - 16 - (1 - a) * 26);
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
      case 'death':
        ctx.fillStyle = p.color || '#ef4444';
        for (let i = 0; i < 6; i++) {
          const ang = i / 6 * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(ang) * (1 - a) * 24, p.y + Math.sin(ang) * (1 - a) * 24, 2 * a, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
    }
    ctx.restore();
  }
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

function drawSymbol(id, x, y, w, h, alpha = 1) {
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${id}`);
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  svg.appendChild(use);
  const xml = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  ctx.restore();
}

function typeIcon(t) { return { attack: '⚔', defense: '🛡', passive: '🔮', joker: '🃏', curse: '💀' }[t] || '•'; }
function typeName(t) { return { attack: '攻击', defense: '防御', passive: '被动', joker: '小丑', curse: '诅咒' }[t] || t; }
function rarityName(r) { return { common: '普通', rare: '精良', epic: '史诗', legendary: '传说' }[r] || r; }
function costText(s) {
  if (!s) return '无';
  const names = { speed: '移速', attack: '攻击', health: '生命', attack_speed: '攻速' };
  return `${names[s.stat] || s.stat} -${Math.round(s.amount * 100)}%`;
}
function cardStatsLine(c) {
  const parts = [];
  if (c.damage) parts.push(`伤害+${c.damage}`);
  if (c.armorBonus) parts.push(`护甲+${c.armorBonus}`);
  if (c.speedBonus) parts.push(`移速+${c.speedBonus}`);
  if (c.critChance) parts.push(`暴击+${Math.round(c.critChance * 100)}%`);
  if (c.lifesteal) parts.push(`吸血${Math.round(c.lifesteal * 100)}%`);
  if (c.chain) parts.push(`链击${c.chain}`);
  if (c.regen) parts.push(`回血+${c.regen}/s`);
  if (c.barrier) parts.push(`护盾+${c.barrier}`);
  if (c.damageMultiplier) parts.push(`伤害x${c.damageMultiplier}`);
  if (c.dodgeChance) parts.push(`闪避+${Math.round(c.dodgeChance * 100)}%`);
  return parts.join(' · ');
}
function resizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.floor(innerWidth * dpr), h = Math.floor(innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
  }
}
function getScale() {
  const scale = Math.min(canvas.width / 1280, canvas.height / 720);
  return { scale, offsetX: (canvas.width / scale - 1280) / 2, offsetY: (canvas.height / scale - 720) / 2 };
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
showMenu();
requestAnimationFrame(loop);
