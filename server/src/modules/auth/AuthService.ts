import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { UnauthorizedError } from '../../core/errors/AppError.js';
import { DEFAULT_ROLES } from '../../database/CatalogSeedData.js';
import type { AuthenticatedRequestUser } from '../../middlewares/AuthMiddleware.js';
import type { ICompanyRepository, IUserRepository } from '../../repositories/contracts.js';
import type { CompanyContext } from '../reports/core/ReportTypes.js';
import type { AuthenticatedUserRecord } from '../../repositories/contracts.js';

export interface AuthTokenPayload {
  readonly sub: number;
  readonly login: string;
  readonly roleId: number;
  readonly roleCode: string;
  readonly fullName?: string;
  readonly roleName?: string;
  readonly allowedCompanyCodes?: string[];
  readonly isExternalIdentity?: boolean;
}

interface ResolvedRoleSpec {
  readonly id: number;
  readonly code: string;
  readonly name: string;
}

type CompanyScope = 'both' | 'multired' | 'servired';

const INACTIVE_EXTERNAL_STATES = new Set([
  'inactivo',
  'inactive',
  'bloqueado',
  'blocked',
  'deshabilitado',
  'disabled',
  'suspendido',
  'suspended',
  '0',
  'false',
]);

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeRoleKey(value: string): string {
  return stripDiacritics(value)
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, '_');
}

const ROLE_BY_CODE = new Map<string, ResolvedRoleSpec>(
  DEFAULT_ROLES.map((spec, idx) => [
    spec.code,
    { id: idx + 1, code: spec.code, name: spec.name },
  ]),
);

const ROLE_BY_NORMALIZED_CODE = new Map<string, ResolvedRoleSpec>(
  DEFAULT_ROLES.map((spec, idx) => [
    normalizeRoleKey(spec.code),
    { id: idx + 1, code: spec.code, name: spec.name },
  ]),
);

function requireDefaultRole(code: string): ResolvedRoleSpec {
  return ROLE_BY_CODE.get(code) ?? { id: 0, code, name: code };
}

function hasAnyKeyword(key: string, keywords: readonly string[]): boolean {
  return keywords.some((kw) => key.includes(kw));
}

