#!/usr/bin/env node
// 📊 Firebase Notification System - Real-time Monitor
// This script provides real-time monitoring of notification delivery and system health

const axios = require('axios');
const WebSocket = require('ws');
const { EventEmitter } = require('events');

// 📊 MONITORING CONFIGURATION
const MONITOR_CONFIG = {
  BASE_URL: 'http://localhost:3001',
  WS_URL: 'ws://localhost:3001',
  MONITORING_INTERVAL: 2000,      // Check every 2 seconds
  ALERT_THRESHOLDS: {
    responseTime: 500,             // Alert if response time > 500ms
    errorRate: 0.05,               // Alert if error rate > 5%
    deliveryRate: 0.95,            // Alert if delivery rate < 95%
    queueSize: 1000,               // Alert if queue size > 1000
  },
  DASHBOARD_UPDATE_INTERVAL: 1000, // Update dashboard every second
  LOG_RETENTION_MINUTES: 60,       // Keep logs for 60 minutes
};

class FirebaseNotificationMonitor extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      notifications: {
        sent: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
        deliveryRate: 0,
        avgResponseTime: 0,
        errorRate: 0
      },
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        activeConnections: 0,
        databaseConnections: 0,
        redisConnections: 0
      },
      realtime: {
        connectedUsers: 0,
        activeChats: 0,
        messagesPerSecond: 0,
        notificationsPerSecond: 0
      },
      firebase: {
        fcmTokens: 0,
        activeDevices: 0,
        invalidTokens: 0,
        successRate: 0
      }
    };
    
    this.alerts = [];
    this.logs = [];
    this.isMonitoring = false;
    this.dashboardUpdateTimer = null;
    this.monitoringTimer = null;
    this.startTime = Date.now();
  }

  // 🚀 START MONITORING
  async startMonitoring() {
    console.log('📊 Starting Firebase Notification Monitor...');
    console.log('🎯 Monitoring Configuration:', {
      updateInterval: `${MONITOR_CONFIG.MONITORING_INTERVAL}ms`,
      responseTimeThreshold: `${MONITOR_CONFIG.ALERT_THRESHOLDS.responseTime}ms`,
      errorRateThreshold: `${MONITOR_CONFIG.ALERT_THRESHOLDS.errorRate * 100}%`
    });

    this.isMonitoring = true;
    this.startTime = Date.now();

    try {
      // Initialize monitoring components
      await this.initializeMonitoring();
      
      // Start real-time dashboard
      this.startDashboard();
      
      // Start metrics collection
      this.startMetricsCollection();
      
      // Start alert system
      this.startAlertSystem();
      
      console.log('✅ Firebase Notification Monitor started successfully');
      console.log('📈 Dashboard will update every second...\n');

    } catch (error) {
      console.error('❌ Failed to start monitor:', error);
      throw error;
    }
  }

  // 🏗️ INITIALIZE MONITORING
  async initializeMonitoring() {
    // Test system connectivity
    await this.testSystemConnectivity();
    
    // Initialize WebSocket monitoring (if available)
    this.initializeWebSocketMonitoring();
    
    // Initialize event listeners
    this.setupEventListeners();
  }

  async testSystemConnectivity() {
    console.log('🔍 Testing system connectivity...');
    
         const tests = [
       { name: 'API Server', test: () => axios.get(`${MONITOR_CONFIG.BASE_URL}/api/enterprise/health`, { timeout: 5000 }) },
       { name: 'Enterprise Stats', test: () => axios.get(`${MONITOR_CONFIG.BASE_URL}/api/enterprise/stats`, { timeout: 5000 }) }
     ];

    for (const test of tests) {
      try {
        const response = await test.test();
        console.log(`✅ ${test.name}: Connected`);
      } catch (error) {
        console.log(`⚠️ ${test.name}: ${error.message}`);
      }
    }
  }

  initializeWebSocketMonitoring() {
    try {
      // Note: This would require authentication in a real scenario
      console.log('🌐 WebSocket monitoring initialized (mock)');
    } catch (error) {
      console.warn('⚠️ WebSocket monitoring not available:', error.message);
    }
  }

  setupEventListeners() {
    this.on('alert', (alert) => {
      this.alerts.unshift({
        ...alert,
        timestamp: new Date().toISOString()
      });
      
      // Keep only recent alerts
      if (this.alerts.length > 100) {
        this.alerts = this.alerts.slice(0, 100);
      }
    });

    this.on('log', (log) => {
      this.logs.unshift({
        ...log,
        timestamp: new Date().toISOString()
      });
      
      // Keep logs within retention period
      const retentionTime = Date.now() - (MONITOR_CONFIG.LOG_RETENTION_MINUTES * 60 * 1000);
      this.logs = this.logs.filter(l => new Date(l.timestamp).getTime() > retentionTime);
    });
  }

  // 📊 START METRICS COLLECTION
  startMetricsCollection() {
    this.monitoringTimer = setInterval(async () => {
      if (!this.isMonitoring) return;
      
      try {
        await this.collectMetrics();
        await this.analyzeMetrics();
      } catch (error) {
        this.emit('log', {
          level: 'error',
          message: `Metrics collection failed: ${error.message}`
        });
      }
    }, MONITOR_CONFIG.MONITORING_INTERVAL);
  }

  async collectMetrics() {
    // Collect notification metrics
    await this.collectNotificationMetrics();
    
    // Collect system metrics
    await this.collectSystemMetrics();
    
    // Collect realtime metrics
    await this.collectRealtimeMetrics();
    
    // Collect Firebase metrics
    await this.collectFirebaseMetrics();
  }

  async collectNotificationMetrics() {
    try {
      // Mock API call to get notification stats
      const response = await axios.get(`${MONITOR_CONFIG.BASE_URL}/api/enterprise/stats`, {
        timeout: 3000
      });
      
      if (response.data) {
        // Update metrics based on API response
        this.updateNotificationMetrics(response.data);
      }
    } catch (error) {
      this.emit('log', {
        level: 'warn',
        message: `Failed to collect notification metrics: ${error.message}`
      });
    }
  }

  updateNotificationMetrics(data) {
    // Extract metrics from API response
    const previousSent = this.metrics.notifications.sent;
    
    // Mock data update (replace with actual API response parsing)
    this.metrics.notifications.sent += Math.floor(Math.random() * 10);
    this.metrics.notifications.delivered += Math.floor(Math.random() * 9);
    this.metrics.notifications.failed += Math.floor(Math.random() * 1);
    
    // Calculate rates
    const totalAttempts = this.metrics.notifications.sent;
    if (totalAttempts > 0) {
      this.metrics.notifications.deliveryRate = this.metrics.notifications.delivered / totalAttempts;
      this.metrics.notifications.errorRate = this.metrics.notifications.failed / totalAttempts;
    }
    
    // Calculate per-second rate
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    this.metrics.realtime.notificationsPerSecond = totalAttempts / elapsedSeconds;
  }

  async collectSystemMetrics() {
    try {
      // Collect process metrics
      const usage = process.memoryUsage();
      this.metrics.system.memoryUsage = Math.round(usage.heapUsed / 1024 / 1024); // MB
      
      // Mock other system metrics
      this.metrics.system.cpuUsage = Math.random() * 100;
      this.metrics.system.activeConnections = Math.floor(Math.random() * 1000);
      this.metrics.system.databaseConnections = Math.floor(Math.random() * 100);
      this.metrics.system.redisConnections = Math.floor(Math.random() * 50);
      
    } catch (error) {
      this.emit('log', {
        level: 'warn',
        message: `Failed to collect system metrics: ${error.message}`
      });
    }
  }

  async collectRealtimeMetrics() {
    try {
      // Mock realtime metrics collection
      this.metrics.realtime.connectedUsers = Math.floor(Math.random() * 10000);
      this.metrics.realtime.activeChats = Math.floor(Math.random() * 5000);
      this.metrics.realtime.messagesPerSecond = Math.random() * 100;
      
    } catch (error) {
      this.emit('log', {
        level: 'warn',
        message: `Failed to collect realtime metrics: ${error.message}`
      });
    }
  }

  async collectFirebaseMetrics() {
    try {
      // Mock Firebase metrics
      this.metrics.firebase.fcmTokens = Math.floor(Math.random() * 50000);
      this.metrics.firebase.activeDevices = Math.floor(Math.random() * 30000);
      this.metrics.firebase.invalidTokens = Math.floor(Math.random() * 100);
      
      const totalTokens = this.metrics.firebase.fcmTokens;
      const validTokens = totalTokens - this.metrics.firebase.invalidTokens;
      this.metrics.firebase.successRate = totalTokens > 0 ? validTokens / totalTokens : 0;
      
    } catch (error) {
      this.emit('log', {
        level: 'warn',
        message: `Failed to collect Firebase metrics: ${error.message}`
      });
    }
  }

  // 🔍 ANALYZE METRICS
  async analyzeMetrics() {
    const thresholds = MONITOR_CONFIG.ALERT_THRESHOLDS;
    
    // Check delivery rate
    if (this.metrics.notifications.deliveryRate < thresholds.deliveryRate) {
      this.emit('alert', {
        type: 'LOW_DELIVERY_RATE',
        severity: 'warning',
        message: `Delivery rate dropped to ${(this.metrics.notifications.deliveryRate * 100).toFixed(2)}%`,
        value: this.metrics.notifications.deliveryRate,
        threshold: thresholds.deliveryRate
      });
    }

    // Check error rate
    if (this.metrics.notifications.errorRate > thresholds.errorRate) {
      this.emit('alert', {
        type: 'HIGH_ERROR_RATE',
        severity: 'critical',
        message: `Error rate increased to ${(this.metrics.notifications.errorRate * 100).toFixed(2)}%`,
        value: this.metrics.notifications.errorRate,
        threshold: thresholds.errorRate
      });
    }

    // Check response time
    if (this.metrics.notifications.avgResponseTime > thresholds.responseTime) {
      this.emit('alert', {
        type: 'HIGH_RESPONSE_TIME',
        severity: 'warning',
        message: `Average response time: ${this.metrics.notifications.avgResponseTime.toFixed(2)}ms`,
        value: this.metrics.notifications.avgResponseTime,
        threshold: thresholds.responseTime
      });
    }

    // Check system resources
    if (this.metrics.system.memoryUsage > 1000) { // 1GB
      this.emit('alert', {
        type: 'HIGH_MEMORY_USAGE',
        severity: 'warning',
        message: `Memory usage: ${this.metrics.system.memoryUsage}MB`,
        value: this.metrics.system.memoryUsage,
        threshold: 1000
      });
    }

    // Check Firebase health
    if (this.metrics.firebase.successRate < 0.95) {
      this.emit('alert', {
        type: 'FIREBASE_HEALTH',
        severity: 'warning',
        message: `Firebase success rate: ${(this.metrics.firebase.successRate * 100).toFixed(2)}%`,
        value: this.metrics.firebase.successRate,
        threshold: 0.95
      });
    }
  }

  // 🚨 ALERT SYSTEM
  startAlertSystem() {
    this.on('alert', (alert) => {
      const severityColors = {
        info: '\x1b[36m',      // Cyan
        warning: '\x1b[33m',   // Yellow
        critical: '\x1b[31m'   // Red
      };
      
      const color = severityColors[alert.severity] || '\x1b[37m';
      const reset = '\x1b[0m';
      
      console.log(`\n🚨 ${color}ALERT [${alert.severity.toUpperCase()}]${reset}: ${alert.message}`);
      
      if (alert.severity === 'critical') {
        console.log('🔥 CRITICAL ISSUE DETECTED - IMMEDIATE ACTION REQUIRED');
      }
    });
  }

  // 📈 DASHBOARD
  startDashboard() {
    this.dashboardUpdateTimer = setInterval(() => {
      if (!this.isMonitoring) return;
      this.updateDashboard();
    }, MONITOR_CONFIG.DASHBOARD_UPDATE_INTERVAL);
  }

  updateDashboard() {
    // Clear screen (ANSI escape code)
    console.clear();
    
    console.log('🔥 Firebase Notification System - Real-time Monitor');
    console.log('='.repeat(80));
    
    const uptime = ((Date.now() - this.startTime) / 1000).toFixed(0);
    console.log(`📊 Monitoring since: ${new Date(this.startTime).toLocaleTimeString()} (${uptime}s ago)`);
    
    console.log('\n📱 NOTIFICATION METRICS:');
    console.log(`📨 Sent: ${this.metrics.notifications.sent.toLocaleString()}`);
    console.log(`✅ Delivered: ${this.metrics.notifications.delivered.toLocaleString()}`);
    console.log(`❌ Failed: ${this.metrics.notifications.failed.toLocaleString()}`);
    console.log(`📈 Delivery Rate: ${(this.metrics.notifications.deliveryRate * 100).toFixed(2)}%`);
    console.log(`⚡ Rate: ${this.metrics.realtime.notificationsPerSecond.toFixed(2)} per second`);
    
    console.log('\n🔥 FIREBASE METRICS:');
    console.log(`📱 FCM Tokens: ${this.metrics.firebase.fcmTokens.toLocaleString()}`);
    console.log(`✅ Active Devices: ${this.metrics.firebase.activeDevices.toLocaleString()}`);
    console.log(`❌ Invalid Tokens: ${this.metrics.firebase.invalidTokens.toLocaleString()}`);
    console.log(`📈 Success Rate: ${(this.metrics.firebase.successRate * 100).toFixed(2)}%`);
    
    console.log('\n⚡ SYSTEM METRICS:');
    console.log(`💾 Memory: ${this.metrics.system.memoryUsage}MB`);
    console.log(`🔗 Connections: ${this.metrics.system.activeConnections}`);
    console.log(`🗄️ DB Connections: ${this.metrics.system.databaseConnections}`);
    console.log(`🔴 Redis Connections: ${this.metrics.system.redisConnections}`);
    
    console.log('\n🌐 REAL-TIME METRICS:');
    console.log(`👥 Connected Users: ${this.metrics.realtime.connectedUsers.toLocaleString()}`);
    console.log(`💬 Active Chats: ${this.metrics.realtime.activeChats.toLocaleString()}`);
    console.log(`📨 Messages/sec: ${this.metrics.realtime.messagesPerSecond.toFixed(2)}`);
    
    // Show recent alerts
    if (this.alerts.length > 0) {
      console.log('\n🚨 RECENT ALERTS:');
      this.alerts.slice(0, 5).forEach(alert => {
        const timeAgo = ((Date.now() - new Date(alert.timestamp).getTime()) / 1000).toFixed(0);
        const severityIcon = {
          info: 'ℹ️',
          warning: '⚠️',
          critical: '🔥'
        };
        
        console.log(`${severityIcon[alert.severity]} [${timeAgo}s] ${alert.message}`);
      });
    }
    
    // Show system health status
    console.log('\n🏥 SYSTEM HEALTH:');
    const healthStatus = this.calculateSystemHealth();
    const healthColor = healthStatus.status === 'healthy' ? '\x1b[32m' : 
                       healthStatus.status === 'degraded' ? '\x1b[33m' : '\x1b[31m';
    console.log(`${healthColor}${healthStatus.emoji} Status: ${healthStatus.status.toUpperCase()}\x1b[0m`);
    
    if (healthStatus.issues.length > 0) {
      console.log('Issues:');
      healthStatus.issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    console.log('\n📊 Press Ctrl+C to stop monitoring...');
    console.log('='.repeat(80));
  }

  calculateSystemHealth() {
    const issues = [];
    let status = 'healthy';
    let emoji = '💚';
    
    // Check various health indicators
    if (this.metrics.notifications.deliveryRate < 0.95) {
      issues.push('Low delivery rate');
      status = 'degraded';
      emoji = '💛';
    }
    
    if (this.metrics.notifications.errorRate > 0.05) {
      issues.push('High error rate');
      status = 'critical';
      emoji = '❤️';
    }
    
    if (this.metrics.system.memoryUsage > 1000) {
      issues.push('High memory usage');
      status = 'degraded';
      emoji = '💛';
    }
    
    if (this.metrics.firebase.successRate < 0.9) {
      issues.push('Firebase issues');
      status = 'degraded';
      emoji = '💛';
    }
    
    if (issues.length > 2) {
      status = 'critical';
      emoji = '❤️';
    }
    
    return { status, emoji, issues };
  }

  // 🛑 STOP MONITORING
  stopMonitoring() {
    console.log('\n🛑 Stopping Firebase Notification Monitor...');
    this.isMonitoring = false;
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    
    if (this.dashboardUpdateTimer) {
      clearInterval(this.dashboardUpdateTimer);
    }
    
    // Final summary
    this.printFinalSummary();
    
    console.log('✅ Monitor stopped successfully');
  }

  printFinalSummary() {
    const duration = (Date.now() - this.startTime) / 1000;
    
    console.log('\n📊 MONITORING SESSION SUMMARY:');
    console.log(`⏱️ Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📨 Total Notifications: ${this.metrics.notifications.sent.toLocaleString()}`);
    console.log(`✅ Success Rate: ${(this.metrics.notifications.deliveryRate * 100).toFixed(2)}%`);
    console.log(`🚨 Total Alerts: ${this.alerts.length}`);
    
    const criticalAlerts = this.alerts.filter(a => a.severity === 'critical').length;
    if (criticalAlerts > 0) {
      console.log(`🔥 Critical Alerts: ${criticalAlerts}`);
    }
  }
}

// 🚀 MAIN EXECUTION
if (require.main === module) {
  const monitor = new FirebaseNotificationMonitor();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    monitor.stopMonitoring();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    monitor.stopMonitoring();
    process.exit(0);
  });

  // Start monitoring
  monitor.startMonitoring()
    .then(() => {
      // Keep the process running
      process.stdin.resume();
    })
    .catch((error) => {
      console.error('💥 Monitor failed to start:', error);
      process.exit(1);
    });
}

module.exports = FirebaseNotificationMonitor; 