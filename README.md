# TypeScript 全栈学习项目

这个仓库用于从前端开发逐步学习完整项目交付。当前技术栈：

- `apps/web`：React + Vite + Tailwind
- `apps/api`：Node.js + NestJS + Prisma
- 基础设施：PostgreSQL + MinIO + Docker Compose
- 后续课程：自动化测试、完整 Docker 化、Nginx、HTTPS 和 CI/CD

## 当前进度

- 第 1 课：HTTP 与前后端联调。
- 第 2 课：PostgreSQL 与 Prisma。
- 第 3 课：DTO 参数校验和统一错误响应。
- 第 4 课：JWT 认证和角色授权。
- 第 5A 课：PDF 上传、本地存储和鉴权预览。
- 第 5B 课：将 PDF 迁移到 MinIO 对象存储。
- 第 5C 课：鉴权后生成短期签名 URL，浏览器直连 MinIO 预览。
- 第 6A 课（当前）：使用 Vitest 和 Nest TestingModule 编写后端单元测试。

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
| React 页面 | `http://localhost:5173` | 操作完整功能 |
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

## 五、怎么停止

1. 在运行 `pnpm dev` 的终端按 `Ctrl+C`，停止前端和后端。
2. 如果不再使用数据库和 MinIO，再执行：

```powershell
pnpm infra:down
```

`infra:down` 会停止并移除容器，但保留 Docker Volume 中的数据。不要随意运行 `docker compose down -v`，`-v` 会删除数据库和 MinIO 的持久化数据。

## 六、修改代码后怎么检查

```powershell
pnpm check
pnpm test
pnpm build
docker compose config --quiet
```

- `check`：只做 TypeScript 类型检查。
- `test`：运行后端单元测试；第 6A 课的测试不依赖数据库和 MinIO。
- `build`：生成前端和后端生产构建。
- `docker compose config --quiet`：检查 Compose 配置语法。

## 七、常见启动问题

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

### 页面能打开，但接口请求失败

先直接访问 `http://localhost:3000/api/health`。如果打不开，查看 `pnpm dev` 终端中的 NestJS 错误；如果提示数据库或 MinIO 连接失败，再检查 `docker compose ps`。

### 签名预览地址指向错误电脑

本机学习使用 `MINIO_PUBLIC_URL=http://127.0.0.1:9000`。如果让局域网其他电脑访问，应将它改为运行 MinIO 那台电脑可被访问的 IP 和端口，然后重启后端。

## 八、课程资料

建议按顺序阅读 `docs`：

- 第 4 课慢速拆解：`docs/04b-auth-code-walkthrough.md`
- 第 5A 课：`docs/05a-local-file-upload.md`
- 第 5B 课：`docs/05b-minio-object-storage.md`
- 第 5C 课：`docs/05c-presigned-preview-url.md`
- 第 6A 课：`docs/06a-backend-unit-tests.md`
- 完整学习路线：`docs/roadmap.md`
- 陌生术语：`docs/glossary.md`

## 九、常用命令速查

```powershell
pnpm dev                   # 同时启动前端和后端
pnpm check                 # TypeScript 静态检查
pnpm test                  # 运行一次后端单元测试
pnpm test:watch            # 监听代码变化并重复运行相关测试
pnpm build                 # 生成生产构建
pnpm infra:up              # 启动 PostgreSQL 和 MinIO
pnpm infra:down            # 停止基础设施，保留 Volume 数据
pnpm db:up                 # 只启动 PostgreSQL
pnpm db:down               # 只停止 PostgreSQL
pnpm db:migrate            # 执行 Prisma 数据库迁移
pnpm db:studio             # 可视化查看数据库
pnpm db:logs               # 持续查看 PostgreSQL 日志
pnpm storage:migrate-local # 将第 5A 课旧文件复制到 MinIO
```
