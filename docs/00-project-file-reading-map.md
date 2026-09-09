# 当前项目必须看懂的文件地图

这份清单不是要求背代码。使用 AI 开发时，“看懂一个文件”是指你能够回答四个问题：

1. 它负责什么，不负责什么？
2. 它的输入和输出是什么？
3. 它会调用谁，又被谁调用？
4. 它失败后会影响用户、数据还是部署中的哪一部分？

NestJS 装饰器、Prisma API、PromQL 和 YAML 的具体写法可以随用随查，不需要默写。

## 一、第一优先级：必须能解释的四条主链路

### 1. 项目启动与通用 HTTP 请求

按下面顺序阅读：

| 文件 | 必须看懂的内容 |
| --- | --- |
| [`README.md`](../README.md) | 本地依赖、首次启动、日常启动、端口和停止命令。 |
| [`apps/api/src/main.ts`](../apps/api/src/main.ts) | NestJS 从哪里启动、监听哪个端口、为什么监听 `0.0.0.0`。 |
| [`apps/api/src/configure-http-app.ts`](../apps/api/src/configure-http-app.ts) | `/api` 前缀、全局 DTO 校验和统一异常处理在哪里启用。 |
| [`apps/api/src/app.module.ts`](../apps/api/src/app.module.ts) | 各业务模块在哪里组装，请求 ID Middleware 为什么覆盖全部路由。 |
| [`apps/web/src/App.tsx`](../apps/web/src/App.tsx) | 前端登录状态如何决定显示登录、评分和文件区域。 |
| [`apps/web/src/api/http.ts`](../apps/web/src/api/http.ts) | Token 如何进入请求头、JSON/FormData 如何处理、非 2xx 如何变成 `ApiError`。 |

你不需要背 `@Module`、`NestFactory` 或 `fetch` 参数，只需能画出：

```text
浏览器 → React API 封装 → NestJS 全局管道 → Controller → Service
```

### 2. 登录、认证和授权

| 文件 | 必须看懂的内容 |
| --- | --- |
| [`apps/web/src/components/LoginCard.tsx`](../apps/web/src/components/LoginCard.tsx) | 用户输入如何触发登录，成功和失败分别如何更新页面。 |
| [`apps/web/src/api/auth.ts`](../apps/web/src/api/auth.ts) | 登录、获取当前用户和退出分别调用什么接口。 |
| [`apps/web/src/api/token.ts`](../apps/web/src/api/token.ts) | Token 当前保存在什么位置；知道这种学习方案存在 XSS 风险，不能直接照搬到生产。 |
| [`apps/api/src/auth/auth.controller.ts`](../apps/api/src/auth/auth.controller.ts) | `/login` 与 `/me` 两个入口分别做什么。 |
| [`apps/api/src/auth/auth.service.ts`](../apps/api/src/auth/auth.service.ts) | 如何查用户、校验密码、签发 Token；当前演示用户如何初始化。 |
| [`apps/api/src/auth/jwt-auth.guard.ts`](../apps/api/src/auth/jwt-auth.guard.ts) | 如何读取并验证 Bearer Token，以及为何把可信用户写入请求上下文。 |
| [`apps/api/src/auth/roles.decorator.ts`](../apps/api/src/auth/roles.decorator.ts) 与 [`roles.guard.ts`](../apps/api/src/auth/roles.guard.ts) | `Roles` 只写路由元数据，`RolesGuard` 读取元数据并真正决定是否放行。 |
| [`apps/api/src/auth/current-user.decorator.ts`](../apps/api/src/auth/current-user.decorator.ts) | Controller 如何取得 Guard 已验证的当前用户。 |

必须能解释：认证回答“你是谁”，授权回答“你能做什么”；后端不能相信请求体里的用户 ID。

### 3. 查询和保存评分

这是当前项目最应该完整理解的一条链路：

| 顺序 | 文件 | 必须看懂的内容 |
| --- | --- | --- |
| 1 | [`apps/web/src/components/ReviewScoreCard.tsx`](../apps/web/src/components/ReviewScoreCard.tsx) | 加载、编辑、保存、错误提示和刷新后的状态。 |
| 2 | [`apps/web/src/api/reviews.ts`](../apps/web/src/api/reviews.ts) | GET 与 PUT 的 URL、Method、Query 和请求体。 |
| 3 | [`apps/api/src/review/review.controller.ts`](../apps/api/src/review/review.controller.ts) | URL 如何匹配方法，Jwt/角色校验在哪一层，当前用户 ID 如何传给 Service。 |
| 4 | [`apps/api/src/review/dto/save-score.dto.ts`](../apps/api/src/review/dto/save-score.dto.ts) | DTO 负责请求结构和基础格式，不负责评审项最高分等业务规则。 |
| 5 | [`apps/api/src/review/review.service.ts`](../apps/api/src/review/review.service.ts) | 查询评审项、校验分值范围与步长、使用 `upsert` 保存正式评分。 |
| 6 | [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma) | `ReviewItem`、`ExpertScore`、唯一约束和外键分别保证什么。 |

