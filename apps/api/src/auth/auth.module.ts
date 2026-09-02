import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

function readJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('缺少 JWT_SECRET 环境变量');
  return secret;
}

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: readJwtSecret(),
        signOptions: { expiresIn: 2 * 60 * 60 },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
