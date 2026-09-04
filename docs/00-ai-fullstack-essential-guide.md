# AI 时代的全栈开发必备知识地图

这份文档写给“前端基础已有，但 Node.js、NestJS、数据库、对象存储和部署几乎从零开始”的开发者。

先说结论：以后主要用 Codex 写代码完全可行，但“让 AI 生成代码”和“你能对系统负责”是两回事。你不需要背下所有语法，也不需要徒手写每个配置；你必须能判断需求有没有做对、数据会不会丢、权限会不会放错、改动能不能验证、上线失败能不能退回。

## 一、什么才叫“掌握”，不是把文档背下来

对每项技术，你先达到下面四个标准就够了：

1. **知道它负责什么**：例如 PostgreSQL 保存结构化业务数据，MinIO 保存 PDF 文件内容。
2. **知道数据怎么经过它**：一个请求从浏览器出发，经过 Nginx、NestJS，最后写入数据库或 MinIO。
3. **知道失败时先看哪里**：页面错误看 Network，请求 500 看 API 日志，连接失败看容器和环境变量。
4. **知道怎样证明它正常**：不能只接受 AI 说“完成了”，要有类型检查、测试、接口响应、数据库查询或日志作为证据。

暂时不会默写 NestJS 装饰器、Prisma 方法或 Docker 参数没关系，随时可以让 AI 查和写。不能接受的是：不知道命令会不会删数据，就直接在生产环境运行。

## 二、先只认识这 20 个词

原术语表用于查阅，不应该一次背完。刚开始只需要理解下面这些词：

| 词 | 最简单的理解 |
| --- | --- |
| 源码 | 开发者和 AI 编辑的代码文件 |
| 进程 | 正在运行的一个程序，例如正在运行的 NestJS |
| 服务 | 对外提供一种能力的长期运行程序，例如 API 服务 |
| 端口 | 同一台电脑上区分不同服务的门牌号 |
| 请求 | 浏览器向服务提出的一次问题或操作 |
| 响应 | 服务对请求返回的状态和数据 |
| API | 前后端约定好的请求入口和数据格式 |
| HTTP 状态码 | 请求结果的大类，例如 200、400、401、403、500 |
| 日志 | 程序运行时留下的过程和错误信息 |
| 环境变量 | 同一份代码在不同环境使用的配置，例如端口和密码 |
| 数据库 | 持久保存业务数据的软件 |
| 表、行、列 | 数据库中的数据集合、一条记录和一个字段 |
| 迁移 | 可追踪地改变数据库表结构 |
| Token | 登录后代表当前身份的临时凭证 |
| 镜像 | 已打包好的程序和运行环境模板 |
| 容器 | 镜像实际运行出来的实例 |
| Volume | 容器被替换后仍保留数据的存储空间 |
| 反向代理 | 接收统一入口请求，再转给内部服务 |
| 备份 | 为数据制作可独立保存的副本 |
| 回滚 | 新版本失败时把应用切回已知可用版本 |

以后在代码中遇到一个新词，再去 `docs/glossary.md` 查它。术语必须和实际请求、代码或故障联系起来才容易理解。

## 三、你必须建立的系统全景

先不要陷入某个框架。这个项目整体只有下面这条主线：

```text
用户点击页面
    ↓ HTTP 请求
React 前端
    ↓ /api
Nginx 或 Vite 开发代理
    ↓
NestJS Controller：接收请求
    ↓
DTO / Guard：检查参数、身份和权限
    ↓
Service：执行评分、文件等业务规则
    ↓                  ↓
Prisma → PostgreSQL    MinIO SDK → MinIO
    ↓                  ↓
结构化记录             PDF 二进制内容
```

出问题时也沿这条链路逐层排查，而不是让 AI 随机改代码：

1. 浏览器有没有发出请求？
2. 请求地址、方法、请求体和 Token 对不对？
3. Nginx/Vite 有没有转发到 API？
4. NestJS 返回了什么状态码和错误？
5. 数据库或 MinIO 是否可连接？
6. 数据是否真的写入，而不是页面暂时显示成功？

## 四、必须亲自理解的九类知识

下面所有项目文件路径都相对于 `D:\projects\fullstack-learning-lab`。每一项都按照“问题 → 答案 → 项目 Demo”编写，可以边读边打开对应文件，不要求脱离代码背诵。

### 1. 文件、终端和进程

#### 1.1 为什么要看懂绝对路径、相对路径和当前工作目录？

**答案：** 绝对路径从磁盘根开始，例如 `D:\projects\fullstack-learning-lab\package.json`，无论当前在哪都指向同一文件。相对路径从当前工作目录开始，例如在项目根目录运行时，`apps/api` 才表示当前项目的 API 目录。命令在错误目录运行，可能找不到 `package.json`，也可能误操作另一个同名文件。

**项目 Demo：** 根目录 `README.md` 的启动命令都先执行 `cd D:\projects\fullstack-learning-lab`；`scripts/generate-dev-certificate.mjs` 会根据脚本自身位置计算项目根目录，避免依赖调用者当前目录。

#### 1.2 `cd`、`package.json`、源码和构建产物分别是什么？

**答案：** `cd` 用来切换当前目录；根 `package.json` 是项目命令入口；`apps/api/src` 和 `apps/web/src` 是人和 AI 修改的源码；`apps/api/dist`、`apps/web/dist` 是构建生成的运行产物，通常不直接手改，因为下次构建会覆盖。

**项目 Demo：** 查看根 `package.json` 的 `scripts`；查看 `apps/api/src/main.ts` 与 `apps/web/src/App.tsx` 的源码；运行 `pnpm build` 后再查看两个 `dist` 目录。

#### 1.3 “安装依赖”“启动开发服务”“生产构建”为什么是三件事？

**答案：** `pnpm install` 根据依赖清单把第三方包准备好；`pnpm dev` 启动便于开发的服务并监听源码变化；`pnpm build` 把 TypeScript、React 源码转换成可部署产物。安装成功不代表程序能启动，开发服务能打开也不代表生产构建一定通过。

**项目 Demo：** 根 `package.json` 中分别有 `dev`、`build`、`check` 和 `test`；`apps/web/package.json` 展示 Vite 开发与构建命令，`apps/api/package.json` 展示 NestJS 编译和启动命令。

#### 1.4 为什么终端会一直被服务占用，`Ctrl+C` 又会发生什么？

**答案：** `pnpm dev` 启动的是长期运行进程，它要持续监听端口并等待请求，所以终端不会自动回到提示符。`Ctrl+C` 向当前前台进程发送中断信号，通常只停止这个终端启动的服务，不会自动停止 Docker Desktop 或其他终端里的进程。

**项目 Demo：** 运行 `pnpm dev` 后前端与 API 会持续打印日志；`apps/api/src/main.ts` 中的 `app.listen()` 让 API 持续监听端口，`app.enableShutdownHooks()` 让 NestJS 在停止时执行清理钩子。

#### 1.5 怎样根据端口找到进程，为什么不能重复启动服务？

**答案：** 同一 IP 的同一端口通常只能由一个监听程序占用。API 已占用 3000 时再启动一个 API，第二个会报 `EADDRINUSE`。先查占用者，再决定复用、停止旧进程还是调整端口：

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object LocalPort -eq 3000 |
  Select-Object LocalAddress, LocalPort, OwningProcess

Get-Process -Id <上一步的 OwningProcess>
```

不能因为想抢端口就结束不认识的系统或其他项目进程。

**项目 Demo：** `apps/api/src/main.ts` 默认监听 3000；`apps/web/vite.config.ts` 使用 5173；`compose.yaml` 集中声明 PostgreSQL、MinIO、API 和 Web 的宿主机端口。

#### 1.6 什么是退出码，为什么要找第一条真正的错误？

**答案：** 命令结束时返回 `0` 通常代表成功，非 `0` 代表失败。最后的 `ELIFECYCLE` 或 `exit code 1` 往往只是 pnpm 对下层失败的汇总；真正原因通常更早出现，例如 `P1001: Can't reach database server at localhost:5432`。应从第一条明确异常开始阅读上下文，而不是只看最后一句。

