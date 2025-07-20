"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path")); // path modülünü import et
const database_1 = __importDefault(require("./config/database"));
const redis_1 = __importDefault(require("./config/redis"));
const socket_1 = __importDefault(require("./config/socket"));
const chatRoomCleanupService_1 = __importDefault(require("./services/chatRoomCleanupService"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes")); // Kullanıcı işlemleri için route
const testsRoutes_1 = __importDefault(require("./routes/testsRoutes")); // Ana test setleri için route
const questionsRoutes_1 = __importDefault(require("./routes/questionsRoutes")); // Sorular için route
const testResponsesRoutes_1 = __importDefault(require("./routes/testResponsesRoutes")); // Test cevapları için route
const matchingRoutes_1 = __importDefault(require("./routes/matchingRoutes")); // Eşleştirme için route
const messageRequestRoutes_1 = __importDefault(require("./routes/messageRequestRoutes")); // Mesaj istekleri için route
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes")); // Chat sistemi için route
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes")); // Bildirimler için route
const badgeRoutes_1 = __importDefault(require("./routes/badgeRoutes")); // Badge sistemi için route
const kafkaService_1 = __importDefault(require("./services/kafkaService"));
// Import workers to run in same process
const persistence_worker_1 = __importDefault(require("./workers/persistence.worker"));
const realtime_worker_1 = __importDefault(require("./workers/realtime.worker"));
const notification_worker_1 = __importDefault(require("./workers/notification.worker"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3002; // 3001 port conflict olduğu için 3002 kullanıyoruz
// HTTP server oluştur (Socket.IO için gerekli)
const server = (0, http_1.createServer)(app);
// Socket.IO manager'ı başlat
const socketManager = socket_1.default.getInstance(server);
// Chat room cleanup servisini başlat
const cleanupService = chatRoomCleanupService_1.default.getInstance();
app.use(express_1.default.json());
// Statik dosyaları sunmak için
app.use('/admin', express_1.default.static(path_1.default.join(__dirname, '..', 'public'))); // Admin paneli dosyaları public klasöründe
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '..', 'public', 'uploads'))); // Yüklenen dosyalar için
// API Rotaları
app.use('/api/auth', authRoutes_1.default);
app.use('/api/users', userRoutes_1.default); // /api/users ile başlayanlar userRoutes'a gider
app.use('/api/tests', testsRoutes_1.default); // /api/tests ile başlayanlar testsRoutes'a gider
app.use('/api/test-responses', testResponsesRoutes_1.default); // /api/test-responses ile başlayanlar testResponsesRoutes'a gider
app.use('/api/matches', matchingRoutes_1.default); // /api/matches ile başlayanlar matchingRoutes'a gider
app.use('/api/message-requests', messageRequestRoutes_1.default); // /api/message-requests ile başlayanlar messageRequestRoutes'a gider
app.use('/api/chat', chatRoutes_1.default); // /api/chat ile başlayanlar chatRoutes'a gider
app.use('/api/notifications', notificationRoutes_1.default); // /api/notifications ile başlayanlar notificationRoutes'a gider
app.use('/api/badges', badgeRoutes_1.default); // /api/badges ile başlayanlar badgeRoutes'a gider
// Bir test setine ait soruları yönetmek için nested route
// testsRoutes içinden /:testId/questions gibi bir yapıya yönlendirme yapılabilir
// VEYA doğrudan burada tanımlanabilir. Şimdilik testsRoutes içinde :testId altına questionsRoutes'u ekleyelim.
// Bu, questionsRoutes'un /api/tests/:testId/questions altında çalışmasını sağlar.
testsRoutes_1.default.use('/:testId/questions', questionsRoutes_1.default);
// Veritabanı bağlantısını test et (isteğe bağlı, geliştirme için)
app.get('/test-db', async (req, res) => {
    try {
        const client = await database_1.default.connect();
        const result = await client.query('SELECT NOW()');
        res.json({ message: 'Database connection successful!', time: result.rows[0] });
        client.release();
    }
    catch (error) {
        console.error('Error connecting to database', error);
        res.status(500).json({ message: 'Error connecting to database' });
    }
});
// Admin paneli için özel route
app.get('/admin', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '..', 'public', 'admin.html'));
});
// Ana sayfa için basit bir yönlendirme, /admin'e yönlendirilebilir
app.get('/', (req, res) => {
    // res.send('API is running! Visit /admin for the admin panel.');
    res.redirect('/admin'); // Otomatik olarak admin paneline yönlendir
});
// Redis bağlantısını test et
const cluster = redis_1.default.getCluster();
if (cluster) {
    cluster.on('ready', () => {
        console.log('🚀 Redis Cluster connection established');
    });
}
else {
    console.log('⚠️ Redis cluster not available, using in-memory cache');
}
const startServer = async () => {
    try {
        // Kafka Producer'a bağlan
        await kafkaService_1.default.connectProducer();
        server.listen(port, async () => {
            console.log(`🚀 Server is running on port ${port}`);
            console.log(`📊 Admin panel: http://localhost:${port}/admin`);
            console.log(`💬 Socket.IO ready for connections`);
            console.log(`📊 Redis ready for caching`);
            // Start workers AFTER server and SocketManager are fully initialized
            console.log('🔧 Starting workers in same process...');
            try {
                await persistence_worker_1.default.start();
                console.log('✅ Persistence Worker started');
            }
            catch (error) {
                console.error('❌ Failed to start Persistence Worker:', error);
            }
            try {
                await realtime_worker_1.default.start();
                console.log('✅ Realtime Worker started');
            }
            catch (error) {
                console.error('❌ Failed to start Realtime Worker:', error);
            }
            try {
                await notification_worker_1.default.start();
                console.log('✅ Notification Worker started');
            }
            catch (error) {
                console.error('❌ Failed to start Notification Worker:', error);
            }
            console.log(`⚡ All workers running in same process`);
        });
    }
    catch (error) {
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
        await persistence_worker_1.default.stop();
        await realtime_worker_1.default.stop();
        await notification_worker_1.default.stop();
        console.log('✅ All workers stopped');
    }
    catch (error) {
        console.error('❌ Error stopping workers:', error);
    }
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    try {
        await persistence_worker_1.default.stop();
        await realtime_worker_1.default.stop();
        await notification_worker_1.default.stop();
        console.log('✅ All workers stopped');
    }
    catch (error) {
        console.error('❌ Error stopping workers:', error);
    }
    process.exit(0);
});
