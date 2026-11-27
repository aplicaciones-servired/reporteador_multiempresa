import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class ExistenciaRollosReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'existencia-rollos',
    module: 'Rollos',
    name: 'Existencia de Rollos',
    description: 'Formularios/rollos gastados y existencia actual por colocador y papel.',
    oracleSource: 'replica',
    inputSchema: 'date_range',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 120,
  };

  protected readonly inputSchema = dateRangeWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'PRS_DOCUMENTO', header: 'DOCUMENTO', format: 'text', width: 16 },
      { key: 'NOMBRE', header: 'NOMBRES', format: 'text', width: 32 },
      { key: 'GRUPO_DE_VENTA', header: 'GRUPO_VENTA', format: 'text', width: 20 },
      { key: 'FORM_GASTADOS', header: 'CANT_FORM_GASTADOS', format: 'number', width: 20 },
      { key: 'ROLL_GASTADOS', header: 'CANT_ROLLOS_GASTADOS', format: 'number', width: 22 },
      { key: 'FORM_EXISTENTE', header: 'CANT_FORM_EXISTENCIA', format: 'number', width: 22 },
      { key: 'ROLLO_EXISTENTE', header: 'CANT_ROLLOS_EXISTENCIA', format: 'number', width: 24 },
      { key: 'TIPO_PAPEL', header: 'TIPO_PAPEL', format: 'text', width: 14 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);
    const empresa = Number(company!.code);

    const sql = `
      SELECT
        cf.prs_documento,
        UPPER(cf.nombre) AS nombre,
        DECODE(
          cf.grupo_de_venta,
          929, 'FIJO',
          930, 'MOVIL',
          12, 'RECORRIDO',
          13, 'PDA/CELULAR',
          931, 'PDA/CELULAR',
          950, 'GANESERVICIOS FIJO',
          952, 'INTEGRANTE CAJERO',
          953, 'INTEGRANTE CAJERO',
          'PDA/CELULAR'
        ) AS GRUPO_DE_VENTA,
        SUM(cf.cant_form) AS form_gastados,
        ROUND(SUM(cf.cant_form) / cf.divisor) AS roll_gastados,
        SUM(cf.formularios_ext) AS form_existente,
        ROUND(SUM(cf.formularios_ext) / cf.divisor) AS rollo_existente,
        DECODE(cf.divisor, 150, 'TERMICO', 500, 'BOND') AS TIPO_PAPEL
      FROM (
        SELECT
          F.PRS_DOCUMENTO,
          P.NOMBRES || ' ' || P.APELLIDO1 || ' ' || P.APELLIDO2 AS nombre,
          f.grupoventas AS GRUPO_DE_VENTA,
          COUNT(F.NUMERO) AS cant_form,
          0 AS FORMULARIOS_EXT,
          DECODE(serie, '100', 500, '200', 150, 500) AS DIVISOR
        FROM formularios f, personas P
        WHERE F.DAT_DTO_CODIGO = 10
          AND p.documento = f.prs_documento
          AND F.ZONA = :empresa
          AND F.FECHA BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
        GROUP BY F.PRS_DOCUMENTO, P.NOMBRES || ' ' || P.APELLIDO1 || ' ' || P.APELLIDO2, f.grupoventas, f.serie
        UNION ALL
        SELECT
          hF.PRS_DOCUMENTO,
          P.NOMBRES || ' ' || P.APELLIDO1 || ' ' || P.APELLIDO2 AS nombre,
          hf.grupoventas AS GRUPO_DE_VENTA,
          COUNT(hF.NUMERO) AS cant_form,
          0 AS FORMULARIOS_EXT,
          DECODE(serie, '100', 500, '200', 150, 500) AS DIVISOR
        FROM hist_formularios hf, personas P
        WHERE hF.DAT_DTO_CODIGO = 10
          AND p.documento = hf.prs_documento
          AND hF.ZONA = :empresa
          AND hF.FECHA BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
        GROUP BY hF.PRS_DOCUMENTO, P.NOMBRES || ' ' || P.APELLIDO1 || ' ' || P.APELLIDO2, hf.grupoventas, hf.serie
        UNION ALL
        SELECT
          FP.PRS_DOCUMENTO,
          PE.NOMBRES || ' ' || PE.APELLIDO1 || ' ' || PE.APELLIDO2 AS NOMBRES,
          GRPVTAS_CODIGO AS GRUPO_DE_VENTA,
          0 AS FORMULARIOS,
          COUNT(FP.NUMERO) AS FORMULARIOS_EXT,
          DECODE(serie, '100', 500, '200', 150, 500) AS DIVISOR
        FROM formulariopersonas fp, contratosventa cov, PERSONAS PE
        WHERE FP.PRS_DOCUMENTO = COV.PRS_DOCUMENTO
          AND PE.DOCUMENTO = FP.PRS_DOCUMENTO
          AND PE.DOCUMENTO = COV.PRS_DOCUMENTO
          AND COV.FECHAFINAL IS NULL
          AND cov.UBCNTRTRIO_CODIGO_COMPUESTO_DE = :empresa
        GROUP BY FP.PRS_DOCUMENTO, PE.NOMBRES || ' ' || PE.APELLIDO1 || ' ' || PE.APELLIDO2, GRPVTAS_CODIGO, FP.SERIE
      ) CF
      GROUP BY CF.PRS_DOCUMENTO, CF.nombre, cf.grupo_de_venta, cf.divisor
      ORDER BY CF.PRS_DOCUMENTO, SUM(cf.formularios_ext) ASC
    `;

    return {
      sql,
      binds: { empresa, fecha1, fecha2 },
    };
  }
}
