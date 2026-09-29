# English Learning Platform · 后端（Backend）

> **当前状态：第一阶段已完成并实测 · 2026-09-29**
> Node + Express + MySQL 的**数据层与 API 层已可运行**：8 张表 + 2 视图，16 个只读接口，
> 冒烟测试 27 项全部通过。**尚不含写接口与 AI 功能**（按计划留待第二阶段）。

角色定位（见 `../AGENTS.md`）：本目录是项目的 **学习记忆层** —— 让 Amy 每天知道学生
**学过什么 / 错过什么 / 掌握什么**。

---

## 快速开始

```bash
cd backend
npm install                 # 安装依赖（express / mysql2 / dotenv / cors / morgan / helmet）
cp .env.example .env        # 填入 MySQL 账号密码（本机已配好，见下）
npm run db:init             # 建库建表 + 写入种子数据（幂等）
npm start                   # 启动服务 → http://localhost:4000
npm run test:api            # 另开终端：跑 API 冒烟测试
```

- 数据库：`english_platform`（MySQL 8.0，本机 3306）
- 配置：全部走 `backend/.env`（已在 `.gitignore`，**不入版本库**）
- `npm run db:reset` 会 **DROP DATABASE 后重建**，仅在需要清空时使用

---

## 文档索引

| 文档 | 状态 | 内容 |
|---|---|---|
| [`docs/05-api-reference.md`](docs/05-api-reference.md) | ✅ **已实现** | 16 个接口的实测契约与响应样例（**对接权威**） |
| [`docs/06-api-requirements-amy.md`](docs/06-api-requirements-amy.md) | 📥 **需求** | Amy 侧 API 需求：P0 快照 + 写接口，P1 知识点/阅读，数据质量问题 DQ1—DQ5 |
| [`docs/01-architecture.md`](docs/01-architecture.md) | 设计 | 分层架构、目录规划、错误处理与校验策略 |
| [`docs/02-data-model.md`](docs/02-data-model.md) | 设计 | ER、字段字典、业务规则、md↔DB 映射 |
| [`docs/03-api-contract.md`](docs/03-api-contract.md) | 设计 | 长期契约（含写接口与 Agent Snapshot） |
| [`docs/04-migration-and-roadmap.md`](docs/04-migration-and-roadmap.md) | 设计 | md→DB 迁移方案与 M0–M5 路线 |
| [`db/schema.sql`](db/schema.sql) | ✅ **已执行** | 第一阶段 8 表 + 2 视图 |
| [`db/schema.full.design.sql`](db/schema.full.design.sql) | 设计 | 长期 18 表 + 2 视图设计稿 |

---

## 技术栈

Node.js 22 · Express 4 · MySQL 8.0 · mysql2（连接池 + prepared statement）· dotenv
安全与日志：helmet / cors / morgan（`X-Request-Id` 贯穿）
**不引入 ORM**：SQL 手写、参数化，透明可读。

---

## 目录结构（已实现）

```
backend/
├─ package.json / .env.example / .env(不入库)
├─ src/
│  ├─ server.js            启动 + 优雅退出
│  ├─ app.js               express 装配
│  ├─ constants.js         枚举唯一来源（与 schema 同源）
│  ├─ config/              env.js（配置集中校验）、db.js（连接池/事务）
│  ├─ routes/              index + lesson/vocabulary/mistake/studyRecord/progress
│  ├─ controllers/         HTTP 层：解析入参、包装响应
│  ├─ services/            业务规则：优先级推导、字段映射、进度对齐
│  ├─ repositories/        纯 SQL（prepared statement）
│  ├─ middlewares/         requestContext / notFound / errorHandler
│  └─ utils/               ApiError / asyncHandler / response / validate
├─ db/
│  ├─ schema.sql           第一阶段 schema（已执行）
│  ├─ schema.full.design.sql  长期设计稿
│  ├─ seed.js              真实种子数据（第 1—6 课）
│  └─ init.js              建库建表 + 写入种子
├─ scripts/smoke-test.js   27 项 API 冒烟测试
└─ docs/
```

---

## 给各 Agent 的对接摘要

### → 前端工程师
- **Base URL**：`http://localhost:4000`　前缀 `/api`
- **统一响应**：成功 `{code:200, message:'success', data}`；失败 `{code, message, data:null}`
- **分页**：`data = { list, total, page, size }`
- **页面对照**（现阶段均为只读）：

| 页面 | 可用接口 |
|---|---|
| 看板 `review/index.html` | `GET /api/lessons`、`GET /api/progress` |
| 阅读 `review/reading.html` | ⏳ 阅读表尚未建（第二阶段） |
| 词汇 `review/words.html` | `GET /api/vocabulary/stats`、`GET /api/vocabulary?letter=` |
| 错词 `review/wrong.html` | `GET /api/mistakes`、`GET /api/mistakes/stats` |
| 课程详情 `lessons/lesson-N.html` | `GET /api/lessons/:id` |

- ⚠️ **本阶段不要求前端改动**，`review/*.html` 保持不动；确认切换后再对接。
- ⚠️ 响应格式已从设计稿的 `{success,data,meta}` 改为 **`{code,message,data}`**，以 `docs/05-api-reference.md` 为准。

### → Amy / Skill 设计师
- **已可用**：`GET /api/mistakes/pending`（未过关错词，含 `priority`，等价 `digest.md` 待复习段）、
  `GET /api/lessons/latest`（最近一课 + 下一课号）、`GET /api/lessons/error-trend`（R3 加速判断依据）、
  `GET /api/progress`（级别 / 连击 / 冻结）。
- **尚未实现**（第二阶段，即 `docs/03-api-contract.md` 的 B1）：
  `GET /agent/snapshot`、`POST /courses`、`POST /mistakes/:id/review`、`POST /progress/feedback`。
- 教学规则后端**只搬运不重设计**，规则来源仍是 `progress.md` / `docs/ai-teacher.md`。

### → Git / 版本管理工程师
- 本次新增：`backend/` 全目录（可运行代码 + schema + 种子 + 文档）与 `backend/docs/05-api-reference.md`；
  更新：`docs/api.md`、`docs/database.md`、`backend/README.md`。
- **未修改**：`review/`、`notes/`、`read/`、`progress.md`、`wrong-words.md`、`INDEX.md`、`digest.md`、`PROJECT.md`、`AGENTS.md`、`.workbuddy/skills/`。
- `.gitignore` 已覆盖 `node_modules/`、`.env`、`db/_snapshot.json`，无需改动。

---

## 下一阶段（未做，按计划）

1. 写接口：`POST /courses`、`POST /mistakes`、`POST /mistakes/:id/review`、`POST /progress/feedback`
2. `GET /agent/snapshot`（把 `digest.md` 升级为 JSON，供 Amy / Skill 一次取全）
3. md → DB 自动迁移脚本（M2）：`export_md_to_json.py` + `import_json.js`
4. 补齐长期设计的其余表（阅读、知识点、练习、Skill 运行记录）
