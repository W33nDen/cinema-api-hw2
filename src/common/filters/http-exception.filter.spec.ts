import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/showings?page=0' }),
    }),
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    json.mockClear();
    status.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it('keeps validation messages and request path', () => {
    new HttpExceptionFilter().catch(
      new BadRequestException(['page має бути від 1']),
      host,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      timestamp: expect.any(String) as string,
      path: '/showings?page=0',
      message: ['page має бути від 1'],
      error: 'Bad Request',
    });
  });

  it('does not expose unexpected database/internal error details', () => {
    new HttpExceptionFilter().catch(
      new Error('password=secret; SQL SELECT from private_table'),
      host,
    );
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      timestamp: expect.any(String) as string,
      path: '/showings?page=0',
      message: 'Внутрішня помилка сервера',
      error: 'Internal Server Error',
    });
  });
});
