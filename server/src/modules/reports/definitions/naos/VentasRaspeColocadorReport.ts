import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class VentasRaspeColocadorReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'ventas-raspe-colocador',
    module: 'LF y Raspes',
    name: '5. Reporte de Ventas RASPE x Vendedor y Juego',
    description: 'Ventas de Raspe consolidadas por vendedor, juego y sorteo.',
    oracleSource: 'naos',
    inputSchema: 'date_range',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 154,
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
      { key: 'CANT_RASPE', header: 'CANTIDAD RASPES', format: 'number', width: 18 },
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
        COUNT(1) AS CANT_RASPE
      FROM GAMBLE.detallevtasotrosproductos CO
      LEFT JOIN personas pe ON co.prs_documento = PE.DOCUMENTO
      LEFT JOIN proveedores pro ON pro.nit = co.nit
      LEFT JOIN proveedorservicios ps ON ps.servicio_codigo = co.servicio_codigo
      WHERE CO.FECHAVENTA BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
        AND PS.requiereclave = 'LF'
        AND co.servicio_codigo NOT IN (510, 511)
        AND CO.ZONA = :empresa
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
