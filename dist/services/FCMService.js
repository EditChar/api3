"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Try to import Firebase messaging, fallback to mock if not available
let messaging;
try {
    const firebaseMessaging = require('@react-native-firebase/messaging');
    messaging = firebaseMessaging.default || firebaseMessaging;
}
catch (error) {
    console.warn('⚠️ Firebase messaging not available, using mock');
    messaging = {
        requestPermission: () => Promise.resolve(1),
        getToken: () => Promise.resolve('mock-token'),
        setBackgroundMessageHandler: () => { },
        onMessage: () => () => { },
        onNotificationOpenedApp: () => () => { },
        getInitialNotification: () => Promise.resolve(null),
        AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 }
    };
}
class FCMService {
    constructor() {
        this.isInitialized = false;
    }
    async initialize() {
        try {
            console.log('🔥 FCM Service initializing...');
            if (this.isInitialized) {
                console.log('✅ FCM Service already initialized');
                return true;
            }
            // Request permissions
            const authStatus = await messaging.requestPermission();
            const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                authStatus === messaging.AuthorizationStatus.PROVISIONAL;
            if (!enabled) {
                console.warn('🚫 FCM permission denied');
                return false;
            }
            console.log('✅ FCM permission granted');
            // Setup crash-safe message handlers
            this.setupSafeMessageHandlers();
            // Get and log token
            const token = await messaging.getToken();
            console.log('📱 FCM Token:', token.substring(0, 20) + '...');
            this.isInitialized = true;
            console.log('✅ FCM Service initialized successfully');
            return true;
        }
        catch (error) {
            console.error('❌ FCM initialization failed:', error);
            return false;
        }
    }
    setupSafeMessageHandlers() {
        try {
            // 🛡️ CRASH-SAFE: Background message handler
            messaging.setBackgroundMessageHandler(async (remoteMessage) => {
                try {
                    console.log('📱 Background FCM message:', remoteMessage.messageId);
                    // Minimal handling - just log, no complex operations
                    return Promise.resolve();
                }
                catch (error) {
                    console.error('❌ Background message handler error:', error);
                    return Promise.resolve(); // Always resolve to prevent crash
                }
            });
            // 🛡️ CRASH-SAFE: Foreground message handler  
            messaging.onMessage(async (remoteMessage) => {
                try {
                    console.log('📱 Foreground FCM message:', remoteMessage.messageId);
                    console.log('📱 Title:', remoteMessage.notification?.title);
                    console.log('📱 Body:', remoteMessage.notification?.body);
                    // Minimal handling - just log, no complex operations
                }
                catch (error) {
                    console.error('❌ Foreground message handler error:', error);
                    // Don't throw - just log and continue
                }
            });
            // 🛡️ CRASH-SAFE: Notification opened app
            messaging.onNotificationOpenedApp((remoteMessage) => {
                try {
                    console.log('📱 Notification opened app:', remoteMessage.messageId);
                    // Minimal handling - just log
                }
                catch (error) {
                    console.error('❌ Notification opened handler error:', error);
                    // Don't throw - just log and continue
                }
            });
            // 🛡️ CRASH-SAFE: App opened by notification
            messaging
                .getInitialNotification()
                .then((remoteMessage) => {
                try {
                    if (remoteMessage) {
                        console.log('📱 App opened by notification:', remoteMessage.messageId);
                        // Minimal handling - just log
                    }
                }
                catch (error) {
                    console.error('❌ Initial notification handler error:', error);
                    // Don't throw - just log and continue
                }
            })
                .catch((error) => {
                console.error('❌ Get initial notification error:', error);
                // Don't throw - just log and continue
            });
            console.log('✅ FCM message handlers setup completed');
        }
        catch (error) {
            console.error('❌ FCM message handlers setup failed:', error);
            // Don't throw - service should continue without handlers if needed
        }
    }
    async getToken() {
        try {
            const token = await messaging.getToken();
            return token;
        }
        catch (error) {
            console.error('❌ Error getting FCM token:', error);
            return null;
        }
    }
}
exports.default = new FCMService();
