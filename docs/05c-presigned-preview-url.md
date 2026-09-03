# 第 5C 课：短期签名 URL 与直连预览

第 5B 课已经把 PDF 放进 MinIO，但预览时文件字节仍然经过 NestJS。第 5C 课让 NestJS 只负责身份检查和授权，真正的 PDF 由浏览器直接向 MinIO 请求。

本课目标不是单纯“换一个 URL”，而是理解认证、授权、临时委托和文件传输之间的边界。

## 1. 本课完成了什么

- Bucket 继续保持私有，不能直接匿名读取。
- 登录用户先携带 JWT 请求后端。
- 后端确认文件存在并生成 5 分钟有效的预签名 URL。
- React 把临时 URL 放进 iframe。
- 浏览器直接从 MinIO 的 9000 端口读取 PDF。
- 第 5B 课的流式接口继续保留，方便对照两种方案。

新增接口：

| 方法 | 地址 | 权限 | 作用 |
| --- | --- | --- | --- |
| GET | `/api/documents/:documentId/preview-url` | 已登录 | 生成某个文件的短期预览地址 |

返回示例：

```json
{
  "url": "http://127.0.0.1:9000/fullstack-documents/...?...",
  "expiresAt": "2026-09-03T07:30:00.000Z",
  "expiresInSeconds": 300
}
```

不要把真实返回的完整 `url` 粘贴到聊天、工单或日志中。它在过期前相当于一张临时门票。

## 2. 第 5B 和第 5C 的区别

第 5B 课由后端中转文件：

```text
浏览器 ──JWT──> NestJS ──密钥──> MinIO
浏览器 <────── PDF 字节 <─────── MinIO
```

第 5C 课分为两次请求：

```text
第一次：浏览器 ──JWT──> NestJS ──> 返回短期签名 URL
第二次：浏览器 ──签名 URL────────> MinIO ──> 返回 PDF 字节
```

后端不再转发每一个 PDF 字节，因此可以减少后端带宽、连接数和文件传输压力。对象存储通常比业务 API 更适合处理大文件和高并发下载。

## 3. JWT 和签名 URL 不是同一种 Token

两者都像凭证，但作用范围不同：

| 凭证 | 谁签发 | 交给谁验证 | 代表什么 |
| --- | --- | --- | --- |
| JWT | NestJS 业务系统 | NestJS | 当前用户是谁、拥有什么角色 |
| 预签名 URL | MinIO SDK 使用存储密钥生成 | MinIO | 在过期前读取某一个对象 |

用户不能拿 JWT 直接请求 MinIO，因为 MinIO 不认识本项目的用户体系。NestJS 也不会把 MinIO 密钥发给浏览器，而是用密钥签发权限更小、时间更短的地址。

可以把过程类比为：前台先检查你的工作证，然后给你一张只允许进入某个档案室、五分钟后失效的通行条。

## 4. 为什么私有 Bucket 仍然能直连

私有 Bucket 会拒绝没有凭证的请求。预签名 URL 把以下信息放进查询参数：

- 访问哪个 Bucket 和对象键。
- 使用哪种签名算法。
- 签名生成时间。
- 有效秒数。
- 用于验签的 Access Key 标识。
- 根据请求内容和 Secret Key 计算出的签名。

常见参数包括：

```text
X-Amz-Algorithm
X-Amz-Credential
X-Amz-Date
X-Amz-Expires=300
X-Amz-SignedHeaders
X-Amz-Signature
```

Secret Key 不会出现在 URL 中。MinIO 使用服务端保存的 Secret Key重新计算签名；只要路径、关键参数或签名被修改，计算结果就不一致，请求会被拒绝。

签名不是加密。URL 中的 Bucket、对象键和过期时间仍然可见，安全性来自“无法伪造有效签名”和“有效时间很短”。

## 5. 为什么仍然必须先请求后端

如果前端自己持有 MinIO 的 Access Key 和 Secret Key，它就可以绕过所有业务权限，读取甚至修改其他对象。浏览器代码和网络请求都能被用户查看，因此绝不能把 Secret Key 放进 React 环境变量或构建产物。

正确边界是：

1. 浏览器只持有业务 JWT。
2. NestJS 使用 `JwtAuthGuard` 确认用户身份。
3. `DocumentService` 查询数据库并执行文件权限规则。
4. 只有通过授权后，后端才使用服务端密钥生成临时 URL。
5. 浏览器拿到临时 URL 后，只能在限定时间读取指定对象。

当前学习项目允许所有已登录用户预览。正式投标系统还应查询项目、供应商、评审专家和文件之间的业务关系，不能因为用户“已经登录”就允许查看全部文件。

