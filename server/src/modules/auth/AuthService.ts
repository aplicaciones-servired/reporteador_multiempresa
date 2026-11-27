import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { UnauthorizedError } from '../../core/errors/AppError.js';
import type { ICompanyRepository, IUserRepository } from '../../repositories/contracts.js';
import type { CompanyContext } from '../reports/core/ReportTypes.js';
import type { AuthenticatedUserRecord } from '../../repositories/contracts.js';

export interface AuthTokenPayload {
  readonly sub: number;
  readonly login: string;
  readonly roleId: number;
  readonly roleCode: string;
}

export interface PublicUserProfile {
  readonly id: number;
  readonly login: string;
  readonly fullName: string;
  readonly roleCode: string;
  readonly roleName: string;
  readonly companies: CompanyContext[];
}

export interface LoginResult {
  readonly token: string;
  readonly user: PublicUserProfile;
}

export class AuthService {
  private readonly externalJwtSecret: string;

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly companyRepository: ICompanyRepository,
    private readonly jwtSecret: string,
    private readonly jwtExpiresIn: string,
    private readonly allowLegacyPlaintextPasswords = false,
    externalJwtSecret = jwtSecret,
  ) {
    this.externalJwtSecret = externalJwtSecret.trim() || jwtSecret;
  }

  public async login(login: string, password: string): Promise<LoginResult> {
    const user = await this.userRepository.findByLogin(login.trim());
    if (!user || !user.isActive || !user.role.isActive) {
      throw new UnauthorizedError('Credenciales inválidas o usuario inactivo');
    }

    const passwordMatches = await this.verifyPassword(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError('Credenciales inválidas o usuario inactivo');
    }

    await this.userRepository.updateLastLogin(user.id, new Date());
    const companies = await this.companyRepository.findByRoleId(user.role.id);

    const payload: AuthTokenPayload = {
      sub: user.id,
      login: user.login,
      roleId: user.role.id,
      roleCode: user.role.code,
    };

    const signOptions: SignOptions = {
      algorithm: 'HS256',
      expiresIn: this.jwtExpiresIn as SignOptions['expiresIn'],
    };
    const token = jwt.sign(payload, this.jwtSecret, signOptions);

    return {
      token,
      user: {
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        roleCode: user.role.code,
        roleName: user.role.name,
        companies,
      },
    };
  }

  public verifyToken(token: string): AuthTokenPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
      }) as unknown as AuthTokenPayload;
      if (!decoded || typeof decoded.sub !== 'number' || typeof decoded.roleId !== 'number') {
        throw new UnauthorizedError('Token de sesión inválido');
      }
      return decoded;
    } catch {
      throw new UnauthorizedError('Sesión inválida o expirada');
    }
  }

  public async authenticateToken(token: string): Promise<AuthTokenPayload> {
    const decoded = this.verifyRawJwt(token);

    if (
      typeof decoded.username !== 'string' &&
      typeof decoded.sub === 'number' &&
      typeof decoded.roleId === 'number' &&
      typeof decoded.login === 'string' &&
      typeof decoded.roleCode === 'string'
    ) {
      return {
        sub: decoded.sub,
        login: decoded.login,
        roleId: decoded.roleId,
        roleCode: decoded.roleCode,
      };
    }

    const user = await this.resolveExternalUser(decoded);
    if (!user || !user.isActive || !user.role.isActive) {
      throw new UnauthorizedError('Usuario autenticado no registrado o inactivo en el reporteador');
    }

    return {
      sub: user.id,
      login: user.login,
      roleId: user.role.id,
      roleCode: user.role.code,
    };
  }

  private verifyRawJwt(token: string): Record<string, unknown> {
    const secrets =
      this.externalJwtSecret !== this.jwtSecret
        ? [this.jwtSecret, this.externalJwtSecret]
        : [this.jwtSecret];

    for (const secret of secrets) {
      try {
        const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
        if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
          return decoded as Record<string, unknown>;
        }
      } catch {
        // Probar siguiente secreto configurado si existe
      }
    }

    throw new UnauthorizedError('Sesión inválida o expirada');
  }

  private async resolveExternalUser(
    decoded: Record<string, unknown>,
  ): Promise<AuthenticatedUserRecord | null> {
    const username = this.extractUsernameClaim(decoded);
    if (username) {
      return this.userRepository.findByLogin(username);
    }

    if (typeof decoded.sub === 'string' && decoded.sub.trim().length > 0) {
      const subTrimmed = decoded.sub.trim();
      const byLogin = await this.userRepository.findByLogin(subTrimmed);
      if (byLogin) {
        return byLogin;
      }
      if (/^\d+$/.test(subTrimmed)) {
        return this.userRepository.findById(Number(subTrimmed));
      }
      return null;
    }

    const numericId = this.extractNumericIdClaim(decoded);
    if (numericId !== null) {
      return this.userRepository.findById(numericId);
    }

    return null;
  }

  private extractUsernameClaim(decoded: Record<string, unknown>): string | null {
    const nestedUser =
      decoded.user && typeof decoded.user === 'object' && !Array.isArray(decoded.user)
        ? (decoded.user as Record<string, unknown>)
        : null;
    const nestedData =
      decoded.data && typeof decoded.data === 'object' && !Array.isArray(decoded.data)
        ? (decoded.data as Record<string, unknown>)
        : null;

    const candidates: unknown[] = [
      decoded.username,
      decoded.login,
      decoded.usuario,
      decoded.preferred_username,
      typeof decoded.user === 'string' ? decoded.user : undefined,
      nestedUser?.username,
      nestedUser?.login,
      nestedUser?.usuario,
      nestedData?.username,
      nestedData?.login,
      nestedData?.usuario,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return null;
  }

  private extractNumericIdClaim(decoded: Record<string, unknown>): number | null {
    for (const raw of [decoded.sub, decoded.id, decoded.userId]) {
      if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) {
        return raw;
      }
    }
    return null;
  }

  public async getProfile(userId: number): Promise<PublicUserProfile> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.isActive || !user.role.isActive) {
      throw new UnauthorizedError('Usuario no disponible o inactivo');
    }
    const companies = await this.companyRepository.findByRoleId(user.role.id);

    return {
      id: user.id,
      login: user.login,
      fullName: user.fullName,
      roleCode: user.role.code,
      roleName: user.role.name,
      companies,
    };
  }

  private async verifyPassword(plain: string, stored: string): Promise<boolean> {
    if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
      return bcrypt.compare(plain, stored);
    }

    if (this.allowLegacyPlaintextPasswords) {
      const inputBuf = Buffer.from(plain, 'utf8');
      const storedBuf = Buffer.from(stored, 'utf8');
      if (inputBuf.length !== storedBuf.length) {
        return false;
      }
      return timingSafeEqual(inputBuf, storedBuf);
    }

    return false;
  }
}
