import { ArrayUnique, IsArray, IsInt } from 'class-validator';

export class UpdateAvailabilitiesDto {
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  dateIds!: number[];
}
