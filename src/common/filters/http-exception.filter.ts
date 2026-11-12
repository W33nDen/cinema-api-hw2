import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** One response shape for validation, business errors and unexpected failures. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter<unknown> {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const payload =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as { message?: string | string[]; error?: string })
        : null;
    const message = isHttpException
      ? typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (payload?.message ?? exception.message)
      : 'Внутрішня помилка сервера';
    const error = isHttpException
      ? (payload?.error ?? exception.name)
      : 'Internal Server Error';

    if (status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${status}`);
    }
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      error,
    });
  }
}
