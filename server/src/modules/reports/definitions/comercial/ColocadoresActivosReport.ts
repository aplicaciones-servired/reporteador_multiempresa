import { BaseReport } from '../../core/BaseReport.js';
import { companyOnlySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

const EXCLUDED_COLOCADORES = [
  '1117222333',
  '1119444555',
  '1118111222',
  '11118000111',
  '11113002019',
  '1113002017',
  '1125111222',
  '1118002017',
  '2001',
  '901007388',
  '901260918',
  '901021901',
  '1112475812',
  '1234567890',
];

export class ColocadoresActivosReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'colocadores-activos',
    module: 'Colocadores',
    name: 'Colocadores Activos',
    description: 'Listado de colocadores con contrato activo e inclusión de nómina.',
    oracleSource: 'replica',
    inputSchema: 'company_only',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 90,
  };

  protected readonly inputSchema = companyOnlySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'PRS_DOCUMENTO', header: 'DOCUMENTO', format: 'text', width: 16 },
      { key: 'NOMBRES', header: 'NOMBRES', format: 'text', width: 34 },
      { key: 'FECHA_CONTRATO', header: 'FE_CONTRATO', format: 'date', width: 14 },
      { key: 'PLAN_VENTAS', header: 'PLAN_VENTA', format: 'text', width: 28 },
      { key: 'CENTRO_COSTO', header: 'C_COSTO', format: 'text', width: 28 },
    ];
  }

  public buildQuery(_input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const empresa = Number(company!.code);
    const excl1 = this.buildInClause('ex1', EXCLUDED_COLOCADORES);
    const excl2 = this.buildInClause('ex2', EXCLUDED_COLOCADORES);

    const sql = `
      SELECT
        CNV.PRS_DOCUMENTO,
        UPPER(PE.NOMBRES || ' ' || PE.APELLIDO1 || ' ' || PE.APELLIDO2) AS NOMBRES,
        TRUNC(CNV.FECHAINICIO) AS FECHA_CONTRATO,
        GP.DESCRIPCION AS PLAN_VENTAS,
        GAMBLEDBV10.RESTOUBICACIONNEG3(CNV.UBCNEG_TRTRIO_CODIGO) AS CENTRO_COSTO
      FROM CONTRATOSVENTA CNV, PERSONAS PE, GRUPOPLANES GP
      WHERE CNV.UBCNTRTRIO_CODIGO_COMPUESTO_DE = :empresa
        AND CNV.FECHAFINAL IS NULL
        AND PE.DOCUMENTO = CNV.PRS_DOCUMENTO
        AND GP.DESCRIPCION NOT IN ('JAMUNDI_SIN_COMISION', 'YUMBO_SIN_COMISION')
        AND CNV.PRS_DOCUMENTO NOT IN (${excl1.placeholders})
        AND GP.ID = CNV.GRUPOPLANES_CODIGO
      UNION ALL
      SELECT
        CNV.PRS_DOCUMENTO,
        UPPER(PE.NOMBRES || ' ' || PE.APELLIDO1 || ' ' || PE.APELLIDO2) AS NOMBRES,
        TRUNC(CNV.FECHAINICIO) AS FECHA_CONTRATO,
        GP.DESCRIPCION AS PLAN_VENTAS,
        GAMBLEDBV10.RESTOUBICACIONNEG3(CNV.UBCNEG_TRTRIO_CODIGO) AS CENTRO_COSTO
      FROM CONTRATOSVENTA CNV, PERSONAS PE, GRUPOPLANES GP
      WHERE CNV.UBCNTRTRIO_CODIGO_COMPUESTO_DE = :empresa
        AND CNV.FECHAFINAL IS NULL
        AND PE.DOCUMENTO = CNV.PRS_DOCUMENTO
        AND CNV.grupoplanes_codigo IN (212, 213)
        AND CNV.plan_tipoventavirtual IN (52, 54, 62, 58, 59, 68)
        AND CNV.PRS_DOCUMENTO NOT IN (${excl2.placeholders})
        AND GP.ID = CNV.GRUPOPLANES_CODIGO
    `;

    return {
      sql,
      binds: {
        empresa,
        ...excl1.binds,
        ...excl2.binds,
      },
    };
  }

  protected override buildFilenameBase(
    _input: ReportExecutionInput,
    company?: CompanyContext,
  ): string {
    return `REPORTE_COLOCADORES_ACTIVOS_${this.sanitizeFilenamePart(company?.cityLabel ?? 'EMPRESA')}`;
  }
}
