# TypeScript 全栈学习项目

这个仓库用于从前端开发逐步学习完整项目交付。技术栈统一使用 TypeScript，减少语言切换：

- `apps/web`：React + Vite + Tailwind
- `apps/api`：Node.js + NestJS
- 后续加入：PostgreSQL、Prisma、鉴权、测试、Docker、Nginx 和 CI/CD

## 当前进度

- 第 1 课：浏览器调用后端健康检查接口。
- 第 2 课：使用 PostgreSQL 和 Prisma 查询、保存专家评分。
- 第 3 课：使用 DTO 校验参数，并统一 API 错误格式。

## 启动

环境要求：Node.js 20+、pnpm 10+。

```powershell
cd D:\projects\fullstack-learning-lab
pnpm install
pnpm db:up
pnpm db:migrate
pnpm dev
```

`db:migrate` 首次运行或数据库结构变化时执行，日常启动只需 `pnpm db:up` 和 `pnpm dev`。

启动后访问：

- 前端：`http://localhost:5173`
- 后端接口：`http://localhost:3000/api/health`

停止服务：在终端按 `Ctrl+C`。

## 推荐学习方式

1. 按顺序阅读 `docs/01-http-api.md`、`docs/02-database-prisma.md` 和 `docs/03-validation-errors.md`。
2. 在页面依次尝试保存 `3.5`、`4.5` 和 `3.2` 分。
3. 对照页面上的错误码，找到后端抛出该错误的位置。
4. 能解释 DTO 校验和业务校验的区别后，再进入下一课。

完整路线见 `docs/roadmap.md`，陌生词汇见 `docs/glossary.md`。

## 常用命令

```powershell
pnpm dev      # 同时启动前端和后端
pnpm check    # TypeScript 静态检查
pnpm build    # 生成生产构建
pnpm db:up    # 启动 PostgreSQL
pnpm db:down  # 停止 PostgreSQL
pnpm db:studio # 可视化查看数据库
```

学习阶段不要把 Token、密码或数据库连接信息提交到 Git；本地配置放在 `.env`。
