# 第 11F 课：让 AI 完成一次可验收的全栈改动

这一课不要求你背 NestJS、React 或 Prisma API，而是练习以后使用 Codex 开发时最重要的能力：把需求说清楚、判断修改范围、识别风险，并用证据验收 AI 的结果。

## 1. 本课改动

把原来可选的“评分说明”改为：

- 专家保存评分时必须填写评分说明。
- 去除首尾空格后，评分说明必须包含内容。
- 最多允许 200 个字符。
- 页面显示当前字数和最大字数。
- 保存前去除首尾空格。
- 即使历史数据中已有超长说明，页面也会在再次保存前阻止请求。
- 后端必须独立执行相同规则，不能只依赖前端。
- 已有评分数据继续正常读取，不修改数据库表结构。

这是一项很小的需求，但会经过完整链路：

```text
React 输入框
  ↓
前端保存函数与 JSON 请求
  ↓
NestJS Controller 和 DTO
  ↓
ReviewService 业务规则
  ↓
Prisma upsert
  ↓
PostgreSQL ExpertScore.feedback
```

## 2. 为什么先写验收条件

“给评分说明加个限制”不是可直接开发的需求，因为 AI 仍然不知道：

- 是否必填；
- 限制 100、200 还是 500 字；
- 空格算不算内容；
- 超长时阻止输入还是允许输入后报错；
- 老数据中 `null` 是否还能读取；
- 是否需要修改数据库字段。

如果这些问题没有答案，AI 只能猜。代码即使能运行，也可能不符合产品要求。

本课把需求明确为以下验收表：

| 场景 | 预期结果 | 负责位置 |
| --- | --- | --- |
| 页面未填写说明就保存 | 页面提示“请填写评分说明”，不发送保存请求 | React |
| 输入有效说明 | 页面显示字数，提交时去除首尾空格 | React |
| 页面读取到 201 字历史数据 | 提示超长且不发送保存请求 | React |
| 绕过页面提交空格 | HTTP 400，`FEEDBACK_REQUIRED` | NestJS Service |
| 绕过页面提交 201 字 | HTTP 400，`FEEDBACK_TOO_LONG` | NestJS Service |
| 提交 1～200 字 | 写入 PostgreSQL 并返回保存结果 | Service + Prisma |
| 读取历史空说明 | 继续返回空字符串，不影响页面 | Service 响应转换 |

## 3. 修改范围是怎样判断的

### 前端输入和提示

文件：`apps/web/src/components/ReviewScoreCard.tsx`

它负责：

- 把单行输入框改为多行 `textarea`；
- 显示 `当前字数 / 200`；
- 空内容时给用户即时提示；
- 对加载自历史数据的超长内容再次执行长度检查；
- 调用接口前使用 `trim()` 去除首尾空格。

前端校验的作用是改善体验，不是安全边界。用户可以使用脚本、Postman 或其他程序绕过页面直接调用 API。

### 前端接口类型

文件：`apps/web/src/api/reviews.ts`

后端在 `reviewItem` 中返回 `feedbackMaxLength`，前端使用这个值设置输入限制和计数器。这样规则由后端给出，页面不需要再单独写一个 `200`。

### DTO 结构校验

文件：`apps/api/src/review/dto/save-score.dto.ts`

`feedback` 由可选字段改为必填字符串。DTO 先回答“请求体的形状是否正确”：

- 没传 `feedback`：不正确；
- 传数字：不正确；
- 传字符串：结构正确，继续进入业务层。

DTO 不负责判断只有空格的字符串是否是有效评分依据。这属于本项目定义的业务规则。

### Controller 传递参数

文件：`apps/api/src/review/review.controller.ts`

原代码使用 `body.feedback || ''` 为可选字段补空字符串。字段改为必填后，Controller 直接把 `body.feedback` 交给 Service，不再偷偷修改含义。

### Service 业务校验

文件：`apps/api/src/review/review.service.ts`

Service 是最终业务规则执行者：

1. 先保留原有分数范围和 0.5 步长规则；
2. 对评分说明执行 `trim()`；
3. 空内容返回 `FEEDBACK_REQUIRED`；
4. 超过 200 字返回 `FEEDBACK_TOO_LONG`；
5. 只把整理后的内容交给 Prisma 保存。

`FEEDBACK_MAX_LENGTH` 定义在后端并随详情接口返回，避免保存规则与页面提示不一致。

### 数据库

文件：`apps/api/prisma/schema.prisma`

本课没有修改 Prisma Schema，也不需要迁移。

原因是 `ExpertScore.feedback` 已经能保存字符串，PostgreSQL 对应列能够容纳 200 字。此次变化只是“应用是否允许为空、允许多长”的业务规则，不是存储结构变化。

