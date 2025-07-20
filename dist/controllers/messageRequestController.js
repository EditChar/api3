"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelMessageRequest = exports.rejectMessageRequest = exports.acceptMessageRequest = exports.getPendingRequests = exports.getReceivedRequests = exports.sendMessageRequest = void 0;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
const notificationService_1 = require("../services/notificationService");
const sendMessageRequest = async (req, res) => {
    const senderId = req.user?.id;
    const { receiver_id, initial_message } = req.body;
    if (!senderId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!receiver_id) {
        return res.status(400).json({ message: 'Receiver ID is required' });
    }
    if (senderId === receiver_id) {
        return res.status(400).json({ message: 'Cannot send message request to yourself' });
    }
    try {
        // Kullanıcının aktif bir sohbeti olup olmadığını kontrol et
        const activeChatResult = await database_1.default.query("SELECT id FROM chats WHERE (user1_id = $1 OR user2_id = $1) AND status = 'active'", [senderId]);
        if (activeChatResult.rows.length > 0) {
            return res.status(403).json({ message: 'You already have an active chat and cannot send a new message request.' });
        }
        // Daha önce istek gönderilmiş mi kontrol et
        const existingRequestResult = await database_1.default.query('SELECT * FROM message_requests WHERE sender_id = $1 AND receiver_id = $2', [senderId, receiver_id]);
        if (existingRequestResult.rows.length > 0) {
            const existingRequest = existingRequestResult.rows[0];
            if (existingRequest.status === 'pending') {
                return res.status(400).json({
                    message: 'Message request already sent and pending',
                    existing_request: { ...existingRequest }
                });
            }
            else if (existingRequest.status === 'accepted') {
                return res.status(400).json({
                    message: 'Message request already accepted',
                    existing_request: { ...existingRequest }
                });
            }
        }
        // Receiver'ın bu sender'a istek göndermiş olup olmadığını kontrol et
        const reverseRequestResult = await database_1.default.query('SELECT * FROM message_requests WHERE sender_id = $1 AND receiver_id = $2', [receiver_id, senderId]);
        if (reverseRequestResult.rows.length > 0) {
            const reverseRequest = reverseRequestResult.rows[0];
            if (reverseRequest.status === 'pending') {
                return res.status(400).json({
                    message: 'This user has already sent you a message request. Please check your received requests.',
                    reverse_request: { ...reverseRequest }
                });
            }
        }
        // Receiver'ın var olup olmadığını kontrol et
        const receiverResult = await database_1.default.query('SELECT id, username, first_name, last_name FROM users WHERE id = $1', [receiver_id]);
        if (receiverResult.rows.length === 0) {
            return res.status(404).json({ message: 'Receiver not found' });
        }
        const receiver = receiverResult.rows[0];
        // Sender bilgilerini al
        const senderResult = await database_1.default.query('SELECT id, username, first_name, last_name FROM users WHERE id = $1', [senderId]);
        if (senderResult.rows.length === 0) {
            // Bu durum normalde olmamalı çünkü senderId token'dan geliyor
            return res.status(404).json({ message: 'Sender not found' });
        }
        const sender = senderResult.rows[0];
        // Yeni mesaj isteği oluştur
        const requestId = (0, uuid_1.v4)();
        const messageRequestResult = await database_1.default.query(`
      INSERT INTO message_requests (id, sender_id, receiver_id, status, initial_message)
      VALUES ($1, $2, $3, 'pending', $4)
      RETURNING *
    `, [requestId, senderId, receiver_id, initial_message || null]);
        const messageRequest = messageRequestResult.rows[0];
        // Receiver'a bildirim gönder
        // Bildirim mesajını initial_message'a göre ayarla
        const notificationMessage = initial_message
            ? `"${initial_message}"`
            : 'size bir mesaj isteği gönderdi.';
        await (0, notificationService_1.createNotificationSafe)({
            user_id: receiver_id,
            type: 'message_request',
            title: `Yeni Mesaj İsteği: ${sender.first_name}`,
            message: `${sender.first_name} ${sender.last_name} ${notificationMessage}`,
            data: {
                message_request_id: messageRequest.id,
                sender_id: senderId,
                sender_name: `${sender.first_name} ${sender.last_name}`
            }
        });
        // Güvenli bir yanıt objesi oluştur
        const safeRequest = {
            id: messageRequest.id,
            sender_id: messageRequest.sender_id,
            receiver_id: messageRequest.receiver_id,
            status: messageRequest.status,
            initial_message: messageRequest.initial_message,
            created_at: messageRequest.created_at,
            updated_at: messageRequest.updated_at
        };
        const safeReceiver = {
            id: receiver.id,
            username: receiver.username,
            first_name: receiver.first_name,
            last_name: receiver.last_name
        };
        res.status(201).json({
            message: 'Message request sent successfully',
            request: safeRequest,
            receiver: safeReceiver
        });
    }
    catch (error) {
        console.error('Send message request error:', error);
        console.error('Full error details:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            requestBody: req.body
        });
        res.status(500).json({ message: 'Error sending message request' });
    }
};
exports.sendMessageRequest = sendMessageRequest;
const getReceivedRequests = async (req, res) => {
    const userId = req.user?.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        // Gelen istekleri getir
        const requestsResult = await database_1.default.query(`
      SELECT mr.*, 
             u.id as sender_id, u.username as sender_username, 
             u.first_name as sender_first_name, u.last_name as sender_last_name,
             u.avatar_url as sender_avatar
      FROM message_requests mr
      JOIN users u ON mr.sender_id = u.id
      WHERE mr.receiver_id = $1
      ORDER BY mr.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
        // Toplam sayı
        const countResult = await database_1.default.query('SELECT COUNT(*) as total FROM message_requests WHERE receiver_id = $1', [userId]);
        const requests = requestsResult.rows.map(row => ({
            id: row.id,
            sender_id: row.sender_id,
            receiver_id: row.receiver_id,
            status: row.status,
            initial_message: row.initial_message,
            created_at: row.created_at,
            updated_at: row.updated_at,
            sender: {
                id: row.sender_id,
                username: row.sender_username,
                first_name: row.sender_first_name,
                last_name: row.sender_last_name,
                avatar_url: row.sender_avatar
            }
        }));
        res.status(200).json({
            requests,
            pagination: {
                current_page: page,
                total_pages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
                total_count: parseInt(countResult.rows[0].total),
                limit
            }
        });
    }
    catch (error) {
        console.error('Get received requests error:', error);
        res.status(500).json({ message: 'Error getting received requests' });
    }
};
exports.getReceivedRequests = getReceivedRequests;
const getPendingRequests = async (req, res) => {
    const userId = req.user?.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        // Gönderilen istekleri getir
        const requestsResult = await database_1.default.query(`
      SELECT mr.*, 
             u.id as receiver_id, u.username as receiver_username, 
             u.first_name as receiver_first_name, u.last_name as receiver_last_name,
             u.avatar_url as receiver_avatar
      FROM message_requests mr
      JOIN users u ON mr.receiver_id = u.id
      WHERE mr.sender_id = $1
      ORDER BY mr.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
        // Toplam sayı
        const countResult = await database_1.default.query('SELECT COUNT(*) as total FROM message_requests WHERE sender_id = $1', [userId]);
        const requests = requestsResult.rows.map(row => ({
            id: row.id,
            sender_id: row.sender_id,
            receiver_id: row.receiver_id,
            status: row.status,
            initial_message: row.initial_message,
            created_at: row.created_at,
            updated_at: row.updated_at,
            receiver: {
                id: row.receiver_id,
                username: row.receiver_username,
                first_name: row.receiver_first_name,
                last_name: row.receiver_last_name,
                avatar_url: row.receiver_avatar
            }
        }));
        res.status(200).json({
            requests,
            pagination: {
                current_page: page,
                total_pages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
                total_count: parseInt(countResult.rows[0].total),
                limit
            }
        });
    }
    catch (error) {
        console.error('Get pending requests error:', error);
        res.status(500).json({ message: 'Error getting pending requests' });
    }
};
exports.getPendingRequests = getPendingRequests;
const acceptMessageRequest = async (req, res) => {
    const userId = req.user?.id;
    const requestId = req.params.requestId;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!requestId) {
        return res.status(400).json({ message: 'Request ID is required' });
    }
    try {
        // İsteği getir ve kontrol et
        const requestResult = await database_1.default.query('SELECT * FROM message_requests WHERE id = $1 AND receiver_id = $2', [requestId, userId]);
        if (requestResult.rows.length === 0) {
            return res.status(404).json({ message: 'Message request not found' });
        }
        const messageRequest = requestResult.rows[0];
        if (messageRequest.status !== 'pending') {
            return res.status(400).json({
                message: `Message request is already ${messageRequest.status}`,
                request: { ...messageRequest }
            });
        }
        // Her iki kullanıcının da başka bir aktif sohbeti olup olmadığını kontrol et
        const senderId = messageRequest.sender_id;
        const receiverId = userId;
        const activeChatResult = await database_1.default.query("SELECT user1_id, user2_id FROM chats WHERE (user1_id = $1 OR user2_id = $1 OR user1_id = $2 OR user2_id = $2) AND status = 'active'", [senderId, receiverId]);
        if (activeChatResult.rows.length > 0) {
            const activeChat = activeChatResult.rows[0];
            const busyUserId = [activeChat.user1_id, activeChat.user2_id].find(id => id === senderId || id === receiverId);
            if (busyUserId === receiverId) {
                return res.status(403).json({ message: 'You are already in an active chat. You cannot accept a new message request.' });
            }
            else {
                return res.status(403).json({ message: 'The other user is in another chat. You cannot accept this request at this time.' });
            }
        }
        // Transaction başlat
        const client = await database_1.default.connect();
        try {
            await client.query('BEGIN');
            // İsteği kabul et
            await client.query('UPDATE message_requests SET status = $1 WHERE id = $2', ['accepted', requestId]);
            // Chat room oluştur (7 gün süreyle)
            const chatRoomId = (0, uuid_1.v4)();
            const chatRoomResult = await client.query(`
        INSERT INTO chats (id, user1_id, user2_id, expires_at, status)
        VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', 'active')
        RETURNING *
      `, [chatRoomId, messageRequest.sender_id, userId]);
            const chatRoom = chatRoomResult.rows[0];
            await client.query('COMMIT');
            // Sender'a bildirim gönder
            const receiverResult = await database_1.default.query('SELECT first_name, last_name FROM users WHERE id = $1', [userId]);
            if (receiverResult.rows.length === 0) {
                // Bu durum, kimliği doğrulanmış bir kullanıcı için beklenmez, ancak bir güvenlik önlemidir.
                // İşlem zaten yapıldığı için hata günlüğe kaydedilir, ancak devam edilir.
                console.error(`Accept message request error: Receiver with ID ${userId} not found after transaction commit.`);
                // Yine de başarılı bir yanıt gönderiyoruz çünkü sohbet odası oluşturuldu.
                // Bildirim gönderilemedi.
                const safeChatRoomOnError = {
                    id: chatRoom.id,
                    user1_id: chatRoom.user1_id,
                    user2_id: chatRoom.user2_id,
                    created_at: chatRoom.created_at,
                    expires_at: chatRoom.expires_at,
                    status: chatRoom.status
                };
                return res.status(200).json({
                    message: 'Message request accepted, but failed to send notification.',
                    chat_room: safeChatRoomOnError
                });
            }
            const receiver = receiverResult.rows[0];
            await (0, notificationService_1.createNotificationSafe)({
                user_id: messageRequest.sender_id,
                type: 'message_received',
                title: 'Mesaj İsteğiniz Kabul Edildi',
                message: `${receiver.first_name} ${receiver.last_name} mesaj isteğinizi kabul etti. Artık mesajlaşabilirsiniz!`,
                data: {
                    room_id: chatRoom.id,
                    other_user_id: userId,
                    other_user_name: `${receiver.first_name} ${receiver.last_name}`
                }
            });
            const safeChatRoom = {
                id: chatRoom.id,
                user1_id: chatRoom.user1_id,
                user2_id: chatRoom.user2_id,
                created_at: chatRoom.created_at,
                expires_at: chatRoom.expires_at,
                status: chatRoom.status
            };
            res.status(200).json({
                message: 'Message request accepted successfully',
                chat_room: safeChatRoom
            });
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Accept message request error:', error);
        console.error('Full error details:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            requestId: requestId,
            userId: userId
        });
        res.status(500).json({ message: 'Error accepting message request' });
    }
};
exports.acceptMessageRequest = acceptMessageRequest;
const rejectMessageRequest = async (req, res) => {
    const userId = req.user?.id;
    const requestId = req.params.requestId;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!requestId) {
        return res.status(400).json({ message: 'Request ID is required' });
    }
    try {
        // İsteği getir ve kontrol et
        const requestResult = await database_1.default.query('SELECT * FROM message_requests WHERE id = $1 AND receiver_id = $2', [requestId, userId]);
        if (requestResult.rows.length === 0) {
            return res.status(404).json({ message: 'Message request not found' });
        }
        const messageRequest = requestResult.rows[0];
        if (messageRequest.status !== 'pending') {
            return res.status(400).json({
                message: `Message request is already ${messageRequest.status}`,
                request: { ...messageRequest }
            });
        }
        // İsteği reddet
        await database_1.default.query('UPDATE message_requests SET status = $1 WHERE id = $2', ['rejected', requestId]);
        res.status(200).json({
            message: 'Message request rejected successfully'
        });
    }
    catch (error) {
        console.error('Reject message request error:', error);
        res.status(500).json({ message: 'Error rejecting message request' });
    }
};
exports.rejectMessageRequest = rejectMessageRequest;
const cancelMessageRequest = async (req, res) => {
    const userId = req.user?.id;
    const requestId = req.params.requestId;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!requestId) {
        return res.status(400).json({ message: 'Request ID is required' });
    }
    try {
        // İsteği getir ve kontrol et (sadece gönderen iptal edebilir)
        const requestResult = await database_1.default.query('SELECT * FROM message_requests WHERE id = $1 AND sender_id = $2', [requestId, userId]);
        if (requestResult.rows.length === 0) {
            return res.status(404).json({ message: 'Message request not found or you are not authorized to cancel it' });
        }
        const messageRequest = requestResult.rows[0];
        if (messageRequest.status !== 'pending') {
            return res.status(400).json({
                message: `Cannot cancel request. Status is already ${messageRequest.status}`,
                request: { ...messageRequest }
            });
        }
        // İsteği sil
        await database_1.default.query('DELETE FROM message_requests WHERE id = $1', [requestId]);
        res.status(200).json({
            message: 'Message request cancelled successfully'
        });
    }
    catch (error) {
        console.error('Cancel message request error:', error);
        res.status(500).json({ message: 'Error cancelling message request' });
    }
};
exports.cancelMessageRequest = cancelMessageRequest;
