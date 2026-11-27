import type { CompanyContext, ReportMetadata } from '../modules/reports/core/ReportTypes.js';

export interface AuthenticatedUserRecord {
  readonly id: number;
  readonly login: string;
  readonly passwordHash: string;
  readonly fullName: string;
  readonly isActive: boolean;
  readonly role: {
    readonly id: number;
    readonly code: string;
    readonly name: string;
    readonly isActive: boolean;
  };
}

export interface RoleReportRecord extends ReportMetadata {
  readonly id: number;
  readonly isActive: boolean;
}

export interface IUserRepository {
  findByLogin(login: string): Promise<AuthenticatedUserRecord | null>;
  findById(id: number): Promise<AuthenticatedUserRecord | null>;
  updateLastLogin(id: number, at: Date): Promise<void>;
}

export interface ICompanyRepository {
  findByRoleId(roleId: number): Promise<CompanyContext[]>;
  findAuthorizedCompany(roleId: number, companyCode: string): Promise<CompanyContext | null>;
}

export interface IReportRepository {
  findAuthorizedReportsByRoleId(roleId: number): Promise<RoleReportRecord[]>;
  isReportAuthorizedForRole(roleId: number, slug: string): Promise<boolean>;
}
