import type { NextFunction, Request, Response } from 'express';
import { TooManyRequestsError } from '../core/errors/AppError.js';

export interface RateLimiterOptions {
  readonly windowMs: number;
  readonly maxAttempts: number;
  readonly keyPrefix?: string;
  readonly message?: string;
  readonly skip?: (req: Request) => boolean;
}

export class RateLimiterMiddleware {
  private readonly buckets = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly maxAttempts: number;
  private readonly keyPrefix: string;
  private readonly message: string;
  private readonly skip?: (req: Request) => boolean;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxAttempts = options.maxAttempts;
    this.keyPrefix = options.keyPrefix ?? 'global';
    this.message =
      options.message ?? 'Demasiados intentos. Intenta nuevamente más tarde';
    this.skip = options.skip;
  }

  public handle(req: Request, res: Response, next: NextFunction): void {
    if (this.skip?.(req)) {
      next();
      return;
    }

    const now = Date.now();
    const windowStart = now - this.windowMs;
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${this.keyPrefix}:${clientIp}`;

    if (this.buckets.size > 1000) {
      this.pruneExpired(windowStart);
    }

    const activeTimestamps = (this.buckets.get(key) ?? []).filter(
      (ts) => ts > windowStart,
    );

    if (activeTimestamps.length >= this.maxAttempts) {
      const oldestTimestamp = activeTimestamps[0] ?? now;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldestTimestamp + this.windowMs - now) / 1000),
      );
      res.setHeader('Retry-After', String(retryAfterSeconds));
      this.buckets.set(key, activeTimestamps);
      next(new TooManyRequestsError(this.message));
      return;
    }

    activeTimestamps.push(now);
    this.buckets.set(key, activeTimestamps);
    next();
  }

  public reset(): void {
    this.buckets.clear();
  }

  private pruneExpired(windowStart: number): void {
    for (const [key, timestamps] of this.buckets.entries()) {
      const active = timestamps.filter((ts) => ts > windowStart);
      if (active.length === 0) {
        this.buckets.delete(key);
      } else {
        this.buckets.set(key, active);
      }
    }
  }
}
