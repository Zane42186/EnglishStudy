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

### 已建表（13 张）与实测行数

| 表 | 行数 | 说明 |
|---|---|---|
| `students` | 1 | 学生（Zane） |
| `lessons` | 6 | 课程（第 1—6 课） |
| `lesson_sections` | 51 | 课程小节（每课 8 类，2026-09-30 由 12 条回填；另含 3 课补漏块 `backfill`） |
| `vocabulary` | 51 | 词汇库（**学生内单词唯一**，已去重） |
| `lesson_vocabulary` | 52 | 课程 ↔ 词汇关联（按课累计，`tired` 在第 2、6 课各一次） |
| `mistakes` | 19 | 错词本（**pending 15 / passed 4**；参见第九节待办：错词本已 23 行，库内仍是 19） |
| `study_records` | 18 | 学习记录（6 课 × 上课/批改/反馈） |
| `progress` | 1 | 学习进度（Level 2 · 第 6 课） |
| `lesson_exercises` | 34 | 练习记录（作业 25 + 补漏块 9，2026-09-30 回填；含 `self_check` 列） |
| `mistake_events` | 0 | 错词事件流水（P0 表，幂等键 `uk_me_client`，待写入） |
| `readings` | 4 | 阅读日（一天一行，`uk_reading_day`，2026-09-30 建并回填 4 天） |
| `reading_pieces` | 11 | 阅读篇（`uk_piece`，含 `source_url`，2026-09-30 回填 11 篇） |
| `reading_questions` | 22 | 阅读理解题（`uk_rq`，2026-09-30 回填 22 题） |

### 已建视图（2 个）

- `v_dashboard_stats` —— 看板统计（课程数 / 当前级别 / 词汇总数 / 未过关错词数 / **阅读篇数 `reading_piece_count`** / **阅读天数 `reading_day_count`**，后两列 2026-09-30 追加）
- `v_pending_mistakes` —— 未过关错词（等价 `digest.md` 的「待复习」段）

---

## 三、Schema 要点

- **主键用自增 `id`**，业务唯一键 `uk_lessons_no (student_id, lesson_no)`——替代旧体系里脆弱的「课号字符串关联」。
- **`lesson_sections.content_md`** 用 MEDIUMTEXT 保存原始 Markdown，**不丢信息**。
- **`mistakes`** 含掌握度字段：`streak`（连续答对，≥2 判过关）、`wrong_count`（累计犯错）、`status`（pending/passed）、`error_type`（6 类）。
  - 业务唯一键 **`uk_mistakes_text (student_id, wrong_text)`** —— 同一学生下「错误点」唯一。这是 `seed.js` 的 `INSERT ... ON DUPLICATE KEY UPDATE` **能真正触发幂等**的前提（见第五节 DQ1）。
- **`lesson_exercises`** 以 `uk_exercise (lesson_id, block_kind, block_no, exercise_no)` 唯一 —— `exerciseNo` 是**块内**题号，作业与补漏块各自从 1 开始，必须带上 `block_kind` + `block_no` 才唯一。
- **`lesson_sections.section_type`** 共 11 值，`backfill`（补漏块整段原文）为 2026-09-30 追加值。
- **`mistake_events`** 以 `uk_me_client (student_id, client_event_id)` 做写入幂等（写接口重复提交只记一次）。
- **`lesson_exercises.self_check`**（`VARCHAR(128) NULL`）—— 本题点名的强制自查项。此前 `exercise-set.schema.json` 的 `ExerciseItem.selfCheck` 在 `LessonRecord.ExerciseRecord` 与表中**都没有对应字段**，归档时会**静默丢弃**（2026-09-30 已补列闭合，见第六节）。
- **`readings` / `reading_pieces` / `reading_questions`** 三层：「阅读日 → 当天第几篇 → 篇内第几题」，幂等键依次是 `uk_reading_day (student_id, read_date)` / `uk_piece (reading_id, piece_no)` / `uk_rq (piece_id, question_no)`。`reading_pieces.body_md` 存**英中对照逐段**原文（英文行 + `> 中文` 行），`vocabulary_notes` 存「生词注释」整行，`word_count` 由写库器按英文词数计算；`source_url`（2026-09-30 追加，见第八之二节）存新闻原文链接。设计稿 `schema.full.design.sql` §10—§12 用的是已废弃的 `users` / `user_id`，**以本文件与 `schema.sql` 的 `students` / `student_id` 为准**。
- **外键删除策略统一 `RESTRICT`**：学习数据只增不删（阅读三表同样不带 `ON DELETE CASCADE`；重导入时由写库器在同一事务内显式删除子行）。
- 枚举与 `backend/src/constants.js` **同源**，改枚举必须先改表（`lesson_sections.section_type` 已含 `objectives` / `expected_mistakes`）。

