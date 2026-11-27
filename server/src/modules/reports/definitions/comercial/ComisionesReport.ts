import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class ComisionesReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'comisiones',
    module: 'Comisiones',
    name: 'Reporte de Comisiones',
    description: 'Ventas brutas, comisiones y ahorros diarios por colocador y punto.',
    oracleSource: 'replica',
    inputSchema: 'date_range',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 100,
  };

  protected readonly inputSchema = dateRangeWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'FECHA', header: 'FECHA', format: 'date', width: 14 },
      { key: 'TIPO', header: 'TIPO', format: 'text', width: 14 },
      { key: 'NOMBRE_PUNTO', header: 'NOMBRE_PUNTO', format: 'text', width: 28 },
      { key: 'PERSONA', header: 'DOCUMENTO', format: 'text', width: 16 },
      { key: 'NOMBRES', header: 'NOMBRES', format: 'text', width: 32 },
      { key: 'VENTA_BRUTA', header: 'VENTA_BRUTA', format: 'currency', width: 16 },
      { key: 'COMISION', header: 'COMISION', format: 'currency', width: 16 },
      { key: 'AHORRO', header: 'AHORRO', format: 'currency', width: 16 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);
    const empresa = Number(company!.code);

    const sql = `
      SELECT
        TV.FECHA,
        DECODE(TV.GRUPOVENTAS, 929, 'PUNTO FIJO', 930, 'MOVIL', 'MOVIL') AS TIPO,
        GAMBLEDBV10.RESTOUBICACIONNEG3(TV.SUCURSAL) AS NOMBRE_PUNTO,
        TV.PERSONA,
        UPPER(PE.NOMBRES || ' ' || PE.APELLIDO1 || ' ' || PE.APELLIDO2) AS NOMBRES,
        SUM(TV.VENTABRUTA) AS VENTA_BRUTA,
        ROUND(SUM(TV.COMISION)) AS COMISION,
        ROUND(SUM(TV.AHORRO)) AS AHORRO
      FROM v_totalventasnegocio tv, PERSONAS PE
      WHERE tv.fecha BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
        AND PE.DOCUMENTO = TV.PERSONA
        AND TV.VENTABRUTA <> 0
        AND TV.ZONA = :empresa
        AND TV.SERVICIO NOT IN (802, 804, 806, 807)
      GROUP BY TV.FECHA, TV.PERSONA, PE.NOMBRES || ' ' || PE.APELLIDO1 || ' ' || PE.APELLIDO2, TV.SUCURSAL, TV.GRUPOVENTAS
      ORDER BY TV.FECHA ASC
    `;

    return {
      sql,
      binds: { fecha1, fecha2, empresa },
    };
  }

  protected override buildFilenameBase(
    input: ReportExecutionInput,
    company?: CompanyContext,
  ): string {
    return `REPORTE_COMISIONES_${this.sanitizeFilenamePart(company?.cityLabel ?? 'EMPRESA')}_DEL_${this.formatFileDate(input.fecha1!)}_AL_${this.formatFileDate(input.fecha2!)}`;
  }
}
