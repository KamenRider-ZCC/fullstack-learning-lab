# 第 7 课：Docker 化完整前后端系统

前六课中，React 和 NestJS 直接运行在 Windows，只有 PostgreSQL 与 MinIO 在容器中。本课把前端和后端也制作成镜像，让四个服务通过一条命令组成完整系统。

这一课的重点不只是“会运行 Docker 命令”，而是理解源码怎样变成镜像、镜像怎样变成容器、容器之间怎样通信，以及业务数据为什么不会随着容器删除而消失。

## 1. 本课完成了什么

- 为 NestJS API 编写多阶段 Dockerfile。
- 在 Linux 镜像中生成 Prisma Client、编译 TypeScript 并执行数据库迁移。
- 为 React 编写构建镜像，再用 Nginx 托管静态产物。
- 由 Nginx 把浏览器的 `/api` 请求反向代理到 API 容器。
- 用 Docker Compose 编排 Web、API、PostgreSQL 和 MinIO。
- 为四个服务配置启动顺序和健康检查。
- 使用根目录 `.env` 管理 Compose 环境变量。
- 保留 PostgreSQL 和 MinIO 原有 Volume 数据。

完整启动：

```powershell
cd D:\projects\fullstack-learning-lab
pnpm stack:up
```

等待服务 healthy 后打开：

```text
http://localhost:8080
```

## 2. 先理解镜像和容器

可以把镜像想成“不可修改的应用安装包”，把容器想成“这个安装包的一次运行实例”。

```text
Dockerfile + 源码
        │ docker build
        ▼
      镜像
        │ docker run / compose up
        ▼
      容器
```

修改源码不会自动改变已经构建好的镜像，也不会自动改变正在运行的容器。要让容器使用新代码，需要重新构建镜像并重新创建容器。

`pnpm stack:up` 内部使用 `docker compose up --build -d`：

- `--build`：启动前检查并构建镜像。
- `-d`：让容器在后台运行，终端可以继续使用。

这和 Vite 热更新不同。Docker 模式模拟可交付的生产产物，不追求保存源码后立即刷新。

## 3. 为什么还要保留 pnpm dev

本项目现在有两种运行方式：

| 方式 | 前端与后端运行位置 | 优点 | 适用场景 |
| --- | --- | --- | --- |
| `pnpm dev` | Windows Node.js 进程 | 热更新快、调试方便 | 日常编码 |
| `pnpm stack:up` | Linux 容器 | 环境统一、接近交付 | 联调、部署演练 |

Docker 化不是用容器替代所有本地开发。日常写代码通常继续用 `pnpm dev`；准备交付时，再证明代码能在干净 Linux 镜像中运行。

两种方式默认都使用宿主机 3000 端口，因此不能同时启动。切换到 Docker 模式前，应先在 `pnpm dev` 终端按 `Ctrl+C`。

## 4. Dockerfile 是什么

Dockerfile 是构建镜像的步骤说明。常见指令包括：

| 指令 | 作用 |
| --- | --- |
| `FROM` | 选择基础镜像或开始新阶段 |
| `WORKDIR` | 设置后续命令的工作目录 |
| `COPY` | 把构建上下文中的文件复制进镜像 |
| `RUN` | 构建时执行命令并形成镜像层 |
| `ENV` | 设置镜像内环境变量 |
| `USER` | 指定容器进程身份 |
| `EXPOSE` | 说明程序在容器内监听的端口 |
| `CMD` | 声明容器默认启动命令 |

`RUN` 发生在构建镜像时，结果会保存；`CMD` 发生在每次启动容器时。不要把“启动服务器”写进 `RUN`。

## 5. 为什么构建上下文必须是仓库根目录

Compose 中 API 配置为：

```yaml
build:
  context: .
  dockerfile: apps/api/Dockerfile
```

Dockerfile 虽然位于 `apps/api`，但它要读取根目录的 `package.json`、`pnpm-lock.yaml` 和 `pnpm-workspace.yaml`。Dockerfile 只能 `COPY` 构建上下文内的文件，所以这里使用仓库根目录 `.` 作为上下文。

路径的判断基准不同：

