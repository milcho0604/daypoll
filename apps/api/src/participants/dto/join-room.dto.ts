import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class JoinRoomDto {
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
  @IsString()
  @Length(1, 20)
  nickname!: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'pin must be 4 digits' })
  pin!: string;
}
