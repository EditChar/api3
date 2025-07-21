-- 📱 ENTERPRISE DEVICE TOKENS TABLE MIGRATION
-- This migration creates the device_tokens table required for multi-device FCM support.
-- Run this after deploying the enterprise notification system migration.

-- 1. Create table if it does not exist
CREATE TABLE IF NOT EXISTS device_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  device_token VARCHAR(255) NOT NULL,
  device_type VARCHAR(20) NOT NULL,
  device_info JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Ensure device_token is unique across all records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'device_tokens' AND constraint_name = 'device_tokens_device_token_key'
  ) THEN
    ALTER TABLE device_tokens
      ADD CONSTRAINT device_tokens_device_token_key UNIQUE (device_token);
  END IF;
END $$;

-- 3. Add helpful indexes for high-traffic queries
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active
  ON device_tokens (user_id, is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_device_tokens_updated_at
  ON device_tokens (updated_at DESC) WHERE is_active = TRUE;

-- Migration complete
RAISE NOTICE '✅ device_tokens table ready for enterprise multi-device support'; 