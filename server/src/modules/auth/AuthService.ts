import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { UnauthorizedError } from '../../core/errors/AppError.js';
import { DEFAULT_COMPANIES, DEFAULT_ROLES } from '../../database/CatalogSeedData.js';
import type { IUserPermissionsStore } from '../../database/UserPermissionsStore.js';
import type { AuthenticatedRequestUser } from '../../middlewares/AuthMiddleware.js';
import type {
  ILoginUnificadoRepository,
  LoginUnificadoUserDto,
} from '../../repositories/LoginUnificadoRepository.js';
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
  readonly canManagePermissions?: boolean;
}

export const ALL_DEFAULT_COMPANIES: CompanyContext[] = DEFAULT_COMPANIES.map((c, idx) => ({
  id: idx + 1,
  code: c.code,
  name: c.name,
  cityLabel: c.cityLabel,
  nit: c.nit,
  legalName: c.legalName,
  warehouseCode: c.warehouseCode,
  sisbetCode: c.sisbetCode,
  legacyZones: c.legacyZones,
  costCenters: c.costCenters,
  daneCodes: c.daneCodes,
  registrocajasUnits: c.registrocajasUnits,
  excludedChanceGames: c.excludedChanceGames,
  requirePositiveCash: c.requirePositiveCash,
}));

export interface ResolvedExternalClaimsDefaults {
  readonly roleId: number;
  readonly roleCode: string;
  readonly roleName: string;
  readonly scope: CompanyScope;
  readonly companyCodes?: string[];
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

function normalizePhrase(value: string): string {
  return stripDiacritics(value)
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, ' ');
}

