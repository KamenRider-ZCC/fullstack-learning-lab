# 第 6B 课：API 集成测试与隔离基础设施

第 6A 课用 Mock 隔离了 PostgreSQL、MinIO 和 HTTP。本课反过来：启动真正的 NestJS 应用、PostgreSQL 和 MinIO，通过真实 HTTP 请求验证这些组件能否正确协作。

最重要的前提是数据隔离。集成测试绝不能把测试评分和测试 PDF 写进你的开发数据库，更不能清理用户真实上传的文件。

## 1. 本课完成了什么

- 使用单独的 Docker Compose 文件启动测试 PostgreSQL 和 MinIO。
- 测试服务使用独立端口、账号、数据库名和 Bucket。
- 每次测试前对空数据库执行真实 Prisma 迁移。
- 使用 NestJS `TestingModule` 启动完整 `AppModule`。
- 使用 Supertest 发送真实 HTTP 请求。
- 验证 JWT、角色、ValidationPipe、数据库、multipart、MinIO 和签名 URL。
- 无论测试通过还是失败，都自动清理测试容器和临时数据。

运行：

```powershell
cd D:\projects\fullstack-learning-lab
pnpm test:integration
```

当前结果：1 个集成测试文件、6 个场景通过。

## 2. 为什么单元测试通过还不够

第 6A 课的 `DocumentService` 测试把依赖替换成 Mock：

```text
DocumentService → 假 Prisma
                → 假 MinIO
                → 假签名服务
```

它能证明业务代码按照约定调用依赖，却不能证明：

- Prisma 迁移真的能在空 PostgreSQL 上执行。
- NestJS 路由、Guard 和拦截器顺序正确。
- ValidationPipe 真的识别了 DTO。
- Multer 能从 multipart 请求中读取 Buffer。
- MinIO SDK 的账号、端口、Bucket 和签名配置正确。
- 浏览器拿到的 URL 真的可以下载 PDF。

集成测试覆盖的正是这些组件之间的接缝。

## 3. 为什么不能直接连接开发环境

假设集成测试直接使用开发数据库 5432 和开发 MinIO 9000：

1. 测试上传会出现在正常文件列表中。
2. 重复执行会累积垃圾记录和对象。
3. 清理脚本写错条件可能删除真实 PDF。
4. 测试依赖你当前数据库中已有的数据，换一台电脑就失败。
5. 多个人或 CI 同时运行时会互相影响。

因此，本项目把环境硬性分开：

| 资源 | 开发环境 | 集成测试环境 |
| --- | --- | --- |
| Compose 项目名 | `fullstack-learning-lab` | `fullstack-learning-lab-test` |
| PostgreSQL 端口 | 5432 | 55432 |
| 数据库名 | `fullstack_lab` | `fullstack_lab_test` |
| MinIO API 端口 | 9000 | 59000 |
| MinIO Console 端口 | 9001 | 59001 |
| Bucket | `fullstack-documents` | `fullstack-documents-test` |
| 数据位置 | Docker Volume | tmpfs 临时内存 |

测试账号和端口只绑定 `127.0.0.1`，不会主动暴露到局域网。

## 4. compose.test.yaml 逐段理解

文件：`compose.test.yaml`

它与开发用 `compose.yaml` 完全分开，并声明：

```yaml
name: fullstack-learning-lab-test
```

Compose 项目名决定容器和网络属于哪个集合。清理 `fullstack-learning-lab-test` 不会匹配开发项目。

测试数据库使用：

```yaml
ports:
  - "127.0.0.1:55432:5432"
tmpfs:
  - /var/lib/postgresql/data
```

左侧 55432 是 Windows 主机端口，右侧 5432 是容器内部端口。`tmpfs` 表示数据库文件只存在内存中，容器删除后数据自然消失。

测试 MinIO 同样把 `/data` 放进 tmpfs，因此测试 PDF 不会进入开发 Volume。

## 5. healthcheck 和 --wait

“容器已经启动”不等于“服务已经能接受请求”。PostgreSQL 可能还在初始化数据库，MinIO 也可能还没监听完成。

两个测试服务都配置 healthcheck。运行器使用：

```text
docker compose ... up --detach --wait
```

- `--detach`：容器在后台运行。
- `--wait`：等待带健康检查的服务变为 healthy。

只有二者健康后才执行 Prisma 迁移，避免用固定 `sleep 5` 猜测启动时间。

