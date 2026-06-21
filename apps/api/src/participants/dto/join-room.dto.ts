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

  // 방 만든 사람의 첫 입장 시 보내는 token. 이 토큰이 rooms.creator_token 과
  // 매칭되면 이 participant 를 방 주인으로 link (rooms.creator_participant_id).
  // 그 후 같은 PIN 으로 다른 기기 복원 시 creator_token 도 같이 반환된다.
  @IsOptional()
  @IsString()
  @Length(1, 200)
  creatorToken?: string;
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
