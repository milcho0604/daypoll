import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  PLACE_MEMO_MAX,
  PLACE_NAME_MAX,
  PLACE_URL_MAX,
} from '@whenever/shared';

// 앞뒤 공백 정리 + 줄바꿈·탭을 한 칸으로 (이름·메모는 한 줄 텍스트).
const oneLine = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value;
// 선택 필드: 빈 문자열은 "없음" — 폼이 빈 칸을 '' 로 보내도 null 로 저장.
const optTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
const optOneLine = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() || null : value;

// 보이지 않는 제어문자·방향 제어 문자 금지 (이름으로 화면을 흐트러뜨리는 것 방지).
const NO_CONTROL = /^[^\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]*$/;

export class AddPlaceDto {
  @Transform(oneLine)
  @IsString()
  @Length(1, PLACE_NAME_MAX)
  @Matches(NO_CONTROL, { message: 'name has invalid characters' })
  name!: string;

  // 형식 검증(스킴·userinfo 등)은 서비스의 normalizePlaceUrl 이 한다.
  @Transform(optTrim)
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(PLACE_URL_MAX)
  url?: string | null;

  @Transform(optOneLine)
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @Length(1, PLACE_MEMO_MAX)
  @Matches(NO_CONTROL, { message: 'memo has invalid characters' })
  memo?: string | null;
}

export class ConfirmPlaceDto {
  @IsInt()
  @Min(1)
  placeId!: number;
}