必须能用自己的话说明：

```text
点击保存
→ 前端发送 PUT
→ Guard 验证身份和角色
→ ValidationPipe 按 DTO 检查请求
→ Service 检查业务规则
→ Prisma 写入 PostgreSQL
→ 响应返回前端
```

### 4. PDF 上传和临时预览

| 顺序 | 文件 | 必须看懂的内容 |
| --- | --- | --- |
| 1 | [`apps/web/src/components/DocumentPanel.tsx`](../apps/web/src/components/DocumentPanel.tsx) | 列表、上传、请求预览地址和 iframe 展示如何连接。 |
| 2 | [`apps/web/src/api/documents.ts`](../apps/web/src/api/documents.ts) | multipart 的字段名为什么是 `file`，预览接口为什么先返回 URL。 |
| 3 | [`apps/api/src/document/document.controller.ts`](../apps/api/src/document/document.controller.ts) | 登录、角色、文件大小限制以及三个文件接口。 |
| 4 | [`apps/api/src/document/document.service.ts`](../apps/api/src/document/document.service.ts) | PDF 内容校验、先存对象再写元数据、失败补偿删除、查询和生成预览地址。 |
| 5 | [`apps/api/src/document/document.module.ts`](../apps/api/src/document/document.module.ts) | `FILE_STORAGE`、`TEMPORARY_FILE_URL`、`STORAGE_HEALTH` 如何映射到同一个 MinIO 实例。 |
| 6 | [`file-storage.port.ts`](../apps/api/src/document/file-storage.port.ts)、[`temporary-file-url.port.ts`](../apps/api/src/document/temporary-file-url.port.ts)、[`storage-health.port.ts`](../apps/api/src/document/storage-health.port.ts) | Port 是业务层依赖的能力合同，让 Service 不必绑定某个具体存储实现。 |
| 7 | [`apps/api/src/document/minio-file-storage.service.ts`](../apps/api/src/document/minio-file-storage.service.ts) | 对象如何保存、删除、健康检查和生成短期签名 URL。 |
| 8 | [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma) | `Document` 保存元数据，PDF 二进制本身保存在 MinIO。 |

必须能区分：数据库里的 `storageKey` 是定位信息，MinIO 对象才是文件内容，临时 URL 只是限时访问凭证。

## 二、第二优先级：修改对应功能前必须看懂

不要求现在逐行阅读，但修改相关功能或准备上线前必须回来查看。

### 数据库与迁移

| 文件 | 需要理解到什么程度 |
| --- | --- |
| [`apps/api/src/prisma/prisma.module.ts`](../apps/api/src/prisma/prisma.module.ts) 与 [`prisma.service.ts`](../apps/api/src/prisma/prisma.service.ts) | PrismaService 为什么能被其他模块注入、启动和退出时如何管理数据库连接。 |
| [`apps/api/prisma/migrations`](../apps/api/prisma/migrations) | 每个 `migration.sql` 对表结构做了什么；执行生产迁移前判断是否删列、改类型、丢数据或长时间锁表。 |
| [`apps/api/.env.example`](../apps/api/.env.example) | 每个环境变量控制哪个依赖；真实密码和密钥不能提交。 |

### 错误、日志、健康与指标

| 文件 | 需要理解到什么程度 |
| --- | --- |
| [`apps/api/src/common/api-exception.filter.ts`](../apps/api/src/common/api-exception.filter.ts) | 已知业务错误与未知 500 如何形成统一响应，`requestId` 如何进入错误。 |
| [`apps/api/src/common/request-id.middleware.ts`](../apps/api/src/common/request-id.middleware.ts) | 请求 ID 如何生成/复用，完成日志和耗时从哪里产生。 |
| [`health.controller.ts`](../apps/api/src/health/health.controller.ts) 与 [`health.service.ts`](../apps/api/src/health/health.service.ts) | live 只看进程，ready 检查 PostgreSQL 和 MinIO。 |
| [`metrics.controller.ts`](../apps/api/src/metrics/metrics.controller.ts) 与 [`metrics.service.ts`](../apps/api/src/metrics/metrics.service.ts) | 请求计数如何累加、如何转成 JSON 和 Prometheus 文本。 |

### 本地容器与监控

