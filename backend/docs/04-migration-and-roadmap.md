# 04 · 迁移方案与落地路线

> 状态：**设计稿**。原则：**现有 Markdown 是真相源，只读不改；迁移是单向的 md → DB。**

---

## 一、迁移原则

1. **不破坏**：`review/*.html`、`INDEX.md`、`digest.md`、`notes/`、`read/`、`progress.md`、`wrong-words.md` 全程保持不动。
2. **单向**：只把 md 导入数据库，**绝不反向写回 md**。
3. **可重复**：迁移脚本幂等（重复运行结果一致），用业务唯一键 `ON DUPLICATE KEY UPDATE` 实现。
4. **可回溯**：每行保留 `source_file`（如 `day-01-07.md`），出问题能定位来源。
5. **不丢信息**：结构性弱的内容（复述段落等）原样存进 `course_sections.content_md`。

---

## 二、解析器归属（2026-09-30 更新：已改为自包含）

`build_board.py` 里曾有一套经过生产验证的 Markdown 解析规则（`LESSON_RE` / `SUMMARY_RE` / `SECTION_ORDER` / `parse_vocab` / `parse_piece` / `parse_wrong_words`）。原计划是**复用**它以避免规则漂移。

**现状已变**：`build_board.py` 已退役待清理（见 `docs/skills.md` 7.3），其删除前置条件是「不再有脚本 import 它」。因此 `export_md_to_json.py` 已改为**内联所需正则与解析函数、零外部依赖**——正则语义与 `build_board.py` 保持一致，但不再 import。

**同时数据源已从「md 单一来源」改为「md 题面 + `records/` 判定」双源**：

```
notes/*.md（题面 / 小节正文 / 词汇）   records/lesson-NN.*.json（逐题判定）
read/*.md（阅读）   wrong-words.md（错词本·权威）   progress.md（级别）
        │
        ▼  export_md_to_json.py   ← 自包含解析，只读，不写任何 md
   _snapshot.json（结构化快照，含对账统计）
        │
        ▼  import_json.js         ← 单事务 + 幂等 upsert
      MySQL
        │
        ▼  /api/readings · /api/agent/snapshot …
     前端 / Amy 教学读取
```

- `export_md_to_json.py`：**只读**，产出 `_snapshot.json`（已加 `.gitignore`）。md 供**题面**，`records/` 供**判定**；`wrong-words.md` 是错词的唯一权威，`records` 的 `mistakeCandidates` 只做交叉校验、**不得新建错词**。
- `import_json.js`：单个事务内按依赖顺序 upsert。**实际写入范围**（2026-09-30 落地）：

  | 表 | 动作 | 幂等键 |
  |---|---|---|
  | `lessons` | 仅补 `lesson_date IS NULL`（含「同日沿用当日日期」），**绝不覆盖 `error_count` 等历史值** | `uk_lessons_no` |
  | `lesson_sections` | upsert md 原文小节（含 `backfill`） | `uk_section (lesson_id, section_type)` |
  | `lesson_exercises` | upsert 逐题（题干 + 判定 + `selfCheck` + `target_point`） | `uk_exercise (lesson_id, block_kind, block_no, exercise_no)` |
  | `readings` / `reading_pieces` / `reading_questions` | 按天整体重建（阅读是 md 派生物，子行先删后插） | `uk_reading_day` / `uk_piece` / `uk_rq` |
  | `study_records` | 把 `recordsSummary.homework.byType` 合并进 `record_type='grade'` 的 `payload`（已有则不覆盖） | 按 `(student_id, lesson_id, record_type)` 定位 |
  | `mistakes` | **不写** | — |
  | `vocabulary` / `lesson_vocabulary` | **不写**（库内已一致，仅做计数断言） | — |

- 未在本脚本内的表（`progress`、`mistake_events`、`students`）由 `db/seed.js` 与写接口负责，回填器不碰。

---

## 三、字段映射

见 `02-data-model.md` 第六节。要点：

| md 来源 | 目标表 | 备注 |
|---|---|---|
| `## 第 N 课 · 日期` | `courses` | 同日第二课无日期 → `lesson_date=NULL`，沿用当日 |
| `### 词汇` 表行 | `vocabulary` + `course_vocabulary` | 单词按 `word` 去重，`is_new` 由首次出现判定 |
| `### 作业` 编号题 | `exercises` | 题干与 `<details>` 答案拆分 |
| `wrong-words.md` 表行 | `mistakes` | 「连续答对」「状态」直接映射；「第 3 次犯」→ `wrong_count` |
| 脏值 `第 诊断 课` | `mistakes.first_course_id=NULL` | 非数字课号 → 置空并记日志，不阻断迁移 |

---

## 四、落地里程碑（建议顺序）

