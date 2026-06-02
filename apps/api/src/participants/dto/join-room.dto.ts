import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class JoinRoomDto {
  @Transform(trim)
  @IsString()
  @Length(1, 20)
  nickname!: string;

  // 선택적 4자리 PIN. 다른 기기 복원 시 사용.
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'pin must be 4 digits' })
  pin?: string;
}

export class RecoverParticipantDto {
  @Transform(trim)
  @IsString()
  @Length(1, 20)
  nickname!: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'pin must be 4 digits' })
  pin!: string;
}
