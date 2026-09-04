import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  describeFile,
  projectRoot,
  run,
  safePath,
} from './backup-utils.mjs';

try {
  const backupDirectory = process.argv[2]
    ? path.resolve(projectRoot, process.argv[2])
    : await findLatestBackup();
  const incompletePath = path.join(backupDirectory, 'INCOMPLETE');
  if (await exists(incompletePath)) {
    throw new Error('This backup has an INCOMPLETE marker and must not be restored.');
  }

  const manifestPath = path.join(backupDirectory, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.formatVersion !== 1 || !Array.isArray(manifest.files)) {
    throw new Error('Unsupported or malformed backup manifest.');
  }

  console.log(`[1/2] Checking ${manifest.files.length} file checksum(s) ...`);
  for (const expected of manifest.files) {
    if (
      typeof expected.path !== 'string' ||
      typeof expected.bytes !== 'number' ||
      typeof expected.sha256 !== 'string'
    ) {
      throw new Error('Manifest contains a malformed file entry.');
    }
    const filePath = safePath(backupDirectory, expected.path);
    const actual = await describeFile(filePath, backupDirectory);
    if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
      throw new Error(`Checksum mismatch: ${expected.path}`);
    }
  }

  const databaseRelativePath = manifest.database?.file;
  if (typeof databaseRelativePath !== 'string') {
    throw new Error('Database archive path is missing from the manifest.');
  }
  safePath(backupDirectory, databaseRelativePath);
  console.log('[2/2] Asking pg_restore to inspect the database archive ...');
  run(
    'docker',
    [
      'run',
      '--rm',
      '--mount',
      `type=bind,source=${backupDirectory},target=/backup,readonly`,
      'postgres:16-alpine',
      'pg_restore',
      '--list',
      `/backup/${databaseRelativePath.replaceAll('\\', '/')}`,
    ],
    { quiet: true, label: 'PostgreSQL archive validation' },
  );

  console.log(`Backup is readable and checksums match: ${backupDirectory}`);
  console.log('No database or object-storage data was changed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

async function findLatestBackup() {
  const backupRoot = path.join(projectRoot, 'backups');
  const candidates = [];
  for (const environment of ['development', 'production']) {
    const environmentDirectory = path.join(backupRoot, environment);
    if (!(await exists(environmentDirectory))) {
      continue;
    }
    for (const entry of await readdir(environmentDirectory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const directory = path.join(environmentDirectory, entry.name);
        if (await exists(path.join(directory, 'manifest.json'))) {
          candidates.push(directory);
        }
      }
    }
  }
  candidates.sort((left, right) =>
    path.basename(right).localeCompare(path.basename(left)),
  );
  if (candidates.length === 0) {
    throw new Error('No completed backup found. Run pnpm backup:create first.');
  }
  return candidates[0];
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