| 文件 | 需要理解到什么程度 |
| --- | --- |
| [`compose.yaml`](../compose.yaml) | PostgreSQL、MinIO、API、Web 的镜像、端口、网络、环境变量和 Volume。重点识别哪些数据需要持久化。 |
| [`compose.monitoring.yaml`](../compose.monitoring.yaml) | Prometheus、Grafana、Alertmanager 分别启动什么，主机端口如何映射，配置文件挂载到哪里。 |
| [`monitoring/prometheus.yml`](../monitoring/prometheus.yml) | 每 5 秒抓取/计算、从哪里抓 API、把已触发告警发给谁。 |
| [`monitoring/alert-rules.yml`](../monitoring/alert-rules.yml) | 哪个表达式代表异常、要持续多久、严重级别和说明文字。 |
| [`monitoring/alertmanager.yml`](../monitoring/alertmanager.yml) | 告警如何分组、等待和重复；当前接收器为何不向外发送消息。 |

对这些 YAML 不要求会手写，但必须能把关键项翻译成人话，并在 AI 修改后检查端口、地址、Volume、指标名、阈值和凭据。

### 构建、发布和数据安全

| 文件 | 需要理解到什么程度 |
| --- | --- |
| [`apps/api/Dockerfile`](../apps/api/Dockerfile) 与 [`apps/web/Dockerfile`](../apps/web/Dockerfile) | 源码如何变成生产镜像，多阶段构建为什么能缩小最终镜像。 |
| [`apps/web/nginx.conf`](../apps/web/nginx.conf) | Nginx 如何托管前端并把 `/api` 转发到后端。 |
| [`compose.production.yaml`](../compose.production.yaml) 与 [`.env.production.example`](../.env.production.example) | 生产服务如何组合、哪些值必须由部署环境提供、为什么镜像版本不能只写 `latest`。 |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | 推送代码后依次检查、测试、构建什么；失败为什么会阻止错误版本继续发布。 |
| [`scripts/create-backup.mjs`](../scripts/create-backup.mjs) 与 [`verify-backup.mjs`](../scripts/verify-backup.mjs) | 备份包含什么、校验什么；备份成功不等于已经验证能够恢复。 |

## 三、测试文件怎样读

先读测试名称、准备条件、执行动作和断言，不需要先掌握所有 mock API。

优先选择三个代表：

- [`apps/api/src/document/document.service.spec.ts`](../apps/api/src/document/document.service.spec.ts)：业务单元测试，尤其是数据库失败后删除 MinIO 对象。
- [`apps/api/src/integration/document-api.integration.spec.ts`](../apps/api/src/integration/document-api.integration.spec.ts)：真实 HTTP、PostgreSQL 和 MinIO 如何串起来验证。
- [`apps/web/src/components/DocumentPanel.spec.tsx`](../apps/web/src/components/DocumentPanel.spec.tsx)：用户点击行为和页面结果如何验证。

必须能回答“这个测试防止哪一种真实故障再次发生”，不要求默写 Vitest API。

## 四、目前不需要阅读的文件

以下文件知道用途即可，需要修改时交给 AI 并通过命令验证：

- `node_modules/`、`dist/`：安装和构建生成物，不读、不手改。
- `pnpm-lock.yaml`：锁定依赖精确版本，不逐行读、不手改。
- `tsconfig*.json`、Vite/Vitest/Tailwind/PostCSS 配置：遇到编译、测试或样式配置问题再查。
- `monitoring/grafana/dashboards/fullstack-overview.json`：Grafana 仪表盘机器配置，只核对最终面板和查询结果。
- Grafana provisioning 文件：知道它们会自动创建数据源和仪表盘即可。
- `migration_lock.toml`：Prisma 的迁移工具配置，不需要学习其内部格式。
- 历史课程文档：遇到对应概念时回查，不需要一次性背完。

## 五、推荐阅读顺序

不要按文件夹从头看到尾。每次只沿一条用户操作追踪：

1. 保存评分：React 组件 → 前端 API → Controller → DTO → Service → Prisma Schema。
2. 登录：React 登录组件 → 前端 Token → AuthController → AuthService → JwtAuthGuard。
3. 预览 PDF：React 文件组件 → DocumentController → DocumentService → MinIO → 临时 URL。
4. 排查故障：浏览器 Request ID → Middleware/Filter 日志 → health/ready → Prometheus → Alertmanager。
5. 准备发布：README 命令 → Dockerfile → Compose → Nginx → CI → 备份与回滚。

一次只理解一条链路，比孤立地背 NestJS、Prisma 和 YAML API 更适合 AI 辅助开发。

## 六、自测标准

对第一优先级的每条链路，你能不看答案说出下面内容，就算已经满足当前要求：

- 浏览器发出了什么请求。
- 后端哪个 Controller 接收。
- 身份、DTO 和业务规则分别在哪里检查。
- 数据最终写到 PostgreSQL 还是 MinIO。
- 成功和失败分别返回什么。
- 出错时先去浏览器、NestJS 日志、健康检查还是监控页面找什么证据。

说不出具体框架 API 名称没有关系；如果说不清数据流向、权限边界和失败影响，就需要回到对应主链路继续追踪。