## 6. 为什么测试前执行 migrate deploy

每次测试数据库都是空的，需要根据 `prisma/migrations` 创建表：

```text
prisma migrate deploy
```

它只应用仓库中已经存在的迁移，不会交互式询问，也不会根据 schema 临时生成迁移，适合自动化测试和部署。

开发时设计新表通常使用 `prisma migrate dev`；测试和生产部署已有迁移使用 `prisma migrate deploy`。两者目的不同。

如果迁移文件本身有错误，集成测试会在真正执行用例前失败。这是重要保护，而 Mock 单元测试发现不了。

## 7. 一条命令如何编排完整生命周期

文件：`apps/api/scripts/run-integration-tests.mjs`

根命令：

```powershell
pnpm test:integration
```

内部按顺序执行：

```text
1. 启动并等待测试 PostgreSQL、MinIO
2. 向测试数据库执行 Prisma 迁移
3. 注入测试环境变量并运行 Vitest
4. 在 finally 中销毁测试容器、网络和临时数据
```

`finally` 表示无论测试通过还是抛出错误，都尝试执行清理。这就是第一次测试有一个场景失败时，容器仍然全部被删除的原因。

如果直接关闭电脑、强制结束 Docker 或杀死 Node 进程，`finally` 来不及运行，可以手动清理：

```powershell
docker compose --file compose.test.yaml down --volumes --remove-orphans
```

这个命令只针对测试 Compose 文件。不要把文件名省略后再添加 `--volumes`，否则可能删除开发环境 Volume。

## 8. 测试环境变量怎样覆盖开发配置

运行脚本为子进程显式传入：

```text
DATABASE_URL=...127.0.0.1:55432/fullstack_lab_test
MINIO_PORT=59000
MINIO_BUCKET=fullstack-documents-test
MINIO_PUBLIC_URL=http://127.0.0.1:59000
PREVIEW_URL_TTL_SECONDS=60
```

即使 Prisma 输出“Environment variables loaded from .env”，当前进程已经存在的测试变量仍然优先，因此实际输出必须显示 55432 和 `fullstack_lab_test`。

运行器不会修改开发 `.env`，避免测试结束后忘记切回配置。

## 9. 为什么测试签名 URL 只设 60 秒

开发页面仍使用 300 秒。集成测试使用 60 秒是为了证明环境配置确实被替换，同时减少测试凭证存活时间。

测试不会真的等待 60 秒，而是同时检查 API 返回值和 URL 中的 `X-Amz-Expires=60`。

## 10. 启动完整 NestJS 应用

测试文件：`document-api.integration.spec.ts`

核心代码：

```ts
moduleRef = await Test.createTestingModule({
  imports: [AppModule],
}).compile();

app = moduleRef.createNestApplication();
configureHttpApp(app);
await app.init();
```

与第 6A 课不同，这里导入完整 `AppModule`，所以使用真实 Prisma、Auth、Review、Document 和 MinIO Provider。

`app.init()` 会触发 NestJS 生命周期：

- `AuthService` 创建测试库中的 expert 和 viewer。
- `ReviewService` 创建演示评审项。
- `MinioFileStorageService` 创建测试 Bucket。

这些写入全部落在临时测试环境。

## 11. 为什么抽出 configureHttpApp

以前全局前缀、ValidationPipe 和异常过滤器直接写在 `main.ts`。测试如果忘记复制其中某一项，就会出现“测试环境与正式启动方式不同”。

现在由：

```text
apps/api/src/configure-http-app.ts
```

集中配置：

- `/api` 全局前缀。
- DTO 转换与白名单。
- 禁止多余字段。
- 统一异常响应。

正式 `main.ts` 和集成测试调用同一个函数。这样生产配置变化时，测试更不容易悄悄落后。

`enableShutdownHooks()` 仍只在正式进程中调用，因为测试会主动执行 `app.close()`。

## 12. Supertest 为什么不占用 3000 端口

调用方式：

```ts
request(app.getHttpServer())
  .get('/api/documents')
  .expect(401);
```

Supertest 可以直接向 NestJS 创建的 HTTP Server 发送请求，不必调用 `app.listen(3000)`。好处是：

- 不与正在运行的开发后端抢占 3000。
- 不需要寻找随机端口。
- 请求仍然经过真正的路由、Guard、Pipe、Interceptor 和 Filter。

它不是在直接调用 Controller 方法，因此比 Controller 单元测试覆盖更多框架行为。

