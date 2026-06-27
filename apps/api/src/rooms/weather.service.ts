import { Injectable, Logger } from '@nestjs/common';
import type { RegionCode, WeatherDay } from '@whenever/shared';
import { describeWeatherCode, REGION_COORDS } from '../common/regions';

// Open-Meteo 무료 예보 API (키 불필요). 일별 예보는 약 16일까지.
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const FORECAST_DAYS = 16;
const FETCH_TIMEOUT_MS = 4000;

interface DailyForecast {
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
  };
}

type RegionCache = { day: string; byDate: Map<string, WeatherDay> };

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  // 지역별 캐시 — KST 날짜가 바뀌면 무효화. 예보는 하루 한 번이면 충분하다.
  private readonly cache = new Map<RegionCode, RegionCache>();
  // 동시 요청이 같은 지역을 중복 fetch 하지 않게 진행 중 Promise 공유.
  private readonly inflight = new Map<RegionCode, Promise<RegionCache>>();

  // 후보날짜 중 예보 범위 안에 드는 날만 날씨를 채워 돌려준다.
  // 날씨는 부가 정보라 실패하면 조용히 빈 배열 (방 화면은 정상 동작).
  async forDates(region: RegionCode, dates: string[]): Promise<WeatherDay[]> {
    let entry: RegionCache;
    try {
      entry = await this.load(region);
    } catch (err) {
      this.logger.warn(`weather fetch failed for ${region}: ${String(err)}`);
      return [];
    }
    const seen = new Set<string>();
    const out: WeatherDay[] = [];
    for (const d of dates) {
      if (seen.has(d)) continue;
      seen.add(d);
      const w = entry.byDate.get(d);
      if (w) out.push(w);
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }

  private async load(region: RegionCode): Promise<RegionCache> {
    const today = this.kstToday();
    const cached = this.cache.get(region);
    if (cached && cached.day === today) return cached;

    const pending = this.inflight.get(region);
    if (pending) return pending;

    const p = this.fetchForecast(region, today)
      .then((entry) => {
        this.cache.set(region, entry);
        return entry;
      })
      .finally(() => {
        this.inflight.delete(region);
      });
    this.inflight.set(region, p);
    return p;
  }

  private async fetchForecast(
    region: RegionCode,
    today: string,
  ): Promise<RegionCache> {
    const coords = REGION_COORDS[region];
    const url =
      `${OPEN_METEO_URL}?latitude=${coords.lat}&longitude=${coords.lon}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&timezone=Asia%2FSeoul&forecast_days=${FORECAST_DAYS}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let json: DailyForecast;
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = (await res.json()) as DailyForecast;
    } finally {
      clearTimeout(timer);
    }

    const byDate = new Map<string, WeatherDay>();
    const daily = json.daily;
    const times = daily?.time ?? [];
    const codes = daily?.weather_code ?? [];
    const maxes = daily?.temperature_2m_max ?? [];
    const mins = daily?.temperature_2m_min ?? [];
    for (let i = 0; i < times.length; i++) {
      const code = codes[i] ?? 0;
      const { emoji, label } = describeWeatherCode(code);
      byDate.set(times[i], {
        date: times[i],
        code,
        emoji,
        label,
        tempMax: round(maxes[i]),
        tempMin: round(mins[i]),
      });
    }
    return { day: today, byDate };
  }

  // KST 기준 오늘 날짜 (YYYY-MM-DD). 캐시 무효화 키.
  private kstToday(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
    }).format(new Date());
  }
}

function round(n: number | null | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null;
}
