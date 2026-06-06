-- 0003_admin_log_and_vote_ts.sql
-- 어드민 고도화:
--   1) availabilities 에 created_at 컬럼 — 일별 투표 추이 분석용
--   2) admin_actions 테이블 — 어드민이 한 작업 기록 (삭제·강퇴·마감수정·cleanup·login)

ALTER TABLE availabilities
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_avail_created ON availabilities(created_at);

CREATE TABLE IF NOT EXISTS admin_actions (
  id             BIGSERIAL PRIMARY KEY,
  action         TEXT NOT NULL,                                    -- 'delete_room' / 'kick_participant' / 'update_deadline' / 'cleanup' / 'login'
  room_id        TEXT REFERENCES rooms(id) ON DELETE SET NULL,     -- 방 삭제 후에도 로그는 남김
  participant_id BIGINT,                                           -- FK 안 둠 (참여자 빨리 사라질 수 있음)
  payload        JSONB,                                            -- 자유 형식: 삭제 시 title, kick 시 nickname, deadline 변경 전/후 등
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_room    ON admin_actions(room_id);