## 13. 六个场景分别保护什么

### 13.1 健康检查

请求 `/api/health` 返回 200，证明完整 AppModule 能启动并经过 HTTP 层。

### 13.2 未登录读取文件列表

不携带 Authorization 请求 `/api/documents`，要求 401 和 `AUTH_REQUIRED`，同时验证统一错误格式及 path。

### 13.3 查看角色上传

viewer 使用真实账号登录并上传 multipart，请求必须在角色 Guard 阶段返回 403。

### 13.4 伪 PDF

expert 上传 MIME 为 `application/pdf`、内容却不是 `%PDF-` 的文件，要求返回 `UNSUPPORTED_FILE_TYPE`。这同时覆盖 Multer 到 Service 的 Buffer 链路。

### 13.5 评分身份防伪造

请求体故意增加 `expertId`，ValidationPipe 必须返回 `VALIDATION_ERROR`。移除伪造字段后合法评分写进测试 PostgreSQL；viewer 再尝试评分仍应返回 403。

### 13.6 上传与签名预览

expert 上传合成 PDF，测试确认：

1. PostgreSQL 返回文件元数据。
2. viewer 可以在列表看到文件，但看不到 `storageKey`。
3. 签名 URL 指向 59000 测试 MinIO。
4. URL 有效期是 60 秒。
5. 直接请求 URL 得到完全相同的 PDF 字节。
6. 修改签名一个字符后，MinIO 返回 403。

这是本课最长的场景，因为它验证一条完整业务链路。

## 14. 测试为什么使用合成 PDF

测试 Buffer 只有几十字节，并以 `%PDF-` 开头。它足以验证当前系统的文件签名规则和二进制传输，不需要读取真实投标文件。

自动化测试数据应当：

- 明显是虚构内容。
- 尽量小，运行快。
- 能在代码中稳定重建。
- 不包含客户文件、Token 或个人信息。

## 15. 第一次失败教会了什么

第一次执行时有 5 个场景通过，但额外 `expertId` 意外返回 200。生产代码没有缺少 ValidationPipe，问题来自测试编译器。

NestJS 依赖 TypeScript 装饰器元数据识别 Controller 参数的 DTO 类型。Vitest 默认使用 esbuild 转换 TypeScript，而 esbuild 没有生成 NestJS 需要的 `emitDecoratorMetadata` 信息，于是 ValidationPipe 看不到 `SaveScoreDto`。

集成测试配置加入 SWC：

```ts
plugins: [swc.vite({ tsconfigFile: './tsconfig.json' })]
```

SWC 按项目 tsconfig 保留装饰器和元数据。重新执行后，6 个场景全部通过。

这个例子说明：测试工具链也可能制造与生产不同的行为。遇到失败应根据证据定位，不能为了让测试变绿就把正确的安全断言删掉。

## 16. 单元测试和集成测试怎样配合

| 规则 | 单元测试 | 集成测试 |
| --- | --- | --- |
| 数据库失败后删除孤儿对象 | 容易精确模拟 | 很难稳定制造 |
| 乱码文件名纯函数 | 快速覆盖多组输入 | 没必要走完整 HTTP |
| Guard 返回真实 401/403 | Mock 无法完整证明 | 非常适合 |
| Prisma 迁移可执行 | 无法证明 | 可以证明 |
| MinIO 签名真的可下载 | Mock 只能验证调用 | 必须真实连接 |

同一功能可能同时需要两层测试，但每一层选择最有价值的断言。

## 17. 常用测试命令

只运行快速单元测试：

```powershell
pnpm test
```

只运行真实 API 集成测试：

```powershell
pnpm test:integration
```

依次运行两者：

```powershell
pnpm test:all
```

不要直接运行内部命令 `test:integration:only`。它假设测试容器、迁移和所有环境变量已经由外层脚本准备好。

## 18. 怎样确认没有碰开发数据

运行测试时观察 Prisma 输出：

```text
PostgreSQL database "fullstack_lab_test" at "127.0.0.1:55432"
```

观察签名 URL 的断言目标：

```text
127.0.0.1:59000
```

结束后执行：

```powershell
docker compose ps
docker compose --file compose.test.yaml ps
```

第一个命令仍能看到开发 postgres 和 minio；第二个命令不应留下测试容器。

## 19. 常见故障排查

### Docker Desktop 没启动

`pnpm test:integration` 会在第一步失败。启动 Docker Desktop 后重试。单元测试 `pnpm test` 不需要 Docker。

