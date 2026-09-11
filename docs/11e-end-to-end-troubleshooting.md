# 第 11E 课：沿完整请求链路定位故障

本课不追求记住所有错误，而是形成固定排查顺序：先收集证据、确定故障层，再让 AI 修改代码或配置。

## 1. 为什么不能看到报错就改代码

同一个“页面不能用”，原因可能完全不同：

```text
浏览器请求写错
Vite / Nginx 代理错误
NestJS 没启动
认证或参数被拒绝
Service 业务校验失败
PostgreSQL 不可用
MinIO 不可用
临时签名 URL 过期
```

没有先确定故障层，AI 很容易修改无关文件，让问题更复杂。

## 2. 固定排查顺序

```text
① 浏览器 Network
   URL、Method、Status、Request、Response、X-Request-Id
        ↓
② 当前运行模式与入口
   Vite 5173 / Nginx 8080 / API 3000 是否存在
        ↓
③ API 日志
   用 requestId 找同一次请求的完成日志或异常日志
        ↓
④ 健康检查
   live 看进程，ready 看 PostgreSQL 和 MinIO
        ↓
⑤ 具体依赖
   PostgreSQL 数据、MinIO 对象、容器状态和日志
        ↓
⑥ 监控历史
   Prometheus / Grafana / Alertmanager 判断何时开始、是否持续
```

前面已经得到明确证据时，不必机械执行后面所有步骤。

## 3. 常见现象只能作为线索

| 现象 | 优先怀疑 | 不能直接下什么结论 |
| --- | --- | --- |
| `ERR_CONNECTION_REFUSED` | 端口没有进程监听、地址或端口错误 | 不能直接说是后端代码异常 |
| Nginx `502 Bad Gateway` | Nginx 无法连接上游 API | 不一定是数据库故障 |
| HTTP 400 | DTO 或业务校验拒绝 | 不一定是服务器崩溃 |
| HTTP 401 | 没有有效登录身份 | 不等于角色不足 |
| HTTP 403 | 身份存在但权限不足，或签名 URL 无效/过期 | 需要结合响应内容确认来源 |
| HTTP 404 | 当前接收请求的服务没有对应路由或资源 | 服务可能仍然运行正常 |
| HTTP 413 | Nginx 等入口拒绝过大的请求体 | 请求可能尚未进入 NestJS |
| HTTP 500 | 未处理异常 | 仅凭 500 不能判断是哪一个依赖 |
| HTTP 503 | 服务主动报告暂不可用，例如 ready 失败 | 进程可能仍然存活 |

状态码只是起点，响应 JSON、请求 ID、日志和健康检查才用于确认。

## 4. 当前运行模式基线

2026-09-11 课程开始时实际检查到：

```text
Windows node.exe：5173 Vite 正在运行
Windows node.exe：3000 NestJS 正在运行
Docker PostgreSQL、MinIO：healthy
Docker API、Web：Exited
```

所以当前请求链路是：

```text
浏览器 → Vite 5173 → NestJS 3000 → Docker PostgreSQL / MinIO
```

不是 Nginx 链路。

## 5. 第一阶段：证明 Vite 代理与 API 都能到达

运行：

```powershell
curl.exe -i http://localhost:5173/api/health/live
curl.exe -i http://localhost:3000/api/health/live
curl.exe -i http://localhost:5173/api/route-does-not-exist
```

三个命令都只发送 GET 请求，不修改数据。

记录：

```text
5173 /api/health/live Status：
5173 响应 X-Request-Id：

3000 /api/health/live Status：
3000 响应 X-Request-Id：

不存在路由 Status：
不存在路由 Response code：
不存在路由 X-Request-Id：
```

然后判断：

1. 5173 和 3000 的 live 都成功，分别证明了什么？
2. 不存在路由返回结构化 JSON 和 `X-Request-Id`，是否说明请求已经进入 NestJS？
3. 这种 404 应先修改 Nginx、数据库，还是检查请求 URL 与 Controller 路由？

第一阶段已完成：5173 证明 Vite 与其 API 代理可以到达 NestJS；3000 证明可以直连 NestJS；结构化 404 证明请求已进入 NestJS，只是没有匹配的 Controller 路由。`ApiExceptionFilter` 负责统一格式化异常，不负责决定路由是否存在。

## 6. 第二阶段：切换到完整 Docker 模式