- `dockerfile` 路径相对于 Compose 文件。
- Dockerfile 中的 `COPY` 源路径相对于 build context。
- `WORKDIR` 是镜像内部路径，与 Windows 的 `D:\projects` 无关。

## 6. .dockerignore 为什么重要

如果构建上下文直接发送整个仓库，Docker 可能把本机 `node_modules`、`.env`、构建产物和旧上传文件一起传给构建器。

`.dockerignore` 排除了：

- `.git` 和本地 Codex 文件。
- 所有 `node_modules`、`dist` 和 Vite 缓存。
- `.env` 与日志。
- `apps/api/storage` 中的旧本地文件。

它有三个目的：

1. 减少构建上下文，加快构建。
2. 防止 Windows 依赖被错误复制进 Linux 镜像。
3. 防止密码、Token 和业务文件进入镜像层。

即使后来删除镜像中的密钥，早期镜像层仍可能保留它，所以敏感文件应从一开始就不进入构建上下文。

## 7. 为什么先复制 package.json 再复制源码

API 构建阶段先执行：

```dockerfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @fullstack-lab/api...
```

之后才复制 `apps/api` 源码。

Docker 会缓存每一步。如果只修改 `.ts` 文件，依赖清单没有变化，下一次构建可以复用安装依赖的镜像层；如果先复制所有源码，每次改一个字都可能重新安装依赖。

`--frozen-lockfile` 要求 lockfile 与 package.json 一致，构建过程不会偷偷选择新的依赖版本。这样今天和下周构建更容易得到相同结果。

## 8. API 为什么采用多阶段构建

文件：`apps/api/Dockerfile`。

它包含四个命名阶段：

```text
base
 ├─ build：安装全部依赖 → 生成 Prisma Client → 编译 TypeScript
 └─ production-dependencies：只安装生产依赖 → 生成 Prisma Client

runtime：Node.js + OpenSSL + 生产依赖 + prisma + dist
```

`build` 阶段需要 TypeScript、类型声明和编译器，但容器运行 `dist/main.js` 时不需要这些工具。`production-dependencies` 使用 `--prod`，只准备运行所需依赖。

最终 `runtime` 从前两个阶段复制结果，而不是复制源码和完整开发依赖。这就是多阶段构建：中间阶段可以很重，最终镜像只保留交付需要的内容。

## 9. 为什么 Prisma 在 dependencies 中

`@prisma/client` 是业务代码访问数据库的运行库；`prisma` 是执行 `generate`、`migrate` 等命令的 CLI。

以前只有本机开发和构建需要 Prisma CLI，所以它位于 `devDependencies`。现在 API 容器启动时会执行：

```text
prisma migrate deploy
```

因此 CLI 已成为当前部署方式的运行依赖，本课把 `prisma` 移入 `dependencies`。如果仍放在 devDependencies，`pnpm install --prod` 后容器将找不到迁移命令。

大型生产系统通常用单独的部署 Job 执行迁移，再启动多个 API 副本。当前项目只有一个 API 容器，为了让学习流程一条命令完成，先在 API 启动前执行迁移。

## 10. API 容器启动顺序

最终命令是：

```dockerfile
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
```

它表示：

1. 根据仓库已有迁移更新数据库结构。
2. 只有迁移成功才启动 NestJS。
3. `exec` 用 Node 进程替换 shell，让停止信号正确传给 NestJS。

这里使用已安装的 `./node_modules/.bin/prisma`，而不是在运行阶段执行 `pnpm exec`。运行镜像无需联网下载包，也不应临时修改依赖目录。

## 11. 本课真实遇到的 Corepack 问题

第一版容器使用 `pnpm exec prisma migrate deploy`。运行阶段没有复制根 `package.json`，Corepack 无法读取其中固定的 `pnpm@10.12.4`，于是尝试下载另一版本，并在非 root 用户目录中执行依赖检查，最终出现 EACCES。

日志证据包括：

```text
Corepack is about to download ... pnpm-11...
EACCES: permission denied ... /workspace/apps/api/_tmp...
```

正确修复不是把容器改成 root，也不是给整个应用目录开放写权限，而是移除不必要的运行期 pnpm：

