# 数据库文档（Database）

> **状态：已创建并初始化 · 最后更新 2026-09-30**
> 数据库 `english_platform` 已在 MySQL 8.0.27 中创建，**10 张表 + 2 个视图**已建，含真实种子数据。
> 长期完整设计（18 表 + 2 视图）见 `backend/db/schema.full.design.sql`。

---

## 一、权威资料

| 资料 | 位置 | 说明 |
|---|---|---|
| **第一阶段可执行 Schema** | `backend/db/schema.sql` | 10 表 + 2 视图，由 `npm run db:init` 执行 |
| 初始化与种子 | `backend/db/init.js`、`backend/db/seed.js` | 建库建表 + **幂等**写入真实数据 |
| 长期完整设计稿 | `backend/db/schema.full.design.sql` | 18 表 + 2 视图（知识点地图、阅读、Skill 运行记录等），未执行 |
| 数据模型设计说明 | `backend/docs/02-data-model.md` | ER、字段字典、业务规则、Markdown ↔ DB 映射 |
| 迁移与路线 | `backend/docs/04-migration-and-roadmap.md` | md → DB 迁移方案与 M0–M5 路线 |
| 接口权威 | `backend/docs/05-api-reference.md` | 已实现接口的唯一权威（含真实响应） |

---

## 二、当前实际状态（非推测，均为实测）

- **数据库**：`english_platform`（MySQL 8.0.27，字符集 `utf8mb4` / `utf8mb4_unicode_ci`，InnoDB）
- **连接**：`127.0.0.1:3306`，账号配置在 `backend/.env`（不入版本库）
- **初始化命令**：`cd backend && npm run db:init`（**幂等，可安全重复执行**）；`npm run db:reset` 会先删库再重建

### 已建表（10 张）与实测行数

| 表 | 行数 | 说明 |
|---|---|---|
| `students` | 1 | 学生（Zane） |
| `lessons` | 6 | 课程（第 1—6 课） |
| `lesson_sections` | 12 | 课程小节正文（每课 2 条：今日语法 / 难度反馈） |
| `vocabulary` | 51 | 词汇库（**学生内单词唯一**，已去重） |
| `lesson_vocabulary` | 52 | 课程 ↔ 词汇关联（按课累计，`tired` 在第 2、6 课各一次） |
| `mistakes` | 19 | 错词本（**pending 15 / passed 4**） |
| `study_records` | 18 | 学习记录（6 课 × 上课/批改/反馈） |
| `progress` | 1 | 学习进度（Level 2 · 第 6 课） |
| `lesson_exercises` | 0 | 练习记录（P0 表，结构已建、待写入；含 `self_check` 列，2026-09-30 补） |
| `mistake_events` | 0 | 错词事件流水（P0 表，幂等键 `uk_me_client`，待写入） |

### 已建视图（2 个）

- `v_dashboard_stats` —— 看板统计（课程数 / 当前级别 / 词汇总数 / 未过关错词数）
- `v_pending_mistakes` —— 未过关错词（等价 `digest.md` 的「待复习」段）

---

## 三、Schema 要点

- **主键用自增 `id`**，业务唯一键 `uk_lessons_no (student_id, lesson_no)`——替代旧体系里脆弱的「课号字符串关联」。
- **`lesson_sections.content_md`** 用 MEDIUMTEXT 保存原始 Markdown，**不丢信息**。
- **`mistakes`** 含掌握度字段：`streak`（连续答对，≥2 判过关）、`wrong_count`（累计犯错）、`status`（pending/passed）、`error_type`（6 类）。
  - 业务唯一键 **`uk_mistakes_text (student_id, wrong_text)`** —— 同一学生下「错误点」唯一。这是 `seed.js` 的 `INSERT ... ON DUPLICATE KEY UPDATE` **能真正触发幂等**的前提（见第五节 DQ1）。
- **`mistake_events`** 以 `uk_me_client (student_id, client_event_id)` 做写入幂等（写接口重复提交只记一次）。
- **`lesson_exercises.self_check`**（`VARCHAR(128) NULL`）—— 本题点名的强制自查项。此前 `exercise-set.schema.json` 的 `ExerciseItem.selfCheck` 在 `LessonRecord.ExerciseRecord` 与表中**都没有对应字段**，归档时会**静默丢弃**（2026-09-30 已补列闭合，见第六节）。
- **外键删除策略统一 `RESTRICT`**：学习数据只增不删。
- 枚举与 `backend/src/constants.js` **同源**，改枚举必须先改表（`lesson_sections.section_type` 已含 `objectives` / `expected_mistakes`）。

### 口径说明（2026-09-30 更新，看板已改为纯 API 驱动）

`review/` 看板不再硬编码统计，直接取库内值，历史「看板 vs 库内」差异**已消除**。现行口径：

| 指标 | 库内（= 看板现值） | 同口径换算 | 原因 |
|---|---|---|---|
| 累计生词 | **51** | 52（按课累计） | 库内按 `word` 去重，`tired` 在第 2、6 课重复 |
| 未过关错词 | **15** | 16（不归并） | 库内归并 `play game`（第 4、6 课各记一次） |
| 错词总数 | **19** | 20（不归并） | 归并 `play game` 1 条后为 20；DQ1 再剔除 1 条非错题 → 19 |

