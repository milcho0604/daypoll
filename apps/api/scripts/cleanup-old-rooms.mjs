#!/usr/bin/env node
// 오래된 방 정리 배치 (CASCADE 로 하위 데이터 함께 삭제).
// 사용:
//   node apps/api/scripts/cleanup-old-rooms.mjs            # 90일 기본
//   node apps/api/scripts/cleanup-old-rooms.mjs --days 60  # 임의 일수
// cron 예시 (매일 새벽 4시):
//   0 4 * * * cd /path/to/whenever && node apps/api/scripts/cleanup-old-rooms.mjs --days 90 >> /var/log/whenever-cleanup.log 2>&1

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(__dirname, '..', '..', '..', '.env');
if (existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const args = process.argv.slice(2);
let days = 90;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--days' && args[i + 1]) {
    days = Math.max(1, Number(args[i + 1]));
    i++;
  }
}

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgres://whenever:whenever@127.0.0.1:5433/whenever';

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

const beforeRes = await client.query('SELECT COUNT(*)::int AS c FROM rooms');
const result = await client.query(
  `DELETE FROM rooms WHERE created_at < now() - ($1::int * interval '1 day')`,
  [days],
);
const afterRes = await client.query('SELECT COUNT(*)::int AS c FROM rooms');

await client.end();

const ts = new Date().toISOString();
console.log(
  `[${ts}] cleanup: removed=${result.rowCount ?? 0} threshold=${days}d rooms_before=${beforeRes.rows[0].c} rooms_after=${afterRes.rows[0].c}`,
);
