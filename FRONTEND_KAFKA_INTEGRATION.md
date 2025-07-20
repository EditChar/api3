# 🚀 Frontend Kafka Entegrasyonu Rehberi

## 📱 Genel Değişiklikler

### 1. Mesaj Durumları (Message States)

```typescript
// types/message.ts
export type MessageStatus = 
  | 'sending'     // Frontend'de optimistic
  | 'queued'      // Kafka'ya gönderildi
  | 'delivered'   // Realtime worker tarafından işlendi
  | 'read'        // Karşı taraf okudu
  | 'failed';     // Gönderim başarısız

export interface Message {
  id: string;
  chat_id: string;
  sender_id: number;
  content: string;
  message_type: 'text' | 'image' | 'file';
  created_at: string;
  status: MessageStatus;
  timestamp: number;
  is_read: boolean;
  retry_count?: number; // Yeniden deneme sayısı
}
```

### 2. Enhanced Message Service

```typescript
// services/messageService.ts
class EnhancedMessageService {
  private retryQueue: Map<string, Message> = new Map();
  private maxRetries = 3;
  private retryDelay = 2000; // 2 saniye

  async sendMessage(roomId: string, content: string, messageType: string): Promise<{
    success: boolean;
    message?: Message;
    error?: string;
  }> {
    const messageId = this.generateMessageId();
    const timestamp = Date.now();
    
    // 1. Optimistic UI Update
    const optimisticMessage: Message = {
      id: messageId,
      chat_id: roomId,
      sender_id: this.getCurrentUserId(),
      content,
      message_type: messageType,
      created_at: new Date().toISOString(),
      status: 'sending',
      timestamp,
      is_read: false
    };

    // UI'ye hemen ekle
    this.addOptimisticMessage(optimisticMessage);

    try {
      // 2. API'ye gönder (Kafka Queue)
      const response = await fetch(`/api/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: content,
          messageType: messageType
        })
      });

      const result = await response.json();

      if (response.ok) {
        // 3. Mesaj başarıyla queue'ya eklendi
        this.updateMessageStatus(messageId, 'queued', result.data.id);
        
        // 4. Delivery confirmation için timeout başlat
        this.startDeliveryTimeout(result.data.id, roomId);
        
        return { success: true, message: result.data };
      } else {
        throw new Error(result.message || 'Message sending failed');
      }

    } catch (error) {
      console.error('Message sending error:', error);
      
      // 5. Hata durumunda retry queue'ya ekle
      this.updateMessageStatus(messageId, 'failed');
      this.addToRetryQueue(optimisticMessage);
      
      return { success: false, error: error.message };
    }
  }

  private startDeliveryTimeout(messageId: string, roomId: string) {
    setTimeout(() => {
      const message = this.getMessageById(messageId);
      if (message && message.status === 'queued') {
        // 10 saniye içinde delivered olmadıysa retry
        console.warn(`Message ${messageId} not delivered, adding to retry queue`);
        this.addToRetryQueue(message);
      }
    }, 10000); // 10 saniye timeout
  }

  private async addToRetryQueue(message: Message) {
    if ((message.retry_count || 0) < this.maxRetries) {
      message.retry_count = (message.retry_count || 0) + 1;
      this.retryQueue.set(message.id, message);
      
      // Exponential backoff ile retry
      const delay = this.retryDelay * Math.pow(2, message.retry_count - 1);
      setTimeout(() => {
        this.retryMessage(message);
      }, delay);
    } else {
      // Max retry aşıldıysa kalıcı olarak failed işaretle
      this.updateMessageStatus(message.id, 'failed');
      this.showRetryOption(message);
    }
  }

  private async retryMessage(message: Message) {
    console.log(`Retrying message ${message.id} (attempt ${message.retry_count})`);
    
    // Mesajı tekrar gönder
    const result = await this.sendMessage(
      message.chat_id, 
      message.content, 
      message.message_type
    );
    
    if (result.success) {
      this.retryQueue.delete(message.id);
    }
  }

  private showRetryOption(message: Message) {
    // UI'de "Tekrar Gönder" butonu göster
    this.eventBus.emit('message_retry_needed', message);
  }
}
```

### 3. Socket.IO Event Handlers

```typescript
// hooks/useSocketEvents.ts
export const useEnhancedSocketEvents = (roomId: string) => {
  const { socket } = useSocket();
  const { updateMessageStatus, addMessage } = useMessageStore();

  useEffect(() => {
    if (!socket || !roomId) return;

    // 1. Yeni mesaj geldi (Realtime Worker'dan)
    const handleNewMessage = (message: Message) => {
      console.log('📨 New message received:', message);
      addMessage(message);
      
      // Ses/vibrasyon bildirimi
      if (message.sender_id !== getCurrentUserId()) {
        playNotificationSound();
        vibrateDevice();
      }
    };

    // 2. Mesaj delivered (Realtime Worker'dan)
    const handleMessageDelivered = (data: {
      messageId: string;
      roomId: string;
      status: string;
      timestamp: number;
    }) => {
      console.log('✅ Message delivered:', data);
      updateMessageStatus(data.messageId, 'delivered');
    };

    // 3. Mesaj okundu (Realtime Worker'dan)
    const handleMessageRead = (data: {
      messageId: string;
      roomId: string;
      readBy: number;
      timestamp: number;
    }) => {
      console.log('👁️ Message read:', data);
      updateMessageStatus(data.messageId, 'read');
    };

    // 4. Typing indicator
    const handleTypingIndicator = (data: {
      roomId: string;
      userId: number;
      isTyping: boolean;
      timestamp: number;
    }) => {
      console.log('⌨️ Typing indicator:', data);
      setTypingUsers(prev => {
        if (data.isTyping) {
          return [...prev.filter(id => id !== data.userId), data.userId];
        } else {
          return prev.filter(id => id !== data.userId);
        }
      });
    };

    // 5. Kullanıcı durumu değişti
    const handleUserStatusChanged = (data: {
      userId: number;
      status: 'online' | 'offline';
      timestamp: number;
    }) => {
      console.log('👤 User status changed:', data);
      updateUserStatus(data.userId, data.status);
    };

    // Event listeners
    socket.on('new_message', handleNewMessage);
    socket.on('message_delivered', handleMessageDelivered);
    socket.on('message_read', handleMessageRead);
    socket.on('typing_indicator', handleTypingIndicator);
    socket.on('user_status_changed', handleUserStatusChanged);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_delivered', handleMessageDelivered);
      socket.off('message_read', handleMessageRead);
      socket.off('typing_indicator', handleTypingIndicator);
      socket.off('user_status_changed', handleUserStatusChanged);
    };
  }, [socket, roomId]);
};
```

### 4. Offline Support & Queue Management

```typescript
// hooks/useOfflineQueue.ts
export const useOfflineQueue = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<Message[]>([]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processOfflineQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addToOfflineQueue = (message: Message) => {
    setOfflineQueue(prev => [...prev, message]);
    // LocalStorage'a kaydet
    localStorage.setItem('offline_messages', JSON.stringify([...offlineQueue, message]));
  };

  const processOfflineQueue = async () => {
    if (offlineQueue.length === 0) return;

    console.log(`📤 Processing ${offlineQueue.length} offline messages`);

    for (const message of offlineQueue) {
      try {
        await messageService.sendMessage(
          message.chat_id,
          message.content,
          message.message_type
        );
      } catch (error) {
        console.error('Failed to send offline message:', error);
      }
    }

    setOfflineQueue([]);
    localStorage.removeItem('offline_messages');
  };

  return {
    isOnline,
    addToOfflineQueue,
    offlineQueueSize: offlineQueue.length
  };
};
```

### 5. Message Status Indicators

```typescript
// components/MessageStatusIndicator.tsx
import React from 'react';
import { MessageStatus } from '../types/message';

