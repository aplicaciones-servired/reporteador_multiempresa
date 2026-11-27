import type { UserCatalogResponse } from '../types/api.types';
import type { HttpClient } from './HttpClient';

export class CatalogApiService {
  constructor(private readonly http: HttpClient) {}

  public async getCatalog(): Promise<UserCatalogResponse> {
    return this.http.get<UserCatalogResponse>('/catalog');
  }
}
