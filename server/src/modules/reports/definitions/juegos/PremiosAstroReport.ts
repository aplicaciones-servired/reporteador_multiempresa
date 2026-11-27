import { BaseReport } from '../../core/BaseReport.js';
import { singleDateSerieNoCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class PremiosAstroReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'premios-astro',
    module: 'Astro',
    name: 'Premios Astro',
    description: 'Consulta premios de Astro por serie/número y fecha de pago desde.',
    oracleSource: 'replica',
    inputSchema: 'single_date_serie',
    outputType: 'table_and_xlsx',
    requiresCompany: false,
    displayOrder: 81,
  };

  protected readonly inputSchema = singleDateSerieNoCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'FECHAPAGO', header: 'FECHAPAGO', format: 'date', width: 14 },
      { key: 'HORAPAGO', header: 'HORAPAGO', format: 'text', width: 12 },
      { key: 'DOCUMENTOTERCERO', header: 'DOCUMENTOTERCERO', format: 'text', width: 18 },
      { key: 'NOMBRES', header: 'NOMBRES', format: 'text', width: 32 },
      { key: 'SERIE', header: 'SERIE', format: 'text', width: 12 },
      { key: 'NUMERO', header: 'NUMERO', format: 'text', width: 16 },
      { key: 'TOTALPREMIO', header: 'TOTALPREMIO', format: 'currency', width: 16 },
      { key: 'RETEFUENTE', header: 'RETEFUENTE', format: 'currency', width: 16 },
      { key: 'DOCUMENTOCAJERO', header: 'DOCUMENTOCAJERO', format: 'text', width: 18 },
      { key: 'CAJERO', header: 'CAJERO', format: 'text', width: 32 },
      { key: 'CODIGO_TIPOJUEGO', header: 'CODIGO_TIPOJUEGO', format: 'number', width: 18 },
      { key: 'TIPO_PREMIO', header: 'TIPO_PREMIO', format: 'text', width: 18 },
    ];
  }

  public buildQuery(input: ReportExecutionInput): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const serie = input.serie!;

    const sql = `
      SELECT
        PP.FECHAPAGO,
        PP.HORA AS HORAPAGO,
        PP.DOCUMENTOTERCERO,
        UPPER(PE.NOMBRES || ' ' || PE.APELLIDO1 || ' ' || PE.APELLIDO2) AS NOMBRES,
        PP.SERIE,
        PP.NUMERO,
        PP.TOTALPREMIO,
        PP.RETEFUENTE,
        PP.DOCUMENTOCAJERO,
        UPPER(PE2.NOMBRES || ' ' || PE2.APELLIDO1 || ' ' || PE2.APELLIDO2) AS CAJERO,
        PP.CODIGO_TIPOJUEGO,
        TIPO_PREMIO
      FROM PREMIOSPERSONAPROVEEDOR PP
      LEFT JOIN PERSONAS PE ON PE.DOCUMENTO = PP.DOCUMENTOTERCERO
      LEFT JOIN PERSONAS PE2 ON PE2.DOCUMENTO = PP.DOCUMENTOCAJERO
      WHERE PP.FECHAPAGO >= TO_DATE(:fecha1, 'DD/MM/YYYY')
        AND PP.SERIE || PP.NUMERO = :serie
      ORDER BY PP.FECHAPAGO
    `;

    return {
      sql,
      binds: { fecha1, serie },
    };
  }

  protected override buildFilenameBase(
    input: ReportExecutionInput,
    _company?: CompanyContext,
  ): string {
    return `PREMIOS_ASTRO_${this.sanitizeFilenamePart(input.serie ?? 'SERIE')}_${this.formatFileDate(input.fecha1!)}`;
  }
}
