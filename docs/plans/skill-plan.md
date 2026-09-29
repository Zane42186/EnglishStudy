# Skill 教学能力体系与 JSON 契约落地方案

> **状态：方案（待评审）· 2026-09-29 · 作者：Skill 设计师**
> 数据基准：第 6 课（2026-09-29）下课后的仓库状态；后端第一版只读 API 已上线（16 个 GET，`npm run test:api` 27/27）。
> 权威来源：`PROJECT.md`、`AGENTS.md` 3.3、`docs/skills.md`、`docs/schemas/`（12 个 schema）、`docs/ai-teacher.md`、`backend/docs/05-api-reference.md`、`backend/db/schema.sql`。
> **证据标注**：【已实测】本轮在本机跑过；【静态证据】文件/代码可定位但未运行；【推断】由证据推导；【未验证】无可执行环境或尚未执行。

---

## 0. 结论摘要

| 结论 | 内容 |
|---|---|
| **体系** | 3 个独立 Skill + 6 个内嵌能力，共用同一套契约。判据只有一个：用户会不会单独说一句话来要它。 |
| **契约** | `docs/schemas/` 12 个 JSON Schema（v1），枚举与 `schema.sql` 严格同源；加字段兼容、Skill 必须忽略未知字段。已实测 `SCHEMA_CHECK files=12 refs=84 objects=71` → `SCHEMA_OK`（objects 68→71 为增补 `pendingMistakeStats`/`lastRecommendation` 两次；后续仅改描述文本，objects 不变）【已实测，见 `docs/skills.md` 6.3】 |
| **数据源** | 三态而不是两态：**A0 纯 md → A1 md + 只读 API（当前实际所处）→ B 全 API**。切换只改 `AgentSnapshot.deploymentMode` 一个字段，Skill 零改动。 |
| **适配层** | 全项目**唯一**允许接触 md 的地方，且必须复用 `build_board.py` 已有的解析函数，禁止写第二套正则。 |
| **阻塞项（需他人决策/交付）** | ① 无聚合快照接口（`/api/agent/snapshot` 实测 404）；② 无任何写接口，闭环断裂；③ ~~接口命名两套~~ **已与 be-dev 确认：一律以 `05-api-reference.md` 为准（`/api` 前缀 + 资源名 `lessons`，`03-api-contract.md` 与 `docs/backend-analysis.md` 作废）**；④ 阶段一 8 表缺 6 张表（be-dev 已给补表顺序）；⑤ `build_board.py` 5 份副本、权威副本不在版本库。 |

> **2026-09-29 与 be-dev 对齐后的更新**：命名（Q1）、快照字段映射（Q2）已定；DQ1 根因已由 be-dev 实测定位（见 5.4）；schema 已补 `pendingMistakeStats` 与 `lastRecommendation` 两个 optional 字段并复跑 `SCHEMA_OK`（objects 68→71）【已实测】。 |

---

## 1. Skill 体系总图

### 1.1 完整清单（3 独立 + 6 内嵌）

| # | Skill | 层 | 用户会怎么说（触发） | 输入 | 输出（schema） | 依赖后端接口（现状） | 可否独立调用 | 当前落地 |
|---|---|---|---|---|---|---|---|---|
| 1 | `daily-lesson` | 独立 | 上课 / 开始今天的英语课 / 今天学英语 / 下一课 / 英语每日课 / 上次学到哪了 / 今天我想学 X / 「继续」（需先确认） | `AgentSnapshot` + 可选 `LessonPlan` + `topicOverride` + `today` | `LessonRecord` + `ReadingSet?` + `ReviewSession` + `SkillRun[]` | 读：`/api/progress`✅ `/api/lessons`✅ `/api/lessons/latest`✅ `/api/lessons/error-trend`✅ `/api/mistakes/pending`✅ `/api/vocabulary/stats`✅ `/api/study-records`✅ **`/api/agent/snapshot`❌404**；写：**全部缺失** | ✅ 是 | `.workbuddy/skills/english-daily/` v2.2.0，已实跑 6 课【已实测输出 `BOARD_OK 课程数=6 阅读数=11 词汇数=52`】 |
| 2 | `lesson-review` | 独立 | 复习 / 复习错词 / 今天先复习 / 考考我 / 把错词再过一遍 | `AgentSnapshot` + `lessonNo` + `source(embedded\|standalone)` | `ReviewSession` | 读：同 #1；写：`POST /api/mistakes/:id/review`**❌404** | ✅ 是（入口待补） | 内嵌于 daily-lesson 第 3—4 步 |
| 3 | `learning-progress-analysis` | 独立 | 我学得怎么样 / 分析我的错误 / 我的弱项是什么 / 给我一份学习报告 / 我进步了吗 | `AgentSnapshot` + `windowSize?` | `ProgressReport` | 读：`/api/lessons/error-trend`✅ `/api/mistakes/pending`✅ `/api/mistakes/stats`✅ `/api/study-records`✅ `/api/progress`✅ | ✅ 是（Skill 待建） | `build_board.py` 出统计，趋势靠人工读 |
| 4 | `next-lesson-planning` | 内嵌 | —（用户不会单独点名） | `AgentSnapshot` + `ProgressReport?` + `topicOverride?` | `LessonPlan` | 读：`/api/knowledge-points` **❌404** | 技术上可，当前不注册入口 | 规则在 `docs/ai-teacher.md` 第八章 |
| 5 | `grammar-teaching` | 内嵌 | — | `LessonPlan` + `AgentSnapshot` + `vocabularyHints?` | `TeachingBlock(kind=grammar)` | 读：`/api/lessons/:id`✅；`/api/knowledge-points`❌ | 同上 | 内嵌第 5 步 |
| 6 | `vocabulary-teaching` | 内嵌 | — | `LessonPlan` + `AgentSnapshot` + `historyVocabulary?` | `TeachingBlock(kind=vocabulary)` | 读：`/api/vocabulary`✅ | 同上 | 内嵌第 5 步 |
| 7 | `exercise-generation` | 内嵌 | — | `kind(homework\|review\|backfill\|diagnostic)` + `LessonPlan` + `AgentSnapshot` + `targetMistakeIds?` | `ExerciseSet` | 读：`/api/mistakes/pending`✅；**无 `exercises` 表/接口**【静态证据：阶段一 `schema.sql` 无此表】 | 同上 | 内嵌第 3、6 步 |
| 8 | `answer-grading` | 内嵌 | — | `ExerciseSet` + 学生作答 + `expectedMistakes?` | `GradingResult` | 写（回填）：`PUT /api/lessons/:id` **❌** | 同上 | 内嵌第 4、7 步 |
| 9 | `mistake-analysis` | 内嵌 | — | `GradingResult` + `AgentSnapshot` + `ReviewSession?` | `MistakeAnalysisResult` | 写：`POST /api/mistakes` **❌**；`POST /api/mistakes/:id/review` **❌** | 同上 | 半自动，`error_type` 人工判定为主 |

### 1.2 调用关系

```
                    ┌──────────── AgentSnapshot（唯一入口）────────────┐
                    │  适配层(md/API) → 级别/课号/最近三课/未过关错词/  │
                    │  阅读清单/错误趋势/待补队列/上次未完成            │
                    └───────────────────┬──────────────────────────────┘
                                        │
        ┌───────────────────────────────┼────────────────────────────────┐
        ▼                               ▼                                ▼
【独立】daily-lesson            【独立】lesson-review          【独立】learning-progress-analysis
        │                               │                                │
        ├─④ next-lesson-planning ─▶ LessonPlan                  ReviewSession    ProgressReport
        ├─② lesson-review ───────▶ ReviewSession                    │                │
        ├─⑤ grammar-teaching ────▶ TeachingBlock(grammar)           │                └──▶（可选）LessonPlan
        ├─⑥ vocabulary-teaching ─▶ TeachingBlock(vocabulary)        │
        ├─⑦ exercise-generation ─▶ ExerciseSet ──▶ 学生作答          │
        │                                   │                       │
        ├─⑧ answer-grading ◀────────────────┘                       │
        │        └──▶ GradingResult                                 │
        ├─⑨ mistake-analysis ◀── GradingResult + ReviewSession ─────┘
        │        └──▶ MistakeAnalysisResult ──▶ 下一课 selfChecks（闭环）
        └─当日阅读 ─▶ ReadingSet
                    │
                    ▼
              LessonRecord ──▶ 后端 API ──▶ DB ──▶ Frontend
                    │
                    └──▶ SkillRun[]（自身 1 条 + 每个内嵌能力 1 条，parentSkillRunId 成树）
```

`①②③` 为独立入口编号，`④—⑨` 为内嵌能力编号（对应 `docs/skills.md` 第三章小节）。两种入口走同一份契约，结果必须一致。

### 1.3 触发路由与 near-miss

沿用 `docs/skills.md` 1.2 / 1.3，本方案只补三点：

1. **「继续」必须二次确认**：无英语课上下文时先问「是继续上次的英语课吗」，不得直接进 11 步流程。
2. **`lesson-review` 独立触发时的课号**：当日未上课则 `lessonNo` 填上一课号，`source="standalone"`。
3. **升级为独立 Skill 的判据**（写在文档里以免日后各说各话）：出现「用户单独说一句话点名要它」的真实场景，且该场景每周出现 ≥1 次。例如「只给我出 5 道题练练」若成为高频表达，`exercise-generation` 即可独立；**未达判据前不得拆分**，避免 9 处重复取数（理由见 `docs/skills.md` 0.2）。

触发识别本身【未验证】——本环境无模型调用能力，无法做真实触发测试（`docs/skills.md` 6.3 已如实登记）。

---

## 2. 统一 JSON 契约规范

### 2.1 12 个 schema 的分层（谁产出 / 谁消费 / 落哪张表）

| 层 | 契约 | 产出者 | 消费者 | 阶段一落库（`schema.sql`） |
|---|---|---|---|---|
| **输入层** | `AgentSnapshot` | 适配层 / 后端 | 全部 9 个 Skill | 聚合读，无独立表 |
| **被引用层** | `common.schema.json` | — | 全部契约 | 枚举对齐各表 |
| **计划层** | `LessonPlan` | ④ next-lesson-planning | ①⑤⑥⑦ | 无（合同内部对象） |
| **内容层** | `TeachingBlock` | ⑤⑥ | ① | `lesson_sections`、`vocabulary`、`lesson_vocabulary` |
| | `ExerciseSet` | ⑦ | ⑧、学生 | **无 `exercises` 表**（阶段一缺） |
| **结果层** | `GradingResult` | ⑧ | ⑨、① | 回填进 `lesson_sections('grading')` 正文 |
| | `ReviewSession` | ② | ①、⑨ | `mistakes.streak/status`（经写接口） |
| | `MistakeAnalysisResult` | ⑨ | ①、③ | `mistakes`（`mistake_events` 阶段一缺表） |
| **归档层** | `LessonRecord` | ① | 后端 / 生成脚本 | `lessons` + `lesson_sections` + `lesson_vocabulary`（⚠️ `lesson_sections` 现库内**只有 grammar / feedback 两类共 12 条**，其余 6 类待 M2 补全【be-dev 已实测】——近期**不能**指望结构化查到复习/作业/例句/批改正文，这些只能从 md 取） |
| | `ReadingSet` | ① | 后端、前端 | **无 `readings` 三表**（阶段一缺） |
| **分析层** | `ProgressReport` | ③ | ④、学生 | 由 `study_records(record_type='grade')` 聚合 |
| **观测层** | `SkillRun` | 全部 9 个 | 后端、人工回溯 | **无 `skill_runs` 表**（阶段一缺） |

