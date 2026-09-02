import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedUser, JwtPayload } from './auth.types.js';

interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(JwtService) private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.readBearerToken(request.headers.authorization);
    if (!token) this.throwUnauthorized();

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      if (!this.isValidPayload(payload)) this.throwUnauthorized();

      request.user = {
        id: payload.sub,
        username: payload.username,
        displayName: payload.displayName,
        role: payload.role,
      };
      return true;
    } catch {
      this.throwUnauthorized();
    }
  }

  private readBearerToken(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) return null;
    return authorization.slice('Bearer '.length).trim() || null;
  }

  private isValidPayload(payload: JwtPayload) {
    return Boolean(
      payload.sub
      && payload.username
      && payload.displayName
      && (payload.role === 'EXPERT' || payload.role === 'VIEWER'),
    );
  }

  private throwUnauthorized(): never {
    throw new UnauthorizedException({
      code: 'AUTH_REQUIRED',
      message: '请先登录或重新登录',
    });
  }
}
