# 🔥 REACT NATIVE FIREBASE CLOUD MESSAGING INTEGRATION

## 📋 **FRONTEND TASK: Enterprise FCM Integration**

### **🎯 OBJECTIVE:**
Integrate Firebase Cloud Messaging with our **Enterprise User-Centric Multi-Device Notification System** for React Native app. Enable seamless cross-device notifications with WhatsApp-like behavior.

---

## 🏢 **BACKEND SYSTEM OVERVIEW:**

### **✅ Backend Status:**
- **Server:** `http://localhost:3001` (running)
- **Firebase Project:** `easyto-prod` (configured)
- **Enterprise System:** Multi-device user-centric notifications
- **Database:** Optimized with device analytics & tracking
- **Security:** User isolation & token deduplication

### **🔗 Key Backend Endpoints:**
```typescript
// Device Management (Multi-device support)
POST /api/devices/register-token
POST /api/devices/unregister-token

// Enterprise Features
GET /api/enterprise/devices
GET /api/enterprise/stats
POST /api/enterprise/test-notification

// Authentication  
POST /api/auth/login
POST /api/auth/logout
```

---

## 🚀 **REACT NATIVE INTEGRATION REQUIREMENTS:**

### **1. FIREBASE SETUP**

#### **Install Dependencies:**
```bash
npm install @react-native-firebase/app
npm install @react-native-firebase/messaging
npm install @react-native-community/push-notification-ios  # iOS only
npm install react-native-push-notification
npm install @react-native-async-storage/async-storage
```

#### **Firebase Config Files:**
```typescript
// android/app/google-services.json (from Firebase Console)
// ios/GoogleService-Info.plist (from Firebase Console)
// Firebase Project: easyto-prod
```

#### **Android Configuration:**
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<service android:name="io.invertase.firebase.messaging.RNFirebaseMessagingService"
         android:exported="false">
  <intent-filter>
    <action android:name="com.google.firebase.MESSAGING_EVENT" />
  </intent-filter>
</service>

<!-- Notification Channel -->
<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id"
           android:value="chat_notifications"/>
```

#### **iOS Configuration:**
```xml
<!-- ios/Runner/Info.plist -->
<key>UIBackgroundModes</key>
<array>
  <string>remote-notification</string>
</array>
```

---

### **2. NOTIFICATION SERVICE IMPLEMENTATION**

#### **Core Service:**
```typescript
// services/NotificationService.ts
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotification from 'react-native-push-notification';
import { API_BASE_URL } from '../config';

interface NotificationData {
  type: 'message_received' | 'message_request' | 'request_accepted' | 'chat_ended';
  chatId?: string;
  senderId?: string;
  senderName?: string;
  requestId?: string;
  userId: string;
  timestamp: string;
  notificationId: string;
}

class NotificationService {
  private isInitialized = false;
  private authToken: string | null = null;

  async initialize(authToken: string) {
    this.authToken = authToken;
    
    if (this.isInitialized) return;
    
    // Request permissions
    const authStatus = await messaging().requestPermission();
    const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || 
                   authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.warn('🚫 Push notification permission denied');
      return false;
    }

    // Configure notification channel (Android)
    PushNotification.createChannel({
      channelId: "chat_notifications",
      channelName: "Chat Notifications",
      channelDescription: "Notifications for messages and chat events",
      importance: 4,
      vibrate: true,
    });

    // Get FCM token and register with backend
    await this.registerFCMToken();

    // Setup message handlers
    this.setupMessageHandlers();
    
    // Setup token refresh
    this.setupTokenRefresh();