| 阶段 | 内容 | 产出 | 依赖 |
|---|---|---|---|
| **M0（本次）** | 设计与文档 | 本目录 4 份文档 + `db/schema.sql` | 无 ✅ |
| M1 | 建库建表 | 执行 `schema.sql`，`BOARD_OK` 式校验输出 | **需 root 密码** |
| M2 | 迁移脚本 | `export_md_to_json.py` + `import_json.js`，跑通历史数据导入 | M1 |
| M3 | 只读 API | courses / vocabulary / reading / mistakes / progress / dashboard / agent snapshot | M2 |
| M4 | 写接口与业务规则 | `POST /courses`、`POST /mistakes/:id/review`、`POST /progress/feedback`（连击与升降级） | M3 |
| M5 | 前端对接（可选） | 前端工程师把静态页改为调用 API；**需前端 Agent 参与** | M4 |

---

## 五、风险与回滚

### 5.1 DDL 前置动作（强制，2026-09-29 定为标准流程）

**执行任何 `CREATE TABLE` / `ALTER TABLE` / `DROP` / 数据修复之前，先导出一份可重放的结构备份。** 并在动手前**实测它能重放**，而不是只看文件存在。

```bash
# 1) 导出结构（纯结构，不含数据，体积小、可安全留存）
mysqldump -h127.0.0.1 -P3306 -uroot -p"$PW" \
  --no-data --routines --skip-comments --single-transaction \
  english_platform > db/backup-YYYYMMDD-<用途>.sql

# 2) 实测可重放（关键一步，别省）
mysql -e "DROP DATABASE IF EXISTS <db>_bakcheck; CREATE DATABASE <db>_bakcheck DEFAULT CHARSET utf8mb4;"
mysql <db>_bakcheck < db/backup-YYYYMMDD-<用途>.sql
mysql -N -e "SHOW TABLES FROM <db>_bakcheck;"   # 必须等于变更前的对象集合
mysql -e "DROP DATABASE <db>_bakcheck;"          # 清理临时库
```

约束：
- 备份文件**不入 Git**（`.gitignore` 已含 `backend/db/backup-*.sql`）——纯结构 dump 可由 `schema.sql` 重建，入库只会制造第二真相源与 churn。
- **每次 DDL 单独一个 commit**，只提交 `db/schema.sql`（枚举同步时加 `src/constants.js`），commit message 写明改了哪张表与**回滚 SQL**。
- 回滚锚点优先级：远端 `main`（已 push）> 备份分支 > 本地镜像 > 结构 dump > commit message 内的回滚语句。

### 5.2 风险

| 风险 | 应对 |
|---|---|
| 迁移写入脏数据 | 导入在**单事务**内；失败整体回滚，DB 不留半成品 |
| 解析规则与 md 不一致 | 复用 Python 已验证规则；导入后跑一致性校验（课数/词数/错词数与 `INDEX.md` 对比） |
| 影响现有静态看板 | 后端完全独立目录，**不改不删任何现有文件**；回滚 = 删掉 `backend/` 即可 |
| 密钥泄漏 | 密码走 `.env`；实现阶段先补 `.gitignore`（加 `.env`、`node_modules/`） |
| **ENUM 变更静默损坏既有行** | 新值**只追加末尾**，禁止插中间；变更后逐类型计数核对。详见 `01-architecture.md` §5.3.1 |

---

## 五之二、已执行的数据修复记录

> 只记录**已在本机 `english_platform` 实际执行过**的数据修复，供追溯与复原。表结构变更（DDL）见各次 commit。

### R-1 · 删除非错题记录 `mistakes.id=19`（2026-09-29，DQ1 / D-7）

```sql
-- 前置校验：确认无外键引用
SELECT COUNT(*) FROM mistake_events WHERE mistake_id = 19;   -- 实测 = 0
DELETE FROM mistakes WHERE id = 19
  AND (wrong_count = 0 OR correct_text IN ('—','-',''));
```

- 该行内容：`correct_text='—'`、`error_type='other'`、`streak=1`、`wrong_count=0`、`status='passed'`，语义上不是错题。
- 成因：`wrong-words.md` 已删、DB 种子未同步；它也解释了 `byType` 多出的 `other=1`。
- 复原：`INSERT INTO mistakes (id, student_id, wrong_text, correct_text, error_type, streak, wrong_count, status)`
  `VALUES (19, 1, 'I was busy yesterday.（翻译题「我昨天很忙」正确）', '—', 'other', 1, 0, 'passed');`
  （本就是误入数据，**不建议复原**）
- 规则固化：M2 迁移脚本必须跳过 `correct_text` 为占位符（NULL / 空串 / `-` / `—`）**或** `wrong_count = 0` 的行。

### R-2 · 回滚探针测试写入 `mistakes.id=5`（2026-09-29）

