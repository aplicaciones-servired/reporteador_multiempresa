import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class PremiosMaquinasRutaReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'premios-maquinas-ruta',
    module: 'Máquinas Ruta',
    name: 'Premios Máquinas Ruta',
    description: 'Autorizaciones de premios pagados en máquinas de ruta.',
    oracleSource: 'naos',
    inputSchema: 'date_range',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 161,
  };

  protected readonly inputSchema = dateRangeWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'FECHA', header: 'FECHA', format: 'date', width: 14 },
      { key: 'TERCERO', header: 'TERCERO', format: 'text', width: 16 },
      { key: 'NOMBRE', header: 'NOMBRE', format: 'text', width: 32 },
      { key: 'VALOR', header: 'VALOR', format: 'currency', width: 16 },
      { key: 'CAJERO', header: 'CAJERO', format: 'text', width: 16 },
      { key: 'NOMBRE_CAJERO', header: 'NOMBRE_CAJERO', format: 'text', width: 32 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);
    const empresa = Number(company!.code);

    const sql = `
      SELECT
        au.fecha,
        au.tercero,
        UPPER(pe.nombres || ' ' || pe.apellido1 || ' ' || pe.apellido2) AS nombre,
        au.valor,
        au.LOGINUSR AS cajero,
        UPPER(pe2.nombres || ' ' || pe2.apellido1 || ' ' || pe2.apellido2) AS nombre_cajero
      FROM gamble.autorizacionespdv au
      LEFT JOIN gamble.personas pe ON pe.documento = au.tercero
      LEFT JOIN gamble.personas pe2 ON pe2.documento = au.LOGINUSR
      WHERE au.fecha BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
        AND au.zona = :empresa
      ORDER BY fecha, tercero
    `;

    return {
      sql,
      binds: { fecha1, fecha2, empresa },
    };
  }
}