### 2.2 公共字段约定

| 约定 | 内容 |
|---|---|
| `deploymentMode` | `AgentSnapshot` 必填，`"markdown"` / `"backend"`。**Skill 不得用它做逻辑分支**，只用于留痕与诊断（见 2.4） |
| `degradation` | 所有契约均带可选 `degradation{degraded,reason,affected[]}`。只要有降级就必须填，且必须向上层标注限制，不得把降级结果当完整结果输出 |
| `lessonNo` | 课号唯一权威值 = 实际最大课号 + 1（断更不断号）。**`progress.currentCourseNo` 与之不一致时以 `courseCatalog` 最大值为准**，并在 `SkillRun.notes` 记「已按笔记修正」 |
| `id` | 错词 id 为**不透明值**，Skill 只做引用不做算术。markdown 模式下由适配层合成，取值区间 `900000+`，与数据库自增主键天然区分（见 3.2） |
| `levelCode` | 上课时级别快照，不随后续升降级改写 |
| 错误口径 | 全系统唯一口径 = **错误处数**，不折算百分制，与 `study_records(grade).payload` 一致 |
| 时间 | `DateOnly` = `YYYY-MM-DD`；`DateTime` = date-time。后端响应为字符串（`2026-09-29 14:08:02`），适配层写契约时统一转 ISO 8601【静态证据：`05-api-reference.md` 1.5】 |

### 2.3 枚举同源规则（契约枚举 ↔ `schema.sql`）

| 契约枚举 | 取值 | DB 落点 | 一致性 |
|---|---|---|---|
| `LevelCode` | Level 1—5 | `lessons.level_code VARCHAR(10)` | ⚠️ 阶段一为**无约束字符串**（级别表在完整设计 `schema.full.design.sql`）。Skill 侧按枚举取值，不得发明 |
| `Feedback` | too_easy / just_right / too_hard | `progress.last_feedback` ENUM | ✅ 完全一致 |
| `ErrorType` | grammar / spelling / punctuation / word_choice / capitalization / other | `mistakes.error_type` ENUM | ✅ 完全一致（6 值） |
| `MistakeStatus` | pending / passed | `mistakes.status` ENUM | ✅ |
| `ExerciseType` | fill_blank / translate / error_correction / reorder / open / choice | `exercises.exercise_type`（**阶段一无表**） | ⚠️ 无落点，仅契约内部 |
| `ExerciseSetKind` | homework / review / backfill / diagnostic | — | 契约内部 |
| `SectionType` | review, grammar, vocab_table, examples, homework, my_answer, grading, feedback, **objectives, expected_mistakes** | `lesson_sections.section_type` ENUM **10 值**（S1 已落库，2026-09-29） | ✅ **已一致**（契约枚举顺序与库内 ENUM 逐字一致） |
| `StudyRecordType` | attend / homework_submit / grade / review / feedback / reading | `study_records.record_type` ENUM | ✅ |
| `KnowledgeRole` | new / review / backfill | `course_knowledge_points.role`（完整设计，阶段一无表） | ✅ 语义一致 |
| `SkillName` | 9 个机器名 | `skills.name`（完整设计，阶段一无表） | ✅ 语义一致 |
| `SkillRunStatus` | success / failed / partial | `skill_runs.status`（完整设计） | ✅ |
| `DeploymentMode` / `Degradation` / `MistakeItem.priority` / `PatternHit.pattern` / `Bottleneck.kind` / `LevelRecommendation.action` / `Dimension.name` / `ReviewSourceTag` | — | — | 契约内部，无 DB 落点。**其中 `priority` 已由服务端推导**（G2 已关闭）【已实测：`05-api-reference.md` 第 10 条】 |

**规则**：新增/修改枚举取值必须先改 `schema.sql`（或完整设计）与 `common.schema.json`，Skill 侧不得先行使用。**且新增 ENUM 值一律追加在末尾，不得插入中间**——MySQL 的 ENUM 按内部索引存储，插在中间会让既有行的枚举值**静默错位**（追加可走 `INSTANT`）。S1 落地时即按此执行（`28d4732`），实测 `grammar`/`feedback` 行数与取值均未变【be-dev 实测】。

### 2.4 `deploymentMode` 切换机制

```
阶段 A0（纯 md）        阶段 A1（md + 只读 API，当前实际）     阶段 B（全 API）
适配层读 md      →      适配层优先读 API，缺字段回落到 md   →   GET /api/agent/snapshot
        │                       │                                    │
        └───────────────────────┴────────────────────────────────────┘
                                ▼
                        AgentSnapshot（同一 schema，同一形状）
                                ▼
                    Skill：零改动（不得读 deploymentMode 做分支）
```

- **A1 是本方案新增的中间态**，理由：后端 16 个 GET 已实测可用【已实测，`docs/integration-report-01.md`】，继续纯 md 会浪费已验证的数据源；但写接口与快照接口全缺，无法直接进 B。
- 建议新增**可选**字段 `AgentSnapshot.provenance`（形如 `{"progress":"api:/api/progress","backlog":"md:progress.md","lastIncomplete":null}`）。属「加字段兼容」，不升版本；Skill 必须忽略它（见 2.5），仅供人读与排障。**需与 be-dev 确认后再写入 schema。**
- 切换验证方式：同一时刻分别用 md 与 API 生成快照并逐字段 diff，**差异只能出现在 2.6 的缺口字段清单内**，出现清单外差异即判定为设计缺陷。

### 2.5 版本演进与「忽略未知字段」

| 规则 | 内容 |
|---|---|
| 命名空间即版本 | `$id = https://english-study.local/schemas/v1/<文件名>`（标识符，非可访问网址） |
| 加字段 | 兼容，不升版本；**Skill 必须忽略未知字段**，不得因后端多返回字段而报错 |
| 加枚举值 | 兼容，不升版本；但须先改表再改 `common.schema.json` |
| 删字段 / 改含义 / 改必填 | 破坏性，升 `v2`，`v1` 保留一个迁移周期 |
| `required` 只减不增 | 新增必填视为破坏性变更 |

**「忽略未知字段」的实现要求**（落到 Skill 源码与脚本层面，不只是文档承诺）：

1. 读取侧一律用**白名单取值**：`obj.get("field", default)`，禁止 `for k in obj` 式全量遍历后强校验未知键。
2. 校验失败时**记录并降级**，不得抛异常中断上课（例：后端返回了未登记字段 → 写 `SkillRun.notes`，继续）。
3. `SkillRun.notes` 是未知字段的落点，便于事后发现契约漂移。
4. 所有契约默认允许附加属性（当前 12 个 schema 均未设 `additionalProperties:false`【静态证据】），**后续新增 schema 也不得设**。

### 2.6 契约缺口登记（现状更新）

原 `docs/skills.md` 4.2 登记 G1—G5 + S1/S2。按 `docs/ai-teacher.md` 9.3 与 `backend/docs/05-api-reference.md` 实测结果更新：

| # | 缺口 | 原状态 | **本轮核实状态** | 影响 Skill | 缺省降级 |
|---|---|---|---|---|---|
| G1 | `errorTrend` / `recentLessons[].errorCount` | 未补 | ✅ **已关闭**：`GET /api/lessons/error-trend` 已实现并实测【已实测】 | ①③④ | md 侧可由 `progress.md`「错误趋势」表取（1—6 课真实数据齐备） |
| G2 | `pendingMistakes[].priority` | 未定义 | ✅ **已关闭**：服务端推导（`wrongCount≥2`→high，`streak==1`→medium，其余 low）【已实测】 | ②⑦ | md 侧按同一规则自行推导 |
| G3 | `backlog`（待补知识点 / 补漏队列） | 未补 | ⏳ 需求 R6，`/api/knowledge-points` **404**【已实测】 | ①④⑤ | 本课不排补漏块 |
| G4 | `lastIncomplete` | 未补 | ⏳ 需求 R5 + R1。**be-dev 已实测：现有 `study_records.payload` 无任何一条含 `next_recommendation`** → 即使走 API，`lastRecommendation` 与 `lastIncomplete` **现阶段恒为 null** | ①④ | 中断后从头开始，需学生确认；**必须写 `degradation`** |
| **G9**（新增） | `pendingMistakeStats` / `lastRecommendation` 未进入契约 | — | ✅ **本轮已补**：两个字段以 optional 形式加入 `agent-snapshot.schema.json`，复跑 `SCHEMA_OK`【已实测】 | ①③ | 前端先按 optional 返回，Skill 忽略未知字段不受影响 |
| G5 | `studyMinutes` 由谁填 | 未定 | ⏳ 需求 R4；且**阶段一 `lessons` 表无 `study_minutes` 列**【静态证据】 | ① | 留空，不做时长统计 |
| **G6** | 无聚合快照接口 | — | ⏳ 需求 R1（P0），`/api/agent/snapshot` **404**【已实测】 | 全部 9 个 | 并发 9 个 GET 自行聚合（Amy 已实操验证可行） |
| **G7** | 无任何写接口 | — | ⏳ 需求 R2—R5（P0/P1），实测全部 404【已实测】 | ①②⑧⑨ | 复习/反馈/归档结果全部回写 md，**不写库** |
| **G8**（新增） | md 侧错词缺 `wrongCount` / `errorType` / 稳定 `id` | — | 🆕 `wrong-words.md` 表仅 6 列（课号/错误点/正确形式/错因/连续答对/状态）【静态证据】，无类型、无累计次数、无主键 | ②⑦⑨ | 适配层合成（见 3.2），并在 `degradation.affected` 标注 |
| **DQ1** | 库内 20 条 vs md 19 条、`byType` 多 `other=1` | 未定位 | ✅ **根因已由 be-dev 实测定位**：差异全在 passed，多出 `id=19`（wrong_text 是「正确」的翻译题记录、correct_text 为占位符、`wrong_count=0`、`error_type=other`），正是 Amy 在 md 里已删除的那行非错题记录；**非重复插入**。另：判重校验（`GROUP BY lower(trim(correct_text)), error_type HAVING count>1`）返回**空**，唯一索引可直接建 | 全部 | 待 Amy 确认后删 `id=19`；迁移脚本加「correct_text 为占位符或 wrong_count=0 的行不导入」 |
| ~~S1~~ | `section_type` 增 `objectives`、`expected_mistakes` | 待确认 | ✅ **已落库（2026-09-29，commit `28d4732`）**：`db/schema.sql` + 库内 ENUM + `backend/src/constants.js` 三处同源；新值**追加在末尾**（避免既有行索引错位），实测 `grammar`/`feedback` 行数与值未变、`information_schema` 的 `COLUMN_TYPE` 与 `schema.sql` 一致【be-dev 实测】 | ①⑤ | 无缺口：契约 `SectionType` 已同步为 10 值 |
| **S2** | `skill_runs` 缺父子关系 | 待确认 | ⏳ `schema.full.design.sql` 的 `skill_runs` 无 `parent_skill_run_id`【静态证据】 | 全部 | 退化为按 `course_id` + `created_at` 时序推断 |
| **S3**（新增） | `skill_runs` 字段不足以承载 `SkillRun` | — | 🆕 完整设计仅 `id/skill_id/user_id/course_id/input/output/status/created_at`，**缺 `started_at`/`finished_at`/`duration_ms`/`degraded`/`notes`/`error`**【静态证据】 | 全部 | 阶段一不落盘，仅在对话留痕 |
| **S4**（新增） | 阶段一缺 6 张表 | — | 🆕 `schema.sql` 仅 8 表，缺 `exercises`、`readings`+`reading_pieces`+`reading_questions`、`knowledge_points`+`course_knowledge_points`、`mistake_events`、`progress_feedback`、`skills`+`skill_runs`【静态证据】 | ①⑦⑧⑨② | 相应契约对象**只进 md / 只存在于对话**，不落库 |
| ~~G10~~（新增，**已关闭**） | 补漏块错误 / 阅读理解题错误的**单独计数**无契约落点 | — | ✅ **已定形（amy，`docs/ai-teacher.md` §6.5）**：**契约无需新增字段**。① 补漏块**永远独立成一套 `kind='backfill'`**，该套 `summary.errorCount` 即 `backfillErrorCount`，由 `kind` 区分即可 → 不加 `sourceScope`；② 阅读理解题作答**不进 `GradingResult`**（走阅读模块）→ `comprehensionErrorCount` 不在本契约；③ 若将来出现「一套里混多来源」再评估 `sourceScope`。`errorCount` 已写死只计 `verdict=wrong`（blank / correct_with_note / 任务完成度问题不计入，见 schema 描述与 ai-teacher §6.5） | ⑧⑨ | 无需降级 |
| **G11**（新增） | 快照 `pendingMistakes[]` 的课号字段名未按契约映射 | — | 🆕 **实测发现**：真实 `GET /api/agent/snapshot` 返回 `firstLessonNo` / `lastLessonNo`（接口原名），未按 §5.5 映射为契约名 `firstCourseNo` / `lastCourseNo`。因契约里这两个字段**非必填**，schema 校验**不会报错**，Skill 按 `firstCourseNo` 取值会**静默拿到 undefined**。同批实测：`progress` 的 `currentCourseNo` 映射正确、`recentLessons[].levelCode` 映射正确，**仅此一处漏映射** | ②⑦⑨ | 已在 schema 的 `pendingMistakes` 描述里写明映射要求；待 be-dev 修快照映射 |
| **G12**（新增，**已关闭**） | `backlog` / `lastIncomplete` 返回 `null` 时契约不接受 | — | ✅ **本轮已修**：契约原写 `type: object`（不可空），而 §5.5 约定的缺值行为是「返回 `null` / `[]` + `degradation`」。已改为 `anyOf[{object},{null}]`。实测：改后真实快照 `SNAPSHOT_OK` 通过校验 | 全部 | 无缺口 |

