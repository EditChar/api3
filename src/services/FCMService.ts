import { Platform } from 'react-native';

// Firebase messaging type-safe import
interface RemoteMessage {
  messageId?: string;
  notification?: {
    title?: string;
    body?: string;
  };
  data?: { [key: string]: string };
}

// Mock Firebase messaging for TypeScript compatibility
interface MessagingModule {
  requestPermission(): Promise<number>;
  getToken(): Promise<string>;
  setBackgroundMessageHandler(handler: (message: RemoteMessage) => Promise<void>): void;
  onMessage(handler: (message: RemoteMessage) => void): () => void;
  onNotificationOpenedApp(handler: (message: RemoteMessage) => void): () => void;
  getInitialNotification(): Promise<RemoteMessage | null>;
  AuthorizationStatus: {
    AUTHORIZED: number;
    PROVISIONAL: number;
  };
}

// Try to import Firebase messaging, fallback to mock if not available
let messaging: MessagingModule;
try {
  const firebaseMessaging = require('@react-native-firebase/messaging');
  messaging = firebaseMessaging.default || firebaseMessaging;
} catch (error) {
  console.warn('⚠️ Firebase messaging not available, using mock');
  messaging = {
    requestPermission: () => Promise.resolve(1),
    getToken: () => Promise.resolve('mock-token'),
    setBackgroundMessageHandler: () => {},
    onMessage: () => () => {},
    onNotificationOpenedApp: () => () => {},
    getInitialNotification: () => Promise.resolve(null),
    AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 }
  };
}

class FCMService {
  private isInitialized = false;

  async initialize(): Promise<boolean> {
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

    } catch (error: any) {
      console.error('❌ FCM initialization failed:', error);
      return false;
    }
  }

  private setupSafeMessageHandlers(): void {
    try {
      // 🛡️ CRASH-SAFE: Background message handler
      messaging.setBackgroundMessageHandler(async (remoteMessage: RemoteMessage) => {
        try {
          console.log('📱 Background FCM message:', remoteMessage.messageId);
          // Minimal handling - just log, no complex operations
          return Promise.resolve();
        } catch (error: any) {
          console.error('❌ Background message handler error:', error);
          return Promise.resolve(); // Always resolve to prevent crash
        }
      });

      // 🛡️ CRASH-SAFE: Foreground message handler  
      messaging.onMessage(async (remoteMessage: RemoteMessage) => {
        try {
          console.log('📱 Foreground FCM message:', remoteMessage.messageId);
          console.log('📱 Title:', remoteMessage.notification?.title);
          console.log('📱 Body:', remoteMessage.notification?.body);
          // Minimal handling - just log, no complex operations
        } catch (error: any) {
          console.error('❌ Foreground message handler error:', error);
          // Don't throw - just log and continue
        }
      });

      // 🛡️ CRASH-SAFE: Notification opened app
      messaging.onNotificationOpenedApp((remoteMessage: RemoteMessage) => {
        try {
          console.log('📱 Notification opened app:', remoteMessage.messageId);
          // Minimal handling - just log
        } catch (error: any) {
          console.error('❌ Notification opened handler error:', error);
          // Don't throw - just log and continue
        }
      });

      // 🛡️ CRASH-SAFE: App opened by notification
      messaging
        .getInitialNotification()
        .then((remoteMessage: RemoteMessage | null) => {
          try {
            if (remoteMessage) {
              console.log('📱 App opened by notification:', remoteMessage.messageId);
              // Minimal handling - just log
            }
          } catch (error: any) {
            console.error('❌ Initial notification handler error:', error);
            // Don't throw - just log and continue
          }
        })
        .catch((error: any) => {
          console.error('❌ Get initial notification error:', error);
          // Don't throw - just log and continue
        });

      console.log('✅ FCM message handlers setup completed');

    } catch (error: any) {
      console.error('❌ FCM message handlers setup failed:', error);
      // Don't throw - service should continue without handlers if needed
    }
  }

  async getToken(): Promise<string | null> {
    try {
      const token = await messaging.getToken();
      return token;
    } catch (error: any) {
      console.error('❌ Error getting FCM token:', error);
      return null;
    }
  }
}

export default new FCMService(); 