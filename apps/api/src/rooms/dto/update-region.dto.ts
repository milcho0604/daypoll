import { IsIn, ValidateIf } from 'class-validator';
import { REGION_CODES, type RegionCode } from '@whenever/shared';

export class UpdateRegionDto {
  // null = 지역 해제(날씨 끄기). 값이 있으면 허용된 시·도 코드여야 함.
  @ValidateIf((_o, v) => v !== null)
  @IsIn(REGION_CODES)
  region!: RegionCode | null;
}
