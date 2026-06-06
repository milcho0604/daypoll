import { IsISO8601, IsOptional, ValidateIf } from 'class-validator';

export class AdminUpdateDeadlineDto {
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsISO8601({ strict: true })
  deadline?: string | null;
}
