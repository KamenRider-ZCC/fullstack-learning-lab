export interface MinioConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
  publicPathPrefix: string;
  publicEndpoint: {
    endPoint: string;
    port: number;
    useSSL: boolean;
  };
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
    region: readRequired('MINIO_REGION'),
    publicPathPrefix: normalizePublicPathPrefix(
      process.env.MINIO_PUBLIC_PATH_PREFIX || '',
    ),
    publicEndpoint: parsePublicUrl(readRequired('MINIO_PUBLIC_URL')),
  };
}

export function normalizePublicPathPrefix(value: string) {
  const prefix = value.trim();
  if (!prefix) return '';
  if (
    !prefix.startsWith('/')
    || prefix.endsWith('/')
    || prefix.includes('//')
    || !/^\/[A-Za-z0-9._~/-]+$/.test(prefix)
    || prefix.split('/').includes('..')
  ) {
    throw new Error(
      'MINIO_PUBLIC_PATH_PREFIX 必须是以 / 开头、不以 / 结尾的安全路径',
    );
  }
  return prefix;
}

export function addPublicPathPrefix(value: string, prefix: string) {
  if (!prefix) return value;
  new URL(value);
  const authorityStart = value.indexOf('://') + 3;
  const pathStart = value.indexOf('/', authorityStart);
  if (pathStart >= 0) {
    return `${value.slice(0, pathStart)}${prefix}${value.slice(pathStart)}`;
  }
  const suffixStart = value.search(/[?#]/);
  const insertAt = suffixStart >= 0 ? suffixStart : value.length;
  return `${value.slice(0, insertAt)}${prefix}/${value.slice(insertAt)}`;
}

function parsePublicUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('MINIO_PUBLIC_URL 必须是完整的 http(s) 地址');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('MINIO_PUBLIC_URL 只支持 http 或 https');
  }
  if (
    url.pathname !== '/'
    || url.search
    || url.hash
    || url.username
    || url.password
  ) {
    throw new Error('MINIO_PUBLIC_URL 只能包含协议、主机和端口');
  }

  return {
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
    useSSL: url.protocol === 'https:',
  };
}

function readRequired(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少 ${name} 环境变量`);
  return value;
}
