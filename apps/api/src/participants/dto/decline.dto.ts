import { IsBoolean } from 'class-validator';

// 사람 단위 불참 토글. true = 이번 모임 참석 못 함.
export class DeclineDto {
  @IsBoolean()
  declined!: boolean;
}
