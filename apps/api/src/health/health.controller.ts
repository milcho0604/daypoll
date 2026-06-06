import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

@Controller('health')
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get()
  async check() {
    let db: 'ok' | 'down' = 'down';
    try {
      const r = await this.pool.query<{ ok: number }>('SELECT 1 as ok');
      if (r.rows[0]?.ok === 1) db = 'ok';
    } catch {
      db = 'down';
    }
    const ts = new Date().toISOString();
    // DB 죽으면 503 — CD 의 curl -fsS 가 false-negative 안 잡는 것 방지.
    if (db !== 'ok') {
      throw new ServiceUnavailableException({ status: 'error', db, ts });
    }
    return { status: 'ok', db, ts };
  }
}
