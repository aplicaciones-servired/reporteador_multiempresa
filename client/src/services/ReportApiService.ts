import type { ReportFilterPayload, ReportPreviewResponse } from '../types/api.types';
import type { HttpClient } from './HttpClient';

export class ReportApiService {
  constructor(private readonly http: HttpClient) {}

  public async preview(
    slug: string,
    payload: ReportFilterPayload,
  ): Promise<ReportPreviewResponse> {
    return this.http.post<ReportPreviewResponse>(
      `/reports/${encodeURIComponent(slug)}/preview`,
      payload,
    );
  }

  public async exportAndDownload(
    slug: string,
    payload: ReportFilterPayload,
  ): Promise<string> {
    const result = await this.http.postBlob(
      `/reports/${encodeURIComponent(slug)}/export`,
      payload,
    );

    const blobUrl = URL.createObjectURL(result.blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = result.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      URL.revokeObjectURL(blobUrl);
    }

    return result.filename;
  }
}
