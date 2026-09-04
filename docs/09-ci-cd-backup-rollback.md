# 第 9 课：CI/CD、生产部署、备份与回滚

这一课不要求你立刻成为运维。目标是先建立一条完整而安全的主线：代码经过自动检查，变成有明确版本号的镜像，由人确认后部署；上线失败时能切回旧应用；数据则有独立的备份与恢复流程。

## 一、完成这一课后你应该会什么

你应该能够解释：

1. CI、持续交付和持续部署并不是同一件事。
2. 为什么线上运行的是“构建制品”，不是开发者电脑上的源码目录。
3. 为什么生产环境应使用 `sha-...` 镜像标签，而不能只写 `latest`。
4. 为什么应用回滚和数据库恢复是两种操作。
5. 为什么“脚本执行成功”还不能证明备份可以恢复。
6. 域名、证书、服务器、镜像仓库、数据库和对象存储分别由谁负责。

本课新增的主要文件：

| 文件 | 作用 |
| --- | --- |
| `.github/workflows/ci.yml` | 自动检查、测试、构建并向 GHCR 推送镜像 |
| `.env.production.example` | 生产环境变量模板，不含真实密钥 |
| `compose.production.yaml` | 只用于生产部署的 Compose 配置 |
| `deploy/nginx.production.conf` | 生产 HTTPS、反向代理和安全响应头 |
| `scripts/create-backup.mjs` | 导出 PostgreSQL 并复制 MinIO 对象 |
| `scripts/verify-backup.mjs` | 校验 SHA-256 并检查数据库归档可读性 |

## 二、先建立发布流程的全景图

一次正常发布沿着下面的方向前进：

```text
开发者提交代码
      ↓
GitHub 收到 Pull Request
      ↓
GitHub Actions：类型检查 → 测试 → 构建 → Compose 配置检查
      ↓ 全部通过后合并
构建 API/Web 镜像并推送到 GHCR
      ↓
负责人选择 sha-<提交摘要> 版本
      ↓
生产服务器：备份 → pull → up -d → 健康与业务检查
      ↓
成功：保留版本记录    失败：切回上一个镜像标签
```

这里有三个容易混淆的名词：

- **CI（持续集成）**：自动验证多人的代码能否安全地合在一起。
- **持续交付**：自动产出“已经通过检查、随时可以部署”的镜像，但上线由人确认。
- **持续部署**：检查通过后，系统自动修改生产环境。

本项目做到前两项，没有自动登录服务器。这是刻意的学习边界：在你还没有权限审批、Secret 管理、监控和成熟回滚方案前，不应让一次普通提交直接改变生产系统。

## 三、逐段理解 GitHub Actions

工作流文件是 `.github/workflows/ci.yml`。GitHub 读取它后，会在临时 Linux Runner 上执行任务。

### 1. 什么时候触发

```yaml
on:
  push:
    branches: [master]
    tags: ["v*"]
  pull_request:
    branches: [master]
  workflow_dispatch:
```

- 向 `master` 提交会触发。
- 新建或更新以 `master` 为目标的 Pull Request 会触发。
- 推送 `v1.0.0` 这类标签会触发。
- `workflow_dispatch` 允许在 GitHub 页面手工运行。

### 2. `quality` 为什么先执行

这个任务依次安装锁定版本的依赖，然后执行：

```text
pnpm check
pnpm test:all
pnpm build
docker compose ... config --quiet
```

`pnpm install --frozen-lockfile` 的含义是严格按照 `pnpm-lock.yaml` 安装。如果 `package.json` 与锁文件不一致，CI 会失败，而不是在 Runner 上偷偷生成一个新锁文件。

测试包括后端单元测试、React 组件测试和真实 API 集成测试。集成测试使用隔离的 PostgreSQL 与 MinIO，结束后销毁测试容器，不接触开发或生产数据。

### 3. `images` 为什么依赖 `quality`

```yaml
needs: quality
```

只有质量任务通过，镜像任务才会开始。矩阵会分别构建 `api` 和 `web`，避免复制两套几乎相同的配置。

Pull Request 不推送镜像，因为它仍是待审代码：

```yaml
if: github.event_name != 'pull_request'
```

工作流只给镜像任务 `packages: write`，其他任务保持只读。这叫最小权限原则。

### 4. 镜像标签表示什么

工作流会产生类似地址：

```text
ghcr.io/kamenrider-zcc/fullstack-learning-lab-api:sha-a1b2c3d
ghcr.io/kamenrider-zcc/fullstack-learning-lab-web:sha-a1b2c3d
```

