import { Inject, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser, JwtPayload, LoginResponse, UserRole } from './auth.types.js';
import { hashPassword, verifyPassword } from './password.js';

const DEMO_PASSWORD = 'demo123456';
const demoUsers: Array<{
  username: string;
  displayName: string;
  role: UserRole;
}> = [
  { username: 'expert', displayName: '演示评审专家', role: 'EXPERT' },
  { username: 'viewer', displayName: '演示查看用户', role: 'VIEWER' },
];

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    for (const demoUser of demoUsers) {
      const existing = await this.prisma.user.findUnique({
        where: { username: demoUser.username },
      });
      if (!existing) {
        await this.prisma.user.create({
          data: {
            ...demoUser,
            passwordHash: await hashPassword(DEMO_PASSWORD),
          },
        });
      }
    }
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    const passwordMatches = user
      ? await verifyPassword(password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: '用户名或密码错误',
      });
    }

    const publicUser = this.toAuthenticatedUser(user);
    const payload: JwtPayload = {
      sub: publicUser.id,
      username: publicUser.username,
      displayName: publicUser.displayName,
      role: publicUser.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: publicUser,
    };
  }

  private toAuthenticatedUser(user: User): AuthenticatedUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role as UserRole,
    };
  }
}