## 6. Controller：受保护的新入口

文件：`apps/api/src/document/document.controller.ts`

Controller 类已经使用：

```ts
@UseGuards(JwtAuthGuard)
```

所以新增路由自动要求登录：

```ts
@Get(':documentId/preview-url')
@Header('Cache-Control', 'private, no-store')
createPreviewUrl(@Param('documentId') documentId: string) {
  return this.documentService.createPreviewUrl(documentId);
}
```

`Cache-Control: private, no-store` 告诉浏览器和中间代理不要缓存包含临时凭证的 JSON 响应。

Controller 只读取路径参数并调用 Service。文件是否存在、有效期是多少、怎样签名都不应堆在 Controller 中。

## 7. Service：先查询业务数据，再申请 URL

文件：`apps/api/src/document/document.service.ts`

`createPreviewUrl()` 的顺序很重要：

1. 使用 `documentId` 查询数据库。
2. 不存在时返回 `DOCUMENT_NOT_FOUND`。
3. 读取后端配置的有效期。
4. 将数据库中的 `storageKey` 交给 URL Provider。
5. 返回 URL 和明确的过期时间。

浏览器提交的是业务文档 ID，不是 MinIO 对象键。对象键属于后端内部存储细节，不需要让页面决定。

`expiresAt` 便于页面给用户明确提示；真正决定 MinIO 是否放行的仍然是签名中的生成时间和 `X-Amz-Expires`。

## 8. 为什么又定义了一个 Port

文件：`apps/api/src/document/temporary-file-url.port.ts`

第 5B 课的 `FileStoragePort` 负责：

- 保存对象。
- 读取对象流。
- 删除对象。

本课新增 `TemporaryFileUrlPort`，只负责生成临时读取地址。分开定义是因为“保存文件”和“生成可公开访问的短期地址”是两种能力。

本地磁盘实现能够保存和读取文件，却不天然支持 S3 风格的预签名 URL；强迫它实现一个做不到的方法，会让抽象变得虚假。

MinIO 同时具备两种能力，所以 `DocumentModule` 把两个 Token 都映射到同一个实例：

```ts
{ provide: FILE_STORAGE, useExisting: MinioFileStorageService }
{ provide: TEMPORARY_FILE_URL, useExisting: MinioFileStorageService }
```

`useExisting` 的意思是复用同一个 Provider 实例，不再创建第二个 MinIO Service。

## 9. MinIO SDK 如何生成签名

文件：`apps/api/src/document/minio-file-storage.service.ts`

核心调用是：

```ts
client.presignedGetObject(
  bucket,
  storageKey,
  expiresInSeconds,
  responseHeaders,
)
```

它不会先把 PDF 读进 NestJS，也不会创建一份新文件。SDK 只根据请求路径、有效期、响应参数和密钥计算签名字符串。

响应参数要求 MinIO 返回：

- `Content-Type: application/pdf`
- `Content-Disposition: inline`
- UTF-8 原始文件名
- 禁止公共缓存

`inline` 让浏览器倾向于直接预览，而不是强制下载。

## 10. 为什么有内部地址和公开地址

新增环境变量：

```dotenv
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_PUBLIC_URL=http://127.0.0.1:9000
MINIO_REGION=us-east-1
PREVIEW_URL_TTL_SECONDS=300
```

- `MINIO_ENDPOINT`：NestJS 上传、读取对象时连接的内部地址。
- `MINIO_PUBLIC_URL`：签名 URL 中写给浏览器访问的地址。
- `MINIO_REGION`：参与 S3 签名计算的区域。
- `PREVIEW_URL_TTL_SECONDS`：临时地址有效秒数，本项目限制为 10～3600 秒。

当前后端和浏览器都在同一台电脑上，两种地址看起来一样。以后后端进入 Docker 后，可能是：

```dotenv
MINIO_ENDPOINT=minio
MINIO_PUBLIC_URL=https://files.example.com
```

`minio` 是 Docker 内部服务名，浏览器无法解析；`files.example.com` 才是浏览器能够访问的域名。

签名会包含 Host，因此不能生成后再随意把域名字符串替换掉。必须在签名时就使用正确的公开地址。

如果同一局域网的同事访问你的演示页面，`127.0.0.1` 会指向同事自己的电脑。此时应把 `MINIO_PUBLIC_URL` 改成你电脑的局域网 IP，例如 `http://192.168.2.15:9000`，并重启后端。

## 11. 前端为什么不再创建 Blob URL

第 5B 课的前端流程：

```ts
const blob = await fetchDocumentContent(id);
const url = URL.createObjectURL(blob);
```

