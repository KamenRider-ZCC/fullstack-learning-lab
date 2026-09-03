# 第 4 课补充：逐文件慢速拆解登录与鉴权

这份讲义假设你熟悉 React，但没有使用过 NestJS、Prisma、ValidationPipe 或 JWT。不要尝试一次记住所有装饰器，先沿着一次真实请求理解每个文件为什么存在。

## 1. 先建立整体地图

系统由三个运行环境组成：

```text
浏览器（React，5173 端口）
  ↓ HTTP 请求
后端（NestJS，3000 端口）
  ↓ Prisma 调用
数据库（PostgreSQL，5432 端口）
```

登录和评分是两次独立请求：

```text
第一次：用户名、密码 → 登录接口 → 返回 JWT
第二次：评分数据 + JWT → 评分接口 → 保存到数据库
```

JWT 类似一张由后端签发的临时工作证。浏览器以后不必在每次请求中重新发送密码，只需出示工作证。

## 2. NestJS 中先认识六种角色

| 名称 | 在本项目中的作用 | 类比 |
| --- | --- | --- |
| Module | 组织和连接一组功能 | 插线板 |
| Controller | 接收 HTTP 请求、读取参数 | 前台接待 |
| Service | 执行业务逻辑、访问数据库 | 办事人员 |
| DTO | 描述请求允许有哪些字段 | 表单模板 |
| Pipe | 在进入 Controller 前转换或校验数据 | 资料审核 |
| Guard | 在进入 Controller 前检查身份和权限 | 门禁 |

依赖注入（Dependency Injection，DI）是 NestJS 连接这些角色的方法。Controller 不自己 `new AuthService()`，而是声明“我需要 AuthService”，NestJS 负责创建并传进来。

## 3. 应用如何启动

### 3.1 `apps/api/src/main.ts`

这是后端入口，相当于 React 项目中的 `main.tsx`。

```ts
const app = await NestFactory.create(AppModule);
```

NestJS 从根模块 `AppModule` 开始查找 Controller、Service 和其他模块，并创建它们。

```ts
app.setGlobalPrefix('api');
```

为全部路由增加 `/api` 前缀。因此 `@Controller('auth')` 最终对应 `/api/auth`。

```ts
app.useGlobalPipes(new ValidationPipe({
  forbidNonWhitelisted: true,
  transform: true,
  whitelist: true,
}));
```

这里注册全局 `ValidationPipe`：

- `whitelist`：只保留 DTO 中声明的字段。
- `forbidNonWhitelisted`：请求包含多余字段时直接报错。
- `transform`：把普通 JSON 对象转换成对应 DTO 实例，装饰器才能参与校验。

```ts
app.useGlobalFilters(new ApiExceptionFilter());
```

异常过滤器将 DTO 错误、401、403 和业务错误转换成统一 JSON。它不会决定请求能不能通过，只负责统一失败响应的形状。

```ts
await app.listen(port, '0.0.0.0');
```

启动 HTTP 服务。`0.0.0.0` 表示监听这台电脑的所有网卡，而不仅是本机回环地址。

### 3.2 `apps/api/src/app.module.ts`

```ts
@Module({
  imports: [PrismaModule, HealthModule, AuthModule, ReviewModule],
})
export class AppModule {}
```

`AppModule` 本身没有业务代码，它是总装配入口：

- `PrismaModule`：数据库连接。
- `HealthModule`：健康检查。
- `AuthModule`：登录、JWT 和权限。
- `ReviewModule`：评审查询和评分。

`@Module()` 是装饰器。装饰器给类附加框架可以读取的元数据，NestJS 据此知道如何组装应用。

## 4. AuthModule 如何组装认证功能

文件：`apps/api/src/auth/auth.module.ts`

```ts
JwtModule.registerAsync({
  useFactory: () => ({
    secret: readJwtSecret(),
    signOptions: { expiresIn: 2 * 60 * 60 },
  }),
})
```

`JwtModule` 提供 `JwtService`。配置中有两个重点：

- `secret`：签发和验证 JWT 的密钥，来自 `.env` 的 `JWT_SECRET`。
- `expiresIn`：Token 两小时后失效，单位是秒。

