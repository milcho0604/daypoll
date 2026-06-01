import { IsString, Length } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  @Length(1, 20)
  nickname!: string;
}
