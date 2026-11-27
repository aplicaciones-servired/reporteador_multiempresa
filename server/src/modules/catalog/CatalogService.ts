import type { IUserPermissionsStore } from '../../database/UserPermissionsStore.js';
import type { ICompanyRepository, IReportRepository } from '../../repositories/contracts.js';
import { ALL_DEFAULT_COMPANIES } from '../auth/AuthService.js';
import type { ReportRegistry } from '../reports/core/ReportRegistry.js';
import type { CompanyContext, ReportMetadata } from '../reports/core/ReportTypes.js';

export interface CatalogModuleGroup {
  readonly module: string;
  readonly reports: ReportMetadata[];
}

export interface UserCatalogResponse {
  readonly companies: CompanyContext[];
  readonly modules: CatalogModuleGroup[];
  readonly totalReports: number;
}

export class CatalogService {
  constructor(
    private readonly companyRepository: ICompanyRepository,
    private readonly reportRepository: IReportRepository,
    private readonly reportRegistry?: ReportRegistry,
    private readonly userPermissionsStore?: IUserPermissionsStore,
  ) {}

  public async getCatalogForRole(
    roleId: number,
    allowedCompanyCodes?: readonly string[],
    login?: string,
  ): Promise<UserCatalogResponse> {
    const override = login ? this.userPermissionsStore?.getByUsername(login) ?? null : null;

    let companies: CompanyContext[];
    let reports: ReportMetadata[];

    if (override && this.reportRegistry) {
      const allowedSlugSet = new Set(override.reportSlugs);
      reports = this.reportRegistry
        .getAllMetadata()
        .filter((report) => allowedSlugSet.has(report.slug));

      if (override.companyCodes && override.companyCodes.length > 0) {
        const overrideCompanySet = new Set(override.companyCodes);
        companies = ALL_DEFAULT_COMPANIES.filter((company) =>
          overrideCompanySet.has(company.code),
        );
      } else if (allowedCompanyCodes && allowedCompanyCodes.length > 0) {
        const allowedCompanySet = new Set(allowedCompanyCodes);
        companies = ALL_DEFAULT_COMPANIES.filter((company) =>
          allowedCompanySet.has(company.code),
        );
      } else {
        companies = await this.companyRepository.findByRoleId(roleId);
      }
    } else {
      const [rawCompanies, roleReports] = await Promise.all([
        this.companyRepository.findByRoleId(roleId),
        this.reportRepository.findAuthorizedReportsByRoleId(roleId),
      ]);
      const allowedSet = allowedCompanyCodes ? new Set(allowedCompanyCodes) : null;
      companies = allowedSet
        ? rawCompanies.filter((company) => allowedSet.has(company.code))
        : rawCompanies;
      reports = roleReports;
    }

    const grouped = new Map<string, ReportMetadata[]>();
    for (const report of reports) {
      const existing = grouped.get(report.module) ?? [];
      existing.push({
        slug: report.slug,
        module: report.module,
        name: report.name,
        description: report.description,
        oracleSource: report.oracleSource,
        inputSchema: report.inputSchema,
        outputType: report.outputType,
        requiresCompany: report.requiresCompany,
        displayOrder: report.displayOrder,
      });
      grouped.set(report.module, existing);
    }

    const modules: CatalogModuleGroup[] = Array.from(grouped.entries()).map(
      ([module, items]) => ({
        module,
        reports: items,
      }),
    );

    return {
      companies,
      modules,
      totalReports: reports.length,
    };
  }
}
