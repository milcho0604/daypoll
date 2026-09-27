import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { closeTestPool, getTestPool, resetDb } from './setup';

// 장소·메뉴 투표 — 날짜와 같은 방에서 동시에. 잠금은 날짜와 독립.
describe('places e2e', () => {
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
      .send({ title: '회식', dates: ['2026-10-01', '2026-10-02'] });
    return {
      roomId: r.body.roomId as string,
      creator: r.body.creatorToken as string,
    };
  }
  async function join(roomId: string, nickname: string) {
    const r = await request(server())
      .post(`/rooms/${roomId}/participants`)
      .send({ nickname });
    return {
      token: r.body.clientToken as string,
      id: r.body.participantId as number,
    };
  }
  const add = (
    roomId: string,
    token: string | undefined,
    body: Record<string, unknown>,
  ) => {
    const req = request(server()).post(`/rooms/${roomId}/places`);
    if (token) req.set('x-client-token', token);
    return req.send(body);
  };
  const vote = (roomId: string, token: string, placeId: number, on = true) =>
    (on
      ? request(server()).put(`/rooms/${roomId}/places/${placeId}/vote`)
      : request(server()).delete(`/rooms/${roomId}/places/${placeId}/vote`)
    ).set('x-client-token', token);
  const confirmPlace = (roomId: string, creator: string, placeId: number) =>
    request(server())
      .post(`/rooms/${roomId}/place-confirm`)
      .set('x-creator-token', creator)
      .send({ placeId });
  const unconfirmPlace = (roomId: string, creator: string) =>
    request(server())
      .delete(`/rooms/${roomId}/place-confirm`)
      .set('x-creator-token', creator);
  const results = async (roomId: string) =>
    (await request(server()).get(`/rooms/${roomId}/results`)).body;
  const decline = (roomId: string, token: string, declined: boolean) =>
    request(server())
      .put(`/rooms/${roomId}/participants/me/decline`)
      .set('x-client-token', token)
      .send({ declined });
  async function dateIds(roomId: string) {
    const r = await request(server()).get(`/rooms/${roomId}`);
    return (r.body.dates as { id: number }[]).map((d) => d.id);
  }
  const setDeadlinePast = (roomId: string) =>
    getTestPool().query(
      `UPDATE rooms SET deadline = now() - interval '1 minute' WHERE id = $1`,
      [roomId],
    );

  describe('추가', () => {
    it('입장한 참여자가 후보를 올리면 본인 👍 가 같이 켜진다', async () => {
      const { roomId } = await makeRoom();
      const a = await join(roomId, '민수');
      const r = await add(roomId, a.token, {
        name: '  을지로   노가리  ',
        url: 'https://naver.me/abc',
        memo: '1인 2만',
      });
      expect(r.status).toBe(201);
      const res = await results(roomId);
      expect(res.places).toHaveLength(1);
      expect(res.places[0]).toMatchObject({
        placeId: r.body.placeId,
        name: '을지로 노가리', // 한 줄로 정리
        url: 'https://naver.me/abc',
        memo: '1인 2만',
        createdBy: { id: a.id, nickname: '민수' },
        votes: 1,
        voters: [{ id: a.id, nickname: '민수' }],
      });
      expect(res.confirmedPlaceId).toBeNull();
      // 상세 응답에도 같이 실린다
      const detail = await request(server()).get(`/rooms/${roomId}`);
      expect(detail.body.places).toHaveLength(1);
      expect(detail.body.confirmedPlaceAt).toBeNull();
    });

    it('링크·메모 없이 이름만으로도 된다 (빈 문자열 = 없음)', async () => {
      const { roomId } = await makeRoom();
      const a = await join(roomId, '민수');
      const r = await add(roomId, a.token, { name: '삼겹살', url: '', memo: ' ' });
      expect(r.status).toBe(201);
      const res = await results(roomId);
      expect(res.places[0].url).toBeNull();
      expect(res.places[0].memo).toBeNull();
    });

    it('토큰 없음 / 다른 방 토큰 → 403', async () => {
      const { roomId } = await makeRoom();
      const other = await makeRoom();
      const b = await join(other.roomId, '남');
      expect((await add(roomId, undefined, { name: 'x' })).status).toBe(403);
      expect((await add(roomId, b.token, { name: 'x' })).status).toBe(403);
    });

    it.each([
      ['빈 이름', { name: '   ' }],
      ['41자 이름', { name: 'ㄱ'.repeat(41) }],
      ['javascript 링크', { name: 'x', url: 'javascript:alert(1)' }],
      ['userinfo 위장', { name: 'x', url: 'https://naver.me@evil.example/' }],
      ['스킴 없는 링크', { name: 'x', url: 'naver.me/abc' }],
      ['61자 메모', { name: 'x', memo: 'ㄱ'.repeat(61) }],
      ['모르는 필드', { name: 'x', hack: 1 }],
    ])('400: %s', async (_label, body) => {
      const { roomId } = await makeRoom();
      const a = await join(roomId, '민수');
      expect((await add(roomId, a.token, body)).status).toBe(400);
    });

    it('같은 이름(대소문자 무시) 중복 → 409', async () => {
      const { roomId } = await makeRoom();
      const a = await join(roomId, '민수');
      expect((await add(roomId, a.token, { name: 'Cafe A' })).status).toBe(201);
      expect((await add(roomId, a.token, { name: 'cafe a' })).status).toBe(409);
    });

    it('방당 20개 — 19개에서 동시 5건 추가해도 20개를 넘지 않는다', async () => {
      const { roomId } = await makeRoom();
      const a = await join(roomId, '민수');
      for (let i = 0; i < 19; i++) {
        expect((await add(roomId, a.token, { name: `곳${i}` })).status).toBe(201);
      }
      const rs = await Promise.all(
        [0, 1, 2, 3, 4].map((i) => add(roomId, a.token, { name: `동시${i}` })),
      );
      expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
      expect(rs.filter((r) => r.status === 409)).toHaveLength(4);
      expect((await results(roomId)).places).toHaveLength(20);
    });
  });

  describe('투표·집계', () => {
    it('PUT 두 번 = 1표, DELETE 두 번 = 0표 (멱등)', async () => {
      const { roomId } = await makeRoom();
      const a = await join(roomId, '민수');
      const b = await join(roomId, '지수');
      const { body } = await add(roomId, a.token, { name: '곱창' });
      expect((await vote(roomId, b.token, body.placeId)).status).toBe(200);
      expect((await vote(roomId, b.token, body.placeId)).status).toBe(200);
      expect((await results(roomId)).places[0].votes).toBe(2);
      await vote(roomId, b.token, body.placeId, false);
      await vote(roomId, b.token, body.placeId, false);
      await vote(roomId, a.token, body.placeId, false);
      const res = await results(roomId);
      // 0표 후보도 목록에 남는다
      expect(res.places).toHaveLength(1);
      expect(res.places[0].votes).toBe(0);
      expect(res.places[0].voters).toEqual([]);
    });

    it('정렬: 표 DESC → 등록순', async () => {
      const { roomId } = await makeRoom();
      const a = await join(roomId, '민수');
      const b = await join(roomId, '지수');
      const p1 = (await add(roomId, a.token, { name: '첫째' })).body.placeId;
      const p2 = (await add(roomId, a.token, { name: '둘째' })).body.placeId;
      const p3 = (await add(roomId, a.token, { name: '셋째' })).body.placeId;
      await vote(roomId, b.token, p3);
      const names = (await results(roomId)).places.map(
        (p: { name: string }) => p.name,
      );
      expect(names).toEqual(['셋째', '첫째', '둘째']);
      expect([p1, p2]).toHaveLength(2);
    });

    it('다른 방의 후보에는 투표 못 함 → 404', async () => {
      const r1 = await makeRoom();
      const r2 = await makeRoom();
      const a = await join(r1.roomId, '민수');
      const b = await join(r2.roomId, '남');
      const pid = (await add(r2.roomId, b.token, { name: '남의집' })).body.placeId;
      expect((await vote(r1.roomId, a.token, pid)).status).toBe(404);
    });

    it('불참자 표는 집계에서 빠지고, 복귀하면 돌아온다 (행 보존)', async () => {
      const { roomId } = await makeRoom();
      const a = await join(roomId, '민수');
      const b = await join(roomId, '지수');
      const pid = (await add(roomId, a.token, { name: '곱창' })).body.placeId;
      await vote(roomId, b.token, pid);
      expect((await results(roomId)).places[0].votes).toBe(2);

      expect((await decline(roomId, b.token, true)).status).toBe(200);
      let res = await results(roomId);
      expect(res.places[0].votes).toBe(1);
      expect(res.places[0].voters.map((v: { id: number }) => v.id)).toEqual([a.id]);
      // 불참 중엔 투표·추가 불가
      expect((await vote(roomId, b.token, pid, false)).status).toBe(409);
      expect((await add(roomId, b.token, { name: '다른곳' })).status).toBe(409);
      // 본인 표는 /me 로 보존된 채 보인다
      const me = await request(server())
        .get(`/rooms/${roomId}/participants/me`)
        .set('x-client-token', b.token);
      expect(me.body.me.placeIds).toEqual([pid]);

      await decline(roomId, b.token, false);
      res = await results(roomId);
      expect(res.places[0].votes).toBe(2);
    });
  });

  describe('삭제', () => {
    it('등록자 본인 또는 방장만 — 남의 후보는 403', async () => {
      const { roomId, creator } = await makeRoom();
      const a = await join(roomId, '민수');
      const b = await join(roomId, '지수');
      const pa = (await add(roomId, a.token, { name: 'A집' })).body.placeId;
      const pb = (await add(roomId, b.token, { name: 'B집' })).body.placeId;
      expect(
        (
          await request(server())
            .delete(`/rooms/${roomId}/places/${pa}`)
            .set('x-client-token', b.token)
        ).status,
      ).toBe(403);
      expect(
        (
          await request(server())
            .delete(`/rooms/${roomId}/places/${pa}`)
            .set('x-client-token', a.token)
        ).status,
      ).toBe(200);
      // 방장은 입장 안 했어도 creator 토큰으로 지울 수 있다
      expect(
        (
          await request(server())
            .delete(`/rooms/${roomId}/places/${pb}`)
            .set('x-creator-token', creator)
        ).status,
      ).toBe(200);
      expect((await results(roomId)).places).toEqual([]);
    });

    it('다른 방 방장 토큰으로는 못 지운다', async () => {
      const r1 = await makeRoom();
      const r2 = await makeRoom();
      const a = await join(r1.roomId, '민수');
      const pid = (await add(r1.roomId, a.token, { name: 'A집' })).body.placeId;
      const res = await request(server())
        .delete(`/rooms/${r1.roomId}/places/${pid}`)
        .set('x-creator-token', r2.creator);
      expect(res.status).toBe(403);
    });

    it('등록자가 강퇴되면 후보는 남고(createdBy null) 방장만 지울 수 있다', async () => {
      const { roomId, creator } = await makeRoom();
      const a = await join(roomId, '민수');
      const pid = (await add(roomId, a.token, { name: 'A집' })).body.placeId;
      await request(server())
        .delete(`/rooms/${roomId}/participants/${a.id}`)
        .set('x-creator-token', creator)
        .expect(200);
      const res = await results(roomId);
      expect(res.places[0].createdBy).toBeNull();
      expect(res.places[0].votes).toBe(0); // 표는 cascade 로 사라짐
      await request(server())
        .delete(`/rooms/${roomId}/places/${pid}`)
        .set('x-creator-token', creator)
        .expect(200);
    });
  });

  describe('확정·잠금 (날짜와 독립)', () => {
    it('방장만 확정 — 참여자·다른 방 방장 403, 다른 방 후보 400', async () => {
      const { roomId, creator } = await makeRoom();
      const other = await makeRoom();
      const a = await join(roomId, '민수');
      const b = await join(other.roomId, '남');
      const pid = (await add(roomId, a.token, { name: 'A집' })).body.placeId;
      const foreign = (await add(other.roomId, b.token, { name: 'B집' })).body
        .placeId;
      expect(
        (
          await request(server())
            .post(`/rooms/${roomId}/place-confirm`)
            .send({ placeId: pid })
        ).status,
      ).toBe(403);
      expect((await confirmPlace(roomId, other.creator, pid)).status).toBe(403);
      expect((await confirmPlace(roomId, creator, foreign)).status).toBe(400);
      expect((await confirmPlace(roomId, creator, pid)).status).toBe(201);
      const res = await results(roomId);
      expect(res.confirmedPlaceId).toBe(pid);
      expect(res.confirmedPlaceAt).not.toBeNull();
    });

    it('장소 확정 → 장소 쓰기 전부 423, 날짜 투표는 계속 된다', async () => {
      const { roomId, creator } = await makeRoom();
      const a = await join(roomId, '민수');
      const pid = (await add(roomId, a.token, { name: 'A집' })).body.placeId;
      await confirmPlace(roomId, creator, pid).expect(201);

      expect((await add(roomId, a.token, { name: 'B집' })).status).toBe(423);
      expect((await vote(roomId, a.token, pid, false)).status).toBe(423);
      expect(
        (
          await request(server())
            .delete(`/rooms/${roomId}/places/${pid}`)
            .set('x-creator-token', creator)
        ).status,
      ).toBe(423); // 확정된 후보는 해제 후에만 지울 수 있다

      const [d1] = await dateIds(roomId);
      await request(server())
        .put(`/rooms/${roomId}/participants/me/availabilities`)
        .set('x-client-token', a.token)
        .send({ dateIds: [d1] })
        .expect(200);
    });

    it('날짜 확정은 장소를 잠그지 않는다', async () => {
      const { roomId, creator } = await makeRoom();
      const a = await join(roomId, '민수');
      const [d1] = await dateIds(roomId);
      await request(server())
        .post(`/rooms/${roomId}/confirm`)
        .set('x-creator-token', creator)
        .send({ dateId: d1 })
        .expect(201);
      const r = await add(roomId, a.token, { name: '확정 후 올린 곳' });
      expect(r.status).toBe(201);
      await vote(roomId, a.token, r.body.placeId, false).expect(200);
    });

    it('마감이 지나면 장소 쓰기 423 — 그래도 방장은 확정할 수 있다', async () => {
      const { roomId, creator } = await makeRoom();
      const a = await join(roomId, '민수');
      const pid = (await add(roomId, a.token, { name: 'A집' })).body.placeId;
      await setDeadlinePast(roomId);
      expect((await add(roomId, a.token, { name: 'B집' })).status).toBe(423);
      expect((await vote(roomId, a.token, pid, false)).status).toBe(423);
      expect((await confirmPlace(roomId, creator, pid)).status).toBe(201);
      // 해제해도 마감은 그대로라 투표는 계속 잠김
      await unconfirmPlace(roomId, creator).expect(200);
      expect((await vote(roomId, a.token, pid, false)).status).toBe(423);
    });

    it('같은 후보 재확정은 확정 시각 유지, 해제하면 둘 다 비고 다시 열린다', async () => {
      const { roomId, creator } = await makeRoom();
      const a = await join(roomId, '민수');
      const pid = (await add(roomId, a.token, { name: 'A집' })).body.placeId;
      await confirmPlace(roomId, creator, pid).expect(201);
      const at1 = (await results(roomId)).confirmedPlaceAt;
      await new Promise((r) => setTimeout(r, 20));
      await confirmPlace(roomId, creator, pid).expect(201);
      expect((await results(roomId)).confirmedPlaceAt).toBe(at1);

      await unconfirmPlace(roomId, creator).expect(200);
      const res = await results(roomId);
      expect(res.confirmedPlaceId).toBeNull();
      expect(res.confirmedPlaceAt).toBeNull();
      expect((await add(roomId, a.token, { name: 'B집' })).status).toBe(201);
    });

    it('투표↔확정 동시 — 확정 뒤에 커밋되는 투표는 없다', async () => {
      const { roomId, creator } = await makeRoom();
      const a = await join(roomId, '민수');
      const b = await join(roomId, '지수');
      const pid = (await add(roomId, a.token, { name: 'A집' })).body.placeId;
      const [v, c] = await Promise.all([
        vote(roomId, b.token, pid),
        confirmPlace(roomId, creator, pid),
      ]);
      expect(c.status).toBe(201);
      const res = await results(roomId);
      // 투표가 먼저 잡았으면 200 + 2표, 확정이 먼저면 423 + 1표. 둘이 섞이지 않는다.
      if (v.status === 200) expect(res.places[0].votes).toBe(2);
      else {
        expect(v.status).toBe(423);
        expect(res.places[0].votes).toBe(1);
      }
    });
  });

  describe('불참 규칙 (장소 투표가 날짜 확정 뒤에도 열려 있어서 바뀐 부분)', () => {
    it('날짜 확정 뒤: 불참 복귀는 허용(장소 열림), 새 불참은 423', async () => {
      const { roomId, creator } = await makeRoom();
      const a = await join(roomId, '민수');
      const b = await join(roomId, '지수');
      await decline(roomId, b.token, true).expect(200);
      const [d1] = await dateIds(roomId);
      await request(server())
        .post(`/rooms/${roomId}/confirm`)
        .set('x-creator-token', creator)
        .send({ dateId: d1 })
        .expect(201);

      expect((await decline(roomId, a.token, true)).status).toBe(423);
      expect((await decline(roomId, b.token, false)).status).toBe(200);
      // 복귀한 지수가 장소를 올릴 수 있다
      expect((await add(roomId, b.token, { name: '지수픽' })).status).toBe(201);
    });

    it('날짜·장소 둘 다 확정이면 복귀도 423', async () => {
      const { roomId, creator } = await makeRoom();
      const a = await join(roomId, '민수');
      const b = await join(roomId, '지수');
      const pid = (await add(roomId, a.token, { name: 'A집' })).body.placeId;
      await decline(roomId, b.token, true).expect(200);
      const [d1] = await dateIds(roomId);
      await request(server())
        .post(`/rooms/${roomId}/confirm`)
        .set('x-creator-token', creator)
        .send({ dateId: d1 })
        .expect(201);
      await confirmPlace(roomId, creator, pid).expect(201);
      expect((await decline(roomId, b.token, false)).status).toBe(423);
    });

    it('장소 확정은 "대상" 을 고정할 뿐 — 불참하면 표수는 줄고 확정 장소는 그대로', async () => {
      const { roomId, creator } = await makeRoom();
      const a = await join(roomId, '민수');
      const b = await join(roomId, '지수');
      const pid = (await add(roomId, a.token, { name: 'A집' })).body.placeId;
      await vote(roomId, b.token, pid).expect(200);
      await confirmPlace(roomId, creator, pid).expect(201);
      await decline(roomId, b.token, true).expect(200); // 날짜 미확정이라 허용
      const res = await results(roomId);
      expect(res.confirmedPlaceId).toBe(pid);
      expect(res.places[0].votes).toBe(1);
    });

    it('날짜 미확정이면 기존처럼 불참·복귀 자유', async () => {
      const { roomId } = await makeRoom();
      const a = await join(roomId, '민수');
      await decline(roomId, a.token, true).expect(200);
      await decline(roomId, a.token, false).expect(200);
    });
  });

  describe('캘린더(.ics)', () => {
    it('장소가 확정되면 LOCATION 과 링크가 들어간다', async () => {
      const { roomId, creator } = await makeRoom();
      const a = await join(roomId, '민수');
      const [d1] = await dateIds(roomId);
      await request(server())
        .put(`/rooms/${roomId}/participants/me/availabilities`)
        .set('x-client-token', a.token)
        .send({ dateIds: [d1] })
        .expect(200);
      const pid = (
        await add(roomId, a.token, {
          name: '을지로, 노가리',
          url: 'https://naver.me/abc',
        })
      ).body.placeId;
      let ics = (await request(server()).get(`/rooms/${roomId}/winner.ics`)).text;
      expect(ics).not.toContain('LOCATION:');
      await confirmPlace(roomId, creator, pid).expect(201);
      ics = (await request(server()).get(`/rooms/${roomId}/winner.ics`)).text;
      expect(ics).toContain('LOCATION:을지로\\, 노가리');
      expect(ics).toContain('https://naver.me/abc');
    });
  });

  it('방을 지우면 후보·표도 같이 사라진다 (확정 후보가 있어도)', async () => {
    const { roomId, creator } = await makeRoom();
    const a = await join(roomId, '민수');
    const pid = (await add(roomId, a.token, { name: 'A집' })).body.placeId;
    await confirmPlace(roomId, creator, pid).expect(201);
    const pool = getTestPool();
    await pool.query(`DELETE FROM rooms WHERE id = $1`, [roomId]);
    const left = await pool.query(
      `SELECT (SELECT COUNT(*) FROM room_places)::int AS p,
              (SELECT COUNT(*) FROM place_votes)::int AS v`,
    );
    expect(left.rows[0]).toEqual({ p: 0, v: 0 });
  });
});
