# Skill 系统设计（Skills）

> **状态：第一版（正式正文）· 2026-09-29**
> 数据基准：第 6 课（2026-09-29）下课后的仓库状态。
> 权威来源：`PROJECT.md`（理念）、`AGENTS.md`（角色分工）、`docs/ai-teacher.md`（教学决策）、`backend/docs/03-api-contract.md`（数据契约）、`backend/db/schema.sql`（表结构）。
> 配套契约：`docs/schemas/`（12 个 JSON Schema 与索引）。
> 与旧骨架的关系：本文件替换原 TODO 骨架。原骨架登记的三项待办——Skill 清单与职责、输入输出格式、与 `GET /agent/snapshot` 的对接方式——分别在第一章、第二章、第四章与第七章落地。

---

## 零、设计原则与总架构

### 0.1 一条铁律

**Skill 只认对象，不认文件。**

所有 Skill 的输入输出都是 `docs/schemas/` 里定义的结构化对象。Skill 不得读取 `digest.md`、解析 `notes/*.md`、拼接 `review/*.html`。

判定标准只有一条：**如果一个 Skill 的行为会因为 md 文件换个排版而改变，说明设计错了。**

### 0.2 三层能力模型

`AGENTS.md` 列出 9 项能力。它们不是 9 个并列的 Skill，而是分三层：

| 层 | Skill | 数量 | 判断依据 |
|---|---|---|---|
| **独立 Skill** | `daily-lesson`、`lesson-review`、`learning-progress-analysis` | 3 | 用户会**单独说出一句话**来要它 |
| **内嵌能力** | `next-lesson-planning`、`grammar-teaching`、`vocabulary-teaching`、`exercise-generation`、`answer-grading`、`mistake-analysis` | 6 | 它是上课流程的组成步骤，用户不会单独点名 |

**为什么不做成 9 个独立 Skill**：9 个各自去读状态，就是 9 处重复取数、9 处格式漂移风险；而课内 6 个能力会争抢同一份数据，出现「批改用的错词版本」和「归档用的错词版本」不一致这类难查的错。

**为什么不能只做 1 个**：「我只想复习」「我学得怎么样」是两个真实且高频的独立意图。把它们硬塞进 11 步上课流程里，用户想复习十分钟却被要求先做完一课，体验是错的。

三个独立 Skill 与六个内嵌能力**共用同一套契约**，因此内嵌能力随时可以无改动地升级为独立 Skill——只要它的用户意图真的存在。

### 0.3 数据流与调用树

```
                        ┌──────────── AgentSnapshot ────────────┐
                        │  唯一入口：级别 / 课号 / 最近三课 /   │
                        │  未过关错词 / 阅读清单 / 趋势 / 待补  │
                        └───────────────┬───────────────────────┘
                                        │
              ┌─────────────────────────┴─────────────────────────┐
              ▼                                                   ▼
   【独立 Skill】daily-lesson (3.1)      【独立 Skill】learning-progress-analysis (3.8)
              │                                                   │
              ├─ 3.9 next-lesson-planning ─▶ LessonPlan           ▼
              ├─ 3.2 lesson-review ────────▶ ReviewSession    ProgressReport
              ├─ 3.3 grammar-teaching ─────▶ TeachingBlock(grammar)
              ├─ 3.4 vocabulary-teaching ──▶ TeachingBlock(vocabulary)
              ├─ 3.5 exercise-generation ──▶ ExerciseSet ──▶ 学生作答
              │                                                 │
              ├─ 3.6 answer-grading ◀───────────────────────────┘
              │        └──────────────────▶ GradingResult
              ├─ 3.7 mistake-analysis ─────▶ MistakeAnalysisResult
              └─ 当日阅读 ────────────────▶ ReadingSet
              │
              ▼
        LessonRecord
              │
              ▼
   后端 API  →  Database  →  Frontend
```

> 编号为第三章对应小节号。`3.5 exercise-generation` 的输出去向是学生而非下游 Skill，学生作答是它与 `3.6 answer-grading` 之间的接口。

「独立触发」与「内嵌调用」走同一份契约，因此 `lesson-review` 在两种入口下产生的结果完全一致。

### 0.4 两阶段落地

| 阶段 | 数据来源 | Skill 是否需要改动 | 判定方式 |
|---|---|---|---|
| **A（当前）** | markdown 适配层读 `digest.md` / `progress.md` / `wrong-words.md` / `notes/` / `read/`，合成契约对象 | — | `AgentSnapshot.deploymentMode = "markdown"` |
| **B（后端就绪后）** | `GET /agent/snapshot` 等接口 | **不需要** | `AgentSnapshot.deploymentMode = "backend"` |

切换点是一个字段值，不是一次重构。

### 0.5 职责边界

| Skill 绝不做什么 | 原因 |
|---|---|
| 直接读写 `review/*.html` | 那是前端产物。Skill 产出契约对象，由后端或生成脚本翻译成页面 |
| 调用前端接口、拼 HTML/CSS | 违反「不直接与前端耦合」；前端改版会连带 Skill 失效 |
| 解析 `notes/*.md` 的结构 | 一旦 Skill 依赖 md 排版，md 就不敢改，等于把真相源钉死在一个格式上 |
| 自行发明枚举值 | 枚举与 `schema.sql` 一一对应，改枚举必须先改表 |
| 重新设计教学策略 | 策略由 Amy 决定（`docs/ai-teacher.md`）。Skill 只负责把策略稳定执行 |
| 替学生作答、提前给答案 | 见各 Skill 的停止条件 |
| 删除、重命名、移动任何已有学习数据 | 学习数据只增不删 |

### 0.6 与前端、后端的接口

```
Skill  ──契约对象──▶  后端 API  ──▶  Database  ──▶  Frontend
   │
   └──契约对象──▶  生成脚本（如 build_board.py）──▶ review/*.html
```

两条路径的输入是同一个契约对象，因此**静态看板与未来 Vue 前端可以并存**，切换前端不影响任何 Skill。

---

## 一、Skill 清单与路由

### 1.1 总表

| # | Skill | 层 | 触发 | 当前落地物 | 状态 |
|---|---|---|---|---|---|
| 1 | `daily-lesson` | 独立 | 上课 / 开始今天的英语课 / 今天学英语 / 下一课 / 继续 / 英语每日课 / 上次学到哪了 | `.workbuddy/skills/english-daily/` v2.2.0 | ✅ 运行中（6 课实证） |
| 2 | `lesson-review` | 独立 | 复习 / 复习错词 / 今天先复习 / 考考我 | 内嵌于 daily-lesson 第 3—4 步 | ⚠️ 内嵌可用，未独立可触发 |
| 3 | `grammar-teaching` | 内嵌 | —（daily-lesson 第 5 步） | 内嵌于 daily-lesson | ✅ 内嵌运行中 |
| 4 | `vocabulary-teaching` | 内嵌 | —（daily-lesson 第 5 步） | 内嵌于 daily-lesson | ✅ 内嵌运行中 |
| 5 | `exercise-generation` | 内嵌 | —（daily-lesson 第 3、6 步） | 内嵌于 daily-lesson | ✅ 内嵌运行中 |
| 6 | `answer-grading` | 内嵌 | —（daily-lesson 第 4、7 步） | 内嵌于 daily-lesson | ✅ 内嵌运行中 |
| 7 | `mistake-analysis` | 内嵌 | —（daily-lesson 第 4、7 步之后） | 人工判定为主 | ⚠️ 半自动，`error_type` 判定未规则化 |
| 8 | `learning-progress-analysis` | 独立 | 我学得怎么样 / 分析我的错误 / 我的弱项 / 学习报告 / 我进步了吗 | `build_board.py` 出统计，趋势靠人工读 | ⚠️ 统计可用，分析未成 Skill |
| 9 | `next-lesson-planning` | 内嵌 | —（daily-lesson 第 1—2 步） | 规则写在 `docs/ai-teacher.md` 第八章 | ✅ 规则完整，未独立成契约 |

### 1.2 触发词总表

只列三个独立 Skill。内嵌能力不由用户直接触发。

| Skill | 正例（应触发） |
|---|---|
| `daily-lesson` | 上课 · 开始今天的英语课 · 今天学英语 · 下一课 · 继续 · 英语每日课 · 上次学到哪了 · 今天我想学一般过去时 |
| `lesson-review` | 复习 · 复习错词 · 今天先复习 · 考考我 · 把错词再过一遍 |
| `learning-progress-analysis` | 我学得怎么样 · 分析我的错误 · 我的弱项是什么 · 给我一份学习报告 · 我进步了吗 |

### 1.3 near-miss 反例（不应触发，或需先确认）

| 用户说 | 正确行为 | 原因 |
|---|---|---|
| 继续 | 若上下文中无英语课信号，**先确认**「是继续上次的英语课吗」 | 「继续」是高频歧义词，独立出现时不足以判定 |
| 我的作业是什么 | 不触发任何 Skill，直接回答最近一课的作业内容 | 这是查询，不是教学动作 |
| 帮我看看这个单词是什么意思 | 不触发 Skill，直接回答 | 单次查询，无需教学流程 |
| 看板怎么打不开了 | 不触发教学 Skill | 属前端/脚本问题，不是教学能力 |
| 读一下今天的新闻 | 不触发 Skill | 新闻阅读属 Level 4—5 的阅读取材，由 daily-lesson 的阅读环节产出，不是独立入口 |

> 触发识别需要在真实环境实测。本轮无可用模型调用环境，**触发测试标记为未执行**，见第六章 6.3。

---

## 二、统一数据契约

### 2.1 契约全景

```
AgentSnapshot ─────────────────────────────────────┐
   │                                               │
   │ ① next-lesson-planning                        │
   ▼                                               │
LessonPlan ────┬──────────────────────┐            │
   │           │                      │            │
   │ ③ grammar-teaching ④ vocab-teaching   ⑤ exercise-generation
   ▼           ▼                      ▼            │
TeachingBlock  ExerciseSet ──▶ 学生作答             │
                    │                │             │
                    │                ▼             │
                    │        ⑦ answer-grading      │
                    │                │             │
                    │                ▼             │
                    │        ⑧ mistake-analysis ───┤
                    │                              │
                    ▼                              ▼
              LessonRecord  ◀──────────────────────┘
                    │
                    ▼
               ReadingSet   SkillRun
```

### 2.2 契约文件与权责

完整清单见 `docs/schemas/README.md`。核心约定：

| 约定 | 内容 |
|---|---|
| 命名空间即版本 | `$id` 为 `https://english-study.local/schemas/v1/<文件名>`，是标识符不是可访问网址 |
| 加字段兼容 | 所有契约允许附加属性；**Skill 必须忽略未知字段**，不得因后端多返回字段而报错 |
| 枚举不发明 | 枚举取值与 `schema.sql` 严格一致。新增取值必须先改表与 `common.schema.json` |
| 一个 Skill 一个根对象 | 每个 `.schema.json` 的根即该契约的校验入口，辅助类型放该文件的 `$defs` |
| 引用方式 | 同目录相对路径 `common.schema.json#/$defs/X`；文件内 `#/$defs/X` |

### 2.3 与后端接口的对应

| 契约对象 | 后端接口 | 方向 |
|---|---|---|
| `AgentSnapshot` | `GET /agent/snapshot?recent=3` | 读 |
| `LessonRecord` | `POST /courses`、`PUT /courses/:id` | 写 |
| `TeachingBlock` | `course_sections`、`vocabulary`（随 `POST /courses` 提交） | 写 |
| `ExerciseSet` | `exercises`（随 `POST /courses` 提交） | 写 |
| `GradingResult` | `exercises.is_correct / error_note`（随 `PUT /courses/:id` 回填） | 写 |
| `MistakeAnalysisResult` | `POST /mistakes`、`POST /mistakes/:id/review` | 写 |
| `ReviewSession` | `POST /mistakes/:id/review` | 写 |
| `ProgressReport` | `study_records(record_type='grade')` 聚合 | 读 |
| `ReadingSet` | `POST /readings` | 写 |
| `SkillRun` | `POST /skill-runs` | 写 |

### 2.4 降级表示法

每份契约都带可选的 `degradation` 对象。只要某次执行有降级，就必须填：