缺少 `JWT_SECRET` 时直接阻止后端启动，比悄悄使用一个公开默认密钥安全。

```ts
@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
```

- `controllers`：本模块接收 HTTP 请求的类。
- `providers`：由 NestJS 创建和注入的服务。
- `exports`：允许其他模块使用的能力。

`ReviewModule` 需要鉴权，所以 `AuthModule` 必须导出两个 Guard 及其依赖的 `JwtModule`。

## 5. 用户数据存在哪里

文件：`apps/api/prisma/schema.prisma`

```prisma
model User {
  id           String   @id @default(cuid())
  username     String   @unique
  displayName  String
  passwordHash String
  role         String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

逐个字段理解：

- `id`：主键，`cuid()` 自动生成基本不会重复的字符串。
- `username`：登录名，`@unique` 保证数据库中不能重复。
- `displayName`：页面显示名称。
- `passwordHash`：密码摘要，不保存明文密码。
- `role`：当前为 `EXPERT` 或 `VIEWER`。
- `createdAt`：新增记录时自动保存当前时间。
- `updatedAt`：每次更新时由 Prisma 自动刷新。

修改 `schema.prisma` 只是修改设计图。运行迁移后，PostgreSQL 中才会真正创建或修改表：

```text
schema.prisma
  → prisma migrate dev
  → migration.sql
  → PostgreSQL 表结构
