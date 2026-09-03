# 第 5A 课：普通文件上传与鉴权预览

这节课先使用后端本地磁盘保存 PDF。目标不是把本地磁盘当成最终生产方案，而是先理解文件上传的完整链路。第 5B 课会把本地存储替换成 MinIO。

> 课程演进说明：完成第 5B 课后，当前应用已改用 `MinioFileStorageService`。`LocalFileStorageService` 仍保留在代码中，用于对照两种存储实现；本讲义描述的是第 5A 课当时的数据流。

## 1. 本课完成了什么

- 专家可以上传最大 10 MB 的 PDF。
- 查看角色不能上传，但登录后可以查看文件列表和预览。
- PostgreSQL 保存文件元数据。
- 后端本地目录保存文件二进制内容。
- 预览请求携带 JWT，不能绕过身份认证。

演示接口：

| 方法 | 地址 | 权限 | 作用 |
| --- | --- | --- | --- |
| GET | `/api/documents` | 已登录 | 查询文件列表 |
| POST | `/api/documents` | EXPERT | 上传 PDF |
| GET | `/api/documents/:id/content` | 已登录 | 读取 PDF 内容 |

## 2. 文件内容和元数据不是一回事

假设用户上传 `投标文件.pdf`，系统需要保存两类信息。

文件内容是二进制字节：

```text
%PDF-1.7 ... 很多二进制数据 ... %%EOF
```

文件元数据是描述文件的信息：

```json
{
  "originalName": "投标文件.pdf",
  "mimeType": "application/pdf",
  "size": 1048576,
  "uploadedById": "用户 ID",
  "createdAt": "上传时间"
}
```

当前存储位置：

```text
PDF 字节 → apps/api/storage/uploads/<随机 UUID>.pdf
元数据   → PostgreSQL Document 表
```

为什么不直接用原文件名保存？用户可能上传重名文件，文件名还可能包含路径字符。后端生成随机 `storageKey`，数据库单独保留用于展示的 `originalName`。

## 3. 为什么文件上传不用 JSON

前几课发送的是 JSON：

```http
Content-Type: application/json

{"score": 3.5}
```

文件上传使用 `multipart/form-data`，它可以在一个请求中携带文件和普通字段：

```http
Content-Type: multipart/form-data; boundary=----浏览器生成的分隔符

------分隔符
Content-Disposition: form-data; name="file"; filename="投标文件.pdf"
Content-Type: application/pdf

<PDF 二进制内容>
------分隔符--
```

在浏览器中使用 `FormData`：

```ts
const form = new FormData();
form.append('file', file);
```

不要手动设置 `Content-Type: multipart/form-data`。浏览器必须自动补上和请求体一致的 `boundary`；手动设置通常会漏掉 boundary，后端就找不到文件字段。

## 4. 完整上传链路

```text
用户选择 PDF
  → React 得到 File 对象
  → FormData 添加 file 字段
  → requestJson 添加 Bearer Token
  → POST /api/documents
  → JwtAuthGuard 验证身份
  → RolesGuard 检查 EXPERT
  → FileInterceptor 解析 multipart
  → DocumentService 验证文件
  → LocalFileStorageService 写入随机文件名
  → Prisma 写入 Document 元数据
  → 返回 DocumentSummary
  → React 更新文件列表
```

Guard 在文件解析前运行。没有权限的用户会尽早被拒绝，后端不必先接收完整文件再判断权限。

## 5. Document 数据库表

文件：`apps/api/prisma/schema.prisma`

```prisma
model Document {
  id           String   @id @default(cuid())
  originalName String
  storageKey   String   @unique
  mimeType     String
  size         Int
  uploadedById String
  uploadedBy   User     @relation(
    fields: [uploadedById],
    references: [id],
    onDelete: Restrict
  )
  createdAt    DateTime @default(now())

  @@index([uploadedById])
}
```

重点字段：

- `originalName`：展示给用户的原始文件名。
- `storageKey`：磁盘上的随机文件名，必须唯一。
- `mimeType`：响应浏览器时使用的文件类型。
- `size`：文件字节数。
- `uploadedById`：上传者 ID。
- `uploadedBy`：指向 `User` 的数据库关系。