SHA 指向一次确定的 Git 提交。部署记录只要保存这两个标签，就知道服务器运行的是哪份代码。

`latest` 会随着新构建移动，只适合表达“目前最新”，不适合回答“昨天线上到底是哪一版”。生产 `.env.production` 因此应该固定 SHA 标签。

## 四、为什么生产配置要和本地配置分开

本地 `compose.yaml` 公开多个端口，是为了学习和排错：

- PostgreSQL `5432`
- MinIO API `9000`
- MinIO Console `9001`
- API `3000`
- Web `8080`

生产环境不应该把数据库和对象存储直接暴露给互联网。`compose.production.yaml` 只公开 Web 的 80/443；Nginx 再通过容器内部网络访问 `api:3000` 和 `minio:9000`。

生产配置还使用 `image:` 拉取 CI 生成的镜像，不包含 `build:`。这表示生产服务器不负责安装 npm 依赖和编译源码，它只运行已经检查过的制品。

## 五、`.env.production` 到底放什么

先复制模板：

```powershell
Copy-Item .env.production.example .env.production
```

这两个文件的区别非常重要：

- `.env.production.example` 可以提交，只展示变量名和假值。
- `.env.production` 不能提交，保存该环境的真实值。

你必须修改：

- `APP_DOMAIN`：解析到服务器的真实域名。
- `API_IMAGE`、`WEB_IMAGE`：本次批准上线的 SHA 镜像。
- `POSTGRES_PASSWORD`、`DATABASE_URL`：数据库密码与连接串。
- `MINIO_ROOT_USER`、`MINIO_ROOT_PASSWORD`：对象存储管理凭据。
- `JWT_SECRET`：至少 32 位的随机密钥。
- `TLS_CERT_PATH`、`TLS_KEY_PATH`：服务器上真实证书和私钥的绝对路径。

注意：如果数据库密码含有 `@`、`:`、`/` 等字符，放进 `DATABASE_URL` 时必须进行 URL 编码；`POSTGRES_PASSWORD` 本身仍填写原始密码。这也是两个值不能随便写成看起来相同的原因。

检查变量是否齐全，但不启动容器：

```powershell
pnpm production:config
```

该命令能发现缺失变量和 YAML 语法错误，但不能证明域名已解析、证书有效或镜像能够拉取。

## 六、第一次生产部署需要谁提供什么

在公司项目里，前端或全栈开发通常需要和项目经理、后端、运维确认：

| 信息或资源 | 常见负责人 | 为什么需要 |
| --- | --- | --- |
| Linux 服务器与登录权限 | 运维 | Docker 容器最终运行的位置 |
| 域名及 DNS 解析 | 运维/客户 | 用户用稳定地址访问，证书也绑定域名 |
| 80/443 防火墙策略 | 运维 | 允许 HTTP 跳转 HTTPS 和正式访问 |
| 可信 HTTPS 证书 | 运维 | 浏览器验证服务器身份并加密通信 |
| GHCR 拉取权限 | 仓库管理员 | 私有镜像不能匿名拉取 |
| 生产密码和 JWT Secret | 安全负责人/运维 | 不能由开发者写死到 Git |
| 备份位置、保留周期、RPO/RTO | 业务方与运维 | 决定能丢多少数据、多久恢复 |

仅有前端代码不能自动补齐这些生产资源。能明确说出缺少什么，是全栈交付能力的一部分。

## 七、生产服务器上的首次上线步骤

下面是操作手册，不会由本课自动执行。真实操作前要经过公司授权。

### 1. 准备最小部署目录

服务器不需要整个源码仓库。至少需要：

```text
compose.production.yaml
deploy/nginx.production.conf
.env.production
证书与私钥（可放在系统证书目录）
```

备份脚本若在服务器运行，还需要 `package.json`、`scripts/` 和 Node.js；正式公司也可以用独立运维脚本或备份系统代替它。

### 2. 登录私有 GHCR

```text
docker login ghcr.io
```

应使用权限尽可能小、可轮换的 Token，不能把个人密码写进脚本或聊天记录。公共镜像可不登录。

### 3. 发布前检查与备份

```powershell
docker compose --env-file .env.production --file compose.production.yaml config --quiet
pnpm backup:create:production
pnpm backup:verify
```

首次部署还没有生产数据时可以没有旧备份；已有系统更新前应按发布制度执行备份。备份完成后还要复制到另一台机器或对象存储，因为“备份和生产数据都在同一块硬盘”无法防止整盘损坏。

