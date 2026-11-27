import type { CompanyContext, ReportMetadata } from '../reports/core/ReportTypes.js';
import type { ICompanyRepository, IReportRepository } from '../../repositories/contracts.js';

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
  ) {}

  public async getCatalogForRole(roleId: number): Promise<UserCatalogResponse> {
    const [companies, reports] = await Promise.all([
      this.companyRepository.findByRoleId(roleId),
      this.reportRepository.findAuthorizedReportsByRoleId(roleId),
    ]);

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
