import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import { EnvironmentConfig } from '../src/config/EnvironmentConfig.js';
import { TooManyRequestsError } from '../src/core/errors/AppError.js';
import { LocalFileDatabase } from '../src/database/LocalFileDatabase.js';
import type {
  IOraclePoolManager,
  OracleBinds,
  OracleSourceName,
} from '../src/database/OraclePoolManager.js';
import { UserPermissionsStore } from '../src/database/UserPermissionsStore.js';
import { RateLimiterMiddleware } from '../src/middlewares/RateLimiterMiddleware.js';
import { AuthService, isAdminPortalAuthorized } from '../src/modules/auth/AuthService.js';
import type {
  ILoginUnificadoRepository,
  LoginUnificadoUserDto,
} from '../src/repositories/LoginUnificadoRepository.js';
import type { CompanyContext } from '../src/modules/reports/core/ReportTypes.js';
import { DefaultReportRegistryFactory } from '../src/modules/reports/definitions/index.js';
import { ExcelReportExporter } from '../src/modules/reports/exporters/ExcelReportExporter.js';
import { SisbetTxtExporter } from '../src/modules/reports/exporters/SisbetTxtExporter.js';
import type {
  AuthenticatedUserRecord,
  ICompanyRepository,
  IReportRepository,
  IUserRepository,
  RoleReportRecord,
} from '../src/repositories/contracts.js';
import {
  LegacyMysqlUserRepository,
  StaticCompanyRepository,
  StaticReportRepository,
} from '../src/repositories/LegacyMysqlRepositories.js';
import {
  LocalFileCompanyRepository,
  LocalFileReportRepository,
  LocalFileUserRepository,
} from '../src/repositories/LocalFileRepositories.js';
import type { Sequelize } from 'sequelize';
import { ServerApp } from '../src/ServerApp.js';

const TEST_COMPANIES: CompanyContext[] = [
  {
    id: 1,
    code: '39627',
    name: 'MULTIRED',
    cityLabel: 'YUMBO',
    nit: '805014543-9',
    legalName: 'GRUPO EMPRESARIAL MULTIRED S.A',
    warehouseCode: '2',
    sisbetCode: '020',
    legacyZones: ['1197'],
    costCenters: [39629, 39630, 39631],
    daneCodes: [76869, 76377, 76892],
    registrocajasUnits: ['1198', '1199', '39629', '39630', '39631'],
    excludedChanceGames: [15, 18, 104, 110, 116],
    requirePositiveCash: true,
  },
  {
    id: 2,
    code: '39628',
    name: 'SERVIRED',
    cityLabel: 'JAMUNDI',
    nit: '805003010-8',
    legalName: 'GRUPO EMPRESARIAL SERVIRED S.A',
    warehouseCode: '3',
    sisbetCode: '032',
    legacyZones: ['2023'],
    costCenters: [39632],
    daneCodes: [76364],
    registrocajasUnits: ['2024', '2025', '39632'],
    excludedChanceGames: [15, 18, 110, 116],
    requirePositiveCash: false,
  },
];

function stripSqlLiteralsAndComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:''|[^'])*'/g, "''");
}

function extractSqlBindNames(sql: string): Set<string> {
  const cleaned = stripSqlLiteralsAndComments(sql);
  const regex = /(?<![A-Za-z0-9_:]):([A-Za-z_][A-Za-z0-9_]*)/g;
  const names = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(cleaned)) !== null) {
    names.add(match[1]);
  }
  return names;
}

class MockOraclePoolManager implements IOraclePoolManager {
  public readonly calls: Array<{
    source: OracleSourceName;
    sql: string;
    binds: OracleBinds;
    maxRows: number;
  }> = [];

  public async initialize(): Promise<void> {}

  public async executeQuery<T extends Record<string, unknown>>(
    source: OracleSourceName,
    sql: string,
    binds: OracleBinds = {},
    maxRows = 0,
  ): Promise<T[]> {
    this.calls.push({ source, sql, binds, maxRows });

    if (sql.includes('FORMATO_SISBET')) {
      return [
        { FORMATO_SISBET: '020|35|1112480525|JUAN|PEREZ|LOPEZ|1112480525' } as unknown as T,
      ];
    }

    return [
      {
        MUNICIPIO: 'YUMBO',
        VENDEDOR: '1112480525',
        NOMBRE_VENDEDOR: 'JUAN PEREZ LOPEZ',
        HORA_RECAUDO: '01/11/2026 10:15:00',
        VALOR: 250000,
        CAJERO: '94321000',
        NOMBRE_CAJERO: 'MARIA GOMEZ',
        DESCRIPCION: 'RECAUDO PRUEBA',
      } as unknown as T,
    ];
  }

  public getHealthStatus(): Record<OracleSourceName, 'ready' | 'unconfigured' | 'lazy'> {
    return { principal: 'ready', replica: 'ready', naos: 'ready' };
  }

  public async closeAll(): Promise<void> {}
}

test('ReportRegistry registra exactamente 28 reportes únicos con SQL y binds consistentes', () => {
  const config = EnvironmentConfig.fromEnv({ NODE_ENV: 'test' });
  const registry = DefaultReportRegistryFactory.create(config);
  const reports = registry.getAllReports();

  assert.equal(reports.length, 28);

  const seenSlugs = new Set<string>();
  const multired = TEST_COMPANIES[0];

  for (const report of reports) {
    assert.ok(!seenSlugs.has(report.metadata.slug), `Slug duplicado: ${report.metadata.slug}`);
    seenSlugs.add(report.metadata.slug);
    assert.ok(report.getColumns().length > 0, `${report.metadata.slug} debe definir columnas`);

    let rawInput: Record<string, unknown>;
    switch (report.metadata.inputSchema) {
      case 'date_range':
        rawInput = {
          ...(report.metadata.requiresCompany ? { empresa: multired.code } : {}),
          fecha1: '2026-11-01',
          fecha2: '2026-11-15',
        };
        break;
      case 'single_date':
        rawInput = { empresa: multired.code, fecha1: '2026-11-01' };
        break;
      case 'single_date_sorteo':
        rawInput = { empresa: multired.code, fecha1: '2026-11-01', sorteo: '4520' };
        break;
      case 'single_date_serie':
        rawInput = { fecha1: '2025-01-01', serie: 'G1S0004806296' };
        break;
      case 'company_only':
        rawInput = { empresa: multired.code };
        break;
      case 'document_list':
        rawInput = {
          empresa: multired.code,
          documentos: ['1112480525', '94321000'],
        };
        break;
    }

    const parsed = report.validateInput(rawInput);
    const company = report.metadata.requiresCompany || rawInput.empresa ? multired : undefined;
    const spec = report.buildQuery(parsed, company);

    const placeholders = extractSqlBindNames(spec.sql);
    const bindKeys = new Set(Object.keys(spec.binds));

    for (const placeholder of placeholders) {
      assert.ok(
        bindKeys.has(placeholder),
        `${report.metadata.slug}: falta bind ':${placeholder}' en binds`,
      );
    }
    for (const bindKey of bindKeys) {
      assert.ok(
        placeholders.has(bindKey),
        `${report.metadata.slug}: bind huérfano ':${bindKey}' no usado en SQL (riesgo ORA-01036)`,
      );
    }

    assert.ok(
      !spec.sql.includes('01/11/2026') &&
        !spec.sql.includes('01/01/2025') &&
        !spec.sql.includes('G1S0004806296') &&
        !spec.sql.includes('1112480525') &&
        !spec.sql.includes('4520'),
      `${report.metadata.slug}: detectada interpolación literal de parámetros en SQL`,
    );
  }
});

