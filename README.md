# TypeScript 全栈学习项目

这个仓库用于从前端开发逐步学习完整项目交付。技术栈统一使用 TypeScript，减少语言切换：

- `apps/web`：React + Vite + Tailwind
- `apps/api`：Node.js + NestJS
- 基础设施：PostgreSQL + MinIO + Docker Compose
- 后续加入：自动化测试、完整 Docker 化、Nginx 和 CI/CD

## 当前进度

- 第 1 课：浏览器调用后端健康检查接口。
- 第 2 课：使用 PostgreSQL 和 Prisma 查询、保存专家评分。
- 第 3 课：使用 DTO 校验参数，并统一 API 错误格式。
- 第 4 课：使用 JWT 确认用户身份，并按角色保护评分接口。
- 第 5A 课：上传 PDF，将文件内容与数据库元数据分开保存并鉴权预览。
- 第 5B 课：把 PDF 从本地目录迁移到 MinIO 对象存储，并保留鉴权预览。

## 启动

环境要求：Node.js 20+、pnpm 10+。

```powershell
cd D:\projects\fullstack-learning-lab
pnpm install
pnpm infra:up
pnpm db:migrate
pnpm dev
```

`db:migrate` 首次运行或数据库结构变化时执行，日常启动只需 `pnpm infra:up` 和 `pnpm dev`。

如果你是从第 5A 课升级，并且本地目录中已经有 PDF，只需额外执行一次：

```powershell
pnpm storage:migrate-local
```

迁移脚本可重复执行，且不会删除本地文件。

启动后访问：

- 前端：`http://localhost:5173`
- 后端接口：`http://localhost:3000/api/health`
- MinIO Console：`http://localhost:9001`（本地学习账号见第 5B 课讲义）

停止服务：在终端按 `Ctrl+C`。

## 推荐学习方式

1. 按顺序阅读 `docs/01-http-api.md` 到 `docs/05b-minio-object-storage.md`。
2. 第一次接触 NestJS 或 JWT 时，再阅读 `docs/04b-auth-code-walkthrough.md`。
3. 使用专家账号上传一个 PDF，并在 Prisma Studio 查看 `Document` 元数据。
4. 使用查看账号完成一次鉴权预览。
5. 能解释 Bucket、对象键和 Docker Volume 后，再进入下一课。

完整路线见 `docs/roadmap.md`，陌生词汇见 `docs/glossary.md`。

## 常用命令

```powershell
pnpm dev      # 同时启动前端和后端
pnpm check    # TypeScript 静态检查
pnpm build    # 生成生产构建
pnpm db:up    # 启动 PostgreSQL
pnpm db:down  # 停止 PostgreSQL
pnpm db:studio # 可视化查看数据库
pnpm infra:up  # 启动 PostgreSQL 和 MinIO
pnpm infra:down # 停止基础设施容器
pnpm storage:migrate-local # 将第 5A 课的本地文件复制到 MinIO
```

学习阶段不要把 Token、密码或数据库连接信息提交到 Git；本地配置放在 `.env`。
