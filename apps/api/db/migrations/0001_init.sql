-- 0001_init.sql
-- 기획서 7장 데이터 모델 그대로

CREATE TABLE IF NOT EXISTS rooms (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    creator_token TEXT,
    deadline      TIMESTAMPTZ NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS room_dates (
    id        BIGSERIAL PRIMARY KEY,
    room_id   TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    the_date  DATE NOT NULL,
    UNIQUE (room_id, the_date)
);

CREATE TABLE IF NOT EXISTS participants (
    id           BIGSERIAL PRIMARY KEY,
    room_id      TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    nickname     TEXT NOT NULL,
    client_token TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (room_id, client_token)
);

CREATE TABLE IF NOT EXISTS availabilities (
    participant_id BIGINT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    room_date_id   BIGINT NOT NULL REFERENCES room_dates(id) ON DELETE CASCADE,
    PRIMARY KEY (participant_id, room_date_id)
);

CREATE INDEX IF NOT EXISTS idx_room_dates_room   ON room_dates(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_room ON participants(room_id);
CREATE INDEX IF NOT EXISTS idx_avail_date        ON availabilities(room_date_id);
