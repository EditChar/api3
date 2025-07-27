-- Chat Media System Migration - Optimized
-- Run: psql -d your_db_name -f database_migration_chat_media.sql

-- Create chat_media table for encrypted photo sharing
CREATE TABLE IF NOT EXISTS chat_media (
    id SERIAL PRIMARY KEY,
    media_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_room_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    
    -- File metadata
    original_filename VARCHAR(500),
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    
    -- S3 storage
    s3_key VARCHAR(1000) NOT NULL,
    urls JSONB, -- Stores S3 keys for different sizes: {"thumbnail": "key1", "medium": "key2", "original": "key3"}
    
    -- Encryption
    encryption_iv VARCHAR(64) NOT NULL, -- 32 bytes hex = 64 chars
    auth_tag VARCHAR(64), -- 32 bytes hex = 64 chars
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'uploading' CHECK (status IN ('uploading', 'completed', 'failed', 'deleted')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    
    -- Optional metadata
    metadata JSONB DEFAULT '{}'
);

-- Essential indexes only
CREATE INDEX idx_chat_media_user_id ON chat_media(user_id);
CREATE INDEX idx_chat_media_chat_room_id ON chat_media(chat_room_id);
CREATE INDEX idx_chat_media_status_expires ON chat_media(status, expires_at) WHERE status != 'deleted';
CREATE INDEX idx_chat_media_cleanup ON chat_media(expires_at, status) WHERE status IN ('completed', 'uploading', 'failed');

-- Update existing messages table to support media_id (if not exists)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_id UUID REFERENCES chat_media(media_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_messages_media_id ON messages(media_id) WHERE media_id IS NOT NULL;

-- Auto-cleanup function (simplified)
CREATE OR REPLACE FUNCTION cleanup_expired_chat_media()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Mark expired media as deleted
    UPDATE chat_media 
    SET status = 'deleted', 
        deleted_at = NOW()
    WHERE expires_at <= NOW() 
      AND status IN ('completed', 'uploading', 'failed');
      
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log cleanup (optional)
    IF deleted_count > 0 THEN
        INSERT INTO notifications (user_id, type, title, message, created_at)
        SELECT 1, 'system', 'Media Cleanup', 
               'Cleaned up ' || deleted_count || ' expired media files', NOW()
        WHERE EXISTS (SELECT 1 FROM users WHERE id = 1); -- Only if admin user exists
    END IF;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
DO $$
BEGIN
    -- Check if a database user exists (replace 'your_app_user' with actual username)
    IF EXISTS (SELECT 1 FROM pg_user WHERE usename = 'postgres') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON chat_media TO postgres;
        GRANT USAGE ON SEQUENCE chat_media_id_seq TO postgres;
    END IF;
END $$; 