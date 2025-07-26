-- =====================================================
-- ENTERPRISE AVATAR SYSTEM MIGRATION
-- Migration for scalable, enterprise-grade avatar system
-- with deduplication, CDN, and cleanup features
-- =====================================================

-- Drop existing constraints and tables if they exist (in correct order)
DROP TABLE IF EXISTS avatar_cleanup_queue CASCADE;
DROP TABLE IF EXISTS avatar_files CASCADE;

-- Add avatar_id column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'users' AND column_name = 'avatar_id') THEN
        ALTER TABLE users ADD COLUMN avatar_id UUID;
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_avatar_id ON users(avatar_id);
    END IF;
END $$;

-- =====================================================
-- AVATAR FILES TABLE
-- Stores avatar file metadata with deduplication support
-- =====================================================
CREATE TABLE IF NOT EXISTS avatar_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash for deduplication
    file_size BIGINT NOT NULL, -- File size in bytes
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
    s3_key VARCHAR(500) NOT NULL, -- S3 object key
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_count INTEGER DEFAULT 1,
    
    -- Constraints
    CONSTRAINT chk_file_size_positive CHECK (file_size > 0),
    CONSTRAINT chk_access_count_positive CHECK (access_count >= 0),
    CONSTRAINT chk_valid_content_type CHECK (
        content_type IN ('image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp')
    )
);

