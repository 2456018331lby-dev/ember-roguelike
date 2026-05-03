import { createRun, updateRun, applyCardChoice, getPlayerStats, dash, restart } from './game_core.mjs';

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
let installPrompt = null;
let prevWave = 0;

function start(seed = Date.now()) {
  run = createRun(seed);
  prevWave = 0;
  menu.classList.add('hidden');
  gameover.classList.add('hidden');
  reward.classList.add('hidden');
  last = performance.now();
}

document.querySelector('#startBtn').addEventListener('click', () => start());
document.querySelector('#restartBtn').addEventListener('click', () => start());
document.querySelector('#backMenuBtn').addEventListener('click', () => {
  gameover.classList.add('hidden');
  menu.classList.remove('hidden');
});
document.querySelector('#skipBtn')?.addEventListener('click', () => {
  if (run && run.state === 'reward') {
    run.state = 'playing';
    run.rewardChoices = [];
  }
});

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  const btn = document.querySelector('#installBtn');
  btn.hidden = false;
  btn.onclick = async () => { await installPrompt.prompt(); btn.hidden = true; };
});

// ---- 键盘 ----
const keys = new Set();
window.addEventListener('keydown', e => {
  keys.add(e.key.toLowerCase());
  if (e.key === ' ' || e.key === 'Shift') {
    // 空格/Shift = 冲刺
    if (run && run.state === 'playing') {
      const dir = { x: input.x || 0, y: input.y || 1 };
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
let joyActive = false;
let joyId = null;
let joyCenterX = 0, joyCenterY = 0;
function setJoy(clientX, clientY) {
  const rect = joystick.getBoundingClientRect();
  joyCenterX = rect.left + rect.width / 2;
  joyCenterY = rect.top + rect.height / 2;
  let dx = clientX - joyCenterX, dy = clientY - joyCenterY;
  const max = rect.width * 0.34;
  const len = Math.hypot(dx, dy);
  if (len > max) { dx = dx / len * max; dy = dy / len * max; }
  knob.style.left = `${36 + dx}px`;
  knob.style.top = `${36 + dy}px`;
  input = { x: dx / max, y: dy / max };
}
function resetJoy() {
  knob.style.left = '36px';
  knob.style.top = '36px';
  input = { x: 0, y: 0 };
  joyActive = false;
  joyId = null;
}
joystick.addEventListener('pointerdown', e => {
  joyActive = true;
  joyId = e.pointerId;
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
    const dx = e.clientX - joyCenterX;
    const dy = e.clientY - joyCenterY;
    dash(run, dx || 0, dy || 1);
  }
  lastTapTime = now;
});

// ---- 主循环 ----
function loop(now) {
  const dt = Math.min(0.04, (now - last) / 1000);
  last = now;
  resizeCanvas();
  updateKeyboardInput();
  if (run) {
    const beforeState = run.state;
    updateRun(run, input, dt);
    // 波次过渡动画
    if (run.state === 'wave_transition' && run.wave !== prevWave) {
      showWaveSplash(run.wave);
      prevWave = run.wave;
    }
    if (beforeState !== run.state) onStateChange();
    updateHud();
  }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---- 状态变化 ----
function onStateChange() {
  if (!run) return;
  if (run.state === 'reward') showReward();
  if (run.state === 'gameover') showGameOver();
  if (run.state === 'victory') showVictory();
}

function showWaveSplash(waveNum) {
  if (!waveSplash) return;
  waveSplash.textContent = waveNum % 5 === 0 ? `⚔ BOSS 第 ${waveNum} 波 ⚔` : `第 ${waveNum} 波`;
  waveSplash.classList.remove('hidden');
  waveSplash.classList.add('show');
  setTimeout(() => {
    waveSplash.classList.remove('show');
    waveSplash.classList.add('hidden');
  }, 1800);
}

function showReward() {
  choicesEl.innerHTML = '';
  for (const card of run.rewardChoices) {
    const el = document.createElement('button');
    el.className = `card ${card.rarity || 'common'}`;
    const hasCombo = run.extremes.length > 0;
    el.innerHTML = `
      <div>
        <div class="type">${typeName(card.type)} · ${rarityName(card.rarity)}</div>
        <h3>${card.name}</h3>
        <div class="desc">${card.desc ?? ''}</div>
        ${card.sacrifice ? `<div class="cost">代价：${costText(card.sacrifice)}</div>` : ''}
      </div>
      ${hasCombo ? `<div class="combo-hint">🔥 极端化：${run.extremes.join('、')}</div>` : ''}
    `;
    el.onclick = () => {
      applyCardChoice(run, card);
      reward.classList.add('hidden');
    };
    choicesEl.appendChild(el);
  }
  reward.classList.remove('hidden');
}

function showGameOver() {
  const best = Number(localStorage.getItem('ember_best') ?? 0);
  if (run.score > best) localStorage.setItem('ember_best', String(run.score));
  finalStats.innerHTML = `
    <div class="final-stat">波次 <span>${run.wave}</span></div>
    <div class="final-stat">击杀 <span>${run.kills}</span></div>
    <div class="final-stat">分数 <span>${run.score}</span> ${run.score > best ? '🏆 新纪录' : ''}</div>
    <div class="final-stat">最高连击 <span>${run.maxCombo}</span></div>
    <div class="final-stat">极端化 <span>${run.extremes.join('、') || '无'}</span></div>
  `;
  gameover.classList.remove('hidden');
}

function showVictory() {
  const best = Number(localStorage.getItem('ember_best') ?? 0);
  if (run.score > best) localStorage.setItem('ember_best', String(run.score));
  finalStats.innerHTML = `
    <h2 style="color:#ffd58a">🏆 余烬永不熄灭！</h2>
    <div class="final-stat">击杀 <span>${run.kills}</span></div>
    <div class="final-stat">分数 <span>${run.score}</span></div>
    <div class="final-stat">最高连击 <span>${run.maxCombo}</span></div>
    <div class="final-stat">极端化 <span>${run.extremes.join('、') || '无'}</span></div>
  `;
  document.querySelector('#gameover h2').textContent = '🏆 胜利！';
  gameover.classList.remove('hidden');
}

function updateHud() {
  const stats = getPlayerStats(run);
  const hpPct = Math.max(0, Math.min(1, run.player.hp / stats.maxHp));
  hpBar.style.width = `${hpPct * 100}%`;
  hpBar.style.background = hpPct < 0.3 ? 'linear-gradient(90deg, #ff1744, #ff5252)' : 'linear-gradient(90deg, #ff6d00, #ffd58a)';
  hpText.textContent = `${Math.ceil(run.player.hp)} / ${stats.maxHp}`;

  // 护盾条
  if (barrierBar) {
    if (run.player.barrier > 0) {
      barrierBar.style.display = 'block';
      barrierBar.style.width = `${Math.min(100, run.player.barrier / stats.maxHp * 100)}%`;
    } else {
      barrierBar.style.display = 'none';
    }
  }

  waveText.textContent = `第 ${run.wave} / ${run.totalWaves} 波`;
  scoreText.textContent = `分数 ${Math.floor(run.score)} · 击杀 ${run.kills}`;
  comboText.textContent = run.combo > 1 ? `连击 x${run.combo}` : '';
  comboText.style.display = run.combo > 1 ? 'block' : 'none';

  // 冲刺指示器
  if (dashIndicator) {
    const pct = Math.max(0, 1 - run.dashCooldown / 2);
    dashIndicator.style.background = pct >= 1 ? '#ffd58a' : `conic-gradient(#ffd58a ${pct * 360}deg, #333 ${pct * 360}deg)`;
  }

  statsText.innerHTML = `
    伤害 ${Math.round(stats.attack * stats.damageMultiplier)}<br>
    攻速 ${(1 / stats.attackCooldown).toFixed(1)}/s<br>
    速度 ${Math.round(stats.speed)}<br>
    护甲 ${stats.armor}<br>
    ${stats.critChance > 0 ? `暴击 ${(stats.critChance * 100).toFixed(0)}%<br>` : ''}
    ${stats.dodgeChance > 0 ? `闪避 ${(stats.dodgeChance * 100).toFixed(0)}%<br>` : ''}
    ${stats.lifesteal > 0 ? `吸血 ${(stats.lifesteal * 100).toFixed(0)}%<br>` : ''}
    极端化 ${run.extremes.join('、') || '无'}
  `;
  messageLog.innerHTML = run.messages.slice(0, 4).map(m => `<div>${m}</div>`).join('');
}

// ---- 渲染 ----
function draw() {
  const s = getScale();
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(s.scale, s.scale);

  // 屏幕震动
  let shakeX = 0, shakeY = 0;
  if (run && run.screenShake > 0) {
    shakeX = (Math.random() - 0.5) * run.screenShake * 16;
    shakeY = (Math.random() - 0.5) * run.screenShake * 16;
  }
  ctx.translate(s.offsetX + shakeX, s.offsetY + shakeY);

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

function drawArena() {
  // 背景渐变
  const grd = ctx.createRadialGradient(640, 360, 50, 640, 360, 700);
  grd.addColorStop(0, '#1a1225');
  grd.addColorStop(0.5, '#120d1a');
  grd.addColorStop(1, '#08060d');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 1280, 720);

  // 地板纹理 - 六边形网格
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#ffd58a';
  ctx.lineWidth = 1;
  const hexSize = 40;
  for (let row = -1; row < 20; row++) {
    for (let col = -1; col < 34; col++) {
      const x = col * hexSize * 1.5 + (row % 2 ? hexSize * 0.75 : 0);
      const y = row * hexSize * 0.866;
      drawHex(x, y, hexSize * 0.45);
    }
  }
  ctx.globalAlpha = 1;

  // 竞技场边框 - 发光效果
  ctx.save();
  ctx.strokeStyle = '#ff6d00';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ff6d00';
  ctx.shadowBlur = 15;
  ctx.strokeRect(30, 35, 1220, 650);
  ctx.shadowBlur = 0;
  ctx.restore();

  // 角落装饰
  const corners = [[35, 40], [1245, 40], [35, 680], [1245, 680]];
  for (const [cx, cy] of corners) {
    ctx.fillStyle = '#ff6d00';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd58a';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHex(x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i - Math.PI / 6;
    const px = x + r * Math.cos(angle);
    const py = y + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawPlayer() {
  const p = run.player;
  const stats = getPlayerStats(run);
  ctx.save();
  ctx.translate(p.x, p.y);

  // 受伤闪红
  if (run.hitFlash > 0) {
    ctx.globalAlpha = 0.5 + run.hitFlash * 0.5;
    ctx.fillStyle = '#ff1744';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 冲刺残影
  if (run.dashTimer > 0) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#48b7ff';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 无敌闪烁
  const alpha = p.invuln > 0 ? (Math.sin(performance.now() * 0.02) * 0.3 + 0.7) : 1;
  ctx.globalAlpha = alpha;

  // 护盾光环
  if (p.barrier > 0) {
    ctx.strokeStyle = '#00bcd4';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.4 + Math.sin(performance.now() * 0.003) * 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }

  // 外圈光晕
  const glow = ctx.createRadialGradient(0, 0, p.radius - 4, 0, 0, p.radius + 10);
  glow.addColorStop(0, '#48b7ff');
  glow.addColorStop(0.7, '#2196f3');
  glow.addColorStop(1, 'rgba(33,150,243,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, p.radius + 10, 0, Math.PI * 2);
  ctx.fill();

  // 身体
  ctx.fillStyle = '#e3f2fd';
  ctx.beginPath();
  ctx.arc(0, 0, p.radius - 2, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛
  ctx.fillStyle = '#1a237e';
  ctx.beginPath();
  ctx.arc(-4, -3, 3, 0, Math.PI * 2);
  ctx.arc(4, -3, 3, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛高光
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-3, -4, 1.5, 0, Math.PI * 2);
  ctx.arc(5, -4, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // 再生光环
  if (stats.regen > 0) {
    ctx.save();
    ctx.globalAlpha = 0.15 + Math.sin(performance.now() * 0.002) * 0.1;
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 16 + Math.sin(performance.now() * 0.003) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemies() {
  for (const e of run.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);

    // 相位状态（幽灵半透明）
    if (e.phased) ctx.globalAlpha = 0.3;

    // 受击闪白
    const flash = e.hitFlash > 0;

    // Boss 光环
    if (e.isBoss) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 15 + Math.sin(performance.now() * 0.004) * 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 身体
    const bodyColor = flash ? '#ffffff' : e.color;
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();

    // 轮廓
    ctx.strokeStyle = flash ? '#ffffff' : adjustColor(e.color, -30);
    ctx.lineWidth = e.isBoss ? 3 : 2;
    ctx.stroke();

    // 敌人类型特征
    if (e.behavior === 'ranged') {
      // 弓箭手 - 小弓标记
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.6, -0.5, 0.5);
      ctx.stroke();
    } else if (e.behavior === 'healer') {
      // 治疗者 - 十字
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
      ctx.moveTo(0, -5); ctx.lineTo(0, 5);
      ctx.stroke();
    } else if (e.behavior === 'summoner') {
      // 召唤者 - 眼睛
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-4, -2, 3, 0, Math.PI * 2);
      ctx.arc(4, -2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(-4, -2, 1.5, 0, Math.PI * 2);
      ctx.arc(4, -2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.behavior === 'ghost') {
      // 幽灵 - 波浪底部
      ctx.fillStyle = flash ? '#fff' : e.color;
      ctx.beginPath();
      for (let i = -e.radius; i < e.radius; i += 4) {
        const wave = Math.sin(performance.now() * 0.005 + i * 0.3) * 3;
        ctx.lineTo(i, e.radius + wave);
      }
      ctx.lineTo(e.radius, 0);
      ctx.closePath();
      ctx.fill();
    }

    // 血条
    if (e.hp < e.maxHp) {
      const barW = e.radius * 2.2;
      const barH = 4;
      const barY = -e.radius - 10;
      ctx.fillStyle = '#1a0000';
      ctx.fillRect(-barW / 2, barY, barW, barH);
      const hpPct = Math.max(0, e.hp / e.maxHp);
      const hpColor = hpPct > 0.5 ? '#4caf50' : hpPct > 0.25 ? '#ff9800' : '#f44336';
      ctx.fillStyle = hpColor;
      ctx.fillRect(-barW / 2, barY, barW * hpPct, barH);
    }

    // 名字（Boss 显示）
    if (e.isBoss) {
      ctx.fillStyle = '#ffd58a';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(e.name, 0, -e.radius - 16);
    }

    // DOT 效果
    if (e.dotDamage > 0) {
      ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.008) * 0.3;
      ctx.fillStyle = '#76ff03';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 减速效果
    if (e.slowTimer > 0) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#00bcd4';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}

function drawProjectiles() {
  for (const p of run.projectiles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = p.color || '#ff9800';
    ctx.shadowColor = p.color || '#ff9800';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function drawPickups() {
  for (const p of run.pickups) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.15;
    ctx.scale(pulse, pulse);

    if (p.type === 'heal') {
      ctx.fillStyle = '#4caf50';
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', 0, 1);
    } else if (p.type === 'ember') {
      ctx.fillStyle = '#ffd58a';
      ctx.globalAlpha = 0.8;
      drawStar(0, 0, 5, 10, 5);
      ctx.globalAlpha = 1;
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
      case 'slash': {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);
        ctx.strokeStyle = '#ffd58a';
        ctx.lineWidth = p.isCrit ? 6 : 3;
        ctx.shadowColor = '#ffd58a';
        ctx.shadowBlur = p.isCrit ? 15 : 8;
        const sweep = (1 - a) * Math.PI * 0.8;
        ctx.beginPath();
        ctx.arc(0, 0, 28, -sweep / 2, sweep / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        // 伤害数字
        ctx.rotate(-(p.angle || 0));
        ctx.fillStyle = p.isCrit ? '#ff0' : '#ffd58a';
        ctx.font = `bold ${p.isCrit ? 28 : 20}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText((p.isCrit ? '暴击 ' : '') + p.damage, 0, -30 - (1 - a) * 30);
        break;
      }
      case 'hit': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#ff1744';
        ctx.font = 'bold 22px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`-${p.damage}`, 0, -20 - (1 - a) * 40);
        break;
      }
      case 'heal':
      case 'lifesteal':
      case 'ember_pickup': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = p.type === 'lifesteal' ? '#ff4081' : '#4caf50';
        ctx.font = 'bold 18px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`+${p.value}`, 0, -(1 - a) * 35);
        break;
      }
      case 'dodge': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#00e5ff';
        ctx.font = 'bold 18px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('闪避!', 0, -(1 - a) * 30);
        break;
      }
      case 'reflect': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#ff9800';
        ctx.font = 'bold 16px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`反弹 ${p.value}`, 0, -(1 - a) * 25);
        break;
      }
      case 'death': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = p.color || '#f44336';
        const size = (1 - a) * 30 + 5;
        ctx.globalAlpha = a * 0.6;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'dash': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#48b7ff';
        ctx.globalAlpha = a * 0.4;
        ctx.beginPath();
        ctx.arc(0, 0, (1 - a) * 40, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'revive': {
        ctx.translate(p.x, p.y);
        ctx.strokeStyle = '#ffd58a';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ff6d00';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(0, 0, (1 - a) * 80, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        break;
      }
      case 'summon': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#9c27b0';
        ctx.globalAlpha = a * 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, (1 - a) * 50, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'aoe': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#f44336';
        ctx.globalAlpha = a * 0.3;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * (1 - a), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'barrier_hit': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#00bcd4';
        ctx.font = 'bold 16px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`-${p.value} 护盾`, 0, -(1 - a) * 25);
        break;
      }
      case 'self_damage': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#ff5722';
        ctx.font = 'bold 16px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`自伤 -${p.value}`, 0, -(1 - a) * 25);
        break;
      }
      case 'dot': {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#76ff03';
        ctx.font = 'bold 14px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`${p.value}`, 0, -(1 - a) * 20);
        break;
      }
    }

    ctx.restore();
  }
}

function drawMinimap() {
  if (!run) return;
  const mmX = 1280 - 130, mmY = 720 - 110, mmW = 120, mmH = 100;
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#000';
  ctx.fillRect(mmX, mmY, mmW, mmH);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(mmX, mmY, mmW, mmH);

  // 玩家点
  const px = mmX + (run.player.x / 1280) * mmW;
  const py = mmY + (run.player.y / 720) * mmH;
  ctx.fillStyle = '#48b7ff';
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();

  // 敌人点
  for (const e of run.enemies) {
    const ex = mmX + (e.x / 1280) * mmW;
    const ey = mmY + (e.y / 720) * mmH;
    ctx.fillStyle = e.isBoss ? '#ff0' : '#f44336';
    ctx.beginPath();
    ctx.arc(ex, ey, e.isBoss ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ---- 工具函数 ----
function drawStar(cx, cy, spikes, outerRadius, innerRadius) {
  let rot = Math.PI / 2 * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
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
  return { attack: '⚔ 攻击牌', defense: '🛡 防御牌', passive: '🔮 被动牌', joker: '🃏 小丑牌', curse: '💀 诅咒牌' }[t] ?? t;
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
