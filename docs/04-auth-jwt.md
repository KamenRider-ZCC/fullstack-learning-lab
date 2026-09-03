# 第 4 课：登录、JWT 鉴权与角色权限

第一次接触 NestJS、ValidationPipe、JWT 或 Prisma 时，请在完成本讲义后继续阅读 [`04b-auth-code-walkthrough.md`](./04b-auth-code-walkthrough.md)。补充课会按照实际执行顺序逐文件拆解代码。

## 本课目标

让后端可靠地确定“谁正在评分”，并拒绝未登录用户和没有专家角色的用户。

## 登录链路

```text
用户名 + 密码
  → POST /api/auth/login
  → 数据库查询 User
  → scrypt 校验密码摘要
  → 签发有效期两小时的 JWT
  → 前端保存 Token
```

后续受保护请求：

```text
Authorization: Bearer <token>
  → JwtAuthGuard 验证签名和有效期
  → 把用户身份写入当前请求
  → RolesGuard 检查角色
  → Controller / Service
```

## 演示账号

| 用户名 | 密码 | 角色 | 权限 |
| --- | --- | --- | --- |
| `expert` | `demo123456` | `EXPERT` | 查看并保存自己的评分 |
| `viewer` | `demo123456` | `VIEWER` | 只能查看，不能评分 |

启动 API 时会自动创建这两个本地学习账号。数据库保存的是 scrypt 密码摘要，不是明文密码。

## 为什么不能再接收 expertId

以前前端提交：

```json
{ "expertId": "demo-expert", "score": 3.5 }
```

任何人都可以把 `expertId` 改成其他专家，因此这个身份不可信。现在前端只提交业务数据：

```json
{ "bidderId": "demo-bidder", "score": 3.5 }
```

后端从已经验签的 JWT 中读取用户 ID，并把它作为 `ExpertScore.expertId`。前端无法通过修改请求体冒充其他专家。

## JWT 要注意什么

- JWT 的签名可以证明内容没有被篡改，但内容只是编码，并未加密。
- 不要把密码、身份证号等敏感内容放进 Token。
- `JWT_SECRET` 必须放在环境变量中，生产环境使用随机长密钥。
- Token 会过期；过期后需要重新登录。
- 本课用 `localStorage` 便于观察请求。真实项目需评估 XSS 风险，常见替代方案是 HttpOnly Cookie。

## 动手验证

1. 使用 `expert` 登录并保存一个评分。
2. 退出后使用 `viewer` 登录，确认页面不可评分。
3. 打开浏览器开发者工具的 Network，查看请求中的 `Authorization` 请求头。
4. 在 Application → Local Storage 中删除 Token，刷新后确认需要重新登录。

也可以直接请求未携带 Token 的接口：

```powershell
Invoke-WebRequest `
  -SkipHttpErrorCheck `
  -Uri 'http://127.0.0.1:3000/api/review-items/review-progress-plan?bidderId=demo-bidder'
```

应返回 HTTP 401 和错误码 `AUTH_REQUIRED`。

## 重点文件

- `apps/api/src/auth/auth.service.ts`：查询用户、校验密码、签发 Token。
- `apps/api/src/auth/jwt-auth.guard.ts`：认证用户身份。
- `apps/api/src/auth/roles.guard.ts`：检查角色权限。
- `apps/api/src/review/review.controller.ts`：从已认证用户获取专家 ID。
- `apps/web/src/api/http.ts`：自动携带 Token。
- `apps/web/src/components/LoginCard.tsx`：登录界面。

完成标准：你能解释认证和授权的区别，并说明为什么后端不能相信请求体中的用户 ID。
