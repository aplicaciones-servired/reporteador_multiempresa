import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class CantidadGeneradosReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'cantidad-generados',
    module: 'Conciliación Redcolsa',
    name: 'Cantidad Generados (Benelite vs Gamble)',
    description: 'Validación diaria de apuestas impresas, anuladas y montos por empresa.',
    oracleSource: 'principal',
    inputSchema: 'date_range',
    outputType: 'table_and_xlsx',
    requiresCompany: true,
    displayOrder: 24,
  };

  protected readonly inputSchema = dateRangeWithCompanySchema;

  constructor(private readonly beneliteHistTable: string) {
    super();
  }

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'FECHA', header: 'FECHA', format: 'date', width: 15 },
      { key: 'FRM_BENE', header: 'FRM_BENE', format: 'currency', width: 18 },
      { key: 'RC_BENE', header: 'RC_BENE', format: 'currency', width: 18 },
      { key: 'FRM_GANE', header: 'FRM_GANE', format: 'currency', width: 18 },
      { key: 'RC_GANE', header: 'RC_GANE', format: 'currency', width: 18 },
      { key: 'CANT_IMPRESOS', header: 'CANT_IMPRESOS', format: 'number', width: 18 },
      { key: 'CANT_ANULADOS', header: 'CNT_ANULADOS', format: 'number', width: 18 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);

    const daneB1 = this.buildInClause('dn1', company!.daneCodes);
    const daneB2 = this.buildInClause('dn2', company!.daneCodes);
    const daneB3 = this.buildInClause('dn3', company!.daneCodes);
    const daneB4 = this.buildInClause('dn4', company!.daneCodes);
    const daneB5 = this.buildInClause('dn5', company!.daneCodes);
    const daneB6 = this.buildInClause('dn6', company!.daneCodes);

    const games1 = this.buildInClause('gm1', company!.excludedChanceGames);
    const games2 = this.buildInClause('gm2', company!.excludedChanceGames);
    const units = this.buildInClause('rcu', company!.registrocajasUnits);
    const positiveFilter = company!.requirePositiveCash ? 'AND valor > 0' : '';

    const sql = `
      SELECT
        VALI.FECHA,
        SUM(VALI.FRM_BENE) AS FRM_BENE,
        SUM(VALI.FRM_BENE) AS RC_BENE,
        SUM(VALI.FRM_GANE) AS FRM_GANE,
        SUM(VALI.RC_GANE) AS RC_GANE,
        SUM(VALI.CANT_IMPRESOS) AS CANT_IMPRESOS,
        SUM(VALI.CANT_ANULADOS) AS CANT_ANULADOS
      FROM (
        SELECT
          BN.APFECHA AS FECHA,
          SUM(BN.APTOPAGA) AS FRM_BENE,
          0 AS FRM_GANE,
          0 AS RC_GANE,
          0 AS CANT_IMPRESOS,
          0 AS CANT_ANULADOS
        FROM BN_APUESTAS@BENELITE bn
        WHERE bn.apestado = 17
          AND bn.apfecha BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND BN.APCODANE IN (${daneB1.placeholders})
          AND bn.aplogin != '12345'
        GROUP BY BN.APFECHA
        UNION ALL
        SELECT
          BN.APFECHA AS FECHA,
          SUM(BN.APTOPAGA) AS FRM_BENE,
          0 AS FRM_GANE,
          0 AS RC_GANE,
          0 AS CANT_IMPRESOS,
          0 AS CANT_ANULADOS
        FROM ${this.beneliteHistTable} bn
        WHERE bn.apestado = 17
          AND bn.apfecha BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND BN.APCODANE IN (${daneB2.placeholders})
          AND bn.aplogin != '12345'
        GROUP BY BN.APFECHA
        UNION ALL
        SELECT
          fecha,
          0 AS FRM_BENE,
          ROUND(SUM(totalpagado)) AS FRM_GANE,
          0 AS RC_GANE,
          0 AS CANT_IMPRESOS,
          0 AS CANT_ANULADOS
        FROM formularios
        WHERE dat_dto_codla_elaboracion_para = 17
          AND dat_dto_codigo IN ('10', '276')
          AND zona = :empresa
          AND FECHA BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND codigo_tipojuego NOT IN (${games1.placeholders})
        GROUP BY fecha
        UNION ALL
        SELECT
          fecha,
          0 AS FRM_BENE,
          ROUND(SUM(totalpagado)) AS FRM_GANE,
          0 AS RC_GANE,
          0 AS CANT_IMPRESOS,
          0 AS CANT_ANULADOS
        FROM hist_formularios
        WHERE dat_dto_codla_elaboracion_para = 17
          AND dat_dto_codigo IN ('10', '276')
          AND zona = :empresa
          AND FECHA BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND codigo_tipojuego NOT IN (${games2.placeholders})
        GROUP BY fecha
        UNION ALL
        SELECT
          RCGA.FECHA,
          0 AS FRM_BENE,
          0 AS FRM_GANE,
          SUM(RCGA.RCO_GANE) AS RC_GANE,
          0 AS CANT_IMPRESOS,
          0 AS CANT_ANULADOS
        FROM (
          SELECT fecha AS FECHA, SUM(VALOR) AS RCO_GANE
          FROM registrocajas
          WHERE ESTTRN_TRANS_CODIGO = 1
            AND UBCNTRTRIO_CODIGO_COMPUESTO_DE IN (${units.placeholders})
            AND fecha BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
            AND dat_dto_codigo IN (73, 74)
            ${positiveFilter}
          GROUP BY fecha
          UNION ALL
          SELECT FECHAVENTA AS FECHA, SUM(C.VTABRUTA) AS RCO_GANE
          FROM CONSOLIDADOVENTASERVICIOS C
          WHERE C.SERVICIO_CODIGO IN (73, 75, 76, 77, 78, 117, 574, 575, 780, 30, 94, 92, 2193)
            AND C.ZONA = :empresa
            AND C.FECHAVENTA BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          GROUP BY FECHAVENTA
        ) RCGA
        GROUP BY RCGA.FECHA
        UNION ALL
        SELECT
          BN.APFECHA AS FECHA,
          0 AS FRM_BENE,
          0 AS FRM_GANE,
          0 AS RC_GANE,
          COUNT(1) AS CANT_IMPRESOS,
          0 AS CANT_ANULADOS
        FROM BN_APUESTAS@BENELITE bn
        WHERE bn.apestado = 17
          AND bn.apfecha BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND BN.APCODANE IN (${daneB3.placeholders})
          AND bn.aplogin != '12345'
        GROUP BY BN.APFECHA
        UNION ALL
        SELECT
          BN.APFECHA AS FECHA,
          0 AS FRM_BENE,
          0 AS FRM_GANE,
          0 AS RC_GANE,
          COUNT(1) AS CANT_IMPRESOS,
          0 AS CANT_ANULADOS
        FROM ${this.beneliteHistTable} bn
        WHERE bn.apestado = 17
          AND bn.apfecha BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND BN.APCODANE IN (${daneB4.placeholders})
          AND bn.aplogin != '12345'
        GROUP BY BN.APFECHA
        UNION ALL
        SELECT
          BN.APFECHA AS FECHA,
          0 AS FRM_BENE,
          0 AS FRM_GANE,
          0 AS RC_GANE,
          0 AS CANT_IMPRESOS,
          COUNT(1) AS CANT_ANULADOS
        FROM BN_APUESTAS@BENELITE bn
        WHERE bn.apestado = 18
          AND bn.apfecha BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND BN.APCODANE IN (${daneB5.placeholders})
          AND bn.aplogin != '12345'
        GROUP BY BN.APFECHA
        UNION ALL
        SELECT
          BN.APFECHA AS FECHA,
          0 AS FRM_BENE,
          0 AS FRM_GANE,
          0 AS RC_GANE,
          0 AS CANT_IMPRESOS,
          COUNT(1) AS CANT_ANULADOS
        FROM ${this.beneliteHistTable} bn
        WHERE bn.apestado = 18
          AND bn.apfecha BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND BN.APCODANE IN (${daneB6.placeholders})
          AND bn.aplogin != '12345'
        GROUP BY BN.APFECHA
      ) VALI
      GROUP BY VALI.FECHA
      ORDER BY VALI.FECHA
    `;

    return {
      sql,
      binds: {
        fecha1,
        fecha2,
        empresa: company!.code,
        ...daneB1.binds,
        ...daneB2.binds,
        ...daneB3.binds,
        ...daneB4.binds,
        ...daneB5.binds,
        ...daneB6.binds,
        ...games1.binds,
        ...games2.binds,
        ...units.binds,
      },
    };
  }
}
