import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
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

  // 불가능한 날짜. optional 이라 이 필드를 모르는 옛 클라이언트도 그대로 통과한다
  // (미전송 = 불가능 없음). 미정은 두 배열 어디에도 없는 날짜.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  unavailableDateIds?: number[];
}
