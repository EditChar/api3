# 🚨 S3 Presigned URL Authentication Hatası

## 📊 **Hata Detayları**

**Durum:** S3 upload'ında 403 AccessDenied hatası
**Lokasyon:** `POST /api/media/presign` endpoint'inden alınan presigned URL
**S3 Region:** eu-north-1
**Bucket:** easy-to-image-*

## 🔍 **Alınan Presigned URL Formatı**

```
URL: https://s3.eu-north-1.amazonaws.com/easy-to-image-...
```

## ❌ **S3 Hatası**

```xml
<Error>
  <Code>AccessDenied</Code>
  <Message>Anonymous users cannot invoke this API. Please authenticate.</Message>
  <RequestId>8NP4ADVZTA8KWX92</RequestId>
</Error>
```

## 🎯 **Backend'de Kontrol Edilmesi Gerekenler**

### 1. **Presigned URL Oluşturma**
```javascript
// ✅ DOĞRU Presigned URL formatı:
const presignedUrl = s3.getSignedUrl('putObject', {
  Bucket: 'your-bucket-name',
  Key: `media/${mediaId}`,
  ContentType: 'image/jpeg',
  Expires: 3600, // 1 saat
  ACL: 'private' // veya 'public-read'
});
```

### 2. **AWS Credentials Kontrolü**
- AWS Access Key ID doğru mu?
- AWS Secret Access Key doğru mu?
- AWS Region (eu-north-1) doğru mu?
- S3 bucket policy'si upload'a izin veriyor mu?

### 3. **Presigned URL Query Parametreleri**
Presigned URL'de şu parametreler olmalı:
- `X-Amz-Algorithm`
- `X-Amz-Credential`
- `X-Amz-Date`
- `X-Amz-Expires`
- `X-Amz-Signature`
- `X-Amz-SignedHeaders`

### 4. **S3 Bucket Policy Örneği**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT-ID:user/YOUR-USER"
      },
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::easy-to-image-*/*"
    }
  ]
}
```

### 5. **IAM User Permissions**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::easy-to-image-*/*"
    }
  ]
}
```

## 🧪 **Test Edilmesi Gerekenler**

1. **Backend'de presigned URL'i test et:**
```bash
curl -X PUT "PRESIGNED_URL_HERE" \
  -H "Content-Type: image/jpeg" \
  --data-binary "@test-image.jpg"
```

2. **AWS CLI ile bucket erişimini test et:**
```bash
aws s3 cp test-image.jpg s3://easy-to-image-bucket/test/
```

3. **Backend'de AWS credentials'ları test et:**
```javascript
console.log('AWS Config:', {
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'MISSING',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'MISSING'
});
```

## 📱 **Frontend Request Detayları**

**Request Data:**
```json
{
  "chatRoomId": "137c4b3a-d565-4bc2-b5d4-ea71945acbcc",
  "contentType": "image/jpeg", 
  "fileSize": 10923,
  "originalFilename": "34.jpg"
}
```

**Backend Response:**
```json
{
  "mediaId": "25720b91-6998-4247-81fa-a05331c47f00",
  "uploadUrl": "https://s3.eu-north-1.amazonaws.com/easy-to-image-...",
  "correlationId": undefined,
  "expiresAt": undefined
}
```

## 🔧 **Geçici Çözüm**

Presigned URL sorunu çözülene kadar frontend'e mock response eklenebilir:

```javascript
// Backend'de geçici mock
app.post('/api/media/presign', (req, res) => {
  res.json({
    success: false,
    error: 'S3 presigned URL generation currently disabled for debugging',
    mockMode: true
  });
});
```

## ⚡ **Acil Çözüm Adımları**

1. AWS Console'da bucket policy'sini kontrol et
2. IAM user permissions'ları kontrol et  
3. Backend'de AWS credentials'ları kontrol et
4. Presigned URL generation code'unu gözden geçir
5. Test environment'da manuel S3 upload test et 