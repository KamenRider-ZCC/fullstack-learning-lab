import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: options.quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const detail = options.quiet ? result.stderr.trim() : '';
    throw new Error(`${options.label ?? command} failed${detail ? `: ${detail}` : ''}`);
  }
  return options.quiet ? result.stdout.trim() : '';
}

export function runToFile(command, args, targetPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const output = createWriteStream(targetPath);
    const errors = [];

    child.stdout.pipe(output);
    child.stderr.on('data', (chunk) => errors.push(chunk));
    child.on('error', reject);
    output.on('error', reject);
    child.on('close', (code) => {
      output.end(() => {
        if (code === 0) {
          resolve();
          return;
        }
        const detail = Buffer.concat(errors).toString('utf8').trim();
        reject(new Error(`pg_dump failed${detail ? `: ${detail}` : ''}`));
      });
    });
  });
}

export async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function describeFile(filePath, baseDirectory) {
  const fileStat = await stat(filePath);
  return {
    path: path.relative(baseDirectory, filePath).replaceAll(path.sep, '/'),
    bytes: fileStat.size,
    sha256: await sha256(filePath),
  };
}

export function safePath(baseDirectory, relativePath) {
  const resolvedBase = path.resolve(baseDirectory);
  const resolvedFile = path.resolve(baseDirectory, relativePath);
  if (resolvedFile !== resolvedBase && !resolvedFile.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error(`Manifest contains an unsafe path: ${relativePath}`);
  }
  return resolvedFile;
}

function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const input = createReadStream(filePath);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('error', reject);
    input.on('end', () => resolve(hash.digest('hex')));
  });
}