    this.isInitialized = true;
    console.log('🔥 Firebase Cloud Messaging initialized');
    return true;
  }

  private async registerFCMToken() {
    try {
      const fcmToken = await messaging().getToken();
      if (!fcmToken) {
        console.error('❌ Failed to get FCM token');
        return;
      }

      console.log('📱 FCM Token:', fcmToken.substring(0, 20) + '...');
      
      // Store token locally
      await AsyncStorage.setItem('fcm_token', fcmToken);

      // Register with backend (Enterprise multi-device support)
      const response = await fetch(`${API_BASE_URL}/api/devices/register-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          token: fcmToken,
          deviceType: Platform.OS,
          deviceInfo: {
            model: DeviceInfo.getModel(),
            systemVersion: DeviceInfo.getSystemVersion(),
            appVersion: DeviceInfo.getVersion(),
            platform: Platform.OS,
            registeredAt: new Date().toISOString(),
          }
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ FCM Token registered with backend');
        console.log(`📱 Active devices: ${result.enterprise?.activeDeviceCount || 'Unknown'}`);
      } else {
        console.error('❌ Failed to register FCM token:', result.message);
      }
    } catch (error) {
      console.error('❌ Error registering FCM token:', error);
    }
  }

  private setupMessageHandlers() {
    // Handle background messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('📱 Background message:', remoteMessage);
      this.handleBackgroundNotification(remoteMessage);
    });

    // Handle foreground messages
    messaging().onMessage(async (remoteMessage) => {
      console.log('📱 Foreground message:', remoteMessage);
      this.handleForegroundNotification(remoteMessage);
    });

    // Handle notification opened app
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('📱 Notification opened app:', remoteMessage);
      this.handleNotificationPressed(remoteMessage);
    });

    // Check if app was opened by notification
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('📱 App opened by notification:', remoteMessage);
          this.handleNotificationPressed(remoteMessage);
        }
      });
  }

  private setupTokenRefresh() {
    messaging().onTokenRefresh(async (token) => {
      console.log('🔄 FCM Token refreshed');
      await AsyncStorage.setItem('fcm_token', token);
      await this.registerFCMToken();
    });
  }

  private handleBackgroundNotification(remoteMessage: any) {
    const data: NotificationData = remoteMessage.data;
    
    // Show local notification for background
    PushNotification.localNotification({
      channelId: "chat_notifications",
      title: remoteMessage.notification?.title || "New Message",
      message: remoteMessage.notification?.body || "You have a new message",
      data: data,
      importance: "high",
      priority: "high",
      vibrate: true,
      playSound: true,
      soundName: "default",
    });
  }

  private handleForegroundNotification(remoteMessage: any) {
    const data: NotificationData = remoteMessage.data;
    
    // WhatsApp-like behavior: Show in-app notification unless on chat screen
    const currentRoute = this.getCurrentRoute();
    const isOnChatScreen = currentRoute?.name === 'Chat' && 
                          currentRoute?.params?.chatId === data.chatId;

    if (!isOnChatScreen) {
      // Show in-app banner notification
      this.showInAppNotification({
        title: remoteMessage.notification?.title || "New Message",
        body: remoteMessage.notification?.body || "You have a new message",
        data: data,
      });
    }
    
    // Always update badge and local state
    this.updateBadgeCount();
    this.updateLocalNotificationState(data);
  }

  private handleNotificationPressed(remoteMessage: any) {
    const data: NotificationData = remoteMessage.data;
    
    // Navigate based on notification type
    switch (data.type) {
      case 'message_received':
        if (data.chatId) {
          NavigationService.navigate('Chat', { 
            chatId: data.chatId,
            fromNotification: true 
          });
        }
        break;
        
      case 'message_request':
        NavigationService.navigate('MessageRequests', {
          highlightId: data.requestId,
          fromNotification: true
        });
        break;
        
      case 'request_accepted':
        if (data.chatId) {
          NavigationService.navigate('Chat', { 
            chatId: data.chatId,
            fromNotification: true 
          });
        }
        break;
    }
  }

  async logout() {
    try {
      if (this.authToken) {
        // Unregister token from backend
        await fetch(`${API_BASE_URL}/api/devices/unregister-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`,
          },
          body: JSON.stringify({
            allDevices: false // Only current device
          }),
        });
      }

      // Clear local token
      await AsyncStorage.removeItem('fcm_token');
      this.authToken = null;
      this.isInitialized = false;
      
      console.log('🚫 FCM token unregistered on logout');
    } catch (error) {
      console.error('❌ Error during FCM logout:', error);
    }
  }

  // Enterprise features
  async getActiveDevices() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/enterprise/devices`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        return result.enterprise.devices;
      }
    } catch (error) {
      console.error('❌ Error fetching active devices:', error);
    }
    return [];
  }

  async sendTestNotification() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/enterprise/test-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          title: "Test Notification",
          body: "Enterprise multi-device notification system is working!"
        }),
      });

      const result = await response.json();
      console.log('🧪 Test notification result:', result);
      return result;
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
    }
  }
}

export default new NotificationService();
```

---

### **3. APP INTEGRATION**

#### **App.tsx Integration:**
```typescript
// App.tsx
import { useEffect } from 'react';
import NotificationService from './services/NotificationService';
import { useAuth } from './contexts/AuthContext';

export default function App() {
  const { user, token } = useAuth();

  useEffect(() => {
    if (user && token) {
      // Initialize notifications after login
      NotificationService.initialize(token);
    }
  }, [user, token]);

  // Rest of your app...
}
```

#### **Login Integration:**
```typescript
// screens/LoginScreen.tsx
import NotificationService from '../services/NotificationService';