```powershell
$LASTEXITCODE # 查看上一条外部命令的退出码
```

**项目 Demo：** `apps/api/scripts/run-integration-tests.mjs` 检查每个子命令的退出状态，失败后仍在 `finally` 清理测试容器；`.github/workflows/ci.yml` 中任一步返回非 0，当前 CI 任务就会失败。

AI 可以帮你生成命令，但你必须告诉它当前目录、操作系统、报错全文，以及哪些进程不能停止。

### 2. HTTP 和前后端边界

#### 2.1 URL 的协议、主机、端口、路径和查询参数分别是什么？

**答案：** 以 `http://localhost:3000/api/review-items/review-progress-plan?bidderId=demo-bidder` 为例：`http` 是通信协议，`localhost` 是主机，`3000` 是服务端口，`/api/review-items/review-progress-plan` 是接口路径，`bidderId=demo-bidder` 是查询参数。协议、主机或端口任一不同，浏览器就可能把它视为不同源。

**项目 Demo：** `apps/web/src/api/reviews.ts` 组装评分接口请求；`apps/api/src/review/review.controller.ts` 用 `@Param` 读取路径参数、用 `@Query` 读取查询参数。

#### 2.2 GET、POST、PUT/PATCH、DELETE 应该怎样理解？

**答案：** 它们表达请求意图：GET 读取数据，POST 常用于创建或触发动作，PUT 常表示整体保存或覆盖，PATCH 常表示局部修改，DELETE 删除资源。它们不是绝对法律，但前后端应保持约定一致，并且 GET 不应偷偷修改数据。

**项目 Demo：** `apps/api/src/auth/auth.controller.ts` 用 POST 登录；`apps/api/src/document/document.controller.ts` 用 POST 上传；`apps/api/src/review/review.controller.ts` 用 GET 查评审详情、用 PUT 保存专家评分。

#### 2.3 请求头、请求体、响应状态码和 JSON 响应是什么？

**答案：** 请求头携带身份、内容类型等附加信息，例如 `Authorization: Bearer ...`；请求体携带登录信息、分数等主要数据；状态码先告诉浏览器成功或失败的大类；JSON 响应再提供业务数据或错误详情。

**项目 Demo：** `apps/web/src/api/http.ts` 统一添加 Token、解析 JSON 和处理失败；`apps/web/src/api/reviews.ts` 发送评分请求体；`apps/api/src/common/api-exception.filter.ts` 统一生成失败 JSON。

#### 2.4 400、401、403、404、409 和 500 分别表示什么？

**答案：** 400 表示请求参数不合法；401 表示没有有效登录身份；403 表示身份有效但权限不足；404 表示目标资源不存在；409 表示请求与当前数据状态冲突，例如唯一值重复；500 表示后端出现未预料异常。前端不应把所有失败都显示为“网络错误”。

**项目 Demo：** `apps/api/src/common/api-exception.filter.ts` 维护状态码和业务错误码；`apps/api/src/auth/jwt-auth.guard.ts` 产生 401；`apps/api/src/auth/roles.guard.ts` 产生 403；`apps/api/src/review/review.service.ts` 会产生 400 和 404。

#### 2.5 怎样用浏览器 Network 面板判断请求实际发生了什么？

**答案：** 打开开发者工具的 Network，重新执行操作，选择对应请求，依次看 Request URL、Method、Request Headers、Payload、Status 和 Response。这样能区分“按钮根本没发请求”“请求地址错误”“Token 没带”“后端明确拒绝”等不同问题。

**项目 Demo：** 登录后保存评分，可以看到 `PUT /api/review-items/.../score`；点击 PDF 预览，会先看到带 JWT 的预览 API 请求，再看到浏览器访问短期签名 URL。前端触发位置分别在 `apps/web/src/components/ReviewScoreCard.tsx` 和 `apps/web/src/components/DocumentPanel.tsx`。

#### 2.6 为什么前端校验后，后端还必须重新校验？

**答案：** 用户可以绕过页面直接调用 API，也可以在浏览器中修改 JavaScript 和请求体。前端校验只负责及时提示，后端才是保护数据库的可信边界。即使按钮限制最高 4 分，攻击者仍能手工发送 100 分。

**项目 Demo：** `ReviewScoreCard.tsx` 提供页面输入限制；`apps/api/src/review/dto/save-score.dto.ts` 检查数据类型；`apps/api/src/review/review.service.ts` 再根据数据库中的最高分和 0.5 步长执行业务校验。

这是全栈开发最重要的共同语言。框架会变化，HTTP 边界长期存在。

### 3. JavaScript、TypeScript 与 Node.js

Node.js 不是另一门语言，它是在浏览器之外运行 JavaScript 的环境。

#### 3.1 浏览器 JavaScript 和 Node.js JavaScript 有什么区别？

**答案：** 语言基本相同，但运行环境提供的能力不同。浏览器提供 `window`、DOM、用户界面和受限网络访问；Node.js 提供文件系统、进程、服务器和操作系统能力，但默认没有页面 DOM。后端不能使用 `document.querySelector`，前端也不能随意读取服务器磁盘。

**项目 Demo：** `apps/web/src/App.tsx` 使用 React 和浏览器界面；`apps/api/src/main.ts` 在 Node.js 中启动 HTTP 服务；`scripts/create-backup.mjs` 使用 Node.js 文件和子进程 API。

#### 3.2 `package.json` 和 `pnpm-lock.yaml` 各自负责什么？

**答案：** `package.json` 声明项目名称、脚本以及允许的依赖版本范围；`pnpm-lock.yaml` 记录这次安装实际解析到的精确版本及依赖关系。两者都提交 Git，才能让同事和 CI 尽量安装同一套依赖。

**项目 Demo：** 根 `package.json` 管理整个工作区命令；`apps/api/package.json` 和 `apps/web/package.json` 分别声明后端、前端依赖；`.github/workflows/ci.yml` 使用 `pnpm install --frozen-lockfile`，锁文件不一致时直接失败。

#### 3.3 `dependencies` 和 `devDependencies` 有什么区别？

**答案：** `dependencies` 是程序生产运行仍需要的包，例如 NestJS、Prisma Client；`devDependencies` 主要在开发、类型检查、构建或测试时使用，例如 TypeScript、Vitest。Docker 生产镜像通常尽量不携带纯开发工具，以减少体积和攻击面。

**项目 Demo：** 查看 `apps/api/package.json`；再看 `apps/api/Dockerfile` 的 build 与 production-dependencies 阶段如何分别安装依赖。Prisma CLI 当前放在运行依赖中，是因为 API 容器启动时需要执行 `prisma migrate deploy`。

#### 3.4 怎样通过 `import` / `export` 跟踪代码？

**答案：** `export` 让文件公开一个函数、类或值，`import` 表示当前文件从哪里使用它。看到陌生调用时先看文件顶部 import，再打开来源文件，比在整个项目里猜更可靠。

**项目 Demo：** `review.controller.ts` 从 `review.service.ts` 导入 `ReviewService`；`document.service.ts` 从 `file-storage.port.ts` 导入 `FILE_STORAGE`；`app.module.ts` 导入各业务 Module 并组装应用。

#### 3.5 Promise、`async/await` 和 `try/catch` 怎样理解？

**答案：** 数据库、网络和文件操作不能立即完成，通常返回 Promise。`await` 等待它成功并取得结果；失败时 Promise 会拒绝，需由 `try/catch` 处理、向上抛出，或在统一错误层处理。忘记 `await` 可能让函数提前返回，也可能产生未处理异常。

