# 06 · Amy / Skill 侧 API 需求（由 Amy 提出）

> **状态：需求（待实现）· 2026-09-29**
> 提出方：AI 英语老师 Amy（教学侧）　收方：后端工程师
> 依据：`backend/docs/05-api-reference.md`（已实现的第一版接口，本次全部实测可用）
> 背景：Amy 已能用现有 9 个 GET 接口拼出下一课计划（见 `docs/amy-session-07-plan.md`），
> 但存在 **1 个效率缺口（缺聚合快照）**、**3 个能力缺口（知识点 / 阅读 / 回写）**。
> **本文件只提需求，不涉及实现，也未修改任何数据库与代码。**

---

## 一、已验证可用的接口（无需改动）

本次实测 9 个，全部返回正确数据：

```
GET /api/health
GET /api/progress
GET /api/lessons?size=6
GET /api/lessons/latest
GET /api/lessons/error-trend?limit=6
GET /api/mistakes/pending?limit=20
GET /api/mistakes/stats
GET /api/vocabulary/stats
GET /api/study-records?size=6
```

**特别说明**：`/api/lessons/error-trend` 已补齐原设计缺口 G1（错误趋势）。
Amy 的「是否加速」判据因此可从「读 md 表格」改为「直接读接口」，**该缺口关闭**。

---

## 二、P0 需求：聚合快照接口

### R1. `GET /api/agent/snapshot`

