import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class PremiosLoteriaVirtualReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'loteria-virtual-premios',
    module: 'Lotería Virtual',
    name: 'Premios Lotería Virtual',
    description: 'Reporte de premios pagados de lotería virtual por empresa.',
    oracleSource: 'replica',
    inputSchema: 'date_range',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 60,
  };

  protected readonly inputSchema = dateRangeWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'ENVIO_NRO', header: 'ENVIO_NRO', format: 'text', width: 12 },
      { key: 'SERIE_COLILLA', header: 'SERIE_COLILLA', format: 'text', width: 20 },
      { key: 'FECHASORTEO', header: 'FECHASORTEO', format: 'date', width: 14 },
      { key: 'NRO_SORTEO', header: 'NRO_SORTEO', format: 'text', width: 14 },
      { key: 'NUMERO', header: 'NUMERO', format: 'text', width: 16 },
      { key: 'RAZONSOCIAL', header: 'RAZONSOCIAL', format: 'text', width: 32 },
      { key: 'PREMIO_NETO', header: 'PREMIO_NETO', format: 'currency', width: 16 },
      { key: 'FECHAPAGO', header: 'FECHAPAGO', format: 'date', width: 14 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);
    const empresa = Number(company!.code);

    const sql = `
      WITH DD_UNICO AS (
        SELECT
          FRM_SERIE,
          FRM_NUMERO,
          NUMEROAGANAR,
          ROW_NUMBER() OVER (PARTITION BY FRM_SERIE, FRM_NUMERO ORDER BY FRM_NUMERO) AS RN
        FROM hist_detalleformularios
      ),
      CP_UNICO AS (
        SELECT
          LOGIN,
          UBCNTRTRIO_CODIGO_COMPUESTO_DE,
          ROW_NUMBER() OVER (PARTITION BY LOGIN ORDER BY LOGIN) AS RN
        FROM CONTRATOPERSONAS
        WHERE FECHAFINAL IS NULL
      )
      SELECT
        '' AS ENVIO_NRO,
        PP.SERIE || '-' || PP.NUMERO AS SERIE_COLILLA,
        PP.FECHASORTEO,
        '' AS NRO_SORTEO,
        CASE
          WHEN DD.NUMEROAGANAR IS NOT NULL THEN
            SUBSTR(DD.NUMEROAGANAR, 1, 4) || '-' || SUBSTR(DD.NUMEROAGANAR, 5, 7)
          ELSE ''
        END AS NUMERO,
        PR.RAZONSOCIAL,
        PP.TOTALPREMIO - PP.RETEFUENTE AS PREMIO_NETO,
        PP.FECHAPAGO
      FROM premiospersonaproveedor PP
      JOIN proveedores PR ON PR.NIT = PP.PROVEEDOR
      JOIN CP_UNICO CP
        ON CP.LOGIN = PP.LOGINCAJERO
       AND CP.RN = 1
       AND CP.UBCNTRTRIO_CODIGO_COMPUESTO_DE = :empresa
      LEFT JOIN DD_UNICO DD
        ON DD.FRM_SERIE = PP.SERIE
       AND DD.FRM_NUMERO = PP.NUMERO
       AND DD.RN = 1
      WHERE PP.fechapago BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
        AND PP.CODIGO_TIPOJUEGO = 15
      ORDER BY PP.FECHAPAGO DESC, PR.RAZONSOCIAL
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
    return `REPORTE_PREMIOS_LOTERIA_${this.sanitizeFilenamePart(company?.cityLabel ?? 'EMPRESA')}_${this.formatFileDate(input.fecha1!)}_AL_${this.formatFileDate(input.fecha2!)}`;
  }
}