**项目 Demo：** `apps/api/src/document/document.service.ts` 的 `upload()` 等待 MinIO 和 Prisma；数据库创建失败后用 `catch` 清理对象；`apps/api/src/main.ts` 对 `bootstrap()` 使用 `.catch()`，确保启动失败被记录并返回非 0 状态。

#### 3.6 为什么 TypeScript 类型不能替代运行时校验？

**答案：** TypeScript 类型在构建后大多会被删除，它只能检查开发者写的代码。浏览器、第三方调用者或攻击者发送的 JSON 不会自动遵守 TypeScript 接口，所以后端必须在运行时验证。

**项目 Demo：** `SaveScoreDto` 的 TypeScript 字段同时使用 `class-validator` 装饰器；`apps/api/src/configure-http-app.ts` 注册 `ValidationPipe`，真正请求到来时才执行这些规则。

#### 3.7 `process.env` 是什么，为什么关键配置缺失时要尽早失败？

**答案：** `process.env` 是 Node.js 读取外部环境变量的入口，读取结果是字符串或 `undefined`。如果数据库或 MinIO 密钥缺失却让程序继续启动，错误可能等到用户操作时才暴露，更难定位。关键配置应在启动阶段检查并给出明确错误；修改变量后通常要重启进程或容器。

**项目 Demo：** `apps/api/src/main.ts` 读取可使用默认值的 `PORT`；`apps/api/src/document/minio.config.ts` 使用 `readRequired()` 强制检查 MinIO 配置，并验证端口、URL；`apps/api/prisma/schema.prisma` 从 `DATABASE_URL` 获取数据库连接；`apps/api/.env.example` 提供开发示例但不保存生产密钥。

你不必先研究 Node.js 事件循环源码，也不必背 npm/pnpm 的所有命令。

### 4. NestJS 后端请求链路

NestJS 帮你组织 Node.js API。先看懂各部分职责，不需要背装饰器。

#### 4.1 Module 是什么，为什么需要它？

**答案：** Module 是功能装配清单，告诉 NestJS 这一组功能有哪些 Controller、Provider，以及依赖哪些其他 Module。它本身通常不写业务逻辑，作用类似“把零件正确接线”。没有注册的 Controller 或 Provider，NestJS 不知道要创建它。

**项目 Demo：** `apps/api/src/review/review.module.ts` 注册 `ReviewController` 和 `ReviewService`，并导入认证模块；`apps/api/src/app.module.ts` 再把 Review、Document、Health 等模块装配成完整应用。

#### 4.2 Controller 是什么，为什么不把所有逻辑都写进去？

**答案：** Controller 是 HTTP 接待员：决定路由和请求方法，读取路径、查询、请求体和当前用户，再调用 Service。复杂业务都写在 Controller 会导致逻辑难复用、难测试，也容易把 HTTP 细节与业务规则混在一起。

**项目 Demo：** `apps/api/src/review/review.controller.ts` 接收评分请求并把 `reviewItemId`、`bidderId`、当前用户和分数交给 `ReviewService`；真正的最高分和步长校验在 `review.service.ts`。

#### 4.3 DTO 是什么，它能校验哪些内容？

**答案：** DTO 是请求数据的运行时格式说明书。它适合检查字段是否存在、是不是字符串或数字、长度和基本格式。它不适合判断“当前评审项最高分是多少”这类需要查数据库的业务规则。

**项目 Demo：** `apps/api/src/review/dto/save-score.dto.ts` 声明 `bidderId`、`score` 和 `feedback`；`apps/api/src/auth/dto/login.dto.ts` 声明登录字段。

#### 4.4 Pipe 是 NestJS 特有的吗？

**答案：** “数据进入业务方法前先转换或校验”的思想不是 NestJS 特有的，其他框架也会用中间件、Schema 校验器或普通函数实现。`Pipe` 接口、`ValidationPipe` 和 `@UsePipes()` 是 NestJS 提供的具体实现。

当前全局 Pipe 的流程是：请求 JSON → `ValidationPipe` 按 DTO 校验和转换 → 通过后进入 Controller。非法数据会在执行 Service 之前失败。

**项目 Demo：** `apps/api/src/configure-http-app.ts` 注册全局 `ValidationPipe`；`save-score.dto.ts` 提供它执行的规则。可结合 `docs/04b-auth-code-walkthrough.md` 阅读一次完整请求。

#### 4.5 Guard 是什么，它与 Pipe 有什么区别？

**答案：** Guard 是门卫，决定请求者能否进入路由。Pipe 主要问“数据格式对不对”，Guard 主要问“你是谁、你有没有权限”。一个请求可能参数正确但没登录，也可能登录成功但角色无权评分。

**项目 Demo：** `apps/api/src/auth/jwt-auth.guard.ts` 验证 JWT 并建立当前用户；`roles.guard.ts` 检查角色；`review.controller.ts` 在评分路由要求 `EXPERT`。

#### 4.6 Service 是什么，它与 Controller 有什么区别？

**答案：** Service 是业务负责人，执行评分范围、文件校验、数据查询和失败补偿等规则。Controller 只负责 HTTP 输入输出，因此同一个 Service 将来可以被另一个 Controller、任务脚本或测试调用。

**项目 Demo：** `apps/api/src/review/review.service.ts` 处理评分；`apps/api/src/document/document.service.ts` 协调文件存储与数据库；相应的 `.spec.ts` 可在不启动 HTTP 服务时直接测试 Service。

#### 4.7 Provider 和依赖注入是什么？

**答案：** Provider 是交给 NestJS 创建和管理、可注入给其他对象使用的依赖。Service 通常是 Provider，但 Provider 也可以是一个值、工厂或 Token 对应的实现。依赖注入表示一个类只声明“我需要什么”，由 NestJS 提供实例，而不是到处手工 `new`。

这样做便于统一生命周期和替换实现。例如 `DocumentService` 只依赖 `FILE_STORAGE` 能力；正式运行注入 MinIO，单元测试注入可观察的假存储。

**项目 Demo：** `apps/api/src/document/document.module.ts` 用 `{ provide: FILE_STORAGE, useExisting: MinioFileStorageService }` 建立映射；`document.service.ts` 用 `@Inject(FILE_STORAGE)` 接收；`document.service.spec.ts` 用 `useValue` 替换为 Mock。

#### 4.8 Exception Filter 是什么？

**答案：** Exception Filter 是 NestJS 集中捕获未处理异常并生成 HTTP 错误响应的机制。“统一异常处理”并非只有 NestJS 有，但 `ExceptionFilter` 接口和 `@Catch()` 是 NestJS 的实现。它避免每个 Controller 重复写 `try/catch`，也防止未知 500 错误把内部堆栈泄露给浏览器。

**项目 Demo：** `apps/api/src/common/api-exception.filter.ts` 把不同异常转换成统一的 `success/code/message/details/timestamp/path`；`configure-http-app.ts` 通过 `useGlobalFilters()` 全局注册它。

#### 4.9 一次 NestJS 请求按什么顺序经过这些部件？

**答案：** 对当前评分请求可以先记成：路由匹配 → Guard 验身份和角色 → Pipe 根据 DTO 校验输入 → Controller 读取参数 → Service 执行业务 → Prisma 访问 PostgreSQL → 返回 JSON；任一层抛出异常后，由 Exception Filter 统一响应。

**项目 Demo 阅读顺序：** `apps/web/src/components/ReviewScoreCard.tsx` → `apps/web/src/api/reviews.ts` → `review.controller.ts` → `save-score.dto.ts` 与两个 Guard → `review.service.ts` → `schema.prisma`。暂时不要求从空白项目默写这些文件。

### 5. 数据库、SQL 和 Prisma

