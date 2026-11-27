import { BaseReport } from '../../core/BaseReport.js';
import { dateRangeWithCompanySchema } from '../../core/ReportSchemas.js';
import type {
  CompanyContext,
  OracleQuerySpec,
  ReportColumnDef,
  ReportExecutionInput,
  ReportMetadata,
} from '../../core/ReportTypes.js';

export class GanadoresDiarioReport extends BaseReport<ReportExecutionInput> {
  public readonly metadata: ReportMetadata = {
    slug: 'ganadores-diario',
    module: 'Ganadores',
    name: 'Clientes Ganadores de Premios',
    description: 'Resumen diario de terceros ganadores por Chance, Astro y Raspe.',
    oracleSource: 'principal',
    inputSchema: 'date_range',
    outputType: 'xlsx',
    requiresCompany: true,
    displayOrder: 10,
  };

  protected readonly inputSchema = dateRangeWithCompanySchema;

  public getColumns(): ReportColumnDef[] {
    return [
      { key: 'CLIENTE', header: 'CLIENTE', format: 'text', width: 16 },
      { key: 'NOMBRES', header: 'NOMBRES', format: 'text', width: 22 },
      { key: 'APELLIDO1', header: 'APELLIDO1', format: 'text', width: 18 },
      { key: 'APELLIDO2', header: 'APELLIDO2', format: 'text', width: 18 },
      { key: 'NOMBRES_Y_APELLIDOS', header: 'NOMBRES_Y_APELLIDOS', format: 'text', width: 34 },
      { key: 'CANT_PREMIOS_CHANCE', header: 'CANT_PREMIOS_CHANCE', format: 'number', width: 20 },
      { key: 'CANT_PREMIOS_ASTRO', header: 'CANT_PREMIOS_ASTRO', format: 'number', width: 20 },
      { key: 'CANT_PREMIOS_RASPE', header: 'CANT_PREMIOS_RASPE', format: 'number', width: 20 },
      { key: 'CANT_PREMIOS_COBRADOS', header: 'CANT_PREMIOS_COBRADOS', format: 'number', width: 22 },
      { key: 'TOTAL_PREMIOS_COBRADOS', header: 'TOTAL_PREMIOS_COBRADOS', format: 'currency', width: 22 },
      { key: 'DIRECCION', header: 'DIRECCION', format: 'text', width: 30 },
      { key: 'TELEFONO', header: 'TELEFONO', format: 'text', width: 16 },
    ];
  }