```json
{ "degraded": true, "reason": "snapshot 缺 errorTrend", "affected": ["R3 加速判断"] }
```

降级结果必须向上层标注限制，**不得把降级结果当成完整结果输出**。

### 2.5 补漏块（`### 补漏块 N · …`）归置口径

`### 补漏块 N · <主题>` **不是讲解小节，而是与 `### 作业` 同构的第二份题集**——整段就是题干列表，没有讲义正文。当前 `parse_notes` 的 `SECTION_ORDER` 白名单不含它，因此整段被静默丢弃；同时 `### 我的作答` / `### 批改` 里按「补漏块 N：」分组的作答与作业作答共用一套题号，会**互相覆盖**（例如第 4 课 `my_answer[1]` 被作业作答顶掉）。以下为唯一口径：

| 笔记里的内容 | 落到哪里 | 字段 |
|---|---|---|
| 题目（补漏块 N 的题干 + 参考答案） | `lesson_exercises` | `block_kind='backfill'`、`block_no=N`、`exercise_no` 为**块内**题号、`exercise_type`、`prompt`、`self_check`、`target_point`、`reference_answer` |
| 学生作答（`### 我的作答` 内「补漏块 N：」分组） | `lesson_exercises` | `user_answer` |
| 批改结论（`### 批改` 内「补漏块 N：」分组） | `lesson_exercises` | `is_correct`、`error_type`、`error_note`、`revised_answer` |
| 整段原文（小节标题 + 全部行） | `lesson_sections` | `section_type='backfill'`、`content_md`（每课次最多一条） |

**题号是块内的，不是课内的**。`exercise_no` 在作业块与补漏块里各自从 1 开始，因此 `lesson_exercises` 现用的 `UNIQUE KEY uk_exercise (lesson_id, exercise_no)` 会撞车，必须扩为 `(lesson_id, block_kind, block_no, exercise_no)`。`lesson_exercises` 当前 **0 行**，改键零数据风险。

**`block_no` 必须 NOT NULL，用 0 表示「作业题」**。MySQL 的唯一键**不约束 NULL**——若把作业行的 `block_no` 留空，同一课可以重复插入相同的作业题而不会被拦下（与 `mistake_events.client_event_id` 故意依赖 NULL 可重复的情形正好相反）。这里的目的是去重，所以取 0 而非 NULL。

**契约侧**：`SectionType` 末尾追加 `backfill`；新增 `ExerciseBlockKind = ["homework","backfill"]`；`exercise-set.schema.json` 的 `ExerciseItem` 与 `lesson-record.schema.json` 的 `ExerciseRecord` 各增 `blockKind` / `blockNo`。枚举必须 `backend/src/constants.js` / `backend/db/schema.sql` / `docs/schemas/` 三处同源。

**DDL 申请（待后端执行，本次未动库）**：

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

⚠️ `section_type` 的新值**追加在末尾**，不得插入中间（MySQL ENUM 按内部索引存储，插中间会让既有行的枚举值静默错位）。执行前先确认备份可重放，并照 8.1 的 DDL 规程单独 commit。

**机器真相源是 `records/`，不是 md 散文**：补漏块的逐题判定落在 `records/lesson-NN.backfill.json`（`kind: "backfill"`、`exerciseNo` 块内编号、`summary.backfillErrorCount` 单列），作业判定落在 `records/lesson-NN.grading.json`。后端**只读该目录的 JSON**，禁止从 `### 批改` 文字里做文本匹配提取 `isCorrect` / `errorNote`——文字匹不出一处错误对应哪一题，也判不出「用词 vs 语法」（见 `records/README.md`）。md 侧的「补漏块 N：」分组仅供人读，与 JSON 同源；两者不一致时以 JSON 为准。

**与 `mistakes` 的边界**：补漏块本身不是错词来源条目，但补漏题答错会经 `mistakeCandidates[]` 进入错词本——判重键为规范化后的 `wrongText` + `errorType`，命中则 `wrong_count + 1`、`streak = 0`，不新建。`error_type` 按 `docs/ai-teacher.md` §11.5 的三步判定，判不出一律 `other`。补漏块的错误数**不计入本课作业 `errorCount`**（口径见 `docs/ai-teacher.md` §11.4）。

**导出链影响（已落地）**：`backend/db/migration/export_md_to_json.py` 已按上表把题号拆成**两块命名空间**——作业题 `block_kind='homework'`、`block_no=0`，补漏块 `block_kind='backfill'`、`block_no=块序号`；`parse_my_answer()` 按 `补漏块 N：` 标签把答案分流到对应块。该脚本已改为**自包含**（内联 `LESSON_RE` / `SECTION_RE` / `DETAIL_RE` / `BACKFILL_HEAD_RE` 等全部正则与解析函数），**不再 import `build_board`**，因此与 `skills/english-daily/scripts/` 已无依赖关系（见 7.3 / 7.4）。逐题判定一律取自 `records/*.json`，warnings 中「补漏块无对应 SectionType」的历史项已由 `section_type` 末尾新增 `backfill` 消解。

---

## 三、九个 Skill 的定义

每个 Skill 均按「名称 / 功能 / 输入 / 输出 / 依赖数据 / 执行流程 / 判断规则 / 异常情况 / 示例」九项定义。

---

### 3.1 daily-lesson

#### Skill 名称
`daily-lesson`（英语每日课）· 独立 Skill · 当前实现为 `.workbuddy/skills/english-daily/` v2.2.0。

#### 功能
编排一次完整上课。把 `AgentSnapshot` 与 `LessonPlan` 变成 11 步可执行的教学动作，结束时产出可归档的 `LessonRecord` 与当日 `ReadingSet`。它是唯一在课内调用其他六个能力的编排层。

#### 输入

| 字段 | 必需 | 说明 |
|---|---|---|
| `snapshot: AgentSnapshot` | ✅ | 唯一状态来源 |
| `plan: LessonPlan` | 可选 | 缺省时先调 `next-lesson-planning`（对应 3.9）生成 |
| `topicOverride: string` | 可选 | 学生说「今天我想学 X」时填入 |
| `today: DateOnly` | ✅ | 当日日期，用于阅读文件名与笔记标题 |

#### 输出

| 字段 | 说明 |
|---|---|
| `lessonRecord: LessonRecord` | 归档产物 |
| `readingSet: ReadingSet \| null` | 当天已存在时为 `null`，并在 `SkillRun.notes` 说明跳过原因 |
| `reviewSession: ReviewSession` | 内嵌复习那一段的完整记录 |
| `skillRuns: SkillRun[]` | 自身一条 + 每个被调用的内嵌能力各一条，`parentSkillRunId` 指向自身 |

#### 依赖数据

| 契约字段 | 后端表 | 用途 |
|---|---|---|
| `snapshot.progress` | `user_progress` | 级别、课号、连击、冻结 |
| `snapshot.courseCatalog` | `courses` | 定课号 N |
| `snapshot.recentLessons` | `courses` + `study_records(grade)` | 出复习题、判断加速 |
| `snapshot.pendingMistakes` | `v_pending_mistakes` | 复习取词池 |
| `snapshot.readingCatalog` | `readings` | 判断当天阅读是否已存在 |
| `snapshot.errorTrend` | `study_records(grade)` 聚合 | 教学规则 R3（缺口 G1） |
| `snapshot.backlog` | `knowledge_points.is_backlog` | 补漏块、规则 R2（缺口 G3） |
| `snapshot.lastIncomplete` | `study_records(feedback).payload` | 断更补课（缺口 G4） |

#### 执行流程

标注「等」的步骤必须停止并等待学生回复，不得一次输出到底。

| # | 动作 | 调用 | 等待 |
|---|---|---|---|
| 1 | 取快照与计划；课号 N = `max(courseCatalog.lessonNo) + 1`，与 `progress.currentCourseNo` 不一致时以课号为准并在回复中说明 | — | |
| 2 | 定归档文件 `day-{起始:02d}-{结束:02d}.md`，起始 = ⌊(N-1)/7⌋×7+1 | — | |
| 3 | 出 3—5 道复习题 | `lesson-review` | ⏸ |
| 4 | 批改复习，回写连击与过关 | `answer-grading` → `mistake-analysis` | |
| 5 | 讲新课：1 个语法点 + 词表 + 3—5 例句，总量 20—30 分钟 | `grammar-teaching`、`vocabulary-teaching` | ⏸ |
| 6 | 出作业 3 小题 + 1 开放题，带强制自查项；学生作答 | `exercise-generation` | ⏸ |
| 7 | 批改作业，逐题给错误类型、正确形式、一句解释 | `answer-grading` → `mistake-analysis` | |
| 8 | 收难度反馈（太简单 / 刚好 / 太难） | — | ⏸ |
| 9 | 归档：追加写笔记；写 `LessonRecord` | — | |
| 10 | 生成当日阅读 1—3 篇；当天已存在则跳过 | — | |
| 11 | 重建看板、汇报课号 / 文件 / 下次复习什么 / 当前级别 | 生成脚本 | |

#### 判断规则

| 规则 | 内容 |
|---|---|
| 课号 | N = 实际最大课号 + 1。断更不断号，中断不影响编号 |
| 文件分片 | 第 1—7 课写 `day-01-07.md`；第 8 课起写 `day-08-14.md` |
| 日期标注 | 同一天第一次课在标题标日期，第二次课起不标 |
| 复习取材 | N-1 一题、N-3 一题、N-7 一题（课号 ≤0 跳过），其余取自 `pendingMistakes`，按 `priority` 高→低、同级按 `wrongCount` 降序 |
| 内容量 | 1 个语法点，不许多塞；整课 20—30 分钟 |
| 补漏块 | 从 `backlog.backfillQueue` 队首取 1 块（3 题，5—8 分钟），**不占新语法点额度** |
| 强制自查 | 作业必带 `plan.selfChecks`；由高频复发错词（`wrongCount ≥3`）触发生成 |
| 升降级 | 太简单连续 2 次 → 升 1 级并清零；太难 1 次 → 降 1 级并冻结 3 课；刚好 → 维持 |
| R1 准确度守门 | 连击满 2 次但同类老错仍在复发 → 冻结升级，并在 `ProgressReport.levelRecommendation.unlockCondition` 写明解锁条件 |
| R2 升级不豁免欠账 | 升级后未学的低级别知识点转 `backlog`，以补漏块消化，不回头单独成课 |
| R3 加速复议 | 需「连续 2—3 课错误 ≤2 处 **且** 反馈为太简单」才考虑一课两点；任一不满足即不加速 |
| R4 暂停加速 | 错误数未持续下降或老错复发 → 转巩固纠错，并在作业加强制自查项 |
| 归档纪律 | 只追加，不重写、不删除已有内容 |

#### 异常情况

| 情况 | 处理 |
|---|---|
| 快照缺 `progress` | **停止**，报告缺失字段，不猜测级别与课号 |
| 快照缺 `errorTrend` | 降级：跳过 R3 加速判断，本课按维持级别处理，标 `degradation.affected=["R3 加速判断"]` |
| 快照缺 `backlog` | 降级：本课不排补漏块，其余照常 |
| 学生未作答 | 停在等待点。不推进、不代答、不降低题目难度 |
| 学生中途离开 | 未到归档点：不写笔记，只写 `SkillRun(status="partial")` 与 `lastIncomplete`；已过归档点：照常归档 |
| 当天 `ReadingSet` 已存在 | 跳过生成。唯一例外：学生明确说「重新出今天的阅读」 |
| Level 4—5 取新闻失败 | 降级为自编同级短文，`source` 写「自编（当日新闻获取失败）」。**不得用旧新闻冒充当日新闻** |
| 归档脚本返回 `BOARD_FAIL` | 先修笔记或阅读文件格式再重跑，**不手工改生成物** |
| 内容超时 | 若已讲完但未收反馈，按 partial 归档并记录下一课从收反馈继续 |

#### 示例

第 7 课（可直接执行，来源 `docs/ai-teacher.md` 8.3）：