> G3/G4/G6/G7 与 S4 是**当前的实际阻塞点**：没有写接口，Skill 产出的 `ReviewSession`、`GradingResult`、`MistakeAnalysisResult`、`LessonRecord`、`ReadingSet` 全部只能落到 md。

---

## 3. markdown 适配层设计

### 3.1 定位与边界

- **适配层是全项目唯一允许打开 `notes/`、`progress.md`、`wrong-words.md`、`digest.md`、`read/` 的代码。** Skill、后端、前端一律不得解析 md。
- 适配层**不做任何教学判断**，只做格式翻译与字段合成。教学规则由 Amy（`docs/ai-teacher.md`）决定。
- 双向：读适配（md → 契约）+ 写适配（契约 → md）。
- 判定标准沿用 `docs/skills.md` 0.1：**如果一个 Skill 的行为会因为 md 换个排版而改变，说明设计错了。**

### 3.2 读适配：`md → AgentSnapshot`

**实现原则：复用 `build_board.py` 的已验证解析函数，不写第二套正则。**

可复用函数【静态证据，`build_board.py:132—284`】：`parse_notes`（课 → `no/date/summary/file/sections{8小节}/vocab`）、`parse_read_dir`（日 → `date/file/pieces`）、`parse_wrong_words`（错词 → 原始表格行）、`read_level`（级别）。
`build_board.py` 结尾为 `if __name__ == "__main__": sys.exit(main())`，**import 无副作用**【静态证据】，可安全复用。此做法与 `backend/docs/04-migration-and-roadmap.md` 第二节「不重写解析器」同源。

| `AgentSnapshot` 字段 | md 来源 | 取数方式 | 缺失时 |
|---|---|---|---|
| `deploymentMode` | 固定 `"markdown"` | — | — |
| `progress.currentLevel` | `progress.md`「当前级别：Level 2」 | `read_level()` | **停止**（不猜级别，硬边界） |
| `progress.currentCourseNo` | `progress.md`「当前课号」与 notes 实际最大课号取**较大者** | `parse_notes` 最大值 | **停止** |
| `progress.lastFeedback` | `progress.md` 反馈记录表最后一行 | 中文→枚举：太简单/刚好/太难 | `null` |
| `progress.easyStreak` | 「太简单连击计数：0 / 2」取分子 | 正则 | `0` |
| `progress.upgradeFrozenUntil` | 「升级记录」段落（**非结构化文本**） | 文本匹配，失败取 0 | `0` + `degradation` |
| `progress.lastClassDate` | 「上次上课：2026-09-29」 | 正则 | `null` |
| `courseCatalog[]` | `notes/*.md` | `parse_notes` | — |
| `recentLessons[]` | notes 最近 N 课 | `parse_notes` + 小节映射（`今日语法`→`grammarPoint`、`词汇`→`vocabulary`、`难度反馈`→`feedback`） | — |
| `recentLessons[].errorCount` | `progress.md`「错误趋势」表（1—6 课真实数据齐备）**或** `/api/lessons/error-trend`（A1 优先 API） | 表格解析 | `null` → G1 降级 |
| `pendingMistakes[]` | `wrong-words.md` 表格（19 行：未过关 15 / 已过关 4） | `parse_wrong_words` + 合成 | — |
| └ `id` | **合成** | `900000 + 行序`，区间与 DB 主键天然区分 | — |
| └ `errorType` | **md 无此列** → 按 `docs/skills.md` 3.6 三步判定规则推断；与既有 19 条人工基线比对（见 6.2） | 规则推断 | `other` + 标「待人工复核」 |
| └ `wrongCount` | **md 无此列**（仅「第 3 次犯」等散落文字） → 从文本抽取，抽取不到取 `1` | 文本抽取 | `1` + `degradation` |
| └ `streak` | 「连续答对」列 | 直接 | — |
| └ `status` | 「状态」列 已过关/未过关 → `passed`/`pending` | 直接 | — |
| └ `priority` | 服务端规则（G2 已关闭）在适配层复算 | `wrongCount≥2`→high，`streak==1`→medium，其余 low | — |
| └ `firstCourseNo` / `lastCourseNo` | 「课号」列（含脏值 `诊断` → `null`） | 非数字置 `null` | `null` |
| └ `lastReviewedAt` | 无来源（DQ5：全库亦为 null） | — | `null` |
| `readingCatalog[]` | `read/` 目录 | `parse_read_dir` | — |
| `errorTrend` | `progress.md`「错误趋势」表 或 `/api/lessons/error-trend` | 表格解析 | 缺 → G1 降级 |
| `backlog.pendingKnowledgePoints` / `backfillQueue` | `progress.md`「待补的 Level 1 知识点」+「补漏队列」编号列表 | **文本解析（脆弱）** | 缺 → G3 降级 |
| `pendingMistakeStats` | `wrong-words.md` 行数统计（total） + 按 `errorType` 分组 | md 侧自算；A1 优先 API（已在 R1 需求中，字段已入契约） | 缺 → 不显示分布，不影响取词 |
| `lastRecommendation` / `lastIncomplete` | **无来源**：md 侧不存在该字段，API 侧 `study_records.payload` 现也无 `next_recommendation`【be-dev 已实测】 | — | 恒 `null` → G4 降级，**必须写 `degradation`** |
| `degradation` | 适配层按上述缺失自动填 | — | — |

> **G8 是本方案新发现的关键风险**：`wrong-words.md` 缺 `wrongCount`、`errorType`、稳定主键，三者都要靠合成/推断。切换后端后同一条错词的 `wrongCount` 可能与 md 推算值不一致（库内是 20 条 vs md 19 条，DQ1 已暴露同类问题）。**建议 Amy 在 `wrong-words.md` 增两列（`错误类型`、`累计次数`）**，属 md 侧最小改动，可让适配层停用推断逻辑。

### 3.3 写适配：`契约 → md`

| 契约对象 | 落点 | 规则 |
|---|---|---|
| `LessonRecord.sections[]` | `notes/day-XX-YY.md` **追加** | `sectionType` → md 标题映射：`review`→`### 复习`、`grammar`→`### 今日语法`、`vocab_table`→`### 词汇`、`examples`→`### 例句`、`homework`→`### 作业`、`my_answer`→`### 我的作答`、`grading`→`### 批改`、`feedback`→`### 难度反馈`；**`objectives`、`expected_mistakes` 目前无对应 md 标题 → 仍降级写进 `grammar` 小节前缀**。虽然 S1 已让库端可存这两类，但**落地切换还差两步**：① `SKILL.md` 的笔记格式仍是 8 个小节标题、`references/course-template.md` 未含这两节；② `build_board.py` 的 `parse_notes` 只映射 8 个小节，写新标题脚本解析不到（`LessonRecord.sections` 会丢节）。故**先降级写入，待模板 + 解析器同步后再切**（切换属 Skill 源代码改动，走 6.3 流程）。 |
| `LessonRecord.vocabulary[]` | `### 词汇` 表格 | `word/phonetic/meaning/example` 四列 |
| `LessonRecord.exercises[]` | `### 作业` 编号题 + `<details>` 答案 | 阶段一无 `exercises` 表 |
| `LessonRecord.gradeSummary` | `### 批改` + `study_records(grade).payload` | 口径 = 错误处数 |
| `ReadingSet` | `read/YYYY-MM-DD-read.md` | 当天已存在 → **不覆盖**（唯一例外：学生明确要求重出） |
| `MistakeAnalysisResult.newMistakes` | `wrong-words.md` **追加行** | 只增不改 |
| `MistakeAnalysisResult.updatedMistakes` | `wrong-words.md` **改该行** 连续答对 / 状态 | 幂等：同 `id` 只改一次 |
| `ReviewSession.outcomes` | `wrong-words.md` 连续答对列 | 与上面同源，避免两套写逻辑 |
| `ProgressReport` | 无落地文件，仅输出给学生 | — |
| `SkillRun` | 阶段一**不落盘**，仅对话留痕（S3 无表） | — |

**硬边界（写适配同样遵守）**：只追加、不重写、不删除任何已有笔记与阅读文件；不手工改脚本生成物（`INDEX.md`、`digest.md`、`review/*.html`）。

### 3.4 保证「切换后端时 Skill 零改动」的四条约束

