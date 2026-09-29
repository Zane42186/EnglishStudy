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

## 二、为什么不重写解析器

现有 `build_board.py` 里已经有一套**经过生产验证**的 Markdown 解析规则（`LESSON_RE` / `SUMMARY_RE` / `SECTION_ORDER` / `parse_vocab` / `parse_piece` / `parse_wrong_words`）。重写一份 JS 解析器会造成规则漂移（两套正则不一致 → 数据对不上）。

**方案：复用 Python 解析、Node 只负责入库。**

```
notes/*.md  read/*.md  wrong-words.md  progress.md
        │
        ▼  export_md_to_json.py   ← 复用 build_board.py 的纯解析函数，不写文件
   snapshot.json（结构化快照）
        │
        ▼  import_json.js         ← 事务 + 幂等 upsert
      MySQL
```

- `export_md_to_json.py`：import `build_board` 的 `parse_notes` / `parse_read_dir` / `parse_wrong_words` / `read_level`，打印 JSON 到 stdout 或写 `db/_snapshot.json`（**只读 md，不改任何文件**）。
- `import_json.js`：单个事务内按依赖顺序 upsert：`users → user_progress → courses → course_sections → vocabulary → course_vocabulary → exercises → readings → reading_pieces → reading_questions → mistakes`。

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

## 六、待你确认的事项

1. **MySQL root 密码**（或专用账号）——M1 起必须，仅用于建库与连接。
2. 是否需要**多用户**：当前 schema 已按 `user_id` 隔离，默认单用户；若确认只要单用户，可保留现状不简化。
3. M5 是否启动：即是否要把静态看板改为动态前端（会触碰**前端工程师**职责）。
