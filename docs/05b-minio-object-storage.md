# 第 5B 课：使用 MinIO 对象存储 PDF

这节课把第 5A 课保存在后端本地目录中的 PDF，改为保存到独立的 MinIO 服务。上传、权限和预览页面基本不变，但文件不再依附某一台后端服务器的磁盘。

> 课程演进说明：完成第 5C 课后，当前页面已改用短期签名 URL 直连 MinIO。第 5B 课的 `/documents/:id/content` 流式接口仍保留，用于对比“后端中转”和“浏览器直连”两种方案。

完成本课后，你应该能回答：对象存储解决什么问题、Bucket 和对象键是什么、为什么数据库仍然需要 `Document` 表、NestJS 如何切换存储实现，以及旧文件如何安全迁移。

## 1. 先看最终数据流

上传时：

```text
浏览器 FormData
  → POST /api/documents（携带 JWT）
  → DocumentController 接收 multipart 文件
  → DocumentService 校验 PDF
  → MinioFileStorageService 把字节写入 MinIO
  → Prisma 把文件元数据写入 PostgreSQL
```

预览时：

```text
浏览器携带 JWT 请求文件
  → GET /api/documents/:id/content
  → Prisma 根据文档 ID 查询 storageKey
  → MinIO 根据 Bucket + storageKey 返回可读流
  → NestJS 把流传给浏览器
  → 浏览器生成 Blob URL 并放进 iframe
```

这里有三类职责：

| 组件 | 保存或处理什么 | 本地端口 |
| --- | --- | --- |
| PostgreSQL | 文件名、对象键、大小、上传者等元数据 | 5432 |
| MinIO API | 真正的 PDF 字节，供后端 SDK 调用 | 9000 |
| MinIO Console | 给开发者查看 Bucket 和对象的管理网页 | 9001 |

端口 9000 和 9001 最容易混淆。后端连接 9000；你在浏览器中打开 9001。

## 2. 为什么不继续使用后端本地目录

本地磁盘很适合第 5A 课，因为它能用最少概念讲清上传链路。但正式系统常有多个后端实例：

```text
请求 1 → 后端 A → 文件只写在 A 的磁盘
请求 2 → 后端 B → B 的磁盘找不到该文件
```

如果所有后端都连接同一个对象存储，请求落到 A 或 B 都能读到相同文件。对象存储还便于做容量扩展、生命周期管理、权限控制和云服务迁移。

对象存储并不是数据库的替代品。数据库擅长按业务关系查询，例如“谁在什么时候上传了什么文件”；MinIO 擅长保存大量二进制内容。两者通过 `storageKey` 关联。

## 3. Bucket 和对象键

本项目的 Bucket 名称是：

```text
fullstack-documents
```

新文件的对象键类似：

```text
documents/2026/2bf47d2b-xxxx-xxxx-xxxx-0dd01ab3a75d.pdf
```

组合起来可以理解为：

```text
Bucket: fullstack-documents
Key:    documents/2026/<随机 UUID>.pdf
```

对象键使用 UUID，而不是原始文件名，主要是为了避免同名覆盖和特殊字符问题。原始中文文件名仍保存在 PostgreSQL，展示和下载时再从数据库读取。

对象键中的 `/` 让 Console 看起来像目录，但对对象存储来说，整个字符串才是对象的唯一名称。

## 4. Docker Compose 启动了什么

文件：`compose.yaml`

```yaml
minio:
  image: minio/minio:RELEASE.2025-04-22T22-12-26Z
  command: server /data --console-address ":9001"
  ports:
    - "9000:9000"
    - "9001:9001"
  volumes:
    - minio-data:/data
```

- `image`：MinIO 程序及其运行环境。
- `command`：用 `/data` 保存对象，并让管理网页监听 9001。
- `ports`：把容器端口映射到本机。
- `volumes`：把 `/data` 放进 Docker 管理的持久化空间。

