# 第 6A 课：后端单元测试

前五课主要靠手工操作和命令验证功能。手工验证很重要，但每次修改后都重新登录、上传、断网、观察数据库，成本会越来越高。本课开始把稳定的业务规则交给测试程序自动检查。

这节只学习后端单元测试。测试不会连接真实 PostgreSQL 或 MinIO，也不会修改现有评分和 PDF。下一课再专门讲需要真实基础设施的 API 集成测试。

## 1. 本课完成了什么

- 使用 Vitest 作为测试运行器。
- 使用 NestJS `TestingModule` 创建隔离的测试容器。
- 用 Mock 代替 Prisma、文件存储和签名 URL 服务。
- 为文件名修复、密码摘要、TTL 配置和 `DocumentService` 编写测试。
- 根目录新增一次运行和监听运行命令。

运行：

```powershell
cd D:\projects\fullstack-learning-lab
pnpm test
```

当前结果应为：

```text
Test Files  4 passed (4)
Tests       20 passed (20)
```

## 2. 类型检查、构建和测试分别解决什么问题

三个命令不能互相替代：

| 命令 | 能发现什么 | 不能保证什么 |
| --- | --- | --- |
| `pnpm check` | 类型错误、缺少属性、错误参数类型 | 业务结果一定正确 |
| `pnpm build` | 源码能生成生产产物 | 每条权限和补偿规则正确 |
| `pnpm test` | 给定场景下行为符合预期 | 未编写用例的场景也正确 |

下面代码类型完全正确，但业务可能错：

```ts
const expiresAt = Date.now() + 300;
```

如果产品要求 300 秒，这里却只增加 300 毫秒。TypeScript 不知道业务含义，测试可以通过固定当前时间并断言结果来发现错误。

## 3. 单元、集成和端到端测试

### 单元测试

只测一个较小单元，外部依赖换成测试替身：

```text
DocumentService
  ├─ 假 Prisma
  ├─ 假 FileStorage
  └─ 假 TemporaryFileUrl
```

优点是快、稳定、失败位置明确。缺点是无法证明真实数据库、MinIO SDK 或 HTTP 路由配置一定正确。

### 集成测试

让多个真实组件合作，例如启动 NestJS 测试应用并连接专用 PostgreSQL、MinIO。它能发现 SQL、迁移、序列化、Guard 和 SDK 配置问题，但速度更慢，环境管理也更复杂。

### 端到端测试

从浏览器或完整客户端入口操作整个系统。它最接近用户，但失败原因可能跨越前端、后端、网络和基础设施，维护成本最高。

合理项目通常三种都需要，而不是只选择一种。数量通常是单元测试最多，集成测试其次，关键端到端测试最少。

## 4. 为什么第 6 课拆成 A、B、C

一次同时引入测试运行器、数据库隔离、MinIO 清理、HTTP 测试和 React 测试，会很难判断某段配置为什么存在。因此拆成：

1. 6A：先学测试语法、Mock 和业务单元。
2. 6B：再让真实 NestJS、测试数据库和 MinIO 一起运行。
3. 6C：最后学习 React 组件和用户交互测试。

本课刻意不启动基础设施，让你先看清“被测代码”和“测试替身”的关系。

## 5. 安装了哪些工具

`apps/api/package.json` 新增：

```json
{
  "devDependencies": {
    "@nestjs/testing": "...",
    "vitest": "..."
  }
}
```

- `vitest`：发现 `.spec.ts` 文件，执行用例，提供 `expect` 和 `vi.fn()`。
- `@nestjs/testing`：用与正式 NestJS 相同的依赖注入规则创建测试 Module。

它们是 `devDependencies`，因为只用于开发和测试，不是生产 API 运行所需依赖。

## 6. 测试文件放在哪里

本项目把测试放在被测文件旁边：

```text
document.service.ts
document.service.spec.ts
```

`.spec.ts` 表示规格测试。相邻放置便于修改业务时立即看到对应测试，也方便一起移动模块。

大型项目也可能集中放入 `test` 目录。两种都可以，关键是团队约定一致。

## 7. Vitest 配置

文件：`apps/api/vitest.config.ts`

```ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    clearMocks: true,
  },
});
```

- `environment: 'node'`：后端测试运行在 Node.js 环境，不需要浏览器 DOM。
- `include`：只发现 `src` 中以 `.spec.ts` 结尾的文件。
- `clearMocks`：每个用例之间清空 Mock 的调用记录，避免前一个用例影响后一个。

