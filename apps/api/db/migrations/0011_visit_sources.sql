-- 0011_visit_sources.sql
--
-- 어드민 "유입 경로" 집계 — 방문이 어디서 왔는지(검색·SNS·직접)를 대략만 본다.
-- page_views(0009)와 같은 원칙: 개인정보 없음.
--   · 원본 referrer URL 은 저장하지 않는다 (쿼리스트링에 PII 가 섞일 수 있음).
--   · 서버가 referrer 를 coarse source 라벨(naver·google·kakao·direct·other…)로
--     분류한 뒤, 날짜×source별 카운트만 누적한다.
CREATE TABLE IF NOT EXISTS visit_sources (
    day    DATE NOT NULL,
    source TEXT NOT NULL,
    count  BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (day, source)
);