`uploadedById` 是外键字段。数据库会保证它必须指向一个真实用户。

```prisma
onDelete: Restrict
```

表示一个用户仍有文件记录时，数据库不允许直接删除该用户，避免文件元数据失去上传者。

```prisma
@@index([uploadedById])
```

为上传者 ID 建立索引。以后按用户查询文件时，数据库不必扫描整张表。

修改模型后运行：

```powershell
pnpm db:migrate
```

本课生成的迁移文件会创建 `Document` 表、唯一约束、索引和外键。

## 6. 为什么需要 Module

文件：`apps/api/src/document/document.module.ts`

```ts
@Module({
  imports: [AuthModule],
  controllers: [DocumentController],
  providers: [DocumentService, LocalFileStorageService],
})
export class DocumentModule {}
```

- `AuthModule`：提供 JWT 和角色 Guard。
- `DocumentController`：定义文件 HTTP 接口。
- `DocumentService`：文件业务规则和数据库元数据。
- `LocalFileStorageService`：只负责本地文件系统。

`DocumentModule` 还要被根 `AppModule` 导入，否则 NestJS 不会创建这些组件，路由也不会出现。

## 7. FileInterceptor 做了什么

文件：`apps/api/src/document/document.controller.ts`

```ts
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
}))
```

浏览器发来的 multipart 请求不是普通 JSON。`FileInterceptor` 在 Controller 前调用 Multer：

1. 识别 multipart boundary。
2. 找到名为 `file` 的字段。
3. 读取文件名、MIME 类型、大小和二进制 Buffer。
4. 限制只能有一个文件、最大 10 MB。
5. 把结果交给 `@UploadedFile()`。

```ts
@UploadedFile() file: Express.Multer.File | undefined
```

`Express.Multer.File` 包含：

- `originalname`：用户上传时的文件名。
- `mimetype`：客户端声明的类型。
- `size`：文件大小。
- `buffer`：文件字节。

`undefined` 表示请求里没有 `file` 字段，因此 Service 仍需要检查必填。

## 8. 为什么文件校验有两层

文件：`apps/api/src/document/document.service.ts`

第一层检查浏览器声明：

```ts
file.mimetype === 'application/pdf'
```

但 MIME 类型由客户端发送，可以伪造。因此还检查文件的前五个字节：

```ts
file.buffer.subarray(0, 5).toString() === '%PDF-'
```

PDF 文件通常以 `%PDF-` 开始，这叫文件签名或魔数。

两层检查仍不是恶意文件扫描。生产系统还可能需要：

- 更严格的文件解析。
- 病毒或恶意内容扫描。
- 文件名和内容安全策略。
- 上传频率、用户额度限制。

## 9. 本地存储服务为什么单独存在

文件：`apps/api/src/document/local-file-storage.service.ts`

如果直接在 Controller 中调用 `writeFile()`，下一课切换 MinIO 时会同时修改 Controller、Service 和测试。单独抽象存储职责后：

```text
第 5A 课：DocumentService → LocalFileStorageService
第 5B 课：DocumentService → MinioFileStorageService
```

Controller 和数据库元数据结构基本不变。

启动时：

```ts
await mkdir(this.uploadDirectory, { recursive: true });
```

确保目录存在。`recursive` 允许父目录不存在，也不会因为目录已存在而报错。

保存时：

```ts
const storageKey = `${randomUUID()}.pdf`;
await writeFile(filePath, content, { flag: 'wx' });
```

- UUID 避免重名并隐藏用户原文件名。
- `wx` 表示只创建新文件；极端情况下名字已存在会报错，而不是覆盖旧文件。

`resolveStorageKey()` 还会检查最终路径是否仍在上传目录中，用于防止 `../` 之类的路径穿越。

## 10. 为什么数据库失败后还要删除文件

上传涉及两个独立系统：

1. 本地磁盘写文件。
2. PostgreSQL 写元数据。

磁盘写入成功后，数据库仍可能失败。此时只留下磁盘文件，没有数据库记录能找到它，这叫孤儿文件。

因此代码使用补偿操作：

