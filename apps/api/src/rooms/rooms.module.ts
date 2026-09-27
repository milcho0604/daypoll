import { Module } from '@nestjs/common';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { WeatherService } from './weather.service';

@Module({
  controllers: [RoomsController, PlacesController],
  providers: [RoomsService, WeatherService, PlacesService],
  exports: [RoomsService],
})
export class RoomsModule {}
