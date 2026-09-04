# 第 8 课：Nginx、HTTPS 与浏览器安全边界

第 7 课已经让四个服务在 Docker 中运行。本课继续处理真正上线前一定会遇到的问题：用户从哪个入口访问、通信怎样加密、HTTPS 页面为什么会拦截 HTTP PDF，以及 CORS、CSP 和 iframe 到底分别限制什么。

没有真实域名就无法申请正式可信证书，所以本课先搭建一套能运行的本地自签名 HTTPS 环境，再完整说明正式域名上线时需要替换哪些部分。

## 1. 本课完成了什么

- 使用 Docker 中的 OpenSSL 生成本地自签名证书。
- 使用 Compose 覆盖文件给现有系统增加 8443 HTTPS 入口。
- Nginx 终止 TLS，并继续代理 NestJS API。
- 通过同源 `/storage` 路径代理 MinIO 签名文件。
- 解决 HTTPS 页面嵌入 HTTP PDF 的混合内容问题。
- 增加上传大小限制、基础安全响应头和 CSP。
- 为签名 URL 的代理路径前缀增加后端配置与单元测试。
- 解释为什么当前同源架构不需要开启 CORS。
- 说明外部客户 iframe 集成时如何配置 `frame-ancestors`。

本地运行：

```powershell
cd D:\projects\fullstack-learning-lab
pnpm https:cert
pnpm stack:https:up
```

打开：

```text
https://localhost:8443
```

## 2. HTTP、TLS 和 HTTPS 的关系

HTTP 定义请求和响应怎样表达，但普通 HTTP 内容在网络中没有加密。HTTPS 可以理解为 HTTP 运行在 TLS 加密连接之上。

TLS 主要解决三个问题：

1. **机密性**：旁观者不容易读到密码、Token 和业务内容。
2. **完整性**：传输内容被篡改时连接会失败。
3. **身份验证**：浏览器通过证书判断自己连接的是否是目标域名。

HTTPS 不会自动修复 SQL 注入、越权、弱密码或 XSS。它保护传输通道，应用层安全仍需单独处理。

## 3. 一次 HTTPS 请求经过哪里

本课链路为：

```text
浏览器
  │ HTTPS :8443
  ▼
Nginx Web 容器（TLS 在这里解密）
  ├─ /            → React 静态文件
  ├─ /api/...     → HTTP → api:3000
  └─ /storage/... → HTTP → minio:9000
```

浏览器到 Nginx 是 HTTPS。Nginx、API、MinIO 位于同一台主机的隔离 Compose 网络中，内部暂用 HTTP。

正式系统如果内部服务跨主机、跨不可信网络或有更严格合规要求，还要考虑内部 TLS 或 mTLS。不能简单认为“入口是 HTTPS，任何内部网络都永远安全”。

## 4. 证书里有什么

证书至少关联：

- 公钥。
- 允许使用的域名或 IP，也就是 SAN。
- 有效期。
- 签发者。
- 签发者对证书内容的数字签名。

服务器保管与公钥配对的私钥。私钥不能提交 Git、写进前端、发到群里或烘焙进公共镜像。

浏览器建立 TLS 连接时会检查：

1. 当前时间是否在证书有效期内。
2. 访问的域名或 IP 是否出现在 SAN。
3. 签发链是否最终连接到浏览器信任的 CA。

只要其中一项失败，就会出现证书警告。

## 5. 自签名证书能做什么、不能做什么

`pnpm https:cert` 生成的证书由它自己签名，而不是由浏览器信任的 CA 签名。

它可以用于：

- 学习 Nginx TLS 配置。
- 复现 HTTPS、混合内容和安全响应头。
- 验证程序是否能通过加密连接工作。

它不能用于：

- 面向客户正式发布。
- 让浏览器自动显示可信锁标识。
- 证明服务器确实属于某个真实组织。

浏览器警告不是“HTTPS 没生效”，而是“连接可以加密，但身份签发者不受信任”。正式系统绝不能要求客户点击忽略警告。

## 6. 证书生成脚本逐段理解

文件：`scripts/generate-dev-certificate.mjs`。

脚本本身不要求 Windows 安装 OpenSSL，而是运行固定版本镜像：

```text
alpine/openssl:3.5.4
```

生成参数包括：

