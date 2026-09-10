# 第 11C 课：Compose 逐段慢速拆解

本课按 PostgreSQL → MinIO → API → Web 的顺序学习。一次只看一个服务，不要求从头背诵 `compose.yaml`。

## 第一段：Compose 文件的最外层

当前文件开头和结尾可以先缩写成：

```yaml
name: fullstack-learning-lab

services:
  postgres:
    # PostgreSQL 服务的具体配置
  minio:
    # MinIO 服务的具体配置
  api:
    # NestJS 服务的具体配置
  web:
    # Nginx + React 服务的具体配置

volumes:
  postgres-data:
  minio-data:
```

先当成 JavaScript 对象理解：

```ts
const compose = {
  name: 'fullstack-learning-lab',
  services: {
    postgres: {},
    minio: {},
    api: {},
    web: {},
  },
  volumes: {
    'postgres-data': {},
    'minio-data': {},
  },
};
```

- `name`：Compose 项目名，Docker 生成容器、网络和 Volume 名称时会使用它。
- `services`：要管理的服务定义。服务不是镜像，也不是容器；它是一份“如何创建某类容器”的配置。
- 最外层 `volumes`：声明这组服务可以使用的命名 Volume。

`postgres` 服务最终生成的容器名是 `fullstack-learning-lab-postgres-1`：

```text
项目名 + 服务名 + 实例序号
```

## 第二段：PostgreSQL 使用哪个镜像

```yaml
services:
  postgres:
    image: postgres:16-alpine
```

这表示 `postgres` 服务从 `postgres:16-alpine` 镜像创建容器：

```text
postgres   = 镜像仓库/名称
16-alpine  = 标签，本项目用它表示 PostgreSQL 16 的 Alpine 版本
```

Compose 不会因为服务名叫 `postgres` 就自动知道该运行什么，真正决定模板的是 `image`。

## 第三段：环境变量和默认值

```yaml
environment:
  POSTGRES_DB: ${POSTGRES_DB:-fullstack_lab}
  POSTGRES_USER: ${POSTGRES_USER:-fullstack}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-fullstack_dev_password}
```

`environment` 表示传进 PostgreSQL 容器的环境变量。

`${POSTGRES_DB:-fullstack_lab}` 不是普通 YAML 语法，而是 Docker Compose 的变量替换语法：

```text
如果外部 POSTGRES_DB 有非空值 → 使用外部值
否则                           → 使用默认值 fullstack_lab
```

因此当前本地默认创建：

```text
数据库：fullstack_lab
用户：fullstack
密码：fullstack_dev_password
```

默认密码只用于本地学习，生产环境必须从受保护的部署环境提供，不能沿用或直接写入仓库。

## 第四段：主机端口映射

```yaml
ports:
  - "${POSTGRES_HOST_PORT:-5432}:5432"
```

如果没有设置 `POSTGRES_HOST_PORT`，Compose 得到：

```text
Windows 主机 5432 → PostgreSQL 容器 5432
```

左侧变量允许在主机 5432 已被占用时改用其他主机端口；右侧 5432 是 PostgreSQL 在容器里监听的固定端口。

## 第五段：Volume 挂载

```yaml
volumes:
  - postgres-data:/var/lib/postgresql/data
```

冒号两侧含义：

```text
postgres-data                 → Compose 中声明的命名 Volume
/var/lib/postgresql/data      → PostgreSQL 容器里的数据目录
```

PostgreSQL 写入容器内数据目录时，实际数据进入 Volume。容器重建后，新容器再次挂载同一个 Volume，数据库数据仍可保留。

配置里使用逻辑名称 `postgres-data`，Docker 根据项目名创建出的实际名称是：

```text
fullstack-learning-lab_postgres-data
```

## 第六段：健康检查

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-fullstack} -d ${POSTGRES_DB:-fullstack_lab}"]
  interval: 5s
  timeout: 3s
  retries: 10
