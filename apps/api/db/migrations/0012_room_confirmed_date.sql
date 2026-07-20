-- 모임 확정: 방장이 후보 중 하나를 최종 날짜로 못박는다.
-- deadline(마감 시각)과는 별개 — 마감은 "언제까지 투표", 확정은 "이 날로 정함".
-- confirmed_date_id 가 NULL 이 아니면 확정된 방 → 투표/불참 잠금.
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS confirmed_date_id BIGINT
    REFERENCES room_dates(id) ON DELETE SET NULL;
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