```json
// 输入（节选）
{
  "deploymentMode": "markdown",
  "progress": { "currentLevel": "Level 2", "currentCourseNo": 6, "easyStreak": 0,
                "lastFeedback": "just_right", "upgradeFrozenUntil": 0, "lastClassDate": "2026-09-29" },
  "errorTrend": { "windowSize": 3, "byLesson": [
    { "lessonNo": 4, "errorCount": 6 }, { "lessonNo": 5, "errorCount": 2 }, { "lessonNo": 6, "errorCount": 5 } ] },
  "backlog": { "backfillQueue": [ { "seq": 4, "title": "介词 on / at", "status": "next" } ] },
  "pendingMistakes": [
    { "id": 12, "wrongText": "play game", "correctText": "play games", "errorType": "grammar",
      "streak": 0, "wrongCount": 3, "status": "pending", "priority": "high" } ]
}

// 输出（节选）
{
  "lessonRecord": {
    "lessonNo": 7, "levelCode": "Level 2", "sourceFile": "day-01-07.md",
    "summary": "学会规则动词过去式 -ed，能说清「上周做了什么」",
    "knowledgePoints": [ { "code": "L2-04", "role": "new" },
                         { "code": "L1-preposition-on-at", "role": "backfill" } ],
    "gradeSummary": { "exerciseCount": 4, "errorCount": 3, "byType": { "grammar": 2, "punctuation": 1 } }
  },
  "skillRuns": [ { "skillName": "daily-lesson", "status": "success" },
                 { "skillName": "next-lesson-planning", "parentSkillRunId": 101, "status": "success" } ],
  "readingSet": { "date": "2026-09-30", "pieces": [ { "pieceNo": 1, "source": "自编" } ] }
}
```

R3 判定演示：最近三课错误数为 6 → 2 → 5，**不满足「持续下降」**，且第 6 课错误 5 处，因此本课维持 1 个语法点，不加第二个。

---

### 3.2 lesson-review

#### Skill 名称
`lesson-review`（复习与错词过关）· 独立 Skill。当前内嵌于 `daily-lesson` 第 3—4 步。

#### 功能
从既有内容里取 3—5 题，考学生，判定对错并更新错词的连击与过关状态。它只做复习，不引入任何新知识。

#### 输入

| 字段 | 必需 | 说明 |
|---|---|---|
| `snapshot: AgentSnapshot` | ✅ | 取词池与历史课 |
| `lessonNo: integer` | ✅ | 挂在哪一课编号下；独立触发且当日未上课时填上一课号 |
| `source: "embedded" \| "standalone"` | ✅ | 入口来源 |

#### 输出
`ReviewSession`（题目 + 判定结果）。更新动作通过 `POST /mistakes/:id/review` 落库，连击与过关由服务端判定，Skill 只报对错。

#### 依赖数据

| 契约字段 | 后端表 | 用途 |
|---|---|---|
| `snapshot.pendingMistakes` | `v_pending_mistakes` | 主要取词池 |
| `snapshot.recentLessons` | `courses` | N-1 / N-3 / N-7 的语法点 |
| `snapshot.courseCatalog` | `courses` | 判断 N-1 / N-3 / N-7 是否存在 |

#### 执行流程

1. 取 `lessonNo` 为 N，排除课号 ≤0 的引用。
2. 按取题规则组题：N-1 一题、N-3 一题、N-7 一题，其余从 `pendingMistakes` 取；总数 3—5。
3. 出题，只出现在对话里，**不写进任何笔记文件**。等待作答。
4. 逐题判定：
   - `mistake` 来源：答对 `streak+1`，答错 `wrongCount+1` 且 `streak=0`；`streak ≥ 2` → `status = passed`
   - 旧课来源：只判对错，不产生错词条目
5. 汇报本次结果与错词池变化。

#### 判断规则

| 规则 | 内容 |
|---|---|
| 取题优先级 | `priority` 高 → 低；同级按 `wrongCount` 降序，再按 `lastReviewedAt` 升序（最久没复习的先考） |
| 来源必须可追溯 | 每题必须带 `sourceTag`；**不得出现临时编造的新内容** |
| 过关门槛 | 连续答对 2 次即过关，之后不再进入每日复习队列 |
| 答错处理 | `wrongCount+1` 且 `streak` 归零，回到队列高位 |
| 题目数量 | 3—5 题。少于 3 题说明取词池不足，此时只用旧课补足 |
| 不引入新知识 | 复习阶段不出现学生没学过的语法点或词汇 |

#### 异常情况

| 情况 | 处理 |
|---|---|
| 错词池为空 | 只用 N-1 / N-3 / N-7 的语法点出题；仍不足 3 题时按实际数量出，并在回复中说明 |
| N-1 / N-3 / N-7 不存在 | 跳过该来源，不报错；课号 ≤ 0 一律跳过 |
| 学生答不出要求提示 | 给一条不泄露答案的线索（如「注意句尾标点」），仍不计对 |
| 学生中途放弃 | `abandoned = true`。已判定的照常回写，未判定的不入 `outcomes`，**也不计入错误** |
| 学生直接要答案 | 先给提示；坚持要时给答案，该题不计对也不计错 |
| 学生一次提交多题 | 逐题分别判定，不因一题错而整批判错 |

#### 示例

```json
// 第 7 课课前复习（输入节选）
{ "lessonNo": 7, "source": "embedded",
  "questions": [
    { "exerciseNo": 1, "prompt": "Tom ___ (play) soccer every day.", "referenceAnswer": "plays",
      "sourceTag": "N-1", "sourceLessonNo": 6 },
    { "exerciseNo": 2, "prompt": "改错：Do you like coffee.", "referenceAnswer": "Do you like coffee?",
      "sourceTag": "mistake", "sourceMistakeId": 12 },
    { "exerciseNo": 3, "prompt": "I ___ (study) English last night.", "referenceAnswer": "studied",
      "sourceTag": "N-1", "sourceLessonNo": 6 } ] }

// 判定结果（输出节选）
{ "outcomes": [
    { "mistakeId": 12, "result": "wrong", "newStreak": 0, "newStatus": "pending" } ] }
```

第 12 条错词（`play game`，`wrongCount=3`）为最高优先级，每次复习都优先考；答错后连击归零，继续留在队列。

---

### 3.3 grammar-teaching

#### Skill 名称
`grammar-teaching`（语法讲解）· 内嵌能力。由 `daily-lesson` 第 5 步调用。

#### 功能
把 `LessonPlan.grammarPoint` 讲成一个完整的语法点，产出可直接写入课程小节的正文、例句与预判易错点。**一课只讲一个语法点**，但同一「家族」要一次讲全。

#### 输入

| 字段 | 必需 | 说明 |
|---|---|---|
| `plan: LessonPlan` | ✅ | 取 `grammarPoint`、`levelCode`、`objectives` |
| `snapshot: AgentSnapshot` | ✅ | 取已学知识点，避免重复讲 |
| `vocabularyHints: string[]` | 可选 | 本课词表，用于让例句贴合本课词汇 |

#### 输出
`TeachingBlock`（`kind = "grammar"`），含 `knowledgePoint`、`bodyMd`、`examples`、`expectedMistakes`、`familyCoverage`。

#### 依赖数据

| 契约字段 | 后端表 | 用途 |
|---|---|---|
| `plan.grammarPoint` | `knowledge_points` | 本课讲哪一个 |
| `snapshot.courseCatalog` + `recentLessons` | `course_knowledge_points` | 判断是否已讲过 |
| `snapshot.pendingMistakes` | `mistakes` | 生成针对性的 `expectedMistakes` |
| `snapshot.backlog` | `knowledge_points.is_backlog` | 避免与补漏块内容撞车 |

#### 执行流程

1. 确认 `grammarPoint` 未在 `course_knowledge_points` 中以 `role=new` 出现过。已出现过则转 `role=review` 并在回复中说明。
2. 按「规则 → 形式变化 → 例句 → 否定与疑问」组织正文。
3. 生成 3—5 个例句，**只用学生已学过的词汇**；必须用到本课词表时取 `vocabularyHints`。
4. 填 `familyCoverage`：肯定、否定、疑问三项必须都讲到（不适用于该语法点的项填 `true` 并在正文说明为何不适用）。
5. 生成 `expectedMistakes`：至少 1 条，优先取历史复发错词（当前最高频为 `play game`、句尾缺问号、句首未大写）。

#### 判断规则

| 规则 | 内容 |
|---|---|
| 一课一点 | 不许多塞第二个语法点。用户明确要求加讲时，作为独立小节并标注「加讲」 |
| 家族讲全 | 时态类必须覆盖肯定 / 否定 / 疑问；`familyCoverage` 任一为 `false` 视为未讲完，不得进入下一课 |
| 不越级 | 只讲 `level-map` 中当前级别的下一个知识点；不提前讲更高级内容 |
| 不重复 | 已学过的知识点只能作为复习出现，不得标 `role=new` |
| 例句词汇约束 | 例句中的非本课新词必须已在 `snapshot` 历史词表中出现过 |
| 预判错误优先复发项 | `expectedMistakes` 至少一条来自 `wrongCount ≥ 2` 的错词 |

#### 异常情况

| 情况 | 处理 |
|---|---|
| 知识点已学过 | 转 `role=review`，出 2—3 道回忆题代替讲解，并在回复说明 |
| `level-map` 无对应下一个知识点 | **停止**并报告，不自行发明知识点；此时应触发级别调整流程 |
| 例句无法只用已学词汇表达 | 允许引入不超过 1 个新词，并在例句后立即给中文注释 |
| 语法点存在学生未学的先决知识 | 将该先决点加入 `backlog` 并**先讲先决点**，本次语法点顺延一课 |
| 级别刚降 | 回退到上一级未覆盖的知识点，不重复已学内容 |

#### 示例

```json
{
  "kind": "grammar", "lessonNo": 7, "levelCode": "Level 2",
  "grammar": {
    "knowledgePoint": { "code": "L2-04", "title": "规则动词过去式", "role": "new" },
    "bodyMd": "规则动词过去式：一般加 -ed（played）；辅音字母 + y 结尾改 y 为 i 再加 -ed（studied）；重读闭音节双写末尾字母（stopped）。",
    "examples": [
      { "en": "I played games yesterday.", "zh": "我昨天打了游戏。" },
      { "en": "She studied English last night.", "zh": "她昨晚学了英语。" },
      { "en": "We stopped at a small shop.", "zh": "我们在一家小店停下来了。" }
    ],
    "expectedMistakes": [
      { "wrong": "I studyed English.", "correct": "I studied English.",
        "reason": "辅音字母 + y 结尾要改 y 为 i 再加 -ed" },
      { "wrong": "We played game.", "correct": "We played games.", "reason": "可数名词不能裸用（历史累计 3 次）",
        "fromMistakeId": 12 }
    ],
    "familyCoverage": { "affirmative": true, "negative": true, "question": true }
  }
}
```

第 2 条 `expectedMistakes` 直接挂在历史错词的 `fromMistakeId` 上——这是新语法点与老错词的结合点，也是批改时能回答「为什么不是 play game」的依据。

---

### 3.4 vocabulary-teaching

#### Skill 名称
`vocabulary-teaching`（词汇讲解）· 内嵌能力。由 `daily-lesson` 第 5 步调用。

#### 功能
产出本课词表：词形、音标、中文、本课例句。数量由 `LessonPlan.vocabularySize` 决定，并保证词在用户内不重复。

#### 输入

| 字段 | 必需 | 说明 |
|---|---|---|
| `plan: LessonPlan` | ✅ | 取 `vocabularySize`、`levelCode`、`grammarPoint` |
| `snapshot: AgentSnapshot` | ✅ | 取历史词表用于去重 |
| `historyVocabulary: string[]` | 可选 | 已学词的去重清单，缺省时从快照历史课取 |

#### 输出
`TeachingBlock`（`kind = "vocabulary"`），含 `entries[]`。

#### 依赖数据

| 契约字段 | 后端表 | 用途 |
|---|---|---|
| `recentLessons[].vocabulary` | `vocabulary` + `course_vocabulary` | 去重 |
| `plan.vocabularySize` | — | 词量上限 |
| `plan.grammarPoint` | `knowledge_points` | 让例句体现本课语法点 |

#### 执行流程

