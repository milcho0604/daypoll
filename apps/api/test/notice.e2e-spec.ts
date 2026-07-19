import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { closeTestPool, resetDb } from './setup';

const ADMIN = process.env.ADMIN_TOKEN ?? 'test-admin-token-32-chars-XXXXXX';

describe('notice e2e', () => {
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
  const create = (body: Record<string, unknown>) =>
    withAdmin(request(server()).post('/admin/notices')).send(body);
  const publish = (id: number, published: boolean) =>
    withAdmin(request(server()).post(`/admin/notices/${id}/publish`)).send({
      published,
    });

  describe('public GET /notice', () => {
    it('returns null when nothing published', async () => {
      const r = await request(server()).get('/notice');
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ notice: null });
    });

    it('needs no auth', async () => {
      const r = await request(server()).get('/notice'); // no token
      expect(r.status).toBe(200);
    });
  });

  describe('admin auth', () => {
    it('401 to create without token', async () => {
      const r = await request(server())
        .post('/admin/notices')
        .send({ title: 'x', body: 'y' });
      expect(r.status).toBe(401);
    });
    it('401 with wrong token', async () => {
      const r = await request(server())
        .post('/admin/notices')
        .set('x-admin-token', 'wrong')
        .send({ title: 'x', body: 'y' });
      expect(r.status).toBe(401);
    });
    it('401 to list without token', async () => {
      const r = await request(server()).get('/admin/notices');
      expect(r.status).toBe(401);
    });
  });

  describe('validation', () => {
    it('400 when title missing', async () => {
      const r = await create({ body: 'y' });
      expect(r.status).toBe(400);
    });
    it('400 when body missing', async () => {
      const r = await create({ title: 'x' });
      expect(r.status).toBe(400);
    });
    it('400 when title too long', async () => {
      const r = await create({ title: 'a'.repeat(121), body: 'y' });
      expect(r.status).toBe(400);
    });
    it('400 when scheduledAt is not ISO8601', async () => {
      const r = await create({ title: 'x', body: 'y', scheduledAt: 'tomorrow' });
      expect(r.status).toBe(400);
    });
    it('400 when scheduledAt has no timezone (date only)', async () => {
      const r = await create({ title: 'x', body: 'y', scheduledAt: '2026-07-20' });
      expect(r.status).toBe(400);
    });
    it('400 when scheduledAt has no timezone (local datetime)', async () => {
      const r = await create({
        title: 'x',
        body: 'y',
        scheduledAt: '2026-07-20T15:00:00',
      });
      expect(r.status).toBe(400);
    });
    it('accepts Z and +09:00 offsets', async () => {
      expect(
        (await create({ title: 'z', body: 'y', scheduledAt: '2026-07-20T15:00:00.000Z' }))
          .status,
      ).toBe(201);
      expect(
        (await create({ title: 'o', body: 'y', scheduledAt: '2026-07-21T00:00:00+09:00' }))
          .status,
      ).toBe(201);
    });
    it('rejects unknown fields (forbidNonWhitelisted)', async () => {
      const r = await create({ title: 'x', body: 'y', evil: 1 });
      expect(r.status).toBe(400);
    });
  });

  describe('lifecycle', () => {
    it('create → draft (not visible publicly) → publish → visible', async () => {
      const c = await create({
        title: '점검 안내',
        body: '첫 줄\n둘째 줄',
        scheduledAt: '2026-07-20T15:00:00.000Z',
      });
      expect(c.status).toBe(201);
      const id = c.body.id as number;
      expect(c.body.published).toBe(false);

      // 초안이라 공개 GET 은 아직 null
      expect((await request(server()).get('/notice')).body.notice).toBeNull();

      // 게시
      const p = await publish(id, true);
      expect(p.status).toBe(201);

      const pub = await request(server()).get('/notice');
      expect(pub.body.notice).toMatchObject({
        id,
        title: '점검 안내',
        body: '첫 줄\n둘째 줄', // 줄바꿈 보존
        published: true,
        scheduledAt: '2026-07-20T15:00:00.000Z', // ISO 왕복
      });
    });

    it('shows the most recently PUBLISHED notice, not most recently created', async () => {
      // A 를 먼저 만들고(오래된 초안), B 를 나중에 만든다.
      const a = await create({ title: 'A', body: 'a' });
      const b = await create({ title: 'B', body: 'b' });
      // 하지만 게시는 B 먼저, A 를 나중에 → published_at 기준으로 A 가 노출돼야 한다.
      await publish(b.body.id, true);
      await new Promise((r) => setTimeout(r, 10));
      await publish(a.body.id, true);
      const r = await request(server()).get('/notice');
      expect(r.body.notice.title).toBe('A'); // created_at 이면 B 가 나와 실패
    });

    it('unpublish falls back to the previous published one', async () => {
      const a = await create({ title: 'A', body: 'a' });
      const b = await create({ title: 'B', body: 'b' });
      await publish(a.body.id, true);
      await publish(b.body.id, true);
      await publish(b.body.id, false); // B 내림
      const r = await request(server()).get('/notice');
      expect(r.body.notice.title).toBe('A');
    });

    it('edit updates fields and bumps updatedAt', async () => {
      const c = await create({ title: '원본', body: 'x' });
      const id = c.body.id as number;
      const before = c.body.updatedAt as string;
      // updatedAt 이 실제로 바뀌도록 살짝 대기
      await new Promise((r) => setTimeout(r, 20));
      const u = await withAdmin(
        request(server()).patch(`/admin/notices/${id}`),
      ).send({ title: '수정됨', body: 'y', scheduledAt: null });
      expect(u.status).toBe(200);
      expect(u.body.title).toBe('수정됨');
      expect(u.body.scheduledAt).toBeNull();
      expect(new Date(u.body.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(before).getTime(),
      );
    });

    it('delete removes it', async () => {
      const c = await create({ title: 'del', body: 'x' });
      const id = c.body.id as number;
      await publish(id, true);
      const d = await withAdmin(
        request(server()).delete(`/admin/notices/${id}`),
      );
      expect(d.status).toBe(200);
      expect((await request(server()).get('/notice')).body.notice).toBeNull();
    });

    it('404 on publish/patch/delete of missing id', async () => {
      expect((await publish(999999, true)).status).toBe(404);
      const patch = await withAdmin(
        request(server()).patch('/admin/notices/999999'),
      ).send({ title: 'x', body: 'y' });
      expect(patch.status).toBe(404);
      const del = await withAdmin(
        request(server()).delete('/admin/notices/999999'),
      );
      expect(del.status).toBe(404);
    });

    it('admin list includes drafts', async () => {
      await create({ title: 'draft', body: 'x' });
      const pubd = await create({ title: 'pub', body: 'y' });
      await publish(pubd.body.id, true);
      const r = await withAdmin(request(server()).get('/admin/notices'));
      expect(r.status).toBe(200);
      expect(r.body).toHaveLength(2);
      const titles = (r.body as { title: string }[]).map((n) => n.title);
      expect(titles).toContain('draft');
      expect(titles).toContain('pub');
    });
  });
});