前端组件测试以后会使用模拟浏览器 DOM 的环境，与这里不同。

`apps/api/tsconfig.build.json` 还会在生产编译时排除 `*.spec.ts`。测试源码仍由 `pnpm check` 检查类型，但不会进入 `dist` 部署目录。

## 8. describe、it 和 expect

最小测试结构：

```ts
describe('normalizeMultipartFilename', () => {
  it('保留普通 ASCII 文件名', () => {
    expect(normalizeMultipartFilename('proposal.pdf')).toBe('proposal.pdf');
  });
});
```

- `describe`：把同一主题的用例分组。
- `it`：描述一个具体行为，名称应让人一眼看懂规则。
- `expect`：创建断言。
- `toBe`：要求基本值严格相等。

测试名称建议写“在什么条件下，应该得到什么结果”，不要只写“测试方法 1”。当 CI 失败时，用例名称就是第一条排错信息。

## 9. AAA：准备、执行、断言

测试通常分成三段：

```ts
// Arrange：准备输入
const mojibake = Buffer.from('投标文件.pdf', 'utf8').toString('latin1');

// Act + Assert：执行并检查结果
expect(normalizeMultipartFilename(mojibake)).toBe('投标文件.pdf');
```

复杂用例会把 Act 单独写出：

```ts
const result = await service.createPreviewUrl(documentId);

expect(result.expiresInSeconds).toBe(300);
```

空行用于视觉上分隔 AAA 三段，比给每一行都写注释更容易阅读。

## 10. 纯函数为什么最容易测试

文件：`document-filename.spec.ts`

`normalizeMultipartFilename()` 只依赖传入字符串，没有数据库、网络和当前时间。同样输入永远得到同样输出，因此测试简单稳定。

用例覆盖：

- ASCII 文件名保持不变。
- Latin-1 误解码的 UTF-8 中文能够恢复。
- 已经正常的中文保持不变。
- 无法安全恢复的 `café.pdf` 不被破坏。

最后一条很重要：测试不仅证明“修复成功”，也保护“不该修改的数据”。

## 11. it.each：同一规则测试多组输入

文件：`preview-url.config.spec.ts`

多个值都应触发相同错误时，可以写参数化测试：

```ts
it.each(['', '9', '60.5', '3601', 'not-a-number'])(
  '拒绝无效配置：%s',
  (value) => {
    // 每个 value 都会独立执行一次
  },
);
```

因此一个 `it.each` 代码块会在输出中计算为多个测试。本项目 4 个文件中实际显示 20 个用例。

## 12. 异步函数怎样测试

密码摘要使用异步 scrypt，因此测试也声明 `async`：

```ts
const encoded = await hashPassword('demo123456');

await expect(verifyPassword('demo123456', encoded)).resolves.toBe(true);
await expect(verifyPassword('wrong', encoded)).resolves.toBe(false);
```

这里验证的是安全性质，而不是某一个固定摘要：

- 摘要不包含明文密码。
- 正确密码通过。
- 错误密码失败。
- 相同密码因为随机盐而产生不同摘要。

如果断言固定摘要，随机盐每次变化就会让测试无意义地失败。

## 13. TestingModule 是什么

正式程序由 `AppModule` 创建所有 Controller、Service 和基础设施连接。单元测试不应该启动整套应用，而是只注册本次需要的 Provider：

```ts
moduleRef = await Test.createTestingModule({
  providers: [
    DocumentService,
    { provide: PrismaService, useValue: prisma },
    { provide: FILE_STORAGE, useValue: storage },
    { provide: TEMPORARY_FILE_URL, useValue: temporaryUrl },
  ],
}).compile();
```

这仍然使用 NestJS 依赖注入，所以可以发现 Token 配置和构造函数依赖问题；但注入的是测试创建的对象，不会连接真实服务。

`moduleRef.get(DocumentService)` 取得的 Service 已经完成依赖注入。

## 14. Mock 是什么

测试里的 Prisma 替身：

```ts
const prisma = {
  document: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
  },
};
```

`vi.fn()` 创建可控制、可观察的函数：

```ts
prisma.document.findUnique.mockResolvedValue(documentRecord);
expect(prisma.document.findUnique).toHaveBeenCalledWith({
  where: { id: 'document-1' },
});
```

第一行规定假查询返回什么，第二段检查被测代码怎样调用它。

日常交流中大家常把所有替身统称为 Mock。更严格的术语还有：

