import { BaseReport } from '../../core/BaseReport.js';
import { documentListWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class VendedoresBalotoReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'vendedores-baloto',
    module: 'Baloto',
    name: 'Vendedores Baloto',
    description: 'Planilla de alta de vendedores Baloto por número de documento.',
    oracleSource: 'replica',
    inputSchema: 'document_list',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 70,
  };

  protected readonly inputSchema = documentListWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'NIT', header: 'NIT EMPRESA', format: 'text', width: 16 },
      { key: 'RAZON_SOCIAL', header: 'RAZON SOCIAL', format: 'text', width: 32 },
      { key: 'DOCUMENTO', header: 'CODIGO VENDEDOR PARA VENTA', format: 'text', width: 24 },
      { key: 'VALOR_POR_DEFECTO', header: 'NUMERO DE DOCUMENTO', format: 'text', width: 20 },
      { key: 'TIPO', header: 'TIPO DE DOCUMENTO', format: 'text', width: 18 },
      { key: 'EXPEDIDO_EN', header: 'EXPEDIDO EN', format: 'text', width: 26 },
      { key: 'NOMBRES', header: 'NOMBRES', format: 'text', width: 22 },
      { key: 'APELLIDO1', header: 'PRIMER APELLIDO', format: 'text', width: 18 },
      { key: 'APELLIDO2', header: 'SEGUNDO APELLIDO', format: 'text', width: 18 },
      { key: 'SEXO', header: 'SEXO', format: 'text', width: 8 },
      { key: 'FECHANACIMIENTO', header: 'FECHA DE NACIMIENTO DIA-MES-AÑO', format: 'date', width: 26 },
      { key: 'NACIDO_EN', header: 'NACIDO EN - MUNICIPIO/DPTO', format: 'text', width: 26 },
      { key: 'DIRECCION', header: 'DIRECCION ASESOR', format: 'text', width: 30 },
      { key: 'RESIDE_EN', header: 'RESIDE EN - MUNICIPIO/DPTO', format: 'text', width: 24 },
      { key: 'TELEFONO', header: 'TELEFONO', format: 'text', width: 16 },
      { key: 'COD_DPTO', header: 'CODIGO DANE DEPARTAMENTO', format: 'text', width: 22 },
      { key: 'CODANE_MUNICIPIO', header: 'CODIGO DANE MUNICIPIO', format: 'text', width: 22 },
      { key: 'ESTADO', header: 'ESTADO', format: 'text', width: 12 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const docsClause = this.buildInClause('doc', input.documentos!);
    const empresa = Number(company!.code);

    const sql = `
      SELECT
        :nit AS NIT,
        :razonSocial AS RAZON_SOCIAL,
        PE.DOCUMENTO,
        PE.DOCUMENTO AS VALOR_POR_DEFECTO,
        'CEDULA' AS TIPO,
        GAMBLEDBV10_2.NOMBRETERRITORIOS1(UBCPOL_TRTRIO_CODIGEXPEDIDO_EN) || ' - ' || GAMBLEDBV10_2.NOMBRETERRITORIOS1(UBCPOTRTRIO_CODIGO_EXPEDIDO_EN) AS EXPEDIDO_EN,
        UPPER(PE.NOMBRES) AS NOMBRES,
        UPPER(PE.APELLIDO1) AS APELLIDO1,
        UPPER(PE.APELLIDO2) AS APELLIDO2,
        DECODE(DAT_DTO_CODIGO_SEXO_PARA, 34, 'F', 33, 'M', DAT_DTO_CODIGO_SEXO_PARA) AS SEXO,
        PE.FECHANACIMIENTO,
        GAMBLEDBV10_2.NOMBRETERRITORIOS1(UBCPOL_TRTRIO_CODIGO_NACIDO_EN) || ' - ' || GAMBLEDBV10_2.NOMBRETERRITORIOS1(UBCPOTRTRIO_CODIGO_PENACIDO_EN) AS NACIDO_EN,
        UPPER(PE.DIRECCION) AS DIRECCION,
        DECODE(HR.UBCNTRTRIO_CODIGO_COMPUESTO_DE, 39629, 'YUMBO - VALLE', 39630, 'VIJES - VALLE', 39631, 'CUMBRE - VALLE', 39632, 'JAMUNDI - VALLE') AS RESIDE_EN,
        PE.TELEFONO,
        '76' AS COD_DPTO,
        DECODE(HR.UBCNTRTRIO_CODIGO_COMPUESTO_DE, 39629, '76892', 39630, '76869', 39631, '76377', '76364') AS CODANE_MUNICIPIO,
        'ACTIVO' AS ESTADO
      FROM personas PE, HORARIOPERSONAS HR
      WHERE UBCNEG_TRTRIO_CODIGO NOT IN (11111)
        AND HR.CONTVTA_PRS_DOCUMENTO NOT IN (1)
        AND HR.CONTVTA_PRS_DOCUMENTO IN (${docsClause.placeholders})
        AND HR.CONTVTA_PRS_DOCUMENTO = PE.DOCUMENTO
        AND HR.CONTVTA_PRS_DOCUMENTO IN (
          SELECT DISTINCT PRS_DOCUMENTO
          FROM CONTRATOSVENTA
          WHERE FECHAFINAL IS NULL
            AND UBCNTRTRIO_CODIGO_COMPUESTO_DE = :empresa
        )
        AND HR.FECHAFINAL IS NULL
    `;

    return {
      sql,
      binds: {
        nit: company!.nit,
        razonSocial: company!.legalName,
        empresa,
        ...docsClause.binds,
      },
    };
  }

  protected override buildFilenameBase(
    _input: ReportExecutionInput,
    company?: CompanyContext,
  ): string {
    return `BALOTO_${this.sanitizeFilenamePart(company?.name ?? 'EMPRESA')}`;
  }
}
