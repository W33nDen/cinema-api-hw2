import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilmsController } from './films.controller';
import { FilmsService } from './films.service';
import { FilmEntity } from './entities/film-record.entity';
import { ShowingEntity } from '../showings/entities/showing-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FilmEntity, ShowingEntity])],
  controllers: [FilmsController],
  providers: [FilmsService],
  exports: [FilmsService],
})
export class FilmsModule {}
