#!/usr/bin/env node
// 가장 단순한 SQL 파일 순서 실행 마이그레이션 러너.
// db/migrations/*.sql 을 파일명 사전순으로 1회씩 적용. 이미 적용된 건 건너뜀.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, '..', 'db', 'migrations');

// 모노레포 루트의 .env 를 직접 파싱(외부 deps 없이).
const rootEnv = resolve(__dirname, '..', '..', '..', '.env');
if (existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2];
    }
  }
}

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgres://whenever:whenever@127.0.0.1:5433/whenever';

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`);

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

for (const file of files) {
  const { rowCount } = await client.query(
    'SELECT 1 FROM _migrations WHERE name = $1',
    [file],
  );
  if (rowCount && rowCount > 0) {
    console.log(`[skip] ${file}`);
    continue;
  }
  const sql = readFileSync(join(migrationsDir, file), 'utf8');
  console.log(`[apply] ${file}`);
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO _migrations(name) VALUES ($1)', [file]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[fail] ${file}`, err);
    process.exit(1);
  }
}

await client.end();
console.log('migrations done');
