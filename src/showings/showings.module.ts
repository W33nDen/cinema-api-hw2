import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilmsModule } from '../films/films.module';
import { HallsModule } from '../halls/halls.module';
import { ShowingEntity } from './entities/showing-record.entity';
import { ShowingsController } from './showings.controller';
import { ShowingsService } from './showings.service';

@Module({
  imports: [
    FilmsModule,
    HallsModule,
    TypeOrmModule.forFeature([ShowingEntity]),
  ],
  controllers: [ShowingsController],
  providers: [ShowingsService],
  exports: [ShowingsService],
})
export class ShowingsModule {}
