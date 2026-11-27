import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface UserPermissionOverride {
  readonly username: string;
  readonly reportSlugs: string[];
  readonly companyCodes?: string[];
  readonly updatedAt: string;
  readonly updatedBy: string;
}

export interface UpsertUserPermissionInput {
  readonly username: string;
  readonly reportSlugs: string[];
  readonly companyCodes?: string[];
  readonly updatedBy: string;
}

export interface IUserPermissionsStore {
  initialize(): Promise<void>;
  getByUsername(username: string): UserPermissionOverride | null;
  getAll(): UserPermissionOverride[];
  upsert(input: UpsertUserPermissionInput): Promise<UserPermissionOverride>;
  deleteByUsername(username: string): Promise<boolean>;
}

interface PersistedPermissionsSchema {
  version: number;
  overrides: Record<string, UserPermissionOverride>;
}

function normalizeUsernameKey(username: string): string {
  return username.trim().toLowerCase();
}

function uniqueTrimmed(values: readonly string[]): string[] {
  return Array.from(
    new Set(values.map((item) => item.trim()).filter((item) => item.length > 0)),
  );
}

export class UserPermissionsStore implements IUserPermissionsStore {
  private readonly overrides = new Map<string, UserPermissionOverride>();
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  public getFilePath(): string {
    return this.filePath;
  }

  public async initialize(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    this.overrides.clear();

    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedPermissionsSchema>;
      const entries = parsed?.overrides && typeof parsed.overrides === 'object'
        ? Object.entries(parsed.overrides)
        : [];

      for (const [key, entry] of entries) {
        if (!entry || typeof entry !== 'object') {
          continue;
        }
        const normalizedKey = normalizeUsernameKey(entry.username ?? key);
        if (!normalizedKey) {
          continue;
        }
        const reportSlugs = Array.isArray(entry.reportSlugs)
          ? uniqueTrimmed(entry.reportSlugs.filter((s): s is string => typeof s === 'string'))
          : [];
        const companyCodes = Array.isArray(entry.companyCodes)
          ? uniqueTrimmed(entry.companyCodes.filter((c): c is string => typeof c === 'string'))
          : undefined;

        this.overrides.set(normalizedKey, {
          username: (entry.username ?? normalizedKey).trim(),
          reportSlugs,
          ...(companyCodes !== undefined ? { companyCodes } : {}),
          updatedAt:
            typeof entry.updatedAt === 'string' && entry.updatedAt.trim()
              ? entry.updatedAt
              : new Date().toISOString(),
          updatedBy:
            typeof entry.updatedBy === 'string' && entry.updatedBy.trim()
              ? entry.updatedBy
              : 'admin',
        });
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') {
        await this.persist();
        return;
      }
      throw error;
    }
  }

  public getByUsername(username: string): UserPermissionOverride | null {
    const key = normalizeUsernameKey(username);
    if (!key) {
      return null;
    }
    return this.overrides.get(key) ?? null;
  }

  public getAll(): UserPermissionOverride[] {
    return Array.from(this.overrides.values()).sort((a, b) =>
      a.username.localeCompare(b.username, 'es'),
    );
  }

  public async upsert(input: UpsertUserPermissionInput): Promise<UserPermissionOverride> {
    const cleanUsername = input.username.trim();
    const key = normalizeUsernameKey(cleanUsername);
    if (!key) {
      throw new Error('El nombre de usuario es obligatorio para guardar permisos');
    }

    const reportSlugs = uniqueTrimmed(input.reportSlugs);
    const companyCodes =
      input.companyCodes !== undefined ? uniqueTrimmed(input.companyCodes) : undefined;

    const record: UserPermissionOverride = {
      username: cleanUsername,
      reportSlugs,
      ...(companyCodes !== undefined ? { companyCodes } : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: input.updatedBy.trim() || 'admin',
    };

    this.overrides.set(key, record);
    await this.persist();
    return record;
  }

  public async deleteByUsername(username: string): Promise<boolean> {
    const key = normalizeUsernameKey(username);
    if (!key || !this.overrides.has(key)) {
      return false;
    }
    this.overrides.delete(key);
    await this.persist();
    return true;
  }

  private async persist(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const payload: PersistedPermissionsSchema = {
        version: 1,
        overrides: Object.fromEntries(this.overrides.entries()),
      };
      const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
      await rename(tmpPath, this.filePath);
    });
    return this.writeQueue;
  }
}

export class MemoryUserPermissionsStore implements IUserPermissionsStore {
  private readonly overrides = new Map<string, UserPermissionOverride>();

  public async initialize(): Promise<void> {}

  public getByUsername(username: string): UserPermissionOverride | null {
    const key = normalizeUsernameKey(username);
    return key ? (this.overrides.get(key) ?? null) : null;
  }

  public getAll(): UserPermissionOverride[] {
    return Array.from(this.overrides.values());
  }

  public async upsert(input: UpsertUserPermissionInput): Promise<UserPermissionOverride> {
    const cleanUsername = input.username.trim();
    const record: UserPermissionOverride = {
      username: cleanUsername,
      reportSlugs: uniqueTrimmed(input.reportSlugs),
      ...(input.companyCodes !== undefined
        ? { companyCodes: uniqueTrimmed(input.companyCodes) }
        : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: input.updatedBy.trim() || 'admin',
    };
    this.overrides.set(normalizeUsernameKey(cleanUsername), record);
    return record;
  }

  public async deleteByUsername(username: string): Promise<boolean> {
    return this.overrides.delete(normalizeUsernameKey(username));
  }
}
