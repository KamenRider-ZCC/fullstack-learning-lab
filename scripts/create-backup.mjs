import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  describeFile,
  listFiles,
  projectRoot,
  run,
  runToFile,
} from './backup-utils.mjs';

const production = process.argv.includes('--production');
const environment = production ? 'production' : 'development';
const composeArgs = production
  ? ['compose', '--env-file', '.env.production', '--file', 'compose.production.yaml']
  : ['compose', '--file', 'compose.yaml'];
const timestamp = new Date().toISOString().replaceAll(/[-:]/g, '').replace('.000', '');
const backupDirectory = path.join(projectRoot, 'backups', environment, timestamp);
const incompletePath = path.join(backupDirectory, 'INCOMPLETE');
const databasePath = path.join(backupDirectory, 'database.dump');

try {
  await mkdir(path.join(backupDirectory, 'minio'), { recursive: true });
  await writeFile(incompletePath, 'Backup did not finish. Do not use this directory for restore.\n');

  const config = JSON.parse(
    run('docker', [...composeArgs, 'config', '--format', 'json'], {
      quiet: true,
      label: 'Compose configuration check',
    }),
  );
  const postgres = config.services?.postgres?.environment;
  const minio = config.services?.minio?.environment;
  const api = config.services?.api?.environment;
  requireValue(postgres?.POSTGRES_USER, 'POSTGRES_USER');
  requireValue(postgres?.POSTGRES_DB, 'POSTGRES_DB');
  requireValue(minio?.MINIO_ROOT_USER, 'MINIO_ROOT_USER');
  requireValue(minio?.MINIO_ROOT_PASSWORD, 'MINIO_ROOT_PASSWORD');
  requireValue(api?.MINIO_BUCKET, 'MINIO_BUCKET');

  const postgresContainer = serviceContainer('postgres');
  const minioContainer = serviceContainer('minio');
  console.log(`[1/3] Exporting PostgreSQL from ${postgresContainer.slice(0, 12)} ...`);
  await runToFile(
    'docker',
    [
      ...composeArgs,
      'exec',
      '--no-TTY',
      'postgres',
      'pg_dump',
      '--username',
      postgres.POSTGRES_USER,
      '--dbname',
      postgres.POSTGRES_DB,
      '--format=custom',
      '--no-owner',
      '--no-privileges',
    ],
    databasePath,
  );

  console.log(`[2/3] Mirroring MinIO bucket ${api.MINIO_BUCKET} ...`);
  const sourceUrl = `http://${encodeURIComponent(minio.MINIO_ROOT_USER)}:${encodeURIComponent(minio.MINIO_ROOT_PASSWORD)}@127.0.0.1:9000`;
  run(
    'docker',
    [
      'run',
      '--rm',
      '--network',
      `container:${minioContainer}`,
      '--env',
      `MC_HOST_source=${sourceUrl}`,
      '--mount',
      `type=bind,source=${backupDirectory},target=/backup`,
      'minio/mc:RELEASE.2025-04-16T18-13-26Z',
      'mirror',
      '--overwrite',
      `source/${api.MINIO_BUCKET}`,
      '/backup/minio',
    ],
    { label: 'MinIO mirror' },
  );

  console.log('[3/3] Calculating SHA-256 checksums ...');
  const filePaths = (await listFiles(backupDirectory))
    .filter((filePath) => filePath !== incompletePath)
    .sort();
  const files = await Promise.all(
    filePaths.map((filePath) => describeFile(filePath, backupDirectory)),
  );
  const manifest = {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    environment,
    database: {
      engine: 'PostgreSQL',
      database: postgres.POSTGRES_DB,
      file: 'database.dump',
      format: 'custom',
    },
    objectStorage: {
      engine: 'MinIO',
      bucket: api.MINIO_BUCKET,
      directory: 'minio',
    },
    files,
  };
  await writeFile(
    path.join(backupDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await rm(incompletePath);

  console.log(`Backup completed: ${backupDirectory}`);
  console.log(`Files recorded in manifest: ${files.length}`);
} catch (error) {
  console.error(`Backup failed. Partial files remain at: ${backupDirectory}`);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function serviceContainer(service) {
  const container = run('docker', [...composeArgs, 'ps', '--quiet', service], {
    quiet: true,
    label: `${service} container lookup`,
  });
  if (!container) {
    throw new Error(
      `${service} is not running for the ${environment} Compose project. Start it before backup.`,
    );
  }
  return container.split(/\s+/)[0];
}

function requireValue(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} is missing from the resolved Compose configuration.`);
  }
}