const handleLogin = async (credentials) => {
  try {
    const response = await authAPI.login(credentials);
    const { token, user } = response.data;
    
    // Store auth data
    await AsyncStorage.setItem('auth_token', token);
    setUser(user);
    setToken(token);
    
    // Initialize FCM after successful login
    const fcmInitialized = await NotificationService.initialize(token);
    
    if (fcmInitialized) {
      console.log('✅ Login successful with FCM enabled');
    }
    
    navigation.navigate('Main');
  } catch (error) {
    console.error('❌ Login failed:', error);
  }
};
```

#### **Logout Integration:**
```typescript
// contexts/AuthContext.tsx
const logout = async () => {
  try {
    // Logout from backend
    await authAPI.logout();
    
    // Unregister FCM token
    await NotificationService.logout();
    
    // Clear local data
    await AsyncStorage.multiRemove(['auth_token', 'fcm_token']);
    
    setUser(null);
    setToken(null);
    
    console.log('✅ Logout successful');
  } catch (error) {
    console.error('❌ Logout error:', error);
  }
};
```

---

### **4. UI COMPONENTS**

#### **In-App Notification Banner:**
```typescript
// components/InAppNotification.tsx
import { useState, useEffect } from 'react';
import { Animated, TouchableOpacity, Text, View } from 'react-native';

interface InAppNotificationProps {
  title: string;
  body: string;
  onPress?: () => void;
  onDismiss?: () => void;
}

export const InAppNotification: React.FC<InAppNotificationProps> = ({
  title,
  body,
  onPress,
  onDismiss
}) => {
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    // Slide down animation
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Auto dismiss after 4 seconds
    const timer = setTimeout(() => {
      dismissNotification();
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const dismissNotification = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDismiss?.();
    });
  };

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#4A90E2',
        padding: 16,
        paddingTop: 50, // Account for status bar
        transform: [{ translateY: slideAnim }],
        zIndex: 9999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      }}
    >
      <TouchableOpacity
        onPress={() => {
          onPress?.();
          dismissNotification();
        }}
        style={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
            {title}
          </Text>
          <Text style={{ color: 'white', fontSize: 14, marginTop: 2 }}>
            {body}
          </Text>
        </View>
        <TouchableOpacity
          onPress={dismissNotification}
          style={{ padding: 8 }}
        >
          <Text style={{ color: 'white', fontSize: 18 }}>×</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};
```

#### **Enterprise Device Management Screen:**
```typescript
// screens/DeviceManagementScreen.tsx
import NotificationService from '../services/NotificationService';

export const DeviceManagementScreen = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const activeDevices = await NotificationService.getActiveDevices();
      setDevices(activeDevices);
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    try {
      const result = await NotificationService.sendTestNotification();
      Alert.alert(
        'Test Notification',
        `Sent to ${result.enterprise?.testResult?.totalDevices || 0} devices`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
        Active Devices ({devices.length}/10)
      </Text>
      
      <FlatList
        data={devices}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={{
            padding: 12,
            marginBottom: 8,
            backgroundColor: '#f5f5f5',
            borderRadius: 8,
            borderLeftWidth: 4,
            borderLeftColor: item.isPrimary ? '#4CAF50' : '#2196F3'
          }}>
            <Text style={{ fontWeight: 'bold' }}>
              {item.deviceType.toUpperCase()} 
              {item.isPrimary ? ' (Primary)' : ''}
            </Text>
            <Text style={{ color: '#666', marginTop: 4 }}>
              Last active: {new Date(item.lastActive).toLocaleString()}
            </Text>
            <Text style={{ color: '#666' }}>
              Token: {item.tokenId}
            </Text>
          </View>
        )}
      />

      <TouchableOpacity
        onPress={sendTestNotification}
        style={{
          backgroundColor: '#4CAF50',
          padding: 16,
          borderRadius: 8,
          alignItems: 'center',
          marginTop: 16,
        }}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
          Send Test Notification
        </Text>
      </TouchableOpacity>
    </View>
  );
};
```

---

### **5. NAVIGATION SERVICE**

```typescript
// services/NavigationService.ts
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

class NavigationService {
  navigate(routeName: string, params?: any) {
    if (navigationRef.isReady()) {
      navigationRef.navigate(routeName as never, params as never);
    }
  }

  getCurrentRoute() {
    if (navigationRef.isReady()) {
      return navigationRef.getCurrentRoute();
    }
    return null;
  }
}

export default new NavigationService();
```

---

### **6. CHAT SCREEN INTEGRATION**

```typescript
// screens/ChatScreen.tsx
import { useEffect, useState } from 'react';
import NotificationService from '../services/NotificationService';

