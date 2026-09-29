# 01 · 后端架构设计

> 状态：**设计稿（DESIGN ONLY）**，尚未编写可运行代码。经你确认后再进入实现。
> 适用项目：English Learning Platform（工作目录 `E:\English`）

---

## 一、设计前提（来自第一阶段侦察，不是假设）

| 事项 | 侦察结论 | 对后端的影响 |
|---|---|---|
| 前端 | `review/*.html`，纯静态 HTML/CSS/原生 JS，**由 `build_board.py` 生成** | 后端**不碰**前端；两者解耦 |
| 数据真相源 | 4 类 Markdown：`notes/`、`read/`、`progress.md`、`wrong-words.md` | 迁移时以 md 为准，只读不改 |
| 现有 API | **无**（fetch/axios/XHR 零命中） | 从零建 REST API |
| 现有后端 | **无**（无 package.json / server / .env / *.sql） | 从零搭建 |
| 运行环境 | Node 22.22.2、npm 10.9.7、MySQL 8.0.27（3306 运行中） | 技术栈可用，仅缺 DB 密码 |
| 用户诉求 | 「Amy 每天要知道学生**学过什么 / 错过什么 / 掌握什么**」 | 数据模型围绕此三问设计 |

**约束（遵守 AGENTS.md）**：不改前端技术栈、不删现有文件、不动 Amy 教学规则、不做无说明的大重构。

---

## 二、技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| 运行时 | Node.js 22（LTS） | 环境已具备，与 PROJECT.md 一致 |
| Web 框架 | Express 4 | PROJECT.md 指定；生态成熟，学生易读 |
| 数据库 | MySQL 8.0 | PROJECT.md 指定；本机已在运行 |
| 驱动 | `mysql2`（连接池 + Promise） | 支持 prepared statement，防注入 |
| 校验 | `zod` | Schema 即文档，一处定义可复用；错误信息结构化 |
| 安全 | `helmet` + `cors` | 基础响应头与跨域控制 |
| 日志 | `morgan` + 结构化 `requestId` | 便于排错与定位 |
| 配置 | `dotenv`（`.env`，不入库） | 不硬编码密钥 |

**明确不引入**：ORM（如 Sequelize/Prisma）。原因——本项目 SQL 可读性优先、表结构稳定，手写 SQL + 参数化更透明，也便于你理解每一条查询。

---

## 三、分层架构

```
        HTTP 请求
            │
   ┌────────▼────────┐
   │  routes/        │  只做 URL → controller 绑定 + 中间件挂载
   ├─────────────────┤
   │  middlewares/   │  requestId → 校验(zod) → 路由 → 404 → 错误处理
   ├─────────────────┤
   │  controllers/   │  解析 req、调用 service、统一包装响应；不含业务规则
   ├─────────────────┤
   │  services/      │  业务规则：连击+1、≥2 判过关、升降级、paylo ad 组装
   ├─────────────────┤
   │  repositories/  │  纯 SQL（mysql2 prepared statement），返回领域对象
   ├─────────────────┤
   │  config/db.js   │  mysql2 连接池
   └────────┬────────┘
            │
        MySQL 8.0
```

**分层铁律**：
- controller 不写 SQL，repository 不写业务判断；
- 业务规则（如「连续答对 2 次 → 已过关」）**只允许出现在 service**，与 `progress.md` 现有规则一一对应；
- 时间、ID、分页等横切逻辑放 utils，避免各处重复。

---

## 四、目录规划

```
backend/
├─ package.json                 依赖与 scripts（design 阶段先不创建）
├─ .env.example                 环境变量样例（DB_HOST/DB_USER/DB_PASSWORD/DB_NAME/PORT）
├─ src/
│  ├─ server.js                 读取 env → 启动 HTTP 服务
│  ├─ app.js                    装配 express：helmet/cors/json/路由/错误处理
│  ├─ config/
│  │  ├─ env.js                 读取并校验环境变量（缺失即启动失败）
│  │  └─ db.js                  mysql2 连接池 + 事务辅助
│  ├─ routes/
│  │  ├─ index.js               汇总挂载 /api/v1
│  │  ├─ course.routes.js
│  │  ├─ vocabulary.routes.js
│  │  ├─ reading.routes.js
│  │  ├─ mistake.routes.js
│  │  ├─ progress.routes.js
│  │  ├─ studyRecord.routes.js
│  │  ├─ dashboard.routes.js    看板统计
│  │  └─ agent.routes.js        ← 给 Amy / Skill 的快照接口
│  ├─ controllers/              与 routes 一一对应
│  ├─ services/                 业务规则
│  ├─ repositories/             纯 SQL
│  ├─ validators/               zod schema（body / query / params）
│  ├─ middlewares/
│  │  ├─ requestContext.js      requestId + 计时
│  │  ├─ validate.js            按 schema 校验并入参
│  │  ├─ notFound.js            404
│  │  └─ errorHandler.js        统一错误出口
│  └─ utils/
│     ├─ ApiError.js            带 code/status 的错误类
│     ├─ asyncHandler.js        包裹 async 路由，自动 catch
│     └─ response.js            ok() / fail() 响应包络
├─ db/
│  ├─ schema.sql                ← 已产出（本设计）
│  ├─ seed.sql                  初始数据（可并入 schema）
│  ├─ export_md_to_json.py      复用 build_board.py 解析规则，导出快照 JSON
│  └─ import_json.js            快照 JSON → MySQL（幂等）
└─ docs/                        本目录（设计文档）
```

