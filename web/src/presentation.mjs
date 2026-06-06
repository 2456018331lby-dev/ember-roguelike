export function buildRunPresentation(run, stats, character) {
  const buildSummary = buildBuildSummary(run);
  const rewardSummary = buildRewardSummary(run);
  const targetProfile = run.nextWavePreview || run.waveProfile;
  const buildAnalysis = run.buildAnalysis || {};
  const weaknessText = buildWeaknessSummary(buildAnalysis);
  const rewardWhy = buildRewardWhy(run, buildAnalysis, targetProfile);
  return {
    topLine: `第 ${run.wave} / ${run.totalWaves} 波`,
    scoreLine: `分数 ${Math.floor(run.score)} · 击杀 ${run.kills}`,
    hpLine: `${Math.ceil(Math.max(0, run.player.hp))} / ${stats.maxHp}`,
    comboLine: run.combo >= 3 ? `x${run.combo}` : '',
    statsLine: buildStatsLine(run, stats),
    forgeChoices: run.forgeChoices || [],
    isForge: run.state === 'forge',
    rewardLine: buildRewardLine(run),
    waveKindLine: buildWaveKindLine(run),
    waveSummary: targetProfile?.summary || '',
    waveRiskLine: targetProfile?.risk || '',
    screenTone: targetProfile?.kind === 'boss' ? 'boss' : targetProfile?.kind === 'elite' ? 'elite' : targetProfile?.kind === 'event' ? 'event' : targetProfile?.kind || 'normal',
    hudMood: buildHudMood(run, stats, targetProfile),
    phaseHint: buildPhaseHint(targetProfile),
    rewardWhy,
    weaknessSummary: weaknessText,
    deathReason: run.deathSummary?.reason || '',
    deathWaveLabel: run.deathSummary?.waveLabel || '',
    deathWaveKind: run.deathSummary?.waveKind || '',
    deathBuildTip: run.deathSummary?.buildTip || '',
    deathPressureLine: buildDeathPressureLine(run.deathSummary, buildAnalysis),
    deathDecisionLine: buildDeathDecisionLine(run.deathSummary),
    deathDeckSize: run.deathSummary?.deckSize || 0,
    deathFocus: run.deathSummary?.focus || '',
    deathGameTime: run.deathSummary?.gameTime || 0,
    deathKills: run.deathSummary?.kills || 0,
    deathExtremes: run.deathSummary?.extremes || 0,
    synergies: [...(run.synergies || [])],
    extremes: [...(run.extremes || [])],
    buildSummary,
    rewardSummary,
    messages: (run.messages || []).slice(0, 3),
    characterName: character?.name || run.characterId,
    doomSeconds: stats.doomTimer > 0 ? Math.ceil(Math.max(0, stats.doomTimer - run.gameTime)) : 0,
  };
}

export function buildStatsLine(run, stats) {
  const parts = [
    `攻击 ${Math.round(stats.attack * stats.damageMultiplier)}`,
    `攻速 ${(1 / stats.attackCooldown).toFixed(1)}`,
    `护甲 ${stats.armor}`,
  ];
  if (stats.critChance > 0) parts.push(`暴击 ${Math.round(stats.critChance * 100)}%`);
  if (stats.dodgeChance > 0) parts.push(`闪避 ${Math.round(stats.dodgeChance * 100)}%`);
  return parts.join(' · ');
}

export function buildRewardLine(run) {
  const rerolls = run.rewardRerolls ?? 0;
  const synergies = run.synergies?.length || 0;
  const preview = run.nextWavePreview;
  const target = run.rewardContext?.targetTag || 'tempo';
  const targetText = {
    tempo: '补节奏',
    burst: '追爆发',
    survival: '补生存',
    stabilize: '稳血线',
    aoe: '补清场',
    snowball: '滚雪球',
    forge: '锻造升级',
  }[target] || '补构筑';
  const rawWeaknessText = buildWeaknessSummary(run.buildAnalysis || {});
  const weaknessText = rawWeaknessText.includes('暂无明显短板')
    ? ''
    : rawWeaknessText.replace('当前短板：', '');
  const nextLabel = preview ? ` · 下一波 ${preview.label}` : '';
  return `命运重铸 ${rerolls} 次 · 当前协同 ${synergies} 项 · 本轮建议 ${targetText}${nextLabel}${weaknessText ? ` · 优先处理 ${weaknessText}` : ''}`;
}

export function buildWaveKindLine(run) {
  const profile = run.waveProfile;
  if (!profile) return '';
  const stars = '★'.repeat(profile.danger || 1);
  return `${profile.label} · 危险度 ${stars}`;
}

export function buildBuildSummary(run) {
  const analysis = run.buildAnalysis;
  if (!analysis) return '当前构筑尚未成型';
  const focus = analysis.descriptors?.join(' / ') || '均衡';
  const extremes = run.extremes?.length ? ` · 极端化 ${run.extremes.join('、')}` : '';
  return `构筑倾向 ${focus}${extremes}`;
}

export function buildRewardSummary(run) {
  const cards = run.rewardChoices || [];
  if (!cards.length) return [];
  return cards.map(card => ({
    id: card.id,
    fitHint: card.fitHint || '提供通用数值',
    fitScore: card.fitScore || 0,
  }));
}


