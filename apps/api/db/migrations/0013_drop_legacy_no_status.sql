-- 0013_drop_legacy_no_status.sql
-- PR #38 이 도입했던 날짜별 "못 가요"(status='no') 를 #46 에서 사람 단위
-- 불참(participants.declined)으로 방향 전환하면서 프론트/집계 코드는 status 를
-- 더 이상 읽지도 쓰지도 않는다. 그런데 #38 배포 기간에 찍힌 status='no' 행이
-- 남아 있으면 지금 집계(COUNT 무조건)에서 "가능" 표로 잘못 세어진다.
-- → 레거시 'no' 행을 제거해 데이터와 코드 의미를 일치시킨다.
-- (컬럼 자체는 0009 방침대로 남긴다 — 재도입 시 재사용.)

DELETE FROM availabilities WHERE status = 'no';
