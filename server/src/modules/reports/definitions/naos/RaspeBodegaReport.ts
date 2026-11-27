import { BaseReport } from '../../core/BaseReport.js';
import { companyOnlySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
  ReportRow,
} from '../../core/ReportTypes.js';

export class RaspeBodegaReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'inventario-raspe-bodega',
    module: 'LF y Raspes',
    name: '1. Inventario RASPE (Bodegas Principales)',
    description: 'Inventario disponible y en tránsito de Raspe en bodegas principales.',
    oracleSource: 'naos',
    inputSchema: 'company_only',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 150,
  };

  protected readonly inputSchema = companyOnlySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'EMPRESA', header: 'EMPRESA', format: 'text', width: 14 },
      { key: 'NOMBRE_JUEGO', header: 'NOMBRE JUEGO', format: 'text', width: 28 },
      { key: 'SORTEO', header: 'SORTEO', format: 'text', width: 12 },
      { key: 'BODEGA', header: 'BODEGA', format: 'text', width: 22 },
      { key: 'KARCAN_CODIGO', header: 'KARCAN CODIGO', format: 'text', width: 16 },
      { key: 'CANTIDAD_DISPONIBLE', header: 'CANTIDAD DISPONIBLE', format: 'number', width: 20 },
      { key: 'CANTIDAD_TRANSITO', header: 'CANTIDAD TRANSITO', format: 'number', width: 20 },
      { key: 'FECHA_CONSULTA', header: 'FECHA_CONSULTA', format: 'date', width: 18 },
    ];
  }

  public buildQuery(_input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const sql = `
      SELECT *
      FROM GAMBLE.INVENTARIO_PRINCIPAL_RSP_V
      WHERE EMPRESA = :empresa
    `;

    return {
      sql,
      binds: { empresa: Number(company!.code) },
    };
  }

  protected override transformRows(rows: ReportRow[]): ReportRow[] {
    const cols = this.getColumns();
    return rows.map((row) => {
      if ('NOMBRE_JUEGO' in row) {
        return row;
      }
      const values = Object.values(row);
      const mapped: ReportRow = {};
      cols.forEach((col, index) => {
        mapped[col.key] = (values[index] ?? null) as ReportRow[string];
      });
      return mapped;
    });
  }

  protected override buildFilenameBase(
    _input: ReportExecutionInput,
    company?: CompanyContext,
  ): string {
    return `REPORTE_RASPE_BODEGA_${this.sanitizeFilenamePart(company?.name ?? 'EMPRESA')}`;
  }
}
