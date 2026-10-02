# 后端方案 · 核心数据模型评审与 API 缺口补齐

> **状态：方案（PLAN）· 2026-09-29**　作者：后端工程师（be-dev）
> 性质：**只出方案，未改任何库表结构与已跑通代码**。文中所有 `ALTER TABLE` / `CREATE TABLE` 均为**待确认**的候选，未执行。
> 依据：`PROJECT.md`、`AGENTS.md`、`backend/README.md`、`backend/docs/01—06`、`backend/src/**`、`backend/db/schema.sql`、`backend/db/schema.full.design.sql`、`docs/skills.md`、`docs/schemas/*.json`、`docs/integration-report-01.md`。

---

## 〇、结论速览

| 项 | 结论 |
|---|---|
| 现有 8 表是否支撑「长期、连续、个性化」 | **主干够用，四块必须补**：练习明细、错题事件流水、知识点地图、阅读三表 |
| 是否需要推倒重来 | **否**。8 表命名与分层已落地并被前端实测消费，改造走「加表 + 加可空列 + 加接口」，不动既有 16 个 GET 契约 |
| 缺口优先级 Top3 | ① 写接口闭环（`POST /mistakes/:id/review`、`POST /progress/feedback`）<br>② `GET /agent/snapshot`（含 G3 backlog / G4 lastIncomplete 降级方案）<br>③ 阅读三表 + `GET /api/readings/stats` |
| 最大阻塞项 | **DQ1（错词 20 vs md 19）根因是 `mistakes` 缺业务唯一键**；修它需要先做去重校验再建函数唯一索引，必须与 Amy / skill-designer 对齐判重键 |
| 对调用方的影响 | 全部为**新增**接口；仅在 `GET /agent/snapshot` 内新增可选字段，缺数据时返回 `null`/空数组并带 `degradation`，**不返回 500** |

### 证据标注口径（全文遵守）

| 标记 | 含义 |
|---|---|
| **[已实测]** | 本次在本机 `english_platform` 实跑只读 SQL / 实读源码得到的结论 |
| **[静态证据]** | 读代码或文档可确证，但未运行 |
| **[推断]** | 基于现有结构的设计判断，尚未验证 |
| **[未验证]** | 明确没有跑过，不得声明通过 |

---

## 一、数据模型评审

### 1.0 现状基线（**[已实测]** 2026-09-29 只读核对）

```
english_platform 实际对象：10 个
  表 8：students / lessons / lesson_sections / vocabulary /
        lesson_vocabulary / mistakes / study_records / progress
  视图 2：v_dashboard_stats / v_pending_mistakes
行数：students 1 · lessons 6 · lesson_sections 12 · vocabulary 51 ·
      lesson_vocabulary 52 · mistakes 20 · study_records 18 · progress 1
```

三个**此前文档未记录**的实测发现，直接影响方案：

| # | 实测发现 | 影响 |
|---|---|---|
| **N1** | `lesson_sections` **只有 2 种 section_type**：`grammar` 6 条 + `feedback` 6 条，共 12 条；`review`/`vocab_table`/`examples`/`homework`/`my_answer`/`grading` **一条都没有** | 课程详情页只能渲染语法与反馈两段；「课程全文检索」若只搜 `lessons.summary/grammar_point`，**搜不到作业与例句内容**（见 2.9） |
| **N2** | `study_records.payload` 现有 3 类，字段为 `{lessonNo, level/errorCount/exerciseCount/feedback}`，**没有任何一条含 `next_recommendation`** | G4 `lastIncomplete` 与快照 `lastRecommendation` 目前**只能返回 `null`**，需靠写接口约定补齐（见 2.4） |
| **N3** | `mistakes.last_reviewed_at` 非空行数 = **0**；`mistakes` 表**除主键外没有任何业务唯一键** | DQ5 确认；DQ1（20 vs 19）的根因即「无唯一键 → 迁移重复插 → 无法 `ON DUPLICATE KEY UPDATE`」（见 5.3） |

---

### 1.1 课程（lessons + lesson_sections）

| 维度 | 结论 |
|---|---|
| 长期 / 连续 / 个性化 | **够用**（`uk(student_id, lesson_no)` 保证断更不断号，`lesson_date` 可空支持同日二课） |
| 缺口 | ① `study_minutes` 列不存在（G5）<br>② **数据不全**：N1，6 类小节未入库<br>③ 无全文检索能力 |

- **需加字段**：`lessons.study_minutes TINYINT UNSIGNED NULL`（G5）。**可空加列，对现有 6 行与 16 个接口零影响**。
  过渡方案（**零 DDL，推荐先做**）：由 `study_records(record_type='feedback').payload.studyMinutes` 承载，待口径稳定后再落列。
- **不新建表**：小节用 `lesson_sections` 足够，`content_md MEDIUMTEXT` 保原文。
- **数据补全**依赖 M2 迁移（见第四章），**不靠手工补**。

### 1.2 词汇（vocabulary + lesson_vocabulary）

| 维度 | 结论 |
|---|---|
| 结论 | **够用，不动** |
| 说明 | `uk(student_id, word)` 已保证「累计生词按去重计」，与契约口径「词汇总量由去重后总量决定」一致 |

- **已知口径分歧 DQ3**（API 51 vs 看板 52）：**[已实测]** `vocabulary=51`、`lesson_vocabulary=52`（有 1 词在两课各出现一次）。**后端不改数**，只在 `05-api-reference.md` 标注口径：*API 的 `total` 是去重词条数；看板的 52 是「课×词」关联数*。需 fe-dev 在看板对齐（见 6.4）。
- **不建议**现在加「词汇掌握度」字段：契约里没有消费方，属过度设计。

### 1.3 阅读（readings / reading_pieces / reading_questions）

| 维度 | 结论 |
|---|---|
| 结论 | **需新建表**。当前 0 张表，前端（原 `review/reading.html`，2026-10-02 已退役；现 `frontend/` 的 `/reading`）的「阅读篇数」只能显示「—」（联调报告 F3） |

- 现状可替代方案均不成立：**[已实测]** `study_records` 中 `record_type='reading'` 为 **0 条**，无数据可聚合；直接读 `read/*.md` 违反「后端是学习记忆层」的定位。
- 建表顺序见 1.8，接口草案见 2.6。

### 1.4 练习（exercises）

| 维度 | 结论 |
|---|---|
| 结论 | **需新建表**。当前只有 `lessons.exercise_count` 一个计数，**题目、参考答案、作答、批改结论全部无处可存** |

- 这不是「锦上添花」：`GradingResult`、`ExerciseRecord`、`answer-grading` 的归因（`targetPoint`）**没有落点**，教学闭环在库内是断的。
- 落表命名建议 `lesson_exercises`（与既有 `lesson_sections` / `lesson_vocabulary` 前缀体系一致，见 1.8）。

### 1.5 错题（mistakes + 待补 mistake_events）

| 维度 | 结论 |
|---|---|
| 结论 | **主表够用；需新建 `mistake_events`；建议加 2 个字段** |

- `mistakes` 字段已覆盖 `MistakeItem` 全部字段（`wrong_text/correct_text/error_type/error_reason/streak/wrong_count/status/last_reviewed_at` + `first_lesson_id/last_lesson_id`）✅
- **需新建 `mistake_events`**：R2 明确要求「每次判对错都插入一条流水」；`mistake-analysis` 的 `events[]`、`MistakeEvent` 契约也无落点。
- **建议加 `mistakes.note VARCHAR(255) NULL`**（DQ2）：把「（第 3 次犯：第 6 课写 were playing game）」这类批注从 `wrong_text` 中剥离。**可空加列 + 数据清洗，不改已有 20 行的语义**；清洗动作需 Amy 确认文案，本方案只给字段不给洗数。
- **必须新增业务唯一键**（DQ1 根因）：见 5.3。

### 1.6 学习记录（study_records）

| 维度 | 结论 |
|---|---|
| 结论 | **够用，不新建表** |

- `payload JSON` 提供弹性扩展，`G4 lastIncomplete`、`R5 nextRecommendation`、`G5 studyMinutes` 均可在**不改表**的前提下由 `payload` 约定承载。
- 代价是 `payload` 内的键无 schema 约束 → 需在 `05-api-reference.md` 明确「**payload 键白名单**」（见 5.2 幂等与校验）。

### 1.7 进度（progress）

| 维度 | 结论 |
|---|---|
| 结论 | **够用**；`progress_feedback` 表可延后到 P2 |

- `progress` 单行已含级别 / 课号 / 连击 / 冻结 / 最近反馈 / 备注，`GET /api/progress` 已实测可用。
- 反馈历史当前可从 `lessons.feedback` + `study_records(feedback).payload` 还原序列（`lessonNo` + `feedback` 齐全）**[已实测]**，因此 `progress_feedback` 不阻塞任何 Skill，放到 P2。

---

### 1.8 与 `schema.full.design.sql`（18 表）的差距与取舍

