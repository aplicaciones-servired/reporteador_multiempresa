import { BaseReport } from '../../core/BaseReport.js';
import { singleDateSorteoWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class PlanoDevolucionesReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'plano-devoluciones',
    module: 'Devoluciones',
    name: 'Plano Devoluciones',
    description: 'Genera planilla de devoluciones confirmadas por sorteo con consecutivo.',
    oracleSource: 'principal',
    inputSchema: 'single_date_sorteo',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 41,
  };

  protected readonly inputSchema = singleDateSorteoWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'RN', header: 'RN', format: 'number', width: 8 },
      { key: 'FECHAREGISTRA', header: 'FECHA REGISTRA', format: 'text', width: 15 },
      { key: 'COLOCADOR', header: 'COLOCADOR', format: 'text', width: 15 },
      { key: 'NOMBRES', header: 'NOMBRES', format: 'text', width: 32 },
      { key: 'LOTERIA', header: 'LOTERIA', format: 'text', width: 26 },
      { key: 'SORTEO', header: 'SORTEO', format: 'text', width: 12 },
      { key: 'ESTADO', header: 'ESTADO', format: 'text', width: 18 },
      {
        key: 'DEVOLUCION_SIN_CONSECUTIVO',
        header: 'DEVOLUCION SIN CONSECUTIVO',
        format: 'text',
        width: 28,
      },
      {
        key: 'DEVOLUCION_CON_CONSECUTIVO',
        header: 'DEVOLUCION CON CONSECUTIVO',
        format: 'text',
        width: 32,
      },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const sorteo = Number(input.sorteo!);
    const bodega = Number(company!.warehouseCode);

    const sql = `
      WITH datos AS (
        SELECT
          ROW_NUMBER() OVER (ORDER BY rpt.loteria, rpt.colocador, rpt.sorteo, rpt.billete) AS rn,
          rpt.fecharegistra,
          rpt.colocador,
          rpt.nombres,
          rpt.loteria,
          rpt.sorteo,
          rpt.estado,
          rpt.billete || '00' || rpt.cant || '0' || rpt.cant AS DEVOLUCION_SIN_CONSECUTIVO
        FROM (
          SELECT
            rp.fecharegistra,
            rp.colocador,
            rp.nombres,
            rp.loteria,
            rp.sorteo,
            rp.billete,
            rp.estado,
            COUNT(DISTINCT rp.cant_fracciones) AS cant
          FROM (
            SELECT
              TO_CHAR(t.FECHAREGISTRA, 'DD/MM/YYYY') AS FECHAREGISTRA,
              SUBSTR(t.LOGINUSR_REGISTRA, 3) AS COLOCADOR,
              UPPER(pe.NOMBRES || ' ' || pe.APELLIDO1 || ' ' || pe.APELLIDO2) AS NOMBRES,
              pi.nombre AS loteria,
              kc.sorteo,
              dt.numero || dt.serie AS BILLETE,
              dt.fraccion AS CANT_FRACCIONES,
              CASE
                WHEN t.ESTADO = 0 THEN 'Construcción'
                WHEN t.ESTADO = 1 THEN 'PENDIENTE'
                WHEN t.ESTADO = 2 THEN 'RECIBIDO'
                WHEN t.ESTADO = 3 THEN 'CONFIRMADO'
                WHEN t.ESTADO = 4 THEN 'RECHAZADO'
                WHEN t.ESTADO = 5 THEN 'CERRADOXDEVOLUCION'
                ELSE 'Otro Estado'
              END AS ESTADO
            FROM traslado t
            LEFT JOIN kardexbodega kb ON kb.codigo = t.karbod_codigo
            LEFT JOIN detalletraslado dt ON dt.traslado_codigo = t.codigo
            LEFT JOIN kardexcantidad kc ON kc.codigo = kb.karcan_codigo
            LEFT JOIN productosinventario pi ON pi.codigo = kc.proinv_codigo
            LEFT JOIN personas pe ON 'CV' || pe.documento = t.loginusr_registra
            WHERE TRUNC(t.FECHAREGISTRA) = TO_DATE(:fecha1, 'DD/MM/YYYY')
              AND kc.sorteo = :sorteo
              AND t.ESTADO = 3
              AND dt.numero || dt.serie IS NOT NULL
              AND t.BODDESTINO_CODIGO = :bodega
              AND t.LOGINUSR_REGISTRA LIKE '%CV%'
          ) rp
          GROUP BY
            rp.fecharegistra,
            rp.colocador,
            rp.nombres,
            rp.loteria,
            rp.sorteo,
            rp.billete,
            rp.estado
        ) rpt
        ORDER BY rpt.loteria, rpt.colocador, rpt.sorteo, rpt.billete
      )
      SELECT
        RN,
        FECHAREGISTRA,
        COLOCADOR,
        NOMBRES,
        LOTERIA,
        SORTEO,
        ESTADO,
        DEVOLUCION_SIN_CONSECUTIVO,
        DEVOLUCION_SIN_CONSECUTIVO ||
        CASE
          WHEN rn BETWEEN 1 AND 50 THEN '001' || LPAD(rn, 2, '0')
          WHEN rn BETWEEN 51 AND 99 THEN '002' || LPAD(rn - 50, 2, '0')
          WHEN rn = 100 THEN '02100'
          WHEN rn BETWEEN 101 AND 150 THEN '031' || LPAD(rn - 100, 2, '0')
          WHEN rn BETWEEN 151 AND 199 THEN '041' || LPAD(rn - 150, 2, '0')
          ELSE '051' || LPAD(rn - 199, 2, '0')
        END AS DEVOLUCION_CON_CONSECUTIVO
      FROM datos
    `;

    return {
      sql,
      binds: { fecha1, sorteo, bodega },
    };
  }
}
