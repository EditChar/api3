import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import redisClient from './redis';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  user?: any;
}

class SocketManager {
  private io: SocketIOServer;
  private static instance: SocketManager;

  private constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*", // Production'da specific domain'leri belirt
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  public static getInstance(server?: HTTPServer): SocketManager {
    if (!SocketManager.instance && server) {
      SocketManager.instance = new SocketManager(server);
    }
    return SocketManager.instance;
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          // Development mode: Allow connection without token for testing
          console.log('⚠️ No token provided, using test user');
          socket.userId = 1; // Test user ID
          socket.user = { id: 1, username: 'testuser' };
          return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        socket.userId = decoded.id;
        socket.user = decoded;

        // Redis'te kullanıcıyı online işaretle
        await redisClient.setUserOnline(decoded.id, socket.id);
        
        console.log(`✅ User ${decoded.id} connected with socket ${socket.id}`);
        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        // Development mode: Allow connection even with invalid token
        console.log('⚠️ Invalid token, using test user');
        socket.userId = 1;
        socket.user = { id: 1, username: 'testuser' };
        next();
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`🔗 User ${socket.userId} connected`);

      // Chat room'a katıl
      socket.on('join_room', async (roomId: string) => {
        socket.join(`room_${roomId}`);
        console.log(`📨 User ${socket.userId} joined room ${roomId}`);
        
        // Diğer kullanıcıya online durumunu bildir
        socket.to(`room_${roomId}`).emit('user_joined', {
          userId: socket.userId,
          timestamp: Date.now()
        });
      });

      // Chat room'dan çık
      socket.on('leave_room', (roomId: string) => {
        socket.leave(`room_${roomId}`);
        console.log(`📤 User ${socket.userId} left room ${roomId}`);
      });

      // Mesaj gönderme artık sadece API üzerinden yapılıyor
      // Socket.IO sadece real-time events için kullanılıyor

      // Typing indicator
      socket.on('typing', (data: { roomId: string; isTyping: boolean }) => {
        socket.to(`room_${data.roomId}`).emit('user_typing', {
          userId: socket.userId,
          isTyping: data.isTyping
        });
      });



      // Bağlantı koptuğunda
      socket.on('disconnect', async () => {
        console.log(`❌ User ${socket.userId} disconnected`);
        if (socket.userId) {
          await redisClient.setUserOffline(socket.userId);
        }
      });
    });
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  // Specific user'a mesaj gönder
  public async sendToUser(userId: number, event: string, data: any): Promise<boolean> {
    const socketId = await redisClient.getUserSocketId(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  // Room'a mesaj gönder
  public sendToRoom(roomId: string, event: string, data: any): void {
    this.io.to(`room_${roomId}`).emit(event, data);
  }

  // Broadcast user status to all connected clients
  public broadcastUserStatus(userId: number, status: 'online' | 'offline'): void {
    this.io.emit('user_status_changed', {
      userId: userId,
      status: status,
      timestamp: Date.now()
    });
  }

  // Room ended event
  public sendRoomEnded(roomId: string, reason: string, endedBy?: number): void {
    this.sendToRoom(roomId, 'room_ended', {
      roomId: roomId,
      reason: reason,
      endedBy: endedBy,
      timestamp: Date.now()
    });
  }

  // Room updated event
  public sendRoomUpdated(roomId: string, updates: any): void {
    this.sendToRoom(roomId, 'room_updated', {
      roomId: roomId,
      updates: updates,
      timestamp: Date.now()
    });
  }
}

export default SocketManager; 