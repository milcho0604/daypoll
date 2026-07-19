-- 불참(declined)에 시각을 남겨 어드민 활동 피드에 "언제 불참했는지"를 표시한다.
-- declined 플래그(0009)는 boolean 뿐이라 시간순 피드에 끼워 넣을 수 없었다.
-- nullable — 참여자/미응답자는 NULL, 불참 처리 순간에만 채운다.
ALTER TABLE participants ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;

-- 이미 불참 상태인 기존 행은 근사치로 가입 시각을 채워 피드에서 누락되지 않게 한다.
UPDATE participants
   SET declined_at = created_at
 WHERE declined = true AND declined_at IS NULL;
