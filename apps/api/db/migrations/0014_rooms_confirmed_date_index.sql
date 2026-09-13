-- rooms.confirmed_date_id → room_dates(id) FK 의 역방향 인덱스.
--
-- room_dates 한 행을 지울 때마다 PG 가 "이 날짜를 확정한 방이 있나" 를
-- rooms 에서 찾는데(rooms_confirmed_date_id_fkey 트리거), 인덱스가 없으면
-- 매번 rooms 전체를 훑는다. 방 삭제 = 날짜 수만큼 rooms 풀스캔.
-- 1000배 규모 실측: cleanup 이 방 730개 지우는 데 19.5초 → 0.15초.
--
-- 부분 인덱스 — 확정된 방만 (대부분 NULL). `confirmed_date_id = $1` 조건은
-- NOT NULL 을 함의하므로 FK 검사 쿼리도 이 인덱스를 탄다 (EXPLAIN 으로 확인).
-- 마이그레이션이 트랜잭션 안이라 CONCURRENTLY 는 못 쓰지만, rooms 는
-- 수십 행이라 락 시간은 ms 단위.
CREATE INDEX IF NOT EXISTS idx_rooms_confirmed_date
  ON rooms(confirmed_date_id)
  WHERE confirmed_date_id IS NOT NULL;
