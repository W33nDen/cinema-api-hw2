import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCinemaSchema1700000000000 implements MigrationInterface {
  name = 'CreateCinemaSchema1700000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      CREATE TABLE "films" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" varchar NOT NULL,
        "duration_minutes" integer NOT NULL,
        "release_year" integer NOT NULL,
        CONSTRAINT "PK_films_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "halls" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "rows" integer NOT NULL,
        "seats_per_row" integer NOT NULL,
        CONSTRAINT "PK_halls_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_halls_name" UNIQUE ("name")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_halls_name_normalized" ON "halls" (lower(btrim("name")))`,
    );
    await queryRunner.query(`
      CREATE TABLE "showings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "film_id" uuid NOT NULL,
        "hall_id" uuid NOT NULL,
        "starts_at" timestamptz NOT NULL,
        "price" integer NOT NULL,
        CONSTRAINT "PK_showings_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_showings_film" FOREIGN KEY ("film_id") REFERENCES "films"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "FK_showings_hall" FOREIGN KEY ("hall_id") REFERENCES "halls"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "showing_id" uuid NOT NULL,
        "total_price" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bookings_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bookings_showing" FOREIGN KEY ("showing_id") REFERENCES "showings"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "booking_seats" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "booking_id" uuid NOT NULL,
        "showing_id" uuid NOT NULL,
        "row" integer NOT NULL,
        "seat" integer NOT NULL,
        CONSTRAINT "PK_booking_seats_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_booking_seats_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_booking_seats_showing" FOREIGN KEY ("showing_id") REFERENCES "showings"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_booking_seats_showing_row_seat" ON "booking_seats" ("showing_id", "row", "seat")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_booking_seats_showing_row_seat"`,
    );
    await queryRunner.query(`DROP TABLE "booking_seats"`);
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TABLE "showings"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_halls_name_normalized"`);
    await queryRunner.query(`DROP TABLE "halls"`);
    await queryRunner.query(`DROP TABLE "films"`);
  }
}
