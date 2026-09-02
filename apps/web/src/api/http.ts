import { getAccessToken } from './token';

interface ErrorResponse {
  code?: string;
  message?: string;
  details?: string[];
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: string[] = [],
  ) {
    super(`[${code}] ${message}`);
  }
}

export async function requestJson<T>(
  url: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getAccessToken();
  if (authenticated && token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json() as T & ErrorResponse;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.code || `HTTP_${response.status}`,
      data.message || '请求失败',
      data.details,
    );
  }
  return data;
}