- RSA 2048 位私钥。
- SHA-256 签名。
- 365 天学习有效期。
- SAN 包含 `localhost` 和 `127.0.0.1`。
- 私钥不设置口令，便于无人值守启动本地 Nginx。

无口令私钥更需要严格保护。它只保存在 `.certs/dev.key`，整个 `.certs` 已被 `.gitignore` 和 `.dockerignore` 排除，既不会提交 Git，也不会发送进镜像构建上下文。

如果需要在局域网 IP 上实验，可重新生成包含该 IP 的证书：

```powershell
pnpm https:cert -- 192.168.2.15
```

脚本会先验证参数确实是 IP，避免把任意内容传给证书命令。

## 7. 为什么证书不放进 Docker 镜像

镜像可能被推送到镜像仓库、复制到测试机或由其他人拉取。私钥一旦进入镜像层，即使后续 Dockerfile 再删除，旧层中仍可能恢复。

HTTPS Compose 使用只读挂载：

```yaml
volumes:
  - ./.certs/dev.crt:/etc/nginx/tls/dev.crt:ro
  - ./.certs/dev.key:/etc/nginx/tls/dev.key:ro
```

`:ro` 表示容器只能读取。正式环境同样应在部署时注入证书，或由专门的证书管理服务提供，不能把生产私钥提交到源码仓库。

## 8. Compose 覆盖文件是什么

基础 `compose.yaml` 仍负责普通 HTTP 环境。`compose.https.yaml` 只写 HTTPS 需要改变或增加的部分。

启动命令：

```text
docker compose -f compose.yaml -f compose.https.yaml up
```

Compose 按顺序合并：

- API 的 MinIO 公共地址改为 HTTPS 入口。
- Web 增加宿主机 8443 到容器 443 的端口。
- Web 挂载证书和 HTTPS Nginx 配置。

这样普通开发模式不强制要求证书，HTTPS 学习模式也不需要复制一整份四服务配置。

检查合并结果：

```powershell
docker compose --file compose.yaml --file compose.https.yaml config --quiet
```

不要把不带 `--quiet` 的完整展开结果发到公开位置，因为实际 `.env` 里的密码会被展开。

## 9. Nginx TLS 配置

文件：`apps/web/nginx.https.conf`。

核心配置包括：

```nginx
listen 443 ssl;
http2 on;
ssl_certificate /etc/nginx/tls/dev.crt;
ssl_certificate_key /etc/nginx/tls/dev.key;
ssl_protocols TLSv1.2 TLSv1.3;
```

- `listen 443 ssl`：容器内部 443 接收 TLS。
- `http2 on`：允许支持的客户端使用 HTTP/2。
- certificate：公开证书。
- certificate_key：必须保密的私钥。
- 只启用 TLS 1.2 和 1.3，禁用过时协议。

宿主机使用 8443 只是为了本地实验不占标准端口。正式网站通常把宿主机 443 映射到容器 443，用户 URL 不再写端口。

## 10. 为什么本地没有强制 HTTP 跳转 HTTPS

当前 HTTP 页面在 8080，HTTPS 页面在 8443。Nginx 容器只知道自己的 80 和 443，不天然知道宿主机映射成了 8080 与 8443。

若简单写 `return 301 https://$host$request_uri`，本地浏览器可能跳到默认 443，而不是 8443。

因此学习环境暂时同时保留 HTTP 与 HTTPS，方便对照。正式域名部署在标准 80/443 后应：

1. 让 80 只负责 ACME 验证和跳转。
2. 把其他请求永久重定向到 HTTPS。
3. 确认 HTTPS 长期稳定后，再谨慎启用 HSTS。

HSTS 会被浏览器缓存，不适合随意加在 localhost 自签名实验中。

## 11. 什么是混合内容

如果页面是：

```text
https://localhost:8443
```

iframe 却加载：

```text
http://127.0.0.1:9000/file.pdf
```

外层连接虽然加密，PDF 却能被网络中间人读取或替换。浏览器因此会阻止这类 HTTPS 页面中的 HTTP 活动内容。

只给主页面配 HTTPS 不够。页面依赖的脚本、API、图片、iframe 和下载地址也必须使用安全来源。

## 12. 为什么不直接让浏览器访问 MinIO HTTPS

可以给 MinIO 单独配置证书和域名，例如 `files.example.com`，但这会增加：