- **现状**：`/api/agent/snapshot`（实测 404 接口不存在）。Amy 目前需并发 9 个接口再自行聚合。
- **目的**：一次拿全上课所需上下文，替代当前 `digest.md`（Amy 上课第一步）。
- **Query**：`recent`（最近几课，1—10，默认 3）、`studentId`
- **Response 200（示例，数据取自本次真实快照）**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "progress": {
      "studentId": 1, "currentLevel": "Level 2", "currentLevelNumber": 2,
      "currentLessonNo": 6, "nextLessonNo": 7,
      "lastFeedback": "just_right", "easyStreak": 0, "upgradeFrozen": false,
      "lastClassDate": "2026-09-29", "lessonNoAligned": true,
      "note": "第 5、6 课错误未持续下降且老错复发，暂停加速，先做巩固纠错"
    },
    "errorTrend": {
      "windowSize": 6,
      "byLesson": [
        { "lessonNo": 1, "lessonDate": "2026-09-26", "errorCount": 3 },
        { "lessonNo": 6, "lessonDate": "2026-09-29", "errorCount": 5 }
      ]
    },
    "recentLessons": [
      {
        "lessonNo": 6, "lessonDate": "2026-09-29", "level": "Level 2",
        "summary": "学会过去时 was / were，能说清「昨天怎么样」",
        "grammarPoint": "一般过去时 was / were",
        "vocabulary": ["yesterday", "last night", "ago"],
        "errorCount": 5, "exerciseCount": 9, "feedback": "just_right"
      }
    ],
    "courseCatalog": [ { "lessonNo": 6, "summary": "…" } ],
    "pendingMistakes": [
      {
        "id": 12, "wrongText": "play game", "correctText": "play games",
        "errorType": "grammar", "errorReason": "可数名词单数不能裸用",
        "streak": 0, "wrongCount": 3, "status": "pending", "priority": "high",
        "firstLessonNo": 4, "lastLessonNo": 6, "lastReviewedAt": null
      }
    ],
    "pendingMistakeStats": { "total": 15, "byType": { "grammar": 9, "word_choice": 4 } },
    "readingCatalog": [ { "date": "2026-09-29", "pieceCount": 3, "titles": ["Yesterday"] } ],
    "lastRecommendation": {
      "lessonNo": 6,
      "text": "第 7 课：规则动词过去式 -ed + 补漏块 4（介词 on/at）；复习优先 play games 与问号"
    }
  }
}
```

- **验收标准**
  1. 单次请求即可获得上表全部字段（缺数据的字段返回空数组或 `null`，不得 500）。
  2. `pendingMistakes` 排序与 `/api/mistakes/pending` **完全一致**（复用同一 service，避免两套排序）。
  3. `errorTrend` 与 `/api/lessons/error-trend` 同源。
  4. `lastRecommendation` 取值来自最近一条 `study_records(record_type='feedback').payload.next_recommendation`；无记录时返回 `null`。
- **依赖**：无新表。`lastRecommendation` 需 Amy 写入时带上该字段（见 R5）。

---

## 三、P0 需求：写接口（Amy 无法回写，闭环断裂）

> 现状：`POST /api/mistakes/12/review` 实测 404。**Amy 批改后的一切结果都无法入库**，
> 直接导致 5 个数据质量问题：`lastReviewedAt` 全 null、`streak` 永不变化、`status` 永不更新、
> 新课无法归档、反馈无法触发升降级。

### R2. `POST /api/mistakes/:id/review` ★

- **Request**
```json
{ "result": "correct", "lessonNo": 7, "answeredAt": "2026-09-30T10:20:00+08:00" }
```
- **服务端规则（必须与现有 `wrong-words.md` 一致，只搬运不重设计）**
  - `wrong` → `wrong_count + 1`，`streak = 0`，`status = 'pending'`
  - `correct` → `streak + 1`；`streak >= 2` → `status = 'passed'`
  - 两者都写 `last_reviewed_at`，并插入一条 `mistake_events`
- **Response 200**：`{ "id": 12, "streak": 1, "wrongCount": 3, "status": "pending" }`
- **批量版（可选，Amy 一次复习会判 3—5 条）**：`POST /api/mistakes/review-batch`，body 为数组，单事务。

### R3. `POST /api/progress/feedback` ★

- **Request**：`{ "lessonNo": 7, "feedback": "just_right", "note": "" }`
- **服务端规则（对齐 `progress.md`）**
  - `too_easy` → `easy_streak + 1`；`== 2` 时升 1 级并清零（受 `upgrade_frozen_until` 约束）
  - `too_hard` → 降 1 级，`upgrade_frozen_until = lessonNo + 3`
  - `just_right` → `easy_streak` 归零，仅记录
- **Response 200**：`{ "levelBefore": "Level 2", "levelAfter": "Level 2", "easyStreak": 0, "upgradeFrozenUntil": 0, "message": "维持 Level 2" }`
- **注意**：Amy 侧还有 4 条「守门规则」（准确度冻结、加速复议等，见 `docs/ai-teacher.md` 7.2）**暂不要求后端实现**，保持在 `progress.md` 备注中，避免后端承载教学策略。

### R4. `POST /api/lessons` / `PUT /api/lessons/:id`

- **用途**：课程归档（新课）与批改回填（`sections` / `vocabulary` / `exercises`）。
- **Request（对齐现有表结构，无新表）**
```json
{
  "lessonNo": 7, "lessonDate": "2026-09-30", "level": "Level 2",
  "summary": "学会规则动词过去式 -ed",
  "grammarPoint": "规则动词过去式 -ed",
  "studyMinutes": 28,
  "sections": [ { "sectionType": "review", "content": "…", "orderIndex": 0 } ],
  "vocabulary": [ { "word": "played", "phonetic": "/pleɪd/", "meaning": "玩（过去式）", "example": "I played games yesterday." } ],
  "exercises": [ { "exerciseNo": 1, "exerciseType": "fill_blank", "prompt": "…", "referenceAnswer": "…" } ]
}
```
- **约束**：`lessonNo` 唯一（重复 → 409）；`sectionType` 仅接受现有 8 个枚举值（见下节 R6）。
- **Response 201**：`{ "id": 7, "lessonNo": 7 }`

### R5. `POST /api/study-records`

- **Request**：`{ "recordType": "grade", "lessonNo": 7, "payload": { "errorCount": 3, "exerciseCount": 9, "byType": { "grammar": 2, "punctuation": 1 } } }`
- **另一类**：`{ "recordType": "feedback", "payload": { "feedback": "just_right", "nextRecommendation": "第 8 课：常用不规则过去式 + 补漏块 5" } }`
- **说明**：`nextRecommendation` 是 R1 快照 `lastRecommendation` 的数据来源，**Amy 需要这个字段来保留教学决策的可追溯性**。

---

## 四、P1 需求：知识点与阅读

### R6. `GET /api/knowledge-points`

- **现状**：`/api/knowledge-points` 实测 404。Amy 的「Level 1 待补清单 / 补漏队列」目前只能读 `progress.md`（**非 API 数据**）。
- **目的**：让「哪些知识点未学 / 在补 / 已掌握」变成可查询数据，支撑补漏块抽取与升级后的欠账追踪。
- **建议返回**
```json
{ "code": 200, "message": "success", "data": {
  "list": [
    { "code": "L1-04", "level": "Level 1", "name": "一般现在时第三人称单数 -s", "status": "backfill", "role": "backfill" },
    { "code": "L1-13", "level": "Level 1", "name": "介词 in / on / at", "status": "backfill", "role": "backfill" },
    { "code": "L2-04", "level": "Level 2", "name": "规则动词过去式 -ed", "status": "planned", "role": "new" }
  ],
  "total": 3 } }
