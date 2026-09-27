// 장소 후보 입력 보조 — 지도 앱 "공유 → 복사" 텍스트에서 링크와 가게 이름을 뽑는다.
//
// 서버로 링크를 긁어오지 않는다(미리보기 fetch 없음).
// 규칙: 링크(http…)는 링크 칸으로, 나머지 글은 이름으로. "제목 + 링크" 를 한 칸에
// 붙여도 알아서 나눠져야 한다(사용자 요청 — 손으로 링크를 떼어내는 건 불편).
// 이름 후보에서 주소·전화·앱 안내 줄만 걸러낸다. 틀리면 사용자가 고치면 된다.
//
// 흔한 형식 (실기기 문자열은 바뀔 수 있어 fixture 로 계속 보강한다):
//   [네이버 지도]\n가게이름\n서울 중구 ...\nhttps://naver.me/xxxx
//   [카카오맵] 가게이름\n서울 중구 ...\nhttps://kko.to/xxxx
//   https://naver.me/xxxx            (URL 만)

export interface ParsedShare {
  url: string | null; // 링크가 정확히 하나일 때만
  urls: string[]; // 찾은 링크 전부 (여러 개면 사용자가 고른다)
  name: string | null;
}

const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;
// 문장 끝 구두점·닫는 괄호가 링크에 붙어 딸려오는 것 제거
const TRAILING = /[)\].,!?'"」』>]+$/;

const MARKER = /^\[\s*(네이버\s*지도|카카오\s*맵|naver\s*map|kakao\s*map|kakaomap)\s*\]\s*/i;

// 가게 이름이 아닌 줄 — 주소, 전화번호, 앱 안내.
const SIDO =
  /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|충청|전북|전남|전라|경북|경남|경상|제주)/;
const ROAD = /(로|길|동|읍|면|리)\s*\d/;
const PHONE = /^\+?[\d\s-]{8,}$/;
const PROMO = /(앱|다운로드|설치|에서\s*보기|지도에서|자세히\s*보기|바로가기)/;
// 줄 중간에서 시작하는 주소 (공백 뒤 시·도 + 공백) — 거기서부터 끝까지 버린다.
const SIDO_INLINE =
  /\s(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|충청|전북|전남|전라|경북|경남|경상|제주)(특별시|광역시|특별자치시|특별자치도|도|시)?\s.*$/;

export function parsePlaceShare(text: string): ParsedShare {
  const urls: string[] = [];
  for (const m of text.matchAll(URL_RE)) {
    const u = m[0].replace(TRAILING, '');
    if (!urls.includes(u)) urls.push(u);
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(URL_RE, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  let name: string | null = null;
  for (const raw of lines) {
    let l = raw.replace(MARKER, '').trim();
    // 한 줄 입력칸에 붙이면 줄바꿈이 공백으로 뭉개진다 — "가게 서울 중구 …" 에서
    // 주소가 시작되는 곳에서 자른다.
    l = l.replace(SIDO_INLINE, '').trim();
    // 링크를 떼고 남은 "이름 -", "이름:" 같은 꼬리 구분자 정리
    l = l.replace(/[\s\-–—:|·,]+$/, '').replace(/^[\s\-–—:|·,]+/, '').trim();
    if (!l) continue;
    if (SIDO.test(l) || ROAD.test(l) || PHONE.test(l) || PROMO.test(l)) continue;
    name = l.slice(0, 40).trim();
    break; // 첫 후보 줄만 — 아래쪽 줄은 주소·설명일 가능성이 크다
  }

  return { url: urls.length === 1 ? urls[0] : null, urls, name };
}

export interface Provider {
  label: string;
  kind: 'map' | 'link';
}

// 호스트 → 표시 라벨. 문자열 포함 검사가 아니라 파싱한 hostname 의 정확한 목록으로
// 판정한다 (naver.me.evil.example 같은 위장 방지). 단축 링크는 목적지를 모르므로
// "지도" 라고 단정하지 않는다.
const HOSTS: Record<string, Provider> = {
  'map.naver.com': { label: '네이버 지도', kind: 'map' },
  'm.map.naver.com': { label: '네이버 지도', kind: 'map' },
  'm.place.naver.com': { label: '네이버 플레이스', kind: 'map' },
  'pcmap.place.naver.com': { label: '네이버 플레이스', kind: 'map' },
  'naver.me': { label: '네이버', kind: 'link' },
  'map.kakao.com': { label: '카카오맵', kind: 'map' },
  'place.map.kakao.com': { label: '카카오맵', kind: 'map' },
  'm.map.kakao.com': { label: '카카오맵', kind: 'map' },
  'kko.to': { label: '카카오', kind: 'link' },
  'kko.kakao.com': { label: '카카오', kind: 'link' },
  'maps.google.com': { label: '구글 지도', kind: 'map' },
  'maps.app.goo.gl': { label: '구글 지도', kind: 'map' },
  'app.catchtable.co.kr': { label: '캐치테이블', kind: 'link' },
  'catchtable.co.kr': { label: '캐치테이블', kind: 'link' },
  'www.instagram.com': { label: '인스타그램', kind: 'link' },
  'instagram.com': { label: '인스타그램', kind: 'link' },
};

export function providerOf(url: string): Provider | null {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    host = u.hostname; // 브라우저가 소문자·punycode 로 정규화
  } catch {
    return null;
  }
  const hit = HOSTS[host];
  if (hit) return hit;
  // 모르는 호스트는 그대로(punycode) 보여준다 — 잘라서 정상 서비스처럼 보이게 하지 않는다.
  return { label: host.replace(/^www\./, ''), kind: 'link' };
}

// 렌더 직전 한 번 더 — 서버가 http(s) 만 저장하지만, 화면이 그 가정에 기대지 않게.
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

// 이름으로 지도 앱 검색 — 링크 없는 후보도 한 번에 지도를 열 수 있게,
// 그리고 입력 중에 "찾아서 공유 링크 복사" 동선을 열어준다. 네트워크 요청 없음(그냥 링크).
export function mapSearchLinks(name: string): { label: string; href: string }[] {
  const q = encodeURIComponent(name.trim());
  if (!q) return [];
  return [
    { label: '네이버 지도', href: `https://map.naver.com/p/search/${q}` },
    { label: '카카오맵', href: `https://map.kakao.com/?q=${q}` },
  ];
}
