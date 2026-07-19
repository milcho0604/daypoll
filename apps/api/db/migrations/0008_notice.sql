-- 0008_notice.sql
-- 메인 화면 공지 팝업 — 어드민이 작성/게시.
--
-- 번호 주의: 0007 은 진행 중인 PR(투표 "못 가요", 0007_availability_status.sql)이
-- 선점 중이라 충돌을 피해 0008 로 둔다. notice 는 다른 테이블과 독립적이라
-- 적용 순서는 무관하다. migrate.mjs 는 파일명 정렬로 미적용분만 적용하므로
-- 두 브랜치가 각각 머지돼도 문제없다.
--
-- 모델: 다중 행. "현재 공지" = published=true 중 가장 최근(created_at DESC) 1건.
-- 새 공지를 게시하면 새 id 가 생기고, 프론트의 "다시 보지 않기"(id 별 localStorage)가
-- 자동으로 초기화된 것처럼 동작한다(예전 공지 id 를 dismiss 했어도 새 id 는 다시 뜸).

CREATE TABLE IF NOT EXISTS notices (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title        TEXT NOT NULL,
    body         TEXT NOT NULL,
    -- 팝업에 표시할 "점검/업데이트 예정 시각" (선택). 표시용이며 자동 동작 트리거는 아님.
    scheduled_at TIMESTAMPTZ,
    published    BOOLEAN NOT NULL DEFAULT false,
    -- "현재 공지"는 published_at 이 가장 최근인 게시본. created_at 이 아니라
    -- published_at 기준이라야, 오래전 만든 초안을 지금 게시해도 그게 노출된다.
    published_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 게시 상태면 published_at 이 반드시 있어야 한다 (정렬 기준이 published_at 이라
    -- NULL 이면 조회에서 뒤로 밀림). API 경로는 항상 채우지만 수동 UPDATE 도 방어.
    CONSTRAINT notices_published_at_chk CHECK (NOT published OR published_at IS NOT NULL)
);

-- 공개 GET /notice 가 "게시된 것 중 published_at 최신"을 자주 조회하므로 부분 인덱스.
CREATE INDEX IF NOT EXISTS idx_notices_published
    ON notices(published_at DESC) WHERE published;
