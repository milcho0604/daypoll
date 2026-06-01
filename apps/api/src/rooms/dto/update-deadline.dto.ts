import { IsISO8601, ValidateIf } from 'class-validator';

export class UpdateDeadlineDto {
  // null = 무기한 해제
  @ValidateIf((_o, v) => v !== null)
  @IsISO8601({ strict: true })
  deadline!: string | null;
}
