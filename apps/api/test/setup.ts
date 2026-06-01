// e2e 셋업: 테스트 DB URL 강제 + 모든 테이블 truncate 헬퍼.
import { Pool } from 'pg';

export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://whenever:whenever@127.0.0.1:5433/whenever_test';

process.env.DATABASE_URL = TEST_DB_URL;
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.API_PORT = '0';

let _pool: Pool | null = null;

export function getTestPool(): Pool {
  if (!_pool) _pool = new Pool({ connectionString: TEST_DB_URL });
  return _pool;
}

export async function resetDb() {
  const pool = getTestPool();
  // 자식부터 → 부모 순서. CASCADE는 안전망.
  await pool.query(`
    TRUNCATE TABLE availabilities, participants, room_dates, rooms RESTART IDENTITY CASCADE;
  `);
}

export async function closeTestPool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
