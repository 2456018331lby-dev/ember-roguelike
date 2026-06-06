import { simulateSeeds, summarizeRuns } from './sim_harness.mjs';

const results = simulateSeeds({ strategy: 'baseline', seedCount: 60 });

console.log(JSON.stringify(summarizeRuns(results), null, 2));
