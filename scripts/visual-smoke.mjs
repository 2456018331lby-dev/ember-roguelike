import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const screenshotsDir = resolve(root, 'output', 'visual-smoke');
const failures = [];
const consoleErrors = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function sleep(ms) {
  return new Promise(resolveSleep => setTimeout(resolveSleep, ms));
}

async function findOpenPort() {
  return await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  return candidates.find(candidate => existsSync(candidate));
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolveOpen, rejectOpen) => {
      this.ws.addEventListener('open', resolveOpen, { once: true });
      this.ws.addEventListener('error', rejectOpen, { once: true });
    });

    this.ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolveMessage, rejectMessage } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) rejectMessage(new Error(`${message.error.message || 'CDP error'} (${message.error.code || 'unknown'})`));
        else resolveMessage(message.result || {});
        return;
      }

      const handlers = this.handlers.get(message.method) || [];
      for (const handler of handlers) handler(message.params || {});
    });
  }

  on(method, handler) {
    const handlers = this.handlers.get(method) || [];
    handlers.push(handler);
    this.handlers.set(method, handlers);
  }

  async send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    const promise = new Promise((resolveMessage, rejectMessage) => {
      this.pending.set(id, { resolveMessage, rejectMessage });
    });
    this.ws.send(payload);
    return await promise;
  }

  close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.close();
  }
}

async function waitForHttp(url, timeoutMs = 6000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

async function waitForChromeTarget(debugPort, expectedUrl, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const target = targets.find(item => item.type === 'page' && item.url?.startsWith(expectedUrl)) ||
          targets.find(item => item.type === 'page' && item.webSocketDebuggerUrl);
        if (target?.webSocketDebuggerUrl) return target.webSocketDebuggerUrl;
      }
    } catch {
      // Chrome may still be booting.
    }
    await sleep(100);
  }
  throw new Error('Timed out waiting for Chrome DevTools target');
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
  }
  return result.result?.value;
}

async function waitForOk(cdp, expression, label, timeoutMs = 5000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    last = await evaluate(cdp, expression);
    if (last === true || last?.ok === true) return last;
    await sleep(100);
  }
  throw new Error(`${label} did not become true. Last value: ${JSON.stringify(last)}`);
}

async function capture(cdp, name) {
  const result = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await mkdir(screenshotsDir, { recursive: true });
  const filePath = join(screenshotsDir, name);
  await writeFile(filePath, Buffer.from(result.data || '', 'base64'));
  return filePath;
}

async function terminateProcessTree(child) {
  if (!child || !child.pid) return;
  if (child.exitCode !== null || child.signalCode !== null) return;

  if (process.platform === 'win32') {
    await new Promise(resolveTerminate => {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
      killer.once('error', resolveTerminate);
      killer.once('exit', resolveTerminate);
    });
    return;
  }

  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolveExit => child.once('exit', resolveExit)),
    sleep(1500).then(() => child.kill('SIGKILL')),
  ]);
}

