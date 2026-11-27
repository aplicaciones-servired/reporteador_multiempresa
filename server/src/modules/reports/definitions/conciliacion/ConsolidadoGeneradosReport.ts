import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeNoCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class ConsolidadoGeneradosReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'consolidado-generados',
    module: 'Conciliación Redcolsa',
    name: 'Consolidado Generados',
    description: 'Comparativo diario de ventas y premios generados Multired vs Servired.',
    oracleSource: 'principal',
    inputSchema: 'date_range',
    outputType: 'table_and_xlsx',
    requiresCompany: false,
    displayOrder: 20,
  };

  protected readonly inputSchema = dateRangeNoCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'FECHA', header: 'FECHA', format: 'date', width: 15 },
      { key: 'VENTA_MULTIRED', header: 'VENTA_MULTIRED', format: 'currency', width: 22 },
      {
        key: 'PREMIOS_GENERADOS_MULTIRED',
        header: 'PREMIOS_GENERADOS_MULTIRED',
        format: 'currency',
        width: 28,
      },
      { key: 'VENTA_SERVIRED', header: 'VENTA_SERVIRED', format: 'currency', width: 22 },
      {
        key: 'PREMIOS_GENERADOS_SERVIRED',
        header: 'PREMIOS_GENERADOS_SERVIRED',
        format: 'currency',
        width: 28,
      },
    ];
  }

  public buildQuery(input: ReportExecutionInput): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);

    const sql = `
      SELECT
        VPG.FECHA,
        ROUND(SUM(VPG.VENTA_MULTIRED)) AS VENTA_MULTIRED,
        ROUND(SUM(VPG.PREMIOS_GENERADOS_MULTIRED)) AS PREMIOS_GENERADOS_MULTIRED,
        ROUND(SUM(VPG.VENTA_SERVIRED)) AS VENTA_SERVIRED,
        ROUND(SUM(VPG.PREMIOS_GENERADOS_SERVIRED)) AS PREMIOS_GENERADOS_SERVIRED
      FROM (
        SELECT
          VP.FECHA,
          SUM(CASE WHEN VP.ZONA IN (39627) THEN VP.VRVENTA ELSE 0 END) AS VENTA_MULTIRED,
          0 AS PREMIOS_GENERADOS_MULTIRED,
          SUM(CASE WHEN VP.ZONA IN (39628) THEN VP.VRVENTA ELSE 0 END) AS VENTA_SERVIRED,
          0 AS PREMIOS_GENERADOS_SERVIRED
        FROM VENTASPREMIOSDIAS vp, productos pr
        WHERE VP.PRODUCTO = PR.CODIGO
          AND PR.CODIGO_TIPOJUEGO NOT IN (15, 18, 110, 116)
          AND VP.FECHA BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND VP.FECHA NOT IN (TRUNC(SYSDATE))
        GROUP BY VP.FECHA
        UNION ALL
        SELECT
          PFR.FECHASORTEO AS FECHA,
          0 AS VENTA_MULTIRED,
          SUM(CASE WHEN PFR.CODCCOSTO IN (39629, 39630, 39631) THEN PFR.TOTALPREMIO ELSE 0 END) AS PREMIOS_GENERADOS_MULTIRED,
          0 AS VENTA_SERVIRED,
          SUM(CASE WHEN PFR.CODCCOSTO IN (39632) THEN PFR.TOTALPREMIO ELSE 0 END) AS PREMIOS_GENERADOS_SERVIRED
        FROM (
          SELECT
            PF.FECHASORTEO,
            PF.UBCNEG_TRTRIO_CODIGO AS CODCCOSTO,
            PF.TOTALPREMIO
          FROM premioformularios pf, FORMULARIOS F
          WHERE PF.FECHASORTEO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
            AND F.SERIE = PF.FRM_SERIE
            AND F.NUMERO = PF.FRM_NUMERO
            AND PF.FRM_SERIE || PF.FRM_NUMERO NOT IN (
              SELECT DISTINCT PF2.FRM_SERIE || PF2.FRM_NUMERO
              FROM premioformularios2 pf2
              WHERE PF2.FECHASORTEO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
                AND PF2.UBCNTRTRIO_CODIGUBICACION_PARA IN (39627, 39628)
            )
            AND DECODE(F.DAT_DTO_CODIFORMA_DE_PAGO_PARA, 73, 73, 329, 73, 74, 74) IN (73, 74)
            AND PF.UBCNTRTRIO_CODIGUBICACION_PARA IN (39627, 39628)
            AND PF.LTRY_CODIGO NOT IN (47, 48)
            AND PF.FECHASORTEO <> TRUNC(SYSDATE)
          UNION ALL
          SELECT
            PF.FECHASORTEO,
            PF.UBCNEG_TRTRIO_CODIGO AS CODCCOSTO,
            PF.TOTALPREMIO + PF2.TOTALPREMIO AS TOTALPREMIO
          FROM premioformularios pf, FORMULARIOS F, premioformularios2 pf2
          WHERE PF.FECHASORTEO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
            AND F.SERIE = PF.FRM_SERIE
            AND F.NUMERO = PF.FRM_NUMERO
            AND F.SERIE = PF2.FRM_SERIE
            AND F.NUMERO = PF2.FRM_NUMERO
            AND PF2.FRM_SERIE || PF2.FRM_NUMERO = PF.FRM_SERIE || PF.FRM_NUMERO
            AND DECODE(F.DAT_DTO_CODIFORMA_DE_PAGO_PARA, 73, 73, 329, 73, 74, 74) IN (73, 74)
            AND PF.UBCNTRTRIO_CODIGUBICACION_PARA IN (39627, 39628)
            AND PF.LTRY_CODIGO NOT IN (47, 48)
            AND PF.LTRY_CODIGO = PF2.LTRY_CODIGO
            AND PF.FECHASORTEO <> TRUNC(SYSDATE)
        ) PFR
        WHERE PFR.FECHASORTEO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
        GROUP BY PFR.FECHASORTEO
      ) VPG
      GROUP BY VPG.FECHA
      ORDER BY VPG.FECHA
    `;

    return {
      sql,
      binds: { fecha1, fecha2 },
    };
  }

  protected override buildFilenameBase(
    input: ReportExecutionInput,
    _company?: CompanyContext,
  ): string {
    return `CONSOLIDADO_GENERADOS_DEL_${this.formatFileDate(input.fecha1!)}_AL_${this.formatFileDate(input.fecha2!)}`;
  }
}
