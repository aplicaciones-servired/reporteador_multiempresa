import type { BaseReport } from './BaseReport.js';
import type { ReportMetadata } from './ReportTypes.js';

export class ReportRegistry {
  private readonly reports = new Map<string, BaseReport>();

  public register(report: BaseReport): void {
    const { slug } = report.metadata;
    if (this.reports.has(slug)) {
      throw new Error(`El reporte con slug '${slug}' ya está registrado`);
    }
    this.reports.set(slug, report);
  }

  public registerMany(items: BaseReport[]): void {
    for (const item of items) {
      this.register(item);
    }
  }

  public getBySlug(slug: string): BaseReport | undefined {
    return this.reports.get(slug);
  }

  public has(slug: string): boolean {
    return this.reports.has(slug);
  }

  public getAllReports(): BaseReport[] {
    return Array.from(this.reports.values()).sort(
      (a, b) => a.metadata.displayOrder - b.metadata.displayOrder,
    );
  }

  public getAllMetadata(): ReportMetadata[] {
    return this.getAllReports().map((r) => r.metadata);
  }
}
