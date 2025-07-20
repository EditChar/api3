import Redis, { Cluster } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Redis Cluster Configuration
const REDIS_CLUSTER_NODES = [
  { host: 'localhost', port: 7001 },
  { host: 'localhost', port: 7002 },
  { host: 'localhost', port: 7003 },
  { host: 'localhost', port: 7004 },
  { host: 'localhost', port: 7005 },
  { host: 'localhost', port: 7006 },
];

// In-memory cache for fallback
const inMemoryCache = new Map<string, any>();
const inMemoryExpiry = new Map<string, number>();

class RedisClusterClient {
  private cluster: Cluster | null = null;
  private static instance: RedisClusterClient;
  private useInMemory: boolean = false;
  private connected: boolean = false;

  private constructor() {
    this.initializeRedisCluster();
  }

  private initializeRedisCluster() {
    try {
      // Single Redis instance for development
      this.cluster = new Redis({
        host: 'localhost',
        port: 7000,
        password: process.env.REDIS_PASSWORD || undefined,
        connectTimeout: 10000,
        commandTimeout: 5000,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        enableOfflineQueue: false,
        // Disable cluster mode for single instance
        enableReadyCheck: false
      }) as any;

      if (this.cluster) {
        this.cluster.on('connect', () => {
          console.log('🔗 Redis connecting...');
        });

        this.cluster.on('ready', () => {
          console.log('✅ Redis connected and ready');
          this.useInMemory = false;
          this.connected = true;
        });

        this.cluster.on('error', (error) => {
          console.warn('⚠️ Redis error, falling back to in-memory cache:', error.message);
          this.useInMemory = true;
          this.connected = false;
        });

        this.cluster.on('close', () => {
          console.log('🔌 Redis connection closed');
          this.connected = false;
        });

        this.cluster.on('reconnecting', () => {
          console.log('🔄 Redis reconnecting...');
        });

        this.cluster.on('end', () => {
          console.log('🔚 Redis connection ended');
          this.connected = false;
        });

        // Test connection
        this.cluster.ping().catch(() => {
          console.warn('⚠️ Redis ping failed, using in-memory cache');
          this.useInMemory = true;
          this.connected = false;
        });
      }

    } catch (error) {
      console.warn('⚠️ Redis Cluster initialization failed, using in-memory cache:', error);
      this.useInMemory = true;
             this.connected = false;
    }
  }

  public static getInstance(): RedisClusterClient {
    if (!RedisClusterClient.instance) {
      RedisClusterClient.instance = new RedisClusterClient();
    }
    return RedisClusterClient.instance;
  }

  public getCluster(): Cluster | null {
    return this.cluster;
  }

  // Clean expired in-memory cache
  private cleanExpiredCache() {
    const now = Date.now();
    for (const [key, expiry] of inMemoryExpiry.entries()) {
      if (expiry < now) {
        inMemoryCache.delete(key);
        inMemoryExpiry.delete(key);
      }
    }
  }

  // Generic Redis operations with fallback
  public async get(key: string): Promise<string | null> {
    try {
      if (!this.useInMemory && this.cluster) {
        return await this.cluster.get(key);
      } else {
        this.cleanExpiredCache();
        return inMemoryCache.get(key) || null;
      }
    } catch (error) {
      console.warn('Redis GET failed, using in-memory:', error);
      this.cleanExpiredCache();
      return inMemoryCache.get(key) || null;
    }
  }

