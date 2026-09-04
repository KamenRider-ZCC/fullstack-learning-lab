# TypeScript 全栈学习项目

这个仓库用于从前端开发逐步学习完整项目交付。当前技术栈：

- `apps/web`：React + Vite + Tailwind
- `apps/api`：Node.js + NestJS + Prisma
- 基础设施：PostgreSQL + MinIO + Docker Compose
- 工程化：GitHub Actions、GHCR、生产 Compose、备份和回滚

如果你以前只做过前端、准备主要借助 AI 学习和开发，请先阅读：`docs/00-ai-fullstack-essential-guide.md`。它说明哪些知识必须亲自理解、哪些工作可以交给 Codex，以及接受 AI 代码前应检查什么。

## 当前进度

- 第 1 课：HTTP 与前后端联调。
- 第 2 课：PostgreSQL 与 Prisma。
- 第 3 课：DTO 参数校验和统一错误响应。
- 第 4 课：JWT 认证和角色授权。
- 第 5A 课：PDF 上传、本地存储和鉴权预览。
- 第 5B 课：将 PDF 迁移到 MinIO 对象存储。
- 第 5C 课：鉴权后生成短期签名 URL，浏览器直连 MinIO 预览。
- 第 6A 课：使用 Vitest 和 Nest TestingModule 编写后端单元测试。
- 第 6B 课：使用隔离的 PostgreSQL 和 MinIO 完成 API 集成测试。
- 第 6C 课：使用 Vitest、jsdom 和 Testing Library 完成 React 组件测试。
- 第 7 课：为前后端制作生产镜像，并用 Docker Compose 启动完整系统。
- 第 8 课：使用 Nginx 统一入口，学习本地 HTTPS、CSP、CORS 和 iframe 安全边界。
- 第 9 课（当前）：使用 CI 自动检查并发布镜像，学习生产配置、备份和可回滚发布。

## 一、运行前准备

安装并启动以下软件：

- Node.js 20 或更高版本
- pnpm 10（项目声明版本为 10.12.4）
- Docker Desktop，并确认 Docker Engine 已经启动

在 PowerShell 中检查：

```powershell
node --version
pnpm --version
docker --version
docker compose version
```

如果已有 Node.js、但没有 pnpm，可以运行：

```powershell
corepack enable
corepack prepare pnpm@10.12.4 --activate
```

## 二、第一次完整启动

### 1. 进入项目并安装依赖

```powershell
cd D:\projects\fullstack-learning-lab
pnpm install
```

### 2. 创建本地环境变量

`.env` 不会提交到 Git。第一次运行时复制示例文件：

```powershell
if (!(Test-Path apps/api/.env)) {
  Copy-Item apps/api/.env.example apps/api/.env
}
```

学习环境可以先使用示例配置。正式项目必须更换数据库密码、MinIO 密钥和 `JWT_SECRET`，不能把真实密钥提交到 Git。

### 3. 启动 PostgreSQL 和 MinIO

先确保 Docker Desktop 正在运行，然后执行：

```powershell
pnpm infra:up
docker compose ps
```

应看到 `postgres` 和 `minio` 都处于运行状态。PostgreSQL 首次启动可能需要几秒钟。

### 4. 创建或更新数据库表

```powershell
pnpm db:migrate
```

首次运行会创建数据库表；以后 Prisma 模型或迁移发生变化时再次运行。它不会清空已有评分和文件记录。

### 5. 仅在从第 5A 课升级时迁移旧 PDF

全新项目没有旧文件，可以跳过此步。如果 `apps/api/storage/uploads` 中已有第 5A 课上传的文件，执行：

```powershell
pnpm storage:migrate-local
```

脚本可以重复执行，已存在且大小一致的对象会被跳过，本地原文件不会删除。

### 6. 启动前端和后端开发服务

```powershell
pnpm dev
```

这个终端需要保持运行。命令会同时启动：

