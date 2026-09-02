# TypeScript 全栈学习项目

这个仓库用于从前端开发逐步学习完整项目交付。技术栈统一使用 TypeScript，减少语言切换：

- `apps/web`：React + Vite + Tailwind
- `apps/api`：Node.js + NestJS
- 后续加入：PostgreSQL、Prisma、鉴权、测试、Docker、Nginx 和 CI/CD

## 当前进度

已完成第 1 课：浏览器调用后端健康检查接口。先理解一次 HTTP 请求如何从页面到达后端，再逐步增加业务复杂度。

## 启动

环境要求：Node.js 20+、pnpm 10+。

```powershell
cd D:\projects\fullstack-learning-lab
pnpm install
pnpm dev
```

启动后访问：

- 前端：`http://localhost:5173`
- 后端接口：`http://localhost:3000/api/health`

停止服务：在终端按 `Ctrl+C`。

## 推荐学习方式

1. 先阅读 `docs/01-http-api.md`。
2. 自己启动项目并点击“重新请求”。
3. 给健康接口增加一个字段，同时修改前端类型和页面展示。
4. 能解释请求经过的每一层后，再进入下一课。

完整路线见 `docs/roadmap.md`，陌生词汇见 `docs/glossary.md`。

## 常用命令

```powershell
pnpm dev      # 同时启动前端和后端
pnpm check    # TypeScript 静态检查
pnpm build    # 生成生产构建
```

学习阶段不要把 Token、密码或数据库连接信息提交到 Git；本地配置放在 `.env`。
