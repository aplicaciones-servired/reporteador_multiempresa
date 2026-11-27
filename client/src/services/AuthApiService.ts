import type { PublicUserProfile } from '../types/api.types';
import { ApiClientError, type HttpClient } from './HttpClient';

export class AuthApiService {
  constructor(
    private readonly http: HttpClient,
    private readonly loginHttp: HttpClient = http,
  ) {}

  public async login(username: string, password: string): Promise<PublicUserProfile> {
    const loginResponse = await this.loginHttp.post<Record<string, unknown> | null>('/login', {
      username,
      password,
    });

    if (
      loginResponse &&
      typeof loginResponse === 'object' &&
      (loginResponse.success === false || loginResponse.ok === false)
    ) {
      const msg = this.extractFailureMessage(loginResponse);
      throw new ApiClientError(msg, 401, 'LOGIN_FAILED');
    }

    return this.getCurrentUser();
  }

  public async logout(): Promise<void> {
    await Promise.allSettled([
      this.http.post<{ message: string }>('/auth/logout', {}),
      this.loginHttp.post<unknown>('/logout', {}),
    ]);
  }

  public async getCurrentUser(): Promise<PublicUserProfile> {
    const response = await this.http.get<{ user: PublicUserProfile }>('/auth/me');
    return response.user;
  }

  private extractFailureMessage(payload: Record<string, unknown>): string {
    const candidates = [payload.message, payload.error, payload.msg];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
    return 'Credenciales inválidas o usuario inactivo';
  }
}
