import bcrypt from 'bcryptjs';
import type { EnvironmentConfig } from '../config/EnvironmentConfig.js';
import type { ReportMetadata } from '../modules/reports/core/ReportTypes.js';
import { DEFAULT_COMPANIES, DEFAULT_ROLES } from './CatalogSeedData.js';
import {
  CompanyModel,
  ReportModel,
  RoleCompanyModel,
  RoleModel,
  RoleReportModel,
  UserModel,
} from './models/index.js';

export class SeedRunner {
  constructor(
    private readonly config: EnvironmentConfig,
    private readonly reportDefinitions: ReportMetadata[],
  ) {}

  public async run(): Promise<void> {
    const companyMap = await this.seedCompanies();
    const reportMap = await this.seedReports();
    const roleMap = await this.seedRolesAndPermissions(companyMap, reportMap);
    await this.seedDefaultAdmin(roleMap);
  }

  private async seedCompanies(): Promise<Map<string, CompanyModel>> {
    const map = new Map<string, CompanyModel>();
    for (const data of DEFAULT_COMPANIES) {
      const [existing] = await CompanyModel.findOrCreate({
        where: { code: data.code },
        defaults: data,
      });
      await existing.update(data);
      map.set(data.code, existing);
    }
    return map;
  }

  private async seedReports(): Promise<Map<string, ReportModel>> {
    const map = new Map<string, ReportModel>();
    for (const def of this.reportDefinitions) {
      const [existing] = await ReportModel.findOrCreate({
        where: { slug: def.slug },
        defaults: { ...def, isActive: true },
      });
      await existing.update({ ...def, isActive: true });
      map.set(def.slug, existing);
    }
    return map;
  }

  private async seedRolesAndPermissions(
    companyMap: Map<string, CompanyModel>,
    reportMap: Map<string, ReportModel>,
  ): Promise<Map<string, RoleModel>> {
    const roleMap = new Map<string, RoleModel>();

    for (const spec of DEFAULT_ROLES) {
      const [role] = await RoleModel.findOrCreate({
        where: { code: spec.code },
        defaults: { code: spec.code, name: spec.name, isActive: true },
      });
      await role.update({ name: spec.name, isActive: true });
      roleMap.set(spec.code, role);

      await RoleCompanyModel.destroy({ where: { roleId: role.id } });
      for (const companyCode of spec.companyCodes) {
        const company = companyMap.get(companyCode);
        if (company) {
          await RoleCompanyModel.create({ roleId: role.id, companyId: company.id });
        }
      }

      const targetSlugs =
        spec.reportSlugs === '*' ? Array.from(reportMap.keys()) : spec.reportSlugs;

      await RoleReportModel.destroy({ where: { roleId: role.id } });
      for (const slug of targetSlugs) {
        const report = reportMap.get(slug);
        if (report) {
          await RoleReportModel.create({ roleId: role.id, reportId: report.id });
        }
      }
    }

    return roleMap;
  }

  private async seedDefaultAdmin(roleMap: Map<string, RoleModel>): Promise<void> {
    const adminRole = roleMap.get('ADMIN');
    if (!adminRole) {
      return;
    }

    const existing = await UserModel.findOne({ where: { login: 'admin' } });
    if (!existing) {
      const passwordHash = await bcrypt.hash(this.config.seedDefaultAdminPassword, 10);
      await UserModel.create({
        login: 'admin',
        passwordHash,
        fullName: 'Administrador del Sistema',
        roleId: adminRole.id,
        isActive: true,
      });
    }
  }
}
