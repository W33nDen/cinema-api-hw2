import { config } from 'dotenv';

config({ path: '.env', quiet: true });
const database = process.env.TEST_DB_DATABASE ?? 'cinema_test';
if (!database.endsWith('_test')) {
  throw new Error(
    'TEST_DB_DATABASE must end with _test: e2e tests clear its data',
  );
}
process.env.NODE_ENV = 'test';
process.env.DB_DATABASE = database;