1. 按级别定词量：Level 1—2 取 5—8 个，Level 3 及以上取 8—12 个。
2. 从本课语法点的自然搭配里选词（如讲过去式时选 `played` / `studied` / `watched` 与时间词 `yesterday` / `last night`）。
3. 逐词排除已出现过的；确需重复的标 `isNew=false` 并只更新例句。
4. 每词产出 `phonetic`、`meaning`、`example`；`example` 必须用本课语法点造句。

#### 判断规则

| 规则 | 内容 |
|---|---|
| 词量随级别 | Level 1—2：5—8；Level 3 及以上：8—12。与 `LessonPlan.vocabularySize` 一致 |
| 不重复 | `word` 在用户内唯一。已出现的只更新例句，`isNew=false` |
| 例句用本课语法 | 每条例句必须体现本课语法点，不得用无关时态 |
| 音标必填 | 缺音标的词不得进入词表 |
| 词汇总量可统计 | 累计生词数由去重后的总量决定，不由课次累加 |

#### 异常情况

| 情况 | 处理 |
|---|---|
| 已学词过多导致可选新词不足 | 允许下调至 `vocabularySize` 下限，并在回复说明；不得用生僻词凑数 |
| 词已被讲过 | 标 `isNew=false`，例句换成本课语法点重写 |
| 无音标（如自造缩写） | **剔除该词**，换同义常用词 |
| 词表与历史重复率超过一半 | 说明本课新词偏少，建议调高 `vocabularySize` 或推进知识点 |

#### 示例

```json
{
  "kind": "vocabulary", "lessonNo": 7, "levelCode": "Level 2",
  "vocabulary": { "entries": [
    { "word": "played", "phonetic": "/pleɪd/", "meaning": "玩（过去式）",
      "example": "I played games yesterday.", "isNew": true },
    { "word": "studied", "phonetic": "/ˈstʌdid/", "meaning": "学习（过去式）",
      "example": "She studied English last night.", "isNew": true },
    { "word": "yesterday", "phonetic": "/ˈjestərdeɪ/", "meaning": "昨天",
      "example": "I played games yesterday.", "isNew": false }
  ] }
}
```

---

### 3.5 exercise-generation

#### Skill 名称
`exercise-generation`（练习生成）· 内嵌能力。由 `daily-lesson` 第 5、6 步调用。

#### 功能
按四类用途生成题集：作业、复习、补漏、诊断。每一道题都必须带参考答案。

#### 输入

| 字段 | 必需 | 说明 |
|---|---|---|
| `kind: ExerciseSetKind` | ✅ | `homework` / `review` / `backfill` / `diagnostic` |
| `plan: LessonPlan` | ✅ | 取 `grammarPoint`、`selfChecks`、`levelCode` |
| `snapshot: AgentSnapshot` | ✅ | 取错词池与历史课 |
| `targetMistakeIds: integer[]` | 可选 | 指定要考核的错词，缺省时按优先级取 |

#### 输出
`ExerciseSet`。

#### 依赖数据

| 契约字段 | 后端表 | 用途 |
|---|---|---|
| `snapshot.pendingMistakes` | `v_pending_mistakes` | 错词类题目来源 |
| `snapshot.recentLessons[].grammarPoint` | `course_knowledge_points` | 复习题来源 |
| `plan.selfChecks` | — | 题干中的强制自查项 |
| `plan.backfill` | `knowledge_points.is_backlog` | 补漏块题目 |

#### 执行流程

1. 按 `kind` 选题型模板与题量（见判断规则）。
2. 逐题生成 `prompt` 与 `referenceAnswer`。错词类题必须带 `fromMistakeId`，旧课类题必须带 `fromLessonNo`。
3. 把 `plan.selfChecks` 写进 `instructions`，并在相关题目的 `selfCheck` 上点名。
4. 自检：题中没有学生未学的词汇，没有未讲过的语法。

#### 判断规则

| 规则 | 内容 |
|---|---|
| 题量与时长 | 作业 3 小题 + 1 开放题（8—12 分钟）；复习 3—5 题（3—5 分钟）；补漏 3 题（5—8 分钟）；诊断 10 题 |
| 题型取值 | 只用 `fill_blank` / `translate` / `error_correction` / `reorder` / `open` / `choice` 六种 |
| 答案必填 | `referenceAnswer` 不得为空。缺答案的题不得进入题集 |
| 复习题必须可追溯 | `fromLessonNo` 或 `fromMistakeId` 至少一个存在 |
| 开放题只能一道 | 每份作业恰好 1 道 `open` 题，判「是否达到目标」而非逐字比对 |
| 不考未学内容 | 题干与答案中出现的非本课新词，必须已在历史词表中 |
| 强制自查 | 有 `selfChecks` 时，至少 1 道题的题干明确写出自查项 |

#### 异常情况

| 情况 | 处理 |
|---|---|
| 错词池为空 | 只出本课与旧课语法题，`fromMistakeId` 全部省略 |
| 题中引用了未学词汇 | **重出该题**，不得直接放行 |
| 找不到 `referenceAnswer` | 放弃该题，换用同类模板重出；连续两次失败则减少题量并说明 |
| 补漏块题量与内容超出 5—8 分钟 | 砍到 3 题，优先保留诊断价值高的 |
| 学生刚答错同一考点 | 本次不重复出同一题的原文，换形式考同一考点 |

#### 示例

```json
{
  "kind": "homework", "lessonNo": 7, "levelCode": "Level 2", "estimatedMinutes": 10,
  "instructions": "做完后自查两件事：句尾标点是否写了，可数名词有没有加 s。",
  "items": [
    { "exerciseNo": 1, "exerciseType": "fill_blank",
      "prompt": "I ___ (play) games yesterday.", "referenceAnswer": "played",
      "targetPoint": "L2-04", "selfCheck": "可数名词复数" },
    { "exerciseNo": 2, "exerciseType": "error_correction",
      "prompt": "改错：She studyed English last night.", "referenceAnswer": "She studied English last night.",
      "targetPoint": "L2-04" },
    { "exerciseNo": 3, "exerciseType": "translate",
      "prompt": "翻译：昨天我看了电视。", "referenceAnswer": "I watched TV yesterday.",
      "targetPoint": "L2-04" },
    { "exerciseNo": 4, "exerciseType": "open", "allowOpenEnded": true,
      "prompt": "用过去式写 3 句关于你上周做过的事。",
      "referenceAnswer": "参考答案：I played games last weekend. / I studied English. / I watched a movie.",
      "selfCheck": "句尾标点" }
  ]
}
```

第 1、4 题点名的自查项来自 `plan.selfChecks`——由 `play game` 累计 3 次、句尾缺问号累计 3 次这两个高频复发项生成（教学规则 R4）。

---

### 3.6 answer-grading

#### Skill 名称
`answer-grading`（批改）· 内嵌能力。由 `daily-lesson` 第 4、7 步调用。

#### 功能
批改学生作答，逐题给出判定、最小修正后的正确形式、错误类型与一句解释。把需要进错词本的错误整理成候选条目交给 `mistake-analysis`。

#### 输入

| 字段 | 必需 | 说明 |
|---|---|---|
| `exerciseSet: ExerciseSet` | ✅ | 题目与参考答案 |
| `answers: { exerciseNo, text }[]` | ✅ | 学生作答 |
| `expectedMistakes` | 可选 | 来自 `TeachingBlock`，用于回答「为什么不是 Y」 |

#### 输出
`GradingResult`。

#### 依赖数据

| 契约字段 | 后端表 | 用途 |
|---|---|---|
| `exerciseSet.items[].referenceAnswer` | `exercises.reference_answer` | 比对基准 |
| `exerciseSet.items[].targetPoint` | `course_knowledge_points` | 归因到知识点 |
| `snapshot.pendingMistakes` | `mistakes` | 判断是否为老错复发 |

#### 执行流程

1. 逐题判定，取四种结论之一：`correct` / `correct_with_note` / `wrong` / `blank`。
2. 判错时给出**最小修正**的 `correctText`（不改写整句），并写 `errorNote`。
3. 判错时按固定顺序判定 `errorType`（见判断规则），产出 `MistakeCandidate`。
4. 汇总 `summary`：错误处数、作答数、空题数、按类型分布。

#### 判断规则

`errorType` 判定分三步。**依据是错误主体，不是两种写法的差异大小**——按差异大小取最小的那一类会误判（`what do you do?` 只因句首大小写就被归到 `capitalization`）。

**第一步：单一差异**（两种写法只差一类）

| 差异性质 | 判定 | 真实例子 |
|---|---|---|
| 同一个词的同一个形态，仅字母写错（顺序错 / 漏 / 多 / 错） | `spelling` | `Theri` → `their`；`bush` → `busy`；`intrusting` → `interesting` |
| 统一大小写后两种写法完全相同 | `capitalization` | `zane` → `Zane`；`Tv` → `TV`；`those are…` → `Those are…` |
| 去掉标点与空格后两种写法完全相同 | `punctuation` | `Do you like coffee.` → `Do you like coffee?` |

> `studyed → studied`、`teached → taught` 属**形态变化**，不是拼写，走第二步判 `grammar`。

**第二步：多处差异**（按错误主体判，标点与大小写属附带修正）

| 错误主体 | 判定 | 真实例子 |
|---|---|---|
| 选错了词，含疑问词与搭配（换成另一个词才成立） | `word_choice` | `We see movie` → `We watch movies`；`What were you yesterday.` → `How were you yesterday?` |
| 动词形态 / 时态 / 语序 / 结构 / 主谓一致 / 虚词增减 | `grammar` | `play game` → `play games`；`I reading a book.` → `I am reading a book.`；`at yesterday` → `yesterday` |

存在多处差异时，标点与大小写**不作为归口依据**，只在 `errorNote` 里一并列出。

**第三步**：判不出错误主体 → `other`，标「待人工复核」，不猜测归因。

#### 规则回归（对 `wrong-words.md` 全部 19 条逐条走查）

| 结果 | 条数 | 说明 |
|---|---|---|
| 判定与现有记录一致 | 17 | 含全部单一差异条目与大部分多差异条目 |
| 判定与现有记录分歧 | 2 | 见下表 |

| 条目 | 现有记录 | 本规则判定 | 分歧原因 |
|---|---|---|---|
| `what do you do?` → `What are you doing?` | `word_choice` | `grammar` | 现有记录归入「用词/搭配类」，但错误主体是时态与结构（用一般现在时问正在进行的事）。若认定「学生知道两种形式但选错了」，则为 `word_choice` |
| `I am very busy.` → `We are busy.` | `grammar` | `word_choice` | 现有记录归入语法，但错误主体是中文「我们」被当作「我」（选错代词），`am → are` 是被动修正。按第二步应归 `word_choice` |

两条分歧恰好在 `grammar` 与 `word_choice` 之间**互换归属**，因此两类条数不变（均为 grammar 9 条、word_choice 4 条），分类趋势统计不受影响。分歧条目需由 Amy 裁定后统一，**本规则不单方面改动已有数据**。

其他判定规则：

| 规则 | 内容 |
|---|---|
| 最小修正 | `correctText` 只改错的地方，不重写整句 |
| 正确但有更优表达 | 判 `correct_with_note`，不计入错误数 |
| 空题 | 判 `blank`，不计对也不计错，单列 `blankCount` |
| 错误口径 | 汇总口径固定为**错误处数**，不折算百分制，与 `study_records(grade).payload` 一致 |
| 老错复发 | 与 `pendingMistakes` 中某条判重键相同时，在 `errorNote` 中注明「第 N 次犯」 |
| 每题必带解释 | 判错时 `errorNote` 必填，含一句为什么 |
| 不额外扣分 | 一次错误只记一次，不因同一个错误在多题出现而重复计数 |

#### 异常情况

| 情况 | 处理 |
|---|---|
| 学生未提交某题 | 判 `blank`，不追问、不计错 |
| 作答题意模糊、无法判定 | 判 `correct_with_note` 并在 `note` 说明歧义点；**不得直接判错** |
| 学生的答案正确但不在地道表达内 | 判 `correct`，另附改进建议，不新增错词 |
| 一题中多处错误 | 按本节判定规则取**错误主体**所属类别作为归口，其余差异在 `errorNote` 中一并列出；标点与大小写不参与归口 |
| 参考答案与学生答案等价 | 判 `correct`，不改写学生的表达 |
| 无法判定 `errorType` | 归 `other` 并标记需人工复核，**不猜测归因** |

