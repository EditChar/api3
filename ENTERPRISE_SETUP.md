# Enterprise-Grade Messaging System Setup

Bu rehber, 100 milyonlarca kullanıcıya hizmet verebilecek enterprise-grade mesajlaşma sisteminin kurulumunu anlatır.

## 🏗️ Sistem Mimarisi

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client Apps   │────│   Load Balancer  │────│   API Gateway   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                       ┌────────────────────────────────┼────────────────────────────────┐
                       │                                │                                │
                ┌──────▼──────┐                ┌───────▼────────┐                ┌─────▼─────┐
                │ Chat Service │                │ Worker Services │                │ WebSocket │
                │   (Node.js)  │                │   (Kafka)      │                │  Service  │
                └──────┬──────┘                └───────┬────────┘                └─────┬─────┘
                       │                               │                               │
         ┌─────────────┼───────────────┬───────────────┼───────────────┬───────────────┤
         │             │               │               │               │               │
    ┌────▼────┐  ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
    │Redis    │  │PostgreSQL │  │  Kafka    │  │Realtime   │  │Persistence│  │Notification│
    │Cluster  │  │ Database  │  │ Cluster   │  │ Worker    │  │ Worker    │  │  Worker   │
    │(6 nodes)│  │           │  │(3 brokers)│  │           │  │           │  │           │
    └─────────┘  └───────────┘  └───────────┘  └───────────┘  └───────────┘  └───────────┘
```

## 🚀 Hızlı Başlangıç

### 1. Sistem Gereksinimleri

- **Node.js**: >= 18.0.0
- **Docker**: >= 20.0.0
- **Docker Compose**: >= 2.0.0
- **PostgreSQL**: >= 13.0 (Docker dışında)
- **RAM**: Minimum 8GB (Önerilen: 16GB+)
- **CPU**: Minimum 4 core (Önerilen: 8+ core)
- **Disk**: Minimum 50GB SSD

### 2. Bağımlılıkları Yükle

```bash
npm install
```

### 3. Environment Variables

`.env` dosyasını oluşturun:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
DB_HOST=localhost
DB_PORT=5432
DB_NAME=localdb
DB_USER=postgres
DB_PASSWORD=123

# Redis Cluster (Docker içinde)
REDIS_HOST=localhost
REDIS_PORT=7001
REDIS_PASSWORD=

# Kafka Cluster (Docker içinde)
KAFKA_BROKERS=localhost:9092,localhost:9093,localhost:9094

# JWT
JWT_SECRET=your-super-secret-jwt-key-here

# Server
PORT=3000
NODE_ENV=development

# File Upload
UPLOAD_PATH=./public/uploads
MAX_FILE_SIZE=10485760

# Notification
PUSH_NOTIFICATION_KEY=your-push-notification-key
```

### 4. Enterprise Kurulum

Tek komutla tüm sistemi kurun:

```bash
npm run setup:enterprise
```

Bu komut:
- Docker Compose ile Redis Cluster ve Kafka Cluster'ı başlatır
- Redis Cluster'ı yapılandırır
- Kafka topic'lerini oluşturur

### 5. Veritabanı Kurulumu

PostgreSQL'i Docker dışında kurduğunuzdan emin olun ve tabloları oluşturun:

```sql
-- Kullanıcılar tablosu
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    avatar_url TEXT,
    push_token TEXT,
    notification_preferences JSONB DEFAULT '{}',
    last_activity_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Sohbet odaları
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id INTEGER REFERENCES users(id),
    user2_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
    status VARCHAR(20) DEFAULT 'active',
    ended_by_user1 BOOLEAN DEFAULT FALSE,
    ended_by_user2 BOOLEAN DEFAULT FALSE,
    last_message_at TIMESTAMP DEFAULT NOW()
);

-- Mesajlar
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    chat_id UUID REFERENCES chats(id),
    sender_id INTEGER REFERENCES users(id),
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    status VARCHAR(20) DEFAULT 'sent',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Kullanıcı olayları
CREATE TABLE user_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    event_type VARCHAR(50) NOT NULL,
    room_id UUID REFERENCES chats(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics
CREATE TABLE analytics_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    session_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Bildirimler
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexler
CREATE INDEX idx_chats_users ON chats(user1_id, user2_id);
CREATE INDEX idx_chats_status ON chats(status);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_user_events_user_id ON user_events(user_id);
CREATE INDEX idx_user_events_created_at ON user_events(created_at);
CREATE INDEX idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at);
CREATE INDEX idx_notifications_user_id ON notifications(user_id, is_read);
```

