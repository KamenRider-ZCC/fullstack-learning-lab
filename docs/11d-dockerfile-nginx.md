# 第 11D 课：Dockerfile、生产镜像与最小 Nginx

本课分三段：Web 多阶段镜像、Nginx 请求处理、API 生产镜像。每次只学习一段。

## 第一段：开发模式和生产模式不同

当前开发模式：

```text
React/TypeScript 源码
→ Vite 开发服务器实时编译
→ Windows node.exe 监听 5173
```

生产模式：

```text
React/TypeScript 源码
→ pnpm build
→ dist 中的 HTML/CSS/JS 静态文件
→ Nginx 在容器 80 端口提供文件
```

生产 Web 容器不需要运行 Vite，也不需要在浏览器请求时重新编译 TypeScript。

## 第二段：Dockerfile 是按顺序执行的制作说明

文件：`apps/web/Dockerfile`

```dockerfile
FROM node:22-alpine AS build

WORKDIR /workspace

COPY package files ...
RUN pnpm install ...
COPY apps/web ./apps/web
RUN pnpm ... build

FROM nginx:1.27-alpine

COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
CMD ["nginx", "-g", "daemon off;"]
```

上面是便于理解的缩写，阅读真实文件时仍以实际代码为准。

Dockerfile 不是容器启动清单。它描述如何一层层制作一个镜像，`docker build` 执行这些步骤。

## 第三段：为什么有两个 FROM

真实文件中有两个阶段：

```text
build 阶段
基础镜像：node:22-alpine
用途：安装 pnpm 和依赖，把 React/TypeScript 构建成 dist

最终运行阶段
基础镜像：nginx:1.27-alpine
用途：只复制 dist 和 Nginx 配置，负责返回静态文件
```

这叫多阶段构建。最终镜像不会自动包含 build 阶段的完整 Node.js、源码和开发依赖，所以通常更小、攻击面也更少。

`AS build` 给第一个阶段起名；后面的 `COPY --from=build` 从这个阶段取构建产物。

## 第四段：WORKDIR、COPY 与 RUN

```dockerfile
WORKDIR /workspace
```

设置后续命令在镜像里的工作目录，不是修改 Windows 当前目录。

```dockerfile
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install ...
```

先只复制依赖清单再安装，源码没变化但业务代码变化时，Docker 更有机会复用依赖安装缓存。

```dockerfile
COPY apps/web ./apps/web
RUN pnpm --filter @fullstack-lab/web run build
```

再复制 Web 源码并运行 Vite 生产构建，生成 `apps/web/dist`。

`COPY` 在制作镜像时复制文件，`RUN` 在制作镜像时执行命令；它们不是用户每次打开网页时执行。

## 第五段：最终镜像为什么不运行 Node.js

```dockerfile
FROM nginx:1.27-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
```

最终阶段只需要：

- Nginx 程序。
- Nginx 配置。
- 已经构建好的静态文件。

浏览器运行 JavaScript，Nginx 只负责把文件传给浏览器并代理 API。

## 第六段：EXPOSE 和 CMD

