-- 0002_pin.sql
-- 다른 기기에서 같은 사람임을 복원하기 위한 선택적 PIN.
-- 4자리 PIN을 scrypt로 해시해 저장. nickname + pin 으로 client_token 재발급.

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS pin_hash TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_participants_room_nick
  ON participants(room_id, nickname);