- Stub：预设返回值。
- Spy：记录真实或替代函数怎样被调用。
- Fake：能工作的简化实现，例如内存数据库。
- Mock：带有调用预期的替身。

初学阶段先掌握“用可控制依赖隔离外部系统”即可。

## 15. 为什么单元测试不能使用真实数据库

如果测试直接连接开发数据库：

- 可能误删或污染真实学习数据。
- 测试顺序会影响结果。
- 没启动 Docker 时测试无法运行。
- 网络或磁盘变慢会导致偶发失败。
- 很难稳定制造“数据库写入失败”场景。

本课用 `mockRejectedValue()` 一行就能稳定模拟数据库故障，并验证 MinIO 补偿删除逻辑。

这并不代表永远不测试真实数据库。真实连接放到第 6B 课的隔离集成环境中处理。

## 16. DocumentService 测了哪些业务规则

文件：`document.service.spec.ts`

### 16.1 列表不泄露 storageKey

数据库对象包含内部 `storageKey`，对外摘要不包含。测试保护 API 边界，避免以后直接返回 Prisma 对象时泄露内部字段。

### 16.2 缺少文件时立即拒绝

测试不仅检查抛出 `BadRequestException`，还检查 `storage.savePdf` 和数据库都没有被调用。这证明校验发生在副作用之前。

### 16.3 MIME 正确也可能是假 PDF

浏览器传来的 MIME 类型可以伪造。测试构造 `application/pdf`，但内容不以 `%PDF-` 开头，要求 Service 拒绝它。

### 16.4 上传顺序和元数据

测试要求：先由存储服务得到对象键，再用它创建数据库记录；同时确认乱码中文文件名被恢复。

### 16.5 数据库失败时清理对象

这是高价值异常路径：MinIO 保存成功、数据库写入失败时，必须删除刚创建的对象，避免孤儿文件。

### 16.6 临时 URL 的 TTL

测试固定当前时间，要求返回准确的五分钟过期时间，并确认传给签名服务的是数据库中的对象键，而不是前端输入。

### 16.7 文件不存在时不签名

数据库返回 `null` 时应抛出 `NotFoundException`，而且签名 Provider 不能被调用。

## 17. 为什么要固定时间

如果测试直接使用真实当前时间，执行断言时已经过去几毫秒，精确比较会失败。测试使用：

```ts
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-09-03T08:00:00.000Z'));
```

这样代码中的 `Date.now()` 会得到稳定值，预期过期时间可以精确写为 `08:05:00`。

用例结束后必须 `vi.useRealTimers()`，避免影响其他测试。

## 18. 环境变量也要隔离

`DocumentService` 创建时读取 `PREVIEW_URL_TTL_SECONDS`。测试使用：

```ts
vi.stubEnv('PREVIEW_URL_TTL_SECONDS', '300');
```

结束后执行 `vi.unstubAllEnvs()`。测试不能依赖开发者电脑碰巧存在某个 `.env` 值，否则换到 CI 就可能失败。

## 19. beforeEach 和 afterEach

- `beforeEach`：每个用例前创建全新的 Mock 和 TestingModule。
- `afterEach`：关闭 Module、恢复真实时间、恢复环境变量。

每个测试都应能单独运行，也不应依赖其他测试先执行。改变用例顺序仍然通过，才说明隔离基本正确。

## 20. 一次运行和监听模式

提交前运行一次：

```powershell
pnpm test
```

开发某个功能时使用监听模式：

```powershell
pnpm test:watch
```

监听模式不会自动结束。修改文件后 Vitest 会重跑相关测试，完成时按 `q` 或 `Ctrl+C` 退出。

CI 中必须使用一次运行的 `vitest run`，不能使用一直等待输入的监听模式。

## 21. 怎样阅读失败输出

失败时先看三处：

1. 哪个测试文件失败。
2. 哪个中文用例名称失败。
3. Expected 和 Received 有什么不同，以及堆栈指向哪一行。

不要一看到红色就立刻修改生产代码。先判断是代码违反规则，还是测试期望已经过时。产品规则真的改变时，生产代码、测试和文档应一起更新。

## 22. 什么是不好的测试

### 只为了覆盖率调用代码

没有明确断言的测试即使通过，也不能保护业务规则。

### 过度绑定内部实现

私有方法重命名不应导致所有测试失败。优先通过公开方法验证可观察结果。

### 一个用例验证十件不相关的事

失败后很难看出原因。一个用例最好围绕一个清晰行为。

### 使用真实用户数据

单元测试应使用明显的虚构 ID 和小型 Buffer，不读取你上传的真实 PDF。

