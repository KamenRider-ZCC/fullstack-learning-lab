# 第 10B 课：请求 ID 与可关联日志

当多人同时使用系统时，后端日志会交错出现。只知道“16:14 左右有一个 500”通常不足以找到浏览器中的那一次请求。请求 ID 为每次 HTTP 请求提供一个短期流水号。

## 1. 请求 ID 解决什么问题

一次请求现在会出现相同的 ID：

```text
浏览器响应头 X-Request-Id
          ↓ 相同
错误响应 JSON 的 requestId
          ↓ 相同
NestJS 请求完成日志的 requestId
          ↓ 相同
未处理异常日志的 requestId
```

用户报告问题时可以提供请求时间、接口地址和 Request ID。开发者据此过滤日志，不需要在大量相似错误中猜测。

## 2. 它不是什么

- 不是 JWT，不能证明用户身份。
- 不是用户 ID，不能用于授权。
- 不是订单号、评分 ID 等业务主键。
- 不是秘密，但也不应包含密码、Token 或其他隐私数据。

请求 ID 只用于关联一次请求的证据。

## 3. 当前执行流程

```text
请求进入 NestJS
→ RequestIdMiddleware 读取或生成 requestId
→ 写入 request.requestId
→ 写入响应头 X-Request-Id
→ Guard / Pipe / Controller / Service
→ ApiExceptionFilter 将 requestId 写入错误 JSON
→ 响应结束后记录状态码和耗时
```

对应文件：

- `apps/api/src/common/request-id.middleware.ts`
- `apps/api/src/common/api-exception.filter.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/common/request-id.middleware.spec.ts`

## 4. 为什么使用 Middleware

Middleware 位于 Controller、Guard 和 Pipe 之前，适合为整次请求准备公共上下文。即使认证或参数校验提前失败，响应仍然可以带 Request ID。

`AppModule.configure()` 将它应用到所有路由：

```ts
consumer.apply(RequestIdMiddleware).forRoutes('*');
```

这不是前端中间件。它运行在 NestJS 服务端，每次 HTTP 请求都会执行一次。

## 5. ID 从哪里来

如果网关传来格式安全的 `X-Request-Id`，后端继续使用它，便于跨网关和 API 关联。没有传入时使用 `randomUUID()` 生成。

只允许字母、数字、点、下划线和短横线，长度不超过 100：

```text
^[A-Za-z0-9._-]{1,100}$
```

这是因为请求头是不可信输入。如果攻击者在 ID 中加入换行符，未经处理直接写日志可能伪造出一条看似真实的新日志。

正式系统通常由受信任网关覆盖或生成 Request ID，而不是完全相信公网客户端提供的值。

## 6. 为什么监听 finish

进入请求时还不知道最终状态码和耗时。响应触发 `finish` 后，Middleware 才记录：

```json
{
  "event": "http_request_completed",
  "requestId": "...",
  "method": "GET",
  "path": "/api/health/ready",
  "statusCode": 200,
  "durationMs": 8
}
```

这些字段采用 JSON 结构，日志平台可以按 `requestId`、`statusCode` 或 `path` 搜索。当前仍由 Nest Logger 输出外层时间和上下文，属于学习阶段的轻量结构化日志。

## 7. 为什么不记录请求体和 Token

请求体可能包含密码、商业数据和个人信息，Authorization 头包含可用凭证。把它们完整写入日志会扩大泄露范围。

当前完成日志只记录：

- Request ID
- HTTP 方法
- 不含查询参数的路径
- 状态码
- 耗时

需要排查具体业务时，应只增加经过脱敏和明确评审的字段。

## 8. 如何验证

1. 打开浏览器 Network。
2. 发起任意成功请求，查看 Response Headers 的 `X-Request-Id`。
3. 发起一次伪 PDF 上传，查看错误 JSON 的 `requestId`。
4. 在 NestJS 终端寻找 `http_request_completed`。
5. 确认浏览器和日志中的 Request ID 完全相同。

可以使用自定义 ID 验证上游透传：

```powershell
Invoke-WebRequest `
  -Headers @{ 'X-Request-Id' = 'learning-request-001' } `
  -Uri http://localhost:3000/api/health/live
```

响应头应返回同一个 `learning-request-001`，后端完成日志也应包含它。不要把 JWT 当作 Request ID。

## 9. AI 开发需要掌握什么

需要掌握：

- Request ID 用来关联浏览器响应和服务端日志。
- 请求头是不可信输入，写日志前要限制格式。
- 日志不能记录密码、Token 和未脱敏请求体。
- 排障时用 Request ID 找同一次请求，而不是只按时间猜测。

不需要背诵：

- NestMiddleware 的准确接口签名。
- Express 的 `response.once('finish')` 写法。
- UUID API 的导入路径。

这些实现细节可以让 AI 生成，但你要亲自确认 ID 是否真的贯穿响应和日志，以及日志中是否意外包含敏感信息。
