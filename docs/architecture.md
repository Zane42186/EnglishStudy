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

- **前端**：`review/*.html` 静态页面（Dashboard / 课程 / 阅读 / 词汇 / 错词），由 `build_board.py` 生成，目前无构建工具链、无 API 调用。
- **后端**：目录 `backend/` 内只有设计文档与 `db/schema.sql`，**没有可运行代码**（无 `package.json`、无 `src/`）。
- **数据库**：MySQL 8.0，schema 为设计稿，**尚未执行**。
- **数据真相源**：Markdown 文件 —— `notes/`、`read/`、`progress.md`、`wrong-words.md`、`INDEX.md`、`digest.md`。
- **版本管理**：Git + GitHub（`origin` → `Zane42186/EnglishStudy`），单分支 `main`。

---

## 三、待补充（TODO）

- [ ] 整体架构图（学生 → 前端 → 后端 → 数据库 → Skill → Amy 的实际部署形态）
- [ ] 前端页面清单与各自职责（待前端工程师登记）
- [ ] 后端分层实现落地后的目录与模块说明（待 M1–M4 实施后补充，见 `backend/docs/04-migration-and-roadmap.md`）
- [ ] 运行环境与启动方式（Node / MySQL 版本、端口、环境变量）
- [ ] 静态看板 → 动态前端 的切换方案与时间点

---

## 四、变更约定

本文件的任何架构结论若与 `PROJECT.md` / `AGENTS.md` 冲突，以二者为准；
确需变更架构的，按 `AGENTS.md` 第 2.2 条先说明影响范围再实施，并通知 Git 工程师记录基线。