```

翻译成人话：

```text
每隔 5 秒在容器中执行一次 pg_isready
单次最多等待 3 秒
连续失败达到重试条件后，把容器标记为 unhealthy
```

它不会自动修复 PostgreSQL，只是把检查结果写成 `healthy` 或 `unhealthy`，供人和其他服务判断。

`docker compose ps` 中看到的 `(healthy)` 就来自这里。

## 第一阶段只读验证

在项目根目录运行：

```powershell
docker compose config --services
docker compose config --images
docker compose config --volumes
```

`docker compose config` 会读取 YAML、处理变量替换并生成最终配置。以上三个参数只摘出服务、镜像和 Volume，不会创建、停止或删除容器。

根据配置和输出回答：

1. Compose 项目中有哪四个服务？
2. `postgres` 是服务名、镜像名还是容器名？另外两个名称分别是什么？
3. 未设置外部变量时，PostgreSQL 的主机端口和容器端口分别是多少？
4. `postgres-data:/var/lib/postgresql/data` 冒号左右分别代表什么？
5. `(healthy)` 是 PostgreSQL 永远不会出错，还是最近健康检查通过？

第一阶段已完成，五项结果均与真实容器一致。

## 第七段：MinIO 镜像和启动命令

```yaml
minio:
  image: minio/minio:RELEASE.2025-04-22T22-12-26Z
  command: server /data --console-address ":9001"
```

- `image` 指定创建容器的 MinIO 版本。
- `command` 指定容器启动后运行 MinIO 对象存储服务。
- `server /data` 表示把 `/data` 作为对象数据目录。
- `--console-address ":9001"` 表示管理控制台在容器 9001 端口监听。

镜像回答“用什么模板”，`command` 回答“容器启动后主要运行什么”。

## 第八段：MinIO 的本地学习账号

```yaml
environment:
  MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
  MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin123}
```

这两个环境变量传进 MinIO 容器，用于初始化管理员账号。默认值只方便本地课程；生产环境不能继续使用，也不能把真实密码直接提交到 Compose 文件。

## 第九段：为什么 MinIO 有两个端口

```yaml
ports:
  - "${MINIO_API_HOST_PORT:-9000}:9000"
  - "${MINIO_CONSOLE_HOST_PORT:-9001}:9001"
```

默认映射：

```text
Windows 9000 → 容器 9000：对象存储 API，NestJS 和 PDF 地址使用
Windows 9001 → 容器 9001：给人操作的 MinIO 管理页面
```

API 端口和管理页面端口职责不同。能打开 9001 管理页面，不代表应用使用的 9000 API、账号和 Bucket 一定正确。

## 第十段：MinIO Volume

```yaml
volumes:
  - minio-data:/data
```

它与启动命令中的 `server /data` 对应：MinIO 往容器 `/data` 写入对象，实际由 `minio-data` Volume 持久保存。

```text
MinIO 容器删除并重建 + 重新挂载同一个 Volume
→ 已上传对象通常仍然存在

Volume 被删除
→ 对象数据可能丢失
```

数据库元数据仍在 PostgreSQL，不代表 MinIO PDF 也还在；两边都需要备份和恢复验证。

## 第十一段：两种 MinIO 健康检查

Compose 中：

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://127.0.0.1:9000/minio/health/live"]
  interval: 5s
  timeout: 3s
  retries: 10
```

这个检查从 MinIO 容器内部访问存活地址，主要确认 MinIO 进程还能响应，因此 `docker compose ps` 可以显示 `healthy`。

NestJS `/api/health/ready` 还会使用应用自己的 MinIO 客户端和凭据检查目标 Bucket 是否存在。它更接近“当前 API 能否使用需要的存储能力”。

所以需要分开理解：

```text
MinIO 容器 healthy
≠ NestJS 的地址、凭据、Bucket 配置必然全部正确
```

## 第二阶段只读验证

运行：

```powershell
docker compose port minio 9000
docker compose port minio 9001
```

这两个命令查询运行中 MinIO 容器的实际端口映射，不会修改服务。

回答：