Prisma 是访问数据库的工具，不是数据库本身；PostgreSQL 才真正保存数据。

#### 5.1 表、行、列、数据类型、主键和外键是什么？

**答案：** 表是一类数据的集合，例如 `Document`；一行是一份文件记录；列是 `originalName`、`size` 等属性；数据类型限制列保存字符串、数字还是时间。主键唯一识别一行，外键把一张表的记录指向另一张表，例如文件的 `uploadedById` 指向上传用户。

**项目 Demo：** `apps/api/prisma/schema.prisma` 中 `User`、`Document`、`ReviewItem`、`ExpertScore` 是四张业务表；`Document.id` 是主键，`uploadedById` 与 `uploadedBy` 描述文件到用户的外键关系。

#### 5.2 为什么 `NOT NULL`、`UNIQUE` 等约束是最后一道数据防线？

**答案：** `NOT NULL` 禁止必填列为空，`UNIQUE` 禁止重复值。即使前端或后端某处漏了校验，PostgreSQL 仍会拒绝破坏规则的数据。它们比只写在页面里的限制更可靠，因为所有写入数据库的程序都必须遵守。

**项目 Demo：** Prisma 中没有 `?` 的字段默认必填，对应数据库非空；`User.username @unique` 防止重复用户名；`ExpertScore` 的 `@@unique([reviewItemId, bidderId, expertId])` 防止同一专家产生重复评分记录。对应 SQL 在 `apps/api/prisma/migrations/`。

#### 5.3 `SELECT`、`INSERT`、`UPDATE`、`DELETE` 和 `JOIN` 分别做什么？

**答案：** `SELECT` 查询，`INSERT` 新增，`UPDATE` 修改，`DELETE` 删除；`JOIN` 根据关联字段把多张表组合查询。例如文件列表可以把 `Document.uploadedById` 与 `User.id` 连接，从而同时返回上传者姓名。实际项目主要由 Prisma 生成 SQL，但你仍应能辨认这些基础操作。

**项目 Demo：** `review.service.ts` 的 `findUnique` 类似按条件 SELECT，`upsert` 根据是否存在执行 INSERT 或 UPDATE；`document.service.ts` 的 `findMany({ include: { uploadedBy: ... } })` 会查询文件及关联用户；迁移目录中的 `.sql` 展示真实建表语句。

#### 5.4 怎样理解“事务保证一组相关操作要么都成功，要么都失败”？

**答案：** 假设转账要执行“A 减 100”和“B 加 100”。只成功第一步会导致钱消失。数据库事务把相关操作包在一起：全部成功才提交，任一步失败就回到开始前。Prisma 可通过 `$transaction` 执行多项数据库操作。

但 PostgreSQL 事务只能回滚数据库，不能自动撤销 MinIO、磁盘、邮件或第三方接口。当前上传流程先写 MinIO，再写数据库；数据库失败时必须手工删除刚写入的对象，这叫补偿。

**项目 Demo：** `apps/api/src/document/document.service.ts` 的 `upload()` 在 `catch` 中执行 `storage.remove(storageKey)`；`document.service.spec.ts` 的“数据库写入失败时删除刚保存的对象”用例验证了补偿。当前评分保存只有一次原子 `upsert`，暂时不需要额外事务。

#### 5.5 为什么索引加快查询，却占空间并增加写入成本？

**答案：** 索引像书的目录。没有目录时数据库可能逐行扫描，索引可先找到目标位置；但目录本身要占空间，每次新增、删除或修改相关字段时也要同步维护，所以索引不是越多越好，应围绕真实查询条件建立。

**项目 Demo：** `Document` 的 `@@index([uploadedById])` 支持按上传者查文件；`ExpertScore` 的 `@@index([reviewItemId])` 支持按评审项查询。`@unique` 和 `@@unique` 通常也会在 PostgreSQL 建立唯一索引，既加速查找又阻止重复。

#### 5.6 Prisma Schema 和 Prisma Client 是什么关系？

**答案：** PostgreSQL 是真正保存数据的服务；`schema.prisma` 是应用的数据模型设计文件；Prisma Client 是根据这个设计生成的 TypeScript 查询工具。Schema 声明 `Document` 后，Client 会提供 `prisma.document.findMany()` 等带类型提示的方法。

修改 Schema 只改变设计文件，不会自动改变数据库；还需要迁移把真实表结构同步过去。

**项目 Demo：** `apps/api/prisma/schema.prisma` 描述模型；`apps/api/src/prisma/prisma.service.ts` 继承生成的 `PrismaClient` 并管理连接；`review.service.ts` 和 `document.service.ts` 展示类型化查询。

#### 5.7 `prisma migrate dev` 和 `prisma migrate deploy` 有什么区别？

**答案：** `migrate dev` 在本机开发时根据 Schema 变化生成新的 `migration.sql`、执行它并更新 Client，过程可能需要交互；`migrate deploy` 不设计新迁移，只按顺序执行仓库里已经审核和提交、但目标数据库尚未执行的迁移，因此适合 CI、测试和生产。

流程应该是：本机修改 Schema → `migrate dev` 生成 SQL → 人和 AI 检查 SQL → 提交 Git → 测试/生产执行同一份 `migrate deploy`。生产服务器不能临时生成一份没人检查过的迁移。

**项目 Demo：** 根 `package.json` 的 `db:migrate` 用于本机；`apps/api/scripts/run-integration-tests.mjs` 对隔离测试库执行 `migrate deploy`；`apps/api/Dockerfile` 在启动 NestJS 前也执行 `migrate deploy`。

#### 5.8 修改迁移前为什么要判断删列、改类型、丢数据或锁表？

**答案：** 迁移面对的是已经有真实记录的数据库。删列会删除历史值；长文本改短可能装不下旧值；可空列改非空会被旧空值阻止；增加唯一约束会被已有重复数据阻止；大表建索引或改类型还可能长时间锁表，让正常请求等待。

常见安全方式是分多次发布：先新增兼容字段，再填充历史数据并切换代码，确认稳定后最后删除旧字段。应用镜像回滚不会自动撤销数据库迁移，因此生产执行前必须检查 SQL、备份和兼容性。

**项目 Demo：** 按时间阅读 `apps/api/prisma/migrations/*/migration.sql`，观察建表、加用户和加文件表的实际 SQL；`docs/02-database-prisma.md` 解释本项目的迁移流程。

#### 5.9 删除容器为什么通常不会删除 Volume，而 `docker compose down -v` 会删除数据？

**答案：** 容器是可替换的运行实例，Volume 是 Docker 独立管理的持久化空间，类似“主机”和“外接硬盘”。普通 `docker compose down` 删除容器与网络但默认保留 Volume；加 `-v` 明确要求一起删除 Volume，PostgreSQL 数据和 MinIO PDF 可能因此消失。

**项目 Demo：** `compose.yaml` 底部声明 `postgres-data`、`minio-data`，并分别挂载到两个服务的数据目录；`compose.test.yaml` 使用临时 `tmpfs`，所以测试结束可以安全丢弃测试数据。可用只读命令 `docker volume ls` 查看 Volume，不能为了清理随手加 `-v`。

任何涉及生产迁移、批量更新、删除表或恢复备份的操作，都不能只因为 AI 给出了一条命令就执行。

### 6. 登录、权限与安全边界

这部分不能完全外包给 AI，因为权限错误可能导致数据泄露。

#### 6.1 认证和授权有什么区别？

**答案：** 认证回答“你是谁”，例如用户名密码登录并验证 JWT；授权回答“已经确认身份的你能做什么”。viewer 可以认证成功，但因为不是 EXPERT，保存评分时仍会收到 403。401 通常是没有有效身份，403 是有身份但权限不足。

