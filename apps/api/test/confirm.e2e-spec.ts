import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { closeTestPool, resetDb } from './setup';

// 모임 확정(방장이 최종 날짜 못박기) + 확정 시 투표 잠금 + 해제.
describe('room confirm e2e', () => {
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

  async function makeRoom() {
    const r = await request(server())
      .post('/rooms')
      .send({ title: '모임', dates: ['2026-09-01', '2026-09-02', '2026-09-03'] });
    return { roomId: r.body.roomId as string, creator: r.body.creatorToken as string };
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
  const confirm = (roomId: string, creator: string, dateId: number) =>
    request(server())
      .post(`/rooms/${roomId}/confirm`)
      .set('x-creator-token', creator)
      .send({ dateId });
  const unconfirm = (roomId: string, creator: string) =>
    request(server())
      .delete(`/rooms/${roomId}/confirm`)
      .set('x-creator-token', creator);

  it('403 without/with wrong creator token', async () => {
    const { roomId } = await makeRoom();
    const [d1] = await dateIds(roomId);
    await request(server())
      .post(`/rooms/${roomId}/confirm`)
      .send({ dateId: d1 })
      .expect(403);
    await request(server())
      .post(`/rooms/${roomId}/confirm`)
      .set('x-creator-token', 'nope')
      .send({ dateId: d1 })
      .expect(403);
  });

  it('400 when dateId is not a candidate of this room', async () => {
    const { roomId, creator } = await makeRoom();
    await confirm(roomId, creator, 99999999).expect(400);
    // 다른 방의 날짜도 거부
    const other = await makeRoom();
    const [otherDate] = await dateIds(other.roomId);
    await confirm(roomId, creator, otherDate).expect(400);
  });

  it('confirms → appears in detail & results, locks voting', async () => {
    const { roomId, creator } = await makeRoom();
    const [d1, d2] = await dateIds(roomId);
    const alice = await join(roomId, 'alice');
    await vote(roomId, alice, [d1, d2]).expect(200);

    const c = await confirm(roomId, creator, d2).expect(201);
    expect(c.body.confirmedDateId).toBe(d2);
    expect(c.body.confirmedDate).toBe('2026-09-02');

    const detail = await request(server()).get(`/rooms/${roomId}`);
    expect(detail.body.confirmedDateId).toBe(d2);
    expect(detail.body.confirmedDate).toBe('2026-09-02');
    expect(detail.body.confirmedAt).toBeTruthy();

    const results = await request(server()).get(`/rooms/${roomId}/results`);
    expect(results.body.confirmedDateId).toBe(d2);

    // 확정되면 투표/불참 잠금 (423 Locked)
    await vote(roomId, alice, [d1]).expect(423);
    await request(server())
      .put(`/rooms/${roomId}/participants/me/decline`)
      .set('x-client-token', alice)
      .send({ declined: true })
      .expect(423);
  });

  it('unconfirm reopens voting', async () => {
    const { roomId, creator } = await makeRoom();
    const [d1] = await dateIds(roomId);
    const alice = await join(roomId, 'alice');
    await confirm(roomId, creator, d1).expect(201);
    await vote(roomId, alice, [d1]).expect(423); // 잠김

    const u = await unconfirm(roomId, creator).expect(200);
    expect(u.body.confirmedDateId).toBeNull();

    const detail = await request(server()).get(`/rooms/${roomId}`);
    expect(detail.body.confirmedDateId).toBeNull();
    // 다시 투표 가능
    await vote(roomId, alice, [d1]).expect(200);
  });

  it('winner.ics uses the confirmed date, not the vote leader', async () => {
    const { roomId, creator } = await makeRoom();
    const [d1, d2, d3] = await dateIds(roomId);
    // d1 을 1위로 (2표), 하지만 방장은 d3 로 확정
    const a = await join(roomId, 'a');
    const b = await join(roomId, 'b');
    await vote(roomId, a, [d1]).expect(200);
    await vote(roomId, b, [d1]).expect(200);
    await confirm(roomId, creator, d3).expect(201);

    const ics = await request(server()).get(`/rooms/${roomId}/winner.ics`);
    expect(ics.status).toBe(200);
    // 2026-09-03 → DTSTART;VALUE=DATE:20260903
    expect(ics.text).toContain('DTSTART;VALUE=DATE:20260903');
    expect(ics.text).not.toContain('DTSTART;VALUE=DATE:20260901');
  });
});
