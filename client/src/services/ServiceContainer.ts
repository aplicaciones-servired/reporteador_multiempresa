import { AuthApiService } from './AuthApiService';
import { CatalogApiService } from './CatalogApiService';
import { HttpClient } from './HttpClient';
import { ReportApiService } from './ReportApiService';

export class ServiceContainer {
  private static instance: ServiceContainer | null = null;

  public readonly http: HttpClient;
  public readonly loginHttp: HttpClient;
  public readonly auth: AuthApiService;
  public readonly catalog: CatalogApiService;
  public readonly reports: ReportApiService;

  private constructor() {
    const rawUrl = import.meta.env.PUBLIC_API_URL?.trim() || 'http://localhost:4000/api';
    const apiBaseUrl = this.alignLocalOrigin(rawUrl);
    const rawLoginUrl = import.meta.env.PUBLIC_LOGIN_API_URL?.trim() || '/apilogin';
    const loginBaseUrl = this.alignLocalOrigin(rawLoginUrl);
    this.http = new HttpClient(apiBaseUrl);
    this.loginHttp = new HttpClient(loginBaseUrl);
    this.auth = new AuthApiService(this.http, this.loginHttp);
    this.catalog = new CatalogApiService(this.http);
    this.reports = new ReportApiService(this.http);
  }

  public static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  private alignLocalOrigin(rawUrl: string): string {
    if (typeof window === 'undefined') {
      return rawUrl;
    }
    try {
      const parsed = new URL(rawUrl, window.location.origin);
      const browserHost = window.location.hostname;
      const isBrowserLocal = browserHost === 'localhost' || browserHost === '127.0.0.1';
      const isApiLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

      if (isBrowserLocal && isApiLocal && parsed.hostname !== browserHost) {
        parsed.hostname = browserHost;
      }
      return parsed.toString().replace(/\/+$/, '');
    } catch {
      return rawUrl;
    }
  }
}
