import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { closeTestPool, resetDb } from './setup';

const ADMIN = process.env.ADMIN_TOKEN ?? 'test-admin-token-32-chars-XXXXXX';

// CORS_ORIGIN 은 setup.ts 에서 http://localhost:3000 — 우리 도메인(internal) 판별용.
describe('유입 경로(visit sources) e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = ref.createNestApplication();
    app.enableShutdownHooks();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await app.close();
    await closeTestPool();
  });

  const server = () => app.getHttpServer();
  const withAdmin = (req: request.Test) => req.set('x-admin-token', ADMIN);
  const track = (body: Record<string, unknown>) =>
    request(server()).post('/track').send(body);
  const sources = async () => {
    const r = await withAdmin(request(server()).get('/admin/visits/detail'));
    expect(r.status).toBe(200);
    return Object.fromEntries(
      (
        r.body.sources as {
          source: string;
          today: number;
          allTime: number;
        }[]
      ).map((s) => [s.source, s]),
    );
  };

  it('POST /track 은 인증 없이 되고, referrer 를 coarse source 로 분류한다', async () => {
    await track({ path: '/', referrer: 'https://www.naver.com/' }).expect(201);
    await track({
      path: '/',
      referrer: 'https://search.naver.com/search?q=%EB%AA%A8%EC%9E%84', // 쿼리 PII 포함
    }).expect(201);
    await track({ path: '/', referrer: 'https://www.google.com/' }).expect(201);
    await track({
      path: '/',
      referrer: 'https://l.instagram.com/?u=x',
    }).expect(201);
    await track({
      path: '/',
      referrer: 'https://blog.example.com/post/123?a=1',
    }).expect(201);
    await track({ path: '/' }).expect(201); // referrer 없음 → direct

    const s = await sources();
    expect(s['naver'].today).toBe(2); // www.naver.com + search.naver.com
    expect(s['google'].today).toBe(1);
    expect(s['instagram'].today).toBe(1);
    expect(s['direct'].today).toBe(1);
    // 그 외 외부 host 는 host 만(path/query 제거) 저장
    expect(s['blog.example.com'].today).toBe(1);
    // 원본 referrer URL·쿼리는 어디에도 없어야 한다
    expect(Object.keys(s)).not.toContain('search.naver.com');
    expect(JSON.stringify(s)).not.toContain('%EB%AA%A8%EC%9E%84');
    expect(JSON.stringify(s)).not.toContain('/post/123');
  });

  it('빈/누락 referrer 는 direct 로 집계된다', async () => {
    await track({ path: '/' }).expect(201); // 누락
    await track({ path: '/', referrer: '' }).expect(201); // 빈 문자열
    await track({ path: '/', referrer: 'not-a-url' }).expect(201); // 파싱 불가
    const s = await sources();
    expect(s['direct'].today).toBe(3);
  });

  it('우리 도메인(internal) referrer 는 유입 경로에서 제외된다', async () => {
    await track({
      path: '/rooms/ABC',
      referrer: 'http://localhost:3000/rooms/ABC',
    }).expect(201);
    await track({
      path: '/',
      referrer: 'https://moilga.com/',
    }).expect(201);
    const s = await sources();
    expect(s['internal']).toBeUndefined();
    expect(s['direct']).toBeUndefined(); // internal 은 direct 로도 새지 않는다
    expect(Object.keys(s)).toHaveLength(0);
  });

  it('kakao / facebook / youtube / x / daum / bing 매핑', async () => {
    await track({ path: '/', referrer: 'https://story.kakao.com/' });
    await track({ path: '/', referrer: 'https://m.facebook.com/' });
    await track({ path: '/', referrer: 'https://www.youtube.com/watch?v=x' });
    await track({ path: '/', referrer: 'https://t.co/abcd' });
    await track({ path: '/', referrer: 'https://search.daum.net/search?q=y' });
    await track({ path: '/', referrer: 'https://www.bing.com/' });
    const s = await sources();
    expect(s['kakao'].today).toBe(1);
    expect(s['facebook'].today).toBe(1);
    expect(s['youtube'].today).toBe(1);
    expect(s['x'].today).toBe(1);
    expect(s['daum'].today).toBe(1);
    expect(s['bing'].today).toBe(1);
  });

  it('utm_source/ref 힌트는 알려진 값만 인정하고 referrer 보다 우선한다', async () => {
    // referrer 는 비었지만 카카오톡 공유 링크의 utm_source=kakao 로 잡는다
    await track({ path: '/', ref: 'kakao' }).expect(201);
    // 별칭(twitter → x)
    await track({ path: '/', ref: 'twitter' }).expect(201);
    // 알 수 없는 임의 값은 무시하고 referrer(여기선 없음) → direct 로 폴백
    await track({ path: '/', ref: 'some-random-campaign' }).expect(201);
    const s = await sources();
    expect(s['kakao'].today).toBe(1);
    expect(s['x'].today).toBe(1);
    expect(s['direct'].today).toBe(1);
    // 임의 캠페인 문자열이 그대로 집계에 들어가면 안 된다
    expect(s['some-random-campaign']).toBeUndefined();
  });

  it('GET /admin/visits/detail 는 어드민 토큰이 필요하다 (401)', async () => {
    await request(server()).get('/admin/visits/detail').expect(401);
  });

  it('상세 응답의 sources 는 창별 카운트를 담는다', async () => {
    await track({ path: '/', referrer: 'https://www.naver.com/' });
    await track({ path: '/', referrer: 'https://www.naver.com/' });
    await track({ path: '/', referrer: 'https://www.google.com/' });
    const s = await sources();
    // 오늘 집계 → today/last7Days/last30Days/allTime 모두 같은 창에 잡힌다
    expect(s['naver']).toMatchObject({
      today: 2,
      last7Days: 2,
      last30Days: 2,
      allTime: 2,
    });
    expect(s['google'].allTime).toBe(1);
  });
});