### 口径说明（2026-09-30 更新，看板已改为纯 API 驱动）

`review/` 看板不再硬编码统计，直接取库内值，历史「看板 vs 库内」差异**已消除**。现行口径：

| 指标 | 库内（= 看板现值） | 同口径换算 | 原因 |
|---|---|---|---|
| 累计生词 | **51** | 52（按课累计） | 库内按 `word` 去重，`tired` 在第 2、6 课重复 |
| 未过关错词 | **15** | 16（不归并） | 库内归并 `play game`（第 4、6 课各记一次） |
| 错词总数 | **19** | 20（不归并） | 归并 `play game` 1 条后为 20；DQ1 再剔除 1 条非错题 → 19 |

> 口径统一原则：**以库内为准**（写接口取数一律走库）。
> ⚠️ **错词本 `wrong-words.md` 已于 2026-09-30 由 Amy 扩充为 23 行**（新增 `work.So` / `intrusting` /
> `Our teacher is Amy together.` / `Now, My` 4 条漏登记项）。库内仍是 **19** 条——因 `db:import` 按既定规则
> **不写 `mistakes`**（权威在 md，需 Amy 判定的字段不自动推导）。差异待处理，见第九节。

---

## 四、迁移现状

**M2 自动迁移已闭环**（2026-09-30）。链路三段，命令都在 `backend/`：

| 段 | 命令 | 性质 |
|---|---|---|
| 导出 | `npm run db:export` | 只读：md + `records/` + 错词本 + `read/` → `db/migration/_snapshot.json` |
| 验收 | `npm run db:compare` | 只读：快照 vs 库内逐项比对 |
| 写库 | `npm run db:import` | 写库：单事务 + 幂等 upsert（支持 `--dry-run`） |

首次建库顺序：`npm run db:init` → `npm run db:export` → `npm run db:import`。
实测 `db:init` 重跑不会回退回填内容（`seed.js` 的 `lesson_sections` 写入已改为冲突时空操作）。
明细与逐项验收见 `backend/docs/04-migration-and-roadmap.md` §五之三。

`seed.js` 的两条写入约束（已实现）：

1. **非错题不导入（DQ1 规则）** —— `correct` 为空 / `—` / `-` / `n/a` 或 `wrong_count = 0` 的行不入库（实测 21 条来源 → 19 条入库）。
2. **按 `uk_mistakes_text` 幂等** —— 重跑 `db:init` 不会让 `mistakes` 翻倍。
3. **小节内容冲突时不覆盖** —— `lesson_sections` 的 `grammar` / `feedback` 只在缺失时写入，
   已存在的（含 `db:import` 回填的 md 原文）保持不变。

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

## 七、题块与补漏块归置（2026-09-30 已执行）

**问题**：笔记里的 `### 补漏块 N · <主题>` 是**与 `### 作业` 同构的第二份题集**（整段就是题干列表）。它与作业**共用一套题号**（各自从 1 开始），因此 `lesson_exercises` 原唯一键 `uk_exercise (lesson_id, exercise_no)` 会撞车；且补漏块原文本无对应 `SectionType`，会被解析链静默丢弃。

**修复（两项 DDL 已执行，口径见 `docs/skills.md` 2.5）**：

