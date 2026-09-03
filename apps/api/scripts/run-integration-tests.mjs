import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const composeFile = fileURLToPath(
  new URL('../../../compose.test.yaml', import.meta.url),
);
const pnpmCli = process.env.npm_execpath;

if (!pnpmCli) {
  throw new Error('请通过 pnpm test:integration 运行集成测试');
}

const testEnvironment = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: '0',
  DATABASE_URL:
    'postgresql://fullstack_test:fullstack_test_password@127.0.0.1:55432/fullstack_lab_test?schema=public',
  JWT_SECRET: 'integration-test-only-jwt-secret',
  MINIO_ENDPOINT: '127.0.0.1',
  MINIO_PORT: '59000',
  MINIO_USE_SSL: 'false',
  MINIO_ACCESS_KEY: 'minio_test',
  MINIO_SECRET_KEY: 'minio_test_password',
  MINIO_BUCKET: 'fullstack-documents-test',
  MINIO_REGION: 'us-east-1',
  MINIO_PUBLIC_URL: 'http://127.0.0.1:59000',
  PREVIEW_URL_TTL_SECONDS: '60',
};

let failed = false;

try {
  run('docker', ['compose', '--file', composeFile, 'up', '--detach', '--wait']);
  runPnpm(
    ['--filter', '@fullstack-lab/api', 'exec', 'prisma', 'migrate', 'deploy'],
    testEnvironment,
  );
  runPnpm(
    [
      '--filter',
      '@fullstack-lab/api',
      'run',
      'test:integration:only',
    ],
    testEnvironment,
  );
} catch (error) {
  failed = true;
  console.error(error instanceof Error ? error.message : error);
} finally {
  try {
    // compose.test.yaml 使用独立项目名和临时文件系统，只清理测试资源。
    run('docker', [
      'compose',
      '--file',
      composeFile,
      'down',
      '--volumes',
      '--remove-orphans',
    ]);
  } catch (error) {
    failed = true;
    console.error('测试基础设施清理失败：', error);
  }
}

if (failed) process.exitCode = 1;

function runPnpm(args, env) {
  run(process.execPath, [pnpmCli, ...args], env);
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} 执行失败，退出码：${result.status}`);
  }
}