已有列仍为可空，可以兼容历史数据。新请求由后端规则保证不会再写入空说明。

## 4. 自动化测试分别证明什么

### Service 单元测试

文件：`apps/api/src/review/review.service.spec.ts`

使用假的 Prisma Provider 验证：

- 空格说明被拒绝，而且 `upsert` 没有执行；
- 201 字说明被拒绝；
- 合法说明去除首尾空格后才交给 Prisma；
- 返回给前端的最大长度为 200。

它很快，但没有连接真实 HTTP 和 PostgreSQL。

### React 组件测试

文件：`apps/web/src/components/ReviewScoreCard.spec.tsx`

使用假的 API 验证：

- 页面显示字数和最大长度；
- 空说明时不会调用保存接口；
- 从旧数据加载的超长说明也不会调用保存接口；
- 合法说明去除首尾空格后才交给 API 函数。

它证明页面行为，不证明后端安全。

### API 集成测试

文件：`apps/api/src/integration/document-api.integration.spec.ts`

它通过真实 NestJS HTTP 管道、JWT、Guard、Service、测试 PostgreSQL 和测试 MinIO 验证：

- 伪造专家 ID 仍被拒绝；
- 空格说明返回 `FEEDBACK_REQUIRED`；
- 201 字说明返回 `FEEDBACK_TOO_LONG`；
- 合法评分可以持久化；
- 查看角色仍不能评分。

## 5. AI 写完代码后你必须检查什么

你不需要逐行背代码，但至少要能回答：

1. 本次改动修改了哪些层，为什么没有 Prisma 迁移？
2. 为什么前端已经限制 200 字，后端还要再次校验？
3. 空格说明为什么由 Service 判断，而不是只靠 `@IsNotEmpty()`？
4. 哪个测试证明“数据库写入没有发生”，哪个测试证明页面没有发送请求？
5. 这次改动会不会让旧版本前端保存失败？

第 5 题的答案是“会”。旧前端可能不发送 `feedback`，新 DTO 会返回 400。因此真实项目上线时，前后端需要一起发布，或者先让后端兼容一段时间。课程项目采用前后端一起发布。

## 6. 先运行快速自动检查

在项目根目录执行：

```powershell
pnpm check
pnpm --filter @fullstack-lab/api exec vitest run src/review/review.service.spec.ts
pnpm --filter @fullstack-lab/web exec vitest run src/components/ReviewScoreCard.spec.tsx
```

它们依次检查 TypeScript、后端业务规则和前端交互。

需要验证真实 HTTP、数据库和 MinIO 时再运行：

```powershell
pnpm test:integration
```

集成测试会创建隔离环境，不使用日常开发数据库。

## 7. 手工验收页面

如果当前使用本地开发模式，访问 `http://localhost:5173`；如果使用完整 Docker 模式，需要重新构建后访问 `http://localhost:8080`。

使用专家账号登录：

```text
用户名：expert
密码：demo123456
```

完成三个场景：

1. 输入合法分数，不填写评分说明，点击保存。
2. 输入“  依据充分  ”并保存，然后刷新页面。
3. 在 Network 中找到成功的 PUT 请求，查看 Payload、Status 和 Response。

记录：

```text
空说明时是否出现提示：
空说明时 Network 是否产生 PUT：

合法请求 Status：
Payload 中的 feedback：
Response 中的 feedback：
刷新后显示的 feedback：
```

## 8. 本课真正要掌握的结论

- AI 可以写代码，但产品规则和兼容策略必须由人确认。
- 先写验收条件，再让 AI 修改，返工会明显减少。
- 前端校验服务于体验，后端校验才是可信边界。
- 不是每个业务规则都需要改数据库；先判断存储结构是否真的变化。
- “测试通过”不是一句笼统结论，要知道每类测试覆盖哪一层、没有覆盖哪一层。

完成手工验收并能解释第 5 节的问题后，第 11F 课结束。第 11G 课会让你在较少提示下独立描述一个改动，再由 AI 实现并由你验收。

## 9. 本次实际验收结果

2026-09-14 已完成以下验证：

- 页面不填写说明时提示“请填写评分说明”，Network 中没有 PUT 请求。
- 合法说明由前端去除首尾空格，保存接口返回 200，刷新后仍能从数据库读取。
- 第一次绕过前端提交 201 字时意外返回 200。检查发现浏览器使用新版 Vite 前端，但 3000 端口仍是旧 Docker API 镜像。
- 重新构建 API 镜像后，同一个绕过请求返回 400 和 `FEEDBACK_TOO_LONG`，并包含可关联日志的 Request ID。

这次意外很有价值：源代码已经修改、前端界面已经更新，并不代表所有运行实例都使用了同一版本。验收全栈改动时还要确认请求实际进入哪个进程或容器。
