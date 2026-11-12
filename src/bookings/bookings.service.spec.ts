import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { HallEntity } from '../halls/entities/hall-record.entity';
import { HallsService } from '../halls/halls.service';
import { ShowingEntity } from '../showings/entities/showing-record.entity';
import { BookingsService } from './bookings.service';
import { BookingEntity } from './entities/booking-record.entity';
import { BookingSeatEntity } from './entities/booking-seat.entity';
import { Booking } from './entities/booking.entity';

const showingId = '11111111-1111-4111-8111-111111111111';
const bookingId = '22222222-2222-4222-8222-222222222222';

describe('BookingsService', () => {
  let service: BookingsService;
  let showing: ShowingEntity | null;
  let findShowing: jest.Mock;
  let insertSeats: jest.Mock;
  let saveBooking: jest.Mock;
  let transaction: jest.Mock;
  let getRepository: jest.Mock;

  beforeEach(() => {
    const hall = Object.assign(new HallEntity(), {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Зал 1',
      rows: 3,
      seatsPerRow: 5,
    });
    showing = Object.assign(new ShowingEntity(), {
      id: showingId,
      hall,
      price: 12500,
    });
    findShowing = jest.fn(() => Promise.resolve(showing));
    const showingRepository = { findOne: findShowing };
    saveBooking = jest.fn((entity: BookingEntity) =>
      Promise.resolve(
        Object.assign(entity, {
          id: bookingId,
          createdAt: new Date('2026-11-12T12:00:00Z'),
        }),
      ),
    );
    const bookingRepository = {
      create: (dto: Partial<BookingEntity>) =>
        Object.assign(new BookingEntity(), dto),
      save: saveBooking,
    };
    insertSeats = jest.fn(() =>
      Promise.resolve({ identifiers: [], generatedMaps: [], raw: [] }),
    );
    const seatRepository = {
      create: (dto: Partial<BookingSeatEntity>) =>
        Object.assign(new BookingSeatEntity(), dto),
      insert: insertSeats,
    };
    getRepository = jest.fn((entity: unknown) => {
      if (entity === ShowingEntity) return showingRepository;
      if (entity === BookingEntity) return bookingRepository;
      if (entity === BookingSeatEntity) return seatRepository;
      throw new Error('Unexpected transaction repository');
    });
    const manager = { getRepository } as unknown as EntityManager;
    transaction = jest.fn(
      async (callback: (manager: EntityManager) => Promise<Booking>) =>
        callback(manager),
    );
    const dataSource = { transaction } as unknown as DataSource;
    const halls = new HallsService(
      {} as Repository<HallEntity>,
      {} as Repository<ShowingEntity>,
    );
    // Reads are intentionally separate from transaction repositories.
    service = new BookingsService(
      dataSource,
      halls,
      {} as Repository<BookingEntity>,
      {} as Repository<BookingSeatEntity>,
      {} as Repository<ShowingEntity>,
    );
  });

  it('uses transaction-scoped repositories and computes price × seat count', async () => {
    const booking = await service.create(showingId, {
      seats: [
        { row: 1, seat: 1 },
        { row: 1, seat: 2 },
      ],
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(getRepository).toHaveBeenCalledWith(BookingEntity);
    expect(getRepository).toHaveBeenCalledWith(BookingSeatEntity);
    expect(booking.totalPrice).toBe(25000);
    expect(booking.seats).toEqual([
      { row: 1, seat: 1 },
      { row: 1, seat: 2 },
    ]);
    expect(insertSeats).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ bookingId, showingId, row: 1, seat: 1 }),
        expect.objectContaining({ bookingId, showingId, row: 1, seat: 2 }),
      ]),
    );
  });

  it('rejects seats outside the hall before any booking write', async () => {
    await expect(
      service.create(showingId, { seats: [{ row: 4, seat: 1 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(saveBooking).not.toHaveBeenCalled();
    expect(insertSeats).not.toHaveBeenCalled();
  });

  it('rejects missing showings before writing', async () => {
    showing = null;
    await expect(
      service.create(showingId, { seats: [{ row: 1, seat: 1 }] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(saveBooking).not.toHaveBeenCalled();
  });

  it('guards the PostgreSQL integer range for calculated totalPrice', async () => {
    if (showing) showing.price = 2_147_483_647;
    await expect(
      service.create(showingId, {
        seats: [
          { row: 1, seat: 1 },
          { row: 1, seat: 2 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(saveBooking).not.toHaveBeenCalled();
  });

  it('translates only the booking-seat unique constraint into a clean 409', async () => {
    const driverError = Object.assign(new Error('SQL duplicate key details'), {
      code: '23505',
      constraint: 'uq_booking_seats_showing_row_seat',
    });
    insertSeats.mockRejectedValueOnce(
      new QueryFailedError('INSERT', [], driverError),
    );
    await expect(
      service.create(showingId, { seats: [{ row: 1, seat: 1 }] }),
    ).rejects.toEqual(
      new ConflictException('Одне або кілька місць уже заброньовані'),
    );
  });

  it('does not disguise unrelated database failures as a seat conflict', async () => {
    const error = new Error('Connection interrupted');
    insertSeats.mockRejectedValueOnce(error);
    await expect(
      service.create(showingId, { seats: [{ row: 1, seat: 1 }] }),
    ).rejects.toBe(error);
  });
});
