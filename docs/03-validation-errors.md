# 第 3 课：参数校验与统一错误处理

## 本课目标

不让错误请求进入业务代码，并让前端收到稳定、可识别的错误结构。

## 一次失败请求经过哪里

```text
React 提交 JSON
  → ValidationPipe 检查 SaveScoreDto
  → Controller 接收已验证的数据
  → ReviewService 检查评分业务规则
  → ApiExceptionFilter 统一错误格式
  → React 根据 code 和 message 展示原因
```

## 三个组件分别负责什么

- `SaveScoreDto`：声明字段类型、必填项以及允许出现的字段。
- `ValidationPipe`：在 Controller 执行前自动校验 DTO；多余字段也会被拒绝。
- `ApiExceptionFilter`：把框架异常、业务异常统一转换成同一种 JSON。

DTO 只检查“数据长什么样”。例如 `score` 是否为数字。
Service 检查“业务允不允许”。例如分数是否超过满分、是否按 0.5 递增。

## 统一错误响应

保存 `4.5` 分时，后端返回 HTTP 400：

```json
{
  "success": false,
  "code": "SCORE_OUT_OF_RANGE",
  "message": "分数必须在 0～4 之间",
  "timestamp": "2026-09-02T08:00:00.000Z",
  "path": "/api/review-items/review-progress-plan/score"
}
```

HTTP 状态码用于表示请求整体成功或失败；业务错误码用于让前端准确区分失败原因。错误文案可以修改，但稳定的错误码适合写程序判断。

## 动手验证

启动项目：

```powershell
pnpm db:up
pnpm dev
```

打开 `http://localhost:5173`，依次尝试：

1. `3.5`：保存成功。
2. `4.5`：返回 `SCORE_OUT_OF_RANGE`。
3. `3.2`：返回 `SCORE_STEP_INVALID`。

再用 PowerShell 发送一个字段类型错误的请求：

```powershell
$body = @{ bidderId = 'demo-bidder'; expertId = 'demo-expert'; score = '三分' } |
  ConvertTo-Json

Invoke-RestMethod `
  -Uri 'http://127.0.0.1:3000/api/review-items/review-progress-plan/score' `
  -Method Put `
  -ContentType 'application/json' `
  -Body $body
```

PowerShell 会显示 HTTP 400；响应体中的错误码是 `VALIDATION_ERROR`，数据库不会写入这次请求。

## 重点文件

- `apps/api/src/review/dto/save-score.dto.ts`
- `apps/api/src/main.ts`
- `apps/api/src/common/api-exception.filter.ts`
- `apps/api/src/review/review.service.ts`
- `apps/web/src/api/reviews.ts`

后端开发环境使用 `tsc-watch` 启动。它会调用 TypeScript 编译器，按 `tsconfig.json` 生成装饰器类型元数据，`ValidationPipe` 才能识别 Controller 参数对应的 DTO。生产构建也使用 TypeScript 编译，因此两种环境的校验行为一致。

完成标准：你能解释 DTO 校验和 Service 业务校验为什么不能互相替代。
