export interface Media {
  id: number;
  media_id: string; // UUID
  user_id: number;
  chat_room_id: string;
  
  // File metadata
  original_filename?: string;
  content_type: string;
  file_size: number;
  
  // S3 storage
  s3_key: string;
  urls?: {
    thumbnail?: string;
    medium?: string;
    original?: string;
  };
  
  // Encryption
  encryption_iv: string;
  auth_tag?: string;
  
  // Status tracking
  status: 'uploading' | 'completed' | 'failed' | 'deleted';
  
  // Timestamps
  created_at: Date;
  processed_at?: Date;
  deleted_at?: Date;
  expires_at: Date;
  
  // Metadata
  metadata?: { [key: string]: any };
}

export interface MediaUploadRequest {
  chatRoomId: string;
  contentType: string;
  fileSize: number;
  originalFilename?: string;
}

export interface MediaUploadResponse {
  success: boolean;
  mediaId?: string;
  uploadUrl?: string;
  fields?: { [key: string]: string }; // POST method için (backward compatibility)
  method?: 'POST' | 'PUT'; // Upload method
  contentType?: string; // PUT method için content type
  error?: string;
}

export interface MediaCompleteRequest {
  mediaId: string;
  eTag: string;
  fileSize: number;
}

export interface MediaCompleteResponse {
  success: boolean;
  mediaId?: string;
  urls?: {
    thumbnail: string;
    medium: string;
    original: string;
  };
  expiresAt?: Date;
  error?: string;
}

export interface MediaUrlsResponse {
  success: boolean;
  mediaId?: string;
  urls?: {
    thumbnail: string;
    medium: string;
    original: string;
  };
  expiresAt?: Date;
  error?: string;
}

export interface MediaDeleteResponse {
  success: boolean;
  error?: string;
} 