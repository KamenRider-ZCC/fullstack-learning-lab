# 第 10D 课：让 Prometheus 定时抓取指标

第 10C 课的 JSON 指标适合人阅读，但 Prometheus 使用自己的文本格式。本课让 API 同时输出标准文本，并单独启动一个 Prometheus 容器定时保存数据。

## 1. 三个地址分别属于谁

```text
http://localhost:3000/api/metrics
→ NestJS 提供，给学习者阅读的 JSON

http://localhost:3000/api/metrics/prometheus
→ NestJS 提供，给 Prometheus 抓取的文本

http://localhost:9090
→ 独立运行的 Prometheus 网页与查询 API
```

Prometheus 不是 NestJS 插件，也不参与评分、上传等业务请求。

## 2. 数据流

```text
用户请求 NestJS
→ MetricsService 在内存中累计 Counter 和 Gauge

每隔 5 秒
→ Prometheus 请求 /api/metrics/prometheus
→ 读取当前数值
→ 给数据加上抓取时间
→ 保存到自己的时序数据库与 Docker Volume
```

API 重启后内存 Counter 会从零开始。只要 Prometheus 的 Volume 仍在，旧的历史采样不会因为 API 重启而立即消失。Prometheus 查询函数能够识别 Counter 重置。

Prometheus 自己也有数据保留期限，删除它的 Volume 或超过保留期后历史仍会消失，所以它不是永久归档或业务备份。

## 3. 配置文件

`monitoring/prometheus.yml`：

```yaml
global:
  scrape_interval: 5s

scrape_configs:
  - job_name: fullstack-learning-api
    metrics_path: /api/metrics/prometheus
    static_configs:
      - targets:
          - host.docker.internal:3000
```

- `scrape_interval`：每 5 秒读取一次。
- `job_name`：给这组抓取目标命名。
- `metrics_path`：API 暴露指标的路径。
- `targets`：被抓取的 API 地址。

Prometheus 在 Docker 容器内，容器里的 `localhost:3000` 指向 Prometheus 容器自己。Windows Docker Desktop 使用 `host.docker.internal` 访问宿主机上的 `pnpm dev` API。

## 4. 启动和停止

先保证 `pnpm dev` 正在运行，然后执行：

```powershell
pnpm monitoring:up
```

打开：

```text
http://localhost:9090/targets
```

目标显示 `UP` 表示 Prometheus 能读取 API 指标。`DOWN` 时先检查 NestJS 是否运行、3000 端口和 Target 的 Last Error。

停止监控：

```powershell
pnpm monitoring:down
```

该命令不带 `-v`，会保留 Prometheus Volume。不要随意追加 `-v`。

## 5. Prometheus 文本是什么

访问 `/api/metrics/prometheus` 会看到：

```text
# TYPE fullstack_http_requests_total counter
fullstack_http_requests_total 7

# TYPE fullstack_http_requests_active gauge
fullstack_http_requests_active 0

fullstack_http_responses_total{status_class="2xx"} 6
fullstack_http_responses_total{status_class="4xx"} 1

# TYPE fullstack_dependency_up gauge
fullstack_dependency_up{dependency="postgres"} 1
fullstack_dependency_up{dependency="minio"} 1
```

`# TYPE` 告诉 Prometheus 指标类型。花括号中是标签，用于有限分类。Request ID、用户 ID 和文件名不能作为标签。

`fullstack_dependency_up` 使用 Gauge 表示必要依赖的当前状态：1 是可访问，0 是不可访问。它复用 `/health/ready` 的 PostgreSQL 与 MinIO 检查，但指标端点仍会正常返回文本，因此 Prometheus 的自身 `up` 与具体依赖状态可以同时观察。

## 6. 第一次查询

在 `http://localhost:9090` 的查询输入框输入：

```text
fullstack_http_requests_total
```

点击 Execute，可以看到 Prometheus 最近一次抓取的数值。先访问 `/api/health/live` 三次，等待最多 5 秒后再次查询，数值应增加 3。

结果中的：

- `job="fullstack-learning-api"`：来自配置中的 job_name。
- `instance="host.docker.internal:3000"`：来自抓取目标。
- 数值：最近一次抓取时 API 暴露的 Counter。

还可以查询：

```text
fullstack_dependency_up
```

停止 PostgreSQL 时会出现一个很重要的组合：Prometheus 自身的 `up` 仍为 1，而 `fullstack_dependency_up{dependency="postgres"}` 变为 0。前者表示指标端点可抓取，后者表示具体业务依赖不可用。

## 7. 当前仍未加入什么

- 没有 Grafana 图表。
- 没有 Alertmanager 通知。
- 没有正式的 Histogram 分桶和 P95/P99。
- 指标端点还未做生产网络隔离。

本课只验证 Prometheus 的角色和 Pull 抓取过程，不把所有监控组件一次堆进项目。

## 8. AI 开发需要掌握什么

需要理解：Prometheus 是独立监控服务；它定时 Pull API 的指标；API 重启与 Prometheus 历史存储是两个生命周期；Target `UP` 只证明抓取成功，不等于所有业务正常。

不需要背 Prometheus 配置语法或查询语法。AI 可以生成配置，但你必须检查抓取的是正确环境、指标是否包含敏感信息、监控 Volume 是否持久化，以及 Target 是否真实为 `UP`。
