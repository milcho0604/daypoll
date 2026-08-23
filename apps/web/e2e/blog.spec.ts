import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const ADMIN_TOKEN = 'playwright-admin-token';

test.describe('공개 블로그 읽기 경험', () => {
  test('모바일에서 목차·현재 위치·복사·진행률을 조작한다', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/blog/reading-guide');

    const details = page.getByRole('navigation', { name: '글 목차' }).locator('details');
    const summary = page.getByText('이 글에서 다루는 내용');
    await expect(details).toHaveAttribute('open', '');
    await summary.click();
    await expect(details).not.toHaveAttribute('open', '');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open', '');

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await page.locator('#두-번째-내용').evaluate((heading) => {
      window.scrollTo({ top: (heading as HTMLElement).offsetTop - 96 });
    });
    await expect(
      page.getByRole('link', { name: '두 번째 내용', exact: true }),
    ).toHaveAttribute('aria-current', 'location');

    await page.getByRole('button', { name: '코드 복사' }).click();
    await expect(page.getByRole('button', { name: '코드 복사' })).toHaveText(
      '복사됨',
    );
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      'const verified = true',
    );

    await page
      .getByRole('link', { name: '두 번째 내용 제목 링크 복사' })
      .click();
    expect(
      decodeURI(await page.evaluate(() => navigator.clipboard.readText())),
    ).toContain('#두-번째-내용');

    await page.locator('#마무리-점검').scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: '글 맨 위로 이동' })).toBeVisible();
    const progress = page.getByTestId('reading-progress');
    await expect.poll(async () => progress.evaluate((node) => node.getBoundingClientRect().width)).toBeGreaterThan(0);
  });

  test('검색·필터 상태를 URL에 보존하고 원문을 이벤트 속성에 노출하지 않는다', async ({
    page,
  }) => {
    const analyticsRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/_vercel/insights')) {
        analyticsRequests.push(request.postData() ?? '');
      }
    });
    await page.goto('/blog');
    await page.getByRole('searchbox', { name: '블로그 글 검색' }).fill('두 번째');
    await page.getByRole('button', { name: '찾기' }).click();
    await expect(page).toHaveURL(
      (url) => url.searchParams.get('q') === '두 번째',
    );
    await expect(page.getByText('1개의 글을 찾았어요')).toBeVisible();
    await expect(page.getByRole('link', { name: '두 번째 제품 기록' })).toBeVisible();

    await page.getByRole('button', { name: '#product' }).click();
    await expect(page).toHaveURL(/tag=product/);
    await page.getByRole('button', { name: '필터 지우기' }).click();
    await expect(page).toHaveURL(/\/blog$/);
    expect(analyticsRequests.join('\n')).not.toContain('두 번째');
  });

  test('예약 글을 목록·피드·상세에서 발행 시각 전까지 숨긴다', async ({
    page,
    request,
  }) => {
    await page.goto('/blog');
    await expect(page.getByText('예약된 미래 글')).toHaveCount(0);
    const future = await page.goto('/blog/future-note');
    expect(future?.status()).toBe(404);
    expect(await page.content()).not.toContain('FUTURE_CONTENT_SENTINEL');
    const feed = await request.get('/blog/feed.xml');
    expect(await feed.text()).not.toContain('예약된 미래 글');
    const sitemap = await request.get('/sitemap.xml');
    expect(await sitemap.text()).not.toContain('/blog/future-note');
  });

  test('공개 목록과 글 상세에 중대한 접근성 위반이 없다', async ({ page }) => {
    for (const path of ['/blog', '/blog/reading-guide']) {
      await page.goto(path);
      const result = await new AxeBuilder({ page }).analyze();
      expect(result.violations).toEqual([]);
    }
  });
});

test.describe.serial('비공개 블로그 보안', () => {
  test('본문을 숨기고 기존 어드민 권한으로만 연 뒤 로그아웃한다', async ({
    context,
    page,
  }) => {
    const response = await page.goto('/blog/private-roadmap');
    expect(response?.status()).toBe(200);
    expect(await page.content()).not.toContain('PRIVATE_CONTENT_SENTINEL');

    const direct = await context.request.get(
      '/api/blog/private/private-roadmap',
      { headers: { 'x-forwarded-for': '203.0.113.10' } },
    );
    expect(direct.status()).toBe(401);

    await page.getByLabel('관리자 토큰').fill('wrong-admin-token');
    await page.getByRole('button', { name: '관리자 권한으로 열기' }).click();
    await expect(page.locator('p[role="alert"]')).toContainText('맞지 않아요');
    expect(await page.content()).not.toContain('PRIVATE_CONTENT_SENTINEL');

    await page.getByLabel('관리자 토큰').fill(ADMIN_TOKEN);
    await page.getByRole('button', { name: '관리자 권한으로 열기' }).click();
    await expect(page.getByText('내부 전용 로드맵')).toBeVisible();
    await expect(page.getByText('PRIVATE_CONTENT_SENTINEL_9f86d081884c7d65')).toBeVisible();

    expect(
      await page.evaluate(() =>
        window.sessionStorage.getItem('whenever_admin_token'),
      ),
    ).toBe(ADMIN_TOKEN);
    expect(
      (await context.cookies()).some(
        (cookie) => cookie.name === 'whenever_blog_session',
      ),
    ).toBe(false);

    const authorized = await context.request.get(
      '/api/blog/private/private-roadmap',
      { headers: { 'x-admin-token': ADMIN_TOKEN } },
    );
    expect(authorized.status()).toBe(200);
    expect(await authorized.text()).toContain('PRIVATE_CONTENT_SENTINEL');
    expect(authorized.headers()['cache-control']).toContain('no-store');
    expect(authorized.headers()['x-robots-tag']).toContain('noindex');
    expect(authorized.headers().vary).toContain('x-admin-token');

    await page.getByRole('button', { name: '관리자 로그아웃' }).click();
    await expect(
      page.getByRole('button', { name: '관리자 권한으로 열기' }),
    ).toBeVisible();
    expect(await page.content()).not.toContain('PRIVATE_CONTENT_SENTINEL');
    expect(
      await page.evaluate(() =>
        window.sessionStorage.getItem('whenever_admin_token'),
      ),
    ).toBeNull();

    await page.evaluate((token) => {
      window.sessionStorage.setItem('whenever_admin_token', token);
    }, ADMIN_TOKEN);
    await page.reload();
    await expect(page.getByText('내부 전용 로드맵')).toBeVisible();
  });

  test('연속 실패를 제한하고 본문을 계속 숨긴다', async ({ page }) => {
    const clientIp = '203.0.113.20';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await page.request.get(
        '/api/blog/private/private-roadmap',
        {
          headers: {
            'x-admin-token': `wrong-${attempt}`,
            'x-forwarded-for': clientIp,
          },
        },
      );
      expect(response.status()).toBe(401);
    }
    const blocked = await page.request.get(
      '/api/blog/private/private-roadmap',
      {
        headers: {
          'x-admin-token': 'wrong-blocked',
          'x-forwarded-for': clientIp,
        },
      },
    );
    expect(blocked.status()).toBe(429);
    expect(await blocked.text()).not.toContain('PRIVATE_CONTENT_SENTINEL');
  });
});
