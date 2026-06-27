import type { RegionCode } from '@whenever/shared';

// 시·도 대표 좌표 (도청/시청 소재지 기준). 날씨는 시·도 단위면 충분 — 동 단위 정밀도 불필요.
export const REGION_COORDS: Record<RegionCode, { lat: number; lon: number }> = {
  seoul: { lat: 37.5665, lon: 126.978 },
  busan: { lat: 35.1796, lon: 129.0756 },
  daegu: { lat: 35.8714, lon: 128.6014 },
  incheon: { lat: 37.4563, lon: 126.7052 },
  gwangju: { lat: 35.1595, lon: 126.8526 },
  daejeon: { lat: 36.3504, lon: 127.3845 },
  ulsan: { lat: 35.5384, lon: 129.3114 },
  sejong: { lat: 36.4801, lon: 127.289 },
  gyeonggi: { lat: 37.2636, lon: 127.0286 }, // 수원
  gangwon: { lat: 37.8813, lon: 127.7298 }, // 춘천
  chungbuk: { lat: 36.6424, lon: 127.489 }, // 청주
  chungnam: { lat: 36.8151, lon: 127.1139 }, // 천안
  jeonbuk: { lat: 35.8242, lon: 127.148 }, // 전주
  jeonnam: { lat: 34.8118, lon: 126.3922 }, // 목포
  gyeongbuk: { lat: 36.5684, lon: 128.7294 }, // 안동
  gyeongnam: { lat: 35.228, lon: 128.6811 }, // 창원
  jeju: { lat: 33.4996, lon: 126.5312 },
};

// WMO weather code → 한국어 요약 + 이모지. Open-Meteo daily.weather_code 가 이 코드를 준다.
// https://open-meteo.com/en/docs (WMO Weather interpretation codes)
export function describeWeatherCode(code: number): {
  emoji: string;
  label: string;
} {
  if (code === 0) return { emoji: '☀️', label: '맑음' };
  if (code === 1) return { emoji: '🌤️', label: '대체로 맑음' };
  if (code === 2) return { emoji: '⛅', label: '구름 조금' };
  if (code === 3) return { emoji: '☁️', label: '흐림' };
  if (code === 45 || code === 48) return { emoji: '🌫️', label: '안개' };
  if (code >= 51 && code <= 57) return { emoji: '🌦️', label: '이슬비' };
  if (code >= 61 && code <= 67) return { emoji: '🌧️', label: '비' };
  if (code >= 71 && code <= 77) return { emoji: '❄️', label: '눈' };
  if (code >= 80 && code <= 82) return { emoji: '🌧️', label: '소나기' };
  if (code === 85 || code === 86) return { emoji: '🌨️', label: '눈' };
  if (code === 95) return { emoji: '⛈️', label: '천둥번개' };
  if (code === 96 || code === 99)
    return { emoji: '⛈️', label: '우박 동반 뇌우' };
  return { emoji: '🌡️', label: '예보' };
}
