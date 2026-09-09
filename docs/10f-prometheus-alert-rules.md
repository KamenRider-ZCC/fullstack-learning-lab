# 第 10F 课：让 Prometheus 根据指标触发告警

监控图表需要人主动打开查看；告警规则则由 Prometheus 持续计算，在条件异常时主动把状态变为 `Firing`。

## 1. 当前告警链路

```text
NestJS 暴露指标
→ Prometheus 每 5 秒抓取指标
→ Prometheus 每 5 秒计算告警条件
→ 条件持续 15 秒后变为 Firing
```

本课尚未接入 Alertmanager，所以只能在 Prometheus 页面看到告警状态，不会发送邮件或群消息。Prometheus 负责判断“是否应该告警”，Alertmanager 才负责分组、静默以及发送通知。

## 2. 两条规则分别发现什么

规则在 `monitoring/alert-rules.yml`：

- `FullstackApiScrapeDown`：`up` 连续 15 秒为 `0`，说明 Prometheus 无法抓取 NestJS。
- `FullstackDependencyDown`：某个 `fullstack_dependency_up` 连续 15 秒为 `0`，说明 PostgreSQL 或 MinIO 不可用。

这两个状态不能互相替代。例如 MinIO 停止时，NestJS 仍能返回指标，因此 `up` 可以是 `1`，而 `fullstack_dependency_up{dependency="minio"}` 是 `0`。

## 3. 为什么设置 for: 15s

异常条件刚出现时，告警先进入 `Pending`；持续 15 秒仍未恢复，才进入 `Firing`。这可以避免一次短暂抖动立刻产生通知。

三个状态的含义：

- `Inactive`：条件不成立，一切正常。
- `Pending`：条件已成立，但持续时间还没达到 15 秒。
- `Firing`：异常持续达到 15 秒，正式触发。

生产环境通常会根据故障容忍时间设置更长的 `for`，本课使用 15 秒只是为了方便实验。

## 4. 查看规则和告警

启动或重建监控容器：

```powershell
pnpm monitoring:up
```

打开：

- 规则页面：`http://localhost:9090/rules`
- 告警页面：`http://localhost:9090/alerts`

正常情况下，两条告警都应显示为 `Inactive`。

## 5. MinIO 故障实验

只停止 MinIO：

```powershell
docker compose stop minio
```

等待大约 20 秒并刷新告警页面，预期结果：

```text
FullstackDependencyDown{dependency="minio"} = Firing
FullstackApiScrapeDown = Inactive
```

此时 `/api/health/live` 仍可返回 200，`/api/health/ready` 返回 503。实验后恢复：

```powershell
docker compose start minio
```

等待几次抓取后，依赖指标恢复为 `1`，告警回到 `Inactive`。

## 6. AI 开发需要掌握什么

需要理解：告警必须基于真实指标；`up=1` 只表示 Prometheus 能抓取目标；`for` 用来过滤短暂抖动；告警恢复也必须验证；没有 Alertmanager 就不会发送通知。

不需要背 PromQL 或 YAML。AI 可以生成规则，但你必须检查指标名、标签、阈值和持续时间是否符合业务，并通过一次可控故障证明规则真的能触发和恢复。
