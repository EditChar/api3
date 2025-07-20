export interface Notification {
  id?: number;
  user_id: number;
  type: 'message_request' | 'room_ending_soon' | 'room_ended' | 'message_received';
  title: string;
  message: string;
  data?: any; // JSONB data
  is_read: boolean;
  created_at?: Date;
}

export interface NotificationData {
  // Message request notification data
  message_request_id?: number;
  sender_id?: number;
  sender_name?: string;
  
  // Room notification data
  room_id?: number;
  other_user_id?: number;
  other_user_name?: string;
  hours_remaining?: number;
  
  // Message notification data
  message_id?: string;
  message_preview?: string;
}

export interface CreateNotificationRequest {
  user_id: number;
  type: Notification['type'];
  title: string;
  message: string;
  data?: NotificationData;
} 