**命名取舍（重要，避免第二套命名漂移）**：第一阶段已把设计稿的 `users → students`、`courses → lessons`、`course_sections → lesson_sections`、`course_vocabulary → lesson_vocabulary` 改名并落地，前端与联调脚本已按新名消费。**新表一律沿用现有前缀体系**，不再回退到 `courses` / `user_*`。

| 设计稿表 | 现有对应 | 处置 | 优先级 | 理由 |
|---|---|---|---|---|
| `levels` | 无（`level_code VARCHAR`） | **不建** | — | 只有 5 个级别，用 `src/constants.js` 常量即可；建表收益 < 维护成本 |
| `users` | `students` ✅ | — | — | 已落地 |
| `user_progress` | `progress` ✅ | — | — | 已落地（多一个 `note` 字段） |
| `courses` | `lessons` ✅ | 加 `study_minutes` | P1 | G5 |
| `course_sections` | `lesson_sections` ✅ | 补数据（M2） | P1 | N1 |
| `knowledge_points` | **无** | **新建** | **P1** | G3 backlog 的唯一来源 |
| `course_knowledge_points` | **无** | **新建 `lesson_knowledge_points`** | **P1** | `role=new/review/backfill` 的载体，R2「升级不豁免欠账」依赖它 |
| `vocabulary` / `course_vocabulary` | `vocabulary` / `lesson_vocabulary` ✅ | — | — | 已落地 |
| `exercises` | **无** | **新建 `lesson_exercises`** | **P0** | 批改闭环、`GradingResult` 落点 |
| `readings` / `reading_pieces` / `reading_questions` | **无** | **新建 3 张** | **P1** | R1 阅读统计 + 前端 `reading.html` |
| `mistakes` | `mistakes` ✅ | 加 `note` + 唯一键 | P0（键）/ P2（note） | DQ1 / DQ2 |
| `mistake_events` | **无** | **新建** | **P0** | R2 明确要求 |
| `progress_feedback` | 无（`lessons.feedback` 代） | 延后 | P2 | 现有数据可还原序列 |
| `study_records` | `study_records` ✅ | — | — | 已落地（多 `summary` 列） |
| `skills` / `skill_runs` | 无 | 延后 | P2 | S2 可追溯性，不阻塞上课 |
| `v_pending_mistakes` / `v_dashboard_stats` | 已有 ✅ | — | — | 已落地 |

**先补哪几张、为什么**（按「阻塞的教学闭环」排序，不是按设计稿顺序）：

1. **`lesson_exercises`（P0）** —— 没有它，批改结果只能存在对话里，**「错了什么」在库内不可追溯**，这是 Amy 三问之一。
2. **`mistake_events`（P0）** —— 没有它，`streak` 的变化过程不可回放，无法回答「这个错是慢慢变好还是反复」。
3. **`knowledge_points` + `lesson_knowledge_points`（P1）** —— G3 backlog 的唯一数据来源，支撑 R2/R3。
4. **`readings` 3 张（P1）** —— 前端 `reading.html` 与 R1 都在等；且 `read/*.md` 已有 4 天真实数据可迁移，风险低。
5. `progress_feedback` / `skills` / `skill_runs`（P2）—— 可追溯性增强，不阻塞。

---

## 二、API 缺口清单与优先级

### 优先级总表

| 优先级 | 缺口 | 接口 | 依赖建表 | 复杂度 |
|---|---|---|---|---|
| **P0-1** | 复习结果无法回写（Amy 闭环断裂） | `POST /api/mistakes/:id/review`<br>`POST /api/mistakes/review-batch` | `mistake_events`（新建） | 中 |
| **P0-2** | 难度反馈无法触发升降级 | `POST /api/progress/feedback` | 无 | 中 |
| **P0-3** | 教学决策不可回溯（G4 数据源） | `POST /api/study-records` | 无 | 低 |
| **P0-4** | 无聚合快照（9 次请求 → 1 次） | `GET /api/agent/snapshot` | 无（缺字段降级） | 中 |
| **P0-5** | 新课无法归档 / 批改无法回填 | `POST /api/lessons`<br>`PUT /api/lessons/:id` | `lesson_exercises`（新建） | 高 |
| **P0-6** | 新错词无法入库 | `POST /api/mistakes` | `mistakes` 唯一键 | 中 |
| **P1-1** | G3 无知识点地图 | `GET /api/knowledge-points` | `knowledge_points` 等 2 张 | 中 |
| **P1-2** | R1/R7 无阅读统计 | `GET /api/readings/stats`<br>`GET /api/readings`<br>`GET /api/readings/:date`<br>`POST /api/readings` | `readings` 等 3 张 | 中 |
| **P1-3** | G5 学习时长无落点 | `lessons.study_minutes` 列 + `GET /api/study-records/stats` 扩字段 | 加 1 列（可空） | 低 |
| **P1-4** | 前端 `size` 卡在上限 100（F2/B3） | `GET /api/lessons/all` + `maxSize` 放宽 | 无 | 低 |
| **P1-5** | 课程全文检索只搜 2 个字段 | `GET /api/lessons?q=` 扩面 + `GET /api/search` | 可选 FULLTEXT | 中 |
| **P1-6** | S2 Skill 执行无留痕 | `POST /api/skill-runs`、`GET /api/skills` | `skills`/`skill_runs` | 低 |
| **P2** | 看板一次取全 | `GET /api/dashboard/summary` | 无 | 低 |

> **G1（errorTrend）已关闭**、**G2（priority）已关闭**：`GET /api/lessons/error-trend` 与 `mistake.service.js:derivePriority` 均已实现并实测。本方案只负责把它们**聚合进快照**（2.4），不重复实现。

---

### 2.1 P0-1 · `POST /api/mistakes/:id/review` ★

- **入参**：`{ result: 'correct' \| 'wrong', lessonNo?: int, answeredAt?: datetime, clientEventId?: string }`
- **出参 200**：`{ id, streak, wrongCount, status, priority, lastReviewedAt }`
- **SQL 涉及表**：`mistakes`（UPDATE）、`mistake_events`（INSERT）、`lessons`（按 lessonNo 解析 id，可空）
- **服务端规则（只搬运 `wrong-words.md`，不重设计）**：
  - `wrong` → `wrong_count+1`、`streak=0`、`status='pending'`
  - `correct` → `streak+1`；`streak>=2` → `status='passed'`
  - 两者都写 `last_reviewed_at` 并插一条 `mistake_events`
- **事务边界**：`withTransaction` 单事务（读改写在 `SELECT ... FOR UPDATE` 下做，避免并发复习丢更新）
- **幂等**：`clientEventId` 唯一键 `uk_me_client(client_event_id)`，重复提交返回首次结果（见 5.2）
- **复杂度**：中（新表 + 事务 + 规则）
- **批量版**：`POST /api/mistakes/review-batch`，body 为数组，**单事务**；部分失败整批回滚并 400

```js
// 草案（service 层核心，未落盘）
async function reviewMistake(studentId, id, { result, lessonNo, answeredAt, clientEventId }) {
  return withTransaction(async (conn) => {
    const m = await mistakeRepo.lockById(conn, id, studentId);          // SELECT ... FOR UPDATE
    if (!m) throw ApiError.notFound('MISTAKE_NOT_FOUND', `错词不存在：id=${id}`);
    const dup = clientEventId && await mistakeEventRepo.findByClientId(conn, clientEventId);
    if (dup) return mapMistake(m);                                       // 幂等命中
    const next = result === 'correct'
      ? { streak: m.streak + 1, wrongCount: m.wrong_count,
          status: m.streak + 1 >= 2 ? 'passed' : 'pending' }
      : { streak: 0, wrongCount: m.wrong_count + 1, status: 'pending' };
    await mistakeRepo.update(conn, id, { ...next, lastReviewedAt: answeredAt || new Date() });
    await mistakeEventRepo.insert(conn, { mistakeId: id, lessonId, result, clientEventId });
    return mapMistake({ ...m, ...next });
  });
}
```

### 2.2 P0-2 · `POST /api/progress/feedback` ★

- **入参**：`{ lessonNo: int（必填）, feedback: 'too_easy'\|'just_right'\|'too_hard', note?: string }`
- **出参 200**：`{ levelBefore, levelAfter, easyStreak, upgradeFrozenUntil, message }`
- **SQL 涉及表**：`progress`（UPDATE）、`lessons`（UPDATE feedback + 解析 id）、`study_records`（INSERT feedback，payload 带 `nextRecommendation`）
- **服务端规则（对齐 `progress.md`）**：
  - `too_easy` → `easy_streak+1`；`==2` 时升 1 级并清零（**受 `upgrade_frozen_until` 约束**：`upgrade_frozen_until >= lessonNo` 时只记连击不升级）
  - `too_hard` → 降 1 级（下限 `Level 1`），`upgrade_frozen_until = lessonNo + 3`
  - `just_right` → `easy_streak=0`，仅记录
