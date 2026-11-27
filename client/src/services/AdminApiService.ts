import type {
  AdminPermissionsOverviewResponse,
  UpdateUserPermissionsPayload,
  UserPermissionOverrideDto,
} from '../types/api.types';
import type { HttpClient } from './HttpClient';

export class AdminApiService {
  constructor(private readonly http: HttpClient) {}

  public async getOverview(): Promise<AdminPermissionsOverviewResponse> {
    return this.http.get<AdminPermissionsOverviewResponse>('/admin/permissions');
  }

  public async updateUserPermissions(
    username: string,
    payload: UpdateUserPermissionsPayload,
  ): Promise<{ override: UserPermissionOverrideDto }> {
    return this.http.put<{ override: UserPermissionOverrideDto }>(
      `/admin/permissions/${encodeURIComponent(username)}`,
      payload,
    );
  }

  public async resetUserPermissions(
    username: string,
  ): Promise<{ removed: boolean; username: string }> {
    return this.http.delete<{ removed: boolean; username: string }>(
      `/admin/permissions/${encodeURIComponent(username)}`,
    );
  }
}
