import {
  Global,
  Inject,
  Module,
  OnApplicationShutdown,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const PG_POOL = Symbol('PG_POOL');

@Injectable()
class PoolShutdown implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown() {
    await this.pool.end().catch(() => {
      /* 이미 종료된 경우 무시 */
    });
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        if (!url) {
          throw new Error('DATABASE_URL is not set');
        }
        return new Pool({ connectionString: url, max: 10 });
      },
    },
    PoolShutdown,
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}