## 🔧 Sistem Başlatma

### Development Modu

```bash
# API sunucusunu başlat
npm run dev

# Worker'ları başlat (ayrı terminal)
npm run start:workers
```

### Production Modu

```bash
# Tüm servisleri birlikte başlat
npm run start:production
```

### Tek Tek Worker Başlatma

```bash
# Persistence Worker
npm run start:worker:persistence

# Realtime Worker
npm run start:worker:realtime

# Notification Worker
npm run start:worker:notification
```

## 📊 Monitoring ve Health Check

### Sistem Sağlığını Kontrol Et

```bash
npm run health:check
```

### Docker Servisleri İzle

```bash
# Tüm servislerin loglarını izle
npm run docker:logs

# Kafka UI (http://localhost:8080)
# Redis Insight (http://localhost:8001)
```

### Kafka Topic'lerini Listele

```bash
npm run kafka:topics
```

## 🎯 Performans Optimizasyonları

### Redis Cluster Konfigürasyonu

- **6 node cluster**: 3 master + 3 slave
- **Memory policy**: allkeys-lru
- **Persistence**: AOF + RDB
- **Cluster timeout**: 15 saniye

### Kafka Cluster Konfigürasyonu

- **3 broker cluster**: KRaft mode (Zookeeper'sız)
- **Replication factor**: 3
- **Min in-sync replicas**: 2
- **Compression**: LZ4
- **Retention**: 7 gün (mesajlar), 30 gün (analytics)

### PostgreSQL Optimizasyonları

```sql
-- Performans ayarları
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
SELECT pg_reload_conf();
```

## 🚦 Load Testing

### Artillery ile Load Test

```bash
# package.json'a ekleyin
npm install -D artillery

# Load test çalıştır
artillery quick --count 100 --num 10 http://localhost:3000/api/health
```

### Test Senaryoları

1. **Mesaj Gönderme**: 1000 eşzamanlı kullanıcı
2. **WebSocket Bağlantıları**: 10000 eşzamanlı bağlantı
3. **Veritabanı Sorguları**: 5000 RPS
4. **Redis İşlemleri**: 50000 RPS

## 🔒 Güvenlik

### Rate Limiting

```typescript
// Express rate limiting
import rateLimit from 'express-rate-limit';

const messageLimit = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 60, // Dakikada 60 mesaj
  message: 'Çok fazla mesaj gönderiyorsunuz'
});

app.use('/api/chat', messageLimit);
```

### CORS Konfigürasyonu

```typescript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
```

## 📈 Ölçekleme Stratejileri

### Horizontal Scaling

1. **API Servers**: Load balancer arkasında N instance
2. **Worker Processes**: Her worker tipinden M instance
3. **Database**: Read replicas + connection pooling
4. **Redis**: Cluster sharding
5. **Kafka**: Partition artırma

### Vertical Scaling

1. **CPU**: Worker process'leri için çok çekirdekli
2. **Memory**: Redis ve Node.js heap boyutu
3. **Storage**: NVMe SSD + RAID 10
4. **Network**: 10Gbps+ bağlantı

## 🛠️ Troubleshooting

### Redis Cluster Sorunları

```bash
# Cluster durumunu kontrol et
docker exec redis-node-1 redis-cli cluster nodes

# Cluster'ı yeniden başlat
docker-compose restart redis-node-1 redis-node-2 redis-node-3
```

### Kafka Sorunları

```bash
# Broker durumunu kontrol et
docker exec kafka-1 kafka-broker-api-versions --bootstrap-server localhost:9092

# Topic detaylarını gör
docker exec kafka-1 kafka-topics --describe --bootstrap-server localhost:9092
```

### PostgreSQL Performans

```sql
-- Yavaş sorguları bul
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;

-- Index kullanımını kontrol et
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_tup_read DESC;
```

## 📞 Destek

Sorunlarınız için:

1. **Health Check**: `npm run health:check`
2. **Logs**: `npm run docker:logs`
3. **Monitoring**: Kafka UI ve Redis Insight
4. **Database**: PostgreSQL slow query log

## 🚀 Production Deployment

### Docker Production

```bash
# Production docker-compose
docker-compose -f docker-compose.prod.yml up -d

# Auto-restart politikası
restart: unless-stopped
```

### PM2 ile Process Management

```bash
npm install -g pm2

# ecosystem.config.js oluştur
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

Bu enterprise-grade sistem şimdi 100 milyonlarca kullanıcıya hizmet vermeye hazır! 🎉 