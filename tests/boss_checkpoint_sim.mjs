import { simulateSeeds, summarizeBossCheckpoints, summarizeRuns } from './sim_harness.mjs';

const strategies = ['baseline', 'smart'];
const report = {};

function roundGaps(gaps) {
  return Object.fromEntries(
    Object.entries(gaps || {}).map(([key, value]) => [
      key,
      Math.round((Number(value) || 0) * 100) / 100,
    ])
  );
}

function summarizeBossDeathSamples(results) {
  const byWave = {};
  for (const result of results) {
    if (result.state !== 'gameover' || result.wave % 5 !== 0) continue;
    const list = byWave[result.wave] || [];
    if (list.length < 5) {
      list.push({
        seed: result.seed,
        reason: result.deathReason,
        weaknessTags: result.weaknessTags,
        pressureGaps: roundGaps(result.pressureGaps),
        focus: result.focus,
        deckSize: result.deckSize,
        kills: result.kills,
      });
    }
    byWave[result.wave] = list;
  }
  return byWave;
}

for (const strategy of strategies) {
  const results = simulateSeeds({ strategy, seedCount: 60 });

  report[strategy] = {
    ...summarizeRuns(results),
    ...summarizeBossCheckpoints(results),
    bossDeathSamplesByWave: summarizeBossDeathSamples(results),
  };
}

console.log(JSON.stringify(report, null, 2));