### 失败后简单增加等待时间

单元测试通常不需要网络等待。偶发失败更可能来自共享状态、真实时间或未清理的依赖。

## 23. 建议亲手完成的实验

### 实验 A：制造一次失败

把文件名测试中的预期 `proposal.pdf` 临时改成 `wrong.pdf`，运行：

```powershell
pnpm test
```

观察 Expected、Received 和行号，然后恢复原值并再次运行。不要把故意失败的修改保留下来。

### 实验 B：破坏补偿逻辑

临时注释 `DocumentService` 中的 `storage.remove(storageKey)`，确认“数据库写入失败时删除对象”用例失败。恢复代码后应重新变绿。

### 实验 C：只运行一个文件

```powershell
pnpm --filter @fullstack-lab/api exec vitest run src/document/document.service.spec.ts
```

这样能在排查时缩小反馈范围。

## 24. 常见问题

### `vitest` 不是可识别的命令

先在根目录运行 `pnpm install`。不要全局安装 Vitest，项目应使用锁文件记录的版本。

### 测试提示缺少 `PREVIEW_URL_TTL_SECONDS`

确认测试在创建 `DocumentService` 之前执行了 `vi.stubEnv()`。单元测试不应依赖本地 `.env`。

### 测试一直不退出

可能误用了 `pnpm test:watch`，按 `q` 或 `Ctrl+C`；提交前使用 `pnpm test`。

### 单独通过、一起运行失败

通常表示用例共享了 Mock、时间、环境变量或其他全局状态。检查 `beforeEach` 和 `afterEach` 是否正确恢复。

### TypeScript 通过但测试失败

这正是测试的价值：类型正确只说明调用形式合法，不代表业务结果符合要求。

## 25. 本课涉及的文件

| 文件 | 作用 |
| --- | --- |
| `apps/api/vitest.config.ts` | 后端 Vitest 配置 |
| `apps/api/tsconfig.build.json` | 生产构建时排除测试源码 |
| `document-filename.spec.ts` | 中文文件名纯函数测试 |
| `preview-url.config.spec.ts` | TTL 环境变量参数化测试 |
| `password.spec.ts` | scrypt 密码摘要测试 |
| `document.service.spec.ts` | 使用 Nest TestingModule 的业务单元测试 |
| `apps/api/package.json` | API 测试命令和开发依赖 |
| 根目录 `package.json` | 工作区统一测试入口 |

## 26. 本课自测

先自己回答，再展开答案。

<details>
<summary>1. 为什么 TypeScript 检查不能替代单元测试？</summary>

TypeScript 检查数据形状和调用是否合法，不理解“签名必须五分钟过期”或“数据库失败要删除对象”等业务规则。
</details>

<details>
<summary>2. 为什么单元测试不连接开发数据库？</summary>

为了速度、稳定性、场景可控和数据安全。真实数据库协作由隔离的集成测试负责。
</details>

<details>
<summary>3. `mockResolvedValue` 和 `mockRejectedValue` 分别模拟什么？</summary>

前者模拟异步调用成功并返回值，后者模拟 Promise 拒绝，例如数据库故障。
</details>

<details>
<summary>4. 为什么要检查 `storage.remove` 是否被调用？</summary>

只检查上传 Promise 失败，无法证明已经写入 MinIO 的对象得到清理；调用断言保护补偿行为。
</details>

<details>
<summary>5. Mock 测试全部通过，能证明真实 MinIO 配置正确吗？</summary>

不能。Mock 只证明 `DocumentService` 按契约调用依赖。真实 SDK、网络和配置要由集成测试覆盖。
</details>

<details>
<summary>6. `beforeEach` 为什么重新创建依赖？</summary>

让每个用例从干净状态开始，避免调用次数、预设返回值和共享对象造成测试顺序依赖。
</details>

## 27. 本课完成标准

- `pnpm test` 显示 4 个文件、20 个用例通过。
- 不启动 PostgreSQL 和 MinIO，单元测试仍可运行。
- 你能解释 AAA、断言、Mock 和 TestingModule。
- 你能说出单元测试无法替代集成测试的原因。
- 你能读懂数据库故障补偿和临时 URL 两个测试。
- 你亲手制造过一次失败，并根据输出定位到断言。

达到这些标准后进入第 6B 课：为测试创建隔离的数据和对象，启动真实 NestJS HTTP 应用，验证 JWT、角色权限、上传与签名 URL 的完整后端链路。
