# 第 11B 课：Docker 核心概念与只读观察

本课不写 Dockerfile，也不修改 Compose。目标是看到 Docker 命令输出时，能分清镜像、容器、端口、Volume 和网络。

## 1. Docker 解决什么问题

普通部署需要在每台机器分别安装 Node.js、PostgreSQL、MinIO 等软件，并处理版本和配置差异。Docker 把应用及其运行环境做成镜像，再从镜像启动隔离的容器，使不同机器更容易运行同一版本。

它不能自动保证业务正确，也不能代替数据库备份、权限设计和生产运维。

## 2. 先记住一条主线

```text
Dockerfile（制作说明）
→ docker build
→ Image 镜像（只读模板）
→ docker run / docker compose up
→ Container 容器（正在运行的实例）
```

可以类比前端：

```text
源代码 + 构建配置 → pnpm build → dist 构建产物 → Web 服务器运行
Dockerfile          → docker build → Image       → Container 运行
```

类比只用于帮助入门，两者并不完全相同。

## 3. Image：镜像

镜像是创建容器的只读模板，通常包含应用代码、运行时和启动命令。例如：

- `postgres:16-alpine`：带 PostgreSQL 16 的镜像。
- `minio/minio`：带 MinIO 服务的镜像。
- 项目 API 镜像：包含编译后的 NestJS 和 Node.js 运行环境。

同一个镜像可以创建多个容器。修改正在运行的容器，并不会自动修改原镜像。

AI 开发必须确认镜像名称和版本，不要在生产环境随意依赖会变化的标签。

## 4. Container：容器

容器是镜像启动后的运行实例。一个容器通常运行一个主要进程，例如 PostgreSQL 进程。

常见状态：

- `running`：主要进程正在运行。
- `stopped/exited`：容器还在，但进程已停止。
- 被删除：容器实例不存在，可以再从镜像创建。

停止、删除容器和删除镜像是三件不同的事。

## 5. Port：端口映射

容器有自己的网络空间。下面的显示：

```text
0.0.0.0:5432->5432/tcp
```

含义是：

```text
Windows 主机 5432 端口 → PostgreSQL 容器 5432 端口
```

冒号左边是主机端口，右边是容器端口。浏览器或本机程序通常访问左边；同一 Compose 网络里的其他容器通常通过服务名和右边端口访问。

开放到 `0.0.0.0` 可能允许局域网访问，正式环境还要结合防火墙和访问控制判断风险。

## 6. Volume：持久化数据

容器可以删除和重建，因此数据库和文件不能只存在容器可写层。Volume 是由 Docker 管理、生命周期独立于普通容器的数据存储位置。

本项目中：

- PostgreSQL Volume 保存数据库文件。
- MinIO Volume 保存上传的 PDF 对象。
- Prometheus Volume 保存已采集的历史指标。

一般情况下：

```text
停止容器                  → Volume 还在
删除并重建普通容器         → 命名 Volume 还在
docker compose down       → 默认保留命名 Volume
docker compose down -v    → 删除 Compose 的 Volume，可能丢失数据
```

所以不要在不清楚目标和备份情况时运行带 `-v` 的删除命令。

## 7. Network：容器间通信

Compose 默认会为项目创建网络，并提供服务名解析。

例如 API 运行在容器里时连接 PostgreSQL，通常使用：

```text
postgres:5432
```

其中 `postgres` 是 Compose 服务名。容器里的 `localhost` 指当前容器自己，不是 Windows，也不是另一个容器。

从 Windows 本机访问已映射的 PostgreSQL，则通常使用：

```text
localhost:5432
```

这是 Docker 初学者最常遇到的地址区别。

## 8. Docker Compose 是什么

Docker Engine 负责镜像和容器等底层能力。Docker Compose 读取 Compose YAML，一次管理一组有关联的服务、网络和 Volume。

本项目使用 Compose 同时描述 PostgreSQL、MinIO、API、Web；监控 Compose 描述 Prometheus、Grafana、Alertmanager。

本课只理解它的职责，第 11C 课再逐段阅读 `compose.yaml`。

## 9. 当前项目有两套运行方式

开发模式：

```text
Windows node.exe：Vite 5173、NestJS 3000
Docker 容器：PostgreSQL 5432、MinIO 9000/9001
```

完整 Docker 模式：

```text
Docker Web 容器：Windows 8080 → 容器 80
Docker API 容器：Windows 3000 → 容器 3000
Docker 容器：PostgreSQL、MinIO
```

因此 Docker Web 容器停止时，Windows 上的 Vite 仍可通过 `http://localhost:5173` 提供页面。两套 API 都想占用 Windows 的 3000 端口，不能同时启动；切换到完整 Docker 模式前应先停止本机 `pnpm dev`。

## 10. 常用生命周期命令

```powershell
docker compose ps
```

只读查看当前项目的容器、状态和端口。

```powershell
docker compose stop minio
docker compose start minio
```

停止或重新启动已有 MinIO 容器，不删除容器和 Volume。

```powershell
docker compose up -d
```

按配置创建或更新服务，并在后台运行。

```powershell
docker compose down
```

停止并删除当前 Compose 项目的容器和网络，默认保留命名 Volume。当前阶段不要自行追加 `-v`。

## 11. AI 开发中的掌握边界

必须理解：

- 镜像是模板，容器是运行实例。
- 主机端口和容器端口不是一个概念。
- 容器中的 `localhost` 只指该容器自己。
- 需要持久保存的数据应该进入 Volume 或外部存储。
- 停止容器、删除容器、删除 Volume 的影响不同。
- 运行 AI 给出的 Docker 命令前，判断它是只读、可恢复还是可能删除数据。

暂时不要求：

- 记忆 Docker CLI 的全部参数。
- 理解 Linux namespace、cgroup、镜像分层的底层实现。
- 独立设计生产集群、负载均衡和容器编排平台。

## 12. 今天的只读实验

在项目根目录运行：

```powershell
docker compose ps
docker compose images
docker volume ls
```

这三个命令只读取状态，不会停止或删除服务。

根据真实输出回答：

1. `postgres` 和 `minio` 容器是否正在运行？
2. PostgreSQL 使用的镜像名称和版本是什么？
3. MinIO 映射了哪两个主机端口，它们分别指向哪个容器端口？
4. 输出中找到了哪些名称包含 `fullstack-learning-lab` 的 Volume？
5. 用一句话说明镜像、容器和 Volume 的区别。

## 13. 官方资料

- Docker 官方概览：<https://docs.docker.com/get-started/docker-overview/>
- 容器入门：<https://docs.docker.com/get-started/docker-concepts/running-containers/>
- 持久化存储：<https://docs.docker.com/get-started/docker-concepts/running-containers/persisting-container-data/>
- Docker Compose：<https://docs.docker.com/compose/>

第一次只读概览和容器入门，不需要从头通读全部官方文档。
