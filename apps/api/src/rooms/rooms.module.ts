import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { WeatherService } from './weather.service';

@Module({
  controllers: [RoomsController],
  providers: [RoomsService, WeatherService],
  exports: [RoomsService],
})
export class RoomsModule {}
