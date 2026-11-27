import { Sequelize } from 'sequelize';
import type { EnvironmentConfig } from '../config/EnvironmentConfig.js';
import { DatabaseError } from '../core/errors/AppError.js';
import { ModelRegistry } from './models/index.js';

export class SequelizeDatabase {
  private readonly sequelize: Sequelize;
  private initialized = false;

  constructor(config: EnvironmentConfig) {
    this.sequelize = new Sequelize(
      config.appDb.database,
      config.appDb.username,
      config.appDb.password,
      {
        host: config.appDb.host,
        port: config.appDb.port,
        dialect: config.appDb.dialect,
        logging: config.nodeEnv === 'development' ? false : false,
        pool: {
          max: 10,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },
      },
    );
  }

  public initModels(): void {
    if (!this.initialized) {
      ModelRegistry.registerAll(this.sequelize);
      this.initialized = true;
    }
  }

  public async connect(syncTables = false): Promise<void> {
    this.initModels();
    try {
      await this.sequelize.authenticate();
      if (syncTables) {
        await this.sequelize.sync();
      }
    } catch (error) {
      throw new DatabaseError('No se pudo conectar a la base de datos de aplicación', error);
    }
  }

  public getInstance(): Sequelize {
    this.initModels();
    return this.sequelize;
  }

  public async close(): Promise<void> {
    await this.sequelize.close();
  }
}