- 第二个证书和域名。
- MinIO CORS、外网端口与防火墙配置。
- 多一个直接暴露到公网的服务。
- CSP 中额外的跨源许可。

本课采用统一入口：浏览器只接触 Nginx，Nginx 在内部访问 MinIO。它不是唯一正确架构，但很适合当前单机项目。

## 13. /storage 同源代理怎样工作

HTTPS 模式给 API 注入：

```text
MINIO_PUBLIC_URL=https://localhost:8443
MINIO_PUBLIC_PATH_PREFIX=/storage
```

MinIO SDK 先为原始对象路径签名：

```text
/fullstack-documents/documents/...pdf?X-Amz-Signature=...
```

API 返回浏览器前只增加代理前缀：

```text
/storage/fullstack-documents/documents/...pdf?X-Amz-Signature=...
```

Nginx 的配置为：

```nginx
location /storage/ {
  proxy_pass http://minio:9000/;
  proxy_set_header Host $http_host;
}
```

`proxy_pass` 结尾的 `/` 会在转发时移除 `/storage/` 前缀，MinIO 最终仍看到它签名时的对象路径。

## 14. 为什么必须保留 Host

MinIO 使用 AWS Signature V4。签名不仅与路径和查询参数有关，也包含 Host。

SDK 按浏览器入口 `localhost:8443` 生成签名，Nginx 因此使用：

```nginx
proxy_set_header Host $http_host;
```

如果转发时把 Host 改成内部的 `minio:9000`，MinIO 重新计算签名时会得到不同结果并返回 403。

这说明反向代理签名 URL 时不能只看“文件路径是否一样”，还要知道签名算法包含了哪些请求信息。

## 15. 为什么后端不重新序列化整个签名 URL

签名查询参数中的大小写、百分号编码和参数值都很敏感。`addPublicPathPrefix` 只在主机与原路径之间插入 `/storage`，不重新生成查询参数。

测试特意包含 `%2F`：

```text
?credential=a%2Fb&signature=test
```

并断言增加前缀后它仍逐字保留。处理签名内容时，应尽量把未知签名字段当成不透明数据。

## 16. 路径前缀为什么需要校验

`normalizePublicPathPrefix` 只接受：

- 空字符串，表示不使用代理前缀。
- 以 `/` 开头。
- 不以 `/` 结尾。
- 只含安全路径字符。
- 不含重复斜杠或 `..`。

错误配置如 `storage`、`/storage/`、`/../secret` 会在应用启动时失败，而不是生成难以排查的错误 URL。

环境变量也是程序输入。即使只有运维人员设置，也应该尽早验证。

## 17. CSP 是什么

Content Security Policy 是浏览器执行的资源加载白名单。本课 HTTPS 响应头大意为：

```text
default-src self
script-src self
style-src self
connect-src self
frame-src self
object-src none
frame-ancestors self
```

其中 self 实际写作带单引号的 CSP 关键字。

含义：

- JS、CSS、fetch 和 iframe 只允许当前源。
- 图片额外允许 `data:`。
- 禁止旧式插件对象。
- 当前页面只允许被同源页面嵌入。

因为 API 和 PDF 都走同一个 HTTPS 入口，所以可以保持严格的 `self`，无需放开 9000 端口。

## 18. frame-src 与 frame-ancestors 不要混淆

两者方向相反：

```text
当前页面 ──嵌入──> PDF iframe
  frame-src 控制这一方向

客户页面 ──嵌入──> 当前应用
  frame-ancestors 控制这一方向
```

本学习项目是独立页面，所以设置 `frame-ancestors self` 和 `X-Frame-Options: SAMEORIGIN`。

如果将类似 AI 抽屉应用嵌入客户系统，必须：

1. 把 `frame-ancestors` 改为客户页面的精确 HTTPS 来源。
2. 移除与跨站嵌入冲突的 `X-Frame-Options: SAMEORIGIN`。
3. 不要使用任意 `*` 代替客户白名单。
4. 同时检查客户自己的 CSP 是否允许你的应用 URL。

例如概念上允许：

```text
frame-ancestors https://customer.example.com
```

协议、域名和端口共同组成来源，不能只确认域名文字相似。

## 19. X-Frame-Options 与 CSP 的关系

`X-Frame-Options: SAMEORIGIN` 是较旧的 iframe 防护头，表达能力有限；CSP `frame-ancestors` 可以列出多个精确来源。

