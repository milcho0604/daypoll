import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsDateString, IsISO8601, IsOptional, IsString, Length, ValidateIf } from 'class-validator';

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
}
