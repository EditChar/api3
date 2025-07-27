# 📷 Enterprise Media Sharing System

## 🌟 Overview

Bu sistem kullanıcıların mesajlaşma ekranında güvenli fotoğraf paylaşımı yapabilmelerine olanak sağlar. Tüm medya dosyaları şifrelenmiş olarak Amazon S3'te saklanır ve presigned URL'lerle erişim sağlanır.

## ✨ Features

- ✅ **Encrypted Photo Sharing**: Tüm fotoğraflar AES-256-GCM ile şifrelenir
- ✅ **S3 Storage**: Amazon S3 ile enterprise-grade dosya saklama
- ✅ **Pre-signed URLs**: 7 gün geçerli güvenli URL'ler
- ✅ **Multiple Sizes**: Thumbnail, medium, original boyutlar
- ✅ **Auto Cleanup**: 30 gün sonra otomatik temizlik
- ✅ **User Access Control**: Kullanıcı bazlı erişim kontrolü
- ✅ **CDN Support**: CloudFront entegrasyonu

## 🛠️ Environment Variables

`.env` dosyanıza aşağıdaki değişkenleri ekleyin:

```bash
# AWS Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-app-media-bucket
CLOUDFRONT_URL=https://d123abc456.cloudfront.net

# Media Encryption
MEDIA_ENCRYPTION_KEY=your_32_byte_hex_encryption_key

# Database (existing)
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
```

## 📦 Installation

### 1. Database Migration

```bash
# Run the media database migration
psql -d your_database -f database_migration_chat_media.sql
```

### 2. AWS S3 Setup

```bash
# Create S3 bucket for media
aws s3 mb s3://your-app-media-bucket

# Set bucket CORS policy
aws s3api put-bucket-cors --bucket your-app-media-bucket --cors-configuration file://s3-cors-config.json
```

**s3-cors-config.json:**
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "POST", "PUT", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

### 3. CloudFront CDN (Optional)

```bash
# Create CloudFront distribution for faster access
aws cloudfront create-distribution --distribution-config file://cloudfront-media-config.json
```

## 🚀 API Endpoints

### Authentication Required
Tüm endpointler `Authorization: Bearer <token>` header'ı gerektirir.

### 1. Presigned Upload URL Al
```http
POST /api/media/presign
Content-Type: application/json

{
  "chatRoomId": "room-uuid",
  "contentType": "image/jpeg",
  "fileSize": 1024000,
  "originalFilename": "photo.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "mediaId": "uuid",
  "uploadUrl": "https://s3.amazonaws.com/...",
  "fields": {
    "key": "chat-media/room/uuid/original",
    "Content-Type": "image/jpeg",
    ...
  }
}
```

### 2. Upload Tamamla
```http
POST /api/media/complete
Content-Type: application/json

{
  "mediaId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "mediaId": "uuid",
  "urls": {
    "thumbnail": "https://s3.amazonaws.com/...",
    "medium": "https://s3.amazonaws.com/...",
    "original": "https://s3.amazonaws.com/..."
  },
  "expiresAt": "2024-01-07T12:00:00Z"
}
```

### 3. Media URL'leri Al
```http
GET /api/media/:mediaId
```

**Response:**
```json
{
  "success": true,
  "mediaId": "uuid",
  "urls": {
    "thumbnail": "https://s3.amazonaws.com/...",
    "medium": "https://s3.amazonaws.com/...",
    "original": "https://s3.amazonaws.com/..."
  },
  "expiresAt": "2024-01-07T12:00:00Z"
}
```

### 4. Media Sil
```http
DELETE /api/media/:mediaId
```

**Response:**
```json
{
  "success": true
}
```

### 5. Mesaj Gönder (Media ile)
```http
POST /api/chat/rooms/:roomId/messages
Content-Type: application/json

{
  "messageType": "image",
  "mediaId": "uuid"
}
```

## 🔄 Usage Flow

### Frontend Implementation