```

Prisma Client 则是根据设计图生成的 TypeScript 数据库操作 API，例如 `prisma.user.findUnique()`。

## 6. 后端启动时为什么会出现演示账号

文件：`apps/api/src/auth/auth.service.ts`

```ts
export class AuthService implements OnModuleInit {
  async onModuleInit() {
    // 查询账号，不存在时创建
  }
}
```

`OnModuleInit` 是 NestJS 生命周期接口。所有依赖准备好后、HTTP 服务正式可用前，NestJS 会调用 `onModuleInit()`。

本项目利用这个阶段创建 `expert` 和 `viewer`。这只是学习项目的初始化方式；正式项目通常使用独立 seed 脚本或后台用户管理功能。

```ts
const existing = await this.prisma.user.findUnique({
  where: { username: demoUser.username },
});
```

Prisma 将它转换成 SQL 查询。`await` 表示数据库返回结果前暂停当前异步函数，但不会阻塞整个 Node.js 进程。

## 7. 密码为什么不能直接保存

文件：`apps/api/src/auth/password.ts`

错误做法：

```text
username = expert
password = demo123456
```

一旦数据库泄露，所有密码都会直接暴露。本项目保存的格式类似：

```text
scrypt:随机盐:计算后的摘要
```

### 7.1 注册或创建用户

```ts
const salt = randomBytes(16).toString('hex');
const key = await deriveKey(password, salt, KEY_LENGTH);
```

随机盐使两个相同密码也产生不同摘要，避免攻击者通过常见密码对照表直接识别密码。

### 7.2 登录校验

系统读取数据库中的盐，用用户刚输入的密码重新计算摘要，再比较两个结果。

```ts
return timingSafeEqual(storedKey, suppliedKey);
```

`timingSafeEqual` 尽量避免比较耗时差异泄露摘要信息。

哈希或摘要不是加密：加密通常可以用密钥还原原文；密码摘要的设计目标是不可逆，只能验证输入是否相同。

## 8. 点击登录后发生了什么

### 8.1 `apps/web/src/components/LoginCard.tsx`

React 收集用户名和密码，并在提交表单时调用：

```ts
onLogin(await login(username.trim(), password));
```

`await` 等登录请求完成；失败进入 `catch`，成功把用户信息交给 `App.tsx`。

### 8.2 `apps/web/src/api/auth.ts`

```ts
const result = await requestJson<LoginResponse>('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ username, password }),
}, false);
```

- `POST` 表示提交数据。
- `JSON.stringify` 把 JavaScript 对象转换成 HTTP 请求体字符串。
- 最后的 `false` 表示登录请求不携带 Token，因为此时还没有 Token。

Vite 将 `/api/auth/login` 代理到后端 3000 端口。

### 8.3 `apps/api/src/auth/dto/login.dto.ts`

请求进入 Controller 前，ValidationPipe 根据 DTO 检查数据：

```ts
@IsString()
@IsNotEmpty()
username!: string;
```

- `@IsString()`：值必须是字符串。
- `@IsNotEmpty()`：不能是空字符串。
- `!`：告诉 TypeScript 这个字段稍后由框架赋值，不是运行时非空校验。

如果请求是 `{ "username": 123 }`，它会在到达 Controller 前返回 `VALIDATION_ERROR`。

### 8.4 `apps/api/src/auth/auth.controller.ts`

```ts
@Controller('auth')
@Post('login')
login(@Body() body: LoginDto) {
  return this.authService.login(body.username, body.password);
}
```

这些装饰器组合出 `POST /api/auth/login`：

- `@Controller('auth')`：路由分组。
- `@Post('login')`：只接收该路径的 POST 请求。
- `@Body()`：从 HTTP JSON 请求体读取数据。

Controller 只做协议适配：读取 HTTP 参数，再调用 Service。查询数据库、校验密码等业务不放在 Controller。

### 8.5 `AuthService.login()`

执行顺序如下：

1. 根据用户名查询 `User`。
2. 使用 scrypt 校验密码。
3. 失败时抛出 `INVALID_CREDENTIALS`，而且不区分用户名不存在还是密码错误，避免泄露账号信息。
4. 删除 `passwordHash` 等不应返回的字段，得到公开用户信息。
5. 使用 `JwtService.signAsync()` 签发 JWT。

JWT 载荷如下：

```ts
{
  sub: user.id,
  username: user.username,
  displayName: user.displayName,
  role: user.role,
}
```

`sub` 是 JWT 的标准字段，表示当前凭证代表哪个主体。JWT 还会自动包含签发时间 `iat` 和过期时间 `exp`。

JWT 只是编码加签，不是加密。任何拿到 Token 的人都可能读到载荷，所以绝不能放密码。

## 9. 浏览器如何保存和携带 Token

### 9.1 `apps/web/src/api/token.ts`

```ts
localStorage.setItem(TOKEN_KEY, token);
```

`localStorage` 刷新页面后仍存在，所以页面可以恢复登录状态。本课用它方便观察；正式项目需要评估 XSS 风险，常见方案还有 HttpOnly Cookie。

### 9.2 `apps/web/src/api/http.ts`

所有需要身份的前端请求最终经过 `requestJson()`：

```ts
headers.set('Authorization', `Bearer ${token}`);
```

最终 HTTP 请求头类似：

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

`Bearer` 表示“持有这个 Token 的调用者”。前端显示隐藏按钮只能改善体验，真正的安全检查必须由后端完成。

### 9.3 `apps/web/src/App.tsx`

页面刷新时：

1. 查看本地是否有 Token。
2. 有 Token 就调用 `GET /api/auth/me`。
3. 后端验证成功后返回当前用户。
4. Token 无效或过期时删除它，重新显示登录界面。

不要只因为本地存在 Token 就认定已登录，因为它可能已经过期或被伪造。

## 10. JwtAuthGuard 如何认证请求

文件：`apps/api/src/auth/jwt-auth.guard.ts`

受保护 Controller 执行前，`canActivate()` 先运行：

```ts
const token = this.readBearerToken(request.headers.authorization);
const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
```

`verifyAsync()` 会同时检查：

- JWT 签名是否匹配当前 `JWT_SECRET`。
- Token 是否已过期。
- Token 格式是否正确。

仅仅把 JWT 内容 Base64 解码出来不算认证，必须验签。

验签成功后：

```ts
request.user = {
  id: payload.sub,
  username: payload.username,
  displayName: payload.displayName,
  role: payload.role,
};
```

Guard 把可信身份放到当前请求对象。这个 `request.user` 只在本次 HTTP 请求生命周期内存在，不是全局变量，不会和其他用户混在一起。

没有 Token、签名错误或 Token 过期时抛出 HTTP 401：

```json
{ "code": "AUTH_REQUIRED", "message": "请先登录或重新登录" }
```

## 11. CurrentUser 如何取出身份

文件：`apps/api/src/auth/current-user.decorator.ts`

`@CurrentUser()` 是项目自定义参数装饰器，它把读取 `request.user` 的重复代码封装起来：

```ts
getProfile(@CurrentUser() user: AuthenticatedUser) {
  return user;
}
```

执行顺序不能颠倒：

```text
JwtAuthGuard 写入 request.user
  → CurrentUser 读取 request.user
  → Controller 使用 user