#### 示例

```json
{
  "lessonNo": 7, "kind": "homework",
  "items": [
    { "exerciseNo": 1, "verdict": "wrong", "userAnswer": "play",
      "correctText": "played", "errorNote": "括号里给了 play，但句子说的是昨天，要用过去式 played。",
      "targetPoint": "L2-04" },
    { "exerciseNo": 2, "verdict": "wrong", "userAnswer": "She studyed English last night.",
      "correctText": "She studied English last night.",
      "errorNote": "辅音字母 + y 结尾要改 y 为 i 再加 -ed。", "targetPoint": "L2-04" },
    { "exerciseNo": 3, "verdict": "wrong", "userAnswer": "I watched TV yesterday",
      "correctText": "I watched TV yesterday.", "errorNote": "句尾漏了句号。", "targetPoint": "L2-04" }
  ],
  "mistakeCandidates": [
    { "wrongText": "play", "correctText": "played", "errorType": "grammar",
      "errorReason": "过去时要用过去式，不能用原形", "sourceExerciseNo": 1 },
    { "wrongText": "studyed", "correctText": "studied", "errorType": "grammar",
      "errorReason": "辅音字母 + y 结尾改 y 为 i 再加 -ed", "sourceExerciseNo": 2 },
    { "wrongText": "I watched TV yesterday", "correctText": "I watched TV yesterday.",
      "errorType": "punctuation", "errorReason": "陈述句句尾漏句号", "sourceExerciseNo": 3 }
  ],
  "summary": { "exerciseCount": 4, "errorCount": 3, "blankCount": 0,
               "byType": { "grammar": 2, "punctuation": 1 } }
}
```

注意第 2 题判 `grammar` 而非 `spelling`：`studyed` 与 `studied` 不是同一个词同一形态的拼法差异，而是过去式构成错误，按第二步判 `grammar`。第 3 题只差一个句号，按第一步判 `punctuation`。

---

### 3.7 mistake-analysis

#### Skill 名称
`mistake-analysis`（错词归并与模式识别）· 内嵌能力。由 `daily-lesson` 在批改之后调用。

#### 功能
把 `GradingResult` 的候选错误去重、归并进错词本，识别错误模式，对高频复发项发出警告。**它的产出直接决定下一课的强制自查项。**

#### 输入

| 字段 | 必需 | 说明 |
|---|---|---|
| `gradingResult: GradingResult` | ✅ | 本次候选错误 |
| `snapshot: AgentSnapshot` | ✅ | 历史错词，用于判重 |
| `reviewSession: ReviewSession` | 可选 | 复习答对答错的流水 |

#### 输出
`MistakeAnalysisResult`。

#### 依赖数据

| 契约字段 | 后端表 | 用途 |
|---|---|---|
| `snapshot.pendingMistakes` | `mistakes` | 判重与累加 |
| `gradingResult.mistakeCandidates` | — | 候选来源 |
| `reviewSession.outcomes` | `mistake_events` | 复习流水 |

#### 执行流程

1. 逐条候选做判重：判重键 = 规范化后的 `correctText` + `errorType`（去首尾空格、统一大小写、合并连续空格）。
2. 命中既有条目 → 进 `updatedMistakes`，`wrongCount+1` 且 `streak=0`。
3. 未命中 → 新建条目进 `newMistakes`。
4. 全部写入 `events` 流水（只增不改）。
5. 匹配错误模式（A / B / C）填 `patternHits`。
6. `wrongCount ≥ 3` 的条目生成 `recurrenceWarnings` 与建议自查项。

#### 判断规则

| 规则 | 内容 |
|---|---|
| 判重键 | 规范化 `correctText` + `errorType`。**仅部分相似不得合并** |
| 复发不新建 | 同一错误重复出现只累加 `wrongCount`，不新建条目 |
| 累加即归零 | 任意一次答错都把 `streak` 归零 |
| 过关 | 连续答对 2 次 → `status=passed`，离开每日复习队列 |
| 模式 A 形态限定类 | 可数名词裸用、漏 be 动词、不规则过去式、三单 -s。处置：2 次过关制 + 作业强制自查 |
| 模式 B 书写规范类 | 问号、句首大写、逗号连句、空格。处置：每课开场固定自查 + 作业前提示 |
| 模式 C 用词搭配类 | watch/see、ask for、how/what。处置：讲清「为什么不能用另一个」+ 当堂验证题 |
| 高频复发门槛 | `wrongCount ≥ 3` 触发 `RecurrenceWarning`，并生成下一课 `selfChecks` |
| 相似不自动合并 | 疑似相似时写入 `similarTo` 供人工复核，**不得自动合并** |

#### 异常情况

| 情况 | 处理 |
|---|---|
| 同一次批改里同一错误出现两次 | 只记一次错误，`wrongCount` 只加 1 |
| 候选与既有条目疑似相关但不完全一致 | 新建条目，同时写入 `similarTo`，交人工复核 |
| `errorType` 为 `other` | 单独列出并标「待人工复核」，不参与模式统计 |
| 历史错词表为空 | 全部作为新条目，`patternHits` 可为空数组 |
| 学生复习答对 | 只更新 `streak` 与流水，`wrongCount` 不变 |
| 错词条目数增长过快（单课新增 >8 条） | 在 `SkillRun.notes` 提示降难度，并在下一课减少新语法点内容量 |

#### 示例

```json
{
  "lessonNo": 7,
  "newMistakes": [
    { "id": 21, "wrongText": "studyed", "correctText": "studied", "errorType": "grammar",
      "errorReason": "辅音字母 + y 结尾改 y 为 i 再加 -ed", "streak": 0, "wrongCount": 1, "status": "pending" }
  ],
  "updatedMistakes": [
    { "mistakeId": 12,
      "after": { "id": 12, "wrongText": "play game", "correctText": "play games", "errorType": "grammar",
                 "streak": 0, "wrongCount": 3, "status": "pending", "priority": "high" },
      "beforeStreak": 0, "beforeStatus": "pending" }
  ],
  "patternHits": [
    { "pattern": "A", "evidence": "可数名词裸用与过去式形态错误同时出现", "mistakeIds": [12, 21] },
    { "pattern": "B", "evidence": "句尾标点错误复发", "mistakeIds": [15] }
  ],
  "recurrenceWarnings": [
    { "mistakeId": 12, "wrongCount": 3, "suggestedSelfCheck": "可数名词复数" },
    { "mistakeId": 15, "wrongCount": 3, "suggestedSelfCheck": "句尾标点" }
  ]
}
```

`recurrenceWarnings` 里两项的 `suggestedSelfCheck` 就是第 7 课起作业的强制自查项，与 `ExerciseSet.instructions` 一一对应。这条链是「错词 → 自查项 → 作业」的完整闭环。

---

### 3.8 learning-progress-analysis

#### Skill 名称
`learning-progress-analysis`（学情分析）· 独立 Skill。用户说「我学得怎么样」时单独触发。

#### 功能
评估当前水平、定位瓶颈、给出可判定的级别建议。核心是把**理解**与**产出**分开评估——两者不同步时，结论会完全不同。

#### 输入

| 字段 | 必需 | 说明 |
|---|---|---|
| `snapshot: AgentSnapshot` | ✅ | 含 `errorTrend`、`pendingMistakes`、`recentLessons` |
| `windowSize: integer` | 可选 | 回溯课数，默认 3 |

#### 输出
`ProgressReport`。

#### 依赖数据

| 契约字段 | 后端表 | 用途 |
|---|---|---|
| `snapshot.progress` | `user_progress` | 当前级别与连击 |
| `snapshot.errorTrend.byLesson` | `study_records(grade)` 聚合 | 错误趋势（缺口 G1） |
| `snapshot.pendingMistakes` | `mistakes` | 复发项与分布 |
| `snapshot.recentLessons[].feedback` | `progress_feedback` | 难度反馈序列 |
| `snapshot.backlog` | `knowledge_points` | 欠账（缺口 G3） |

#### 执行流程

1. 取最近 `windowSize` 课的错误数，形成 `trend`。
2. 按 `errorType` 把错误分成理解型与产出型，各自定级填 `errorSplit`。
3. 逐维度评估 `dimensions`：语法、词汇、阅读、拼写标点、自检习惯。每项给出 `stable` / `unstable` / `untested` 与证据。
4. 按 R1 / R3 / R4 给出 `levelRecommendation`。
5. 定位 `bottleneck` 并给可执行动作。

#### 判断规则

| 规则 | 内容 |
|---|---|
| 理解与产出分开 | 理解型错误 = `word_choice`（知道意思但选错）；产出型 = `grammar` + `spelling` + `punctuation` + `capitalization`（知道规则但写错） |
| 产出型优先定级 | 综合级别取「理解级」与「产出级」中较低者 |
| 趋势判定 | 连续 3 课错误数**持续下降**才算改善；持平或回升都算未改善 |
| 样本不足 | 课数 < 3 时 `bottleneck.kind = insufficient_sample`，只给单课结论，不给趋势 |
| 加速条件 R3 | 需「连续 2—3 课错误 ≤2 处 **且** 反馈为太简单」，任一不满足即不建议加速 |
| 冻结条件 R1 | 连击满 2 次但同类老错仍复发 → `action = freeze` 并必填 `unlockCondition` |
| 瓶颈必须可执行 | `bottleneck.summary` 要说明「缺什么动作」。当前学生的问题不是「没学过」，而是「没形成自检习惯」——这类结论必须落到动作上 |
| 证据可追溯 | `dimensions[].evidence` 必须能指回具体课号或错词 id |
| 不给无证据结论 | 未测过的维度标 `untested`，不猜 |

#### 异常情况

| 情况 | 处理 |
|---|---|
| 快照缺 `errorTrend` | 降级：用 `pendingMistakes` 的 `firstCourseNo` / `lastCourseNo` / `wrongCount` 推算分布，标 `degradation`，**不给趋势结论** |
| 课数 < 3 | 标 `insufficient_sample`，只输出单课结果 |
| 全部维度均为 `untested` | 直接说明样本不足并停止，不编造评估 |
| 级别建议与连击计数冲突 | 以规则 R1 / R3 为准，并在 `reason` 中写明冲突点与 `ruleRefs` |
| 学生要求「给个分数」 | 说明口径是错误处数不是百分制，可给错误率，不折算分数 |
| 学生要求预测何时升到 Level 3 | 不给时间承诺，只给触发升级的条件 |

#### 示例

第 6 课后的真实结论（源自 `docs/ai-teacher.md` 2.5）：

```json
{
  "asOfLessonNo": 6, "asOfDate": "2026-09-29", "sampleSize": 6,
  "dimensions": [
    { "name": "grammar", "assessment": "stable",
      "evidence": ["第 4—5 课进行时作业正确", "第 6 课复习 was/were 正确"] },
    { "name": "spelling_punctuation", "assessment": "unstable",
      "evidence": ["第 6 课错词 at yesterday", "第 4、6 课 play game 累计 3 次",
                   "问号类错误 ≥3 次", "句首大写 2 次"] },
    { "name": "self_check_habit", "assessment": "unstable",
      "evidence": ["同一批题目口头判断正确、书面产出出错", "第 3 课规范达标时错误数 4 → 2"] }
  ],
  "errorSplit": { "understandingLevel": "Level 2", "productionLevel": "Level 1",
                  "understandingErrors": 4, "productionErrors": 15 },
  "trend": [ { "lessonNo": 4, "errorCount": 6 }, { "lessonNo": 5, "errorCount": 2 },
             { "lessonNo": 6, "errorCount": 5 } ],
  "bottleneck": {
    "summary": "不是没学过，而是没形成自检习惯：口头判断正确、书面产出出错",
    "kind": "no_self_check_habit",
    "actions": ["作业加强制自查项：句尾标点 + 可数名词复数"] },
  "levelRecommendation": {
    "action": "hold", "targetLevel": "Level 2",
    "reason": "第 5 课错误 2 处但反馈为刚好，第 6 课错误回升至 5 处，不满足 R3 加速条件",
    "ruleRefs": ["R3", "R4"] }
}
```

