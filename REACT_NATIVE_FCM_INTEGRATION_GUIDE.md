# 🔥 React Native Firebase Cloud Messaging Integration Guide

## 📋 Backend System Overview

Backend'inizde enterprise-grade FCM sistemi tamamen kurulu ve aktif. Aşağıdaki özellikler mevcut:

### ✅ Mevcut Backend Features
- **Multi-device support** (kullanıcı başına max 10 cihaz)
- **Enterprise notification service** (batch sending, retry mechanisms)
- **Real-time WebSocket integration**
- **Token management** (register/unregister endpoints)
- **Notification persistence** (database + Redis cache)
- **Failed token cleanup** (invalid token auto-removal)
- **Metrics and analytics** (delivery tracking)

---

## 🎯 Frontend Integration Requirements

### 1. 📦 Required Dependencies

```bash
# React Native Firebase (Ana paket)
npm install @react-native-firebase/app

# FCM messaging modülü
npm install @react-native-firebase/messaging

# Permissions (iOS için)
npm install react-native-permissions
```

### 2. 📱 Platform Configuration

#### Android Configuration

**android/google-services.json** dosyası zaten mevcut ve doğru konfigüre edilmiş:
```json
{
  "project_info": {
    "project_id": "easyto-prod",
    "project_number": "1078215278691"
  },
  "client": [{
    "client_info": {
      "mobilesdk_app_id": "1:1078215278691:android:67f0634d318658feb67856",
      "android_client_info": {
        "package_name": "com.newapi"
      }
    }
  }]
}
```

**android/app/build.gradle** dosyasına ekleyin:
```gradle
dependencies {
    implementation 'com.google.firebase:firebase-messaging:23.0.0'
    // ... existing dependencies
}

// En alta ekleyin
apply plugin: 'com.google.gms.google-services'
```

**android/build.gradle** (project level) dosyasına ekleyin:
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.3.15'
        // ... existing classpath entries
    }
}
```

#### iOS Configuration

**ios/newApi/GoogleService-Info.plist** dosyası oluşturun ve Firebase Console'dan indirin.

**ios/Podfile** dosyasına ekleyin:
```ruby
pod 'Firebase', :modular_headers => true
pod 'GoogleUtilities', :modular_headers => true
```

### 3. 🔧 FCM Service Implementation

```typescript
// services/FCMService.ts
import messaging from '@react-native-firebase/messaging';
import { Platform, Alert } from 'react-native';

class FCMService {
  private isInitialized = false;

