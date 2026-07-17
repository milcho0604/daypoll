-- 0007_availability_status.sql
-- 투표에 "불가능" 상태 추가.
--
-- 이전: 행이 있으면 가능, 없으면 끝 → "못 옴"과 "아직 답 안 함"이 구분 불가.
-- 이후: 3상태
--   가능   = 행 있음 + status='yes'
--   불가능 = 행 있음 + status='no'
--   미정   = 행 없음
--
-- DEFAULT 'yes' 라서 기존 행은 전부 '가능'으로 승격 = 하위호환.
-- nullable 아닌 대신 default 가 있어 백필 불필요 → 무중단 적용.

ALTER TABLE availabilities
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'yes';

-- 오타/미래의 잘못된 값 차단. 값이 늘면(예: 'maybe') 이 제약을 갱신할 것.
ALTER TABLE availabilities
  DROP CONSTRAINT IF EXISTS availabilities_status_check;
ALTER TABLE availabilities
  ADD CONSTRAINT availabilities_status_check CHECK (status IN ('yes', 'no'));

-- 집계가 (room_date_id, status) 로 FILTER 하므로 복합 인덱스가 커버.
CREATE INDEX IF NOT EXISTS idx_avail_date_status ON availabilities(room_date_id, status);
