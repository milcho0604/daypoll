-- 공지 팝업 — "한 번만 보여주기" + 버튼 링크.
--
-- show_once: true 면 사용자가 한 번 보면(어떻게 닫든) 그 기기에서 다시 안 뜬다.
--            새 기능 안내처럼 반복할 필요 없는 공지용. 점검 공지는 false(기존 동작:
--            "다시 보지 않기" 를 눌러야 안 뜸).
-- link_url : 팝업 버튼이 가는 곳 — 우리 사이트 안 경로만 ("/updates" 등).
--            외부·프로토콜 상대(//evil) 링크로 사용자를 보내지 못하게 CHECK 로도 막는다.
-- link_label: 버튼 문구 (없으면 프론트가 "자세히 보기").
--
-- notices 는 수십 행 이하라 ADD COLUMN(기본값 상수)도 즉시 끝난다.
SET LOCAL lock_timeout = '5s';

ALTER TABLE notices
  ADD COLUMN IF NOT EXISTS show_once BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE notices
  ADD COLUMN IF NOT EXISTS link_url TEXT NULL;
ALTER TABLE notices
  ADD COLUMN IF NOT EXISTS link_label TEXT NULL;

ALTER TABLE notices DROP CONSTRAINT IF EXISTS notices_link_url_chk;
ALTER TABLE notices
  ADD CONSTRAINT notices_link_url_chk CHECK (
    link_url IS NULL
    OR (char_length(link_url) <= 200 AND link_url ~ '^/[^/\\]')
    OR link_url = '/'
  );
ALTER TABLE notices DROP CONSTRAINT IF EXISTS notices_link_label_chk;
ALTER TABLE notices
  ADD CONSTRAINT notices_link_label_chk CHECK (
    link_label IS NULL OR char_length(link_label) BETWEEN 1 AND 20
  );