- React 前端：`http://localhost:5173`
- NestJS API：`http://localhost:3000`

看到前后端的启动日志后，打开 `http://localhost:5173`。

## 三、登录和访问地址

演示业务账号：

| 用户名 | 密码 | 权限 |
| --- | --- | --- |
| `expert` | `demo123456` | 评分、上传、预览 |
| `viewer` | `demo123456` | 只读和预览 |

常用地址：

| 页面或服务 | 地址 | 用途 |
| --- | --- | --- |
| React 开发页面 | `http://localhost:5173` | 使用 Vite 开发服务操作完整功能 |
| Docker 完整页面 | `http://localhost:8080` | 使用 Nginx 访问容器化系统 |
| Docker HTTPS 页面 | `https://localhost:8443` | 使用本地自签名证书学习 HTTPS |
| API 健康检查 | `http://localhost:3000/api/health` | 确认 NestJS 可访问 |
| MinIO Console | `http://localhost:9001` | 查看 Bucket 和对象 |

MinIO 本地学习账号为 `minioadmin / minioadmin123`。端口 9001 是管理页面；后端和签名 URL 使用 9000。

## 四、以后每天怎么启动

Docker Desktop 启动后，在项目目录执行：

```powershell
pnpm infra:up
pnpm dev
```

日常启动不需要重复安装依赖、迁移数据库或迁移旧文件，除非依赖、数据库结构或课程说明发生了变化。

## 五、用 Docker 启动完整系统

这种方式不需要在本机运行 `pnpm dev`，前端、后端、PostgreSQL 和 MinIO 都在容器中运行。先在 `pnpm dev` 的终端按 `Ctrl+C`，避免 3000 端口冲突。

第一次可复制 Docker 环境变量示例：

```powershell
if (!(Test-Path .env)) {
  Copy-Item .env.docker.example .env
}
```

`apps/api/.env` 供本机开发进程使用；根目录 `.env` 供 Docker Compose 使用，两者不要混淆。本地学习可以直接使用示例值，正式部署必须更换密码和 `JWT_SECRET`。

构建镜像并启动全部服务：

```powershell
pnpm stack:up
docker compose ps
```

等待四个服务都显示 `healthy`，然后打开 `http://localhost:8080`。代码修改后再次运行 `pnpm stack:up`，Compose 会重新构建有变化的镜像。

只重新构建镜像、不启动容器：

```powershell
pnpm stack:build
```

### 本地 HTTPS 模式

第一次先生成本地自签名证书，再启动 HTTPS 组合配置：

```powershell
pnpm https:cert
pnpm stack:https:up
```

打开 `https://localhost:8443`。浏览器会提示证书不受信任，这是自签名学习证书的正常现象；正式环境必须使用受信任 CA 为真实域名签发的证书。

HTTPS 页面中的 PDF 会通过同源 `/storage` 入口转发到 MinIO，不会产生“HTTPS 页面嵌入 HTTP 文件”的混合内容错误。证书和私钥保存在被 Git 忽略的 `.certs`，不能提交或用于正式环境。

### 第 9 课：生产配置、发布和备份

GitHub Actions 配置在 `.github/workflows/ci.yml`：Pull Request 只做检查、测试和构建；代码进入 `master` 或推送 `v*` 标签后，还会把 API、Web 镜像发布到 GHCR。它不会自动连接真实服务器，因此当前属于“自动交付镜像、人工确认上线”。

第一次准备生产服务器时，复制并修改生产环境变量：

```powershell
Copy-Item .env.production.example .env.production
```

必须替换示例域名、镜像 SHA 标签、数据库密码、MinIO 密钥、JWT 密钥和证书路径。`.env.production` 含真实密钥，已被 Git 和 Docker 构建忽略。修改后先检查配置，不启动服务：

```powershell
pnpm production:config
```

服务器登录 GHCR 后，发布命令是：

