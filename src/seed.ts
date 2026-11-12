import 'dotenv/config';
import dataSource from './database/data-source';

const ids = {
  film1: '11111111-1111-4111-8111-111111111111',
  film2: '22222222-2222-4222-8222-222222222222',
  hall1: '33333333-3333-4333-8333-333333333333',
  hall2: '44444444-4444-4444-8444-444444444444',
  showing1: '55555555-5555-4555-8555-555555555555',
  showing2: '66666666-6666-4666-8666-666666666666',
  showing3: '77777777-7777-4777-8777-777777777777',
  showing4: '88888888-8888-4888-8888-888888888888',
  booking: '99999999-9999-4999-8999-999999999999',
  bookingSeat: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

async function seed(): Promise<void> {
  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO films (id, title, duration_minutes, release_year) VALUES
        ($1, 'The Matrix', 136, 1999), ($2, 'Spirited Away', 125, 2001)
        ON CONFLICT (id) DO NOTHING`,
        [ids.film1, ids.film2],
      );
      await manager.query(
        `INSERT INTO halls (id, name, rows, seats_per_row) VALUES
        ($1, 'Red Hall', 10, 12), ($2, 'Blue Hall', 8, 10)
        ON CONFLICT (id) DO NOTHING`,
        [ids.hall1, ids.hall2],
      );
      await manager.query(
        `INSERT INTO showings (id, film_id, hall_id, starts_at, price) VALUES
        ($1, $5, $7, '2030-01-02T18:00:00Z', 12000),
        ($2, $6, $8, '2030-01-03T19:30:00Z', 14000),
        ($3, $5, $7, '2030-01-04T16:00:00Z', 12000),
        ($4, $6, $8, '2030-01-05T20:00:00Z', 14000)
        ON CONFLICT (id) DO NOTHING`,
        [
          ids.showing1,
          ids.showing2,
          ids.showing3,
          ids.showing4,
          ids.film1,
          ids.film2,
          ids.hall1,
          ids.hall2,
        ],
      );
      await manager.query(
        `INSERT INTO bookings (id, showing_id, total_price, created_at) VALUES ($1, $2, 12000, now()) ON CONFLICT (id) DO NOTHING`,
        [ids.booking, ids.showing1],
      );
      await manager.query(
        `INSERT INTO booking_seats (id, booking_id, showing_id, row, seat) VALUES ($1, $2, $3, 1, 1) ON CONFLICT (id) DO NOTHING`,
        [ids.bookingSeat, ids.booking, ids.showing1],
      );
    });
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
