-- Mesajlaşma sistemi için gerekli tablolar
-- Çalıştırma: psql -d your_db_name -f database_migration_chat.sql

-- 1. Mesaj istekleri tablosu
CREATE TABLE IF NOT EXISTS message_requests (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    initial_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_message_request UNIQUE(sender_id, receiver_id)
);

-- 2. Mevcut chats tablosunu 7 günlük süre özelliği için güncelle
-- (chats tablosu zaten mevcut, sadece yeni sütunları ekle)
ALTER TABLE chats ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days');
ALTER TABLE chats ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended_by_users', 'expired'));
ALTER TABLE chats ADD COLUMN IF NOT EXISTS ended_by_user1 BOOLEAN DEFAULT FALSE;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS ended_by_user2 BOOLEAN DEFAULT FALSE;

-- Mevcut kayıtlar için expires_at değerini ayarla
UPDATE chats 
SET expires_at = created_at + INTERVAL '7 days' 
WHERE expires_at IS NULL;

-- Mevcut kayıtlar için status değerini ayarla
UPDATE chats 
SET status = CASE 
    WHEN is_active = true THEN 'active'
    ELSE 'ended_by_users'
END
WHERE status IS NULL OR status = 'active';

-- expires_at için NOT NULL constraint ekle
ALTER TABLE chats ALTER COLUMN expires_at SET NOT NULL;

-- 3. Bildirimler tablosu
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('message_request', 'room_ending_soon', 'room_ended', 'message_received')),
    title VARCHAR(255),
    message TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- İndeksler (Performans için)
CREATE INDEX IF NOT EXISTS idx_message_requests_receiver ON message_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_message_requests_sender ON message_requests(sender_id, status);
CREATE INDEX IF NOT EXISTS idx_chats_user1_status ON chats(user1_id, status);
CREATE INDEX IF NOT EXISTS idx_chats_user2_status ON chats(user2_id, status);
CREATE INDEX IF NOT EXISTS idx_chats_expires_at ON chats(expires_at, status);
CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at);

-- Trigger: message_requests updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_message_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_message_requests_updated_at
    BEFORE UPDATE ON message_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_message_requests_updated_at();

-- Chat expires_at otomatik 7 gün ayarlama trigger'ı
CREATE OR REPLACE FUNCTION set_chat_expiry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expires_at IS NULL THEN
        NEW.expires_at = NEW.created_at + INTERVAL '7 days';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_chat_expiry
    BEFORE INSERT ON chats
    FOR EACH ROW
    EXECUTE FUNCTION set_chat_expiry();

-- Otomatik süresi dolan chat'leri işaretleme fonksiyonu
CREATE OR REPLACE FUNCTION mark_expired_chats()
RETURNS void AS $$
BEGIN
    UPDATE chats 
    SET status = 'expired', is_active = false
    WHERE expires_at <= NOW() 
      AND status = 'active';
END;
$$ language 'plpgsql';

-- Başlangıç için test verileri (opsiyonel)
-- INSERT INTO message_requests (sender_id, receiver_id, initial_message) VALUES (1, 2, 'Merhaba, tanışabilir miyiz?'); 