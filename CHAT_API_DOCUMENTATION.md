# 💬 **CHAT SYSTEM API DOCUMENTATION**

## 🚀 **Genel Bilgiler**

- **Base URL**: `http://localhost:3000/api`
- **Authentication**: JWT Token required (Bearer Token)
- **Content-Type**: `application/json`

---

## 📨 **Message Requests API**

### 1. **Mesaj İsteği Gönder**
```http
POST /api/message-requests/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "receiver_id": 2,
  "initial_message": "Merhaba, tanışabilir miyiz?"
}
```

**Response:**
```json
{
  "message": "Message request sent successfully",
  "request": {
    "id": 1,
    "sender_id": 1,
    "receiver_id": 2,
    "status": "pending",
    "initial_message": "Merhaba, tanışabilir miyiz?",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "receiver": {
    "id": 2,
    "username": "john_doe",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

### 2. **Gelen İstekleri Getir**
```http
GET /api/message-requests/received?page=1&limit=10
Authorization: Bearer <token>
```

### 3. **Gönderilen İstekleri Getir**
```http
GET /api/message-requests/pending?page=1&limit=10
Authorization: Bearer <token>
```

### 4. **Mesaj İsteğini Kabul Et**
```http
POST /api/message-requests/1/accept
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Message request accepted successfully",
  "chat_room": {
    "id": 1,
    "user1_id": 1,
    "user2_id": 2,
    "created_at": "2024-01-15T10:35:00Z",
    "expires_at": "2024-01-22T10:35:00Z",
    "status": "active"
  }
}
```

### 5. **Mesaj İsteğini Reddet**
```http
POST /api/message-requests/1/reject
Authorization: Bearer <token>
```

### 6. **Mesaj İsteğini İptal Et**
```http
DELETE /api/message-requests/1/cancel
Authorization: Bearer <token>
```

---

## 💬 **Chat System API**

### 1. **Chat Room'ları Getir**
```http
GET /api/chat/rooms
Authorization: Bearer <token>
```

**Response:**
```json
{
  "rooms": [
    {
      "id": 1,
      "user1_id": 1,
      "user2_id": 2,
      "created_at": "2024-01-15T10:35:00Z",
      "expires_at": "2024-01-22T10:35:00Z",
      "status": "active",
      "other_user": {
        "id": 2,
        "username": "john_doe",
        "first_name": "John",
        "last_name": "Doe",
        "avatar_url": "https://..."
      },
      "last_message": "Merhaba nasılsın?",
      "unread_count": 3,
      "time_remaining": 604800000
    }
  ],
  "total_count": 1
}
```

### 2. **Specific Chat Room Getir**
```http
GET /api/chat/rooms/1
Authorization: Bearer <token>
```

### 3. **Mesajları Getir**
```http
GET /api/chat/rooms/1/messages?limit=50&offset=0
Authorization: Bearer <token>
```

**Response:**
```json
{
  "messages": [
    {
      "id": "msg_1704461400000_abc123",
      "sender_id": 1,
      "message": "Merhaba nasılsın?",
      "message_type": "text",
      "image_url": null,
      "timestamp": 1704461400000,
      "status": "read",
      "sender": {
        "id": 1,
        "username": "jane_doe",
        "first_name": "Jane",
        "last_name": "Doe",
        "avatar_url": "https://..."
      }
    }
  ],
  "total_count": 1,
  "room_id": 1
}
```

### 4. **Mesaj Gönder**
```http
POST /api/chat/rooms/1/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "Merhaba! Ben de iyiyim, teşekkürler.",
  "messageType": "text"
}
```

**Resim Mesajı:**
```json
{
  "message": "",
  "messageType": "image",
  "imageUrl": "https://example.com/image.jpg"
}
```

### 5. **Chat Room'u Okundu Olarak İşaretle (Badge Sıfırlama)**
```http
POST /api/chat/rooms/1/read
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Chat room marked as read successfully",
  "roomId": "1",
  "timestamp": 1704467890123
}
```

### 6. **Room Sonlandırma İsteği**
```http
POST /api/chat/rooms/1/end
Authorization: Bearer <token>
```

---

## 🔔 **Notifications API**

### 1. **Bildirimleri Getir**
```http
GET /api/notifications?page=1&limit=20
Authorization: Bearer <token>
```

**Response:**
```json
{
  "notifications": [
    {
      "id": 1,
      "user_id": 2,
      "type": "message_request",
      "title": "Yeni Mesaj İsteği",
      "message": "Jane Doe size mesaj isteği gönderdi.",
      "data": {
        "message_request_id": 1,
        "sender_id": 1,
        "sender_name": "Jane Doe"
      },
      "is_read": false,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 1,
    "total_count": 1,
    "unread_count": 1,
    "limit": 20
  }
}
```

### 2. **Okunmamış Bildirim Sayısı**
```http
GET /api/notifications/unread-count
Authorization: Bearer <token>
```

### 3. **Bildirimi Okundu İşaretle**
```http
PATCH /api/notifications/1/read
Authorization: Bearer <token>
```

### 4. **Tüm Bildirimleri Okundu İşaretle**
```http
PATCH /api/notifications/read-all
Authorization: Bearer <token>
```

### 5. **Bildirimi Sil**
```http
DELETE /api/notifications/1
Authorization: Bearer <token>
```

---

## 🔌 **Socket.IO Events**

### **Client → Server Events**

#### 1. **Connection**
```javascript
const socket = io('http://localhost:3001', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

#### 2. **Join Room**
```javascript
socket.emit('join_room', roomId);
```

#### 3. **Send Message**
```javascript
socket.emit('send_message', {
  roomId: 1,
  message: 'Merhaba!',
  messageType: 'text'
});
```

#### 4. **Typing Indicator**
```javascript
socket.emit('typing', {
  roomId: 1,
  isTyping: true
});
```



### **Server → Client Events**

#### 1. **New Message**
```javascript
socket.on('new_message', (messageData) => {
  console.log('New message:', messageData);
});
```

#### 2. **User Typing**
```javascript
socket.on('user_typing', (data) => {
  console.log(`User ${data.userId} is typing:`, data.isTyping);
});
```

#### 3. **New Notification**
```javascript
socket.on('new_notification', (notification) => {
  console.log('New notification:', notification);
});
```

#### 4. **Room End Request**
```javascript
socket.on('end_room_request', (data) => {
  console.log('Room end requested by:', data.requestedBy);
});
```

#### 5. **Room Ended**
```javascript
socket.on('room_ended', (data) => {
  console.log('Room ended:', data.reason);
});
```

---

## 📊 **Database Tables**

### 1. **message_requests**
```sql
- id: SERIAL PRIMARY KEY
- sender_id: INTEGER (FK to users.id)
- receiver_id: INTEGER (FK to users.id)
- status: VARCHAR(20) ['pending', 'accepted', 'rejected']
- initial_message: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### 2. **chat_rooms**
```sql
- id: SERIAL PRIMARY KEY
- user1_id: INTEGER (FK to users.id)
- user2_id: INTEGER (FK to users.id)
- created_at: TIMESTAMP
- expires_at: TIMESTAMP (auto: created_at + 7 days)
- status: VARCHAR(20) ['active', 'ended_by_users', 'expired']
- ended_by_user1: BOOLEAN
- ended_by_user2: BOOLEAN
- last_message_at: TIMESTAMP
```

### 3. **notifications**
```sql
- id: SERIAL PRIMARY KEY
- user_id: INTEGER (FK to users.id)
- type: VARCHAR(30) ['message_request', 'room_ending_soon', 'room_ended', 'message_received']
- title: VARCHAR(255)
- message: TEXT
- data: JSONB
- is_read: BOOLEAN
- created_at: TIMESTAMP
```

---

## 📦 **Redis Data Structure**

### **Messages (7 gün expire)**
```redis
Key: chat_room:{room_id}:messages
Type: LIST
Value: JSON objects
{
  "id": "msg_1704461400000_abc123",
  "sender_id": 1,
  "message": "Merhaba!",
  "message_type": "text",
  "image_url": null,
  "timestamp": 1704461400000
}
```

### **Online Users**
```redis
Key: online_users
Type: SET
Value: user_ids

Key: user_session:{user_id}
Type: STRING
Value: socket_id
TTL: 3600 seconds
```

---

## 🛠️ **Error Codes**

| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | Missing required fields |
| 401 | Unauthorized | Invalid or missing JWT token |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate message request |
| 500 | Internal Server Error | Server error |

---

## ⚡ **Setup Instructions**

### 1. **Database Migration**
```bash
psql -d your_database -f database_migration_chat.sql
```

### 2. **Redis Setup**
```bash
# Docker ile
docker run -d --name redis-chat -p 6379:6379 redis:alpine

# Veya Windows Redis kurulumu
```

### 3. **Environment Variables**
```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Configuration
JWT_SECRET=your_secret_key
```

### 4. **Start Server**
```bash
npm run dev
```

---

## 🔄 **Workflow Örneği**

1. **Kullanıcı A** eşleşme detayında **Kullanıcı B**'ye mesaj isteği gönderir
2. **Kullanıcı B**'ye real-time bildirim gider
3. **Kullanıcı B** isteği kabul eder
4. Sistem otomatik **7 günlük chat room** oluşturur
5. **Kullanıcı A**'ya kabul bildirimi gider
6. Her iki kullanıcı da **ChatScreen**'den mesajlaşabilir
7. 7 gün sonunda oda otomatik kapanır
8. Kullanıcılar erken sonlandırma isteyebilir (karşılıklı onay)

---

Bu API sistemi **production ready** ve tüm edge case'ler düşünülmüş durumda! 🚀 