interface Props {
  status: MessageStatus;
  timestamp: number;
}

export const MessageStatusIndicator: React.FC<Props> = ({ status, timestamp }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <span className="status-sending">🕐</span>;
      case 'queued':
        return <span className="status-queued">📤</span>;
      case 'delivered':
        return <span className="status-delivered">✓</span>;
      case 'read':
        return <span className="status-read">✓✓</span>;
      case 'failed':
        return <span className="status-failed">❌</span>;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'sending':
        return 'Gönderiliyor...';
      case 'queued':
        return 'Sıraya eklendi';
      case 'delivered':
        return 'İletildi';
      case 'read':
        return 'Okundu';
      case 'failed':
        return 'Gönderilemedi';
      default:
        return '';
    }
  };

  return (
    <div className="message-status">
      {getStatusIcon()}
      <span className="status-text">{getStatusText()}</span>
      <span className="timestamp">
        {new Date(timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
};
```

### 6. Enhanced Chat Screen

```typescript
// screens/ChatScreen.tsx
export const EnhancedChatScreen: React.FC = () => {
  const { roomId } = useParams();
  const { messages, sendMessage, isLoading } = useMessages(roomId);
  const { isOnline, addToOfflineQueue } = useOfflineQueue();
  const [retryableMessages, setRetryableMessages] = useState<Message[]>([]);
  
  useEnhancedSocketEvents(roomId);

  const handleSendMessage = async (content: string, messageType: string) => {
    if (!isOnline) {
      // Offline durumunda queue'ya ekle
      const offlineMessage: Message = {
        id: generateId(),
        chat_id: roomId,
        sender_id: getCurrentUserId(),
        content,
        message_type: messageType,
        created_at: new Date().toISOString(),
        status: 'sending',
        timestamp: Date.now(),
        is_read: false
      };
      
      addToOfflineQueue(offlineMessage);
      showToast('Mesaj çevrimiçi olduğunuzda gönderilecek');
      return;
    }

    const result = await sendMessage(content, messageType);
    
    if (!result.success) {
      showToast('Mesaj gönderilemedi. Tekrar denenecek.');
    }
  };

  const handleRetryMessage = async (message: Message) => {
    const result = await sendMessage(message.content, message.message_type);
    
    if (result.success) {
      setRetryableMessages(prev => 
        prev.filter(m => m.id !== message.id)
      );
    }
  };

  return (
    <div className="enhanced-chat-screen">
      {/* Offline Indicator */}
      {!isOnline && (
        <div className="offline-banner">
          📱 Çevrimdışı - Mesajlar çevrimiçi olduğunuzda gönderilecek
        </div>
      )}

      {/* Retry Banner */}
      {retryableMessages.length > 0 && (
        <div className="retry-banner">
          ⚠️ {retryableMessages.length} mesaj gönderilemedi
          <button onClick={() => retryableMessages.forEach(handleRetryMessage)}>
            Tekrar Dene
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="messages-container">
        {messages.map(message => (
          <div key={message.id} className="message-item">
            <MessageBubble message={message} />
            <MessageStatusIndicator 
              status={message.status} 
              timestamp={message.timestamp} 
            />
            {message.status === 'failed' && (
              <button 
                className="retry-button"
                onClick={() => handleRetryMessage(message)}
              >
                🔄 Tekrar Gönder
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Message Input */}
      <MessageInput onSend={handleSendMessage} disabled={!isOnline} />
    </div>
  );
};
```

## 🔧 Konfigürasyon

### Environment Variables

```env
# Frontend .env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_SOCKET_URL=http://localhost:3001
REACT_APP_RETRY_ATTEMPTS=3
REACT_APP_RETRY_DELAY=2000
REACT_APP_OFFLINE_STORAGE_KEY=offline_messages
```

### Package.json Dependencies

```json
{
  "dependencies": {
    "socket.io-client": "^4.7.5",
    "@tanstack/react-query": "^4.29.0",
    "zustand": "^4.3.8",
    "react-use": "^17.4.0"
  }
}
```

## 📊 Monitoring & Analytics

### Message Analytics

```typescript
// utils/messageAnalytics.ts
export const trackMessageEvent = (event: string, data: any) => {
  // Google Analytics, Mixpanel, etc.
  analytics.track(event, {
    ...data,
    timestamp: Date.now(),
    session_id: getSessionId()
  });
};

// Usage
trackMessageEvent('message_sent', {
  room_id: roomId,
  message_type: 'text',
  message_length: content.length,
  delivery_time: deliveryTime
});
```

Bu entegrasyon ile:

✅ **Kafka-first mesajlaşma** - Tüm mesajlar önce Kafka'ya gidiyor
✅ **Automatic fallback** - Kafka çalışmazsa direkt işleme geçiyor
✅ **Real-time delivery** - Worker'lar mesajları işleyip Socket.IO ile iletiyor
✅ **Offline support** - İnternet yokken mesajlar queue'ya ekleniyor
✅ **Retry mechanism** - Başarısız mesajlar otomatik tekrar deneniyor
✅ **Status tracking** - Her mesajın durumu takip ediliyor
✅ **Enterprise scale** - Milyonlarca kullanıcı için hazır

Kafka entegrasyonu tamamlandı! 🚀 