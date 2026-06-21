import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { closeTestPool, getTestPool, resetDb } from './setup';

describe('rooms + participants e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
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

  // ---------- health ----------

  describe('GET /health', () => {
    it('db ok', async () => {
      const res = await request(server()).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.db).toBe('ok');
    });
  });

  // ---------- POST /rooms ----------

  describe('POST /rooms', () => {
    it('creates a room with deadline null', async () => {
      const res = await request(server())
        .post('/rooms')
        .send({ title: '모임', dates: ['2026-05-15', '2026-05-16'] });
      expect(res.status).toBe(201);
      expect(typeof res.body.roomId).toBe('string');
      expect(res.body.roomId).toHaveLength(12);
      expect(typeof res.body.creatorToken).toBe('string');
      expect(res.body.creatorToken).toHaveLength(32);
    });

    it('creates a room with deadline', async () => {
      const deadline = new Date(Date.now() + 86400000).toISOString();
      const res = await request(server())
        .post('/rooms')
        .send({ title: '내일까지', dates: ['2026-05-15'], deadline });
      expect(res.status).toBe(201);
    });

    it('400 on past deadline', async () => {
      const res = await request(server())
        .post('/rooms')
        .send({
          title: '이미 지남',
          dates: ['2026-05-15'],
          deadline: '2020-01-01T00:00:00.000Z',
        });
      expect(res.status).toBe(400);
    });

    it('400 on empty title', async () => {
      const res = await request(server())
        .post('/rooms')
        .send({ title: '', dates: ['2026-05-15'] });
      expect(res.status).toBe(400);
    });

    it('400 on empty dates', async () => {
      const res = await request(server())
        .post('/rooms')
        .send({ title: '제목', dates: [] });
      expect(res.status).toBe(400);
    });

    it('400 on duplicate dates', async () => {
      const res = await request(server())
        .post('/rooms')
        .send({ title: '제목', dates: ['2026-05-15', '2026-05-15'] });
      expect(res.status).toBe(400);
    });

    it('400 on malformed date', async () => {
      const res = await request(server())
        .post('/rooms')
        .send({ title: '제목', dates: ['nope'] });
      expect(res.status).toBe(400);
    });

    it('400 on extra unknown field', async () => {
      const res = await request(server())
        .post('/rooms')
        .send({ title: '제목', dates: ['2026-05-15'], hax: 1 });
      expect(res.status).toBe(400);
    });
  });

  // ---------- GET /rooms/:id ----------

  describe('GET /rooms/:id', () => {
    it('returns room detail with dates and empty results', async () => {
      const create = await request(server())
        .post('/rooms')
        .send({ title: 'detail-test', dates: ['2026-05-15', '2026-05-20'] });
      const id = create.body.roomId;

      const res = await request(server()).get(`/rooms/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.title).toBe('detail-test');
      expect(res.body.deadline).toBeNull();
      expect(res.body.dates).toHaveLength(2);
      expect(res.body.dates[0].date).toBe('2026-05-15');
      expect(res.body.dates[1].date).toBe('2026-05-20');
      expect(res.body.participantCount).toBe(0);
      expect(res.body.results).toHaveLength(2);
      for (const r of res.body.results) {
        expect(r.votes).toBe(0);
        expect(r.voters).toEqual([]);
      }
    });

    it('preserves the calendar date (KST/UTC safe)', async () => {
      // 사용자가 '2026-05-15'를 입력하면 결과도 정확히 '2026-05-15' 여야 한다.
      const create = await request(server())
        .post('/rooms')
        .send({ title: 'tz', dates: ['2026-05-15', '2026-12-31'] });
      const res = await request(server()).get(`/rooms/${create.body.roomId}`);
      const dates = res.body.dates.map((d: { date: string }) => d.date);
      expect(dates).toEqual(['2026-05-15', '2026-12-31']);
    });

    it('404 on unknown room', async () => {
      const res = await request(server()).get('/rooms/does-not-exist');
      expect(res.status).toBe(404);
    });
  });

  // ---------- participants + voting ----------

  describe('participants + voting', () => {
    async function makeRoom(
      dates = ['2026-05-15', '2026-05-16', '2026-05-22'],
    ) {
      const r = await request(server())
        .post('/rooms')
        .send({ title: '모임', dates });
      return r.body as { roomId: string; creatorToken: string };
    }
    async function getDateIds(roomId: string) {
      const r = await request(server()).get(`/rooms/${roomId}`);
      return (r.body.dates as { id: number }[]).map((d) => d.id);
    }
    async function join(roomId: string, nickname: string) {
      const r = await request(server())
        .post(`/rooms/${roomId}/participants`)
        .send({ nickname });
      return r.body as { participantId: number; clientToken: string };
    }

    it('joins, votes, and ranking aggregates correctly', async () => {
      const { roomId } = await makeRoom();
      const [d1, d2, d3] = await getDateIds(roomId);

      const alice = await join(roomId, 'alice');
      await request(server())
        .put(`/rooms/${roomId}/participants/me/availabilities`)
        .set('x-client-token', alice.clientToken)
        .send({ dateIds: [d1, d2] })
        .expect(200);

      const bob = await join(roomId, 'bob');
      await request(server())
        .put(`/rooms/${roomId}/participants/me/availabilities`)
        .set('x-client-token', bob.clientToken)
        .send({ dateIds: [d2, d3] })
        .expect(200);

      const res = await request(server()).get(`/rooms/${roomId}/results`);
      expect(res.status).toBe(200);
      expect(res.body.participantCount).toBe(2);
      expect(res.body.results[0]).toMatchObject({
        dateId: d2,
        votes: 2,
      });
      expect(
        res.body.results[0].voters.map((v: { nickname: string }) => v.nickname),
      ).toEqual(['alice', 'bob']);
      // 동점 1표는 날짜 빠른 쪽이 위
      expect(res.body.results[1].dateId).toBe(d1);
      expect(res.body.results[2].dateId).toBe(d3);
    });

    it('GET me returns own votes', async () => {
      const { roomId } = await makeRoom();
      const [d1, d2] = await getDateIds(roomId);
      const me = await join(roomId, 'me');
      await request(server())
        .put(`/rooms/${roomId}/participants/me/availabilities`)
        .set('x-client-token', me.clientToken)
        .send({ dateIds: [d1, d2] });

      const res = await request(server())
        .get(`/rooms/${roomId}/participants/me`)
        .set('x-client-token', me.clientToken);
      expect(res.status).toBe(200);
      expect(res.body.me).toMatchObject({
        participantId: me.participantId,
        nickname: 'me',
        dateIds: expect.arrayContaining([d1, d2]),
      });
    });

    it('GET me without token returns null inside wrapper', async () => {
      const { roomId } = await makeRoom();
      const res = await request(server()).get(
        `/rooms/${roomId}/participants/me`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ me: null });
    });

    it('vote replaces previous selection (idempotent)', async () => {
      const { roomId } = await makeRoom();
      const [d1, d2, d3] = await getDateIds(roomId);
      const me = await join(roomId, 'me');

      await request(server())
        .put(`/rooms/${roomId}/participants/me/availabilities`)
        .set('x-client-token', me.clientToken)
        .send({ dateIds: [d1, d2] });
      await request(server())
        .put(`/rooms/${roomId}/participants/me/availabilities`)
        .set('x-client-token', me.clientToken)
        .send({ dateIds: [d3] });

      const r = await request(server()).get(`/rooms/${roomId}/results`);
      const votes = Object.fromEntries(
        r.body.results.map((x: { dateId: number; votes: number }) => [
          x.dateId,
          x.votes,
        ]),
      );
      expect(votes[d1]).toBe(0);
      expect(votes[d2]).toBe(0);
      expect(votes[d3]).toBe(1);
    });

    it('filters out date ids from other rooms', async () => {
      const a = await makeRoom(['2026-05-15']);
      const b = await makeRoom(['2026-06-15']);
      const [bDateId] = await getDateIds(b.roomId);
      const me = await join(a.roomId, 'cheater');

      const res = await request(server())
        .put(`/rooms/${a.roomId}/participants/me/availabilities`)
        .set('x-client-token', me.clientToken)
        .send({ dateIds: [bDateId] });
      expect(res.status).toBe(200);
      expect(res.body.dateIds).toEqual([]); // 다른 방 dateId는 무시
    });

    it('403 without client_token on vote', async () => {
      const { roomId } = await makeRoom();
      const [d1] = await getDateIds(roomId);
      const res = await request(server())
        .put(`/rooms/${roomId}/participants/me/availabilities`)
        .send({ dateIds: [d1] });
      expect(res.status).toBe(403);
    });

    it('403 with someone else’s client_token', async () => {
      const { roomId } = await makeRoom();
      const [d1] = await getDateIds(roomId);
      const res = await request(server())
        .put(`/rooms/${roomId}/participants/me/availabilities`)
        .set('x-client-token', 'not-a-real-token')
        .send({ dateIds: [d1] });
      expect(res.status).toBe(403);
    });

    it('400 on empty nickname', async () => {
      const { roomId } = await makeRoom();
      const res = await request(server())
        .post(`/rooms/${roomId}/participants`)
        .send({ nickname: '' });
      expect(res.status).toBe(400);
    });

    it('400 on whitespace-only nickname (trim 후 빈 값)', async () => {
      const { roomId } = await makeRoom();
      const res = await request(server())
        .post(`/rooms/${roomId}/participants`)
        .send({ nickname: '   ' });
      expect(res.status).toBe(400);
    });

    it('404 join in unknown room', async () => {
      const res = await request(server())
        .post('/rooms/unknown123/participants')
        .send({ nickname: 'x' });
      expect(res.status).toBe(404);
    });
  });

  // ---------- deadline ----------

  describe('deadline', () => {
    it('creator can set, change, and unset deadline', async () => {
      const create = await request(server())
        .post('/rooms')
        .send({ title: 'dd', dates: ['2026-05-15'] });
      const id = create.body.roomId;
      const creatorToken = create.body.creatorToken;

      const future = new Date(Date.now() + 7 * 86400000).toISOString();
      const r1 = await request(server())
        .patch(`/rooms/${id}/deadline`)
        .set('x-creator-token', creatorToken)
        .send({ deadline: future });
      expect(r1.status).toBe(200);
      expect(r1.body.deadline).toBe(future);

      const r2 = await request(server())
        .patch(`/rooms/${id}/deadline`)
        .set('x-creator-token', creatorToken)
        .send({ deadline: null });
      expect(r2.status).toBe(200);
      expect(r2.body.deadline).toBeNull();
    });

    it('403 without creator token', async () => {
      const create = await request(server())
        .post('/rooms')
        .send({ title: 'dd', dates: ['2026-05-15'] });
      const res = await request(server())
        .patch(`/rooms/${create.body.roomId}/deadline`)
        .send({ deadline: null });
      expect(res.status).toBe(403);
    });

    it('403 with wrong creator token', async () => {
      const create = await request(server())
        .post('/rooms')
        .send({ title: 'dd', dates: ['2026-05-15'] });
      const res = await request(server())
        .patch(`/rooms/${create.body.roomId}/deadline`)
        .set('x-creator-token', 'bogus')
        .send({ deadline: null });
      expect(res.status).toBe(403);
    });

    it('423 Locked on vote after deadline; creator can still unlock', async () => {
      const create = await request(server())
        .post('/rooms')
        .send({ title: 'lock', dates: ['2026-05-15'] });
      const id = create.body.roomId;
      const creatorToken = create.body.creatorToken;

      // 개설자가 마감일을 과거로 당겨 강제 마감
      await request(server())
        .patch(`/rooms/${id}/deadline`)
        .set('x-creator-token', creatorToken)
        .send({ deadline: '2020-01-01T00:00:00.000Z' });

      const me = await request(server())
        .post(`/rooms/${id}/participants`)
        .send({ nickname: 'me' });

      const detail = await request(server()).get(`/rooms/${id}`);
      const dateId = detail.body.dates[0].id;

      const vote = await request(server())
        .put(`/rooms/${id}/participants/me/availabilities`)
        .set('x-client-token', me.body.clientToken)
        .send({ dateIds: [dateId] });
      expect(vote.status).toBe(423);

      // 개설자가 풀어주면 다시 가능해야 함
      await request(server())
        .patch(`/rooms/${id}/deadline`)
        .set('x-creator-token', creatorToken)
        .send({ deadline: null });

      const retry = await request(server())
        .put(`/rooms/${id}/participants/me/availabilities`)
        .set('x-client-token', me.body.clientToken)
        .send({ dateIds: [dateId] });
      expect(retry.status).toBe(200);
    });

    it('joining after deadline is allowed (results-only view)', async () => {
      const create = await request(server())
        .post('/rooms')
        .send({ title: 'late', dates: ['2026-05-15'] });
      await request(server())
        .patch(`/rooms/${create.body.roomId}/deadline`)
        .set('x-creator-token', create.body.creatorToken)
        .send({ deadline: '2020-01-01T00:00:00.000Z' });
      const res = await request(server())
        .post(`/rooms/${create.body.roomId}/participants`)
        .send({ nickname: 'latecomer' });
      expect(res.status).toBe(201);
    });
  });

  // ---------- aggregation specifics ----------

  describe('GET /rooms/:id/results', () => {
    it('returns empty results when no participants', async () => {
      const create = await request(server())
        .post('/rooms')
        .send({ title: 'empty', dates: ['2026-05-15'] });
      const res = await request(server()).get(
        `/rooms/${create.body.roomId}/results`,
      );
      expect(res.status).toBe(200);
      expect(res.body.participantCount).toBe(0);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].votes).toBe(0);
    });

    it('orders by votes desc, then date asc', async () => {
      const c = await request(server())
        .post('/rooms')
        .send({
          title: 'order',
          dates: ['2026-05-15', '2026-05-10', '2026-05-20'],
        });
      const id = c.body.roomId;
      const detail = await request(server()).get(`/rooms/${id}`);
      const map = Object.fromEntries(
        detail.body.dates.map((d: { date: string; id: number }) => [
          d.date,
          d.id,
        ]),
      );

      // 모두 1표
      for (const n of ['a', 'b', 'c']) {
        const p = await request(server())
          .post(`/rooms/${id}/participants`)
          .send({ nickname: n });
        const day =
          n === 'a'
            ? map['2026-05-15']
            : n === 'b'
              ? map['2026-05-10']
              : map['2026-05-20'];
        await request(server())
          .put(`/rooms/${id}/participants/me/availabilities`)
          .set('x-client-token', p.body.clientToken)
          .send({ dateIds: [day] });
      }

      const r = await request(server()).get(`/rooms/${id}/results`);
      expect(r.body.results.map((x: { date: string }) => x.date)).toEqual([
        '2026-05-10',
        '2026-05-15',
        '2026-05-20',
      ]);
    });
  });

  // ---------- 강퇴 ----------
  describe('DELETE /rooms/:id/participants/:pid (creator)', () => {
    it('creator can kick, vote disappears', async () => {
      const create = await request(server())
        .post('/rooms')
        .send({ title: 'kick', dates: ['2026-05-15'] });
      const id = create.body.roomId;
      const creator = create.body.creatorToken;
      const detail = await request(server()).get(`/rooms/${id}`);
      const dateId = detail.body.dates[0].id;
      const me = await request(server())
        .post(`/rooms/${id}/participants`)
        .send({ nickname: 'alice' });
      await request(server())
        .put(`/rooms/${id}/participants/me/availabilities`)
        .set('x-client-token', me.body.clientToken)
        .send({ dateIds: [dateId] });

      const kick = await request(server())
        .delete(`/rooms/${id}/participants/${me.body.participantId}`)
        .set('x-creator-token', creator);
      expect(kick.status).toBe(200);

      const after = await request(server()).get(`/rooms/${id}`);
      expect(after.body.participantCount).toBe(0);
      expect(after.body.results[0].votes).toBe(0);
    });

    it('403 without creator token', async () => {
      const create = await request(server())
        .post('/rooms')
        .send({ title: 'kick', dates: ['2026-05-15'] });
      const me = await request(server())
        .post(`/rooms/${create.body.roomId}/participants`)
        .send({ nickname: 'alice' });
      const r = await request(server()).delete(
        `/rooms/${create.body.roomId}/participants/${me.body.participantId}`,
      );
      expect(r.status).toBe(403);
    });
  });

  // ---------- PIN 복원 ----------
  describe('POST /rooms/:id/participants/recover (PIN)', () => {
    it('joins with pin, recovers a fresh client_token', async () => {
      const create = await request(server())
        .post('/rooms')
        .send({ title: 'pin', dates: ['2026-05-15'] });
      const id = create.body.roomId;
      const join = await request(server())
        .post(`/rooms/${id}/participants`)
        .send({ nickname: 'memo', pin: '1234' });
      expect(join.status).toBe(201);

      const recover = await request(server())
        .post(`/rooms/${id}/participants/recover`)
        .send({ nickname: 'memo', pin: '1234' });
      expect(recover.status).toBe(201);
      expect(recover.body.participantId).toBe(join.body.participantId);
      // recover 는 새 토큰을 발급하지 않고 기존 토큰 그대로 반환 — multi-device 지원 (한 사람 = 한 토큰).
      expect(recover.body.clientToken).toBe(join.body.clientToken);
    });

    it('403 on wrong pin', async () => {
      const create = await request(server())
        .post('/rooms')
        .send({ title: 'pin', dates: ['2026-05-15'] });
      await request(server())
        .post(`/rooms/${create.body.roomId}/participants`)
        .send({ nickname: 'memo', pin: '1234' });
      const r = await request(server())
        .post(`/rooms/${create.body.roomId}/participants/recover`)
        .send({ nickname: 'memo', pin: '9999' });
      expect(r.status).toBe(403);
    });

    it('locks a nickname after repeated wrong PIN recovery attempts', async () => {
      const create = await request(server())
        .post('/rooms')
        .send({ title: 'pin-lockout', dates: ['2026-05-15'] });
      await request(server())
        .post(`/rooms/${create.body.roomId}/participants`)
        .send({ nickname: 'memo', pin: '1234' });

      for (let i = 0; i < 5; i++) {
        const r = await request(server())
          .post(`/rooms/${create.body.roomId}/participants/recover`)
          .send({ nickname: 'memo', pin: '9999' });
        expect(r.status).toBe(403);
      }

      const locked = await request(server())
        .post(`/rooms/${create.body.roomId}/participants/recover`)
        .send({ nickname: 'memo', pin: '1234' });
      expect(locked.status).toBe(429);
    });

    it('403 if pin was never set', async () => {
      const create = await request(server())
        .post('/rooms')
        .send({ title: 'no-pin', dates: ['2026-05-15'] });
      await request(server())
        .post(`/rooms/${create.body.roomId}/participants`)
        .send({ nickname: 'a' });
      const r = await request(server())
        .post(`/rooms/${create.body.roomId}/participants/recover`)
        .send({ nickname: 'a', pin: '1234' });
      expect(r.status).toBe(403);
    });

    it('400 on malformed pin', async () => {
      const create = await request(server())
        .post('/rooms')
        .send({ title: 'pin', dates: ['2026-05-15'] });
      const r = await request(server())
        .post(`/rooms/${create.body.roomId}/participants`)
        .send({ nickname: 'a', pin: 'abc' });
      expect(r.status).toBe(400);
    });
  });

  // ---------- .ics 내보내기 ----------
  describe('GET /rooms/:id/winner.ics', () => {
    it('returns VCALENDAR with the top date', async () => {
      const c = await request(server())
        .post('/rooms')
        .send({ title: 'cal', dates: ['2026-07-20', '2026-07-21'] });
      const id = c.body.roomId;
      const dates = (await request(server()).get(`/rooms/${id}`)).body.dates;
      const p = await request(server())
        .post(`/rooms/${id}/participants`)
        .send({ nickname: 'a' });
      await request(server())
        .put(`/rooms/${id}/participants/me/availabilities`)
        .set('x-client-token', p.body.clientToken)
        .send({ dateIds: [dates[0].id] });

      const r = await request(server()).get(`/rooms/${id}/winner.ics`);
      expect(r.status).toBe(200);
      expect(r.headers['content-type']).toContain('text/calendar');
      expect(r.text).toContain('BEGIN:VCALENDAR');
      expect(r.text).toContain('DTSTART;VALUE=DATE:20260720');
      expect(r.text).toContain('SUMMARY:cal');
      expect(r.text).toContain('END:VEVENT');
    });

    it('404 when no votes', async () => {
      const c = await request(server())
        .post('/rooms')
        .send({ title: 'empty', dates: ['2026-07-20'] });
      const r = await request(server()).get(
        `/rooms/${c.body.roomId}/winner.ics`,
      );
      expect(r.status).toBe(404);
    });
  });

  // ---------- sanity DB ----------
  it('sanity: TRUNCATE works between tests', async () => {
    const r = await getTestPool().query('SELECT COUNT(*)::int AS c FROM rooms');
    expect(r.rows[0].c).toBe(0);
  });
});
