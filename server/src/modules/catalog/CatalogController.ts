import { Router, type Request, type Response } from 'express';
import { UnauthorizedError } from '../../core/errors/AppError.js';
import type { AuthMiddleware } from '../../middlewares/AuthMiddleware.js';
import type { CatalogService } from './CatalogService.js';

export class CatalogController {
  public readonly router: Router;

  constructor(
    private readonly catalogService: CatalogService,
    private readonly authMiddleware: AuthMiddleware,
  ) {
    this.router = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.get(
      '/',
      (req, res, next) => this.authMiddleware.authenticate(req, res, next),
      (req, res) => this.handleGetCatalog(req, res),
    );
  }

  private async handleGetCatalog(req: Request, res: Response): Promise<void> {
    if (!req.authUser) {
      throw new UnauthorizedError();
    }
    const catalog = await this.catalogService.getCatalogForRole(
      req.authUser.roleId,
      req.authUser.allowedCompanyCodes,
      req.authUser.login,
    );
    res.status(200).json(catalog);
  }
}
