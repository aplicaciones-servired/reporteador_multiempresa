import { NotFoundError } from '../../core/errors/AppError.js';
import type { IOraclePoolManager } from '../../database/OraclePoolManager.js';
import type { ReportRegistry } from './core/ReportRegistry.js';
import type {
  CompanyContext,
  ExportedFile,
  ReportColumnDef,
  ReportRow,
} from './core/ReportTypes.js';
import type { ExporterFactory } from './exporters/ExporterFactory.js';

export interface ReportPreviewResponse {
  readonly reportName: string;
  readonly slug: string;
  readonly outputType: string;
  readonly columns: ReportColumnDef[];
  readonly rows: Record<string, string | number | null>[];
  readonly totalReturned: number;
  readonly truncated: boolean;
  readonly generatedAt: string;
}

export class ReportExecutionService {
  private static readonly PREVIEW_MAX_ROWS = 500;

  constructor(
    private readonly registry: ReportRegistry,
    private readonly oraclePools: IOraclePoolManager,
    private readonly exporterFactory: ExporterFactory,
  ) {}

  public async preview(
    slug: string,
    rawInput: unknown,
    company?: CompanyContext,
  ): Promise<ReportPreviewResponse> {
    const report = this.registry.getBySlug(slug);
    if (!report) {
      throw new NotFoundError(`El reporte '${slug}' no existe`);
    }

    const result = await report.execute(
      this.oraclePools,
      rawInput,
      company,
      ReportExecutionService.PREVIEW_MAX_ROWS,
    );

    const serializedRows = result.rows.map((row) =>
      this.serializeRowForPreview(row, result.columns),
    );

    return {
      reportName: result.metadata.name,
      slug: result.metadata.slug,
      outputType: result.metadata.outputType,
      columns: result.columns,
      rows: serializedRows,
      totalReturned: serializedRows.length,
      truncated: result.truncated,
      generatedAt: result.generatedAt,
    };
  }

  public async export(
    slug: string,
    rawInput: unknown,
    company?: CompanyContext,
  ): Promise<ExportedFile> {
    const report = this.registry.getBySlug(slug);
    if (!report) {
      throw new NotFoundError(`El reporte '${slug}' no existe`);
    }

    const result = await report.execute(this.oraclePools, rawInput, company, 0);
    const exporter = this.exporterFactory.getExporter(result.metadata.outputType);
    return exporter.export(result);
  }

  private serializeRowForPreview(
    row: ReportRow,
    columns: ReportColumnDef[],
  ): Record<string, string | number | null> {
    const out: Record<string, string | number | null> = {};
    for (const col of columns) {
      const value = row[col.key];
      if (value === undefined || value === null) {
        out[col.key] = null;
      } else if (value instanceof Date) {
        out[col.key] = this.formatDateForDisplay(value, col.format === 'datetime');
      } else {
        out[col.key] = value;
      }
    }
    return out;
  }

  private formatDateForDisplay(date: Date, includeTime: boolean): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    if (!includeTime) {
      return `${day}/${month}/${year}`;
    }
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  }
}