```

如果路由没有先使用 `JwtAuthGuard`，`@CurrentUser()` 就得不到经过认证的身份。

## 12. RolesGuard 如何授权

认证解决“你是谁”，授权解决“你能不能做这件事”。

文件：`apps/api/src/auth/roles.decorator.ts`

```ts
@Roles('EXPERT')
```

这行代码并不会自己阻止请求，只是在路由上写入元数据：该接口允许 `EXPERT`。

文件：`apps/api/src/auth/roles.guard.ts`

`RolesGuard` 使用 `Reflector` 读取这份元数据，再比较：

```ts
roles.includes(request.user.role)
```

- 专家：认证成功，授权成功，继续执行。
- 查看用户：认证成功，授权失败，返回 HTTP 403。
- 未登录用户：先在认证阶段返回 HTTP 401，不进入角色检查。

## 13. 评分接口为什么不能接收 expertId

文件：`apps/api/src/review/review.controller.ts`

整个 Controller 使用：

```ts
@UseGuards(JwtAuthGuard)
```

因此查询和保存评分都必须先认证。

保存接口还增加：

```ts
@Roles('EXPERT')
@UseGuards(RolesGuard)
```

最终调用 Service 时：

```ts
this.reviewService.saveScore(
  reviewItemId,
  body.bidderId,
  user.id,
  body.score,
  body.feedback || '',
);
```

注意第三个参数来自 `user.id`，不是 `body.expertId`。请求体由浏览器用户控制，任何人都能用开发者工具修改；`user.id` 来自后端验签后的 Token。

`SaveScoreDto` 中根本没有 `expertId`，而 ValidationPipe 禁止额外字段。因此伪造该字段会直接返回 `VALIDATION_ERROR`。

## 14. Service 如何保存当前专家的评分

文件：`apps/api/src/review/review.service.ts`

Service 先查询评审项，得到该项真实满分，再检查业务规则：

```text
DTO：score 是不是数字？
Service：这个数字是否在当前评审项允许的范围内？
```

最后使用 `upsert`：

```ts
reviewItemId_bidderId_expertId: {
  reviewItemId,
  bidderId,
  expertId,
}
```

这三个字段组成数据库唯一约束：同一评审项、投标人和专家只有一条当前评分。第一次保存执行新增，再次保存执行更新。

## 15. 一次专家评分的完整时间线

1. React 调用 `saveExpertScore()`。
2. `requestJson()` 从 localStorage 读取 Token。
3. 请求头加入 `Authorization: Bearer <token>`。
4. Vite 将 `/api` 请求代理到 NestJS。
5. `JwtAuthGuard` 提取 Token。
6. `JwtService` 验证签名和过期时间。
7. Guard 将身份写入 `request.user`。
8. `RolesGuard` 读取路由要求的 `EXPERT` 角色。
9. ValidationPipe 使用 `SaveScoreDto` 校验请求体。
10. `@CurrentUser()` 读取可信用户身份。
11. Controller 将参数交给 `ReviewService`。
12. Service 查询 `ReviewItem`。
13. Service 检查分数范围和 0.5 步长。
14. Prisma 执行数据库 `upsert`。
15. PostgreSQL 保存数据并返回结果。
16. NestJS 将对象序列化为 JSON。
17. `requestJson()` 解析响应。
18. React 更新页面。

任何一步抛出异常，后续步骤都会停止，并由 `ApiExceptionFilter` 统一返回错误。

## 16. 四种失败分别在哪一层

| 情况 | 拦截位置 | HTTP | 错误码 |
| --- | --- | --- | --- |
| `score` 是字符串 | ValidationPipe | 400 | `VALIDATION_ERROR` |
| 分数超过满分 | ReviewService | 400 | `SCORE_OUT_OF_RANGE` |
| 没有或伪造 Token | JwtAuthGuard | 401 | `AUTH_REQUIRED` |
| VIEWER 尝试评分 | RolesGuard | 403 | `INSUFFICIENT_ROLE` |

排查错误时先看 HTTP 状态码和业务错误码，就能快速确定应该阅读哪一层代码。

## 17. 建议你亲手做的实验

### 实验 A：观察登录请求

1. 打开浏览器开发者工具 Network。
2. 使用专家账号登录。
3. 找到 `POST /api/auth/login`。
4. 查看 Request Payload 和 Response。
5. 确认密码只出现在登录请求，后续评分请求不再发送密码。

### 实验 B：观察受保护请求

1. 找到 `GET /api/auth/me` 或评分请求。
2. 查看 Request Headers。
3. 找到 `Authorization: Bearer ...`。
4. 对照 `jwt-auth.guard.ts`，确认 Guard 从哪里读取它。

### 实验 C：让 Token 失效

1. 在 Application → Local Storage 删除 `fullstack-lab-access-token`。
2. 刷新页面。
3. 页面重新显示登录表单。
4. 直接请求评审接口会返回 401。

### 实验 D：比较两个角色

1. 使用 `expert` 登录，确认可以保存。
2. 退出后使用 `viewer` 登录。
3. 确认前端按钮被禁用。
4. 记住：按钮禁用只是用户体验，真正权限由后端 RolesGuard 保证。

## 18. 常见疑问

### 有 JWT 后还需要数据库吗？

需要。JWT 主要携带短期身份，用户、评分、文件等长期业务数据仍在数据库中。用户被禁用、角色被修改时，成熟系统还需要考虑 Token 撤销或重新查询用户状态。

### 为什么不把所有逻辑写在 Controller？

Controller 属于 HTTP 层。将业务放入 Service 后，未来定时任务、消息队列或测试也能复用，不必伪造 HTTP 请求。

### 前端隐藏按钮是不是已经完成权限控制？

不是。用户可以绕过页面直接发请求。前端权限控制改善交互，后端权限控制才保证安全。

### 401 和 403 有什么区别？

- 401：身份没有通过认证，需要登录或重新登录。
- 403：身份已经认证，但没有执行该操作的权限。

## 19. 本课为了学习做出的简化

- 演示账号由应用启动时自动创建，正式项目通常使用 seed 或用户管理流程。
- 角色使用字符串，复杂系统通常使用数据库枚举、权限表或 RBAC 模型。
- `ExpertScore.expertId` 当前是逻辑上的用户 ID，尚未建立数据库外键；正式设计通常会增加关联约束。
- Token 暂存在 localStorage；正式项目需要结合 XSS、跨域和部署方式选择更合适的存储方案。
- 当前 Token 有效期内不会实时感知用户被禁用，后续可增加用户状态检查或 Token 撤销机制。

这些简化不是最终生产方案，而是为了每一课只增加有限的新概念。

## 20. 自测题

先尝试自己回答，再展开答案。

<details>
<summary>1. ValidationPipe 和 JwtAuthGuard 的区别是什么？</summary>

ValidationPipe 检查请求数据的结构和类型；JwtAuthGuard 检查请求者身份。一个请求可能身份正确但参数错误，也可能参数正确但没有身份。

</details>

<details>
<summary>2. 为什么 JWT 载荷中不能放密码？</summary>

JWT 默认只是编码和签名，并未加密。拿到 Token 的人可能读取载荷内容。

</details>

<details>
<summary>3. 为什么保存评分使用 user.id 而不是 body.expertId？</summary>

请求体可以被调用者任意修改；`user.id` 来自后端验签后的 Token，能够代表已经认证的当前用户。

</details>

<details>
<summary>4. viewer 登录成功后为什么仍不能评分？</summary>

登录成功只代表认证成功。评分路由还要求 `EXPERT` 角色，RolesGuard 会让 viewer 在授权阶段收到 403。

</details>

<details>
<summary>5. Module、Controller 和 Service 分别做什么？</summary>

Module 组织并连接功能；Controller 接收 HTTP 请求；Service 执行业务规则并访问数据库等外部能力。

</details>

能不看答案解释这五题后，再进入文件上传课程。