### 4. 拉取并启动指定版本

```powershell
docker compose --env-file .env.production --file compose.production.yaml pull
docker compose --env-file .env.production --file compose.production.yaml up --detach
docker compose --env-file .env.production --file compose.production.yaml ps
```

API 镜像启动时执行 `prisma migrate deploy`，应用已有迁移后再启动 NestJS。迁移失败会阻止 API 正常上线，应该先看日志，不能跳过迁移硬启动。

### 5. 查看日志和做冒烟检查

```powershell
docker compose --env-file .env.production --file compose.production.yaml logs --tail 100 api web
```

至少检查：

1. `https://真实域名/healthz` 能返回 `ok`。
2. 首页可打开且浏览器证书无警告。
3. 专家账号能登录、读取评分并保存一条允许修改的测试数据。
4. PDF 上传与预览正常。
5. 浏览器控制台没有 Mixed Content、CSP 或接口错误。

健康检查只证明某个探针能响应，不能代替这些业务检查。

## 八、备份脚本逐步做了什么

运行开发备份：

```powershell
pnpm backup:create
```

脚本依次执行：

1. 读取 Compose 最终配置，取得数据库名、账号和 Bucket 名。
2. 确认 PostgreSQL 与 MinIO 容器正在运行。
3. 在 PostgreSQL 容器内执行 `pg_dump --format=custom`。
4. 使用固定版本的 MinIO Client，把 Bucket 镜像到新目录。
5. 为数据库归档和每个对象计算 SHA-256。
6. 写入 `manifest.json`，最后才移除 `INCOMPLETE` 标记。

目录大致如下：

```text
backups/development/20260904T071227.531Z/
├─ database.dump
├─ manifest.json
└─ minio/
   └─ ...PDF 对象
```

如果中途失败，目录会保留 `INCOMPLETE`。保留部分文件是为了排错，但它们不能用于正式恢复。

`pg_dump` 是逻辑备份：它通过数据库理解的方式导出表结构和数据。直接复制一个正在运行的 PostgreSQL Volume 可能得到不一致文件，不能当作同等替代。

## 九、验证为什么是单独一步

执行：

```powershell
pnpm backup:verify
```

不提供路径时，脚本验证最新的已完成备份。也可以指定目录：

```powershell
pnpm backup:verify -- backups/development/20260904T071227.531Z
```

验证包含两层：

- 重新计算每个文件的大小和 SHA-256，与 `manifest.json` 比较。
- 用同一大版本的 `pg_restore --list` 读取数据库归档目录。

这能发现文件缺失、传输损坏和不可读归档，而且完全不会连接或修改数据库。

但这仍不是最高等级的证明。正式环境应定期做“隔离恢复演练”：创建一套临时 PostgreSQL 和临时 Bucket，恢复后检查用户数、评分数、文件数，并尝试登录和预览。永远不要把第一次恢复练习直接指向生产数据库。

## 十、数据库与 MinIO 的一致性限制

一次文件上传会同时产生：

- PostgreSQL 中的文件元数据；
- MinIO 中的 PDF 对象。

当前脚本先导出数据库，再复制 MinIO。两步之间如果仍有人上传或删除文件，二者可能不是完全相同的时间点。例如数据库导出后新上传的对象可能只出现在 MinIO 备份中。

学习环境可以接受这个限制。对一致性要求高的生产系统，应由架构和运维选择：

- 备份期间短暂停止写入；
- 使用数据库时间点恢复（PITR）与对象版本控制；
- 为业务操作设计可重放事件或补偿任务；
- 使用云厂商的一致性快照能力。

不要在不知道一致性要求时承诺“零数据丢失”。先和业务方确认 RPO 和 RTO。

## 十一、应用回滚怎么做

假设当前 `.env.production` 是：

```text
API_IMAGE=...-api:sha-new1111
WEB_IMAGE=...-web:sha-new1111
```

发布前记录的上一版是 `sha-old0000`。若新版本业务检查失败：

1. 把 `.env.production` 中 API/Web 镜像标签改回 `sha-old0000`。
2. 再次执行 `docker compose ... pull`。
3. 执行 `docker compose ... up --detach`。
4. 查看日志并重新做冒烟检查。

Compose 会用旧镜像重建 API/Web 容器，数据库和 MinIO Volume 不会因为容器替换而自动删除。

这叫应用回滚，不等于数据库恢复。若新版本已经执行了数据库迁移，旧应用能否读取新表结构取决于迁移是否向后兼容。正式项目常采用“扩展—迁移数据—切换—最后清理旧字段”的多阶段迁移，避免一上线就删除旧代码仍依赖的列。

