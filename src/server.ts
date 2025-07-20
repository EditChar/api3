import express, { Application, Request, Response } from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import path from 'path'; // path modülünü import et
import pool from './config/database';
import redisClient from './config/redis';
import SocketManager from './config/socket';
import ChatRoomCleanupService from './services/chatRoomCleanupService';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes'; // Kullanıcı işlemleri için route
import testsRoutes from './routes/testsRoutes'; // Ana test setleri için route
import questionsRoutes from './routes/questionsRoutes'; // Sorular için route
import testResponsesRoutes from './routes/testResponsesRoutes'; // Test cevapları için route
import matchingRoutes from './routes/matchingRoutes'; // Eşleştirme için route
import messageRequestRoutes from './routes/messageRequestRoutes'; // Mesaj istekleri için route
import chatRoutes from './routes/chatRoutes'; // Chat sistemi için route
import notificationRoutes from './routes/notificationRoutes'; // Bildirimler için route
import badgeRoutes from './routes/badgeRoutes'; // Badge sistemi için route
import kafkaService from './services/kafkaService';
// Import workers to run in same process
import persistenceWorker from './workers/persistence.worker';
import realtimeWorker from './workers/realtime.worker';
import notificationWorker from './workers/notification.worker';

dotenv.config();

const app: Application = express();
const port = process.env.PORT || 3002; // 3001 port conflict olduğu için 3002 kullanıyoruz

// HTTP server oluştur (Socket.IO için gerekli)
const server = createServer(app);

// Socket.IO manager'ı başlat
const socketManager = SocketManager.getInstance(server);

// Chat room cleanup servisini başlat
const cleanupService = ChatRoomCleanupService.getInstance();

app.use(express.json());

// Statik dosyaları sunmak için
app.use('/admin', express.static(path.join(__dirname, '..', 'public'))); // Admin paneli dosyaları public klasöründe
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads'))); // Yüklenen dosyalar için

// API Rotaları
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes); // /api/users ile başlayanlar userRoutes'a gider
app.use('/api/tests', testsRoutes); // /api/tests ile başlayanlar testsRoutes'a gider
app.use('/api/test-responses', testResponsesRoutes); // /api/test-responses ile başlayanlar testResponsesRoutes'a gider
app.use('/api/matches', matchingRoutes); // /api/matches ile başlayanlar matchingRoutes'a gider
app.use('/api/message-requests', messageRequestRoutes); // /api/message-requests ile başlayanlar messageRequestRoutes'a gider
app.use('/api/chat', chatRoutes); // /api/chat ile başlayanlar chatRoutes'a gider
app.use('/api/notifications', notificationRoutes); // /api/notifications ile başlayanlar notificationRoutes'a gider
app.use('/api/badges', badgeRoutes); // /api/badges ile başlayanlar badgeRoutes'a gider

// Bir test setine ait soruları yönetmek için nested route
// testsRoutes içinden /:testId/questions gibi bir yapıya yönlendirme yapılabilir
// VEYA doğrudan burada tanımlanabilir. Şimdilik testsRoutes içinde :testId altına questionsRoutes'u ekleyelim.
// Bu, questionsRoutes'un /api/tests/:testId/questions altında çalışmasını sağlar.
testsRoutes.use('/:testId/questions', questionsRoutes);

// Veritabanı bağlantısını test et (isteğe bağlı, geliştirme için)
app.get('/test-db', async (req: Request, res: Response) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    res.json({ message: 'Database connection successful!', time: result.rows[0] });
    client.release();
  } catch (error) {
    console.error('Error connecting to database', error);
    res.status(500).json({ message: 'Error connecting to database' });
  }
});

// Admin paneli için özel route
app.get('/admin', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// Ana sayfa için basit bir yönlendirme, /admin'e yönlendirilebilir
app.get('/', (req: Request, res: Response) => {
  // res.send('API is running! Visit /admin for the admin panel.');
  res.redirect('/admin'); // Otomatik olarak admin paneline yönlendir
});

// Redis bağlantısını test et
const cluster = redisClient.getCluster();
if (cluster) {
  cluster.on('ready', () => {
    console.log('🚀 Redis Cluster connection established');
  });
} else {
  console.log('⚠️ Redis cluster not available, using in-memory cache');
}

const startServer = async () => {
  try {
    // Kafka Producer'a bağlan
    await kafkaService.connectProducer();

    server.listen(port, async () => {
      console.log(`🚀 Server is running on port ${port}`);
      console.log(`📊 Admin panel: http://localhost:${port}/admin`);
      console.log(`💬 Socket.IO ready for connections`);
      console.log(`📊 Redis ready for caching`);
      
      // Start workers AFTER server and SocketManager are fully initialized
      console.log('🔧 Starting workers in same process...');
      
      try {
        await persistenceWorker.start();
        console.log('✅ Persistence Worker started');
      } catch (error) {
        console.error('❌ Failed to start Persistence Worker:', error);
      }

      try {
        await realtimeWorker.start();
        console.log('✅ Realtime Worker started');
      } catch (error) {
        console.error('❌ Failed to start Realtime Worker:', error);
      }

      try {
        await notificationWorker.start();
        console.log('✅ Notification Worker started');
      } catch (error) {
        console.error('❌ Failed to start Notification Worker:', error);
      }
      
      console.log(`⚡ All workers running in same process`);
    });
  } catch (error) {
    console.error('Failed to start the server:', error);
    process.exit(1);
  }
};

startServer();

// Global error handling için
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception thrown:', error);
  process.exit(1);
});

// Graceful shutdown for workers
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  
  try {
    await persistenceWorker.stop();
    await realtimeWorker.stop();
    await notificationWorker.stop();
    console.log('✅ All workers stopped');
  } catch (error) {
    console.error('❌ Error stopping workers:', error);
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  
  try {
    await persistenceWorker.stop();
    await realtimeWorker.stop();
    await notificationWorker.stop();
    console.log('✅ All workers stopped');
  } catch (error) {
    console.error('❌ Error stopping workers:', error);
  }
  
  process.exit(0);
});
