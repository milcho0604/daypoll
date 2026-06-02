import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CleanupDto {
  // 기본 90일. 1~3650일 범위로 제한해 NaN/음수/비정상 입력 차단.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;
}
