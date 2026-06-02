import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

export class UpdateAvailabilitiesDto {
  // 한 방의 후보 날짜는 최대 60개(CreateRoomDto와 동일)라 dateIds도 60개로 상한.
  // 대형 페이로드로 인한 자원 남용을 막는다.
  @IsArray()
  @ArrayMaxSize(60)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  dateIds!: number[];
}
