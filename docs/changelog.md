# 变更记录（Changelog）

> 记录方式：一个提交一条，按时间倒序。格式：`- <日期> · <短哈希> · <提交信息>`
> 本文件由 Git / 版本管理工程师维护。

---

## 2026-09-29

- 2026-09-29 · （本次） · `chore: establish project baseline` —— 建立项目版本基线
  - 纳入版本管理的既有文件：`PROJECT.md`、`AGENTS.md`、`backend/`、`digest.md`、`read/2026-09-28-read.md`、`read/2026-09-29-read.md`、`review/reading.html`、`review/readIndex.html`、`review/words.html`、`review/wrong.html`、`review/lessons/lesson-5.html`、`review/lessons/lesson-6.html`
  - 同步更新：`INDEX.md`、`progress.md`、`wrong-words.md`、`notes/day-01-07.md`、`review/index.html`、`review/lessons/lesson-1~4.html`
  - 版本管理调整：`.gitignore` 增加临时打包目录、`.env`、`node_modules/`、`db/_snapshot.json`
- 2026-09-29 · （本次） · `docs: add documentation skeleton` —— 新增 `docs/` 骨架（architecture / api / database / ai-teacher / skills / changelog）

## 2026-09-29（阶段二：后端落地 + 前后端联调）

- 2026-09-29 · 4c29813 · `feat: add backend foundation` —— 后端从设计进入实现：分层代码（config/utils/middlewares/repositories/services/controllers/routes）、`db/init.js`、`db/seed.js`、`schema.sql`（第一阶段 8 表 + 2 视图）、`docs/05-api-reference.md` 与 `06-api-requirements-amy.md`、校验脚本 `smoke-test.js` / `integration-check.js`
- 2026-09-29 · 4377603 · `feat: connect dashboard with backend api` —— `review/index.html` 切换为后端 API 实时取数；其余 review 页面为 `build_board.py` 重建产物
- 2026-09-29 · 5e96775 · `docs: add skill schemas and ai learning data flow` —— `docs/schemas/` 12 个 JSON Schema、Amy 教学规则与 Skill 设计、联调报告、第 7 课计划（首次由后端 API 供数）

## 2026-09-27

- 2026-09-27 · 80427d7 · `docs: 第 3、4 课归档，级别升至 Level 2`

## 2026-09-26

- 2026-09-26 · f5c63f6 · `docs: 第 2 课批改归档，阅读材料抽取独立文件`
- 2026-09-26 · 858f8f9 · `chore: 添加 .gitignore 并整理仓库内容`
- 2026-09-26 · 0170c5e · `first-commit`
- 2026-09-26 · 21689ce · `first commit`

---

## 基线说明

`21689ce` ～ `80427d7` 为「学习数据单线推进」阶段，仓库只有笔记与看板；
2026-09-29 起进入「平台化」阶段（新增 `PROJECT.md`、`AGENTS.md`、`backend/`），
自此建立正式版本基线，后续变更需按 `AGENTS.md` 的角色分工产出。
