import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // NestJS 依赖装饰器元数据识别 DTO；Vitest 默认的 esbuild 不会生成这些元数据。
  plugins: [swc.vite({ tsconfigFile: './tsconfig.json' })],
  test: {
    environment: 'node',
    include: ['src/**/*.integration.spec.ts'],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
