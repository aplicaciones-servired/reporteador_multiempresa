import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class PremiosPagadosNaosReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'premios-pagados',
    module: 'Premios Pagados',
    name: 'Premios Pagados NAOS',
    description: 'Premios pagados de proveedores por cajero (local y @CONSULTAS).',
    oracleSource: 'naos',
    inputSchema: 'date_range',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 130,
  };

  protected readonly inputSchema = dateRangeWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'FECHAPAGO', header: 'FECHAPAGO', format: 'date', width: 14 },
      { key: 'SERIE', header: 'SERIE', format: 'text', width: 20 },
      { key: 'PREMIO', header: 'PREMIO', format: 'currency', width: 16 },
      { key: 'VENDEDOR', header: 'VENDEDOR', format: 'text', width: 16 },
      { key: 'NOMBRES', header: 'NOMBRES', format: 'text', width: 32 },
      { key: 'HORA', header: 'HORA', format: 'text', width: 12 },
      { key: 'PUNTO_VTA_PAGO', header: 'PUNTO_VTA_PAGO', format: 'number', width: 18 },
      { key: 'APLICACION', header: 'APLICACION', format: 'number', width: 12 },
      { key: 'MUNICIPIO', header: 'MUNICIPIO', format: 'text', width: 16 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);
    const ccClause = this.buildInClause('cc', company!.costCenters);

    const sql = `
      SELECT
        TT.FECHAPAGO,
        TT.SERIE,
        TT.PREMIO,
        TT.VENDEDOR,
        UPPER(PE.NOMBRES || ' ' || PE.APELLIDO1 || ' ' || PE.APELLIDO2) AS NOMBRES,
        TT.HORA,
        TT.PUNTO_VTA_PAGO,
        TT.APLICACION,
        DECODE(UN.TRTRIO_CODIGO_COMPUESTO_DE, 39629, 'YUMBO', 39630, 'VIJES', 39631, 'CUMBRE', 39632, 'JAMUNDI', UN.TRTRIO_CODIGO_COMPUESTO_DE) AS MUNICIPIO
      FROM (
        SELECT
          FECHAPAGO,
          SERIE || NUMERO AS SERIE,
          TOTALPREMIO - RETEFUENTE AS PREMIO,
          SUBSTR(LOGINCAJERO, 4) AS VENDEDOR,
          HORA,
          PUNTO_VTA_PAGO,
          1 AS APLICACION
        FROM premiospersonaproveedor
        WHERE FECHAPAGO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND documentocajero IN (SELECT DISTINCT usuadocu FROM cerberus.ms_usuario WHERE grupcodi IN (16, 17))
        UNION ALL
        SELECT
          FECHAPAGO,
          SERIE || NUMERO AS SERIE,
          TOTALPREMIO - RETEFUENTE AS PREMIO,
          SUBSTR(LOGINCAJERO, 4) AS VENDEDOR,
          HORA,
          PUNTO_VTA_PAGO,
          2 AS APLICACION
        FROM premiospersonaproveedor@CONSULTAS
        WHERE FECHAPAGO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND documentocajero IN (SELECT DISTINCT usuadocu FROM cerberus.ms_usuario WHERE grupcodi IN (16, 17))
          AND SERIE || NUMERO NOT IN (
            SELECT DISTINCT SERIE || NUMERO
            FROM premiospersonaproveedor
            WHERE FECHAPAGO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
              AND documentocajero IN (SELECT DISTINCT usuadocu FROM cerberus.ms_usuario WHERE grupcodi IN (16, 17))
          )
      ) TT
      JOIN PERSONAS PE ON PE.DOCUMENTO = TT.VENDEDOR
      JOIN UBICACIONNEGOCIOS UN ON UN.TRTRIO_CODIGO = TT.PUNTO_VTA_PAGO
      WHERE TT.FECHAPAGO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
        AND UN.TRTRIO_CODIGO_COMPUESTO_DE IN (${ccClause.placeholders})
      ORDER BY TT.FECHAPAGO, TT.APLICACION
    `;

    return {
      sql,
      binds: {
        fecha1,
        fecha2,
        ...ccClause.binds,
      },
    };
  }
}
