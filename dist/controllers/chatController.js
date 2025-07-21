"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveChat = exports.deleteExpiredChatRooms = exports.getExpiredChatRooms = exports.createChatRoom = exports.updateRoom = exports.endRoom = exports.sendTypingIndicator = exports.markChatRoomAsRead = exports.uploadImage = exports.sendMessage = exports.getMessages = exports.enterChatRoom = exports.getChatRoom = exports.getChatRooms = void 0;
const database_1 = __importDefault(require("../config/database"));
const redis_1 = __importDefault(require("../config/redis"));
const uuid_1 = require("uuid");
const socket_1 = __importDefault(require("../config/socket"));
const kafkaService_1 = __importDefault(require("../services/kafkaService"));
const badgeService_1 = __importDefault(require("../services/badgeService"));
const firebaseNotificationService_1 = require("../services/firebaseNotificationService");
const enterpriseNotificationService_1 = require("../services/enterpriseNotificationService");
const getChatRooms = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const query = `
      WITH latest_messages AS (
        SELECT
          chat_id,
          content,
          created_at,
          sender_id,
          ROW_NUMBER() OVER(PARTITION BY chat_id ORDER BY created_at DESC) as rn
        FROM messages
      )
      SELECT
        c.id,
        c.user1_id,
        c.user2_id,
        c.created_at,
        c.expires_at,
        c.status,
        lm.content AS last_message_db,
        lm.created_at AS last_message_at,
        u.id AS other_user_id,
        u.username AS other_user_username,
        u.first_name AS other_user_first_name,
        u.last_name AS other_user_last_name,
        u.avatar_url AS other_user_avatar_url
      FROM
        chats c
      LEFT JOIN latest_messages lm ON c.id = lm.chat_id AND lm.rn = 1
      JOIN users u ON u.id = (CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END)
      WHERE
        (c.user1_id = $1 OR c.user2_id = $1) AND c.status = 'active'
      ORDER BY
        lm.created_at DESC NULLS LAST;
    `;
        const { rows } = await database_1.default.query(query, [userId]);
        const rooms = await Promise.all(rows.map(async (row) => {
            const otherUser = {
                id: row.other_user_id,
                username: row.other_user_username,
                first_name: row.other_user_first_name,
                last_name: row.other_user_last_name,
                avatar_url: row.other_user_avatar_url,
            };
            // Redis'ten son mesajı al
            let lastMessage = row.last_message_db || 'Henüz mesaj yok';
            let lastMessageAt = row.last_message_at;
            try {
                const messages = await redis_1.default.getMessages(row.id, 1, 0);
                if (messages.length > 0) {
                    const msg = messages[0];
                    lastMessage = msg.message_type === 'text' ? msg.content || msg.message : '📷 Resim';
                    lastMessageAt = new Date(msg.created_at);
                }
            }
            catch (redisError) {
                console.warn('Could not get last message from Redis:', redisError);
            }
            // Badge sayısını al
            let unread_count = 0;
            try {
                const badgeService = badgeService_1.default.getInstance();
                unread_count = await badgeService.getRoomBadgeCount(userId, row.id);
            }
            catch (badgeError) {
                console.warn('Could not get badge count:', badgeError);
            }
            return {
                id: row.id,
                user1_id: row.user1_id,
                user2_id: row.user2_id,
                created_at: row.created_at,
                expires_at: row.expires_at,
                status: row.status,
                last_message: lastMessage,
                last_message_at: lastMessageAt,
                other_user: otherUser,
                // Frontend'in beklediği ek alanlar
                time_remaining: row.expires_at ? new Date(row.expires_at).getTime() - Date.now() : 0,
                // Badge sistemi
                unread_count: unread_count,
                unread_message_count: unread_count, // Alternatif alan adı
                unread_messages: unread_count, // Alternatif alan adı
                message_count: unread_count, // Alternatif alan adı
            };
        }));
        res.status(200).json({
            rooms,
            total_count: rooms.length
        });
    }
    catch (error) {
        console.error('Get chat rooms error:', error);
        res.status(500).json({ message: 'Error getting chat rooms' });
    }
};
exports.getChatRooms = getChatRooms;
const getChatRoom = async (req, res) => {
    const userId = req.user?.id;
    const roomId = req.params.roomId;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required' });
    }
    try {
        const roomResult = await database_1.default.query(`
      SELECT cr.*, 
             u1.id as user1_id, u1.username as user1_username, 
             u1.first_name as user1_first_name, u1.last_name as user1_last_name,
             u1.avatar_url as user1_avatar,
             u2.id as user2_id, u2.username as user2_username, 
             u2.first_name as user2_first_name, u2.last_name as user2_last_name,
             u2.avatar_url as user2_avatar,
             EXTRACT(EPOCH FROM (cr.expires_at - NOW())) * 1000 as time_remaining_ms
      FROM chats cr
      JOIN users u1 ON cr.user1_id = u1.id
      JOIN users u2 ON cr.user2_id = u2.id
      WHERE cr.id = $1 AND (cr.user1_id = $2 OR cr.user2_id = $2) AND cr.status = 'active'
    `, [roomId, userId]);
        if (roomResult.rows.length === 0) {
            return res.status(404).json({ message: 'Chat room not found or you are not a participant' });
        }
        const row = roomResult.rows[0];
        const otherUser = row.user1_id === userId ? {
            id: row.user2_id,
            username: row.user2_username,
            first_name: row.user2_first_name,
            last_name: row.user2_last_name,
            avatar_url: row.user2_avatar
        } : {
            id: row.user1_id,
            username: row.user1_username,
            first_name: row.user1_first_name,
            last_name: row.user1_last_name,
            avatar_url: row.user1_avatar
        };
        const room = {
            id: row.id,
            user1_id: row.user1_id,
            user2_id: row.user2_id,
            created_at: row.created_at,
            expires_at: row.expires_at,
            status: row.status,
            ended_by_user1: row.ended_by_user1,
            ended_by_user2: row.ended_by_user2,
            last_message_at: row.last_message_at,
            other_user: otherUser,
            time_remaining: Math.max(0, parseInt(row.time_remaining_ms))
        };
        // Send user event for room join
        try {
            const userEvent = {
                userId: userId,
                eventType: 'join_room',
                roomId: roomId,
                timestamp: Date.now(),
                metadata: {
                    otherUserId: otherUser.id,
                    roomType: 'chat'
                }
            };
            await kafkaService_1.default.sendUserEvent(userEvent);
        }
        catch (kafkaError) {
            console.warn('Failed to send user event:', kafkaError);
        }
        res.status(200).json({ room });
    }
    catch (error) {
        console.error('Get chat room error:', error);
        res.status(500).json({ message: 'Error getting chat room' });
    }
};
exports.getChatRoom = getChatRoom;
// Chat room'a giriş yap ve badge'i sıfırla
const enterChatRoom = async (req, res) => {
    const userId = req.user?.id;
    const roomId = req.params.roomId;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required' });
    }
    try {
        // Room'un varlığını kontrol et
        const roomResult = await database_1.default.query(`
      SELECT cr.*, 
             u1.id as user1_id, u1.username as user1_username, 
             u1.first_name as user1_first_name, u1.last_name as user1_last_name,
             u1.avatar_url as user1_avatar,
             u2.id as user2_id, u2.username as user2_username, 
             u2.first_name as user2_first_name, u2.last_name as user2_last_name,
             u2.avatar_url as user2_avatar,
             EXTRACT(EPOCH FROM (cr.expires_at - NOW())) * 1000 as time_remaining_ms
      FROM chats cr
      JOIN users u1 ON cr.user1_id = u1.id
      JOIN users u2 ON cr.user2_id = u2.id
      WHERE cr.id = $1 AND (cr.user1_id = $2 OR cr.user2_id = $2) AND cr.status = 'active'
    `, [roomId, userId]);
        if (roomResult.rows.length === 0) {
            return res.status(404).json({ message: 'Chat room not found or you are not a participant' });
        }
        // Badge'i sıfırla
        try {
            const badgeService = badgeService_1.default.getInstance();
            await badgeService.resetBadgeCount(userId, roomId);
            console.log(`🔄 Badge reset for user ${userId} entering room ${roomId}`);
        }
        catch (badgeError) {
            console.warn('Failed to reset badge count:', badgeError);
        }
        // Send user event for room join
        try {
            const userEvent = {
                userId: userId,
                eventType: 'join_room',
                roomId: roomId,
                timestamp: Date.now(),
                metadata: {
                    roomType: 'chat'
                }
            };
            await kafkaService_1.default.sendUserEvent(userEvent);
        }
        catch (kafkaError) {
            console.warn('Failed to send user event:', kafkaError);
        }
        res.status(200).json({
            message: 'Successfully entered chat room and badge reset',
            roomId: roomId,
            timestamp: Date.now()
        });
    }
    catch (error) {
        console.error('Enter chat room error:', error);
        res.status(500).json({ message: 'Error entering chat room' });
    }
};
exports.enterChatRoom = enterChatRoom;
const getMessages = async (req, res) => {
    console.log('🚀🚀🚀 getMessages endpoint called - START');
    console.log('📋 Request params:', req.params);
    console.log('📋 Request query:', req.query);
    console.log('👤 Request user:', req.user);
    console.log('🔑 Authorization header:', req.headers.authorization);
    const userId = req.user?.id;
    const roomId = req.params.roomId;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    console.log(`🔍 Extracted values - userId: ${userId}, roomId: ${roomId}, limit: ${limit}, offset: ${offset}`);
    if (!userId) {
        console.log('❌ No userId found, returning 401');
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required' });
    }
    try {
        // Kullanıcının bu room'da olup olmadığını kontrol et
        console.log(`🔍 Checking room access for user ${userId} in room ${roomId}`);
        const roomResult = await database_1.default.query('SELECT * FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2) AND status = $3', [roomId, userId, 'active']);
        console.log(`📊 Room query result: ${roomResult.rows.length} rows found`);
        if (roomResult.rows.length === 0) {
            console.log(`❌ Room not found or user not participant`);
            return res.status(404).json({ message: 'Chat room not found or you are not a participant' });
        }
        console.log(`✅ Room access granted for user ${userId}`);
        // Redis'ten mesajları getir
        let redisMessages = [];
        try {
            console.log(`🔍 Fetching messages from Redis for room: ${roomId}`);
            console.log(`📊 Redis client connected: ${redis_1.default.isConnected()}`);
            console.log(`📊 Redis using in-memory: ${redis_1.default.isUsingInMemory()}`);
            // Debug: Test Redis connection
            const testKey = `chat:${roomId}:messages`;
            console.log(`🔧 Debug: Testing Redis key: ${testKey}`);
            // Try to get raw messages first
            const rawMessages = await redis_1.default.lrange(testKey, 0, 2);
            console.log(`🔧 Debug: Raw Redis lrange result: ${JSON.stringify(rawMessages)}`);
            redisMessages = await redis_1.default.getMessages(roomId, limit, offset);
            console.log(`📊 Retrieved ${redisMessages.length} messages from Redis for room ${roomId}`);
            if (redisMessages.length > 0) {
                console.log(`📨 First message: ${JSON.stringify(redisMessages[0])}`);
            }
            else {
                console.log(`⚠️ No messages found - debugging Redis connection...`);
                console.log(`🔧 Redis cluster status: ${redis_1.default.getCluster() ? 'Connected' : 'Disconnected'}`);
            }
        }
        catch (redisError) {
            console.warn('Could not get messages from Redis:', redisError);
            return res.status(200).json({ messages: [], total_count: 0 });
        }
        // Redis mesajlarını API formatına dönüştür
        const messages = redisMessages.map((redisMsg, index) => ({
            id: index + 1, // Temporary sequential ID for frontend compatibility
            uuid: redisMsg.id, // Keep original UUID for reference
            chat_id: redisMsg.roomId,
            sender_id: redisMsg.sender_id,
            content: redisMsg.content || redisMsg.message, // content veya message alanını kullan (fallback compatibility)
            message_type: redisMsg.message_type,
            created_at: new Date(redisMsg.created_at),
            updated_at: new Date(redisMsg.created_at)
        }));
        // Kullanıcı bilgilerini ekle
        const userIds = [...new Set(messages.map(msg => msg.sender_id))];
        const usersResult = await database_1.default.query('SELECT id, username, first_name, last_name, avatar_url FROM users WHERE id = ANY($1)', [userIds]);
        const usersMap = new Map();
        usersResult.rows.forEach(user => {
            usersMap.set(user.id, user);
        });
        const messagesWithSender = messages.map(msg => ({
            ...msg,
            sender: usersMap.get(msg.sender_id)
        }));
        res.status(200).json({
            messages: messagesWithSender,
            total_count: messages.length,
            room_id: roomId
        });
    }
    catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ message: 'Error getting messages' });
    }
};
exports.getMessages = getMessages;
const sendMessage = async (req, res) => {
    const senderId = req.user?.id;
    const roomId = req.params.roomId;
    const { message, messageType = 'text', imageUrl } = req.body;
    const messageId = (0, uuid_1.v4)();
    if (!senderId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required' });
    }
    if (messageType === 'text' && !message) {
        return res.status(400).json({ message: 'Message content is required for text messages' });
    }
    if (messageType === 'image' && !imageUrl) {
        return res.status(400).json({ message: 'Image URL is required for image messages' });
    }
    try {
        // 1. Odaya ait kullanıcıları doğrula
        const roomResult = await database_1.default.query('SELECT user1_id, user2_id FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2) AND status = $3', [roomId, senderId, 'active']);
        if (roomResult.rows.length === 0) {
            return res.status(404).json({ message: 'Chat room not found or you are not a participant.' });
        }
        const room = roomResult.rows[0];
        const receiverId = room.user1_id === senderId ? room.user2_id : room.user1_id;
        // 2. Enterprise-grade Kafka message
        const chatMessage = {
            id: messageId,
            roomId: roomId,
            userId: senderId,
            content: messageType === 'text' ? message : imageUrl,
            timestamp: Date.now(),
            messageType: messageType,
            metadata: {
                receiverId: receiverId,
                platform: req.headers['user-agent'] || 'unknown',
                ip: req.ip || 'unknown'
            }
        };
        // 3. Primary: Send to Kafka Queue (Enterprise Message Processing)
        try {
            await kafkaService_1.default.sendChatMessage(chatMessage);
            console.log('✅ Message sent to Kafka queue:', messageId);
            // 3.1. Badge System: Alıcının badge sayısını artır (Kafka başarılı olduğunda da çalışmalı)
            try {
                const badgeService = badgeService_1.default.getInstance();
                await badgeService.incrementBadgeCount(receiverId, roomId);
                console.log(`✅ Badge incremented for user ${receiverId} in room ${roomId}`);
            }
            catch (badgeError) {
                console.warn('Failed to increment badge count:', badgeError);
            }
            // 3.2. OPTIMISTIC CHAT LIST UPDATE: Hemen chat listesi güncellemesi gönder (worker'dan önce)
            try {
                const socketManager = socket_1.default.getInstance();
                console.log(`🧪 [Optimistic] SocketManager instance:`, socketManager ? 'AVAILABLE' : 'NULL');
                if (socketManager) {
                    const optimisticChatListUpdate = {
                        roomId: roomId,
                        last_message: messageType === 'text' ? message : '📷 Resim',
                        last_message_at: new Date(chatMessage.timestamp).toISOString(),
                        sender_id: senderId,
                        message_type: messageType,
                        optimistic: true // Worker güncellemesinden ayırt etmek için
                    };
                    console.log(`🚀 [Optimistic] Sending chat list update:`, optimisticChatListUpdate);
                    socketManager.sendToUser(senderId, 'chat_list_update', optimisticChatListUpdate);
                    socketManager.sendToUser(receiverId, 'chat_list_update', optimisticChatListUpdate);
                    console.log(`✅ [Optimistic] Chat list update sent to users ${senderId} and ${receiverId} for room ${roomId}`);
                }
                else {
                    console.error(`❌ [Optimistic] SocketManager not available!`);
                }
            }
            catch (socketError) {
                console.error('❌ [Optimistic] Failed to send optimistic chat list update:', socketError);
            }
            // 4. Immediate response to client (message is queued)
            res.status(202).json({
                message: "Message queued for processing",
                data: {
                    id: messageId,
                    roomId: roomId,
                    sender_id: senderId,
                    content: chatMessage.content,
                    message_type: messageType,
                    created_at: new Date(chatMessage.timestamp).toISOString(),
                    status: 'queued',
                    timestamp: chatMessage.timestamp,
                },
                // 🚀 OPTIMISTIC UPDATE DATA (Frontend için)
                optimistic_chat_update: {
                    roomId: roomId,
                    last_message: messageType === 'text' ? message : '📷 Resim',
                    last_message_at: new Date(chatMessage.timestamp).toISOString(),
                    sender_id: senderId,
                    message_type: messageType,
                    optimistic: true
                }
            });
            // Message will be processed by workers asynchronously
            return;
        }
        catch (kafkaError) {
            console.error('❌ Kafka queue failed, falling back to direct processing:', kafkaError);
            // 5. Fallback: Direct processing if Kafka fails
            const redisMessage = {
                id: messageId,
                chat_id: roomId,
                sender_id: senderId,
                content: chatMessage.content, // content alanını kullan (tutarlılık için)
                message_type: messageType,
                created_at: new Date(chatMessage.timestamp).toISOString(),
                timestamp: chatMessage.timestamp
            };
            try {
                await redis_1.default.saveMessage(roomId, redisMessage);
                console.log('✅ Fallback: Message saved to Redis:', messageId);
            }
            catch (redisError) {
                console.error('❌ Fallback: Failed to save message to Redis:', redisError);
            }
            // 6. Fallback: Save to PostgreSQL
            try {
                await database_1.default.query('INSERT INTO messages (id, chat_id, sender_id, content, message_type, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING', [messageId, roomId, senderId, chatMessage.content, messageType, new Date(chatMessage.timestamp)]);
                console.log('✅ Fallback: Message saved to PostgreSQL:', messageId);
            }
            catch (dbError) {
                console.warn('Fallback: Failed to save message to PostgreSQL:', dbError);
            }
            // 7. Fallback: Send real-time notification via Socket.IO
            try {
                const socketManager = socket_1.default.getInstance();
                socketManager.sendToRoom(roomId, 'new_message', {
                    id: messageId,
                    chat_id: roomId,
                    sender_id: senderId,
                    content: chatMessage.content, // content alanını kullan (tutarlılık için)
                    message_type: messageType,
                    created_at: redisMessage.created_at,
                    timestamp: chatMessage.timestamp
                });
                console.log('✅ Fallback: Real-time message sent via Socket.IO:', messageId);
            }
            catch (socketError) {
                console.warn('Fallback: Failed to send real-time message:', socketError);
            }
            // 7.1. Badge System: Alıcının badge sayısını artır
            try {
                const badgeService = badgeService_1.default.getInstance();
                await badgeService.incrementBadgeCount(receiverId, roomId);
                console.log(`✅ Badge incremented for user ${receiverId} in room ${roomId}`);
            }
            catch (badgeError) {
                console.warn('Failed to increment badge count:', badgeError);
            }
        }
        // 8. Fallback: Send user event for analytics
        try {
            const userEvent = {
                userId: senderId,
                eventType: 'typing',
                roomId: roomId,
                timestamp: Date.now(),
                metadata: {
                    messageId: messageId,
                    messageType: messageType,
                    receiverId: receiverId,
                    action: 'message_sent'
                }
            };
            await kafkaService_1.default.sendUserEvent(userEvent);
        }
        catch (eventError) {
            console.warn('Fallback: Failed to send user event:', eventError);
        }
        // 9. Fallback: Update last message timestamp in database
        try {
            await database_1.default.query('UPDATE chats SET last_message_at = NOW() WHERE id = $1', [roomId]);
        }
        catch (dbError) {
            console.warn('Fallback: Failed to update last message timestamp:', dbError);
        }
        // 10. Fallback: Send notification to receiver
        try {
            const senderResult = await database_1.default.query('SELECT first_name, last_name FROM users WHERE id = $1', [senderId]);
            if (senderResult.rows.length > 0) {
                const sender = senderResult.rows[0];
                const senderName = `${sender.first_name} ${sender.last_name}`;
                // Kafka notification
                const notification = {
                    userId: receiverId,
                    type: 'message',
                    title: senderName,
                    body: messageType === 'text' ? message : '📷 Resim gönderdi',
                    data: {
                        roomId: roomId,
                        messageId: messageId,
                        senderId: senderId,
                        messageType: messageType
                    },
                    timestamp: Date.now()
                };
                await kafkaService_1.default.sendNotification(notification);
                // 🏢 ENTERPRISE: Multi-device push notification
                try {
                    const messageBodyForNotification = messageType === 'text'
                        ? (message.length > 100 ? message.substring(0, 100) + '...' : message)
                        : '📷 Resim gönderdi';
                    await enterpriseNotificationService_1.enterpriseNotificationService.sendMessageNotificationEnterprise(receiverId, senderId, senderName, messageBodyForNotification, roomId);
                    console.log(`🏢 Enterprise notification sent for message ${messageId}`);
                }
                catch (enterpriseError) {
                    console.warn('Enterprise notification failed:', enterpriseError);
                    // Fallback to legacy Firebase
                    try {
                        const messageBodyForFallback = messageType === 'text'
                            ? (message.length > 100 ? message.substring(0, 100) + '...' : message)
                            : '📷 Resim gönderdi';
                        await firebaseNotificationService_1.firebaseNotificationService.sendMessageNotification(receiverId, senderId, senderName, messageBodyForFallback, roomId);
                        console.log(`🔥 Fallback Firebase notification sent for message ${messageId}`);
                    }
                    catch (firebaseError) {
                        console.warn('Both enterprise and Firebase notifications failed:', firebaseError);
                    }
                }
            }
        }
        catch (notificationError) {
            console.warn('Fallback: Failed to send notification:', notificationError);
        }
        // 11. Fallback response to client
        res.status(202).json({
            message: "Message processed directly (Kafka unavailable)",
            data: {
                id: messageId,
                roomId: roomId,
                sender_id: senderId,
                content: chatMessage.content,
                message_type: messageType,
                created_at: new Date(chatMessage.timestamp).toISOString(),
                timestamp: chatMessage.timestamp,
            },
            // 🚀 OPTIMISTIC UPDATE DATA (Frontend için)
            optimistic_chat_update: {
                roomId: roomId,
                last_message: messageType === 'text' ? message : '📷 Resim',
                last_message_at: new Date(chatMessage.timestamp).toISOString(),
                sender_id: senderId,
                message_type: messageType,
                optimistic: true
            }
        });
    }
    catch (error) {
        console.error('Send message error:', error);
        if (error instanceof Error && error.message.includes('Producer is not connected')) {
            return res.status(503).json({
                message: 'Message service is temporarily unavailable. Please try again later.',
                error: 'KAFKA_UNAVAILABLE'
            });
        }
        res.status(500).json({
            message: 'Error processing message',
            error: 'INTERNAL_ERROR'
        });
    }
};
exports.sendMessage = sendMessage;
const uploadImage = async (req, res) => {
    // ... existing code ...
};
exports.uploadImage = uploadImage;
// markMessagesAsRead fonksiyonu kaldırıldı - yeni badge sistemi kullanılacak
// Chat room'daki mesajları okundu olarak işaretle (Badge sıfırlama için)
const markChatRoomAsRead = async (req, res) => {
    const userId = req.user?.id;
    const roomId = req.params.roomId;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required' });
    }
    try {
        // Room'un varlığını kontrol et
        const roomResult = await database_1.default.query('SELECT user1_id, user2_id FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2) AND status = $3', [roomId, userId, 'active']);
        if (roomResult.rows.length === 0) {
            return res.status(404).json({ message: 'Chat room not found or you are not a participant' });
        }
        // Badge'i sıfırla
        try {
            const badgeService = badgeService_1.default.getInstance();
            await badgeService.resetBadgeCount(userId, roomId);
            console.log(`🔄 Badge reset for user ${userId} reading room ${roomId}`);
        }
        catch (badgeError) {
            console.warn('Failed to reset badge count:', badgeError);
        }
        res.status(200).json({
            message: 'Chat room marked as read successfully',
            roomId: roomId,
            timestamp: Date.now()
        });
    }
    catch (error) {
        console.error('Mark chat room as read error:', error);
        res.status(500).json({ message: 'Error marking chat room as read' });
    }
};
exports.markChatRoomAsRead = markChatRoomAsRead;
const sendTypingIndicator = async (req, res) => {
    const userId = req.user?.id;
    const { roomId } = req.params;
    const { isTyping } = req.body;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required' });
    }
    try {
        // Verify user is in room
        const roomResult = await database_1.default.query('SELECT user1_id, user2_id FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2) AND status = $3', [roomId, userId, 'active']);
        if (roomResult.rows.length === 0) {
            return res.status(404).json({ message: 'Chat room not found' });
        }
        const room = roomResult.rows[0];
        const otherUserId = room.user1_id === userId ? room.user2_id : room.user1_id;
        // Send typing event
        const userEvent = {
            userId: userId,
            eventType: 'typing',
            roomId: roomId,
            timestamp: Date.now(),
            metadata: {
                isTyping: isTyping,
                otherUserId: otherUserId
            }
        };
        await kafkaService_1.default.sendUserEvent(userEvent);
        // Real-time notification via Socket.IO
        const socketManager = socket_1.default.getInstance();
        socketManager.sendToUser(otherUserId, 'typing_indicator', {
            roomId: roomId,
            userId: userId,
            isTyping: isTyping,
            timestamp: Date.now()
        });
        res.status(200).json({ message: 'Typing indicator sent' });
    }
    catch (error) {
        console.error('Send typing indicator error:', error);
        res.status(500).json({ message: 'Error sending typing indicator' });
    }
};
exports.sendTypingIndicator = sendTypingIndicator;
const endRoom = async (req, res) => {
    const userId = req.user?.id;
    const { roomId } = req.params;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required' });
    }
    try {
        // Chat room'un varlığını kontrol et
        const roomResult = await database_1.default.query('SELECT user1_id, user2_id FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2) AND status = $3', [roomId, userId, 'active']);
        if (roomResult.rows.length === 0) {
            return res.status(404).json({ message: 'Chat odası bulunamadı' });
        }
        const room = roomResult.rows[0];
        const otherUserId = room.user1_id === userId ? room.user2_id : room.user1_id;
        // Room'u sonlandır
        await database_1.default.query('UPDATE chats SET status = $1 WHERE id = $2', ['ended_by_users', roomId]);
        // Send user event for room leave
        try {
            const userEvent = {
                userId: userId,
                eventType: 'leave_room',
                roomId: roomId,
                timestamp: Date.now(),
                metadata: {
                    otherUserId: otherUserId,
                    reason: 'user_ended'
                }
            };
            await kafkaService_1.default.sendUserEvent(userEvent);
        }
        catch (kafkaError) {
            console.warn('Failed to send user event:', kafkaError);
        }
        // Redis'teki mesajları temizle (opsiyonel - retention policy'ye göre)
        try {
            await redis_1.default.expire(`chat_room:${roomId}:messages`, 3600); // 1 hour retention after end
        }
        catch (redisError) {
            console.warn('Could not set expiry for room messages in Redis:', redisError);
        }
        // Karşı kullanıcıya bildirim gönder
        try {
            const senderResult = await database_1.default.query('SELECT first_name, last_name FROM users WHERE id = $1', [userId]);
            if (senderResult.rows.length > 0) {
                const sender = senderResult.rows[0];
                const notification = {
                    userId: otherUserId,
                    type: 'system',
                    title: 'Sohbet Sonlandırıldı',
                    body: `${sender.first_name} ${sender.last_name} sohbeti sonlandırdı.`,
                    data: {
                        roomId: roomId,
                        endedBy: userId,
                        reason: 'user_ended'
                    },
                    timestamp: Date.now()
                };
                await kafkaService_1.default.sendNotification(notification);
            }
        }
        catch (notificationError) {
            console.warn('Could not send notification:', notificationError);
        }
        // Socket.IO ile real-time bildirim
        try {
            const socketManager = socket_1.default.getInstance();
            socketManager.sendRoomEnded(roomId, 'user_ended', userId);
        }
        catch (socketError) {
            console.warn('Could not send real-time notification:', socketError);
        }
        // 🚫 Karşı tarafı otomatik olarak blokla
        try {
            await database_1.default.query('INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT (blocker_id, blocked_id) DO NOTHING', [userId, otherUserId]);
            console.log(`[AutoBlock] User ${userId} blocked user ${otherUserId} after ending chat room ${roomId}`);
        }
        catch (blockError) {
            console.error(`[AutoBlock] Failed to block user ${otherUserId} for user ${userId}:`, blockError);
        }
        res.status(200).json({
            message: 'Chat room ended successfully',
            roomId: roomId,
            timestamp: Date.now()
        });
    }
    catch (error) {
        console.error('Error ending chat room:', error);
        res.status(500).json({ message: 'Sunucu hatası' });
    }
};
exports.endRoom = endRoom;
const updateRoom = async (req, res) => {
    const userId = req.user?.id;
    const { roomId } = req.params;
    const { expires_at } = req.body;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required' });
    }
    try {
        // Room'un varlığını kontrol et
        const roomResult = await database_1.default.query('SELECT user1_id, user2_id, expires_at FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2) AND status = $3', [roomId, userId, 'active']);
        if (roomResult.rows.length === 0) {
            return res.status(404).json({ message: 'Chat room not found' });
        }
        const room = roomResult.rows[0];
        const updates = {};
        // Expire time update
        if (expires_at) {
            await database_1.default.query('UPDATE chats SET expires_at = $1 WHERE id = $2', [expires_at, roomId]);
            updates.expires_at = expires_at;
            updates.time_remaining = new Date(expires_at).getTime() - Date.now();
        }
        // Send room updated event via Socket.IO
        try {
            const socketManager = socket_1.default.getInstance();
            socketManager.sendRoomUpdated(roomId, updates);
        }
        catch (socketError) {
            console.warn('Could not send room update notification:', socketError);
        }
        res.status(200).json({
            message: 'Room updated successfully',
            roomId: roomId,
            updates: updates,
            timestamp: Date.now()
        });
    }
    catch (error) {
        console.error('Error updating room:', error);
        res.status(500).json({ message: 'Error updating room' });
    }
};
exports.updateRoom = updateRoom;
const createChatRoom = async (req, res) => {
    const userId = req.user?.id;
    const { roomId, otherUserId } = req.body;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!roomId || !otherUserId) {
        return res.status(400).json({ message: 'Room ID and other user ID are required' });
    }
    try {
        // Check if room already exists
        const existingRoom = await database_1.default.query('SELECT * FROM chats WHERE id = $1', [roomId]);
        if (existingRoom.rows.length > 0) {
            return res.status(200).json({
                message: 'Room already exists',
                room: existingRoom.rows[0]
            });
        }
        // Create new room
        const result = await database_1.default.query('INSERT INTO chats (id, user1_id, user2_id, created_at, expires_at, status, last_message_at) VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL \'7 days\', $4, NOW()) RETURNING *', [roomId, userId, otherUserId, 'active']);
        console.log('✅ Chat room created:', roomId);
        res.status(201).json({
            message: 'Chat room created successfully',
            room: result.rows[0]
        });
    }
    catch (error) {
        console.error('Create chat room error:', error);
        res.status(500).json({ message: 'Error creating chat room' });
    }
};
exports.createChatRoom = createChatRoom;
// 🗑️ Expired Chat Cleanup Endpoints
const getExpiredChatRooms = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        // Kullanıcının süresi dolmuş chat room'larını getir
        const expiredRoomsResult = await database_1.default.query(`
      SELECT cr.*, 
             u1.username as user1_username, u1.first_name as user1_first_name, u1.last_name as user1_last_name,
             u2.username as user2_username, u2.first_name as user2_first_name, u2.last_name as user2_last_name
      FROM chats cr
      JOIN users u1 ON cr.user1_id = u1.id
      JOIN users u2 ON cr.user2_id = u2.id
      WHERE (cr.user1_id = $1 OR cr.user2_id = $1) 
        AND cr.expires_at <= NOW() 
        AND cr.status = 'active'
      ORDER BY cr.expires_at DESC
    `, [userId]);
        const expiredRooms = expiredRoomsResult.rows.map(room => ({
            id: room.id,
            expires_at: room.expires_at,
            created_at: room.created_at,
            other_user: room.user1_id === userId ? {
                id: room.user2_id,
                username: room.user2_username,
                first_name: room.user2_first_name,
                last_name: room.user2_last_name
            } : {
                id: room.user1_id,
                username: room.user1_username,
                first_name: room.user1_first_name,
                last_name: room.user1_last_name
            }
        }));
        res.status(200).json({
            expired_rooms: expiredRooms,
            count: expiredRooms.length
        });
    }
    catch (error) {
        console.error('Get expired chat rooms error:', error);
        res.status(500).json({ message: 'Error getting expired chat rooms' });
    }
};
exports.getExpiredChatRooms = getExpiredChatRooms;
const deleteExpiredChatRooms = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        // Kullanıcının süresi dolmuş chat room'larını bul
        const expiredRoomsResult = await database_1.default.query(`
      SELECT cr.id, cr.user1_id, cr.user2_id
      FROM chats cr
      WHERE (cr.user1_id = $1 OR cr.user2_id = $1) 
        AND cr.expires_at <= NOW() 
        AND cr.status = 'active'
    `, [userId]);
        const expiredRooms = expiredRoomsResult.rows;
        let cleanupCount = 0;
        for (const room of expiredRooms) {
            try {
                // Room'u expired olarak işaretle
                await database_1.default.query('UPDATE chats SET status = $1, updated_at = NOW() WHERE id = $2', ['expired', room.id]);
                // Redis'teki mesajları temizle
                await redis_1.default.deleteRoomMessages(room.id);
                // Socket.IO ile real-time bildirim gönder
                try {
                    const socketManager = socket_1.default.getInstance();
                    socketManager.sendRoomEnded(room.id, 'expired', undefined);
                }
                catch (socketError) {
                    console.warn('Could not send room expired notification:', socketError);
                }
                cleanupCount++;
                console.log(`🗑️ Expired room cleaned up: ${room.id}`);
            }
            catch (roomError) {
                console.error(`Error cleaning up room ${room.id}:`, roomError);
            }
        }
        res.status(200).json({
            message: `Successfully cleaned up ${cleanupCount} expired chat rooms`,
            cleaned_count: cleanupCount,
            timestamp: Date.now()
        });
    }
    catch (error) {
        console.error('Delete expired chat rooms error:', error);
        res.status(500).json({ message: 'Error deleting expired chat rooms' });
    }
};
exports.deleteExpiredChatRooms = deleteExpiredChatRooms;
const getActiveChat = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const query = `
      SELECT
        c.id,
        c.user1_id,
        c.user2_id,
        c.created_at,
        c.expires_at,
        c.status,
        u.id AS other_user_id,
        u.username AS other_user_username,
        u.first_name AS other_user_first_name,
        u.last_name AS other_user_last_name,
        u.avatar_url AS other_user_avatar_url,
        EXTRACT(EPOCH FROM (c.expires_at - NOW())) * 1000 as time_remaining_ms
      FROM
        chats c
      JOIN users u ON u.id = (CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END)
      WHERE
        (c.user1_id = $1 OR c.user2_id = $1) AND c.status = 'active'
      LIMIT 1;
    `;
        const { rows } = await database_1.default.query(query, [userId]);
        if (rows.length === 0) {
            return res.status(200).json({ active_chat: null });
        }
        const row = rows[0];
        const otherUser = {
            id: row.other_user_id,
            username: row.other_user_username,
            first_name: row.other_user_first_name,
            last_name: row.other_user_last_name,
            avatar_url: row.other_user_avatar_url,
        };
        const activeChat = {
            id: row.id,
            user1_id: row.user1_id,
            user2_id: row.user2_id,
            created_at: row.created_at,
            expires_at: row.expires_at,
            status: row.status,
            other_user: otherUser,
            time_remaining: Math.max(0, parseInt(row.time_remaining_ms || '0')),
        };
        res.status(200).json({ active_chat: activeChat });
    }
    catch (error) {
        console.error('Get active chat error:', error);
        res.status(500).json({ message: 'Error getting active chat' });
    }
};
exports.getActiveChat = getActiveChat;
