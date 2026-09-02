export interface HealthResponse {
  status: 'ok';
  service: string;
  serverTime: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health');

  if (!response.ok) {
    throw new Error(`请求失败，HTTP 状态码：${response.status}`);
  }

  return response.json() as Promise<HealthResponse>;
}
