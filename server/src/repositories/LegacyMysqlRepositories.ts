import { QueryTypes, type Sequelize } from 'sequelize';
import { DEFAULT_COMPANIES, DEFAULT_ROLES } from '../database/CatalogSeedData.js';
import type { CompanyContext, ReportMetadata } from '../modules/reports/core/ReportTypes.js';
import type {
  AuthenticatedUserRecord,
  ICompanyRepository,
  IReportRepository,
  IUserRepository,
  RoleReportRecord,
} from './contracts.js';

function normalizeRoleKey(value: string): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, '_');
}

const ROLE_BY_NORMALIZED_KEY = new Map(
  DEFAULT_ROLES.map((spec, idx) => [
    normalizeRoleKey(spec.code),
    { ...spec, id: idx + 1 },
  ]),
);
const ROLE_BY_ID = new Map(
  DEFAULT_ROLES.map((spec, idx) => [idx + 1, { ...spec, id: idx + 1 }]),
);

const ALL_COMPANIES: CompanyContext[] = DEFAULT_COMPANIES.map((c, idx) => ({
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

const SAFE_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export class LegacyMysqlUserRepository implements IUserRepository {
  private detectedPkColumn: string | null = null;

  constructor(private readonly sequelize: Sequelize) {}

  public async findByLogin(login: string): Promise<AuthenticatedUserRecord | null> {
    const rows = await this.sequelize.query<Record<string, unknown>>(
      'SELECT * FROM tbusuario WHERE login = :login AND activo != 0 LIMIT 1',
      {
        replacements: { login },
        type: QueryTypes.SELECT,
      },
    );
    const row = rows[0];
    return row ? this.mapLegacyRow(row) : null;
  }

  public async findById(id: number): Promise<AuthenticatedUserRecord | null> {
    const pkCol = await this.resolvePkColumn();
    if (!pkCol) {
      return null;
    }

    const rows = await this.sequelize.query<Record<string, unknown>>(
      `SELECT * FROM tbusuario WHERE \`${pkCol}\` = :id AND activo != 0 LIMIT 1`,
      {
        replacements: { id },
        type: QueryTypes.SELECT,
      },
    );
    const row = rows[0];
    return row ? this.mapLegacyRow(row) : null;
  }

  public async updateLastLogin(): Promise<void> {
    // Conexión de solo lectura sobre la tabla legada tbusuario
  }

  private async resolvePkColumn(): Promise<string | null> {
    if (this.detectedPkColumn && SAFE_IDENTIFIER_RE.test(this.detectedPkColumn)) {
      return this.detectedPkColumn;
    }

    try {
      const columns = await this.sequelize.query<Record<string, unknown>>(
        'SHOW COLUMNS FROM tbusuario',
        { type: QueryTypes.SELECT },
      );
      const firstCol = columns[0];
      const fieldName = firstCol
        ? String(firstCol.Field ?? firstCol.field ?? Object.values(firstCol)[0] ?? '')
        : '';

      if (SAFE_IDENTIFIER_RE.test(fieldName)) {
        this.detectedPkColumn = fieldName;
        return fieldName;
      }
    } catch {
      // Fallback si la consulta de metadatos no está permitida
    }

    return 'id';
  }

  private mapLegacyRow(row: Record<string, unknown>): AuthenticatedUserRecord | null {
    const keys = Object.keys(row);
    if (keys.length > 0 && SAFE_IDENTIFIER_RE.test(keys[0])) {
      this.detectedPkColumn = keys[0];
    }

    const normalized = new Map<string, unknown>();
    for (const [k, v] of Object.entries(row)) {
      normalized.set(k.toLowerCase(), v);
    }

    const values = Object.values(row);
    const rawId = Number(normalized.get('id') ?? values[0]);
    const login = String(normalized.get('login') ?? values[1] ?? '').trim();
    const pass = String(normalized.get('pass') ?? values[2] ?? '');
    const fullName = String(
      normalized.get('nombreusu') ?? normalized.get('nombre') ?? values[3] ?? login,
    ).trim();
    const rawPerfil = String(normalized.get('perfil') ?? values[4] ?? '')
      .replace(/[\r\n]+/g, ' ')
      .trim();
    const activo = Number(normalized.get('activo') ?? values[5] ?? 1);

    if (!Number.isFinite(rawId) || login.length === 0) {
      return null;
    }

    const roleSpec = ROLE_BY_NORMALIZED_KEY.get(normalizeRoleKey(rawPerfil));
    if (!roleSpec) {
      console.warn(
        `[legacy_mysql] Perfil sin permisos en el reporteador para login='${login}': '${rawPerfil}'`,
      );
    }

    return {
      id: rawId,
      login,
      passwordHash: pass,
      fullName,
      isActive: activo !== 0,
      role: roleSpec
        ? {
            id: roleSpec.id,
            code: roleSpec.code,
            name: roleSpec.name,
            isActive: true,
          }
        : {
            id: 0,
            code: rawPerfil || 'SIN_PERFIL',
            name: rawPerfil || 'Sin perfil asignado',
            isActive: true,
          },
    };
  }
}

export class StaticCompanyRepository implements ICompanyRepository {
  public async findByRoleId(roleId: number): Promise<CompanyContext[]> {
    const role = ROLE_BY_ID.get(roleId);
    if (!role) {
      return [];
    }
    const allowed = new Set(role.companyCodes);
    return ALL_COMPANIES.filter((c) => allowed.has(c.code));
  }

  public async findAuthorizedCompany(
    roleId: number,
    companyCode: string,
  ): Promise<CompanyContext | null> {
    const companies = await this.findByRoleId(roleId);
    return companies.find((c) => c.code === companyCode) ?? null;
  }
}

export class StaticReportRepository implements IReportRepository {
  private readonly allReports: RoleReportRecord[];

  constructor(reportDefinitions: ReportMetadata[]) {
    this.allReports = reportDefinitions.map((rep, idx) => ({
      ...rep,
      id: idx + 1,
      isActive: true,
    }));
  }

  public async findAuthorizedReportsByRoleId(roleId: number): Promise<RoleReportRecord[]> {
    const role = ROLE_BY_ID.get(roleId);
    if (!role) {
      return [];
    }
    if (role.reportSlugs === '*') {
      return this.allReports;
    }
    const allowed = new Set(role.reportSlugs);
    return this.allReports.filter((r) => allowed.has(r.slug));
  }

  public async isReportAuthorizedForRole(roleId: number, slug: string): Promise<boolean> {
    const reports = await this.findAuthorizedReportsByRoleId(roleId);
    return reports.some((r) => r.slug === slug);
  }
}
