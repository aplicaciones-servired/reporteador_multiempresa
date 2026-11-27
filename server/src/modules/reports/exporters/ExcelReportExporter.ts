import ExcelJS from 'exceljs';
import type {
  ColumnFormat,
  ExportedFile,
  ReportColumnDef,
  ReportExecutionResult,
} from '../core/ReportTypes.js';
import type { IReportExporter } from './IReportExporter.js';

export class ExcelReportExporter implements IReportExporter {
  private static readonly EXCEL_MIME =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  public async export(result: ReportExecutionResult): Promise<ExportedFile> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Reporteador Multiempresa';
    workbook.created = new Date();

    const sheetTitle = this.sanitizeSheetName(result.metadata.name);
    const worksheet = workbook.addWorksheet(sheetTitle, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    worksheet.columns = result.columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width ?? Math.max(col.header.length + 4, 15),
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF334155' } },
      };
    });

    for (const row of result.rows) {
      const normalizedRow: Record<string, string | number | Date | null> = {};
      for (const col of result.columns) {
        normalizedRow[col.key] = this.normalizeCellValue(row[col.key], col.format);
      }
      const addedRow = worksheet.addRow(normalizedRow);
      this.applyColumnFormats(addedRow, result.columns);
    }

    if (result.columns.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: result.columns.length },
      };
    }

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);

    return {
      buffer,
      filename: `${result.filenameBase}.xlsx`,
      mimeType: ExcelReportExporter.EXCEL_MIME,
    };
  }

  private normalizeCellValue(
    value: string | number | Date | null | undefined,
    format?: ColumnFormat,
  ): string | number | Date | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (format === 'text') {
      const textValue = String(value);
      return /^[=+@\t\r]/.test(textValue) ? `'${textValue}` : textValue;
    }
    if ((format === 'number' || format === 'currency') && typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0 && /^-?\d+(\.\d+)?$/.test(trimmed)) {
        return Number(trimmed);
      }
    }
    return value;
  }

  private applyColumnFormats(row: ExcelJS.Row, columns: ReportColumnDef[]): void {
    columns.forEach((col, idx) => {
      const cell = row.getCell(idx + 1);
      if (col.format === 'text') {
        cell.numFmt = '@';
      } else if (col.format === 'currency') {
        cell.numFmt = '#,##0.00';
      } else if (col.format === 'number') {
        cell.numFmt = '#,##0';
      } else if (col.format === 'date' && cell.value instanceof Date) {
        cell.numFmt = 'dd/mm/yyyy';
      } else if (col.format === 'datetime' && cell.value instanceof Date) {
        cell.numFmt = 'dd/mm/yyyy hh:mm:ss';
      }
    });
  }

  private sanitizeSheetName(name: string): string {
    return name.replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 31) || 'Reporte';
  }
}
