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

完成后进入 Nginx 的静态文件、反向代理、SPA fallback 和健康检查。