function menuCheckExpression({ mobile = false } = {}) {
  return `(() => {
    const menu = document.querySelector('#menu');
    const start = document.querySelector('#startBtn');
    const heroPanel = document.querySelector('.hero-panel');
    const h1 = heroPanel?.querySelector('h1');
    const startRect = start?.getBoundingClientRect();
    const heroRect = heroPanel?.getBoundingClientRect();
    const h1Rect = h1?.getBoundingClientRect();
    const heroBg = heroPanel ? getComputedStyle(heroPanel).backgroundImage : '';
    const menuBg = menu ? getComputedStyle(menu, '::before').backgroundImage : '';
    const generatedArtLoaded = heroBg.includes('ember-menu-tableau.png') || menuBg.includes('ember-menu-tableau.png');
    const fullBleedHero = heroRect && heroRect.width >= window.innerWidth - 4 && heroRect.height >= window.innerHeight - 4;
    const noHorizontalOverflow = document.documentElement.scrollWidth <= window.innerWidth + 2;
    return {
      ok: Boolean(menu && start && heroPanel && h1 && !menu.classList.contains('hidden') &&
        generatedArtLoaded && fullBleedHero &&
        startRect.width >= 90 && startRect.height >= 34 &&
        h1Rect.width > 80 && h1Rect.height > 40 &&
        noHorizontalOverflow${mobile ? ' && startRect.top < window.innerHeight' : ''}),
      startText: start?.textContent || '',
      startRect: startRect ? { top: Math.round(startRect.top), bottom: Math.round(startRect.bottom), width: Math.round(startRect.width), height: Math.round(startRect.height) } : null,
      heroRect: heroRect ? { top: Math.round(heroRect.top), bottom: Math.round(heroRect.bottom), width: Math.round(heroRect.width), height: Math.round(heroRect.height) } : null,
      h1Rect: h1Rect ? { top: Math.round(h1Rect.top), bottom: Math.round(h1Rect.bottom), width: Math.round(h1Rect.width), height: Math.round(h1Rect.height) } : null,
      generatedArtLoaded,
      width: window.innerWidth,
      height: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth
    };
  })()`;
}

const characterCheckExpression = `(() => {
  const panel = document.querySelector('#charSelect');
  const cards = [...document.querySelectorAll('.char-card')];
  const difficulties = [...document.querySelectorAll('.difficulty-option')];
  const selectedDifficulty = document.querySelector('.difficulty-selected');
  const start = document.querySelector('#charStartBtn');
  const noHorizontalOverflow = document.documentElement.scrollWidth <= window.innerWidth + 2;
  return {
    ok: Boolean(panel && !panel.classList.contains('hidden') &&
      cards.length >= 4 && difficulties.length === 3 && selectedDifficulty && start &&
      start.textContent.includes('开始战斗') && noHorizontalOverflow),
    cards: cards.length,
    difficulties: difficulties.map(button => button.textContent.trim()),
    selectedDifficulty: selectedDifficulty?.textContent.trim() || '',
    scrollWidth: document.documentElement.scrollWidth,
    width: window.innerWidth
  };
})()`;

const gameplayCheckExpression = `(() => new Promise(resolve => {
  requestAnimationFrame(() => {
    const hud = document.querySelector('#hud');
    const canvas = document.querySelector('#game');
    const hpText = document.querySelector('#hpText')?.textContent || '';
    const waveText = document.querySelector('#waveText')?.textContent || '';
    const joystick = document.querySelector('#joystick');
    const dash = document.querySelector('#dashIndicator');
    const joyRect = joystick?.getBoundingClientRect();
    const dashRect = dash?.getBoundingClientRect();
    const controlsVisible = Boolean(joyRect && dashRect && joyRect.width >= 80 && joyRect.height >= 80 && dashRect.width >= 50 && dashRect.height >= 50);
    const noHorizontalOverflow = document.documentElement.scrollWidth <= window.innerWidth + 2;
    const ctx = canvas?.getContext('2d');
    let visibleSamples = 0;
    if (canvas && ctx) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let y = 0; y < canvas.height; y += 24) {
        for (let x = 0; x < canvas.width; x += 24) {
          const idx = (y * canvas.width + x) * 4;
          const alpha = data[idx + 3];
          const light = data[idx] + data[idx + 1] + data[idx + 2];
          if (alpha > 0 && light > 24) visibleSamples++;
        }
      }
    }
    const minVisibleSamples = window.innerWidth <= 500 ? 60 : 140;
    resolve({
      ok: Boolean(hud && hud.style.display !== 'none' && canvas && visibleSamples > minVisibleSamples && hpText.includes('/') && waveText.includes('第') && controlsVisible && noHorizontalOverflow),
      visibleSamples,
      hpText,
      waveText,
      hudDisplay: hud?.style.display || '',
      controlsVisible,
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth
    });
  });
}))()`;

