import { QueryTypes, Sequelize } from 'sequelize';
import type { LoginUnificadoDbConfig } from '../config/EnvironmentConfig.js';

export interface LoginUnificadoUserDto {
  readonly id: string;
  readonly username: string;
  readonly fullName: string;
  readonly document: string;
  readonly email: string;
  readonly company: string;
  readonly process: string;
  readonly subProcess: string;
  readonly position: string;
  readonly state: string;
  readonly isActive: boolean;
}

export interface ILoginUnificadoRepository {
  listUsers(search?: string): Promise<LoginUnificadoUserDto[]>;
  findByUsername(username: string): Promise<LoginUnificadoUserDto | null>;
  close(): Promise<void>;
}

const SAFE_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SENSITIVE_COLUMN_RE = /pass|clave|secret|token|hash|salt|pwd/i;
const INACTIVE_STATES = new Set([
  'inactivo',
  'inactive',
  'bloqueado',
  'blocked',
  'deshabilitado',
  'disabled',
  'suspendido',
  'suspended',
  '0',
  'false',
]);

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function readFirstText(
  normalizedRow: Map<string, unknown>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const raw = normalizedRow.get(key);
    if (raw === null || raw === undefined) {
      continue;
    }
    const text = String(raw).replace(/[\r\n]+/g, ' ').trim();
    if (text.length > 0) {
      return text;
    }
  }
  return '';
}

export class LoginUnificadoRepository implements ILoginUnificadoRepository {
  private readonly sequelize: Sequelize;
  private readonly tableName: string;
  private safeColumns: string[] | null = null;
  private usernameColumn: string | null = null;
  private columnsDiscovered = false;

  constructor(
    config: LoginUnificadoDbConfig,
    sequelizeOverride?: Sequelize,
  ) {
    if (!SAFE_IDENTIFIER_RE.test(config.tableName)) {
      throw new Error(`Nombre de tabla inválido para login_unificado: ${config.tableName}`);
    }
    this.tableName = config.tableName;
    this.sequelize =
      sequelizeOverride ??
      new Sequelize(config.database, config.username, config.password, {
        host: config.host,
        port: config.port,
        dialect: 'mysql',
        logging: false,
        pool: {
          max: 5,
          min: 0,
          acquire: 10000,
          idle: 10000,
        },
      });
  }

