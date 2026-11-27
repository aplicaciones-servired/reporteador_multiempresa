import { Router, type Request, type Response } from 'express';
import { UnauthorizedError } from '../../core/errors/AppError.js';
import type { AuthMiddleware } from '../../middlewares/AuthMiddleware.js';
import { AUTH_COOKIE_NAME, DEFAULT_AUTH_COOKIE_NAMES } from '../../middlewares/AuthMiddleware.js';
import type { RateLimiterMiddleware } from '../../middlewares/RateLimiterMiddleware.js';
import { AuthService } from './AuthService.js';
import { loginSchema } from './auth.schemas.js';

export class AuthController {
  public readonly router: Router;

  constructor(
    private readonly authService: AuthService,
    private readonly authMiddleware: AuthMiddleware,
    private readonly cookieSecure: boolean,
    private readonly loginRateLimiter?: RateLimiterMiddleware,
    private readonly authCookieNames: readonly string[] = DEFAULT_AUTH_COOKIE_NAMES,
  ) {
    this.router = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    if (this.loginRateLimiter) {
      this.router.post(
        '/login',
        (req, res, next) => this.loginRateLimiter!.handle(req, res, next),
        (req, res) => this.handleLogin(req, res),
      );
    } else {
      this.router.post('/login', (req, res) => this.handleLogin(req, res));
    }
    this.router.post('/logout', (req, res) => this.handleLogout(req, res));
    this.router.get(
      '/me',
      (req, res, next) => this.authMiddleware.authenticate(req, res, next),
      (req, res) => this.handleMe(req, res),
    );
  }

  private async handleLogin(req: Request, res: Response): Promise<void> {
    const parsed = loginSchema.parse(req.body);
    const result = await this.authService.login(parsed.login, parsed.password);

    res.cookie(AUTH_COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(200).json({ user: result.user });
  }

  private async handleLogout(_req: Request, res: Response): Promise<void> {
    const cookieNamesToClear = new Set([AUTH_COOKIE_NAME, ...this.authCookieNames]);
    for (const cookieName of cookieNamesToClear) {
      res.clearCookie(cookieName, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.cookieSecure,
        path: '/',
      });
    }
    res.status(200).json({ message: 'Sesión cerrada correctamente' });
  }

  private async handleMe(req: Request, res: Response): Promise<void> {
    if (!req.authUser) {
      throw new UnauthorizedError();
    }
    const user = await this.authService.getProfile(req.authUser.userId);
    res.status(200).json({ user });
  }
}