function matchSpecificRole(key: string, scope: CompanyScope): ResolvedRoleSpec | null {
  if (!key) {
    return null;
  }

  const direct = ROLE_BY_NORMALIZED_CODE.get(key);
  if (direct) {
    return direct;
  }

  if (
    hasAnyKeyword(key, [
      'SOPORTE',
      'APLICACIONES',
      'ADMIN',
      'SISTEMAS',
      'TECNOLOGIA',
      'DESARROLLO',
      'GERENCIA',
    ])
  ) {
    return requireDefaultRole('ADMIN');
  }

  if (hasAnyKeyword(key, ['CUMPLIMIENTO', 'SARLAFT', 'SAGRILAFT'])) {
    return requireDefaultRole('CUMPLIMIENTO');
  }

  if (hasAnyKeyword(key, ['CONTABILIDAD', 'CONTABLE'])) {
    return requireDefaultRole(
      scope === 'servired' ? 'CONTABILIDAD-SERVIRED' : 'CONTABILIDAD-MULTIRED',
    );
  }

  if (hasAnyKeyword(key, ['AUDITORIA', 'AUDITOR', 'CONTROL_INTERNO'])) {
    if (key.includes('OPERATIV')) {
      return requireDefaultRole('AUDITORIA-OPERATIVA');
    }
    if (scope === 'servired') {
      return requireDefaultRole('AUDITORIA-SERVIRED');
    }
    return requireDefaultRole('AUDITORIA');
  }

  if (hasAnyKeyword(key, ['COMERCIAL', 'VENTAS'])) {
    return requireDefaultRole(
      scope === 'servired' ? 'COMERCIAL-SERVIRED' : 'COMERCIAL-MULTIRED',
    );
  }

  if (hasAnyKeyword(key, ['CONTEO', 'TESORERIA', 'RECAUDO'])) {
    return requireDefaultRole(
      scope === 'servired' ? 'CONTEO_SERVIRED' : 'CONTEO_MULTIRED',
    );
  }

  if (hasAnyKeyword(key, ['ADMINISTRACION', 'ADMINISTRATIV'])) {
    return requireDefaultRole(
      scope === 'servired' ? 'ADMINISTRACION_SERVIRED' : 'ADMINISTRACION_MULTIRED',
    );
  }

  if (hasAnyKeyword(key, ['AUXILIAR', 'OFICINA'])) {
    return requireDefaultRole('AUXILIAR OFICINA');
  }

  return null;
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

    if (typeof decoded.state === 'string') {
      const normalizedState = stripDiacritics(decoded.state).trim().toLowerCase();
      if (INACTIVE_EXTERNAL_STATES.has(normalizedState)) {
        throw new UnauthorizedError('Usuario inactivo en el sistema de autenticación');
      }
    }

    const user = await this.resolveExternalUser(decoded);
    if (user) {
      if (!user.isActive || !user.role.isActive) {
        throw new UnauthorizedError('Usuario autenticado no registrado o inactivo en el reporteador');
      }

      return {
        sub: user.id,
        login: user.login,
        roleId: user.role.id,
        roleCode: user.role.code,
      };
    }

    const fallback = this.resolveLoginUnificadoFallback(decoded);
    if (fallback) {
      return fallback;
    }

    throw new UnauthorizedError('Usuario autenticado no registrado o inactivo en el reporteador');
  }

  private resolveLoginUnificadoFallback(
    decoded: Record<string, unknown>,
  ): AuthTokenPayload | null {
    const username = this.extractUsernameClaim(decoded);
    if (!username) {
      return null;
    }

    const rawCompany = typeof decoded.company === 'string' ? decoded.company.trim() : '';
    const rawProcess = typeof decoded.process === 'string' ? decoded.process.trim() : '';
    const rawSubProcess = typeof decoded.sub_process === 'string' ? decoded.sub_process.trim() : '';

    if (!rawCompany && !rawProcess && !rawSubProcess) {
      return null;
    }

    const { scope, allowedCompanyCodes } = this.resolveCompanyScope(rawCompany);
    const role = this.resolveExternalRole(rawSubProcess, rawProcess, scope);
    const fullName = this.extractExternalFullName(decoded, username);

    return {
      sub: 0,
      login: username,
      roleId: role.id,
      roleCode: role.code,
      fullName,
      roleName: role.name,
      ...(allowedCompanyCodes ? { allowedCompanyCodes } : {}),
      isExternalIdentity: true,
    };
  }

  private resolveCompanyScope(rawCompany: string): {
    scope: CompanyScope;
    allowedCompanyCodes?: string[];
  } {
    const normalized = stripDiacritics(rawCompany).trim().toLowerCase();
    const hasMultired =
      normalized.includes('multired') ||
      normalized.includes('yumbo') ||
      normalized.includes('39627');
    const hasServired =
      normalized.includes('servired') ||
      normalized.includes('jamundi') ||
      normalized.includes('39628');

    if ((hasMultired && hasServired) || normalized.includes('ambas') || normalized.includes('todas')) {
      return { scope: 'both', allowedCompanyCodes: ['39627', '39628'] };
    }
    if (hasMultired) {
      return { scope: 'multired', allowedCompanyCodes: ['39627'] };
    }
    if (hasServired) {
      return { scope: 'servired', allowedCompanyCodes: ['39628'] };
    }
    return { scope: 'both' };
  }

  private resolveExternalRole(
    rawSubProcess: string,
    rawProcess: string,
    scope: CompanyScope,
  ): ResolvedRoleSpec {
    const subKey = normalizeRoleKey(rawSubProcess);
    const procKey = normalizeRoleKey(rawProcess);

    const bySub = matchSpecificRole(subKey, scope);
    if (bySub) {
      return bySub;
    }

    const byProc = matchSpecificRole(procKey, scope);
    if (byProc) {
      return byProc;
    }

    if (subKey.includes('FINANCIER') || procKey.includes('FINANCIER')) {
      return requireDefaultRole(
        scope === 'servired' ? 'CONTABILIDAD-SERVIRED' : 'CONTABILIDAD-MULTIRED',
      );
    }

    const fallbackLabel = rawSubProcess || rawProcess || 'SIN_PERFIL';
    return {
      id: 0,
      code: fallbackLabel,
      name: fallbackLabel,
    };
  }

  private extractExternalFullName(decoded: Record<string, unknown>, fallbackLogin: string): string {
    const names = typeof decoded.names === 'string' ? decoded.names.trim() : '';
    const lastnames = typeof decoded.lastnames === 'string' ? decoded.lastnames.trim() : '';
    const joined = [names, lastnames].filter((part) => part.length > 0).join(' ');
    if (joined) {
      return joined;
    }

    for (const candidate of [decoded.fullName, decoded.name]) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return fallbackLogin;
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

  public async getProfileForAuthUser(authUser: AuthenticatedRequestUser): Promise<PublicUserProfile> {
    if (!authUser.isExternalIdentity) {
      return this.getProfile(authUser.userId);
    }

    const roleCompanies = await this.companyRepository.findByRoleId(authUser.roleId);
    const allowedSet = authUser.allowedCompanyCodes
      ? new Set(authUser.allowedCompanyCodes)
      : null;
    const companies = allowedSet
      ? roleCompanies.filter((company) => allowedSet.has(company.code))
      : roleCompanies;

    return {
      id: authUser.userId,
      login: authUser.login,
      fullName: authUser.fullName ?? authUser.login,
      roleCode: authUser.roleCode,
      roleName: authUser.roleName ?? authUser.roleCode,
      companies,
    };
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
