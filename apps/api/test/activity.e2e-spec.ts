import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { closeTestPool, resetDb } from './setup';

const ADMIN = process.env.ADMIN_TOKEN ?? 'test-admin-token-32-chars-XXXXXX';

describe('activity feed + visits detail e2e', () => {
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

  async function makeRoom(title = '모임') {
    const r = await request(server())
      .post('/rooms')
      .send({ title, dates: ['2026-08-01', '2026-08-02', '2026-08-03'] });
    return r.body.roomId as string;
  }
  async function dateIds(roomId: string) {
    const r = await request(server()).get(`/rooms/${roomId}`);
    return (r.body.dates as { id: number }[]).map((d) => d.id);
  }
  async function join(roomId: string, nickname: string) {
    const r = await request(server())
      .post(`/rooms/${roomId}/participants`)
      .send({ nickname });
    return r.body.clientToken as string;
  }
  const vote = (roomId: string, token: string, ids: number[]) =>
    request(server())
      .put(`/rooms/${roomId}/participants/me/availabilities`)
      .set('x-client-token', token)
      .send({ dateIds: ids });
  const decline = (roomId: string, token: string) =>
    request(server())
      .put(`/rooms/${roomId}/participants/me/decline`)
      .set('x-client-token', token)
      .send({ declined: true });

  describe('GET /admin/activity', () => {
    it('requires admin token', async () => {
      await request(server()).get('/admin/activity').expect(401);
    });

    it('aggregates room_created · joined · voted · declined, newest first', async () => {
      const roomId = await makeRoom('주말모임');
      const [d1, d2] = await dateIds(roomId);
      const minsu = await join(roomId, '민수');
      const hayun = await join(roomId, '하윤');
      await vote(roomId, minsu, [d1, d2]).expect(200);
      await decline(roomId, hayun).expect(200);

      const r = await withAdmin(request(server()).get('/admin/activity'));
      expect(r.status).toBe(200);
      const events = r.body.events as {
        type: string;
        ts: string;
        roomId: string;
        roomTitle: string;
        nickname?: string;
        count?: number;
      }[];

      const types = events.map((e) => e.type);
      expect(types).toContain('room_created');
      expect(types).toContain('joined');
      expect(types).toContain('voted');
      expect(types).toContain('declined');

      // 최신순 (ts 내림차순)
      for (let i = 1; i < events.length; i++) {
        expect(new Date(events[i - 1].ts).getTime()).toBeGreaterThanOrEqual(
          new Date(events[i].ts).getTime(),
        );
      }

      const voted = events.find((e) => e.type === 'voted');
      expect(voted?.nickname).toBe('민수');
      expect(voted?.count).toBe(2);

      const declined = events.find((e) => e.type === 'declined');
      expect(declined?.nickname).toBe('하윤');
      expect(declined?.roomTitle).toBe('주말모임');

      // 방 개설 이벤트는 닉네임 없이 방 제목만
      const created = events.find((e) => e.type === 'room_created');
      expect(created?.roomTitle).toBe('주말모임');
      expect(created?.nickname).toBeUndefined();
    });

    it('paginates with a before cursor (no overlap)', async () => {
      const roomId = await makeRoom();
      const [d1] = await dateIds(roomId);
      for (const n of ['a', 'b', 'c']) {
        const t = await join(roomId, n);
        await vote(roomId, t, [d1]);
      }

      const first = await withAdmin(
        request(server()).get('/admin/activity?limit=2'),
      );
      expect(first.body.events).toHaveLength(2);
      expect(first.body.nextBefore).toBeTruthy();

      const second = await withAdmin(
        request(server()).get(
          `/admin/activity?limit=2&before=${encodeURIComponent(first.body.nextBefore)}`,
        ),
      );
      // 2페이지의 모든 ts 는 커서보다 과거
      const cursor = new Date(first.body.nextBefore).getTime();
      for (const e of second.body.events as { ts: string }[]) {
        expect(new Date(e.ts).getTime()).toBeLessThan(cursor);
      }
    });

    it('undeclining clears declined_at → drops from feed', async () => {
      const roomId = await makeRoom();
      const [d1] = await dateIds(roomId);
      const t = await join(roomId, '지수');
      await decline(roomId, t).expect(200);
      // 다시 날짜 선택 = 참여 전환 → declined_at NULL
      await vote(roomId, t, [d1]).expect(200);

      const r = await withAdmin(request(server()).get('/admin/activity'));
      const declined = (r.body.events as { type: string }[]).filter(
        (e) => e.type === 'declined',
      );
      expect(declined).toHaveLength(0);
    });
  });

  describe('GET /admin/visits/detail', () => {
    it('requires admin token', async () => {
      await request(server()).get('/admin/visits/detail').expect(401);
    });

    it('returns windowed counts and per-path breakdown', async () => {
      await request(server()).post('/track').send({ path: '/' }).expect(201);
      await request(server()).post('/track').send({ path: '/' }).expect(201);
      await request(server())
        .post('/track')
        .send({ path: '/rooms/ABC123' })
        .expect(201);
      await request(server())
        .post('/track')
        .send({ path: '/rooms/DEF456' })
        .expect(201);

      const r = await withAdmin(
        request(server()).get('/admin/visits/detail'),
      );
      expect(r.status).toBe(200);
      expect(r.body.today).toBe(4);
      expect(r.body.last7Days).toBe(4);
      expect(r.body.last30Days).toBe(4);
      expect(r.body.allTime).toBe(4);
      // 서로 다른 정규화 경로: '/' 와 '/rooms/[id]'
      expect(r.body.distinctPaths).toBe(2);

      const paths = Object.fromEntries(
        (r.body.paths as { path: string; allTime: number }[]).map((p) => [
          p.path,
          p.allTime,
        ]),
      );
      expect(paths['/']).toBe(2);
      expect(paths['/rooms/[id]']).toBe(2);

      // 정렬: allTime 내림차순 (동률이면 경로 asc)
      const alltimes = (r.body.paths as { allTime: number }[]).map(
        (p) => p.allTime,
      );
      const sorted = [...alltimes].sort((a, b) => b - a);
      expect(alltimes).toEqual(sorted);
    });
  });
});