test('Validación Zod rechaza entradas maliciosas o rangos inválidos', () => {
  const config = EnvironmentConfig.fromEnv({ NODE_ENV: 'test' });
  const registry = DefaultReportRegistryFactory.create(config);

  const plano = registry.getBySlug('plano-devoluciones')!;
  assert.throws(
    () =>
      plano.validateInput({
        empresa: '39627',
        fecha1: "2026-11-01' OR '1'='1",
        sorteo: '4520',
      }),
    ZodError,
  );
  assert.throws(
    () =>
      plano.validateInput({
        empresa: '39627',
        fecha1: '2026-11-01',
        sorteo: '12;DROP',
      }),
    ZodError,
  );

  const baloto = registry.getBySlug('vendedores-baloto')!;
  assert.throws(
    () =>
      baloto.validateInput({
        empresa: '39627',
        documentos: ['12345 OR 1=1'],
      }),
    ZodError,
  );

  const comisiones = registry.getBySlug('comisiones')!;
  assert.throws(
    () =>
      comisiones.validateInput({
        empresa: '39627',
        fecha1: '2026-11-20',
        fecha2: '2026-11-01',
      }),
    ZodError,
  );

  const premiosAstro = registry.getBySlug('premios-astro')!;
  assert.throws(
    () =>
      premiosAstro.validateInput({
        fecha1: '2025-01-01',
        serie: "G1S0004806296' OR '1'='1",
      }),
    ZodError,
  );
  const parsedAstro = premiosAstro.validateInput({
    fecha1: '2025-01-01',
    serie: 'g1s0004806296',
  });
  assert.equal(parsedAstro.serie, 'G1S0004806296');
});

