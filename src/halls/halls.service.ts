import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateHallDto } from './dto/create-hall.dto';
import { Hall, HallWithSeats } from './entities/hall.entity';
import { Seat } from './entities/seat.entity';
import { HallEntity } from './entities/hall-record.entity';
import { ShowingEntity } from '../showings/entities/showing-record.entity';

@Injectable()
export class HallsService {
  constructor(
    @InjectRepository(HallEntity)
    private readonly halls: Repository<HallEntity>,
    @InjectRepository(ShowingEntity)
    private readonly showings: Repository<ShowingEntity>,
  ) {}

  async create(dto: CreateHallDto): Promise<Hall> {
    try {
      return await this.halls.save(this.halls.create(dto));
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException(`Зал з назвою "${dto.name}" вже існує`);
      }
      throw error;
    }
  }

  findAll(): Promise<Hall[]> {
    return this.halls.find({ order: { name: 'ASC', id: 'ASC' } });
  }

  findById(id: string): Promise<Hall | null> {
    return this.halls.findOneBy({ id });
  }

  async findOne(id: string): Promise<Hall> {
    const hall = await this.findById(id);
    if (!hall) throw new NotFoundException(`Зал з id ${id} не знайдено`);
    return hall;
  }

  async findOneWithSeats(id: string): Promise<HallWithSeats> {
    const hall = await this.findOne(id);
    return { ...hall, seats: this.getSeats(hall) };
  }

  getSeats(hall: Pick<Hall, 'rows' | 'seatsPerRow'>): Seat[] {
    const seats: Seat[] = [];
    for (let row = 1; row <= hall.rows; row++) {
      for (let seat = 1; seat <= hall.seatsPerRow; seat++)
        seats.push({ row, seat });
    }
    return seats;
  }

  hasSeat(hall: Pick<Hall, 'rows' | 'seatsPerRow'>, seat: Seat): boolean {
    return (
      seat.row >= 1 &&
      seat.row <= hall.rows &&
      seat.seat >= 1 &&
      seat.seat <= hall.seatsPerRow
    );
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    if (await this.showings.countBy({ hallId: id })) {
      throw new ConflictException(
        `Зал з id ${id} не можна видалити: у ньому є сеанси`,
      );
    }
    try {
      await this.halls.delete(id);
    } catch (error) {
      if ((error as { code?: string }).code === '23503') {
        throw new ConflictException(
          `Зал з id ${id} не можна видалити: у ньому є сеанси`,
        );
      }
      throw error;
    }
  }
}
