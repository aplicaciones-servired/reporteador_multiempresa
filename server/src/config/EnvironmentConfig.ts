import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(SERVER_ROOT, '.env'), quiet: true });

const oracleIdentifierRegex = /^[A-Za-z][A-Za-z0-9_$#]*(\.[A-Za-z][A-Za-z0-9_$#]*)?(@[A-Za-z][A-Za-z0-9_.]+)?$/;

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_ORIGIN: z.string().min(1).default('http://localhost:4321,http://127.0.0.1:4321'),

  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET debe tener al menos 16 caracteres')
    .default('dev-reporteador-multiempresa-jwt-secret-key'),
  JWT_EXPIRES_IN: z.string().min(1).default('8h'),
  LOGIN_JWT_SECRET: z.string().optional().default(''),
  AUTH_COOKIE_NAMES: z
    .string()
    .optional()
    .default('AuthTokenGaneCompany,access_token,token,jwt,auth_token,rm_token'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),

  APP_DB_MODE: z.enum(['local_file', 'legacy_mysql', 'sequelize']).default('local_file'),
  LOCAL_DB_FILE: z.string().min(1).default('./data/local-db.json'),

  DB_DIALECT: z.enum(['mysql', 'postgres']).default('mysql'),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().optional(),
  DB_NAME: z.string().min(1).default('reporteador_multiempresa'),
  DB_USER: z.string().min(1).default('root'),
  DB_PASSWORD: z.string().default(''),

  SEED_DEFAULT_ADMIN_PASSWORD: z.string().min(6).default('Admin123*'),

  ORACLE_CLIENT_LIB_DIR: z.string().optional().default(''),

  ORACLE_PRINCIPAL_CONNECT_STRING: z.string().optional().default(''),
  ORACLE_PRINCIPAL_USER: z.string().optional().default(''),
  ORACLE_PRINCIPAL_PASSWORD: z.string().optional().default(''),

  ORACLE_REPLICA_CONNECT_STRING: z.string().optional().default(''),
  ORACLE_REPLICA_USER: z.string().optional().default(''),
  ORACLE_REPLICA_PASSWORD: z.string().optional().default(''),

  ORACLE_NAOS_CONNECT_STRING: z.string().optional().default(''),
  ORACLE_NAOS_USER: z.string().optional().default(''),
  ORACLE_NAOS_PASSWORD: z.string().optional().default(''),

  ORACLE_BENELITE_HIST_TABLE: z
    .string()
    .regex(oracleIdentifierRegex, 'Nombre de tabla ORACLE_BENELITE_HIST_TABLE inválido')
    .default('HIST_APUESTAS_AGO2025@BENELITE'),
});

export interface OracleConnectionConfig {
  readonly connectString: string;
  readonly user: string;
  readonly password: string;
}

export interface AppDatabaseConfig {
  readonly dialect: 'mysql' | 'postgres';
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
}

export class EnvironmentConfig {
  private static instance: EnvironmentConfig | null = null;

  public readonly port: number;
  public readonly nodeEnv: 'development' | 'test' | 'production';
  public readonly clientOrigin: string;
  public readonly clientOrigins: string[];
  public readonly jwtSecret: string;
  public readonly jwtExpiresIn: string;
  public readonly loginJwtSecret: string;
  public readonly authCookieNames: string[];
  public readonly cookieSecure: boolean;
  public readonly seedDefaultAdminPassword: string;
  public readonly appDbMode: 'local_file' | 'legacy_mysql' | 'sequelize';
  public readonly localDbFile: string;
  public readonly appDb: AppDatabaseConfig;
  public readonly oracle: {
    readonly clientLibDir: string;
    readonly beneliteHistTable: string;
    readonly principal: OracleConnectionConfig;
    readonly replica: OracleConnectionConfig;
    readonly naos: OracleConnectionConfig;
  };

  private constructor(parsed: z.infer<typeof envSchema>) {
    this.port = parsed.PORT;
    this.nodeEnv = parsed.NODE_ENV;
    this.clientOrigins = parsed.CLIENT_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
    this.clientOrigin = this.clientOrigins[0] ?? 'http://localhost:4321';
    this.jwtSecret = parsed.JWT_SECRET;
    this.jwtExpiresIn = parsed.JWT_EXPIRES_IN;
    this.loginJwtSecret = parsed.LOGIN_JWT_SECRET.trim() || parsed.JWT_SECRET;
    const parsedCookieNames = parsed.AUTH_COOKIE_NAMES.split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    this.authCookieNames =
      parsedCookieNames.length > 0
        ? parsedCookieNames
        : ['AuthTokenGaneCompany', 'access_token', 'token', 'jwt', 'auth_token', 'rm_token'];
    this.cookieSecure = parsed.COOKIE_SECURE;
    this.seedDefaultAdminPassword = parsed.SEED_DEFAULT_ADMIN_PASSWORD;
    this.appDbMode = parsed.APP_DB_MODE;
    this.localDbFile = path.isAbsolute(parsed.LOCAL_DB_FILE)
      ? parsed.LOCAL_DB_FILE
      : path.resolve(SERVER_ROOT, parsed.LOCAL_DB_FILE);

    this.appDb = {
      dialect: parsed.DB_DIALECT,
      host: parsed.DB_HOST,
      port: parsed.DB_PORT ?? (parsed.DB_DIALECT === 'postgres' ? 5432 : 3306),
      database: parsed.DB_NAME,
      username: parsed.DB_USER,
      password: parsed.DB_PASSWORD,
    };

    this.oracle = {
      clientLibDir: parsed.ORACLE_CLIENT_LIB_DIR.trim(),
      beneliteHistTable: parsed.ORACLE_BENELITE_HIST_TABLE,
      principal: {
        connectString: parsed.ORACLE_PRINCIPAL_CONNECT_STRING.trim(),
        user: parsed.ORACLE_PRINCIPAL_USER.trim(),
        password: parsed.ORACLE_PRINCIPAL_PASSWORD,
      },
      replica: {
        connectString: parsed.ORACLE_REPLICA_CONNECT_STRING.trim(),
        user: parsed.ORACLE_REPLICA_USER.trim(),
        password: parsed.ORACLE_REPLICA_PASSWORD,
      },
      naos: {
        connectString: parsed.ORACLE_NAOS_CONNECT_STRING.trim(),
        user: parsed.ORACLE_NAOS_USER.trim(),
        password: parsed.ORACLE_NAOS_PASSWORD,
      },
    };
  }

  public static fromEnv(rawEnv: Record<string, string | undefined> = process.env): EnvironmentConfig {
    const parsed = envSchema.parse(rawEnv);
    if (parsed.NODE_ENV === 'production') {
      const insecureSecrets = new Set([
        'dev-reporteador-multiempresa-jwt-secret-key',
        'cambia-esta-clave-secreta-en-produccion-min-32-chars',
      ]);
      const jwtSecret = parsed.JWT_SECRET.trim();
      if (jwtSecret.length < 32 || insecureSecrets.has(jwtSecret)) {
        throw new Error(
          'En producción debes configurar un JWT_SECRET seguro de al menos 32 caracteres distinto al valor por defecto.',
        );
      }
      if (parsed.CLIENT_ORIGIN.split(',').some((origin) => origin.trim() === '*')) {
        throw new Error(
          'En producción CLIENT_ORIGIN no puede contener "*" cuando las cookies con credenciales están habilitadas.',
        );
      }
    }
    return new EnvironmentConfig(parsed);
  }

  public static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = EnvironmentConfig.fromEnv();
    }
    return EnvironmentConfig.instance;
  }

  public get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}