```
- **枚举建议**：`status` ∈ `unlearned` / `planned` / `backfill` / `mastered`；`role` 复用 `course_knowledge_points.role`（`new` / `review` / `backfill`）。

### R7. `GET /api/readings`

- **现状**：`/api/readings` 实测 404。阅读目录只能从 `digest.md` / `read/*.md` 读。
- **建议**：`GET /api/readings`（按日期倒序：`date` / `pieceCount` / `titles`）、`GET /api/readings/:date`（篇目与理解题）。
- **约束**：与现有「当天不覆盖」规则一致，`POST` 遇同日期返回 409。

---

## 五、数据质量问题（需后端修复，优先级高于新接口）

| # | 问题 | 证据（实测） | 建议 |
|---|---|---|---|
| **DQ1** | **库内与本地不一致**：`total=20 / pending=15 / passed=5`，错词本 md 为 **19**（15 / 4），且 `byType` 多出 `other=1` | `GET /api/mistakes/stats` vs `wrong-words.md` | 重跑幂等迁移（`ON DUPLICATE KEY UPDATE`）；导入后跑一致性校验（课数 / 词数 / 错词数对 `INDEX.md`） |
| DQ2 | `wrong_text` 混入批注：id12「play game（第 3 次犯：第 6 课写 were playing game）」、id8「Do you like coffee.（句号结尾）」、id16「at yesterday（I was busy at yesterday）」 | `GET /api/mistakes/pending` | `wrong_text` 只存错误形式；批注移入 `error_reason`，或新增 `note VARCHAR(255)` |
| DQ3 | 词汇口径两套：API `51`（word 去重）vs 看板 `52`（按课累计） | `/api/vocabulary/stats` vs `review/index.html` | 在 `05-api-reference.md` 明确口径，看板对齐 |
| DQ4 | `firstLessonNo` / `lastLessonNo` 为 `null`（id8、id9 来源课号为「诊断」脏值） | `/api/mistakes?status=passed` | 支持 `sourceType='diagnostic'`，或允许 null 并在快照标注 |
| DQ5 | `lastReviewedAt` 全为 null | `/api/mistakes/pending` | R2 实现后自然修复 |

> **对 Amy 的实际影响**：DQ1 会导致「错词计数」与教师本地记录不一致，建议优先修。
> 其余问题不阻塞上课（Amy 读接口即可完成教学决策）。

---

## 六、优先级与建议排期

| 优先级 | 需求 | 理由 | 阻塞谁 |
|---|---|---|---|
| **P0** | R1 快照接口 | 把 9 次请求降为 1 次，Skill 第一步可切换 | Skill 设计师 |
| **P0** | R2 复习结果回写 | 无它则 `streak / status / lastReviewedAt` 永远不动，间隔重复失效 | Amy 闭环 |
| **P0** | R3 难度反馈回写 | 无它则升降级无法落库 | Amy 闭环 |
| **P0** | DQ1 数据同步 | 计数与教师侧不一致 | 数据可信度 |
| **P1** | R4 课程归档 | 目前课程仍由 md 归档，MD 为真相源，可继续等 | 迁移完成度 |
| **P1** | R5 学习记录 | 决策可追溯性（`nextRecommendation`） | R1 的字段来源 |
| **P1** | R6 知识点接口 | 补漏队列目前读 md | Amy 完整性 |
| **P2** | R7 阅读接口 | 阅读目前只读 md，前端需要它 | 前端工程师 |

**验收口径**：实现 R1 + R2 + R3 + DQ1 后，Amy 的上课链路可从「读 md」整体切换到「读 API」，
届时 `digest.md` 降级为**人读副本**，`docs/ai-teacher.md` 第 9.4 节的「降级方案」可关闭。

---

## 七、给后端工程师的对接摘要

- **不改现有 16 个 GET 接口**，只新增（R1、R6、R7）与写接口（R2—R5）。
- **不新增表**：R1 是聚合读，R2/R3 复用 `mistakes` / `mistake_events` / `progress_feedback` / `user_progress`；R4/R5 复用 `courses` / `course_sections` / `vocabulary` / `exercises` / `study_records`。
- **唯一可能需要动 schema 的两处**（请评估后再动，勿擅自改）：
  1. `mistakes` 增 `note VARCHAR(255)`（为解决 DQ2，也可不动、只规范写入内容）；
  2. `course_sections.section_type` 增 `objectives` / `expected_mistakes`（见 `docs/ai-teacher.md` 5.4，属**可选增强**，不做也不影响上课）。
- **教学规则边界**：服务端只实现 `wrong-words.md` 与 `progress.md` 中已存在的规则；Amy 侧 4 条守门规则（准确度冻结、加速复议）**暂不实现**。