```dockerfile
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- `EXPOSE 80`：声明镜像中的程序预计监听 80，主要是元数据；它不会自动把端口发布到 Windows。
- Compose 的 `8080:80`：才负责把 Windows 8080 映射到容器 80。
- `CMD`：容器启动时默认运行的主要命令。
- `daemon off;`：让 Nginx 留在前台，Docker 才能用这个主要进程判断容器是否还在运行。

如果主要进程退出，容器也会进入 Exited 状态。

## 第七段：AI 开发必须检查什么

AI 可以编写 Dockerfile，但你必须确认：

1. 基础镜像来源和版本是否明确。
2. 构建阶段是否真的执行依赖安装、代码检查和生产构建。
3. 最终阶段是否只带运行必需内容，没有复制 `.env`、密钥或整个工作目录。
4. `COPY --from` 的构建产物路径是否正确。
5. `CMD` 是否启动真正的前台服务。
6. 镜像能构建成功，并能通过实际容器健康检查。

不要求背 Dockerfile 指令参数或独立优化镜像层。

## 第一阶段只读实验

运行：

```powershell
docker image inspect fullstack-learning-lab-web:local --format '{{json .Config.ExposedPorts}}'
docker image inspect fullstack-learning-lab-web:local --format '{{json .Config.Cmd}}'
docker history fullstack-learning-lab-web:local
```

这些命令只读取已经构建好的镜像，不创建或删除容器。

回答：

1. 第一阶段为什么需要 Node.js，最终阶段为什么不需要？
2. 最终镜像中实际复制了哪两类项目文件？
3. `EXPOSE 80` 是否等于 Windows 已经可以通过 80 端口访问？真正的主机端口在哪里配置？
4. 镜像中记录的默认 `CMD` 是什么？它和容器生命周期有什么关系？
5. `docker history` 能看到复制 Nginx 配置和 `dist` 的层吗？为什么最终镜像历史中看不到 Node.js build 阶段的安装与构建层？

第一阶段已完成。最终镜像只保留 Nginx、Nginx 配置和 `dist`；`EXPOSE` 是镜像元数据，实际监听由 Nginx 决定，主机映射由 Compose 决定。

## 第八段：Nginx 在当前项目中的职责

生产 Web 容器里的 Nginx 负责四件事：

```text
1. 返回 React 构建后的 HTML、CSS、JavaScript
2. 把 /api 请求转发给 NestJS
3. 为 React 单页路由返回 index.html
4. 提供只检查 Nginx 自身的 /healthz
```

它不执行业务 Service，不直接查询 PostgreSQL，也不保存 MinIO 文件。

## 第九段：server 和静态文件目录

```nginx
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;
}
```

- `server`：一组 HTTP 请求处理规则。
- `listen 80`：Nginx 真正在容器内监听 80。
- `server_name _`：本地课程接受没有专门匹配域名的请求。
- `root`：静态文件根目录，Dockerfile 正好把 `dist` 复制到这里。
- `index`：访问目录时默认寻找 `index.html`。

Dockerfile 和 Nginx 配置在此处连接：

```text
COPY dist → /usr/share/nginx/html
root      → /usr/share/nginx/html
```

路径不一致时，Nginx 进程可能仍能启动，但页面会找不到。

## 第十段：location 根据 URL 选择处理方式

当前配置有三类 location：

```nginx
location /api/ { ... }
location = /healthz { ... }
location / { ... }
```

可以先这样理解：

- 请求路径以 `/api/` 开头：使用 API 代理规则。
- 请求路径正好等于 `/healthz`：使用健康检查规则；`=` 表示精确匹配。
- 其他路径：进入通用 `/` 静态页面规则。

不用背 Nginx 的完整匹配优先级，只需要能判断当前三个明确入口。

## 第十一段：反向代理 /api

```nginx
location /api/ {
  proxy_pass http://api:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_read_timeout 60s;
}
```

请求流程：

```text
浏览器请求 http://localhost:8080/api/documents
→ Windows 8080 映射到 Web 容器 80
→ Nginx 匹配 /api/
→ Compose DNS 将 api 解析到 API 容器
→ Nginx 转发到 api:3000/api/documents
→ NestJS 返回响应
→ Nginx 把响应交还浏览器
```

这里的 `api` 是 Compose 服务名。`proxy_pass` 当前没有在地址末尾添加 `/` 路径，因此会保留原始 `/api/...`，与 NestJS 全局 `/api` 前缀对应。

`X-Real-IP`、`X-Forwarded-For` 和 `X-Forwarded-Proto` 用于告诉后端原始客户端、代理链和协议。需要理解目的，不要求背变量名称。

`proxy_read_timeout 60s` 表示等待后端响应的时间边界之一。它不是要求所有 API 都应该执行 60 秒。

## 第十二段：SPA fallback

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

Nginx 按顺序尝试：

```text
1. 查找与 URL 对应的真实文件
2. 查找与 URL 对应的目录
3. 都没有则返回 /index.html
```

例如用户刷新 `/review/123`：磁盘中通常没有名为 `/review/123` 的文件。如果直接返回 404，React Router 没机会运行；返回 `index.html` 后，浏览器加载 React，再由前端路由解释 `/review/123`。

这就是 SPA fallback。即使当前演示页路由很少，生产 React 单页应用通常仍需要它。

## 第十三段：/healthz 只检查 Web 容器

```nginx
location = /healthz {
  access_log off;
  add_header Content-Type text/plain;
  return 200 "ok\n";
}
```

它不请求 NestJS，而是由 Nginx 直接返回 200。作用是快速判断 Nginx 进程和配置是否还能响应。

因此：

```text
/healthz = 200
≠ /api 正常
≠ PostgreSQL 正常
≠ MinIO 正常
```

## 第十四段：请求大小和安全响应头

```nginx
client_max_body_size 11m;
```

Nginx 最多接受约 11 MB 的请求体；后端仍有自己的 10 MB 文件业务限制。多一层边界可以尽早拒绝明显过大的请求，11 MB 也给 multipart 请求的额外内容留出少量空间。

```nginx
server_tokens off;
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy strict-origin-when-cross-origin always;
add_header X-Frame-Options SAMEORIGIN always;
```

这些配置减少版本信息和部分浏览器风险。`SAMEORIGIN` 表示页面通常只能被同源页面通过 iframe 嵌入；如果产品需要跨站 iframe，必须结合真实域名重新设计 CSP 和嵌入策略，不能只为“能打开”而随意移除防护。

## Nginx 阶段练习

不用启动 Docker Web，根据配置判断下面请求走哪条规则、最终交给谁：

1. `GET /assets/index.js`
2. `GET /review/123`
3. `PUT /api/review-items/review-progress-plan/score`
4. `GET /healthz`

再回答：

5. 为什么 `/healthz` 返回 200 不能证明评分接口正常？
6. 如果 Nginx 写成 `listen 81`，但 Compose 仍是 `8080:80`，访问为什么失败？
7. 如果把 `client_max_body_size` 改为 `1m`，上传 5 MB PDF 时，请求会先到 NestJS 吗？

Nginx 阶段已完成，配置也已通过镜像内的 `nginx -t` 语法检查。

## 第十五段：API 为什么最终仍需要 Node.js

Web 构建后得到浏览器可以直接执行的 HTML、CSS、JavaScript，最终由 Nginx 传输文件。

NestJS 构建后得到 `dist` 中的服务端 JavaScript，但它仍需要 Node.js 在服务器上持续执行、监听端口和处理请求：

```text
Web：TypeScript → 静态 dist → Nginx 返回文件
API：TypeScript → 服务端 dist → Node.js 持续执行
```

所以 API 最终镜像使用 `node:22-alpine`，Web 最终镜像使用 `nginx:1.27-alpine`。

## 第十六段：API Dockerfile 的四个阶段

```text
base
├─ 准备 Node.js、pnpm、OpenSSL 和工作目录
├─ build：安装完整依赖，生成 Prisma Client，编译 TypeScript
└─ production-dependencies：只安装生产依赖，生成生产所需 Prisma Client

