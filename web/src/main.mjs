import { createRun, updateRun, applyCardChoice, getPlayerStats } from './game_core.mjs';

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
const statsText = document.querySelector('#statsText');
const messageLog = document.querySelector('#messageLog');
const finalStats = document.querySelector('#finalStats');
const joystick = document.querySelector('#joystick');
const knob = document.querySelector('#knob');

let run = null;
let last = performance.now();
let input = { x: 0, y: 0 };
let installPrompt = null;

function start(seed = Date.now()) {
  run = createRun(seed);
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

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  const btn = document.querySelector('#installBtn');
  btn.hidden = false;
  btn.onclick = async () => { await installPrompt.prompt(); btn.hidden = true; };
});

const keys = new Set();
window.addEventListener('keydown', e => { keys.add(e.key.toLowerCase()); });
window.addEventListener('keyup', e => { keys.delete(e.key.toLowerCase()); });

function updateKeyboardInput() {
  let x = 0, y = 0;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('w') || keys.has('arrowup')) y -= 1;
  if (keys.has('s') || keys.has('arrowdown')) y += 1;
  if (x || y) input = { x, y };
}

let joyActive = false;
let joyId = null;
function setJoy(clientX, clientY) {
  const rect = joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = clientX - cx, dy = clientY - cy;
  const max = rect.width * 0.34;
  const len = Math.hypot(dx, dy);
  if (len > max) { dx = dx / len * max; dy = dy / len * max; }
  knob.style.left = `${36 + dx}px`;
  knob.style.top = `${36 + dy}px`;
  input = { x: dx / max, y: dy / max };
}
function resetJoy() { knob.style.left = '36px'; knob.style.top = '36px'; input = { x: 0, y: 0 }; joyActive = false; joyId = null; }
joystick.addEventListener('pointerdown', e => { joyActive = true; joyId = e.pointerId; joystick.setPointerCapture(e.pointerId); setJoy(e.clientX, e.clientY); });
joystick.addEventListener('pointermove', e => { if (joyActive && e.pointerId === joyId) setJoy(e.clientX, e.clientY); });
joystick.addEventListener('pointerup', resetJoy);
joystick.addEventListener('pointercancel', resetJoy);

function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  resizeCanvas();
  updateKeyboardInput();
  if (run) {
    const beforeState = run.state;
    updateRun(run, input, dt);
    if (beforeState !== run.state) onStateChange();
    updateHud();
  }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function onStateChange() {
  if (!run) return;
  if (run.state === 'reward') showReward();
  if (run.state === 'gameover') showGameOver();
}

function showReward() {
  choicesEl.innerHTML = '';
  for (const card of run.rewardChoices) {
    const el = document.createElement('button');
    el.className = 'card';
    el.innerHTML = `
      <div>
        <div class="type">${typeName(card.type)}</div>
        <h3>${card.name}</h3>
        <div class="desc">${card.desc ?? ''}</div>
      </div>
      <div class="cost">代价：${costText(card.sacrifice)}</div>
    `;
    el.onclick = () => { applyCardChoice(run, card); reward.classList.add('hidden'); };
    choicesEl.appendChild(el);
  }
  reward.classList.remove('hidden');
}

function showGameOver() {
  const best = Number(localStorage.getItem('ember_best') ?? 0);
  if (run.score > best) localStorage.setItem('ember_best', String(run.score));
  finalStats.innerHTML = `
    <p>波次：第 ${run.wave} 波</p>
    <p>击杀：${run.kills}</p>
    <p>分数：${run.score} ${run.score > best ? '（新纪录）' : ''}</p>
  `;
  gameover.classList.remove('hidden');
}

function updateHud() {
  const stats = getPlayerStats(run);
  const hpPct = Math.max(0, Math.min(1, run.player.hp / stats.maxHp));
  hpBar.style.width = `${hpPct * 100}%`;
  hpText.textContent = `${Math.ceil(run.player.hp)} / ${stats.maxHp}`;
  waveText.textContent = `第 ${run.wave} 波`;
  scoreText.textContent = `分数 ${Math.floor(run.score)} · 击杀 ${run.kills}`;
  statsText.innerHTML = `伤害 ${Math.round(stats.attack * stats.damageMultiplier)}<br>攻速 ${(1 / stats.attackCooldown).toFixed(1)}/s<br>速度 ${Math.round(stats.speed)}<br>护甲 ${stats.armor}<br>极端化 ${run.extremes.join('、') || '无'}`;
  messageLog.innerHTML = run.messages.map(m => `<div>${m}</div>`).join('');
}

function draw() {
  const s = getScale();
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(s.scale, s.scale);
  ctx.translate(s.offsetX, s.offsetY);
  drawArena();
  if (run) {
    drawEnemies();
    drawPlayer();
    drawParticles();
  }
  ctx.restore();
}

function drawArena() {
  const grd = ctx.createRadialGradient(640, 360, 80, 640, 360, 640);
  grd.addColorStop(0, '#24192f');
  grd.addColorStop(1, '#09070e');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.strokeStyle = '#5a3a25';
  ctx.lineWidth = 8;
  ctx.strokeRect(42, 42, 1196, 636);
  ctx.globalAlpha = .08;
  ctx.strokeStyle = '#ffd58a';
  ctx.lineWidth = 1;
  for (let x = 80; x < 1240; x += 80) { ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x, 670); ctx.stroke(); }
  for (let y = 80; y < 660; y += 80) { ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(1230, y); ctx.stroke(); }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  const p = run.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  const pulse = p.invuln > 0 ? Math.sin(performance.now() * .04) * .35 + .65 : 1;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#48b7ff';
  ctx.beginPath(); ctx.arc(0, 0, p.radius + 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4fbff';
  ctx.beginPath(); ctx.arc(0, 0, p.radius - 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff8a2a';
  ctx.beginPath(); ctx.arc(6, -5, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawEnemies() {
  for (const e of run.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = e.boss ? '#b9142c' : '#d44848';
    ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = e.boss ? '#ffd58a' : '#531414';
    ctx.lineWidth = e.boss ? 4 : 2;
    ctx.stroke();
    const pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = '#270b0b'; ctx.fillRect(-e.radius, -e.radius - 12, e.radius * 2, 5);
    ctx.fillStyle = '#ff5a5a'; ctx.fillRect(-e.radius, -e.radius - 12, e.radius * 2 * pct, 5);
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of run.particles) {
    const a = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = a;
    if (p.type === 'slash') {
      ctx.strokeStyle = '#ffd58a'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 24 * (1 - a) + 8, -.8, .8); ctx.stroke();
      ctx.fillStyle = '#fff1bb'; ctx.font = 'bold 22px system-ui'; ctx.fillText(String(p.damage), p.x + 12, p.y - 14);
    } else {
      ctx.fillStyle = '#ff4444'; ctx.font = 'bold 22px system-ui'; ctx.fillText(`-${p.damage}`, p.x + 12, p.y - 14 - (1 - a) * 30);
    }
    ctx.restore();
  }
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
function typeName(t) { return { attack: '攻击牌', passive: '被动牌', joker: '小丑牌' }[t] ?? t; }
function costText(s) {
  if (!s) return '无';
  const names = { speed: '速度', attack: '攻击', health: '生命', attack_speed: '攻速' };
  return `${names[s.stat] ?? s.stat} -${Math.round(s.amount * 100)}%`;
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
