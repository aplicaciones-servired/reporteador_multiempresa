export type ReportInputSchemaType =
  | 'date_range'
  | 'single_date'
  | 'single_date_sorteo'
  | 'single_date_serie'
  | 'company_only'
  | 'document_list';

export type ReportOutputType = 'xlsx' | 'txt' | 'table_and_xlsx';

export type ColumnFormat = 'text' | 'number' | 'currency' | 'date' | 'datetime';

export interface CompanyDto {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly cityLabel: string;
  readonly nit: string;
  readonly legalName: string;
  readonly warehouseCode: string;
  readonly sisbetCode: string;
}

export interface PublicUserProfile {
  readonly id: number;
  readonly login: string;
  readonly fullName: string;
  readonly roleCode: string;
  readonly roleName: string;
  readonly companies: CompanyDto[];
  readonly canManagePermissions?: boolean;
}

export interface ReportCatalogItem {
  readonly slug: string;
  readonly module: string;
  readonly name: string;
  readonly description: string;
  readonly oracleSource: 'principal' | 'replica' | 'naos';
  readonly inputSchema: ReportInputSchemaType;
  readonly outputType: ReportOutputType;
  readonly requiresCompany: boolean;
  readonly displayOrder: number;
}

export interface CatalogModuleGroup {
  readonly module: string;
  readonly reports: ReportCatalogItem[];
}

export interface UserCatalogResponse {
  readonly companies: CompanyDto[];
  readonly modules: CatalogModuleGroup[];
  readonly totalReports: number;
}

export interface ReportColumnDef {
  readonly key: string;
  readonly header: string;
  readonly format?: ColumnFormat;
  readonly width?: number;
}

export interface ReportPreviewResponse {
  readonly reportName: string;
  readonly slug: string;
  readonly outputType: ReportOutputType;
  readonly columns: ReportColumnDef[];
  readonly rows: Record<string, string | number | null>[];
  readonly totalReturned: number;
  readonly truncated: boolean;
  readonly generatedAt: string;
}

export interface ReportFilterPayload {
  readonly empresa?: string;
  readonly fecha1?: string;
  readonly fecha2?: string;
  readonly sorteo?: string;
  readonly serie?: string;
  readonly documentos?: string[];
}

export interface ApiErrorDetail {
  readonly path: string;
  readonly message: string;
}

export interface ApiErrorPayload {
  readonly error?:
    | string
    | {
        readonly code?: string;
        readonly message?: string;
        readonly details?: ApiErrorDetail[] | string;
      };
  readonly message?: string | string[];
  readonly detail?: string;
  readonly msg?: string;
}

export interface AdminUserPermissionDto {
  readonly id: string;
  readonly username: string;
  readonly fullName: string;
  readonly document: string;
  readonly email: string;
  readonly company: string;
  readonly process: string;
  readonly subProcess: string;
  readonly position: string;
  readonly state: string;
  readonly isActive: boolean;
  readonly isAdminPortalAuthorized: boolean;
  readonly defaultRoleCode: string;
  readonly defaultRoleName: string;
  readonly defaultReportSlugs: string[];
  readonly defaultCompanyCodes: string[];
  readonly isCustomized: boolean;
  readonly effectiveReportSlugs: string[];
  readonly effectiveCompanyCodes: string[];
  readonly updatedAt: string | null;
  readonly updatedBy: string | null;
}

export interface UserPermissionOverrideDto {
  readonly username: string;
  readonly reportSlugs: string[];
  readonly companyCodes?: string[];
  readonly updatedAt: string;
  readonly updatedBy: string;
}

export interface AdminPermissionsOverviewResponse {
  readonly users: AdminUserPermissionDto[];
  readonly reports: ReportCatalogItem[];
  readonly companies: CompanyDto[];
}

export interface UpdateUserPermissionsPayload {
  readonly reportSlugs: string[];
  readonly companyCodes?: string[];
}