1. **形状一致**：两种 mode 产出的 `AgentSnapshot` 通过同一个 `agent-snapshot.schema.json` 校验；适配层自带校验（复用 `.workbuddy/build/check_schemas.py` 的 `$ref` 解析思路【静态证据：该脚本为只读校验，可直接调用】）。
2. **ID 可辨识**：markdown 模式 id 取 `900000+`，与 DB 自增主键不可能撞；切换后一眼能分辨数据来自哪条链路。
3. **Skill 不读 `deploymentMode` 做分支**：该字段只进 `SkillRun.deploymentMode` 留痕。
4. **黄金样本比对**：固定一批输入（第 6 课后状态）分别跑 md 与 API 两条链路，diff 只允许出现在 2.6 的缺口字段内。样本入 `docs/testdata/`（新建，待 git-manager 确认目录约定）。

### 3.5 目录与 CLI 形态（建议，待确认）

```
skills/english-daily/scripts/
├─ build_board.py          # 现有着板脚本（权威副本）
├─ check_environment.py
├─ init_workspace.py
└─ adapter.py              # 新增：唯一接触 md 的适配层
```

```
python adapter.py snapshot --root E:\English [--api http://localhost:4000/api] [--recent 3] [--out snapshot.json]
python adapter.py write-lesson --root E:\English --record lesson-record.json
python adapter.py write-mistakes --root E:\English --result mistake-analysis.json
python adapter.py write-reading --root E:\English --set reading-set.json [--force]
python adapter.py check --root E:\English      # 只校验不写入，退出码 0/1
```

- `--api` 缺省 → 纯 md（A0）；给定 → A1（API 优先、md 回落）。
- 标准库实现，Python 3.10+（与现有三个脚本一致）。

---

## 4. Skill 源码管理与防丢失

### 4.1 现状：5 份 `build_board.py` 副本【本轮全部已实测】

| 副本路径 | 字节 | 行数 | md5 | 判定 |
|---|---|---|---|---|
| `.workbuddy/skills/english-daily/scripts/build_board.py` | 44415 | 1040 | `50aca14b1edf40cb20404a088e4e3d14` | ✅ **权威**（含阅读索引页改造） |
| `.workbuddy/build/output/english-daily/scripts/build_board.py` | 30349 | 711 | `486cd2890ecf127be5b8631fe62d71da` | 旧副本（9/28） |
| `.workbuddy/build/resources/scripts/build_board.py` | 30349 | 711 | `486cd2890ecf127be5b8631fe62d71da` | 同上（同一份） |
| `.workbuddy/_tmpx/english-daily/scripts/build_board.py` | 30349 | 711 | `486cd2890ecf127be5b8631fe62d71da` | 同上（同一份） |
| `.english-daily-package-yj7kiobf/english-daily/scripts/build_board.py` | 28980 | 681 | `101d1df7f629dc715480cdd1630480cd` | 更早打包副本（9/28 前的 zip 时代） |

**差异实证**：权威副本 grep `readIndex.html` 命中 2 次、总命中 7 处阅读页相关；3 份 30KB 副本与 1 份 28KB 副本均**不含 `readIndex.html`**（0 次）【已实测】。即旧副本丢失了阅读页改造。

> 注：团队简报称权威副本为 38KB，实测为 **44415 字节（约 43.4KB）**，以实测为准。

### 4.2 为什么危险

| 风险 | 说明 |
|---|---|
| 不在版本库 | `.gitignore` 第 2 行 `.workbuddy/`，权威副本**无任何 git 历史**，被覆盖不可回滚【已实测：`git status` 仅 `review/index.html` 变更，`skills/` 未纳入】 |
| 打包回流 | `.workbuddy/build/{resources,output}` 的命名指向打包流程的「输入/输出」；若打包产物回装到 `.workbuddy/skills/`，30KB 旧版会**反向覆盖**权威副本【推断：目录语义明确指向该流程，但回流触发条件本轮未复现，需 git-manager / 实操确认】 |
| 一份权威 + 四处旧版 | 任何人误跑旧副本，会用旧模板重建看板，直接冲掉前端已接入的 API 改造（联调报告 F1 已记录 `review/index.html` 是生成产物）【静态证据：`docs/integration-report-01.md` F1】 |

### 4.3 三道防线

| 防线 | 做法 | 解决什么 |
|---|---|---|
| **① 入库** | 权威源码落到版本库 `skills/english-daily/`（8 个文件，排除 `__pycache__/`） | 工作区丢失可恢复 |
| **② 备份** | 每次改动前**完整目录备份**到 `skills/_backup/english-daily-v<版本>-<日期>/`，附 md5 清单；该目录同样入库 | 改坏了可回滚到上一版（见 6.3） |
| **③ 同步方向唯一** | 约定 **git `skills/` ⇒ `.workbuddy/skills/`** 单向同步。每次打包/重建前跑一次 `diff -r`（或校验脚本），不一致**先停下**，禁止把 `.workbuddy/` 的副本反向提交 | 防止旧副本回流污染权威 |

### 4.4 `.gitignore` 写法（本轮实测结论）

`docs/skills.md` 7.4 写的 `.workbuddy/` + `!.workbuddy/skills/` **实测无效**：

```
方案 A：.workbuddy/          方案 B：.workbuddy/*
        !.workbuddy/skills/          !.workbuddy/skills/
→ git check-ignore 命中 .workbuddy/（仍被忽略）  → 未命中任何规则（可入库）✅
```

**原因**：git 不允许在父目录被整体排除后重新包含其子内容（父目录已被排除，git 不再进入）。
【已实测：在临时仓库用 `git check-ignore -v` 验证，方案 A 命中 `.gitignore:2:.workbuddy/`，方案 B 退出码 1 表示未被忽略】

**本方案推荐**：**不动 `.gitignore` 的 `.workbuddy/` 规则，改为只入库 `skills/` 目录**（方案 C）。

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **C（推荐）** | `.workbuddy/` 维持整体忽略；新建并入库 `skills/` | 权威唯一、目录语义干净、不把 build/tmp 拉进仓库 | 运行副本仍可能被覆盖，需靠防线③发现 |
| B（备选） | 改 `.workbuddy/*` + `!.workbuddy/skills/` | 运行副本也在版本库，双保险 | 两份副本同仓，易再次出现「哪份权威」的二义；`.workbuddy/` 下还有 `tmp`、`memory` 需逐条排除 |

**待 git-manager 定夺**（见第 7 章未决问题 Q3）。

### 4.5 `docs/skills.md` 7.4 入库执行步骤细化（方案阶段不执行）

> 前置：与 git-manager 确认 4.4 方案（C / B）后再动手。以下步骤按方案 C 编写。

1. **确认权威**：`md5sum .workbuddy/skills/english-daily/scripts/build_board.py`，必须等于 `50aca14b1edf40cb20404a088e4e3d14`；不等则**停止并上报**（说明权威副本已被改动或覆盖）。
2. **先备份**：整目录复制到 `skills/_backup/english-daily-v2.2.0-20260929/`，生成 `MANIFEST.md5`（8 个文件逐个 md5）。
3. **建权威源码目录**：`skills/english-daily/`，复制 8 个文件——`SKILL.md`、`skill-dependencies.json`、`scripts/{build_board,check_environment,init_workspace}.py`、`references/{course-template,level-map,setup-guide}.md`；**排除 `scripts/__pycache__/`**（62KB 编译产物）。
4. **校验一致性**：`diff -r skills/english-daily .workbuddy/skills/english-daily`（除 `__pycache__` 外应无差异）。
5. **提交**：`git add skills/` → `git commit -m "chore(skill): 入库 english-daily v2.2.0 源码（防丢失基线）"`。
6. **changelog**：在 `docs/changelog.md` 2026-09-29 段落追加一条，注明 8 个文件 + 排除 `__pycache__`。
7. **（可选）打 tag**：`git tag skill-v2.2.0`，由 git-manager 决定是否启用 tag 规范。
8. **旧副本清理（最后做，且必须可回滚）**：
   - 先删 `.english-daily-package-*/`（已被 `.gitignore` 忽略的临时打包目录，含 28KB 最早副本）；
   - `.workbuddy/_tmpx/`、`.workbuddy/build/` **暂不删**，待确认打包流程是否依赖（见 Q4）；若确认无用，改为**重命名加 `.bak-20260929` 后缀**而非直接删除，`_tmpx` 本身即临时语义。
9. **加同步校验脚本**：`skills/english-daily/scripts/verify_copy.py`（或 shell），输出 `COPY_OK` / `COPY_DIFF`，供每次重建看板前跑。
10. **写入约定**：在 `docs/skills.md` 7.4 追加「权威 = 版本库 `skills/english-daily/`；`.workbuddy/skills/` 为运行副本」一句，消除二义。

### 4.6 后续每次改 Skill 的固定动作（见 6.3）

### 4.7 与前端的生成边界（`review/` 页面归属）

**前提纠正**（面向 fe-dev，2026-09-29）：fe-dev 依据的是 `.english-daily-package-yj7kiobf/` 那份副本（28980 字节 / 681 行 / md5 `101d1df7…`），它是 5 份里**最旧的一份**；权威副本是 `.workbuddy/skills/english-daily/scripts/build_board.py`（44415 字节 / 1040 行 / md5 `50aca14b…`）。他引用的输出映射 645—653 行，在权威版为 **1006—1012 行**：

```python
1006  "review/index.html":     build_board(lessons, level, days, wrong_rows),
1007  "review/reading.html":   build_reading_page(days),
1008  "review/readIndex.html": build_read_index_page(days),   # 权威版是生成产物，非手写
1009  "review/words.html":     build_words_page(lessons),
1010  "review/wrong.html":     build_wrong_page(wrong_rows),
1012  {f"review/lessons/lesson-{no}.html": render_lesson_page(lesson) for ...}
```

**关键事实：`review/index.html` 的模板已经是 API 驱动版。** 权威版 `build_board()`（第 700 行）产出的骨架含 `#statLessons` / `apiError` / `apiRetry` 与 `BOARD_API_CSS` / `BOARD_API_JS`，且 F5 的 `.api-error.hide { display: none; }` **已在模板内（第 562 行）**【已实测 grep 双向验证】。因此：

- 联调报告 F1「重建会冲掉 API 改造」的**当前状态是：模板已同步，重建不会冲掉**；
- **真实风险换成另一条**：今后前端对页面的任何修改只落在产物上、未回填模板，重建即丢失；以及**误跑旧副本**（那份的 `build_board()` 仍是静态版）会让首页直接倒退成静态。

**生成范围调整原则（答复 fe-dev 问题 1）**：分阶段收缩，**判据是「后端能否提供该页全部字段」**，不是一次性全停。

| 页面 | 现在能否移出生成集 | 依据 |
|---|---|---|
| `review/words.html` | ✅ 可以 | `/api/vocabulary` 字段齐全（51 词含音标/释义/例句/首现课） |
| `review/wrong.html` | ✅ 可以 | `/api/mistakes` 字段齐全（含 priority / streak / wrongCount） |
| `review/index.html` | ⚠️ **不必移出** | 模板已是 API 版；移出反而形成两份首页 |
| `review/reading.html`、`review/readIndex.html` | ❌ 暂缓 | 无 `readings` 表与接口（R7，P2）；前端不得解析 `read/*.md`（铁律） |
| `review/lessons/lesson-N.html` | ❌ 暂缓 | `lesson_sections` 现只有 grammar / feedback 两类，作业/例句/批改/我的作答/复习 6 类正文库里没有（**R11**）；且无 `exercises` 表 |