  // 🚀 Initialize FCM service
  async initialize(): Promise<boolean> {
    try {
      console.log('🔥 FCM Service initializing...');

      // Request permissions
      const authStatus = await messaging().requestPermission();
      const enabled = 
        authStatus === messaging.AuthorizationStatus.AUTHORIZED || 
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.warn('🚫 FCM permission denied');
        return false;
      }

      console.log('✅ FCM permission granted');

      // Setup message handlers
      this.setupMessageHandlers();

      // Get FCM token
      const token = await messaging().getToken();
      console.log('📱 FCM Token:', token.substring(0, 20) + '...');

      // Register token with backend
      await this.registerTokenWithBackend(token);

      this.isInitialized = true;
      console.log('✅ FCM Service initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ FCM initialization failed:', error);
      return false;
    }
  }

  // 📡 Register token with your backend
  private async registerTokenWithBackend(token: string) {
    try {
      // Backend endpoint: /api/device/register-token
      const response = await fetch(`${API_BASE_URL}/api/device/register-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`, // User auth token
        },
        body: JSON.stringify({
          token: token,
          deviceType: Platform.OS,
          platform: Platform.OS,
          deviceInfo: {
            os: Platform.OS,
            osVersion: Platform.Version,
            model: 'Unknown', // Device.getModel() if using react-native-device-info
            brand: 'Unknown',
          },
          appVersion: '1.0.0', // From package.json
          timezone: 'Europe/Istanbul',
        }),
      });

      const result = await response.json();
      
      if (result.message === 'Enterprise FCM token registered successfully') {
        console.log('✅ Token registered with backend enterprise system');
        console.log(`📱 Active devices: ${result.enterprise.activeDeviceCount}`);
      } else {
        console.error('❌ Backend token registration failed:', result);
      }

    } catch (error) {
      console.error('❌ Error registering token with backend:', error);
    }
  }

  // 📨 Setup message handlers
  private setupMessageHandlers() {
    // 🔔 Foreground messages
    messaging().onMessage(async remoteMessage => {
      console.log('📱 Foreground FCM message received:', remoteMessage);
      
      // Show local notification or update UI
      this.handleForegroundMessage(remoteMessage);
    });

    // 🔄 Background/Quit messages (opens app)
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('📱 Notification opened app:', remoteMessage);
      
      // Navigate to specific screen
      this.handleNotificationNavigation(remoteMessage);
    });

    // 🚀 App launched by notification
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('📱 App launched by notification:', remoteMessage);
          this.handleNotificationNavigation(remoteMessage);
        }
      });

    // 🔄 Token refresh
    messaging().onTokenRefresh(token => {
      console.log('📱 FCM token refreshed:', token.substring(0, 20) + '...');
      this.registerTokenWithBackend(token);
    });
  }

  // 🎯 Handle foreground messages
  private handleForegroundMessage(remoteMessage: any) {
    const { notification, data } = remoteMessage;
    
    if (notification) {
      // Show in-app notification or alert
      Alert.alert(
        notification.title || 'Bildirim',
        notification.body || 'Yeni mesaj',
        [{ text: 'Tamam' }]
      );
    }

    // Handle different notification types
    if (data?.type) {
      switch (data.type) {
        case 'message_received':
          // Update chat UI, show badge
          this.handleMessageReceived(data);
          break;
        case 'message_request':
          // Show message request notification
          this.handleMessageRequest(data);
          break;
        case 'request_accepted':
          // Navigate to chat
          this.handleRequestAccepted(data);
          break;
      }
    }
  }

  // 🧭 Handle navigation from notifications
  private handleNotificationNavigation(remoteMessage: any) {
    const { data } = remoteMessage;
    
    if (data?.type) {
      switch (data.type) {
        case 'message_received':
          // Navigate to specific chat
          // NavigationService.navigate('Chat', { chatId: data.chatId });
          break;
        case 'message_request':
          // Navigate to message requests
          // NavigationService.navigate('MessageRequests');
          break;
        case 'request_accepted':
          // Navigate to new chat
          // NavigationService.navigate('Chat', { chatId: data.chatId });
          break;
      }
    }
  }

  // 💬 Handle specific message types
  private handleMessageReceived(data: any) {
    // Update local chat state
    // Increment badge count
    // Show in-app notification
    console.log('📬 New message from:', data.senderName);
  }

  private handleMessageRequest(data: any) {
    console.log('🤝 New message request from:', data.senderName);
    // Update message requests badge
  }

  private handleRequestAccepted(data: any) {
    console.log('✅ Request accepted by:', data.accepterName);
    // Navigate to chat
  }

  // 🔓 Unregister token (logout)
  async unregisterToken(allDevices: boolean = false) {
    try {
      const token = await messaging().getToken();
      
      const response = await fetch(`${API_BASE_URL}/api/device/unregister-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          token: token,
          allDevices: allDevices,
        }),
      });

      const result = await response.json();
      console.log('📱 Token unregistered:', result.enterprise);

    } catch (error) {
      console.error('❌ Error unregistering token:', error);
    }
  }

  // 📊 Check if initialized
  get initialized(): boolean {
    return this.isInitialized;
  }
}

export default new FCMService();
```

### 4. 🎯 App Integration

#### App.tsx veya Ana Component'te

```typescript
// App.tsx
import React, { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import FCMService from './services/FCMService';

const App = () => {
  useEffect(() => {
    initializeFCM();
    
    // Handle app state changes
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && FCMService.initialized) {
        // App came to foreground - refresh token if needed
        console.log('📱 App became active');
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, []);

  const initializeFCM = async () => {
    try {
      // Wait for user authentication first
      // const isAuthenticated = await checkUserAuthentication();
      // if (!isAuthenticated) return;

      const fcmInitialized = await FCMService.initialize();
      
      if (fcmInitialized) {
        console.log('✅ FCM successfully integrated with backend');
      } else {
        console.warn('⚠️ FCM initialization failed');
      }
      
    } catch (error) {
      console.error('❌ FCM integration error:', error);
    }
  };

  return (
    // Your app content
  );
};

export default App;
```

#### Background Message Handler (index.js)

```javascript
// index.js (React Native entry point)
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';

// 🔄 Background message handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('📱 Background message handled:', remoteMessage.messageId);
  
  // Minimal processing in background
  // Don't perform heavy operations here
  
  return Promise.resolve();
});

AppRegistry.registerComponent('newApi', () => App);
```

---

## 🌐 Backend API Endpoints

### Device Management

#### Register FCM Token
```http
POST /api/device/register-token
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "token": "FCM_TOKEN_HERE",
  "deviceType": "android", // or "ios"
  "platform": "android",
  "deviceInfo": {
    "os": "android",
    "osVersion": "13",
    "model": "Pixel 6",
    "brand": "Google"
  },
  "appVersion": "1.0.0",
  "timezone": "Europe/Istanbul"
}
```

**Response:**
```json
{
  "message": "Enterprise FCM token registered successfully",
  "enterprise": {
    "tokenId": "eXcG8vJxRk...",
    "deviceType": "android",
    "activeDeviceCount": 2,
    "multiDeviceEnabled": true,
    "maxDevicesPerUser": 10,
    "registrationTimestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Unregister FCM Token
```http
POST /api/device/unregister-token
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "token": "FCM_TOKEN_HERE",
  "allDevices": false  // true = logout from all devices
}
```

### Notification Management

#### Get Notifications
```http
GET /api/notifications
Authorization: Bearer <user_token>
```

#### Mark as Read
```http
PATCH /api/notifications/:notificationId/read
Authorization: Bearer <user_token>
```

#### Get Unread Count
```http
GET /api/notifications/unread-count
Authorization: Bearer <user_token>
```

---

## 🔧 Environment Configuration

### Environment Variables (.env)

```bash
# API Base URL
API_BASE_URL=https://your-api-domain.com

# Firebase Configuration (eğer manuel config gerekirse)
FIREBASE_PROJECT_ID=easyto-prod
FIREBASE_APP_ID_ANDROID=1:1078215278691:android:67f0634d318658feb67856
```

---

## 🧪 Testing

### Test FCM Integration

```typescript
// TestFCMService.ts
import FCMService from './services/FCMService';

export const testFCMIntegration = async () => {
  try {
    console.log('🧪 Testing FCM integration...');
    
    // 1. Initialize service
    const initialized = await FCMService.initialize();
    console.log('✅ FCM initialized:', initialized);
    
    // 2. Get token
    const token = await messaging().getToken();
    console.log('📱 Current token:', token.substring(0, 30) + '...');
    
    // 3. Test backend registration
    // (Automatic in initialize method)
    
    console.log('✅ FCM integration test completed');
    
  } catch (error) {
    console.error('❌ FCM integration test failed:', error);
  }
};
```

---

## 📱 Platform-Specific Notes

### Android
- **Notification channels** automatically handled by Firebase
- **Background processing** limited - keep handlers simple
- **App icon** must be in `android/app/src/main/res/drawable`

### iOS
- **Push notification entitlements** required in Xcode
- **Background app refresh** must be enabled
- **Notification service extension** optional for rich media

---

## ⚠️ Important Notes

### Security
- **Never log full tokens** in production
- **Tokens are sensitive** - handle securely
- **User permissions** required before registration

### Performance
- **Initialize after user authentication** - tokens are user-specific
- **Handle background messages minimally** - avoid heavy processing
- **Cache notification state** locally when possible

### Error Handling
- **Token refresh** handled automatically
- **Invalid tokens** automatically removed by backend
- **Network failures** have retry mechanisms in backend

---

## 🎉 Success Criteria

After successful integration, you should have:

✅ **FCM tokens registered** with backend enterprise system  
✅ **Push notifications received** on both foreground and background  
✅ **Navigation working** from notification taps  
✅ **Multi-device support** (user can receive notifications on multiple devices)  
✅ **Automatic token management** (refresh, cleanup, etc.)  
✅ **Enterprise analytics** (delivery tracking, metrics)

---

## 🆘 Troubleshooting

### Common Issues

1. **"Notifications not received"**
   - Check Firebase project configuration
   - Verify google-services.json/GoogleService-Info.plist
   - Ensure permissions granted

2. **"Token registration failed"**
   - Check API endpoint URL
   - Verify user authentication token
   - Check network connectivity

3. **"Background notifications not working"**
   - Ensure background message handler in index.js
   - Check device power management settings
   - Verify app not killed by system

### Debug Commands

```bash
# Check Firebase setup
npx react-native run-android --variant=debug

# View logs
npx react-native log-android  # Android
npx react-native log-ios      # iOS
```

---

## 📞 Backend Support

Backend sisteminiz tamamen hazır. Herhangi bir sorun yaşarsanız:

1. **Token registration issues** - Backend enterprise notification servis aktif
2. **Multi-device support** - Kullanıcı başına 10 cihaz limiti
3. **Notification delivery** - Batch sending ve retry mechanisms mevcut
4. **Analytics** - Delivery tracking ve metrics otomatik

**Backend endpoint'leriniz:**
- Device management: `/api/device/*`
- Notifications: `/api/notifications/*`
- Enterprise features: Full multi-device support active

Başarılar! 🚀 