- **边界**：Amy 侧 4 条守门规则（准确度冻结、加速复议等）**不在后端实现**，与 `06-api-requirements-amy.md` R3 一致
- **复杂度**：中

### 2.3 P0-3 · `POST /api/study-records`

- **入参**：`{ recordType, lessonNo?, payload }`，`payload` 走**键白名单**：
  `lessonNo / level / feedback / errorCount / exerciseCount / byType / nextRecommendation / studyMinutes / incompleteStep`
- **出参 201**：`{ id, recordType, createdAt }`
- **SQL 涉及表**：`study_records`（INSERT）、`lessons`（按 lessonNo 解析 id）
- **契约意义**：`nextRecommendation` 是快照 `lastRecommendation` 与 **G4** 的唯一数据来源（N2：当前库内 0 条）
- **复杂度**：低

### 2.4 P0-4 · `GET /api/agent/snapshot` ★

- **入参**：`?recent=3`（1—10）、`?studentId=`
- **出参 200**：`data` 形状对齐 `docs/schemas/agent-snapshot.schema.json`
- **SQL 涉及表**：`progress`、`lessons`、`lesson_sections`、`lesson_vocabulary`+`vocabulary`、`mistakes`（或 `v_pending_mistakes`）、`study_records`、（`readings`、`knowledge_points` 建表后并入）
- **实现约束（避免两套排序漂移）**：
  - `pendingMistakes` **直接复用** `mistakeService.getPendingMistakes`（含 `derivePriority`），不另写 SQL
  - `errorTrend` **直接复用** `lessonService.getErrorTrend`
- **字段降级表（缺数据不 500）**：

| 快照字段 | 来源 | 当前状态 | 缺省处理 |
|---|---|---|---|
| `deploymentMode` | 固定 `"backend"` | ✅ | — |
| `progress` | `progress` 表 | ✅ 可用 | — |
| `courseCatalog` | `lessons` | ✅ 可用 | — |
| `recentLessons[].vocabulary` | `lesson_vocabulary`+`vocabulary` | ✅ 可用 | `[]` |
| `recentLessons[].errorCount` | `lessons.error_count` | ✅ 可用（G1 已关） | — |
| `pendingMistakes[].priority` | service 推导 | ✅ 可用（G2 已关） | — |
| `errorTrend.byLesson[].byType` | 需 `mistake_events` 或 `payload.byType` | **[已实测] 无数据** | 省略该键，`degradation.affected=["errorTrend.byType"]` |
| `backlog` | 需 `knowledge_points` | **缺表** | `null` + `degradation.affected=["补漏块"]` |
| `lastIncomplete` | `study_records(feedback).payload.nextRecommendation/incompleteStep` | **[已实测] 全 null** | `null` |
| `readingCatalog` | 需 `readings` | **缺表** | `[]` |
| `lastRecommendation` | 同上 | **[已实测] 全 null** | `null` |

- **G4 `lastIncomplete` 的两个方案**：
  - **方案 A（推荐，零 DDL）**：约定 `POST /api/study-records` 时由 Amy 写入 `payload.nextRecommendation` 与可选 `payload.incompleteStep`；快照取最近一条 `record_type='feedback'` 的记录合成 `{lessonNo, nextRecommendation, incompleteStep}`。
  - **方案 B（备选）**：新增 `lessons.status='planned'` 语义 —— 学生中途离开时建一条 `planned` 课，快照取 `status='planned'` 的最大课号。
  - 取舍：A 不动表、与契约 `lastIncomplete` 字段一一对应；B 会污染 `lessons` 的课号序列（与「断更不断号」冲突）。**推荐 A**。
- **复杂度**：中（7—9 个查询并行聚合）

### 2.5 P0-5 · `POST /api/lessons` / `PUT /api/lessons/:id`

- **入参**（对齐 `LessonRecord`，`lessonNo` 与 `sections` 必填）：
  `lessonNo, lessonDate, levelCode, summary, studyMinutes?, sourceFile?, sections[{sectionType, contentMd, orderIndex}], vocabulary[{word, phonetic, meaning, example, isNew}], exercises[{exerciseNo, exerciseType, prompt, referenceAnswer, targetPoint?}], knowledgePoints?[{code, role}], feedback?, gradeSummary?, nextRecommendation?`
- **出参 201**：`{ id, lessonNo }`；冲突 → 409 `课号 N 已存在`
- **SQL 涉及表**：`lessons`、`lesson_sections`、`vocabulary`（upsert）、`lesson_vocabulary`（upsert）、`lesson_exercises`（新建）、`study_records`（grade/feedback）
- **事务边界**：**单事务**，任一步失败整体回滚，不留半成品课
- **复杂度**：高（唯一需要跨 6 表写的地方）
- **注意**：`sectionType` 若采纳 S1（增 `objectives`、`expected_mistakes`），需先改表再改 `constants.js`（顺序不可反，见 5.4）

### 2.6 P1-1 · `GET /api/knowledge-points`（G3）

- **入参**：`?level=`（如 `Level 1`）、`?status=`
- **出参 200**：
```json
{ "code":200, "message":"success", "data": { "list": [
    { "code":"L1-04", "levelCode":"Level 1", "title":"一般现在时第三人称单数 -s",
      "status":"backfill", "reason":"错词本里有 Tom plays soccer，仍未过关" } ],
  "total": 1 } }
```
- **SQL 涉及表**：`knowledge_points`（字典，全局不带 `student_id`）、`lesson_knowledge_points`（每生覆盖状态）
- **初始数据来源**：`progress.md` 的「待补的 Level 1 知识点」7 条 —— 由 M2 迁移脚本导入，**不手工插**
#### 与快照 `backlog` 的映射（已与 skill-designer 定稿，2026-09-29）

**先纠正一处**：`knowledge_points` 目前**尚未建表**（仅存在于 `schema.full.design.sql` 设计稿），所以「是否落 `status` 列」是 **CREATE 时选不选这一列**，不是 ALTER、无迁移成本。结论如下。

**结论：不落 `status` 列，由 service 合成。** 理由：

1. `next` / `queued` / `done` 三个状态**全部可推导**，存一份 `status` 就是引入第二个真相源，需与 `lesson_knowledge_points` 长期同步，收益为负。
2. `untested` 无数据支撑（证据只在 `progress.md` 文本里），**首版恒 `[]` + `degradation`**，不编数据。
3. Skill 侧明确不把 `status` 当掌握度证据（诊断通过 ≠ 课堂掌握，掌握度走 Amy 的规则），因此**不需要持久化状态快照**。

**映射规则（service 层）**：

| `backfillQueue[].status` | 判定 |
|---|---|
| `next` | `is_backlog = 1` 且未完成，**`order_index` 最小**的那一项（队首） |
| `queued` | 其余未完成项，按 `order_index` 升序 |
| `done` | 已出现在 `lesson_knowledge_points`（`role='backfill'`） |
| `untested` | 首版恒 `[]`，附 `degradation.affected=["backlog.untested"]` |

**两条硬性约束**：

- **`planned` 绝不进补漏队列**：`planned` 是主干线上计划新授的知识点（`role='new'`，出现在 `LessonPlan.grammarPoint`），若混入补漏队列会导致一课出现两个语法点（Amy 明确禁止）。队列**只取 `is_backlog = 1`**。
- **`seq` 必须 ≥ 1**（契约 `minimum: 1`）：**不透传 `order_index`**，改用排序后的行号（`ROW_NUMBER()` 或遍历计数）从 1 开始编号，否则 schema 校验直接失败。

**`pendingKnowledgePoints[].reason` 的取值边界**：

| 取值 | 可否后端给出 | 依据 |
|---|---|---|
| `升级后未学` | ✅ 可给出 | `knowledge_points.level_code` 低于 `progress.current_level`，且未出现在任何 `lesson_knowledge_points` |
| `诊断未通过` | ⚠️ **md 有出处、库内没有** | `progress.md` 第 60—72 行有「**Level 1 待补点诊断结果（2026-09-27，10 题）**」表，10 项含「通过 / 部分通过 / 未掌握 / 本次未测」判定 —— 这是 `untested` 与 `reason='诊断未通过'` 的**现成出处**（如 `there is / there are` 未掌握、`a / an` 部分通过）。<br>**首版仍按约定留空**（该表未入库，引用它等于引用 md，与「Skill 只认对象」冲突）；若 Amy 认可它可作正式出处，则新增 `diagnostics` 表（或在 `knowledge_points` 加 `diagnosis_result` 列）后即可给出。**是否落库待 Amy / skill-designer 决定** |

`levelCode` 直接取 `knowledge_points.level_code`。

**历史欠账的处理（`done` 判定，Q12 已与 skill-designer 定稿）**：