1. 9000 和 9001 分别服务于谁？
2. 为什么 `command` 中的数据目录 `/data` 必须与 Volume 右侧 `/data` 对应？
3. 删除 MinIO 容器但保留并重新挂载 `minio-data`，PDF 对象是否应该保留？
4. MinIO 容器显示 `healthy`，为什么 NestJS 的 `ready` 仍有可能报告 MinIO `down`？

第二阶段已完成。注意：9000 是对象存储网络 API，PDF 字节真正写在挂载到 `/data` 的 Volume 中。

## 第十二段：API 的镜像从哪里来

```yaml
api:
  image: fullstack-learning-lab-api:local
  build:
    context: .
    dockerfile: apps/api/Dockerfile
```

这里同时出现 `build` 和 `image`：

```text
build       → 告诉 Compose 如何构建镜像
image       → 给构建结果命名为 fullstack-learning-lab-api:local
context: .  → 构建时可以读取项目根目录范围内的文件
dockerfile  → 使用 apps/api/Dockerfile 作为制作说明
```

PostgreSQL 和 MinIO 直接使用别人发布的镜像；API 是当前项目自己的代码，因此需要根据 Dockerfile 构建本地镜像。Dockerfile 的内容留到第 11D 课再拆。

## 第十三段：API 为什么使用服务名连接依赖

数据库连接：

```yaml
DATABASE_URL: "postgresql://${POSTGRES_USER:-fullstack}:${POSTGRES_PASSWORD:-fullstack_dev_password}@postgres:5432/${POSTGRES_DB:-fullstack_lab}?schema=public"
```

可以拆成：

```text
协议：postgresql
用户：fullstack
密码：fullstack_dev_password
主机：postgres
端口：5432
数据库：fullstack_lab
Schema：public
```

API 容器里的 `localhost` 指 API 容器自己。PostgreSQL 在另一个容器，所以这里通过 Compose 网络中的服务名 `postgres` 访问。

MinIO 内部连接同理：

```yaml
MINIO_ENDPOINT: minio
MINIO_PORT: "9000"
```

表示 NestJS 容器通过 `minio:9000` 调用 MinIO 容器。

## 第十四段：内部地址和浏览器地址为什么不同

```yaml
MINIO_ENDPOINT: minio
MINIO_PORT: "9000"
MINIO_PUBLIC_URL: ${MINIO_PUBLIC_URL:-http://127.0.0.1:9000}
```

它们服务于不同访问者：

```text
API 容器访问 MinIO       → minio:9000
Windows 浏览器打开 PDF   → 127.0.0.1:9000
```

浏览器不在 Compose 容器网络里，通常无法解析服务名 `minio`，所以后端生成的预览地址要使用浏览器可访问的公开地址。

正式部署时公开地址应换成用户能够访问的 HTTPS 域名，而不是 `127.0.0.1`。

## 第十五段：API 端口映射

```yaml
environment:
  PORT: "3000"
ports:
  - "${API_HOST_PORT:-3000}:3000"
```

- `PORT` 告诉 NestJS 在容器内监听 3000。
- `ports` 默认把 Windows 3000 映射到容器 3000。

如果 Windows 上的 `pnpm dev` 已经占用 3000，Docker API 就无法同时绑定同一个主机端口。可以停止本机开发服务，或者明确使用另一个 `API_HOST_PORT`。

## 第三阶段只读验证

运行：

```powershell
docker compose exec postgres getent hosts minio
docker compose ps -a api
```

第一个命令从 PostgreSQL 容器内部查询 Compose 服务名 `minio`，返回的容器 IP 可能变化，所以配置应使用稳定的服务名而不是写死 IP。第二个命令确认 API 容器的当前状态。

回答：

1. `build` 和 `image` 在 API 配置中分别负责什么？
2. 为什么 Docker API 的 `DATABASE_URL` 使用 `postgres:5432`，而 Windows 上运行的开发 API 使用 `127.0.0.1:5432`？
3. 为什么 `MINIO_ENDPOINT` 是 `minio`，`MINIO_PUBLIC_URL` 却是 `127.0.0.1`？
4. 如果本机 NestJS 已占用 3000，直接启动 Docker API 会发生什么？
5. `getent hosts minio` 是否成功解析出地址？API 容器当前是什么状态？

