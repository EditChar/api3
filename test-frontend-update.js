// Frontend Chat List Update Tester
const io = require('socket.io-client');

const socket = io('http://localhost:3001', {
  auth: {
    token: 'test-token',
  },
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('✅ Frontend tester connected to Socket.IO');
  
  // Chat list update event'ini dinle
  socket.on('chat_list_update', (data) => {
    console.log('📋 [Frontend Test] Chat list update received:', data);
  });
  
  // 3 saniye sonra test mesajı gönder
  setTimeout(() => {
    console.log('🚀 Sending test chat list update...');
    socket.emit('test_chat_list_update', {
      roomId: 'test-room-123',
      last_message: 'Test mesajı frontend için',
      last_message_at: new Date().toISOString(),
      message_type: 'text',
      sender_id: 999
    });
  }, 3000);
  
  // 10 saniye sonra kapat
  setTimeout(() => {
    console.log('🔴 Disconnecting...');
    socket.disconnect();
    process.exit(0);
  }, 10000);
});

socket.on('disconnect', () => {
  console.log('❌ Frontend tester disconnected');
});

socket.on('connect_error', (error) => {
  console.error('🔥 Connection error:', error);
}); 