#!/usr/bin/env ts-node

/**
 * Basic usage example for ProcessLifecycleManager and TUIAgent
 *
 * This example demonstrates:
 * 1. Basic process management
 * 2. TUI agent usage
 * 3. Zombie process prevention
 * 4. Proper cleanup
 */

import { ProcessLifecycleManager, TUIAgent } from '../src';

async function demonstrateProcessManager() {
  console.log('\n=== ProcessLifecycleManager Demo ===');

  const manager = new ProcessLifecycleManager();

  // Event handlers
  manager.on('processStarted', (processInfo) => {
    console.log(`✅ Started process: ${processInfo.command} (PID: ${processInfo.pid})`);
  });

  manager.on('processExited', (processInfo, code) => {
    console.log(`🏁 Process exited: ${processInfo.command} (PID: ${processInfo.pid}, code: ${code})`);
  });

  manager.on('processKilled', (processInfo) => {
    console.log(`💀 Process killed: ${processInfo.command} (PID: ${processInfo.pid})`);
  });

  try {
    // Start several processes
    console.log('\nStarting multiple processes...');

    const process1 = manager.startProcess('echo', ['Hello from process 1']);
    const process2 = manager.startProcess('echo', ['Hello from process 2']);
    const process3 = manager.startProcess('sleep', ['2']);

    console.log(`\nRunning processes: ${manager.getRunningProcesses().length}`);

    // Wait for echo processes to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`Running processes after echo completion: ${manager.getRunningProcesses().length}`);

    // Kill the sleep process
    await manager.killProcess(process3.pid!, 'SIGTERM');

    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log(`Final running processes: ${manager.getRunningProcesses().length}`);
    console.log(`Total processes managed: ${manager.getProcesses().length}`);

  } finally {
    // Cleanup
    await manager.shutdown();
    console.log('🧹 ProcessLifecycleManager cleanup complete');
  }
}

async function demonstrateTUIAgent() {
  console.log('\n=== TUIAgent Demo ===');

  const manager = new ProcessLifecycleManager();
  const agent = new TUIAgent({
    dimensions: { cols: 80, rows: 24 }
  }, manager);

  // Event handlers
  agent.on('ready', () => {
    console.log('📺 TUI Agent ready');
  });

  agent.on('data', (data) => {
    // Only log significant output to avoid spam
    if (data.includes('example-output')) {
      console.log('📤 Received output:', data.trim());
    }
  });

  try {
    // Start the terminal
    console.log('\nStarting TUI agent...');
    await agent.start();

    // Execute some commands
    console.log('\nExecuting commands...');

    const result1 = await agent.executeCommand('echo "example-output: Hello World"', {
      expectedOutput: 'Hello World',
      timeout: 5000
    });
    console.log('Command 1 result length:', result1.length);

    const result2 = await agent.executeCommand('pwd', {
      timeout: 5000
    });
    console.log('Current directory detected:', result2.includes('/'));

    const result3 = await agent.executeCommand('echo "Process management test"', {
      expectedOutput: 'Process management',
      timeout: 5000
    });
    console.log('Command 3 completed successfully');

    // Show process info
    const processInfo = agent.getProcessInfo();
    console.log(`\nAgent process info: PID ${processInfo?.pid}, Status: ${processInfo?.status}`);

  } catch (error) {
    console.error('❌ TUI Agent error:', error);
  } finally {
    // Cleanup
    await agent.destroy();
    await manager.shutdown();
    console.log('🧹 TUI Agent cleanup complete');
  }
}

async function demonstrateZombieProcessPrevention() {
  console.log('\n=== Zombie Process Prevention Demo ===');

  const manager = new ProcessLifecycleManager();
  let cleanupCount = 0;

  manager.on('cleanupComplete', (count) => {
    cleanupCount = count;
    console.log(`🧟‍♂️ Cleaned up ${count} processes - no zombies!`);
  });

  try {
    console.log('\nCreating many processes that could become zombies...');

    const processes = [];

    // Create processes that spawn children (potential zombie creators)
    for (let i = 0; i < 5; i++) {
      const process = manager.startProcess('sh', [
        '-c',
        `echo "Parent process ${i}"; for j in 1 2 3; do (echo "Child ${i}-${j}" &); done; sleep 1`
      ]);
      processes.push(process);
    }

    console.log(`Started ${processes.length} parent processes`);

    // Let them run and spawn children
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`Current running processes: ${manager.getRunningProcesses().length}`);

    // Force shutdown (simulating abrupt termination)
    console.log('\nForcing shutdown to test zombie prevention...');
    await manager.shutdown(3000);

    console.log(`Processes cleaned up: ${cleanupCount}`);
    console.log(`Remaining running processes: ${manager.getRunningProcesses().length}`);

  } finally {
    // Final cleanup
    await manager.shutdown();
    console.log('🏆 Zombie prevention demo complete - no zombies should remain!');
  }
}

async function demonstrateMultipleAgents() {
  console.log('\n=== Multiple TUI Agents Demo ===');

  const manager = new ProcessLifecycleManager();
  const agents: TUIAgent[] = [];

  try {
    console.log('\nCreating multiple TUI agents...');

    // Create several agents
    for (let i = 0; i < 3; i++) {
      const agent = new TUIAgent({
        dimensions: { cols: 80, rows: 24 }
      }, manager);

      await agent.start();
      agents.push(agent);
      console.log(`🚀 Started agent ${i + 1}`);
    }

    // Execute commands on all agents simultaneously
    console.log('\nExecuting commands on all agents...');

    const commandPromises = agents.map(async (agent, index) => {
      return agent.executeCommand(`echo "Agent ${index + 1} executing"`, {
        expectedOutput: `Agent ${index + 1}`,
        timeout: 5000
      });
    });

    const results = await Promise.all(commandPromises);
    console.log(`All ${results.length} agents completed their commands`);

    console.log(`Total processes managed: ${manager.getProcesses().length}`);
    console.log(`Currently running: ${manager.getRunningProcesses().length}`);

  } finally {
    // Cleanup all agents
    console.log('\nCleaning up all agents...');
    await Promise.all(agents.map(agent => agent.destroy()));
    await manager.shutdown();
    console.log('🧹 Multi-agent cleanup complete');
  }
}

async function main() {
  console.log('🎯 Gadugi Agentic Test Framework - Basic Usage Examples');
  console.log('======================================================');

  try {
    await demonstrateProcessManager();
    await demonstrateTUIAgent();
    await demonstrateZombieProcessPrevention();
    await demonstrateMultipleAgents();

    console.log('\n✅ All demos completed successfully!');
    console.log('🎉 No zombie processes should remain in the system');

  } catch (error) {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  }
}

// Handle cleanup on script termination
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT - cleaning up...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM - cleaning up...');
  process.exit(0);
});

if (require.main === module) {
  main();
}