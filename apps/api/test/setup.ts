// e2e 셋업: 테스트 DB URL 강제 + 모든 테이블 truncate 헬퍼.
import { Pool, type PoolClient } from 'pg';

export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://whenever:whenever@127.0.0.1:5433/whenever_test';

process.env.DATABASE_URL = TEST_DB_URL;
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.API_PORT = '0';
process.env.ADMIN_TOKEN =
  process.env.ADMIN_TOKEN ?? 'test-admin-token-32-chars-XXXXXX';
// e2e에서는 레이트리밋 비활성화 (반복 요청이 정상)
process.env.RATE_LIMIT_DISABLED = '1';

let _pool: Pool | null = null;

// 테스트 DB 는 하나를 같이 쓴다. 다른 터미널·세션·워크트리에서 e2e 를 동시에 돌리면
// 한쪽의 resetDb(TRUNCATE) 가 다른 쪽 테스트 도중 데이터를 지워 "방금 만든 방이 404"
// 같은 가짜 실패가 난다. 스펙 프로세스마다 advisory lock 을 잡아 실행을 줄 세운다.
// 락은 이 프로세스의 전용 연결에 걸리고, closeTestPool 이나 프로세스 종료 때 풀린다.
const E2E_LOCK_KEY = 7_202_611; // 임의 상수 — 이 저장소 e2e 전용
let _lockClient: PoolClient | null = null;

async function ensureExclusive(pool: Pool) {
  if (_lockClient) return;
  _lockClient = await pool.connect();
  await _lockClient.query('SELECT pg_advisory_lock($1)', [E2E_LOCK_KEY]);
}

export function getTestPool(): Pool {
  if (!_pool) _pool = new Pool({ connectionString: TEST_DB_URL });
  return _pool;
}

export async function resetDb() {
  const pool = getTestPool();
  await ensureExclusive(pool);
  // 자식부터 → 부모 순서. CASCADE는 안전망.
  await pool.query(`
    TRUNCATE TABLE availabilities, participants, room_dates, rooms RESTART IDENTITY CASCADE;
  `);
  // notices 는 rooms 와 FK 관계가 없어 별도 truncate (테스트 간 격리).
  await pool.query(`TRUNCATE TABLE notices RESTART IDENTITY CASCADE;`);
  await pool.query(`TRUNCATE TABLE page_views;`);
  await pool.query(`TRUNCATE TABLE visit_sources;`);
}

export async function closeTestPool() {
  if (_lockClient) {
    await _lockClient
      .query('SELECT pg_advisory_unlock($1)', [E2E_LOCK_KEY])
      .catch(() => undefined);
    _lockClient.release();
    _lockClient = null;
  }
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
