# Skill 文档（Skills）

> **状态：TODO（骨架）**
> 项目确实有一个正在使用的 Skill（`english-daily`），但它**位于不入库的工作区目录**，
> 仓库内目前没有 Skill 源码。正文由 Skill 设计师补齐。

---

## 一、已确认的现状（非推测）

- 正在使用的 Skill：`english-daily`（每日英语课流程）。
- 安装位置：`.workbuddy/skills/english-daily/` —— **该目录已被 `.gitignore` 排除，不在版本库内**。
- 仓库内可见的副本：`english-daily.zip`（打包产物，同样已被 `.gitignore` 排除）。
- Skill 产出物（入库）：`notes/`、`read/`、`progress.md`、`wrong-words.md`、`INDEX.md`、`digest.md`、`review/*.html`。

---

## 二、风险登记（Git 视角）

> Skill 源码当前**不受版本管理**。一旦工作区目录丢失，`english-daily` 无法从仓库恢复。
> 建议 Skill 设计师决定：将 Skill 源码纳入 `skills/` 目录入库，或在本文档中登记恢复方式。

---

## 三、待补充（TODO）

- [ ] Skill 清单与各自职责（daily-lesson / grammar-teaching / vocabulary-teaching / exercise-generation / answer-grading / mistake-analysis / learning-progress-analysis / next-lesson-planning，见 `AGENTS.md`）
- [ ] 每个 Skill 的输入 / 输出格式（JSON Schema）
- [ ] Skill 与后端 `GET /agent/snapshot` 的对接方式
- [ ] Skill 源码是否需要入库的决策结论
