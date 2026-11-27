import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class DetalleIncentivos3CFReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'detalle-incentivos-3cf',
    module: 'Conciliación Incentivos',
    name: 'Detalle Incentivo 3CF',
    description: 'Conciliación de premios con incentivo 3 cifras (hasta $756.000).',
    oracleSource: 'principal',
    inputSchema: 'date_range',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 30,
  };

  protected readonly inputSchema = dateRangeWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'FECHASORTEO', header: 'FECHASORTEO', format: 'date', width: 14 },
      { key: 'SERIE_KARDEX', header: 'SERIE_KARDEX', format: 'text', width: 20 },
      { key: 'CONSECUTIVO', header: 'CONSECUTIVO', format: 'text', width: 18 },
      { key: 'INCENTIVO', header: 'INCENTIVO', format: 'currency', width: 16 },
      { key: 'PREMIO_R', header: 'PREMIOS_R', format: 'currency', width: 16 },
      { key: 'RTFUENTE', header: 'RETEFUENTE', format: 'currency', width: 16 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);
    const empresa = Number(company!.code);

    const sql = `
      SELECT
        TPFI.FECHASORTEO,
        TPFI.SERIE AS SERIE_KARDEX,
        TPFI.CONSECUTIVO,
        ROUND(SUM(TPFI.TOTALPREMIO)) AS INCENTIVO,
        ROUND(SUM(TPFI.TOTALPREMIO_R)) AS PREMIO_R,
        ROUND(SUM(TPFI.RETENCIONFUENTE)) AS RTFUENTE
      FROM (
        SELECT
          PF.FECHASORTEO,
          PF.FRM_SERIE || PF.FRM_NUMERO AS SERIE,
          PF.SERIE_CONSTVO || PF.NUMERO_CONSTVO AS CONSECUTIVO,
          PF.TOTALPREMIO AS TOTALPREMIO,
          0 AS TOTALPREMIO_R,
          PF.RETENCIONFUENTE
        FROM PREMIOFORMULARIOS2 PF, DETALLEFORMULARIOS DF, FORMULARIOS F
        WHERE F.SERIE = DF.FRM_SERIE
          AND F.NUMERO = DF.FRM_NUMERO
          AND F.SERIE = PF.FRM_SERIE
          AND F.NUMERO = PF.FRM_NUMERO
          AND PF.FRM_SERIE = DF.FRM_SERIE
          AND PF.FRM_NUMERO = DF.FRM_NUMERO
          AND PF.LTRY_CODIGO = DF.PRDLOT_LTRY_CODIGO
          AND DF.PRDLOT_PRODUCT_CODIGO = 3
          AND DF.VALORPREMIO <> 0
          AND PF.TOTALPREMIO <= 756000
          AND PF.LTRY_CODIGO <> 95
          AND F.ZONA IN (:empresa)
          AND PF.FECHASORTEO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
        UNION ALL
        SELECT
          PF.FECHASORTEO,
          PF.FRM_SERIE || PF.FRM_NUMERO AS SERIE,
          PF.SERIE_CONSTVO || PF.NUMERO_CONSTVO AS CONSECUTIVO,
          0 AS TOTALPREMIO,
          DF.VALORPREMIO AS TOTALPREMIO_R,
          PF.RETENCIONFUENTE
        FROM PREMIOFORMULARIOS PF, DETALLEFORMULARIOS DF, FORMULARIOS F
        WHERE F.SERIE = DF.FRM_SERIE
          AND F.NUMERO = DF.FRM_NUMERO
          AND F.SERIE = PF.FRM_SERIE
          AND F.NUMERO = PF.FRM_NUMERO
          AND PF.FRM_SERIE = DF.FRM_SERIE
          AND PF.FRM_NUMERO = DF.FRM_NUMERO
          AND PF.LTRY_CODIGO = DF.PRDLOT_LTRY_CODIGO
          AND PF.FRM_SERIE || PF.FRM_NUMERO IN (
            SELECT DISTINCT PF2.FRM_SERIE || PF2.FRM_NUMERO FROM PREMIOFORMULARIOS2 PF2
          )
          AND DF.PRDLOT_PRODUCT_CODIGO = 3
          AND DF.VALORPREMIO <> 0
          AND PF.TOTALPREMIO <= 756000
          AND PF.LTRY_CODIGO <> 95
          AND F.ZONA IN (:empresa)
          AND PF.FECHASORTEO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
      ) TPFI
      GROUP BY TPFI.FECHASORTEO, TPFI.SERIE, TPFI.CONSECUTIVO
      ORDER BY TPFI.FECHASORTEO
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
    return `DETALLE_PREMIOS_INCENTIVOS3CF_${this.sanitizeFilenamePart(company?.cityLabel ?? 'EMPRESA')}_${this.formatFileDate(input.fecha1!)}_AL_${this.formatFileDate(input.fecha2!)}`;
  }
}
