import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { HallsService } from '../halls/halls.service';
import { Seat } from '../halls/entities/seat.entity';
import { ShowingEntity } from '../showings/entities/showing-record.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Booking, SeatStatus } from './entities/booking.entity';
import { BookingEntity } from './entities/booking-record.entity';
import { BookingSeatEntity } from './entities/booking-seat.entity';

const seatKey = (seat: Seat) => `${seat.row}:${seat.seat}`;
const seatLabel = (seat: Seat) => `ряд ${seat.row}, місце ${seat.seat}`;
const MAX_INT = 2_147_483_647;

@Injectable()
export class BookingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly hallsService: HallsService,
    @InjectRepository(BookingEntity)
    private readonly bookings: Repository<BookingEntity>,
    @InjectRepository(BookingSeatEntity)
    private readonly bookingSeats: Repository<BookingSeatEntity>,
    @InjectRepository(ShowingEntity)
    private readonly showings: Repository<ShowingEntity>,
  ) {}

  async findAll(): Promise<Booking[]> {
    const rows = await this.bookings.find({
      relations: { seats: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return rows.map((row) => this.toView(row));
  }

  async findByShowing(showingId: string): Promise<Booking[]> {
    await this.requireShowing(showingId);
    const rows = await this.bookings.find({
      where: { showingId },
      relations: { seats: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return rows.map((row) => this.toView(row));
  }

  async create(showingId: string, dto: CreateBookingDto): Promise<Booking> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        // Never use injected repositories inside a transaction: they can use
        // another pooled connection and their writes would not be rolled back.
        const showingRepo = manager.getRepository(ShowingEntity);
        const bookingRepo = manager.getRepository(BookingEntity);
        const seatRepo = manager.getRepository(BookingSeatEntity);
        const showing = await showingRepo.findOne({
          where: { id: showingId },
          relations: { hall: true },
        });
        if (!showing) {
          throw new NotFoundException(`Сеанс з id ${showingId} не знайдено`);
        }
        const hall = showing.hall;
        const seats: Seat[] = dto.seats.map(({ row, seat }) => ({ row, seat }));
        const outside = seats.filter(
          (seat) => !this.hallsService.hasSeat(hall, seat),
        );
        if (outside.length) {
          throw new BadRequestException(
            `Місць немає в залі "${hall.name}" (${hall.rows} рядів × ${hall.seatsPerRow} місць): ${outside.map(seatLabel).join('; ')}`,
          );
        }
        const totalPrice = showing.price * seats.length;
        if (!Number.isSafeInteger(totalPrice) || totalPrice > MAX_INT) {
          throw new BadRequestException(
            'Загальна сума бронювання перевищує допустиме значення',
          );
        }
        const booking = await bookingRepo.save(
          bookingRepo.create({ showingId, totalPrice }),
        );
        const seatRows = seats.map((seat) =>
          seatRepo.create({
            bookingId: booking.id,
            showingId,
            row: seat.row,
            seat: seat.seat,
          }),
        );
        // The unique index arbitrates simultaneous requests; no check-then-write race.
        await seatRepo.insert(seatRows);
        booking.seats = seatRows;
        return this.toView(booking);
      });
    } catch (error) {
      // Reaching here means TypeORM has already rolled the whole transaction back.
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
          constraint?: string;
        };
        if (
          driverError.code === '23505' &&
          driverError.constraint === 'uq_booking_seats_showing_row_seat'
        ) {
          throw new ConflictException('Одне або кілька місць уже заброньовані');
        }
      }
      throw error;
    }
  }

  async getSeatMap(showingId: string): Promise<SeatStatus[]> {
    const showing = await this.showings.findOne({
      where: { id: showingId },
      relations: { hall: true },
    });
    if (!showing) {
      throw new NotFoundException(`Сеанс з id ${showingId} не знайдено`);
    }
    const booked = new Set(
      (await this.bookingSeats.findBy({ showingId })).map(seatKey),
    );
    return this.hallsService
      .getSeats(showing.hall)
      .map((seat) => ({ ...seat, isBooked: booked.has(seatKey(seat)) }));
  }

  async remove(id: string): Promise<void> {
    const { affected } = await this.bookings.delete(id);
    if (!affected) {
      throw new NotFoundException(`Бронювання з id ${id} не знайдено`);
    }
    // PostgreSQL ON DELETE CASCADE removes the seats, not a service-side loop.
  }

  private async requireShowing(id: string): Promise<ShowingEntity> {
    const showing = await this.showings.findOneBy({ id });
    if (!showing) throw new NotFoundException(`Сеанс з id ${id} не знайдено`);
    return showing;
  }

  private toView(row: BookingEntity): Booking {
    return {
      id: row.id,
      showingId: row.showingId,
      seats: (row.seats ?? []).map((seat) => ({
        row: seat.row,
        seat: seat.seat,
      })),
      totalPrice: row.totalPrice,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
