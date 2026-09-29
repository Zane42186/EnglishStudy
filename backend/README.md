# English Learning Platform · 后端（Backend）

> **当前状态：设计阶段（DESIGN ONLY）。** 这里目前只有设计与文档，**没有可运行代码**。
> 等你确认后，按 `docs/04-migration-and-roadmap.md` 的 M1→M4 逐步实现。

角色定位（见 `../AGENTS.md`）：本目录是项目的 **学习记忆层** —— 让 Amy 每天知道学生
**学过什么 / 错过什么 / 掌握什么**。

---

## 文档索引

| 文档 | 内容 |
|---|---|
| [`docs/01-architecture.md`](docs/01-architecture.md) | 技术选型、分层架构、目录规划、错误处理与校验策略 |
| [`docs/02-data-model.md`](docs/02-data-model.md) | ER、18 表 + 2 视图、字段字典、业务规则、md↔DB 映射 |
| [`docs/03-api-contract.md`](docs/03-api-contract.md) | 全部 API 契约（URL/Method/Req/Res/Error）与前端页面对照 |
| [`docs/04-migration-and-roadmap.md`](docs/04-migration-and-roadmap.md) | 迁移方案（md→DB）与 M0–M5 落地路线 |
| [`db/schema.sql`](db/schema.sql) | MySQL 建表 DDL（**设计稿，尚未执行**） |

---

## 技术栈（对齐 PROJECT.md）

Node.js 22 · Express 4 · MySQL 8.0 · mysql2 · zod · helmet/cors · dotenv

---

## 目录规划（实现阶段将生成）

```
backend/
├─ src/{config,routes,controllers,services,repositories,validators,middlewares,utils}
├─ db/{schema.sql, seed.sql, export_md_to_json.py, import_json.js}
└─ docs/
```

---

## 给各 Agent 的对接摘要

### → 前端工程师
- Base URL：`http://localhost:4000/api/v1`
- 通用响应：`{ success, data, meta }` / 失败 `{ success, error:{code,message,details} }`
- 页面对照：看板 `GET /dashboard/summary` + `GET /courses`；阅读 `GET /readings`；
  词汇 `GET /vocabulary/stats` + `GET /vocabulary?letter=`；错词 `GET /mistakes`。
- **注意**：本阶段不要求前端改动，`review/*.html` 保持不动，接口在你确认切换后再对接。

### → Amy / Skill 设计师
- 核心接口：`GET /agent/snapshot?recent=3` —— 一次拿到级别/进度、最近课程、
  未过关错词（含优先级）、阅读目录。等价于把 `digest.md` 升级为 JSON。
- 写接口：`POST /mistakes/:id/review`（连击与过关）、`POST /progress/feedback`（升降级）。
- 教学规则后端**只搬运不重设计**，规则来源为现有 `progress.md`。

### → Git / 版本管理工程师
- 本次新增仅 `backend/` 目录（6 个文件），未修改、未删除任何既有文件。
- 实现阶段需补充 `.gitignore`：`.env`、`node_modules/`、`db/_snapshot.json`。

---

## 落地前置条件

1. **MySQL root 密码**（本机 8.0.27 已在 3306 运行，当前无法连接）。
2. 确认是否需要多用户（默认单用户，schema 已预留 `user_id`）。
3. 确认是否启动 M5（把静态看板改为动态前端，涉及前端职责）。
