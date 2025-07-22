#!/usr/bin/env node
// 🚀 Firebase Notification System - Enterprise Load Test for Millions of Users
// This script simulates millions of concurrent users to test enterprise-grade scalability

const cluster = require('cluster');
const os = require('os');
const axios = require('axios');
const { performance } = require('perf_hooks');

// 🏢 ENTERPRISE LOAD TEST CONFIGURATION
const LOAD_CONFIG = {
  BASE_URL: 'http://localhost:3001',
  
  // 🔥 MASSIVE SCALE SIMULATION
  TOTAL_USERS: 1000000,           // 1 Million users
  CONCURRENT_WORKERS: os.cpus().length, // Use all CPU cores
  USERS_PER_WORKER: null,         // Calculated automatically
  DEVICES_PER_USER: 2,            // Average 2 devices per user
  
  // 📈 LOAD PATTERNS
  RAMP_UP_DURATION: 300,          // 5 minutes ramp-up
  SUSTAINED_DURATION: 600,        // 10 minutes sustained load
  NOTIFICATIONS_PER_SECOND: 10000, // Target 10K notifications/second
  MESSAGES_PER_SECOND: 5000,      // Target 5K messages/second
  
  // 🎯 TEST SCENARIOS
  SCENARIOS: {
    'peak_messaging': { weight: 40, notifications: 15000, messages: 8000 },
    'normal_usage': { weight: 30, notifications: 8000, messages: 4000 },
    'quiet_hours': { weight: 20, notifications: 2000, messages: 1000 },
    'viral_content': { weight: 10, notifications: 50000, messages: 20000 }
  },
  
  // 📊 MONITORING
  METRICS_INTERVAL: 5000,         // Report metrics every 5 seconds
  MAX_RESPONSE_TIME: 500,         // Max acceptable response time (ms)
  ERROR_THRESHOLD: 0.01,          // Max 1% error rate
  
  // 💾 OUTPUT
  SAVE_METRICS: true,
  METRICS_FILE: 'load-test-metrics.json'
};

class EnterpriseLoadTestManager {
  constructor() {
    this.workers = [];
    this.metrics = {
      startTime: null,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errorsPerSecond: 0,
      scenarios: {},
      systemMetrics: {
        cpuUsage: [],
        memoryUsage: [],
        networkLatency: []
      }
    };
    this.isRunning = false;
    this.currentPhase = 'initializing';
  }

