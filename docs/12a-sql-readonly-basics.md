# 第 12A 课：用只读 SQL 看懂数据库里的数据

这一阶段不再给 Demo 增加功能，而是补齐已有项目中最常用的数据库基础。本课只执行 `SELECT` 查询，不修改或删除数据。

## 1. SQL 在当前系统中的位置

正常业务请求由 Prisma 生成 SQL：

```text
ReviewService → Prisma Client → SQL → PostgreSQL
```

开发者仍需要看懂基础 SQL，因为排查问题时经常需要直接确认：

- 数据是否真的写入；
- 写入了几行；
- 最新一条记录是什么；
- 页面显示值与数据库值是否一致；
- 两张表能否按外键关联。

使用 AI 生成 SQL 没问题，但执行前必须判断它是只读查询还是会修改数据。

## 2. 最基础的查询结构

```sql
SELECT 列名
FROM 表名
WHERE 过滤条件
ORDER BY 排序列 DESC
LIMIT 返回行数;
```

逐句理解：

- `SELECT`：希望看到哪些列；
- `FROM`：数据来自哪张表；
- `WHERE`：只保留符合条件的行；
- `ORDER BY`：按哪一列排序；
- `DESC`：从大到小，时间列通常表示最新在前；
- `LIMIT`：最多返回多少行。

## 3. 为什么表名和列名有双引号

Prisma 创建了 `ExpertScore`、`reviewItemId` 等包含大小写的名称。PostgreSQL 对未加双引号的标识符会转成小写，因此：

```sql
FROM ExpertScore
```

会被理解成 `FROM expertscore`，可能提示表不存在。正确写法是：

```sql
FROM "ExpertScore"
```

字符串值使用单引号，例如：

```sql
WHERE "bidderId" = 'demo-bidder'
```

双引号用于表名和列名，单引号用于文本值。

## 4. 第一组只读查询

在项目根目录执行：

```powershell
@'
SELECT
  "bidderId",
  score,
  length(feedback) AS "feedbackLength",
  "updatedAt"
FROM "ExpertScore"
ORDER BY "updatedAt" DESC
LIMIT 5;
'@ | docker compose exec -T postgres psql -U fullstack -d fullstack_lab
```

新出现的两项：

- `length(feedback)`：计算说明包含多少个字符；
- `AS "feedbackLength"`：给计算结果起一个便于阅读的临时列名，不会修改数据库。

然后统计总行数：

```powershell
@'
SELECT COUNT(*) AS "scoreCount"
FROM "ExpertScore";
'@ | docker compose exec -T postgres psql -U fullstack -d fullstack_lab
```

`COUNT(*)` 统计符合条件的行数。因为没有 `WHERE`，这里统计整张表。

## 5. 本次需要记录

```text
最近一条 bidderId：
最近一条 score：
最近一条 feedbackLength：
ExpertScore 总行数：
```

如果最近一条说明长度仍为 201，它是旧 API 在重新构建前写入的历史数据，不是刚才返回 400 的请求写入的。返回 400 后总行数和 `updatedAt` 不应该因为失败请求再次变化。

## 6. AI 可以代劳和你必须判断的边界

AI 可以：

- 根据问题生成查询语句；
- 解释查询结果；
- 帮助补充 JOIN、分组和排序。

你必须判断：

- 语句是否只有 `SELECT`；
- 查询的是开发、测试还是生产数据库；
- 表名、过滤条件和租户条件是否正确；
- 输出是否包含不应复制或发送的个人信息；
- AI 是否把查询偷偷扩大成 UPDATE、DELETE 或迁移。

完成本课后再进入 `WHERE`、`JOIN`、索引和事务的渐进练习。
