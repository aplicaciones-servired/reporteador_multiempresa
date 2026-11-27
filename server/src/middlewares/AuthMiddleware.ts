import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../core/errors/AppError.js';
import type { AuthService } from '../modules/auth/AuthService.js';
import type { CompanyContext } from '../modules/reports/core/ReportTypes.js';

export const AUTH_COOKIE_NAME = 'rm_token';
export const EXTERNAL_AUTH_COOKIE_NAME = 'AuthTokenGaneCompany';
export const DEFAULT_AUTH_COOKIE_NAMES: readonly string[] = [
  EXTERNAL_AUTH_COOKIE_NAME,
  'access_token',
  'token',
  'jwt',
  'auth_token',
  AUTH_COOKIE_NAME,
];

export interface AuthenticatedRequestUser {
  readonly userId: number;
  readonly login: string;
  readonly roleId: number;
  readonly roleCode: string;
  readonly fullName?: string;
  readonly roleName?: string;
  readonly allowedCompanyCodes?: string[];
  readonly isExternalIdentity?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedRequestUser;
      authorizedCompany?: CompanyContext;
    }
  }
}

export class AuthMiddleware {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieNames: readonly string[] = DEFAULT_AUTH_COOKIE_NAMES,
  ) {}

  public async authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const candidates = this.extractCandidateTokens(req);
      if (candidates.length === 0) {
        throw new UnauthorizedError('Debes iniciar sesión primero');
      }

      let lastError: unknown;
      for (const token of candidates) {
        try {
          const payload = await this.authService.authenticateToken(token);
          req.authUser = {
            userId: payload.sub,
            login: payload.login,
            roleId: payload.roleId,
            roleCode: payload.roleCode,
            ...(payload.fullName !== undefined ? { fullName: payload.fullName } : {}),
            ...(payload.roleName !== undefined ? { roleName: payload.roleName } : {}),
            ...(payload.allowedCompanyCodes !== undefined
              ? { allowedCompanyCodes: payload.allowedCompanyCodes }
              : {}),
            ...(payload.isExternalIdentity !== undefined
              ? { isExternalIdentity: payload.isExternalIdentity }
              : {}),
          };
          next();
          return;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new UnauthorizedError('Sesión inválida o expirada');
    } catch (error) {
      next(error);
    }
  }

  private extractCandidateTokens(req: Request): string[] {
    const tokens: string[] = [];

    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const bearer = authHeader.slice(7).trim();
      if (bearer.length > 0) {
        tokens.push(bearer);
      }
    }

    for (const cookieName of this.cookieNames) {
      const cookieToken = req.cookies?.[cookieName];
      if (typeof cookieToken === 'string' && cookieToken.trim().length > 0) {
        tokens.push(cookieToken.trim());
      }
    }

    return [...new Set(tokens)];
  }
}
