import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class VentasLfColocadorReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'ventas-lf-colocador',
    module: 'LF y Raspes',
    name: '4. Reporte de Ventas LF x Vendedor y Lotería',
    description: 'Ventas de Lotería Física consolidadas por colocador, lotería y sorteo.',
    oracleSource: 'naos',
    inputSchema: 'date_range',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 153,
  };

  protected readonly inputSchema = dateRangeWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'ZONA', header: 'ZONA', format: 'text', width: 12 },
      { key: 'FECHAVENTA', header: 'FECHA VENTA', format: 'date', width: 14 },
      { key: 'DOCUMENTO', header: 'DOCUMENTO', format: 'text', width: 16 },
      { key: 'NOMBRES', header: 'NOMBRES', format: 'text', width: 32 },
      { key: 'NIT', header: 'NIT', format: 'text', width: 16 },
      { key: 'RAZONSOCIAL', header: 'RAZONSOCIAL', format: 'text', width: 30 },
      { key: 'SORTEO', header: 'SORTEO', format: 'text', width: 12 },
      { key: 'VTA', header: 'VTA', format: 'currency', width: 16 },
      { key: 'CANT_FRACCIONES', header: 'CANT_FRACCIONES', format: 'number', width: 18 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);
    const empresa = Number(company!.code);

    const sql = `
      SELECT
        CO.ZONA,
        co.FECHAVENTA,
        co.prs_documento AS documento,
        UPPER(PE.NOMBRES || ' ' || PE.APELLIDO1 || ' ' || PE.APELLIDO2) AS NOMBRES,
        co.nit,
        pro.RAZONSOCIAL,
        SUBSTR(serial, 1, INSTR(serial, '-') - 1) AS sorteo,
        SUM(co.VALOR) AS VTA,
        COUNT(1) AS CANT_FRACCIONES
      FROM GAMBLE.detallevtasotrosproductos CO
      LEFT JOIN personas pe ON co.prs_documento = PE.DOCUMENTO
      LEFT JOIN proveedores pro ON pro.nit = co.nit
      WHERE CO.FECHAVENTA >= TO_DATE(:fecha1, 'DD/MM/YYYY')
        AND CO.FECHAVENTA <= TO_DATE(:fecha2, 'DD/MM/YYYY')
        AND CO.ZONA = :empresa
        AND co.servicio_codigo IN (510, 511)
      GROUP BY
        CO.ZONA,
        co.FECHAVENTA,
        co.prs_documento,
        co.nit,
        SUBSTR(serial, 1, INSTR(serial, '-') - 1),
        pro.RAZONSOCIAL,
        UPPER(PE.NOMBRES || ' ' || PE.APELLIDO1 || ' ' || PE.APELLIDO2)
      ORDER BY co.FECHAVENTA, co.prs_documento
    `;

    return {
      sql,
      binds: { fecha1, fecha2, empresa },
    };
  }
}