- 构建阶段继续用固定 pnpm 安装依赖。
- 运行阶段直接调用已经安装好的 Prisma CLI。
- 最终镜像不再携带 pnpm 下载缓存。

排错原则是先确认“运行时真正需要什么”，而不是看到权限错误就扩大权限。

## 12. 为什么 API 使用非 root 用户

Dockerfile 在运行前声明：

```dockerfile
USER node
```

Node 官方镜像自带普通用户 `node`。如果应用被利用，攻击者获得的是受限用户权限，而不是容器内 root 权限。

非 root 不是完整安全边界，但属于低成本的基础加固。应用目前把文件写进 MinIO，不需要修改代码目录，因此很适合只读运行。

## 13. OpenSSL 为什么在 API 镜像中

Prisma 的 Linux 查询引擎依赖 OpenSSL。Windows 本机能运行，不代表精简 Alpine 镜像中一定有相同系统库。

API 的构建阶段和运行阶段都显式安装 OpenSSL：

- 构建阶段供 `prisma generate` 检测运行平台。
- 运行阶段供 Prisma Client 和迁移引擎连接数据库。

这是容器的价值之一：系统依赖也被记录在 Dockerfile，而不是依赖某台电脑“碰巧装过”。

## 14. React 为什么不能直接用 Vite 开发服务上线

`vite dev` 的主要目标是热更新和调试，不是生产静态服务。生产流程是：

```text
React / TypeScript 源码
        │ vite build
        ▼
dist/index.html + CSS + JS
        │ COPY
        ▼
Nginx 运行镜像
```

文件：`apps/web/Dockerfile`。

第一阶段使用 Node.js、pnpm、TypeScript 和 Vite 构建 `dist`。第二阶段从 `nginx:1.27-alpine` 开始，只复制 `dist` 与 Nginx 配置。

因此最终 Web 容器不需要 Node.js，也不包含 React 源码和测试依赖。

## 15. Nginx 做了两件事

文件：`apps/web/nginx.conf`。

### 15.1 托管前端静态文件

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

请求已有 JS、CSS 或图片时直接返回文件；其他路径回退到 `index.html`，为以后增加 React Router 做准备。

### 15.2 反向代理 API

```nginx
location /api/ {
  proxy_pass http://api:3000;
}
```

浏览器只访问 `http://localhost:8080/api/...`，Nginx 再通过 Compose 网络把请求转给 API。因为 `proxy_pass` 后没有额外路径和结尾斜杠，原始 `/api/...` 会保留，符合 NestJS 的全局前缀。

这与 Vite 开发代理作用相似，但运行位置不同：

- 开发模式由 Vite 转发。
- Docker 模式由 Nginx 转发。

前端代码始终请求相对地址 `/api`，所以不需要为两种模式写两套 API 地址。

## 16. 容器里的 localhost 陷阱

每个容器都有自己的网络空间。在 API 容器里：

- `localhost:3000` 是 API 自己。
- `localhost:5432` 不是 PostgreSQL 容器。
- `localhost:9000` 不是 MinIO 容器。

Compose 会创建内部网络和 DNS，服务名就是主机名：

```text
api → postgres:5432
api → minio:9000
web → api:3000
```

所以容器版 `DATABASE_URL` 使用 `postgres`，`MINIO_ENDPOINT` 使用 `minio`，Nginx 使用 `api`。

如果 Nginx 写 `proxy_pass http://localhost:3000`，它会寻找 Web 容器自身的 3000，结果通常是 502。

## 17. 端口映射怎么看

Compose 中：

```yaml
ports:
  - "8080:80"
```

左边是宿主机端口，右边是容器端口。访问 Windows 的 8080，会转到 Web 容器的 80。

默认映射为：

| 服务 | 宿主机 | 容器内 |
| --- | --- | --- |
| Web | 8080 | 80 |
| API | 3000 | 3000 |
| PostgreSQL | 5432 | 5432 |
| MinIO API | 9000 | 9000 |
| MinIO Console | 9001 | 9001 |

容器间通信使用右侧端口，不经过宿主机映射。API 即使临时映射为宿主机 3300，Nginx 仍应访问 `api:3000`。

