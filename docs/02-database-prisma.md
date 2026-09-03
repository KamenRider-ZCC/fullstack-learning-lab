# 第 2 课：让专家评分真正保存下来

## 本课目标

把评分从 React 内存状态保存到 PostgreSQL。页面刷新后，后端仍能从数据库读取上次保存的结果。

## 数据流

```text
React 表单
  → PUT /api/review-items/:id/score
  → ReviewController 读取参数
  → ReviewService 检查分数规则
  → Prisma 生成 SQL
  → PostgreSQL 写入 ExpertScore
  → 返回 JSON
  → React 显示保存时间
```

查询时使用：

```text
GET /api/review-items/review-progress-plan
    ?bidderId=demo-bidder
```

> 课程演进说明：第 2 课最初由查询参数传递 `expertId`。完成第 4 课后，接口已受 JWT 保护，后端会从已验签的 Token 中取得专家 ID，不能再由前端指定。现在需要先登录，再携带 `Authorization: Bearer <token>` 请求头。

## 启动数据库

`compose.yaml` 描述了一个 PostgreSQL 16 容器和持久化 Volume：

```powershell
pnpm db:up
```

如果出现 `dockerDesktopLinuxEngine`、`500 Internal Server Error` 或 WSL2 不可用，说明 Docker 的 Linux 引擎没有正常运行。先确认 Docker Desktop 已启动，并执行：

```powershell
docker version
wsl --status
```

`docker version` 必须同时显示 Client 和 Server。若系统提示 WSL2/虚拟化不可用，需要启用 Windows 的“适用于 Linux 的 Windows 子系统”和“虚拟机平台”，确认 BIOS 虚拟化已开启，然后重启电脑。

检查数据库容器：

```powershell
docker compose ps
pnpm db:logs
```

`db:logs` 会持续显示日志，按 `Ctrl+C` 退出日志查看，不会停止数据库。

## 数据库迁移

`apps/api/prisma/schema.prisma` 是数据库结构的源代码。首次运行：

```powershell
pnpm db:migrate
```

迁移会完成三件事：

1. 对比 Prisma 模型和数据库结构。
2. 生成可追踪的 SQL 文件。
3. 更新数据库并生成类型安全的 Prisma Client。

查看真实数据：

```powershell
pnpm db:studio
```

## 两张表的职责

- `ReviewItem`：保存评审项、评分细则、满分和 AI 建议分。
- `ExpertScore`：保存某位专家对某个投标人的正式评分。

`reviewItemId + bidderId + expertId` 设置了联合唯一约束，因此同一组合只会保留一条当前评分。再次保存使用 `upsert`：没有记录就新增，有记录就更新。

这里的 `expertId` 仍然存在于数据库记录中，但它来自后端确认的登录身份。“数据库需要保存专家 ID”和“允许浏览器提交专家 ID”是两件不同的事。

## 重点文件

- `compose.yaml`：启动 PostgreSQL。
- `apps/api/prisma/schema.prisma`：定义表和关系。
- `apps/api/src/prisma/prisma.service.ts`：管理数据库连接。
- `apps/api/src/review/review.controller.ts`：定义 HTTP 接口。
- `apps/api/src/review/review.service.ts`：查询、校验和保存评分。
- `apps/web/src/api/reviews.ts`：前端接口函数。
- `apps/web/src/components/ReviewScoreCard.tsx`：评分界面。

## 动手练习

1. 保存 `3.5` 分并刷新页面。
2. 在 Prisma Studio 中找到 `ExpertScore` 记录。
3. 再保存 `2.5` 分，观察原记录被更新而不是新增。
4. 尝试保存 `4.5` 或 `3.2`，观察后端拒绝请求。

完成标准：你能解释数据库为什么不会产生重复评分，以及数据为什么在服务重启后仍然存在。