`lesson_knowledge_points` 只有建表后的数据。若初始导入只写主干知识点（`role='new'/'review'`），**历史上已补过的补漏块仍无 `role='backfill'` 记录，会被误判为「未完成」并重新冒进队列** —— 后果是第 7 课起的 `backfillQueue` 会重复排出已补过的知识点。因此导入必须补 **3 条 `role='backfill'` 关联**（**[静态证据]** 逐条核对 `progress.md`「队列」段）：

| 补漏块 | 知识点 | 关联课 | md 原文依据 |
|---|---|---|---|
| 1 | `there is / there are`（含 `a / an` 规则） | 第 4 课 | 「第 4 课完成，已出队」 |
| 2 | `this / that / these / those` | 第 5 课 | 「第 5 课完成，已出队」 |
| 3 | `疑问词 what / who / where` | 第 6 课 | 「第 6 课完成，已出队」 |

补完后队列只剩编号 4 的 **`介词 on / at`**（`← 第 7 课`），即 `next`，与 Amy 的第 7 课规划一致。

**`is_backlog` 的取值边界（同样决定队列正确性）**：`is_backlog = 1` **只给「队列」里编号的 4 项**，不给 `progress.md`「待补的 Level 1 知识点」全部 7 项。依据 `progress.md` 的诊断结果表 —— `can`、`don't / doesn't`、`第三人称单数 -s`、`名词复数` 均已「通过 / 免修」，`Do / Does` 归为标点习惯，**都不该进补漏队列**；否则它们会以 `queued` 混进队列。

**队列顺序以 Amy 的编号队列为准，不以诊断结果为准**：`介词 on / at` 的诊断判定是「待测」而非「未通过」，但 Amy 已明确排进第 7 课（`← 第 7 课`）。因此 `next` 由「`is_backlog=1` 且未完成、`order_index` 最小」推导即可，**不得用诊断结果反推重排队列**。
- **复杂度**：中

### 2.7 P1-2 · 阅读统计（R1 / R7）

| 接口 | 入参 | 出参要点 | SQL 涉及表 |
|---|---|---|---|
| `GET /api/readings/stats` | `studentId` | `{ totalDays, pieceCount, wordCountTotal, byMonth:{}, lastReadDate, currentStreakDays }` | `readings` + `reading_pieces` |
| `GET /api/readings` | `page/size/from/to` | `{ list:[{date, pieceCount, titles[]}], total }` 按日期倒序 | 同上 |
| `GET /api/readings/:date` | 路径 `YYYY-MM-DD` | 篇目 + `paragraphs[{en,zh}]` + `questions[]` | 三表 |
| `POST /api/readings` | `ReadingSet` | 201 `{ id, date, pieceCount }`；同日已存在 → **409**（与「当天不覆盖」一致） | 三表单事务 |

- **取舍**：先建 `readings` + `reading_pieces` + `reading_questions` 三张完整表（与设计稿一致），**不做「先只建 readings」的简化** —— 因为 `reading.html` 需要段落级英中对照，二次拆表成本更高。
- **迁移源**：`read/YYYY-MM-DD-read.md` 已有 4 天真实数据，格式稳定（`## 第 N 篇 · 标题` / `级别：` / `来源：` / 英中对照行 / `生词注释：` / `理解题：`），**可解析**
- **复杂度**：中

### 2.8 P1-3 · G5 `studyMinutes`

- **接口侧**：`GET /api/lessons/:id` 与 `/api/lessons` 的返回体增 `studyMinutes`（当前返回 null）；`GET /api/study-records/stats` 增 `totalStudyMinutes`
- **表侧（待确认）**：
```sql
ALTER TABLE lessons ADD COLUMN study_minutes TINYINT UNSIGNED NULL COMMENT '本课时长（分钟）' AFTER exercise_count;
-- 影响范围：仅新增可空列。现有 6 行自动为 NULL；16 个已实现接口中 lessons 相关 4 个需各加 1 个返回字段（向后兼容）
-- 回滚：ALTER TABLE lessons DROP COLUMN study_minutes;（无依赖，秒级）
```
- **过渡**：在加列前，`POST /api/study-records` 先收 `payload.studyMinutes`，加列后由 service 同步写入 `lessons.study_minutes`
- **复杂度**：低

### 2.9 P1-4 · 增量拉取与 `size` 上限（前端 F2 / 后端 B3）

**问题**：`review/index.html` 用 `?size=100` 拉全量，后端 `maxSize=100`（`utils/response.js:35`）。课数超过 100 会**静默少显示**。（**2026-10-02 更新**：原生站已退役；Vue 版 `frontend/src/api.js` 改为**优先 `GET /lessons/all`、失败才回退分页** ⇒ 该风险**已消解**）

**方案（三步，按序做，互不阻塞）**：

| 步 | 做法 | 破坏性 | 说明 |
|---|---|---|---|
| 1 | 新增 `GET /api/lessons/all`（返回**精简字段**全量：`{list:[{id,lessonNo,lessonDate,levelCode,summary,vocabCount,exerciseCount,errorCount}], total}`，不受 100 限制） | 无 | 前端把 `?size=100` 换成 `/all`，**短期止血** |
| 2 | `maxSize` 由 100 放宽到 **500**，并在 `parsePaging` 保留上限保护 | 无（只会让原来 400 的请求变 200） | 兼容老调用 |
| 3 | 列表接口统一支持 `?updatedSince=<datetime>` 增量拉取 | 无 | 中长期；需 `updated_at` 上有索引 |

**不推荐**做 keyset 游标：课号本身就是天然有序键，`?afterLessonNo=N` 比游标更简单，若需要可加。**[推断]** 单用户场景下 3—5 年课数约 1000，全量拉取（精简字段）成本可接受。

- **SQL 涉及表**：`lessons`；`?updatedSince` 需 `KEY idx_lessons_updated(student_id, updated_at)`
- **复杂度**：低

### 2.10 P1-5 · 课程全文检索

**现状**：`lesson.repository.js:15` 只做 `l.summary LIKE ? OR l.grammar_point LIKE ?`。

**分两阶段**：

- **阶段 1（零 DDL，推荐先做）**：把搜索面扩到小节正文与词汇
```sql
-- 草案：命中任一处即返回，并给出命中位置
SELECT DISTINCT l.id, l.lesson_no, l.summary
FROM lessons l
LEFT JOIN lesson_sections  s  ON s.lesson_id  = l.id
LEFT JOIN lesson_vocabulary lv ON lv.lesson_id = l.id
LEFT JOIN vocabulary        v  ON v.id = lv.vocabulary_id
WHERE l.student_id = ?
  AND ( l.summary LIKE ? OR l.grammar_point LIKE ?
     OR s.content_md LIKE ? OR v.word LIKE ? OR v.meaning LIKE ? );
```
  影响：**[已实测]** `lesson_sections` 当前只有 12 行且只有 2 类，阶段 1 的收益要等 M2 补数据后才显现 —— **顺序上先迁移、再谈检索**。
- **阶段 2（可选 DDL）**：MySQL 8 InnoDB FULLTEXT
```sql
CREATE FULLTEXT INDEX ft_lesson_summary ON lessons (summary, grammar_point);
CREATE FULLTEXT INDEX ft_section_content ON lesson_sections (content_md) WITH PARSER ngram;
-- 中文混排正文用 ngram parser；纯英文摘要用默认 parser 即可
-- 回滚：DROP INDEX ft_lesson_summary ON lessons; DROP INDEX ft_section_content ON lesson_sections;
```
  **[未验证]** ngram parser 在中英混排下的检索质量未实测；**建议阶段 1 先上线，阶段 2 视数据量（>500 课）再评估**。
- **接口形态**：`GET /api/lessons?q=`（现接口扩面，**不改签名**）；若需跨实体统一搜索再加 `GET /api/search?q=&types=lesson,vocab,mistake`（P2）
- **复杂度**：中

### 2.11 Amy 教学侧需求 N1—N9 的映射（2026-09-29 收到）

| 编号 | 需求 | 与本方案的对应关系 | 优先级 | 阻塞依赖 |
|---|---|---|---|---|
| **N5** | `GET /api/knowledge-points`（含 status/role） | **= P1-1（2.6）** ✅ 已排 | P1 | `knowledge_points` 建表 |
| **N6** | `GET /api/agent/snapshot` + `next_recommendation` | **= P0-4（2.4）+ P0-3（2.3）** ✅ 已排 | P0 | 无（缺值降级） |
| **N8** | DQ1 / DQ2 / DQ5 数据修复 | 见下方「N8 三条」 | P0 | 部分需 Amy 确认 |
| — | 写接口（连续答对 2 次过关无法成立） | **= P0-1 / P0-2 / P0-5 / P0-6** ✅ 已排 | P0 | 部分需建表 |
| **N1** | `error-trend.byLesson[].byType` | **上调至 P0**，且**不需等建表** —— 见下方「N1 的提前实现路径」 | **P0** | Amy 写入 `payload.byType` |
| **N2** | 错词复发明细 | **新增** `GET /api/mistakes/:id/events`（2.12） | P0 | `mistake_events` 建表 |
| **N4** | `GET /api/lessons/:id/exercises` | **新增**（2.12） | P0 | `lesson_exercises` 建表 |
| **N7** | `GET /api/readings` + `/:date` | **= P1-2（2.7）** ✅ 已排 | P1 | `readings` 建表 |
| **N3** | 词汇复现度 | P2，待 N2/N4 落地后再评估 | P2 | — |
| **N9** | `progress` 增 `daysSinceLastClass` | **采纳，零成本** —— service 用 `last_class_date` 现算，不落库；`last_class_date` 为 null 时返回 `null` | P2（可随手写） | 无 |

