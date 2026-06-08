export function buildRunPresentation(run, stats, character) {
  const buildSummary = buildBuildSummary(run);
  const rewardSummary = buildRewardSummary(run);
  const rewardCardReadouts = buildRewardCardReadouts(run);
  const targetProfile = run.nextWavePreview || run.waveProfile;
  const buildAnalysis = run.buildAnalysis || {};
  const weaknessText = buildWeaknessSummary(buildAnalysis);
  const rewardWhy = buildRewardWhy(run, buildAnalysis, targetProfile);
  const resultPriority = buildResultPriority(run, buildAnalysis);
  const resultCollapse = buildResultCollapseReadout(run, resultPriority);
  const resultTimeline = buildResultTimeline(run, resultPriority);
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
    resultPriorityLabel: resultPriority.label,
    resultNextHint: resultPriority.hint,
    resultCollapseLabel: resultCollapse.label,
    resultCollapseDetail: resultCollapse.detail,
    resultCollapseTone: resultCollapse.tone,
    resultTimeline,
    deathDeckSize: run.deathSummary?.deckSize || 0,
    deathFocus: run.deathSummary?.focus || '',
    deathGameTime: run.deathSummary?.gameTime || 0,
    deathKills: run.deathSummary?.kills || 0,
    deathExtremes: run.deathSummary?.extremes || 0,
    synergies: [...(run.synergies || [])],
    extremes: [...(run.extremes || [])],
    buildSummary,
    rewardSummary,
    rewardCardReadouts,
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

function buildRewardCardReadouts(run) {
  const cards = run.rewardChoices || [];
  if (!cards.length) return [];
  const scores = cards
    .map(rewardFitScoreValue)
    .filter(score => score !== null);
  const bestScore = scores.length ? Math.max(...scores) : null;
  return cards.map((card, index) => {
    const fitScore = rewardFitScoreValue(card);
    const riskLevel = rewardRiskLevel(card);
    const isTop = fitScore !== null && bestScore !== null && index === 0 && fitScore >= bestScore - 0.001;
    const decision = buildRewardDecision(card, fitScore, bestScore, riskLevel, isTop);
    const opportunity = buildRewardOpportunity(card, run, riskLevel);
    return {
      id: card.id,
      fitScore: fitScore ?? 0,
      isTop,
      decisionLabel: decision.label,
      decisionTone: decision.tone,
      riskLevel,
      riskLabel: rewardRiskLabel(riskLevel),
      riskText: buildRewardRiskText(card, riskLevel),
      rarityLabel: rewardRarityLabel(card.rarity),
      opportunityTitle: opportunity.title,
      opportunityDetail: opportunity.detail,
      opportunityTone: opportunity.tone,
    };
  });
}

function rewardFitScoreValue(card) {
  const score = Number(card?.fitScore);
  return Number.isFinite(score) ? score : null;
}

function rewardRiskLevel(card) {
  let level = 0;
  if (card?.type === 'curse') level += 2;
  if ((card?.sacrifice?.amount || 0) >= 0.12) level += 1;
  if (card?.doomTimer || card?.decayRate || card?.selfDamageChance || (card?.armorBonus || 0) < 0) level += 2;
  if ((card?.damageMultiplier || 1) >= 2 && card?.sacrifice?.stat === 'health') level += 1;
  return Math.min(3, level);
}

function buildRewardDecision(card, fitScore, bestScore, riskLevel, isTop) {
  if (isTop && riskLevel >= 2) return { label: '高分豪赌', tone: 'danger' };
  if (isTop) return { label: '本轮首选', tone: 'recommended' };
  if (riskLevel >= 2) return { label: '豪赌', tone: 'danger' };
  if (isStabilizingReward(card)) return { label: '稳血线', tone: 'safe' };
  if (fitScore !== null && bestScore !== null && bestScore - fitScore <= 1.2) return { label: '可替代', tone: 'neutral' };
  return { label: '备选', tone: 'muted' };
}

function isStabilizingReward(card) {
  return Boolean(card?.regen || card?.lifesteal || card?.barrier || card?.armorBonus || card?.dodgeChance || card?.reflect || card?.thorns || card?.revive);
}

function rewardRiskLabel(level) {
  if (level >= 3) return '死亡赌注';
  if (level === 2) return '高风险';
  if (level === 1) return '献祭风险';
  return '低风险';
}

function buildRewardRiskText(card, riskLevel) {
  if (!card?.sacrifice && riskLevel === 0) return '无献祭代价';
  const parts = [];
  if (card?.sacrifice) parts.push(rewardSacrificeText(card.sacrifice));
  if (card?.doomTimer) parts.push(`${Math.round(card.doomTimer)} 秒末日`);
  if (card?.decayRate) parts.push(`每秒流失 ${card.decayRate}`);
  if (card?.selfDamageChance) parts.push(`${Math.round(card.selfDamageChance * 100)}% 自伤`);
  if ((card?.armorBonus || 0) < 0) parts.push(`护甲 ${card.armorBonus}`);
  return parts.join(' · ') || '低风险';
}

function rewardSacrificeText(sacrifice) {
  if (!sacrifice) return '无';
  const names = {
    health: '生命',
    attack: '攻击',
    speed: '移速',
    attack_speed: '攻速',
  };
  return `${names[sacrifice.stat] || sacrifice.stat} -${Math.round((sacrifice.amount || 0) * 100)}%`;
}

function rewardRarityLabel(rarity = 'common') {
  return {
    common: '普通',
    rare: '稀有',
    epic: '史诗',
    legendary: '传说',
    special: '特殊',
  }[rarity] || rarity;
}

function buildRewardOpportunity(card, run, riskLevel) {
  const synergy = findPendingSynergy(card, run);
  if (synergy) {
    return {
      title: '协同点亮',
      detail: `与【${synergy.partnerName}】组成 ${synergy.name}，拿下后会立刻改变构筑轴。`,
      tone: 'synergy',
    };
  }

  const weaknesses = run.buildAnalysis?.weaknesses || {};
  if (weaknesses.safety && (card.revive || card.barrier || card.dodgeChance)) {
    return { title: '修复安全网', detail: '补一次失误容错，适合高波 Boss 前保住路线。', tone: 'safety' };
  }
  if (weaknesses.aoe && isRewardAoeRepair(card)) {
    return { title: '修复清场', detail: '提高处理怪群和压场的速度，降低被包围概率。', tone: 'repair' };
  }
  if (weaknesses.sustain && isStabilizingReward(card)) {
    return { title: '修复续航', detail: '补持续回血、护盾或硬度，减少高波换血崩盘。', tone: 'safety' };
  }
  if (weaknesses.singleTarget && isRewardSingleTargetRepair(card)) {
    return { title: '修复首领输出', detail: '直接抬升单体击杀速度，适合 Boss 跑道变短的局。', tone: 'repair' };
  }

  if (riskLevel >= 2) {
    return { title: '高危爆发', detail: '收益很高，但会压低容错；除非已有安全网，否则不要只看契合分。', tone: 'risk' };
  }

  if (card.perCardDamage || card.perCardsDamage || card.rewardDoubleChance || card.sacrificeReduce) {
    return { title: '成长引擎', detail: '越早拿越容易滚出后续收益，适合路线已经能活下来的局。', tone: 'growth' };
  }

  if (card.rarity === 'legendary' || card.rarity === 'epic') {
    return { title: '稀有核心', detail: '高品质铭牌，优先判断它是否服务当前短板而不是只看稀有度。', tone: 'rare' };
  }

  return { title: '路线补强', detail: card.fitHint || '提供通用数值，适合作为当前构筑的稳定补位。', tone: 'neutral' };
}

function findPendingSynergy(card, run) {
  const deck = run.player?.deck || [];
  const ids = new Set(deck.map(item => item.id));
  const pairs = [
    ['flame_sword', 'meteor', '烈焰共鸣'],
    ['quick_blade', 'gatling', '速射核心'],
    ['poison_dagger', 'bleed_axe', '腐血瘟疫'],
    ['dodge_cloak', 'phase_shift', '虚空步'],
    ['vampire_edge', 'berserker', '血怒汲取'],
    ['lightning', 'crit_eye', '雷暴视界'],
    ['heal_aura', 'barrier', '圣愈庇护'],
    ['shadow_blade', 'crit_eye', '暗影暴击'],
    ['iron_wall', 'stone_skin', '不破铁壁'],
    ['reflect_shield', 'thorn_skin', '反弹荆棘'],
    ['decay', 'doom', '命定之死'],
    ['frost_staff', 'shock_orb', '冰雷双控'],
    ['heavy_core', 'swift_feet', '均衡之力'],
    ['collector', 'greed', '财富即力量'],
  ];
  for (const [a, b, name] of pairs) {
    const partnerId = card.id === a ? b : card.id === b ? a : null;
    if (!partnerId || !ids.has(partnerId)) continue;
    const partner = deck.find(item => item.id === partnerId);
    return { name, partnerName: partner?.name || partnerId };
  }
  return null;
}

function isRewardAoeRepair(card) {
  return Boolean(card.chain || card.rangeBonus || card.slow || card.attackSpeedBonus || card.onKillExplosion);
}

function isRewardSingleTargetRepair(card) {
  return Boolean(card.damage || card.attackBonus || card.damageMultiplier || card.critChance || card.critDamageBonus || card.armorPierce);
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

function buildResultPriority(run, analysis = {}) {
  const summary = run.deathSummary || {};
  if (run.state === 'victory') {
    return {
      label: '冲分路线',
      hint: '保留本轮成型路线，下一把可以提高献祭风险或切到试炼难度追求更高分。',
    };
  }

  const pressure = summary.pressure || analysis.pressure || {};
  const targets = summary.pressureTargets || analysis.pressureTargets || {};
  const gaps = summary.pressureGaps || analysis.pressureGaps || {};
  const weaknesses = analysis.weaknesses || {};
  const candidates = [
    {
      key: 'singleTarget',
      label: '首领输出',
      gap: Number(gaps.singleTarget) || (weaknesses.singleTarget ? 1 : 0),
      hint: '首领输出缺口最大，下一把优先拿高伤害、暴击或攻速牌，Boss 前避免再用高风险自毁牌挤掉输出位。',
    },
    {
      key: 'aoe',
      label: '清场',
      gap: Number(gaps.aoe) || (weaknesses.aoe ? 1 : 0),
      hint: '清场缺口最大，下一把优先拿链击、范围、减速或召唤压场牌，先把怪群处理速度补起来。',
    },
    {
      key: 'sustain',
      label: '续航硬度',
      gap: Number(gaps.sustain) || (weaknesses.sustain ? 1 : 0),
      hint: '续航硬度缺口最大，下一把优先补回血、护盾、护甲或闪避，减少高波持续消耗后的血线崩盘。',
    },
    {
      key: 'safety',
      label: '安全网',
      gap: Number(gaps.safety) || (weaknesses.safety ? 1 : 0),
      hint: '安全网缺口最大，下一把 Boss 前优先拿余烬护符、烟幕疾行、凤凰余烬或屏障牌，别只继续堆输出。',
    },
  ].sort((a, b) => b.gap - a.gap);

  const top = candidates[0];
  if (top?.gap > 0) {
    const currentPressure = top.key === 'sustain'
      ? (pressure.sustain || 0) + (pressure.mitigation || 0)
      : pressure[top.key];
    const pressureText = formatPressureDetail(currentPressure, targets[top.key]);
    return {
      label: top.label,
      hint: `${top.hint}${pressureText ? ` 当前${top.label}${pressureText}。` : ''}`,
    };
  }

  if (summary.buildTip) {
    return {
      label: '路线校准',
      hint: summary.buildTip,
    };
  }

  return {
    label: '战斗节奏',
    hint: '压力目标基本达标，下一把优先复盘站位、冲刺窗口和 Boss 读招节奏。',
  };
}

function buildResultCollapseReadout(run, resultPriority) {
  if (run.state === 'victory') {
    return {
      label: '通关节奏',
      detail: '本轮路线已经撑过最终压力，可以保留核心牌序后再提高献祭风险。',
      tone: 'victory',
    };
  }

  const summary = run.deathSummary || {};
  const combatLog = getResultCombatLog(run, summary);
  const moment = pickCollapseMoment(combatLog);
  if (moment) return buildCollapseReadoutFromMoment(moment, resultPriority);

  const priorityLabel = resultPriority?.label || '';
  if (priorityLabel) {
    return {
      label: `${priorityLabel}缺口`,
      detail: `${summary.reason || '没有记录到明确波中转折。'} 下一把先按${priorityLabel}方向补强，再复盘站位和冲刺窗口。`,
      tone: 'neutral',
    };
  }

  return {
    label: '战斗节奏',
    detail: summary.reason || '没有记录到明确波中转折，下一把优先检查站位、冲刺窗口和 Boss 读招节奏。',
    tone: 'neutral',
  };
}

function getResultCombatLog(run, summary) {
  if (Array.isArray(summary?.combatLog) && summary.combatLog.length) return summary.combatLog;
  return Array.isArray(run.combatLog) ? run.combatLog : [];
}

function pickCollapseMoment(log) {
  return [...(log || [])]
    .filter(Boolean)
    .sort((a, b) => collapseMomentScore(b) - collapseMomentScore(a) || (Number(b.time) || 0) - (Number(a.time) || 0))[0] || null;
}

function collapseMomentScore(moment) {
  const typeScore = {
    heavy_hit: 100,
    low_hp: 84,
    survival: 74,
    boss_late_phase: 68,
    boss_defeated: 18,
  }[moment?.type] ?? 40;
  const toneScore = moment?.tone === 'danger' ? 10 : moment?.tone === 'boss' ? 6 : moment?.tone === 'survival' ? 4 : 0;
  return typeScore + toneScore;
}

function buildCollapseReadoutFromMoment(moment, resultPriority) {
  const title = moment.title || '战斗转折';
  const baseDetail = `${title}：${trimSentence(moment.detail || '这一刻改变了战斗走向。')}`;
  const priorityLabel = resultPriority?.label || '';

  if (moment.type === 'heavy_hit') {
    return {
      label: '高伤害命中',
      detail: joinSentences([
        baseDetail,
        priorityLabel ? `这次命中把${priorityLabel}缺口直接兑现。` : '这类命中通常说明容错或走位窗口已经被压穿。',
      ]),
      tone: 'danger',
    };
  }

  if (moment.type === 'low_hp') {
    return {
      label: '血线断层',
      detail: joinSentences([
        baseDetail,
        priorityLabel ? `低血线后最需要先补${priorityLabel}。` : '低血线后已经没有足够空间继续犯错。',
      ]),
      tone: 'combat',
    };
  }

  if (moment.type === 'survival') {
    return {
      label: '救场已消耗',
      detail: joinSentences([
        baseDetail,
        '保命资源已经用掉，后续路线必须补回安全网。',
      ]),
      tone: 'survival',
    };
  }

  if (moment.type === 'boss_late_phase') {
    return {
      label: '终局弹幕压迫',
      detail: joinSentences([
        baseDetail,
        priorityLabel ? `这个阶段会持续追问${priorityLabel}。` : '这个阶段需要更稳定的输出和走位窗口。',
      ]),
      tone: 'boss',
    };
  }

  return {
    label: '战斗转折',
    detail: baseDetail,
    tone: moment.tone || 'combat',
  };
}

function trimSentence(text) {
  return String(text || '').trim().replace(/[。；;,.，\s]+$/u, '');
}

function joinSentences(parts) {
  return parts
    .map(part => trimSentence(part))
    .filter(Boolean)
    .map(part => `${part}。`)
    .join('');
}

function buildResultTimeline(run, resultPriority) {
  const summary = run.deathSummary || {};
  const decisionLog = Array.isArray(run.decisionLog) ? run.decisionLog : [];
  const structuredEntries = decisionLog
    .slice(-5)
    .map(entry => buildTimelineItemFromDecision(entry, run, summary, resultPriority))
    .filter(Boolean);
  let routeEntries = [];

  if (structuredEntries.length) {
    routeEntries = structuredEntries;
  } else {
    const fallbackDecisions = Array.isArray(summary.lastDecisions) ? summary.lastDecisions : [];
    routeEntries = fallbackDecisions.slice(-4).map(buildTimelineItemFromText).filter(Boolean);
  }

  const combatEntries = buildTimelineItemsFromCombatLog(run, summary).slice(-3);
  const timeline = [...routeEntries, ...combatEntries].sort(compareTimelineItems);
  const terminal = buildTerminalTimelineItem(run, summary, resultPriority);
  if (!terminal) return timeline.slice(-6);
  return [...timeline.slice(-5), terminal];
}

function buildTimelineItemFromDecision(entry, run, summary, resultPriority) {
  if (!entry) return null;
  const typeLabels = {
    reward: '奖励选择',
    forge: '余烬锻造',
    shop: '商店取舍',
    rest: '战前营火',
  };
  const actionLabels = {
    heal: '休整',
    meditate: '冥想',
    train: '训练',
    gamble: '豪赌',
    upgrade: '升级',
    purify: '净化',
    reforge: '重铸',
    card: '拿牌',
    pick: '拿牌',
    skip: '离开',
  };
  const type = typeLabels[entry.type] || '关键选择';
  const action = actionLabels[entry.action] || entry.action || '';
  const fit = typeof entry.fitScore === 'number' ? `契合 ${entry.fitScore.toFixed(1)}` : '';
  const cost = entry.cost ? `花费 ${entry.cost}` : '';
  const detail = [action ? `动作：${action}` : '', fit, cost].filter(Boolean).join(' · ') || '这一步改变了后续路线。';
  const impact = buildDecisionImpact(entry, run, summary, resultPriority);
  return {
    marker: `第 ${entry.wave ?? '?'} 波`,
    title: `${type} · ${entry.name || '未命名选择'}`,
    detail,
    tone: entry.type || 'decision',
    impactLabel: impact.label,
    impactDetail: impact.detail,
    impactTone: impact.tone,
    sortWave: Number(entry.wave) || 0,
    sortTime: Number(entry.time) || 0,
    sortRank: 10,
  };
}

function buildDecisionImpact(entry, run, summary, resultPriority) {
  const priorityKey = priorityKeyFromResult(resultPriority);
  if (entry.type === 'reward') return buildRewardDecisionImpact(entry, run, priorityKey);
  if (entry.type === 'rest') return buildRestDecisionImpact(entry, priorityKey);
  if (entry.type === 'forge') return buildForgeDecisionImpact(entry, priorityKey);
  if (entry.type === 'shop') return buildShopDecisionImpact(entry, summary, priorityKey);
  return {
    label: '路线记录',
    detail: '这一步进入了最后几次关键选择，但缺少更细的因果来源。',
    tone: 'neutral',
  };
}

function buildRewardDecisionImpact(entry, run, priorityKey) {
  const card = findDecisionCard(run, entry);
  const cardKey = card ? classifyDecisionCard(card) : null;
  const priorityLabel = priorityKey ? PRESSURE_LABELS[priorityKey] : '';
  const riskLevel = card ? rewardRiskLevel(card) : 0;
  const hint = entry.fitHint || card?.fitHint || '';
  const fit = Number(entry.fitScore);

  if (riskLevel >= 2) {
    return {
      label: '风险放大',
      detail: priorityLabel
        ? `这张牌收益高但会压低容错；最终仍要面对${priorityLabel}问题。`
        : '这张牌收益高但会压低容错，适合已有安全网时再赌。',
      tone: 'risk',
    };
  }

  if (cardKey) {
    const label = `${PRESSURE_LABELS[cardKey]}补强`;
    if (cardKey === priorityKey) {
      return {
        label,
        detail: `直接处理了本局复盘里的最大缺口，但后续强度仍未完全达标。`,
        tone: 'repair',
      };
    }
    return {
      label,
      detail: priorityLabel
        ? `补了${PRESSURE_LABELS[cardKey]}，但最终最大缺口落在${priorityLabel}。`
        : `补了${PRESSURE_LABELS[cardKey]}，属于路线稳定项。`,
      tone: 'neutral',
    };
  }

  if (Number.isFinite(fit)) {
    if (fit >= 12) {
      return { label: '高契合推进', detail: hint || '当时评分较高，说明它贴合当前路线。', tone: 'repair' };
    }
    if (fit <= 5) {
      return {
        label: '低契合信号',
        detail: priorityLabel ? `这步没有直接处理最终的${priorityLabel}缺口。` : '这步和当时构筑短板的关系偏弱。',
        tone: 'missed',
      };
    }
  }

  return {
    label: '路线意图',
    detail: hint || '提供通用数值，具体因果需要结合后续战斗事件判断。',
    tone: 'neutral',
  };
}

function buildRestDecisionImpact(entry, priorityKey) {
  const priorityLabel = priorityKey ? PRESSURE_LABELS[priorityKey] : '';
  const hint = entry.fitHint || '';
  const action = entry.action;
  if (action === 'ward' || action === 'smoke') {
    return {
      label: '安全网补强',
      detail: priorityKey === 'safety'
        ? '这一步直接补了最终最大缺口，但后续仍被高压窗口继续追问容错。'
        : '用保命或机动换下一波走位窗口。',
      tone: 'repair',
    };
  }
  if (action === 'heal') {
    return {
      label: '血线回正',
      detail: priorityKey === 'sustain'
        ? '这一步补了续航硬度方向，适合避免下一波开局低血。'
        : '先把当前生命拉回可战状态。',
      tone: 'repair',
    };
  }
  if (action === 'train') {
    return {
      label: '输出取向',
      detail: priorityLabel
        ? `选择压缩战斗时长；如果最终缺口是${priorityLabel}，说明单靠训练没有补齐全部短板。`
        : '用临时输出换更短的下一波战斗时间。',
      tone: priorityKey === 'singleTarget' ? 'repair' : 'neutral',
    };
  }
  if (action === 'gamble') {
    return {
      label: '风险放大',
      detail: '用生命换高品质牌，会提高爆发但明显压低下一波容错。',
      tone: 'risk',
    };
  }
  if (action === 'meditate') {
    return {
      label: '长期减负',
      detail: hint || '降低献祭负担，更偏后续路线而不是立即解压。',
      tone: 'growth',
    };
  }
  return {
    label: entry.decisionLabel || '战前准备',
    detail: hint || '这一步改变了下一波开局条件。',
    tone: 'neutral',
  };
}

function buildForgeDecisionImpact(entry, priorityKey) {
  const priorityLabel = priorityKey ? PRESSURE_LABELS[priorityKey] : '';
  if (entry.action === 'upgrade') {
    return {
      label: '核心强化',
      detail: priorityLabel ? `强化已有牌位；最终仍需确认是否覆盖${priorityLabel}缺口。` : '提高既有路线强度。',
      tone: 'growth',
    };
  }
  if (entry.action === 'purify') {
    return {
      label: '代价修复',
      detail: '移除献祭代价，降低路线长期副作用。',
      tone: 'repair',
    };
  }
  if (entry.action === 'reforge') {
    return {
      label: '路线换血',
      detail: '用低价值牌位换更高上限，也会改变后续短板结构。',
      tone: 'growth',
    };
  }
  return {
    label: '锻造调整',
    detail: '这一步改变了已有牌组的质量或代价。',
    tone: 'neutral',
  };
}

function buildShopDecisionImpact(entry, summary, priorityKey) {
  const priorityLabel = priorityKey ? PRESSURE_LABELS[priorityKey] : '';
  if (entry.action === 'heal') return { label: '补给回血', detail: '用余烬换血线，减少下一段连续消耗风险。', tone: 'repair' };
  if (entry.action === 'remove') return { label: '牌组瘦身', detail: '移除低价值牌，降低构筑噪声。', tone: 'growth' };
  if (entry.action === 'upgrade') return { label: '商店强化', detail: priorityLabel ? `强化已有路线，但仍要看是否能覆盖${priorityLabel}。` : '用余烬提高核心牌质量。', tone: 'growth' };
  if (entry.action === 'rare') return { label: '高稀有补位', detail: '抽高品质牌提高上限，但方向取决于落牌。', tone: 'growth' };
  if (entry.action === 'purify_all') return { label: '全局减负', detail: '降低献祭副作用，帮助长线稳定。', tone: 'repair' };
  if (entry.action === 'skip' && priorityLabel) {
    return {
      label: '资源保留',
      detail: `没有在商店直接处理最终的${priorityLabel}缺口。`,
      tone: 'missed',
    };
  }
  return {
    label: summary?.reason ? '商店取舍' : '路线取舍',
    detail: '商店决策影响后续资源和牌组质量。',
    tone: 'neutral',
  };
}

const PRESSURE_LABELS = {
  singleTarget: '首领输出',
  aoe: '清场',
  sustain: '续航硬度',
  safety: '安全网',
};

function priorityKeyFromResult(resultPriority) {
  const label = resultPriority?.label || '';
  return Object.entries(PRESSURE_LABELS).find(([, value]) => value === label)?.[0] || null;
}

function findDecisionCard(run, entry) {
  const deck = run.player?.deck || [];
  if (entry.cardId) {
    const byId = [...deck].reverse().find(card => card.id === entry.cardId);
    if (byId) return byId;
  }
  if (entry.name) {
    return [...deck].reverse().find(card => card.name === entry.name || card.name?.replace(/[+·净]+$/u, '') === entry.name) || null;
  }
  return null;
}

function classifyDecisionCard(card) {
  if (card.revive || card.barrier || card.dodgeChance) return 'safety';
  if (card.regen || card.lifesteal || card.armorBonus || card.reflect || card.thorns) return 'sustain';
  if (isRewardAoeRepair(card)) return 'aoe';
  if (isRewardSingleTargetRepair(card)) return 'singleTarget';
  return null;
}

function buildTimelineItemFromText(text) {
  if (!text) return null;
  const match = String(text).match(/^第\s*(.+?)\s*波\s*(.+?)：(.+)$/);
  if (!match) {
    return {
      marker: '路线',
      title: String(text),
      detail: '旧版复盘记录，缺少结构化来源。',
      tone: 'decision',
      sortWave: 0,
      sortTime: 0,
      sortRank: 10,
    };
  }
  return {
    marker: `第 ${match[1]} 波`,
    title: `${match[2].replace('/', ' · ')} · ${match[3].split(' · ')[0]}`,
    detail: match[3].split(' · ').slice(1).join(' · ') || '关键选择记录。',
    tone: 'decision',
    sortWave: Number(match[1]) || 0,
    sortTime: 0,
    sortRank: 10,
  };
}

function buildTimelineItemsFromCombatLog(run, summary) {
  const log = Array.isArray(summary.combatLog) && summary.combatLog.length
    ? summary.combatLog
    : Array.isArray(run.combatLog) ? run.combatLog : [];
  return log.map(buildTimelineItemFromCombatMoment).filter(Boolean);
}

function buildTimelineItemFromCombatMoment(moment) {
  if (!moment) return null;
  const wave = moment.wave ?? '?';
  const timePrefix = typeof moment.time === 'number' && moment.time > 0
    ? `${formatTimelineTime(moment.time)} · `
    : '';
  const allowedTones = new Set(['combat', 'survival', 'boss', 'danger', 'victory']);
  return {
    marker: `第 ${wave} 波`,
    title: moment.title || '战斗转折',
    detail: `${timePrefix}${moment.detail || '这一刻改变了战斗走向。'}`,
    tone: allowedTones.has(moment.tone) ? moment.tone : 'combat',
    sortWave: Number(wave) || 0,
    sortTime: Number(moment.time) || 0,
    sortRank: moment.tone === 'survival' ? 25 : moment.tone === 'boss' ? 22 : 20,
  };
}

function compareTimelineItems(a, b) {
  const waveDiff = (Number(a.sortWave) || 0) - (Number(b.sortWave) || 0);
  if (waveDiff) return waveDiff;
  const timeDiff = (Number(a.sortTime) || 0) - (Number(b.sortTime) || 0);
  if (timeDiff) return timeDiff;
  return (Number(a.sortRank) || 0) - (Number(b.sortRank) || 0);
}

function formatTimelineTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return minutes > 0 ? `${minutes}分${rest}秒` : `${rest}秒`;
}

function buildTerminalTimelineItem(run, summary, resultPriority) {
  if (run.state === 'victory') {
    return {
      marker: `第 ${run.wave} 波`,
      title: '远征完成',
      detail: resultPriority?.hint || '路线已打通，可以提高风险或挑战试炼。',
      tone: 'victory',
    };
  }

  if (!summary.reason && !summary.waveLabel && run.state !== 'gameover') return null;
  const wave = summary.wave || run.wave || '?';
  const label = summary.waveLabel || `第 ${wave} 波`;
  const priority = resultPriority?.label ? `下一把优先处理${resultPriority.label}。` : '';
  return {
    marker: `第 ${wave} 波`,
    title: `崩盘节点 · ${label}`,
    detail: [summary.reason || '余烬熄灭。', priority].filter(Boolean).join(' '),
    tone: 'danger',
  };
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
