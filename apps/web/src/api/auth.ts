import { requestJson } from './http';
import { clearAccessToken, getAccessToken, saveAccessToken } from './token';

export type UserRole = 'EXPERT' | 'VIEWER';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export async function login(username: string, password: string) {
  const result = await requestJson<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }, false);
  saveAccessToken(result.accessToken);
  return result.user;
}

export function hasStoredSession() {
  return Boolean(getAccessToken());
}

export function fetchCurrentUser() {
  return requestJson<AuthUser>('/api/auth/me');
}

export function logout() {
  clearAccessToken();
}
