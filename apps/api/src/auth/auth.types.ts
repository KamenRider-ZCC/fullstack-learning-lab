export type UserRole = 'EXPERT' | 'VIEWER';

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}

export interface JwtPayload {
  sub: string;
  username: string;
  displayName: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
}
