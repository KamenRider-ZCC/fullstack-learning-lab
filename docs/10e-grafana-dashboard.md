# 第 10E 课：用 Grafana 展示 Prometheus 数据

Grafana 是独立的监控展示软件。它不参与业务请求，也不直接从 NestJS 累加指标；它查询 Prometheus 已保存的数据，并把查询结果画成数字、曲线和状态面板。

## 1. 当前数据流

```text
NestJS MetricsService 产生指标
→ /api/metrics/prometheus 暴露文本
→ Prometheus 每 5 秒抓取并保存
→ Grafana 查询 Prometheus
→ 浏览器打开 Grafana 仪表盘
```

如果 Grafana 停止，评分、上传、NestJS 和 Prometheus 都可以继续运行，只是暂时看不到图表。

## 2. 启动和访问

```powershell
pnpm monitoring:up
```

地址：`http://localhost:3001`

本地学习账号：

```text
用户名：admin
密码：fullstack_lab_admin
```

这是提交在 Compose 中的学习默认值，不能用于正式环境。正式环境必须通过 Secret 或环境变量设置强密码，并限制 Grafana 的网络访问。

进入后打开文件夹 `Fullstack Lab`，选择：

```text
Fullstack Learning Lab Overview
```

## 3. 为什么不需要手工配置

Grafana 支持 Provisioning，即启动时从仓库文件自动创建配置：

- `monitoring/grafana/provisioning/datasources/prometheus.yml`：创建 Prometheus 数据源。
- `monitoring/grafana/provisioning/dashboards/dashboards.yml`：指定仪表盘目录。
- `monitoring/grafana/dashboards/fullstack-overview.json`：定义具体面板。

这样新电脑只需要拉取仓库并启动容器，不必依赖某个人记住网页点击步骤。

## 4. 数据源地址为什么不是 localhost

Grafana 和 Prometheus 分别运行在两个 Docker 容器中。Grafana 容器里的 `localhost` 指向 Grafana 自己，因此数据源使用 Compose 服务名：

```text
http://prometheus:9090
```

Docker 内部 DNS 会把 `prometheus` 解析到 Prometheus 容器。

## 5. 当前五个面板

1. Prometheus 能否抓取 API：查询内置 `up` 指标。
2. 必要依赖状态：查询 PostgreSQL、MinIO 的 `fullstack_dependency_up`。
3. 已完成请求总数：查询 Counter `fullstack_http_requests_total`。
4. 响应状态码累计数量：按 2xx、3xx、4xx、5xx 显示。
5. 平均请求耗时：用累计耗时除以累计请求数。

仪表盘默认展示最近 15 分钟，每 5 秒刷新一次。

## 6. 三处数据分别是什么

- API 内存：当前进程启动后的原始计数器，重启清零。
- Prometheus Volume：定时采样形成的历史时序数据。
- Grafana Volume：用户、偏好等 Grafana 自身状态。
- 仓库中的 Dashboard JSON：可重复创建的仪表盘定义。

当前仪表盘由文件 Provisioning，修改应优先更新仓库中的 JSON。只在网页临时修改但不保存回仓库，换电脑或重建环境时可能丢失。

## 7. 停止与数据

```powershell
pnpm monitoring:down
```

该命令停止并移除 Prometheus、Grafana 容器，但保留两个 Docker Volume。再次 `monitoring:up` 后历史和 Grafana 状态可以恢复。

不要追加 `-v`，否则会删除监控数据 Volume。

## 8. AI 开发需要掌握什么

需要理解：Grafana 读取 Prometheus，而不是替代 Prometheus；仪表盘查询必须对应真实指标；容器之间用服务名通信；网页临时配置不等于可重复交付的配置；本地默认密码不能用于生产。

不需要背 Dashboard JSON、Grafana Provisioning 或查询语法。AI 可以生成它们，但你必须打开页面确认数据源正常、数值符合真实实验、时间范围正确，并检查仪表盘是否泄露敏感信息。
