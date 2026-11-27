import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Server } from 'node:http';
import type { EnvironmentConfig } from './config/EnvironmentConfig.js';
import type { IOraclePoolManager, OracleSourceName } from './database/OraclePoolManager.js';
import { AuthMiddleware } from './middlewares/AuthMiddleware.js';
import { ErrorHandlerMiddleware } from './middlewares/ErrorHandlerMiddleware.js';
import { RateLimiterMiddleware } from './middlewares/RateLimiterMiddleware.js';
import { RbacMiddleware } from './middlewares/RbacMiddleware.js';
import { AuthController } from './modules/auth/AuthController.js';
import { AuthService } from './modules/auth/AuthService.js';
import { CatalogController } from './modules/catalog/CatalogController.js';
import { CatalogService } from './modules/catalog/CatalogService.js';
import type { ReportRegistry } from './modules/reports/core/ReportRegistry.js';
import { ExporterFactory } from './modules/reports/exporters/ExporterFactory.js';
import { ReportController } from './modules/reports/ReportController.js';
import { ReportExecutionService } from './modules/reports/ReportExecutionService.js';
import type {
  ICompanyRepository,
  IReportRepository,
  IUserRepository,
} from './repositories/contracts.js';

export interface ServerDependencies {
  readonly config: EnvironmentConfig;
  readonly oraclePools: IOraclePoolManager;
  readonly reportRegistry: ReportRegistry;
  readonly userRepository: IUserRepository;
  readonly companyRepository: ICompanyRepository;
  readonly reportRepository: IReportRepository;
  readonly allowLegacyPlaintextPasswords?: boolean;
  readonly getAppDbStatus?: () => Promise<'connected' | 'disconnected'>;
  readonly loginRateLimiter?: RateLimiterMiddleware;
}

export class ServerApp {
  public readonly expressApp: Express;
  private httpServer: Server | null = null;

  constructor(private readonly deps: ServerDependencies) {
    this.expressApp = express();
    this.configureMiddlewares();
    this.configureRoutes();
    this.configureErrorHandling();
  }

  private configureMiddlewares(): void {
    this.expressApp.set('trust proxy', 1);
    this.expressApp.use(
      helmet({
        crossOriginResourcePolicy: { policy: 'same-origin' },
      }),
    );
    this.expressApp.use(
      cors({
        origin: this.deps.config.clientOrigins,
        credentials: true,
        exposedHeaders: ['Content-Disposition'],
      }),
    );
    this.expressApp.use(express.json({ limit: '1mb' }));
    this.expressApp.use(cookieParser());
  }

  private configureRoutes(): void {
    const authService = new AuthService(
      this.deps.userRepository,
      this.deps.companyRepository,
      this.deps.config.jwtSecret,
      this.deps.config.jwtExpiresIn,
      Boolean(this.deps.allowLegacyPlaintextPasswords),
      this.deps.config.loginJwtSecret,
    );
    const authMiddleware = new AuthMiddleware(authService, this.deps.config.authCookieNames);
    const rbacMiddleware = new RbacMiddleware(
      this.deps.reportRegistry,
      this.deps.reportRepository,
      this.deps.companyRepository,
    );

    const loginRateLimiter =
      this.deps.loginRateLimiter ??
      new RateLimiterMiddleware({
        windowMs: 15 * 60 * 1000,
        maxAttempts: 10,
        keyPrefix: 'login',
        skip: () => this.deps.config.nodeEnv === 'test',
      });

    const authController = new AuthController(
      authService,
      authMiddleware,
      this.deps.config.cookieSecure,
      loginRateLimiter,
      this.deps.config.authCookieNames,
    );

    const catalogService = new CatalogService(
      this.deps.companyRepository,
      this.deps.reportRepository,
    );
    const catalogController = new CatalogController(catalogService, authMiddleware);

    const exporterFactory = new ExporterFactory();
    const reportService = new ReportExecutionService(
      this.deps.reportRegistry,
      this.deps.oraclePools,
      exporterFactory,
    );
    const reportController = new ReportController(
      reportService,
      authMiddleware,
      rbacMiddleware,
    );

    this.expressApp.get('/api/health', async (_req, res) => {
      const oracleStatus: Record<OracleSourceName, string> =
        this.deps.oraclePools.getHealthStatus();
      const appDbStatus = this.deps.getAppDbStatus
        ? await this.deps.getAppDbStatus()
        : 'unknown';

      res.status(200).json({
        status: 'ok',
        service: 'reporteador-multiempresa-api',
        appDb: appDbStatus,
        oracle: oracleStatus,
        registeredReports: this.deps.reportRegistry.getAllMetadata().length,
        timestamp: new Date().toISOString(),
      });
    });

    this.expressApp.use('/api/auth', authController.router);
    this.expressApp.use('/api/catalog', catalogController.router);
    this.expressApp.use('/api/reports', reportController.router);
  }

  private configureErrorHandling(): void {
    const errorHandler = new ErrorHandlerMiddleware(this.deps.config.isProduction);
    this.expressApp.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
      errorHandler.handle(err, req, res, next);
    });
  }

  public async listen(port = this.deps.config.port): Promise<number> {
    return new Promise((resolve) => {
      this.httpServer = this.expressApp.listen(port, () => {
        const address = this.httpServer?.address();
        const boundPort = typeof address === 'object' && address ? address.port : port;
        resolve(boundPort);
      });
    });
  }

  public async close(): Promise<void> {
    if (!this.httpServer) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.httpServer?.close((err) => (err ? reject(err) : resolve()));
    });
    this.httpServer = null;
  }
}