test('ExcelReportExporter genera .xlsx válido preservando columnas de texto largo', async () => {
  const config = EnvironmentConfig.fromEnv({ NODE_ENV: 'test' });
  const registry = DefaultReportRegistryFactory.create(config);
  const consultaDev = registry.getBySlug('consulta-devoluciones')!;
  const exporter = new ExcelReportExporter();

  const file = await exporter.export({
    metadata: consultaDev.metadata,
    columns: consultaDev.getColumns(),
    rows: [
      {
        FECHAREGISTRA: '01/11/2026',
        COLOCADOR: '1112480525',
        NOMBRES: 'JUAN PEREZ',
        LOTERIA: 'LOTERIA DEL VALLE',
        SORTEO: '4520',
        ESTADO: 'CONFIRMADO',
        DEVOLUCION_SIN_CONSECUTIVO: '123456789000505',
      },
    ],
    filenameBase: 'CONSULTA_DEVOLUCIONES_MULTIRED_20261101',
    generatedAt: new Date().toISOString(),
    truncated: false,
  });

  assert.equal(
    file.mimeType,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  assert.equal(file.filename, 'CONSULTA_DEVOLUCIONES_MULTIRED_20261101.xlsx');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  assert.ok(sheet, 'Debe contener al menos una hoja Excel');
  assert.equal(sheet.getRow(1).getCell(7).value, 'DEVOLUCION SIN CONSECUTIVO');
  assert.equal(sheet.getRow(2).getCell(7).value, '123456789000505');
});

test('SisbetTxtExporter genera archivo plano pipe-delimited con CRLF sin BOM', async () => {
  const config = EnvironmentConfig.fromEnv({ NODE_ENV: 'test' });
  const registry = DefaultReportRegistryFactory.create(config);
  const sisbet = registry.getBySlug('astro-sisbet-usuarios')!;
  const exporter = new SisbetTxtExporter();

  const file = await exporter.export({
    metadata: sisbet.metadata,
    columns: sisbet.getColumns(),
    rows: [
      { FORMATO_SISBET: '020|35|1112480525|JUAN|PEREZ|LOPEZ|1112480525' },
      { FORMATO_SISBET: '020|35|94321000|MARIA|GOMEZ|RUIZ|94321000' },
    ],
    filenameBase: 'ASTRO_SISBET',
    sisbetArchiveCode: '020',
    generatedAt: new Date().toISOString(),
    truncated: false,
  });

  assert.match(file.filename, /^ADV_020_\d{8}\.txt$/);
  assert.equal(file.mimeType, 'text/plain; charset=iso-8859-1');
  const text = file.buffer.toString('latin1');
  assert.ok(!text.startsWith('\uFEFF'), 'No debe tener BOM');
  assert.equal(
    text,
    '020|35|1112480525|JUAN|PEREZ|LOPEZ|1112480525\r\n020|35|94321000|MARIA|GOMEZ|RUIZ|94321000',
  );
});

test('ServerApp API end-to-end: autenticación, catálogo, RBAC por reporte y empresa, preview y export', async () => {
  const config = EnvironmentConfig.fromEnv({
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-key-at-least-32-chars',
  });
  const registry = DefaultReportRegistryFactory.create(config);
  const oraclePools = new MockOraclePoolManager();

  const adminHash = bcrypt.hashSync('AdminPass123*', 6);
  const conteoHash = bcrypt.hashSync('ConteoPass123*', 6);

  const users: AuthenticatedUserRecord[] = [
    {
      id: 1,
      login: 'admin',
      passwordHash: adminHash,
      fullName: 'Administrador',
      isActive: true,
      role: { id: 1, code: 'ADMIN', name: 'Admin', isActive: true },
    },
    {
      id: 2,
      login: 'conteo_yumbo',
      passwordHash: conteoHash,
      fullName: 'Conteo Multired',
      isActive: true,
      role: { id: 2, code: 'CONTEO_MULTIRED', name: 'Conteo Multired', isActive: true },
    },
  ];

  const userRepo: IUserRepository = {
    async findByLogin(login) {
      return users.find((u) => u.login === login) ?? null;
    },
    async findById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async updateLastLogin() {},
  };

  const companyRepo: ICompanyRepository = {
    async findByRoleId(roleId) {
      return roleId === 1 ? TEST_COMPANIES : [TEST_COMPANIES[0]];
    },
    async findAuthorizedCompany(roleId, code) {
      const list = roleId === 1 ? TEST_COMPANIES : [TEST_COMPANIES[0]];
      return list.find((c) => c.code === code) ?? null;
    },
  };

  const allReportRecords: RoleReportRecord[] = registry.getAllMetadata().map((m, idx) => ({
    ...m,
    id: idx + 1,
    isActive: true,
  }));
  const conteoAllowedSlugs = new Set(['premios-pagados', 'recaudos']);

  const reportRepo: IReportRepository = {
    async findAuthorizedReportsByRoleId(roleId) {
      if (roleId === 1) {
        return allReportRecords;
      }
      return allReportRecords.filter((r) => conteoAllowedSlugs.has(r.slug));
    },
    async isReportAuthorizedForRole(roleId, slug) {
      if (roleId === 1) {
        return allReportRecords.some((r) => r.slug === slug);
      }
      return conteoAllowedSlugs.has(slug);
    },
  };

  const app = new ServerApp({
    config,
    oraclePools,
    reportRegistry: registry,
    userRepository: userRepo,
    companyRepository: companyRepo,
    reportRepository: reportRepo,
    getAppDbStatus: async () => 'connected',
  });

  const port = await app.listen(0);
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // 1. Healthcheck
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as { registeredReports: number };
    assert.equal(healthJson.registeredReports, 28);

    // 1b. CORS preflight desde 127.0.0.1 y localhost
    for (const origin of ['http://127.0.0.1:4321', 'http://localhost:4321']) {
      const preflightRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      });
      assert.equal(preflightRes.status, 204);
      assert.equal(preflightRes.headers.get('access-control-allow-origin'), origin);
      assert.equal(preflightRes.headers.get('access-control-allow-credentials'), 'true');
    }

    // 2. Bloqueo sin sesión
    const unauthRes = await fetch(`${baseUrl}/catalog`);
    assert.equal(unauthRes.status, 401);

    // 3. Login rol restringido CONTEO_MULTIRED
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'conteo_yumbo', password: 'ConteoPass123*' }),
    });
    assert.equal(loginRes.status, 200);
    const setCookie = loginRes.headers.get('set-cookie') ?? '';
    assert.ok(setCookie.includes('rm_token='), 'Debe emitir cookie rm_token');
    assert.ok(setCookie.toLowerCase().includes('httponly'), 'Cookie debe ser HttpOnly');
    const conteoCookie = setCookie.split(';')[0];

    // 4. Catálogo filtrado por rol
    const catalogRes = await fetch(`${baseUrl}/catalog`, {
      headers: { Cookie: conteoCookie },
    });
    assert.equal(catalogRes.status, 200);
    const catalogJson = (await catalogRes.json()) as {
      companies: CompanyContext[];
      totalReports: number;
    };
    assert.equal(catalogJson.companies.length, 1);
    assert.equal(catalogJson.companies[0].code, '39627');
    assert.equal(catalogJson.totalReports, 2);

    // 5. RBAC: reporte no autorizado -> 403
    const forbiddenReportRes = await fetch(`${baseUrl}/reports/ganadores-diario/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: conteoCookie },
      body: JSON.stringify({ empresa: '39627', fecha1: '2026-11-01', fecha2: '2026-11-10' }),
    });
    assert.equal(forbiddenReportRes.status, 403);

    // 6. RBAC: empresa no autorizada -> 403
    const forbiddenCompanyRes = await fetch(`${baseUrl}/reports/recaudos/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: conteoCookie },
      body: JSON.stringify({ empresa: '39628', fecha1: '2026-11-01', fecha2: '2026-11-10' }),
    });
    assert.equal(forbiddenCompanyRes.status, 403);

    // 7. Preview autorizado -> 200
    const previewRes = await fetch(`${baseUrl}/reports/recaudos/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: conteoCookie },
      body: JSON.stringify({ empresa: '39627', fecha1: '2026-11-01', fecha2: '2026-11-10' }),
    });
    assert.equal(previewRes.status, 200);
    const previewJson = (await previewRes.json()) as {
      totalReturned: number;
      rows: Array<Record<string, unknown>>;
    };
    assert.equal(previewJson.totalReturned, 1);
    assert.equal(previewJson.rows[0].MUNICIPIO, 'YUMBO');

    // 8. Export Excel autorizado -> 200
    const exportXlsxRes = await fetch(`${baseUrl}/reports/recaudos/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: conteoCookie },
      body: JSON.stringify({ empresa: '39627', fecha1: '2026-11-01', fecha2: '2026-11-10' }),
    });
    assert.equal(exportXlsxRes.status, 200);
    assert.equal(
      exportXlsxRes.headers.get('content-type'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    assert.match(exportXlsxRes.headers.get('content-disposition') ?? '', /\.xlsx/);

    // 9. Login ADMIN y export SISBET TXT -> 200
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'admin', password: 'AdminPass123*' }),
    });
    assert.equal(adminLoginRes.status, 200);
    const adminCookie = (adminLoginRes.headers.get('set-cookie') ?? '').split(';')[0];

    const sisbetRes = await fetch(`${baseUrl}/reports/astro-sisbet-usuarios/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ empresa: '39627', documentos: ['1112480525'] }),
    });
    assert.equal(sisbetRes.status, 200);
    assert.match(sisbetRes.headers.get('content-type') ?? '', /^text\/plain/);
    assert.match(sisbetRes.headers.get('content-disposition') ?? '', /ADV_020_\d{8}\.txt/);
    const txtBody = await sisbetRes.text();
    assert.equal(txtBody, '020|35|1112480525|JUAN|PEREZ|LOPEZ|1112480525');
  } finally {
    await app.close();
  }
});

test('LocalFileDatabase inicializa empresas, roles, 27 reportes y usuario admin en disco', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'rm-localdb-'));
  const dbFile = path.join(tempDir, 'local-db.json');

  try {
    const config = EnvironmentConfig.fromEnv({ NODE_ENV: 'test' });
    const registry = DefaultReportRegistryFactory.create(config);
    const localDb = new LocalFileDatabase(dbFile);
    await localDb.initialize(registry.getAllMetadata(), 'MiClaveAdmin123');

    const userRepo = new LocalFileUserRepository(localDb);
    const companyRepo = new LocalFileCompanyRepository(localDb);
    const reportRepo = new LocalFileReportRepository(localDb);

    const authService = new AuthService(
      userRepo,
      companyRepo,
      'test-jwt-secret-key-at-least-32-chars',
      '8h',
    );
    const loginResult = await authService.login('admin', 'MiClaveAdmin123');
    assert.equal(loginResult.user.roleCode, 'ADMIN');
    assert.equal(loginResult.user.companies.length, 2);

    const reports = await reportRepo.findAuthorizedReportsByRoleId(1);
    assert.equal(reports.length, 28);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('AuthService soporta validación legada en modo legacy_mysql y la rechaza por defecto', async () => {
  const legacyUser: AuthenticatedUserRecord = {
    id: 7,
    login: 'legacy_user',
    passwordHash: 'claveLegada123',
    fullName: 'Usuario Legado',
    isActive: true,
    role: { id: 2, code: 'CONTEO_MULTIRED', name: 'Conteo Multired', isActive: true },
  };
  const userRepo: IUserRepository = {
    async findByLogin(login) {
      return login === 'legacy_user' ? legacyUser : null;
    },
    async findById(id) {
      return id === 7 ? legacyUser : null;
    },
    async updateLastLogin() {},
  };
  const companyRepo: ICompanyRepository = {
    async findByRoleId() {
      return [TEST_COMPANIES[0]];
    },
    async findAuthorizedCompany() {
      return TEST_COMPANIES[0];
    },
  };

  const strictAuth = new AuthService(
    userRepo,
    companyRepo,
    'test-jwt-secret-key-at-least-32-chars',
    '8h',
    false,
  );
  await assert.rejects(() => strictAuth.login('legacy_user', 'claveLegada123'));

  const legacyAuth = new AuthService(
    userRepo,
    companyRepo,
    'test-jwt-secret-key-at-least-32-chars',
    '8h',
    true,
  );
  const res = await legacyAuth.login('legacy_user', 'claveLegada123');
  assert.equal(res.user.login, 'legacy_user');
  assert.equal(res.user.roleCode, 'CONTEO_MULTIRED');
});

test('LegacyMysqlUserRepository mapea columnas alternas, perfil normalizado y detecta PK en findById', async () => {
  const executedSqls: string[] = [];
  const fakeSequelize = {
    async query(sql: string, opts?: { replacements?: Record<string, unknown> }) {
      executedSqls.push(sql);
      if (sql.startsWith('SHOW COLUMNS')) {
        return [{ Field: 'idusuario' }, { Field: 'login' }];
      }
      if (sql.includes('WHERE `idusuario` = :id') && opts?.replacements?.id === 42) {
        return [
          {
            idusuario: 42,
            LOGIN: 'jefe_conteo',
            PASS: 'secreto123',
            nombreusu: 'Jefe Conteo',
            PERFIL: 'admin',
            ACTIVO: 1,
          },
        ];
      }
      if (sql.includes('WHERE login = :login')) {
        const login = opts?.replacements?.login;
        if (login === 'jefe_conteo') {
          return [
            {
              idusuario: 42,
              LOGIN: 'jefe_conteo',
              PASS: 'secreto123',
              nombreusu: 'Jefe Conteo',
              PERFIL: 'admin',
              ACTIVO: 1,
            },
          ];
        }
        if (login === 'adm_multired') {
          return [
            {
              id: 50,
              login: 'adm_multired',
              pass: 'clave50',
              nombre: 'Admin Multired',
              perfil: 'ADMINISTRACION-MULTIRED',
              activo: 1,
            },
          ];
        }
        if (login === 'aud_servired') {
          return [
            {
              id: 51,
              login: 'aud_servired',
              pass: 'clave51',
              nombre: 'Auditoria Servired',
              perfil: 'AUDITORIA-SERVIRED\n',
              activo: 1,
            },
          ];
        }
        if (login === 'conductor_1') {
          return [
            {
              id: 52,
              login: 'conductor_1',
              pass: 'clave52',
              nombre: 'Conductor Ruta',
              perfil: 'CONDUCTOR',
              activo: 1,
            },
          ];
        }
      }
      return [];
    },
  } as unknown as Sequelize;

  const repo = new LegacyMysqlUserRepository(fakeSequelize);

  // findById antes de findByLogin debe detectar la PK con SHOW COLUMNS
  const byId = await repo.findById(42);
  assert.ok(byId);
  assert.equal(byId.id, 42);
  assert.equal(byId.login, 'jefe_conteo');
  assert.equal(byId.role.code, 'ADMIN');

  const byLogin = await repo.findByLogin('jefe_conteo');
  assert.ok(byLogin);
  assert.equal(byLogin.fullName, 'Jefe Conteo');
  assert.equal(byLogin.isActive, true);
  assert.ok(executedSqls.some((s) => s.includes('activo != 0')));

  const admMultired = await repo.findByLogin('adm_multired');
  assert.ok(admMultired);
  assert.equal(admMultired.role.code, 'ADMINISTRACION_MULTIRED');

  const audServired = await repo.findByLogin('aud_servired');
  assert.ok(audServired);
  assert.equal(audServired.role.code, 'AUDITORIA-SERVIRED');

  const conductor = await repo.findByLogin('conductor_1');
  assert.ok(conductor);
  assert.equal(conductor.role.id, 0);
  assert.equal(conductor.role.code, 'CONDUCTOR');

  const config = EnvironmentConfig.fromEnv({ NODE_ENV: 'test' });
  const registry = DefaultReportRegistryFactory.create(config);
  const staticCompanies = new StaticCompanyRepository();
  const staticReports = new StaticReportRepository(registry.getAllMetadata());
  assert.deepEqual(await staticCompanies.findByRoleId(0), []);
  assert.deepEqual(await staticReports.findAuthorizedReportsByRoleId(0), []);
  assert.equal(await staticReports.isReportAuthorizedForRole(0, 'recaudos'), false);
});

test('EnvironmentConfig en producción rechaza secretos inseguros y CORS wildcard', () => {
  assert.throws(
    () =>
      EnvironmentConfig.fromEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'secreto-muy-corto-20ch',
        CLIENT_ORIGIN: 'http://localhost:8080',
      }),
    /JWT_SECRET/,
  );

  assert.throws(
    () =>
      EnvironmentConfig.fromEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'cambia-esta-clave-secreta-en-produccion-min-32-chars',
        CLIENT_ORIGIN: 'http://localhost:8080',
      }),
    /JWT_SECRET/,
  );

  assert.throws(
    () =>
      EnvironmentConfig.fromEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'clave-produccion-unica-super-segura-2026-multired-servired',
        CLIENT_ORIGIN: '*',
      }),
    /CLIENT_ORIGIN/,
  );

  const validProd = EnvironmentConfig.fromEnv({
    NODE_ENV: 'production',
    JWT_SECRET: 'clave-produccion-unica-super-segura-2026-multired-servired',
    CLIENT_ORIGIN: 'https://reportes.ejemplo.local',
  });
  assert.equal(validProd.isProduction, true);
  assert.deepEqual(validProd.clientOrigins, ['https://reportes.ejemplo.local']);
});

test('AuthService.verifyToken rechaza tokens con algoritmo none o distinto de HS256', async () => {
  const secret = 'test-jwt-secret-key-at-least-32-chars';
  const authService = new AuthService(
    {
      findByLogin: async () => null,
      findById: async () => null,
      updateLastLogin: async () => {},
    },
    {
      findByRoleId: async () => [],
      findAuthorizedCompany: async () => null,
    },
    secret,
    '1h',
    false,
  );

  const headerNone = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: 1, login: 'admin', roleId: 1, roleCode: 'ADMIN' }),
  ).toString('base64url');
  const unsignedToken = `${headerNone}.${payload}.`;
  assert.throws(() => authService.verifyToken(unsignedToken), /inválida|expirada/i);

  const hs384Token = jwt.sign(
    { sub: 1, login: 'admin', roleId: 1, roleCode: 'ADMIN' },
    secret,
    { algorithm: 'HS384', expiresIn: '1h' },
  );
  assert.throws(() => authService.verifyToken(hs384Token), /inválida|expirada/i);

  const hs256Token = jwt.sign(
    { sub: 1, login: 'admin', roleId: 1, roleCode: 'ADMIN' },
    secret,
    { algorithm: 'HS256', expiresIn: '1h' },
  );
  const verified = authService.verifyToken(hs256Token);
  assert.equal(verified.login, 'admin');
});

test('RateLimiterMiddleware limita peticiones excedentes con TooManyRequestsError y Retry-After', () => {
  const limiter = new RateLimiterMiddleware({
    windowMs: 60_000,
    maxAttempts: 2,
    keyPrefix: 'login-test',
  });

  const headers = new Map<string, string>();
  const mockReq = {
    ip: '10.98.98.50',
    socket: { remoteAddress: '10.98.98.50' },
  } as unknown as Parameters<RateLimiterMiddleware['handle']>[0];
  const mockRes = {
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
  } as unknown as Parameters<RateLimiterMiddleware['handle']>[1];

  const results: Array<unknown> = [];
  for (let i = 0; i < 3; i += 1) {
    limiter.handle(mockReq, mockRes, (err?: unknown) => {
      results.push(err ?? null);
    });
  }

  assert.equal(results[0], null);
  assert.equal(results[1], null);
  assert.ok(results[2] instanceof TooManyRequestsError);
  assert.equal((results[2] as TooManyRequestsError).statusCode, 429);
  assert.ok(Number(headers.get('Retry-After')) >= 1);
});

test('ExcelReportExporter neutraliza inyección de fórmulas en columnas text preservando valores normales', async () => {
  const config = EnvironmentConfig.fromEnv({ NODE_ENV: 'test' });
  const registry = DefaultReportRegistryFactory.create(config);
  const premiosAstro = registry.getBySlug('premios-astro')!;
  const exporter = new ExcelReportExporter();

  const file = await exporter.export({
    metadata: premiosAstro.metadata,
    columns: premiosAstro.getColumns(),
    rows: [
      {
        FECHAPAGO: '01/01/2025',
        HORAPAGO: '14:20:00',
        DOCUMENTOTERCERO: '1112480525',
        NOMBRES: "=CMD|' /C calc'!A0",
        SERIE: 'G1S',
        NUMERO: '0004806296',
        TOTALPREMIO: 50000,
        RETEFUENTE: 0,
        DOCUMENTOCAJERO: '-9901',
        CAJERO: '+CAJERO_PRUEBA',
        CODIGO_TIPOJUEGO: 1,
        TIPO_PREMIO: 'EFECTIVO',
      },
    ],
    filenameBase: 'PREMIOS_ASTRO_20250101',
    generatedAt: new Date().toISOString(),
    truncated: false,
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  assert.ok(sheet);
  assert.equal(sheet.getRow(2).getCell(3).value, '1112480525');
  assert.equal(sheet.getRow(2).getCell(4).value, "'=CMD|' /C calc'!A0");
  assert.equal(sheet.getRow(2).getCell(7).value, 50000);
  assert.equal(sheet.getRow(2).getCell(9).value, '-9901');
  assert.equal(sheet.getRow(2).getCell(10).value, "'+CAJERO_PRUEBA");
});

test('AuthService.authenticateToken valida JWT externo de api_login_v2 con secreto compartido o LOGIN_JWT_SECRET', async () => {
  const internalSecret = 'test-jwt-secret-key-at-least-32-chars';
  const externalSecret = 'external-login-v2-secret-at-least-32c';
  const activeUser: AuthenticatedUserRecord = {
    id: 15,
    login: 'conteo_yumbo',
    passwordHash: 'hash',
    fullName: 'Conteo Multired',
    isActive: true,
    role: { id: 2, code: 'CONTEO_MULTIRED', name: 'Conteo Multired', isActive: true },
  };
  const inactiveUser: AuthenticatedUserRecord = {
    id: 16,
    login: 'inactivo_user',
    passwordHash: 'hash',
    fullName: 'Usuario Inactivo',
    isActive: false,
    role: { id: 2, code: 'CONTEO_MULTIRED', name: 'Conteo Multired', isActive: true },
  };

  const userRepo: IUserRepository = {
    async findByLogin(login) {
      if (login === 'conteo_yumbo') return activeUser;
      if (login === 'inactivo_user') return inactiveUser;
      return null;
    },
    async findById(id) {
      if (id === 15) return activeUser;
      if (id === 16) return inactiveUser;
      return null;
    },
    async updateLastLogin() {},
  };
  const companyRepo: ICompanyRepository = {
    async findByRoleId() {
      return [TEST_COMPANIES[0]];
    },
    async findAuthorizedCompany() {
      return TEST_COMPANIES[0];
    },
  };

  const sharedAuth = new AuthService(userRepo, companyRepo, internalSecret, '1h', false);
  const sharedToken = jwt.sign({ username: 'conteo_yumbo', sub: 9999 }, internalSecret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
  const sharedResolved = await sharedAuth.authenticateToken(sharedToken);
  assert.equal(sharedResolved.sub, 15);
  assert.equal(sharedResolved.login, 'conteo_yumbo');
  assert.equal(sharedResolved.roleId, 2);
  assert.equal(sharedResolved.roleCode, 'CONTEO_MULTIRED');

  const splitAuth = new AuthService(
    userRepo,
    companyRepo,
    internalSecret,
    '1h',
    false,
    externalSecret,
  );
  const externalToken = jwt.sign({ username: 'conteo_yumbo', sub: 9999 }, externalSecret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
  const splitResolved = await splitAuth.authenticateToken(externalToken);
  assert.equal(splitResolved.sub, 15);
  assert.equal(splitResolved.roleCode, 'CONTEO_MULTIRED');

  const headerNone = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const rawPayload = Buffer.from(JSON.stringify({ username: 'conteo_yumbo', sub: 15 })).toString(
    'base64url',
  );
  await assert.rejects(() => splitAuth.authenticateToken(`${headerNone}.${rawPayload}.`), /inválida|expirada/i);

  const wrongSecretToken = jwt.sign(
    { username: 'conteo_yumbo', sub: 15 },
    'wrong-secret-key-at-least-32-chars!!',
    { algorithm: 'HS256', expiresIn: '1h' },
  );
  await assert.rejects(() => splitAuth.authenticateToken(wrongSecretToken), /inválida|expirada/i);

  const missingUserToken = jwt.sign({ username: 'no_existe', sub: 100 }, externalSecret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
  await assert.rejects(() => splitAuth.authenticateToken(missingUserToken), /no registrado o inactivo/i);

  const inactiveUserToken = jwt.sign({ username: 'inactivo_user', sub: 16 }, externalSecret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
  await assert.rejects(() => splitAuth.authenticateToken(inactiveUserToken), /no registrado o inactivo/i);
});

test('ServerApp autentica cookie JWT externa de api_login_v2, aplica RBAC y limpia cookies en logout', async () => {
  const jwtSecret = 'test-jwt-secret-key-at-least-32-chars';
  const loginSecret = 'external-login-v2-secret-at-least-32c';
  const config = EnvironmentConfig.fromEnv({
    NODE_ENV: 'test',
    JWT_SECRET: jwtSecret,
    LOGIN_JWT_SECRET: loginSecret,
  });
  const registry = DefaultReportRegistryFactory.create(config);
  const oraclePools = new MockOraclePoolManager();

  const users: AuthenticatedUserRecord[] = [
    {
      id: 2,
      login: 'conteo_yumbo',
      passwordHash: 'unused-external-auth',
      fullName: 'Conteo Multired',
      isActive: true,
      role: { id: 2, code: 'CONTEO_MULTIRED', name: 'Conteo Multired', isActive: true },
    },
    {
      id: 3,
      login: 'usuario_inactivo',
      passwordHash: 'unused-external-auth',
      fullName: 'Usuario Inactivo',
      isActive: false,
      role: { id: 2, code: 'CONTEO_MULTIRED', name: 'Conteo Multired', isActive: true },
    },
  ];

  const userRepo: IUserRepository = {
    async findByLogin(login) {
      return users.find((u) => u.login === login) ?? null;
    },
    async findById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async updateLastLogin() {},
  };

  const companyRepo: ICompanyRepository = {
    async findByRoleId(roleId) {
      return roleId === 2 ? [TEST_COMPANIES[0]] : [];
    },
    async findAuthorizedCompany(roleId, code) {
      const list = roleId === 2 ? [TEST_COMPANIES[0]] : [];
      return list.find((c) => c.code === code) ?? null;
    },
  };

  const allReportRecords: RoleReportRecord[] = registry.getAllMetadata().map((m, idx) => ({
    ...m,
    id: idx + 1,
    isActive: true,
  }));
  const conteoAllowedSlugs = new Set(['premios-pagados', 'recaudos']);
  const reportRepo: IReportRepository = {
    async findAuthorizedReportsByRoleId(roleId) {
      return roleId === 2 ? allReportRecords.filter((r) => conteoAllowedSlugs.has(r.slug)) : [];
    },
    async isReportAuthorizedForRole(roleId, slug) {
      return roleId === 2 && conteoAllowedSlugs.has(slug);
    },
  };

  const app = new ServerApp({
    config,
    oraclePools,
    reportRegistry: registry,
    userRepository: userRepo,
    companyRepository: companyRepo,
    reportRepository: reportRepo,
    getAppDbStatus: async () => 'connected',
  });

  const port = await app.listen(0);
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    const externalJwt = jwt.sign({ username: 'conteo_yumbo', sub: 9999 }, loginSecret, {
      algorithm: 'HS256',
      expiresIn: '1h',
    });

    // 1. Autenticación con cookie access_token emitida por api_login_v2
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: `access_token=${externalJwt}` },
    });
    assert.equal(meRes.status, 200);
    const meJson = (await meRes.json()) as {
      user: { id: number; login: string; roleCode: string; companies: CompanyContext[] };
    };
    assert.equal(meJson.user.id, 2);
    assert.equal(meJson.user.login, 'conteo_yumbo');
    assert.equal(meJson.user.roleCode, 'CONTEO_MULTIRED');
    assert.equal(meJson.user.companies.length, 1);

    // 2. Catálogo y RBAC por reporte con cookie token + rm_token obsoleta
    const catalogRes = await fetch(`${baseUrl}/catalog`, {
      headers: { Cookie: `rm_token=stale.invalid.token; token=${externalJwt}` },
    });
    assert.equal(catalogRes.status, 200);
    const catalogJson = (await catalogRes.json()) as {
      companies: CompanyContext[];
      totalReports: number;
    };
    assert.equal(catalogJson.companies.length, 1);
    assert.equal(catalogJson.totalReports, 2);

    const forbiddenRes = await fetch(`${baseUrl}/reports/ganadores-diario/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `access_token=${externalJwt}` },
      body: JSON.stringify({ empresa: '39627', fecha1: '2026-11-01', fecha2: '2026-11-10' }),
    });
    assert.equal(forbiddenRes.status, 403);

    const allowedRes = await fetch(`${baseUrl}/reports/recaudos/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `access_token=${externalJwt}` },
      body: JSON.stringify({ empresa: '39627', fecha1: '2026-11-01', fecha2: '2026-11-10' }),
    });
    assert.equal(allowedRes.status, 200);

    // 3. Usuario no registrado o inactivo en BD del reporteador -> 401
    const unknownUserJwt = jwt.sign({ username: 'usuario_desconocido', sub: 500 }, loginSecret, {
      algorithm: 'HS256',
      expiresIn: '1h',
    });
    const unknownRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: `access_token=${unknownUserJwt}` },
    });
    assert.equal(unknownRes.status, 401);

    const inactiveUserJwt = jwt.sign({ username: 'usuario_inactivo', sub: 3 }, loginSecret, {
      algorithm: 'HS256',
      expiresIn: '1h',
    });
    const inactiveRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: `access_token=${inactiveUserJwt}` },
    });
    assert.equal(inactiveRes.status, 401);

    // 4. Logout limpia todas las cookies configuradas
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, { method: 'POST' });
    assert.equal(logoutRes.status, 200);
    const setCookies =
      typeof logoutRes.headers.getSetCookie === 'function'
        ? logoutRes.headers.getSetCookie()
        : [logoutRes.headers.get('set-cookie') ?? ''];
    const joinedSetCookies = setCookies.join('\n');
    for (const cookieName of ['AuthTokenGaneCompany', 'access_token', 'token', 'jwt', 'auth_token', 'rm_token']) {
      assert.ok(
        joinedSetCookies.includes(`${cookieName}=`),
        `Logout debe limpiar la cookie ${cookieName}`,
      );
    }
  } finally {
    await app.close();
  }
});

test('ServerApp autentica cookie AuthTokenGaneCompany de login_unificado con mapeo híbrido de rol y empresa', async () => {
  const jwtSecret = 'test-jwt-secret-key-at-least-32-chars';
  const loginSecret = 'external-login-unificado-secret-32ch';
  const config = EnvironmentConfig.fromEnv({
    NODE_ENV: 'test',
    JWT_SECRET: jwtSecret,
    LOGIN_JWT_SECRET: loginSecret,
  });
  const registry = DefaultReportRegistryFactory.create(config);
  const oraclePools = new MockOraclePoolManager();

  const userRepo: IUserRepository = {
    async findByLogin() {
      return null;
    },
    async findById() {
      return null;
    },
    async updateLastLogin() {},
  };

  const companyRepo: ICompanyRepository = {
    async findByRoleId(roleId) {
      return roleId === 1 ? TEST_COMPANIES : [];
    },
    async findAuthorizedCompany(roleId, code) {
      const list = roleId === 1 ? TEST_COMPANIES : [];
      return list.find((c) => c.code === code) ?? null;
    },
  };

  const allReportRecords: RoleReportRecord[] = registry.getAllMetadata().map((m, idx) => ({
    ...m,
    id: idx + 1,
    isActive: true,
  }));

  const reportRepo: IReportRepository = {
    async findAuthorizedReportsByRoleId(roleId) {
      return roleId === 1 ? allReportRecords : [];
    },
    async isReportAuthorizedForRole(roleId, slug) {
      return roleId === 1 && allReportRecords.some((r) => r.slug === slug);
    },
  };

  const app = new ServerApp({
    config,
    oraclePools,
    reportRegistry: registry,
    userRepository: userRepo,
    companyRepository: companyRepo,
    reportRepository: reportRepo,
    getAppDbStatus: async () => 'connected',
  });

  const port = await app.listen(0);
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // 1. Token exacto de login_unificado con ambas empresas y sub_process coordinador_soporte -> ADMIN
    const dualCompanyToken = jwt.sign(
      {
        id: 'fe1b8f02-80f0-4476-9bd6-2ae8f0d59f2e',
        names: 'Cebastian',
        lastnames: 'Ponton',
        document: 1001060235,
        username: 'CP1001060235',
        email: 'aplicaciones@gruposervired.com.co',
        company: 'MultiredYServired',
        process: 'Financiero',
        sub_process: 'coordinador_soporte',
        state: 'Activo',
      },
      loginSecret,
      { algorithm: 'HS256', expiresIn: '1h' },
    );

    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: `AuthTokenGaneCompany=${dualCompanyToken}` },
    });
    assert.equal(meRes.status, 200);
    const meJson = (await meRes.json()) as {
      user: {
        login: string;
        fullName: string;
        roleCode: string;
        companies: CompanyContext[];
      };
    };
    assert.equal(meJson.user.login, 'CP1001060235');
    assert.equal(meJson.user.fullName, 'Cebastian Ponton');
    assert.equal(meJson.user.roleCode, 'ADMIN');
    assert.equal(meJson.user.companies.length, 2);

    const catalogRes = await fetch(`${baseUrl}/catalog`, {
      headers: { Cookie: `AuthTokenGaneCompany=${dualCompanyToken}` },
    });
    assert.equal(catalogRes.status, 200);
    const catalogJson = (await catalogRes.json()) as {
      companies: CompanyContext[];
      totalReports: number;
    };
    assert.equal(catalogJson.companies.length, 2);
    assert.equal(catalogJson.totalReports, 28);

    const previewRes = await fetch(`${baseUrl}/reports/recaudos/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `AuthTokenGaneCompany=${dualCompanyToken}`,
      },
      body: JSON.stringify({ empresa: '39627', fecha1: '2026-11-01', fecha2: '2026-11-10' }),
    });
    assert.equal(previewRes.status, 200);

    // 2. Token restringido a una sola empresa (Multired) bloquea acceso a Servired (39628)
    const multiredOnlyToken = jwt.sign(
      {
        id: 'user-2',
        names: 'Ana',
        lastnames: 'Gomez',
        username: 'AG123456',
        company: 'Multired',
        process: 'Tecnologia',
        sub_process: 'soporte',
        state: 'Activo',
      },
      loginSecret,
      { algorithm: 'HS256', expiresIn: '1h' },
    );

    const singleCatRes = await fetch(`${baseUrl}/catalog`, {
      headers: { Cookie: `AuthTokenGaneCompany=${multiredOnlyToken}` },
    });
    assert.equal(singleCatRes.status, 200);
    const singleCatJson = (await singleCatRes.json()) as {
      companies: CompanyContext[];
    };
    assert.equal(singleCatJson.companies.length, 1);
    assert.equal(singleCatJson.companies[0].code, '39627');

    const forbiddenCompanyRes = await fetch(`${baseUrl}/reports/recaudos/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `AuthTokenGaneCompany=${multiredOnlyToken}`,
      },
      body: JSON.stringify({ empresa: '39628', fecha1: '2026-11-01', fecha2: '2026-11-10' }),
    });
    assert.equal(forbiddenCompanyRes.status, 403);

    // 3. Usuario con state: 'Inactivo' es rechazado con 401
    const inactiveExternalToken = jwt.sign(
      {
        id: 'user-3',
        names: 'Carlos',
        lastnames: 'Ruiz',
        username: 'CR999999',
        company: 'MultiredYServired',
        process: 'Financiero',
        sub_process: 'coordinador_soporte',
        state: 'Inactivo',
      },
      loginSecret,
      { algorithm: 'HS256', expiresIn: '1h' },
    );
    const inactiveRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: `AuthTokenGaneCompany=${inactiveExternalToken}` },
    });
    assert.equal(inactiveRes.status, 401);

    // 4. Logout limpia AuthTokenGaneCompany
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, { method: 'POST' });
    assert.equal(logoutRes.status, 200);
    const setCookies =
      typeof logoutRes.headers.getSetCookie === 'function'
        ? logoutRes.headers.getSetCookie()
        : [logoutRes.headers.get('set-cookie') ?? ''];
    assert.ok(
      setCookies.join('\n').includes('AuthTokenGaneCompany='),
      'Logout debe limpiar la cookie AuthTokenGaneCompany',
    );
  } finally {
    await app.close();
  }
});

test('isAdminPortalAuthorized restringe el panel Admin a Desarrollo Informático o Director de Tecnología', () => {
  assert.equal(isAdminPortalAuthorized({ process: 'Desarrollo Informático' }), true);
  assert.equal(isAdminPortalAuthorized({ process: 'desarrollo_informatico' }), true);
  assert.equal(
    isAdminPortalAuthorized({ process: 'Tecnologia', position: 'Director de Tecnología' }),
    true,
  );
  assert.equal(
    isAdminPortalAuthorized({ process: 'Financiero', cargo: 'director_tecnologia' }),
    true,
  );
  assert.equal(
    isAdminPortalAuthorized({ process: 'Financiero', subProcess: 'coordinador_soporte' }),
    false,
  );
  assert.equal(
    isAdminPortalAuthorized({ process: 'Comercial', position: 'Coordinador Comercial' }),
    false,
  );
  assert.equal(
    isAdminPortalAuthorized({ process: 'Contabilidad', subProcess: 'Auxiliar Contable' }),
    false,
  );
});

test('UserPermissionsStore persiste permisos por usuario en disco y permite restaurarlos', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'rm-perms-'));
  const storeFile = path.join(tempDir, 'user-permissions.json');

  try {
    const store1 = new UserPermissionsStore(storeFile);
    await store1.initialize();
    assert.equal(store1.getByUsername('cp1001060235'), null);

    await store1.upsert({
      username: 'CP1001060235',
      reportSlugs: ['recaudos', 'premios-pagados', 'recaudos'],
      companyCodes: ['39627'],
      updatedBy: 'dir_tecnologia',
    });

    const store2 = new UserPermissionsStore(storeFile);
    await store2.initialize();
    const loaded = store2.getByUsername('cp1001060235');
    assert.ok(loaded);
    assert.equal(loaded.username, 'CP1001060235');
    assert.deepEqual(loaded.reportSlugs, ['recaudos', 'premios-pagados']);
    assert.deepEqual(loaded.companyCodes, ['39627']);

    const removed = await store2.deleteByUsername('CP1001060235');
    assert.equal(removed, true);
    assert.equal(store2.getByUsername('CP1001060235'), null);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('ServerApp /api/admin/permissions restringe acceso y aplica overrides por usuario en catálogo y RBAC', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'rm-admin-e2e-'));
  const storeFile = path.join(tempDir, 'user-permissions.json');
  const jwtSecret = 'test-jwt-secret-key-at-least-32-chars';
  const loginSecret = 'external-login-unificado-secret-32ch';
  const config = EnvironmentConfig.fromEnv({
    NODE_ENV: 'test',
    JWT_SECRET: jwtSecret,
    LOGIN_JWT_SECRET: loginSecret,
  });
  const registry = DefaultReportRegistryFactory.create(config);
  const oraclePools = new MockOraclePoolManager();
  const permissionsStore = new UserPermissionsStore(storeFile);
  await permissionsStore.initialize();

  const loginUsers: LoginUnificadoUserDto[] = [
    {
      id: 'u-1',
      username: 'DEV_ADMIN',
      fullName: 'Laura Desarrollo',
      document: '100200300',
      email: 'dev@empresa.com',
      company: 'MultiredYServired',
      process: 'Desarrollo Informático',
      subProcess: 'ingeniero_desarrollo',
      position: 'Ingeniero de Desarrollo',
      state: 'Activo',
      isActive: true,
    },
    {
      id: 'u-2',
      username: 'DIR_TECH',
      fullName: 'Carlos Director',
      document: '100200301',
      email: 'dir@empresa.com',
      company: 'MultiredYServired',
      process: 'Gerencia',
      subProcess: 'tecnologia',
      position: 'Director de Tecnología',
      state: 'Activo',
      isActive: true,
    },
    {
      id: 'u-3',
      username: 'CP1001060235',
      fullName: 'Cebastian Ponton',
      document: '1001060235',
      email: 'aplicaciones@gruposervired.com.co',
      company: 'MultiredYServired',
      process: 'Financiero',
      subProcess: 'coordinador_soporte',
      position: 'coordinador_soporte',
      state: 'Activo',
      isActive: true,
    },
  ];

  const loginRepo: ILoginUnificadoRepository = {
    async listUsers(search) {
      if (!search) return loginUsers;
      const q = search.toLowerCase();
      return loginUsers.filter(
        (u) => u.username.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q),
      );
    },
    async findByUsername(username) {
      return (
        loginUsers.find((u) => u.username.toLowerCase() === username.toLowerCase()) ?? null
      );
    },
    async close() {},
  };

  const userRepo: IUserRepository = {
    async findByLogin() {
      return null;
    },
    async findById() {
      return null;
    },
    async updateLastLogin() {},
  };
  const companyRepo = new StaticCompanyRepository();
  const reportRepo = new StaticReportRepository(registry.getAllMetadata());

  const app = new ServerApp({
    config,
    oraclePools,
    reportRegistry: registry,
    userRepository: userRepo,
    companyRepository: companyRepo,
    reportRepository: reportRepo,
    userPermissionsStore: permissionsStore,
    loginUnificadoRepository: loginRepo,
    getAppDbStatus: async () => 'connected',
  });

  const port = await app.listen(0);
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    const devToken = jwt.sign(
      {
        username: 'DEV_ADMIN',
        names: 'Laura',
        lastnames: 'Desarrollo',
        company: 'MultiredYServired',
        process: 'Desarrollo Informático',
        sub_process: 'ingeniero_desarrollo',
        state: 'Activo',
      },
      loginSecret,
      { algorithm: 'HS256', expiresIn: '1h' },
    );

    const dirToken = jwt.sign(
      {
        username: 'DIR_TECH',
        names: 'Carlos',
        lastnames: 'Director',
        company: 'MultiredYServired',
        process: 'Gerencia',
        sub_process: 'tecnologia',
        state: 'Activo',
      },
      loginSecret,
      { algorithm: 'HS256', expiresIn: '1h' },
    );

    const soporteToken = jwt.sign(
      {
        username: 'CP1001060235',
        names: 'Cebastian',
        lastnames: 'Ponton',
        company: 'MultiredYServired',
        process: 'Financiero',
        sub_process: 'coordinador_soporte',
        state: 'Activo',
      },
      loginSecret,
      { algorithm: 'HS256', expiresIn: '1h' },
    );

    // 1. Usuario Financiero/coordinador_soporte NO ve admin (canManagePermissions: false) -> 403 en /api/admin/permissions
    const soporteMeRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: `AuthTokenGaneCompany=${soporteToken}` },
    });
    assert.equal(soporteMeRes.status, 200);
    const soporteMeJson = (await soporteMeRes.json()) as {
      user: { canManagePermissions: boolean };
    };
    assert.equal(soporteMeJson.user.canManagePermissions, false);

    const soporteAdminRes = await fetch(`${baseUrl}/admin/permissions`, {
      headers: { Cookie: `AuthTokenGaneCompany=${soporteToken}` },
    });
    assert.equal(soporteAdminRes.status, 403);

    // 2. Usuario de Desarrollo Informático y Director de Tecnología SÍ tienen canManagePermissions: true
    for (const adminToken of [devToken, dirToken]) {
      const meRes = await fetch(`${baseUrl}/auth/me`, {
        headers: { Cookie: `AuthTokenGaneCompany=${adminToken}` },
      });
      assert.equal(meRes.status, 200);
      const meJson = (await meRes.json()) as {
        user: { canManagePermissions: boolean };
      };
      assert.equal(meJson.user.canManagePermissions, true);
    }

    const listRes = await fetch(`${baseUrl}/admin/permissions`, {
      headers: { Cookie: `AuthTokenGaneCompany=${dirToken}` },
    });
    assert.equal(listRes.status, 200);
    const listJson = (await listRes.json()) as {
      users: Array<{ username: string; isCustomized: boolean }>;
      reports: Array<{ slug: string }>;
    };
    assert.equal(listJson.users.length, 3);
    assert.equal(listJson.reports.length, 28);

    // 3. Asignar override de reportes y empresa a CP1001060235
    const putRes = await fetch(`${baseUrl}/admin/permissions/CP1001060235`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `AuthTokenGaneCompany=${devToken}`,
      },
      body: JSON.stringify({
        reportSlugs: ['recaudos'],
        companyCodes: ['39627'],
      }),
    });
    assert.equal(putRes.status, 200);

    // 4. El usuario personalizado ahora solo ve 1 reporte y 1 empresa en /api/catalog y RBAC
    const customCatRes = await fetch(`${baseUrl}/catalog`, {
      headers: { Cookie: `AuthTokenGaneCompany=${soporteToken}` },
    });
    assert.equal(customCatRes.status, 200);
    const customCatJson = (await customCatRes.json()) as {
      companies: CompanyContext[];
      totalReports: number;
    };
    assert.equal(customCatJson.totalReports, 1);
    assert.equal(customCatJson.companies.length, 1);
    assert.equal(customCatJson.companies[0].code, '39627');

    const allowedPreview = await fetch(`${baseUrl}/reports/recaudos/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `AuthTokenGaneCompany=${soporteToken}`,
      },
      body: JSON.stringify({ empresa: '39627', fecha1: '2026-11-01', fecha2: '2026-11-10' }),
    });
    assert.equal(allowedPreview.status, 200);

    const blockedReportPreview = await fetch(`${baseUrl}/reports/premios-pagados/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `AuthTokenGaneCompany=${soporteToken}`,
      },
      body: JSON.stringify({ empresa: '39627', fecha1: '2026-11-01', fecha2: '2026-11-10' }),
    });
    assert.equal(blockedReportPreview.status, 403);

    // 5. Restaurar por defecto devuelve los 28 reportes al usuario
    const delRes = await fetch(`${baseUrl}/admin/permissions/CP1001060235`, {
      method: 'DELETE',
      headers: { Cookie: `AuthTokenGaneCompany=${dirToken}` },
    });
    assert.equal(delRes.status, 200);

    const restoredCatRes = await fetch(`${baseUrl}/catalog`, {
      headers: { Cookie: `AuthTokenGaneCompany=${soporteToken}` },
    });
    assert.equal(restoredCatRes.status, 200);
    const restoredCatJson = (await restoredCatRes.json()) as { totalReports: number };
    assert.equal(restoredCatJson.totalReports, 28);
  } finally {
    await app.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});