第三阶段已完成。`getent` 返回的 `172.18.0.2` 是 MinIO 容器当前在 Compose 私有网络中的 IP；容器重建后 IP 可能变化，因此应用使用稳定服务名 `minio`。

## 第十六段：depends_on 只管理启动依赖

```yaml
depends_on:
  postgres:
    condition: service_healthy
  minio:
    condition: service_healthy
```

它告诉 Compose：启动 API 前，先等待 PostgreSQL 和 MinIO 的健康检查通过。

它不是持续运行的故障管理器。如果 MinIO 在 API 启动十分钟后停止：

```text
API 不会因为 depends_on 自动停止
API 的 ready 会报告 503
API 的健康检查随后可能变成 unhealthy
```

这正是之前故障实验中出现“API 进程仍存活，但依赖尚未就绪”的原因。

## 第十七段：API 自己的健康检查

```yaml
healthcheck:
  test:
    - CMD
    - node
    - -e
    - "fetch('http://127.0.0.1:3000/api/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
  interval: 5s
  timeout: 3s
  retries: 10
  start_period: 15s
```

这段配置在 API 容器内部请求它自己的 `ready` 接口：

- `127.0.0.1:3000` 此时指 API 容器自己，所以使用 localhost 是正确的。
- 返回 2xx 视为成功，其他状态或连接失败以退出码 1 表示检查失败。
- 启动后的前 15 秒是宽限期，避免应用初始化时过早判定失败。
- 之后每 5 秒检查，单次最多等 3 秒，连续失败达到条件后标记为 `unhealthy`。

## 第十八段：restart 不等于健康检查修复

```yaml
init: true
restart: unless-stopped
```

- `init: true`：在容器里加入一个很小的 init 进程，帮助正确转发停止信号和清理子进程。知道作用即可，不需要研究 Linux 进程细节。
- `restart: unless-stopped`：主要进程异常退出或 Docker 重启时尝试重新启动；如果是人明确停止，则保持停止。

仅仅变成 `unhealthy` 不等于主要进程已经退出，普通 Docker Compose 不会因为健康检查失败就自动重启容器。监控负责发现，恢复动作仍要按故障原因决定。

## 第十九段：Web 服务

```yaml
web:
  image: fullstack-learning-lab-web:local
  build:
    context: .
    dockerfile: apps/web/Dockerfile
  ports:
    - "${WEB_HOST_PORT:-8080}:80"
  depends_on:
    api:
      condition: service_healthy
```

默认含义：

```text
根据 apps/web/Dockerfile 构建 fullstack-learning-lab-web:local
Windows 8080 → Web 容器 80
首次启动 Web 前等待 API healthy
```

这与 Windows 上由 Vite 提供的 5173 开发服务是两套进程。

Web 健康检查：

```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://127.0.0.1/healthz"]
```

它只确认 Web 容器里的 Nginx 能响应 `/healthz`，不代表登录、评分、PostgreSQL 和 MinIO 全部正常。

## 第四阶段：把 YAML 转回熟悉的对象

运行：

```powershell
$config = docker compose config --format json | ConvertFrom-Json
$config.services.api.depends_on | ConvertTo-Json
$config.services.web.ports | Format-Table
```

第一行让 Compose 完成 YAML 解析和变量替换，再由 PowerShell 转成对象。后两行只读取对象中的 API 依赖和 Web 端口，不会修改容器。

回答：

1. 如果 MinIO 在 API 启动后停止，`depends_on` 会不会自动停止或重启 API？
2. API 健康检查中的 `127.0.0.1:3000` 指谁？为什么这里不用服务名 `api`？
3. API 变成 `unhealthy` 后，`restart: unless-stopped` 是否保证自动重启？
4. Web 的主机端口和容器端口分别是什么？它和 Vite 5173 是不是同一个服务？
5. Web 显示 `healthy` 能否证明评分和文件预览一定正常？

完成后，你应该能把 `compose.yaml` 当作一份结构化的“多服务运行说明”阅读，而不需要背诵 YAML 或 Compose 语法。
