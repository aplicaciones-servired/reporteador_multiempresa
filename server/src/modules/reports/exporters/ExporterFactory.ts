import type { ReportOutputType } from '../core/ReportTypes.js';
import { ExcelReportExporter } from './ExcelReportExporter.js';
import type { IReportExporter } from './IReportExporter.js';
import { SisbetTxtExporter } from './SisbetTxtExporter.js';

export class ExporterFactory {
  private readonly excelExporter = new ExcelReportExporter();
  private readonly sisbetTxtExporter = new SisbetTxtExporter();

  public getExporter(outputType: ReportOutputType): IReportExporter {
    if (outputType === 'txt') {
      return this.sisbetTxtExporter;
    }
    return this.excelExporter;
  }
}
