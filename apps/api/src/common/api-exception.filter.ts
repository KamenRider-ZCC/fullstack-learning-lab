import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

interface ErrorPayload {
  code?: unknown;
  message?: unknown;
}

interface HttpResponse {
  status(statusCode: number): HttpResponse;
  json(body: unknown): void;
}

const statusCodes: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'FILE_TOO_LARGE',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<{ url: string }>();
    const response = http.getResponse<HttpResponse>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = this.readPayload(exception);

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception);
    }

    response.status(status).json({
      success: false,
      code: payload.code,
      message: payload.message,
      details: payload.details,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private readPayload(exception: unknown) {
    if (!(exception instanceof HttpException)) {
      return {
        code: 'INTERNAL_SERVER_ERROR',
        message: '服务器内部错误',
        details: undefined,
      };
    }

    const status = exception.getStatus();
    const response = exception.getResponse();
    if (typeof response === 'string') {
      return { code: statusCodes[status] || `HTTP_${status}`, message: response };
    }

    const payload = response as ErrorPayload;
    const validationMessages = Array.isArray(payload.message)
      ? payload.message.filter((item): item is string => typeof item === 'string')
      : undefined;

    return {
      code: typeof payload.code === 'string'
        ? payload.code
        : validationMessages
          ? 'VALIDATION_ERROR'
          : statusCodes[status] || `HTTP_${status}`,
      message: status === HttpStatus.PAYLOAD_TOO_LARGE
        ? '上传内容过大'
        : validationMessages
          ? '请求参数不合法'
          : typeof payload.message === 'string'
            ? payload.message
            : '请求失败',
      details: validationMessages,
    };
  }
}