  public async listUsers(search?: string): Promise<LoginUnificadoUserDto[]> {
    const selectClause = await this.buildSelectClause();
    const rows = await this.sequelize.query<Record<string, unknown>>(
      `SELECT ${selectClause} FROM \`${this.tableName}\` LIMIT 5000`,
      { type: QueryTypes.SELECT },
    );

    const mapped = rows
      .map((row) => this.mapRow(row))
      .filter((item): item is LoginUnificadoUserDto => item !== null)
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));

    const q = search ? stripDiacritics(search).trim().toLowerCase() : '';
    if (!q) {
      return mapped;
    }

    return mapped.filter((user) =>
      [
        user.username,
        user.fullName,
        user.document,
        user.email,
        user.company,
        user.process,
        user.subProcess,
        user.position,
      ].some((field) => stripDiacritics(field).toLowerCase().includes(q)),
    );
  }

  public async findByUsername(username: string): Promise<LoginUnificadoUserDto | null> {
    const clean = username.trim();
    if (!clean) {
      return null;
    }

    const selectClause = await this.buildSelectClause();
    if (this.usernameColumn && SAFE_IDENTIFIER_RE.test(this.usernameColumn)) {
      const rows = await this.sequelize.query<Record<string, unknown>>(
        `SELECT ${selectClause} FROM \`${this.tableName}\` WHERE LOWER(\`${this.usernameColumn}\`) = LOWER(:username) LIMIT 1`,
        {
          replacements: { username: clean },
          type: QueryTypes.SELECT,
        },
      );
      const row = rows[0];
      return row ? this.mapRow(row) : null;
    }

    const allUsers = await this.listUsers();
    const targetLower = clean.toLowerCase();
    return allUsers.find((u) => u.username.toLowerCase() === targetLower) ?? null;
  }

  public async close(): Promise<void> {
    await this.sequelize.close();
  }

  private async buildSelectClause(): Promise<string> {
    await this.discoverSafeColumns();
    if (this.safeColumns && this.safeColumns.length > 0) {
      return this.safeColumns.map((col) => `\`${col}\``).join(', ');
    }
    return '*';
  }

  private async discoverSafeColumns(): Promise<void> {
    if (this.columnsDiscovered) {
      return;
    }
    this.columnsDiscovered = true;

    try {
      const columns = await this.sequelize.query<Record<string, unknown>>(
        `SHOW COLUMNS FROM \`${this.tableName}\``,
        { type: QueryTypes.SELECT },
      );

      const safe: string[] = [];
      for (const col of columns) {
        const name = String(col.Field ?? col.field ?? Object.values(col)[0] ?? '').trim();
        if (!SAFE_IDENTIFIER_RE.test(name) || SENSITIVE_COLUMN_RE.test(name)) {
          continue;
        }
        safe.push(name);
      }

      if (safe.length > 0) {
        this.safeColumns = safe;
        const usernameCandidates = ['username', 'usuario', 'login', 'user_name', 'user'];
        for (const candidate of usernameCandidates) {
          const found = safe.find((col) => col.toLowerCase() === candidate);
          if (found) {
            this.usernameColumn = found;
            break;
          }
        }
      }
    } catch {
      this.safeColumns = null;
      this.usernameColumn = null;
    }
  }

  private mapRow(row: Record<string, unknown>): LoginUnificadoUserDto | null {
    const normalized = new Map<string, unknown>();
    for (const [key, value] of Object.entries(row)) {
      if (SENSITIVE_COLUMN_RE.test(key)) {
        continue;
      }
      normalized.set(key.toLowerCase(), value);
    }

    const username = readFirstText(normalized, [
      'username',
      'usuario',
      'login',
      'user_name',
      'user',
    ]);
    if (!username) {
      return null;
    }

    const id =
      readFirstText(normalized, ['id', 'uuid', 'id_user', 'idusuario']) || username;
    const names = readFirstText(normalized, ['names', 'nombres', 'first_name', 'nombre']);
    const lastnames = readFirstText(normalized, [
      'lastnames',
      'apellidos',
      'last_name',
      'apellido',
    ]);
    const combinedName = [names, lastnames].filter((p) => p.length > 0).join(' ');
    const fullName =
      combinedName ||
      readFirstText(normalized, [
        'fullname',
        'full_name',
        'nombre_completo',
        'name',
        'nombre',
      ]) ||
      username;

    const document = readFirstText(normalized, [
      'document',
      'documento',
      'cedula',
      'identificacion',
      'doc',
    ]);
    const email = readFirstText(normalized, ['email', 'correo', 'mail']);
    const company = readFirstText(normalized, ['company', 'empresa', 'compania']);
    const process = readFirstText(normalized, [
      'process',
      'proceso',
      'area',
      'proceso_area',
    ]);
    const subProcess = readFirstText(normalized, [
      'sub_process',
      'sub_proceso',
      'subproceso',
      'subprocess',
    ]);
    const position =
      readFirstText(normalized, [
        'cargo',
        'position',
        'job_title',
        'puesto',
        'perfil',
        'rol',
        'role',
      ]) || subProcess;

    const rawActive = normalized.get('activo');
    let state = readFirstText(normalized, ['state', 'estado', 'status']);
    let isActive = true;

    if (rawActive !== undefined && rawActive !== null && String(rawActive).trim() !== '') {
      isActive = Number(rawActive) !== 0;
      if (!state) {
        state = isActive ? 'Activo' : 'Inactivo';
      }
    } else if (state) {
      const normalizedState = stripDiacritics(state).toLowerCase();
      isActive = !INACTIVE_STATES.has(normalizedState);
    } else {
      state = 'Activo';
    }

    return {
      id,
      username,
      fullName,
      document,
      email,
      company,
      process,
      subProcess,
      position,
      state,
      isActive,
    };
  }
}