注意 `understandingLevel = Level 2` 而 `productionLevel = Level 1`——两者差一级是真实存在的状态。若只看总错误数，会把结论误判为「基础不牢」，而正确结论是「规则懂了，产出缺自查」。

---

### 3.9 next-lesson-planning

#### Skill 名称
`next-lesson-planning`（下一课规划）· 内嵌能力。由 `daily-lesson` 第 1—2 步调用。

#### 功能
决定下一课学什么、从哪些课与错词复习、补漏补什么、作业强制自查哪几项，产出 `LessonPlan`。

#### 输入

| 字段 | 必需 | 说明 |
|---|---|---|
| `snapshot: AgentSnapshot` | ✅ | 级别、课号、错词、待补清单 |
| `progressReport: ProgressReport` | 可选 | 有则用其级别建议，无则按连击规则自行判定 |
| `topicOverride: string` | 可选 | 学生指定主题 |

#### 输出
`LessonPlan`。

#### 依赖数据

| 契约字段 | 后端表 | 用途 |
|---|---|---|
| `snapshot.progress` | `user_progress` | 级别与前课号 |
| `snapshot.courseCatalog` | `courses` | 定课号 |
| `snapshot.backlog.backfillQueue` | `knowledge_points.is_backlog` | 取补漏块（缺口 G3） |
| `snapshot.pendingMistakes` | `mistakes` | 复习来源与强制自查项 |
| `snapshot.errorTrend` | `study_records(grade)` | R3 加速判断（缺口 G1） |
| `snapshot.lastIncomplete` | `study_records(feedback)` | 断更后接续（缺口 G4） |

#### 执行流程

1. 定课号 N = `max(courseCatalog.lessonNo) + 1`，推导 `sourceFile`。
2. 定级别：有 `progressReport.levelRecommendation` 时按它；无则按连击规则（太简单连续 2 次升、太难 1 次降）。
3. 取知识点：当前级别 `level-map` 中的下一个未学点，标 `role=new`。
4. 取补漏块：`backlog.backfillQueue` 中 `status="next"` 的一项，标 `role=backfill`。为空则 `backfill=null`。
5. 定 `reviewSources`：N-1、N-3、N-7 各一题（存在的才写），其余取自错词池。
6. 定 `selfChecks`：取 `recurrenceWarnings` 的 `suggestedSelfCheck`。
7. 定 `vocabularySize` 与 `objectives`（1—3 条）。

#### 判断规则

| 规则 | 内容 |
|---|---|
| 课号连续 | N = 最大课号 + 1，断更不断号 |
| 一课一点 | `grammarPoint` 只有一个，`role=new` |
| 补漏不占额度 | `backfill` 是独立小节，不计入语法点数量 |
| 补漏 FIFO | 按 `backfillQueue` 顺序取 `status="next"` 的一项 |
| 升级不豁免欠账（R2） | 升级后，上一级未学的知识点转 `backlog`，以补漏块消化，不回头单独成课 |
| 加速条件（R3） | 仅当连续 2—3 课错误 ≤2 处且反馈为太简单，才在 `objectives` 中写入第二个知识点 |
| 暂停加速（R4） | 老错复发时，`selfChecks` 必须包含对应自查项 |
| 中断接续 | 有 `lastIncomplete` 时，从中断的教学动作继续，不重讲已完成的环节 |
| 学生主题优先 | `topicOverride` 存在时覆盖 `grammarPoint`，但 `backfill` 与 `selfChecks` 不变 |

#### 异常情况

| 情况 | 处理 |
|---|---|
| `level-map` 无下一个知识点（当前级已学完） | 提议升级，`levelRecommendation.action = "upgrade"`；由 `daily-lesson` 向学生确认后执行，**不擅自跳级** |
| 账本不一致（`courseCatalog` 最大课号 ≠ `progress.currentCourseNo`） | 以课号为准，在 `SkillRun.notes` 记录「已按笔记修正」 |
| 刚降级 | 回退到上一级未覆盖的知识点，`backlog` 中已完成的项不再重复排 |
| 补漏队列为空 | `backfill = null`，本课只讲新知识点 |
| 学生指定主题与当前级别不符（过难） | 说明难度差距，给「按级别讲」与「按你要求讲」两个选项，等确认后再定 `LessonPlan` |
| 高频复发项超过 3 条 | `selfChecks` 最多保留 2 条最重要的（按 `wrongCount` 取），避免自查项过多形同虚设 |

#### 示例

```json
{
  "lessonNo": 7, "lessonDate": "2026-09-30", "levelCode": "Level 2",
  "sourceFile": "day-01-07.md",
  "summary": "学会规则动词过去式 -ed，能说清「上周做了什么」",
  "objectives": [
    "能写出规则动词的 -ed 形式（play→played、study→studied、stop→stopped）",
    "能用过去式写 3 句关于上周的事"
  ],
  "grammarPoint": { "code": "L2-04", "title": "规则动词过去式", "role": "new" },
  "backfill": { "seq": 4, "title": "介词 on / at" },
  "vocabularySize": 10,
  "reviewSources": [
    { "source": "N-1", "detail": "第 6 课 was/were", "count": 1 },
    { "source": "N-3", "detail": "第 4 课现在进行时", "count": 1 },
    { "source": "mistake", "detail": "play games、句尾问号", "count": 3 }
  ],
  "selfChecks": ["句尾标点", "可数名词复数"],
  "expectedMistakes": [
    { "wrong": "I studyed English.", "correct": "I studied English.", "reason": "改 y 为 i 再加 -ed" }
  ]
}
```

第 7 课是 `day-01-07.md` 的最后一课；**第 8 课起 `sourceFile` 将变为 `day-08-14.md`**，由课号推导自动切换。

---

## 四、与后端协作

### 4.1 数据依赖矩阵（按后端数据域）

| Skill | 学生历史课程 | 学习记录 | 错题 | 单词掌握 | 学习等级 | 练习结果 | 知识点地图 | 阅读 |
|---|---|---|---|---|---|---|---|---|
| `daily-lesson` | ✅ 课号 / 摘要 / 语法点 | ✅ 批改与反馈 | ✅ 未过关池 | ✅ 词表去重 | ✅ 级别 / 连击 | ✅ 错误处数 | ✅ 补漏队列 | ✅ 当天是否已生成 |
| `lesson-review` | ✅ N-1/N-3/N-7 | ⚠️ 仅流水 | ✅ 主取词池 | — | ⚠️ 只读 | ⚠️ 对错流水 | — | — |
| `grammar-teaching` | ✅ 是否已讲 | — | ✅ 复发项 | — | ✅ 级别 | — | ✅ 顺序与待补 | — |
| `vocabulary-teaching` | ✅ 历史词表 | — | — | ✅ 唯一性 | ✅ 级别定词量 | — | — | — |
| `exercise-generation` | ✅ 旧课语法点 | — | ✅ 错词出题 | ✅ 词汇约束 | ✅ 级别 | ⚠️ 近期错题 | ✅ 补漏题源 | — |
| `answer-grading` | — | — | ✅ 复发判定 | ✅ 词形基准 | — | ✅ 作答与判定 | ⚠️ 归因 | — |
| `mistake-analysis` | ✅ 犯错课号 | ✅ 事件流水 | ✅ 核心 | — | — | ✅ 错误分布 | — | — |
| `learning-progress-analysis` | ✅ 课清单 | ✅ 趋势（G1） | ✅ 分布与复发 | ✅ 词量 | ✅ 核心 | ✅ 错误序列 | ✅ 欠账（G3） | ✅ 阅读量 |
| `next-lesson-planning` | ✅ 定课号 | ✅ 上次未完成（G4） | ✅ 自查项 | ✅ 词量 | ✅ 核心 | ✅ 趋势（G1） | ✅ 核心 | ⚠️ 当天是否需生成 |

图例：✅ 强依赖；⚠️ 弱依赖或仅读取；— 不依赖。

### 4.2 依赖契约缺口登记

以下缺口来自 `docs/ai-teacher.md` 9.3 与 5.4，**本文件只登记需求，不代表后端已同意实现**。缺口未补齐时，Skill 走降级路径而不是报错。

| # | 缺口 | 需求字段 | 影响哪些 Skill | 缺省时的降级 |
|---|---|---|---|---|
| G1 | `snapshot` 无错误趋势 | `errorTrend`、`recentLessons[].errorCount` | `learning-progress-analysis`、`next-lesson-planning`、`daily-lesson` | 不给趋势结论；跳过 R3 加速判断 |
| G2 | `pendingMistakes[].priority` 未定义 | `priority`（`wrongCount≥2` → high，`streak==1` → medium，其余 low；同级按 `updated_at ASC`） | `lesson-review`、`exercise-generation` | 自行按 `wrongCount` 降序、`lastReviewedAt` 升序排序 |
| G3 | 无待补知识点 / 补漏队列 | `backlog.pendingKnowledgePoints`、`backlog.backfillQueue` | `next-lesson-planning`、`grammar-teaching` | 本课不排补漏块 |
| G4 | 无「上次未完成的教学动作」 | `lastIncomplete` | `daily-lesson`、`next-lesson-planning` | 中断后从头开始，需学生确认 |
| G5 | `courses.study_minutes` 由谁填未定 | `LessonRecord.studyMinutes` | `daily-lesson` | 留空，不做时长统计 |

**本设计新增的两项请求（不在 G1—G5 内）**：

| # | 需求 | 影响 |
|---|---|---|
| S1 | `course_sections.section_type` 增 `objectives`、`expected_mistakes` | 仅加枚举值，不改类型、不动存量数据。若不实现，`LessonPlan.objectives` 与 `TeachingBlock.expectedMistakes` 只写进 `grammar` 小节正文，**平台化后无法按目标与预判错误做统计** |
| S2 | 新增 `POST /skill-runs` 的 `parentSkillRunId` 语义 | 现有 `skill_runs` 无父子关系字段，内嵌能力的调用树无法还原。若不实现，退化为按 `course_id` + `created_at` 时序推断 |

### 4.3 后端未就绪期间的降级方案（当前生效）

Skill 侧完全按契约工作，数据由 markdown 适配层合成：

| 契约对象 | markdown 来源 | 合成难点 |
|---|---|---|
| `AgentSnapshot` | `digest.md` + `progress.md` + `wrong-words.md` | `errorTrend` 需从笔记批改小节推算；`backlog` 需从 `progress.md` 待补清单解析 |
| `LessonRecord` | 追加写 `notes/day-XX-YY.md`；同时产出契约对象供未来提交 | md 是当前唯一落地形式 |
| `ReadingSet` | `read/YYYY-MM-DD-read.md` | 一段英文一段中文的结构需严格按模板写 |
| `MistakeAnalysisResult` | `wrong-words.md` 表格 | 表格列与 `MistakeItem` 字段一一对应 |
| `ProgressReport` | 无落地文件，仅输出给学生 | — |
| `SkillRun` | 无落地文件 | 后端就绪前不落盘，仅在对话中留痕 |

适配层是**唯一允许接触 md 文件的地方**。它不承担任何教学判断，只做格式翻译。

### 4.4 接口清单

**Skill 读（阶段 B）**

| 接口 | 谁用 |
|---|---|
| `GET /agent/snapshot?recent=3` | 全部 9 个 Skill |
| `GET /courses/latest` | `daily-lesson`（回答「上次学到哪了」） |
| `GET /mistakes?status=pending` | `lesson-review`、`exercise-generation` |
| `GET /vocabulary/stats` | `learning-progress-analysis` |

**Skill 写（阶段 B）**

| 接口 | 谁用 | 时机 |
|---|---|---|
| `POST /courses` | `daily-lesson` | 归档 |
| `PUT /courses/:id` | `daily-lesson` | 回填批改与反馈 |
| `POST /mistakes` | `mistake-analysis` | 发现新错词 |
| `POST /mistakes/:id/review` | `lesson-review`、`daily-lesson` | 每次判对错 |
| `POST /progress/feedback` | `daily-lesson` | 收难度反馈 |
| `POST /study-records` | `daily-lesson` | 下课时（`grade` / `feedback`） |
| `POST /readings` | `daily-lesson` | 生成当日阅读 |
| `POST /skill-runs` | 全部 Skill | 每次执行 |

