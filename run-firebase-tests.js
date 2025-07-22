#!/usr/bin/env node
// 🚀 Firebase Notification System - Test Runner
// This script orchestrates comprehensive testing of the Firebase notification system

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 🎯 TEST RUNNER CONFIGURATION
const TEST_CONFIG = {
  SERVER_START_DELAY: 5000,      // Wait 5s for server to start
  BASIC_TEST_TIMEOUT: 600000,     // 10 minutes for basic test
  LOAD_TEST_TIMEOUT: 1800000,     // 30 minutes for load test
  MONITOR_DURATION: 300000,       // 5 minutes monitoring
  PARALLEL_TESTS: false,          // Run tests sequentially by default
  AUTO_START_SERVER: false,       // Don't auto-start server by default
  SAVE_REPORTS: true             // Save test reports
};

class FirebaseTestRunner {
  constructor() {
    this.processes = [];
    this.results = {
      basic: null,
      load: null,
      monitor: null,
      startTime: Date.now(),
      endTime: null
    };
    this.isRunning = false;
  }

  // 🚀 MAIN TEST ORCHESTRATOR
  async runAllTests(options = {}) {
    console.log('🔥 Firebase Notification System - Comprehensive Test Runner');
    console.log('=' .repeat(80));
    console.log('📊 Test Configuration:', {
      basicTestTimeout: `${TEST_CONFIG.BASIC_TEST_TIMEOUT / 1000}s`,
      loadTestTimeout: `${TEST_CONFIG.LOAD_TEST_TIMEOUT / 1000}s`,
      monitorDuration: `${TEST_CONFIG.MONITOR_DURATION / 1000}s`,
      parallelTests: TEST_CONFIG.PARALLEL_TESTS,
      autoStartServer: TEST_CONFIG.AUTO_START_SERVER
    });

    try {
      this.isRunning = true;

      // Phase 1: Pre-flight checks
      await this.performPreflightChecks();

      // Phase 2: Start server if needed
      if (options.autoStartServer || TEST_CONFIG.AUTO_START_SERVER) {
        await this.startServer();
      }

      // Phase 3: Verify system readiness
      await this.verifySystemReadiness();

      // Phase 4: Run test suite
      if (TEST_CONFIG.PARALLEL_TESTS) {
        await this.runTestsParallel(options);
      } else {
        await this.runTestsSequential(options);
      }

      // Phase 5: Generate consolidated report
      await this.generateConsolidatedReport();

    } catch (error) {
      console.error('❌ Test runner failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  // ✈️ PRE-FLIGHT CHECKS
  async performPreflightChecks() {
    console.log('\n✈️ Performing pre-flight checks...');

    const checks = [
      { name: 'Node.js Version', check: () => this.checkNodeVersion() },
      { name: 'Dependencies', check: () => this.checkDependencies() },
      { name: 'Test Scripts', check: () => this.checkTestScripts() },
      { name: 'System Resources', check: () => this.checkSystemResources() }
    ];

    for (const check of checks) {
      try {
        const result = await check.check();
        console.log(`✅ ${check.name}: ${result}`);
      } catch (error) {
        console.error(`❌ ${check.name} failed: ${error.message}`);
        throw error;
      }
    }

    console.log('✅ All pre-flight checks passed');
  }

  checkNodeVersion() {
    const version = process.version;
    const majorVersion = parseInt(version.slice(1).split('.')[0]);
    
    if (majorVersion < 16) {
      throw new Error(`Node.js v16+ required, found ${version}`);
    }
    
    return version;
  }

  checkDependencies() {
    const requiredDeps = ['axios', 'ws', 'uuid'];
    const missing = [];

    for (const dep of requiredDeps) {
      try {
        require.resolve(dep);
      } catch (error) {
        missing.push(dep);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing dependencies: ${missing.join(', ')}. Run: npm install ${missing.join(' ')}`);
    }

    return 'All required dependencies found';
  }

  checkTestScripts() {
    const requiredScripts = [
      'firebase-notification-test-environment.js',
      'firebase-load-test-millions.js',
      'firebase-notification-monitor.js'
    ];

    const missing = requiredScripts.filter(script => !fs.existsSync(script));

    if (missing.length > 0) {
      throw new Error(`Missing test scripts: ${missing.join(', ')}`);
    }

    return 'All test scripts found';
  }

  checkSystemResources() {
    const freeMemory = Math.round(require('os').freemem() / 1024 / 1024); // MB
    const cpuCount = require('os').cpus().length;

    if (freeMemory < 2000) { // Less than 2GB
      throw new Error(`Insufficient memory: ${freeMemory}MB (minimum 2GB required)`);
    }

    return `${cpuCount} CPUs, ${freeMemory}MB free`;
  }

  // 🖥️ START SERVER
  async startServer() {
    console.log('\n🖥️ Starting application server...');
    
         try {
       // Check if server is already running
       const axios = require('axios');
       await axios.get('http://localhost:3001/api/enterprise/health', { timeout: 3000 });
       console.log('✅ Server is already running');
       return;
     } catch (error) {
       // Server is not running, start it
     }

    return new Promise((resolve, reject) => {
      const serverProcess = spawn('npm', ['run', 'dev'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });

      let serverReady = false;
      let serverOutput = '';

      serverProcess.stdout.on('data', (data) => {
        serverOutput += data.toString();
        
        if (data.toString().includes('Server running on port 3001') || 
            data.toString().includes('🚀')) {
          serverReady = true;
          setTimeout(() => resolve(serverProcess), TEST_CONFIG.SERVER_START_DELAY);
        }
      });

      serverProcess.stderr.on('data', (data) => {
        console.warn('Server stderr:', data.toString());
      });

      serverProcess.on('error', (error) => {
        reject(new Error(`Failed to start server: ${error.message}`));
      });

      serverProcess.on('exit', (code) => {
        if (code !== 0 && !serverReady) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!serverReady) {
          serverProcess.kill();
          reject(new Error('Server startup timeout (30s)'));
        }
      }, 30000);

      this.processes.push(serverProcess);
    });
  }

  // 🔍 VERIFY SYSTEM READINESS
  async verifySystemReadiness() {
    console.log('\n🔍 Verifying system readiness...');

    const axios = require('axios');
         const readinessChecks = [
       {
         name: 'API Health',
         url: 'http://localhost:3001/api/enterprise/health',
         expected: 200
       },
       {
         name: 'Enterprise Stats',
         url: 'http://localhost:3001/api/enterprise/stats',
         expected: [200, 401] // 401 is OK (no auth token)
       }
     ];

    for (const check of readinessChecks) {
      try {
        const response = await axios.get(check.url, { timeout: 5000 });
        const expectedCodes = Array.isArray(check.expected) ? check.expected : [check.expected];
        
        if (expectedCodes.includes(response.status)) {
          console.log(`✅ ${check.name}: Ready (HTTP ${response.status})`);
        } else {
          throw new Error(`Unexpected status: ${response.status}`);
        }
      } catch (error) {
        if (error.response && Array.isArray(check.expected) && check.expected.includes(error.response.status)) {
          console.log(`✅ ${check.name}: Ready (HTTP ${error.response.status})`);
        } else {
          throw new Error(`${check.name} not ready: ${error.message}`);
        }
      }
    }

    console.log('✅ System is ready for testing');
  }

  // 🔄 RUN TESTS SEQUENTIALLY
  async runTestsSequential(options) {
    console.log('\n🔄 Running tests sequentially...');

    const testSuite = [];

    if (!options.skipBasic) {
      testSuite.push({
        name: 'Basic Notification Tests',
        script: 'firebase-notification-test-environment.js',
        timeout: TEST_CONFIG.BASIC_TEST_TIMEOUT,
        key: 'basic'
      });
    }

    if (options.includeLoad) {
      testSuite.push({
        name: 'Load Testing',
        script: 'firebase-load-test-millions.js',
        timeout: TEST_CONFIG.LOAD_TEST_TIMEOUT,
        key: 'load'
      });
    }

    if (options.includeMonitor) {
      testSuite.push({
        name: 'Real-time Monitoring',
        script: 'firebase-notification-monitor.js',
        timeout: TEST_CONFIG.MONITOR_DURATION,
        key: 'monitor',
        killAfterTimeout: true
      });
    }

    for (const test of testSuite) {
      console.log(`\n🧪 Starting: ${test.name}`);
      
      try {
        const result = await this.runSingleTest(test);
        this.results[test.key] = {
          success: true,
          result: result,
          duration: result.duration
        };
        
        console.log(`✅ ${test.name} completed successfully`);
        
      } catch (error) {
        this.results[test.key] = {
          success: false,
          error: error.message,
          duration: 0
        };
        
        console.error(`❌ ${test.name} failed: ${error.message}`);
        
        if (options.stopOnError) {
          throw error;
        }
      }

      // Wait between tests
      if (testSuite.indexOf(test) < testSuite.length - 1) {
        console.log('⏸️ Waiting 10 seconds between tests...');
        await this.sleep(10000);
      }
    }
  }

  // ⚡ RUN TESTS PARALLEL
  async runTestsParallel(options) {
    console.log('\n⚡ Running tests in parallel...');

    const testPromises = [];

    if (!options.skipBasic) {
      testPromises.push(
        this.runSingleTest({
          name: 'Basic Tests',
          script: 'firebase-notification-test-environment.js',
          timeout: TEST_CONFIG.BASIC_TEST_TIMEOUT
        }).then(result => ({ key: 'basic', result }))
      );
    }

    if (options.includeLoad) {
      testPromises.push(
        this.runSingleTest({
          name: 'Load Tests',
          script: 'firebase-load-test-millions.js',
          timeout: TEST_CONFIG.LOAD_TEST_TIMEOUT
        }).then(result => ({ key: 'load', result }))
      );
    }

    const results = await Promise.allSettled(testPromises);

    results.forEach((result, index) => {
      const testKey = testPromises[index].key || `test_${index}`;
      
      if (result.status === 'fulfilled') {
        this.results[result.value.key] = {
          success: true,
          result: result.value.result,
          duration: result.value.result.duration
        };
      } else {
        this.results[testKey] = {
          success: false,
          error: result.reason.message,
          duration: 0
        };
      }
    });
  }

  // 🧪 RUN SINGLE TEST
  async runSingleTest(testConfig) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const testProcess = spawn('node', [testConfig.script], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';
      
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
        // Log progress for long-running tests
        if (testConfig.timeout > 60000) {
          process.stdout.write('.');
        }
      });

      testProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      testProcess.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        if (code === 0) {
          resolve({
            success: true,
            output: output,
            duration: duration,
            exitCode: code
          });
        } else {
          reject(new Error(`Test failed with exit code ${code}. Error: ${errorOutput}`));
        }
      });

      testProcess.on('error', (error) => {
        reject(new Error(`Failed to start test: ${error.message}`));
      });

      // Set timeout
      const timeout = setTimeout(() => {
        if (testConfig.killAfterTimeout) {
          testProcess.kill();
          resolve({
            success: true,
            output: output,
            duration: testConfig.timeout,
            exitCode: 0,
            timedOut: true
          });
        } else {
          testProcess.kill();
          reject(new Error(`Test timeout after ${testConfig.timeout}ms`));
        }
      }, testConfig.timeout);

      testProcess.on('close', () => {
        clearTimeout(timeout);
      });

      this.processes.push(testProcess);
    });
  }

  // 📊 GENERATE CONSOLIDATED REPORT
  async generateConsolidatedReport() {
    console.log('\n📊 Generating consolidated test report...');
    
    this.results.endTime = Date.now();
    const totalDuration = this.results.endTime - this.results.startTime;

    console.log('\n' + '='.repeat(80));
    console.log('🔥 FIREBASE NOTIFICATION SYSTEM - COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(80));

    console.log(`\n⏱️ Total Test Duration: ${(totalDuration / 1000).toFixed(2)} seconds`);

    // Test Results Summary
    console.log('\n📋 TEST RESULTS SUMMARY:');
    let totalTests = 0;
    let passedTests = 0;

    Object.entries(this.results).forEach(([key, result]) => {
      if (typeof result === 'object' && result !== null && key !== 'startTime' && key !== 'endTime') {
        totalTests++;
        
        const testName = key.charAt(0).toUpperCase() + key.slice(1) + ' Tests';
        const status = result.success ? '✅ PASSED' : '❌ FAILED';
        const duration = result.duration ? `(${(result.duration / 1000).toFixed(2)}s)` : '';
        
        console.log(`${status} ${testName} ${duration}`);
        
        if (result.success) {
          passedTests++;
        } else {
          console.log(`  Error: ${result.error}`);
        }
      }
    });

    // Overall Status
    console.log('\n🎯 OVERALL STATUS:');
    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    console.log(`📊 Success Rate: ${successRate.toFixed(2)}% (${passedTests}/${totalTests})`);
    
    let overallStatus = '🏆 ALL TESTS PASSED';
    if (successRate < 100) {
      overallStatus = successRate >= 50 ? '⚠️ SOME TESTS FAILED' : '❌ MAJORITY OF TESTS FAILED';
    }
    console.log(`🏅 ${overallStatus}`);

    // System Assessment
    console.log('\n🏢 ENTERPRISE READINESS ASSESSMENT:');
    if (this.results.basic?.success) {
      console.log('✅ Basic functionality verified');
    }
    if (this.results.load?.success) {
      console.log('✅ System handles high load');
    }
    if (this.results.monitor?.success) {
      console.log('✅ Monitoring system operational');
    }

    const recommendations = [];
    if (!this.results.basic?.success) {
      recommendations.push('Fix basic notification functionality before production');
    }
    if (!this.results.load?.success) {
      recommendations.push('Optimize system for high concurrent load');
    }

    if (recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      recommendations.forEach(rec => console.log(`  - ${rec}`));
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎉 COMPREHENSIVE TEST EXECUTION COMPLETED');
    console.log('='.repeat(80));

    // Save report to file
    if (TEST_CONFIG.SAVE_REPORTS) {
      await this.saveConsolidatedReport();
    }
  }

  async saveConsolidatedReport() {
    const reportData = {
      timestamp: new Date().toISOString(),
      totalDuration: this.results.endTime - this.results.startTime,
      results: this.results,
      summary: {
        totalTests: Object.keys(this.results).filter(k => !['startTime', 'endTime'].includes(k)).length,
        passedTests: Object.values(this.results).filter(r => r && r.success).length
      }
    };

    const reportFilename = `firebase-comprehensive-test-report-${Date.now()}.json`;
    
    try {
      fs.writeFileSync(reportFilename, JSON.stringify(reportData, null, 2));
      console.log(`📄 Comprehensive report saved to: ${reportFilename}`);
    } catch (error) {
      console.warn(`⚠️ Could not save report: ${error.message}`);
    }
  }

  // 🧹 CLEANUP
  async cleanup() {
    console.log('\n🧹 Cleaning up test environment...');
    this.isRunning = false;

    // Kill all running processes
    for (const process of this.processes) {
      try {
        if (process && !process.killed) {
          process.kill('SIGTERM');
          
          // Force kill after 5 seconds
          setTimeout(() => {
            if (!process.killed) {
              process.kill('SIGKILL');
            }
          }, 5000);
        }
      } catch (error) {
        console.warn(`⚠️ Error terminating process: ${error.message}`);
      }
    }

    console.log('✅ Cleanup completed');
  }

  // 🛠️ UTILITIES
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 📋 COMMAND LINE INTERFACE
function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  const options = {
    skipBasic: false,
    includeLoad: false,
    includeMonitor: false,
    autoStartServer: false,
    stopOnError: false
  };

  args.forEach(arg => {
    switch (arg) {
      case '--skip-basic':
        options.skipBasic = true;
        break;
      case '--include-load':
        options.includeLoad = true;
        break;
      case '--include-monitor':
        options.includeMonitor = true;
        break;
      case '--auto-start-server':
        options.autoStartServer = true;
        break;
      case '--stop-on-error':
        options.stopOnError = true;
        break;
      case '--all':
        options.includeLoad = true;
        options.includeMonitor = true;
        break;
      case '--help':
        printUsage();
        process.exit(0);
        break;
    }
  });

  return options;
}

function printUsage() {
  console.log(`
🔥 Firebase Notification Test Runner

Usage: node run-firebase-tests.js [options]

Options:
  --skip-basic          Skip basic notification tests
  --include-load        Include load testing (high resource usage)
  --include-monitor     Include real-time monitoring test
  --auto-start-server   Automatically start the application server
  --stop-on-error       Stop execution on first test failure
  --all                 Run all tests (basic + load + monitor)
  --help                Show this help message

Examples:
  node run-firebase-tests.js                    # Run basic tests only
  node run-firebase-tests.js --all              # Run all tests
  node run-firebase-tests.js --include-load     # Basic + load tests
  node run-firebase-tests.js --auto-start-server --all  # Start server + all tests

Note: Make sure your application server is running on localhost:3001
or use --auto-start-server to start it automatically.
`);
}

// 🚀 MAIN EXECUTION
if (require.main === module) {
  const options = parseCommandLineArgs();
  const testRunner = new FirebaseTestRunner();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Test execution interrupted. Cleaning up...');
    await testRunner.cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Test execution terminated. Cleaning up...');
    await testRunner.cleanup();
    process.exit(0);
  });

  // Run tests
  testRunner.runAllTests(options)
    .then(() => {
      console.log('🎉 All tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = FirebaseTestRunner; 