#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runAllSuites } from './harness/test-framework.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI formatting helpers
const reset = '\x1b[0m';
const bold = '\x1b[1m';
const dim = '\x1b[2m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const cyan = '\x1b[36m';
const yellow = '\x1b[33m';
const magenta = '\x1b[35m';

function getSpecFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.spec.mjs'))
    .sort()
    .map(file => path.join(dir, file));
}

async function main() {
  console.log(`\n${bold}${cyan}======================================================================${reset}`);
  console.log(`${bold}${cyan} 🧪 CEREBRO & VAULT AUTO-SYNC — 4-TIER E2E TEST RUNNER${reset}`);
  console.log(`${dim} Target: Next.js Cerebro Dashboard & Obsidian Local Vault${reset}`);
  console.log(`${cyan}======================================================================${reset}\n`);

  const tiers = [
    { name: 'Tier 1: Feature Coverage (F1 to F13)', dir: path.join(__dirname, 'tier1-features'), color: green },
    { name: 'Tier 2: Boundary & Corner Cases (B1 to B13)', dir: path.join(__dirname, 'tier2-boundaries'), color: yellow },
    { name: 'Tier 3: Cross-Feature Combinations', dir: path.join(__dirname, 'tier3-combinations'), color: magenta },
    { name: 'Tier 4: Real-World Application Scenarios', dir: path.join(__dirname, 'tier4-realworld'), color: cyan },
  ];

  const loadedFiles = [];
  for (const tier of tiers) {
    const files = getSpecFiles(tier.dir);
    for (const f of files) {
      await import(`file://${f.replace(/\\/g, '/')}`);
      loadedFiles.push({ file: f, tier: tier.name });
    }
  }

  const results = await runAllSuites();

  // Print results grouped by tier
  console.log(`${bold}Executing Test Suites...${reset}\n`);
  
  for (const suite of results.suiteSummaries) {
    const statusIcon = suite.failed === 0 ? `${green}✔${reset}` : `${red}✖${reset}`;
    console.log(`  ${statusIcon} ${bold}${suite.name}${reset} ${dim}(${suite.duration}ms)${reset}`);
    for (const t of suite.tests) {
      if (t.status === 'pass') {
        console.log(`    ${green}•${reset} ${dim}${t.name}${reset}`);
      } else {
        console.log(`    ${red}✖ ${t.name}${reset}`);
        console.log(`      ${red}Error: ${t.error}${reset}`);
      }
    }
  }

  console.log(`\n${bold}${cyan}----------------------------------------------------------------------${reset}`);
  console.log(`${bold}SUMMARY BREAKDOWN${reset}`);
  console.log(`${cyan}----------------------------------------------------------------------${reset}`);
  console.log(`  Total Suites   : ${bold}${results.totalSuites}${reset}`);
  console.log(`  Total Tests    : ${bold}${results.totalTests}${reset}`);
  console.log(`  Passed Tests   : ${bold}${green}${results.passed}${reset}`);
  console.log(`  Failed Tests   : ${results.failed === 0 ? green + '0' : bold + red + results.failed}${reset}`);
  console.log(`  Execution Time : ${results.durationMs}ms`);
  console.log(`  Pass Rate      : ${results.failed === 0 ? bold + green + '100%' : (results.passed / results.totalTests * 100).toFixed(1) + '%'}${reset}`);
  console.log(`${cyan}======================================================================${reset}\n`);

  if (results.failed > 0) {
    console.error(`${bold}${red}FAILED: ${results.failed} test(s) failed.${reset}\n`);
    process.exit(1);
  } else {
    console.log(`${bold}${green}SUCCESS: All ${results.totalTests} E2E tests passed cleanly!${reset}\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error(`${red}Fatal error running E2E test suite:${reset}`, err);
  process.exit(1);
});