```sql
ALTER TABLE lesson_exercises
  ADD COLUMN block_kind ENUM('homework','backfill') NOT NULL DEFAULT 'homework' AFTER lesson_id,
  ADD COLUMN block_no   SMALLINT UNSIGNED NOT NULL DEFAULT 0
                        COMMENT '补漏块编号 N；0 = 作业题，不属于补漏块' AFTER block_kind,
  DROP INDEX uk_exercise,
  ADD UNIQUE KEY uk_exercise (lesson_id, block_kind, block_no, exercise_no);

ALTER TABLE lesson_sections
  MODIFY COLUMN section_type ENUM('review','grammar','vocab_table','examples',
                                  'homework','my_answer','grading','feedback',
                                  'objectives','expected_mistakes','backfill') NOT NULL;
```

- **`block_no` 必须 NOT NULL、作业取 0**：MySQL 唯一键**不约束 NULL**，若作业行留空就失去去重能力。
- **`backfill` 追加在枚举末尾**：MySQL 按内部索引存储，插中间会让既有行静默错位。
- **回滚 SQL**：
  ```sql
  ALTER TABLE lesson_sections
    MODIFY COLUMN section_type ENUM('review','grammar','vocab_table','examples',
                                    'homework','my_answer','grading','feedback',
                                    'objectives','expected_mistakes') NOT NULL;
  ALTER TABLE lesson_exercises
    DROP INDEX uk_exercise,
    ADD UNIQUE KEY uk_exercise (lesson_id, exercise_no),
    DROP COLUMN block_no,
    DROP COLUMN block_kind;
  ```
  > ⚠️ 回滚前必须确认表内 `block_kind='backfill'` 的行已清空，否则新唯一键会因重复 `exercise_no` 失败。

**执行记录**：

- 变更前备份：`backend/db/backup-20260930-before-blockkind.sql`（**含数据**，8 条 INSERT；已实测可在临时库重放 → 12 表 / `lesson_sections`=12 / `mistakes`=19）。
- 验证：`uk_exercise` 实际为 `lesson_id, block_kind, block_no, exercise_no`（4 列）；`section_type` 末尾为 `backfill`；数据计数未变（sections 12 / exercises 0 / mistakes 19 / lessons 6）。
- 端到端：`write-api-check.js` 的 D2 段（SC1—SC8）——同课同题号分别落 `homework#0` 与 `backfill#1` 可共存、`selfCheck` 可读回、同块重复题号被 `ER_DUP_ENTRY` 拦下。
- 三处枚举同源已同步：`backend/db/schema.sql` / `backend/src/constants.js`（新增 `EXERCISE_BLOCK_KIND`）/ `docs/schemas/common.schema.json`（`ExerciseBlockKind`）。

### 阅读表（P1）已于 2026-09-30 建成

`read/` 目录有 4 天 11 篇，`readings` / `reading_pieces` / `reading_questions` 三张表**已于 2026-09-30 创建**（见第八节）。设计稿见 `schema.full.design.sql` §10—§12，但用的是已废弃的 `users` 命名，实际建表按 `students` 重写；`schema.sql` 已同步，`npm run db:init` 在新库也能建出这三张表。

---

## 八、阅读三表（2026-09-30 已执行）

**目的**：`read/*.md` 的 4 天 11 篇阅读此前只存在于文件里，前端「阅读篇数」恒为 `—`（R1）；快照 `readingCatalog` 因「依赖尚未建表」被列入 `degradation.affected`。建表后两者都有数据来源。

**DDL（已执行，同时写入 `backend/db/schema.sql`）**：

