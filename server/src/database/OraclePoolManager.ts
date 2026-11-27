import oracledb from 'oracledb';
import type { EnvironmentConfig, OracleConnectionConfig } from '../config/EnvironmentConfig.js';
import { DatabaseError } from '../core/errors/AppError.js';

export type OracleSourceName = 'principal' | 'replica' | 'naos';

export type OracleBindValue = string | number | Date | null;
export type OracleBinds = Record<string, OracleBindValue>;

export interface IOraclePoolManager {
  initialize(): Promise<void>;
  executeQuery<T extends Record<string, unknown>>(
    source: OracleSourceName,
    sql: string,
    binds?: OracleBinds,
    maxRows?: number,
  ): Promise<T[]>;
  getHealthStatus(): Record<OracleSourceName, 'ready' | 'unconfigured' | 'lazy'>;
  closeAll(): Promise<void>;
}

export class OraclePoolManager implements IOraclePoolManager {
  private readonly pools = new Map<OracleSourceName, oracledb.Pool>();
  private readonly configs: Record<OracleSourceName, OracleConnectionConfig>;
  private readonly clientLibDir: string;
  private clientInitialized = false;

  constructor(config: EnvironmentConfig) {
    this.clientLibDir = config.oracle.clientLibDir;
    this.configs = {
      principal: config.oracle.principal,
      replica: config.oracle.replica,
      naos: config.oracle.naos,
    };
  }

  public async initialize(): Promise<void> {
    if (!this.clientInitialized && this.clientLibDir.length > 0) {
      oracledb.initOracleClient({ libDir: this.clientLibDir });
      this.clientInitialized = true;
    }
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    oracledb.fetchAsString = [oracledb.CLOB];
  }

  private isConfigured(source: OracleSourceName): boolean {
    const cfg = this.configs[source];
    return Boolean(cfg.connectString && cfg.user && cfg.password);
  }

  private async getOrCreatePool(source: OracleSourceName): Promise<oracledb.Pool> {
    const existing = this.pools.get(source);
    if (existing) {
      return existing;
    }

    if (!this.isConfigured(source)) {
      throw new DatabaseError(
        `La conexión Oracle '${source}' no está configurada. Verifica las variables ORACLE_${source.toUpperCase()}_* en .env`,
      );
    }

    await this.initialize();
    const cfg = this.configs[source];

    try {
      const pool = await oracledb.createPool({
        user: cfg.user,
        password: cfg.password,
        connectString: cfg.connectString,
        poolMin: 0,
        poolMax: 6,
        poolIncrement: 1,
        poolTimeout: 60,
      });
      this.pools.set(source, pool);
      return pool;
    } catch (error) {
      throw new DatabaseError(`No se pudo abrir el pool Oracle '${source}'`, error);
    }
  }

  public async executeQuery<T extends Record<string, unknown>>(
    source: OracleSourceName,
    sql: string,
    binds: OracleBinds = {},
    maxRows = 0,
  ): Promise<T[]> {
    const pool = await this.getOrCreatePool(source);
    let connection: oracledb.Connection | undefined;

    try {
      connection = await pool.getConnection();
      const result = await connection.execute<T>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        maxRows,
      });
      return (result.rows ?? []) as T[];
    } catch (error) {
      throw new DatabaseError(`Error ejecutando consulta en Oracle '${source}'`, error);
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch {
          // Ignorar error secundario al devolver conexión al pool
        }
      }
    }
  }

  public getHealthStatus(): Record<OracleSourceName, 'ready' | 'unconfigured' | 'lazy'> {
    const sources: OracleSourceName[] = ['principal', 'replica', 'naos'];
    const status: Record<OracleSourceName, 'ready' | 'unconfigured' | 'lazy'> = {
      principal: 'unconfigured',
      replica: 'unconfigured',
      naos: 'unconfigured',
    };

    for (const source of sources) {
      if (this.pools.has(source)) {
        status[source] = 'ready';
      } else if (this.isConfigured(source)) {
        status[source] = 'lazy';
      } else {
        status[source] = 'unconfigured';
      }
    }
    return status;
  }

  public async closeAll(): Promise<void> {
    const closePromises = Array.from(this.pools.values()).map((pool) => pool.close(5));
    await Promise.allSettled(closePromises);
    this.pools.clear();
  }
}