const rewardDebugReadyExpression = `(() => ({
  ok: Boolean(window.__EMBER_DEBUG__ &&
    typeof window.__EMBER_DEBUG__.showReward === 'function' &&
    typeof window.__EMBER_DEBUG__.showResult === 'function')
}))()`;

const rewardCheckExpression = `(() => {
  const reward = document.querySelector('#reward');
  const panel = document.querySelector('.reward-panel');
  const cards = [...document.querySelectorAll('#choices .card')];
  const first = cards[0];
  const decisions = cards.map(card => card.querySelector('.card-decision')?.textContent.trim() || '');
  const opportunities = cards.map(card => card.dataset.opportunity || card.querySelector('.card-readout-title')?.textContent.trim() || '');
  const riskLevels = cards.map(card => Number(card.dataset.riskLevel));
  const plan = document.querySelector('#decisionPlan');
  const planText = plan?.textContent.replace(/\\s+/g, ' ').trim() || '';
  const planChips = [...(plan?.querySelectorAll('.decision-plan-chips span') || [])].map(chip => chip.textContent.trim());
  const noPlanOverflow = Boolean(plan && plan.scrollWidth <= plan.clientWidth + 2);
  const scores = cards
    .map(card => Number(card.dataset.fitScore))
    .filter(score => Number.isFinite(score));
  const sorted = scores.every((score, index) => index === 0 || scores[index - 1] >= score - 0.001);
  const noHorizontalOverflow = document.documentElement.scrollWidth <= window.innerWidth + 2;
  const noCardClipping = cards.every(card => card.scrollHeight <= card.clientHeight + 2);
  const cardHeights = cards.map(card => ({ scroll: card.scrollHeight, client: card.clientHeight }));
  const completeCards = cards.every(card =>
    card.querySelector('.card-shell') &&
    card.querySelector('.card-foot') &&
    card.querySelector('.card-readout') &&
    card.querySelector('.card-readout-title')?.textContent.trim().length >= 3 &&
    card.querySelector('.card-readout-detail')?.textContent.trim().length >= 8 &&
    card.querySelector('.fit-line')?.textContent.includes('建议') &&
    card.querySelector('.cost')?.textContent.trim().length > 4
  );
  const firstRect = first?.getBoundingClientRect();
  const panelRect = panel?.getBoundingClientRect();
  return {
    ok: Boolean(reward && !reward.classList.contains('hidden') &&
      panel && cards.length >= 3 &&
      first?.classList.contains('card-recommended') &&
      decisions[0] && /首选|豪赌/.test(decisions[0]) &&
      opportunities.every(label => /协同|修复|核心|高危|成长|路线/.test(label)) &&
      riskLevels.every(level => Number.isFinite(level) && level >= 0 && level <= 3) &&
      plan && !plan.classList.contains('hidden') &&
      /作战计划/.test(planText) &&
      /安全网|首领输出|清场|续航硬度|压力目标/.test(planText) &&
      planChips.length >= 2 && noPlanOverflow &&
      sorted && completeCards && noCardClipping && noHorizontalOverflow &&
      firstRect && firstRect.width >= 240 && firstRect.height >= 220 &&
      panelRect && panelRect.width <= window.innerWidth + 2),
    decisions,
    opportunities,
    riskLevels,
    noCardClipping,
    planText,
    planChips,
    noPlanOverflow,
    cardHeights,
    scores,
    cardCount: cards.length,
    firstRect: firstRect ? { top: Math.round(firstRect.top), width: Math.round(firstRect.width), height: Math.round(firstRect.height) } : null,
    panelRect: panelRect ? { width: Math.round(panelRect.width), height: Math.round(panelRect.height) } : null,
    scrollWidth: document.documentElement.scrollWidth,
    width: window.innerWidth
  };
})()`;

