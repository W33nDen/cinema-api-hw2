import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { validationExceptionFactory } from '../src/common/validation/validation-exception.factory';

type IdBody = { id: string };
type ShowingBody = IdBody & {
  filmTitle: string;
  hallName: string;
  startsAt: string;
  price: number;
};
type PageBody = {
  items: ShowingBody[];
  total: number;
  page: number;
  limit: number;
};
type SeatBody = { row: number; seat: number; isBooked: boolean };
type BookingBody = IdBody & {
  showingId: string;
  totalPrice: number;
  seats: { row: number; seat: number }[];
};
const unknownId = '00000000-0000-4000-8000-000000000000';
const year = new Date().getUTCFullYear() + 2;
const day = `${year}-01-15`;
const nextDay = `${year}-01-16`;

describe('Cinema API + PostgreSQL (e2e)', () => {
  let app: INestApplication<App>;
  let database: DataSource;

  async function startApp() {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const instance = moduleRef.createNestApplication<INestApplication<App>>();
    instance.useLogger(false);
    instance.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: validationExceptionFactory,
      }),
    );
    instance.useGlobalFilters(new HttpExceptionFilter());
    await instance.init();
    return instance;
  }

  async function clearDatabase() {
    if (!String(database.options.database).endsWith('_test')) {
      throw new Error('Refusing to truncate a database not ending in _test');
    }
    await database.query(
      'TRUNCATE TABLE booking_seats, bookings, showings, halls, films CASCADE',
    );
  }

  async function catalog() {
    const film = await request(app.getHttpServer())
      .post('/films')
      .send({ title: 'Земля', durationMinutes: 75, releaseYear: 1930 })
      .expect(201);
    const hall = await request(app.getHttpServer())
      .post('/halls')
      .send({ name: 'Зал 1', rows: 3, seatsPerRow: 5 })
      .expect(201);
    return {
      filmId: (film.body as IdBody).id,
      hallId: (hall.body as IdBody).id,
    };
  }

  async function createShowing(
    ids: { filmId: string; hallId: string },
    startsAt = `${day}T18:00:00Z`,
  ) {
    const response = await request(app.getHttpServer())
      .post('/showings')
      .send({ ...ids, startsAt, price: 12500 })
      .expect(201);
    return response.body as ShowingBody;
  }

  async function fixture() {
    const ids = await catalog();
    return { ...ids, showing: await createShowing(ids) };
  }

  beforeAll(async () => {
    app = await startApp();
    database = app.get(DataSource);
    if (!String(database.options.database).endsWith('_test')) {
      throw new Error('E2E tests require a dedicated *_test database');
    }
    // Create the test schema only through the same migrations used in production.
    await database.runMigrations();
  });
  beforeEach(clearDatabase);
  afterAll(async () => {
    if (database?.isInitialized) await clearDatabase();
    await app?.close();
  });

  it('keeps film CRUD, hall seats and normalized unique names', async () => {
    const { filmId, hallId } = await catalog();
    await request(app.getHttpServer()).get('/films').expect(200);
    await request(app.getHttpServer()).get(`/films/${filmId}`).expect(200);
    await request(app.getHttpServer())
      .patch(`/films/${filmId}`)
      .send({ durationMinutes: 80 })
      .expect(200)
      .expect(({ body }: { body: { durationMinutes: number } }) => {
        expect(body.durationMinutes).toBe(80);
      });
    await request(app.getHttpServer()).get('/halls').expect(200);
    const hall = await request(app.getHttpServer())
      .get(`/halls/${hallId}`)
      .expect(200);
    expect((hall.body as { seats: SeatBody[] }).seats).toHaveLength(15);
    await request(app.getHttpServer())
      .post('/halls')
      .send({ name: '  зал 1  ', rows: 2, seatsPerRow: 2 })
      .expect(409);
    await request(app.getHttpServer()).delete(`/films/${filmId}`).expect(204);
    await request(app.getHttpServer()).delete(`/halls/${hallId}`).expect(204);
    await request(app.getHttpServer()).get(`/films/${filmId}`).expect(404);
    await request(app.getHttpServer()).get(`/halls/${hallId}`).expect(404);
  });

  it('rejects missing/invalid data with the unified error format', async () => {
    const response = await request(app.getHttpServer())
      .post('/films')
      .send({ title: 'Фільм', durationMinutes: '75', unexpected: true })
      .expect(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      path: '/films',
      error: 'Bad Request',
      message: expect.any(Array) as unknown[],
      timestamp: expect.any(String) as string,
    });
    await request(app.getHttpServer())
      .post('/films')
      .send({
        title: 'Фільм',
        durationMinutes: 2_147_483_648,
        releaseYear: 2000,
      })
      .expect(400);
    await request(app.getHttpServer()).get('/films/not-a-uuid').expect(400);
    await request(app.getHttpServer()).get(`/films/${unknownId}`).expect(404);
    await request(app.getHttpServer())
      .delete(`/halls/${unknownId}`)
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/bookings/${unknownId}`)
      .expect(404);
  });

  it('preserves showing responses and protects film/hall foreign keys', async () => {
    const { filmId, hallId, showing } = await fixture();
    expect(showing).toMatchObject({
      filmTitle: 'Земля',
      hallName: 'Зал 1',
      startsAt: `${day}T18:00:00.000Z`,
      price: 12500,
    });
    expect(showing).not.toHaveProperty('filmId');
    expect(showing).not.toHaveProperty('hallId');
    await request(app.getHttpServer())
      .get(`/showings/${showing.id}`)
      .expect(200);
    await request(app.getHttpServer()).delete(`/films/${filmId}`).expect(409);
    await request(app.getHttpServer()).delete(`/halls/${hallId}`).expect(409);
    await request(app.getHttpServer())
      .post('/showings')
      .send({
        filmId: unknownId,
        hallId,
        startsAt: `${day}T18:00:00Z`,
        price: 100,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/showings')
      .send({
        filmId,
        hallId: unknownId,
        startsAt: `${day}T18:00:00Z`,
        price: 100,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/showings')
      .send({ filmId, hallId, startsAt: '2020-01-01T00:00:00Z', price: 100 })
      .expect(400);
  });

  it('paginates, filters and sorts in SQL with stable id tie-breaking', async () => {
    const ids = await catalog();
    const a = await createShowing(ids, `${day}T12:00:00Z`);
    const b = await createShowing(ids, `${day}T18:00:00Z`);
    const c = await createShowing(ids, `${day}T18:00:00Z`);
    const d = await createShowing(ids, `${nextDay}T01:00:00+03:00`);
    const other = await request(app.getHttpServer())
      .post('/films')
      .send({
        title: 'Тіні забутих предків',
        durationMinutes: 97,
        releaseYear: 1965,
      })
      .expect(201);
    const e = await createShowing(
      { ...ids, filmId: (other.body as IdBody).id },
      `${nextDay}T12:00:00Z`,
    );
    const defaultPage = await request(app.getHttpServer())
      .get('/showings')
      .expect(200);
    expect(defaultPage.body).toMatchObject({ total: 5, page: 1, limit: 20 });
    expect((defaultPage.body as PageBody).items).toHaveLength(5);
    const tieIds = [b.id, c.id].sort();
    const expectedAsc = [a.id, ...tieIds, d.id, e.id];
    expect((defaultPage.body as PageBody).items.map((item) => item.id)).toEqual(
      expectedAsc,
    );
    const secondPage = await request(app.getHttpServer())
      .get('/showings?page=2&limit=2')
      .expect(200);
    expect(secondPage.body).toMatchObject({ total: 5, page: 2, limit: 2 });
    expect((secondPage.body as PageBody).items.map((item) => item.id)).toEqual(
      expectedAsc.slice(2, 4),
    );
    const descending = await request(app.getHttpServer())
      .get('/showings?sort=desc')
      .expect(200);
    expect((descending.body as PageBody).items.map((item) => item.id)).toEqual([
      e.id,
      d.id,
      ...tieIds,
      a.id,
    ]);
    const filtered = await request(app.getHttpServer())
      .get(`/showings?date=${day}&filmId=${ids.filmId}&limit=2`)
      .expect(200);
    expect(filtered.body).toMatchObject({ total: 4, page: 1, limit: 2 });
    expect((filtered.body as PageBody).items.map((item) => item.id)).toEqual(
      expectedAsc.slice(0, 2),
    );
    const empty = await request(app.getHttpServer())
      .get(`/showings?date=${day}&filmId=${(other.body as IdBody).id}`)
      .expect(200);
    expect(empty.body).toEqual({ items: [], total: 0, page: 1, limit: 20 });
    const outside = await request(app.getHttpServer())
      .get('/showings?page=99&limit=2')
      .expect(200);
    expect(outside.body).toEqual({ items: [], total: 5, page: 99, limit: 2 });
    const hugePage = await request(app.getHttpServer())
      .get('/showings?page=1e100')
      .expect(200);
    expect(hugePage.body).toEqual({
      items: [],
      total: 5,
      page: 1e100,
      limit: 20,
    });
  });

  it.each([
    'page=0',
    'page=-1',
    'page=1.5',
    'page=abc',
    'page=',
    'limit=0',
    'limit=101',
    'limit=1.5',
    'limit=abc',
    'limit=',
    'sort=invalid',
    'sort=ASC',
    'date=15-01-2030',
    'date=2030-02-30',
    'filmId=not-a-uuid',
    'extra=1',
  ])('rejects invalid query %s', async (query) => {
    await request(app.getHttpServer()).get(`/showings?${query}`).expect(400);
  });

  it('creates booking, preserves route shapes, cascades deletion and permits rebooking', async () => {
    const { showing } = await fixture();
    const bookingResponse = await request(app.getHttpServer())
      .post(`/showings/${showing.id}/bookings`)
      .send({
        seats: [
          { row: 1, seat: 1 },
          { row: 1, seat: 2 },
        ],
      })
      .expect(201);
    const booking = bookingResponse.body as BookingBody;
    expect(booking).toMatchObject({ showingId: showing.id, totalPrice: 25000 });
    expect(booking.seats).toEqual([
      { row: 1, seat: 1 },
      { row: 1, seat: 2 },
    ]);
    const all = await request(app.getHttpServer()).get('/bookings').expect(200);
    expect(all.body).toHaveLength(1);
    const list = await request(app.getHttpServer())
      .get(`/showings/${showing.id}/bookings`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    await request(app.getHttpServer())
      .delete(`/bookings/${booking.id}`)
      .expect(204);
    const seatRows = await database.query<unknown[]>(
      'SELECT id FROM booking_seats WHERE booking_id = $1',
      [booking.id],
    );
    expect(seatRows).toHaveLength(0);
    const map = await request(app.getHttpServer())
      .get(`/showings/${showing.id}/seats`)
      .expect(200);
    expect((map.body as SeatBody[]).every((seat) => !seat.isBooked)).toBe(true);
    await request(app.getHttpServer())
      .post(`/showings/${showing.id}/bookings`)
      .send({ seats: [{ row: 1, seat: 1 }] })
      .expect(201);
  });

  it('rolls back the entire booking when any requested seat is already taken', async () => {
    const { showing } = await fixture();
    await request(app.getHttpServer())
      .post(`/showings/${showing.id}/bookings`)
      .send({ seats: [{ row: 1, seat: 2 }] })
      .expect(201);
    const conflict = await request(app.getHttpServer())
      .post(`/showings/${showing.id}/bookings`)
      .send({
        seats: [
          { row: 1, seat: 3 },
          { row: 1, seat: 2 },
        ],
      })
      .expect(409);
    expect(JSON.stringify(conflict.body)).not.toMatch(
      /23505|INSERT|constraint|booking_seats|duplicate key/i,
    );
    const bookings = await database.query<unknown[]>('SELECT id FROM bookings');
    const bookedSeats = await database.query<unknown[]>(
      'SELECT id FROM booking_seats',
    );
    expect(bookings).toHaveLength(1);
    expect(bookedSeats).toHaveLength(1);
    const map = await request(app.getHttpServer())
      .get(`/showings/${showing.id}/seats`)
      .expect(200);
    expect(
      (map.body as SeatBody[]).find((seat) => seat.row === 1 && seat.seat === 3)
        ?.isBooked,
    ).toBe(false);
  });

  it('allows exactly one concurrent booking and leaves no loser booking/seats', async () => {
    const { showing } = await fixture();
    const responses = await Promise.all(
      [2, 3].map((seat) =>
        request(app.getHttpServer())
          .post(`/showings/${showing.id}/bookings`)
          .send({
            seats: [
              { row: 2, seat: 1 },
              { row: 2, seat },
            ],
          }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    const rows = await database.query<unknown[]>('SELECT id FROM bookings');
    const seats = await database.query<unknown[]>(
      'SELECT id FROM booking_seats',
    );
    expect(rows).toHaveLength(1);
    expect(seats).toHaveLength(2);
  });

  it('validates booking seats and returns 404 for nonexistent showings', async () => {
    const { showing } = await fixture();
    for (const seats of [
      [],
      [{ row: 4, seat: 1 }],
      [{ row: 1, seat: 6 }],
      [{ row: 0, seat: 1 }],
      [
        { row: 1, seat: 1 },
        { row: 1, seat: 1 },
      ],
    ]) {
      await request(app.getHttpServer())
        .post(`/showings/${showing.id}/bookings`)
        .send({ seats })
        .expect(400);
    }
    await request(app.getHttpServer())
      .post(`/showings/${unknownId}/bookings`)
      .send({ seats: [{ row: 1, seat: 1 }] })
      .expect(404);
    await request(app.getHttpServer())
      .get(`/showings/${unknownId}/seats`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/showings/${unknownId}/bookings`)
      .expect(404);
  });

  it('retains data after a complete application restart', async () => {
    const { filmId } = await catalog();
    await app.close();
    app = await startApp();
    database = app.get(DataSource);
    await request(app.getHttpServer()).get(`/films/${filmId}`).expect(200);
  });

  it('describes paginated response and query parameters in OpenAPI', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Cinema API').build(),
    );
    const operation = document.paths['/showings'].get;
    expect(operation?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'page', in: 'query' }),
        expect.objectContaining({ name: 'limit', in: 'query' }),
        expect.objectContaining({ name: 'sort', in: 'query' }),
      ]),
    );
    const schemas = document.components?.schemas ?? {};
    expect(
      Object.values(schemas).some(
        (schema) =>
          'properties' in schema &&
          schema.properties &&
          ['items', 'total', 'page', 'limit'].every((key) =>
            Object.hasOwn(schema.properties ?? {}, key),
          ),
      ),
    ).toBe(true);
  });
});
