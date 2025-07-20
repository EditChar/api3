export interface ChatRoom {
  id: string; // DB'de UUID (character varying)
  user1_id: number;
  user2_id: number;
  last_message_id?: number;
  last_message_at?: Date;
  created_at?: Date;
  updated_at?: Date;
  is_active?: boolean; // Geriye uyumluluk için
  expires_at: Date; // 7 günlük süre için
  status: 'active' | 'ended_by_users' | 'expired';
  ended_by_user1?: boolean;
  ended_by_user2?: boolean;
}

// Genişletilmiş interface (uygulama için) - artık gerekli değil çünkü ChatRoom zaten tüm alanları içeriyor
export interface ExtendedChatRoom extends ChatRoom {
  // Tüm alanlar zaten ChatRoom'da mevcut
}

export interface ChatRoomWithUsers extends ExtendedChatRoom {
  user1?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  user2?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  other_user?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  last_message?: string;
  time_remaining?: number; // milliseconds
} 