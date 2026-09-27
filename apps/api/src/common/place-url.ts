import { BadRequestException } from '@nestjs/common';
import { PLACE_URL_MAX } from '@whenever/shared';

// 제어문자(C0/C1) + 공백 + 방향 제어/폭 없는 문자. 링크 안에 숨어 있으면
// 화면에 보이는 주소와 실제 이동 주소가 달라지는 위장에 쓰인다.
// (앞뒤 공백은 trim 으로 이미 걷어낸 뒤라, 남은 공백은 URL 한가운데에 있는 것)
// 제어문자를 막는 게 목적이라 정규식에 제어문자 범위가 들어가는 건 의도다.
const FORBIDDEN_CHARS =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0020\u007F-\u009F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/;

// 장소 링크 정규화 — 저장 전에 서버가 한 번 파싱해 "진짜 http(s) 링크" 만 남긴다.
// 서버는 이 링크로 요청을 보내지 않는다(SSRF 없음). 목적은 렌더 시 javascript:,
// data:, 사용자정보(@) 위장 링크가 친구들 화면에 박히는 걸 막는 것.
// 빈 값은 null (링크 없는 후보). 잘못된 값은 400.
export function normalizePlaceUrl(
  input: string | null | undefined,
): string | null {
  if (input == null) return null;
  const raw = input.trim();
  if (raw === '') return null;
  if (raw.length > PLACE_URL_MAX) {
    throw new BadRequestException('url too long');
  }
  if (FORBIDDEN_CHARS.test(raw)) {
    throw new BadRequestException('url has invalid characters');
  }
  let u: URL;
  try {
    u = new URL(raw); // base 없이 — 상대 경로·스킴 없는 문자열은 여기서 실패
  } catch {
    throw new BadRequestException('url is not valid');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new BadRequestException('url must be http or https');
  }
  // https://naver.me@evil.example → 실제 호스트는 evil.example. 거부.
  if (u.username !== '' || u.password !== '') {
    throw new BadRequestException('url must not contain credentials');
  }
  if (u.hostname === '') {
    throw new BadRequestException('url is not valid');
  }
  // 정규화(호스트 소문자·punycode) 후 길이가 늘 수 있어 한 번 더.
  const href = u.href;
  if (href.length > PLACE_URL_MAX) {
    throw new BadRequestException('url too long');
  }
  return href;
}