const restCheckExpression = `(() => {
  const reward = document.querySelector('#reward');
  const meta = document.querySelector('#rewardMeta')?.textContent || '';
  const cards = [...document.querySelectorAll('#choices .card')];
  const restCards = cards.filter(card => card.classList.contains('rest-card') || card.classList.contains('risk-card'));
  const plan = document.querySelector('#decisionPlan');
  const planText = plan?.textContent.replace(/\\s+/g, ' ').trim() || '';
  const planChips = [...(plan?.querySelectorAll('.decision-plan-chips span') || [])].map(chip => chip.textContent.trim());
  const noPlanOverflow = Boolean(plan && plan.scrollWidth <= plan.clientWidth + 2);
  const noHorizontalOverflow = document.documentElement.scrollWidth <= window.innerWidth + 2;
  return {
    ok: Boolean(reward && !reward.classList.contains('hidden') &&
      /前夜|战前营火/.test(meta) &&
      restCards.length >= 3 &&
      plan && !plan.classList.contains('hidden') &&
      /作战计划/.test(planText) &&
      /首领|Boss|安全网|首领输出|清场|续航硬度|压力目标/.test(planText) &&
      planChips.length >= 2 && noPlanOverflow &&
      cards.every(card => card.querySelector('.card-topline') && card.querySelector('h3')) &&
      noHorizontalOverflow),
    meta,
    cardCount: cards.length,
    restCount: restCards.length,
    planText,
    planChips,
    noPlanOverflow,
    labels: cards.map(card => card.querySelector('h3')?.textContent.trim() || ''),
    scrollWidth: document.documentElement.scrollWidth,
    width: window.innerWidth
  };
})()`;

const bossWaveStartedExpression = `(() => new Promise(resolve => {
  requestAnimationFrame(() => {
    const reward = document.querySelector('#reward');
    const hud = document.querySelector('#hud');
    const waveText = document.querySelector('#waveText')?.textContent || '';
    const kindText = document.querySelector('#waveKindText')?.textContent || '';
    const canvas = document.querySelector('#game');
    const ctx = canvas?.getContext('2d');
    let visibleSamples = 0;
    if (canvas && ctx) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let y = 0; y < canvas.height; y += 32) {
        for (let x = 0; x < canvas.width; x += 32) {
          const idx = (y * canvas.width + x) * 4;
          if (data[idx + 3] > 0 && data[idx] + data[idx + 1] + data[idx + 2] > 24) visibleSamples++;
        }
      }
    }
    resolve({
      ok: Boolean(reward?.classList.contains('hidden') &&
        hud && hud.style.display !== 'none' &&
        waveText.includes('第 5') &&
        kindText.includes('Boss') &&
        visibleSamples > 80),
      waveText,
      kindText,
      visibleSamples,
      rewardHidden: reward?.classList.contains('hidden') || false
    });
  });
}))()`;

const bossFightActiveExpression = `(() => new Promise(resolve => {
  requestAnimationFrame(() => {
    const reward = document.querySelector('#reward');
    const hud = document.querySelector('#hud');
    const canvas = document.querySelector('#game');
    const ctx = canvas?.getContext('2d');
    const snapshot = window.__EMBER_DEBUG__?.getSnapshot?.() || {};
    let visibleSamples = 0;
    if (canvas && ctx) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let y = 0; y < canvas.height; y += 32) {
        for (let x = 0; x < canvas.width; x += 32) {
          const idx = (y * canvas.width + x) * 4;
          if (data[idx + 3] > 0 && data[idx] + data[idx + 1] + data[idx + 2] > 24) visibleSamples++;
        }
      }
    }
    resolve({
      ok: Boolean(reward?.classList.contains('hidden') &&
        hud && hud.style.display !== 'none' &&
        snapshot.state === 'playing' &&
        snapshot.wave === 5 &&
        snapshot.waveKind === 'boss' &&
        snapshot.bossCount >= 1 &&
        (snapshot.projectileCount > 0 || snapshot.telegraphCount > 0 || (snapshot.bossPhaseAttackTimer !== null && snapshot.bossPhaseAttackTimer < 1.2)) &&
        visibleSamples > 80),
      snapshot,
      visibleSamples,
      rewardHidden: reward?.classList.contains('hidden') || false
    });
  });
}))()`;

