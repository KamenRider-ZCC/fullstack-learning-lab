# 第 6C 课：React 组件测试与关键交互

第 6A 课测试单个后端业务单元，第 6B 课测试真实 API、数据库和对象存储。本课回到浏览器这一侧：在 Node.js 中渲染 React 组件，像用户一样点击、选择文件并观察界面。

本课不会启动真正的浏览器，也不会请求 NestJS、PostgreSQL 或 MinIO。API 模块会被 Mock 替换，因此测试快、稳定，适合每次修改代码后运行。

## 1. 本课完成了什么

- 为 React 项目配置 Vitest 和 jsdom。
- 使用 Testing Library 从用户视角查找和操作页面元素。
- 测试登录账号切换、提交中状态和失败提示。
- 测试角色对上传权限的影响。
- 使用内存中的 `File` 测试 PDF 选择和上传。
- 测试文件列表、签名 URL、iframe 预览和关闭预览。
- 隔离真实 API，并检查组件传给 API 的参数。
- 让根目录的 `pnpm test` 同时运行前后端快速测试。

运行：

```powershell
cd D:\projects\fullstack-learning-lab
pnpm test
```

当前结果：后端 4 个文件、20 个单元测试通过；前端 2 个文件、9 个组件测试通过。

## 2. 先分清三种测试

| 类型 | 本项目例子 | 真实程度 | 速度 | 主要发现的问题 |
| --- | --- | --- | --- | --- |
| 单元测试 | `DocumentService` 配合 Mock | 较低 | 最快 | 分支、参数和业务规则 |
| 组件测试 | `LoginCard` 渲染到 jsdom | 中等 | 快 | 页面状态、文字、按钮和交互 |
| E2E 测试 | 真浏览器完成登录到预览 | 最高 | 较慢 | 浏览器、前后端和基础设施整条链路 |

组件测试比只调用一个函数更接近用户，但它仍不是 E2E。这里的登录请求是假的，iframe 也不会真正加载 PDF。

可以把本课理解为：

```text
React 组件 → jsdom 中的页面元素
          → Mock API
          → Testing Library 模拟用户并观察结果
```

## 3. jsdom 是什么

Vitest 默认运行在 Node.js 中，而 Node.js 没有 `document`、`button`、`input` 或浏览器事件。jsdom 在内存中模拟这些 Web API，让 React 可以把组件渲染成 DOM。

它适合验证：

- 页面有没有某段文字或某个按钮。
- 输入框值有没有变化。
- 按钮是否禁用。
- 点击后是否出现 iframe。
- iframe 的 `src` 是否是后端返回的地址。

它不擅长验证：

- 元素最终显示在屏幕上的像素位置。
- CSS 是否真的完成布局、动画和换行。
- PDF 是否被浏览器插件正确渲染。
- 浏览器网络策略、CORS、下载和真实 iframe 页面。

因此不要因为 jsdom 测试通过，就断言页面视觉效果一定正确。视觉和真实浏览器链路以后用人工验证或 E2E 测试补上。

## 4. 安装的五个测试依赖

`apps/web/package.json` 新增了：

| 依赖 | 作用 |
| --- | --- |
| `vitest` | 发现测试、运行用例、Mock 和输出结果 |
| `jsdom` | 在 Node.js 中模拟 DOM |
| `@testing-library/react` | 渲染 React，并按用户视角查询 DOM |
| `@testing-library/user-event` | 模拟点击、输入和选择文件 |
| `@testing-library/jest-dom` | 提供易读的 DOM 断言 |

虽然名称是 jest-dom，它也支持 Vitest。本项目通过专用入口 `@testing-library/jest-dom/vitest` 接入。

## 5. Vitest 配置逐项解释

文件：`apps/web/vitest.config.ts`。

```ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    setupFiles: ["./src/test/setup.ts"],
    clearMocks: true,
  },
});
```

- `plugins: [react()]`：让测试使用与 Vite 项目一致的 React JSX 转换。
- `environment: "jsdom"`：每个测试文件拥有模拟浏览器环境。
- `include`：只把 `src` 下的 `*.spec.ts` 和 `*.spec.tsx` 当成测试。
- `setupFiles`：每个测试文件执行前加载公共测试初始化。
- `clearMocks`：用例之间清空 Mock 的调用历史，避免上一个用例的调用次数影响下一个。

