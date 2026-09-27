import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

// 타임존 포함 ISO8601 만 허용 (끝에 Z 또는 ±HH:MM).
// @IsISO8601 는 "2026-07-20"·"2026-07-20T15:00:00"(타임존 없음)도 통과시켜,
// TIMESTAMPTZ 에 넣을 때 서버 타임존 해석에 의존하게 된다 → KST/UTC 의미가 흐려짐.
// 프론트는 항상 .toISOString()(Z) 로 보내므로 이 제약이 정상 흐름을 막지 않는다.
const ISO_WITH_TZ =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

// 공지 작성/수정 입력. published 는 별도 publish 엔드포인트로 토글.
export class AdminNoticeDto {
  @IsString()
  @Length(1, 120)
  title!: string;

  // 본문 — 줄바꿈 포함 평문. 상한을 둬 대형 페이로드 남용 방지.
  @IsString()
  @Length(1, 2000)
  body!: string;

  // 점검 예정 시각 (선택). null = 시각 미표시. 타임존 포함 ISO8601 만 허용.
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(ISO_WITH_TZ, {
    message:
      'scheduledAt must be an ISO8601 datetime with timezone (e.g. ...Z)',
  })
  scheduledAt?: string | null;

  // 한 번만 보여주기 (새 기능 안내용). 생략 = false.
  @IsOptional()
  @IsBoolean()
  showOnce?: boolean;

  // 버튼 링크 — 사이트 안 경로만. "//evil.example" 같은 프로토콜 상대 경로와
  // 역슬래시 트릭을 막는다. 빈 문자열 = 없음.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Length(1, 200)
  @Matches(/^\/(?![/\\])[A-Za-z0-9\-._~%/?=&#]*$/, {
    message: 'linkUrl must be a site path like /updates',
  })
  linkUrl?: string | null;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Length(1, 20)
  linkLabel?: string | null;
}

export class AdminPublishNoticeDto {
  @IsBoolean()
  published!: boolean;
}