```ts
try {
  return await prisma.document.create(...);
} catch (error) {
  await storage.remove(storageKey);
  throw error;
}
```

普通数据库事务不能回滚文件系统，所以需要手动清理。以后使用对象存储时仍要考虑相同问题。

## 11. 文件列表为什么只返回元数据

`GET /api/documents` 返回：

```json
[
  {
    "id": "document-id",
    "originalName": "投标文件.pdf",
    "mimeType": "application/pdf",
    "size": 1024,
    "createdAt": "2026-09-03T03:00:00.000Z",
    "uploadedBy": {
      "id": "user-id",
      "displayName": "演示评审专家"
    }
  }
]
```

列表不返回二进制内容，也不返回磁盘绝对路径或 `storageKey`：

- 列表响应保持轻量。
- 客户端不需要知道服务器目录结构。
- 避免泄露内部存储实现。
- 真正读取文件时可以再次鉴权。

## 12. 后端如何返回 PDF

预览接口读取元数据并找到文件路径，然后返回：

```http
Content-Type: application/pdf
Content-Disposition: inline; filename*=UTF-8''...
Cache-Control: private, no-store
```

- `application/pdf`：告诉浏览器这是 PDF。
- `inline`：优先在浏览器中显示，不强制下载。
- `filename*`：支持 UTF-8 中文文件名。
- `private, no-store`：避免共享缓存保存受保护文件。

```ts
new StreamableFile(createReadStream(filePath))
```

文件以流的形式分段发送，不需要一次把整个 PDF 再读入后端内存。上传阶段当前使用内存 Buffer，是本课 10 MB 上限和简化实现的一部分。

## 13. 为什么 iframe 不能直接写受保护接口

普通 iframe：

```html
<iframe src="/api/documents/123/content"></iframe>
```

无法像 `fetch()` 一样自定义 `Authorization` 请求头，所以后端会返回 401。

当前前端采用：

```text
fetch + Bearer Token
  → 收到 PDF Blob
  → URL.createObjectURL(blob)
  → iframe 显示 blob: 地址
```

`Blob` 表示浏览器内存中的二进制对象。`URL.createObjectURL()` 为它创建临时本地地址。

关闭或替换预览时必须执行：

```ts
URL.revokeObjectURL(previewUrl);
```

否则反复预览会一直占用浏览器内存。

第 5C 课会学习另一种方式：后端生成短期有效的临时 URL，iframe 可以直接访问。

## 14. 前端请求封装发生了什么变化

文件：`apps/web/src/api/http.ts`

以前所有有请求体的请求都默认设置 JSON：

```http
Content-Type: application/json
```

现在必须识别 FormData：

```ts
if (options.body && !(options.body instanceof FormData)) {
  headers.set('Content-Type', 'application/json');
}
```

FormData 请求不手动设置 Content-Type，让浏览器生成正确 boundary。

`requestBlob()` 与 `requestJson()` 的区别：

- `requestJson()`：读取接口 JSON。
- `requestBlob()`：读取 PDF 等二进制响应。

二者都会携带 JWT，并使用相同的 API 错误格式。

## 15. 前端页面如何管理状态

文件：`apps/web/src/components/DocumentPanel.tsx`

主要状态：

- `documents`：数据库文件列表。
- `selectedFile`：用户刚选择、尚未上传的浏览器 File。
- `uploading`：防止重复点击上传。
- `previewLoadingId`：正在读取哪个 PDF。
- `previewUrl`：浏览器生成的 Blob 临时地址。
- `message`：成功或失败提示。

专家角色可以选择和上传文件；查看角色的按钮被禁用。但安全边界仍是后端 `RolesGuard`，不是 React 的 `disabled`。

## 16. 本课的错误路径

| 情况 | 拦截位置 | HTTP | 错误码 |
| --- | --- | --- | --- |
| 没有 Token | JwtAuthGuard | 401 | `AUTH_REQUIRED` |
| VIEWER 上传 | RolesGuard | 403 | `INSUFFICIENT_ROLE` |
| 没有 file 字段 | DocumentService | 400 | `FILE_REQUIRED` |
| 超过 10 MB | FileInterceptor | 413 | `FILE_TOO_LARGE` |
| 类型或文件头错误 | DocumentService | 400 | `UNSUPPORTED_FILE_TYPE` |
| 文件 ID 不存在 | DocumentService | 404 | `DOCUMENT_NOT_FOUND` |

