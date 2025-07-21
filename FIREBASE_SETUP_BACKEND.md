# 🔥 Firebase Cloud Messaging Backend Setup

## ✅ Yapılan Backend Değişiklikleri

### 1. Firebase Admin SDK Entegrasyonu
- ✅ Firebase Admin SDK paketi eklendi (`firebase-admin@11.11.1`)
- ✅ Firebase yapılandırma dosyası: `src/config/firebase.ts`
- ✅ FCM servis sınıfı: `src/services/firebaseNotificationService.ts`
- ✅ FCM token yönetimi: `src/controllers/deviceController.ts` ve `src/routes/deviceRoutes.ts`

### 2. Bildirim Entegrasyonu
- ✅ Mesaj gönderme sırasında FCM push notification
- ✅ Mesaj isteği gönderme sırasında FCM push notification  
- ✅ Mesaj isteği kabul edilme sırasında FCM push notification
- ✅ Chat sonlandırma bildirimi

### 3. API Endpoints
- ✅ `POST /api/devices/fcm/register` - FCM token kaydetme
- ✅ `POST /api/devices/fcm/unregister` - FCM token deaktif etme
- ✅ `GET /api/notifications/pending` - Okunmamış bildirimler

### 4. Bildirim Türleri
- `message_received` - Yeni mesaj bildirimi
- `message_request` - Mesaj isteği bildirimi
- `request_accepted` - Mesaj isteği kabul bildirimi
- `chat_ended` - Chat sonlandırma bildirimi

## 🔧 Firebase Kurulumu

### 1. Firebase Console'da Proje Oluşturun
1. [Firebase Console](https://console.firebase.google.com/) gidin
2. "Add project" ile yeni proje oluşturun
3. Project Settings > Service accounts > Generate new private key
4. İndirilen JSON dosyasını `firebase-service-account.json` olarak kaydedin

### 2. Environment Variables (.env dosyası)
```env
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
```

### 3. Server Yeniden Başlatma
```bash
npm run dev
```

## 📱 FCM Token Kaydetme API Kullanımı

```typescript
// FCM Token Kaydetme
POST /api/devices/fcm/register
Authorization: Bearer <token>
Content-Type: application/json

{
  "token": "fcm-token-here",
  "deviceType": "android", // veya "ios"
  "deviceInfo": {
    "model": "Pixel 6",
    "osVersion": "12",
    "appVersion": "1.0.0"
  },
  "platform": "android",
  "appVersion": "1.0.0",
  "timezone": "Europe/Istanbul"
}
```

```typescript
// FCM Token Deaktif Etme (logout sırasında)
POST /api/devices/fcm/unregister
Authorization: Bearer <token>

{
  "token": "fcm-token-here"
}
```

## 🔔 Bildirim Payload Formatları

### Mesaj Bildirimi
```json
{
  "notification": {
    "title": "John Doe",
    "body": "Merhaba nasılsın?"
  },
  "data": {
    "type": "message_received",
    "userId": "123",
    "chatId": "room-uuid",
    "senderId": "456",
    "senderName": "John Doe"
  }
}
```

### Mesaj İsteği Bildirimi
```json
{
  "notification": {
    "title": "Yeni Mesaj İsteği",
    "body": "John Doe size mesaj göndermek istiyor"
  },
  "data": {
    "type": "message_request",
    "userId": "123",
    "requestId": "request-uuid",
    "senderName": "John Doe"
  }
}
```

## 🚀 Test Etmek İçin

1. Firebase Console'da Cloud Messaging bölümüne gidin
2. "Send test message" ile test bildirimi gönderebilirsiniz
3. Backend loglarını kontrol edin: `📱 FCM sent to user X: Y/Z successful` 