---

## 五、异常与降级矩阵

| 故障 | 影响范围 | 降级动作 | 是否继续主流程 | 标注方式 |
|---|---|---|---|---|
| 后端不可用 | 全部 | 切 `deploymentMode = "markdown"`，适配层接管 | ✅ 继续 | `degradation.reason` |
| 快照缺 `progress` | 全部 | **停止** | ❌ 停止 | 报告缺失字段 |
| 快照缺 `errorTrend` | R3 判断 | 跳过加速复议，按维持级别 | ✅ 继续 | `affected=["R3"]` |
| 快照缺 `backlog` | 补漏块 | 本课不排补漏 | ✅ 继续 | `affected=["补漏块"]` |
| 快照缺 `lastIncomplete` | 断更补课 | 从头开始，先向学生确认 | ✅ 继续 | `affected=["中断接续"]` |
| 网络不可用（Level 4—5） | 当日阅读 | 自编同级短文 | ✅ 继续 | `source="自编（当日新闻获取失败）"` |
| 搜不到当日新闻 | 当日阅读 | 同上 | ✅ 继续 | 同上 |
| `level-map` 无下一个知识点 | 讲新课 | 提议升级，等学生确认 | ⏸ 等确认 | `levelRecommendation.action="upgrade"` |
| 当天阅读文件已存在 | 阅读环节 | 跳过生成 | ✅ 继续 | `SkillRun.notes` |
| 归档脚本返回 `BOARD_FAIL` | 看板 | 修格式后重跑，不手改生成物 | ⏸ 修完继续 | 上报错误原因 |
| 学生未作答 | 当前环节 | 停在等待点，不代答 | ⏸ 等待 | — |
| 学生中途离开 | 整课 | 未到归档点不写笔记，只记 `partial` | ⏸ 停止 | `SkillRun.status="partial"` |
| 模型无法判定 `errorType` | 错词归口 | 归 `other` 并标待人工复核 | ✅ 继续 | `备注=待人工复核` |
| 脚本缺 Python 环境 | 看板生成 | 提示缺失项，暂停看板重建，笔记照常归档 | ⚠️ 部分继续 | `ENV_STATUS=needs_setup` |

**停止条件（硬边界）**：

- 学生未作答时，不推进下一环节，不替学生写答案。
- 不删除、不重命名、不移动任何已有笔记与阅读文件。
- 不手工修改脚本生成物（`INDEX.md`、`digest.md`、`review/*.html`）。
- 不擅自跳级；升级必须先说明并等学生确认。
- 不编造新闻内容，不用旧新闻冒充当日新闻。

---

## 六、质量门槛

### 6.1 制作质量 11 项

每个 Skill 落地时按 `skill-crafting` 的 11 项标准自检：选题价值、定位清晰度、触发描述质量、信息增量、工作流程完整性、输出可执行性、边界与停止条件、复杂度适配、参考资料质量、脚本健壮性与实测、安全与隐私。

**分档门槛**：任一适用维度 ≤3 或平均分 <6.0 → 需重做；任一项 <8 或存在未解决的 P2 → 需修改；全部 ≥8 且平均分 ≥8.0 且触发与脚本实测均有真实证据 → 可交付。

### 6.2 各 Skill 的验收条件

| Skill | 可判定的验收条件 |
|---|---|
| `daily-lesson` | 11 步全部执行；4 个等待点均真实停住；归档只追加；`LessonRecord` 与 md 内容一致 |
| `lesson-review` | 3—5 题全部带 `sourceTag`；无一道临时编造；答对答错正确更新连击 |
| `grammar-teaching` | 只讲 1 个语法点；`familyCoverage` 三项齐全；例句只用已学词汇 |
| `vocabulary-teaching` | 词量与 `vocabularySize` 一致；无重复词；每词有音标与中文 |
| `exercise-generation` | 每题有 `referenceAnswer`；复习题可追溯；作业恰好 1 道开放题；`selfChecks` 已写入 |
| `answer-grading` | 每题有判定与解释；`errorType` 判定可复现；`summary` 口径为错误处数 |
| `mistake-analysis` | 判重键一致；同错误不新建；`wrongCount ≥3` 产出 `RecurrenceWarning` |
| `learning-progress-analysis` | 理解与产出分开定级；证据可指回课号或错词 id；样本 <3 时标 `insufficient_sample` |
| `next-lesson-planning` | 课号连续；`sourceFile` 由课号正确推导；补漏 FIFO；`selfChecks` 与复发项对应 |

### 6.3 实测状态（截至 2026-09-29）

| 项 | 状态 | 证据 |
|---|---|---|
| 12 个契约文件的 JSON 合法性 | ✅ **已实测** | `SCHEMA_CHECK files=12 refs=84 objects=68`，`SCHEMA_OK` |
| 契约间 `$ref` 引用完整性 | ✅ **已实测** | 84 个引用全部可解析；`required` 字段定义完整 |
| `daily-lesson` 全流程跑通 | ✅ **有实证** | 现有实现 `english-daily` v2.2.0 已实跑 6 课，`BOARD_OK 课程数=6 阅读数=11 词汇数=52` |
| 其余 8 个 Skill 的独立触发识别 | ❌ **未执行** | 本环境无模型调用能力，无法做真实触发测试 |
| Skill 间契约传递与调用树 | ❌ **未执行** | 后端无代码，无法联调 |
| 与后端接口的读写联调 | ❌ **未执行** | `backend/` 仅有设计稿，无 `package.json` 与 `src/` |
| `errorType` 判定规则 | ⚠️ **静态走查完成，未程序化测试** | 对 `wrong-words.md` 现有 19 条逐条走查：17 条与现有记录一致，2 条归属分歧（`what do you do?`、`I am very busy.`），分歧原因见 3.6。两类条数不受影响。该规则依赖语义判断，**无法用脚本自动验证** |
| Level 4—5 新闻取材 | ❌ **未验证** | 本环境网络不通；新闻源可达性未确认 |

> 未实测项不得声明通过。上表为交付时的真实状态。

---

## 七、迁移路线图

### 7.1 阶段 A（当前）：markdown 适配层

| 步骤 | 内容 | 产出 |
|---|---|---|
| A1 | 定义契约（本文件与 `docs/schemas/`） | ✅ 本轮完成 |
| A2 | 实现 markdown 适配层：读 md → 合成 `AgentSnapshot` 等契约对象 | 待实现 |
| A3 | 把 `daily-lesson` 的现有内嵌能力按契约表述固化为 6 个能力模块 | 待实现 |
| A4 | 补 `lesson-review` 与 `learning-progress-analysis` 的独立触发入口 | 待实现 |
| A5 | 补 `mistake-analysis` 的 `errorType` 判定规则（本文件 3.6 已给出可执行顺序） | 待实现 |

阶段 A 的验收：**在完全不碰后端的前提下，9 个 Skill 的契约数据流能完整走通一遍。**

### 7.2 阶段 B（后端就绪后）

| 步骤 | 内容 | Skill 改动量 |
|---|---|---|
| B1 | 后端实现 `GET /agent/snapshot` 与各写接口 | — |
| B2 | `deploymentMode` 从 `markdown` 切到 `backend` | **零改动** |
| B3 | 契约缺口 G1—G5 由后端补齐 | **零改动**（字段为可选，补上后自动启用增强能力） |
| B4 | 前端从静态 `review/*.html` 迁到 Vue | **零改动** |

切换点验证方式：同一课在 A、B 两阶段产出的 `LessonRecord` 应逐字段一致；不一致即为设计缺陷。

### 7.3 现有 `english-daily` 的处置

现有实现 v2.2.0 即 `daily-lesson` 的当前形态。**本轮不改动它**，后续演进建议：

| 项 | 现状 | 目标 |
|---|---|---|
| 名称 | `english-daily` | `daily-lesson`（与 `AGENTS.md` 对齐） |
| 状态来源 | 直读 `digest.md` | 经适配层产出 `AgentSnapshot` |
| 内嵌能力 | 混在 SKILL.md 正文里 | 按契约拆为 6 个能力模块 |
| 复习 | 内嵌第 3—4 步 | 可被 `lesson-review` 独立调用 |
| 学情分析 | 无 | 接入 `learning-progress-analysis` |

改名会影响触发词，需在改造时同步更新 `description` 并做触发测试。

**已退役（待清理）**：`scripts/build_board.py`。它的 HTML 生成职责已于 2026-09-29 下线（`review/` 改为纯 API 驱动静态页）；`INDEX.md` / `digest.md` 的产出职责自 2026-09-30 起退役，改由后端数据更新。**代码暂不删除**——`build_board.py` 剩下的唯一用途是**第 1—6 课的历史回填**（那批数据没有 `records/` JSON，只能从 md 推），历史回填完成后即可删除脚本：这是清理的实际前置条件。

**接盘方已明确：`records/` 结构化归档**（见 2.5）。md 解析链的正向职责已被 `records/lesson-NN.*.json` 取代——后端只读 JSON、不解析散文。**注意：`backend/db/migration/export_md_to_json.py` 已不再依赖它**。该脚本已于 2026-09-30 改造为**自包含**（内联全部正则与解析函数，删除 `import build_board` 与 `load_build_board()`），因此 `build_board.py` 现在**没有任何下游消费方**；`compare_snapshot.js` 只读导出的 `_snapshot.json`，与该脚本无耦合。

**前置条件已满足，并已执行删除（2026-09-30）**：脚本的最后用途是「第 1—6 课历史回填」，该批数据已通过 `db:export` → `db:import` 落库并验收（`lesson_sections` 12 → 51、`lesson_exercises` 0 → 34、`readings` 4 天/11 篇/22 题，见 `backend/docs/04-migration-and-roadmap.md` §五之三，`npm run db:compare` 全绿）。**Skill 设计师已在 v2.3.0 删除脚本**（受控源 + 运行副本各一份），并同步清空全部残留引用：

| 文件 | 处理 |
|---|---|
| `scripts/build_board.py` | **已删除**（受控源 + 运行副本）。删除前备份 `.workbuddy/skill-backups/english-daily-v2.2.3-20260930-pre-delete/`；回滚点 git `5aab235` / `87ee73e` |
| `SKILL.md` | 第七章第 3 项整段删除；流程中「目录与摘要」那一步删除（汇报顺延为第 10 步）；第七章由「三个脚本」改为「两个脚本」；自查清单与停止条件改为「目录与摘要由后端数据更新，不手工改」 |
| `skill-dependencies.json` | 移除 `总目录重建` / `复习看板生成` 两个能力及其全部条目；`python-runtime` 的作用域收敛为 `上课与笔记归档`；`verify` 的 `BOARD_OK` 改为 `init_workspace.py` 的 `INIT_OK` |
| `scripts/init_workspace.py` | `INDEX.md` 模板文案不再提脚本 |
| `references/setup-guide.md` | 依赖表 / 用途 / 降级矩阵改为「目录初始化与环境自检」，并注明总目录与看板不由脚本产出 |
| `references/course-template.md` | 4 处「看板解析 / 看板生成词卡」改为「后端按标题解析 / 词汇卡页 / 阅读页」 |

版本 **2.2.2 → 2.2.3 → 2.3.0**（本次为 MINOR：能力移除 + 依赖清单结构变更，即上文原先预留的那次）。清理后 Skill 内已无 `build_board` / `BOARD_OK` / `BOARD_FAIL` 任何引用，受控源与运行副本 `diff -r` 完全一致。

### 7.4 Skill 源码入库（已完成）

**决策**：Skill 源码纳入版本库。理由：`.gitignore` 第 2 行排除整个 `.workbuddy/`，仓库丢失即无法恢复 Skill。

**已落库（方案 A：只入库 `skills/`，`.workbuddy/` 保持整体忽略）**：`skills/english-daily/` 的 7 个源文件均已 git 跟踪（`SKILL.md`、`skill-dependencies.json`、`scripts/{check_environment,init_workspace}.py`、`references/{course-template,level-map,setup-guide}.md`），首轮入库提交 `5aab235` 与 `87ee73e`（当时含 `build_board.py`，该文件已在 v2.3.0 删除，见 7.3）。`.gitignore` 未改动；`scripts/__pycache__/` 是编译产物，不入库。

