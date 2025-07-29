# 🔄 Media URL Refresh System

## Problem
Presigned URL'ler expire olduğunda chat'te "Fotoğraf yüklenemedi" görünüyor.

## Backend Changes ✅
- Upload URL: 5 min → **24 hours**
- Download URL: **7 days** (zaten uzun)

## Frontend Solution: Auto-Refresh System

### 1. 📱 Image Component with Auto-Refresh

```typescript
// RefreshableImage.tsx
import { useState, useCallback } from 'react';
import { Image, View, TouchableOpacity, Text } from 'react-native';

interface RefreshableImageProps {
  mediaId: string;
  initialUrl?: string;
  style?: any;
  onRefresh?: (newUrl: string) => void;
}

const RefreshableImage = ({ mediaId, initialUrl, style, onRefresh }: RefreshableImageProps) => {
  const [imageUrl, setImageUrl] = useState(initialUrl);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  const refreshUrl = useCallback(async () => {
    if (!mediaId) return;
    
    setIsRefreshing(true);
    setHasError(false);
    
    try {
      console.log('🔄 Refreshing media URL:', mediaId);
      
      const response = await fetch(`/api/media/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const newUrl = data.urls?.medium || data.urls?.original;
        
        if (newUrl) {
          setImageUrl(newUrl);
          onRefresh?.(newUrl);
          console.log('✅ Media URL refreshed successfully');
        }
      } else {
        console.warn('❌ Failed to refresh media URL:', response.status);
        setHasError(true);
      }
    } catch (error) {
      console.error('❌ Media URL refresh error:', error);
      setHasError(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [mediaId, onRefresh]);

  const handleImageError = useCallback(() => {
    console.warn('🖼️ Image load failed, attempting refresh:', mediaId);
    setHasError(true);
    refreshUrl();
  }, [mediaId, refreshUrl]);

  if (hasError && !isRefreshing) {
    return (
      <TouchableOpacity 
        style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}
        onPress={refreshUrl}
      >
        <Text style={{ color: '#666', fontSize: 12 }}>
          📷 Fotoğraf yüklenemedi{'\n'}
          Tekrar dene
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={style}
      onError={handleImageError}
      onLoad={() => setHasError(false)}
    />
  );
};
```

### 2. 💾 Media Cache with Expiry

```typescript
// mediaCache.ts
interface CachedMedia {
  url: string;
  expiresAt: number;
  refreshCount: number;
}

class MediaCache {
  private cache = new Map<string, CachedMedia>();
  private readonly CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

  set(mediaId: string, url: string): void {
    this.cache.set(mediaId, {
      url,
      expiresAt: Date.now() + this.CACHE_DURATION,
      refreshCount: 0
    });
  }

  get(mediaId: string): string | null {
    const cached = this.cache.get(mediaId);
    
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() > cached.expiresAt) {
      console.log('🕐 Media cache expired:', mediaId);
      this.cache.delete(mediaId);
      return null;
    }
    
    return cached.url;
  }

  async getOrRefresh(mediaId: string): Promise<string | null> {
    // Try cache first
    const cached = this.get(mediaId);
    if (cached) return cached;
    
    // Refresh from API
    try {
      const response = await fetch(`/api/media/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const url = data.urls?.medium || data.urls?.original;
        
        if (url) {
          this.set(mediaId, url);
          return url;
        }
      }
    } catch (error) {
      console.error('❌ Media refresh failed:', error);
    }
    
    return null;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const mediaCache = new MediaCache();
```

### 3. 📨 Message Component Update

```typescript
// MediaMessage.tsx
const MediaMessage = ({ message }: { message: Message }) => {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const mediaId = message.content.replace('media:', '');

  useEffect(() => {
    const loadMedia = async () => {
      // Try cache first
      const cachedUrl = mediaCache.get(mediaId);
      if (cachedUrl) {
        setMediaUrl(cachedUrl);
        return;
      }

      // Load from API
      const url = await mediaCache.getOrRefresh(mediaId);
      setMediaUrl(url);
    };

    loadMedia();
  }, [mediaId]);

  const handleUrlRefresh = (newUrl: string) => {
    mediaCache.set(mediaId, newUrl);
    setMediaUrl(newUrl);
  };

  return (
    <RefreshableImage
      mediaId={mediaId}
      initialUrl={mediaUrl}
      style={{ width: 200, height: 200, borderRadius: 10 }}
      onRefresh={handleUrlRefresh}
    />
  );
};
```

### 4. 🔄 Batch URL Refresh

```typescript
// chatService.ts
export const refreshExpiredMediaUrls = async (messageIds: string[]) => {
  const mediaIds = messageIds
    .filter(id => id.startsWith('media:'))
    .map(id => id.replace('media:', ''));

  if (mediaIds.length === 0) return;

  console.log('🔄 Batch refreshing media URLs:', mediaIds.length);

  const refreshPromises = mediaIds.map(async (mediaId) => {
    try {
      const response = await fetch(`/api/media/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const url = data.urls?.medium;
        if (url) {
          mediaCache.set(mediaId, url);
        }
      }
    } catch (error) {
      console.warn(`Failed to refresh ${mediaId}:`, error);
    }
  });

  await Promise.allSettled(refreshPromises);
  console.log('✅ Batch media refresh completed');
};
```

## Benefits

✅ **Auto-Recovery**: Failed images automatically retry
✅ **Smart Caching**: 6-hour cache with auto-refresh
✅ **User Experience**: "Tap to retry" for manual refresh
✅ **Batch Operations**: Refresh multiple images efficiently
✅ **Performance**: Cache reduces API calls

## Implementation Steps

1. **Backend**: ✅ Increase presigned URL expiry (24h)
2. **Frontend**: Add RefreshableImage component
3. **Frontend**: Implement MediaCache system
4. **Frontend**: Update MediaMessage components
5. **Testing**: Test with expired URLs

## Result

**Before**: 5 min → "Fotoğraf yüklenemedi" ❌
**After**: 24h + Auto-refresh → Always accessible ✅ 