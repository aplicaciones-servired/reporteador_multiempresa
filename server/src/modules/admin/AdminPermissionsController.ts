import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  AppError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../core/errors/AppError.js';
import { DEFAULT_ROLES } from '../../database/CatalogSeedData.js';
import type { IUserPermissionsStore } from '../../database/UserPermissionsStore.js';
import type { AuthMiddleware } from '../../middlewares/AuthMiddleware.js';
import type { IReportRepository } from '../../repositories/contracts.js';
import type {
  ILoginUnificadoRepository,
  LoginUnificadoUserDto,
} from '../../repositories/LoginUnificadoRepository.js';
import {
  ALL_DEFAULT_COMPANIES,
  isAdminPortalAuthorized,
  resolveExternalClaimsRoleAndCompanies,
} from '../auth/AuthService.js';
import type { ReportRegistry } from '../reports/core/ReportRegistry.js';

const updatePermissionsSchema = z.object({
  reportSlugs: z.array(z.string().trim().min(1)).max(200),
  companyCodes: z.array(z.string().trim().min(1)).max(20).optional(),
});

export interface AdminUserPermissionDto extends LoginUnificadoUserDto {
  readonly isAdminPortalAuthorized: boolean;
  readonly defaultRoleCode: string;
  readonly defaultRoleName: string;
  readonly defaultReportSlugs: string[];
  readonly defaultCompanyCodes: string[];
  readonly isCustomized: boolean;
  readonly effectiveReportSlugs: string[];
  readonly effectiveCompanyCodes: string[];
  readonly updatedAt: string | null;
  readonly updatedBy: string | null;
}

export class AdminPermissionsController {
  public readonly router: Router;

  constructor(
    private readonly authMiddleware: AuthMiddleware,
    private readonly reportRegistry: ReportRegistry,
    private readonly userPermissionsStore: IUserPermissionsStore,
    private readonly loginUnificadoRepository?: ILoginUnificadoRepository,
    private readonly reportRepository?: IReportRepository,
  ) {
    this.router = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.get(
      '/permissions',
      (req, res, next) => this.authMiddleware.authenticate(req, res, next),
      (req, res, next) => this.requireAdminPortal(req, res, next),
      (req, res) => this.handleListPermissions(req, res),
    );

    this.router.put(
      '/permissions/:username',
      (req, res, next) => this.authMiddleware.authenticate(req, res, next),
      (req, res, next) => this.requireAdminPortal(req, res, next),
      (req, res) => this.handleUpdatePermissions(req, res),
    );

    this.router.delete(
      '/permissions/:username',
      (req, res, next) => this.authMiddleware.authenticate(req, res, next),
      (req, res, next) => this.requireAdminPortal(req, res, next),
      (req, res) => this.handleDeletePermissions(req, res),
    );
  }

  private requireAdminPortal(req: Request, _res: Response, next: NextFunction): void {
    if (!req.authUser) {
      next(new UnauthorizedError());
      return;
    }
    if (!req.authUser.canManagePermissions) {
      next(
        new ForbiddenError(
          'Solo Desarrollo Informático, Director de Tecnología o coordinador_soporte pueden administrar permisos',
        ),
      );
      return;
    }
    next();
  }

