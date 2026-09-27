-- 장소·메뉴 투표 — 날짜 투표와 같은 방에서 "동시에" 진행한다.
--
-- room_places  = 후보 (이름 + 선택 링크/메모). 입장한 참여자 누구나 추가.
-- place_votes  = 승인투표 (여러 개 가능). 행 = 👍.
-- rooms.confirmed_place_id = 방장이 못박은 장소. 날짜 확정과 독립 —
--   날짜 확정은 장소 투표를 잠그지 않는다 (날짜 먼저, 장소는 계속).
--
-- 불참자(participants.declined)의 표는 지우지 않고 집계에서만 뺀다 →
-- 불참을 해제하면 원래 표가 돌아온다.
--
-- 러너가 파일 전체를 한 트랜잭션으로 감싼다. rooms ALTER 가 잠금을 오래
-- 기다려 방 조회를 막지 않게, 못 잡으면 바로 실패하고 다시 돌린다.
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS room_places (
    id         BIGSERIAL PRIMARY KEY,
    room_id    TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    -- 길이는 코드포인트 기준 상한. 공백만 있는 이름은 서버 DTO 가 trim 후 거부하고,
    -- 여기서도 한 번 더 막는다.
    name       TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
    url        TEXT NULL CHECK (url IS NULL OR char_length(url) BETWEEN 1 AND 500),
    memo       TEXT NULL CHECK (memo IS NULL OR char_length(memo) BETWEEN 1 AND 60),
    -- 등록자. 강퇴되면 NULL — 그 후보는 방장만 지울 수 있다.
    created_by BIGINT NULL REFERENCES participants(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_room_places_room ON room_places(room_id);
-- FK 역인덱스 — 참여자 삭제(강퇴/방 삭제) 때 SET NULL 대상 탐색이 풀스캔이 되지 않게.
-- (0014 에서 FK 역인덱스 누락으로 cleanup 이 19.5초 걸렸던 교훈)
CREATE INDEX IF NOT EXISTS idx_room_places_created_by
    ON room_places(created_by) WHERE created_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS place_votes (
    participant_id BIGINT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    place_id       BIGINT NOT NULL REFERENCES room_places(id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (participant_id, place_id)
);
-- PK 가 participant_id 선두라 후보 쪽(집계·후보 삭제 cascade)은 별도 인덱스.
CREATE INDEX IF NOT EXISTS idx_place_votes_place ON place_votes(place_id);

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS confirmed_place_id BIGINT
    REFERENCES room_places(id) ON DELETE SET NULL;
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS confirmed_place_at TIMESTAMPTZ;
-- 후보 삭제 시 FK 검사가 rooms 풀스캔이 되지 않게 (0014 와 같은 이유, 부분 인덱스).
CREATE INDEX IF NOT EXISTS idx_rooms_confirmed_place
  ON rooms(confirmed_place_id)
  WHERE confirmed_place_id IS NOT NULL;
