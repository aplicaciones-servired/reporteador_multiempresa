import { EnvironmentConfig } from './config/EnvironmentConfig.js';
import { LocalFileDatabase } from './database/LocalFileDatabase.js';
import { OraclePoolManager } from './database/OraclePoolManager.js';
import { SequelizeDatabase } from './database/SequelizeDatabase.js';
import { UserPermissionsStore } from './database/UserPermissionsStore.js';
import { DefaultReportRegistryFactory } from './modules/reports/definitions/index.js';
import type {
  ICompanyRepository,
  IReportRepository,
  IUserRepository,
} from './repositories/contracts.js';
import {
  LegacyMysqlUserRepository,
  StaticCompanyRepository,
  StaticReportRepository,
} from './repositories/LegacyMysqlRepositories.js';
import {
  LocalFileCompanyRepository,
  LocalFileReportRepository,
  LocalFileUserRepository,
} from './repositories/LocalFileRepositories.js';
import { LoginUnificadoRepository } from './repositories/LoginUnificadoRepository.js';
import {
  SequelizeCompanyRepository,
  SequelizeReportRepository,
  SequelizeUserRepository,
} from './repositories/SequelizeRepositories.js';
import { ServerApp } from './ServerApp.js';

async function bootstrap(): Promise<void> {
  const config = EnvironmentConfig.getInstance();
  const reportRegistry = DefaultReportRegistryFactory.create(config);
  const oraclePools = new OraclePoolManager(config);
  await oraclePools.initialize();

  const userPermissionsStore = new UserPermissionsStore(config.userPermissionsFile);
  await userPermissionsStore.initialize();
  console.log(`Almacén de permisos por usuario activo (${userPermissionsStore.getFilePath()})`);

  let loginUnificadoRepository: LoginUnificadoRepository | undefined;
  if (config.loginDb) {
    loginUnificadoRepository = new LoginUnificadoRepository(config.loginDb);
    console.log(
      `Repositorio login_unificado configurado (${config.loginDb.host}:${config.loginDb.port}/${config.loginDb.database}.${config.loginDb.tableName})`,
    );
  }

  let userRepository: IUserRepository;
  let companyRepository: ICompanyRepository;
  let reportRepository: IReportRepository;
  let allowLegacyPlaintextPasswords = false;
  let closeAppDb: () => Promise<void> = async () => {};
  let getAppDbStatus: () => Promise<'connected' | 'disconnected'> = async () => 'connected';

  if (config.appDbMode === 'local_file') {
    const localDb = new LocalFileDatabase(config.localDbFile);
    await localDb.initialize(
      reportRegistry.getAllMetadata(),
      config.seedDefaultAdminPassword,
    );
    userRepository = new LocalFileUserRepository(localDb);
    companyRepository = new LocalFileCompanyRepository(localDb);
    reportRepository = new LocalFileReportRepository(localDb);
    console.log(`Modo APP_DB_MODE=local_file activo (${localDb.getFilePath()})`);
  } else if (config.appDbMode === 'legacy_mysql') {
    const sequelizeDb = new SequelizeDatabase(config);
    await sequelizeDb.getInstance().authenticate();
    userRepository = new LegacyMysqlUserRepository(sequelizeDb.getInstance());
    companyRepository = new StaticCompanyRepository();
    reportRepository = new StaticReportRepository(reportRegistry.getAllMetadata());
    allowLegacyPlaintextPasswords = true;
    closeAppDb = async () => sequelizeDb.close();
    getAppDbStatus = async () => {
      try {
        await sequelizeDb.getInstance().authenticate();
        return 'connected';
      } catch {
        return 'disconnected';
      }
    };
    console.log(
      `Modo APP_DB_MODE=legacy_mysql activo (${config.appDb.host}:${config.appDb.port}/${config.appDb.database})`,
    );
  } else {
    const sequelizeDb = new SequelizeDatabase(config);
    await sequelizeDb.connect(false);
    userRepository = new SequelizeUserRepository();
    companyRepository = new SequelizeCompanyRepository();
    reportRepository = new SequelizeReportRepository();
    closeAppDb = async () => sequelizeDb.close();
    getAppDbStatus = async () => {
      try {
        await sequelizeDb.getInstance().authenticate();
        return 'connected';
      } catch {
        return 'disconnected';
      }
    };
    console.log(
      `Modo APP_DB_MODE=sequelize activo (${config.appDb.dialect} ${config.appDb.host}:${config.appDb.port}/${config.appDb.database})`,
    );
  }

  const server = new ServerApp({
    config,
    oraclePools,
    reportRegistry,
    userRepository,
    companyRepository,
    reportRepository,
    userPermissionsStore,
    loginUnificadoRepository,
    allowLegacyPlaintextPasswords,
    getAppDbStatus,
  });

  const port = await server.listen(config.port);
  console.log(`API Reporteador Multiempresa escuchando en http://localhost:${port}`);

  const shutdown = async (signal: string) => {
    console.log(`Recibida señal ${signal}, cerrando servidor y conexiones...`);
    await server.close();
    await oraclePools.closeAll();
    await closeAppDb();
    if (loginUnificadoRepository) {
      await loginUnificadoRepository.close();
    }
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error('Error fatal al iniciar el servidor:', error);
  process.exit(1);
});