对独立后台系统，两者同时设置可以兼容旧浏览器。对需要跨域嵌入的 SDK 页面，旧头可能直接阻止合法客户，因此要以明确的集成策略统一配置，不能互相矛盾。

## 20. CORS 是什么

浏览器同源策略默认限制页面读取另一个源的响应。源由三部分组成：

```text
协议 + 主机 + 端口
```

以下来源彼此不同：

- `http://localhost:8080`
- `https://localhost:8443`
- `https://127.0.0.1:8443`

CORS 是目标服务器通过响应头告诉浏览器：“允许哪些其他来源的页面读取我”。它不是网络防火墙，也不会阻止 curl 或服务器之间发请求。

## 21. 为什么当前 NestJS 不需要 enableCors

浏览器在 HTTPS 页面中请求相对路径 `/api`：

```text
页面：https://localhost:8443/
API ：https://localhost:8443/api/...
```

二者同源。Nginx 在服务器内部转发到 `api:3000` 的事实对浏览器不可见，因此不存在跨源读取，不需要 CORS。

不要为了“防止以后报错”先配置 `Access-Control-Allow-Origin: *`。宽泛 CORS 会扩大浏览器可访问面，而且携带凭证时星号通常也不符合要求。

如果未来前端和 API 必须使用不同域名，再在 NestJS 中配置精确 allowlist，并验证 Origin、Authorization 预检、允许方法和响应头。

## 22. iframe 与 CORS 也不是同一件事

CORS 主要控制 JavaScript 能否读取跨源响应。页面是否允许被 iframe 嵌入，主要看 CSP `frame-ancestors` 和 `X-Frame-Options`。

一个页面可能：

- 能在 iframe 中显示，但父页面不能读取 iframe DOM。
- API 允许 CORS，但页面仍被禁止嵌入。
- 双方通过 `postMessage` 通信，而不是直接读对方 DOM。

跨源 `postMessage` 必须校验 `event.origin`，发送时也应指定精确 target origin，不能在正式环境无条件使用 `*`。

## 23. client_max_body_size 为什么是 11m

NestJS 允许的 PDF 最大值是 10 MiB，但 Nginx 默认请求体上限通常只有 1 MiB。没有入口配置时，小文件成功，大文件会在到达 NestJS 前得到 413。

Nginx 设置：

```nginx
client_max_body_size 11m;
```

入口上限略高于业务上限，让 NestJS 仍能按自身规则处理接近边界的 multipart 开销。

两层限制各有价值：

- Nginx 尽早拒绝明显过大的流量。
- NestJS 保持最终业务规则和统一错误处理。

## 24. 其他安全响应头

当前还设置：

- `X-Content-Type-Options: nosniff`：减少浏览器把一种类型猜成另一种类型。
- `Referrer-Policy: strict-origin-when-cross-origin`：跨站请求减少泄漏完整路径。
- `X-Frame-Options: SAMEORIGIN`：当前独立应用只允许同源嵌入。

这些响应头不是越多越好。每个头都必须与实际资源、iframe 和客户集成需求一致，并通过浏览器验证。

本地没有启用 HSTS，因为自签名证书与非标准端口实验容易把浏览器锁进不可访问状态。正式环境应在证书、子域策略和回滚方案确认后再逐步启用。

## 25. 正式域名上线的完整思路

假设正式域名是 `review.example.com`，典型流程是：

1. 准备有固定公网 IP 的服务器或负载均衡器。
2. 在 DNS 添加 A/AAAA 记录指向入口。
3. 防火墙只对公网开放 80 和 443。
4. 不公开 PostgreSQL 5432、MinIO 9000/9001 和 API 3000。
5. 使用 Let’s Encrypt、云证书服务或公司 CA 申请可信证书。
6. 把证书和私钥安全注入 Nginx。
7. 把 `HTTPS_PUBLIC_ORIGIN` 配为 `https://review.example.com`。
8. 启动服务并先验证 HTTPS、API、登录和 PDF。
9. 配置 HTTP 到 HTTPS 重定向。
10. 再评估 HSTS、备份、监控、告警和回滚。

本课不会伪造一个不存在的域名，也不会把自签名证书冒充生产方案。

## 26. 生产环境应该隐藏哪些端口

当前 Compose 为学习方便，把各服务映射到 Windows：