容器可以删掉再创建，而 Volume 中的数据仍能保留。注意：`docker compose down` 默认不删除 Volume；`docker compose down -v` 会删除它，本项目有真实学习文件时不要随意加 `-v`。

启动基础设施：

```powershell
cd D:\projects\fullstack-learning-lab
pnpm infra:up
docker compose ps
```

打开 `http://localhost:9001`，本地学习环境账号为：

```text
用户名：minioadmin
密码：minioadmin123
```

这只是本机学习凭据，正式环境必须换成密钥管理系统提供的强凭据，不能提交真实密钥。

## 5. 环境变量为什么要分开配置

文件：`apps/api/.env`

```dotenv
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=fullstack-documents
```

源码只描述“怎样连接”，具体地址和凭据交给环境变量。这样开发、测试和生产可以使用同一份代码、不同配置。

当前 NestJS 在 Windows 本机运行，所以 `MINIO_ENDPOINT` 是 `127.0.0.1`。以后 NestJS 也放进 Compose 后，容器中的 `127.0.0.1` 只代表后端容器自己，应改为 Compose 服务名：

```dotenv
MINIO_ENDPOINT=minio
```

可以把服务名 `minio` 理解为 Docker 内部网络中的主机名。

## 6. 配置读取代码

文件：`apps/api/src/document/minio.config.ts`

`readMinioConfig()` 把字符串环境变量转换成 MinIO SDK 所需配置，并在缺少配置时尽早抛错。

环境变量本质上全是字符串，因此端口需要 `Number()`，SSL 开关需要与字符串 `'true'` 比较。这里选择启动时报错，而不是等第一次上传才发现配置缺失。

## 7. 用接口隔离具体存储方式

文件：`apps/api/src/document/file-storage.port.ts`

```ts
export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface FileStoragePort {
  savePdf(content: Buffer): Promise<string>;
  getObject(storageKey: string): Promise<Readable>;
  remove(storageKey: string): Promise<void>;
}
```

`DocumentService` 真正需要的不是“MinIO”，而是三种能力：保存 PDF、读取对象、删除对象。`FileStoragePort` 把这些能力定义成契约。

这里同时出现 `Symbol` 和 `interface`，是因为 TypeScript 的接口编译后不存在，NestJS 运行时无法拿它当依赖注入 Token。`FILE_STORAGE` 是运行时存在的唯一标识，`FileStoragePort` 则负责 TypeScript 类型检查。

第 5A 课的 `LocalFileStorageService` 和本课的 `MinioFileStorageService` 都实现同一契约。因此业务 Service 不需要知道文件最终写到哪里。

## 8. NestJS 怎样选择 MinIO 实现

文件：`apps/api/src/document/document.module.ts`

核心 Provider 配置等价于：

```ts
{
  provide: FILE_STORAGE,
  useExisting: MinioFileStorageService,
}
```

它是在告诉 NestJS：有代码请求 `FILE_STORAGE` 时，请提供已经创建好的 `MinioFileStorageService`。

随后 `DocumentService` 只注入抽象能力：

```ts
constructor(
  private readonly prisma: PrismaService,
  @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
) {}
```

以后换成云厂商 S3 时，可以新增 `S3FileStorageService` 并修改 Module 映射，上传和预览的业务规则不必重写。这叫依赖倒置：高层业务依赖稳定契约，而不是依赖某个具体基础设施。

## 9. MinIO Service 逐段理解

文件：`apps/api/src/document/minio-file-storage.service.ts`

### 9.1 创建客户端

`new Client(...)` 创建的是 SDK 客户端对象，不会启动一个新的 MinIO 服务。真正的服务运行在 Docker 容器中，客户端只是通过 HTTP 与 9000 端口通信。

### 9.2 启动时确保 Bucket 存在

`onModuleInit()` 是 NestJS 生命周期钩子。Module 初始化时，它调用 `ensureBucket()`：

- Bucket 已存在：直接继续。
- Bucket 不存在：创建 Bucket。
- 多个后端实例同时创建：再次确认最终是否已存在。

