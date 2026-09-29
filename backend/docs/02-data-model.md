# 02 · 数据模型设计

> 状态：**设计稿**。DDL 见 `backend/db/schema.sql`（同为本设计的一部分）。
> 设计目标：让 Amy 每天教学后能回答三个问题 —— **学生学过什么 / 错过什么 / 掌握什么**。

---

## 一、ER 概览

```
users ──1:N── courses ──1:N── course_sections
  │              │  │
  │              │  └──M:N── knowledge_points   (via course_knowledge_points)
  │              │
  │              └──M:N── vocabulary            (via course_vocabulary)
  │
  │  ──1:N── readings ──1:N── reading_pieces ──1:N── reading_questions
  │
  │  ──1:N── mistakes ──1:N── mistake_events
  │
  │  ──1:N── progress_feedback
  │  ──1:N── study_records
  │  ──1:N── skill_runs ──N:1── skills
  │
  └──1:1── user_progress
```

---

## 二、表清单（18 表 + 2 视图）

| 分组 | 表 | 作用 | 对应现有 md |
|---|---|---|---|
| 用户与状态 | `users` | 用户 | — |
| | `user_progress` | 级别 / 课号 / 连击 / 冻结 | `progress.md` 头部 |
| 课程 | `courses` | 每课一行 | `## 第 N 课` |
| | `course_sections` | 8 个小节原文 | `### 复习/今日语法/...` |
| | `knowledge_points` | 知识点地图 | `progress.md` 待补清单 + level-map |
| | `course_knowledge_points` | 课↔知识点 | — |
| 词汇 | `vocabulary` | 全局词典 | 各课词汇表（去重） |
| | `course_vocabulary` | 课↔词 + 例句 | 各课词汇表 |
| 练习 | `exercises` | 作业题结构与批改 | `### 作业 / 我的作答 / 批改` |
| 阅读 | `readings` / `reading_pieces` / `reading_questions` | 阅读日/篇/题 | `read/*.md` |
| 错题 | `mistakes` | 错词本（含掌握度） | `wrong-words.md` |
| | `mistake_events` | 犯/对流水 | — |
| 记录 | `progress_feedback` | 反馈与升降级 | `progress.md` 反馈表 |
| | `study_records` | 行为时间线 | — |
| 技能 | `skills` / `skill_runs` | Skill 注册与执行 | `.workbuddy/skills` 元信息 |
| 视图 | `v_pending_mistakes` | 未过关错词 | `digest.md` 待复习段 |
| | `v_dashboard_stats` | 看板统计 | `review/index.html` 统计卡 |

---

## 三、关键表字段字典（节选核心）

### courses
| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 主键（**新增**，替代脆弱的「课号字符串关联」） |
| user_id | BIGINT FK | 用户 |
| lesson_no | INT | 课号，`UNIQUE(user_id, lesson_no)` |
| lesson_date | DATE | 上课日期 |
| level_code | VARCHAR(10) | 上课时级别 |
| summary | VARCHAR(255) | 一句话摘要 |
| source_file | VARCHAR(64) | 迁移溯源：`day-01-07.md` |

> 为什么要有 `id`：现有体系用「课号」当事实主键，已出现 `第 诊断 课` 这样的脏值。后端用自增 `id` 做主键、`lesson_no` 做业务唯一键，两者分离。

### mistakes（错词本 · 掌握度核心）
| 字段 | 类型 | 说明 | 对应 md 列 |
|---|---|---|---|
| wrong_text | VARCHAR(512) | 错误点 | 错误点 |
| correct_text | VARCHAR(512) | 正确形式 | 正确形式 |
| error_type | ENUM | 语法/拼写/标点/用词/大小写 | （新增，用于趋势统计） |
| error_reason | VARCHAR(512) | 错因 | 错因 |
| streak | SMALLINT | 连续答对次数 | 连续答对 |
| wrong_count | SMALLINT | 累计犯错次数 | （新增，来自「第 3 次犯」） |
| status | ENUM('pending','passed') | 未过关/已过关 | 状态 |

### exercises
| 字段 | 说明 |
|---|---|
| exercise_type | fill_blank / translate / error_correction / reorder / open / choice |
| prompt / reference_answer / user_answer | 题干 / 参考答案 / 学员作答 |
| is_correct / error_note | 批改结论与说明 |

---

## 四、业务规则（必须在 service 层实现，与现有规则对齐）

| 规则 | 出处 | 实现方式 |
|---|---|---|
| 答错 → `wrong_count+1`、`streak=0` | `wrong-words.md` 逻辑 | `POST /mistakes/:id/review {result:'wrong'}` |
| 答对 → `streak+1`；`streak>=2` → `status='passed'` | `wrong-words.md`：连续答对 2 次即过关 | 同上，service 内判定 |
| 「太简单」连击 2 次 → 升 1 级、计数清零 | `progress.md` 升级规则 | `POST /progress/feedback` |
| 「太难」→ 降 1 级 + 冻结 3 课不升级 | `progress.md` 升级规则 | 写 `upgrade_frozen_until = 当前课号+3` |
| 「刚好」→ 维持 | `progress.md` | 仅记录 |

> 这些规则来自现有 `progress.md`，后端**只做搬运与执行，不重新设计教学策略**。

---

## 五、索引与约束

- 业务唯一键：`uk_course_no(user_id, lesson_no)`、`uk_vocab_word(user_id, word)`、`uk_reading_day(user_id, read_date)`、`uk_piece(reading_id, piece_no)`。
- 高频查询索引：`idx_mistake_status(user_id, status)`（取未过关）、`idx_sr_user_time(user_id, created_at)`（时间线）、`idx_course_date(user_id, lesson_date)`。
- 外键删除策略统一 `RESTRICT`：学习数据**只增不删**，避免级联误删历史。
- JSON 字段（`study_records.payload`、`skill_runs.input/output`）用于弹性扩展，避免为易变结构频繁改表。

---

## 六、与现有 Markdown 的字段映射（迁移依据）

| Markdown 位置 | → 数据库 |
|---|---|
| `notes/day-XX-YY.md` 的 `## 第 N 课` | `courses` 一行 |
| `> 一句话：` | `courses.summary` |
| `### 复习/今日语法/例句/作业/我的作答/批改/难度反馈` | `course_sections`（按 `section_type`） |
| `### 词汇` 表格行 | `vocabulary` + `course_vocabulary` |
| `### 作业` 的编号题 | `exercises`（题干/参考答案） |
| `read/YYYY-MM-DD-read.md` | `readings` + `reading_pieces` + `reading_questions` |
| `wrong-words.md` 表格行 | `mistakes` |
| `progress.md` 头部 | `user_progress` |
| `progress.md` 反馈表 | `progress_feedback` |
| 派生统计（课程数/生词数/阅读篇数/未过关数） | `v_dashboard_stats` 视图实时算，**不再存冗余副本** |

> 副产品：现有 `digest.md` 是「派生副本、超 8KB 要手工清理」。改为数据库后，统计实时计算，**冗余副本问题自然消失**。