**永久保留由脚本生成**：`INDEX.md`、`digest.md`——两者是 Markdown 不是 HTML，不与前端冲突；其中 `digest.md` 是 Skill 上课第一步的唯一输入（适配层读它），**不可移交前端**。

**入库答复（问题 2）**：会入库，走 4.3 防线①与 4.5 步骤（落到新建的 `skills/english-daily/`，不是给 `.workbuddy/` 开白名单——父目录被整体排除后否定无效，已实测）。**入库完成前，fe-dev 不要修改任何一份 `build_board.py` 副本**（改了无法追踪，且很可能改到旧那份）；改动 `review/` 产物可照常进行，被重建覆盖属预期。

---

## 5. Skill ↔ Backend 接口映射

### 5.1 命名对齐（**已统一，见 5.1.1**）

| 契约/设计稿用名（`docs/skills.md`、`03-api-contract.md`） | 已实现名（`05-api-reference.md`） | 状态 |
|---|---|---|
| `GET /agent/snapshot` | `GET /api/agent/snapshot` | ❌ 404（需求 R1） |
| `GET /courses` / `GET /courses/:id` / `GET /courses/latest` | `GET /api/lessons` / `/api/lessons/:id` / `/api/lessons/latest` | ✅ 已实现，命名不同 |
| `POST /courses` / `PUT /courses/:id` | `POST /api/lessons` / `PUT /api/lessons/:id` | ❌ 未实现（需求 R4） |
| `GET /mistakes?status=pending` | `GET /api/mistakes/pending` | ✅ |
| `POST /mistakes` / `POST /mistakes/:id/review` | `/api/mistakes` / `/api/mistakes/:id/review` | ❌（需求 R2） |
| `POST /progress/feedback` | `/api/progress/feedback` | ❌（需求 R3） |
| `POST /study-records` | `/api/study-records` | ❌（需求 R5） |
| `POST /readings` | `/api/readings` | ❌（需求 R7） |
| `POST /skill-runs` | `/api/skill-runs` | ❌（**需求单中未列，需新增**） |

### 5.1.1 命名裁决（**已与 be-dev 确认，2026-09-29**）

| 项 | 裁决 |
|---|---|
| 前缀与包络 | 以 `05-api-reference.md` 为准：`/api` 前缀；成功 `{code:200,message:'success',data}`，失败 `{code,message,data:null}`；分页 `data={list,total,page,size}` |
| **资源名** | 同样以已实现为准：**`lessons` 而不是 `courses`**（库表已叫 lessons，前端与联调脚本已按此消费）。故归档为 `POST /api/lessons`、`PUT /api/lessons/:id`；快照为 `GET /api/agent/snapshot` |
| 作废文档 | `backend/docs/03-api-contract.md`（`/api/v1` + `{success,data,meta}`）、`docs/backend-analysis.md`（旧包络）——**一并忽略** |
| 待改文档 | `docs/skills.md` 4.4 的 `/courses`、`/mistakes/:id/review` 等路径名（Skill 设计师负责回改） |

### 5.2 读接口映射（Skill 需要什么 → 现在能不能拿到）

| Skill 需要 | 现有接口 | 状态 |
|---|---|---|
| 级别 / 课号 / 连击 / 冻结 / 上次上课 | `/api/progress` | ✅ 已实现并实测 |
| 课号最大值、最近三课、语法点、词汇、反馈 | `/api/lessons?size=N`、`/api/lessons/latest`、`/api/lessons/:id` | ✅ |
| 错误趋势（R3 加速判定） | `/api/lessons/error-trend?limit=N` | ✅（G1 已关闭） |
| 未过关错词 + priority | `/api/mistakes/pending?limit=N`、`/api/mistakes/stats` | ✅（G2 已关闭） |
| 历史词表（词汇去重、词量） | `/api/vocabulary`、`/api/vocabulary/stats` | ✅ |
| 学习记录 / nextRecommendation | `/api/study-records` | ✅ 读；写缺失 |
| 阅读目录（当天是否已生成） | `/api/readings` | ❌（R7）→ 回落 `read/*.md` |
| 待补知识点 / 补漏队列 | `/api/knowledge-points` | ❌（R6）→ 回落 `progress.md` |
| 一次取全上下文 | `/api/agent/snapshot` | ❌（R1，P0） |

### 5.3 写接口映射（契约对象 → 落库）

| 契约对象 | 目标接口 | 状态 | 当前替代 |
|---|---|---|---|
| `LessonRecord` | `POST /api/lessons` + `PUT /api/lessons/:id` | ❌ R4 | 追加写 `notes/day-XX-YY.md` |
| `ReviewSession.outcomes` | `POST /api/mistakes/:id/review`（建议加批量版 `review-batch`） | ❌ R2 | 改 `wrong-words.md` 连续答对列 |
| `MistakeAnalysisResult` | `POST /api/mistakes` + 上述 review | ❌ R2 | 追加/改 `wrong-words.md` 行 |
| `LessonRecord.feedback` | `POST /api/progress/feedback` | ❌ R3 | 改 `progress.md` |
| `gradeSummary` / `nextRecommendation` | `POST /api/study-records` | ❌ R5 | 写进笔记与 `progress.md` |
| `ReadingSet` | `POST /api/readings` | ❌ R7 | 写 `read/YYYY-MM-DD-read.md` |
| `SkillRun` | `POST /api/skill-runs` | ❌ **未列需求** | 不落盘 |

### 5.4 缺失接口清单（**发给 be-dev**）

| 优先级 | 需求 | 说明 | 阻塞谁 |
|---|---|---|---|
| **P0** | `GET /api/agent/snapshot?recent=3&studentId=1`（R1） | 把 9 次请求降为 1 次；字段以 `06-api-requirements-amy.md` R1 示例为准，并**与本仓库 `docs/schemas/agent-snapshot.schema.json` 对齐**（不一致处以后者为准） | 全部 9 个 Skill |
| **P0** | `POST /api/mistakes/:id/review` + 批量版（R2） | 服务端判定 `streak`/`status`/`last_reviewed_at` | ②⑨ 闭环 |
| **P0** | `POST /api/progress/feedback`（R3） | 升降级与冻结落库 | ① 闭环 |
| **P0** | DQ1 数据同步修复 | 根因已定位（见下方）：删 `id=19` 非错题行 + 迁移脚本加过滤规则 | 全部（计数可信度） |
| **P1** | `POST /api/lessons` / `PUT /api/lessons/:id`（R4） | 课程归档与批改回填 | ① |
| **P1** | `POST /api/study-records`（R5） | 含 `nextRecommendation`（否则 G4 恒为 null） | ① / R1 |
| **P1** | `GET /api/knowledge-points`（R6） | 补漏队列 | ④⑤ |
| **P1** | `POST /api/skill-runs`（新增） | be-dev **已采纳** S2+S3 全部字段：`parent_skill_run_id`、`started_at`、`finished_at`、`duration_ms`、`degraded`、`notes`、`error` | 全部可观测性 |
| **P2** | `GET/POST /api/readings`（R7） | 阅读目录与当日不覆盖（同日期 POST 返回 409） | ① / 前端 |
| **P2** | `lessons` 增 `study_minutes`（G5） | 唯一可能动 schema 的字段之一 | ① |
| ~~P2~~ | ~~`lesson_sections.section_type` 增 `objectives`、`expected_mistakes`（S1）~~ **✅ 已完成（2026-09-29，`28d4732`）** | 已落库，契约已同步 | ①⑤ |
| **P2** | DQ2—DQ5 | `wrong_text` 混入批注、词汇口径两套、`firstLessonNo` 为 null、`lastReviewedAt` 全 null（DQ5 随 R2 自然修复） | 数据可信度 |

**DQ1 修法（be-dev 实测结论）**：`id=19` 是 `wrong_text` 为「正确」的翻译题记录、`correct_text` 为占位符、`wrong_count=0`、`error_type=other` 的非错题行 —— 即 Amy 已在 md 里删除、而 DB 种子未同步的那行；无外键依赖。修法两条：① Amy 确认后删 `id=19`；② 迁移脚本加规则「`correct_text` 为占位符或 `wrong_count=0` 的行不导入」。
**判重唯一索引可直接建**：`GROUP BY lower(trim(correct_text)), error_type HAVING count>1` 返回空，无重复行卡住。

**缺表补齐顺序（按 be-dev 排期，表名沿用其 `lesson_*` 前缀体系）**

| 优先级 | 表 | 阻塞什么 |
|---|---|---|
| **P0** | `lesson_exercises`、`mistake_events` | 批改记录与 `streak` 变化在库内不可追溯 |
| **P1** | `knowledge_points`、`lesson_knowledge_points`；阅读 3 张（`readings` / `reading_pieces` / `reading_questions`） | 补漏队列取数、阅读目录 |
| **P2** | `progress_feedback`、`skills` + `skill_runs` | 级别变化历史、Skill 执行留痕 |

> **关于 `progress_feedback` 排 P2（Skill 侧答复）**：**同意维持 P2，不需要提到 P1**。理由两条：① `LessonRecord.feedback` 需要的 `levelBefore` / `levelAfter` 来自 `POST /api/progress/feedback` 的**响应**，Skill 只在写反馈那一刻需要它，不需要查历史表；② 历史反馈序列已由 `lessons.feedback` + `study_records(feedback).payload` 还原（实测 6 条齐全）。若未来 `learning-progress-analysis` 要做「近 N 课级别变化曲线」，届时再提优先级。

### 5.5 快照字段映射（**已与 be-dev 确认，2026-09-29**）

| 契约字段名（`agent-snapshot.schema.json`） | 已实现接口字段名 | 处理方式 |
|---|---|---|
| `progress.currentCourseNo` | `currentLessonNo` | **快照按 schema 输出**（适配层/后端映射），现有 16 个接口字段名**保持不变** |
| `recentLessons[].levelCode` | `level` | 同上 |
| `pendingMistakes[].firstCourseNo` / `lastCourseNo` | `firstLessonNo` / `lastLessonNo` | 同上 |

**新增 2 个 optional 字段（本轮已补进 schema）**：`pendingMistakeStats`、`lastRecommendation`。两者均来自 R1 需求；后端可先按 optional 返回，Skill 按「忽略未知字段」不报错。

**两处形状已与 be-dev 钉死（2026-09-29）**

| 字段 | 形状 | 口径 |
|---|---|---|
| `pendingMistakeStats` | `{ total, byType }` | `byType` 为 `errorType → count`，口径复用 `/api/mistakes/stats`，**只统计 `status='pending'`** |
| `lastRecommendation` | `{ lessonNo, text } \| null` | **不是纯字符串**。库里 `study_records.payload.next_recommendation` 存字符串，由 service 层合成对象；`lessonNo` 取该条记录的课号；无记录返回 `null` |
| 缺值行为 | 返回 `null` / `[]` + `degradation{degraded:true, reason, affected}` | **绝不 500、绝不返回空串**（be-dev 已确认在快照实现中保证） |