export function isAdminPortalAuthorized(claims: {
  readonly process?: string;
  readonly subProcess?: string;
  readonly position?: string;
  readonly cargo?: string;
}): boolean {
  const processCandidates = [claims.process, claims.subProcess]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map(normalizePhrase);
  if (processCandidates.some((text) => text.includes('DESARROLLO INFORMATICO'))) {
    return true;
  }

  const roleCandidates = [claims.position, claims.cargo, claims.subProcess, claims.process]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map(normalizePhrase);
  return roleCandidates.some(
    (text) =>
      text.includes('DIRECTOR DE TECNOLOGIA') || text.includes('DIRECTOR TECNOLOGIA'),
  );
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

export function resolveCompanyScopeFromText(rawCompany: string): {
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

export function resolveExternalClaimsRoleAndCompanies(claims: {
  readonly company?: string;
  readonly process?: string;
  readonly subProcess?: string;
  readonly position?: string;
}): ResolvedExternalClaimsDefaults {
  const rawCompany = claims.company?.trim() ?? '';
  const rawProcess = claims.process?.trim() ?? '';
  const rawSubProcess = claims.subProcess?.trim() ?? '';
  const rawPosition = claims.position?.trim() ?? '';

  const { scope, allowedCompanyCodes } = resolveCompanyScopeFromText(rawCompany);
  const subKey = normalizeRoleKey(rawSubProcess);
  const posKey = normalizeRoleKey(rawPosition);
  const procKey = normalizeRoleKey(rawProcess);

  const matched =
    matchSpecificRole(subKey, scope) ??
    matchSpecificRole(posKey, scope) ??
    matchSpecificRole(procKey, scope);

  if (matched) {
    return {
      roleId: matched.id,
      roleCode: matched.code,
      roleName: matched.name,
      scope,
      ...(allowedCompanyCodes ? { companyCodes: allowedCompanyCodes } : {}),
    };
  }

  if (
    subKey.includes('FINANCIER') ||
    posKey.includes('FINANCIER') ||
    procKey.includes('FINANCIER')
  ) {
    const finRole = requireDefaultRole(
      scope === 'servired' ? 'CONTABILIDAD-SERVIRED' : 'CONTABILIDAD-MULTIRED',
    );
    return {
      roleId: finRole.id,
      roleCode: finRole.code,
      roleName: finRole.name,
      scope,
      ...(allowedCompanyCodes ? { companyCodes: allowedCompanyCodes } : {}),
    };
  }

  const fallbackLabel = rawPosition || rawSubProcess || rawProcess || 'SIN_PERFIL';
  return {
    roleId: 0,
    roleCode: fallbackLabel,
    roleName: fallbackLabel,
    scope,
    ...(allowedCompanyCodes ? { companyCodes: allowedCompanyCodes } : {}),
  };
}

export interface PublicUserProfile {
  readonly id: number;
  readonly login: string;
  readonly fullName: string;
  readonly roleCode: string;
  readonly roleName: string;
  readonly companies: CompanyContext[];
  readonly canManagePermissions: boolean;
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
    private readonly userPermissionsStore?: IUserPermissionsStore,
    private readonly loginUnificadoRepository?: ILoginUnificadoRepository,
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
        canManagePermissions: false,
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
        canManagePermissions: Boolean(decoded.canManagePermissions),
      };
    }

    if (typeof decoded.state === 'string') {
      const normalizedState = stripDiacritics(decoded.state).trim().toLowerCase();
      if (INACTIVE_EXTERNAL_STATES.has(normalizedState)) {
        throw new UnauthorizedError('Usuario inactivo en el sistema de autenticación');
      }
    }

    const claimUsername = this.extractUsernameClaim(decoded);
    let externalRow: LoginUnificadoUserDto | null = null;
    if (claimUsername && this.loginUnificadoRepository) {
      try {
        externalRow = await this.loginUnificadoRepository.findByUsername(claimUsername);
      } catch (error) {
        console.warn(
          `[login_unificado] No se pudo consultar usuario '${claimUsername}' en login_users:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    if (externalRow && !externalRow.isActive) {
      throw new UnauthorizedError('Usuario inactivo en el sistema de autenticación');
    }

    const canManagePermissions = isAdminPortalAuthorized({
      process:
        externalRow?.process ||
        (typeof decoded.process === 'string' ? decoded.process : undefined),
      subProcess:
        externalRow?.subProcess ||
        (typeof decoded.sub_process === 'string' ? decoded.sub_process : undefined),
      position:
        externalRow?.position ||
        (typeof decoded.position === 'string'
          ? decoded.position
          : typeof decoded.job_title === 'string'
            ? decoded.job_title
            : undefined),
      cargo: typeof decoded.cargo === 'string' ? decoded.cargo : undefined,
    });

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
        canManagePermissions,
      };
    }

    const fallback = this.resolveLoginUnificadoFallback(decoded, externalRow, canManagePermissions);
    if (fallback) {
      return fallback;
    }

    throw new UnauthorizedError('Usuario autenticado no registrado o inactivo en el reporteador');
  }

  private resolveLoginUnificadoFallback(
    decoded: Record<string, unknown>,
    externalRow: LoginUnificadoUserDto | null,
    canManagePermissions: boolean,
  ): AuthTokenPayload | null {
    const username = this.extractUsernameClaim(decoded) ?? externalRow?.username ?? null;
    if (!username) {
      return null;
    }

    const rawCompany =
      (typeof decoded.company === 'string' ? decoded.company.trim() : '') ||
      externalRow?.company ||
      '';
    const rawProcess =
      (typeof decoded.process === 'string' ? decoded.process.trim() : '') ||
      externalRow?.process ||
      '';
    const rawSubProcess =
      (typeof decoded.sub_process === 'string' ? decoded.sub_process.trim() : '') ||
      externalRow?.subProcess ||
      '';
    const rawPosition =
      (typeof decoded.cargo === 'string'
        ? decoded.cargo.trim()
        : typeof decoded.position === 'string'
          ? decoded.position.trim()
          : '') ||
      externalRow?.position ||
      '';

    if (!rawCompany && !rawProcess && !rawSubProcess && !rawPosition) {
      return null;
    }

    const resolved = resolveExternalClaimsRoleAndCompanies({
      company: rawCompany,
      process: rawProcess,
      subProcess: rawSubProcess,
      position: rawPosition,
    });
    const fullName = this.extractExternalFullName(decoded, externalRow?.fullName || username);

    return {
      sub: 0,
      login: username,
      roleId: resolved.roleId,
      roleCode: resolved.roleCode,
      fullName,
      roleName: resolved.roleName,
      ...(resolved.companyCodes ? { allowedCompanyCodes: resolved.companyCodes } : {}),
      isExternalIdentity: true,
      canManagePermissions,
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
      return this.getProfile(authUser.userId, authUser);
    }

    const override = this.userPermissionsStore?.getByUsername(authUser.login) ?? null;
    const roleCompanies = await this.companyRepository.findByRoleId(authUser.roleId);
    let companies: CompanyContext[];

    if (override?.companyCodes && override.companyCodes.length > 0) {
      const overrideSet = new Set(override.companyCodes);
      companies = ALL_DEFAULT_COMPANIES.filter((company) => overrideSet.has(company.code));
    } else if (authUser.allowedCompanyCodes) {
      const allowedSet = new Set(authUser.allowedCompanyCodes);
      if (roleCompanies.length > 0) {
        companies = roleCompanies.filter((company) => allowedSet.has(company.code));
      } else if (override && override.reportSlugs.length > 0) {
        companies = ALL_DEFAULT_COMPANIES.filter((company) => allowedSet.has(company.code));
      } else {
        companies = [];
      }
    } else if (override && override.reportSlugs.length > 0 && roleCompanies.length === 0) {
      companies = ALL_DEFAULT_COMPANIES;
    } else {
      companies = roleCompanies;
    }

    return {
      id: authUser.userId,
      login: authUser.login,
      fullName: authUser.fullName ?? authUser.login,
      roleCode: authUser.roleCode,
      roleName: authUser.roleName ?? authUser.roleCode,
      companies,
      canManagePermissions: Boolean(authUser.canManagePermissions),
    };
  }

  public async getProfile(
    userId: number,
    authUser?: AuthenticatedRequestUser,
  ): Promise<PublicUserProfile> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.isActive || !user.role.isActive) {
      throw new UnauthorizedError('Usuario no disponible o inactivo');
    }
    const override = this.userPermissionsStore?.getByUsername(user.login) ?? null;
    const companies =
      override?.companyCodes && override.companyCodes.length > 0
        ? ALL_DEFAULT_COMPANIES.filter((company) =>
            override.companyCodes!.includes(company.code),
          )
        : await this.companyRepository.findByRoleId(user.role.id);

    return {
      id: user.id,
      login: user.login,
      fullName: user.fullName,
      roleCode: user.role.code,
      roleName: user.role.name,
      companies,
      canManagePermissions: Boolean(authUser?.canManagePermissions),
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
