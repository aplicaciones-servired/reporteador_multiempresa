import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class DetallePremiosGeneradosReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'detalle-premios-generados',
    module: 'Conciliación Redcolsa',
    name: 'Detalle Premios Generados',
    description: 'Detalle por tiquete de premios generados incluyendo incentivos.',
    oracleSource: 'principal',
    inputSchema: 'date_range',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 22,
  };

  protected readonly inputSchema = dateRangeWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'FECHASORTEO', header: 'FECHASORTEO', format: 'date', width: 14 },
      { key: 'CODCCOSTO', header: 'CODCCOSTO', format: 'number', width: 12 },
      { key: 'CCOSTO', header: 'CCOSTO', format: 'text', width: 26 },
      { key: 'CODPTOVTA', header: 'CODPTOVTA', format: 'number', width: 12 },
      { key: 'PTOVTA', header: 'PTOVTA', format: 'text', width: 28 },
      { key: 'FECHAVENTA', header: 'FECHAVENTA', format: 'date', width: 14 },
      { key: 'TIPOVENTA', header: 'TIPOVENTA', format: 'text', width: 16 },
      { key: 'SERIE', header: 'SERIE', format: 'text', width: 20 },
      { key: 'CONSECUTIVO', header: 'CONSECUTIVO', format: 'text', width: 18 },
      { key: 'TOTALPREMIO', header: 'TOTALPREMIO', format: 'currency', width: 16 },
      { key: 'RETENCIONFUENTE', header: 'RETEFUENTE', format: 'currency', width: 16 },
      { key: 'PREMIONETO', header: 'PREMIONETO', format: 'currency', width: 16 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);
    const empresa = Number(company!.code);

    const sql = `
      SELECT
        PFR.FECHASORTEO,
        PFR.CODCCOSTO,
        PFR.CCOSTO,
        PFR.CODPTOVTA,
        PFR.PTOVTA,
        PFR.FECHAVENTA,
        DECODE(PFR.TIPOVENTA, 1, 'MANUAL', 2, 'SISTEMATIZADA', 'NULL') AS TIPOVENTA,
        PFR.SERIE AS SERIE,
        PFR.CONSECUTIVO,
        ROUND(PFR.TOTALPREMIO) AS TOTALPREMIO,
        ROUND(PFR.RETENCIONFUENTE) AS RETENCIONFUENTE,
        ROUND(PFR.TOTALPREMIO - PFR.RETENCIONFUENTE) AS PREMIONETO
      FROM (
        SELECT
          PF.FECHASORTEO,
          PF.UBCNEG_TRTRIO_CODIGO AS CODCCOSTO,
          gambledbv10.restoubicacionneg3(PF.UBCNEG_TRTRIO_CODIGO) AS CCOSTO,
          F.UBCNEG_TRTRIO_CODIGO AS CODPTOVTA,
          gambledbv10.restoubicacionneg3(F.UBCNEG_TRTRIO_CODIGO) AS PTOVTA,
          F.FECHA AS FECHAVENTA,
          F.TPOVTA_CODIGO AS TIPOVENTA,
          PF.TOTALPREMIO,
          PF.RETENCIONFUENTE,
          PF.FRM_SERIE || PF.FRM_NUMERO AS SERIE,
          F.SERIE_CONSTVO || F.NUMERO_CONSTVO AS CONSECUTIVO,
          DECODE(F.DAT_DTO_CODIFORMA_DE_PAGO_PARA, 73, 73, 329, 73, 74, 74) AS TIPO
        FROM premioformularios pf, FORMULARIOS F
        WHERE PF.FECHASORTEO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND F.SERIE = PF.FRM_SERIE
          AND F.NUMERO = PF.FRM_NUMERO
          AND PF.FRM_SERIE || PF.FRM_NUMERO NOT IN (
            SELECT DISTINCT PF2.FRM_SERIE || PF2.FRM_NUMERO
            FROM premioformularios2 pf2
            WHERE PF2.FECHASORTEO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
              AND PF2.UBCNTRTRIO_CODIGUBICACION_PARA = :empresa
          )
          AND DECODE(F.DAT_DTO_CODIFORMA_DE_PAGO_PARA, 73, 73, 329, 73, 74, 74) IN (73, 74)
          AND PF.UBCNTRTRIO_CODIGUBICACION_PARA = :empresa
          AND PF.LTRY_CODIGO NOT IN (47, 48)
          AND PF.FECHASORTEO <> TRUNC(SYSDATE)
        UNION ALL
        SELECT
          PF.FECHASORTEO,
          PF.UBCNEG_TRTRIO_CODIGO AS CODCCOSTO,
          gambledbv10.restoubicacionneg3(PF.UBCNEG_TRTRIO_CODIGO) || '.' AS CCOSTO,
          F.UBCNEG_TRTRIO_CODIGO AS CODPTOVTA,
          gambledbv10.restoubicacionneg3(F.UBCNEG_TRTRIO_CODIGO) AS PTOVTA,
          F.FECHA AS FECHAVENTA,
          F.TPOVTA_CODIGO AS TIPOVENTA,
          PF.TOTALPREMIO + PF2.TOTALPREMIO AS TOTALPREMIO,
          PF.RETENCIONFUENTE + PF2.RETENCIONFUENTE AS RETENCIONFUENTE,
          PF.FRM_SERIE || PF.FRM_NUMERO AS SERIE,
          F.SERIE_CONSTVO || F.NUMERO_CONSTVO AS CONSECUTIVO,
          DECODE(F.DAT_DTO_CODIFORMA_DE_PAGO_PARA, 73, 73, 329, 73, 74, 74) AS TIPO
        FROM premioformularios pf, FORMULARIOS F, premioformularios2 pf2
        WHERE PF.FECHASORTEO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND F.SERIE = PF.FRM_SERIE
          AND F.NUMERO = PF.FRM_NUMERO
          AND F.SERIE = PF2.FRM_SERIE
          AND F.NUMERO = PF2.FRM_NUMERO
          AND PF2.FRM_SERIE || PF2.FRM_NUMERO = PF.FRM_SERIE || PF.FRM_NUMERO
          AND PF.LTRY_CODIGO = PF2.LTRY_CODIGO
          AND DECODE(F.DAT_DTO_CODIFORMA_DE_PAGO_PARA, 73, 73, 329, 73, 74, 74) IN (73, 74)
          AND PF.UBCNTRTRIO_CODIGUBICACION_PARA = :empresa
          AND PF.LTRY_CODIGO NOT IN (47, 48)
          AND PF.FECHASORTEO <> TRUNC(SYSDATE)
      ) PFR
      WHERE PFR.FECHASORTEO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
      ORDER BY PFR.FECHASORTEO
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
    return `DETALLE_PREMIOS_GENERADOS_${this.sanitizeFilenamePart(company?.cityLabel ?? 'EMPRESA')}_${this.formatFileDate(input.fecha1!)}_AL_${this.formatFileDate(input.fecha2!)}`;
  }
}