### 55432、59000 或 59001 被占用

检查：

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object LocalPort -in 55432,59000,59001 |
  Select-Object LocalPort,OwningProcess
```

如果是上次强制中断留下的测试容器，运行测试 Compose 清理命令。

### Prisma 输出连接 5432

这表示测试环境变量没有正确传给迁移进程，应立即停止，不能让集成测试继续使用开发数据库。正常输出必须是 55432 和 `fullstack_lab_test`。

### DTO 多余字段返回 200

确认 `vitest.integration.config.ts` 使用 `unplugin-swc`，并且 tsconfig 中启用了 `experimentalDecorators` 与 `emitDecoratorMetadata`。

### 测试失败后仍有容器

正常断言失败会进入 `finally` 自动清理。只有进程被强制终止时可能残留，使用明确的 `compose.test.yaml` 手动清理。

### 签名 URL 返回 403

确认测试环境的 `MINIO_PUBLIC_URL` 指向 59000，并检查电脑系统时间是否准确。测试还会故意发送一次篡改签名的请求，那一次 403 是预期行为。

## 20. 本课涉及的文件

| 文件 | 作用 |
| --- | --- |
| `compose.test.yaml` | 隔离的测试 PostgreSQL 和 MinIO |
| `apps/api/scripts/run-integration-tests.mjs` | 编排启动、迁移、测试和清理 |
| `apps/api/vitest.integration.config.ts` | 集成测试发现规则、超时和 SWC 配置 |
| `document-api.integration.spec.ts` | 六个真实 API 场景 |
| `apps/api/src/configure-http-app.ts` | 正式服务和测试复用 HTTP 全局配置 |
| `apps/api/src/main.ts` | 调用共享配置并监听正式端口 |

## 21. 建议亲手完成的实验

### 实验 A：观察完整生命周期

运行 `pnpm test:integration`，按输出找到容器创建、healthy、三次迁移、六个测试和容器移除五组信息。

### 实验 B：确认端口隔离

在测试运行期间另开终端执行：

```powershell
docker ps
```

对照开发和测试端口。测试结束后再次执行，确认只剩开发容器。

### 实验 C：制造迁移失败

不要修改已有迁移。只阅读运行器中的执行顺序，思考如果迁移失败，为什么 Vitest 不应该继续，以及 finally 为什么仍要清理容器。

## 22. 本课自测

<details>
<summary>1. 为什么测试数据库不能与开发数据库共用？</summary>

测试需要自由创建和清理数据，共用会污染甚至误删开发数据，也会让测试结果依赖已有状态。
</details>

<details>
<summary>2. Supertest 不监听 3000，为什么仍算 HTTP 测试？</summary>

它直接向 NestJS 创建的 HTTP Server 发送请求，请求仍经过路由、Guard、Pipe、Interceptor 和 Filter，只是不经过固定外部端口。
</details>

<details>
<summary>3. 为什么集成测试使用 migrate deploy？</summary>

测试应验证仓库已有迁移能在空库按顺序执行，不应交互式生成新迁移。
</details>

<details>
<summary>4. tmpfs 有什么作用？</summary>

数据库和对象写在内存临时文件系统中，容器销毁后数据消失，不会形成持久测试垃圾。
</details>

<details>
<summary>5. 为什么需要 SWC？</summary>

NestJS 的 DTO 识别依赖装饰器元数据；Vitest 默认转换器没有生成这些信息，SWC 按 tsconfig 保留它们。
</details>

<details>
<summary>6. 为什么 finally 很重要？</summary>

断言失败也必须释放容器、网络和临时端口，否则下一次测试可能被残留环境影响。
</details>

## 23. 本课完成标准

- `pnpm test:integration` 显示 1 个文件、6 个场景通过。
- 输出明确连接 `fullstack_lab_test@127.0.0.1:55432`。
- 测试签名 URL 指向 59000，而不是开发 MinIO 的 9000。
- 测试失败时也会执行测试容器清理。
- 开发 PostgreSQL、MinIO 和已有 PDF 不受影响。
- 你能解释 Mock 单元测试与真实集成测试各自负责什么。
- 你能说明装饰器元数据缺失为什么会让 DTO 校验失效。

达到这些标准后进入第 6C 课：使用模拟 DOM 渲染 React 组件，通过用户视角验证登录、角色按钮、文件列表和短期预览交互。
