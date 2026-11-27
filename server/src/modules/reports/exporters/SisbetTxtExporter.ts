import type { ExportedFile, ReportExecutionResult } from '../core/ReportTypes.js';
import type { IReportExporter } from './IReportExporter.js';

export class SisbetTxtExporter implements IReportExporter {
  public async export(result: ReportExecutionResult): Promise<ExportedFile> {
    const lines = result.rows
      .map((row) => String(row.FORMATO_SISBET ?? '').trim())
      .filter((line) => line.length > 0);

    const content = lines.join('\r\n');
    const cleanContent = content.replace(/^\uFEFF/, '');
    const buffer = Buffer.from(cleanContent, 'latin1');

    const dateStamp = this.formatTodayYyyymmdd();
    const archiveCode = result.sisbetArchiveCode || result.company?.sisbetCode || '032';
    const filename = `ADV_${archiveCode}_${dateStamp}.txt`;

    return {
      buffer,
      filename,
      mimeType: 'text/plain; charset=iso-8859-1',
    };
  }

  private formatTodayYyyymmdd(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
}
