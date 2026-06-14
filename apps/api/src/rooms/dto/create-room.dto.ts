import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';

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
}
