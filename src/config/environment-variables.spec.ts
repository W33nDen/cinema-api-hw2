import { validate } from './environment-variables';

const validEnvironment = {
  PORT: '3000',
  NODE_ENV: 'test',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'cinema',
  DB_PASSWORD: 'cinema_password',
  DB_DATABASE: 'cinema_test',
};

describe('Environment configuration', () => {
  it('validates and converts numeric connection parameters', () => {
    expect(validate(validEnvironment)).toMatchObject({
      PORT: 3000,
      NODE_ENV: 'test',
      DB_PORT: 5432,
      DB_DATABASE: 'cinema_test',
    });
  });

  it.each(['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'])(
    'fails when required %s is missing',
    (key) => {
      const environment: Record<string, unknown> = { ...validEnvironment };
      delete environment[key];
      expect(() => validate(environment)).toThrow(key);
    },
  );

  it.each(['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'])(
    'fails when required %s is empty',
    (key) => {
      expect(() => validate({ ...validEnvironment, [key]: '' })).toThrow(key);
    },
  );

  it.each(['0', '65536', '1.5', 'abc', ''])(
    'rejects invalid DB_PORT %s',
    (port) => {
      expect(() => validate({ ...validEnvironment, DB_PORT: port })).toThrow(
        'DB_PORT',
      );
    },
  );

  it('rejects an unsupported environment mode', () => {
    expect(() =>
      validate({ ...validEnvironment, NODE_ENV: 'staging' }),
    ).toThrow('NODE_ENV');
  });
});