## 十二、什么时候才考虑数据库恢复

以下情况才可能需要恢复数据：

- 人为误删或错误批量更新了业务数据；
- 数据库文件损坏；
- 服务器或存储发生灾难；
- 已确认某次迁移不可逆地破坏了数据。

数据库恢复前必须明确：

1. 恢复目标是哪套环境、哪个数据库。
2. 恢复到哪个时间点，会丢失该时间点之后哪些数据。
3. 当前现场是否先做了额外备份。
4. API 是否已停止写入。
5. PostgreSQL 与 MinIO 如何恢复到相互匹配的状态。
6. 谁批准，谁执行，谁验证。

因此项目没有提供“一键覆盖当前数据库”的命令。缺少这些确认时，自动恢复反而危险。

## 十三、常见失败怎么判断

### CI 中 `pnpm install --frozen-lockfile` 失败

通常是修改了 `package.json` 却没有提交对应 `pnpm-lock.yaml`。本地运行 `pnpm install`，检查依赖变化后一起提交。

### 单元测试通过，集成测试失败

检查数据库迁移、MinIO Bucket、环境变量和接口真实协作。单元测试中的 Mock 不证明外部服务配置正确。

### 服务器 `pull` 返回 unauthorized

镜像是私有的，或 GHCR Token 没有读取 package 的权限。检查登录账号和 `read:packages` 权限，不要把 Token 粘到日志或仓库。

### API 容器反复重启

查看 `docker compose ... logs api`。常见原因是数据库连接串错误、迁移失败、JWT 密钥缺失或依赖服务不健康。

### Web 健康但页面接口 502

Nginx 本身已启动，不代表 API 可访问。检查 API 容器状态和日志，再检查 Nginx 是否代理到 Compose 服务名 `api:3000`。

### 备份目录留下 `INCOMPLETE`

说明数据库导出或 MinIO 镜像过程中失败。不要删除旧的成功备份，也不要把该目录当作恢复源；先根据终端错误检查 Docker、容器状态、Bucket 和磁盘空间。

## 十四、动手实验

### 实验 A：读懂一次 CI

打开 GitHub 仓库的 Actions 页面，选择一次运行记录，回答：

1. 由 push、Pull Request 还是手工操作触发？
2. `quality` 中哪一步最慢？
3. 如果测试失败，`images` 是否仍执行？为什么？
4. 生成了哪两个 SHA 镜像标签？

### 实验 B：本地备份与验证

确保开发 PostgreSQL 和 MinIO 正在运行：

```powershell
pnpm infra:up
pnpm backup:create
pnpm backup:verify
```

打开最新 `manifest.json`，找到数据库归档和三个 PDF 的大小、SHA-256。不要手工修改原业务数据。

### 实验 C：证明校验能发现损坏

这个实验只操作被 Git 忽略的备份副本：

1. 再创建一份新备份。
2. 在最新备份的某个 PDF 副本末尾添加少量内容。
3. 执行 `pnpm backup:verify -- <该备份目录>`，应看到 checksum mismatch。
4. 删除这份故意损坏的备份副本，保留此前验证成功的备份。

### 实验 D：只解析生产配置

```powershell
docker compose --env-file .env.production.example --file compose.production.yaml config --quiet
```

该命令不会创建容器。继续运行不带 `--quiet` 的 `config`，观察生产配置是否只公开 80/443，以及 API 如何通过服务名连接 PostgreSQL 和 MinIO。输出可能包含展开后的示例变量；真实 `.env.production` 的展开结果不要发到群里。

## 十五、自测题

1. 为什么 CI Runner 不应该连接开发数据库做集成测试？
2. 为什么生产服务器不现场执行 `pnpm build`？
3. `latest` 与 `sha-a1b2c3d` 哪个更适合回滚，为什么？
4. 为什么 PostgreSQL 和 MinIO 都要备份？
5. `pg_restore --list` 成功是否等于业务一定能恢复？还缺什么？
6. 新版页面异常时，为什么不应该第一反应就恢复数据库？
7. 生产数据库和备份位于同一块磁盘，能防住哪些故障，防不住哪些故障？
8. RPO 为 5 分钟的系统，是否适合每天只备份一次？

如果这些问题能用自己的话解释，并能完成四个实验，你就已经走通了“代码到可回滚制品”的第一版完整流程。下一课会把注意力移到运行中的系统：如何用日志、请求 ID、指标和告警发现并定位故障。
