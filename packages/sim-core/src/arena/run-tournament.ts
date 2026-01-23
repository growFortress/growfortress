/**
 * ARENA TOURNAMENT RUNNER
 *
 * Run: npx tsx packages/sim-core/src/arena/run-tournament.ts
 */

import { runTournament, generateTournamentReport, BOTS } from './arena-test-bots.js';
import * as fs from 'fs';
import * as path from 'path';

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║         ARENA PVP TOURNAMENT - 6 BOTS, 15 MATCHES            ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

console.log('BOT LINEUP:');
for (const bot of BOTS) {
  console.log(`  - ${bot.name}: ${bot.description}`);
}
console.log('');

console.log('Starting tournament...\n');

const seed = Math.floor(Math.random() * 1000000);
console.log(`Using base seed: ${seed}\n`);

const results = runTournament(seed);

console.log('\n\nGenerating full report...\n');
const fullReport = generateTournamentReport(results);

// Save to file
const outputPath = path.join(process.cwd(), 'arena-tournament-results.txt');
fs.writeFileSync(outputPath, fullReport, 'utf-8');
console.log(`\nFull report saved to: ${outputPath}`);

// Also output to console
console.log('\n' + '='.repeat(80) + '\n');
console.log(fullReport);
