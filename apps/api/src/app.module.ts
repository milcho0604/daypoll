import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { RoomsModule } from './rooms/rooms.module';
import { ParticipantsModule } from './participants/participants.module';
import { AdminModule } from './admin/admin.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    CommonModule,
    DatabaseModule,
    RealtimeModule,
    RoomsModule,
    ParticipantsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
