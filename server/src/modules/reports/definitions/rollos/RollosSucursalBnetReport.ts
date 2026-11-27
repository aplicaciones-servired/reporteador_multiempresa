import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class RollosSucursalBnetReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'rollos-sucursal-bnet',
    module: 'Rollos BNET',
    name: 'Rollos por Sucursal BNET',
    description: 'Consumo de formularios y rollos térmicos/bond por punto de venta.',
    oracleSource: 'replica',
    inputSchema: 'date_range',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 121,
  };

  protected readonly inputSchema = dateRangeWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'CODIGO_PDV', header: 'CODIGO_PDV', format: 'text', width: 16 },
      { key: 'NOMBRE', header: 'NOMBRE', format: 'text', width: 34 },
      { key: 'FORM_GASTADOS', header: 'FORM_GASTADOS', format: 'number', width: 18 },
      { key: 'ROLL_GASTADOS', header: 'ROLL_GASTADOS', format: 'number', width: 18 },
      { key: 'TIPO_PAPEL', header: 'TIPO_PAPEL', format: 'text', width: 14 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);
    const empresa = Number(company!.code);

    const sql = `
      SELECT
        cf.prs_documento AS codigo_pdv,
        UPPER(cf.nombre_comercial) AS nombre,
        SUM(cf.cant_form) AS form_gastados,
        ROUND(SUM(cf.cant_form) / cf.divisor) AS roll_gastados,
        DECODE(cf.divisor, 150, 'TERMICO', 500, 'BOND') AS TIPO_PAPEL
      FROM (
        SELECT
          F.UBCNEG_TRTRIO_CODIGO AS PRS_DOCUMENTO,
          p.nombre_comercial,
          f.grupoventas AS GRUPO_DE_VENTA,
          COUNT(F.NUMERO) AS cant_form,
          0 AS FORMULARIOS_EXT,
          DECODE(serie, '100', 500, '200', 150, 500) AS DIVISOR
        FROM formularios f, info_puntosventa_cem P
        WHERE F.DAT_DTO_CODIGO = 10
          AND p.codigo = f.UBCNEG_TRTRIO_CODIGO
          AND F.ZONA = :empresa
          AND F.FECHA BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
        GROUP BY F.UBCNEG_TRTRIO_CODIGO, f.grupoventas, f.serie, p.nombre_comercial
        UNION ALL
        SELECT
          hF.UBCNEG_TRTRIO_CODIGO AS PRS_DOCUMENTO,
          p.nombre_comercial,
          hf.grupoventas AS GRUPO_DE_VENTA,
          COUNT(hF.NUMERO) AS cant_form,
          0 AS FORMULARIOS_EXT,
          DECODE(serie, '100', 500, '200', 150, 500) AS DIVISOR
        FROM hist_formularios hf, info_puntosventa_cem P
        WHERE hF.DAT_DTO_CODIGO = 10
          AND p.codigo = hf.UBCNEG_TRTRIO_CODIGO
          AND hF.ZONA = :empresa
          AND hF.FECHA BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
        GROUP BY hF.UBCNEG_TRTRIO_CODIGO, hf.grupoventas, p.nombre_comercial, hf.serie
      ) CF
      GROUP BY CF.PRS_DOCUMENTO, cf.divisor, cf.nombre_comercial
      ORDER BY CF.PRS_DOCUMENTO
    `;

    return {
      sql,
      binds: { empresa, fecha1, fecha2 },
    };
  }
}
