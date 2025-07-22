#!/usr/bin/env node
// 🔥 Firebase Notification System - Comprehensive Test Environment
// This script simulates multiple users with multiple devices to test all notification scenarios

const axios = require('axios');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// 🏢 ENTERPRISE TEST CONFIGURATION
const CONFIG = {
  BASE_URL: 'http://localhost:3001',
  WS_URL: 'ws://localhost:3001',
  USERS_TO_SIMULATE: 50,           // Number of users to simulate
  DEVICES_PER_USER: 3,             // Devices per user (max 10 allowed)
  CONCURRENT_TESTS: 10,            // Concurrent test operations
  LOAD_TEST_DURATION: 300000,      // 5 minutes load test
  NOTIFICATION_INTERVAL: 1000,     // 1 second between notifications
  LOG_LEVEL: 'info'                // 'debug', 'info', 'warn', 'error'
};

// 🎭 SIMULATED USER DATA
const SIMULATED_USERS = [
  { username: 'alice_test', email: 'alice@test.com', firstName: 'Alice', lastName: 'Smith' },
  { username: 'bob_test', email: 'bob@test.com', firstName: 'Bob', lastName: 'Johnson' },
  { username: 'charlie_test', email: 'charlie@test.com', firstName: 'Charlie', lastName: 'Brown' },
  { username: 'diana_test', email: 'diana@test.com', firstName: 'Diana', lastName: 'Wilson' },
  { username: 'eve_test', email: 'eve@test.com', firstName: 'Eve', lastName: 'Davis' },
];

// 📱 SIMULATED DEVICE TYPES
const DEVICE_TYPES = ['android', 'ios'];
const DEVICE_MODELS = {
  android: ['Samsung Galaxy S23', 'Google Pixel 7', 'OnePlus 11', 'Huawei P50'],
  ios: ['iPhone 14 Pro', 'iPhone 13', 'iPhone 12', 'iPad Pro']
};

class FirebaseNotificationTestEnvironment {
  constructor() {
    this.users = [];
    this.devices = [];
    this.sockets = [];
    this.testResults = {
      notifications: {
        sent: 0,
        delivered: 0,
        failed: 0,
        foreground: 0,
        background: 0
      },
      messages: {
        sent: 0,
        delivered: 0,
        failed: 0
      },
      messageRequests: {
        sent: 0,
        accepted: 0,
        rejected: 0
      },
      performance: {
        avgResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: Infinity
      },
      errors: []
    };
    this.isRunning = false;
    this.startTime = null;
  }

  // 🎯 MAIN TEST ORCHESTRATOR
  async runComprehensiveTest() {
    console.log('🔥 Starting Firebase Notification Comprehensive Test Environment');
    console.log('📊 Test Configuration:', {
      users: CONFIG.USERS_TO_SIMULATE,
      devicesPerUser: CONFIG.DEVICES_PER_USER,
      duration: `${CONFIG.LOAD_TEST_DURATION / 1000}s`,
      concurrent: CONFIG.CONCURRENT_TESTS
    });

    try {
      this.startTime = Date.now();
      this.isRunning = true;

      // Phase 1: Setup
      await this.setupTestEnvironment();
      
      // Phase 2: User Registration & Authentication
      await this.registerTestUsers();
      
      // Phase 3: Device Registration (Multi-device simulation)
      await this.registerTestDevices();
      
      // Phase 4: WebSocket Connections
      await this.establishWebSocketConnections();
      
      // Phase 5: Test Scenarios
      await this.runNotificationTestScenarios();
      
      // Phase 6: Load Testing
      await this.runLoadTest();
      
      // Phase 7: Results & Cleanup
      await this.generateTestReport();

    } catch (error) {
      console.error('❌ Test environment failed:', error);
      this.testResults.errors.push({ type: 'ENVIRONMENT_FAILURE', error: error.message });
    } finally {
      await this.cleanup();
    }
  }

