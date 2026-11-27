import bcrypt from 'bcryptjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CompanyContext, ReportMetadata } from '../modules/reports/core/ReportTypes.js';
import type { AuthenticatedUserRecord, RoleReportRecord } from '../repositories/contracts.js';
import { DEFAULT_COMPANIES, DEFAULT_ROLES } from './CatalogSeedData.js';

interface StoredRoleRecord {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  companyCodes: string[];
  reportSlugs: string[];
}

interface StoredUserRecord {
  id: number;
  login: string;
  passwordHash: string;
  fullName: string;
  roleCode: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

interface LocalDbSchema {
  companies: CompanyContext[];
  roles: StoredRoleRecord[];
  reports: RoleReportRecord[];
  users: StoredUserRecord[];
}

export class LocalFileDatabase {
  private readonly filePath: string;
  private data: LocalDbSchema = {
    companies: [],
    roles: [],
    reports: [],
    users: [],
  };

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
  }

  public getFilePath(): string {
    return this.filePath;
  }

  public async initialize(
    reportDefinitions: ReportMetadata[],
    defaultAdminPassword: string,
  ): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });

    let existing: Partial<LocalDbSchema> | null = null;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      existing = JSON.parse(raw) as Partial<LocalDbSchema>;
    } catch {
      existing = null;
    }

    const reports: RoleReportRecord[] = reportDefinitions.map((rep, idx) => ({
      ...rep,
      id: idx + 1,
      isActive: true,
    }));

    const allSlugs = reports.map((r) => r.slug);

    const companies: CompanyContext[] =
      existing?.companies && existing.companies.length > 0
        ? existing.companies
        : DEFAULT_COMPANIES.map((c, idx) => ({
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

    const roles: StoredRoleRecord[] =
      existing?.roles && existing.roles.length > 0
        ? existing.roles
        : DEFAULT_ROLES.map((r, idx) => ({
            id: idx + 1,
            code: r.code,
            name: r.name,
            isActive: true,
            companyCodes: r.companyCodes,
            reportSlugs: r.reportSlugs === '*' ? allSlugs : r.reportSlugs,
          }));

    let users: StoredUserRecord[] = Array.isArray(existing?.users) ? existing.users : [];
    if (users.length === 0) {
      const adminHash = await bcrypt.hash(defaultAdminPassword, 10);
      users = [
        {
          id: 1,
          login: 'admin',
          passwordHash: adminHash,
          fullName: 'Administrador del Sistema',
          roleCode: 'ADMIN',
          isActive: true,
          lastLoginAt: null,
        },
      ];
    }

    this.data = {
      companies,
      roles,
      reports,
      users,
    };

    await this.persist();
  }

  public findUserByLogin(login: string): AuthenticatedUserRecord | null {
    const target = login.trim().toLowerCase();
    const found = this.data.users.find((u) => u.login.toLowerCase() === target);
    return found ? this.toAuthenticatedUser(found) : null;
  }

  public findUserById(id: number): AuthenticatedUserRecord | null {
    const found = this.data.users.find((u) => u.id === id);
    return found ? this.toAuthenticatedUser(found) : null;
  }

  public async updateUserLastLogin(id: number, at: Date): Promise<void> {
    const found = this.data.users.find((u) => u.id === id);
    if (!found) {
      return;
    }
    found.lastLoginAt = at.toISOString();
    await this.persist();
  }

  public findCompaniesByRoleId(roleId: number): CompanyContext[] {
    const role = this.data.roles.find((r) => r.id === roleId);
    if (!role) {
      return [];
    }
    const allowedCodes = new Set(role.companyCodes);
    return this.data.companies
      .filter((c) => allowedCodes.has(c.code))
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  public findReportsByRoleId(roleId: number): RoleReportRecord[] {
    const role = this.data.roles.find((r) => r.id === roleId);
    if (!role) {
      return [];
    }
    const allowedSlugs = new Set(role.reportSlugs);
    return this.data.reports
      .filter((r) => r.isActive && allowedSlugs.has(r.slug))
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  private toAuthenticatedUser(user: StoredUserRecord): AuthenticatedUserRecord | null {
    const role = this.data.roles.find((r) => r.code === user.roleCode);
    if (!role) {
      return null;
    }
    return {
      id: user.id,
      login: user.login,
      passwordHash: user.passwordHash,
      fullName: user.fullName,
      isActive: user.isActive,
      role: {
        id: role.id,
        code: role.code,
        name: role.name,
        isActive: role.isActive,
      },
    };
  }

  private async persist(): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }
}