**N8 三条的现状与阻塞**：

| 项 | 现状 | 阻塞 |
|---|---|---|
| DQ1（20 vs 19） | **根因已实测定位** = `mistakes.id=19` 非错题记录误入（详见 4.2） | **需 Amy 确认删除**（已发，待回） |
| DQ2（`wrong_text` 混入批注） | 建议加 `mistakes.note VARCHAR(255) NULL` 承载批注，让 `wrong_text` 只存错误形式 | **需 Amy 确认清洗文案**（6.2-2） |
| DQ5（`lastReviewedAt` 全 null） | **无需单独修** —— `POST /api/mistakes/:id/review`（P0-1）实现后每次复习都会写入，自然修复 | 随 P0-1 |

**N1 的提前实现路径（不必等 `mistake_events`）**：

`byType` 是 Amy 区分「没听懂」与「听懂了写错」的核心依据，本方案原计划等 `mistake_events` 建表后聚合，**现上调为 P0 并给出不依赖建表的路径**：

1. `LessonRecord.gradeSummary.byType` 已在契约中定义 → Amy 提交批改时写入 `study_records(record_type='grade').payload.byType`（如 `{grammar:2, punctuation:1}`）。
2. 后端 `GET /api/lessons/error-trend` 与快照 `errorTrend` 从该 payload 读出 `byType` 一并返回。
3. **实测**：现有 6 条 `grade` 记录的 payload 只有 `{lessonNo, errorCount, exerciseCount}`，**无 `byType`** → 历史数据取不到，需等新的批改写入后才有效；历史段返回时省略 `byType` 并计入 `degradation`。
4. `mistake_events` 建表后，改为按事件聚合，可与 payload 互为校验。

### 2.12 因 Amy 的 N2 / N4 新增的两个接口

| # | 接口 | 入参 | 出参要点 | SQL 涉及表 | 复杂度 |
|---|---|---|---|---|---|
| 1 | `GET /api/mistakes/:id/events`（N2） | 路径 `id`；`?limit=`（默认 50） | `{ list:[{ eventId, result:'wrong'\|'correct', lessonNo, createdAt }], total }`，按时间**升序**（便于看复发曲线） | `mistake_events` ⋈ `lessons` | 低 |
| 2 | `GET /api/lessons/:id/exercises`（N4） | 路径 `id` | `{ list:[{ exerciseNo, exerciseType, prompt, referenceAnswer, userAnswer, isCorrect, errorNote, targetPoint }], summary:{ exerciseCount, correctCount, byType } }` | `lesson_exercises` | 低 |

**取舍说明**：N2 同时提了「在 `pendingMistakes[]` 里直接带 `events`」的做法，**本方案不采用** —— 快照的 `pendingMistakes` 常有 15+ 条，每条内嵌事件数组会让 payload 膨胀且难以缓存；改为独立接口按需取，快照保持轻量。若 Amy 确实需要在快照里看到复发次数，`wrongCount` 已经是现成的聚合值；需要明细时再按 `mistakeId` 单独查。

### 2.13 前端侧需求 FE-1—FE-4 与遗留问题 D1—D3 的答复（2026-09-29 收到）

#### FE-1 · `GET /api/lessons/:id/exercises` 的字段定名

**接口已排（P0，见 2.12）**。字段名与 fe-dev 提议的差异如下 —— **以契约已有名为准，不改契约**：

| fe-dev 提议 | 本方案采用 | 理由 |
|---|---|---|
| `verdict` | **`isCorrect`**（`boolean \| null`，null=未批改） | `lesson-record.schema.json` 的 `ExerciseRecord.isCorrect` 已是此名 |
| `errorNote` | `errorNote` ✅ 同名 | 契约已有 |
| `errorType` | **采纳，新增列** `lesson_exercises.error_type` | 契约 `ExerciseRecord` 里没有，但批改归因确实需要；**复用 `mistakes.error_type` 同一套 ENUM**（`constants.js` 已定义，同源不漂移） |
| `revisedFull`（开放题完整改后版） | **采纳为 `revisedAnswer TEXT NULL`** | 契约里没有，**需 skill-designer 在 `lesson-record.schema.json` 加该 optional 字段**（加字段不升版本）。若他不采纳，退化为把改后版放入 `referenceAnswer` |

其余沿用 2.12 已定：`exerciseNo / exerciseType / prompt / referenceAnswer / userAnswer / targetPoint`。

#### FE-2 · `selfChecks` 与 `expectedMistakes` 落哪

**`selfChecks`：建议不建存储（[静态证据]）**。`progress.md` 的「每课开场固定检查（书写规范）」五条是**全局固定常量**（句首字母大写 / 句号后空一格 / 人名地名大写 / 逗号不能直接连接两个完整句子 / 疑问句结尾打问号），**不是每课变化的内容**。放 `constants.js` 或一个只读配置接口即可，不必进 `lesson_sections`。若 Amy 确认将来要每课定制，再走新增 `section_type`。

**`expectedMistakes`：与已讨论的 S1 `expected_mistakes` 是同一个东西**，可合并处理。两个方案：

| 方案 | 做法 | 代价 |
|---|---|---|
| A（推荐） | 新增 `section_type` 枚举值 `expected_mistakes` + `objectives`，正文存 `lesson_sections.content_md` | 一次 ENUM 变更（**顺序：先改表 → 再改 `constants.js` → 最后同步 `common.schema.json`**，见 5.4） |
| B | 新建 `lesson_expected_mistakes` 结构化表 | 多一张表；但可结构化关联 `mistakes.id`，便于「预判是否命中」的统计 |

**倾向 A**：与既有小节机制一致、改动面小；结构性需求（如统计预判命中率）出现时再升级为 B。

#### FE-3 · `/api/vocabulary` 增 `wasMistake` —— **首版不给**

**[已实测]** 用「错词文本 ↔ 词汇 word」做匹配的验证结果：**20 条错词有 15 条能文本匹配到某个词，但语义错误率高**，例如：

- `Tom plays soccer`（错在第三人称单数 -s）→ 匹配到单词 **play** ❌
- `Do you like coffee?`（错在疑问句缺问号）→ 匹配到单词 **like** ❌

即：**文本匹配给出的 `wasMistake` 会是假数据**，会误导学生。因此首版**不提供该字段**，前端按 fe-dev 所说留占位、不报错。

可行路径（待 Amy 决定）：给 `mistakes` 加可空 `vocabulary_id`，由批改时**显式关联**；历史 20 条需 Amy 补标注，未标注的不显示。属 P2 增强，不阻塞。

#### FE-4 · `/api/readings` 判断「当天是否已生成」 —— **够用，无需新增接口**

- `GET /api/readings` 按日期**倒序**，取首条 `date` 比对今天 —— **可行** ✅
- 更直接的做法：`/api/readings/stats` 已含 **`lastReadDate`**，前端比 `lastReadDate === 今天` 即可，**零新增接口**
- 后端**不加** `hasToday` 之类的显式字段（那是派生值，与「看板统计实时算、不存冗余副本」的既定原则一致）
- `POST /api/readings` 同日返回 **409** 的语义确认成立：它是**兜底**，前端提交前先查列表避免 409 的用法正确

#### 遗留问题 D1—D3

| # | 问题 | 答复 |
|---|---|---|
| **D1** | `levelCode` vs `level` | `/api/lessons`（含 `/lessons/all`）继续用 **`level`**；**只有 `GET /api/agent/snapshot` 按 schema 输出 `levelCode`**。现有 16 个接口字段名不动 |
| **D2** | `/lessons/all` 缺 `grammarPoint` | **采纳，补上**。`GET /api/lessons/all` 字段调整为：`id / lessonNo / lessonDate / level / summary / grammarPoint / vocabCount / exerciseCount / errorCount / feedback`（即与 `/api/lessons` 列表字段一致，仅不受 `size` 上限约束） |
| **D3** | 阅读篇数取 `pieceCount` 还是 `totalDays` | 看板「阅读篇数」取 **`GET /api/readings/stats` 的 `pieceCount`**（累计篇数）；`totalDays` 是阅读天数，语义不同 |

---

## 三、Skill / 前端契约对齐（字段级映射）

> 原则：**契约对象名不绑定表名**。契约里的 `courses` / `exercises` 是业务概念；库表用现有前缀体系。映射由 **service 层适配层**完成，Skill 与前端只认契约。