```sql
START TRANSACTION;
UPDATE mistakes SET streak=2, wrong_count=3, status='pending', last_reviewed_at=NULL WHERE id=5;
DELETE FROM study_records WHERE id=31;
COMMIT;
```

- 成因：前端的写接口探针（curl）把 `id=5` 从 `pending` 翻成 `passed`，并留下 `study_records.id=31`
  （`payload.clientEventId="probe-fe-1"`，summary「错词复习：答对（mistakeId=5）」）。当天无真实上课，判定为测试残留（前端已确认）。
- 影响：`mistakes` 一度变成 19 / pending 14 / passed 5，与 `wrong-words.md` 的 19 / 15 / 4 差 1 条。
- 复原后实测：`GET /api/mistakes/stats` = **total 19 / pending 15 / passed 4**，`byType` 无 `other`；
  `study_records` 回到 18 条（attend 6 / grade 6 / feedback 6）。
- 预防：**探测写接口必须用一次性数据并当场回滚**，不要拿真实错词当探针 ——
  `POST /api/mistakes/:id/review` 是学生打卡的写路径，会直接改变过关判定。

---

## 五之三、M2 迁移实测（2026-09-30）：只读导出 → 幂等写库，已闭环

**三段式链路（全部已落地实测）**

| 段 | 文件 | 性质 | 命令 |
|---|---|---|---|
| 导出 | `backend/db/migration/export_md_to_json.py` | **只读**：md + records + 错词本 + read/ → `_snapshot.json` | `npm run db:export` |
| 比对 | `backend/db/migration/compare_snapshot.js` | **只读**：产物 vs 库内逐项验收 | `npm run db:compare` |
| 写库 | `backend/db/migration/import_json.js` | **写库**：单事务、幂等 upsert | `npm run db:import` |

- 导出器**自包含、零外部依赖**（不再 import `build_board.py`），产物 `_snapshot.json` 已被 `.gitignore` 排除（属中间物）。
- 写库器只消费 `_snapshot.json` 一个文件：`records/*.json` 的 `summary.byType` / `historicalErrorCount` 由导出器并入
  `lessons[].recordsSummary`，写库器**不再自己读 `records/`**，避免两条读取路径漂移。
- 写库器支持 `--dry-run`（全程执行后整体回滚，只报告不改库）与 `--student`；**它不会写 `mistakes`**
  （权威是 `wrong-words.md`，且 records 候选与错词本有 8 条同义不同文本，须 amy 复核后再定）。

**写库前后实测（`npm run db:import`）**

| 表 | 前 | 后 |
|---|---|---|
| `lesson_sections` | 12 | **51**（每课 8 类 + 有补漏块的 3 课各加 1 条 `backfill`） |
| `lesson_exercises` | 0 | **34**（作业 25 + 补漏块 9；`block_no` = 1/2/3） |
| `readings` / `reading_pieces` / `reading_questions` | 0 / 0 / 0 | **4 / 11 / 22** |
| `study_records.payload.byType` | 0 / 18 条 | **6 课的 grade 记录已补**（第 1—6 课） |
| `lessons` / `vocabulary` / `lesson_vocabulary` / `mistakes` | 6 / 51 / 52 / 19 | **未变**（含 `mistakes` md5 `7f9ad9e7…`） |

**幂等证明**：连续两次 `npm run db:import`，第二次全部 `±0`、`byType=0`、无新行。
**`db:init` 不打架**：`db/seed.js` 的 `lesson_sections` 写入改为**冲突时空操作**
（`content_md = lesson_sections.content_md`）——原先的 `VALUES()` 会在重跑 `db:init` 时把回填进去的
md 原文打回 seed 的简化版。实测重跑 `db:init` 后 `lesson_sections`（51）、`lesson_exercises`（34）、
`study_records.payload`、`lessons` 四处 md5 **全部未变**。
**正确顺序**：`db:init` → `db:export` → `db:import`（首次建库）；日常只跑后两步。

**逐项验收（`npm run db:compare`）**：`match=13 diff=1 gap=1`

| 项 | 结论 | 说明 |
|---|---|---|
| lessons 课数 / `lesson_date` | ✅ | 「同日沿用当日日期」规则已实现：md 无日期的第 2、4 课沿用上一课日期，与库内一致 |
| vocabulary / lesson_vocabulary | ✅ | 51 / 52 |
| mistakes 条数 / status 分布 | ✅ | 19；passed 4 / pending 15 |
| `mistakes.wrong_text` 集合 | ⚠️ **8 条 + 缺 4 行** | ① 库内 8 行仍是旧格式（带括号批注，如 `play game（第 3 次犯：…）`、`zane（人名小写）`），md 已按「只写错误形式本身」改为纯净文本；② md 比库内多 4 行（Amy 新增）。**按「以错词本为准」不自动写库**，待 amy 复核 |
| lesson_sections 条数 | ✅ | 51 |
| lesson_exercises 条数 / 题块拆分 / 批改覆盖 | ✅ | 34；homework 25 / backfill 9；`is_correct` 无 NULL，答错 10 条 |
| `lesson_exercises.error_type` | ⛔ **0 / 34** | 需 amy 先统一 `records.mistakeCandidates` 与错词本措辞（**8 条同义不同文本**），对账后才能逐题判定。**当前 34 条 `error_type` 全为 NULL 是预期状态**，不是漏写 |
| readings 天数 / 篇数 / 题数 | ✅ | 4 / 11 / 22 |

