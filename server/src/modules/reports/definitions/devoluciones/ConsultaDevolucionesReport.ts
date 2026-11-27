import { BaseReport } from '../../core/BaseReport.js';
import { singleDateWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class ConsultaDevolucionesReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'consulta-devoluciones',
    module: 'Devoluciones',
    name: 'Consultar Devoluciones',
    description: 'Consulta traslados de devolución de lotería registrados por colocadores.',
    oracleSource: 'principal',
    inputSchema: 'single_date',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 40,
  };

  protected readonly inputSchema = singleDateWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'FECHAREGISTRA', header: 'FECHA REGISTRA', format: 'text', width: 15 },
      { key: 'COLOCADOR', header: 'COLOCADOR', format: 'text', width: 15 },
      { key: 'NOMBRES', header: 'NOMBRES', format: 'text', width: 32 },
      { key: 'LOTERIA', header: 'LOTERIA', format: 'text', width: 26 },
      { key: 'SORTEO', header: 'SORTEO', format: 'text', width: 12 },
      { key: 'ESTADO', header: 'ESTADO', format: 'text', width: 20 },
      {
        key: 'DEVOLUCION_SIN_CONSECUTIVO',
        header: 'DEVOLUCION SIN CONSECUTIVO',
        format: 'text',
        width: 30,
      },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const bodega = Number(company!.warehouseCode);

    const sql = `
      SELECT
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
      ORDER BY UPPER(rpt.nombres), rpt.loteria, rpt.sorteo, rpt.billete
    `;

    return {
      sql,
      binds: { fecha1, bodega },
    };
  }
}