**项目 Demo：** `apps/api/src/auth/auth.service.ts` 负责登录；`jwt-auth.guard.ts` 负责认证；`roles.guard.ts` 和 `roles.decorator.ts` 负责角色授权；`review.controller.ts` 给保存评分路由声明 `EXPERT`。

#### 6.2 为什么后端不能相信请求体里的用户 ID、角色、价格或总分？

**答案：** 请求体由调用者控制，用户可以绕过页面手工修改。如果评分接口接受 `expertId`，普通用户就可能冒充别的专家；如果订单接口相信前端总价，用户可篡改价格。后端应从已验签 Token 获得当前用户，从数据库读取角色、单价和最高分，再计算关键结果。

**项目 Demo：** `review.controller.ts` 用 `@CurrentUser()` 获得后端认证后的用户，并把 `user.id` 传给 Service；`SaveScoreDto` 根本不接收 `expertId`；`review.service.ts` 从数据库中的 `ReviewItem.maxScore` 判断分数范围。

#### 6.3 为什么密码要保存摘要，不能保存明文或写进日志？

**答案：** 密码摘要是带随机盐的单向计算结果，登录时重新计算后比较，不需要还原原密码。数据库泄露时，摘要能增加攻击者批量取得真实密码的成本；明文或日志中的密码一旦泄露可直接登录，而且用户可能在其他网站复用密码。

**项目 Demo：** `apps/api/src/auth/password.ts` 使用 scrypt 生成和验证摘要；`password.spec.ts` 验证正确密码通过、错误密码失败；`schema.prisma` 的用户模型只保存 `passwordHash`。

#### 6.4 为什么 JWT 不是加密保险箱？

**答案：** 常见 JWT 的载荷只是 Base64URL 编码，拿到 Token 的人可以读取内容；签名的主要作用是让后端发现内容被修改。JWT 应只放必要身份声明并设置过期时间，不能放密码和敏感业务数据。Token 泄露后，在过期前仍可能被冒用。

**项目 Demo：** `apps/api/src/auth/auth.service.ts` 创建 Token；`jwt-auth.guard.ts` 验证签名与过期时间；`apps/web/src/api/token.ts` 管理浏览器端会话。详细流程见 `docs/04b-auth-code-walkthrough.md`。

#### 6.5 DTO 校验和 Service 业务校验为什么不能替代彼此？

**答案：** DTO 检查外部数据的形状，例如 `score` 是有限数字；Service 检查结合当前业务状态的规则，例如分数不能超过该评审项在数据库里的 `maxScore`，并且只能按 0.5 递增。只做 DTO 会放过业务非法值，只做 Service 又会让错误类型和额外字段进入核心逻辑。

**项目 Demo：** `save-score.dto.ts` 与 `configure-http-app.ts` 负责运行时格式校验；`review.service.ts` 负责最高分、步长和评审项存在性。

#### 6.6 为什么 Secret 不能进入 Git、前端包或聊天截图？

**答案：** Git 历史和镜像会被复制、缓存，删除当前文件也未必删除历史；前端代码会下载到每个用户浏览器，无法保密；聊天与截图还会扩大传播范围。数据库密码、MinIO 密钥、JWT Secret、私钥和访问 Token 应由环境或密钥管理系统注入，并支持轮换。

**项目 Demo：** `.gitignore` 和 `.dockerignore` 排除 `.env`、`.env.production` 与证书目录；`.env.production.example` 只保存变量名和假值；`compose.production.yaml` 从外部读取真实配置。

#### 6.7 HTTPS、CORS、CSP 和 iframe 限制分别解决什么？

**答案：** HTTPS 加密浏览器与服务器之间的传输、检查内容完整性并验证服务器身份；CORS 决定一个源的 JavaScript 能否读取另一个源的响应；CSP 限制当前页面能加载或连接哪些来源；iframe 限制分两面，`frame-src` 管“我能嵌入谁”，`frame-ancestors` 管“谁能嵌入我”。它们互相不能替代。

例如启用 HTTPS 不会自动允许跨域；配置 CORS 也不能解决 HTTPS 页面加载 HTTP PDF 的混合内容问题。源由协议、主机和端口共同组成。

**项目 Demo：** `apps/web/nginx.https.conf` 包含本地 HTTPS、CSP 和 `/storage` 同源代理；`deploy/nginx.production.conf` 包含生产配置；`compose.https.yaml` 注入证书和公共地址。完整解释与有答案的自测见 `docs/08-nginx-https-security.md`。

#### 6.8 怎样回答“谁能调用、能操作谁的数据、后端依据什么判断”？

**答案：** 为每个接口写出权限表：是否需要登录、允许哪些角色、资源是否只属于本人、管理员是否例外，以及身份来源。判断依据必须来自后端验签结果和数据库关系，不能来自前端隐藏按钮或请求体自报角色。

**项目 Demo：** 文件查询和预览由 `document.controller.ts` 的 Guard 保护；上传还要求 EXPERT；评分保存由 JWT Guard 加 RolesGuard 保护，并使用 `CurrentUser.id` 作为专家身份。可以对照两个 Controller 为每条路由写一行权限说明。

AI 可以帮助列威胁清单和编写 Guard，但权限规则必须由你和业务负责人确认。

### 7. 文件和对象存储

#### 7.1 数据库文件记录和 MinIO 中的 PDF 有什么区别？

**答案：** PostgreSQL 保存便于查询和关联的元数据，例如原文件名、大小、类型、上传者和对象键；MinIO 保存 PDF 的真实二进制字节。文件列表只查询元数据，真正预览时再根据对象键读取 MinIO。只存在数据库记录会导致找不到文件，只存在对象会成为业务无法找到的孤儿文件。

**项目 Demo：** `schema.prisma` 的 `Document` 模型保存元数据；`document.service.ts` 协调两边；`minio-file-storage.service.ts` 保存和读取字节。

#### 7.2 Bucket、Object Key 和 Windows 文件路径有什么区别？

**答案：** Bucket 是对象的顶层容器，Object Key 是 Bucket 内的唯一名称，例如 `documents/2026/uuid.pdf`。其中的斜杠只是对象名称的一部分，不代表服务器上一定有对应文件夹，也不能用 `D:\...` 这类本机路径访问。原中文文件名与 Object Key 也应分开保存。

**项目 Demo：** `minio-file-storage.service.ts` 的 `savePdf()` 使用年份和 UUID 生成对象键；`apps/api/src/document/minio.config.ts` 从 `MINIO_BUCKET` 读取桶名；`Document.originalName` 保留用户看到的名称。

#### 7.3 为什么上传不能只检查 `.pdf` 扩展名？

**答案：** 文件名、扩展名和浏览器上报的 MIME 类型都可被伪造。后端至少还应限制大小，并检查文件开头是否具有 PDF 特征 `%PDF-`。这仍不是完整病毒扫描，但比只信文件名更安全，也能阻止明显错误内容。

**项目 Demo：** `document.controller.ts` 在上传入口限制大小；`document.service.ts` 的 `validatePdf()` 同时检查大小、MIME 和文件签名；`document.service.spec.ts` 有“只看 MIME 类型不够”的测试。

#### 7.4 为什么预签名 URL 是短期访问凭证？

**答案：** MinIO 使用密钥对对象路径和过期时间签名。拿到完整 URL 的人通常在过期前不需要 JWT 就能读取对应对象，所以它像临时密码：应短期有效，不能长期保存、写入日志或发给无关人员。关闭 iframe 不会让已签发 URL 立即失效。

**项目 Demo：** `document.service.ts` 的 `createPreviewUrl()` 计算过期时间；`minio-file-storage.service.ts` 调用 `presignedGetObject()`；`apps/web/src/components/DocumentPanel.tsx` 先申请 URL 再打开预览。见 `docs/05c-presigned-preview-url.md`。

