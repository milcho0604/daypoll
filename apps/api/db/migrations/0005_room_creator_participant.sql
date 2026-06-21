-- 0005_room_creator_participant.sql
-- 방 만든 사람이 다른 기기에서도 PIN 으로 방 통제 (방 종료 / 마감일 수정 / 강퇴) 가능하게.
-- 첫 입장 시 client_token + creator_token 매칭되면 creator_participant_id 에 link.
-- 다른 기기 PIN 복원 시 그 participant 의 id 가 link 되어 있으면 creator_token 도 같이 반환.

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS creator_participant_id BIGINT;