```javascript
// 1. Presigned URL al
const presignResponse = await fetch('/api/media/presign', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    chatRoomId: roomId,
    contentType: file.type,
    fileSize: file.size,
    originalFilename: file.name
  })
});

const { uploadUrl, fields, mediaId } = await presignResponse.json();

// 2. Doğrudan S3'e upload
const formData = new FormData();
Object.entries(fields).forEach(([key, value]) => {
  formData.append(key, value);
});
formData.append('file', file);

await fetch(uploadUrl, {
  method: 'POST',
  body: formData
});

// 3. Upload'ı tamamla
const completeResponse = await fetch('/api/media/complete', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ mediaId })
});

const { urls } = await completeResponse.json();

// 4. Mesajı gönder
await fetch(`/api/chat/rooms/${roomId}/messages`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messageType: 'image',
    mediaId: mediaId
  })
});
```

## 🔧 System Architecture

```
Frontend → /api/media/presign → Generate S3 presigned URL
Frontend → S3 Direct Upload → Upload encrypted file
Frontend → /api/media/complete → Process & generate sizes
Frontend → /api/chat/rooms/:id/messages → Send message with mediaId
WebSocket → Real-time delivery → Receiver gets message
Frontend → /api/media/:mediaId → Get presigned download URLs
```

## 🧹 Automatic Cleanup

Media cleanup worker otomatik olarak çalışır:

- **Daily Cleanup**: Her gün saat 02:00'da
- **Hourly Check**: Her saat başında kontrol
- **30 Day Expiry**: Medya dosyaları 30 gün sonra silinir
- **Database Cleanup**: Süresi dolan kayıtlar temizlenir

## 🔐 Security Features

### Encryption
- **AES-256-GCM** encryption
- **Unique IV** per file
- **Authentication tags** for integrity

### Access Control
- **User-based access** (sadece chat katılımcıları)
- **Time-limited URLs** (7 gün geçerli)
- **Chat room validation**

### Data Protection
- **No data leakage** between users
- **Secure file deletion**
- **Audit logging**

## 📊 Monitoring

### Health Check
```http
GET /api/media/health
```

### Database Stats
```sql
SELECT * FROM get_media_stats();
```

### Log Monitoring
```bash
# Media cleanup logs
tail -f logs/media-cleanup.log

# Media upload logs
grep "Media upload" logs/app.log
```

## 🐛 Troubleshooting

### Common Issues

1. **S3 Upload Fails**
   - Check AWS credentials
   - Verify bucket permissions
   - Check CORS configuration

2. **Media Not Found**
   - Check expiration date
   - Verify user access to chat room
   - Check database records

3. **Encryption Errors**
   - Verify MEDIA_ENCRYPTION_KEY
   - Check IV generation
   - Validate auth tags

### Debug Commands

```bash
# Test S3 connection
node test-aws-connection.js

# Test media upload
curl -X POST http://localhost:3001/api/media/presign \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"chatRoomId":"test","contentType":"image/jpeg","fileSize":1000}'

# Check database
psql -d dbname -c "SELECT * FROM chat_media ORDER BY created_at DESC LIMIT 5;"
```

## 📈 Performance

### Optimization
- **CDN caching** for faster access
- **Multiple image sizes** for optimal loading
- **Batch cleanup** for efficiency
- **Connection pooling** for database

### Scaling
- **Horizontal scaling** supported
- **Multi-region deployment** ready
- **Load balancer** compatible
- **Auto-scaling** S3 storage

## 🔄 Updates

### Version 1.0.0
- ✅ Basic media upload/download
- ✅ Encryption support
- ✅ Automatic cleanup
- ✅ Chat integration

### Planned Features
- 🔄 Video support (future)
- 🔄 Media compression optimization
- 🔄 Advanced analytics
- 🔄 Backup & recovery automation

---

## 🆘 Support

For issues or questions:
1. Check troubleshooting section
2. Review logs for errors
3. Verify environment configuration
4. Contact system administrator 