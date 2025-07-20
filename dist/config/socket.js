"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const redis_1 = __importDefault(require("./redis"));
class SocketManager {
    constructor(server) {
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: "*", // Production'da specific domain'leri belirt
                methods: ["GET", "POST"]
            },
            transports: ['websocket', 'polling']
        });
        this.setupMiddleware();
        this.setupEventHandlers();
    }
    static getInstance(server) {
        if (!SocketManager.instance && server) {
            SocketManager.instance = new SocketManager(server);
        }
        return SocketManager.instance;
    }
    setupMiddleware() {
        // Authentication middleware
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
                if (!token) {
                    // Development mode: Allow connection without token for testing
                    console.log('⚠️ No token provided, using test user');
                    socket.userId = 1; // Test user ID
                    socket.user = { id: 1, username: 'testuser' };
                    return next();
                }
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
                socket.userId = decoded.id;
                socket.user = decoded;
                // Redis'te kullanıcıyı online işaretle
                await redis_1.default.setUserOnline(decoded.id, socket.id);
                console.log(`✅ User ${decoded.id} connected with socket ${socket.id}`);
                next();
            }
            catch (error) {
                console.error('Socket authentication error:', error);
                // Development mode: Allow connection even with invalid token
                console.log('⚠️ Invalid token, using test user');
                socket.userId = 1;
                socket.user = { id: 1, username: 'testuser' };
                next();
            }
        });
    }
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`🔗 User ${socket.userId} connected`);
            // Chat room'a katıl
            socket.on('join_room', async (roomId) => {
                socket.join(`room_${roomId}`);
                console.log(`📨 User ${socket.userId} joined room ${roomId}`);
                // Diğer kullanıcıya online durumunu bildir
                socket.to(`room_${roomId}`).emit('user_joined', {
                    userId: socket.userId,
                    timestamp: Date.now()
                });
            });
            // Chat room'dan çık
            socket.on('leave_room', (roomId) => {
                socket.leave(`room_${roomId}`);
                console.log(`📤 User ${socket.userId} left room ${roomId}`);
            });
            // Mesaj gönderme artık sadece API üzerinden yapılıyor
            // Socket.IO sadece real-time events için kullanılıyor
            // Typing indicator
            socket.on('typing', (data) => {
                socket.to(`room_${data.roomId}`).emit('user_typing', {
                    userId: socket.userId,
                    isTyping: data.isTyping
                });
            });
            // Bağlantı koptuğunda
            socket.on('disconnect', async () => {
                console.log(`❌ User ${socket.userId} disconnected`);
                if (socket.userId) {
                    await redis_1.default.setUserOffline(socket.userId);
                }
            });
        });
    }
    getIO() {
        return this.io;
    }
    // Specific user'a mesaj gönder
    async sendToUser(userId, event, data) {
        const socketId = await redis_1.default.getUserSocketId(userId);
        if (socketId) {
            this.io.to(socketId).emit(event, data);
            return true;
        }
        return false;
    }
    // Room'a mesaj gönder
    sendToRoom(roomId, event, data) {
        this.io.to(`room_${roomId}`).emit(event, data);
    }
    // Broadcast user status to all connected clients
    broadcastUserStatus(userId, status) {
        this.io.emit('user_status_changed', {
            userId: userId,
            status: status,
            timestamp: Date.now()
        });
    }
    // Room ended event
    sendRoomEnded(roomId, reason, endedBy) {
        this.sendToRoom(roomId, 'room_ended', {
            roomId: roomId,
            reason: reason,
            endedBy: endedBy,
            timestamp: Date.now()
        });
    }
    // Room updated event
    sendRoomUpdated(roomId, updates) {
        this.sendToRoom(roomId, 'room_updated', {
            roomId: roomId,
            updates: updates,
            timestamp: Date.now()
        });
    }
}
exports.default = SocketManager;
