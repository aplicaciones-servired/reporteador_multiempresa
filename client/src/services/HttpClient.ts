import axios, { AxiosError, type AxiosInstance } from 'axios';
import type { ApiErrorDetail, ApiErrorPayload } from '../types/api.types';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: ApiErrorDetail[] | string;

  constructor(
    message: string,
    status: number,
    code = 'API_ERROR',
    details?: ApiErrorDetail[] | string,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface BlobDownloadResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly contentType: string;
}

export class HttpClient {
  private readonly client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      withCredentials: true,
      timeout: 120_000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  public async get<T>(url: string): Promise<T> {
    try {
      const response = await this.client.get<T>(url);
      return response.data;
    } catch (error) {
      throw await this.normalizeError(error);
    }
  }

  public async post<T>(url: string, body: unknown): Promise<T> {
    try {
      const response = await this.client.post<T>(url, body);
      return response.data;
    } catch (error) {
      throw await this.normalizeError(error);
    }
  }

  public async put<T>(url: string, body: unknown): Promise<T> {
    try {
      const response = await this.client.put<T>(url, body);
      return response.data;
    } catch (error) {
      throw await this.normalizeError(error);
    }
  }

  public async delete<T>(url: string): Promise<T> {
    try {
      const response = await this.client.delete<T>(url);
      return response.data;
    } catch (error) {
      throw await this.normalizeError(error);
    }
  }

  public async postBlob(url: string, body: unknown): Promise<BlobDownloadResult> {
    try {
      const response = await this.client.post<Blob>(url, body, {
        responseType: 'blob',
      });
      const disposition = String(response.headers['content-disposition'] ?? '');
      const filename = this.extractFilename(disposition);
      const contentType = String(
        response.headers['content-type'] ?? 'application/octet-stream',
      );
      return {
        blob: response.data,
        filename,
        contentType,
      };
    } catch (error) {
      throw await this.normalizeError(error);
    }
  }

  private extractFilename(contentDisposition: string): string {
    const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (utfMatch?.[1]) {
      return decodeURIComponent(utfMatch[1].trim());
    }
    const asciiMatch = /filename="([^"]+)"/i.exec(contentDisposition);
    if (asciiMatch?.[1]) {
      return asciiMatch[1].trim();
    }
    return 'reporte.xlsx';
  }

  private async normalizeError(error: unknown): Promise<ApiClientError> {
    if (!(error instanceof AxiosError)) {
      return new ApiClientError('Error inesperado al comunicar con el servidor', 500);
    }

    const status = error.response?.status ?? 0;
    let payload: ApiErrorPayload | undefined;

    if (error.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        payload = JSON.parse(text) as ApiErrorPayload;
      } catch {
        payload = undefined;
      }
    } else if (error.response?.data && typeof error.response.data === 'object') {
      payload = error.response.data as ApiErrorPayload;
    }

    const errorObj =
      payload?.error && typeof payload.error === 'object' ? payload.error : undefined;
    const errorStr = typeof payload?.error === 'string' ? payload.error.trim() : '';
    const payloadMessage = Array.isArray(payload?.message)
      ? payload.message
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .join(', ')
      : typeof payload?.message === 'string'
        ? payload.message.trim()
        : '';

    const message =
      errorObj?.message ??
      (errorStr || undefined) ??
      (payloadMessage || undefined) ??
      (typeof payload?.msg === 'string' && payload.msg.trim() ? payload.msg.trim() : undefined) ??
      (typeof payload?.detail === 'string' && payload.detail.trim() ? payload.detail.trim() : undefined) ??
      (status === 0
        ? 'No fue posible conectar con el servidor API'
        : `Error en la solicitud (${status})`);
    const code = errorObj?.code ?? 'HTTP_ERROR';
    const details = errorObj?.details;

    return new ApiClientError(message, status, code, details);
  }
}
