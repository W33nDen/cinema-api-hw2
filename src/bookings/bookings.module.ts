import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HallsModule } from '../halls/halls.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingEntity } from './entities/booking-record.entity';
import { BookingSeatEntity } from './entities/booking-seat.entity';
import { ShowingEntity } from '../showings/entities/showing-record.entity';

@Module({
  imports: [
    HallsModule,
    TypeOrmModule.forFeature([BookingEntity, BookingSeatEntity, ShowingEntity]),
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