**发现的解析缺陷（已修）**：`read/*.md` 的理解题是「题干行 + `<details>` 答案行」两行一题，
早期解析按行切分 → **每题的答案行被当成一道新题**（题数与空题干都翻倍，第 1 篇 2 题被解析成 4 条）。
已改为「答案行并入上一题」，并在比对脚本中固化断言（`reading_questions` 题数必须 = md 题数）。

**仍未闭环（两处，均卡在 amy 侧，非后端可自解）**

- ⛔ `lesson_exercises.error_type` 全 NULL（缺 34 条的逐题判定）
- ⚠️ `mistakes` 与错词本未对齐：库内 19 行 vs `wrong-words.md` **23 行**。差额分两类：
  **① 缺 4 行**（Amy 2026-09-30 补登记的 `work.So` / `intrusting` / `Our teacher is Amy together.` / `Now, My`）；
  **② 8 行 `wrong_text` 仍是旧格式**（库内带括号批注，如 `zane（人名小写）` / `Do you like coffee.（句号结尾）` /
  `play game（第 3 次犯：…）` / `I am very busy.（题目要求…）` / `those are their bags.（句首小写）` /
  `at yesterday（…）` / `What were you yesterday.（…）` / `what do you do?（…）`，md 已按「只写错误形式本身」改为纯净文本）。
  **按「以错词本为准、不自动写库」原则处理**，须 amy 复核后由人工或一次性迁移落库。

**新增待办**

- `study_records(grade).payload.byType` 已回填第 1—6 课；**第 7 课起由 amy 在批改 payload 里带 `byType`**（口径见 `docs/skills.md` 8.2）。
- `lessons.error_count` 保留历史值（3/4/2/6/2/5），重算值为 5/4/2/6/1/6；从第 7 课起严格按新口径（§11.4）。
- `schema.full.design.sql` 落后实际表（`readings` 仍用 `users` 命名、`exercises` 缺列等），需整体重审后再动。
- `POST /api/readings` **已实现并开放**（见下方 §五之四）。

---

## 五之四、阅读在线写入：`POST /api/readings`（2026-09-30 已开放）

**背景**：此前阅读只有一条写路径——离线 md 回填（`db:export` → `db:import`），无法支撑「Amy 当天生成一篇阅读就写库」的实时场景。项目负责人 2026-09-30 明确「开放」在线写接口。

**实现要点**

| 关注点 | 做法 |
|---|---|
| 契约 | 请求体即 `docs/schemas/reading-set.schema.json` 的 `ReadingSet`；校验规则与该 schema 严格一致，不额外发明 |
| 正文格式 | 与 `db:import` **共用同一实现** `renderBodyMd` / `countWords`（`reading.service.js` 导出，`import_json.js` 反向 import）→ 两条路径产出**字节一致**（实测回填的 `reading_pieces` md5 未变） |
| 一致性 | 单事务：读旧值 → 判重 → 三表插入同属一个事务（`db.withTransaction` + `*On(conn,…)`），杜绝并发各写一天 |
| 「当天不覆盖」 | 同日已存在 → **409**；仅 `?force=true` 显式例外（重出），此时同事务删子行重建、`readings` 行复用 |
| 字段丢失修复 | 顺带补 `reading_pieces.source_url` 列——此前 `sourceUrl` 在写路径**被静默丢弃**（见 `docs/database.md` 第八之二节） |

**回归**：`npm run test:write` 新增 E2 段 **RW1—RW18**（201 / 三表落库 / 读回 / 409 不覆盖 / force 重出 / 400 字段级明细 / 学生隔离 / 清理零残留），全套 **59/59**；`npm run test:api` **49/49**。

**两条写路径的分工**（教学侧据此选型）

- **批量历史回填**（如第 1—6 课）→ `npm run db:export` → `db:import`（离线、幂等、可 `--dry-run`）
- **当天新生成阅读** → `POST /api/readings`（在线、即时）

---

## 六、待你确认的事项

1. **MySQL root 密码**（或专用账号）——M1 起必须，仅用于建库与连接。
2. 是否需要**多用户**：当前 schema 已按 `user_id` 隔离，默认单用户；若确认只要单用户，可保留现状不简化。
3. M5 是否启动：即是否要把静态看板改为动态前端（会触碰**前端工程师**职责）。
