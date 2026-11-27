export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Datos de entrada inválidos', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado o sesión expirada') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'No tienes permisos para realizar esta acción') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Error de conexión o consulta en base de datos', details?: unknown) {
    super(message, 503, 'DATABASE_ERROR', details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Demasiados intentos. Intenta nuevamente más tarde') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}
