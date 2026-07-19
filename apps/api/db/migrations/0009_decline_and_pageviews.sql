-- 0009_decline_and_pageviews.sql
--
-- (1) 사람 단위 "불참" — 이번 모임에 아예 참석 못 하는 사람.
--     0007 의 날짜별 status='no'(이 날 못 감)는 제품 방향을 바꿔 프론트에서 걷어낸다.
--     status 컬럼 자체는 롤링 배포 중 구 컨테이너가 참조할 수 있어 남겨둔다(전부 'yes').
--     불참은 날짜가 아니라 사람에게 붙는 플래그다.
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS declined BOOLEAN NOT NULL DEFAULT false;

-- (2) 어드민 방문 집계 — 이용 고객(방 참여자)이 아니라 "그냥 접속한 방문"까지 본다.
--     개인정보(IP·식별자) 저장 없음. 날짜×경로별 집계 카운트만.
CREATE TABLE IF NOT EXISTS page_views (
    day   DATE NOT NULL,
    path  TEXT NOT NULL,
    count BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (day, path)
);