  public buildQuery(input: ReportExecutionInput, company?: CompanyContext): OracleQuerySpec {
    const fecha1 = this.formatOracleDate(input.fecha1!);
    const fecha2 = this.formatOracleDate(input.fecha2!);
    const strZones = [company!.code, ...company!.legacyZones];
    const numZones = strZones.map((z) => Number(z)).filter((n) => Number.isFinite(n));

    const chanceZones1 = this.buildInClause('cz1', strZones);
    const chanceZones2 = this.buildInClause('cz2', strZones);
    const astroZones = this.buildInClause('az', numZones);

    const sql = `
      SELECT
        TP.CLIENTE,
        UPPER(PE.NOMBRES) AS NOMBRES,
        UPPER(PE.APELLIDO1) AS APELLIDO1,
        UPPER(PE.APELLIDO2) AS APELLIDO2,
        UPPER(PE.NOMBRES) || ' ' || UPPER(PE.APELLIDO1) || ' ' || UPPER(PE.APELLIDO2) AS NOMBRES_Y_APELLIDOS,
        SUM(CANT_PREMIOS_CHANCE) AS CANT_PREMIOS_CHANCE,
        SUM(CANT_PREMIOS_ASTRO) AS CANT_PREMIOS_ASTRO,
        SUM(CANT_PREMIOS_RASPE) AS CANT_PREMIOS_RASPE,
        SUM(CANT_PREMIOS_CHANCE) + SUM(CANT_PREMIOS_ASTRO) + SUM(CANT_PREMIOS_RASPE) AS CANT_PREMIOS_COBRADOS,
        SUM(VR_PREMIOS_CHANCE) + SUM(VR_PREMIOS_ASTRO) + SUM(VR_PREMIOS_RASPE) AS TOTAL_PREMIOS_COBRADOS,
        PE.DIRECCION,
        PE.TELEFONO
      FROM (
        SELECT
          GAN.PRS_DOCUMENTO AS CLIENTE,
          COUNT(DISTINCT SERIE) AS cant_premios_chance,
          SUM(TOTALPREMIO) AS vr_premios_chance,
          0 AS cant_premios_astro,
          0 AS vr_premios_astro,
          0 AS cant_premios_raspe,
          0 AS vr_premios_raspe
        FROM (
          SELECT DISTINCT
            PF.LTRY_CODIGO,
            F.UBCNTRTRIO_CODIGO_COMPUESTO_DE AS ZONA,
            PP.FECHAPAGO,
            F.FECHASORTEO,
            PP.PRS_DOCUMENTO,
            PE.NOMBRES,
            PE.APELLIDO1,
            PE.APELLIDO2,
            PE.TELEFONO,
            PF.FRM_SERIE || PF.FRM_NUMERO AS SERIE,
            PE.DIRECCION,
            PF.TOTALPREMIO
          FROM premioformularios pf, premiospersona pp, personas pe, formularios f
          WHERE PP.FECHAPAGO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
            AND PE.DOCUMENTO = PP.PRS_DOCUMENTO
            AND F.SERIE = PP.PRMFOR_FRM_SERIE
            AND F.NUMERO = PP.PRMFOR_FRM_NUMERO
            AND PF.UBCNTRTRIO_CODIGUBICACION_PARA IN (${chanceZones1.placeholders})
            AND PP.PRMFOR_FRM_SERIE = PF.FRM_SERIE
            AND PP.PRMFOR_FRM_NUMERO = PF.FRM_NUMERO
            AND F.CODIGO_TIPOJUEGO NOT IN (18, 25)
            AND PF.LTRY_CODIGO = PP.PRMFOR_LTRY_CODIGO
          UNION ALL
          SELECT DISTINCT
            PF.LTRY_CODIGO,
            F.UBCNTRTRIO_CODIGO_COMPUESTO_DE AS ZONA,
            PP.FECHAPAGO,
            F.FECHASORTEO,
            PP.PRS_DOCUMENTO,
            PE.NOMBRES,
            PE.APELLIDO1,
            PE.APELLIDO2,
            PE.TELEFONO,
            PF.FRM_SERIE || PF.FRM_NUMERO AS SERIE,
            PE.DIRECCION,
            PF.TOTALPREMIO
          FROM premioformularios2 pf, premiospersona pp, personas pe, formularios f
          WHERE PP.FECHAPAGO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
            AND PE.DOCUMENTO = PP.PRS_DOCUMENTO
            AND F.SERIE = PP.PRMFOR_FRM_SERIE
            AND F.NUMERO = PP.PRMFOR_FRM_NUMERO
            AND PF.UBCNTRTRIO_CODIGUBICACION_PARA IN (${chanceZones2.placeholders})
            AND PP.PRMFOR_FRM_SERIE = PF.FRM_SERIE
            AND PP.PRMFOR_FRM_NUMERO = PF.FRM_NUMERO
            AND F.CODIGO_TIPOJUEGO NOT IN (18, 25)
            AND PF.LTRY_CODIGO = PP.PRMFOR_LTRY_CODIGO
        ) GAN
        GROUP BY GAN.PRS_DOCUMENTO
        UNION ALL
        SELECT
          PP.PRS_DOCUMENTO AS CLIENTE,
          0 AS cant_premios_chance,
          0 AS vr_premios_chance,
          COUNT(DISTINCT PP.PRMFOR_FRM_SERIE || PP.PRMFOR_FRM_NUMERO) AS cant_premios_astro,
          SUM(pf.totalpremio) AS vr_premios_astro,
          0 AS cant_premios_raspe,
          0 AS vr_premios_raspe
        FROM PREMIOSPERSONA PP, FORMULARIOS F, PREMIOFORMULARIOS PF, TIPOJUEGOS TJ
        WHERE PP.FECHAPAGO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND F.CODIGO_TIPOJUEGO IN (18)
          AND TJ.CODIGO = F.CODIGO_TIPOJUEGO
          AND F.SERIE = PP.PRMFOR_FRM_SERIE
          AND F.NUMERO = PP.PRMFOR_FRM_NUMERO
          AND F.SERIE = PF.FRM_SERIE
          AND F.NUMERO = PF.FRM_NUMERO
          AND PP.PRMFOR_FRM_SERIE = PF.FRM_SERIE
          AND PP.PRMFOR_FRM_NUMERO = PF.FRM_NUMERO
          AND PP.FECHAPAGO <> TRUNC(SYSDATE)
          AND F.ZONA IN (${astroZones.placeholders})
        GROUP BY PP.PRS_DOCUMENTO
        UNION ALL
        SELECT
          PR.CLIENTE,
          0 AS cant_premios_chance,
          0 AS vr_premios_chance,
          0 AS cant_premios_astro,
          0 AS vr_premios_astro,
          COUNT(DISTINCT PR.CODIGOVENTA) AS cant_premios_raspe,
          SUM(pr.totalpremio) AS vr_premios_raspe
        FROM GAMBLE.PAGOPREMIORASPEFISREPL PR, PERSONAS PE
        WHERE PE.DOCUMENTO = PR.CLIENTE
          AND FECHAPAGO BETWEEN TO_DATE(:fecha1, 'DD/MM/YYYY') AND TO_DATE(:fecha2, 'DD/MM/YYYY')
          AND PR.ZONA = :raspeEmpresa
        GROUP BY PR.CLIENTE
      ) TP, PERSONAS PE
      WHERE TP.CLIENTE = PE.DOCUMENTO
      GROUP BY TP.CLIENTE, PE.NOMBRES, PE.APELLIDO1, PE.APELLIDO2, PE.DIRECCION, PE.TELEFONO, PE.PERSONA_EXPUESTA
      ORDER BY TP.CLIENTE, PE.NOMBRES, PE.APELLIDO1, PE.APELLIDO2
    `;

    return {
      sql,
      binds: {
        fecha1,
        fecha2,
        raspeEmpresa: Number(company!.code),
        ...chanceZones1.binds,
        ...chanceZones2.binds,
        ...astroZones.binds,
      },
    };
  }

  protected override buildFilenameBase(
    input: ReportExecutionInput,
    company?: CompanyContext,
  ): string {
    return `REPORTE_TERCEROS_GANADORES_${this.sanitizeFilenamePart(company?.cityLabel ?? 'EMPRESA')}_${this.formatFileDate(input.fecha1!)}_AL_${this.formatFileDate(input.fecha2!)}`;
  }
}
