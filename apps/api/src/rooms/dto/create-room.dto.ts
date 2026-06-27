import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';
import { REGION_CODES, type RegionCode } from '@whenever/shared';

export class CreateRoomDto {
  @IsString()
  @Length(1, 100)
  title!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ArrayUnique()
  @IsDateString({ strict: true }, { each: true })
  dates!: string[];

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsISO8601({ strict: true })
  deadline?: string | null;

  // 개설자 닉네임 (옵션). 방 화면에 "by 진솔" 같이 표시 — 친구 인식.
  @IsOptional()
  @IsString()
  @Length(1, 20)
  createdBy?: string;

  // 날씨용 지역 (옵션). 허용된 시·도 코드만. null/미지정 = 날씨 안 보임.
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsIn(REGION_CODES)
  region?: RegionCode | null;
}
