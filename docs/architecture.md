# 架构文档（Architecture）

> **状态：TODO（骨架）**
> 本文件只登记「已存在的权威资料」与「待补充项」，不凭空写入未确认的设计。
> 由后端工程师 / 前端工程师按 `AGENTS.md` 的职责分工补充正文。

---

## 一、已有权威资料（补充正文前必读，禁止另写一套）

| 资料 | 位置 | 说明 |
|---|---|---|
| 项目目标与理念 | `PROJECT.md` | 目标、核心理念（Amy / Skill / Backend / Database / Frontend / Git）、推荐技术栈 |
| 角色与协作规范 | `AGENTS.md` | 5 个角色的职责边界、协作链、数据流、禁止事项 |
| 后端架构设计稿 | `backend/docs/01-architecture.md` | 分层架构、技术选型、目录规划（**设计阶段，无实现代码**） |
| 后端说明 | `backend/README.md` | 后端状态说明、文档索引、各 Agent 对接摘要 |

---

## 二、当前已确认的现状（摘录自上述文件，非推测）

- **前端**：`review/*.html` 为**纯 API 驱动的静态页**（前端资产）——数据由 `review/assets/api.js` 经后端 API 获取，样式与交互在 `review/assets/{board.css,ui.js}`；**已不再由 `build_board.py` 生成**。`build_board.py` 自 2026-09-29 起退役 HTML 生成，只保留 md 解析并产出 `INDEX.md` / `digest.md`，**不得再写 `review/*.html`**（会静默覆盖前端改动）。
- **后端**：`backend/` 已有可运行代码（Express + MySQL 分层：`routes` / `controllers` / `services` / `repositories`）；第一版只读 API 已上线（16 个 `GET`，前缀 `/api`，冒烟测试 `npm run test:api` 通过）；写接口与 `GET /api/agent/snapshot` 仍缺。
- **数据库**：MySQL 8.0 已建库执行；第一阶段 8 表（`students` / `lessons` / `lesson_sections` / `vocabulary` / `lesson_vocabulary` / `mistakes` / `study_records` / `progress`）+ 2 视图已生效，并按序补入 `lesson_exercises`、`mistake_events` 等表；DDL 一律先 `db/schema.sql` → 库内 → `src/constants.js`。
- **数据真相源**：markdown 仍是内容真相源（`notes/`、`read/`、`progress.md`、`wrong-words.md`、`INDEX.md`、`digest.md`），仅 md 适配层可读；后端对「学习记忆」（进度、错词、学习记录）为真相源。
- **版本管理**：Git + GitHub（`origin` → `Zane42186/EnglishStudy`），单分支 `main`。

---

## 三、待补充（TODO）

- [ ] 整体架构图（学生 → 前端 → 后端 → 数据库 → Skill → Amy 的实际部署形态）
- [ ] 前端页面清单与各自职责（待前端工程师登记）
- [ ] 后端分层实现落地后的目录与模块说明（待 M1–M4 实施后补充，见 `backend/docs/04-migration-and-roadmap.md`）
- [ ] 运行环境与启动方式（Node / MySQL 版本、端口、环境变量）
- [ ] 静态看板 → 动态前端 的切换方案与时间点（**已进行中**：页面已改为纯 API 驱动静态页、`build_board.py` 已退役 HTML 生成，见上文「前端」条目；待补：各页面的 API 覆盖进度与 Vue 评估时点）

---

## 四、变更约定

本文件的任何架构结论若与 `PROJECT.md` / `AGENTS.md` 冲突，以二者为准；
确需变更架构的，按 `AGENTS.md` 第 2.2 条先说明影响范围再实施，并通知 Git 工程师记录基线。
