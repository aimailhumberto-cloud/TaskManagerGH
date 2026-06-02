const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('\n======================================================');
console.log('   Hermes Task Hub - E2E Test Execution Runner');
console.log('======================================================\n');

// Ensure node_modules exists
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.warn('⚠️  Warning: node_modules directory not detected.');
  console.warn('   Please ensure you have run "npm install" before running tests.\n');
}

// Prepare command to run Playwright with JSON reporter to stdout
const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';
const args = ['playwright', 'test', '--reporter=json'];

console.log(`🚀 Executing: npx playwright test --reporter=json ...\n`);

const child = spawn(npxCmd, args, {
  cwd: __dirname,
  env: { ...process.env, DATABASE_PATH: 'data/db_test.json', FORCE_COLOR: '1' },
  shell: true
});

let stdoutData = '';
let stderrData = '';

child.stdout.on('data', (data) => {
  stdoutData += data.toString();
});

child.stderr.on('data', (data) => {
  stderrData += data.toString();
});

child.on('close', (code) => {
  try {
    const jsonStart = stdoutData.indexOf('{');
    const jsonEnd = stdoutData.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      if (stderrData) {
        console.error('❌ Playwright Error Output:');
        console.error(stderrData);
      }
      console.error('❌ Failed to parse JSON report. Playwright stdout was:');
      console.error(stdoutData || '(empty stdout)');
      process.exit(code || 1);
    }
    
    const jsonStr = stdoutData.substring(jsonStart, jsonEnd + 1);
    const report = JSON.parse(jsonStr);
    
    const fileSet = new Set();
    let totalSpecs = 0;
    let passedSpecs = 0;
    let failedSpecs = 0;
    let skippedSpecs = 0;
    
    function traverse(suite) {
      if (suite.file) {
        fileSet.add(suite.file);
      }
      if (suite.specs) {
        for (const spec of suite.specs) {
          totalSpecs++;
          let specPassed = false;
          let specFailed = false;
          let specSkipped = false;
          
          if (spec.tests && spec.tests.length > 0) {
            for (const run of spec.tests) {
              if (run.status === 'expected') {
                specPassed = true;
              } else if (run.status === 'unexpected' || (run.results && run.results.some(r => r.status === 'failed'))) {
                specFailed = true;
              } else if (run.status === 'skipped') {
                specSkipped = true;
              }
            }
          }
          
          if (specFailed) {
            failedSpecs++;
          } else if (specSkipped) {
            skippedSpecs++;
          } else if (specPassed) {
            passedSpecs++;
          } else {
            // Default or fallback
            passedSpecs++;
          }
        }
      }
      if (suite.suites) {
        for (const subSuite of suite.suites) {
          traverse(subSuite);
        }
      }
    }
    
    if (report.suites) {
      for (const rootSuite of report.suites) {
        traverse(rootSuite);
      }
    }
    
    const durationMs = report.stats ? report.stats.duration : 0;
    const durationSec = (durationMs / 1000).toFixed(2);
    
    console.log('======================================================');
    console.log('                  E2E TEST SUMMARY                    ');
    console.log('======================================================');
    console.log(`📂 Unique Test Files Analyzed : ${fileSet.size}`);
    console.log(`📋 Total Test Cases Found     : ${totalSpecs}`);
    console.log(`🟩 Passed Test Cases          : ${passedSpecs}`);
    console.log(`🟥 Failed Test Cases          : ${failedSpecs}`);
    console.log(`🟨 Skipped Test Cases         : ${skippedSpecs}`);
    console.log(`⏱️  Total Duration             : ${durationSec} seconds`);
    console.log('======================================================');
    
    if (failedSpecs > 0) {
      console.log('\n❌ RESULT: SOME TESTS FAILED!\n');
      process.exit(1);
    } else if (totalSpecs === 0) {
      console.log('\n⚠️  RESULT: NO TESTS WERE RUN (0 suites / 0 cases).\n');
      process.exit(0);
    } else {
      console.log('\n✅ RESULT: ALL E2E TESTS PASSED SUCCESSFULLY!\n');
      process.exit(0);
    }
    
  } catch (err) {
    console.error('❌ An error occurred during JSON report parsing or traversal:', err);
    if (stdoutData) {
      console.log('\nRaw stdout output from Playwright:');
      console.log(stdoutData);
    }
    process.exit(1);
  }
});