const highWaveBossActiveExpression = `(() => new Promise(resolve => {
  requestAnimationFrame(() => {
    const reward = document.querySelector('#reward');
    const hud = document.querySelector('#hud');
    const canvas = document.querySelector('#game');
    const ctx = canvas?.getContext('2d');
    const snapshot = window.__EMBER_DEBUG__?.getSnapshot?.() || {};
    let visibleSamples = 0;
    if (canvas && ctx) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let y = 0; y < canvas.height; y += 32) {
        for (let x = 0; x < canvas.width; x += 32) {
          const idx = (y * canvas.width + x) * 4;
          if (data[idx + 3] > 0 && data[idx] + data[idx + 1] + data[idx + 2] > 24) visibleSamples++;
        }
      }
    }
    resolve({
      ok: Boolean(reward?.classList.contains('hidden') &&
        hud && hud.style.display !== 'none' &&
        snapshot.state === 'playing' &&
        snapshot.wave >= 20 &&
        snapshot.waveKind === 'boss' &&
        snapshot.bossCount >= 1 &&
        snapshot.ward >= 1 &&
        snapshot.barrier >= 1 &&
        typeof snapshot.bossPattern === 'string' &&
        snapshot.bossPattern.length > 0 &&
        typeof snapshot.bossPatternLabel === 'string' &&
        snapshot.bossPatternLabel.length > 0 &&
        typeof snapshot.bossCharge === 'number' &&
        snapshot.bossCharge >= 0 &&
        (snapshot.projectileCount >= 2 || snapshot.telegraphCount >= 2) &&
        visibleSamples > 80),
      snapshot,
      visibleSamples,
      rewardHidden: reward?.classList.contains('hidden') || false
    });
  });
}))()`;