```sql
CREATE TABLE IF NOT EXISTS readings (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id  BIGINT UNSIGNED NOT NULL,
  read_date   DATE            NOT NULL COMMENT '阅读日（一天一行）',
  source_file VARCHAR(64)     NULL COMMENT '来源 md 文件名，如 2026-09-29-read.md',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_reading_day (student_id, read_date),
  CONSTRAINT fk_reading_student FOREIGN KEY (student_id) REFERENCES students (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='阅读日（一天一行）';

CREATE TABLE IF NOT EXISTS reading_pieces (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reading_id       BIGINT UNSIGNED NOT NULL,
  piece_no         SMALLINT UNSIGNED NOT NULL COMMENT '当天第几篇，从 1 开始',
  level_code       VARCHAR(16)     NULL COMMENT '如 Level 1',
  source           VARCHAR(128)    NULL COMMENT '自编 / 新闻来源',
  source_url       VARCHAR(512)    NULL COMMENT '原文链接；来源为新闻时填写，自编为 NULL（ReadingSet.sourceUrl）',
  title            VARCHAR(255)    NULL,
  body_md          MEDIUMTEXT      NOT NULL COMMENT '正文（英中对照，逐段）',
  vocabulary_notes TEXT            NULL COMMENT '生词注释',
  word_count       SMALLINT UNSIGNED NULL COMMENT '英文词数（导出时计算）',
  order_index      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_piece (reading_id, piece_no),
  CONSTRAINT fk_piece_reading FOREIGN KEY (reading_id) REFERENCES readings (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='阅读篇';

CREATE TABLE IF NOT EXISTS reading_questions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  piece_id    BIGINT UNSIGNED NOT NULL,
  question_no SMALLINT UNSIGNED NOT NULL COMMENT '篇内题号，从 1 开始',
  question    TEXT            NOT NULL,
  answer      TEXT            NULL,
  order_index SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_rq (piece_id, question_no),
  CONSTRAINT fk_rq_piece FOREIGN KEY (piece_id) REFERENCES reading_pieces (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='阅读理解题';

-- 看板视图追加两列（追加在末尾，属加法变更）
CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT s.id AS student_id, s.name AS student_name,
  (SELECT COUNT(*) FROM lessons l WHERE l.student_id = s.id)                    AS lesson_count,
  (SELECT p.current_level FROM progress p WHERE p.student_id = s.id)           AS current_level,
  (SELECT COUNT(*) FROM vocabulary v WHERE v.student_id = s.id)                AS vocab_total,
  (SELECT COUNT(*) FROM mistakes m WHERE m.student_id = s.id AND m.status='pending') AS pending_mistake_count,
  (SELECT COUNT(*) FROM reading_pieces rp
     JOIN readings r ON r.id = rp.reading_id WHERE r.student_id = s.id)         AS reading_piece_count,
  (SELECT COUNT(*) FROM readings r WHERE r.student_id = s.id)                   AS reading_day_count
FROM students s;
```

**回滚 SQL**：

```sql
DROP TABLE IF EXISTS reading_questions;
DROP TABLE IF EXISTS reading_pieces;
DROP TABLE IF EXISTS readings;
CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT s.id AS student_id, s.name AS student_name,
  (SELECT COUNT(*) FROM lessons l WHERE l.student_id = s.id)                    AS lesson_count,
  (SELECT p.current_level FROM progress p WHERE p.student_id = s.id)           AS current_level,
  (SELECT COUNT(*) FROM vocabulary v WHERE v.student_id = s.id)                AS vocab_total,
  (SELECT COUNT(*) FROM mistakes m WHERE m.student_id = s.id AND m.status='pending') AS pending_mistake_count
FROM students s;
```

**执行记录**：

- 变更前备份：`backend/db/backup-20260930-before-readings.sql`（**含数据**，10 `CREATE TABLE` + 8 `INSERT INTO`，可重放）。
- 验证：表数 10 → **13**；`uk_reading_day` = `student_id, read_date`、`uk_piece` = `reading_id, piece_no`、`uk_rq` = `piece_id, question_no`（均按 `seq_in_index` 核对）；既有数据计数与 `mistakes` md5（`7f9ad9e713d4ed3cfd0e7f7808cfd5d2`）**均未变**。
- 视图读回：`lesson_count=6 / current_level=Level 2 / vocab_total=51 / pending_mistake_count=15 / reading_piece_count=0 / reading_day_count=0`（后两列为 0 是回填前预期值）。

### 八之二、`reading_pieces.source_url` 追加列（2026-09-30 已执行）