- 3000：直接调试 API。
- 5432：本机 Prisma 连接数据库。
- 9000/9001：访问 MinIO 与 Console。

正式服务器通常只公开入口 Nginx 的 80/443。其他服务仅在容器网络可达，管理员通过受控运维通道访问。

“没有前端链接”不等于端口安全。只要端口绑定公网地址，扫描者就可能发现它。

## 27. 本地 HTTPS 的完整启动与停止

首次生成证书：

```powershell
pnpm https:cert
```

启动：

```powershell
pnpm stack:https:up
docker compose --file compose.yaml --file compose.https.yaml ps
```

访问：

```text
https://localhost:8443
```

停止并保留 Volume：

```powershell
pnpm stack:https:down
```

重新运行 `https:cert` 会替换本地学习证书，已打开的浏览器需要重新建立连接。

## 28. 局域网实验需要同时修改什么

假设 Docker 主机是 `192.168.2.15`：

```powershell
pnpm https:cert -- 192.168.2.15
```

根目录 `.env` 增加：

```text
HTTPS_PUBLIC_ORIGIN=https://192.168.2.15:8443
```

然后重新运行 `pnpm stack:https:up`。还要确认：

- Windows 防火墙允许 8443。
- 同事访问的就是证书 SAN 中的 IP。
- 自签名证书在同事浏览器仍会显示不受信任。

真正交付不要让客户依赖动态局域网 IP 和自签名证书，应使用稳定域名和可信证书。

## 29. 常见故障排查

### Nginx 提示找不到证书

先运行 `pnpm https:cert`，确认 `.certs/dev.crt` 与 `.certs/dev.key` 存在，再启动 HTTPS 组合。

### 浏览器显示名称不匹配

你访问的 IP 或域名不在证书 SAN 中。使用 localhost、127.0.0.1，或重新生成包含局域网 IP 的证书。

### 页面 HTTPS 正常，PDF 报 Mixed Content

检查 API 返回的预览 URL。HTTPS 模式应以同一入口的 `/storage/` 开头，不应仍指向 `http://...:9000`。

### /storage 返回 403 SignatureDoesNotMatch

确认 Nginx 移除了 `/storage` 前缀并保留 `$http_host`，也不要解析后重新拼写签名查询参数。

### /storage 返回 502

确认 MinIO healthy，并确认代理目标使用 Compose 服务名 `minio:9000`，不是 localhost。

### 上传稍大的 PDF 返回 413

检查 `client_max_body_size` 是否加载，并确认请求确实经过当前 Nginx 配置。

### 客户系统无法嵌入页面

查看浏览器控制台中的 CSP 或 X-Frame-Options 报错。跨域嵌入需要精确配置 `frame-ancestors`，并移除冲突的 SAMEORIGIN。

### API 报 CORS，但当前架构本应同源

先检查前端是否写死了另一个 API 域名。相对 `/api` 经同一 Nginx 入口不应触发 CORS。

## 30. 本课已完成的真实验证

本课实际验证了：

1. 自签名证书成功生成且未进入 Git。
2. HTTPS Compose 合并配置合法。
3. 四个服务启动后均 healthy。
4. `https://localhost:8443/` 返回 200。
5. `/api/health` 经 HTTPS Nginx 返回 ok。
6. viewer 能通过 HTTPS 登录并读取 3 条文件记录。
7. 预览 URL 使用 `https://localhost:8443/storage/`。
8. `/storage` 代理保留 MinIO 签名并返回 200 `application/pdf`。
9. CSP 与 X-Frame-Options 响应头存在。
10. 新增 URL 处理单元测试全部通过。

验证没有上传或删除文件，开发 PostgreSQL 和 MinIO Volume 保持原状。

## 31. 建议亲手完成的实验

### 实验 A：比较 HTTP 与 HTTPS

分别打开 8080 和 8443，在浏览器 Network 中查看协议、端口和响应头。说明为什么两个页面内容相同，但安全上下文不同。

### 实验 B：查看证书 SAN

点击浏览器证书详情，找到 localhost、127.0.0.1 和有效期。解释为什么换成另一个 IP 会名称不匹配。

### 实验 C：跟踪一个 PDF 请求

点击预览，观察：

```text
/api/documents/:id/preview-url
/storage/fullstack-documents/...
```

区分“申请临时地址”和“使用临时地址读取文件”两次请求。