### 3.1 `AgentSnapshot` → 库表

| 契约字段 | 库表.列 | 状态 |
|---|---|---|
| `deploymentMode` | 无（后端固定返回 `"backend"`） | ✅ 合成 |
| `progress.currentLevel` | `progress.current_level` | ✅ |
| `progress.currentCourseNo` | `progress.current_lesson_no`（**与 `lessons` 最大课号取大者**） | ✅ 字段名不同，适配层映射 |
| `progress.lastFeedback` / `easyStreak` / `upgradeFrozenUntil` / `lastClassDate` | `progress.*` 同名 | ✅ |
| `courseCatalog[].lessonNo/lessonDate/levelCode/summary` | `lessons.lesson_no/lesson_date/level_code/summary` | ✅ |
| `recentLessons[].grammarPoint` | `lessons.grammar_point` | ✅ |
| `recentLessons[].vocabulary[]` | `lesson_vocabulary` ⋈ `vocabulary.word` | ✅ |
| `recentLessons[].errorCount` | `lessons.error_count` | ✅ |
| `recentLessons[].mistakeCount` | `COUNT(mistakes WHERE first_lesson_id=?)` | ✅ 可聚合 |
| `pendingMistakes[]` | `mistakes`（复用 `mapMistake`，含 `derivePriority`） | ✅ |
| `pendingMistakes[].firstCourseNo/lastCourseNo` | `mistakes.first_lesson_id/last_lesson_id` → `lessons.lesson_no` | ✅ 字段名不同 |
| `errorTrend.byLesson[]` | `lessons.lesson_no/error_count/lesson_date` | ✅ |
| `errorTrend.byLesson[].byType` | **无**（需 `mistake_events`） | ❌ 待建表 |
| `backlog` | **无**（需 `knowledge_points`） | ❌ 待建表 |
| `lastIncomplete` | **无列**（用 `study_records.payload`） | ⚠️ 依赖写入约定 |
| `readingCatalog` | **无**（需 `readings`） | ❌ 待建表 |
| `lastRecommendation` | **无列**（用 `study_records.payload.next_recommendation`） | ⚠️ 依赖写入约定 |

### 3.1.1 快照契约分歧：Amy 要的 2 个字段 schema 里没有（**已提交 skill-designer**）

`backend/docs/06-api-requirements-amy.md` R1 要求快照返回 `lastRecommendation` 与 `pendingMistakeStats`，但 `docs/schemas/agent-snapshot.schema.json` 的 `properties` 中**两者均未定义**。按 `docs/schemas/README.md` 的演进规则，新增可选字段属**向后兼容变更、不升版本**，因此处置建议：

| 字段 | 谁要 | 处置建议 | 数据来源 |
|---|---|---|---|
| `lastRecommendation` | Amy（R1） | **建议加入 schema，optional** | `study_records(record_type='feedback').payload.next_recommendation` 最近一条 |
| `pendingMistakeStats` | Amy（R1） | 建议加入 schema，optional；或由 `pendingMistakes.length` + 客户端聚合替代 | `mistakes` 按 `error_type` 分组计数 |

**字段名与形状（已与 skill-designer 定稿，2026-09-29）**：

- 用 **`pendingMistakeStats`**（单数 `Mistake`），与 `06-api-requirements-amy.md:79` 一致。此前沟通中出现过 `pendingMistakesStats` 的写法，**以单数为准，作废**。
- `lastRecommendation` 形状为对象 `{ lessonNo, text } | null`（不是纯字符串）。
  payload 里存的是字符串 `next_recommendation`，由 service 层合成 `{ lessonNo: <该记录的 lessonNo>, text: next_recommendation }`；无记录时返回 `null`。
- `pendingMistakeStats` 形状为 `{ total, byType }`，`byType` 为 `errorType → count` 的映射（复用 `/api/mistakes/stats` 的口径，`byType` 只统计 `status='pending'` 的条目）。

> 两个字段均为 optional、不升版本；后端照此返回，Skill 侧「忽略未知字段」不受影响。

### 3.2 `LessonRecord` → 库表

| 契约字段 | 库表.列 | 状态 |
|---|---|---|
| `lessonNo` / `lessonDate` / `levelCode` / `summary` / `sourceFile` / `status` | `lessons.*` | ✅ |
| `studyMinutes` | **无列** | ❌ 待加列（G5） |
| `sections[].sectionType/contentMd/orderIndex` | `lesson_sections.*` | ✅（`objectives`、`expected_mistakes` 两个枚举值待 S1） |
| `vocabulary[]` | `vocabulary`（upsert）+ `lesson_vocabulary.example/is_new/order_index` | ✅ |
| `exercises[]` | **无表** | ❌ 待建 `lesson_exercises` |
| `exercises[].targetPoint` | 设计稿 `exercises` 也无此列 | ❌ 建表时新增 `target_point VARCHAR(64)` |
| `knowledgePoints[].code/role` | **无表** | ❌ 待建 `lesson_knowledge_points` |
| `feedback.*` | 由 `POST /progress/feedback` 的**响应**合成，不落单列 | ✅ 合成 |
| `gradeSummary` | `study_records(record_type='grade').payload` | ✅ |
| `nextRecommendation` | `study_records(record_type='feedback').payload` | ✅ |
| `skillRunIds` | **无表** | ❌ 待建 `skill_runs`（P2） |

### 3.3 其余契约

| 契约 | 主要落点 | 状态 |
|---|---|---|
| `LessonPlan` | **无表**（课内中间对象，不落库） | ✅ 设计如此 |
| `TeachingBlock` | `lesson_sections(section_type='grammar'\|'vocab_table')` + `vocabulary` | ✅；`expectedMistakes` 需 S1 才有结构化落点，否则并入正文 |
| `ExerciseSet` | `lesson_exercises` | ❌ 待建表 |
| `GradingResult` | `lesson_exercises.user_answer/is_correct/error_note` | ❌ 待建表 |
| `MistakeAnalysisResult` | `mistakes` + `mistake_events` | ❌ 待建 `mistake_events` |
| `ReviewSession` | `mistake_events`（`outcomes[]` 逐条走 `/mistakes/:id/review`） | ❌ 待建表 |
| `ProgressReport` | 由 `study_records(grade)` + `lessons` 聚合，**无独立表** | ✅ 设计如此 |
| `ReadingSet` | `readings` + `reading_pieces` + `reading_questions` | ❌ 待建 3 表 |
| `SkillRun` | `skill_runs`；`parentSkillRunId` 需新增列（S2） | ❌ 待建表 |

### 3.4 需与 skill-designer 确认的 3 处命名差异（**不改契约，只做映射**）

1. `currentCourseNo` ↔ `current_lesson_no`（字段名不同，语义一致）
2. `firstCourseNo/lastCourseNo` ↔ `first_lesson_id/last_lesson_id`（契约用课号，库里是 ID）
3. `exercises` 表名 → 实际用 `lesson_exercises`（契约对象名不变）

---

## 四、迁移与回滚（M2）

### 4.1 三阶段流水线（延续 `04-migration-and-roadmap.md`，不重写解析器）

```
notes/*.md  read/*.md  wrong-words.md  progress.md
      │
      ▼  ① export_md_to_json.py   —— 复用 build_board.py 的纯解析函数，只读 md，不写任何文件
  db/_snapshot.json（.gitignore 已忽略，不入版本库）
      │
      ▼  ② import_json.js --dry-run  —— 只解析与校验，输出将要变更的行数，不写库
  校验报告（课数 / 词数 / 错词数 / 阅读篇数 对照 INDEX.md）
      │
      ▼  ③ import_json.js          —— 单事务 + 幂等 upsert
    MySQL
```

### 4.2 幂等键设计（成败关键）

| 表 | 业务唯一键 | 现状 |
|---|---|---|
| `lessons` | `uk_lessons_no(student_id, lesson_no)` | ✅ 已有 |
| `lesson_sections` | `uk_section(lesson_id, section_type)` | ✅ 已有 |
| `vocabulary` | `uk_vocab_word(student_id, word)` | ✅ 已有 |
| `lesson_vocabulary` | `uk_lesson_vocab(lesson_id, vocabulary_id)` | ✅ 已有 |
| `readings` | 新增 `uk_reading_day(student_id, read_date)` | 建表时带 |
| `reading_pieces` | 新增 `uk_piece(reading_id, piece_no)` | 建表时带 |
| **`mistakes`** | **缺！** 需新增函数唯一索引 | ❌ **DQ1 根因** |
| `knowledge_points` | `uk_kp_code(code)` | 建表时带 |