#### 7.5 为什么上传或删除可能只成功一边？

**答案：** PostgreSQL 和 MinIO 是两个独立系统，没有自动跨系统事务。可能出现 MinIO 保存成功但数据库断开，也可能数据库记录存在而对象被人工删除。业务代码要设计补偿、重试和定期核对，不能假设连续两次调用一定都成功。

**项目 Demo：** `document.service.ts` 在数据库创建失败后删除刚上传的 MinIO 对象；`document.service.spec.ts` 验证 `storage.remove()` 被调用。更完整的生产方案还应记录删除失败并异步重试。

#### 7.6 为什么 PostgreSQL 和 MinIO 都要备份，什么是时间点一致性？

**答案：** 一个保存业务关系和元数据，一个保存文件字节，只备份一边无法完整恢复。当前脚本先导出 PostgreSQL，再复制 MinIO；如果两步之间仍有用户上传或删除，两个备份可能代表稍微不同的时刻，这就是时间点不完全一致。

学习环境可以接受；严格生产环境需要在备份时暂停写入，或采用数据库时间点恢复、对象版本控制等方案。备份还必须复制到独立机器或存储，不能和生产数据只放同一块硬盘。

**项目 Demo：** `scripts/create-backup.mjs` 备份两边并生成清单；`scripts/verify-backup.mjs` 校验；`docs/09-ci-cd-backup-rollback.md` 解释限制和恢复演练。

你不需要自己实现 S3 协议或文件流底层算法。

### 8. 测试与验证

使用 AI 后，测试反而更重要，因为你生成代码的速度更快，也更容易生成“看起来合理但边界错误”的代码。

#### 8.1 为什么类型检查不能证明业务正确？

**答案：** TypeScript 能发现把字符串传给数字参数等代码形状问题，却不知道“评分不能超过 4”“viewer 不能评分”“数据库失败后要删除孤儿文件”等业务含义。类型正确的代码仍可能算错、越权或漏清理。

**项目 Demo：** `pnpm check` 执行 TypeScript 检查；`review.service.ts` 的分数规则由业务测试保护；`document.service.spec.ts` 保护文件补偿。`docs/06a-backend-unit-tests.md` 对比了类型检查、构建与测试。

#### 8.2 单元测试、集成测试和端到端测试分别验证什么？

**答案：** 单元测试隔离外部依赖，快速验证一个函数或 Service；集成测试启动真实 NestJS、PostgreSQL 和 MinIO，验证它们能协作；端到端测试从真实浏览器操作到后端和数据层，验证完整用户流程。越接近真实环境通常越慢、排错范围越大，因此三层互补。

**项目 Demo：** `document.service.spec.ts` 是后端单元测试；`apps/api/src/integration/document-api.integration.spec.ts` 是 API 集成测试；`apps/web/src/components/*.spec.tsx` 是 React 组件测试。当前项目尚未引入真实浏览器 E2E，这也是组件测试不能证明的边界。

#### 8.3 为什么测试数据必须隔离？

**答案：** 测试会故意创建无效数据、重复操作、删除对象并模拟失败，还可能并行和反复运行。指向开发库会污染你的账号、评分和 PDF，指向生产库风险更大。测试必须使用独立数据库、Bucket、端口和可丢弃存储。

**项目 Demo：** `compose.test.yaml` 使用单独服务名、端口和 `tmpfs`；`apps/api/scripts/run-integration-tests.mjs` 注入测试连接并在 `finally` 清理；`vitest.integration.config.ts` 只匹配集成测试文件。

#### 8.4 为什么测试不能只覆盖成功路径？

**答案：** 真实故障往往发生在边界：参数非法、未登录、角色错误、资源不存在、重复提交、数据库断开或 MinIO 失败。只测试“正常点一下成功”无法证明安全与补偿逻辑。每条重要业务规则至少应有一个成功例和关键拒绝例。

**项目 Demo：** `document.service.spec.ts` 覆盖无文件、伪 PDF、数据库失败和文件不存在；`document-api.integration.spec.ts` 覆盖未登录、无权限、上传和签名 URL；前端 `DocumentPanel.spec.tsx` 覆盖只读角色和预览交互。

#### 8.5 测试失败时为什么不能让 AI 直接删除测试或降低断言？

**答案：** 测试像报警器，失败可能说明新代码破坏旧规则。删除测试只是关掉报警器。应先读测试名称、输入、期望和实际结果，判断是实现错误、需求正式改变，还是测试本身不合理；只有需求确认改变时，才同时更新实现、测试和文档。

**项目 Demo：** 每个 `.spec.ts` / `.spec.tsx` 的 `it('...')` 名称说明受保护行为。让 Codex 排错时可以明确要求：“先解释这个断言保护什么，不要先修改代码或测试”。

#### 8.6 为什么高风险改动还要人工检查？

**答案：** 自动测试只覆盖已经写出的场景，可能漏掉浏览器安全策略、真实文件显示、数据重启后是否仍在或生产配置差异。涉及数据、权限、支付、文件和部署时，应在安全环境做针对性人工验证，并保存可复现证据。

**项目 Demo：** 保存评分后重新请求或重启 API，确认 PostgreSQL 中仍有数据；上传后打开签名 URL，确认真实 PDF 可预览；HTTPS 模式用浏览器 Network 检查协议、CSP 和 `/storage`。对应步骤见 `README.md`、`docs/05c-presigned-preview-url.md` 和 `docs/08-nginx-https-security.md`。

“代码能编译”不是完成，“页面能点一下”也不是完整验证。

### 9. Docker、部署、备份与回滚

你不必成为专业运维，但必须保证自己的应用可交付且不伤数据。

#### 9.1 Dockerfile、镜像、容器、Compose 服务和 Volume 分别是什么？

**答案：** Dockerfile 是制作镜像的步骤说明；镜像是包含程序与运行环境的只读模板；容器是镜像启动出的运行实例；Compose 服务描述多个容器如何配置和协作；Volume 是独立于容器生命周期的持久化数据空间。修改 Dockerfile 后要重新构建镜像，镜像存在也不表示容器正在运行。

**项目 Demo：** `apps/api/Dockerfile` 和 `apps/web/Dockerfile` 制作两个镜像；`compose.yaml` 定义四个服务及两个 Volume；运行只读命令 `docker compose ps` 看正在运行的容器，`docker image ls` 看镜像。

#### 9.2 `8080:80` 中宿主机端口和容器端口是什么关系？

**答案：** Compose 端口通常写成 `宿主机端口:容器端口`。`8080:80` 表示用户访问电脑的 8080，Docker 转到 Web 容器内部监听的 80。容器内部软件仍只知道自己监听 80；宿主机端口可按环境调整。

**项目 Demo：** `compose.yaml` 的 Web 默认将 `${WEB_HOST_PORT:-8080}:80` 映射；API、PostgreSQL 和 MinIO 也有学习用映射。`compose.production.yaml` 只公开 Web 的 80/443，不直接公开内部 API、数据库和 MinIO。

#### 9.3 为什么 Compose 容器间使用服务名，不能都写 `localhost`？

**答案：** 每个容器都有自己的网络空间。在 API 容器中，`localhost` 指 API 容器自己，不是 PostgreSQL 容器。Compose 网络提供内部 DNS，把服务名 `postgres`、`minio`、`api` 解析到相应容器。

**项目 Demo：** `compose.yaml` 中 API 的 `DATABASE_URL` 使用 `postgres:5432`，MinIO 地址使用 `minio:9000`；`apps/web/nginx.conf` 把 `/api` 转发到 `api:3000`。宿主机开发进程才使用 `localhost:5432`。

#### 9.4 `docker compose ps`、`logs`、`up -d` 和 `down` 分别做什么？

