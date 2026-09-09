# 第 10A 课：存活检查与就绪检查

本课来自一次真实故障实验：停止 PostgreSQL 后，评分和文件列表都返回 500，`/api/health` 却仍然返回 200。它说明“进程活着”和“系统能工作”不是同一件事。

## 1. 这是不是 AI 开发必须理解的内容

是，但不需要背 NestJS API。

AI 可以编写 Controller、Prisma 查询、MinIO SDK 调用和测试。开发者必须定义“什么条件才算可以接收用户请求”，并通过真实故障验证定义是否正确。如果定义错误，部署平台可能继续把流量交给一个无法访问数据库的实例。

## 2. 两个概念

### 存活检查 Liveness

问题是：API 进程是否还活着、能否响应 HTTP？

```http
GET /api/health/live
```

它不查询数据库和 MinIO。外部依赖临时故障时，盲目重启 API 通常不能修复依赖，反而会造成更多抖动。

### 就绪检查 Readiness

问题是：这个 API 实例现在是否具备处理完整业务的必要条件？

```http
GET /api/health/ready
```

当前项目会并行检查：

- PostgreSQL 能否执行 `SELECT 1`。
- MinIO 能否访问配置的 Bucket。

全部成功返回 200：

```json
{
  "status": "ok",
  "checks": {
    "postgres": "up",
    "minio": "up"
  }
}
```

任一失败返回 503：

```json
{
  "success": false,
  "code": "SERVICE_NOT_READY",
  "message": "服务依赖尚未就绪",
  "details": {
    "postgres": "down",
    "minio": "up"
  }
}
```

原来的 `/api/health` 暂时保留，并与 `/api/health/live` 含义相同，避免早期课程和前端页面失效。

## 3. 请求经过哪些文件

```text
GET /api/health/ready
  → HealthController.getReadiness()
  → HealthService.getReadiness()
  ├─ PrismaService 执行 SELECT 1
  └─ StorageHealthPort.checkHealth()
       → MinioFileStorageService.checkHealth()
  → 都成功：200
  → 任一失败：ServiceUnavailableException → 503
```

对应文件：

- `apps/api/src/health/health.controller.ts`：定义 HTTP 路由。
- `apps/api/src/health/health.service.ts`：定义“就绪”的业务含义。
- `apps/api/src/health/health.types.ts`：定义响应类型。
- `apps/api/src/document/storage-health.port.ts`：定义存储健康检查能力。
- `apps/api/src/document/minio-file-storage.service.ts`：实际访问 MinIO Bucket。
- `apps/api/src/common/api-exception.filter.ts`：把异常转换成统一 JSON。

## 4. 为什么又出现一个依赖注入 Token

`StorageHealthPort` 是 TypeScript 接口，编译后不存在。`STORAGE_HEALTH` 是运行时仍然存在的 Symbol，NestJS 用它查找实现。

`DocumentModule` 中的绑定：

```ts
{
  provide: STORAGE_HEALTH,
  useExisting: MinioFileStorageService,
}
```

表示把已经创建的 `MinioFileStorageService` 实例同时当作健康检查实现使用。`useExisting` 不会再创建第二个 MinIO 实例。

`HealthService` 构造函数中的：

```ts
@Inject(STORAGE_HEALTH)
private readonly storageHealth: StorageHealthPort
```

表示 NestJS 创建 `HealthService` 时，把上面的现有实例传进来。这样健康模块只依赖“检查存储”的能力，不需要知道 MinIO SDK 的具体写法。

## 5. 为什么使用 Promise.allSettled

数据库和 MinIO 互不依赖，可以同时检查。`Promise.allSettled()` 会等待两项都给出结果，即使其中一项失败，也能知道另一项是 `up` 还是 `down`。

如果使用 `Promise.all()`，第一个失败会直接抛出，响应可能无法同时说明两项依赖的状态。

## 6. 为什么 PostgreSQL 使用 SELECT 1

`SELECT 1` 不读取业务表，只做一次很轻量的往返：

```text
API 能找到数据库地址
→ 能建立连接
→ 数据库能执行 SQL
→ 结果能返回 API
```

它不能证明所有业务 SQL 都正确，但比固定返回 `ok` 更能反映数据库是否可用。

## 7. 为什么失败返回 503 而不是 500

- `500 Internal Server Error`：请求处理出现未预期的内部错误。
- `503 Service Unavailable`：服务当前暂时不具备处理请求的条件。

就绪检查失败通常是临时依赖故障，所以 503 更准确。负载均衡器或部署平台可以据此暂时停止向该实例发送流量。

## 8. Docker 使用哪个地址

Compose 中 API 的 healthcheck 已改为：

```text
/api/health/ready
```

因此容器虽然还在运行，但 PostgreSQL 或 MinIO 故障持续超过检查阈值后，API 会显示 `unhealthy`。

要注意：Docker Compose 会标记健康状态，但不会因为 `unhealthy` 自动重启容器。Kubernetes 等编排系统会分别使用 liveness 和 readiness 探针采取不同动作。

## 9. 本地验证

正常状态：

```powershell
Invoke-RestMethod http://localhost:3000/api/health/live
Invoke-RestMethod http://localhost:3000/api/health/ready
```

停止 PostgreSQL：

```powershell
docker compose stop postgres
Invoke-WebRequest http://localhost:3000/api/health/live -SkipHttpErrorCheck
Invoke-WebRequest http://localhost:3000/api/health/ready -SkipHttpErrorCheck
docker compose up -d postgres
```

Windows PowerShell 5.1 没有 `-SkipHttpErrorCheck`。可以直接在浏览器 Network 中查看，或者捕获 `Invoke-WebRequest` 的异常响应。

停止 MinIO：

```powershell
docker compose stop minio
Invoke-RestMethod http://localhost:3000/api/health/live
docker compose up -d minio
```

停止实验后必须恢复依赖，并等待 `docker compose ps` 显示 healthy。不要使用 `docker compose down -v`，它会删除学习数据。

## 10. 测试如何避免真的破坏依赖

`apps/api/src/health/health.service.spec.ts` 使用 Mock 模拟四种情况：

- liveness 不访问外部依赖。
- PostgreSQL 和 MinIO 都正常。
- PostgreSQL 故障。
- MinIO 故障。

单元测试适合快速覆盖失败分支；手动停止容器则证明真实网络、SDK 和运行配置符合预期。二者不能互相替代。

## 11. 本课只需要记住

```text
live：进程活着，不查外部依赖。
ready：必要依赖可用，实例可以接收流量。
200：就绪。
503：暂时未就绪。
```

不需要记住 `ServiceUnavailableException`、`Promise.allSettled` 或 MinIO SDK 的准确拼写，需要时可以让 AI 查找和实现。但必须亲自确认检查范围、失败状态码和真实故障实验结果。
