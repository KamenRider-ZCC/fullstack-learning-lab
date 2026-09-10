# 第 11A 课：前端开发者需要掌握的最小 YAML

## 1. 为什么只学“最小 YAML”

YAML 不是 Docker，也不会启动服务。它只是一种表达配置数据的文本格式，作用类似 JSON。

AI 可以生成 YAML，但开发者仍要能确认：层级有没有写错、列表是否完整、端口和路径是否正确、是否引用了敏感信息。当前不要求背完整 YAML 规范。

## 2. 从熟悉的 JavaScript 对象开始

前端代码：

```ts
const config = {
  app: {
    name: 'fullstack-learning-lab',
    enabled: true,
    ports: [3000, 5173],
  },
};
```

相同数据写成 YAML：

```yaml
app:
  name: fullstack-learning-lab
  enabled: true
  ports:
    - 3000
    - 5173
```

对应关系：

- `key: value` 类似对象的一个属性。
- 冒号后换行并缩进，表示值是下一层对象。
- `-` 表示数组中的一项。
- `true`、`3000` 等值可以有布尔和数字类型。
- `#` 后面是注释。

## 3. YAML 最重要的规则：缩进表示层级

正确：

```yaml
database:
  host: localhost
  port: 5432
```

它表示 `host` 和 `port` 都属于 `database`。

错误：

```yaml
database:
  host: localhost
port: 5432
```

这里的 `port` 已经回到最外层，不再属于 `database`。文件可能仍能解析，但含义已经改变，所以 YAML 配置错误不一定产生语法报错。

学习项目统一使用空格缩进，不使用 Tab。

## 4. 对象和数组可以嵌套

```yaml
services:
  - name: api
    port: 3000
  - name: web
    port: 5173
```

对应：

```ts
const services = [
  { name: 'api', port: 3000 },
  { name: 'web', port: 5173 },
];
```

看到 YAML 时，先把它当成对象和数组，不要先猜 Docker 的作用。

## 5. 字符串什么时候加引号

普通文字通常可以不加：

```yaml
name: api
```

容易被误解、包含特殊符号或必须保持原样的值建议加引号：

```yaml
portMapping: "3000:3000"
enabledText: "true"
emptyText: ""
```

`"true"` 是字符串，`true` 是布尔值，两者不同。Docker Compose 中端口映射通常加引号，避免 YAML 把它当成其他类型。

## 6. 当前阶段最常见的错误

1. 缩进错一层，配置跑到了错误的对象下面。
2. 数组项漏写 `-`。
3. 把 Tab 和空格混用。
4. 把数字、布尔值和字符串混为一谈。
5. 复制配置时漏掉一整层父级名称。
6. AI 修改了端口、路径或 Volume，但只检查语法，没有检查实际含义。

## 7. AI 开发中的掌握边界

必须掌握：

- 能识别对象、数组、缩进层级和常见值类型。
- 能把一小段 YAML 大致还原成 JavaScript 对象。
- 修改后检查关键端口、路径、环境变量名和列表项。
- 使用对应工具验证最终配置，而不是只凭肉眼判断。

暂时不要求：

- 默写 YAML 规范。
- 使用锚点、别名、复杂多行字符串和自定义标签。
- 独立写出完整 Docker Compose、Prometheus 或 CI 配置。

## 8. 今天的练习

只看下面 YAML，不查 Docker 文档：

```yaml
project:
  name: learning-lab
  enabled: true
  ports:
    - 3000
    - 5173
  database:
    host: localhost
    port: 5432
```

用自己的话回答：

1. 最外层有几个属性？
2. `ports` 是对象还是数组？
3. `database.port` 的值是多少？
4. 如果把 `database` 下面的 `port` 左移两个空格，它还属于 `database` 吗？

这四题检查的是数据结构理解，不要求背任何句子。

## 9. 后续参考资料

- Docker 官方概览：<https://docs.docker.com/get-started/docker-overview/>
- Docker Compose 官方入门：<https://docs.docker.com/compose/gettingstarted/>
- Compose 文件官方参考：<https://docs.docker.com/reference/compose-file/>
- YAML 1.2 官方规范：<https://yaml.org/spec/1.2.2/>（只作查询，不建议初学时通读）

下一课先理解镜像、容器、端口、Volume 和网络，再把这些概念放进 Compose YAML。不要同时学习两套新概念。
