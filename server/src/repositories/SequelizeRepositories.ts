import {
  CompanyModel,
  ReportModel,
  RoleModel,
  UserModel,
} from '../database/models/index.js';
import type {
  CompanyContext,
  ReportInputSchemaType,
  ReportOutputType,
} from '../modules/reports/core/ReportTypes.js';
import type { OracleSourceName } from '../database/OraclePoolManager.js';
import type {
  AuthenticatedUserRecord,
  ICompanyRepository,
  IReportRepository,
  IUserRepository,
  RoleReportRecord,
} from './contracts.js';

function mapCompanyToContext(company: CompanyModel): CompanyContext {
  return {
    id: company.id,
    code: company.code,
    name: company.name,
    cityLabel: company.cityLabel,
    nit: company.nit,
    legalName: company.legalName,
    warehouseCode: company.warehouseCode,
    sisbetCode: company.sisbetCode,
    legacyZones: Array.isArray(company.legacyZones) ? company.legacyZones : [],
    costCenters: Array.isArray(company.costCenters) ? company.costCenters : [],
    daneCodes: Array.isArray(company.daneCodes) ? company.daneCodes : [],
    registrocajasUnits: Array.isArray(company.registrocajasUnits)
      ? company.registrocajasUnits
      : [],
    excludedChanceGames: Array.isArray(company.excludedChanceGames)
      ? company.excludedChanceGames
      : [],
    requirePositiveCash: Boolean(company.requirePositiveCash),
  };
}

function mapUserRecord(user: UserModel): AuthenticatedUserRecord | null {
  if (!user.role) {
    return null;
  }
  return {
    id: user.id,
    login: user.login,
    passwordHash: user.passwordHash,
    fullName: user.fullName,
    isActive: user.isActive,
    role: {
      id: user.role.id,
      code: user.role.code,
      name: user.role.name,
      isActive: user.role.isActive,
    },
  };
}

export class SequelizeUserRepository implements IUserRepository {
  public async findByLogin(login: string): Promise<AuthenticatedUserRecord | null> {
    const user = await UserModel.findOne({
      where: { login },
      include: [{ model: RoleModel, as: 'role', required: true }],
    });
    return user ? mapUserRecord(user) : null;
  }

  public async findById(id: number): Promise<AuthenticatedUserRecord | null> {
    const user = await UserModel.findByPk(id, {
      include: [{ model: RoleModel, as: 'role', required: true }],
    });
    return user ? mapUserRecord(user) : null;
  }

  public async updateLastLogin(id: number, at: Date): Promise<void> {
    await UserModel.update({ lastLoginAt: at }, { where: { id } });
  }
}

export class SequelizeCompanyRepository implements ICompanyRepository {
  public async findByRoleId(roleId: number): Promise<CompanyContext[]> {
    const role = await RoleModel.findByPk(roleId, {
      include: [
        {
          model: CompanyModel,
          as: 'companies',
          where: { isActive: true },
          required: false,
        },
      ],
    });
    const companies = role?.companies ?? [];
    return companies
      .map(mapCompanyToContext)
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  public async findAuthorizedCompany(
    roleId: number,
    companyCode: string,
  ): Promise<CompanyContext | null> {
    const companies = await this.findByRoleId(roleId);
    return companies.find((c) => c.code === companyCode) ?? null;
  }
}

export class SequelizeReportRepository implements IReportRepository {
  public async findAuthorizedReportsByRoleId(roleId: number): Promise<RoleReportRecord[]> {
    const role = await RoleModel.findByPk(roleId, {
      include: [
        {
          model: ReportModel,
          as: 'reports',
          where: { isActive: true },
          required: false,
        },
      ],
    });

    const reports = role?.reports ?? [];
    return reports
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        module: r.module,
        name: r.name,
        description: r.description,
        oracleSource: r.oracleSource as OracleSourceName,
        inputSchema: r.inputSchema as ReportInputSchemaType,
        outputType: r.outputType as ReportOutputType,
        requiresCompany: r.requiresCompany,
        displayOrder: r.displayOrder,
        isActive: r.isActive,
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  public async isReportAuthorizedForRole(roleId: number, slug: string): Promise<boolean> {
    const reports = await this.findAuthorizedReportsByRoleId(roleId);
    return reports.some((r) => r.slug === slug);
  }
}