> 命名裁决：**`pendingMistakeStats`（单数）**，以 `06-api-requirements-amy.md:79` 为准，`pendingMistakesStats` 作废。

### 5.6 `backlog` ↔ `knowledge_points` 映射（R6 前置约定）

`AgentSnapshot.backlog` 是教学规则 R2（升级不豁免欠账）的唯一数据来源，现阶段只能从 `progress.md` 文本解析（脆弱，见 R9）。`knowledge_points` 建好后由后端供数，映射约定如下：

| `backlog.backfillQueue[].status` | 来源 | 判据 |
|---|---|---|
| `next` | `knowledge_points.is_backlog=1` 且未完成 | `order_index` **最小**的那一项（队首） |
| `queued` | 同上 | 其余未完成项，按 `order_index` 升序 |
| `done` | 同上 | 已出现在某课 `lesson_knowledge_points(role='backfill')`（即已补过） |
| `untested` | **现阶段无法判定**，恒为空数组 | 见下方说明 |

**三条必须遵守的边界**：

1. **`planned` 不进补漏队列。** `knowledge_points.status='planned'` 表示主干线上「计划要学的新知识点」（如 `L2-04` 规则动词过去式，role=`new`），它是新授课内容，出现在 `LessonPlan.grammarPoint`，**不是欠账**。若把它塞进 `backfillQueue`，`next-lesson-planning` 会把它当补漏块讲掉，出现「一课两个语法点」——正是 Amy 明确禁止的。
2. **`seq` 必须 ≥ 1。** 契约 `seq` 的 `minimum` 为 1。若后端 `order_index` 从 0 起，映射时 +1；**直接透传 0 会导致 schema 校验失败**。
3. **Skill 不把 `mastered` 当掌握度证据。** `mastered` 会同时承载「诊断免修」与「课堂已掌握」两种语义，而诊断通过 ≠ 课堂掌握。`ProgressReport` 的掌握度一律由 Amy 的规则判定（关联错词是否过关 + 连续 2 课无同类新错），不读 `knowledge_points.status`。

**关于 `untested`**：区分「未测」与「待补」的证据目前只存在于 `progress.md` 文本（如「祈使句与 Let's —— 本次未测」、「介词 in 通过，on / at 待测」），库内无诊断记录表。因此 **R6 首版只产出 `next` / `queued` / `done` 三态，`untested` 恒为空数组并写 `degradation`**，不得由后端凭 `is_backlog` 猜测填充。

#### `is_backlog` 的适用范围（**be-dev 发现，已采纳**）

`progress.md` 有两份清单，容易混为一谈：

| 清单 | 内容 | 是否 `is_backlog=1` |
|---|---|---|
| 「待补的 Level 1 知识点」（7 项） | 三单 -s、名词单复数与 a/an、this/that、there is/there are、疑问词、can、don't/doesn't + Do/Does | **否**（仅作背景） |
| 「补漏队列」编号清单（4 项） | ① there is/there are（含 a/an）② this/that/these/those ③ 疑问词 what/who/where ④ 介词 on/at | **是** |

依据 `progress.md` 的诊断结果：**can、don't/doesn't、三单 -s、名词复数均已「通过 / 免修」，Do/Does 归为标点习惯**。这 5 项若打上 `is_backlog=1`，会以 `queued` 混进补漏队列，把已免修的内容重新讲一遍。

**两条补充边界**：
1. **队列顺序以 Amy 的编号队列为准，不以诊断结果为准。** 介词 on/at 的诊断判定是「待测」而非「未通过」，但 Amy 已明确写「← 第 7 课」，故 `next` 仍由「`is_backlog=1` 且未完成、`order_index` 最小」推导，不因它未测而挪出队列。
2. **补漏队列与错词本是两个独立通道。** 免修项若错词未过关（如三单 -s：诊断「通过」但 `Tom play soccer` 在错词本仍未过关），走 `pendingMistakes` 复习覆盖，**不进补漏队列**。

#### 诊断结果是否落库 —— Skill 侧裁定（**首版不落库**）

be-dev 指出 `progress.md` 的「Level 1 待补点诊断结果（2026-09-27，10 题）」是一张**结构化**表（本方案核对为**第 81—94 行**；be-dev 记为 60—72 行，内容一致，行号差异不影响结论），10 个知识点逐项给出判定，因此 `untested` 与 `reason='诊断未通过'` **确实有出处**。

**裁定：首版维持「留空 + degradation」，不落诊断表。长期也不建议把它当「当前状态」落库。** 三条理由：

1. **引用它等于间接引用 md**，与「Skill 只认对象不认文件」冲突，也满足不了 `ProgressReport.evidence` 必须指回课号或错词 id 的要求。
2. **它是一次性快照，不是每课记录。** 落库前必须先定义它是「事件流水」还是「当前状态」——两者表结构不同，且后者会立刻变成第二个真相源（与 `knowledge_points.status` 不落列的理由相同）。
3. **诊断结论会过期，且与错词本冲突。** 实证：诊断判定三单 -s「通过（Tom plays football）」，但 `wrong-words.md` 中 `Tom play soccer` **仍未过关**，第 6 课复习仍写错。**结论：诊断通过 ≠ 当前掌握。**

**若 Amy 认为诊断需要保留（可选增强，不阻塞首版）**，必须按**事件流水**建模而非状态列：

```
diagnostics(date, scope, items[{knowledge_point_code, verdict, evidence}])
```

并遵守两条消费规则：① 只取**最近一次**诊断的结论；② **与错词本冲突时以错词本为准**（错词本是持续更新的真实产出证据，诊断是某一天的快照）。
在此建模下 `untested` 也只能相对「最近一次诊断」存在，语义仍脆弱——故即便落库，**`untested` 仍建议维持空数组**，「是否要补」一律由 Amy 的编号队列决定。

**`pendingKnowledgePoints`（待补知识点）**：`code` / `title` / `levelCode` 直接取自 `knowledge_points`。`reason` 的处理见下。

#### `reason` 只给一半 —— Skill 侧的处理约定（**已与 be-dev 确认，2026-09-29**）

| `reason` 取值 | 后端能否给出 | 判据 |
|---|---|---|
| 「升级后未学」 | ✅ 可以给 | `level_code` 低于 `progress.current_level` 且未出现在任何 `lesson_knowledge_points` |
| 「诊断未通过」 | ❌ **首版给不出** | 库内无诊断记录表，硬给即编数据（与 `untested` 留空同理） |

**Skill 侧对 `reason` 留空的处理（三条，写死）**：

1. `reason` 在契约中**非必填**（`pendingKnowledgePoints` 仅 `code` / `title` 必填），留空合法，Skill 不得报错。
2. **`reason` 缺失时不得反向推断**：Skill 只允许用 `levelCode < progress.currentLevel` 判定「属欠账（R2）」，**不得**由此猜测「诊断未通过」或「已掌握」。
3. **必须留痕**：在 `SkillRun.notes` 记「N 条待补点无 reason」，并在 `degradation.affected` 列出 `backlog.pendingKnowledgePoints[].reason`。`ProgressReport` 的 `evidence` 一律要求可指回课号或错词 id，**无出处的结论不得写进报告**。

#### `done` 的历史欠账问题 —— 需要补的一步（Skill 侧提出的修正）

`lesson_knowledge_points` 只有建表后的数据，**历史上已补过的补漏块会被误判为「未完成」，从而重新冒进队列**。

be-dev 的初始导入方案（把 `progress.md`「已学知识点」写进 `lesson_knowledge_points`，role=`new`/`review`）**不足以修复 `done`** —— 因为 `done` 的判据是 `role='backfill'`，而主干知识点写进去的是 `new`/`review`。

**修正要求**：M2 初始导入时，除主干知识点外，必须按 `progress.md` 的补漏队列记录补写三条 `role='backfill'` 关联：

| 补漏块 | 课号 | 依据（`progress.md`） |
|---|---|---|
| there is / there are + a / an | 第 4 课 | 「第 4 课完成，已出队」 |
| this / that / these / those | 第 5 课 | 「第 5 课完成，已出队」 |
| 疑问词 what / who / where | 第 6 课 | 「第 6 课完成，已出队」 |

不补这三条的后果：第 7 课起的 `backfillQueue` 会把已出队的三项重新列为 `queued`，`next-lesson-planning` 可能重复排已补过的知识点 —— 与 Amy 的第 7 课规划（补漏块 ④ 介词 on / at）直接冲突。**这是 `next` 判定正确性的前置条件。**

> **Q11 已定（2026-09-29）**：`knowledge_points.status` **不落列**，由 service 按 `is_backlog` + `order_index` + `lesson_knowledge_points` 关联合成。
> **前提更正**：`knowledge_points` **尚未建表**（仅存在于 `schema.full.design.sql` 设计稿）【be-dev 已确认】，因此这是「建表时选不选这一列」而非 `ALTER`，本方案此前写的「落表需 ALTER」表述作废。
> 不落列的两条理由（be-dev 给，Skill 侧认可）：① `next` / `queued` / `done` 全部可推导，存一份 `status` 即引入第二个真相源，需长期与关联表同步；② Skill 不把 `status` 当掌握度证据，它只表达「排序」，持久化状态快照没有消费方。

### 5.7 与 be-dev 的协同项

1. **契约以 `docs/schemas/` 为准**：后端实现 `snapshot` 时按该文件字段命名输出（现有 16 个接口名不动）；若与已实现冲突，**先对齐再改 schema**（改 schema 需走 2.5 演进规则）。
2. **路径与包络以 `05-api-reference.md` 为准**，`docs/skills.md` 4.4 与 `03-api-contract.md`、`docs/backend-analysis.md` 由 Skill 设计师回改。
3. **`priority`、`errorType`、连击规则由服务端判定**，Skill 只报对错——这条边界保持不变（`06-api-requirements-amy.md` 已明确「服务端只搬运已有规则，不重设计教学策略」）。
4. **数据质量 DQ1 优先于新接口**：错词计数不一致会直接让复习取词池出错。

### 5.8 「语义关联不得靠文本匹配」—— 已否决方案（反面案例，勿再尝试）

fe-dev 的 FE-3 提议：用**文本匹配**自动判定「某个词是否曾是错词」，在 `pendingMistakes` / 词汇表之间自动打关联标记。**该方案已被否决（integration-plan §D-13）**，本轮实证如下：

| 项 | 内容 |
|---|---|
| 做法 | 对每条错词，用其 `wrongText` 去词汇表里做文本匹配，命中即标记「曾是错词」 |
| 表面效果 | 20 条错词命中 15 条，**命中率高** |
| 实际错误 | `Tom plays soccer` 错在三单 `-s` 缺失，文本匹配却命中 `play`；`Do you like coffee?` 错在句末问号，文本匹配却命中 `like` |
| 结论 | 命中率高但**语义全错**，产出的是**假数据**——标记出来的关联与真实错误完全无关 |
| 裁定 | **否决自动生成**。改走 `mistakes` 加可空 `vocabulary_id`，**由 amy 在批改时显式判定并关联** |