因此新同事第一次启动项目时不必手动进入 Console 创建 Bucket。

### 9.3 保存对象

`savePdf()` 先生成按年份组织的 UUID 对象键，再调用 `putObject()`。返回值是对象键，之后由 `DocumentService` 写入数据库。

### 9.4 删除补偿

上传是两个系统参与的操作：先写 MinIO，再写 PostgreSQL。如果 MinIO 成功但数据库失败，就会留下没有元数据指向的“孤儿对象”。因此 `DocumentService` 捕获数据库错误，并调用 `remove(storageKey)` 做补偿删除。

这不是完整的分布式事务，但对当前学习项目是清晰实用的处理方式。

## 10. 为什么预览使用 Stream

MinIO SDK 的 `getObject()` 返回 Node.js `Readable`。Controller 再使用 NestJS `StreamableFile` 将它写入 HTTP 响应。

如果先把 500 MB 文件全部读成 Buffer，后端内存要先容纳整个文件；流可以边从 MinIO 读取、边传给浏览器。当前演示限制为 10 MB，但仍使用流，是为了学习更接近正式系统的写法。

Controller 还设置了：

```text
Content-Type: application/pdf
Content-Length: 数据库中的文件大小
Content-Disposition: inline; filename*=UTF-8''...
```

`inline` 表示浏览器可以直接预览；`filename*` 用 UTF-8 编码保留中文文件名。

浏览器端仍先通过带 JWT 的 `fetch` 获取 Blob，再生成临时对象 URL。不能把受保护接口地址直接写进 iframe，因为普通 iframe 请求不方便附加 `Authorization` 请求头。

## 11. 旧文件迁移为什么单独写脚本

文件：`apps/api/src/scripts/migrate-local-files-to-minio.ts`

修改存储代码只会影响新请求，不会自动搬运第 5A 课已经存在的文件。迁移脚本会：

1. 查询所有 `Document` 元数据。
2. 检查同名对象是否已经在 MinIO 中。
3. 不存在时，从 `storage/uploads` 读取旧文件并上传。
4. 已存在且大小一致时跳过。
5. 已存在但大小不一致时停止，避免悄悄覆盖异常数据。
6. 保留所有本地文件，便于确认和回退。

执行：

```powershell
pnpm storage:migrate-local
```

脚本是幂等的：相同输入重复执行，最终结果不变。第一次可能显示“复制 2 个”，第二次应显示“跳过 2 个”，而不是重复上传或报错。

脚本还会修复早期 multipart 上传中出现的中文文件名乱码。它只修改确认可恢复的文件名，不改变 PDF 内容。

## 12. 本课保留了哪些旧代码

`LocalFileStorageService` 没有被 Module 注入，当前运行时不会使用它。保留它是为了让你对照两个实现：

| 能力 | 本地实现 | MinIO 实现 |
| --- | --- | --- |
| 保存 | `writeFile` | `putObject` |
| 读取 | `createReadStream` | `getObject` |
| 删除 | `unlink` | `removeObject` |

二者实现同一个 `FileStoragePort`，正好展示抽象的价值。学习完成后是否删除本地实现，不影响当前 MinIO 方案。

## 13. 按顺序运行和观察

```powershell
cd D:\projects\fullstack-learning-lab
pnpm infra:up
pnpm db:migrate
pnpm storage:migrate-local
pnpm dev
```

然后完成以下观察：

1. 打开 `http://localhost:5173`。
2. 使用 `expert / demo123456` 登录并上传一个小 PDF。
3. 打开 `http://localhost:9001`，进入 `fullstack-documents` Bucket。
4. 找到 `documents/2026/...pdf` 对象。
5. 运行 `pnpm db:studio`，查看 `Document.storageKey`。
6. 回到前端点击“鉴权预览”。
7. 用 `viewer / demo123456` 登录，确认能预览但不能上传。

观察重点是：MinIO 看到的是随机对象键，页面显示的是数据库里的原始文件名。