## 18. MinIO 为什么有两个地址

API 与 MinIO 的普通 SDK 通信使用：

```text
MINIO_ENDPOINT=minio
MINIO_PORT=9000
```

但签名 URL 最终交给用户浏览器。浏览器不在 Compose 网络中，无法解析主机名 `minio`，所以签名必须使用：

```text
MINIO_PUBLIC_URL=http://127.0.0.1:9000
```

这两个配置表达不同视角：

- 内部地址：容器访问服务。
- 公共地址：用户浏览器访问服务。

如果局域网同事访问，应把 `MINIO_PUBLIC_URL` 改为运行 Docker 的电脑局域网 IP，例如 `http://192.168.2.15:9000`，然后重新创建 API 容器。

## 19. healthcheck 与 depends_on

“容器进程已启动”不等于“服务已经能工作”。PostgreSQL 可能还在初始化，API 可能还在迁移。

本课四个服务都配置了健康检查：

| 服务 | 探针 |
| --- | --- |
| PostgreSQL | `pg_isready` |
| MinIO | `/minio/health/live` |
| API | `/api/health` |
| Web | `/healthz` |

依赖链是：

```text
PostgreSQL healthy ─┐
                    ├─ API 启动并 healthy ── Web 启动
MinIO healthy ──────┘
```

`depends_on.condition: service_healthy` 让 Compose 等依赖真正健康再启动下一层。它改善启动顺序，但不是应用重试的永久替代：运行几天后数据库临时断开，成熟系统还要有重连、告警和恢复机制。

## 20. init 和 restart 的作用

API 设置 `init: true`，Compose 会在容器中加入轻量 init 进程，帮助转发信号并回收子进程。

API 与 Web 使用：

```yaml
restart: unless-stopped
```

进程异常退出或 Docker 重启时会尝试恢复；如果你明确手动停止，则保持停止。

restart policy 不能修复配置错误。容器不断重启时应查看日志，不能把“正在反复尝试”误认为“系统可用”。

## 21. 数据为什么不会随容器重建消失

PostgreSQL 和 MinIO 使用命名 Volume：

```text
postgres-data → /var/lib/postgresql/data
minio-data    → /data
```

容器是可替换的运行实例，Volume 才是持久数据位置。重新构建 API 或 Web 镜像不会修改 Volume。

安全停止：

```powershell
pnpm stack:down
```

它删除容器与默认网络，但保留 Volume。不要随意执行：

```powershell
docker compose down -v
```

`-v` 会删除数据库和 MinIO 的持久 Volume，评分和 PDF 可能无法恢复。

## 22. 根 .env 与 apps/api/.env 的区别

项目现在可能出现两个同名环境文件：

| 文件 | 谁读取 | 用途 |
| --- | --- | --- |
| `apps/api/.env` | 本机 NestJS / Prisma | `pnpm dev` 和本地数据库命令 |
| 根目录 `.env` | Docker Compose | 容器环境、端口映射和密码 |

第一次可以执行：

```powershell
Copy-Item .env.docker.example .env
```

两个 `.env` 都被 Git 忽略，`.env.example` 才能提交。正式部署必须更换：

- PostgreSQL 密码。
- MinIO 管理账号与密钥。
- JWT_SECRET。
- 对外可访问的 MinIO 地址。

如果数据库密码包含 `@`、`:`、`/` 等 URL 特殊字符，拼入 `DATABASE_URL` 时需要 URL 编码。后续部署课会把密钥管理再拆开。

## 23. 完整启动流程

### 第一次

```powershell
cd D:\projects\fullstack-learning-lab
Copy-Item .env.docker.example .env
pnpm test:all
pnpm stack:up
docker compose ps
```

看到四个服务 healthy 后打开 `http://localhost:8080`。

### 修改代码后

```powershell
pnpm test
pnpm stack:up
```

Compose 会复用没有变化的镜像层，只重新构建受影响部分。

### 停止

```powershell
pnpm stack:down
```

## 24. 常用排查命令

查看状态：

```powershell
docker compose ps
```

查看前后端日志：

```powershell
pnpm stack:logs
```

