import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HallsController } from './halls.controller';
import { HallsService } from './halls.service';
import { HallEntity } from './entities/hall-record.entity';
import { ShowingEntity } from '../showings/entities/showing-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([HallEntity, ShowingEntity])],
  controllers: [HallsController],
  providers: [HallsService],
  exports: [HallsService],
})
export class HallsModule {}