**目的**：`ReadingSet.piece.sourceUrl`（契约字段，来源为新闻时的原文链接）此前**无处存放**——`reading_pieces` 没有对应列，写入路径会**静默丢弃**该字段。开放 `POST /api/readings` 前必须补列，否则教学侧传了链接却被吞掉且无任何报错。

**DDL（已执行，同时写入 `backend/db/schema.sql`）**：

```sql
ALTER TABLE reading_pieces
  ADD COLUMN source_url VARCHAR(512) NULL
  COMMENT '原文链接；来源为新闻时填写，自编为 NULL（ReadingSet.sourceUrl）'
  AFTER source;
```

- **加法变更**（末尾/指定位置追加可空列），不动任何既有列与索引，不影响存量 11 行（新列为 `NULL`）
- `VARCHAR(512)` 与 `mistakes.wrong_text` / `correct_text` 同宽，足以容纳常见新闻 URL

**回滚 SQL**：

```sql
ALTER TABLE reading_pieces DROP COLUMN source_url;
```

**执行记录**：

- 变更前备份：`backend/db/backup-20260930-before-sourceurl.sql`（**含数据**，可重放）。
- 验证：`SHOW COLUMNS` 中 `source_url` 位置在 `source` 之后、类型 `varchar(512)` 且 `Null=YES`；
  `reading_pieces` 行数仍为 **11**，`body_md` md5 `9b50aa22d2417f81ea9362d5aa4b10e9` **未变**（证明追加列未改写存量数据）。
- 回归：`npm run test:write` 的 **RW7** 用例断言 `sourceUrl` 落库并可经 `GET /api/readings/:date` 读回（此前该用例不存在，因字段必被丢弃）。

---

## 九、待补充（TODO）

- [x] 自动迁移链路已全落地：只读导出 `export_md_to_json.py` + 只读验收 `compare_snapshot.js` + **写库器 `import_json.js`**（`backend/db/migration/`，2026-09-30）
- [x] `readings` / `reading_pieces` / `reading_questions` 三张表（P1，见第八节，2026-09-30 已建）
- [x] 阅读数据回填（4 天 / 11 篇 / 22 题）+ `v_dashboard_stats` 加 `reading_piece_count` / `reading_day_count`
- [x] `lesson_exercises` 回填 34 条（作业 25 + 补漏块 9，2026-09-30）
- [x] `POST /api/readings`（教学侧在线写当天阅读）已开放 —— 单事务 + 幂等判重，同日已存在 → 409，
  显式 `?force=true` 为重出例外；`reading_pieces.source_url` 追加列同步落地（见第八之二节、`05-api-reference.md` §27）
- [ ] `lesson_exercises.error_type` 全为 NULL（34/34）——待 amy 统一 `records.mistakeCandidates` 与错词本措辞后逐题判定
- [ ] **`mistakes` 全表待与错词本对齐**（库内 19 vs `wrong-words.md` 23）：① **缺 4 行**（`work.So` /
  `intrusting` / `Our teacher is Amy together.` / `Now, My`）；② **8 行 `wrong_text` 仍带括号批注**
  （库内为旧格式，如 `zane（人名小写）`，md 已按新规则改为 `zane`）。
  **已决（2026-09-30，项目负责人）：维持现状** —— `mistakes` 由 Amy 落地时**人工 / 一次性迁移**写入，
  **后端不碰**（`db:import` 不写 `mistakes` 的既有约定不变）。故 `db:export` 报 23、库内 19 是**已知预期差异**，
  `db:compare` 的 3 条差异同源，均**不是缺陷**。
- [ ] 长期设计中的其余表（知识点地图 `knowledge_points`、Skill 运行记录等）
- [ ] 备份与恢复策略（学习数据为长期资产，需明确频率与存放位置）
- [ ] `schema.full.design.sql` 同步业务唯一键 `uk_mistakes_text`、`self_check`、`block_kind` / `block_no` 与 `backfill`，并把 `readings` 三表的 `users` 命名改为 `students`；该设计稿仍用已废弃的 `courses`/`user_*` 命名，且 `exercises` 表还缺 `target_point` / `revised_answer`，**已落后实际表 7 个字段**，需整体重审后再动