## 17. 动手实验

启动：

```powershell
pnpm db:up
pnpm db:migrate
pnpm dev
```

打开 `http://localhost:5173`。

### 实验 A：专家上传

1. 使用 `expert / demo123456` 登录。
2. 选择一个不超过 10 MB 的 PDF。
3. 点击“上传 PDF”。
4. 确认文件立即出现在列表。
5. 点击“鉴权预览”。

### 实验 B：观察两种存储

1. 运行 `pnpm db:studio`。
2. 打开 `Document` 表，观察原文件名、大小、storageKey 和 uploadedById。
3. 查看 `apps/api/storage/uploads`。
4. 对比数据库 `storageKey` 与磁盘随机文件名。

不要手动修改或删除二者之一，否则会故意制造元数据与文件不一致。

### 实验 C：查看角色权限

1. 退出专家账号。
2. 使用 `viewer / demo123456` 登录。
3. 确认仍能查看列表和预览。
4. 确认上传控件被禁用。
5. 后端直接请求上传接口也会返回 403。

### 实验 D：伪造文件

1. 把普通文本文件扩展名改为 `.pdf`。
2. 尝试上传。
3. 即使扩展名看起来正确，文件头检查仍会拒绝它。

## 18. 排错顺序

### 页面显示 401

先重新登录，再在 Network 中检查 Authorization 请求头。

### 后端显示 FILE_REQUIRED

检查 FormData 字段名是否是 `file`，以及是否错误地手动设置了 multipart Content-Type。

### 数据库有记录但预览 500

检查 `UPLOAD_DIR`、磁盘文件是否存在，以及运行用户是否有目录读取权限。

### 修改 Prisma 模型后类型报错

先运行迁移或 `pnpm --filter @fullstack-lab/api run db:generate`。Windows 下生成 Prisma Client 前应停止正在运行的 API，避免 DLL 文件被锁定。

### Express.Multer 类型找不到

API 的 `tsconfig.json` 需要包含：

```json
"types": ["node", "express", "multer"]
```

设置 `types` 后，TypeScript 只加载列出的全局类型；加入新的服务器框架类型时要同步扩展。

## 19. 为什么本地磁盘不是最终方案

本地磁盘适合单机学习，但线上会遇到：

- 运行多个后端实例时，各实例看不到彼此文件。
- 容器删除后，本地文件可能丢失。
- 扩容、备份和权限管理困难。
- 无法方便地生成短期访问 URL。

第 5B 课会引入 MinIO。MinIO 提供兼容 S3 的对象存储接口，文件不再依附某一个后端进程。

## 20. 自测题

<details>
<summary>1. 为什么文件内容和元数据分开保存？</summary>

二进制内容适合文件或对象存储；名称、大小、上传者等结构化信息适合数据库查询和关联。分开后也可以替换底层文件存储而不改变业务数据结构。

</details>

<details>
<summary>2. 为什么不能手动设置 FormData 的 Content-Type？</summary>

浏览器需要生成与请求体匹配的 multipart boundary。只写 `multipart/form-data` 而缺少 boundary，后端无法正确拆分字段。

</details>

<details>
<summary>3. MIME 类型已经是 application/pdf，为什么还检查 %PDF-？</summary>

MIME 类型来自客户端，可以伪造。文件头检查增加一层内容判断，但仍不能代替完整安全扫描。

</details>

<details>
<summary>4. 为什么预览使用 Blob URL？</summary>

受保护接口要求 Bearer Token，而普通 iframe 不能添加自定义 Authorization 请求头。先用 fetch 鉴权读取 Blob，再让 iframe 展示临时 Blob URL。

</details>

<details>
<summary>5. 为什么数据库写入失败后要删除磁盘文件？</summary>

否则会产生没有数据库记录引用的孤儿文件。数据库事务不能自动回滚文件系统操作，所以需要补偿清理。

</details>

完成这些实验并能回答自测题后，再进入第 5B 课 MinIO 对象存储。
