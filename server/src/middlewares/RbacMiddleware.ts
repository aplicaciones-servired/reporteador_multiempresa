import type { NextFunction, Request, Response } from 'express';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../core/errors/AppError.js';
import type { IUserPermissionsStore } from '../database/UserPermissionsStore.js';
import { ALL_DEFAULT_COMPANIES } from '../modules/auth/AuthService.js';
import type { ReportRegistry } from '../modules/reports/core/ReportRegistry.js';
import type { CompanyContext } from '../modules/reports/core/ReportTypes.js';
import type { ICompanyRepository, IReportRepository } from '../repositories/contracts.js';

export class RbacMiddleware {
  constructor(
    private readonly reportRegistry: ReportRegistry,
    private readonly reportRepository: IReportRepository,
    private readonly companyRepository: ICompanyRepository,
    private readonly userPermissionsStore?: IUserPermissionsStore,
  ) {}

  public async authorizeReportAccess(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.authUser) {
        throw new UnauthorizedError();
      }

      const slug = String(req.params.slug ?? '').trim();
      const report = this.reportRegistry.getBySlug(slug);
      if (!report) {
        throw new NotFoundError(`El reporte '${slug}' no existe`);
      }

      const override = this.userPermissionsStore?.getByUsername(req.authUser.login) ?? null;

      const canAccessReport = override
        ? override.reportSlugs.includes(slug)
        : await this.reportRepository.isReportAuthorizedForRole(req.authUser.roleId, slug);
      if (!canAccessReport) {
        throw new ForbiddenError('Tu perfil no tiene permiso para ejecutar este reporte');
      }

      const rawEmpresa =
        typeof req.body?.empresa === 'string' ? req.body.empresa.trim() : '';

      if (report.metadata.requiresCompany && rawEmpresa.length === 0) {
        throw new ValidationError('Debes seleccionar una empresa autorizada');
      }

      if (rawEmpresa.length > 0) {
        let company: CompanyContext | null = null;
        if (override) {
          const effectiveCompanyCodes =
            override.companyCodes && override.companyCodes.length > 0
              ? override.companyCodes
              : req.authUser.allowedCompanyCodes;

          if (effectiveCompanyCodes && effectiveCompanyCodes.length > 0) {
            company = effectiveCompanyCodes.includes(rawEmpresa)
              ? (ALL_DEFAULT_COMPANIES.find((c) => c.code === rawEmpresa) ?? null)
              : null;
          } else {
            company = await this.companyRepository.findAuthorizedCompany(
              req.authUser.roleId,
              rawEmpresa,
            );
          }
        } else {
          company = await this.companyRepository.findAuthorizedCompany(
            req.authUser.roleId,
            rawEmpresa,
          );
          if (
            company &&
            req.authUser.allowedCompanyCodes &&
            !req.authUser.allowedCompanyCodes.includes(company.code)
          ) {
            company = null;
          }
        }

        if (!company) {
          throw new ForbiddenError('Tu perfil no tiene permiso sobre la empresa seleccionada');
        }
        req.authorizedCompany = company;
      } else {
        req.authorizedCompany = undefined;
      }

      next();
    } catch (error) {
      next(error);
    }
  }
}
