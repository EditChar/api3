-- Add initial_message to message_requests table
ALTER TABLE message_requests
ADD COLUMN IF NOT EXISTS initial_message TEXT;

COMMENT ON COLUMN message_requests.initial_message IS 'The initial message sent with the request.'; 