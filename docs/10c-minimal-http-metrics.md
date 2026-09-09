# 第 10C 课：最小 HTTP 指标

日志回答“某一次请求为什么失败”，指标回答“系统整体是否正在变差”。本课先用进程内计数器理解指标，不引入 Prometheus 和 Grafana。

## 1. 查看地址

```http
GET /api/metrics
```

示例：

```json
{
  "generatedAt": "2026-09-09T06:30:00.000Z",
  "processUptimeSeconds": 600,
  "http": {
    "requestsTotal": 20,
    "requestsActive": 0,
    "responsesByStatus": {
      "2xx": 12,
      "3xx": 1,
      "4xx": 6,
      "5xx": 1,
      "other": 0
    },
    "serverErrorsTotal": 1,
    "serverErrorRatePercent": 5,
    "averageDurationMs": 18.5
  }
}
```

## 2. 每个数字是什么意思

- `requestsTotal`：API 进程启动后完成的请求总数。
- `requestsActive`：当前仍在处理的请求数。
- `responsesByStatus`：按 2xx、3xx、4xx、5xx 汇总。
- `serverErrorsTotal`：5xx 总数。
- `serverErrorRatePercent`：5xx 数量除以全部已完成请求。
- `averageDurationMs`：全部已完成请求的平均耗时。

`/api/metrics` 自己不参与统计，否则每刷新一次指标页面，数字都会因为查看行为而改变。

## 3. 代码链路

```text
请求进入 RequestIdMiddleware
→ MetricsService.requestStarted()
→ 业务处理
→ response finish
→ MetricsService.requestCompleted(statusCode, durationMs)
→ 数量与耗时累加

GET /api/metrics
→ MetricsController
→ MetricsService.getSnapshot()
→ 返回当前汇总
```

对应文件：

- `apps/api/src/metrics/metrics.module.ts`
- `apps/api/src/metrics/metrics.controller.ts`
- `apps/api/src/metrics/metrics.service.ts`
- `apps/api/src/metrics/metrics.types.ts`
- `apps/api/src/common/request-id.middleware.ts`
- `apps/api/src/metrics/metrics.service.spec.ts`

## 4. 为什么 4xx 和 5xx 要分开

- 4xx 通常表示请求或权限问题，例如参数错误、未登录、无权限。
- 5xx 通常表示服务端或依赖故障，例如 PostgreSQL 无法连接。

单个用户输错分数产生 400，不代表服务故障。持续出现 500 更值得通知开发和运维。

但 4xx 突然暴增也可能说明前后端版本不兼容、攻击或登录大面积失效，所以不能简单忽略，只是告警策略通常不同。

## 5. 为什么 Request ID 不能作为指标标签

Request ID 每次请求都不同。如果按它分组，一万个请求就可能产生一万组时间序列，这叫高基数。它会增加监控存储、内存和查询成本。

```text
Request ID → 放在日志中，用于查某一次请求
状态码类别 → 放在指标中，用于观察整体趋势
```

用户 ID、完整 URL、文件名等变化很多的值，也不能未经评估就作为指标标签。

## 6. 平均值有什么局限

假设九个请求耗时 10 ms，一个请求耗时 1000 ms，平均值约 109 ms。它不能直接告诉你最慢的用户等了多久。

正式监控通常还看分位数：

- P50：一半请求比它快。
- P95：95% 请求比它快。
- P99：99% 请求比它快。

当前课程只实现平均值，用于先理解“累计耗时 ÷ 请求数”。后续接入专业指标库时再使用 Histogram 计算分位数。

## 7. 当前实现为什么不能直接当生产监控

当前指标保存在 NestJS 进程内存中：

- 重启 API 后清零。
- 多个 API 实例各有一份，不能自动汇总。
- 没有历史曲线。
- 没有持久化和告警通知。
- JSON 格式不是 Prometheus 标准抓取格式。

正式环境通常由 Prometheus 周期抓取每个实例的指标，Grafana 展示趋势，再由 Alertmanager 等组件发送告警。

## 8. 安全边界

学习环境可以直接访问 `/api/metrics`。正式环境通常只允许监控网络访问，不能默认公开到互联网。指标名称和标签也不能包含 Token、密码、个人信息或商业敏感内容。

## 9. 动手验证

1. 第一次访问 `/api/metrics`，记录 `requestsTotal`。
2. 连续访问 `/api/health/live` 三次。
3. 再访问 `/api/metrics`。
4. 确认 `requestsTotal` 增加 3，`2xx` 也增加 3。
5. 访问一次没有 Token 的 `/api/documents`。
6. 再查看指标，确认 `4xx` 增加 1，但 `serverErrorsTotal` 不变。

如果停止 PostgreSQL 并通过已登录页面触发文件列表 500，`5xx` 和 `serverErrorsTotal` 会增加。实验后必须恢复数据库。

## 10. AI 开发需要掌握什么

需要掌握：日志、指标和告警分别解决什么问题；4xx 与 5xx 不应使用同一告警规则；不能把高基数或敏感值随意放进指标；内存计数器不能冒充生产监控。

不需要背诵计数器字段和 NestJS Module 写法。AI 可以实现代码，但你必须亲自验证请求前后的数字变化，并判断这些数字能否支持实际运维决策。
