import type { z } from 'zod';
import { ValidationError } from '../../../core/errors/AppError.js';
import type { IOraclePoolManager, OracleBinds } from '../../../database/OraclePoolManager.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportExecutionResult,
  ReportMetadata,
  ReportRow,
} from './ReportTypes.js';

export abstract class BaseReport<
  TInput extends ReportExecutionInput = ReportExecutionInput,
> {
  public abstract readonly metadata: ReportMetadata;
  protected abstract readonly inputSchema: z.ZodType<TInput>;

  public abstract getColumns(): ReportColumnDef[];
  public abstract buildQuery(input: TInput, company?: CompanyContext): OracleQuerySpec;

  public validateInput(rawInput: unknown): TInput {
    return this.inputSchema.parse(rawInput);
  }

  public async execute(
    poolManager: IOraclePoolManager,
    rawInput: unknown,
    company?: CompanyContext,
    maxRows = 0,
  ): Promise<ReportExecutionResult> {
    const parsedInput = this.validateInput(rawInput);

    if (this.metadata.requiresCompany && !company) {
      throw new ValidationError('Debes proporcionar una empresa autorizada para este reporte');
    }

    const querySpec = this.buildQuery(parsedInput, company);
    const fetchLimit = maxRows > 0 ? maxRows + 1 : 0;

    const rawRows = await poolManager.executeQuery<ReportRow>(
      this.metadata.oracleSource,
      querySpec.sql,
      querySpec.binds,
      fetchLimit,
    );

    const truncated = maxRows > 0 && rawRows.length > maxRows;
    const slicedRows = truncated ? rawRows.slice(0, maxRows) : rawRows;
    const rows = this.transformRows(slicedRows, parsedInput, company);

    return {
      metadata: this.metadata,
      columns: this.getColumns(),
      rows,
      filenameBase: this.buildFilenameBase(parsedInput, company),
      company,
      generatedAt: new Date().toISOString(),
      truncated,
      sisbetArchiveCode: this.getSisbetArchiveCode(rows, parsedInput, company),
    };
  }

  protected transformRows(
    rows: ReportRow[],
    _input: TInput,
    _company?: CompanyContext,
  ): ReportRow[] {
    return rows;
  }

  protected getSisbetArchiveCode(
    _rows: ReportRow[],
    _input: TInput,
    _company?: CompanyContext,
  ): string | undefined {
    return undefined;
  }

  protected buildFilenameBase(input: TInput, company?: CompanyContext): string {
    const slugUpper = this.metadata.slug.toUpperCase().replace(/-/g, '_');
    const parts = [slugUpper];

    if (company) {
      parts.push(this.sanitizeFilenamePart(company.name));
    }
    if (input.fecha1 && input.fecha2) {
      parts.push(`DEL_${this.formatFileDate(input.fecha1)}_AL_${this.formatFileDate(input.fecha2)}`);
    } else if (input.fecha1) {
      parts.push(this.formatFileDate(input.fecha1));
    }
    return parts.join('_');
  }

  protected formatOracleDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  }

  protected formatFileDate(isoDate: string): string {
    return isoDate.replace(/-/g, '');
  }

  protected sanitizeFilenamePart(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  protected buildInClause(
    prefix: string,
    values: ReadonlyArray<string | number>,
  ): { placeholders: string; binds: OracleBinds } {
    if (values.length === 0) {
      throw new ValidationError(`La lista de valores para '${prefix}' no puede estar vacía`);
    }
    if (values.length > 1000) {
      throw new ValidationError(`La lista de valores para '${prefix}' excede el límite de 1000 elementos`);
    }

    const binds: OracleBinds = {};
    const names: string[] = [];

    values.forEach((value, index) => {
      const bindName = `${prefix}_${index}`;
      binds[bindName] = value;
      names.push(`:${bindName}`);
    });

    return {
      placeholders: names.join(', '),
      binds,
    };
  }
}
