export interface MinioConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export function readMinioConfig(): MinioConfig {
  const port = Number(readRequired('MINIO_PORT'));
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('MINIO_PORT 必须是有效端口号');
  }

  return {
    endPoint: readRequired('MINIO_ENDPOINT'),
    port,
    useSSL: readRequired('MINIO_USE_SSL') === 'true',
    accessKey: readRequired('MINIO_ACCESS_KEY'),
    secretKey: readRequired('MINIO_SECRET_KEY'),
    bucket: readRequired('MINIO_BUCKET'),
  };
}

function readRequired(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少 ${name} 环境变量`);
  return value;
}