> 口径统一原则：**以库内为准**。错词本 `wrong-words.md` 现为 19 行，与库内 19 条一致。

---

## 四、迁移现状

**本期未执行 Markdown → 数据库的自动迁移**：种子数据是依据 `progress.md` / `wrong-words.md` / `notes/day-01-07.md` 手工整理后写入 `seed.js` 的。
自动迁移（复用 `build_board.py` 解析规则：Python 导出 JSON → Node 入库）仍在 `04-migration-and-roadmap.md` 的 **M2** 阶段，待后续实施。

当前 `seed.js` 的两条写入约束（已实现）：

1. **非错题不导入（DQ1 规则）** —— `correct` 为空 / `—` / `-` / `n/a` 或 `wrong_count = 0` 的行不入库（实测 21 条来源 → 19 条入库）。
2. **按 `uk_mistakes_text` 幂等** —— 重跑 `db:init` 不会让 `mistakes` 翻倍。

---

## 五、DQ1 幂等迁移（2026-09-30 已执行）

**问题**：`seed.js` 用 `INSERT ... ON DUPLICATE KEY UPDATE`，但 `mistakes` 表此前**只有 `PRIMARY KEY (id)`**，`ON DUPLICATE` 永不命中 → **重跑 `npm run db:init` 会让 `mistakes` 直接翻倍**（实测 19 → 38、20 → 40）。其余 7 张表均幂等。

**修复**：

1. `backend/db/schema.sql` 为 `mistakes` 增加业务唯一键：
   ```sql
   UNIQUE KEY uk_mistakes_text (student_id, wrong_text)
   ```
2. `backend/db/seed.js` 增加 `isRealMistake()` 过滤（DQ1：非错题不导入）。

**执行记录**：

- 变更前备份：`backend/db/backup-20260930-before-uk-mistakes.sql`（**含数据**，8 条 INSERT 语句）。
  > ⚠️ 更早的 `backup-20260929-before-ddl.sql` 是 `mysqldump --no-data` 产出的**纯结构**文件，**不能重放数据**。
- DDL：`ALTER TABLE mistakes ADD UNIQUE KEY uk_mistakes_text (student_id, wrong_text);`
- 验证：重跑 `npm run db:init` 后 `mistakes` 仍为 **19**，数据指纹（md5）`60caf4d3240206bb50c25ab20fe5a0f3` 前后一致；`pending 15 / passed 4` 未变。

---

## 六、selfCheck 补列（2026-09-30 已执行）

**问题**：`exercise-set.schema.json` 的 `ExerciseItem.selfCheck`（教学侧生成）在 `LessonRecord.ExerciseRecord` 与 `lesson_exercises` 表中**都没有对应字段** → 归档时静默丢弃，F4-a（只读自查清单）永远取不到数据。

**修复（三层同时补）**：

| 层 | 文件 | 变更 |
|---|---|---|
| 表 | `backend/db/schema.sql` | `lesson_exercises` 增加 `self_check VARCHAR(128) NULL` |
| 契约 | `docs/schemas/lesson-record.schema.json` | `ExerciseRecord.selfCheck`（`string \| null`，`maxLength 128`） |
| 接口 | `lesson.repository.js` / `lesson.service.js` / `backend/docs/05-api-reference.md` | SELECT 取列 → 映射为 `selfCheck` → 响应示例与说明同步 |

**执行记录**：

- 变更前备份：`backend/db/backup-20260930-before-selfcheck.sql`（**含数据**，8 条 INSERT / 10 张表，已实测可在临时库 `english_platform_bakcheck` 完整重放）。
- DDL：
  ```sql
  ALTER TABLE lesson_exercises
    ADD COLUMN self_check VARCHAR(128) NULL
    COMMENT '本题点名的强制自查项（exercise-set.schema.json selfCheck）' AFTER prompt;
  ```
- **回滚 SQL**：
  ```sql
  ALTER TABLE lesson_exercises DROP COLUMN self_check;
  ```
- 验证：`write-api-check.js` 新增 D2 段（SC1—SC4）——插入带 `self_check` 的练习 → `GET /api/lessons/:id/exercises` 读回 `selfCheck="句尾标点"` → 清理后 `lesson_exercises` 计数归零；`test:write` **35/35** 通过，全表计数零影响。

---

## 七、待补充（TODO）

- [ ] 自动迁移脚本 `export_md_to_json.py` + `import_json.js`（M2）
- [ ] 长期设计中的其余 8 张表（知识点、阅读、Skill 运行记录等）
- [ ] 写接口对应的数据变更路径已落地（错词连击、难度反馈升降级、学习记录写入）；待接的是 md→DB 归档
- [ ] 备份与恢复策略（学习数据为长期资产，需明确频率与存放位置）
- [ ] `schema.full.design.sql` 同步业务唯一键 `uk_mistakes_text` 与 `self_check`；注意该设计稿仍用已废弃的 `courses`/`user_*` 命名，且 `exercises` 表还缺 `target_point` / `revised_answer`，**已落后实际表 5 个字段**，需整体重审后再动
