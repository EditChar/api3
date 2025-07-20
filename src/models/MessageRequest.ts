export interface MessageRequest {
  id: string; // DB'de character varying - UUID
  sender_id: number;
  receiver_id: number;
  status: 'pending' | 'accepted' | 'rejected';
  created_at?: Date;
  updated_at?: Date;
  
  // Uygulama tarafında kullanılan field (DB'de yok)
  initial_message?: string;
}

export interface MessageRequestWithUser extends MessageRequest {
  sender?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  receiver?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
} 