**答案：** `ps` 查看服务状态、健康和端口；`logs` 查看运行输出与错误；`up -d` 创建或更新服务并在后台运行；`down` 停止并删除该 Compose 项目的容器和网络，默认保留命名 Volume。加 `--build` 会先重建镜像，加 `-v` 会删除 Volume，风险完全不同。

**项目 Demo：** 根 `package.json` 把常用长命令封装为 `infra:up`、`stack:up`、`stack:down` 和 `stack:logs`；`README.md` 给出启动、停止和排错顺序。

#### 9.5 Nginx 为什么叫统一入口，它负责什么？

**答案：** 用户只访问一个域名和 80/443 端口。Nginx 返回 React 静态文件，把 `/api` 转给 NestJS，把 `/storage` 转给 MinIO，并可负责 HTTPS、安全响应头和上传大小的入口限制。用户不需要知道内部容器地址。

**项目 Demo：** `apps/web/nginx.conf` 是普通 HTTP 模式；`apps/web/nginx.https.conf` 增加本地 HTTPS 与存储代理；`deploy/nginx.production.conf` 是生产入口配置。

#### 9.6 为什么健康检查通过仍不代表完整业务可用？

**答案：** 健康检查通常只探测一个轻量地址或进程，能发现服务未启动，却不一定覆盖登录、权限、数据库写入、MinIO 上传和 PDF 预览。Web 返回 `ok` 时，API 仍可能配置错误；API 健康时，某项业务规则仍可能有 Bug。

**项目 Demo：** `compose.yaml` 为四个服务定义 `healthcheck`；API 的探针访问 `/api/health`，Web 访问 `/healthz`。发布后还要按照 `README.md` 和 `docs/09-ci-cd-backup-rollback.md` 做登录、评分、上传、预览等冒烟检查。

#### 9.7 CI、镜像仓库和生产服务器如何分工？

**答案：** CI 在干净环境安装依赖，执行类型检查、测试和构建；检查通过后把 API/Web 镜像推送到镜像仓库；生产服务器只拉取被批准的镜像并运行。这样服务器运行的是经过验证的制品，而不是现场重新构建一份可能不同的结果。

**项目 Demo：** `.github/workflows/ci.yml` 是 GitHub Actions 工作流；GHCR 保存镜像；`compose.production.yaml` 使用 `API_IMAGE`、`WEB_IMAGE` 拉取指定镜像。当前项目保留人工确认上线，没有自动连接真实服务器。

#### 9.8 为什么使用不可变 SHA 版本并记录上一版？

**答案：** `latest` 会随着新构建移动，无法可靠说明某天线上运行了什么。`sha-a1b2c3d` 对应确定 Git 提交，内容可追踪。发布前记录当前 API/Web SHA，新版本失败时把环境变量改回上一 SHA，再 `pull` 和 `up -d`，才能准确回滚。

**项目 Demo：** `.github/workflows/ci.yml` 生成 `sha-*` 镜像标签；`.env.production.example` 展示固定 SHA 的写法；`docs/09-ci-cd-backup-rollback.md` 给出发布与应用回滚步骤。

#### 9.9 为什么应用回滚不会自动撤销迁移，数据库恢复又为何是独立高风险操作？

**答案：** 应用回滚只是把 API/Web 容器换回旧代码，PostgreSQL 与 MinIO Volume 会保留。新版启动时如果已经改变数据库结构，切回旧代码不会让表自动变回去，旧代码还可能不兼容新结构。数据库恢复则会把数据退到旧时间点，可能覆盖恢复点之后的新评分和文件，因此必须单独审批和确认损失范围。

**项目 Demo：** `apps/api/Dockerfile` 启动时先执行 `prisma migrate deploy`；`compose.production.yaml` 把应用镜像和数据 Volume 分开；`docs/09-ci-cd-backup-rollback.md` 分别讲应用回滚与数据库恢复。生产迁移应尽量设计为新旧应用暂时兼容。

#### 9.10 为什么备份必须校验、异机保存并定期隔离恢复？

**答案：** 脚本显示成功或文件存在，不代表内容完整；校验和与 `pg_restore --list` 可发现损坏。备份和生产数据在同一硬盘时无法防止整盘损坏、勒索软件或服务器丢失，所以要复制到独立位置。最终还要定期恢复到隔离环境并实际检查登录、评分和 PDF，才能证明团队真的能恢复。

**项目 Demo：** `scripts/create-backup.mjs` 导出 PostgreSQL、镜像 MinIO 并记录 SHA-256；`scripts/verify-backup.mjs` 做只读校验；根 `package.json` 提供 `backup:create` 和 `backup:verify`。项目故意不提供“一键覆盖当前数据库”，避免初学时误恢复生产数据。

你可以让 AI 编写 Dockerfile、Compose 和 CI，但必须让它说明公开了哪些端口、挂载了哪些数据、需要哪些 Secret，以及失败时如何回退。

## 五、Git 是使用 AI 开发的安全网

AI 修改速度很快，没有 Git 就很难区分哪些是你的原代码、哪些是本次改动。

你必须会：

- 使用 `git status` 和 `git diff` 查看改了什么。
- 提交前确认没有密码、Token、私钥、备份和大文件。
- 一次提交只表达一个清晰目的，提交信息说明“为什么改”。
- 知道未提交改动属于谁，不能随便覆盖或清理。
- 使用分支和 Pull Request 让 CI 与他人审查改动。
- 回退应用版本时优先部署旧镜像，不随意对源码执行破坏性重置。

不会复杂的 rebase 没关系，先做到每次 AI 工作前后都能看懂 diff。

## 六、哪些事情可以放心让 AI 多做

在边界明确、可验证的情况下，可以让 Codex承担：

- 搜索代码、梳理调用链和解释陌生文件。
- 生成 Controller、DTO、Service 等重复结构。
- 根据已确认的业务规则实现代码。
- 编写单元测试、集成测试和测试数据工厂。
- 修改 Dockerfile、Compose、Nginx 和 CI 配置。
- 根据完整日志提出排查顺序。
- 编写 README、接口说明、部署和回滚手册。
- 执行无破坏性的类型检查、测试、构建、配置检查和只读查询。

AI 最擅长的是快速实现、搜索、对照和重复验证。你负责定义正确性和风险边界。

## 七、哪些决定不能直接交给 AI

以下问题必须由你、业务方或有权限的负责人确认：

- 需求的真正含义和验收标准。
- 角色能查看、修改哪些业务数据。
- 哪些数据可以删除、保留多久、是否涉及隐私或合规。
- 是否允许修改生产环境、停止服务或开放公网端口。
- 数据库迁移的停机窗口和可接受风险。
- RPO、RTO、备份保留周期和恢复时间点。
- 域名、证书、云资源、生产 Secret 和访问授权。
- 一个失败是否允许忽略，还是必须阻止上线。

AI 没有这些组织背景。它即使生成了技术上可执行的方案，也不代表获得了操作授权。

## 八、以后和 Codex 协作的标准流程

### 第 1 步：把目标和边界说清楚

不要只说“做个登录”。更好的表达是：

```text
请先检查当前项目的登录实现。目标是增加只读角色，专家可以评分，只读角色只能查看。
不要修改现有数据库数据，不要连接外部环境。先告诉我请求链路、涉及文件、数据库变化和风险，再实现并测试。
我是 NestJS 初学者，请解释每个框架部件为什么存在。
```

### 第 2 步：先让 AI 建立证据

适合先说：

```text
先只读检查，不要修改。告诉我当前请求从 React 到数据库经过哪些文件，并引用具体路径。
```

这样可以防止在没理解现状时直接重写。

### 第 3 步：要求小步实现

一次只改一个可验证目标，例如先增加数据库字段和迁移，再增加 API，最后改页面。大改动应要求 AI 汇报：

