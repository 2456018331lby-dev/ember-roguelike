// ============================================================
// 余烬 Ember - 程序化音效引擎 (Web Audio API)
// 所有音效由算法生成，无需外部音频文件
// ============================================================

let audioCtx = null;
let masterGain = null;
let sfxGain = null;
let bgmGain = null;
let bgmOsc = null;
let bgmRunning = false;

function ensureCtx() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.6;
  masterGain.connect(audioCtx.destination);
  sfxGain = audioCtx.createGain();
  sfxGain.gain.value = 0.5;
  sfxGain.connect(masterGain);
  bgmGain = audioCtx.createGain();
  bgmGain.gain.value = 0.12;
  bgmGain.connect(masterGain);
}

function noise(duration) {
  const len = audioCtx.sampleRate * duration;
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function playNote(freq, duration, type = 'sine', gain = 0.3, delay = 0) {
  ensureCtx();
  const t = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + duration);
}

// ---- 音效库 ----

export function sfxAttack() {
  // 挥砍声 - 噪音+频率扫掠
  ensureCtx();
  const t = audioCtx.currentTime;
  const src = audioCtx.createBufferSource();
  src.buffer = noise(0.08);
  const filt = audioCtx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.setValueAtTime(3000, t);
  filt.frequency.exponentialRampToValueAtTime(800, t + 0.08);
  filt.Q.value = 2;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  src.connect(filt);
  filt.connect(g);
  g.connect(sfxGain);
  src.start(t);
}

export function sfxCrit() {
  // 暴击 - 高亮金属声
  ensureCtx();
  sfxAttack();
  playNote(1200, 0.12, 'sawtooth', 0.15, 0.02);
  playNote(1800, 0.08, 'sine', 0.1, 0.04);
}

export function sfxHit() {
  // 受伤 - 低沉冲击
  ensureCtx();
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.15);
}

export function sfxDeath() {
  // 玩家死亡 - 低频轰鸣+噪音
  ensureCtx();
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.8);
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.8);
  // 噪音层
  const src = audioCtx.createBufferSource();
  src.buffer = noise(0.5);
  const g2 = audioCtx.createGain();
  g2.gain.setValueAtTime(0.15, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  src.connect(g2);
  g2.connect(sfxGain);
  src.start(t);
}

export function sfxEnemyDeath() {
  // 敌人死亡 - 泡泡破裂声
  ensureCtx();
  playNote(400, 0.08, 'sine', 0.15);
  playNote(600, 0.06, 'sine', 0.1, 0.03);
  playNote(800, 0.04, 'sine', 0.07, 0.06);
}

export function sfxBossDeath() {
  // Boss死亡 - 爆炸+回响
  ensureCtx();
  for (let i = 0; i < 8; i++) {
    playNote(200 + i * 80, 0.15, 'sawtooth', 0.12, i * 0.06);
  }
  const t = audioCtx.currentTime + 0.5;
  const src = audioCtx.createBufferSource();
  src.buffer = noise(0.6);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  src.connect(g);
  g.connect(sfxGain);
  src.start(t);
}

export function sfxDash() {
  // 冲刺 - 嗖的一声
  ensureCtx();
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, t);
  osc.frequency.exponentialRampToValueAtTime(2000, t + 0.1);
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.12);
}

export function sfxPickup() {
  // 拾取 - 叮
  ensureCtx();
  playNote(800, 0.1, 'sine', 0.15);
  playNote(1200, 0.08, 'sine', 0.1, 0.05);
}

export function sfxHeal() {
  // 回复 - 治愈音
  ensureCtx();
  playNote(523, 0.15, 'sine', 0.12);
  playNote(659, 0.12, 'sine', 0.1, 0.08);
  playNote(784, 0.1, 'sine', 0.08, 0.16);
}

export function sfxRevive() {
  // 复活 - 上升和弦
  ensureCtx();
  playNote(261, 0.3, 'sine', 0.15);
  playNote(329, 0.3, 'sine', 0.12, 0.1);
  playNote(392, 0.3, 'sine', 0.1, 0.2);
  playNote(523, 0.5, 'sine', 0.15, 0.3);
}

export function sfxWaveComplete() {
  // 波次完成 - 胜利音
  ensureCtx();
  playNote(392, 0.15, 'square', 0.08);
  playNote(523, 0.15, 'square', 0.08, 0.12);
  playNote(659, 0.2, 'square', 0.1, 0.24);
}

export function sfxCardSelect() {
  // 选牌 - 确认音
  ensureCtx();
  playNote(440, 0.08, 'sine', 0.12);
  playNote(660, 0.1, 'sine', 0.1, 0.06);
}

export function sfxExtreme() {
  // 极端化觉醒 - 不和谐和弦
  ensureCtx();
  playNote(110, 0.4, 'sawtooth', 0.15);
  playNote(138, 0.4, 'sawtooth', 0.12, 0.05);
  playNote(165, 0.5, 'sawtooth', 0.15, 0.1);
  playNote(220, 0.6, 'sawtooth', 0.2, 0.2);
}

export function sfxBulletShot() {
  // 弹幕发射 - 射击声
  ensureCtx();
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(500, t);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.06);
  g.gain.setValueAtTime(0.08, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.06);
}

export function sfxBulletHit() {
  // 弹幕命中 - 轻击
  ensureCtx();
  playNote(300, 0.05, 'square', 0.06);
}

export function sfxCombo(n) {
  // 连击音 - 音高随连击数上升
  ensureCtx();
  const freq = 400 + Math.min(n, 20) * 40;
  playNote(freq, 0.06, 'sine', 0.08);
}

// ---- 背景音乐（程序化生成） ----
const BGM_NOTES = [
  // Am - F - C - G 进行，低沉紧张感
  [110, 130.8, 164.8],  // Am
  [87.3, 110, 130.8],   // F
  [130.8, 164.8, 196],  // C
  [98, 123.5, 146.8],   // G
];

export function startBGM() {
  if (bgmRunning) return;
  ensureCtx();
  bgmRunning = true;

  let chordIdx = 0;
  let noteIdx = 0;
  const beatDuration = 0.8;

  function playNextBeat() {
    if (!bgmRunning) return;
    const chord = BGM_NOTES[chordIdx % BGM_NOTES.length];
    const note = chord[noteIdx % chord.length];
    const t = audioCtx.currentTime;

    // Bass note
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(note, t);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + beatDuration * 0.9);
    osc.connect(g);
    g.connect(bgmGain);
    osc.start(t);
    osc.stop(t + beatDuration * 0.9);

    // 高八度点缀（偶数拍）
    if (noteIdx % 2 === 0) {
      const osc2 = audioCtx.createOscillator();
      const g2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(note * 2, t);
      g2.gain.setValueAtTime(0.05, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + beatDuration * 0.6);
      osc2.connect(g2);
      g2.connect(bgmGain);
      osc2.start(t);
      osc2.stop(t + beatDuration * 0.6);
    }

    noteIdx++;
    if (noteIdx % 4 === 0) chordIdx++;

    bgmOsc = setTimeout(playNextBeat, beatDuration * 1000);
  }

  playNextBeat();
}

export function stopBGM() {
  bgmRunning = false;
  if (bgmOsc) { clearTimeout(bgmOsc); bgmOsc = null; }
}

export function setVolume(master, sfx, bgm) {
  ensureCtx();
  if (masterGain) masterGain.gain.value = master;
  if (sfxGain) sfxGain.gain.value = sfx;
  if (bgmGain) bgmGain.gain.value = bgm;
}

// 用户首次交互后恢复 AudioContext
export function resumeAudio() {
  ensureCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