export const ChatScreen = ({ route }) => {
  const { chatId } = route.params;
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // Mark chat as active (prevents in-app notifications for this chat)
    const markChatAsActive = () => {
      // This is handled automatically by NotificationService.getCurrentRoute()
    };

    markChatAsActive();

    // Clean up unread notifications for this chat
    const markMessagesAsRead = async () => {
      try {
        await fetch(`${API_BASE_URL}/api/chats/${chatId}/mark-read`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };

    markMessagesAsRead();

    return () => {
      // Chat is no longer active
    };
  }, [chatId]);

  // Rest of chat implementation...
};
```

---

### **7. TESTING & VALIDATION**

#### **Test Scenarios:**
```typescript
// utils/NotificationTesting.ts
export const testNotificationScenarios = {
  // Test 1: Multi-device sync
  async testMultiDeviceSync() {
    console.log('🧪 Testing multi-device synchronization...');
    const result = await NotificationService.sendTestNotification();
    return result;
  },

  // Test 2: Background notifications
  async testBackgroundNotification() {
    console.log('🧪 Testing background notification handling...');
    // Put app in background and send notification from backend
  },

  // Test 3: Foreground notifications  
  async testForegroundNotification() {
    console.log('🧪 Testing foreground notification handling...');
    // Keep app in foreground and send notification
  },

  // Test 4: Notification navigation
  async testNotificationNavigation() {
    console.log('🧪 Testing notification-triggered navigation...');
    // Test navigation when tapping notifications
  },

  // Test 5: Cross-device synchronization
  async testCrossDeviceSync() {
    console.log('🧪 Testing cross-device notification sync...');
    // Login from multiple devices and test sync
  }
};
```

---

## 🎯 **IMPLEMENTATION CHECKLIST:**

### **Phase 1: Basic Setup**
- [ ] Install Firebase dependencies
- [ ] Configure Firebase project (easyto-prod)
- [ ] Add platform-specific configuration files
- [ ] Implement NotificationService
- [ ] Test FCM token registration

### **Phase 2: Core Features**
- [ ] Implement message handlers (background/foreground)
- [ ] Add navigation integration
- [ ] Create in-app notification banner
- [ ] Implement notification-triggered navigation
- [ ] Test basic notification flow

### **Phase 3: Enterprise Features**
- [ ] Integrate multi-device management
- [ ] Add device management UI
- [ ] Implement enterprise analytics
- [ ] Add test notification functionality
- [ ] Test cross-device synchronization

### **Phase 4: UX Optimization**
- [ ] Implement WhatsApp-like behavior
- [ ] Add badge count management
- [ ] Optimize notification timing
- [ ] Add notification preferences
- [ ] Test user experience flows

### **Phase 5: Testing & Validation**
- [ ] Test all notification types
- [ ] Test multi-device scenarios
- [ ] Test background/foreground behavior
- [ ] Test navigation flows
- [ ] Validate enterprise features

---

## 📚 **REFERENCES & DOCUMENTATION:**

### **Firebase Documentation:**
- [React Native Firebase Messaging](https://rnfirebase.io/messaging/usage)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [FCM Setup Guide](https://rnfirebase.io/messaging/usage#installation)

### **React Native Push Notifications:**
- [react-native-push-notification](https://github.com/zo0r/react-native-push-notification)
- [React Navigation Deep Linking](https://reactnavigation.org/docs/deep-linking)

### **Backend API Reference:**
```typescript
// Base URL: http://localhost:3001

// Device Management
POST /api/devices/register-token
POST /api/devices/unregister-token

// Enterprise
GET /api/enterprise/devices  
GET /api/enterprise/stats
POST /api/enterprise/test-notification
GET /api/enterprise/health
```

---

## 🚀 **EXPECTED OUTCOME:**

### **✅ Success Criteria:**
1. **Multi-device notifications working** - User receives notifications on all active devices
2. **Cross-device synchronization** - Read status synced across devices
3. **WhatsApp-like UX** - Background notifications as system alerts, foreground as in-app banners
4. **Enterprise management** - Users can view and manage their active devices
5. **Secure token handling** - FCM tokens properly registered and managed
6. **Navigation integration** - Notifications properly navigate to relevant screens

### **📱 User Experience:**
- User logs into Phone 1 → FCM token registered
- User receives message → Notification on Phone 1
- User logs into Phone 2 → Now 2 active devices
- New message arrives → Notifications on **both devices**
- User reads on Phone 1 → Status synced to Phone 2
- **Enterprise-grade multi-device messaging experience**

---

## 💡 **TIPS & BEST PRACTICES:**

1. **Always check notification permissions**
2. **Handle token refresh gracefully**
3. **Test on both iOS and Android**
4. **Implement proper error handling**
5. **Test background/foreground scenarios thoroughly**
6. **Use enterprise device management for better UX**
7. **Implement proper navigation state management**
8. **Consider notification scheduling and batching**

---

**🎯 GOAL: Create a WhatsApp-level notification experience with enterprise multi-device support!** 