### 实验 D：观察 CSP

在 Network 中查看 HTML 的 Content-Security-Policy。逐项对照 React 的脚本、样式、fetch 和 iframe 为什么仍能加载。

### 实验 E：判断是否需要 CORS

记录页面 URL 和 API 请求 URL 的协议、主机、端口。三者完全相同即可证明是同源，不要只看 API 最终运行在另一个容器。

## 32. 本课自测

<details>
<summary>1. HTTPS 提供哪三类核心保护？</summary>

传输机密性、内容完整性和服务器身份验证。
</details>

<details>
<summary>2. 自签名证书为什么会被浏览器警告？</summary>

它的签发链无法连接到浏览器预置信任的 CA，因此浏览器不能自动确认服务器身份。
</details>

<details>
<summary>3. 为什么 HTTPS 页面不能继续嵌入 HTTP PDF？</summary>

HTTP 子资源可被读取或篡改，会破坏外层 HTTPS 的安全保证，因此浏览器按混合内容规则阻止。
</details>

<details>
<summary>4. /storage 为什么能解决混合内容？</summary>

浏览器只访问同一个 HTTPS Nginx 入口，Nginx 再从隔离容器网络读取 MinIO。
</details>

<details>
<summary>5. 为什么转发 MinIO 签名 URL 要保留 Host？</summary>

Signature V4 把 Host 纳入签名；改成内部主机名会让 MinIO 计算出不同签名。
</details>

<details>
<summary>6. 当前项目为什么不需要 CORS？</summary>

页面、API 和文件对浏览器都呈现为同一协议、主机与端口，内部反向代理不改变浏览器眼中的源。
</details>

<details>
<summary>7. frame-src 与 frame-ancestors 分别控制什么？</summary>

frame-src 控制当前页面可以加载哪些 iframe；frame-ancestors 控制哪些父页面可以嵌入当前页面。
</details>

<details>
<summary>8. 为什么生产环境不能提交私钥或放进镜像？</summary>

源码和镜像会被复制、缓存和分发，私钥一旦泄漏，攻击者可冒充服务或解密特定场景下的流量。
</details>

<details>
<summary>9. client_max_body_size 与 NestJS 文件上限为什么都要有？</summary>

Nginx负责尽早限制入口流量，NestJS 负责最终业务规则；代理上限应为 multipart 开销留少量空间。
</details>

<details>
<summary>10. 正式上线为什么通常只公开 80 和 443？</summary>

数据库、对象存储和 API 由统一入口或内部网络访问，减少直接暴露服务和攻击面。
</details>

## 33. 本课涉及的文件

| 文件 | 作用 |
| --- | --- |
| `compose.https.yaml` | 在基础 Compose 上增加 HTTPS 与同源存储代理配置 |
| `apps/web/nginx.https.conf` | TLS、CSP、API 和 `/storage` 代理 |
| `apps/web/nginx.conf` | 普通 HTTP 模式的上传上限与基础安全头 |
| `scripts/generate-dev-certificate.mjs` | 使用固定 OpenSSL 镜像生成本地证书 |
| `.certs/` | 被 Git 忽略的本地证书与私钥 |
| `minio.config.ts` | 校验并应用公共路径前缀 |
| `minio-file-storage.service.ts` | 返回带 `/storage` 前缀的临时 URL |
| `minio.config.spec.ts` | 验证安全路径和签名查询参数保持不变 |
| `.env.docker.example` | 记录普通模式的公共路径配置 |

## 34. 本课完成标准

- 你能解释自签名证书与受信任 CA 证书的区别。
- `pnpm stack:https:up` 后 8443 可访问。
- 页面、API 和 PDF 都通过同一 HTTPS 来源。
- PDF URL 包含 `/storage` 且实际返回 200。
- 你能解释 Nginx 为什么必须移除前缀并保留 Host。
- 你能判断当前请求是否同源、是否真的需要 CORS。
- 你能区分 `frame-src` 和 `frame-ancestors`。
- 你知道外部客户 iframe 集成不能保留 SAMEORIGIN。
- 你能列出正式上线前的 DNS、证书、防火墙、密钥和端口工作。

达到这些标准后进入第 9 课：搭建 CI 流水线，自动执行类型检查、测试和镜像构建，并学习版本标签、部署、备份与回滚的基本流程。