只看 API 最近 100 行：

```powershell
docker compose logs --tail 100 api
```

在 API 容器中查看环境视角，但不要打印密钥：

```powershell
docker compose exec api node -e "console.log(process.env.MINIO_ENDPOINT)"
```

查看镜像：

```powershell
docker image ls fullstack-learning-lab-*
```

检查 Compose 最终配置语法：

```powershell
docker compose config --quiet
```

不要把完整的 `docker compose config` 输出发到群里，因为展开后的环境变量可能包含密码。

## 25. 常见故障排查

### 3000 端口已被占用

通常是 `pnpm dev` 尚未停止。先回到开发终端按 `Ctrl+C`，再运行 `pnpm stack:up`。

检查占用者：

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object LocalPort -in 3000,8080 |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

### API unhealthy

```powershell
docker compose logs api
```

重点查看 Prisma 迁移、数据库连接、JWT_SECRET 和 MinIO 初始化错误。不要只反复重启。

### Web 返回 502 Bad Gateway

说明 Nginx 可访问，但 API 上游不可用。检查 API 是否 healthy，并确认 Nginx 指向 `api:3000`。

### 前端能登录，PDF 预览失败

检查浏览器拿到的签名 URL。若其中主机名是 `minio`，说明误把内部地址当公共地址；若局域网用户拿到 `127.0.0.1`，它会指向用户自己的电脑。

### 修改代码后页面没变化

运行 `pnpm stack:up` 重新构建并创建容器。浏览器仍缓存旧资源时做一次强制刷新。

### 构建时重新下载所有依赖

第一次属于正常现象。之后如果 package 清单未变化仍无法命中缓存，检查 Dockerfile 的 COPY 顺序和 `.dockerignore`。

### 容器不断 Restarting

`restart: unless-stopped` 正在重试失败命令。先看日志定位根因，修复后重新构建；不要通过扩大文件权限掩盖错误。

## 26. 本课已经做过的真实验证

本课不是只检查 YAML 语法，实际完成了：

1. 在 Docker 内构建 React 和 NestJS 镜像。
2. PostgreSQL 与 MinIO 变为 healthy。
3. API 自动执行三条已有迁移并启动。
4. Web 容器通过 Nginx 返回首页。
5. `/api/health` 经 Nginx 代理返回 ok。
6. viewer 通过 Nginx 登录并读取 3 条文件记录。
7. 第一份 PDF 的签名 URL 返回 200 和 `application/pdf`。
8. 测试前后的数据库记录数仍为 3，原有 Volume 没有删除。

验证时本机开发 API 正占用 3000，因此只把容器 API 的宿主机端口临时改为 3300。容器内部始终使用 `api:3000`，这恰好证明内部端口与宿主机映射彼此独立。

## 27. 当前方案还不等于正式公网生产

本课交付的是可复制的单机容器环境，仍缺少正式上线要素：

- 域名和 HTTPS。
- 防火墙与只开放必要端口。
- 独立密钥管理。
- 数据库和对象存储备份。
- 日志收集、监控和告警。
- 镜像仓库、版本标签和回滚。
- CI/CD 自动构建与部署。
- 多副本运行时独立迁移 Job。

“Docker 能启动”是交付基础，不是运维工作的终点。后续课程会逐项补齐。

## 28. 建议亲手完成的实验

### 实验 A：观察镜像与容器的区别

运行 `docker image ls fullstack-learning-lab-*`，再运行 `docker compose ps`。解释为什么镜像存在不代表服务正在运行。

### 实验 B：观察构建缓存

连续执行两次 `pnpm stack:build`，比较第二次输出中的 `CACHED`。然后只修改前端一段文字，观察 API 依赖层是否仍被复用。

### 实验 C：从 Nginx 验证代理

分别访问：

```text
http://localhost:8080/
http://localhost:8080/api/health
```

说明两个响应分别由谁生成，以及浏览器为什么只需要知道 8080。

### 实验 D：观察持久化

记录文件数量，运行 `pnpm stack:down` 再 `pnpm stack:up`，确认登录、评分和文件记录仍存在。不要添加 `-v`。

### 实验 E：制造安全的代理错误