const resultReportExpression = `(() => {
  const overlay = document.querySelector('#gameover');
  const panel = document.querySelector('.result-panel');
  const brief = document.querySelector('.result-brief');
  const outcome = document.querySelector('.result-outcome');
  const briefCopy = document.querySelector('.result-brief p');
  const heroCards = [...document.querySelectorAll('.result-hero-card')];
  const sections = [...document.querySelectorAll('.result-section')];
  const collapse = document.querySelector('.collapse-review');
  const timelineItems = [...document.querySelectorAll('.timeline-item')];
  const combatTimelineItems = [...document.querySelectorAll('.timeline-combat, .timeline-survival, .timeline-boss')];
  const impactItems = [...document.querySelectorAll('.timeline-impact')];
  const next = document.querySelector('.result-next');
  const restart = document.querySelector('#restartBtn');
  const actions = document.querySelector('.result-actions');
  const panelRect = panel?.getBoundingClientRect();
  const briefRect = brief?.getBoundingClientRect();
  const outcomeRect = outcome?.getBoundingClientRect();
  const copyRect = briefCopy?.getBoundingClientRect();
  const collapseRect = collapse?.getBoundingClientRect();
  const restartRect = restart?.getBoundingClientRect();
  const actionsRect = actions?.getBoundingClientRect();
  const noHorizontalOverflow = document.documentElement.scrollWidth <= window.innerWidth + 2;
  return {
    ok: Boolean(overlay && !overlay.classList.contains('hidden') &&
      panel && brief && outcome && briefCopy && heroCards.length === 4 && sections.length >= 3 && next &&
      briefRect && outcomeRect && copyRect &&
      outcomeRect.bottom <= briefRect.bottom + 1 &&
      copyRect.bottom <= briefRect.bottom + 1 &&
      restart && restartRect && restartRect.width >= 90 && restartRect.height >= 34 &&
      actions && actionsRect && actionsRect.bottom <= window.innerHeight + 2 &&
      restartRect.top >= 0 && restartRect.bottom <= window.innerHeight + 2 &&
      panelRect && panelRect.width <= window.innerWidth + 2 &&
      /下一把优先级/.test(next.textContent || '') &&
      collapse &&
      /崩盘诱因/.test(collapse.textContent || '') &&
      /高伤害命中/.test(collapse.textContent || '') &&
      /瞄准连射命中|恶魔领主·混沌造成/.test(collapse.textContent || '') &&
      collapseRect && collapseRect.width >= Math.min(280, window.innerWidth - 40) &&
      /数值缺口/.test(panel.textContent || '') &&
      /最后决策/.test(panel.textContent || '') &&
      /复盘时间线/.test(panel.textContent || '') &&
      timelineItems.length >= 3 &&
      timelineItems.some(item => /崩盘节点/.test(item.textContent || '')) &&
      combatTimelineItems.length >= 1 &&
      timelineItems.some(item => /血线跌入危险区|首领进入终局弹幕|凤凰余烬复燃|余烬护符救场/.test(item.textContent || '')) &&
      timelineItems.some(item => /瞄准连射命中|恶魔领主·混沌造成/.test(item.textContent || '')) &&
      impactItems.length >= 2 &&
      impactItems.some(item => /路线影响/.test(item.textContent || '')) &&
      noHorizontalOverflow),
    heroCards: heroCards.map(card => card.textContent.trim()),
    sections: sections.map(section => section.textContent.trim().slice(0, 32)),
    collapse: collapse?.textContent.trim().slice(0, 96) || '',
    timelineItems: timelineItems.map(item => item.textContent.trim().slice(0, 48)),
    combatTimelineItems: combatTimelineItems.map(item => item.textContent.trim().slice(0, 48)),
    impactItems: impactItems.map(item => item.textContent.trim().slice(0, 48)),
    panelRect: panelRect ? { width: Math.round(panelRect.width), height: Math.round(panelRect.height), scrollHeight: panel.scrollHeight } : null,
    briefRect: briefRect ? { height: Math.round(briefRect.height), bottom: Math.round(briefRect.bottom) } : null,
    outcomeRect: outcomeRect ? { bottom: Math.round(outcomeRect.bottom) } : null,
    copyRect: copyRect ? { bottom: Math.round(copyRect.bottom) } : null,
    collapseRect: collapseRect ? { width: Math.round(collapseRect.width), height: Math.round(collapseRect.height) } : null,
    restartRect: restartRect ? { width: Math.round(restartRect.width), height: Math.round(restartRect.height), top: Math.round(restartRect.top) } : null,
    actionsRect: actionsRect ? { bottom: Math.round(actionsRect.bottom), height: Math.round(actionsRect.height) } : null,
    scrollWidth: document.documentElement.scrollWidth,
    width: window.innerWidth
  };
})()`;