## 14. 建议你亲手做的三个实验

### 实验 A：停止 MinIO

```powershell
docker compose stop minio
```

此时数据库列表仍可能查到，但上传或预览会失败。这证明“元数据存在”不等于“文件服务可用”。实验后执行：

```powershell
docker compose start minio
```

### 实验 B：切换 Provider

阅读 `document.module.ts`，尝试解释为什么只修改 Provider 映射，就能让 `DocumentService` 使用另一种存储实现。暂时不用真正修改代码。

### 实验 C：重复迁移

连续执行两次 `pnpm storage:migrate-local`，确认第二次只跳过已有且大小一致的对象。思考如果没有幂等性，部署脚本重跑可能造成什么问题。

## 15. 常见故障排查

### `ECONNREFUSED 127.0.0.1:9000`

MinIO 没启动，或 API 地址配置错误。依次检查：

```powershell
docker compose ps
Invoke-WebRequest http://127.0.0.1:9000/minio/health/live
```

### 9001 能打开，但后端仍连接失败

9001 是 Console，不是 SDK API。确认 `.env` 中 `MINIO_PORT=9000`。

### `InvalidAccessKeyId` 或 `SignatureDoesNotMatch`

后端凭据和 Compose 中的 MinIO 凭据不一致。修改 `.env` 后需要重启 NestJS。

### 数据库有记录，MinIO 中没有对象

如果记录来自第 5A 课，运行 `pnpm storage:migrate-local`。如果是新上传，查看后端错误日志，不要直接删除用户数据。

### 容器里使用 `127.0.0.1` 连接失败

容器内的 `127.0.0.1` 指向容器自己。后端容器应使用 `MINIO_ENDPOINT=minio`。

### 中文文件名乱码

新上传会经过 `normalizeMultipartFilename()`；旧记录会在迁移时修复。PDF 对象的二进制内容不受文件名乱码影响。

## 16. 本课自测

先自己回答，再展开答案。

<details>
<summary>1. MinIO 和 PostgreSQL 分别保存什么？</summary>

MinIO 保存 PDF 二进制对象；PostgreSQL 保存原始文件名、对象键、大小、上传者等业务元数据。
</details>

<details>
<summary>2. 为什么后端连接 9000，而浏览器管理页面使用 9001？</summary>

9000 是对象存储 API，供 SDK 调用；9001 是 MinIO Console 的网页端口。
</details>

<details>
<summary>3. 为什么不能把原始文件名直接当对象键？</summary>

同名文件可能互相覆盖，中文和特殊字符也会增加处理复杂度。UUID 对象键稳定且近乎不会冲突，原始名称单独保存在数据库。
</details>

<details>
<summary>4. `FILE_STORAGE` 和 `FileStoragePort` 为什么都需要？</summary>

接口负责 TypeScript 编译期类型检查，但运行时会被擦除；Symbol 在运行时存在，可作为 NestJS 依赖注入 Token。
</details>

<details>
<summary>5. 为什么迁移脚本应当幂等？</summary>

迁移可能因网络中断或部署重试而重复执行。幂等脚本能够安全重跑，不会重复写入或覆盖未知数据。
</details>

<details>
<summary>6. 为什么预览用流，而不是先读取整个 Buffer？</summary>

流可以分段传输，降低大文件对后端内存的占用，并更早开始向浏览器返回数据。
</details>

## 17. 本课完成标准

- `docker compose ps` 中 PostgreSQL 和 MinIO 正常运行。
- 专家上传后，MinIO Console 能看到新对象。
- `Document.storageKey` 与 MinIO 对象键一致。
- 两份从第 5A 课迁移的文件仍能预览。
- 查看角色不能上传，但登录后可以预览。
- 你能不看答案解释 Bucket、对象键、Volume、Stream 和存储抽象。

达到这些标准后，第 5C 课会改为短期签名 URL：后端只授权并生成临时地址，浏览器直接从对象存储读取文件，更接近你之前接触的“文件临时 URL”接口。
