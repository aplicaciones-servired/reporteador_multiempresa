import { Router, type Request, type Response } from 'express';
import type { AuthMiddleware } from '../../middlewares/AuthMiddleware.js';
import type { RbacMiddleware } from '../../middlewares/RbacMiddleware.js';
import type { ReportExecutionService } from './ReportExecutionService.js';

export class ReportController {
  public readonly router: Router;

  constructor(
    private readonly reportService: ReportExecutionService,
    private readonly authMiddleware: AuthMiddleware,
    private readonly rbacMiddleware: RbacMiddleware,
  ) {
    this.router = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.post(
      '/:slug/preview',
      (req, res, next) => this.authMiddleware.authenticate(req, res, next),
      (req, res, next) => this.rbacMiddleware.authorizeReportAccess(req, res, next),
      (req, res) => this.handlePreview(req, res),
    );

    this.router.post(
      '/:slug/export',
      (req, res, next) => this.authMiddleware.authenticate(req, res, next),
      (req, res, next) => this.rbacMiddleware.authorizeReportAccess(req, res, next),
      (req, res) => this.handleExport(req, res),
    );
  }

  private async handlePreview(req: Request, res: Response): Promise<void> {
    const slug = String(req.params.slug ?? '').trim();
    const preview = await this.reportService.preview(slug, req.body, req.authorizedCompany);
    res.status(200).json(preview);
  }

  private async handleExport(req: Request, res: Response): Promise<void> {
    const slug = String(req.params.slug ?? '').trim();
    const exported = await this.reportService.export(slug, req.body, req.authorizedCompany);

    const safeFilename = this.sanitizeHeaderFilename(exported.filename);
    const encodedName = encodeURIComponent(safeFilename);
    res.setHeader('Content-Type', exported.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedName}`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(exported.buffer);
  }

  private sanitizeHeaderFilename(name: string): string {
    const cleaned = name.replace(/[\r\n";\\/]+/g, '_').trim();
    return cleaned || 'reporte.bin';
  }
}