当前 Windows 上的开发 API 占用了主机 3000，不能与 Docker API 同时运行。先到执行 `pnpm dev` 的终端按 `Ctrl+C`，再确认开发端口已经释放：

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3000,5173 -ErrorAction SilentlyContinue
```

没有输出表示当前没有进程监听这两个端口。

构建并启动完整 Docker 服务：

```powershell
docker compose up --build -d
docker compose ps
```

`--build` 确保镜像包含当前源码。第一次或缓存失效时可能需要几分钟。等待 `api` 和 `web` 都显示 `healthy` 后建立 Nginx 基线：

```powershell
curl.exe -i http://localhost:8080/healthz
curl.exe -i http://localhost:8080/api/health/ready
```

预期两者均为 200，但含义不同：前者由 Nginx 直接返回，后者经过 Nginx 代理到 NestJS 并检查 PostgreSQL、MinIO。

## 7. 制造可恢复的 API 上游故障

确认基线正常后，只停止 Docker API：

```powershell
docker compose stop api
```

然后依次观察：

```powershell
curl.exe -i http://localhost:8080/
curl.exe -i http://localhost:8080/healthz
curl.exe -i http://localhost:8080/api/health/live
docker compose ps -a
docker compose logs --tail 20 web
```

不要先修改代码。记录：

```text
页面 / Status：
Nginx /healthz Status：
经过 Nginx 的 /api/health/live Status：
API 容器状态：
Web 容器状态：
502 响应是否包含 X-Request-Id：
Web 日志中的第一条相关错误：
```

根据证据回答：

1. 页面和 `/healthz` 都是 200，为什么 API 仍然可以失败？
2. `/api/health/live` 返回 502 而不是 NestJS 的结构化 503，说明请求停在哪一层？
3. 502 没有 NestJS 的 Request ID 时，为什么应先查 Nginx/Web 日志和 API 容器状态？
4. 此时修改数据库或 `ReviewService` 能否解决问题？

完成记录后先不要改配置，使用以下命令恢复：

```powershell
docker compose start api
docker compose ps
```

等待 API 恢复 `healthy`，再请求 `http://localhost:8080/api/health/live` 验证 200。

这一实验会停止并恢复 API 容器，不会删除 PostgreSQL、MinIO 或 Volume。

第二阶段已完成：页面和 `/healthz` 为 200，只能证明 Nginx 静态入口正常；Nginx 连接已停止的 API 失败并生成 502。因为请求没有进入 NestJS，所以没有 NestJS Request ID。恢复 API 后代理请求重新返回 200。

## 8. 第三阶段：API 存活但 PostgreSQL 不可用

第二阶段是 API 进程完全停止。第三阶段只停止 PostgreSQL，让 API 继续运行：

```powershell
docker compose stop postgres
Start-Sleep -Seconds 55
```

等待是为了让 API 容器连续多次健康检查失败，并让 Prometheus 完成抓取与告警计算。然后观察：

```powershell
curl.exe -i http://localhost:8080/api/health/live
curl.exe -i http://localhost:8080/api/health/ready
docker compose ps
curl.exe -s "http://localhost:9090/api/v1/query?query=up%7Bjob%3D%22fullstack-learning-api%22%7D"
curl.exe -s "http://localhost:9090/api/v1/query?query=fullstack_dependency_up"
```

同时打开：

- Prometheus 告警：`http://localhost:9090/alerts`
- Alertmanager：`http://localhost:9093`

记录：

```text
/api/health/live Status：
/api/health/live 是否包含 X-Request-Id：

/api/health/ready Status：
ready Response code：
ready details：
ready 是否包含 X-Request-Id：

API 容器运行/健康状态：
Web 容器健康状态：
Prometheus up：
fullstack_dependency_up 中 postgres：
fullstack_dependency_up 中 minio：
Alertmanager 活动告警：
```

根据证据回答：

1. 这次为什么是 NestJS 返回结构化 503，而不是 Nginx 返回 502？
2. API `live=200` 与 Docker 健康状态 `unhealthy` 是否矛盾？两者分别检查什么？
3. 为什么 Prometheus `up=1`，却仍然应该触发 PostgreSQL 依赖告警？
4. Web 为什么仍能 healthy，用户为什么仍能打开页面？
5. 如果用户报告评分保存失败，应先查看哪些证据，而不是立即修改 `ReviewService`？

## 9. 恢复并验证

记录完成后恢复 PostgreSQL：

```powershell
docker compose start postgres
Start-Sleep -Seconds 25
docker compose ps
curl.exe -i http://localhost:8080/api/health/ready
```

再确认 Prometheus 依赖指标恢复为 `1`、Alertmanager 活动告警消失。

停止和启动 PostgreSQL 容器不会删除 `postgres-data` Volume。不要使用 `down -v`。

完成这一阶段后，第 11E 课结束。
