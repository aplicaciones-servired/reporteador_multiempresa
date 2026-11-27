import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class DetallePremiosPagadosReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'detalle-premios-pagados',
    module: 'Conciliación Redcolsa',
    name: 'Detalle Premios Pagados',
    description: 'Detalle por tiquete de premios pagados, cajero, colocador y ganador.',
    oracleSource: 'principal',
    inputSchema: 'date_range',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 23,
  };

  protected readonly inputSchema = dateRangeWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'FECHAPAGO', header: 'FECHAPAGO', format: 'date', width: 14 },
      { key: 'CCOSTO', header: 'CCOSTO', format: 'text', width: 26 },
      { key: 'CAJERO', header: 'CAJERO', format: 'text', width: 16 },
      { key: 'NOMBRE_CAJERO', header: 'NOMBRE_CAJERO', format: 'text', width: 20 },
      { key: 'COLOCADOR', header: 'COLOCADOR', format: 'text', width: 16 },
      { key: 'NOMBRE_COLOCADOR', header: 'NOMBRE_COLOCADOR', format: 'text', width: 20 },
      { key: 'SERIE', header: 'SERIE', format: 'text', width: 20 },
      { key: 'CONSECUTIVO', header: 'CONSECUTIVO', format: 'text', width: 18 },
      { key: 'TIPOVTA', header: 'TIPOVENTA', format: 'text', width: 16 },
      { key: 'FECHASORTEO', header: 'FECHASORTEO', format: 'date', width: 14 },
      { key: 'TOTALPREMIO', header: 'TOTALPREMIO', format: 'currency', width: 16 },
      { key: 'RETENCIONFUENTE', header: 'RETENCIONFUENTE', format: 'currency', width: 16 },
      { key: 'PREMIO_NETO', header: 'PREMIO_NETO', format: 'currency', width: 16 },
      { key: 'DOC_GANADOR', header: 'DOC_GANADOR', format: 'text', width: 16 },
      { key: 'NOMBRES', header: 'NOMBRES', format: 'text', width: 22 },
      { key: 'APELLIDO1', header: 'APELLIDO1', format: 'text', width: 18 },
      { key: 'APELLIDO2', header: 'APELLIDO2', format: 'text', width: 18 },
      { key: 'DIRECCION', header: 'DIRECCION', format: 'text', width: 28 },
      { key: 'CODCCOSTO', header: 'CODCCOSTO', format: 'number', width: 12 },
      { key: 'TIPO_JUEGO', header: 'TIPO_JUEGO', format: 'text', width: 20 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);
    const empresa = company!.code;

    const sql = `
      SELECT
        PPG.FECHAPAGO,
        PPG.CCOSTO,
        PPG.CAJERO,
        'XXXXXXXXX' AS NOMBRE_CAJERO,
        PPG.COLOCADOR,
        'XXXXXXXXX' AS NOMBRE_COLOCADOR,
        PPG.DETALLE AS SERIE,
        PPG.CONSECUTIVO,
        'SISTEMATIZADA' AS TIPOVTA,
        PPG.FECHASORTEO,
        ROUND(PPG.TOTALPREMIO) AS TOTALPREMIO,
        ROUND(PPG.RETENCIONFUENTE) AS RETENCIONFUENTE,
        ROUND(PPG.TOTALPREMIO - PPG.RETENCIONFUENTE) AS PREMIO_NETO,
        PPG.CLIENTE AS DOC_GANADOR,
        PPG.NOMBRES,
        PPG.APELLIDO1,
        PPG.APELLIDO2,
        PPG.DIRECCION,
        PPG.CODCCOSTO,
        PPG.TIPO_JUEGO
      FROM (
        SELECT DISTINCT
          PF.LTRY_CODIGO,
          PP.FECHAPAGO,
          gambledbv10.restoubicacionneg3(PF.UBCNEG_TRTRIO_CODIGO) AS CCOSTO,
          PP.PRS_DOCUMENTO AS CLIENTE,
          PF.CONTPRS_PRS_DOCUMENTO AS CAJERO,
          F.PRS_DOCUMENTO AS COLOCADOR,
          PP.PRMFOR_FRM_SERIE || PP.PRMFOR_FRM_NUMERO AS DETALLE,
          F.SERIE_CONSTVO || F.NUMERO_CONSTVO AS CONSECUTIVO,
          PF.TOTALPREMIO,
          PF.RETENCIONFUENTE,
          DECODE(F.DAT_DTO_CODIFORMA_DE_PAGO_PARA, 73, 73, 329, 73, 74, 74) AS TIPO,
          PF.FECHASORTEO,
          PE.NOMBRES,
          PE.APELLIDO1,
          PE.APELLIDO2,
          PE.DIRECCION,
          PF.UBCNEG_TRTRIO_CODIGO AS CODCCOSTO,
          TJ.NOMBRE AS TIPO_JUEGO
        FROM PREMIOSPERSONA PP, FORMULARIOS F, PREMIOFORMULARIOS PF, PERSONAS PE, TIPOJUEGOS TJ
        WHERE PP.FECHAPAGO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND F.CODIGO_TIPOJUEGO NOT IN (25, 18)
          AND TJ.CODIGO = F.CODIGO_TIPOJUEGO
          AND PE.DOCUMENTO = PP.PRS_DOCUMENTO
          AND F.SERIE = PP.PRMFOR_FRM_SERIE
          AND F.NUMERO = PP.PRMFOR_FRM_NUMERO
          AND F.SERIE = PF.FRM_SERIE
          AND F.NUMERO = PF.FRM_NUMERO
          AND PP.PRMFOR_FRM_SERIE = PF.FRM_SERIE
          AND PP.PRMFOR_FRM_NUMERO = PF.FRM_NUMERO
          AND PP.PRMFOR_FRM_SERIE || PP.PRMFOR_FRM_NUMERO NOT IN (
            SELECT DISTINCT PF2.FRM_SERIE || PF2.FRM_NUMERO
            FROM premioformularios2 pf2
            WHERE PF2.UBCNTRTRIO_CODIGUBICACION_PARA = :empresa
          )
          AND PP.FECHAPAGO <> TRUNC(SYSDATE)
          AND F.ZONA IN (:empresa)
        UNION ALL
        SELECT DISTINCT
          PF.LTRY_CODIGO,
          PP.FECHAPAGO,
          gambledbv10.restoubicacionneg3(PF.UBCNEG_TRTRIO_CODIGO) AS CCOSTO,
          PP.PRS_DOCUMENTO AS CLIENTE,
          PF.CONTPRS_PRS_DOCUMENTO AS CAJERO,
          F.PRS_DOCUMENTO AS COLOCADOR,
          PP.PRMFOR_FRM_SERIE || PP.PRMFOR_FRM_NUMERO AS DETALLE,
          F.SERIE_CONSTVO || F.NUMERO_CONSTVO AS CONSECUTIVO,
          PF.TOTALPREMIO + PF2.TOTALPREMIO AS TOTALPREMIO,
          PF.RETENCIONFUENTE + PF2.RETENCIONFUENTE AS RETENCIONFUENTE,
          DECODE(F.DAT_DTO_CODIFORMA_DE_PAGO_PARA, 73, 73, 329, 73, 74, 74) AS TIPO,
          PF.FECHASORTEO,
          PE.NOMBRES,
          PE.APELLIDO1,
          PE.APELLIDO2,
          PE.DIRECCION,
          PF.UBCNEG_TRTRIO_CODIGO AS CODCCOSTO,
          TJ.NOMBRE || '.' AS TIPO_JUEGO
        FROM PREMIOSPERSONA PP, FORMULARIOS F, PREMIOFORMULARIOS PF, PERSONAS PE, TIPOJUEGOS TJ, PREMIOFORMULARIOS2 PF2
        WHERE PP.FECHAPAGO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND F.CODIGO_TIPOJUEGO NOT IN (25, 18)
          AND TJ.CODIGO = F.CODIGO_TIPOJUEGO
          AND PE.DOCUMENTO = PP.PRS_DOCUMENTO
          AND PF.FRM_SERIE = PF2.FRM_SERIE
          AND PF.FRM_NUMERO = PF2.FRM_NUMERO
          AND F.SERIE = PP.PRMFOR_FRM_SERIE
          AND F.NUMERO = PP.PRMFOR_FRM_NUMERO
          AND F.SERIE = PF.FRM_SERIE
          AND F.NUMERO = PF.FRM_NUMERO
          AND PP.PRMFOR_FRM_SERIE = PF.FRM_SERIE
          AND PP.PRMFOR_FRM_NUMERO = PF.FRM_NUMERO
          AND PF.LTRY_CODIGO = PF2.LTRY_CODIGO
          AND PP.FECHAPAGO <> TRUNC(SYSDATE)
          AND F.ZONA IN (:empresa)
      ) PPG
      WHERE PPG.FECHAPAGO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
      ORDER BY PPG.FECHAPAGO ASC
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
    return `DETALLE_PREMIOS_PAGADOS_${this.sanitizeFilenamePart(company?.cityLabel ?? 'EMPRESA')}_${this.formatFileDate(input.fecha1!)}_AL_${this.formatFileDate(input.fecha2!)}`;
  }
}
