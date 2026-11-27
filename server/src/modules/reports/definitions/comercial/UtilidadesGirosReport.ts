import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class UtilidadesGirosReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'utilidades-giros',
    module: 'Utilidades Giros',
    name: 'Utilidades Giros',
    description: 'Comisión de vendedor acumulada en servicio de giros por empresa.',
    oracleSource: 'replica',
    inputSchema: 'date_range',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 110,
  };

  protected readonly inputSchema = dateRangeWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'PRS_DOCUMENTO', header: 'DOCUMENTO', format: 'text', width: 16 },
      { key: 'NOMBRES', header: 'NOMBRES Y APELLIDOS', format: 'text', width: 34 },
      { key: 'UTILIDAD', header: 'UTILIDAD', format: 'currency', width: 18 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);
    const empresa = Number(company!.code);

    const sql = `
      SELECT
        CO.PRS_DOCUMENTO,
        UPPER(PE.NOMBRES || ' ' || PE.APELLIDO1 || ' ' || PE.APELLIDO2) AS NOMBRES,
        SUM(CO.COMISIONVENDEDOR) AS UTILIDAD
      FROM consolidadoventaservicios CO
      JOIN PERSONAS PE ON PE.DOCUMENTO = CO.PRS_DOCUMENTO
      WHERE CO.FECHAVENTA BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
        AND CO.PRS_DOCUMENTO <> 1086362524
        AND CO.NIT = '900084777'
        AND CO.COMISIONVENDEDOR <> 0
        AND CO.ZONA = :empresa
      GROUP BY CO.PRS_DOCUMENTO, PE.NOMBRES, PE.APELLIDO1, PE.APELLIDO2
      ORDER BY CO.PRS_DOCUMENTO
    `;

    return {
      sql,
      binds: { fecha1, fecha2, empresa },
    };
  }
}