第 5C 课改为：

```ts
const preview = await fetchDocumentPreviewUrl(id);
setPreviewUrl(preview.url);
```

新的 `preview.url` 是 MinIO HTTP 地址，不是浏览器内存中的 `blob:` 地址，因此不需要 `URL.revokeObjectURL()`。

每次点击“生成临时地址并预览”都会向后端申请新地址。页面关闭 iframe 只是不再显示文件，并不会提前撤销签名；它仍会在设定时间到达后失效。

## 12. iframe 为什么不携带 JWT

iframe 第二次请求发给 MinIO，而不是 NestJS。MinIO 用 URL 查询参数中的签名验证请求，因此不需要业务 JWT。

这也解决了普通 iframe 无法方便添加 `Authorization: Bearer ...` 请求头的问题。JWT 只出现在申请临时地址的 API 请求中，不应追加到 MinIO URL。

iframe 导航通常不受前端 `fetch` 的 CORS 读取限制。如果以后改成 JavaScript `fetch(签名URL)` 并读取响应，或在 PDF.js 中跨域加载，则需要给 MinIO 配置正确的 CORS。

## 13. TTL 应该设置多长

本项目使用 300 秒，也就是 5 分钟。没有统一的最佳值：

- 太长：URL 泄露后的可利用时间更长。
- 太短：网络较慢或用户稍后打开时可能已经失效。

预览地址通常使用几分钟；大文件下载要保证有效期足以让请求开始。签名到期后，新请求会失败；已经开始的响应是否中断取决于对象存储实现和代理行为。

正式系统可以根据文件敏感度、大小和使用场景制定不同 TTL，而不是让前端任意提交有效期。

## 14. 完整运行步骤

第一次启动请以根目录 `README.md` 为准。日常运行：

```powershell
cd D:\projects\fullstack-learning-lab
pnpm infra:up
pnpm dev
```

访问：

```text
http://localhost:5173
```

使用 `expert / demo123456` 或 `viewer / demo123456` 登录，点击“生成临时地址并预览”。

## 15. 在开发者工具中观察两次请求

打开浏览器开发者工具的 Network 面板，然后点击预览按钮。你应该看到：

1. 向 5173 发出的 `/api/documents/.../preview-url` 请求；Vite 将它代理到 3000。
2. 向 9000 发出的 `fullstack-documents/...pdf?...` 请求。

第一个请求头有业务 `Authorization`，返回 JSON；第二个请求依赖 URL 签名，响应内容是 PDF。

观察即可，不要把完整签名 URL 截图或复制到公开位置。

## 16. 用 PowerShell 验证接口

先登录并取得 JWT：

```powershell
$loginBody = @{
  username = 'viewer'
  password = 'demo123456'
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Method Post `
  -Uri 'http://127.0.0.1:3000/api/auth/login' `
  -ContentType 'application/json' `
  -Body $loginBody

$headers = @{ Authorization = "Bearer $($login.accessToken)" }
$documents = Invoke-RestMethod `
  -Uri 'http://127.0.0.1:3000/api/documents' `
  -Headers $headers
```

申请第一份文件的预览地址：

```powershell
$documentId = $documents[0].id
$preview = Invoke-RestMethod `
  -Uri "http://127.0.0.1:3000/api/documents/$documentId/preview-url" `
  -Headers $headers

