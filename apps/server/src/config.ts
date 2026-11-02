const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  port: num(process.env.PORT, 8080),
  databaseUrl: process.env.DATABASE_URL ?? '',
  /** Where the built web app lives. */
  webDist: process.env.WEB_DIST ?? new URL('../../web/dist/', import.meta.url).pathname,
  /** Public origin, e.g. https://ondevo.up.railway.app (used for CORS on the bucket and Origin checks). */
  publicOrigin: process.env.PUBLIC_ORIGIN ?? (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : ''),
  s3: {
    endpoint: process.env.ENDPOINT ?? process.env.S3_ENDPOINT ?? '',
    bucket: process.env.BUCKET ?? process.env.S3_BUCKET ?? '',
    region: process.env.REGION ?? process.env.S3_REGION ?? 'auto',
    accessKeyId: process.env.ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY ?? process.env.S3_SECRET_ACCESS_KEY ?? '',
    /** Railway buckets made before virtual-hosted URLs may need path style. */
    pathStyle: process.env.S3_PATH_STYLE === 'true',
  },
  /** Every shared file is deleted this many minutes after upload. */
  shareTtlMinutes: num(process.env.SHARE_TTL_MINUTES, 120),
  guestMaxBytes: num(process.env.GUEST_MAX_MB, 50) * 1024 * 1024,
  userMaxBytes: num(process.env.USER_MAX_MB, 200) * 1024 * 1024,
  sessionDays: num(process.env.SESSION_DAYS, 30),
  cleanupEveryMs: num(process.env.CLEANUP_EVERY_SECONDS, 300) * 1000,
  production: process.env.NODE_ENV === 'production',
};

export const storageReady = () => !!(config.s3.endpoint && config.s3.bucket && config.s3.accessKeyId && config.s3.secretAccessKey);
