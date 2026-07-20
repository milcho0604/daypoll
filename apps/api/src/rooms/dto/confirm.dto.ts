import { IsInt, Min } from 'class-validator';

export class ConfirmDto {
  // 확정할 후보 날짜 id. 서비스에서 이 방의 후보인지 다시 검증한다.
  @IsInt()
  @Min(1)
  dateId!: number;
}
