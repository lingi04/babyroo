export class ApplicationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string) {
    super('NOT_FOUND', message, 404);
  }
}

