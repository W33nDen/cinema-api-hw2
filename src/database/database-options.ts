import { ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import { BookingEntity } from '../bookings/entities/booking-record.entity';
import { BookingSeatEntity } from '../bookings/entities/booking-seat.entity';
import { FilmEntity } from '../films/entities/film-record.entity';
import { HallEntity } from '../halls/entities/hall-record.entity';
import { ShowingEntity } from '../showings/entities/showing-record.entity';
import { EnvironmentVariables } from '../config/environment-variables';

export const databaseEntities = [
  FilmEntity,
  HallEntity,
  ShowingEntity,
  BookingEntity,
  BookingSeatEntity,
];

/** The same options are used by the Nest application and the TypeORM CLI. */
export function createDatabaseOptions(
  config: ConfigService<EnvironmentVariables, true>,
) {
  return {
    type: 'postgres' as const,
    host: config.get('DB_HOST', { infer: true }),
    port: config.get('DB_PORT', { infer: true }),
    username: config.get('DB_USERNAME', { infer: true }),
    password: config.get('DB_PASSWORD', { infer: true }),
    database: config.get('DB_DATABASE', { infer: true }),
    entities: databaseEntities,
    migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
    synchronize: false,
    migrationsRun: false,
    uuidExtension: 'pgcrypto' as const,
  };
}
