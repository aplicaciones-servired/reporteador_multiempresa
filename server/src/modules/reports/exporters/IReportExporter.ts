import type { ExportedFile, ReportExecutionResult } from '../core/ReportTypes.js';

export interface IReportExporter {
  export(result: ReportExecutionResult): Promise<ExportedFile>;
}
