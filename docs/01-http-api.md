# 第 1 课：一次请求如何完成

## 本课目标

点击前端按钮后，请求后端 `GET /api/health`，并把返回结果展示出来。

## 请求路径

```text
React 页面
  → fetch('/api/health')
  → Vite 开发代理
  → http://localhost:3000/api/health
  → NestJS Controller
  → Service 生成数据
  → JSON 响应
  → React 更新页面
```

## 为什么使用开发代理

浏览器打开的是 `localhost:5173`，后端运行在 `localhost:3000`。开发代理让前端始终请求相对地址 `/api`，减少跨域问题，也避免把开发服务器地址写进组件。

相关文件：

- `apps/web/vite.config.ts`：将 `/api` 转发到后端。
- `apps/web/src/api/health.ts`：发出 HTTP 请求。
- `apps/api/src/health/health.controller.ts`：接收请求。
- `apps/api/src/health/health.service.ts`：产生响应数据。

Controller 通过构造函数取得 Service，这叫“依赖注入”。项目使用 `tsx` 运行 TypeScript，因此示例用 `@Inject(HealthService)` 明确告诉 NestJS 要注入哪个服务。

## 动手练习

1. 启动项目，观察成功状态。
2. 停止后端，再点击“重新请求”，观察错误状态。
3. 给后端响应增加 `version` 字段。
4. 修改前端类型并把版本展示出来。

完成标准：你能不看代码解释请求经过了哪些部分，以及任何一部分停止后会发生什么。
