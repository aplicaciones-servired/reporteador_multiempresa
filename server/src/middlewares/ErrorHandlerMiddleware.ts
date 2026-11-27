import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, DatabaseError } from '../core/errors/AppError.js';

export class ErrorHandlerMiddleware {
  constructor(private readonly isProduction: boolean) {}

  public handle(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Los parámetros enviados no son válidos',
          details: err.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
      return;
    }

    if (err instanceof AppError) {
      const exposeDetails = !this.isProduction || !(err instanceof DatabaseError);
      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          ...(exposeDetails && err.details ? { details: this.sanitizeDetails(err.details) } : {}),
        },
      });
      return;
    }

    const fallbackMessage =
      !this.isProduction && err instanceof Error
        ? err.message
        : 'Error interno del servidor';

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: fallbackMessage,
      },
    });
  }

  private sanitizeDetails(details: unknown): unknown {
    if (details instanceof Error) {
      return details.message;
    }
    return details;
  }
}