只阅读 `nginx.conf`，思考把 `api` 改成 `localhost` 后为什么会 502。无需为了实验破坏当前配置。

## 29. 本课自测

<details>
<summary>1. 镜像和容器有什么区别？</summary>

镜像是不可变的应用模板；容器是镜像的一次运行实例，同一镜像可以创建多个容器。
</details>

<details>
<summary>2. 为什么 Dockerfile 位于 apps/api，却使用仓库根目录作为 context？</summary>

API 属于 pnpm workspace，构建需要读取根 package.json、lockfile 和 workspace 配置，而 Dockerfile 不能读取 context 之外的文件。
</details>

<details>
<summary>3. 多阶段构建解决什么问题？</summary>

构建阶段可以保留编译工具，最终阶段只复制运行产物和生产依赖，从而减小镜像并减少攻击面。
</details>

<details>
<summary>4. 为什么容器里的 API 不能连接 localhost:5432？</summary>

localhost 指 API 容器自己。PostgreSQL 是另一个容器，应通过 Compose DNS 使用 `postgres:5432`。
</details>

<details>
<summary>5. MINIO_ENDPOINT 和 MINIO_PUBLIC_URL 为什么不同？</summary>

前者供 API 容器内部连接 MinIO；后者被写入签名 URL，必须让用户浏览器能够访问。
</details>

<details>
<summary>6. depends_on 为什么还要配 healthcheck？</summary>

只按创建顺序启动不能证明服务已准备好；healthcheck 让依赖方等待服务真正可响应。
</details>

<details>
<summary>7. 为什么 Prisma CLI 被移到生产依赖？</summary>

当前 API 容器在每次启动前执行 migrate deploy，因此运行阶段确实需要 Prisma CLI。
</details>

<details>
<summary>8. docker compose down 为什么通常不会删除 PDF？</summary>

普通 down 删除容器和网络，但命名 Volume 保留；只有额外使用 `-v` 才会删除这些持久数据。
</details>

<details>
<summary>9. 为什么前端容器用 Nginx 而不是 vite dev？</summary>

Vite 开发服务面向热更新；生产先构建静态 dist，再由轻量、稳定的 Nginx 托管。
</details>

<details>
<summary>10. 为什么权限错误不应该直接通过 USER root 修复？</summary>

扩大权限会掩盖运行阶段的不必要写入并降低安全性，应先判断程序是否真的需要写该目录或运行该工具。
</details>

## 30. 本课涉及的文件

| 文件 | 作用 |
| --- | --- |
| `.dockerignore` | 缩小构建上下文并排除敏感、本地文件 |
| `.env.docker.example` | Compose 环境变量示例 |
| `apps/api/Dockerfile` | 构建 NestJS 生产镜像 |
| `apps/web/Dockerfile` | 构建 React 并生成 Nginx 镜像 |
| `apps/web/nginx.conf` | 静态托管、健康接口和 API 反向代理 |
| `compose.yaml` | 编排四个服务、端口、依赖和健康检查 |
| `apps/api/package.json` | 把运行期迁移所需 Prisma CLI 归入生产依赖 |
| 根 `package.json` | 提供 stack:build、stack:up、stack:down 和 stack:logs |

## 31. 本课完成标准

- `pnpm stack:build` 能构建 API 和 Web 两个镜像。
- `pnpm stack:up` 后四个服务均 healthy。
- `http://localhost:8080` 可以打开前端。
- `http://localhost:8080/api/health` 可以经过 Nginx 访问 API。
- 登录、文件列表和签名 URL 预览正常。
- `pnpm stack:down` 后 PostgreSQL 与 MinIO Volume 仍存在。
- 你能解释容器内为什么使用 `postgres`、`minio` 和 `api`，而不是 localhost。
- 你能解释 build 阶段、production-dependencies 阶段与 runtime 阶段各自保留什么。
- 你知道正式上线前还必须补充 HTTPS、密钥、备份、监控和回滚。

达到这些标准后进入第 8 课：把 Nginx 从“容器内静态服务”提升为正式统一入口，学习域名、HTTPS、CORS、iframe CSP 和生产环境网络边界。
