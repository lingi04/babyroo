import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import { ApplicationError } from './application-error';

@Catch(ApplicationError)
export class ApplicationErrorFilter implements ExceptionFilter {
  catch(error: ApplicationError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<{
      status: (statusCode: number) => { json: (body: unknown) => void };
    }>();
    response.status(error.statusCode).json({
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
    });
  }
}
