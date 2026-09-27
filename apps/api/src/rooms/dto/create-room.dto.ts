import { Type } from 'class-transformer';
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
  ValidateNested,
} from 'class-validator';
import {
  PLACES_PER_ROOM_MAX,
  REGION_CODES,
  type RegionCode,
} from '@whenever/shared';
import { AddPlaceDto } from './place.dto';

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

  // 장소 후보 미리 넣기 (옵션). 첫 공유 전에 넣어두면 친구들이 첫 방문에
  // 날짜·장소를 한 번에 고른다. 등록자는 없음(방장만 수정·삭제).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PLACES_PER_ROOM_MAX)
  @ValidateNested({ each: true })
  @Type(() => AddPlaceDto)
  places?: AddPlaceDto[];
}
