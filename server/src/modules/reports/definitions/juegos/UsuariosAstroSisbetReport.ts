import { BaseReport } from '../../core/BaseReport.js';
import { documentListOptionalCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
  ReportRow,
} from '../../core/ReportTypes.js';

export class UsuariosAstroSisbetReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'astro-sisbet-usuarios',
    module: 'Astro SISBET',
    name: 'Usuarios Astro SISBET',
    description: 'Genera archivo plano .txt delimitado por | para usuarios SISBET.',
    oracleSource: 'replica',
    inputSchema: 'document_list',
    outputType: 'txt',
    requiresCompany: false,
    displayOrder: 80,
  };

  protected readonly inputSchema = documentListOptionalCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'FORMATO_SISBET', header: 'FORMATO_SISBET', format: 'text', width: 70 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const docsClause = this.buildInClause('doc', input.documentos!);
    const companyFilter = company
      ? 'AND c.UBCNTRTRIO_CODIGO_COMPUESTO_DE = :empresa'
      : 'AND c.UBCNTRTRIO_CODIGO_COMPUESTO_DE IN (39627, 39628)';

    const sql = `
      SELECT
        DECODE(UBCNTRTRIO_CODIGO_COMPUESTO_DE, 39627, '020', 39628, '032', NULL) ||
        '|35|' ||
        c.prs_documento || '|' || UPPER(pe.nombres) || '|' ||
        UPPER(pe.apellido1) || '|' ||
        UPPER(pe.apellido2) || '|' ||
        c.prs_documento AS FORMATO_SISBET
      FROM CONTRATOSVENTA c
      LEFT JOIN personas pe ON pe.documento = c.prs_documento
      WHERE c.fechafinal IS NULL
        ${companyFilter}
        AND c.prs_documento IN (${docsClause.placeholders})
      ORDER BY c.prs_documento
    `;

    return {
      sql,
      binds: {
        ...(company ? { empresa: Number(company.code) } : {}),
        ...docsClause.binds,
      },
    };
  }

  protected override getSisbetArchiveCode(
    rows: ReportRow[],
    _input: ReportExecutionInput,
    company?: CompanyContext,
  ): string {
    if (company?.sisbetCode) {
      return company.sisbetCode;
    }
    const first = String(rows[0]?.FORMATO_SISBET ?? '');
    const code = first.split('|')[0]?.trim();
    return code === '020' || code === '032' ? code : '032';
  }
}
