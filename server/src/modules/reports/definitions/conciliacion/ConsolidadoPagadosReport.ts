import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeNoCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class ConsolidadoPagadosReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'consolidado-pagados',
    module: 'Conciliación Redcolsa',
    name: 'Consolidado Pagados',
    description: 'Resumen diario de premios pagados y retefuente Multired vs Servired.',
    oracleSource: 'principal',
    inputSchema: 'date_range',
    outputType: 'table_and_xlsx',
    requiresCompany: false,
    displayOrder: 21,
  };

  protected readonly inputSchema = dateRangeNoCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'FECHAPAGO', header: 'FECHA', format: 'date', width: 15 },
      { key: 'PREMIOS_PAGADOS_MULTIRED', header: 'PAGADOS_MULTIRED', format: 'currency', width: 22 },
      { key: 'RETEFUENTE_MULTIRED', header: 'RETEFUENTE_MULTIRED', format: 'currency', width: 22 },
      { key: 'PREMIOS_PAGADOS_SERVIRED', header: 'PAGADOS_SERVIRED', format: 'currency', width: 22 },
      { key: 'RETEFUENTE_SERVIRED', header: 'RETEFUENTE_SERVIRED', format: 'currency', width: 22 },
    ];
  }

  public buildQuery(input: ReportExecutionInput): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);

    const sql = `
      SELECT
        PRE.FECHAPAGO,
        SUM(CASE WHEN PRE.ZONA IN (39627, 1197) THEN PRE.PREMIO ELSE 0 END) AS PREMIOS_PAGADOS_MULTIRED,
        SUM(CASE WHEN PRE.ZONA IN (39627, 1197) THEN PRE.RTEFUENTE ELSE 0 END) AS RETEFUENTE_MULTIRED,
        SUM(CASE WHEN PRE.ZONA IN (39628, 2023) THEN PRE.PREMIO ELSE 0 END) AS PREMIOS_PAGADOS_SERVIRED,
        SUM(CASE WHEN PRE.ZONA IN (39628, 2023) THEN PRE.RTEFUENTE ELSE 0 END) AS RETEFUENTE_SERVIRED
      FROM (
        SELECT DISTINCT
          PF.LTRY_CODIGO,
          p.fechapago AS fechapago,
          pf.fechasorteo,
          p.prmfor_frm_serie || p.prmfor_frm_numero AS serie,
          ROUND(pf.totalpremio) AS PREMIO,
          ROUND(pf.retencionfuente) AS RTEFUENTE,
          F.ZONA AS zona
        FROM premiospersona p, premioformularios pf, territorios t, formularios f, detalleformularios d
        WHERE p.fechapago BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND P.FECHAPAGO NOT IN (TRUNC(SYSDATE))
          AND P.prmfor_frm_serie = PF.frm_serie
          AND P.prmfor_frm_numero = PF.frm_numero
          AND PF.FRM_SERIE || PF.FRM_NUMERO NOT IN (
            SELECT DISTINCT PF2.FRM_SERIE || PF2.FRM_NUMERO
            FROM premioformularios2 pf2
            WHERE PF2.UBCNTRTRIO_CODIGUBICACION_PARA IN (39627, 39628)
          )
          AND F.serie = PF.frm_serie
          AND F.numero = PF.frm_numero
          AND p.prmfor_frm_serie = d.frm_serie
          AND p.prmfor_frm_numero = d.frm_numero
          AND d.valorpremio > 0
          AND pf.ubcntrtrio_codigubicacion_para = t.codigo
          AND f.codigo_tipojuego NOT IN (18, 25)
        UNION ALL
        SELECT DISTINCT
          PF.LTRY_CODIGO,
          p.fechapago AS fechapago,
          pf.fechasorteo,
          p.prmfor_frm_serie || p.prmfor_frm_numero AS serie,
          ROUND(pf.totalpremio + pf2.totalpremio) AS PREMIO,
          ROUND(pf.retencionfuente + pf2.retencionfuente) AS RTEFUENTE,
          F.ZONA AS zona
        FROM premiospersona p, premioformularios pf, territorios t, formularios f, detalleformularios d, premioformularios2 pf2
        WHERE p.fechapago BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND P.FECHAPAGO NOT IN (TRUNC(SYSDATE))
          AND P.prmfor_frm_serie = PF.frm_serie
          AND P.prmfor_frm_numero = PF.frm_numero
          AND F.serie = PF.frm_serie
          AND F.numero = PF.frm_numero
          AND p.prmfor_frm_serie = d.frm_serie
          AND p.prmfor_frm_numero = d.frm_numero
          AND F.SERIE = PF2.FRM_SERIE
          AND F.NUMERO = PF2.FRM_NUMERO
          AND d.valorpremio > 0
          AND PF.LTRY_CODIGO = PF2.LTRY_CODIGO
          AND pf.ubcntrtrio_codigubicacion_para = t.codigo
          AND f.codigo_tipojuego NOT IN (18, 25)
      ) PRE
      GROUP BY PRE.FECHAPAGO
      ORDER BY FECHAPAGO
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
    return `CONSOLIDADO_PAGADOS_DEL_${this.formatFileDate(input.fecha1!)}_AL_${this.formatFileDate(input.fecha2!)}`;
  }
}