---

## 五、横切设计

### 5.1 统一响应包络

```json
// 成功
{ "success": true, "data": { ... }, "meta": { "page": 1, "size": 20, "total": 137 } }

// 失败
{ "success": false, "error": { "code": "MISTAKE_NOT_FOUND", "message": "错词不存在", "details": null } }
```

统一包络是为了让 **Skill / Amy 侧可以稳定解析**（人可读的 `digest.md` → 机器可读的 JSON）。

### 5.2 错误处理策略

- 业务错误：抛 `ApiError.create('MISTAKE_NOT_FOUND', 404, msg)`；
- 未知异常：`errorHandler` 捕获，记日志（含 `requestId`），对外只回 `INTERNAL_ERROR`，**不泄露堆栈与 SQL**；
- DB 错误：识别 `ER_DUP_ENTRY`（唯一键冲突 → 409 `CONFLICT`）、`ER_NO_REFERENCED_ROW`（→ 400 `INVALID_REFERENCE`）。

### 5.3 数据校验

- 所有写接口用 `zod` 校验 body；查询参数校验 query；`:id` 校验为正整数。
- 校验失败 → 400 `VALIDATION_ERROR`，`details` 给出字段级原因。
- 关键枚举（level、feedback、status、section_type、exercise_type）**与数据库 ENUM 同一份定义**，避免漂移。

### 5.3.1 枚举变更铁律（强制，2026-09-29 实测教训）

**改 ENUM 只有一条允许的方向：新值一律追加在末尾，禁止插在中间，禁止调整既有值顺序。**

原因：MySQL 的 `ENUM` **按内部索引存储**，列定义里的第 N 个取值对应磁盘上的整数 N。把新值插到中间会让其后所有取值的索引整体后移，既有行**不会报错、也不会被拒绝**，而是被静默重新解释成另一个语义——属于最难排查的一类数据损坏（例如把 `grading` 读成 `feedback`）。

安全做法（`section_type` 增 `objectives` / `expected_mistakes` 时的实际写法）：

```sql
-- ✅ 追加在末尾：可走 INSTANT，既有行索引不变
ALTER TABLE lesson_sections
  MODIFY COLUMN section_type ENUM('review','grammar','vocab_table','examples',
                                  'homework','my_answer','grading','feedback',
                                  'objectives','expected_mistakes') NOT NULL;

-- ❌ 禁止：插在中间会让 feedback/grading 等既有值的索引错位
-- ENUM('objectives','review','grammar',...,'feedback','expected_mistakes')
```

变更后必须**逐类型计数核对**，确认既有行没有漂移：

```sql
SELECT section_type, COUNT(*) FROM lesson_sections GROUP BY section_type;
-- 变更前 6/6 → 变更后仍须 6/6（实测通过）
```

同源顺序（见 §5.3）：`db/schema.sql` → 库内 `ALTER TABLE` → `src/constants.js` → `docs/schemas/*.json`。反序会造成「代码接受、库拒绝」的 500。

### 5.4 安全与环境

- 密钥只走 `.env`；`.env` 必须加入 `.gitignore`（现有 `.gitignore` 已忽略 `.workbuddy/` 与 `*.zip`，实现阶段需补 `.env`、`node_modules/`）。
- SQL 一律 prepared statement，禁止字符串拼接。
- 上线前启用 `helmet`、限制 CORS 白名单、请求体大小上限。

---

## 六、与现有资产的关系（重要）

- `review/*.html`、`INDEX.md`、`digest.md`、`notes/`、`read/*.md`、`progress.md`、`wrong-words.md`：**本期一律保持不动**。
- 后端是**正交新增**：新增 `backend/` 目录，不改动、不删除任何现有文件。
- 过渡期内，`build_board.py` 与后端**并存**：静态看板继续由脚本生成，后端提供 API 与数据库。两者数据通过迁移脚本单向同步（md → DB），**不反向写回 md**，直到你决定切换前端。