- 修改了哪些文件；
- 为什么这样设计；
- 是否改变 API 或数据库；
- 有哪些失败路径；
- 准备用什么验证。

### 第 4 步：要求分层验证

可以使用下面的提示：

```text
完成后依次做类型检查、相关单元测试、集成测试和构建。说明每项验证证明了什么、没有证明什么。不要为了通过而删除测试或降低断言。
```

### 第 5 步：要求“教回给我”

让 AI 按你的基础解释：

```text
假设我只会 React。请按一次真实请求的时间顺序解释本次后端代码，每次只引入一个新概念，并给我两个自测问题。
```

如果你不能用自己的话复述“数据从哪来、经过哪里、写到哪里、谁有权限”，说明这项改动还没有真正交接给你。

### 第 6 步：自己检查 diff 和高风险点

至少问自己：

1. AI 有没有修改任务之外的文件？
2. 有没有写死密码、Token、IP 或生产地址？
3. 有没有删除迁移、数据、Volume 或用户文件？
4. 后端有没有相信前端传入的身份和关键业务值？
5. 错误是否被悄悄吞掉或总是返回成功？
6. 测试是否使用隔离环境？
7. 上线失败时如何退回？

## 九、接受 AI 代码前的最低检查清单

### 普通前后端功能

- [ ] 我能说清输入、输出和业务规则。
- [ ] 后端对请求做了 DTO 校验和业务校验。
- [ ] 身份从可信认证信息获得，而不是请求体。
- [ ] 页面错误、API 错误和日志不会泄露 Secret。
- [ ] 正常和关键失败路径有测试。
- [ ] 类型检查、测试和构建通过。

### 数据库改动

- [ ] 我读过 Prisma Schema 和生成的迁移 SQL。
- [ ] 我知道是否加列、删列、改类型、加唯一约束或更新已有数据。
- [ ] 迁移不会意外指向错误环境。
- [ ] 生产执行前已有可验证备份。
- [ ] 我知道新旧应用是否都能兼容迁移后的结构。

### 文件和对象存储改动

- [ ] 文件大小、类型、名称和权限都经过后端检查。
- [ ] 数据库记录与对象失败时有清理或补偿思路。
- [ ] 预签名 URL 有合理过期时间，不进入日志。
- [ ] 数据库和对象文件都在备份范围内。

### 部署或运维改动

- [ ] 我知道命令针对本地、测试还是生产。
- [ ] 生产地址、账号和授权由负责人确认。
- [ ] 数据库、MinIO 和 API 没有无意暴露到公网。
- [ ] 使用确定的镜像 SHA，而不是仅依赖 `latest`。
- [ ] 发布前有备份，发布后有健康与业务检查。
- [ ] 已记录上一版和回滚步骤。

## 十、每项工具到底学到什么程度

| 工具 | 当前必须掌握 | 可以让 AI 代劳或以后再学 |
| --- | --- | --- |
| Node.js | 启动脚本、环境变量、异步错误、浏览器与服务端区别 | 事件循环内部实现、原生扩展 |
| NestJS | Module/Controller/DTO/Guard/Service 请求链路 | 框架源码、高级动态模块 |
| Prisma | Schema、查询、关系、迁移 dev/deploy、检查 SQL | Client 生成器内部原理 |
| PostgreSQL | 表、键、约束、基础 SQL、事务、备份恢复风险 | 查询优化器内部、复制与分片 |
| MinIO | Bucket、Object Key、预签名 URL、权限和双份备份 | S3 协议底层、集群运维 |
| Docker | 镜像、容器、端口、网络、Volume、Compose、日志 | 镜像运行时底层、复杂集群调度 |
| Nginx | 静态页面、反向代理、HTTPS、请求大小和安全头 | 模块开发、复杂性能调优 |
| GitHub Actions | 触发条件、检查步骤、Secret、镜像产物、失败定位 | 自建 Runner、大型流水线平台治理 |

“掌握”不是独立从零手写，而是能读懂 AI 的修改、发现明显风险、提供正确上下文并完成验证。

## 十一、现在可以暂时不学什么

在当前单体项目还没有真实需求前，可以暂缓：

- Kubernetes 和复杂容器编排；
- 微服务拆分、服务注册和分布式事务；
- Redis、消息队列和搜索引擎；
- 高并发架构、分库分表和多地域容灾；
- 手写加密算法或认证协议；
- PostgreSQL 内核、Node.js 运行时内部源码；
- 非常复杂的设计模式和抽象层。

这些技术不是不重要，而是过早学习会让你只记名词。等当前项目出现明确问题，例如查询慢、任务需要异步处理或单机无法承载，再学习对应工具。

## 十二、基于当前项目的推荐学习顺序

不要重新从第 1 课背到第 9 课。用现有项目做以下五轮练习：

### 第一轮：只追踪，不写代码

从页面的“保存评分”按钮开始，自己画出 React API 文件、NestJS Controller、Guard、DTO、Service、Prisma 和 PostgreSQL 的顺序。再让 Codex 检查你的理解。

完成标准：你能指出每一层负责什么，身份和分数分别从哪里来。

### 第二轮：做一个很小的字段改动

例如给评审项增加一个可选说明字段。让 Codex先解释数据模型、迁移、DTO、Service、前端和测试的影响，再逐步实现。

完成标准：你能读迁移 SQL，知道旧数据会是什么值，并能验证保存后重启仍存在。

### 第三轮：故意制造并排查故障

在本地临时写错 API 端口、数据库端口或 MinIO Bucket，每次只改一个地方。先根据浏览器 Network 和日志判断故障层，再让 Codex验证。实验后恢复配置。

完成标准：你不会一看到“页面失败”就直接改 React。

### 第四轮：写测试保护规则

选择“只读角色不能评分”这条规则，让 Codex先讲测试类型，再补一个后端测试和一个前端测试。

完成标准：你能解释两个测试各自证明什么，以及为什么不能互相替代。

### 第五轮：模拟发布与回滚

只在本地执行备份、构建镜像、Compose 启动、健康检查和应用镜像回滚，不连接真实服务器。

完成标准：你知道哪些数据在 Volume，容器替换后为什么仍存在，什么时候绝不能使用 `down -v`。

## 十三、给未来课程和 Codex 的固定要求

你可以在每次“继续下一课”时附上这段话：

```text
我是前端转全栈初学者，主要通过 AI 开发。请不要假设我了解新的后端或运维术语。
先用一次真实请求说明本课解决什么问题，再逐文件解释职责。
每引入一个新概念，都说明它是什么、为什么需要、不使用会怎样、如何验证。
实现要小步进行，不接触生产环境，不破坏现有数据。
最后给我动手实验、自测题，以及 AI 可以代劳和我必须亲自判断的边界。
```

后续课程应遵循：先讲系统位置，再讲代码；先讲风险，再执行命令；不仅报告“通过”，还说明验证覆盖了什么。

## 十四、真正的毕业标准

你不需要变成“不使用 AI 也能默写整个系统”的开发者。对一个中小型全栈项目，达到下面状态就已经具备独立交付的基础：

- 能把业务需求转换成前端、API、权限、数据和异常规则。
- 能借助 AI 找到并解释完整请求链路。
- 能读懂数据库迁移，避免明显的数据破坏。
- 能设计最小但有效的单元、集成和业务验证。
- 能用 Docker 在新环境重复启动系统。
- 能根据 Network、日志和数据库证据定位故障层。
- 能识别 Secret、越权、输入校验和文件访问风险。
- 能制定发布、备份、验证与应用回滚步骤。
- 不确定时会停止高风险操作，向业务或运维确认，而不是让 AI 猜。

AI 会让你少写很多样板代码，但不会替你承担系统后果。你的核心能力不是“记住更多命令”，而是建立正确的系统模型、提出好问题、控制风险并用证据验收结果。
