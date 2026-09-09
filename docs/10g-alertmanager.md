# 第 10G 课：用 Alertmanager 接收和管理告警

Prometheus 和 Alertmanager 解决不同问题：

```text
Prometheus：抓取指标、保存数据、计算告警条件
Alertmanager：接收已触发的告警、分组、去重、静默、选择通知渠道
```

把两者分开后，监控规则只负责判断事实，同一条告警可以由 Alertmanager 发送到邮件、企业微信或其他 Webhook，而不用修改 NestJS 业务代码。

## 1. 当前数据流

```text
NestJS 指标
→ Prometheus 抓取并计算规则
→ 告警持续 15 秒，状态变成 Firing
→ Prometheus 把告警发送给 Alertmanager
→ Alertmanager 分组后显示在页面
```

当前课程没有配置真实邮箱、企业微信或钉钉凭据，因此不会向外发送消息。不要把真实密钥直接提交到 Git 仓库。

## 2. 配置文件分别负责什么

- `monitoring/alert-rules.yml`：定义“什么情况算异常”。
- `monitoring/prometheus.yml`：告诉 Prometheus 把告警发到 `alertmanager:9093`。
- `monitoring/alertmanager.yml`：定义告警如何分组以及交给哪个接收器。
- `compose.monitoring.yaml`：启动 Alertmanager 容器并开放本机 9093 端口。

`alertmanager:9093` 使用的是 Docker Compose 服务名，不是浏览器访问地址。浏览器从 Windows 主机访问时使用 `http://localhost:9093`。

## 3. 当前接收器为什么不发消息

当前接收器叫 `local-ui-only`，没有配置邮件或 Webhook。它只让我们在 Alertmanager 页面观察完整流程。

几个配置项翻译成人话：

- `group_by`：把同类告警合并成一组。
- `group_wait: 5s`：一组告警首次出现后等待 5 秒再处理，收集可能同时出现的同类告警。
- `group_interval: 30s`：同一组内容发生变化时，至少间隔 30 秒再次处理。
- `repeat_interval: 4h`：故障一直未恢复时，正式通知最多每 4 小时重复一次。

这些数值只是本地课程示例，生产阈值必须根据业务影响和团队值班规则确认。

## 4. 验证告警传递

启动监控：

```powershell
pnpm monitoring:up
```

打开 Alertmanager：`http://localhost:9093`

停止 MinIO：

```powershell
docker compose stop minio
```

等待大约 25 秒后：

1. Prometheus 的 `http://localhost:9090/alerts` 应显示依赖告警为 `Firing`。
2. Alertmanager 的 `http://localhost:9093` 应出现 `FullstackDependencyDown`。
3. 标签中应包含 `dependency="minio"`。

恢复 MinIO：

```powershell
docker compose start minio
```

等待几次规则计算后，Prometheus 告警恢复为 `Inactive`，Alertmanager 中的活动告警也会消失。

## 5. Silence 是什么

Silence 表示临时静默符合标签条件的通知，例如团队计划维护 MinIO 30 分钟。它不会修复故障、不会把指标改成正常，也不会阻止 Prometheus 继续计算告警，只是让 Alertmanager 暂时不发送匹配的通知。

不能为了隐藏未知故障而随意静默告警。正式使用时应写清维护原因、负责人和结束时间。

## 6. AI 开发需要掌握什么

需要理解：Prometheus 负责判断，Alertmanager 负责通知管理；接收器需要真实渠道配置；凭据不能提交到仓库；分组、重复间隔和静默会影响值班人员能否及时收到消息；必须验证触发和恢复两个方向。

不需要背 Alertmanager YAML 或各家 Webhook 格式。AI 可以生成配置，但通知对象、严重级别、凭据保管方式和生产告警策略必须由项目团队确认。
