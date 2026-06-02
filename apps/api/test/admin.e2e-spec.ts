import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { closeTestPool, resetDb } from './setup';

const ADMIN = process.env.ADMIN_TOKEN ?? 'test-admin-token-32-chars-XXXXXX';

describe('admin e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
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

  // ---- 가드 ----
  describe('AdminGuard', () => {
    it('401 without token', async () => {
      const r = await request(server()).get('/admin/stats');
      expect(r.status).toBe(401);
    });

    it('401 with wrong token', async () => {
      const r = await request(server())
        .get('/admin/stats')
        .set('x-admin-token', 'wrong');
      expect(r.status).toBe(401);
    });

    it('200 with correct token', async () => {
      const r = await withAdmin(request(server()).get('/admin/stats'));
      expect(r.status).toBe(200);
    });
  });

  // ---- stats ----
  describe('GET /admin/stats', () => {
    it('returns zero KPIs on empty db', async () => {
      const r = await withAdmin(request(server()).get('/admin/stats'));
      expect(r.body).toMatchObject({
        totalRooms: 0,
        totalParticipants: 0,
        totalVotes: 0,
        activeRooms: 0,
        closedRooms: 0,
        roomsWithDeadline: 0,
      });
    });

    it('counts after seeding', async () => {
      const create = await request(server())
        .post('/rooms')
        .send({ title: 't', dates: ['2026-05-15'] });
      const id = create.body.roomId;
      const p = await request(server())
        .post(`/rooms/${id}/participants`)
        .send({ nickname: 'a' });
      const detail = await request(server()).get(`/rooms/${id}`);
      await request(server())
        .put(`/rooms/${id}/participants/me/availabilities`)
        .set('x-client-token', p.body.clientToken)
        .send({ dateIds: [detail.body.dates[0].id] });

      const r = await withAdmin(request(server()).get('/admin/stats'));
      expect(r.body.totalRooms).toBe(1);
      expect(r.body.totalParticipants).toBe(1);
      expect(r.body.totalVotes).toBe(1);
      expect(r.body.activeRooms).toBe(1);
    });
  });

  // ---- rooms list ----
  describe('GET /admin/rooms', () => {
    async function seed() {
      for (let i = 0; i < 3; i++) {
        await request(server())
          .post('/rooms')
          .send({ title: `room ${i}`, dates: ['2026-05-15'] });
      }
    }

    it('paginates', async () => {
      await seed();
      const r = await withAdmin(
        request(server()).get('/admin/rooms?limit=2&offset=0'),
      );
      expect(r.body.total).toBe(3);
      expect(r.body.rooms).toHaveLength(2);
      expect(r.body.limit).toBe(2);
    });

    it('search by title', async () => {
      await request(server())
        .post('/rooms')
        .send({ title: '회식 가능?', dates: ['2026-05-15'] });
      await request(server())
        .post('/rooms')
        .send({ title: 'casual', dates: ['2026-05-15'] });
      const r = await withAdmin(request(server()).get('/admin/rooms?q=회식'));
      expect(r.body.total).toBe(1);
      expect(r.body.rooms[0].title).toBe('회식 가능?');
    });

    it('rooms are flagged closed when deadline past', async () => {
      const c = await request(server())
        .post('/rooms')
        .send({ title: 'past', dates: ['2026-05-15'] });
      await request(server())
        .patch(`/rooms/${c.body.roomId}/deadline`)
        .set('x-creator-token', c.body.creatorToken)
        .send({ deadline: '2020-01-01T00:00:00.000Z' });
      const r = await withAdmin(request(server()).get('/admin/rooms'));
      const target = r.body.rooms.find(
        (rr: { id: string }) => rr.id === c.body.roomId,
      );
      expect(target.status).toBe('closed');
    });
  });

  // ---- room detail + delete ----
  describe('GET/DELETE /admin/rooms/:id', () => {
    it('drill-down returns participants + dates', async () => {
      const c = await request(server())
        .post('/rooms')
        .send({ title: 'detail', dates: ['2026-05-15', '2026-05-16'] });
      const id = c.body.roomId;
      const p = await request(server())
        .post(`/rooms/${id}/participants`)
        .send({ nickname: 'alice' });
      const dates = (await request(server()).get(`/rooms/${id}`)).body.dates;
      await request(server())
        .put(`/rooms/${id}/participants/me/availabilities`)
        .set('x-client-token', p.body.clientToken)
        .send({ dateIds: [dates[0].id] });

      const r = await withAdmin(request(server()).get(`/admin/rooms/${id}`));
      expect(r.status).toBe(200);
      expect(r.body.participants).toHaveLength(1);
      expect(r.body.participants[0].nickname).toBe('alice');
      expect(r.body.dates[0].votes).toBe(1);
    });

    it('delete cascades and returns 404 afterwards', async () => {
      const c = await request(server())
        .post('/rooms')
        .send({ title: 'del', dates: ['2026-05-15'] });
      const del = await withAdmin(
        request(server()).delete(`/admin/rooms/${c.body.roomId}`),
      );
      expect(del.status).toBe(200);
      const after = await withAdmin(
        request(server()).get(`/admin/rooms/${c.body.roomId}`),
      );
      expect(after.status).toBe(404);
    });

    it('404 on unknown', async () => {
      const r = await withAdmin(request(server()).get('/admin/rooms/none'));
      expect(r.status).toBe(404);
    });
  });

  // ---- cleanup ----
  describe('POST /admin/cleanup', () => {
    it('does not remove fresh rooms', async () => {
      await request(server())
        .post('/rooms')
        .send({ title: 'new', dates: ['2026-05-15'] });
      const r = await withAdmin(
        request(server()).post('/admin/cleanup').send({ days: 90 }),
      );
      expect(r.body.removed).toBe(0);
    });
  });
});
