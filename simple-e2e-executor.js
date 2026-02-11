#!/usr/bin/env node

/**
 * Simple E2E Test Executor using Agents in Subprocesses
 * This demonstrates the framework testing itself
 */

const { spawn } = require('child_process');
const path = require('path');

async function executeTest(scenarioPath) {
  console.log('🚀 Gadugi E2E Test Executor');
  console.log('═══════════════════════════════════════\n');
  console.log(`📋 Scenario: ${path.basename(scenarioPath)}\n`);

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const testProcess = spawn('node', [
      'dist/cli.js',
      'run',
      scenarioPath
    ], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    testProcess.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    testProcess.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    testProcess.on('close', (code) => {
      const duration = Date.now() - startTime;
      
      console.log('\n═══════════════════════════════════════');
      console.log('📊 Test Results:');
      console.log(`   Exit Code: ${code}`);
      console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
      
      if (code === 0) {
        console.log('   Status: ✅ PASSED');
        resolve({ code, duration, stdout, stderr });
      } else {
        console.log('   Status: ❌ FAILED');
        reject(new Error(`Test failed with exit code ${code}`));
      }
    });

    testProcess.on('error', (error) => {
      console.error('❌ Failed to start test:', error.message);
      reject(error);
    });
  });
}

// Get scenario from command line or use default
const scenarioPath = process.argv[2] || 'scenarios/e2e-scenario-adapter-validation.yaml';

executeTest(scenarioPath)
  .then(result => {
    console.log('\n✅ E2E test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ E2E test failed:', error.message);
    process.exit(1);
  });
