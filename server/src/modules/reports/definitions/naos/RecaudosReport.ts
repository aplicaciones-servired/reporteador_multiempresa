import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class RecaudosReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'recaudos',
    module: 'Recaudos',
    name: 'Reporte de Recaudos',
    description: 'Recaudos diarios en cajas por municipio, vendedor y cajero.',
    oracleSource: 'naos',
    inputSchema: 'date_range',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 140,
  };

  protected readonly inputSchema = dateRangeWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'MUNICIPIO', header: 'MUNICIPIO', format: 'text', width: 14 },
      { key: 'VENDEDOR', header: 'VENDEDOR', format: 'text', width: 16 },
      { key: 'NOMBRE_VENDEDOR', header: 'NOMBRE_VENDEDOR', format: 'text', width: 32 },
      { key: 'HORA_RECAUDO', header: 'HORA_RECAUDO', format: 'text', width: 22 },
      { key: 'VALOR', header: 'VALOR', format: 'currency', width: 16 },
      { key: 'CAJERO', header: 'CAJERO', format: 'text', width: 16 },
      { key: 'NOMBRE_CAJERO', header: 'NOMBRE_CAJERO', format: 'text', width: 32 },
      { key: 'DESCRIPCION', header: 'DESCRIPCION', format: 'text', width: 34 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);
    const empresa = Number(company!.code);

    const sql = `
      SELECT
        DECODE(cj.CCOSTO, 39629, 'YUMBO', 39630, 'VIJES', 39631, 'CUMBRE', 39632, 'JAMUNDI') AS MUNICIPIO,
        cj.prs_documento AS vendedor,
        UPPER(pe.nombres || ' ' || pe.apellido1 || ' ' || pe.apellido2) AS nombre_vendedor,
        TO_CHAR(cj.fechasys, 'DD/MM/YYYY HH24:MI:SS') AS hora_recaudo,
        cj.valor,
        SUBSTR(cj.loginregistro, 4) AS cajero,
        UPPER(pe2.nombres || ' ' || pe2.apellido1 || ' ' || pe2.apellido2) AS nombre_cajero,
        cj.descripcion
      FROM cajasdiarias@consultas cj
      LEFT JOIN personas pe ON pe.documento = cj.prs_documento
      LEFT JOIN personas pe2 ON pe2.documento = SUBSTR(cj.loginregistro, 4)
      WHERE TRUNC(cj.fechasys) BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
        AND cj.TRANS_CODIGO IN (47, 49)
        AND SUBSTR(cj.loginregistro, 3) IN (
          SELECT DISTINCT usuadocu FROM cerberus.ms_usuario WHERE grupcodi IN (16, 17)
        )
        AND cj.ZONA = :empresa
        AND cj.VERSION = 0
      ORDER BY TRUNC(cj.fechasys) ASC, cj.CCOSTO, cj.loginregistro, cj.prs_documento
    `;

    return {
      sql,
      binds: { fecha1, fecha2, empresa },
    };
  }
}
