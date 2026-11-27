import type { OracleBinds, OracleSourceName } from '../../../database/OraclePoolManager.js';
import type {
  ReportInputSchemaType,
  ReportOutputType,
} from '../../../database/models/ReportModel.js';

export type { ReportInputSchemaType, ReportOutputType };

export type ColumnFormat = 'text' | 'number' | 'currency' | 'date' | 'datetime';

export interface ReportColumnDef {
  readonly key: string;
  readonly header: string;
  readonly format?: ColumnFormat;
  readonly width?: number;
}

export interface ReportMetadata {
  readonly slug: string;
  readonly module: string;
  readonly name: string;
  readonly description: string;
  readonly oracleSource: OracleSourceName;
  readonly inputSchema: ReportInputSchemaType;
  readonly outputType: ReportOutputType;
  readonly requiresCompany: boolean;
  readonly displayOrder: number;
}

export interface CompanyContext {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly cityLabel: string;
  readonly nit: string;
  readonly legalName: string;
  readonly warehouseCode: string;
  readonly sisbetCode: string;
  readonly legacyZones: string[];
  readonly costCenters: number[];
  readonly daneCodes: number[];
  readonly registrocajasUnits: string[];
  readonly excludedChanceGames: number[];
  readonly requirePositiveCash: boolean;
}

export interface ReportExecutionInput {
  readonly empresa?: string;
  readonly fecha1?: string;
  readonly fecha2?: string;
  readonly sorteo?: string;
  readonly serie?: string;
  readonly documentos?: string[];
}

export interface OracleQuerySpec {
  readonly sql: string;
  readonly binds: OracleBinds;
}

export type ReportRow = Record<string, string | number | Date | null>;

export interface ReportExecutionResult {
  readonly metadata: ReportMetadata;
  readonly columns: ReportColumnDef[];
  readonly rows: ReportRow[];
  readonly filenameBase: string;
  readonly company?: CompanyContext;
  readonly generatedAt: string;
  readonly truncated: boolean;
  readonly sisbetArchiveCode?: string;
}

export interface ExportedFile {
  readonly buffer: Buffer;
  readonly filename: string;
  readonly mimeType: string;
}
