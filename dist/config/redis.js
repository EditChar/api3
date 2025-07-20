"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
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
const inMemoryCache = new Map();
const inMemoryExpiry = new Map();
class RedisClusterClient {
    constructor() {
        this.cluster = null;
        this.useInMemory = false;
        this.connected = false;
        this.initializeRedisCluster();
    }
    initializeRedisCluster() {
        try {
            // Single Redis instance for development
            this.cluster = new ioredis_1.default({
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
            });
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
        }
        catch (error) {
            console.warn('⚠️ Redis Cluster initialization failed, using in-memory cache:', error);
            this.useInMemory = true;
            this.connected = false;
        }
    }
    static getInstance() {
        if (!RedisClusterClient.instance) {
            RedisClusterClient.instance = new RedisClusterClient();
        }
        return RedisClusterClient.instance;
    }
    getCluster() {
        return this.cluster;
    }
    // Clean expired in-memory cache
    cleanExpiredCache() {
        const now = Date.now();
        for (const [key, expiry] of inMemoryExpiry.entries()) {
            if (expiry < now) {
                inMemoryCache.delete(key);
                inMemoryExpiry.delete(key);
            }
        }
    }
    // Generic Redis operations with fallback
    async get(key) {
        try {
            if (!this.useInMemory && this.cluster) {
                return await this.cluster.get(key);
            }
            else {
                this.cleanExpiredCache();
                return inMemoryCache.get(key) || null;
            }
        }
        catch (error) {
            console.warn('Redis GET failed, using in-memory:', error);
            this.cleanExpiredCache();
            return inMemoryCache.get(key) || null;
        }
    }
    async set(key, value, ttl) {
        try {
            if (!this.useInMemory && this.cluster) {
                if (ttl) {
                    await this.cluster.setex(key, ttl, value);
                }
                else {
                    await this.cluster.set(key, value);
                }
            }
            else {
                inMemoryCache.set(key, value);
                if (ttl) {
                    inMemoryExpiry.set(key, Date.now() + (ttl * 1000));
                }
                this.cleanExpiredCache();
            }
        }
        catch (error) {
            console.warn('Redis SET failed, using in-memory:', error);
            inMemoryCache.set(key, value);
            if (ttl) {
                inMemoryExpiry.set(key, Date.now() + (ttl * 1000));
            }
        }
    }
    async del(key) {
        try {
            if (!this.useInMemory && this.cluster) {
                await this.cluster.del(key);
            }
            else {
                inMemoryCache.delete(key);
                inMemoryExpiry.delete(key);
            }
        }
        catch (error) {
            console.warn('Redis DEL failed, using in-memory:', error);
            inMemoryCache.delete(key);
            inMemoryExpiry.delete(key);
        }
    }
    async exists(key) {
        try {
            if (!this.useInMemory && this.cluster) {
                const result = await this.cluster.exists(key);
                return result === 1;
            }
            else {
                this.cleanExpiredCache();
                return inMemoryCache.has(key);
            }
        }
        catch (error) {
            console.warn('Redis EXISTS failed, using in-memory:', error);
            this.cleanExpiredCache();
            return inMemoryCache.has(key);
        }
    }
    // List operations
    async lpush(key, ...values) {
        try {
            if (!this.useInMemory && this.cluster) {
                return await this.cluster.lpush(key, ...values);
            }
            else {
                const list = inMemoryCache.get(key) || [];
                list.unshift(...values);
                inMemoryCache.set(key, list);
                return list.length;
            }
        }
        catch (error) {
            console.warn('Redis LPUSH failed, using in-memory:', error);
            const list = inMemoryCache.get(key) || [];
            list.unshift(...values);
            inMemoryCache.set(key, list);
            return list.length;
        }
    }
    async lrange(key, start, stop) {
        try {
            if (!this.useInMemory && this.cluster) {
                return await this.cluster.lrange(key, start, stop);
            }
            else {
                this.cleanExpiredCache();
                const list = inMemoryCache.get(key) || [];
                return list.slice(start, stop === -1 ? undefined : stop + 1);
            }
        }
        catch (error) {
            console.warn('Redis LRANGE failed, using in-memory:', error);
            this.cleanExpiredCache();
            const list = inMemoryCache.get(key) || [];
            return list.slice(start, stop === -1 ? undefined : stop + 1);
        }
    }
    // Set operations
    async sadd(key, ...members) {
        try {
            if (!this.useInMemory && this.cluster) {
                return await this.cluster.sadd(key, ...members);
            }
            else {
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
        catch (error) {
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
    async sismember(key, member) {
        try {
            if (!this.useInMemory && this.cluster) {
                const result = await this.cluster.sismember(key, member);
                return result === 1;
            }
            else {
                this.cleanExpiredCache();
                const set = inMemoryCache.get(key) || new Set();
                return set.has(member);
            }
        }
        catch (error) {
            console.warn('Redis SISMEMBER failed, using in-memory:', error);
            this.cleanExpiredCache();
            const set = inMemoryCache.get(key) || new Set();
            return set.has(member);
        }
    }
    async srem(key, ...members) {
        try {
            if (!this.useInMemory && this.cluster) {
                return await this.cluster.srem(key, ...members);
            }
            else {
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
        catch (error) {
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
    async hset(key, field, value) {
        try {
            if (!this.useInMemory && this.cluster) {
                return await this.cluster.hset(key, field, value);
            }
            else {
                const hash = inMemoryCache.get(key) || new Map();
                const isNew = !hash.has(field);
                hash.set(field, value);
                inMemoryCache.set(key, hash);
                return isNew ? 1 : 0;
            }
        }
        catch (error) {
            console.warn('Redis HSET failed, using in-memory:', error);
            const hash = inMemoryCache.get(key) || new Map();
            const isNew = !hash.has(field);
            hash.set(field, value);
            inMemoryCache.set(key, hash);
            return isNew ? 1 : 0;
        }
    }
    async hget(key, field) {
        try {
            if (!this.useInMemory && this.cluster) {
                return await this.cluster.hget(key, field);
            }
            else {
                this.cleanExpiredCache();
                const hash = inMemoryCache.get(key) || new Map();
                return hash.get(field) || null;
            }
        }
        catch (error) {
            console.warn('Redis HGET failed, using in-memory:', error);
            this.cleanExpiredCache();
            const hash = inMemoryCache.get(key) || new Map();
            return hash.get(field) || null;
        }
    }
    async hdel(key, ...fields) {
        try {
            if (!this.useInMemory && this.cluster) {
                return await this.cluster.hdel(key, ...fields);
            }
            else {
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
        catch (error) {
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
    async publish(channel, message) {
        try {
            if (!this.useInMemory && this.cluster) {
                return await this.cluster.publish(channel, message);
            }
            else {
                console.log(`[In-Memory PubSub] Publishing to ${channel}: ${message}`);
                return 0; // No subscribers in in-memory mode
            }
        }
        catch (error) {
            console.warn('Redis PUBLISH failed:', error);
            return 0;
        }
    }
    // Expire operations
    async expire(key, seconds) {
        try {
            if (!this.useInMemory && this.cluster) {
                const result = await this.cluster.expire(key, seconds);
                return result === 1;
            }
            else {
                if (inMemoryCache.has(key)) {
                    inMemoryExpiry.set(key, Date.now() + (seconds * 1000));
                    return true;
                }
                return false;
            }
        }
        catch (error) {
            console.warn('Redis EXPIRE failed, using in-memory:', error);
            if (inMemoryCache.has(key)) {
                inMemoryExpiry.set(key, Date.now() + (seconds * 1000));
                return true;
            }
            return false;
        }
    }
    // High-level operations for chat system
    async saveMessage(roomId, message) {
        try {
            const key = `chat:${roomId}:messages`;
            await this.lpush(key, JSON.stringify(message));
            await this.expire(key, 7 * 24 * 60 * 60); // 7 days
        }
        catch (error) {
            console.warn('Save message failed:', error);
        }
    }
    async getMessages(roomId, limit = 50, offset = 0) {
        try {
            const key = `chat:${roomId}:messages`;
            const messages = await this.lrange(key, offset, offset + limit - 1);
            return messages.map(msg => JSON.parse(msg));
        }
        catch (error) {
            console.warn('Get messages failed:', error);
            return [];
        }
    }
    async isUserOnline(userId) {
        try {
            return await this.sismember('online_users', userId.toString());
        }
        catch (error) {
            console.warn('Check user online failed:', error);
            return false;
        }
    }
    async setUserOnline(userId, socketId) {
        try {
            await this.sadd('online_users', userId.toString());
            if (socketId) {
                await this.hset('user_sockets', userId.toString(), socketId);
            }
        }
        catch (error) {
            console.warn('Set user online failed:', error);
        }
    }
    async setUserOffline(userId) {
        try {
            await this.srem('online_users', userId.toString());
            await this.hdel('user_sockets', userId.toString());
        }
        catch (error) {
            console.warn('Set user offline failed:', error);
        }
    }
    async getUserSocketId(userId) {
        try {
            return await this.hget('user_sockets', userId.toString());
        }
        catch (error) {
            console.warn('Get user socket ID failed:', error);
            return null;
        }
    }
    async deleteRoomMessages(roomId) {
        try {
            const messagesKey = `chat_room:${roomId}:messages`;
            await this.del(messagesKey);
        }
        catch (error) {
            console.warn('Delete room messages failed:', error);
        }
    }
    // Connection status
    isConnected() {
        return this.connected && !this.useInMemory;
    }
    isUsingInMemory() {
        return this.useInMemory;
    }
    // Graceful shutdown
    async disconnect() {
        if (this.cluster) {
            await this.cluster.disconnect();
            console.log('🔌 Redis Cluster disconnected');
        }
    }
}
exports.default = RedisClusterClient.getInstance();