```powershell
docker compose --env-file .env.production --file compose.production.yaml pull
docker compose --env-file .env.production --file compose.production.yaml up --detach
docker compose --env-file .env.production --file compose.production.yaml ps
```

生产配置只公开 Nginx 的 80/443，PostgreSQL、MinIO 和 API 只允许容器网络访问。真实上线前还要由运维准备域名、可信 HTTPS 证书、防火墙和异机备份位置。本课程不会替你连接或修改真实服务器。

本地可对当前开发数据执行一次只读式备份实验：

```powershell
pnpm backup:create
pnpm backup:verify
```

备份位于被 Git 忽略的 `backups/development/<时间戳>`，包括 PostgreSQL 自定义格式归档、MinIO 对象副本和 SHA-256 清单。验证只检查文件与数据库归档是否可读，不会执行恢复。生产环境使用 `pnpm backup:create:production`，要求生产 Compose 正在运行且 `.env.production` 正确。

完整原理、首次上线步骤、回滚演练和注意事项见 `docs/09-ci-cd-backup-rollback.md`。

## 六、怎么停止

1. 在运行 `pnpm dev` 的终端按 `Ctrl+C`，停止前端和后端。
2. 如果使用本地开发模式且不再需要数据库和 MinIO，执行：

```powershell
pnpm infra:down
```

`infra:down` 会停止并移除容器，但保留 Docker Volume 中的数据。不要随意运行 `docker compose down -v`，`-v` 会删除数据库和 MinIO 的持久化数据。

完整 Docker 模式使用：

```powershell
pnpm stack:down
```

如果使用 HTTPS 组合配置，也可以执行：

```powershell
pnpm stack:https:down
```

它同样保留 Volume。查看容器化前后端日志可运行 `pnpm stack:logs`，按 `Ctrl+C` 只退出日志跟随，不会停止容器。

## 七、修改代码后怎么检查

```powershell
pnpm check
pnpm test
pnpm test:integration
pnpm build
pnpm stack:build
docker compose config --quiet
docker compose --file compose.yaml --file compose.https.yaml config --quiet
docker compose --env-file .env.production.example --file compose.production.yaml config --quiet
```

- `check`：只做 TypeScript 类型检查。
- `test`：运行后端单元测试和前端组件测试；不依赖数据库、MinIO 或真实浏览器。
- `test:integration`：临时启动隔离测试基础设施，执行真实 API 测试并自动清理。
- `build`：生成前端和后端生产构建。
- `stack:build`：在 Linux 容器内构建前端和后端生产镜像。
- `docker compose config --quiet`：检查 Compose 配置语法。
- 第二条 Compose 命令：检查基础配置与 HTTPS 覆盖配置合并后是否合法。
- 第三条 Compose 命令：用无真实密钥的示例变量检查生产 Compose 语法。

## 八、常见启动问题

### `P1001: Can't reach database server at localhost:5432`

PostgreSQL 没有运行。启动 Docker Desktop，然后执行：

```powershell
pnpm infra:up
docker compose ps
```

### 5173、3000、5432、9000 或 9001 端口被占用

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object LocalPort -in 5173,3000,5432,9000,9001 |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

停止重复启动的旧进程，或调整对应配置后再运行。

Docker 页面默认还会占用 8080。不能同时运行占用 3000 的 `pnpm dev` 后端和默认 Docker API；先在开发终端按 `Ctrl+C`，或者只为临时调试修改根目录 `.env` 中的 `API_HOST_PORT`。

### 页面能打开，但接口请求失败

先直接访问 `http://localhost:3000/api/health`。如果打不开，查看 `pnpm dev` 终端中的 NestJS 错误；如果提示数据库或 MinIO 连接失败，再检查 `docker compose ps`。

### 签名预览地址指向错误电脑

本机学习使用 `MINIO_PUBLIC_URL=http://127.0.0.1:9000`。如果让局域网其他电脑访问，应在对应环境变量文件中把它改为运行 MinIO 那台电脑可被访问的 IP 和端口，然后重启后端或重建 API 容器。