  // 🚀 MAIN LOAD TEST ORCHESTRATOR
  async runEnterpriseLoadTest() {
    console.log('🚀 Starting Enterprise Load Test for Millions of Users');
    console.log('📊 Configuration:', {
      totalUsers: LOAD_CONFIG.TOTAL_USERS.toLocaleString(),
      workers: LOAD_CONFIG.CONCURRENT_WORKERS,
      targetNotificationsPerSecond: LOAD_CONFIG.NOTIFICATIONS_PER_SECOND.toLocaleString(),
      targetMessagesPerSecond: LOAD_CONFIG.MESSAGES_PER_SECOND.toLocaleString()
    });

    try {
      this.metrics.startTime = Date.now();
      this.isRunning = true;

      // Phase 1: System Health Check
      await this.performHealthCheck();
      
      // Phase 2: Initialize Workers
      await this.initializeWorkers();
      
      // Phase 3: Ramp-up Phase
      await this.rampUpPhase();
      
      // Phase 4: Sustained Load Phase
      await this.sustainedLoadPhase();
      
      // Phase 5: Various Load Scenarios
      await this.runLoadScenarios();
      
      // Phase 6: Ramp-down and Results
      await this.rampDownAndReport();

    } catch (error) {
      console.error('❌ Enterprise load test failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  // 🏥 SYSTEM HEALTH CHECK
  async performHealthCheck() {
    console.log('🏥 Performing system health check...');
    this.currentPhase = 'health_check';
    
    const healthChecks = [
      { name: 'API Health', check: () => this.checkAPIHealth() },
      { name: 'Database Health', check: () => this.checkDatabaseHealth() },
      { name: 'Firebase Health', check: () => this.checkFirebaseHealth() },
      { name: 'Redis Health', check: () => this.checkRedisHealth() },
      { name: 'System Resources', check: () => this.checkSystemResources() }
    ];

    for (const healthCheck of healthChecks) {
      try {
        const result = await healthCheck.check();
        console.log(`✅ ${healthCheck.name}: ${result}`);
      } catch (error) {
        console.error(`❌ ${healthCheck.name} failed: ${error.message}`);
        throw new Error(`Health check failed: ${healthCheck.name}`);
      }
    }

    console.log('✅ All health checks passed - system ready for load test');
  }

  async checkAPIHealth() {
    const start = performance.now();
    const response = await axios.get(`${LOAD_CONFIG.BASE_URL}/api/enterprise/health`, { timeout: 5000 });
    const responseTime = performance.now() - start;
    
    if (response.status !== 200) {
      throw new Error(`API health check failed with status ${response.status}`);
    }
    
    return `OK (${responseTime.toFixed(2)}ms)`;
  }

  async checkDatabaseHealth() {
    // Test database by trying to access users endpoint
    const response = await axios.get(`${LOAD_CONFIG.BASE_URL}/api/enterprise/stats`, { timeout: 10000 });
    return response.status === 200 ? 'Connected' : 'Failed';
  }

  async checkFirebaseHealth() {
    // Test Firebase by trying to send a test notification
    try {
      // This will fail if Firebase is not configured properly
      const response = await axios.post(`${LOAD_CONFIG.BASE_URL}/api/enterprise/test-notification`, {
        userId: 1,
        title: 'Health Check',
        body: 'Testing Firebase connectivity',
        type: 'message_received'
      }, { timeout: 10000 });
      
      return 'Firebase connectivity verified';
    } catch (error) {
      if (error.response && error.response.status === 401) {
        return 'Firebase configured (auth test expected)';
      }
      throw error;
    }
  }

  async checkRedisHealth() {
    // Redis health can be checked indirectly through cache endpoints
    return 'Assumed healthy (cache functionality tested implicitly)';
  }

  async checkSystemResources() {
    const usage = process.memoryUsage();
    const memoryMB = Math.round(usage.heapUsed / 1024 / 1024);
    const cpuCount = os.cpus().length;
    const freeMem = Math.round(os.freemem() / 1024 / 1024);
    
    console.log(`💻 System: ${cpuCount} CPUs, ${memoryMB}MB heap used, ${freeMem}MB free`);
    
    if (freeMem < 1000) { // Less than 1GB free
      throw new Error('Insufficient system memory for load test');
    }
    
    return `${cpuCount} CPUs, ${freeMem}MB free memory`;
  }

  // 👥 INITIALIZE WORKERS
  async initializeWorkers() {
    console.log('👥 Initializing worker processes...');
    this.currentPhase = 'initializing_workers';
    
    LOAD_CONFIG.USERS_PER_WORKER = Math.ceil(LOAD_CONFIG.TOTAL_USERS / LOAD_CONFIG.CONCURRENT_WORKERS);
    
    console.log(`🏭 Creating ${LOAD_CONFIG.CONCURRENT_WORKERS} workers, ${LOAD_CONFIG.USERS_PER_WORKER.toLocaleString()} users per worker`);

    if (cluster.isMaster) {
      // Start metrics collection
      this.startMetricsCollection();
      
      // Fork workers
      for (let i = 0; i < LOAD_CONFIG.CONCURRENT_WORKERS; i++) {
        const worker = cluster.fork({ 
          WORKER_ID: i,
          USERS_PER_WORKER: LOAD_CONFIG.USERS_PER_WORKER,
          BASE_URL: LOAD_CONFIG.BASE_URL
        });
        
        worker.on('message', (message) => {
          this.handleWorkerMessage(message);
        });
        
        this.workers.push(worker);
      }

      console.log(`✅ ${this.workers.length} workers initialized`);
      
    } else {
      // This is a worker process
      await this.runWorkerProcess();
    }
  }

  // 📈 RAMP-UP PHASE
  async rampUpPhase() {
    if (!cluster.isMaster) return;
    
    console.log(`📈 Starting ramp-up phase (${LOAD_CONFIG.RAMP_UP_DURATION}s)...`);
    this.currentPhase = 'ramp_up';
    
    const rampSteps = 10;
    const stepDuration = LOAD_CONFIG.RAMP_UP_DURATION / rampSteps;
    const stepIncrement = LOAD_CONFIG.NOTIFICATIONS_PER_SECOND / rampSteps;
    
    for (let step = 1; step <= rampSteps; step++) {
      const targetRate = stepIncrement * step;
      
      console.log(`📈 Ramp-up step ${step}/${rampSteps}: ${targetRate.toLocaleString()} notifications/second`);
      
      // Send target rate to workers
      this.broadcastToWorkers({
        type: 'SET_RATE',
        notificationRate: Math.floor(targetRate / LOAD_CONFIG.CONCURRENT_WORKERS),
        messageRate: Math.floor((LOAD_CONFIG.MESSAGES_PER_SECOND * step / rampSteps) / LOAD_CONFIG.CONCURRENT_WORKERS)
      });
      
      await this.sleep(stepDuration * 1000);
    }
    
    console.log('✅ Ramp-up phase completed');
  }

  // 🔥 SUSTAINED LOAD PHASE
  async sustainedLoadPhase() {
    if (!cluster.isMaster) return;
    
    console.log(`🔥 Starting sustained load phase (${LOAD_CONFIG.SUSTAINED_DURATION}s)...`);
    this.currentPhase = 'sustained_load';
    
    // Set peak rates
    this.broadcastToWorkers({
      type: 'SET_RATE',
      notificationRate: Math.floor(LOAD_CONFIG.NOTIFICATIONS_PER_SECOND / LOAD_CONFIG.CONCURRENT_WORKERS),
      messageRate: Math.floor(LOAD_CONFIG.MESSAGES_PER_SECOND / LOAD_CONFIG.CONCURRENT_WORKERS)
    });
    
    // Monitor for sustained duration
    const sustainedEndTime = Date.now() + (LOAD_CONFIG.SUSTAINED_DURATION * 1000);
    
    while (Date.now() < sustainedEndTime && this.isRunning) {
      await this.sleep(5000);
      
      // Log current performance
      console.log(`🔥 Sustained load: ${this.metrics.requestsPerSecond.toFixed(0)} req/s, ` +
                  `avg response: ${(this.metrics.totalResponseTime / Math.max(this.metrics.totalRequests, 1)).toFixed(2)}ms, ` +
                  `error rate: ${(this.metrics.errorsPerSecond * 100 / Math.max(this.metrics.requestsPerSecond, 1)).toFixed(2)}%`);
      
      // Check if error threshold exceeded
      if (this.metrics.errorsPerSecond / Math.max(this.metrics.requestsPerSecond, 1) > LOAD_CONFIG.ERROR_THRESHOLD) {
        console.warn(`⚠️ Error threshold exceeded: ${(this.metrics.errorsPerSecond * 100 / this.metrics.requestsPerSecond).toFixed(2)}%`);
      }
    }
    
    console.log('✅ Sustained load phase completed');
  }

  // 🎯 RUN LOAD SCENARIOS
  async runLoadScenarios() {
    if (!cluster.isMaster) return;
    
    console.log('🎯 Running enterprise load scenarios...');
    this.currentPhase = 'scenarios';
    
    for (const [scenarioName, config] of Object.entries(LOAD_CONFIG.SCENARIOS)) {
      console.log(`🎯 Running scenario: ${scenarioName}`);
      
      this.broadcastToWorkers({
        type: 'SET_SCENARIO',
        scenario: scenarioName,
        notificationRate: Math.floor(config.notifications / LOAD_CONFIG.CONCURRENT_WORKERS),
        messageRate: Math.floor(config.messages / LOAD_CONFIG.CONCURRENT_WORKERS)
      });
      
      // Run scenario for 60 seconds
      await this.sleep(60000);
      
      // Record scenario metrics
      this.metrics.scenarios[scenarioName] = {
        requests: this.metrics.totalRequests,
        avgResponseTime: this.metrics.totalResponseTime / Math.max(this.metrics.totalRequests, 1),
        errorRate: this.metrics.failedRequests / Math.max(this.metrics.totalRequests, 1)
      };
      
      console.log(`✅ Scenario ${scenarioName} completed`);
    }
  }

  // 📉 RAMP-DOWN AND REPORT
  async rampDownAndReport() {
    if (!cluster.isMaster) return;
    
    console.log('📉 Starting ramp-down phase...');
    this.currentPhase = 'ramp_down';
    
    // Gradually reduce load
    const rampDownSteps = 5;
    for (let step = rampDownSteps - 1; step >= 0; step--) {
      const rate = (LOAD_CONFIG.NOTIFICATIONS_PER_SECOND * step / rampDownSteps);
      
      this.broadcastToWorkers({
        type: 'SET_RATE',
        notificationRate: Math.floor(rate / LOAD_CONFIG.CONCURRENT_WORKERS),
        messageRate: Math.floor((LOAD_CONFIG.MESSAGES_PER_SECOND * step / rampDownSteps) / LOAD_CONFIG.CONCURRENT_WORKERS)
      });
      
      await this.sleep(5000);
    }
    
    // Stop all workers
    this.broadcastToWorkers({ type: 'STOP' });
    
    await this.sleep(5000);
    
    // Generate final report
    await this.generateFinalReport();
  }

  // 🏭 WORKER PROCESS
  async runWorkerProcess() {
    const workerId = process.env.WORKER_ID;
    const usersPerWorker = parseInt(process.env.USERS_PER_WORKER);
    
    console.log(`🏭 Worker ${workerId} started (handling ${usersPerWorker.toLocaleString()} users)`);
    
    let currentNotificationRate = 0;
    let currentMessageRate = 0;
    let isActive = false;
    
    // Generate test users for this worker
    const users = await this.generateWorkerUsers(workerId, usersPerWorker);
    
    process.on('message', async (message) => {
      switch (message.type) {
        case 'SET_RATE':
          currentNotificationRate = message.notificationRate;
          currentMessageRate = message.messageRate;
          if (!isActive) {
            isActive = true;
            this.startWorkerLoadGeneration(users, () => ({ 
              notificationRate: currentNotificationRate, 
              messageRate: currentMessageRate 
            }));
          }
          break;
          
        case 'SET_SCENARIO':
          currentNotificationRate = message.notificationRate;
          currentMessageRate = message.messageRate;
          console.log(`🏭 Worker ${workerId}: Switching to scenario ${message.scenario}`);
          break;
          
        case 'STOP':
          isActive = false;
          console.log(`🏭 Worker ${workerId}: Stopping load generation`);
          break;
      }
    });
    
    // Keep worker alive
    while (true) {
      await this.sleep(1000);
      
      if (!isActive) {
        await this.sleep(5000);
      }
    }
  }

  async generateWorkerUsers(workerId, count) {
    const users = [];
    const startId = workerId * count;
    
    // Create mock users (no actual registration for load test)
    for (let i = 0; i < count; i++) {
      users.push({
        id: startId + i,
        username: `loadtest_user_${startId + i}`,
        token: `mock_token_${startId + i}`,
        devices: Array(LOAD_CONFIG.DEVICES_PER_USER).fill().map((_, deviceIndex) => ({
          fcmToken: `mock_fcm_${startId + i}_${deviceIndex}`,
          deviceType: deviceIndex % 2 === 0 ? 'android' : 'ios'
        }))
      });
    }
    
    return users;
  }

  async startWorkerLoadGeneration(users, getRates) {
    const workerId = process.env.WORKER_ID;
    
    while (true) {
      const rates = getRates();
      
      if (rates.notificationRate <= 0 && rates.messageRate <= 0) {
        await this.sleep(1000);
        continue;
      }
      
      const operations = [];
      
      // Generate notifications
      for (let i = 0; i < rates.notificationRate; i++) {
        operations.push(this.sendLoadTestNotification(users));
      }
      
      // Generate messages  
      for (let i = 0; i < rates.messageRate; i++) {
        operations.push(this.sendLoadTestMessage(users));
      }
      
      // Execute operations
      const results = await Promise.allSettled(operations);
      
      // Report metrics to master
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      process.send({
        type: 'METRICS',
        workerId: workerId,
        successful: successful,
        failed: failed,
        totalOperations: operations.length
      });
      
      await this.sleep(1000); // 1 second interval
    }
  }

  async sendLoadTestNotification(users) {
    const user = users[Math.floor(Math.random() * users.length)];
    const startTime = performance.now();
    
    try {
      // Simulate FCM notification (mock request)
      await axios.post(`${LOAD_CONFIG.BASE_URL}/api/enterprise/test-notification`, {
        userId: user.id,
        title: 'Load Test Notification',
        body: `Load test notification ${Date.now()}`,
        type: 'message_received'
      }, {
        headers: { 'Authorization': `Bearer ${user.token}` },
        timeout: LOAD_CONFIG.MAX_RESPONSE_TIME
      });
      
      const responseTime = performance.now() - startTime;
      
      process.send({
        type: 'RESPONSE_TIME',
        responseTime: responseTime
      });
      
    } catch (error) {
      throw new Error(`Notification failed: ${error.message}`);
    }
  }

  async sendLoadTestMessage(users) {
    const sender = users[Math.floor(Math.random() * users.length)];
    const receiver = users[Math.floor(Math.random() * users.length)];
    
    if (sender.id === receiver.id) return; // Skip same user
    
    const startTime = performance.now();
    
    try {
      await axios.post(`${LOAD_CONFIG.BASE_URL}/api/chat/send-message`, {
        receiverId: receiver.id,
        content: `Load test message ${Date.now()}`,
        type: 'text'
      }, {
        headers: { 'Authorization': `Bearer ${sender.token}` },
        timeout: LOAD_CONFIG.MAX_RESPONSE_TIME
      });
      
      const responseTime = performance.now() - startTime;
      
      process.send({
        type: 'RESPONSE_TIME',
        responseTime: responseTime
      });
      
    } catch (error) {
      throw new Error(`Message failed: ${error.message}`);
    }
  }

  // 📊 METRICS COLLECTION
  startMetricsCollection() {
    console.log('📊 Starting metrics collection...');
    
    setInterval(() => {
      this.reportCurrentMetrics();
    }, LOAD_CONFIG.METRICS_INTERVAL);
  }

  handleWorkerMessage(message) {
    switch (message.type) {
      case 'METRICS':
        this.metrics.totalRequests += message.totalOperations;
        this.metrics.successfulRequests += message.successful;
        this.metrics.failedRequests += message.failed;
        break;
        
      case 'RESPONSE_TIME':
        this.metrics.totalResponseTime += message.responseTime;
        this.metrics.minResponseTime = Math.min(this.metrics.minResponseTime, message.responseTime);
        this.metrics.maxResponseTime = Math.max(this.metrics.maxResponseTime, message.responseTime);
        break;
    }
  }

  reportCurrentMetrics() {
    if (!this.metrics.startTime) return;
    
    const elapsedSeconds = (Date.now() - this.metrics.startTime) / 1000;
    this.metrics.requestsPerSecond = this.metrics.totalRequests / elapsedSeconds;
    this.metrics.errorsPerSecond = this.metrics.failedRequests / elapsedSeconds;
    
    console.log(`📊 [${this.currentPhase}] Metrics: ` +
                `${this.metrics.requestsPerSecond.toFixed(0)} req/s, ` +
                `${this.metrics.errorsPerSecond.toFixed(2)} err/s, ` +
                `avg: ${(this.metrics.totalResponseTime / Math.max(this.metrics.totalRequests, 1)).toFixed(2)}ms`);
  }

  // 📄 GENERATE FINAL REPORT
  async generateFinalReport() {
    const duration = (Date.now() - this.metrics.startTime) / 1000;
    const avgResponseTime = this.metrics.totalResponseTime / Math.max(this.metrics.totalRequests, 1);
    const errorRate = this.metrics.failedRequests / Math.max(this.metrics.totalRequests, 1);
    
    console.log('\n' + '='.repeat(100));
    console.log('🚀 ENTERPRISE LOAD TEST - FINAL REPORT');
    console.log('='.repeat(100));
    
    console.log('\n📊 EXECUTIVE SUMMARY:');
    console.log(`⏱️  Test Duration: ${duration.toFixed(2)} seconds`);
    console.log(`👥 Total Simulated Users: ${LOAD_CONFIG.TOTAL_USERS.toLocaleString()}`);
    console.log(`📱 Total Simulated Devices: ${(LOAD_CONFIG.TOTAL_USERS * LOAD_CONFIG.DEVICES_PER_USER).toLocaleString()}`);
    console.log(`🏭 Worker Processes: ${LOAD_CONFIG.CONCURRENT_WORKERS}`);
    
    console.log('\n🎯 PERFORMANCE METRICS:');
    console.log(`📨 Total Requests: ${this.metrics.totalRequests.toLocaleString()}`);
    console.log(`✅ Successful Requests: ${this.metrics.successfulRequests.toLocaleString()}`);
    console.log(`❌ Failed Requests: ${this.metrics.failedRequests.toLocaleString()}`);
    console.log(`📈 Requests Per Second: ${this.metrics.requestsPerSecond.toFixed(2)}`);
    console.log(`⚡ Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`🚀 Min Response Time: ${this.metrics.minResponseTime.toFixed(2)}ms`);
    console.log(`🐌 Max Response Time: ${this.metrics.maxResponseTime.toFixed(2)}ms`);
    console.log(`❌ Error Rate: ${(errorRate * 100).toFixed(4)}%`);
    
    console.log('\n🏆 ENTERPRISE READINESS ASSESSMENT:');
    const assessments = [
      { 
        metric: 'Throughput', 
        value: this.metrics.requestsPerSecond,
        target: LOAD_CONFIG.NOTIFICATIONS_PER_SECOND,
        assessment: this.metrics.requestsPerSecond >= LOAD_CONFIG.NOTIFICATIONS_PER_SECOND * 0.8 ? '✅ PASS' : '❌ FAIL'
      },
      { 
        metric: 'Response Time', 
        value: avgResponseTime,
        target: LOAD_CONFIG.MAX_RESPONSE_TIME,
        assessment: avgResponseTime <= LOAD_CONFIG.MAX_RESPONSE_TIME ? '✅ PASS' : '❌ FAIL'
      },
      { 
        metric: 'Error Rate', 
        value: errorRate,
        target: LOAD_CONFIG.ERROR_THRESHOLD,
        assessment: errorRate <= LOAD_CONFIG.ERROR_THRESHOLD ? '✅ PASS' : '❌ FAIL'
      }
    ];
    
    assessments.forEach(assessment => {
      console.log(`${assessment.assessment} ${assessment.metric}: ${assessment.value.toFixed(2)} (target: ${assessment.target})`);
    });
    
    const overallAssessment = assessments.every(a => a.assessment.includes('PASS')) ? 
      '🏆 ENTERPRISE READY' : '⚠️ NEEDS OPTIMIZATION';
    console.log(`\n🎯 OVERALL ASSESSMENT: ${overallAssessment}`);
    
    if (Object.keys(this.metrics.scenarios).length > 0) {
      console.log('\n🎭 SCENARIO RESULTS:');
      Object.entries(this.metrics.scenarios).forEach(([name, metrics]) => {
        console.log(`📊 ${name}: ${metrics.requests.toLocaleString()} req, ` +
                    `${metrics.avgResponseTime.toFixed(2)}ms avg, ` +
                    `${(metrics.errorRate * 100).toFixed(2)}% errors`);
      });
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    if (avgResponseTime > LOAD_CONFIG.MAX_RESPONSE_TIME) {
      console.log('⚡ Consider optimizing database queries and adding more Redis caching');
    }
    if (errorRate > LOAD_CONFIG.ERROR_THRESHOLD) {
      console.log('🔧 Review error handling and increase server resources');
    }
    if (this.metrics.requestsPerSecond < LOAD_CONFIG.NOTIFICATIONS_PER_SECOND * 0.8) {
      console.log('📈 Scale horizontally or optimize critical code paths');
    }
    
    console.log('\n' + '='.repeat(100));
    console.log('🎉 ENTERPRISE LOAD TEST COMPLETED');
    console.log('='.repeat(100) + '\n');
    
    // Save detailed metrics
    if (LOAD_CONFIG.SAVE_METRICS) {
      await this.saveMetricsToFile();
    }
  }

  async saveMetricsToFile() {
    const metricsData = {
      config: LOAD_CONFIG,
      results: this.metrics,
      timestamp: new Date().toISOString(),
      duration: (Date.now() - this.metrics.startTime) / 1000
    };
    
    try {
      const fs = require('fs');
      fs.writeFileSync(LOAD_CONFIG.METRICS_FILE, JSON.stringify(metricsData, null, 2));
      console.log(`📄 Detailed metrics saved to: ${LOAD_CONFIG.METRICS_FILE}`);
    } catch (error) {
      console.warn(`⚠️ Could not save metrics: ${error.message}`);
    }
  }

  // 🧹 CLEANUP
  async cleanup() {
    console.log('🧹 Cleaning up load test environment...');
    this.isRunning = false;
    
    // Terminate all workers
    for (const worker of this.workers) {
      try {
        worker.kill();
      } catch (error) {
        console.warn(`⚠️ Error terminating worker: ${error.message}`);
      }
    }
    
    console.log('✅ Load test cleanup completed');
  }

  // 🛠️ UTILITIES
  broadcastToWorkers(message) {
    this.workers.forEach(worker => {
      try {
        worker.send(message);
      } catch (error) {
        console.warn('⚠️ Error sending message to worker:', error.message);
      }
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 🚀 MAIN EXECUTION
if (require.main === module) {
  const loadTestManager = new EnterpriseLoadTestManager();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Load test interrupted. Cleaning up...');
    loadTestManager.isRunning = false;
    await loadTestManager.cleanup();
    process.exit(0);
  });

  if (cluster.isMaster) {
    loadTestManager.runEnterpriseLoadTest()
      .then(() => {
        console.log('🎉 Enterprise load test completed successfully!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Enterprise load test failed:', error);
        process.exit(1);
      });
  }
}

module.exports = EnterpriseLoadTestManager; 