$preview.expiresAt
$preview.expiresInSeconds
```

不要直接输出 `$preview.url` 到共享终端日志。需要本地验证时可以请求：

```powershell
$response = Invoke-WebRequest -Uri $preview.url
$response.StatusCode
$response.Headers['Content-Type']
```

## 17. 亲手完成三个安全实验

### 实验 A：不登录申请地址

退出登录后直接请求 `/preview-url`，应得到 401。这证明 MinIO 直连没有取消业务系统的认证入口。

### 实验 B：修改签名

只在本机临时复制地址，将 `X-Amz-Signature` 的一个字符改掉再访问，应得到 403。实验结束后不要保存或分享原地址。

### 实验 C：等待过期

生成地址并记录当前时间，超过 5 分钟后刷新该地址，应被 MinIO 拒绝。回到页面重新点击按钮，新地址应再次可用。

## 18. 预签名 URL 的限制

预签名 URL 很实用，但不是万能权限系统：

- 过期前，任何拿到 URL 的人都可以使用它。
- 普通预签名 URL 很难只撤销某一条；通常要等待过期、删除对象或更换密钥。
- URL 可能出现在浏览器历史、代理日志、监控系统或 Referer 中。
- 它只能表达对象存储支持的操作，复杂业务权限仍由后端决定。

因此应使用 HTTPS、短 TTL、私有 Bucket、`no-store` 响应，并避免在日志中记录完整查询参数。

对高度敏感的文件，还可以继续使用后端流式中转，或使用网关一次性 Token、水印、审计和更细的访问策略。

## 19. 常见故障排查

### 接口返回 401

JWT 缺失或过期。重新登录，并确认申请 URL 的 API 请求带有 `Authorization: Bearer ...`。

### 签名 URL 返回 403

依次检查：

- 地址是否超过 5 分钟。
- URL 是否被复制工具截断或修改。
- `MINIO_PUBLIC_URL` 是否与浏览器实际请求的 Host 一致。
- `MINIO_REGION`、Access Key 和 Secret Key 是否与 MinIO 一致。
- 电脑时间是否严重不准；签名依赖时间。

### 页面申请成功，但 iframe 空白

在 Network 面板查看 9000 请求的状态码，再直接检查：

- MinIO 是否运行：`docker compose ps`。
- `MINIO_PUBLIC_URL` 是否能从当前浏览器所在电脑访问。
- PDF 是否完好、响应是否为 `application/pdf`。
- 浏览器是否支持内置 PDF 预览。

### 本机正常，局域网同事失败

签名 URL 中如果是 `127.0.0.1`，同事会访问自己电脑。把 `MINIO_PUBLIC_URL` 改成服务所在电脑的局域网地址，允许防火墙访问 9000，然后重启 NestJS。

### 修改 `.env` 后没有变化

环境变量在后端进程启动时读取。停止 `pnpm dev` 后重新运行，不能只刷新浏览器。

## 20. 本课涉及的文件

| 文件 | 作用 |
| --- | --- |
| `apps/api/src/document/temporary-file-url.port.ts` | 定义生成临时读取地址的能力 |
| `apps/api/src/document/preview-url.config.ts` | 校验预览 URL 的 TTL |
| `apps/api/src/document/minio.config.ts` | 读取内部和公开 MinIO 地址 |
| `apps/api/src/document/minio-file-storage.service.ts` | 调用 SDK 生成预签名 URL |
| `apps/api/src/document/document.service.ts` | 查询文件并组织预览结果 |
| `apps/api/src/document/document.controller.ts` | 暴露受 JWT 保护的新接口 |
| `apps/web/src/api/documents.ts` | 封装前端 API 请求 |
| `apps/web/src/components/DocumentPanel.tsx` | 申请 URL 并放入 iframe |

## 21. 本课自测

先自己回答，再展开答案。

<details>
<summary>1. 使用签名 URL 后，为什么还需要 JWT？</summary>

JWT 让业务后端确认用户身份并执行授权；签名 URL 只负责把某个对象的短期读取能力委托给已经通过授权的浏览器。
</details>

<details>
<summary>2. 签名 URL 中包含 MinIO Secret Key 吗？</summary>

不包含。URL 中包含 Access Key 标识和计算结果，Secret Key 只保留在服务端，用于生成和验证签名。
</details>

<details>
<summary>3. 为什么签名生成后不能直接替换域名？</summary>

Host 参与签名计算。替换后 MinIO 重新计算出的签名不同，请求会被拒绝。
</details>

<details>
<summary>4. 为什么 `PREVIEW_URL_TTL_SECONDS` 由后端配置，而不是前端提交？</summary>

有效期是安全策略。允许前端任意指定，恶意用户就可以申请超长有效期的地址。
</details>

<details>
<summary>5. 为什么当前 iframe 通常不需要 MinIO CORS？</summary>

iframe 是跨域导航并由浏览器展示 PDF，前端 JavaScript 没有读取响应内容；如果改用 `fetch` 或 PDF.js 跨域读取，就需要 CORS。
</details>

<details>
<summary>6. 为什么关闭 iframe 不等于撤销签名 URL？</summary>

关闭只改变当前 React 页面。MinIO 并不知道页面状态，地址会一直有效到签名过期，除非对象或密钥发生变化。
</details>

## 22. 本课完成标准

- 未登录不能申请签名 URL。
- 登录后能得到 `expiresInSeconds: 300`。
- 不带签名直接访问私有 Bucket 会收到 403。
- 正确签名 URL 能返回 `application/pdf` 和 `%PDF-` 文件头。
- 专家和查看角色都能预览，但查看角色仍不能上传。
- 你能画出“JWT 请求后端”和“签名 URL 请求 MinIO”两段链路。
- 你能解释为什么签名 URL 应像临时密码一样保护。

完成后，下一课进入自动化测试：把本课手工验证过的关键规则交给测试程序反复检查。
