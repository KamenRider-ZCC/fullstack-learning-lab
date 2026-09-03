const MIN_TTL_SECONDS = 10;
const MAX_TTL_SECONDS = 60 * 60;

export function readPreviewUrlTtlSeconds() {
  const ttl = Number(process.env.PREVIEW_URL_TTL_SECONDS);
  if (!Number.isInteger(ttl) || ttl < MIN_TTL_SECONDS || ttl > MAX_TTL_SECONDS) {
    throw new Error(
      `PREVIEW_URL_TTL_SECONDS 必须是 ${MIN_TTL_SECONDS} 到 ${MAX_TTL_SECONDS} 之间的整数`,
    );
  }
  return ttl;
}
