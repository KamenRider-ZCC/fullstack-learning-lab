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

function createHeaders(options: RequestInit, authenticated: boolean) {
  const headers = new Headers(options.headers);
  const token = getAccessToken();
  if (authenticated && token) headers.set('Authorization', `Bearer ${token}`);
  // FormData 的 multipart boundary 必须由浏览器生成，不能覆盖它的 Content-Type。
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

async function throwApiError(response: Response): Promise<never> {
  const data = await response.json().catch(() => ({})) as ErrorResponse;
  throw new ApiError(
    response.status,
    data.code || `HTTP_${response.status}`,
    data.message || '请求失败',
    data.details,
  );
}

export async function requestJson<T>(
  url: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: createHeaders(options, authenticated),
  });
  if (!response.ok) return throwApiError(response);
  return response.json() as Promise<T>;
}

export async function requestBlob(url: string): Promise<Blob> {
  const options: RequestInit = {};
  const response = await fetch(url, {
    headers: createHeaders(options, true),
  });
  if (!response.ok) return throwApiError(response);
  return response.blob();
}
