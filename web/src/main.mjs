import { createRun, updateRun, applyCardChoice, getPlayerStats, dash, restart } from './game_core.mjs';

// ============================================================
// 余烬 Ember - 渲染层 & 输入系统
// ============================================================

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const menu = document.querySelector('#menu');
const reward = document.querySelector('#reward');
const gameover = document.querySelector('#gameover');
const choicesEl = document.querySelector('#choices');
const hpBar = document.querySelector('#hpBar');
const hpText = document.querySelector('#hpText');
const waveText = document.querySelector('#waveText');
const scoreText = document.querySelector('#scoreText');
const comboText = document.querySelector('#comboText');
const statsText = document.querySelector('#statsText');
const messageLog = document.querySelector('#messageLog');
const finalStats = document.querySelector('#finalStats');
const joystick = document.querySelector('#joystick');
const knob = document.querySelector('#knob');
const waveSplash = document.querySelector('#waveSplash');
const dashIndicator = document.querySelector('#dashIndicator');
const barrierBar = document.querySelector('#barrierBar');

let run = null;
let last = performance.now();
let input = { x: 0, y: 0 };
let prevWave = 0;
let gameTime = 0;
let ambientParticles = []; // 环境粒子

// 初始化环境粒子
function initAmbientParticles() {
  ambientParticles = [];
  for (let i = 0; i < 40; i++) {
    ambientParticles.push({
      x: Math.random() * 1280,
      y: Math.random() * 720,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 15 + 5,
      alpha: Math.random() * 0.3 + 0.05,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

function start(seed = Date.now()) {
  run = createRun(seed);
  prevWave = 0;
  gameTime = 0;
  menu.classList.add('hidden');
  gameover.classList.add('hidden');
  reward.classList.add('hidden');
  last = performance.now();
  initAmbientParticles();
}

document.querySelector('#startBtn').addEventListener('click', () => start());
document.querySelector('#restartBtn').addEventListener('click', () => start());
document.querySelector('#backMenuBtn').addEventListener('click', () => {
  gameover.classList.add('hidden');
  menu.classList.remove('hidden');
});

// ---- 安装提示 ----
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  const btn = document.querySelector('#installBtn');
  btn.hidden = false;
  btn.onclick = async () => { await e.prompt(); btn.hidden = true; };
});

// ---- 键盘 ----
const keys = new Set();
window.addEventListener('keydown', e => {
  keys.add(e.key.toLowerCase());
  if (e.key === ' ' || e.key === 'Shift') {
    e.preventDefault();
    if (run && run.state === 'playing') {
      const dir = { x: input.x || 0, y: input.y || 0.01 };
      dash(run, dir.x, dir.y);
    }
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

// ---- 虚拟摇杆 ----
let joyActive = false, joyId = null;
let joyCenterX = 0, joyCenterY = 0;
function setJoy(clientX, clientY) {
  const rect = joystick.getBoundingClientRect();
  joyCenterX = rect.left + rect.width / 2;
  joyCenterY = rect.top + rect.height / 2;
  let dx = clientX - joyCenterX, dy = clientY - joyCenterY;
  const max = rect.width * 0.34;
  const len = Math.hypot(dx, dy);
  if (len > max) { dx = dx / len * max; dy = dy / len * max; }
  knob.style.left = `${38 + dx}px`;
  knob.style.top = `${38 + dy}px`;
  input = { x: dx / max, y: dy / max };
}
function resetJoy() {
  knob.style.left = '38px'; knob.style.top = '38px';
  input = { x: 0, y: 0 }; joyActive = false; joyId = null;
}
joystick.addEventListener('pointerdown', e => {
  joyActive = true; joyId = e.pointerId;
  joystick.setPointerCapture(e.pointerId);
  setJoy(e.clientX, e.clientY);
});
joystick.addEventListener('pointermove', e => {
  if (joyActive && e.pointerId === joyId) setJoy(e.clientX, e.clientY);
});
joystick.addEventListener('pointerup', resetJoy);
joystick.addEventListener('pointercancel', resetJoy);

// ---- 双击冲刺（移动端）----
let lastTapTime = 0;
canvas.addEventListener('pointerdown', e => {
  const now = Date.now();
  if (now - lastTapTime < 300 && run && run.state === 'playing') {
    const dx = e.clientX - (joyCenterX || 640);
    const dy = e.clientY - (joyCenterY || 360);
    dash(run, dx || 0, dy || 0.01);
  }
  lastTapTime = now;
});

// ============================================================
// 主循环
// ============================================================
function loop(now) {
  const dt = Math.min(0.04, (now - last) / 1000);
  last = now;
  gameTime += dt;
  resizeCanvas();
  updateKeyboardInput();
  if (run) {
    const beforeState = run.state;
    updateRun(run, input, dt);
    if (run.state === 'wave_transition' && run.wave !== prevWave) {
      showWaveSplash(run.wave);
      prevWave = run.wave;
    }
    if (beforeState !== run.state) onStateChange();
    updateHud();
  }
  // 更新环境粒子
  for (const p of ambientParticles) {
    p.y -= p.speed * dt;
    p.x += Math.sin(gameTime * 0.8 + p.phase) * 8 * dt;
    if (p.y < -10) { p.y = 730; p.x = Math.random() * 1280; }
  }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ============================================================
// UI 状态管理
// ============================================================
function onStateChange() {
  if (!run) return;
  if (run.state === 'reward') showReward();
  if (run.state === 'gameover') showGameOver();
  if (run.state === 'victory') showVictory();
}

function showWaveSplash(waveNum) {
  if (!waveSplash) return;
  const isBoss = waveNum % 5 === 0;
  waveSplash.textContent = isBoss ? `⚔ BOSS 第 ${waveNum} 波 ⚔` : `第 ${waveNum} 波`;
  waveSplash.className = 'wave-splash show';
  setTimeout(() => { waveSplash.className = 'wave-splash hidden'; }, 2000);
}

function showReward() {
  choicesEl.innerHTML = '';
  for (const card of run.rewardChoices) {
    const el = document.createElement('button');
    el.className = `card ${card.rarity || 'common'}`;
    el.innerHTML = `
      <div>
        <div class="type">${typeName(card.type)} · ${rarityName(card.rarity)}</div>
        <h3>${card.name}</h3>
        <div class="desc">${card.desc ?? ''}</div>
        ${card.sacrifice ? `<div class="cost">☠ 代价：${costText(card.sacrifice)}</div>` : ''}
      </div>
      ${run.extremes.length > 0 ? `<div class="combo-hint">🔥 极端化：${run.extremes.join('、')}</div>` : ''}
    `;
    el.onclick = () => { applyCardChoice(run, card); reward.classList.add('hidden'); };
    choicesEl.appendChild(el);
  }
  reward.classList.remove('hidden');
}

function showGameOver() {
  const best = Number(localStorage.getItem('ember_best') ?? 0);
  if (run.score > best) localStorage.setItem('ember_best', String(run.score));
  document.querySelector('#gameover h2').textContent = '余烬熄灭';
  finalStats.innerHTML = `
    <div class="final-stat">波次 <span>${run.wave} / ${run.totalWaves}</span></div>
    <div class="final-stat">击杀 <span>${run.kills}</span></div>
    <div class="final-stat">分数 <span>${Math.floor(run.score)}</span> ${run.score > best ? '🏆 新纪录' : ''}</div>
    <div class="final-stat">最高连击 <span>${run.maxCombo}</span></div>
    <div class="final-stat">极端化 <span>${run.extremes.join('、') || '无'}</span></div>
    <div class="final-stat">卡牌数 <span>${run.player.deck.length}</span></div>
  `;
  gameover.classList.remove('hidden');
}

function showVictory() {
  const best = Number(localStorage.getItem('ember_best') ?? 0);
  if (run.score > best) localStorage.setItem('ember_best', String(run.score));
  document.querySelector('#gameover h2').textContent = '🏆 余烬永不熄灭！';
  finalStats.innerHTML = `
    <div class="final-stat" style="color:#ffd58a;font-size:22px">恭喜通关全部 ${run.totalWaves} 波！</div>
    <div class="final-stat">击杀 <span>${run.kills}</span></div>
    <div class="final-stat">分数 <span>${Math.floor(run.score)}</span></div>
    <div class="final-stat">最高连击 <span>${run.maxCombo}</span></div>
    <div class="final-stat">极端化 <span>${run.extremes.join('、') || '无'}</span></div>
    <div class="final-stat">卡牌数 <span>${run.player.deck.length}</span></div>
  `;
  gameover.classList.remove('hidden');
}

function updateHud() {
  const stats = getPlayerStats(run);
  const hpPct = Math.max(0, Math.min(1, run.player.hp / stats.maxHp));
  hpBar.style.width = `${hpPct * 100}%`;
  hpBar.style.background = hpPct < 0.25 ? 'linear-gradient(90deg, #d50000, #ff1744)' :
    hpPct < 0.5 ? 'linear-gradient(90deg, #ff6d00, #ffab00)' : 'linear-gradient(90deg, #ff6d00, #ffd58a)';
  hpText.textContent = `${Math.ceil(run.player.hp)} / ${stats.maxHp}`;

  if (barrierBar) {
    barrierBar.style.display = run.player.barrier > 0 ? 'block' : 'none';
    if (run.player.barrier > 0) barrierBar.style.width = `${Math.min(100, run.player.barrier / stats.maxHp * 100)}%`;
  }

  waveText.textContent = `第 ${run.wave} / ${run.totalWaves} 波`;
  scoreText.textContent = `分数 ${Math.floor(run.score)} · 击杀 ${run.kills} · 连击 ${run.combo}`;

  if (dashIndicator) {
    const pct = Math.max(0, 1 - run.dashCooldown / 2);
    const ring = dashIndicator.querySelector('.dash-ring');
    if (ring) ring.style.strokeDashoffset = `${100 * (1 - pct)}`;
    dashIndicator.style.opacity = pct >= 1 ? '1' : '0.5';
  }

  let statsHtml = `⚔ ${Math.round(stats.attack * stats.damageMultiplier)} · ${(1 / stats.attackCooldown).toFixed(1)}/s`;
  if (stats.critChance > 0) statsHtml += ` · 暴击${(stats.critChance * 100).toFixed(0)}%`;
  if (stats.lifesteal > 0) statsHtml += ` · 吸血${(stats.lifesteal * 100).toFixed(0)}%`;
  if (stats.thorns > 0) statsHtml += ` · 反伤${stats.thorns}`;
  if (stats.dodgeChance > 0) statsHtml += ` · 闪避${(stats.dodgeChance * 100).toFixed(0)}%`;
  statsHtml += ` · 护甲${stats.armor}`;
  if (run.extremes.length > 0) statsHtml += ` · 🔥${run.extremes.join('+')}`;
  statsText.innerHTML = statsHtml;

  messageLog.innerHTML = run.messages.slice(0, 3).map(m => `<div>${m}</div>`).join('');
}

// ============================================================
// 渲染系统
// ============================================================
function draw() {
  const s = getScale();
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(s.scale, s.scale);

  // 屏幕震动
  let sx = 0, sy = 0;
  if (run && run.screenShake > 0.01) {
    sx = (Math.random() - 0.5) * run.screenShake * 18;
    sy = (Math.random() - 0.5) * run.screenShake * 18;
  }
  ctx.translate(s.offsetX + sx, s.offsetY + sy);

  drawArena();
  if (run) {
    drawPickups();
    drawProjectiles();
    drawEnemies();
    drawPlayer();
    drawParticles();
    drawMinimap();
  }
  ctx.restore();
}

// ---- 竞技场 ----
function drawArena() {
  // 背景
  const grd = ctx.createRadialGradient(640, 360, 40, 640, 360, 750);
  grd.addColorStop(0, '#1e1530');
  grd.addColorStop(0.4, '#140e1f');
  grd.addColorStop(1, '#08060d');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 1280, 720);

  // 地板纹理 - 石砖
  ctx.globalAlpha = 0.045;
  ctx.strokeStyle = '#a08060';
  ctx.lineWidth = 1;
  const tileW = 64, tileH = 64;
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 21; col++) {
      const x = col * tileW + (row % 2 ? tileW / 2 : 0) - 32;
      const y = row * tileH - 16;
      ctx.strokeRect(x + 2, y + 2, tileW - 4, tileH - 4);
      // 裂纹细节
      if ((col + row * 7) % 5 === 0) {
        ctx.beginPath();
        ctx.moveTo(x + tileW * 0.3, y + 2);
        ctx.lineTo(x + tileW * 0.5, y + tileH * 0.6);
        ctx.lineTo(x + tileW * 0.7, y + tileH - 2);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;

  // 环境粒子（灰尘/余烬飘浮）
  for (const p of ambientParticles) {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = '#ffd58a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 竞技场边框 - 双层发光墙
  ctx.save();
  // 外层暗边
  ctx.strokeStyle = '#3a2510';
  ctx.lineWidth = 8;
  ctx.strokeRect(26, 31, 1228, 658);
  // 内层发光
  ctx.strokeStyle = '#ff6d00';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ff6d00';
  ctx.shadowBlur = 12;
  ctx.strokeRect(30, 35, 1220, 650);
  ctx.shadowBlur = 0;
  ctx.restore();

  // 角落火焰装饰
  const corners = [[35, 40], [1245, 40], [35, 680], [1245, 680]];
  for (const [cx, cy] of corners) {
    drawCornerTorch(cx, cy);
  }

  // 墙壁阴影
  ctx.save();
  const shadowGrad = ctx.createLinearGradient(30, 35, 30, 70);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0.3)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowGrad;
  ctx.fillRect(30, 35, 1220, 35);
  const shadowGrad2 = ctx.createLinearGradient(30, 645, 30, 685);
  shadowGrad2.addColorStop(0, 'rgba(0,0,0,0)');
  shadowGrad2.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = shadowGrad2;
  ctx.fillRect(30, 645, 1220, 40);
  ctx.restore();
}

function drawCornerTorch(cx, cy) {
  const t = gameTime * 3;
  // 火焰底座
  ctx.fillStyle = '#5a3a10';
  ctx.fillRect(cx - 4, cy - 2, 8, 8);
  // 火焰
  for (let i = 0; i < 3; i++) {
    const fh = 12 + Math.sin(t + i * 2) * 4;
    const fw = 4 + Math.sin(t * 1.3 + i) * 2;
    const alpha = 0.5 - i * 0.12;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = i === 0 ? '#ff6d00' : i === 1 ? '#ffab00' : '#ffd54f';
    ctx.beginPath();
    ctx.ellipse(cx + Math.sin(t + i) * 1.5, cy - fh / 2 - i * 3, fw, fh / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // 光晕
  const glow = ctx.createRadialGradient(cx, cy - 8, 0, cx, cy - 8, 40);
  glow.addColorStop(0, 'rgba(255,109,0,0.08)');
  glow.addColorStop(1, 'rgba(255,109,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 40, cy - 48, 80, 80);
}

// ---- 玩家角色 ----
function drawPlayer() {
  const p = run.player;
  const stats = getPlayerStats(run);
  const t = gameTime;

  ctx.save();
  ctx.translate(p.x, p.y);

  // 受伤红色闪烁
  if (run.hitFlash > 0.1) {
    ctx.globalAlpha = run.hitFlash * 0.5;
    ctx.fillStyle = '#ff1744';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 冲刺残影
  if (run.dashTimer > 0) {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#48b7ff';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 无敌闪烁
  const alpha = p.invuln > 0 ? (0.5 + Math.sin(t * 12) * 0.4) : 1;
  ctx.globalAlpha = alpha;

  // 护盾光环
  if (p.barrier > 0) {
    ctx.save();
    ctx.strokeStyle = '#00bcd4';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.35 + Math.sin(t * 4) * 0.15;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -t * 30;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // 影子
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, p.radius + 4, p.radius * 0.8, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- 身体（精灵风格）----
  drawPlayerSprite(0, 0, p.radius, t, stats);

  ctx.restore();

  // 再生光环
  if (stats.regen > 0 || (run.player.regen > 0)) {
    ctx.save();
    ctx.globalAlpha = 0.12 + Math.sin(t * 3) * 0.06;
    ctx.strokeStyle = '#66bb6a';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = t * 20;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 18 + Math.sin(t * 2) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function drawPlayerSprite(x, y, r, t, stats) {
  // 角色身体（带呼吸动画的精灵）
  const breathe = Math.sin(t * 2.5) * 1.5;

  // 外层光晕
  const outerGlow = ctx.createRadialGradient(x, y, r - 4, x, y, r + 12);
  outerGlow.addColorStop(0, 'rgba(72,183,255,0.15)');
  outerGlow.addColorStop(1, 'rgba(72,183,255,0)');
  ctx.fillStyle = outerGlow;
  ctx.beginPath();
  ctx.arc(x, y, r + 12, 0, Math.PI * 2);
  ctx.fill();

  // 身体主体 - 圆形+渐变
  const bodyGrad = ctx.createRadialGradient(x - 2, y - 3, 0, x, y, r);
  bodyGrad.addColorStop(0, '#e3f2fd');
  bodyGrad.addColorStop(0.6, '#90caf9');
  bodyGrad.addColorStop(1, '#42a5f5');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(x, y, r - 1 + breathe * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // 身体轮廓
  ctx.strokeStyle = '#1565c0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r - 1 + breathe * 0.3, 0, Math.PI * 2);
  ctx.stroke();

  // 斗篷/披风
  ctx.fillStyle = '#1a237e';
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.7, y - r * 0.2);
  ctx.quadraticCurveTo(x - r * 1.1, y + r * 0.6, x - r * 0.5, y + r * 0.9 + Math.sin(t * 3) * 2);
  ctx.lineTo(x - r * 0.1, y + r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // 头部/面罩
  ctx.fillStyle = '#263238';
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.25, r * 0.55, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛（发光）
  const eyeGlow = ctx.createRadialGradient(x - 4, y - r * 0.25, 0, x - 4, y - r * 0.25, 6);
  eyeGlow.addColorStop(0, '#4fc3f7');
  eyeGlow.addColorStop(0.5, '#0288d1');
  eyeGlow.addColorStop(1, 'rgba(2,136,209,0)');
  ctx.fillStyle = eyeGlow;
  ctx.beginPath();
  ctx.arc(x - 4, y - r * 0.25, 5, 0, Math.PI * 2);
  ctx.fill();
  const eyeGlow2 = ctx.createRadialGradient(x + 4, y - r * 0.25, 0, x + 4, y - r * 0.25, 6);
  eyeGlow2.addColorStop(0, '#4fc3f7');
  eyeGlow2.addColorStop(0.5, '#0288d1');
  eyeGlow2.addColorStop(1, 'rgba(2,136,209,0)');
  ctx.fillStyle = eyeGlow2;
  ctx.beginPath();
  ctx.arc(x + 4, y - r * 0.25, 5, 0, Math.PI * 2);
  ctx.fill();

  // 瞳孔
  ctx.fillStyle = '#e1f5fe';
  ctx.beginPath();
  ctx.arc(x - 4, y - r * 0.25 - 1, 2, 0, Math.PI * 2);
  ctx.arc(x + 4, y - r * 0.25 - 1, 2, 0, Math.PI * 2);
  ctx.fill();

  // 武器（小剑，根据攻速旋转）
  const weaponAngle = Math.sin(t * 8) * 0.3 + 0.5;
  ctx.save();
  ctx.translate(x + r * 0.5, y - r * 0.1);
  ctx.rotate(weaponAngle);
  // 剑刃
  ctx.fillStyle = '#b0bec5';
  ctx.fillRect(-1.5, -14, 3, 14);
  // 剑尖
  ctx.fillStyle = '#cfd8dc';
  ctx.beginPath();
  ctx.moveTo(-2, -14);
  ctx.lineTo(0, -19);
  ctx.lineTo(2, -14);
  ctx.closePath();
  ctx.fill();
  // 剑柄
  ctx.fillStyle = '#795548';
  ctx.fillRect(-3, 0, 6, 3);
  // 剑柄发光（攻速越快越亮）
  if (stats.attackCooldown < 0.3) {
    ctx.globalAlpha = 0.4 + Math.sin(t * 10) * 0.2;
    ctx.fillStyle = '#ffd58a';
    ctx.fillRect(-2, -14, 4, 14);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // 脚部（小圆点，走路时交替）
  const walkPhase = Math.sin(t * 10) * 3;
  ctx.fillStyle = '#263238';
  ctx.beginPath();
  ctx.arc(x - 4, y + r * 0.7 + walkPhase, 3, 0, Math.PI * 2);
  ctx.arc(x + 4, y + r * 0.7 - walkPhase, 3, 0, Math.PI * 2);
  ctx.fill();
}

// ---- 敌人 ----
function drawEnemies() {
  for (const e of run.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);

    // 相位透明
    if (e.phased) ctx.globalAlpha = 0.25;
    const flash = e.hitFlash > 0.1;
    const t = gameTime;

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, e.radius + 3, e.radius * 0.7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Boss 特殊光环
    if (e.isBoss) {
      ctx.save();
      const bossGlow = ctx.createRadialGradient(0, 0, e.radius * 0.5, 0, 0, e.radius + 25);
      bossGlow.addColorStop(0, 'rgba(255,0,0,0.12)');
      bossGlow.addColorStop(0.6, 'rgba(255,0,0,0.05)');
      bossGlow.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = bossGlow;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 25, 0, Math.PI * 2);
      ctx.fill();
      // Boss 旋转符文
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = '#ff1744';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const angle = t * 1.5 + (i * Math.PI * 2 / 3);
        const rx = Math.cos(angle) * (e.radius + 15);
        const ry = Math.sin(angle) * (e.radius + 15);
        ctx.beginPath();
        ctx.arc(rx, ry, 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ---- 按类型绘制精灵 ----
    drawEnemySprite(e, flash, t);

    // 血条
    if (e.hp < e.maxHp) {
      const barW = e.radius * 2.5;
      const barH = e.isBoss ? 6 : 4;
      const barY = -e.radius - 12;
      // 背景
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-barW / 2 - 1, barY - 1, barW + 2, barH + 2);
      // 血量
      const hpPct = Math.max(0, e.hp / e.maxHp);
      const hpColor = hpPct > 0.5 ? '#66bb6a' : hpPct > 0.25 ? '#ffa726' : '#ef5350';
      ctx.fillStyle = hpColor;
      ctx.fillRect(-barW / 2, barY, barW * hpPct, barH);
      // 血条高光
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(-barW / 2, barY, barW * hpPct, barH / 2);
    }

    // Boss 名字
    if (e.isBoss) {
      ctx.fillStyle = '#ffd58a';
      ctx.font = 'bold 13px system-ui';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(e.name, 0, -e.radius - 18);
      ctx.shadowBlur = 0;
    }

    // DOT 绿色光环
    if (e.dotDamage > 0) {
      ctx.globalAlpha = 0.3 + Math.sin(t * 8) * 0.2;
      ctx.strokeStyle = '#76ff03';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.lineDashOffset = t * 20;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // 减速冰霜
    if (e.slowTimer > 0) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#80deea';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 4, 0, Math.PI * 2);
      ctx.fill();
      // 冰晶
      ctx.strokeStyle = '#e0f7fa';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + t;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * e.radius * 0.5, Math.sin(a) * e.radius * 0.5);
        ctx.lineTo(Math.cos(a) * (e.radius + 6), Math.sin(a) * (e.radius + 6));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}

function drawEnemySprite(e, flash, t) {
  const r = e.radius;
  const baseColor = flash ? '#ffffff' : e.color;
  const darkColor = flash ? '#dddddd' : adjustColor(e.color, -40);

  switch (e.behavior) {
    case 'chase':
    case 'slow_chase': {
      // 史莱姆/骷髅 - 弹跳圆形身体
      const squish = 1 + Math.sin(t * 6 + e.x * 0.1) * 0.08;
      // 身体
      const bodyGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
      bodyGrad.addColorStop(0, flash ? '#fff' : adjustColor(e.color, 30));
      bodyGrad.addColorStop(1, darkColor);
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * squish, r / squish, 0, 0, Math.PI * 2);
      ctx.fill();
      // 轮廓
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // 眼睛
      ctx.fillStyle = flash ? '#ccc' : '#fff';
      ctx.beginPath();
      ctx.ellipse(-r * 0.25, -r * 0.15, r * 0.2, r * 0.25, 0, 0, Math.PI * 2);
      ctx.ellipse(r * 0.25, -r * 0.15, r * 0.2, r * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      // 瞳孔（朝向玩家）
      const toPlayer = Math.atan2(run.player.y - e.y, run.player.x - e.x);
      const pupilOff = r * 0.06;
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.arc(-r * 0.25 + Math.cos(toPlayer) * pupilOff, -r * 0.15 + Math.sin(toPlayer) * pupilOff, r * 0.1, 0, Math.PI * 2);
      ctx.arc(r * 0.25 + Math.cos(toPlayer) * pupilOff, -r * 0.15 + Math.sin(toPlayer) * pupilOff, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      // 嘴
      if (e.behavior === 'slow_chase') {
        // 石像鬼 - 方形嘴
        ctx.fillStyle = darkColor;
        ctx.fillRect(-r * 0.2, r * 0.15, r * 0.4, r * 0.15);
      } else {
        ctx.strokeStyle = darkColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, r * 0.1, r * 0.25, 0, Math.PI);
        ctx.stroke();
      }
      break;
    }
    case 'zigzag': {
      // 蝙蝠 - 翅膀扇动
      const wingFlap = Math.sin(t * 12) * 0.5;
      // 身体
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.6, r, 0, 0, Math.PI * 2);
      ctx.fill();
      // 左翅
      ctx.save();
      ctx.rotate(-0.4 + wingFlap);
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, 0);
      ctx.quadraticCurveTo(-r * 1.5, -r * 0.8, -r * 1.3, r * 0.2);
      ctx.lineTo(-r * 0.3, r * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // 右翅
      ctx.save();
      ctx.rotate(0.4 - wingFlap);
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.moveTo(r * 0.3, 0);
      ctx.quadraticCurveTo(r * 1.5, -r * 0.8, r * 1.3, r * 0.2);
      ctx.lineTo(r * 0.3, r * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // 眼睛
      ctx.fillStyle = '#ff0';
      ctx.beginPath();
      ctx.arc(-r * 0.2, -r * 0.2, 2, 0, Math.PI * 2);
      ctx.arc(r * 0.2, -r * 0.2, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'ranged': {
      // 弓箭手 - 拿弓的小人
      // 身体
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // 头巾
      ctx.fillStyle = adjustColor(e.color, -20);
      ctx.beginPath();
      ctx.arc(0, -r * 0.2, r * 0.65, Math.PI, 0);
      ctx.fill();
      // 弓
      const aimAngle = Math.atan2(run.player.y - e.y, run.player.x - e.x);
      ctx.save();
      ctx.rotate(aimAngle);
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, -0.6, 0.6);
      ctx.stroke();
      // 弦
      ctx.strokeStyle = '#d7ccc8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(-0.6) * r * 0.9, Math.sin(-0.6) * r * 0.9);
      ctx.lineTo(Math.cos(0.6) * r * 0.9, Math.sin(0.6) * r * 0.9);
      ctx.stroke();
      ctx.restore();
      // 眼睛
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-3, -2, 2.5, 0, Math.PI * 2);
      ctx.arc(3, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'healer': {
      // 治疗者 - 发光精灵
      const pulse = 1 + Math.sin(t * 4) * 0.1;
      // 光环
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#e91e63';
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.5 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // 身体
      const healGrad = ctx.createRadialGradient(0, -r * 0.3, 0, 0, 0, r);
      healGrad.addColorStop(0, flash ? '#fff' : '#f8bbd0');
      healGrad.addColorStop(1, baseColor);
      ctx.fillStyle = healGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
      ctx.fill();
      // 十字
      ctx.fillStyle = '#fff';
      ctx.fillRect(-1.5, -r * 0.4, 3, r * 0.8);
      ctx.fillRect(-r * 0.4, -1.5, r * 0.8, 3);
      // 眼睛
      ctx.fillStyle = '#c2185b';
      ctx.beginPath();
      ctx.arc(-3, -1, 2, 0, Math.PI * 2);
      ctx.arc(3, -1, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'summoner': {
      // 召唤者 - 邪眼法师
      // 能量环
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = '#9c27b0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // 身体（暗色长袍）
      ctx.fillStyle = '#311b92';
      ctx.beginPath();
      ctx.moveTo(-r, r * 0.5);
      ctx.quadraticCurveTo(-r * 1.1, -r * 0.3, 0, -r);
      ctx.quadraticCurveTo(r * 1.1, -r * 0.3, r, r * 0.5);
      ctx.lineTo(r * 0.6, r);
      ctx.lineTo(-r * 0.6, r);
      ctx.closePath();
      ctx.fill();
      // 大眼睛
      ctx.fillStyle = '#e1bee7';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.1, r * 0.5, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      // 瞳孔
      const toP = Math.atan2(run.player.y - e.y, run.player.x - e.x);
      ctx.fillStyle = '#4a148c';
      ctx.beginPath();
      ctx.arc(Math.cos(toP) * r * 0.12, -r * 0.1 + Math.sin(toP) * r * 0.1, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      // 高光
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-r * 0.1, -r * 0.25, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'phase': {
      // 幽灵
      ctx.globalAlpha = e.phased ? 0.2 : 0.8;
      // 身体
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(0, -r * 0.2, r * 0.85, Math.PI, 0);
      // 波浪底部
      for (let i = r * 0.85; i >= -r * 0.85; i -= 3) {
        const wave = Math.sin(t * 5 + i * 0.4) * 3;
        ctx.lineTo(i, r * 0.6 + wave);
      }
      ctx.closePath();
      ctx.fill();
      // 眼睛（空洞）
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(-r * 0.25, -r * 0.25, r * 0.15, r * 0.2, 0, 0, Math.PI * 2);
      ctx.ellipse(r * 0.25, -r * 0.25, r * 0.15, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // 眼睛发光
      ctx.fillStyle = '#00e5ff';
      ctx.globalAlpha = 0.4 + Math.sin(t * 3) * 0.2;
      ctx.beginPath();
      ctx.arc(-r * 0.25, -r * 0.25, r * 0.06, 0, Math.PI * 2);
      ctx.arc(r * 0.25, -r * 0.25, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    default: {
      // 默认圆形
      const bodyGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
      bodyGrad.addColorStop(0, flash ? '#fff' : adjustColor(e.color, 25));
      bodyGrad.addColorStop(1, darkColor);
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
  }
}

// ---- 弹幕 ----
function drawProjectiles() {
  for (const p of run.projectiles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    // 尾迹
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = p.color || '#ff9800';
    ctx.beginPath();
    ctx.arc(-p.vx * 0.02, -p.vy * 0.02, p.radius * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // 主体
    const pGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.radius);
    pGrad.addColorStop(0, '#fff');
    pGrad.addColorStop(0.5, p.color || '#ff9800');
    pGrad.addColorStop(1, 'rgba(255,152,0,0)');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.color || '#ff9800';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ---- 拾取物 ----
function drawPickups() {
  for (const p of run.pickups) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const pulse = 1 + Math.sin(gameTime * 5) * 0.12;
    const bob = Math.sin(gameTime * 3) * 3;
    ctx.translate(0, bob);
    ctx.scale(pulse, pulse);

    if (p.type === 'heal') {
      // 绿色恢复球
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
      g.addColorStop(0, '#a5d6a7');
      g.addColorStop(0.6, '#43a047');
      g.addColorStop(1, 'rgba(67,160,71,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', 0, 1);
    } else if (p.type === 'ember') {
      // 金色余烬星
      ctx.fillStyle = '#ffd58a';
      ctx.globalAlpha = 0.85;
      drawStar(0, 0, 5, 11, 5);
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
      g.addColorStop(0, 'rgba(255,213,138,0.3)');
      g.addColorStop(1, 'rgba(255,213,138,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// ---- 粒子效果 ----
function drawParticles() {
  for (const p of run.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = a;

    switch (p.type) {
      case 'slash': {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);
        // 挥砍弧线 - 带发光
        ctx.strokeStyle = p.isCrit ? '#ff0' : '#ffd58a';
        ctx.lineWidth = p.isCrit ? 7 : 4;
        ctx.shadowColor = p.isCrit ? '#ff0' : '#ff6d00';
        ctx.shadowBlur = p.isCrit ? 20 : 12;
        const sweep = (1 - a) * Math.PI * 0.9 + 0.2;
        ctx.beginPath();
        ctx.arc(0, 0, 30, -sweep / 2, sweep / 2);
        ctx.stroke();
        // 第二层弧线
        ctx.lineWidth = p.isCrit ? 3 : 1.5;
        ctx.globalAlpha = a * 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, 38, -sweep / 2 + 0.2, sweep / 2 - 0.2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = a;
        // 伤害数字
        ctx.rotate(-(p.angle || 0));
        ctx.fillStyle = p.isCrit ? '#ff0' : '#ffd58a';
        ctx.font = `bold ${p.isCrit ? 30 : 22}px system-ui`;
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.fillText((p.isCrit ? '暴击!' : '') + p.damage, 0, -32 - (1 - a) * 35);
        ctx.shadowBlur = 0;
        break;
      }
      case 'hit': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#ff1744';
        ctx.font = 'bold 24px system-ui';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.fillText(`-${p.damage}`, 0, -22 - (1 - a) * 45);
        ctx.shadowBlur = 0;
        break;
      }
      case 'heal':
      case 'lifesteal':
      case 'ember_pickup': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = p.type === 'lifesteal' ? '#ff4081' : p.type === 'ember_pickup' ? '#ffd58a' : '#66bb6a';
        ctx.font = 'bold 18px system-ui';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(`+${p.value}`, 0, -(1 - a) * 38);
        ctx.shadowBlur = 0;
        break;
      }
      case 'dodge': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#00e5ff';
        ctx.font = 'bold 18px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('闪避!', 0, -(1 - a) * 32);
        break;
      }
      case 'reflect': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#ff9800';
        ctx.font = 'bold 15px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`反弹 ${p.value}`, 0, -(1 - a) * 28);
        break;
      }
      case 'death': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = p.color || '#f44336';
        const size = (1 - a) * 35 + 5;
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + gameTime * 2;
          const dist = size * 0.6;
          ctx.globalAlpha = a * 0.6;
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 3 * a, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'dash': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#48b7ff';
        ctx.globalAlpha = a * 0.3;
        ctx.beginPath();
        ctx.arc(0, 0, (1 - a) * 50, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'revive': {
        ctx.translate(p.x, p.y);
        ctx.strokeStyle = '#ffd58a';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#ff6d00';
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(0, 0, (1 - a) * 90, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        break;
      }
      case 'summon': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#9c27b0';
        ctx.globalAlpha = a * 0.4;
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          const dist = (1 - a) * 40;
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 4 * a, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'aoe': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = 'rgba(244,67,54,0.15)';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * (1 - a), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f44336';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * (1 - a), 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'barrier_hit': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#00bcd4';
        ctx.font = 'bold 15px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`-${p.value} 护盾`, 0, -(1 - a) * 28);
        break;
      }
      case 'self_damage': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#ff5722';
        ctx.font = 'bold 15px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`自伤 -${p.value}`, 0, -(1 - a) * 28);
        break;
      }
      case 'dot': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#76ff03';
        ctx.font = 'bold 13px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`${p.value}`, 0, -(1 - a) * 22);
        break;
      }
    }

    ctx.restore();
  }
}

// ---- 小地图 ----
function drawMinimap() {
  if (!run) return;
  const mmX = 1280 - 135, mmY = 720 - 115, mmW = 125, mmH = 105;
  ctx.save();
  ctx.globalAlpha = 0.55;
  // 背景
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(mmX, mmY, mmW, mmH);
  ctx.strokeStyle = '#3a2510';
  ctx.lineWidth = 1;
  ctx.strokeRect(mmX, mmY, mmW, mmH);
  // 玩家
  const px = mmX + (run.player.x / 1280) * mmW;
  const py = mmY + (run.player.y / 720) * mmH;
  ctx.fillStyle = '#48b7ff';
  ctx.beginPath();
  ctx.arc(px, py, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // 敌人
  for (const e of run.enemies) {
    const ex = mmX + (e.x / 1280) * mmW;
    const ey = mmY + (e.y / 720) * mmH;
    ctx.fillStyle = e.isBoss ? '#ffd58a' : '#ef5350';
    ctx.beginPath();
    ctx.arc(ex, ey, e.isBoss ? 3 : 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // 拾取物
  for (const p of run.pickups) {
    const ppx = mmX + (p.x / 1280) * mmW;
    const ppy = mmY + (p.y / 720) * mmH;
    ctx.fillStyle = p.type === 'heal' ? '#66bb6a' : '#ffd58a';
    ctx.beginPath();
    ctx.arc(ppx, ppy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ============================================================
// 工具函数
// ============================================================
function drawStar(cx, cy, spikes, outerR, innerR) {
  let rot = -Math.PI / 2;
  const step = Math.PI / spikes;
  ctx.beginPath();
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  ctx.closePath();
  ctx.fill();
}

function resizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.floor(innerWidth * dpr), h = Math.floor(innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}
function getScale() {
  const scale = Math.min(canvas.width / 1280, canvas.height / 720);
  return { scale, offsetX: (canvas.width / scale - 1280) / 2, offsetY: (canvas.height / scale - 720) / 2 };
}
function typeName(t) {
  return { attack: '⚔ 攻击', defense: '🛡 防御', passive: '🔮 被动', joker: '🃏 小丑', curse: '💀 诅咒' }[t] ?? t;
}
function rarityName(r) {
  return { common: '普通', rare: '精良', epic: '史诗', legendary: '传说' }[r] ?? r;
}
function costText(s) {
  if (!s) return '无';
  const names = { speed: '速度', attack: '攻击', health: '生命', attack_speed: '攻速' };
  return `${names[s.stat] ?? s.stat} -${Math.round(s.amount * 100)}%`;
}
function adjustColor(hex, amount) {
  let r = parseInt(hex.slice(1, 3), 16) + amount;
  let g = parseInt(hex.slice(3, 5), 16) + amount;
  let b = parseInt(hex.slice(5, 7), 16) + amount;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Service Worker
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
