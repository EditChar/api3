# Test Sistemi - Backend ve Frontend Entegrasyonu

Bu doküman, test sistemi için oluşturulan backend API'leri ve frontend kodlarını açıklamaktadır.

## 📊 Veritabanı Yapısı

Sistem 3 ana tablo kullanır:

### 1. `user_question_responses`
Kullanıcının her soruya verdiği cevapları saklar.
```sql
- id: integer (primary key)
- user_id: integer (foreign key)
- question_id: integer (foreign key) 
- answer_id: integer (foreign key)
- response_score: integer (cevabın puanı)
- created_at: timestamp
```

### 2. `user_test_responses`
Kullanıcının tamamladığı testlerin toplam puanlarını saklar.
```sql
- id: integer (primary key)
- user_id: integer (foreign key)
- test_id: integer (foreign key)
- test_score: integer (testin toplam puanı)
- completed_at: timestamp
```

### 3. `user_scores`
Kullanıcının genel puanını ve istatistiklerini saklar.
```sql
- id: integer (primary key)
- user_id: integer (foreign key, unique)
- total_score: integer (tüm testlerin toplam puanı)
- completed_tests_count: integer (tamamlanan test sayısı)
- last_updated: timestamp
```

## 🚀 Backend API Endpoints

### Test Cevapları Gönderme
```
POST /api/test-responses/:testId/submit
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "responses": [
    {
      "question_id": 1,
      "answer_id": 3
    },
    {
      "question_id": 2,
      "answer_id": 5
    }
  ]
}

Response:
{
  "testResponse": {
    "id": 1,
    "user_id": 1,
    "test_id": 1,
    "test_score": 45,
    "completed_at": "2024-01-15T10:30:00Z"
  },
  "questionResponses": [...],
  "totalScore": 45
}
```

### Kullanıcı Test Geçmişi
```
GET /api/test-responses?page=1&limit=10
Authorization: Bearer <token>

Response:
{
  "testResponses": [
    {
      "id": 1,
      "test_title": "Kişilik Testi",
      "test_score": 45,
      "completed_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalCount": 25
  }
}
```

### Kullanıcı Puanı
```
GET /api/test-responses/score
Authorization: Bearer <token>

Response:
{
  "id": 1,
  "user_id": 1,
  "total_score": 450,
  "completed_tests_count": 10,
  "last_updated": "2024-01-15T10:30:00Z"
}
```

### Kullanıcı Sıralaması
```
GET /api/test-responses/rank
Authorization: Bearer <token>

Response:
{
  "rank": 5,
  "total_score": 450,
  "completed_tests_count": 10
}
```

### Test Detayları
```
GET /api/test-responses/:testResponseId/details
Authorization: Bearer <token>

Response:
{
  "testResponse": {
    "id": 1,
    "test_title": "Kişilik Testi",
    "test_score": 45
  },
  "questionResponses": [
    {
      "question_text": "Soru metni",
      "answer_text": "Seçilen cevap",
      "response_score": 5
    }
  ]
}
```

## 📱 Frontend Kullanımı

### 1. TestService Kurulumu

React Native projenizde `@react-native-async-storage/async-storage` paketini kurun:
```bash
npm install @react-native-async-storage/async-storage
```

### 2. API Base URL Ayarı

`TestService.ts` dosyasındaki `API_BASE_URL` değerini güncelleyin:
```typescript
const API_BASE_URL = 'https://yourapi.com/api'; // Prodüksiyon URL
```

### 3. Authentication Token

Kullanıcı giriş yaptıktan sonra token'ı AsyncStorage'da saklayın:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Token'ı kaydet
await AsyncStorage.setItem('authToken', userToken);
```

### 4. Test Alma Örneği

```typescript
import TestService from './TestService';

// Test cevaplarını gönder
const responses = [
  { question_id: 1, answer_id: 3 },
  { question_id: 2, answer_id: 5 }
];

try {
  const result = await TestService.submitTestResponse(testId, responses);
  console.log('Test tamamlandı:', result.totalScore);
} catch (error) {
  console.error('Test gönderim hatası:', error);
}
```

### 5. Kullanıcı Profili Örneği

```typescript
// Kullanıcı puanını al
const userScore = await TestService.getUserScore();

// Kullanıcı sıralamasını al
const userRank = await TestService.getUserRank();

// Test geçmişini al
const testHistory = await TestService.getUserTestHistory(1, 10);
```

## 📂 Dosya Yapısı

### Backend Dosyaları
```
src/
├── controllers/
│   └── testResponsesController.ts    # Test cevapları controller
├── models/
│   ├── UserTestResponse.ts          # Test yanıtı modeli
│   ├── UserScore.ts                 # Kullanıcı puanı modeli
│   └── UserQuestionResponse.ts      # Soru yanıtı modeli
├── routes/
│   └── testResponsesRoutes.ts       # Test cevapları routes
└── server.ts                        # Ana server dosyası (güncellendi)
```

### Frontend Dosyaları (React Native)
```
├── TestService.ts                   # API servis katmanı
├── TestScreen.tsx                   # Test alma ekranı
├── UserProfileScreen.tsx            # Kullanıcı profil ekranı
└── LeaderboardScreen.tsx            # Liderlik tablosu ekranı
```

## 🔧 Kurulum Adımları

### Backend
1. Mevcut projenize yeni dosyaları ekleyin
2. `src/server.ts` dosyasında route'u aktif edin
3. PostgreSQL'de user_scores tablosuna unique constraint ekleyin:
```sql
ALTER TABLE user_scores ADD CONSTRAINT user_scores_user_id_unique UNIQUE (user_id);
```

### Frontend
1. React Native projenize dosyaları kopyalayın
2. Gerekli paketleri kurun:
```bash
npm install @react-native-async-storage/async-storage
```
3. Navigation sistemine yeni ekranları ekleyin
4. API_BASE_URL'yi güncelleyin

## 🎯 Önemli Notlar

- ✅ Mevcut kod yapısı korunmuştur
- ✅ Tüm işlemler transaction içinde yapılır
- ✅ Kullanıcı authentication kontrolü vardır
- ✅ Pagination desteği mevcuttur
- ✅ Error handling implementasyonu tamamdır
- ✅ TypeScript tip güvenliği sağlanmıştır

## 🧪 Test Etme

### Backend Test
```bash
# Test cevabı gönderme
curl -X POST http://localhost:3001/api/test-responses/1/submit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"responses":[{"question_id":1,"answer_id":3}]}'

# Kullanıcı puanını alma
curl -X GET http://localhost:3000/api/test-responses/score \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Frontend Test
1. TestScreen component'ini bir teste bağlayın
2. Test tamamlandıktan sonra UserProfileScreen'de puanı kontrol edin
3. LeaderboardScreen'de sıralamanızı görün

Bu sistem sayesinde kullanıcılar test alabilir, puanlarını takip edebilir ve sıralamalarını görebilirler! 🚀 