  public async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (!this.useInMemory && this.cluster) {
        if (ttl) {
          await this.cluster.setex(key, ttl, value);
        } else {
          await this.cluster.set(key, value);
        }
      } else {
        inMemoryCache.set(key, value);
        if (ttl) {
          inMemoryExpiry.set(key, Date.now() + (ttl * 1000));
        }
        this.cleanExpiredCache();
      }
    } catch (error) {
      console.warn('Redis SET failed, using in-memory:', error);
      inMemoryCache.set(key, value);
      if (ttl) {
        inMemoryExpiry.set(key, Date.now() + (ttl * 1000));
      }
    }
  }

  public async del(key: string): Promise<void> {
    try {
      if (!this.useInMemory && this.cluster) {
        await this.cluster.del(key);
      } else {
        inMemoryCache.delete(key);
        inMemoryExpiry.delete(key);
      }
    } catch (error) {
      console.warn('Redis DEL failed, using in-memory:', error);
      inMemoryCache.delete(key);
      inMemoryExpiry.delete(key);
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      if (!this.useInMemory && this.cluster) {
        const result = await this.cluster.exists(key);
        return result === 1;
      } else {
        this.cleanExpiredCache();
        return inMemoryCache.has(key);
      }
    } catch (error) {
      console.warn('Redis EXISTS failed, using in-memory:', error);
      this.cleanExpiredCache();
      return inMemoryCache.has(key);
    }
  }

  // List operations
  public async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      if (!this.useInMemory && this.cluster) {
        return await this.cluster.lpush(key, ...values);
      } else {
        const list = inMemoryCache.get(key) || [];
        list.unshift(...values);
        inMemoryCache.set(key, list);
        return list.length;
      }
    } catch (error) {
      console.warn('Redis LPUSH failed, using in-memory:', error);
      const list = inMemoryCache.get(key) || [];
      list.unshift(...values);
      inMemoryCache.set(key, list);
      return list.length;
    }
  }

  public async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      if (!this.useInMemory && this.cluster) {
        return await this.cluster.lrange(key, start, stop);
      } else {
        this.cleanExpiredCache();
        const list = inMemoryCache.get(key) || [];
        return list.slice(start, stop === -1 ? undefined : stop + 1);
      }
    } catch (error) {
      console.warn('Redis LRANGE failed, using in-memory:', error);
      this.cleanExpiredCache();
      const list = inMemoryCache.get(key) || [];
      return list.slice(start, stop === -1 ? undefined : stop + 1);
    }
  }

  // Set operations
  public async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      if (!this.useInMemory && this.cluster) {
        return await this.cluster.sadd(key, ...members);
      } else {
        const set = inMemoryCache.get(key) || new Set();
        let added = 0;
        members.forEach(member => {
          if (!set.has(member)) {
            set.add(member);
            added++;
          }
        });
        inMemoryCache.set(key, set);
        return added;
      }
    } catch (error) {
      console.warn('Redis SADD failed, using in-memory:', error);
      const set = inMemoryCache.get(key) || new Set();
      let added = 0;
      members.forEach(member => {
        if (!set.has(member)) {
          set.add(member);
          added++;
        }
      });
      inMemoryCache.set(key, set);
      return added;
    }
  }

  public async sismember(key: string, member: string): Promise<boolean> {
    try {
      if (!this.useInMemory && this.cluster) {
        const result = await this.cluster.sismember(key, member);
        return result === 1;
      } else {
        this.cleanExpiredCache();
        const set = inMemoryCache.get(key) || new Set();
        return set.has(member);
      }
    } catch (error) {
      console.warn('Redis SISMEMBER failed, using in-memory:', error);
      this.cleanExpiredCache();
      const set = inMemoryCache.get(key) || new Set();
      return set.has(member);
    }
  }

  public async srem(key: string, ...members: string[]): Promise<number> {
    try {
      if (!this.useInMemory && this.cluster) {
        return await this.cluster.srem(key, ...members);
      } else {
        const set = inMemoryCache.get(key) || new Set();
        let removed = 0;
        members.forEach(member => {
          if (set.has(member)) {
            set.delete(member);
            removed++;
          }
        });
        inMemoryCache.set(key, set);
        return removed;
      }
    } catch (error) {
      console.warn('Redis SREM failed, using in-memory:', error);
      const set = inMemoryCache.get(key) || new Set();
      let removed = 0;
      members.forEach(member => {
        if (set.has(member)) {
          set.delete(member);
          removed++;
        }
      });
      inMemoryCache.set(key, set);
      return removed;
    }
  }

  // Hash operations
  public async hset(key: string, field: string, value: string): Promise<number> {
    try {
      if (!this.useInMemory && this.cluster) {
        return await this.cluster.hset(key, field, value);
      } else {
        const hash = inMemoryCache.get(key) || new Map();
        const isNew = !hash.has(field);
        hash.set(field, value);
        inMemoryCache.set(key, hash);
        return isNew ? 1 : 0;
      }
    } catch (error) {
      console.warn('Redis HSET failed, using in-memory:', error);
      const hash = inMemoryCache.get(key) || new Map();
      const isNew = !hash.has(field);
      hash.set(field, value);
      inMemoryCache.set(key, hash);
      return isNew ? 1 : 0;
    }
  }

  public async hget(key: string, field: string): Promise<string | null> {
    try {
      if (!this.useInMemory && this.cluster) {
        return await this.cluster.hget(key, field);
      } else {
        this.cleanExpiredCache();
        const hash = inMemoryCache.get(key) || new Map();
        return hash.get(field) || null;
      }
    } catch (error) {
      console.warn('Redis HGET failed, using in-memory:', error);
      this.cleanExpiredCache();
      const hash = inMemoryCache.get(key) || new Map();
      return hash.get(field) || null;
    }
  }

  public async hdel(key: string, ...fields: string[]): Promise<number> {
    try {
      if (!this.useInMemory && this.cluster) {
        return await this.cluster.hdel(key, ...fields);
      } else {
        const hash = inMemoryCache.get(key) || new Map();
        let deleted = 0;
        fields.forEach(field => {
          if (hash.has(field)) {
            hash.delete(field);
            deleted++;
          }
        });
        inMemoryCache.set(key, hash);
        return deleted;
      }
    } catch (error) {
      console.warn('Redis HDEL failed, using in-memory:', error);
      const hash = inMemoryCache.get(key) || new Map();
      let deleted = 0;
      fields.forEach(field => {
        if (hash.has(field)) {
          hash.delete(field);
          deleted++;
        }
      });
      inMemoryCache.set(key, hash);
      return deleted;
    }
  }

  // Pub/Sub operations
  public async publish(channel: string, message: string): Promise<number> {
    try {
      if (!this.useInMemory && this.cluster) {
        return await this.cluster.publish(channel, message);
      } else {
        console.log(`[In-Memory PubSub] Publishing to ${channel}: ${message}`);
        return 0; // No subscribers in in-memory mode
      }
    } catch (error) {
      console.warn('Redis PUBLISH failed:', error);
      return 0;
    }
  }

  // Expire operations
  public async expire(key: string, seconds: number): Promise<boolean> {
    try {
      if (!this.useInMemory && this.cluster) {
        const result = await this.cluster.expire(key, seconds);
        return result === 1;
      } else {
        if (inMemoryCache.has(key)) {
          inMemoryExpiry.set(key, Date.now() + (seconds * 1000));
          return true;
        }
        return false;
      }
    } catch (error) {
      console.warn('Redis EXPIRE failed, using in-memory:', error);
      if (inMemoryCache.has(key)) {
        inMemoryExpiry.set(key, Date.now() + (seconds * 1000));
        return true;
      }
      return false;
    }
  }

  // High-level operations for chat system
  public async saveMessage(roomId: string, message: any): Promise<void> {
    try {
      const key = `chat:${roomId}:messages`;
      await this.lpush(key, JSON.stringify(message));
      await this.expire(key, 7 * 24 * 60 * 60); // 7 days
    } catch (error) {
      console.warn('Save message failed:', error);
    }
  }

  public async getMessages(roomId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    try {
      const key = `chat:${roomId}:messages`;
      const messages = await this.lrange(key, offset, offset + limit - 1);
      return messages.map(msg => JSON.parse(msg));
    } catch (error) {
      console.warn('Get messages failed:', error);
      return [];
    }
  }

  public async isUserOnline(userId: number): Promise<boolean> {
    try {
      return await this.sismember('online_users', userId.toString());
    } catch (error) {
      console.warn('Check user online failed:', error);
      return false;
    }
  }

  public async setUserOnline(userId: number, socketId?: string): Promise<void> {
    try {
      await this.sadd('online_users', userId.toString());
      if (socketId) {
        await this.hset('user_sockets', userId.toString(), socketId);
      }
    } catch (error) {
      console.warn('Set user online failed:', error);
    }
  }

  public async setUserOffline(userId: number): Promise<void> {
    try {
      await this.srem('online_users', userId.toString());
      await this.hdel('user_sockets', userId.toString());
    } catch (error) {
      console.warn('Set user offline failed:', error);
    }
  }

  public async getUserSocketId(userId: number): Promise<string | null> {
    try {
      return await this.hget('user_sockets', userId.toString());
    } catch (error) {
      console.warn('Get user socket ID failed:', error);
      return null;
    }
  }



  public async deleteRoomMessages(roomId: string): Promise<void> {
    try {
      const messagesKey = `chat_room:${roomId}:messages`;
      await this.del(messagesKey);
    } catch (error) {
      console.warn('Delete room messages failed:', error);
    }
  }

  // Connection status
  public isConnected(): boolean {
    return this.connected && !this.useInMemory;
  }

  public isUsingInMemory(): boolean {
    return this.useInMemory;
  }

  // Graceful shutdown
  public async disconnect(): Promise<void> {
    if (this.cluster) {
      await this.cluster.disconnect();
      console.log('🔌 Redis Cluster disconnected');
    }
  }
}

export default RedisClusterClient.getInstance(); 