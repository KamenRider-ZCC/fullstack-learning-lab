# TypeScript 全栈学习项目

这个仓库用于从前端开发逐步学习完整项目交付。技术栈统一使用 TypeScript，减少语言切换：

- `apps/web`：React + Vite + Tailwind
- `apps/api`：Node.js + NestJS
- 后续加入：PostgreSQL、Prisma、鉴权、测试、Docker、Nginx 和 CI/CD

## 当前进度

- 第 1 课：浏览器调用后端健康检查接口。
- 第 2 课：使用 PostgreSQL 和 Prisma 查询、保存专家评分。
- 第 3 课：使用 DTO 校验参数，并统一 API 错误格式。
- 第 4 课：使用 JWT 确认用户身份，并按角色保护评分接口。

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

1. 按顺序阅读 `docs/01-http-api.md` 到 `docs/04-auth-jwt.md`。
2. 第一次接触 NestJS 或 JWT 时，再阅读 `docs/04b-auth-code-walkthrough.md`。
3. 分别使用专家账号和查看账号登录。
4. 在浏览器 Network 面板观察携带 JWT 的请求。
5. 能解释认证与授权的区别后，再进入下一课。

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
