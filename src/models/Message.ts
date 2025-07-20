export interface Message {
  id: number; // DB'de integer
  chat_id: string; // DB'deki chat_id alanı
  sender_id: number;
  content: string; // DB'de content olarak kayıtlı
  message_type: 'text' | 'image';
  image_url?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

// Socket.IO için kullanılan interface (eski Message interface)
export interface SocketMessage {
  id: string;
  sender_id: number;
  message: string;
  message_type: 'text' | 'image';
  image_url?: string | null;
  timestamp: number;
}

export interface MessageWithSender extends Message {
  sender?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
}

export interface SendMessageRequest {
  roomId: number;
  message: string;
  messageType: 'text' | 'image';
  imageUrl?: string;
}

 