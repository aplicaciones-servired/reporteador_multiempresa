import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class RecaudosMaquinasRutaReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'recaudos-maquinas-ruta',
    module: 'Máquinas Ruta',
    name: 'Recaudos Máquinas Ruta',
    description: 'Recaudos de máquinas en ruta registrados en cajas diarias.',
    oracleSource: 'naos',
    inputSchema: 'date_range',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 160,
  };

  protected readonly inputSchema = dateRangeWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'FECHACAJA', header: 'FECHACAJA', format: 'date', width: 14 },
      { key: 'MUNICIPIO', header: 'MUNICIPIO', format: 'text', width: 14 },
      { key: 'ID_MAQUINA', header: 'ID_MAQUINA', format: 'text', width: 16 },
      { key: 'NOMBRE_MAQUINA', header: 'NOMBRE_MAQUINA', format: 'text', width: 32 },
      { key: 'HORA_RECAUDO', header: 'HORA_RECAUDO', format: 'text', width: 22 },
      { key: 'VALOR', header: 'VALOR', format: 'currency', width: 16 },
      { key: 'CAJERO', header: 'CAJERO', format: 'text', width: 16 },
      { key: 'NOMBRE_CAJERO', header: 'NOMBRE_CAJERO', format: 'text', width: 32 },
      { key: 'DESCRIPCION', header: 'DESCRIPCION', format: 'text', width: 32 },
      { key: 'TIPO', header: 'TIPO', format: 'text', width: 16 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);
    const empresa = Number(company!.code);

    const sql = `
      SELECT
        CJ.FECHA AS FECHACAJA,
        DECODE(cj.CCOSTO, 39629, 'YUMBO', 39630, 'VIJES', 39631, 'CUMBRE', 39632, 'JAMUNDI') AS MUNICIPIO,
        cj.prs_documento AS ID_MAQUINA,
        UPPER(pe.nombres || ' ' || pe.apellido1 || ' ' || pe.apellido2) AS nombre_maquina,
        TO_CHAR(cj.fechasys, 'DD/MM/YYYY HH24:MI:SS') AS hora_recaudo,
        cj.valor,
        SUBSTR(cj.loginregistro, 4) AS cajero,
        UPPER(pe2.nombres || ' ' || pe2.apellido1 || ' ' || pe2.apellido2) AS nombre_cajero,
        cj.descripcion,
        'MaquinasRuta' AS Tipo
      FROM cajasdiarias@consultas cj
      LEFT JOIN personas pe ON pe.documento = cj.prs_documento
      LEFT JOIN personas pe2 ON pe2.documento = SUBSTR(cj.loginregistro, 4)
      WHERE TRUNC(cj.fecha) BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
        AND cj.TRANS_CODIGO IN (47, 49)
        AND SUBSTR(cj.loginregistro, 3) IN (
          SELECT DISTINCT usuadocu FROM cerberus.ms_usuario WHERE grupcodi IN (16, 17)
        )
        AND cj.ZONA = :empresa
        AND cj.prs_documento IN (SELECT DISTINCT maquina FROM gamble.ubicacionmaquinas)
        AND cj.VERSION = 0
      ORDER BY CJ.FECHA, TRUNC(cj.fechasys) ASC, cj.CCOSTO, cj.loginregistro, cj.prs_documento
    `;

    return {
      sql,
      binds: { fecha1, fecha2, empresa },
    };
  }
}