  private async handleListPermissions(req: Request, res: Response): Promise<void> {
    if (!this.loginUnificadoRepository) {
      throw new AppError(
        'La conexión a la base de datos login_unificado (LOGIN_DB_*) no está configurada',
        503,
        'LOGIN_DB_UNCONFIGURED',
      );
    }

    const search = typeof req.query.q === 'string' ? req.query.q : undefined;
    const rawUsers = await this.loginUnificadoRepository.listUsers(search);
    const allReports = this.reportRegistry.getAllMetadata();
    const allReportSlugs = allReports.map((r) => r.slug);
    const roleReportsCache = new Map<number, string[]>();

    const resolveRoleSlugs = async (roleId: number): Promise<string[]> => {
      if (roleId <= 0) {
        return [];
      }
      const cached = roleReportsCache.get(roleId);
      if (cached) {
        return cached;
      }
      let slugs: string[];
      if (this.reportRepository) {
        const roleReports = await this.reportRepository.findAuthorizedReportsByRoleId(roleId);
        slugs = roleReports.map((r) => r.slug);
      } else {
        const spec = DEFAULT_ROLES[roleId - 1];
        slugs = spec
          ? spec.reportSlugs === '*'
            ? allReportSlugs
            : spec.reportSlugs
          : [];
      }
      roleReportsCache.set(roleId, slugs);
      return slugs;
    };

    const users: AdminUserPermissionDto[] = await Promise.all(
      rawUsers.map(async (user) => {
        const defaults = resolveExternalClaimsRoleAndCompanies({
          company: user.company,
          process: user.process,
          subProcess: user.subProcess,
          position: user.position,
        });
        const defaultReportSlugs = await resolveRoleSlugs(defaults.roleId);
        const roleSpec = defaults.roleId > 0 ? DEFAULT_ROLES[defaults.roleId - 1] : undefined;
        const roleCompanyCodes = roleSpec?.companyCodes ?? ALL_DEFAULT_COMPANIES.map((c) => c.code);
        const defaultCompanyCodes = defaults.companyCodes
          ? roleCompanyCodes.filter((code) => defaults.companyCodes!.includes(code))
          : roleCompanyCodes;

        const override = this.userPermissionsStore.getByUsername(user.username);
        const effectiveReportSlugs = override ? override.reportSlugs : defaultReportSlugs;
        const effectiveCompanyCodes =
          override?.companyCodes && override.companyCodes.length > 0
            ? override.companyCodes
            : defaultCompanyCodes;

        return {
          ...user,
          isAdminPortalAuthorized: isAdminPortalAuthorized({
            process: user.process,
            subProcess: user.subProcess,
            position: user.position,
          }),
          defaultRoleCode: defaults.roleCode,
          defaultRoleName: defaults.roleName,
          defaultReportSlugs,
          defaultCompanyCodes,
          isCustomized: Boolean(override),
          effectiveReportSlugs,
          effectiveCompanyCodes,
          updatedAt: override?.updatedAt ?? null,
          updatedBy: override?.updatedBy ?? null,
        };
      }),
    );

    res.status(200).json({
      users,
      reports: allReports,
      companies: ALL_DEFAULT_COMPANIES,
    });
  }

  private async handleUpdatePermissions(req: Request, res: Response): Promise<void> {
    if (!req.authUser) {
      throw new UnauthorizedError();
    }

    const username = decodeURIComponent(String(req.params.username ?? '')).trim();
    if (!username) {
      throw new ValidationError('El usuario en la ruta es obligatorio');
    }

    const parsed = updatePermissionsSchema.parse(req.body);
    const invalidSlugs = parsed.reportSlugs.filter((slug) => !this.reportRegistry.getBySlug(slug));
    if (invalidSlugs.length > 0) {
      throw new ValidationError(
        `Reportes inválidos: ${invalidSlugs.join(', ')}`,
      );
    }

    if (parsed.companyCodes) {
      const validCompanyCodes = new Set(ALL_DEFAULT_COMPANIES.map((c) => c.code));
      const invalidCompanies = parsed.companyCodes.filter(
        (code) => !validCompanyCodes.has(code),
      );
      if (invalidCompanies.length > 0) {
        throw new ValidationError(
          `Empresas inválidas: ${invalidCompanies.join(', ')}`,
        );
      }
    }

    const override = await this.userPermissionsStore.upsert({
      username,
      reportSlugs: parsed.reportSlugs,
      ...(parsed.companyCodes !== undefined ? { companyCodes: parsed.companyCodes } : {}),
      updatedBy: req.authUser.login,
    });

    res.status(200).json({ override });
  }

  private async handleDeletePermissions(req: Request, res: Response): Promise<void> {
    const username = decodeURIComponent(String(req.params.username ?? '')).trim();
    if (!username) {
      throw new ValidationError('El usuario en la ruta es obligatorio');
    }
    const removed = await this.userPermissionsStore.deleteByUsername(username);
    res.status(200).json({ removed, username });
  }
}
