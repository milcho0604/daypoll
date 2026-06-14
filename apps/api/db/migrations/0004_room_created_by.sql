-- 0004_room_created_by.sql
-- 방 화면에 "by 진솔" 같이 개설자 표시 — 친구가 단톡방에서 받은 링크 누가 만든 건지 인식.
-- nullable: 옛 방 + 익명 생성도 그대로 동작.

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS created_by TEXT;