**推广规则（写死，防止换个场景再来一次）**：凡是**语义关联**（「这个词与那条错词是不是同一件事」「这个知识点是不是那次诊断的那一项」），一律**由 amy 判定，不得用文本匹配 / 正则 / 相似度自动生成**。文本匹配只能在**格式翻译**层面使用（如 md 表格列 → 契约字段），一旦要判断「是不是同一个意思」，就必须回到人（amy）。理由：高命中率会让人误以为自动关联可用，而错误又是静默的——假关联会一路流进错词本、报告与复习池，事后极难追溯。

### 5.9 历史数据可推导性（跨模块强制检查项）

**实证（本轮发现）**：`backfillQueue` 的 `done` 判据是「该知识点已出现在某课 `lesson_knowledge_points(role='backfill')`」，但**历史上已补过的补漏块没有这条记录**（`lesson_knowledge_points` 是新表，只有建表后的数据）。后果：第 4/5/6 课已出队的三个补漏块（there is/are、this/that、疑问词）会被判为「未完成」，**重新冒进第 7 课队列**，与 amy 已定的第 7 课规划（补漏块 ④ 介词 on/at）直接冲突，学生会被要求重做已出队的内容。

这是 be-dev 与 Skill 侧共同确认的 **Q12 修正项**：M2 初始导入必须补写第 4/5/6 课三条 `role='backfill'` 关联，`next` 判定才正确（见 5.6）。

**推广规则（列为每次加字段 / 加接口前的强制检查项，来源 integration-plan §G-3）**：

> **契约定得对不对，不看类型，看历史数据能不能接上。**

任何「状态列 / 判据 / 队列」上线前，必须回答一句：**这条规则对历史数据跑一遍，结果对不对？** 具体检查三点：

1. **判据依赖的关联记录是否存在**：若判据是 `role='backfill'` / `status='done'` 一类**建表后才有**的关联，必须同时给出历史回填方案，否则历史项一律被判「未完成」。
2. **是否存在第二真相源**：快照型数据（诊断结论、`next_recommendation`）不得当「当前状态」用，必须带时间戳或 `superseded` 语义；与持续更新的真相源（错词本）冲突时**以错词本为准**（§D-8）。
3. **同源问题是否只此一处**：同一根因大概率还存在于别处（`lesson_sections` 的作业/例句正文 R11、前端静态页里的历史数据均属同类），发现一处要顺手排查同类。

**根因归类**：G-3 与 D-8 是同一类错误——把「某天的快照」当成「一直有效的状态」。故本条与 §G-4、§5.6 的诊断裁定合并为同一条跨模块检查项。

### 5.10 诊断结果表不入库 —— 已裁决（记档）

Q13 已由 team-lead 在 integration-plan §D-8 裁决：**2026-09-27 那张 10 题诊断结果表不入库**，保留在 `progress.md` 文本。裁定与理由见 5.6「诊断结果是否落库」。补充两条执行口径，供日后不再翻案：

1. 若将来确要结构化，**只能**建独立 `diagnostics` 表，带 `diagnosed_at` / `superseded` 字段（按事件流水建模，**不是**状态列）；消费时只取最近一次，且**与错词本冲突时以错词本为准**。
2. 在它落库之前，`backfillQueue.untested` **维持恒为空数组 + `degradation`**，不得由后端凭 `is_backlog` 猜测填充（见 5.6）。

---

## 6. 可维护性

### 6.1 三层回归

| 层 | 回归对象 | 方式 | 现状 |
|---|---|---|---|
| **L1 契约** | 12 个 schema | `python .workbuddy/build/check_schemas.py docs/schemas`（只读，输出 `SCHEMA_OK`）【静态证据：脚本存在且为只读】 | ✅ 已实测通过（`files=12 refs=84 objects=68`） |
| **L2 适配层** | md → `AgentSnapshot` | 黄金样本：固定第 6 课后仓库状态，产出 `snapshot.json` 与既有 `docs/amy-next-lesson-plan.json`（API 链路产物）逐字段 diff；差异只允许落在 2.6 缺口清单内 | 🆕 待建（样本入 `docs/testdata/`） |
| **L3 教学规则** | `error_type` 判定 | **19 条回归基线**（见 6.2） | ⚠️ 静态走查完成，未程序化 |
| **L4 端到端** | 一次完整上课 | 上一课归档 → 下一课计划，与 `docs/amy-next-lesson-plan.json` 对标（该样本已由 9 个 GET 接口产出第 7 课计划）【静态证据】 | ❌ 未执行（无模型调用环境） |

### 6.2 `error_type` 19 条回归基线

以 `wrong-words.md` 现有 19 行作为回归集，`docs/skills.md` 3.6 的三步判定规则为被测对象：

| 项 | 内容 |
|---|---|
| 基线数据 | `wrong-words.md` 19 条（已过关 4 / 未过关 15） |
| 走查结果 | 17 条与现有记录一致；2 条分歧【静态证据，`docs/skills.md` 3.6】 |
| 分歧 1 | `what do you do?` → `What are you doing?`：现有 `word_choice` / 规则判 `grammar` |
| 分歧 2 | `I am very busy.` → `We are busy.`：现有 `grammar` / 规则判 `word_choice` |
| 影响 | 两类条数不变（grammar 9、word_choice 4），趋势统计不受影响 |
| **处置** | **待 Amy 裁定后锁定为基线**；本方案不单方面改已有数据。裁定前两条标「分歧保留」，回归时只校验「分歧条数 = 2 且条目不变」 |
| 运行方式 | 判定规则依赖语义，**无法用脚本自动验证**；每次改动判定规则后必须人工重走 19 条并记录结果到本文件所在目录（建议 `docs/testdata/error-type-regression.md`） |

### 6.3 版本与备份规则

1. **改前必须完整备份**：整目录复制到 `skills/_backup/english-daily-v<当前版本>-<YYYYMMDD>/` + `MANIFEST.md5`。只改一个文件也要整目录备份（多处文件间有隐式耦合）。
2. **版本自增**：版本号**唯一存放位置是 `SKILL.md` frontmatter 的 `version`**。
   - PATCH：改措辞、补说明、脚本缺陷修复，不改流程与契约；
   - MINOR：新增内嵌能力、改触发词、新增可选契约字段；
   - MAJOR：改必填项、删字段、改契约含义（并同步升 schema 到 `v2`）。
3. **正文不留版本标注**：`SKILL.md` 正文、`references/*.md`、文档正文**不得出现 `v2.2.0` 一类版本串**——版本只有一处，多写必然漂移。文档中引用版本时统一写「见 `SKILL.md` frontmatter」。
4. **脚本内不重复版本号**：`SkillRun.version` 运行时从 frontmatter 读取，不在脚本里硬编码。
5. **改动后必须跑**：L1（若改了 schema）→ L2（若改了适配层）→ L3（若改了判定规则）→ `build_board.py` 重建看板确认 `BOARD_OK`。
6. **同步与提交**：`.workbuddy/skills/` → `skills/`（方向见 4.3）→ `git commit` → `docs/changelog.md` 一条。

### 6.4 变更流程（与 Amy 的 10.2 对齐）

```
教学规则变更（Amy）→ progress.md 落地 → docs/ai-teacher.md 同步
   → 涉及流程/脚本 → Skill 设计师：备份 → 改 → 跑回归 → 同步 skills/ → 提交 → changelog
   → 涉及数据结构 → 后端工程师评估契约影响 → docs/schemas/（按 2.5 演进）
   → Git 工程师记录
禁止：绕过真相源直接改 Skill；改了 Skill 不更新 ai-teacher.md；改了 schema 不跑 L1。
```

---

## 7. 风险与未决问题

### 7.1 风险登记

| # | 风险 | 影响 | 缓解 | 责任方 |
|---|---|---|---|---|
| R1 | **Skill 源码不在版本库**，且权威副本被 4 份旧版包围 | 工作区丢失/被覆盖即无法恢复（已丢失阅读页改造的风险） | 4.3 三道防线 + 4.5 入库步骤 | Skill 设计师 + git-manager |
| R2 | **打包流程可能反向覆盖** `.workbuddy/skills/` | 权威副本被 30KB 旧版替换，且无 git 兜底 | 同步方向唯一 + 每次重建前 `verify_copy` | Skill 设计师 + git-manager |
| R3 | **写接口全缺**，Skill 产出无法落库 | 复习连击/过关/反馈/归档全靠 md，双轨长期化 | 5.4 清单发 be-dev；期间严格走 md 写适配 | be-dev |
| R4 | **接口命名两套**（`/courses` vs `/api/lessons`） | 三方各记一套，联调时字段对不上 | 以 `05-api-reference.md` 为准并回改文档 | be-dev + Skill 设计师 |
| R5 | **阶段一 8 表缺 6 表**，5 个契约对象无落点 | 平台化完成度受限；`SkillRun` 永不落盘 | be-dev 已给补表顺序（P0 `lesson_exercises`+`mistake_events`；P1 知识点与阅读；P2 反馈与 Skill 表） | be-dev |
| R11 | **`lesson_sections` 现仅 grammar/feedback 两类 12 条**【be-dev 已实测】 | 结构化查不到复习/词汇表/例句/作业/作答/批改正文，`LessonRecord.sections` 只能从 md 还原 | 阶段内 Skill 一律从 md 取正文；M2 补齐后按 `sectionType` 精确取 | be-dev |
| R6 | **G8：md 错词缺类型/次数/主键**，靠推断合成 | 切换后端后 `wrongCount` 口径可能不一致（DQ1 已现同类问题） | 建议 Amy 在 `wrong-words.md` 增两列；期间合成值标 `degradation` | Amy + Skill 设计师 |
| R7 | **`errorType` 判定依赖模型**，分类可能漂移 | 趋势统计失真 | 3.6 三步规则 + 6.2 十九条回归基线；分歧待 Amy 裁定 | Amy + Skill 设计师 |
| R8 | **看板重建会覆盖 `review/index.html`**（联调 F1） | 前端 API 改造被静态模板冲掉 | 前端改造下沉到 `build_board.py` 模板或把该页移出生成集 | fe-dev + Skill 设计师 |
| R9 | 适配层解析 `progress.md` 的**非结构化段落**（待补清单、补漏队列） | md 排版一改就解析失败（违反「Skill 只认对象」的初衷） | 优先走 `/api/knowledge-points`（R6）；G8 建议增列也是为了减少文本推断 | be-dev + Amy |
| R10 | 触发识别【未验证】 | 「继续」等歧义词误触发 11 步流程 | 1.3 二次确认；真实环境补触发测试 | Skill 设计师 |
| **R12**（新增） | **语义关联被自动化**（文本匹配打「曾是错词」标记等） | 命中率高但语义全错，**假数据**静默流入错词本 / 报告 / 复习池，事后难追溯 | 语义关联一律由 amy 判定；文本匹配只用于格式翻译（见 5.8）。已否决 FE-3 | Amy + Skill 设计师 |
| **R13**（新增） | **历史数据不可推导**（判据依赖建表后才有的关联记录） | 历史项被判「未完成」而重新入队（如已出队的补漏块重回第 7 课），与 amy 规划冲突 | 加字段 / 加接口前强制跑 5.9 三项检查；Q12 已定回填第 4/5/6 课三条 `role='backfill'` | be-dev + Skill 设计师 |

