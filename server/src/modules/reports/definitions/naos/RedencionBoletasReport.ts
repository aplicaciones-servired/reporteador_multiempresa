import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class RedencionBoletasReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'redencion-boletas',
    module: 'LF y Raspes',
    name: '3. Redención de Boletas (Gane Diario)',
    description: 'Cantidad de boletas redimidas por usuario y empresa.',
    oracleSource: 'naos',
    inputSchema: 'date_range',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 152,
  };

  protected readonly inputSchema = dateRangeWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'EMPRESA', header: 'EMPRESA', format: 'text', width: 14 },
      { key: 'FECHA', header: 'FECHA', format: 'date', width: 14 },
      { key: 'USUARIO', header: 'USUARIO', format: 'text', width: 18 },
      { key: 'NOMBRES', header: 'NOMBRES', format: 'text', width: 32 },
      { key: 'CANT', header: 'CANTIDAD', format: 'number', width: 14 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);
    const empresa = Number(company!.code);

    const sql = `
      SELECT EMPRESA, FECHA, USUARIO, NOMBRES, CANT
      FROM (
        SELECT
          cp.UBCNTRTRIO_CODIGO_COMPUESTO_DE AS EMPRESA,
          NR.FECHAINICPROPRO AS FECHA,
          USUARIO,
          UPPER(PE.NOMBRES || ' ' || PE.APELLIDO1) AS NOMBRES,
          COUNT(1) AS cant
        FROM NUMERACIONCLIENTERIFA nr
        LEFT JOIN personas pe ON NR.USUARIO = 'CP' || PE.DOCUMENTO
        LEFT JOIN contratopersonas cp ON 'CP' || cp.prs_documento = NR.usuario
        WHERE NR.FECHAINICPROPRO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND cp.UBCNTRTRIO_CODIGO_COMPUESTO_DE = :empresa
          AND cp.fechafinal IS NULL
        GROUP BY
          cp.UBCNTRTRIO_CODIGO_COMPUESTO_DE,
          NR.FECHAINICPROPRO,
          NR.USUARIO,
          UPPER(PE.NOMBRES || ' ' || PE.APELLIDO1)
        ORDER BY NR.FECHAINICPROPRO, COUNT(1) DESC
      )
    `;

    return {
      sql,
      binds: { fecha1, fecha2, empresa },
    };
  }
}
