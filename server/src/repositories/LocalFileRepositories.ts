import type { LocalFileDatabase } from '../database/LocalFileDatabase.js';
import type { CompanyContext } from '../modules/reports/core/ReportTypes.js';
import type {
  AuthenticatedUserRecord,
  ICompanyRepository,
  IReportRepository,
  IUserRepository,
  RoleReportRecord,
} from './contracts.js';

export class LocalFileUserRepository implements IUserRepository {
  constructor(private readonly db: LocalFileDatabase) {}

  public async findByLogin(login: string): Promise<AuthenticatedUserRecord | null> {
    return this.db.findUserByLogin(login);
  }

  public async findById(id: number): Promise<AuthenticatedUserRecord | null> {
    return this.db.findUserById(id);
  }

  public async updateLastLogin(id: number, at: Date): Promise<void> {
    await this.db.updateUserLastLogin(id, at);
  }
}

export class LocalFileCompanyRepository implements ICompanyRepository {
  constructor(private readonly db: LocalFileDatabase) {}

  public async findByRoleId(roleId: number): Promise<CompanyContext[]> {
    return this.db.findCompaniesByRoleId(roleId);
  }

  public async findAuthorizedCompany(
    roleId: number,
    companyCode: string,
  ): Promise<CompanyContext | null> {
    const companies = this.db.findCompaniesByRoleId(roleId);
    return companies.find((c) => c.code === companyCode) ?? null;
  }
}

export class LocalFileReportRepository implements IReportRepository {
  constructor(private readonly db: LocalFileDatabase) {}

  public async findAuthorizedReportsByRoleId(roleId: number): Promise<RoleReportRecord[]> {
    return this.db.findReportsByRoleId(roleId);
  }

  public async isReportAuthorizedForRole(roleId: number, slug: string): Promise<boolean> {
    const reports = this.db.findReportsByRoleId(roleId);
    return reports.some((r) => r.slug === slug);
  }
}