runtime
└─ 复制生产依赖、Prisma Schema/迁移和编译后的 dist
```

`base` 被两个中间阶段复用，避免重复编写准备 pnpm 的步骤。最终 `runtime` 重新从干净的 Node.js 镜像开始，不会自动继承完整构建环境。

## 第十七段：build 阶段

```dockerfile
FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @fullstack-lab/api...

COPY apps/api apps/api
RUN pnpm --filter @fullstack-lab/api db:generate \
  && pnpm --filter @fullstack-lab/api build
```

它安装包含开发工具的完整依赖，然后：

```text
prisma generate → 根据 schema.prisma 生成类型化 Prisma Client
TypeScript build → 把 src 编译到 dist
```

`prisma generate` 不会修改数据库结构；数据库迁移是另一条命令。

## 第十八段：production-dependencies 阶段

```dockerfile
FROM base AS production-dependencies

RUN pnpm install --frozen-lockfile --prod --filter @fullstack-lab/api...
COPY apps/api/prisma apps/api/prisma
RUN pnpm --filter @fullstack-lab/api exec prisma generate
```

`--prod` 只安装运行 API 所需的生产依赖，排除 Vitest、TypeScript 编译器等开发依赖。Prisma Client 还需要根据 Schema 生成，因此这一阶段也复制 `prisma` 目录并执行 generate。

把“编译代码”和“准备生产依赖”分开，最终阶段可以只拿两边真正需要的结果。

## 第十九段：runtime 最终阶段复制什么

```dockerfile
FROM node:22-alpine AS runtime