-- Create indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_avatar_files_file_hash ON avatar_files(file_hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_avatar_files_user_id ON avatar_files(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_avatar_files_created_at ON avatar_files(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_avatar_files_last_accessed ON avatar_files(last_accessed_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_avatar_files_access_count ON avatar_files(access_count DESC);

-- =====================================================
-- AVATAR CLEANUP QUEUE TABLE
-- Manages background cleanup of orphaned avatar files
-- =====================================================
CREATE TABLE IF NOT EXISTS avatar_cleanup_queue (
    id SERIAL PRIMARY KEY,
    avatar_id UUID NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    last_error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_cleanup_status CHECK (
        status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')
    ),
    CONSTRAINT chk_retry_count_positive CHECK (retry_count >= 0),
    CONSTRAINT uq_avatar_cleanup_queue_avatar_id UNIQUE(avatar_id)
);

-- Create indexes for cleanup queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cleanup_queue_status_scheduled ON avatar_cleanup_queue(status, scheduled_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cleanup_queue_avatar_id ON avatar_cleanup_queue(avatar_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cleanup_queue_processed_at ON avatar_cleanup_queue(processed_at);

-- =====================================================
-- AVATAR ANALYTICS TABLE (Optional - for enterprise insights)
-- Tracks avatar usage patterns and optimization opportunities
-- =====================================================
CREATE TABLE IF NOT EXISTS avatar_analytics (
    id SERIAL PRIMARY KEY,
    date_bucket DATE NOT NULL DEFAULT CURRENT_DATE,
    total_uploads INTEGER DEFAULT 0,
    unique_uploads INTEGER DEFAULT 0, -- Non-duplicate uploads
    duplicate_uploads INTEGER DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    average_file_size BIGINT DEFAULT 0,
    most_common_size VARCHAR(20), -- thumbnail, small, medium, large, original
    total_bandwidth_saved BIGINT DEFAULT 0, -- Bytes saved through deduplication
    cleanup_processed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT uq_avatar_analytics_date UNIQUE(date_bucket)
);

-- Create indexes for analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_avatar_analytics_date ON avatar_analytics(date_bucket DESC);

-- =====================================================
-- TRIGGERS AND FUNCTIONS
-- =====================================================

-- Function to update analytics automatically
CREATE OR REPLACE FUNCTION update_avatar_analytics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update daily analytics when new avatar is uploaded
    INSERT INTO avatar_analytics (date_bucket, total_uploads, unique_uploads, total_size_bytes)
    VALUES (CURRENT_DATE, 1, 1, NEW.file_size)
    ON CONFLICT (date_bucket) 
    DO UPDATE SET
        total_uploads = avatar_analytics.total_uploads + 1,
        unique_uploads = avatar_analytics.unique_uploads + 1,
        total_size_bytes = avatar_analytics.total_size_bytes + NEW.file_size,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for analytics updates
DROP TRIGGER IF EXISTS trg_avatar_analytics_update ON avatar_files;
CREATE TRIGGER trg_avatar_analytics_update
    AFTER INSERT ON avatar_files
    FOR EACH ROW
    EXECUTE FUNCTION update_avatar_analytics();

-- Function to automatically cleanup old analytics (keep 1 year)
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS void AS $$
BEGIN
    DELETE FROM avatar_analytics 
    WHERE date_bucket < CURRENT_DATE - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- HELPER FUNCTIONS FOR ENTERPRISE FEATURES
-- =====================================================

-- Function to get avatar usage statistics
CREATE OR REPLACE FUNCTION get_avatar_system_stats()
RETURNS TABLE(
    total_avatars BIGINT,
    total_size_gb NUMERIC,
    average_size_kb NUMERIC,
    duplicate_count BIGINT,
    pending_cleanup BIGINT,
    bandwidth_saved_gb NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_avatars,
        ROUND((SUM(af.file_size) / 1024.0 / 1024.0 / 1024.0)::numeric, 2) as total_size_gb,
        ROUND((AVG(af.file_size) / 1024.0)::numeric, 2) as average_size_kb,
        (COUNT(*) - COUNT(DISTINCT af.file_hash)) as duplicate_count,
        (SELECT COUNT(*) FROM avatar_cleanup_queue WHERE status = 'pending') as pending_cleanup,
        COALESCE(SUM(aa.total_bandwidth_saved) / 1024.0 / 1024.0 / 1024.0, 0) as bandwidth_saved_gb
    FROM avatar_files af
    LEFT JOIN avatar_analytics aa ON aa.date_bucket >= CURRENT_DATE - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to find duplicate avatars
CREATE OR REPLACE FUNCTION find_duplicate_avatars()
RETURNS TABLE(
    file_hash VARCHAR(64),
    duplicate_count BIGINT,
    total_size_bytes BIGINT,
    first_uploaded_at TIMESTAMP WITH TIME ZONE,
    last_uploaded_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        af.file_hash,
        COUNT(*) as duplicate_count,
        SUM(af.file_size) as total_size_bytes,
        MIN(af.created_at) as first_uploaded_at,
        MAX(af.created_at) as last_uploaded_at
    FROM avatar_files af
    GROUP BY af.file_hash
    HAVING COUNT(*) > 1
    ORDER BY duplicate_count DESC, total_size_bytes DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to schedule avatar cleanup
CREATE OR REPLACE FUNCTION schedule_avatar_cleanup(avatar_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO avatar_cleanup_queue (avatar_id, scheduled_at, status)
    VALUES (avatar_uuid, NOW() + INTERVAL '1 hour', 'pending')
    ON CONFLICT (avatar_id) 
    DO UPDATE SET
        scheduled_at = NOW() + INTERVAL '1 hour',
        status = 'pending',
        retry_count = 0,
        last_error_message = NULL;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MIGRATION DATA (Optional)
-- Migrate existing avatar_url data to new system
-- =====================================================

-- Create a function to migrate existing avatars (if needed)
CREATE OR REPLACE FUNCTION migrate_existing_avatars()
RETURNS INTEGER AS $$
DECLARE
    migrated_count INTEGER := 0;
    user_record RECORD;
BEGIN
    -- This function can be called to migrate existing avatar_url data
    -- to the new enterprise avatar system if needed
    
    FOR user_record IN 
        SELECT id, avatar_url 
        FROM users 
        WHERE avatar_url IS NOT NULL 
        AND avatar_url != '' 
        AND avatar_id IS NULL
    LOOP
        -- Log the migration (implement as needed)
        RAISE NOTICE 'Would migrate avatar for user %: %', user_record.id, user_record.avatar_url;
        migrated_count := migrated_count + 1;
    END LOOP;
    
    RETURN migrated_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PERFORMANCE OPTIMIZATIONS
-- =====================================================

-- Create partial indexes for better query performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_avatar_files_active_users 
ON avatar_files(user_id, created_at DESC) 
WHERE created_at > NOW() - INTERVAL '1 year';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cleanup_queue_pending 
ON avatar_cleanup_queue(scheduled_at) 
WHERE status = 'pending';

-- =====================================================
-- SECURITY AND PERMISSIONS
-- =====================================================

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON avatar_files TO api_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON avatar_cleanup_queue TO api_user;
-- GRANT SELECT, INSERT, UPDATE ON avatar_analytics TO api_user;
-- GRANT USAGE, SELECT ON SEQUENCE avatar_cleanup_queue_id_seq TO api_user;
-- GRANT USAGE, SELECT ON SEQUENCE avatar_analytics_id_seq TO api_user;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE avatar_files IS 'Enterprise avatar file storage with deduplication support';
COMMENT ON COLUMN avatar_files.file_hash IS 'SHA-256 hash for deduplication - prevents storing same file multiple times';
COMMENT ON COLUMN avatar_files.s3_key IS 'S3 object key for CDN access';
COMMENT ON COLUMN avatar_files.access_count IS 'Number of times this avatar has been accessed';

COMMENT ON TABLE avatar_cleanup_queue IS 'Background job queue for cleaning up orphaned avatar files';
COMMENT ON COLUMN avatar_cleanup_queue.retry_count IS 'Number of cleanup retry attempts';

COMMENT ON TABLE avatar_analytics IS 'Daily analytics for avatar system performance monitoring';

COMMENT ON FUNCTION get_avatar_system_stats() IS 'Returns comprehensive statistics about the avatar system';
COMMENT ON FUNCTION find_duplicate_avatars() IS 'Identifies duplicate avatar files for optimization';
COMMENT ON FUNCTION schedule_avatar_cleanup(UUID) IS 'Schedules an avatar for background cleanup';

-- =====================================================
-- FINAL STATUS
-- =====================================================

SELECT 'Enterprise Avatar System Migration Completed Successfully!' as status,
       NOW() as completed_at,
       (SELECT COUNT(*) FROM avatar_files) as existing_avatar_files,
       (SELECT COUNT(*) FROM avatar_cleanup_queue) as cleanup_queue_items; 