**唯一真源与同步方向**：受控权威 = 版本库 `skills/english-daily/`；`.workbuddy/skills/english-daily/` 为**运行副本**。同步方向**单向**「受控 `skills/` ⇒ 运行时 `.workbuddy/skills/`」，**禁止反向**。改 Skill 一律先改受控源再复制过去；两侧内容不一致即视为事故（即原 G-5 多副本漂移）。

**为什么不能用否定写法 `.workbuddy/` + `!.workbuddy/skills/`（实测结论，避免后人再踩）**：git 不允许在父目录被**整体排除**后重新包含其子内容——父目录已被排除，git 根本不会再进入该目录去匹配子路径的否定规则。已实测（临时仓库 `git check-ignore -v`）：

```text
方案 A：.workbuddy/  + !.workbuddy/skills/   →  命中原规则（仍被忽略，无效）
方案 B：.workbuddy/* + !.workbuddy/skills/   →  退出码 1（未被忽略，有效）
```

方案 B 虽然可行，但会让仓库同时存在 `.workbuddy/skills/`（运行副本）与 `skills/`（受控源码）两份副本，重演「哪份权威」的二义；且 `.workbuddy/` 下还有 `tmp`、`memory`、`skill-backups` 等需逐条排除。故**采用方案 A**，受控源码只落在仓库根的 `skills/`。

**消费方（已收敛为 0）**：`export_md_to_json.py` 曾以库形式加载 `skills/english-daily/scripts/build_board.py`；自 2026-09-30 改造为自包含后，**已不再有任何脚本 import `build_board.py`**，`skills/` 目录下不再有被后端消费的文件。实测：临时移走 `build_board.py` 副本后，导出仍输出 `M2_EXPORT_OK lessons=6 vocab=52 exercises=25 mistakes=19 readings=4(pieces=11)`。

> 留档：`export_md_to_json.py` 自包含前的行为是「解析库默认目录 = `<root>/skills/english-daily/scripts`，不依赖 `.workbuddy/`」；自包含后该路径配置已一并移除。

**未决点**：`skills/` 只存源码，构建产物仍放 `.workbuddy/build/` 且不入库。

---

## 八、风险登记与待办

### 8.1 风险

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | Skill 源码不在版本库 | 工作区丢失即无法恢复 | **已解决**：见 7.4，8 文件已落库 |
| R2 | 适配层与后端契约漂移 | 阶段 B 切换时字段对不上 | 契约以 `docs/schemas/` 为唯一来源；后端改动需同步本目录 |
| R3 | 6 个内嵌能力长期不独立，职责继续糊在一起 | `mistake-analysis` 的分类继续靠人工 | 阶段 A 的 A3 / A5 优先做 |
| R4 | `errorType` 判定靠模型，可能出现分类漂移 | 趋势统计失真 | 本文件 3.6 已给出固定判定顺序；落地后需抽样复核 |
| R5 | 触发词「继续」歧义 | 误触发完整上课流程 | 见 1.3，独立出现时先确认 |
| R6 | 错词条目增长快于消化速度 | 复习队列长期不清空 | 单课新增 >8 条时提示降难度 |
| R7 | **解析职责悬空**：`build_board.py` 退役后，md 解析仅剩历史回填（第 1—6 课）一个用途 | 回填未完成就删脚本 → 那批 `is_correct` / `error_type` 无处可推 | **已闭合**：历史回填已由 `records/` + `db:import` 完成（2026-09-30，34/34 题判定入库）；且 `export_md_to_json.py` 已自包含、无下游消费方 → 脚本已在 **v2.3.0 删除**并清空全部引用（见 7.3） |
| R8 | 补漏块与作业题共用 `lesson_exercises` 的题号空间 | 作答与批改互相覆盖，静默丢数据 | **已解决**：见 2.5：加 `block_kind` / `block_no`，唯一键扩为四列；`block_no` 取 0 不取 NULL。实测已回填作业 25 + 补漏块 9 = 34 条，两套题号共存 |
| R9 | 阅读理解题「题干行 + 答案行」按行切分，答案行被当成新题 | 题数与空题干双翻倍（2 题 → 4 条） | **已修复**：导出器改为「答案行并入上一题」，并在 `compare_snapshot.js` 固化断言（`reading_questions` 题数 = md 题数）。见 04-migration 五之三 |
| R10 | `db:init` 重跑会把 `db:import` 回填的 md 原文小节打回 seed 简化版 | 回填结果被静默回退 | **已修复**：`seed.js` 的 `lesson_sections` 写入改为冲突时空操作；实测重跑 `db:init` 后四处 md5 全未变 |

### 8.2 待办（按角色）

| 角色 | 待办 |
|---|---|
| **Skill 设计师** | 阶段 A 的 A2—A5；`daily-lesson` 改名与触发测试；守护「受控 `skills/` ⇒ 运行时 `.workbuddy/skills/`」单向同步不漂移（7.4）；按 7.3 推进 `build_board.py` 与 `skill-dependencies.json` 的清理 |
| **后端工程师** | ✅ 本轮已完成：`readings` 三表 + 回填（4 天/11 篇/22 题）、`GET /api/readings{,/stats,/:date}`、**`POST /api/readings` 已开放**（单事务幂等、同日 409、`force=true` 重出；并补 `reading_pieces.source_url` 修 `sourceUrl` 静默丢弃）、`readingCatalog` 退出 degradation、`lesson_exercises` 34 条与 `study_records.byType` 回填、`errorTrend.byType` 真实化。**仍未实现**：`backlog`（待 `knowledge_points` 建表）、`lastIncomplete`（待教学侧写 `nextRecommendation`）；`lesson_exercises.error_type` 全 NULL 待 amy 对账；`mistakes` 库内 19 vs 错词本 23 待 amy 定夺 |
| **前端工程师** | R1 阅读统计**已可接**：`GET /api/readings/stats` 提供 `totalDays / pieceCount / wordCountTotal / lastReadDate / currentStreakDays`；`reading.html` / `readIndex.html` 仍是硬编码静态页，可改为 API 驱动（`GET /api/readings` 判「当天是否已生成」用 `readingCatalog[0].date`，`GET /api/readings/:date` 取全文） |
| **Amy** | 教学规则变更时按 `docs/ai-teacher.md` 10.2 的流程走：先落 `progress.md` → 更新 `ai-teacher.md` → 交 Skill 设计师改流程 → 交后端评估契约 |
| **Git 工程师** | `docs/skills.md` 与 `docs/schemas/` 的更新需记录到 `docs/changelog.md`；`skills/` 入库已完成（7.4），后续 Skill 变更按受控源提交 |

---

## 附录 A：契约与文件清单

### 本轮（`build_board.py` 删除 + 全量清引用）

| 文件 | 动作 | 说明 |
|---|---|---|
| `skills/english-daily/scripts/build_board.py` | **删** | 受控源与运行副本各删一份；删除前备份 `.workbuddy/skill-backups/english-daily-v2.2.3-20260930-pre-delete/` |
| `skills/english-daily/SKILL.md` | 改 | 删第七章第 3 项与流程「目录与摘要」步，「三个脚本」→「两个脚本」，自查清单 / 停止条件同步；版本 2.2.3 → 2.3.0 |
| `skills/english-daily/skill-dependencies.json` | 改 | 移除 `总目录重建` / `复习看板生成` 能力及全部条目；`verify` 改为 `INIT_OK` |
| `skills/english-daily/scripts/init_workspace.py` | 改 | `INDEX.md` 模板文案不再提脚本 |
| `skills/english-daily/references/setup-guide.md` | 改 | 依赖表 / 用途 / 降级矩阵共 5 处 |
| `skills/english-daily/references/course-template.md` | 改 | 4 处「看板」表述 |
| `docs/skills.md` | 改 | 7.3 删除执行记录、7.4 文件数 8 → 7、8.1 R7 闭合、本附录 |

自检：`skills/` 与运行副本内 `grep -rn "build_board\|BOARD_OK\|BOARD_FAIL"` 零命中；`diff -r skills/english-daily .workbuddy/skills/english-daily` 无差异；`skill-dependencies.json` JSON 解析与 `init_workspace.py` 语法均通过。

### 第二轮（补漏块口径 + `build_board.py` 标记退役）

| 文件 | 动作 | 说明 |
|---|---|---|
| `docs/schemas/common.schema.json` | 改 | `SectionType` 末尾追加 `backfill`；新增 `$defs.ExerciseBlockKind = ["homework","backfill"]` |
| `docs/schemas/exercise-set.schema.json` | 改 | `ExerciseItem` 增 `blockNo`；说明改为「一套题集一个块，`kind` 即块种类」；`exerciseNo` 明确为**块内**题号 |
| `docs/schemas/lesson-record.schema.json` | 改 | `ExerciseRecord` 增 `blockKind` / `blockNo`（对应 `lesson_exercises.block_kind` / `block_no`）；`sections` 说明补入 `backfill` |
| `docs/skills.md` | 改 | 新增 2.5 补漏块归置口径；7.3 / 7.4 / 8.1 / 8.2 同步现状 |
| `skills/english-daily/SKILL.md` | 改 | 标记 `build_board.py` 退役；版本 2.2.2 → 2.2.3 |
| `skills/english-daily/scripts/build_board.py` | 改 | 顶部加退役说明与清理前置条件，**不改代码逻辑** |
| `.workbuddy/skills/english-daily/` | 同步 | 受控源单向复制所得（运行副本），前两个文件 md5 与受控源一致 |
| `backend/db/migration/export_md_to_json.py` | 改 | 解析库默认目录改受控 `<root>/skills/english-daily/scripts` |

自检：`.workbuddy/build/check_schemas.py` 输出 `SCHEMA_CHECK files=12 refs=86 objects=536` → `SCHEMA_OK`；`docs/skills.md` 九个 Skill 的小节完整（`ALL_SECTIONS_OK`）。

### 首轮（Skill 系统设计）

| 文件 | 说明 |
|---|---|
| `docs/skills.md` | 本文件（替换原 TODO 骨架） |
| `docs/schemas/README.md` | 契约索引、版本规则、与后端契约的差异登记 |
| `docs/schemas/common.schema.json` | 公共枚举与基础类型 |
| `docs/schemas/agent-snapshot.schema.json` | 统一输入契约 |
| `docs/schemas/lesson-plan.schema.json` | 备课计划 |
| `docs/schemas/lesson-record.schema.json` | 课程归档记录 |
| `docs/schemas/teaching-block.schema.json` | 教学内容块 |
| `docs/schemas/exercise-set.schema.json` | 题集 |
| `docs/schemas/grading-result.schema.json` | 批改结果 |
| `docs/schemas/mistake.schema.json` | 错词分析结果 |
| `docs/schemas/review-session.schema.json` | 复习场次 |
| `docs/schemas/progress-report.schema.json` | 学情报告 |
| `docs/schemas/reading-set.schema.json` | 当日阅读集 |
| `docs/schemas/skill-run.schema.json` | Skill 执行记录 |

### 首轮未改动

`PROJECT.md`、`AGENTS.md`、`docs/ai-teacher.md`、`notes/`、`read/`、`progress.md`、`wrong-words.md`、`digest.md`、`INDEX.md`、`review/`。

---

## 附录 B：术语与口径

| 术语 | 口径 |
|---|---|
| 课号 N | 实际最大课号 + 1。断更不断号，中断不影响编号 |
| 错误处数 | 作业中错误的数量，**不折算百分制**。全系统唯一的分数量口径 |
| 过关 | 错词连续答对 2 次 → `status = passed` |
| 复发 | 同一错词 `wrongCount ≥ 3` |
| 理解型错误 | `error_type = word_choice`，知道意思但选错 |
| 产出型错误 | `grammar` + `spelling` + `punctuation` + `capitalization`，知道规则但写错 |
| 家族讲全 | 时态类语法点必须同时覆盖肯定、否定、疑问 |
| 补漏块 | 从待补队列取的知识点，3 题、5—8 分钟，不占新语法点额度 |
| 强制自查项 | 作业提交前学生必须自检的项目，由复发错词触发生成 |
| 降级 | 依赖不可用时用替代方案完成，并标注限制。降级必须显式标记，不得静默 |