async function runVisualSmoke() {
  const chromePath = findChrome();
  assert(Boolean(chromePath), 'Chrome or Edge executable should exist for visual smoke');
  if (!chromePath) return;

  const webPort = await findOpenPort();
  const debugPort = await findOpenPort();
  const userDataDir = await mkdtemp(join(tmpdir(), 'ember-visual-smoke-'));
  const baseUrl = `http://127.0.0.1:${webPort}`;

  const server = spawn(process.execPath, [resolve(root, 'scripts', 'serve-web.mjs')], {
    cwd: root,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(webPort) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverStderr = '';
  server.stderr.on('data', chunk => { serverStderr += chunk.toString(); });

  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1365,768',
    baseUrl,
  ], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let chromeStderr = '';
  chrome.stderr.on('data', chunk => { chromeStderr += chunk.toString(); });

  let cdp = null;
  try {
    await waitForHttp(baseUrl);
    const wsUrl = await waitForChromeTarget(debugPort, baseUrl);
    cdp = new CdpClient(wsUrl);
    await cdp.connect();
    cdp.on('Runtime.exceptionThrown', params => {
      consoleErrors.push(params.exceptionDetails?.text || 'Runtime exception');
    });
    cdp.on('Runtime.consoleAPICalled', params => {
      if (params.type === 'error') {
        consoleErrors.push((params.args || []).map(arg => arg.value || arg.description || '').join(' '));
      }
    });
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');

    await waitForOk(cdp, menuCheckExpression(), 'desktop menu');
    const menuShot = await capture(cdp, 'menu-desktop.png');

    await evaluate(cdp, `document.querySelector('#startBtn').click(); true`);
    await waitForOk(cdp, characterCheckExpression, 'desktop character select');
    const charShot = await capture(cdp, 'character-select-desktop.png');

    await evaluate(cdp, `document.querySelector('#charStartBtn').click(); true`);
    await sleep(900);
    await waitForOk(cdp, gameplayCheckExpression, 'desktop gameplay canvas');
    const gameplayShot = await capture(cdp, 'gameplay-desktop.png');

    await cdp.send('Page.navigate', { url: `${baseUrl}?debug=1` });
    await waitForOk(cdp, rewardDebugReadyExpression, 'desktop reward debug hook');
    const debugReward = await evaluate(cdp, `window.__EMBER_DEBUG__.showReward(2026)`);
    assert((debugReward?.cards || []).every(card => typeof card.fitScore === 'number'), 'debug reward cards should carry fit scores');
    await waitForOk(cdp, rewardCheckExpression, 'desktop reward cards');
    const rewardShot = await capture(cdp, 'reward-desktop.png');
    await evaluate(cdp, `document.querySelector('#choices .card')?.click(); true`);
    await waitForOk(cdp, restCheckExpression, 'desktop boss prep rest after reward choice');
    const restShot = await capture(cdp, 'rest-desktop.png');
    await evaluate(cdp, `(document.querySelector('#choices .rest-card') || document.querySelector('#choices .card'))?.click(); true`);
    await waitForOk(cdp, bossWaveStartedExpression, 'desktop boss wave after rest choice', 8000);
    const bossShot = await capture(cdp, 'boss-wave-desktop.png');
    await waitForOk(cdp, bossFightActiveExpression, 'desktop active boss fight cues', 10000);
    const bossFightShot = await capture(cdp, 'boss-fight-desktop.png');
    const highWaveBoss = await evaluate(cdp, `window.__EMBER_DEBUG__.showHighWaveBoss(2048, 20)`);
    assert(highWaveBoss?.wave >= 20, `high-wave boss debug hook should jump to wave 20+: ${JSON.stringify(highWaveBoss)}`);
    await waitForOk(cdp, highWaveBossActiveExpression, 'desktop high-wave boss fight cues', 10000);
    const highWaveBossShot = await capture(cdp, 'boss-fight-highwave-desktop.png');
    await cdp.send('Page.navigate', { url: `${baseUrl}?debug=1` });
    await waitForOk(cdp, rewardDebugReadyExpression, 'desktop result debug hook');
    await evaluate(cdp, `window.__EMBER_DEBUG__.showResult(false)`);
    await waitForOk(cdp, resultReportExpression, 'desktop result report');
    const resultShot = await capture(cdp, 'result-desktop.png');
    await evaluate(cdp, `document.querySelector('.result-timeline')?.scrollIntoView({ block: 'center' }); true`);
    await waitForOk(cdp, resultReportExpression, 'desktop result timeline report');
    const resultTimelineShot = await capture(cdp, 'result-timeline-desktop.png');

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdp.send('Page.navigate', { url: baseUrl });
    await sleep(800);
    await waitForOk(cdp, menuCheckExpression({ mobile: true }), 'mobile menu');
    const mobileMenuShot = await capture(cdp, 'menu-mobile.png');

    await evaluate(cdp, `document.querySelector('#startBtn').click(); true`);
    await waitForOk(cdp, characterCheckExpression, 'mobile character select');
    const mobileCharShot = await capture(cdp, 'character-select-mobile.png');

    await evaluate(cdp, `document.querySelector('#charStartBtn').click(); true`);
    await sleep(900);
    await waitForOk(cdp, gameplayCheckExpression, 'mobile gameplay canvas');
    const mobileGameplayShot = await capture(cdp, 'gameplay-mobile.png');

    await cdp.send('Page.navigate', { url: `${baseUrl}?debug=1` });
    await waitForOk(cdp, rewardDebugReadyExpression, 'mobile reward debug hook');
    await evaluate(cdp, `window.__EMBER_DEBUG__.showReward(2026)`);
    await waitForOk(cdp, rewardCheckExpression, 'mobile reward cards');
    const mobileRewardShot = await capture(cdp, 'reward-mobile.png');
    await evaluate(cdp, `document.querySelector('#choices .card')?.click(); true`);
    await waitForOk(cdp, restCheckExpression, 'mobile boss prep rest after reward choice');
    const mobileRestShot = await capture(cdp, 'rest-mobile.png');
    await evaluate(cdp, `(document.querySelector('#choices .rest-card') || document.querySelector('#choices .card'))?.click(); true`);
    await waitForOk(cdp, bossFightActiveExpression, 'mobile active boss fight cues', 10000);
    const mobileBossFightShot = await capture(cdp, 'boss-fight-mobile.png');
    await cdp.send('Page.navigate', { url: `${baseUrl}?debug=1` });
    await waitForOk(cdp, rewardDebugReadyExpression, 'mobile result debug hook');
    await evaluate(cdp, `window.__EMBER_DEBUG__.showResult(false)`);
    await waitForOk(cdp, resultReportExpression, 'mobile result report');
    const mobileResultShot = await capture(cdp, 'result-mobile.png');
    await evaluate(cdp, `document.querySelector('.result-timeline')?.scrollIntoView({ block: 'center' }); true`);
    await waitForOk(cdp, resultReportExpression, 'mobile result timeline report');
    const mobileResultTimelineShot = await capture(cdp, 'result-timeline-mobile.png');

    assert(consoleErrors.length === 0, `visual smoke should have no console/runtime errors: ${consoleErrors.join(' | ')}`);
    assert(!serverStderr.trim(), `serve-web.mjs should not write stderr: ${serverStderr.trim()}`);

    return {
      screenshots: [menuShot, charShot, gameplayShot, rewardShot, restShot, bossShot, bossFightShot, highWaveBossShot, resultShot, resultTimelineShot, mobileMenuShot, mobileCharShot, mobileGameplayShot, mobileRewardShot, mobileRestShot, mobileBossFightShot, mobileResultShot, mobileResultTimelineShot],
      chromeWarnings: chromeStderr.trim().split(/\r?\n/).filter(Boolean).slice(0, 3),
    };
  } finally {
    if (cdp) cdp.close();
    await terminateProcessTree(chrome);
    await terminateProcessTree(server);
    await sleep(200);
    await rm(userDataDir, { recursive: true, force: true });
  }
}

const result = await runVisualSmoke();

if (failures.length) {
  console.error('Visual smoke check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Visual smoke check passed: desktop/mobile menu, character select, gameplay canvases, reward choices, boss prep rest, boss wave transition, active boss fight cues, high-wave boss cues, and result reports render.');
if (result?.screenshots?.length) {
  for (const file of result.screenshots) console.log(`Screenshot: ${file}`);
}
if (result?.chromeWarnings?.length) {
  console.log(`Chrome warnings ignored: ${result.chromeWarnings.join(' | ')}`);
}
