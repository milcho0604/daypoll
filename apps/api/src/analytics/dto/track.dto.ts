import { IsString, Length } from 'class-validator';

export class TrackDto {
  // 경로만 (쿼리·해시 제외). 서버에서 다시 정규화하므로 신뢰하지 않는다.
  @IsString()
  @Length(1, 200)
  path!: string;
}
