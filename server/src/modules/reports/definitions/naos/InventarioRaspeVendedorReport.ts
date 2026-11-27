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

export class InventarioRaspeVendedorReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'inventario-raspe-vendedor',
    module: 'LF y Raspes',
    name: '2. Inventario RASPE (Vendedor)',
    description: 'Inventario actual de Raspe asignado a cada vendedor/bodega.',
    oracleSource: 'naos',
    inputSchema: 'company_only',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 151,
  };

  protected readonly inputSchema = companyOnlySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'EMPRESA', header: 'EMPRESA', format: 'text', width: 14 },
      { key: 'PRODUCTO_INVENTARIO', header: 'PRODUCTO INVENTARIO', format: 'text', width: 28 },
      { key: 'BODEGA', header: 'BODEGA', format: 'text', width: 20 },
      { key: 'NOMBRES', header: 'NOMBRES', format: 'text', width: 32 },
      { key: 'CANT_BODEGAREF', header: 'CANT_BODEGAREF', format: 'number', width: 18 },
      { key: 'FECHA_CONSULTA', header: 'FECHA_CONSULTA', format: 'date', width: 18 },
    ];
  }

  public buildQuery(_input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const sql = `
      SELECT *
      FROM GAMBLE.INVENTARIO_BODEGA_RSP_V
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
      if ('PRODUCTO_INVENTARIO' in row) {
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
    return `REPORTE_RASPE_VENDEDOR_${this.sanitizeFilenamePart(company?.name ?? 'EMPRESA')}`;
  }
}