### 7.2 未决问题（需他人决策）

| # | 问题 | 需谁决策 | 建议 |
|---|---|---|---|
| ~~Q1~~ | 两套接口命名如何统一 | ~~be-dev + team-lead~~ ✅ **已定** | 一律以 `05-api-reference.md` 为准（含资源名 `lessons`）；`03-api-contract.md`、`docs/backend-analysis.md` 作废；`docs/skills.md` 4.4 由我回改 |
| ~~Q2~~ | `snapshot` 字段以哪份为准 | ~~be-dev~~ ✅ **已定** | 快照按 `docs/schemas/agent-snapshot.schema.json` 输出；现有 16 接口字段名不变 |
| ~~Q10~~ | `pendingMistakeStats` 还是 `pendingMistakesStats` | ~~be-dev~~ ✅ **已定** | 取 **`pendingMistakeStats`**（单数），以 `06-api-requirements-amy.md:79` 为准，复数写法作废 |
| ~~Q11~~ | `knowledge_points.status` 是否落表 | ~~be-dev~~ ✅ **已定** | **不落列**，由 service 合成（见 5.6 末）。注：该表尚未建表，不是 `ALTER` 而是建表时的取舍 |
| ~~Q12~~ | M2 初始导入是否补写三条历史 `role='backfill'` 关联 | ~~be-dev~~ ✅ **已定** | 补（第 4/5/6 课），已逐条核对 `progress.md`「已出队」原文（见 5.6） |
| ~~Q13~~ | 诊断结果是否落库 | ~~Amy（教学侧）+ Skill 设计师~~ ✅ **已定** | **不入库**（Skill 侧裁定 + team-lead 裁决 integration-plan §D-8，见 5.6 / 5.10）。保留在 `progress.md` 文本；将来若结构化只能建独立 `diagnostics` 表带 `diagnosed_at`/`superseded`，**冲突时以错词本为准** |
| Q3 | **入库方案选 C 还是 B**（4.4） | **git-manager**（必须沟通后定稿） | 推荐 C：只入库 `skills/`，`.workbuddy/` 维持忽略 |
| Q4 | `.workbuddy/build/`、`_tmpx/` 是否可清理 | **git-manager** + 实操确认打包流程 | 先重命名加 `.bak-20260929`，确认无用后再删；不直接删 |
| Q5 | 是否新增 `AgentSnapshot.provenance` 字段 | be-dev | 建议加（可选字段、兼容、Skill 忽略）；不加以不影响切换 |
| Q6 | `wrong-words.md` 是否增「错误类型 / 累计次数」两列 | Amy | 建议增，可停用适配层的推断逻辑，消除 G8 |
| Q7 | `error_type` 两条分歧（`what do you do?`、`I am very busy.`）如何裁定 | Amy | 裁定后锁定为 6.2 回归基线 |
| Q8 | 是否启用 tag 规范（`skill-v2.2.0`） | git-manager | 建议启用，便于按 Skill 版本回滚 |
| Q9 | `docs/testdata/` 目录约定（黄金样本是否入库、体积上限） | git-manager | 建议入库，单文件 < 200KB |

---

### 7.3 Amy 教学侧回复的落地（2026-09-29，已采纳）

Amy 已将三条教学决策写入 `amy-teaching-plan.md` §2.7 与附录 B.1，Skill 侧落地情况如下：

| # | Amy 裁定 | 内容 | Skill / 契约侧落地 |
|---|---|---|---|
| 1 | **`expectedMistakes` 学生端不展示**（前端 F10 取消） | 它是 `wrong→correct` 成对的**答案清单**，提交前展示等于提前给答案（违反 `ai-teacher.md` 1.3 硬规则 2）；课后展示又与批改视图重复 | 字段**仍按 D-10 入库**（供批改生成「为什么不是 Y」的文案），**前端不渲染**。契约 `TeachingBlock.expectedMistakes` / `lesson_sections(section_type='expected_mistakes')` 保留，仅约定「不出现在学生作答前的界面」 |
| 2 | **降载判据给全**（正式版 `docs/ai-teacher.md` §7.4；过程稿 `amy-teaching-plan.md` §2.7） | 触发 T-1 单课 `E>=5`；T-2 连续 2 课 `E>=5`；T-3 `too_hard`；T-4 断更 `D>=7`；T-5 复发阻断（`wrongCount>=4` 且 `error_type∈{grammar,word_choice}`）；T-6 拟排生词 >12。档位 L0 常规（生词 10 / 复习 5 / 1 新点讲全）、L1 轻度（生词 6—8）、L2 中度（生词 0—6、不讲新点改同点变式）、LX 阻断（生词 0）。退出：降载后连续 2 课同时 `E<=2` 且 `R=0` 且 `F∈{too_easy,just_right}` → 回 L0；任一课 `E>=5` 回退一档重算 | ✅ 可执行部分已落进 Skill：`SKILL.md` 新增「降载判定」小节（T-1—T-6 + 档位摘要 + 上限保护 / D1 例外 / 退出），引用指向 `docs/ai-teacher.md` §7.4；「同点变式」等教学判断项显式留白给 Amy |
| 3 | **生词量口径** | 以「**Level 2 常规 10（8—12）、降载 6—8**」为准；`SKILL.md` 第 5 步的「5—8」**作废**（那是 Level 1 的旧默认） | ✅ 已改两处：`skills/english-daily/SKILL.md` 第 5 步去掉写死的「5—8」，改为「数量按 `level-map.md` 当前级别的『每课词汇』行取」；`skills/english-daily/references/level-map.md` Level 2「每课词汇」由 6—8 改为「8—12（常规 10），降载档 6—8」【已实测：两处文本已核对，`diff -r` 与运行副本一致】 |

**已落地（本轮，关闭上轮 TODO）**：降载判据的**可执行部分**已补进 Skill——
- `skills/english-daily/SKILL.md` 新增「降载判定（第 5 步前置，规则见 `docs/ai-teacher.md` §7.4）」小节：可自动算的量（`E` / `D` / `F` / `W` / 拟排生词数）、T-1—T-6 触发、L0/L1/L2/LX 档位摘要、三条边界（上限保护 / D1 例外 / 退出条件），并显式列出**不由 Skill 自动决定**的项（`R` 的认定、L2/LX「同点变式」出题、L1 复习题量上限、书写规范类错误的题型拆分）。
- **引用已从方案目录移出**：`SKILL.md` 与 `references/level-map.md` 改指**正式规则文档 `docs/ai-teacher.md` §7.4**；`SKILL.md` 增「仓库内依赖」声明（该 Skill 只能在含 `docs/ai-teacher.md` 的仓库内运行，缺失时应提示并停止）。
- `references/level-map.md` 顶部增「常规档区间 × 档位下调」说明，各级「每课词汇」行保持分级取数（Level 1 的 5—8 未动）。

---

## 附：本方案的证据状态汇总

| 项 | 状态 |
|---|---|
| 5 份 `build_board.py` 的字节数/行数/md5、阅读页特征差异 | ✅ 本轮已实测 |
| `.gitignore` 否定写法 A 无效 / B 有效 | ✅ 本轮已实测（临时仓库 + `git check-ignore -v`） |
| 后端 16 个 GET 可用、写接口与快照接口 404 | ✅ 已实测（`05-api-reference.md`、`06-api-requirements-amy.md`、`amy-next-lesson-plan.json` 三方互证） |
| 12 个 schema 校验通过 | ✅ 已实测（`docs/skills.md` 6.3 记录） |
| 阶段一 8 表缺 6 表、`lessons` 无 `study_minutes`、`section_type` 仅 8 值、`skill_runs` 无父子与时间字段 | ✅ 静态证据（`schema.sql`、`schema.full.design.sql` 可逐行定位） |
| `wrong-words.md` 缺类型/次数/主键 | ✅ 静态证据（表头 6 列） |
| 打包流程会反向覆盖 skills 目录 | ⚠️ 推断（目录语义明确，触发条件未复现） |
| 三个独立 Skill 的真实触发识别 | ❌ 未验证（无模型调用环境） |
| 适配层实跑、A/B 双链路快照 diff | ❌ 未执行（方案阶段未写码，本轮未改动任何 Skill 源码与脚本） |
| schema 增补 `pendingMistakeStats` / `lastRecommendation` 后复跑校验 | ✅ 本轮已实测：`SCHEMA_OK`，objects 68 → 71 |
| DQ1 根因为 `id=19` 非错题行、判重校验返回空 | ✅ be-dev 已实测（本方案引用，本人未复跑） |
| `lesson_sections` 仅 2 类 12 条、`study_records.payload` 无 `next_recommendation` | ✅ be-dev 已实测（本方案引用） |
| `skills/english-daily/` 入库目录就绪（8 文件、`build_board.py` md5 = `50aca14b…`、`diff -r` 与运行副本一致、`git check-ignore` 未忽略） | ✅ 本轮已实测 |
| `SKILL.md` 第 5 步与 `references/level-map.md` 生词量口径按 Amy 裁定改正并同步运行副本 | ✅ 本轮已实测（两处文本已核对） |
| `grading-result` / `lesson-record` 增 optional `revisedAnswer`、`agent-snapshot` 四个字段说明改写后复跑校验 | ✅ 本轮已实测：`SCHEMA_OK`，objects 71（未增对象，仅增属性与描述） |
| ~~S1~~ 两个枚举值已**落库并回改描述**（`db/schema.sql` + 库内 ENUM + `constants.js` + `common.schema.json` 四处同源，新值追加末尾） | ✅ 本轮已实测（`docs/schemas/` 内已无「待确认」残留；`SCHEMA_OK` objects=71） |
| ⚠️ 待续：`SKILL.md` 笔记格式仍是 8 小节、`course-template.md` 与 `build_board.py` 的 `parse_notes` 也只认 8 节，故 `objectives`/`expected_mistakes` **暂不写为独立 md 小节**（仍降级并入 `grammar` 前缀） | ⏳ 未闭环（属 Skill 源码改动，走 6.3 流程） |
| 降载判据可执行部分落进 `SKILL.md`（T-1—T-6 + 档位 + 上限保护 / D1 例外 / 退出），引用改指 `docs/ai-teacher.md` §7.4 并加「仓库内依赖」声明；`level-map.md` 增档位说明 | ✅ 本轮已实测（`SKILL.md` / `references/*.md` 已无 `docs/plans/` 引用；与运行副本同步一致） |
| G10 关闭：`grading-result.schema.json` **不加字段**（补漏块用 `kind='backfill'` 区分、阅读理解题不在本契约） | ✅ 本轮已实测（amy 定形 `docs/ai-teacher.md` §6.5；schema 描述已改为终态并复跑校验） |
| ⚠️ **运行副本漂移（本轮发现）**：`.workbuddy/skills/english-daily/scripts/build_board.py` 被直接改动（退役 HTML 生成，43712B/1029 行/md5 `07db49fd…`），与受控源 `skills/english-daily/scripts/build_board.py`（44415B/1040 行/md5 `50aca14b…`）**不一致**。违反 4.3 防线③「同步方向唯一」，**未擅自覆盖**，已上报 git-manager / team-lead 决策 | ❌ 未闭环（待决策） |