function buildWeaknessSummary(analysis) {
  const weaknesses = analysis?.weaknesses || {};
  const pressure = analysis?.pressure || {};
  const targets = analysis?.pressureTargets || {};
  const tags = [];
  if (weaknesses.singleTarget) tags.push('首领输出不足');
  if (weaknesses.aoe) tags.push('清场偏弱');
  if (weaknesses.sustain) tags.push('续航不足');
  if (weaknesses.safety) tags.push('安全网不足');
  if (!tags.length) return '当前构筑暂无明显短板';

  const detailMap = {
    singleTarget: formatPressureDetail(pressure.singleTarget, targets.singleTarget),
    aoe: formatPressureDetail(pressure.aoe, targets.aoe),
    sustain: formatPressureDetail((pressure.sustain || 0) + (pressure.mitigation || 0), targets.sustain),
    safety: formatPressureDetail(pressure.safety, targets.safety),
  };

  const detailText = [
    weaknesses.singleTarget ? `首领输出 ${detailMap.singleTarget}`.trim() : '',
    weaknesses.aoe ? `清场 ${detailMap.aoe}`.trim() : '',
    weaknesses.sustain ? `续航 ${detailMap.sustain}`.trim() : '',
    weaknesses.safety ? `安全网 ${detailMap.safety}`.trim() : '',
  ].filter(Boolean).join(' · ');

  return `当前短板：${tags.join(' / ')}${detailText ? `（${detailText}）` : ''}`;
}

function formatPressureDetail(current, target) {
  if (!current && !target) return '';
  const currentText = `当前强度 ${Math.round(current || 0)}`;
  return target ? `${currentText}/${Math.round(target)}` : currentText;
}

function buildDeathPressureLine(summary, analysis = {}) {
  const pressure = summary?.pressure || analysis?.pressure || {};
  const targets = summary?.pressureTargets || analysis?.pressureTargets || {};
  const gaps = summary?.pressureGaps || analysis?.pressureGaps || {};
  if (!targets || Object.keys(targets).length === 0) return '';
  const rows = [
    ['首领输出', pressure.singleTarget || 0, targets.singleTarget, gaps.singleTarget],
    ['清场', pressure.aoe || 0, targets.aoe, gaps.aoe],
    ['续航硬度', (pressure.sustain || 0) + (pressure.mitigation || 0), targets.sustain, gaps.sustain],
    ['安全网', pressure.safety || 0, targets.safety, gaps.safety],
  ].filter(([, , target]) => target);
  const missing = rows
    .filter(([, , , gap]) => (gap || 0) > 0)
    .sort((a, b) => (b[3] || 0) - (a[3] || 0))
    .slice(0, 3);
  if (!missing.length) return '压力目标基本达标，主要问题更可能是站位、冲刺窗口或战斗节奏。';
  return missing
    .map(([label, current, target, gap]) => `${label} ${Math.round(current)}/${Math.round(target)}（缺 ${Math.round(gap)}）`)
    .join(' · ');
}

function buildDeathDecisionLine(summary) {
  const decisions = summary?.lastDecisions || [];
  if (!decisions.length) return '';
  return decisions.join(' → ');
}

function buildRewardWhy(run, analysis, profile) {
  const weaknesses = analysis?.weaknesses || {};
  const pressure = analysis?.pressure || {};
  const targets = analysis?.pressureTargets || {};
  const lines = [];
  if (profile?.kind === 'boss') lines.push('下一波是首领战，优先补能决定成败的短板');
  else if (profile?.kind === 'elite') lines.push('下一波是精英波，补单点容错和压场能力');
  else  if (profile?.kind === 'event') lines.push('锻造波即将到来，弱敌击杀后可选高品质奖励');
  if (profile?.kind === 'onslaught') lines.push('下一波是猛攻潮，优先补清场和控场');
  if (weaknesses.singleTarget) lines.push(`当前对首领的稳定输出不足（${formatPressureDetail(pressure.singleTarget, targets.singleTarget)}）`);
  if (weaknesses.aoe) lines.push(`当前清场速度偏慢（${formatPressureDetail(pressure.aoe, targets.aoe)}）`);
  if (weaknesses.sustain) lines.push(`当前续航与硬抗不够稳（${formatPressureDetail((pressure.sustain || 0) + (pressure.mitigation || 0), targets.sustain)}）`);
  if (weaknesses.safety) lines.push(`当前缺安全网，失误后难回正（${formatPressureDetail(pressure.safety, targets.safety)}）`);
  return lines.join(' · ') || '当前奖励更适合继续推进主构筑';
}

function buildHudMood(run, stats, targetProfile) {
  const hpRatio = Math.max(0, run.player.hp) / Math.max(1, stats.maxHp);
  if (targetProfile?.kind === "boss") return hpRatio < 0.4 ? "濒临决战" : "准备迎战";
  if (targetProfile?.kind === "elite") return hpRatio < 0.5 ? "高压处理" : "压节奏";
  if (targetProfile?.kind === "event" || run.state === 'forge') return "锻造时刻";
  if (targetProfile?.kind === "recovery") return "补给窗口";
  if (targetProfile?.kind === "hunt") return "稳定推进";
  return "保持构筑";
}

function buildPhaseHint(profile) {
  if (!profile) return "";
  return profile.risk || profile.summary || "";
}