### Docker API 一直 unhealthy

先运行 `docker compose logs api`。如果迁移失败，检查 PostgreSQL 是否 healthy 以及根目录 `.env` 的数据库账号是否一致；如果 3000 被占用，先停止本地开发后端。

### Docker 页面打开，但 `/api` 返回 502

运行 `docker compose ps` 和 `docker compose logs api web`。Web 容器通过服务名 `api:3000` 访问后端，不应把 Nginx 目标改成 `localhost:3000`。

### HTTPS 页面提示连接不安全

`pnpm https:cert` 生成的是自签名证书，浏览器无法自动信任，只适合本机学习。正式上线不能让用户忽略警告，必须把域名解析到服务器并申请受信任证书。

### HTTPS 页面能打开，但 PDF 被浏览器拦截

确认使用 `pnpm stack:https:up`，并检查预览 URL 是否以当前 HTTPS 入口的 `/storage/` 开头。如果仍是 `http://...:9000`，说明 API 没有加载 `compose.https.yaml` 中的公共地址配置。

## 九、课程资料

建议按顺序阅读 `docs`：

- AI 全栈必备知识地图：`docs/00-ai-fullstack-essential-guide.md`
- 第 4 课慢速拆解：`docs/04b-auth-code-walkthrough.md`
- 第 5A 课：`docs/05a-local-file-upload.md`
- 第 5B 课：`docs/05b-minio-object-storage.md`
- 第 5C 课：`docs/05c-presigned-preview-url.md`
- 第 6A 课：`docs/06a-backend-unit-tests.md`
- 第 6B 课：`docs/06b-api-integration-tests.md`
- 第 6C 课：`docs/06c-frontend-component-tests.md`
- 第 7 课：`docs/07-dockerize-full-stack.md`
- 第 8 课：`docs/08-nginx-https-security.md`
- 第 9 课：`docs/09-ci-cd-backup-rollback.md`
- 完整学习路线：`docs/roadmap.md`
- 陌生术语：`docs/glossary.md`

## 十、常用命令速查

```powershell
pnpm dev                   # 同时启动前端和后端
pnpm check                 # TypeScript 静态检查
pnpm test                  # 运行一次后端单元测试和前端组件测试
pnpm test:watch            # 同时监听前后端代码变化并重复运行相关测试
pnpm test:integration      # 启动隔离基础设施并运行 API 集成测试
pnpm test:all              # 依次运行单元测试和 API 集成测试
pnpm build                 # 生成生产构建
pnpm infra:up              # 启动 PostgreSQL 和 MinIO
pnpm infra:down            # 停止基础设施，保留 Volume 数据
pnpm stack:build           # 构建前端和后端 Docker 镜像
pnpm stack:up              # 构建并启动四个服务
pnpm stack:down            # 停止完整容器系统，保留 Volume 数据
pnpm stack:logs            # 持续查看容器化前后端日志
pnpm https:cert            # 生成被 Git 忽略的本地自签名证书
pnpm stack:https:up        # 构建并启动 HTTP + HTTPS 学习环境
pnpm stack:https:down      # 停止 HTTPS 组合环境并保留 Volume
pnpm production:config     # 使用真实 .env.production 检查生产 Compose
pnpm backup:create         # 备份当前开发 Compose 的数据库和 MinIO
pnpm backup:create:production # 备份正在运行的生产 Compose
pnpm backup:verify         # 校验最近一次备份，不恢复数据
pnpm db:up                 # 只启动 PostgreSQL
pnpm db:down               # 只停止 PostgreSQL
pnpm db:migrate            # 执行 Prisma 数据库迁移
pnpm db:studio             # 可视化查看数据库
pnpm db:logs               # 持续查看 PostgreSQL 日志
pnpm storage:migrate-local # 将第 5A 课旧文件复制到 MinIO
```
