-- Block System Migration
-- Kullanıcıların birbirini bloklaması için tablo

-- Blocked Users Tablosu
CREATE TABLE IF NOT EXISTS blocked_users (
  id SERIAL PRIMARY KEY,
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Aynı kullanıcının iki kez bloklanmasını engelle
  UNIQUE(blocker_id, blocked_id),
  
  -- Kullanıcının kendisini bloklamasını engelle
  CHECK (blocker_id != blocked_id)
);

-- Indexler (performans için)
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_pair ON blocked_users(blocker_id, blocked_id);

-- Chat room cleanup için function
CREATE OR REPLACE FUNCTION cleanup_expired_chat_rooms()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Süresi dolmuş chat room'ları güncelle
  UPDATE chats 
  SET status = 'expired' 
  WHERE expires_at <= NOW() 
    AND status = 'active';
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Block kontrolü için function
CREATE OR REPLACE FUNCTION is_user_blocked(blocker_user_id INTEGER, blocked_user_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM blocked_users 
    WHERE blocker_id = blocker_user_id 
      AND blocked_id = blocked_user_id
  );
END;
$$ LANGUAGE plpgsql;

-- Karşılıklı block kontrolü için function (A blocks B veya B blocks A)
CREATE OR REPLACE FUNCTION are_users_blocked(user1_id INTEGER, user2_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM blocked_users 
    WHERE (blocker_id = user1_id AND blocked_id = user2_id)
       OR (blocker_id = user2_id AND blocked_id = user1_id)
  );
END;
$$ LANGUAGE plpgsql;

-- Blocked users view (kolay erişim için)
CREATE OR REPLACE VIEW user_blocked_list AS
SELECT 
  bu.id,
  bu.blocker_id,
  bu.blocked_id,
  bu.created_at,
  u1.username as blocker_username,
  u1.first_name as blocker_first_name,
  u1.last_name as blocker_last_name,
  u2.username as blocked_username,
  u2.first_name as blocked_first_name,
  u2.last_name as blocked_last_name
FROM blocked_users bu
JOIN users u1 ON bu.blocker_id = u1.id
JOIN users u2 ON bu.blocked_id = u2.id;

COMMENT ON TABLE blocked_users IS 'Stores user blocking relationships';
COMMENT ON FUNCTION cleanup_expired_chat_rooms() IS 'Cleans up expired chat rooms and returns count';
COMMENT ON FUNCTION is_user_blocked(INTEGER, INTEGER) IS 'Check if user1 has blocked user2';
COMMENT ON FUNCTION are_users_blocked(INTEGER, INTEGER) IS 'Check if users have blocked each other (mutual check)'; 