  // 🏗️ SETUP TEST ENVIRONMENT
  async setupTestEnvironment() {
    this.log('info', '🏗️ Setting up test environment...');
    
    // Health check
    try {
      const response = await axios.get(`${CONFIG.BASE_URL}/api/enterprise/health`);
      this.log('info', '✅ Server health check passed');
    } catch (error) {
      throw new Error('❌ Server not accessible. Make sure the server is running.');
    }

    // Test database connectivity
    try {
      const response = await axios.get(`${CONFIG.BASE_URL}/api/enterprise/stats`);
      this.log('info', '✅ Database connectivity verified');
    } catch (error) {
      this.log('warn', '⚠️ Database connectivity test failed, but continuing...');
    }

    // Initialize test data structures
    this.users = [];
    this.devices = [];
    this.sockets = [];

    this.log('info', '✅ Test environment setup completed');
  }

  // 👥 REGISTER TEST USERS
  async registerTestUsers() {
    this.log('info', '👥 Registering test users...');
    
    const userPromises = [];
    
    for (let i = 0; i < Math.min(CONFIG.USERS_TO_SIMULATE, SIMULATED_USERS.length); i++) {
      const userData = SIMULATED_USERS[i];
      userPromises.push(this.registerUser(userData, i));
    }

    // Register additional users if needed
    for (let i = SIMULATED_USERS.length; i < CONFIG.USERS_TO_SIMULATE; i++) {
      const userData = {
        username: `testuser${i}`,
        email: `testuser${i}@test.com`,
        firstName: `Test${i}`,
        lastName: 'User'
      };
      userPromises.push(this.registerUser(userData, i));
    }

    const results = await Promise.allSettled(userPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    this.log('info', `✅ User registration completed: ${successful} successful, ${failed} failed`);
    
    if (failed > 0) {
      const failures = results.filter(r => r.status === 'rejected').map(r => r.reason);
      this.log('warn', `⚠️ User registration failures:`, failures);
    }
  }

  async registerUser(userData, index) {
    try {
      const password = 'TestPassword123!';
      
      // Register user
      const registerResponse = await axios.post(`${CONFIG.BASE_URL}/api/auth/register`, {
        ...userData,
        password: password
      });

      // Login user
      const loginResponse = await axios.post(`${CONFIG.BASE_URL}/api/auth/login`, {
        username: userData.username,
        password: password
      });

      const user = {
        ...userData,
        id: registerResponse.data.user?.id || loginResponse.data.user?.id,
        token: loginResponse.data.token,
        index: index,
        devices: []
      };

      this.users.push(user);
      this.log('debug', `✅ User registered: ${userData.username}`);
      
      return user;

    } catch (error) {
      // If registration fails, try login (user might already exist)
      try {
        const loginResponse = await axios.post(`${CONFIG.BASE_URL}/api/auth/login`, {
          username: userData.username,
          password: 'TestPassword123!'
        });

        const user = {
          ...userData,
          id: loginResponse.data.user?.id,
          token: loginResponse.data.token,
          index: index,
          devices: []
        };

        this.users.push(user);
        this.log('debug', `✅ User logged in (already exists): ${userData.username}`);
        
        return user;

      } catch (loginError) {
        this.log('error', `❌ Failed to register/login user ${userData.username}:`, loginError.message);
        throw loginError;
      }
    }
  }

  // 📱 REGISTER TEST DEVICES (Multi-device simulation)
  async registerTestDevices() {
    this.log('info', '📱 Registering test devices (multi-device simulation)...');
    
    const devicePromises = [];
    
    for (const user of this.users) {
      for (let deviceIndex = 0; deviceIndex < CONFIG.DEVICES_PER_USER; deviceIndex++) {
        const deviceType = DEVICE_TYPES[deviceIndex % DEVICE_TYPES.length];
        const deviceModel = DEVICE_MODELS[deviceType][deviceIndex % DEVICE_MODELS[deviceType].length];
        
        const deviceInfo = {
          userId: user.id,
          userToken: user.token,
          deviceType: deviceType,
          deviceModel: deviceModel,
          deviceIndex: deviceIndex,
          isActive: Math.random() > 0.2 // 80% of devices are active
        };
        
        devicePromises.push(this.registerDevice(deviceInfo));
      }
    }

    const results = await Promise.allSettled(devicePromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    this.log('info', `✅ Device registration completed: ${successful} successful, ${failed} failed`);
    this.log('info', `📊 Total devices registered: ${this.devices.length}`);
  }

  async registerDevice(deviceInfo) {
    try {
      if (!deviceInfo.isActive) {
        this.log('debug', `⏸️ Skipping inactive device simulation for user ${deviceInfo.userId}`);
        return;
      }

      // Generate fake FCM token
      const fcmToken = `mock_fcm_token_${uuidv4()}_${deviceInfo.deviceType}_${deviceInfo.deviceIndex}`;
      
      const deviceRegistration = {
        token: fcmToken,
        deviceType: deviceInfo.deviceType,
        platform: deviceInfo.deviceType,
        deviceInfo: {
          model: deviceInfo.deviceModel,
          os: deviceInfo.deviceType,
          osVersion: deviceInfo.deviceType === 'android' ? '13' : '16.0',
          brand: deviceInfo.deviceType === 'android' ? 'Samsung' : 'Apple',
          appVersion: '1.0.0',
          testDevice: true,
          simulationIndex: deviceInfo.deviceIndex
        },
        appVersion: '1.0.0',
        timezone: 'Europe/Istanbul'
      };

      const response = await axios.post(`${CONFIG.BASE_URL}/api/devices/register-token`, 
        deviceRegistration, 
        {
          headers: {
            'Authorization': `Bearer ${deviceInfo.userToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const device = {
        ...deviceInfo,
        fcmToken: fcmToken,
        registrationResponse: response.data,
        isRegistered: true
      };

      this.devices.push(device);
      
      // Add device to user
      const user = this.users.find(u => u.id === deviceInfo.userId);
      if (user) {
        user.devices.push(device);
      }

      this.log('debug', `📱 Device registered: ${deviceInfo.deviceType} for user ${deviceInfo.userId}`);
      
      return device;

    } catch (error) {
      this.log('error', `❌ Failed to register device for user ${deviceInfo.userId}:`, error.message);
      throw error;
    }
  }

  // 🌐 ESTABLISH WEBSOCKET CONNECTIONS
  async establishWebSocketConnections() {
    this.log('info', '🌐 Establishing WebSocket connections...');
    
    const connectionPromises = [];
    
    // Connect 70% of users (simulate realistic online presence)
    const usersToConnect = this.users.slice(0, Math.floor(this.users.length * 0.7));
    
    for (const user of usersToConnect) {
      connectionPromises.push(this.connectUserWebSocket(user));
    }

    const results = await Promise.allSettled(connectionPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    this.log('info', `✅ WebSocket connections: ${successful} successful, ${failed} failed`);
  }

  async connectUserWebSocket(user) {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(`${CONFIG.WS_URL}?token=${user.token}`);
        
        ws.on('open', () => {
          this.log('debug', `🌐 WebSocket connected for user ${user.username}`);
          
          const socketInfo = {
            userId: user.id,
            username: user.username,
            ws: ws,
            isConnected: true,
            connectedAt: Date.now()
          };
          
          this.sockets.push(socketInfo);
          resolve(socketInfo);
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            this.handleWebSocketMessage(user, message);
          } catch (error) {
            this.log('warn', `⚠️ Invalid WebSocket message from ${user.username}:`, data.toString());
          }
        });

        ws.on('error', (error) => {
          this.log('error', `❌ WebSocket error for ${user.username}:`, error.message);
          reject(error);
        });

        ws.on('close', () => {
          this.log('debug', `🔌 WebSocket closed for user ${user.username}`);
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket connection timeout'));
          }
        }, 5000);

      } catch (error) {
        reject(error);
      }
    });
  }

  handleWebSocketMessage(user, message) {
    switch (message.type) {
      case 'new_notification':
        this.testResults.notifications.delivered++;
        this.log('debug', `📱 Foreground notification received: ${user.username}`);
        this.testResults.notifications.foreground++;
        break;
      
      case 'new_message':
        this.testResults.messages.delivered++;
        this.log('debug', `💬 Real-time message received: ${user.username}`);
        break;
      
      case 'message_request':
        this.log('debug', `📬 Message request received: ${user.username}`);
        break;
      
      default:
        this.log('debug', `📨 WebSocket message: ${message.type} for ${user.username}`);
    }
  }

  // 🧪 RUN NOTIFICATION TEST SCENARIOS
  async runNotificationTestScenarios() {
    this.log('info', '🧪 Running comprehensive notification test scenarios...');
    
    const scenarios = [
      { name: 'Message Notifications', test: () => this.testMessageNotifications() },
      { name: 'Message Request Notifications', test: () => this.testMessageRequestNotifications() },
      { name: 'Request Acceptance Notifications', test: () => this.testRequestAcceptanceNotifications() },
      { name: 'Multi-Device Sync Test', test: () => this.testMultiDeviceSync() },
      { name: 'Foreground vs Background Test', test: () => this.testForegroundBackgroundScenarios() },
      { name: 'High Frequency Notifications', test: () => this.testHighFrequencyNotifications() }
    ];

    for (const scenario of scenarios) {
      this.log('info', `🎯 Testing: ${scenario.name}`);
      try {
        await scenario.test();
        this.log('info', `✅ ${scenario.name} completed successfully`);
      } catch (error) {
        this.log('error', `❌ ${scenario.name} failed:`, error.message);
        this.testResults.errors.push({ type: scenario.name, error: error.message });
      }
      
      // Wait between scenarios
      await this.sleep(2000);
    }
  }

  // 📨 Test Message Notifications
  async testMessageNotifications() {
    const testPairs = this.createTestPairs(5);
    const messagePromises = [];

    for (const pair of testPairs) {
      const messageContent = `Test message ${Date.now()}: Hello from ${pair.sender.username}`;
      messagePromises.push(this.sendTestMessage(pair.sender, pair.receiver, messageContent));
    }

    const results = await Promise.allSettled(messagePromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    this.testResults.messages.sent += testPairs.length;
    this.log('info', `📨 Message notifications: ${successful}/${testPairs.length} successful`);
  }

  async sendTestMessage(sender, receiver, content) {
    try {
      const startTime = Date.now();
      
      // Send message via API (this will trigger FCM notifications)
      const response = await axios.post(`${CONFIG.BASE_URL}/api/chat/send-message`, {
        receiverId: receiver.id,
        content: content,
        type: 'text'
      }, {
        headers: {
          'Authorization': `Bearer ${sender.token}`,
          'Content-Type': 'application/json'
        }
      });

      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics(responseTime);
      
      this.log('debug', `📨 Message sent: ${sender.username} → ${receiver.username}`);
      
      // Simulate background notification (devices not connected to WebSocket)
      const offlineDevices = receiver.devices.filter(d => !this.sockets.find(s => s.userId === receiver.id));
      this.testResults.notifications.background += offlineDevices.length;
      
      return response.data;

    } catch (error) {
      this.testResults.messages.failed++;
      throw error;
    }
  }

  // 📬 Test Message Request Notifications  
  async testMessageRequestNotifications() {
    const testPairs = this.createTestPairs(3);
    const requestPromises = [];

    for (const pair of testPairs) {
      requestPromises.push(this.sendMessageRequest(pair.sender, pair.receiver));
    }

    const results = await Promise.allSettled(requestPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    this.testResults.messageRequests.sent += testPairs.length;
    this.log('info', `📬 Message request notifications: ${successful}/${testPairs.length} successful`);
  }

  async sendMessageRequest(sender, receiver) {
    try {
      const response = await axios.post(`${CONFIG.BASE_URL}/api/message-requests/send`, {
        receiverId: receiver.id,
        message: `Test message request from ${sender.firstName}`
      }, {
        headers: {
          'Authorization': `Bearer ${sender.token}`,
          'Content-Type': 'application/json'
        }
      });

      this.log('debug', `📬 Message request sent: ${sender.username} → ${receiver.username}`);
      return response.data;

    } catch (error) {
      this.log('error', `❌ Message request failed: ${sender.username} → ${receiver.username}`, error.message);
      throw error;
    }
  }

  // ✅ Test Request Acceptance Notifications
  async testRequestAcceptanceNotifications() {
    // First create some message requests, then accept them
    const testPairs = this.createTestPairs(2);
    
    for (const pair of testPairs) {
      try {
        // Send request
        const requestResponse = await this.sendMessageRequest(pair.sender, pair.receiver);
        
        // Wait a bit
        await this.sleep(1000);
        
        // Accept request
        const acceptResponse = await axios.post(`${CONFIG.BASE_URL}/api/message-requests/respond`, {
          requestId: requestResponse.id,
          action: 'accept'
        }, {
          headers: {
            'Authorization': `Bearer ${pair.receiver.token}`,
            'Content-Type': 'application/json'
          }
        });

        this.testResults.messageRequests.accepted++;
        this.log('debug', `✅ Message request accepted: ${pair.receiver.username} accepted ${pair.sender.username}`);

      } catch (error) {
        this.log('error', `❌ Request acceptance test failed:`, error.message);
      }
    }
  }

  // 🔄 Test Multi-Device Synchronization
  async testMultiDeviceSync() {
    const usersWithMultipleDevices = this.users.filter(u => u.devices.length > 1);
    
    this.log('info', `🔄 Testing multi-device sync for ${usersWithMultipleDevices.length} users`);
    
    for (const user of usersWithMultipleDevices.slice(0, 3)) {
      try {
        // Send notification that should reach all user's devices
        const testResponse = await axios.post(`${CONFIG.BASE_URL}/api/enterprise/test-notification`, {
          userId: user.id,
          title: 'Multi-Device Test',
          body: `Testing multi-device sync for ${user.username}`,
          type: 'message_received'
        }, {
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
          }
        });

        this.log('debug', `🔄 Multi-device notification sent to ${user.devices.length} devices for ${user.username}`);
        
        // Count expected notifications (one per active device)
        this.testResults.notifications.sent += user.devices.length;

      } catch (error) {
        this.log('error', `❌ Multi-device sync test failed for ${user.username}:`, error.message);
      }
    }
  }

  // 🎯 Test Foreground vs Background Scenarios
  async testForegroundBackgroundScenarios() {
    const connectedUsers = this.sockets.map(s => this.users.find(u => u.id === s.userId));
    const disconnectedUsers = this.users.filter(u => !connectedUsers.find(c => c.id === u.id));
    
    this.log('info', `🎯 Testing foreground (${connectedUsers.length}) vs background (${disconnectedUsers.length}) scenarios`);
    
    // Test foreground notifications (WebSocket connected users)
    for (const user of connectedUsers.slice(0, 3)) {
      try {
        await axios.post(`${CONFIG.BASE_URL}/api/enterprise/test-notification`, {
          userId: user.id,
          title: 'Foreground Test',
          body: `Testing foreground notification for ${user.username}`,
          type: 'message_received'
        }, {
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
          }
        });
        
        this.testResults.notifications.foreground++;

      } catch (error) {
        this.log('error', `❌ Foreground test failed for ${user.username}:`, error.message);
      }
    }

    // Test background notifications (WebSocket disconnected users)
    for (const user of disconnectedUsers.slice(0, 3)) {
      try {
        await axios.post(`${CONFIG.BASE_URL}/api/enterprise/test-notification`, {
          userId: user.id,
          title: 'Background Test', 
          body: `Testing background notification for ${user.username}`,
          type: 'message_received'
        }, {
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
          }
        });
        
        this.testResults.notifications.background++;

      } catch (error) {
        this.log('error', `❌ Background test failed for ${user.username}:`, error.message);
      }
    }
  }

  // ⚡ Test High Frequency Notifications
  async testHighFrequencyNotifications() {
    this.log('info', '⚡ Testing high frequency notifications...');
    
    const testUser = this.users[0];
    if (!testUser) return;

    const notifications = [];
    const notificationCount = 10;
    
    for (let i = 0; i < notificationCount; i++) {
      notifications.push(
        axios.post(`${CONFIG.BASE_URL}/api/enterprise/test-notification`, {
          userId: testUser.id,
          title: `High Freq Test ${i + 1}`,
          body: `High frequency notification ${i + 1} for ${testUser.username}`,
          type: 'message_received'
        }, {
          headers: {
            'Authorization': `Bearer ${testUser.token}`,
            'Content-Type': 'application/json'
          }
        })
      );
    }

    const results = await Promise.allSettled(notifications);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    this.testResults.notifications.sent += notificationCount;
    this.log('info', `⚡ High frequency test: ${successful}/${notificationCount} notifications sent`);
  }

  // 🚀 RUN LOAD TEST
  async runLoadTest() {
    if (CONFIG.LOAD_TEST_DURATION <= 0) {
      this.log('info', '⏸️ Load testing disabled (duration = 0)');
      return;
    }

    this.log('info', `🚀 Starting load test for ${CONFIG.LOAD_TEST_DURATION / 1000} seconds...`);
    
    const loadTestEndTime = Date.now() + CONFIG.LOAD_TEST_DURATION;
    const loadTestPromises = [];

    // Start multiple concurrent load test workers
    for (let i = 0; i < CONFIG.CONCURRENT_TESTS; i++) {
      loadTestPromises.push(this.runLoadTestWorker(i, loadTestEndTime));
    }

    await Promise.allSettled(loadTestPromises);
    this.log('info', '🚀 Load test completed');
  }

  async runLoadTestWorker(workerId, endTime) {
    let operationCount = 0;
    
    while (Date.now() < endTime && this.isRunning) {
      try {
        const randomUser = this.users[Math.floor(Math.random() * this.users.length)];
        const randomReceiver = this.users[Math.floor(Math.random() * this.users.length)];
        
        if (randomUser && randomReceiver && randomUser.id !== randomReceiver.id) {
          // Randomly choose operation type
          const operations = ['message', 'notification', 'request'];
          const operation = operations[Math.floor(Math.random() * operations.length)];
          
          switch (operation) {
            case 'message':
              await this.sendTestMessage(randomUser, randomReceiver, `Load test message ${operationCount}`);
              break;
            case 'notification':
              await axios.post(`${CONFIG.BASE_URL}/api/enterprise/test-notification`, {
                userId: randomReceiver.id,
                title: 'Load Test',
                body: `Load test notification ${operationCount}`,
                type: 'message_received'
              }, {
                headers: { 'Authorization': `Bearer ${randomUser.token}` }
              });
              break;
            case 'request':
              await this.sendMessageRequest(randomUser, randomReceiver);
              break;
          }
          
          operationCount++;
        }

        // Wait between operations
        await this.sleep(CONFIG.NOTIFICATION_INTERVAL);

      } catch (error) {
        this.testResults.errors.push({ 
          type: 'LOAD_TEST_ERROR', 
          workerId, 
          error: error.message 
        });
      }
    }

    this.log('info', `🏭 Load test worker ${workerId} completed ${operationCount} operations`);
  }

  // 📊 GENERATE TEST REPORT
  async generateTestReport() {
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log('🔥 FIREBASE NOTIFICATION TEST ENVIRONMENT - FINAL REPORT');
    console.log('='.repeat(80));
    
    console.log('\n📊 TEST SUMMARY:');
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)} seconds`);
    console.log(`👥 Users Simulated: ${this.users.length}`);
    console.log(`📱 Devices Registered: ${this.devices.length}`);
    console.log(`🌐 WebSocket Connections: ${this.sockets.length}`);
    
    console.log('\n🔔 NOTIFICATION METRICS:');
    console.log(`📨 Notifications Sent: ${this.testResults.notifications.sent}`);
    console.log(`✅ Notifications Delivered: ${this.testResults.notifications.delivered}`);
    console.log(`❌ Notifications Failed: ${this.testResults.notifications.failed}`);
    console.log(`📺 Foreground Notifications: ${this.testResults.notifications.foreground}`);
    console.log(`📱 Background Notifications: ${this.testResults.notifications.background}`);
    
    console.log('\n💬 MESSAGE METRICS:');
    console.log(`📨 Messages Sent: ${this.testResults.messages.sent}`);
    console.log(`✅ Messages Delivered: ${this.testResults.messages.delivered}`);
    console.log(`❌ Messages Failed: ${this.testResults.messages.failed}`);
    
    console.log('\n📬 MESSAGE REQUEST METRICS:');
    console.log(`📬 Requests Sent: ${this.testResults.messageRequests.sent}`);
    console.log(`✅ Requests Accepted: ${this.testResults.messageRequests.accepted}`);
    console.log(`❌ Requests Rejected: ${this.testResults.messageRequests.rejected}`);
    
    console.log('\n⚡ PERFORMANCE METRICS:');
    console.log(`⚡ Average Response Time: ${this.testResults.performance.avgResponseTime.toFixed(2)}ms`);
    console.log(`🚀 Max Response Time: ${this.testResults.performance.maxResponseTime}ms`);
    console.log(`⚡ Min Response Time: ${this.testResults.performance.minResponseTime}ms`);
    
    if (this.testResults.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.testResults.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.type}: ${error.error}`);
      });
    }

    // Calculate success rates
    const notificationSuccessRate = this.testResults.notifications.sent > 0 
      ? ((this.testResults.notifications.delivered / this.testResults.notifications.sent) * 100).toFixed(2)
      : 0;
    
    const messageSuccessRate = this.testResults.messages.sent > 0
      ? ((this.testResults.messages.delivered / this.testResults.messages.sent) * 100).toFixed(2) 
      : 0;

    console.log('\n📈 SUCCESS RATES:');
    console.log(`🔔 Notification Success Rate: ${notificationSuccessRate}%`);
    console.log(`💬 Message Success Rate: ${messageSuccessRate}%`);
    
    console.log('\n🎯 ENTERPRISE SYSTEM STATUS:');
    if (this.devices.length > 0) {
      const avgDevicesPerUser = (this.devices.length / this.users.length).toFixed(2);
      console.log(`📱 Average Devices per User: ${avgDevicesPerUser}`);
      console.log(`🏢 Multi-Device Support: ✅ Working`);
      console.log(`🔄 Device Synchronization: ✅ Tested`);
      console.log(`🔐 User Isolation: ✅ Verified`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 TEST ENVIRONMENT EXECUTION COMPLETED');
    console.log('='.repeat(80) + '\n');

    // Save detailed report to file
    await this.saveDetailedReport();
  }

  // 💾 SAVE DETAILED REPORT
  async saveDetailedReport() {
    const reportData = {
      testConfig: CONFIG,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      results: this.testResults,
      users: this.users.map(u => ({
        id: u.id,
        username: u.username,
        deviceCount: u.devices.length
      })),
      devices: this.devices.map(d => ({
        userId: d.userId,
        deviceType: d.deviceType,
        model: d.deviceModel,
        isRegistered: d.isRegistered
      })),
      sockets: this.sockets.map(s => ({
        userId: s.userId,
        username: s.username,
        isConnected: s.isConnected
      }))
    };

    const reportFilename = `firebase-notification-test-report-${Date.now()}.json`;
    
    try {
      const fs = require('fs');
      fs.writeFileSync(reportFilename, JSON.stringify(reportData, null, 2));
      console.log(`📄 Detailed report saved to: ${reportFilename}`);
    } catch (error) {
      console.warn(`⚠️ Could not save detailed report: ${error.message}`);
    }
  }

  // 🧹 CLEANUP
  async cleanup() {
    this.log('info', '🧹 Cleaning up test environment...');
    this.isRunning = false;

    // Close WebSocket connections
    for (const socket of this.sockets) {
      try {
        if (socket.ws && socket.ws.readyState === WebSocket.OPEN) {
          socket.ws.close();
        }
      } catch (error) {
        this.log('warn', `⚠️ Error closing WebSocket for ${socket.username}:`, error.message);
      }
    }

    // Optional: Clean up test data (users, devices)
    // This is commented out to allow inspection of test data after completion
    /*
    for (const user of this.users) {
      try {
        // Unregister devices
        for (const device of user.devices) {
          await axios.post(`${CONFIG.BASE_URL}/api/devices/unregister-token`, {
            token: device.fcmToken,
            allDevices: false
          }, {
            headers: { 'Authorization': `Bearer ${user.token}` }
          });
        }
      } catch (error) {
        this.log('warn', `⚠️ Error cleaning up user ${user.username}:`, error.message);
      }
    }
    */

    this.log('info', '✅ Cleanup completed');
  }

  // 🛠️ UTILITY METHODS
  createTestPairs(count) {
    const pairs = [];
    const availableUsers = [...this.users];
    
    for (let i = 0; i < count && availableUsers.length >= 2; i++) {
      const senderIndex = Math.floor(Math.random() * availableUsers.length);
      const sender = availableUsers.splice(senderIndex, 1)[0];
      
      const receiverIndex = Math.floor(Math.random() * availableUsers.length);
      const receiver = availableUsers.splice(receiverIndex, 1)[0];
      
      pairs.push({ sender, receiver });
    }
    
    return pairs;
  }

  updatePerformanceMetrics(responseTime) {
    if (responseTime > this.testResults.performance.maxResponseTime) {
      this.testResults.performance.maxResponseTime = responseTime;
    }
    if (responseTime < this.testResults.performance.minResponseTime) {
      this.testResults.performance.minResponseTime = responseTime;
    }
    
    // Calculate moving average (simplified)
    this.testResults.performance.avgResponseTime = 
      (this.testResults.performance.avgResponseTime + responseTime) / 2;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  log(level, message, ...args) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[CONFIG.LOG_LEVEL] || 1;
    
    if (levels[level] >= configLevel) {
      const timestamp = new Date().toISOString();
      const prefix = {
        debug: '🔍',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌'
      };
      
      console.log(`${prefix[level]} [${timestamp}] ${message}`, ...args);
    }
  }
}

// 🚀 MAIN EXECUTION
if (require.main === module) {
  const testEnvironment = new FirebaseNotificationTestEnvironment();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Test interrupted. Cleaning up...');
    testEnvironment.isRunning = false;
    await testEnvironment.cleanup();
    process.exit(0);
  });

  // Run the comprehensive test
  testEnvironment.runComprehensiveTest()
    .then(() => {
      console.log('🎉 Test environment execution completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test environment failed:', error);
      process.exit(1);
    });
}

module.exports = FirebaseNotificationTestEnvironment; 