```sql
-- 候选（待确认，未执行）：为 mistakes 增加业务判重键
-- 判重键 = 规范化 correct_text + error_type，与 mistake-analysis 的判重规则一致
ALTER TABLE mistakes
  ADD COLUMN dedup_key CHAR(32)
      GENERATED ALWAYS AS (MD5(CONCAT(LOWER(TRIM(correct_text)), '|', error_type))) VIRTUAL;
CREATE UNIQUE INDEX uk_mistakes_dedup ON mistakes (student_id, dedup_key);

-- 前置校验（必须先跑，否则建索引会失败）：
SELECT LOWER(TRIM(correct_text)) ct, error_type, COUNT(*) c, GROUP_CONCAT(id) ids
FROM mistakes GROUP BY ct, error_type HAVING c > 1;

-- 回滚：DROP INDEX uk_mistakes_dedup ON mistakes; ALTER TABLE mistakes DROP COLUMN dedup_key;
```

**前置校验已跑（[已实测] 2026-09-29）**：`HAVING c > 1` 返回 **空结果集** —— 库内**不存在** `correct_text + error_type` 重复的行，因此 `uk_mistakes_dedup` **可以直接建，不会被重复行卡住**。原 6.1 的 R-3 风险据此降级。

**DQ1 的真实根因也已定位（[已实测]）**：不是重复插入，而是 **1 条非错题记录误入**。对照结果：

```
md（wrong-words.md 表体）19 行 = 已过关 4 + 未过关 15
DB（mistakes）          20 行 = passed   5 + pending 15
差异全部落在「已过关/passed」，多出的一条是：
  id=19  wrong_text="I was busy yesterday.（翻译题「我昨天很忙」正确）"
          correct_text="—"  error_type="other"  streak=1  wrong_count=0  status="passed"
```

- 该行 `correct_text="—"`、`wrong_count=0`，**在语义上不是错题**，正是 Amy 在 `wrong-words.md` 头部注明「并删除一行非错题记录」的那一行 —— **md 侧已删，DB 种子未同步**。
- 它同时解释了 DQ1 提到的「`byType` 多出 `other=1`」（`other` 类型全库仅此 1 条）。
- **修法**（需 Amy 确认后执行，非 DDL）：删除 `id=19`；并在迁移脚本中加规则 —— `correct_text` 为占位符（`—` / `-` / 空）或 `wrong_count=0` 的行**不导入**。
- 备选（若不愿物理删除）：新增 `mistakes.is_active TINYINT(1) DEFAULT 1`，软删除并让所有查询带 `is_active=1`。代价是每个查询都要加条件，**本方案倾向物理删除 + changelog 留痕**（该行无外键依赖，`mistake_events` 尚未建表）。

### 4.3 `deploymentMode` 切换如何不影响调用方

| 保障 | 做法 |
|---|---|
| **契约形状不变** | 后端 `GET /agent/snapshot` 的 `data` 严格对齐 `docs/schemas/agent-snapshot.schema.json`；md 适配层产出**同一个 schema 的实例** |
| **字段只增不减** | 后端新增字段一律可选；Skill 按契约「必须忽略未知字段」，不会因后端多返回而报错 |
| **降级显式化** | 后端缺数据时返回 `null`/`[]` 并附 `degradation{degraded:true, reason, affected}`，**绝不 500** |
| **切换前双跑对照** | 同一天同时由 md 适配层与 API 各产一份 `AgentSnapshot`，逐字段 diff；**一致才切**，不一致即视为设计缺陷（对齐 `docs/skills.md` 7.2 的验收口径） |
| **可回退** | `deploymentMode` 只是一个字段值；切回 `markdown` 无需回滚数据库 |

### 4.4 回滚策略

| 层 | 回滚方式 |
|---|---|
| 代码 | `git revert` 对应提交；新接口为**纯新增**，删除不影响既有 16 个 GET |
| 数据（迁移） | 导入在**单事务**内，失败整体回滚；导入前先 `mysqldump` 快照 |
| 数据（加列） | `ALTER TABLE ... DROP COLUMN`，无外键依赖，秒级 |
| 数据（建表） | `DROP TABLE`（新表无上游依赖）；已写入数据先 dump |
| 全库 | `npm run db:reset` + `mysqldump` 恢复（**危险操作，需 git-manager 提醒先提交**） |

---

## 五、非功能设计

### 5.1 事务边界

| 场景 | 边界 | 说明 |
|---|---|---|
| `POST /api/lessons`（归档） | **单事务**跨 6 表：`lessons → lesson_sections → vocabulary → lesson_vocabulary → lesson_exercises → study_records` | 任一步失败整课回滚，不留半成品 |
| `PUT /api/lessons/:id`（回填批改） | 单事务：`lesson_exercises` + `lessons.error_count` + `study_records(grade)` | |
| `POST /api/mistakes/:id/review` | 单事务 + `SELECT ... FOR UPDATE` 行锁 | 防止并发复习丢更新 |
| `POST /api/mistakes/review-batch` | **单事务**，部分失败整批回滚 | 与 Amy「一次复习判 3—5 条」一致 |
| `POST /api/progress/feedback` | 单事务：`progress` + `lessons.feedback` + `study_records` | 级别与连击必须原子 |
| `POST /api/readings` | 单事务跨 `readings` 3 表 | |
| **所有 GET** | **不加事务** | 读多写少，快照内多个查询用 `Promise.all` 并行 |
| 迁移导入 | **单个大事务**（`04-migration-and-roadmap.md` 已定） | 失败不留半成品 |

### 5.2 幂等

| 接口 | 幂等手段 |
|---|---|
| `POST /api/lessons` | `lessonNo` 唯一键 → 冲突 409**或** 带 `?upsert=true` 走 `ON DUPLICATE KEY UPDATE` 变为幂等重放 |
| `POST /api/mistakes` | 判重键 `dedup_key`（见 4.2）→ 命中则累加 `wrong_count` 而非新建 |
| `POST /api/mistakes/:id/review` | **天然非幂等**（会累加）→ 用 `clientEventId` + `uk_me_client(client_event_id)` 去重；不带该字段时按「一次请求一次生效」 |
| `POST /api/progress/feedback` | 按 `(student_id, lesson_no)` 唯一约束 `lesson_feedback`，重复提交返回首次结果 |
| `POST /api/readings` | `uk_reading_day(student_id, read_date)` → 重复 409 |
| 迁移脚本 | 全部 `ON DUPLICATE KEY UPDATE`，重复运行结果一致 |

### 5.3 索引建议（**[已实测]** 现有索引基础上）

现有索引核对结果（本机实查 `information_schema.STATISTICS`）：

| 发现 | 处置 |
|---|---|
| **`vocabulary` 上 `uk_vocab_word(student_id, word)` 与 `idx_vocab_prefix(student_id, word)` 列完全相同** | **冗余索引**，建议删 `idx_vocab_prefix`（前缀查询由 uk 的最左列承担）。**影响**：仅删索引，不改数据；回滚 = 重建索引 |
| `mistakes` 只有 `(student_id,status)` 与 `(student_id,error_type)` | 待复习排序要按 `wrong_count DESC, updated_at ASC`，建议增 `idx_mistakes_pending(student_id, status, wrong_count DESC, updated_at)` |
| `lesson_sections` 无 `lesson_id` 单列索引 | 已有 `uk_section(lesson_id, section_type)` 最左列覆盖，**无需新增** |
| `study_records` 为 `(student_id,created_at)` 与 `(student_id,record_type)` 两个索引 | 建议合并为 `idx_sr_type_time(student_id, record_type, created_at)`（快照按类型取最近一条） |
| `lessons` 无 `updated_at` 索引 | 做 `?updatedSince` 增量拉取时再加 |

> 数据量判断 **[推断]**：单用户 3—5 年约 1000 课 / 1 万词 / 数千条记录，当前索引体系完全够用；**新增索引以「避免全表扫」为度，不做过度优化**。

### 5.4 枚举同源铁律

`src/constants.js` 与 `schema.sql` 的 ENUM 必须一一对应。**改枚举的顺序不可颠倒**：

1. 先 `ALTER TABLE` 改 ENUM（如 S1 增 `objectives`、`expected_mistakes`）
2. 再改 `src/constants.js` 的 `SECTION_TYPE`
3. 最后同步 `docs/schemas/common.schema.json`

反序会导致「代码接受、库拒绝」的 500。**S1 的两个枚举值目前未采纳，采纳时按此顺序执行。**

### 5.5 备份策略（学习记录长期保存与可恢复）