COPY --from=production-dependencies ...node_modules...
COPY --from=production-dependencies ...package.json...
COPY --from=production-dependencies ...prisma...
COPY --from=build ...dist...
```

最终镜像主要包含：

- Node.js 和 OpenSSL。
- 生产依赖与生成的 Prisma Client。
- Prisma Schema 和迁移文件。
- 编译后的 `dist`。

它没有主动复制 `.env`、测试、TypeScript 源码和前端源码。

根目录 `.dockerignore` 还会让构建上下文排除 `.env`、`node_modules`、`dist`、证书和备份等内容，减少误把本机依赖或敏感文件送入构建过程的风险。

## 第二十段：为什么使用非 root 用户

```dockerfile
WORKDIR /workspace/apps/api
USER node
```

容器内应用以镜像自带的普通 `node` 用户运行，而不是 Linux root。即使应用被利用，攻击者默认获得的容器权限也更小。

这不是完整安全方案，但属于生产镜像应具备的最小权限原则。

## 第二十一段：启动时先迁移再运行 API

```dockerfile
EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
```

容器启动顺序：

```text
prisma migrate deploy
→ 应用仓库中已有的正式迁移
→ 成功后 exec node dist/main.js
→ NestJS 开始监听 3000
```

`&&` 表示迁移成功才启动 API；迁移失败时 Node.js 不会启动，容器会退出。`exec` 让 Node.js 接替 shell 成为主要进程，以便正确接收 Docker 的停止信号。

`migrate deploy` 只应用已经提交的迁移，适合部署；`migrate dev` 用于开发阶段创建迁移，不能在生产容器启动时使用。

学习项目把迁移放在容器启动命令中便于演示。真实多实例生产系统需要团队确认迁移由独立发布步骤还是应用启动执行，尤其要评估破坏性变更和锁表风险。

## API Dockerfile 阶段练习

运行：

```powershell
docker image inspect fullstack-learning-lab-api:local --format '{{json .Config.ExposedPorts}}'
docker image inspect fullstack-learning-lab-api:local --format '{{json .Config.Cmd}}'
docker image inspect fullstack-learning-lab-api:local --format '{{json .Config.User}}'
docker history --format '{{.CreatedBy}} | {{.Size}}' fullstack-learning-lab-api:local | Select-Object -First 12
```

这些命令只读取现有镜像，不启动 API，因此不会与本机 3000 端口冲突。

回答：

1. 为什么 Web 最终镜像不需要 Node.js，而 API 最终镜像需要？
2. `build` 与 `production-dependencies` 两个阶段分别产出什么？
3. 最终镜像为什么需要 Prisma 目录，却不需要 TypeScript 源码？
4. `.dockerignore` 排除 `.env` 和本机 `node_modules` 分别防止什么问题？
5. 镜像以哪个用户运行？为什么不用 root 更合适？
6. `CMD` 中数据库迁移失败时，NestJS 是否还会启动？容器会怎样？

完成后，第 11D 课结束。

整体关系可配合阅读：[`11d-docker-web-api-nginx-map.md`](./11d-docker-web-api-nginx-map.md)。
