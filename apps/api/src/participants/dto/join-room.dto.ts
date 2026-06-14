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
  // 닉네임은 충돌 시 (같은 방에 같은 PIN 가입자 여러 명) 만 사용 — 평소엔 PIN 만으로 복원.
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 20)
  nickname?: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'pin must be 4 digits' })
  pin!: string;
}