| 项 | 方案 |
|---|---|
| 备份命令 | `mysqldump --single-transaction --routines --triggers --default-character-set=utf8mb4 english_platform > backup/english_platform-YYYYMMDD.sql` |
| 频率 | 每次上课归档后（可由 `daily-lesson` 第 11 步触发）+ 每日定时 |
| 保留 | 近 7 天每日 + 近 12 周每周 + 近 12 月每月 |
| 存放 | 仓库外目录（如 `E:\English-Backup\`），**不入 Git**；`.gitignore` 已忽略 `db/_snapshot.json`，需补备份目录 |
| 只增不删 | 现有外键删除策略统一 `RESTRICT` **[静态证据]**，学习数据不会被级联误删；写接口**不提供 DELETE** |
| 恢复演练 | 每季度一次：dump → 新库 `english_platform_restore` → 恢复 → 抽样比对行数与最近一课内容。**[未验证]** 尚未演练过 |

---

## 六、风险与未决问题

### 6.1 风险登记

| # | 风险 | 影响 | 缓解 | 状态 |
|---|---|---|---|---|
| **R-1** | **DQ1（错词 20 vs md 19）** | Amy 的错词计数与本地记录不一致，教学判断失真 | **根因已实测定位**：多出的 1 条是 `id=19` 的非错题记录（详见 4.2），非重复插入。修法 = Amy 确认后删除该行 + 迁移脚本加「非错题不导入」规则。**`mistakes` 无业务唯一键仍是隐患**（无唯一键 → 迁移只能靠应用层判重），需建 `dedup_key` | **[已实测]** 根因与重复校验均已跑 |
| **R-2** | **N1：`lesson_sections` 只有 2 类共 12 条** | 课程详情页内容不全；全文检索无正文可搜 | M2 迁移补全 6 类小节；**检索优化排在迁移之后** | **[已实测]** |
| **R-3** | ~~`mistakes` 建函数唯一索引时若有重复行会失败~~ | — | **已解除**：重复判重校验返回空结果集，索引可直接建（见 4.2） | **[已实测]** 风险已降级 |
| **R-4** | `lesson_exercises` / `mistake_events` / `knowledge_points` / `readings` 集中建表，DDL 变更面大 | 一次性改动多 | 按 1.8 的优先级**分批建表、逐批提交**，每批独立可回滚 | **[推断]** |
| **R-5** | `payload` JSON 无 schema 约束，键名易漂移 | `lastRecommendation` / `studyMinutes` 取不到 | 2.3 的键白名单 + 入库校验；快照取不到时返回 `null` 并标 `degradation` | **[推断]** |
| **R-6** | 契约用 `courseNo`，库里是 `lesson_no`，多处需映射 | 适配层出 bug 会导致课号错位 | 3.4 列出全部 3 处差异，映射集中在 service 层一处 | **[静态证据]** |
| **R-7** | `docs/backend-analysis.md:188-189` 仍写着 `/api/v1` 与 `{success,data,meta}` 旧包络 | 新读者按旧文档对接会全错 | **已作废**：以 `05-api-reference.md` 为准（成功 `{code,message,data}`、失败 `{code,message,data:null}`、前缀 `/api`）。建议由 git-manager 或文档owner 在该文件顶部加作废标注 | **[静态证据]** |
| **R-8** | 加列 / 建表属数据库迁移 | 按 `AGENTS.md` 3.5，需提醒 git 提交 | 每次 DDL 前先提交当前可运行版本 | — |

### 6.2 未决问题（需确认后才能动手）

1. **是否采纳 S1**（`section_type` 增 `objectives`、`expected_mistakes`）？→ 需 skill-designer 确认是否真的需要结构化查询；不需要则维持现状。
2. **`mistakes.note` 是否加列**？还是只规范写入内容、不动表？→ 需 Amy 确认（DQ2）。
3. **`lessons.study_minutes` 现在加列还是先用 `payload` 过渡**？→ 本方案推荐先过渡，需 Amy / skill-designer 确认口径（手工填 vs 上下课时间差）。
4. **G4 `lastIncomplete` 用方案 A（payload 约定）还是 B（planned 课）**？→ 本方案推荐 A，需 skill-designer 确认。
5. **`size` 上限放宽到 500 是否需要与 fe-dev 对齐**？→ 前端 F2 修复与本方案 2.9 需同步。
6. **是否建 `levels` 字典表**？→ 本方案建议**不建**（用 `constants.js`），需确认。
7. **是否保留单用户**？→ 现有全部接口支持 `?studentId=`，多用户已预留；若确认永久单用户，可简化但**不建议现在动**。

### 6.2.1 项目负责人裁决记录（2026-09-29，已批复）

| # | 事项 | 裁决 | 对方案的影响 |
|---|---|---|---|
| ③ | S1：`section_type` 增 `objectives` / `expected_mistakes` | **批准执行** | 与 FE-2 的 `expectedMistakes` 合并为**一次 ENUM 变更**。顺序：先改 `schema.sql` 与库内 ENUM → 再改 `src/constants.js` → 最后通知 skill-designer 同步 `common.schema.json`（反序会造成「代码接受、库拒绝」的 500） |
| ③b | 「每课开场固定检查」是否建存储 | **采纳不建存储**，放后端常量 | 确认其为全局常量而非每课内容（2.13 FE-2） |
| ④ | `revisedAnswer`（开放题完整改后版） | **批准入契约** | `lesson_exercises` 加 `revised_answer TEXT NULL`；由 skill-designer 补进 `grading-result.schema.json` 的 optional 字段，不升版本。理由：`referenceAnswer` 是标准答案、`revisedAnswer` 是学生作答的修正版，语义不同，不可合并 |
| ⑤ | 2026-09-27 诊断结果表是否入库 | **不入库**，保留在 `progress.md` | 一次性快照会与错词本冲突（诊断判「三单 -s 通过」但 `Tom plays soccer` 至今未过关）。将来若要结构化，只能建独立 `diagnostics` 表带 `diagnosed_at` / `superseded`，**冲突时以错词本为准** |
| — | FE-3 `wasMistake` | **采纳拒绝** | 首版不提供。**约束：`vocabulary_id` 关联必须由 Amy 在批改时判定，不得用文本匹配自动生成** |
| — | 字段名 | **采纳** | 批改结论用 `isCorrect`（驳回新造字段）；`errorType` 复用 `mistakes` 同一套 ENUM |

**DDL 执行时机**：删 `mistakes.id=19` 与建表，均**等 git-manager 报告 push 完成后**执行。S1 的 ENUM 变更属同类 DDL，**同批执行**（已向 team-lead 确认此理解；若要求立即执行则另行通知）。

### 6.3 对其他 Agent 的影响

| Agent | 需要它做什么 |
|---|---|
| **fe-dev** | ① `?size=100` → `GET /api/lessons/all`（2.9 步骤 1，可立即做）<br>② 阅读页等 `GET /api/readings`（P1-2，需先建表）<br>③ 词汇口径 51 vs 52 在看板对齐（DQ3） |
| **skill-designer** | ① 3.4 三处命名映射确认<br>② S1 是否需要（6.2-1）<br>③ G4 方案 A/B 确认（6.2-4）<br>④ 快照缺字段时按 `degradation` 降级，不得 500 |
| **amy** | ① DQ1 重复错词保留哪一条（R-1/R-3）<br>② DQ2 `mistakes.note` 清洗文案<br>③ `study_minutes` 口径（6.2-3）<br>④ 写 `study-records` 时务必带 `payload.nextRecommendation`（N2） |
| **git-manager** | ① 每次 DDL / 建表前提醒提交<br>② `docs/backend-analysis.md` 旧包络作废标注（R-7）<br>③ `.gitignore` 补备份目录（5.5） |

### 6.4 本次未做的验证（明确列出，不声称通过）

| 项 | 状态 |
|---|---|
| 库表现状、行数、索引、DQ1 根因、`mistakes` 重复判重校验 | **[已实测]** 本次只读实跑完成 |
| 所有 DDL（`ALTER` / `CREATE TABLE` / `CREATE INDEX`） | **[未验证]** 未执行，仅为候选 |
| 删除 `mistakes id=19` | **[未验证]** 需 Amy 确认后才执行 |
| 全部新接口的联调 | **[未验证]** 无代码 |
| ngram FULLTEXT 在中英混排下的检索质量 | **[未验证]** |
| 备份恢复演练 | **[未验证]** |
| 双跑对照（md 适配层 vs API 产出同一 snapshot） | **[未验证]** 需 skill-designer 适配层就绪后做 |

---

## 附：接口清单速查（新增部分，均为 `/api` 前缀）

```
读
GET  /api/agent/snapshot?recent=3&studentId=         P0-4
GET  /api/knowledge-points?level=&status=            P1-1
GET  /api/readings/stats                             P1-2
GET  /api/readings?from=&to=&page=&size=             P1-2
GET  /api/readings/:date                             P1-2
GET  /api/lessons/all                                P1-4
GET  /api/lessons/:id/exercises                      N4  P0（需建表）
GET  /api/mistakes/:id/events                        N2  P0（需建表）
GET  /api/lessons?q=          （扩面，签名不变）      P1-5
GET  /api/dashboard/summary                          P2
GET  /api/skills · GET /api/skill-runs               P1-6

写
POST /api/mistakes/:id/review                        P0-1
POST /api/mistakes/review-batch                      P0-1
POST /api/mistakes                                   P0-6
POST /api/progress/feedback                          P0-2
POST /api/study-records                              P0-3
POST /api/lessons                                    P0-5
PUT  /api/lessons/:id                                P0-5
POST /api/readings                                   P1-2
POST /api/skill-runs                                 P1-6
```