`clearMocks` 只清调用记录，不一定清除人为配置的返回值，所以测试文件仍会在 `beforeEach` 中使用 `mockReset()` 明确恢复初始状态。

## 6. 公共 setup 为什么需要 cleanup

文件：`apps/web/src/test/setup.ts`。

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
```

第一行注册 DOM 专用断言。后三行表示每个用例结束后卸载 React 组件并清空测试 DOM。

如果不清理，第一个用例留下的“登录”按钮可能被第二个用例查到，导致测试单独运行通过、一起运行失败。每个测试都应从空页面开始。

## 7. Testing Library 的核心理念

测试应尽量通过用户能感知的信息找元素，而不是依赖组件内部实现。

优先级通常是：

1. `getByRole`：按语义角色和可访问名称查询。
2. `getByLabelText`：按表单标签查询输入控件。
3. `getByText`：按用户看到的文字查询。
4. 必要时才使用 `data-testid`。

例如：

```ts
screen.getByRole("button", { name: "登录并获取 Token" });
screen.getByLabelText("用户名");
screen.getByText("投标文件.pdf");
```

不建议使用 `.rounded-lg > button:nth-child(2)`。CSS 类名和 DOM 层级调整后用户体验可能完全没变，但这种测试会无意义地失败。

## 8. render、screen 和 userEvent

### render

```ts
render(<LoginCard onLogin={onLogin} />);
```

它把组件挂载到 jsdom。传入的 Props 就是本场景的初始条件。

### screen

`screen` 代表当前测试页面。它比保存 `render()` 返回值更容易阅读，也符合“用户正在整个页面中寻找元素”的视角。

### userEvent

```ts
const user = userEvent.setup();
await user.click(button);
await user.upload(input, file);
```

一次真实点击可能包含聚焦、鼠标事件和点击事件。`userEvent` 会模拟这组交互，通常比直接调用元素的 `click()` 更接近用户操作。

它的大部分方法是异步的，所以要写 `await`。漏掉 `await` 可能导致断言先执行，界面状态还没更新。

## 9. getBy、findBy 和 queryBy 的区别

这三个前缀非常重要：

| 查询 | 找到时 | 暂时找不到时 | 适用场景 |
| --- | --- | --- | --- |
| `getBy...` | 立即返回 | 立即报错 | 元素现在就应该存在 |
| `findBy...` | 返回 Promise | 等待一段时间后报错 | API 或状态更新后才出现 |
| `queryBy...` | 立即返回 | 返回 `null` | 断言元素不存在 |

例子：

```ts
expect(screen.getByLabelText("选择 PDF 文件")).toBeDisabled();
expect(await screen.findByText("新投标文件.pdf")).toBeInTheDocument();
expect(screen.queryByTitle("投标文件.pdf")).not.toBeInTheDocument();
```

不要用 `getBy...` 断言不存在，因为它在进入 `expect` 前就会报“找不到元素”。

## 10. vi.mock 如何隔离真实 API

登录测试开头写了：

```ts
vi.mock("../api/auth", () => ({ login: vi.fn() }));
const mockedLogin = vi.mocked(login);
```

组件仍然认为自己导入了 `login`，但测试运行时实际拿到的是 `vi.fn()`。因此：

- 不会真的访问 `/api/auth/login`。
- 不要求后端处于启动状态。
- 可以让登录立即成功、保持等待或主动失败。
- 可以断言组件是否传入了正确用户名和密码。

`vi.mocked(login)` 主要帮助 TypeScript 理解它现在是一个可配置的 Mock，运行时并没有再创建一份函数。

## 11. 为什么每个测试都重置 Mock

```ts
beforeEach(() => {
  mockedLogin.mockReset();
});
```

假设第一个测试配置登录成功，第二个测试配置登录失败。如果不重置，返回值和调用历史可能跨测试残留。

这里必须特别注意箭头函数的隐式返回。不要写成：

```ts
beforeEach(() => mockedLogin.mockReset());
```

`mockReset()` 会返回 Mock 函数本身。Vitest 把测试钩子返回的函数当作清理函数，并在用例结束时再次执行它。登录失败用例因此曾产生第二个未捕获的失败请求。

加上花括号后函数不再隐式返回：

```ts
beforeEach(() => {
  mockedLogin.mockReset();
});
```

这是本课实际排错得到的经验：失败堆栈指向 `new Error(...)`，不一定说明组件的 `catch` 无效，还要检查测试生命周期是否意外再次调用了 Mock。

## 12. 登录成功测试在验证什么

测试先把 API 结果预设为查看用户：

```ts
mockedLogin.mockResolvedValue(viewer);
```

然后完成用户操作：

```ts
await user.click(screen.getByRole("button", { name: "查看账号" }));
expect(screen.getByLabelText("用户名")).toHaveValue("viewer");
await user.click(screen.getByRole("button", { name: "登录并获取 Token" }));
```

最后验证两个边界：

1. 组件以 `viewer` 和密码调用 API。
2. API 成功后，组件把用户交给父组件的 `onLogin`。

测试不读取 React 的 `username` state。输入框显示值已经是用户能观察到的行为。

## 13. 怎样测试“请求还没完成”

如果使用 `mockResolvedValue`，Promise 很快完成，可能来不及观察“登录中”状态。测试因此创建一个由自己控制结束时间的 Promise：

```ts
let resolveLogin = (value: AuthUser) => undefined;
mockedLogin.mockReturnValue(new Promise((resolve) => {
  resolveLogin = resolve;
}));
```

点击后 Promise 尚未完成，组件应显示并禁用“登录中……”按钮。测试确认后再调用 `resolveLogin(viewer)`，模拟服务器终于返回。

按钮完成后没有从 DOM 中删除。React 会复用同一个 `<button>`，只是恢复文字和 enabled 状态。因此正确断言是等待“登录并获取 Token”重新出现且可用，而不是保存旧 DOM 引用后断言它消失。

## 14. 登录失败测试

```ts
mockedLogin.mockRejectedValue(
  new Error("[INVALID_CREDENTIALS] 用户名或密码错误"),
);
```

用户点击后，组件的 `catch` 应把 Error 的 message 显示在页面上，并且不能调用父组件的 `onLogin`。

这个场景同时保护了两条规则：用户能看到可读原因；失败请求不能被误当成已登录。

## 15. 文件列表测试与角色权限

`DocumentPanel` 接收 `canUpload`。测试将它设为 `false`，并让文件列表 API 返回一份固定数据。

页面应该：

- 显示文件名和上传者。
- 禁用文件选择控件。
- 禁用并显示“当前角色不可上传”按钮。

这验证的是前端体验。真正的安全不能只靠 disabled 按钮，第 6B 课已经验证后端 Guard 会拒绝 viewer 上传。用户可以绕过前端，因此最终权限必须由后端执行。

## 16. 为什么给文件 input 增加 aria-label

原来的文件控件没有关联的 `<label>`，用户能看到浏览器默认按钮，但辅助技术和测试很难稳定说出它的名称。

组件增加：

```tsx
<input aria-label="选择 PDF 文件" type="file" />
```

测试现在可以写：

```ts
screen.getByLabelText("选择 PDF 文件");
```

这不是“为了测试污染生产代码”。可访问名称本来就是页面质量的一部分，测试只是促使组件把语义补完整。

## 17. 用内存 File 测试上传

jsdom 提供浏览器 `File` API：

```ts
const file = new File(
  ["%PDF-1.4 test content"],
  "新投标文件.pdf",
  { type: "application/pdf" },
);
```

它只存在测试进程内存，不会读取或创建磁盘文件，也不会碰开发环境的三份 PDF。

`user.upload(input, file)` 模拟选择文件。点击上传后测试检查：

- `uploadDocument` 收到的正是这个 File 对象。
- 返回的新文件被加入列表。
- 成功提示出现。
- 文件 input 被重置。

因为 API 已 Mock，这里没有验证 multipart、Multer 和 MinIO；这些已由第 6B 课的集成测试负责。

## 18. iframe 预览测试到底证明了什么

预览 API 被设置为返回固定签名地址：

```ts
mockedPreviewUrl.mockResolvedValue({
  url: signedUrl,
  expiresAt: "2026-09-03T08:05:00.000Z",
  expiresInSeconds: 300,
});
```

用户点击后，测试验证：

- API 收到正确的文件 ID。
- 页面生成了标题为文件名的 iframe。
- iframe 的 `src` 等于 API 返回的 URL。
- 页面展示失效时间。

jsdom 不会真正加载该 URL，也不会渲染 PDF。签名是否有效、对象能否下载由第 6B 课集成测试负责。

## 19. 关闭预览为什么用 queryBy

点击“关闭预览”后，iframe 应不存在，但文件列表仍应保留。

```ts
expect(screen.queryByTitle("投标文件.pdf")).not.toBeInTheDocument();
expect(screen.getByText("投标文件.pdf")).toBeInTheDocument();
```

第一个断言使用 `queryByTitle`，因为“不存在”是预期结果；第二个断言证明关闭的只是预览，不是删除文件。

## 20. within 的用途

如果列表有两个文件，页面上会出现两个同名的“生成临时地址并预览”按钮。全局 `getByRole` 会因为匹配多个元素而报错。

测试先找到“报价文件.pdf”所在的 `<li>`，然后：

```ts
within(listItem).getByRole("button", {
  name: "生成临时地址并预览",
});
```

`within` 把查询范围缩小到一个列表项。这验证按钮与对应文件处于正确的语义分组。

## 21. waitFor 什么时候使用

`findByText` 适合等待某个元素出现；但有时要等待调用次数、enabled 状态或多个断言，就使用 `waitFor`。

```ts
await waitFor(() => {
  expect(mockedLogin).toHaveBeenCalledWith("viewer", "demo123456");
  expect(onLogin).toHaveBeenCalledWith(viewer);
});
```

`waitFor` 会重复运行回调，直到里面不再抛出断言错误或超时。不要在其中执行点击，否则回调重试时可能点击多次。行为放外面，断言放里面。

也不要用固定 `setTimeout(1000)` 等待界面；机器快慢不同会让测试变慢或偶发失败。

## 22. jest-dom 让断言更接近人话

本课使用了：

- `toBeInTheDocument()`：元素存在于当前页面。
- `toBeDisabled()` / `toBeEnabled()`：控件不可用或可用。
- `toHaveValue()`：输入框当前值符合预期。
- `toHaveAttribute()`：例如 iframe 具有指定 `src`。

与读取底层 DOM 属性相比，这些断言更易读，失败信息也更清楚。

## 23. 不应该测试什么

组件测试应保护用户行为，不要锁死实现细节：

- 不断言 Tailwind 类名列表。
- 不读取 Hook 内部 state。
- 不断言 `setState` 调用了几次。
- 不为每个 `<div>` 写快照。
- 不在这里验证真实 MinIO URL 能否下载。
- 不断言 jsdom 无法计算的真实布局尺寸。

例如把按钮由蓝色改成青色通常不应导致业务测试失败；但把按钮意外禁用必须失败。

## 24. 测试与生产构建的关系

测试文件放在源码旁边，便于看到组件时立刻找到其行为说明。Vite 生产入口没有 import `*.spec.tsx`，因此这些测试不会被打进正式前端 bundle。

`pnpm build` 仍会执行 TypeScript 检查，所以测试代码本身也必须类型正确。之后 Vite 只从正式入口分析生产依赖。

## 25. 根目录命令现在怎样工作

```powershell
pnpm test
```

同时对 `@fullstack-lab/api` 和 `@fullstack-lab/web` 执行各自的 `test`。它们都是快速测试，不需要 Docker。

```powershell
pnpm test:watch
```

同时启动前后端监听模式。修改相关源码或测试后，Vitest 会自动重跑。该命令会持续运行，结束时按 `Ctrl+C`。

```powershell
pnpm test:all
```

先运行前后端快速测试，再启动隔离环境运行 API 集成测试。提交重要修改前优先用它。

## 26. 常见故障排查

### `document is not defined`

确认 `vitest.config.ts` 设置 `environment: "jsdom"`，并从 `apps/web` 的配置运行测试。

### `Invalid Chai property: toBeInTheDocument`

确认 setup 导入了 `@testing-library/jest-dom/vitest`，且配置的 `setupFiles` 路径正确。

### 找到多个同名按钮

先找到对应列表项，再用 `within` 限定查询范围；不要随意使用 `getAllByRole(...)[1]` 锁死顺序。

### 异步内容找不到

确认用户操作前有 `await`；对稍后出现的内容使用 `findBy...`，对状态断言使用 `waitFor`。

### 用例单独通过、一起失败

检查 cleanup、Mock 返回值和调用记录是否重置，也检查模块级变量有没有被前一个用例修改。

### 登录错误被报告为未处理异常

检查 `beforeEach` 是否隐式返回了 Mock 函数。钩子返回函数具有“结束后执行清理”的特殊含义，应使用花括号确保返回 `undefined`。

### iframe 测试没有显示 PDF

这是正常现象。jsdom 只验证 iframe 元素和 `src`，真实 PDF 渲染要在浏览器或 E2E 测试中验证。

## 27. 建议亲手完成的实验

### 实验 A：观察一个测试失败

把登录成功测试里的预期用户名临时改成错误值，运行 Web 测试，阅读 Vitest 输出。看懂后立即恢复，不要保留故意失败的代码。

```powershell
pnpm --filter @fullstack-lab/web test
```

### 实验 B：使用监听模式

```powershell
pnpm --filter @fullstack-lab/web test:watch
```

修改一个测试名称并保存，观察 Vitest 自动重跑，然后按 `Ctrl+C` 退出。

### 实验 C：增加无文件场景

让 `fetchDocuments` 返回空数组，断言页面显示“还没有文件”。先按 Arrange、Act、Assert 写出三段，再运行测试。

### 实验 D：验证上传错误

让 `uploadDocument` 拒绝并返回 Error，验证错误文字出现、新文件没有加入列表、输入控件仍保留已选文件。

## 28. 本课自测

<details>
<summary>1. 为什么组件测试不需要启动 NestJS？</summary>

测试用 `vi.mock` 替换了 API 模块，只验证组件如何发起调用并处理不同结果。
</details>

<details>
<summary>2. jsdom 与真实 Chrome 有什么区别？</summary>

jsdom 在 Node.js 中模拟 DOM 和事件，不负责真实排版、绘制、PDF 渲染及完整浏览器网络行为。
</details>

<details>
<summary>3. 为什么优先用 getByRole？</summary>

角色和可访问名称接近用户及辅助技术感知页面的方式，比 CSS 选择器更稳定，也能促进可访问性。
</details>

<details>
<summary>4. findBy 与 queryBy 分别什么时候用？</summary>

等待异步出现使用 findBy；断言元素不存在使用 queryBy。
</details>

<details>
<summary>5. 为什么测试上传不用磁盘上的真实 PDF？</summary>

内存 File 足以测试选择和组件调用，不污染磁盘、不依赖个人文件，并让测试快速可重复。
</details>

<details>
<summary>6. 前端禁用上传按钮为什么不能代替后端授权？</summary>

调用者可以绕过页面直接发送 HTTP 请求，真正的权限边界只能由后端验证。
</details>

<details>
<summary>7. 为什么不能在 waitFor 内点击？</summary>

waitFor 会重试回调，把用户行为放进去可能执行多次，导致测试行为与真实一次点击不一致。
</details>

<details>
<summary>8. beforeEach 隐式返回 Mock 为什么危险？</summary>

Vitest 会把返回的函数当作清理回调，在用例结束时再次调用，从而产生额外请求或未处理异常。
</details>

## 29. 本课涉及的文件

| 文件 | 作用 |
| --- | --- |
| `apps/web/vitest.config.ts` | React 组件测试配置 |
| `apps/web/src/test/setup.ts` | 注册 jest-dom 并清理 DOM |
| `LoginCard.spec.tsx` | 登录成功、等待和失败三个场景 |
| `DocumentPanel.spec.tsx` | 权限、上传、列表和预览六个场景 |
| `DocumentPanel.tsx` | 为文件控件补充可访问名称 |
| `apps/web/package.json` | Web 测试与监听命令 |
| 根 `package.json` | 统一运行前后端测试 |

## 30. 本课完成标准

- `pnpm test` 显示后端 20 个、前端 9 个测试通过。
- `pnpm check` 前后端都通过。
- 不启动 Docker，也能运行本课组件测试。
- 测试期间不会访问真实 API、数据库、MinIO 或已有 PDF。
- 你能解释 jsdom 为什么不是完整浏览器。
- 你能正确选择 `getBy`、`findBy` 和 `queryBy`。
- 你能说明前端角色状态与后端授权各自负责什么。
- 你能为一个新的按钮交互独立写出 Arrange、Act、Assert。

达到这些标准后，自动化测试阶段完成。下一课进入第 7 课：为 React 前端和 NestJS 后端分别制作 Docker 镜像，再用 Docker Compose 一次启动完整系统。
