-- 0006_room_region.sql
-- 방에 선택적 지역(시·도 코드) 추가 — 후보날짜 날씨 표시용.
-- nullable: 기존 방·미지정 방은 NULL = 날씨 안 보임. 위치 권한 불필요(사용자가 드롭다운으로 선택).

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS region TEXT;
