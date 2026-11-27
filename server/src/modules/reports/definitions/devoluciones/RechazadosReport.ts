import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class RechazadosReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'rechazados',
    module: 'Rechazados',
    name: 'Consultar Rechazados',
    description: 'Traslados de inventario rechazados desde bodega origen.',
    oracleSource: 'principal',
    inputSchema: 'date_range',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 50,
  };

  protected readonly inputSchema = dateRangeWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'CODIGO_TRASLADO', header: 'CODIGO_TRASLADO', format: 'number', width: 16 },
      { key: 'FECHAREGISTRA', header: 'FECHA_TRASLADO', format: 'date', width: 16 },
      { key: 'TIPO_TRASLADO', header: 'TIPO', format: 'text', width: 22 },
      { key: 'NOMBRE_JUEGO', header: 'NOMBRE_JUEGO', format: 'text', width: 24 },
      { key: 'BODEGA_ORIGEN', header: 'BODEGA_ORIGEN', format: 'text', width: 18 },
      { key: 'LOGINUSR_REGISTRA', header: 'USR_REGISTRA', format: 'text', width: 18 },
      { key: 'BODEGA_DESTINO', header: 'BODEGA_DESTINO', format: 'text', width: 24 },
      { key: 'LOGINUSR_RECIBE', header: 'USR_RECIBE', format: 'text', width: 18 },
      { key: 'CANTIDAD', header: 'CANTIDAD', format: 'number', width: 12 },
      { key: 'SORTEO', header: 'SORTEO', format: 'text', width: 12 },
      { key: 'ESTADO', header: 'ESTADO', format: 'text', width: 16 },
      { key: 'FECHA_RECHAZO', header: 'FECHA_RECHAZO', format: 'date', width: 16 },
      { key: 'HORA_RECHAZO', header: 'HORA_RECHAZO', format: 'text', width: 14 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);
    const bodega = Number(company!.warehouseCode);

    const sql = `
      SELECT
        T.CODIGO AS CODIGO_TRASLADO,
        t.fecharegistra,
        TR.NOMBRE AS TIPO_TRASLADO,
        pi.nombre AS NOMBRE_JUEGO,
        DECODE(t.bodorigen_codigo, 2, 'BODEGA_YUMBO', 3, 'BODEGA_JAMUNDI', 'DESCONOCIDA') AS BODEGA_ORIGEN,
        t.loginusr_registra,
        bo.nombre AS BODEGA_DESTINO,
        t.loginusr_recibe,
        t.cantidad_declarada AS CANTIDAD,
        kc.sorteo,
        CASE
          WHEN T.ESTADO = 0 THEN 'Construcción'
          WHEN T.ESTADO = 1 THEN 'PENDIENTE'
          WHEN T.ESTADO = 2 THEN 'RECIBIDO'
          WHEN T.ESTADO = 3 THEN 'CONFIRMADO'
          WHEN T.ESTADO = 4 THEN 'RECHAZADO'
          WHEN T.ESTADO = 5 THEN 'CERRADOXDEVOLUCION'
          ELSE 'Otro Estado'
        END AS ESTADO,
        t.fecharecibe AS FECHA_RECHAZO,
        t.horarecibe AS HORA_RECHAZO
      FROM TRASLADO T
      JOIN KARDEXBODEGA KB ON T.KARBOD_CODIGO = KB.CODIGO
      JOIN KARDEXCANTIDAD KC ON KC.CODIGO = KB.KARCAN_CODIGO
      JOIN TIPOTRASLADO TR ON T.tiptra_codigo = TR.CODIGO
      JOIN PRODUCTOSINVENTARIO PI ON PI.CODIGO = kc.proinv_codigo
      JOIN BODEGA BO ON t.boddestino_codigo = BO.CODIGO
      WHERE t.bodorigen_codigo = :bodega
        AND kc.proinv_codigo IN (28, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53)
        AND T.ESTADO = 4
        AND TRUNC(t.fecharegistra) BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
      ORDER BY t.fecharegistra
    `;

    return {
      sql,
      binds: { bodega, fecha1, fecha2 },
    };
  }
}
