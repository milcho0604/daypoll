import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class TrackDto {
  // 경로만 (쿼리·해시 제외). 서버에서 다시 정규화하므로 신뢰하지 않는다.
  @IsString()
  @Length(1, 200)
  path!: string;

  // document.referrer (선택). 서버가 coarse source 로 분류만 하고 원본은 저장 안 함.
  // 길이 상한만 두고 내용은 신뢰하지 않는다.
  @IsOptional()
  @IsString()
  @MaxLength(600)
  referrer?: string;

  // utm_source / ref 쿼리 힌트 (선택). 알려진 source 값만 인정, 그 외는 무시.
  @IsOptional()
  @IsString()
  @MaxLength(60)
  ref?: string;
}
