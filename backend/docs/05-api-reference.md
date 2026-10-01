# 05 · API 参考（第一版 · 已实测）

> 状态：**已实现并实测**（2026-09-29）。本文档描述的是**可运行的真实接口**，非设计稿。
> 服务地址：`http://localhost:4000`　接口前缀：`/api`
> 冒烟测试：`npm run test:api`（**49 项全部通过**）；写接口正向验证：`npm run test:write`（**129 项全部通过**）
>
> 变更记录：
> - 2026-09-29 · 第一批写接口与聚合快照落地：`GET /api/lessons/all`、`POST /api/mistakes/:id/review`、
>   `POST /api/study-records`、`POST /api/progress/feedback`、`GET /api/agent/snapshot`；分页 `size` 上限 100 → **500**。
> - 2026-09-29 · 第二批 DDL 落地：建 `lesson_exercises`、`mistake_events`；`section_type` 增
>   `objectives` / `expected_mistakes`；删 `mistakes.id=19`（DQ1）。随之新增
>   `GET /api/mistakes/:id/events`、`GET /api/lessons/:id/exercises`；
>   `POST /api/mistakes/:id/review` 的复习流水改落 `mistake_events`（幂等键即其唯一键）。
> - 2026-09-30 · 第三批：建 `readings` / `reading_pieces` / `reading_questions` 三表并回填 4 天 11 篇；
>   新增 `GET /api/readings`、`GET /api/readings/stats`、`GET /api/readings/:date`（**24—26 节**）；
>   `GET /api/agent/snapshot` 的 `readingCatalog` 转为真实数据（**退出 degradation**）；
>   `lesson_exercises` 回填 34 条（作业 25 + 补漏块 9），`GET /api/lessons/:id/exercises` 的
>   `blockKind` / `blockNo` 自此有数据；`lesson_sections` 12 → 51 条。
> - 2026-09-30 · 第四批：**开放 `POST /api/readings`**（**27 节**）——教学侧在线写入当天阅读，
>   单一事务、幂等判重；同日已存在 → **409**（「当天不覆盖」硬规则），显式 `?force=true` 为重出例外。
>   `reading_pieces` 加列 `source_url`（此前 `sourceUrl` 在写入路径被静默丢弃，写接口一并修正）。
>   阅读的写路径由「只有 `db:import`」变为「`db:import`（md 回填）+ `POST`（在线写入）」双通道。
> - 2026-10-01 · 第五批 · **Step 2a：开放课程归档写接口**（**28—29 节**）——
>   `POST /api/lessons`（按 `LessonRecord` 新建）、`PUT /api/lessons/:id`（回填批改与反馈）。
>   写路径切换点 = **第 8 课**（负责人拍板）：第 8 课起课程由本接口归档，
>   `db:import` 加**零 DDL 守卫**跳过 `lesson_no >= 8`，退化为「历史回填 + 只读校验」，
>   两条路径不再写同一批表。`test:write` 66 → **99 项**（新增 LW1—LW33）。
> - 2026-10-01 · 第六批（**A12 修正，随 Amy 复核**）：`snapshot.service.js` 的 `degradation.reason`
>   改为按实际 `affected` **逐项生成**（`DEGRADE_HINT` 表）；旧文案「待 `knowledge_points` 建表**与教学侧写入
>   nextRecommendation**」在 `teach:sync` 回填后即失真。§21 的实测样例同步刷新为 **2026-10-01 实况**
>   （课号 7 / `affected:["backlog"]` / `lastRecommendation`·`lastIncomplete` 已非 null）。
> - 2026-10-01 · 第七批 · **Step 2b：开放 `POST /api/mistakes`**（**30 节**）——
>   批量写入错词本条目，载荷按 **R3「只喂原始错词条目」**（错词本 8 列），
>   **不喂** `MistakeAnalysisResult` 的 `before/after` 全状态。判重键、列白名单与
>   `db:sync-mistakes` **同口径共用一份实现**（新 `src/utils/mistakeKey.js` 的 `normKey`；
>   `sync_mistakes.js` 的 2 处内联枚举与本地 `normKey` 一并收归单一来源）。
>   `wrong_count` **以人工值覆盖写**，与库内自动累计值不一致时**逐条告警**；
>   **DQ1 守卫**：`wrongText` 含全角括号批注 → 400。`test:write` 99 → **123 项**（新增 MW1—MW16 共 24 条断言，含 `b`/`c` 子项）。
>   接口总数 **29 → 30**；`db:sync-mistakes --dry-run` 实测行为不变（未变 26 / 跳过 0 / 告警 0）。
> - 2026-10-01 · 第八批 · **§11.11 落地：`last_lesson_id` 随复发刷新**（回应 Amy 裁定 A15/A16）——
>   `first_lesson_id` **冻结**（命中时永不改写）、`last_lesson_id` **按 `max(现有课号, 本次课号)`
>   单调刷新**（防重放旧批次倒退）；「本次课号」取 `items[].courseNo` → 顶层 `lessonNo`。
>   定则唯一实现 `src/utils/mistakeLesson.js`，本接口与 `db:sync-mistakes` **共用**。
>   `test:write` 123 → **129 项**（新增 MW17—MW20）。
>   ⚠️ **`db:sync-mistakes` 侧为「形式一致 + 语义安全」而非实质刷新**：错词本 md 只带**首次**课号，
>   拿不到「本次课号」，故该路径以 `firstLessonNo` 作下界（对已有行等价于不刷新），
>   `--dry-run` 实测行为仍不变。真正推进 `last` 的是本接口；`review` 是否同刷待 Amy 拍板。

---

## 一、通用约定

### 1.1 统一响应包络

**成功**
```json
{ "code": 200, "message": "success", "data": { } }
```
**失败**
```json
{ "code": 404, "message": "课程不存在：id=999", "data": null }
```

> `code` 取值 = HTTP 状态码。**用 `code` 一个字段即可判断成败**，`data` 在失败时为 `null`（参数校验失败时为字段级明细数组）。

### 1.2 分页

请求：`?page=1&size=20`（`size` 上限 **500**，2026-09-29 由 100 放宽）
响应：
```json
{ "code": 200, "message": "success",
  "data": { "list": [ ], "total": 6, "page": 1, "size": 20 } }
```

> 需要**不分页拿全量**课程时用 `GET /api/lessons/all`，不要靠把 `size` 调大绕过（历史 `?size=100` 会静默截断）。

### 1.3 学生参数

第一阶段为**单用户**：不传 `studentId` 时自动使用 `.env` 中 `DEFAULT_STUDENT_NAME`（当前 `Zane`）。
如需指定：所有接口均支持 `?studentId=1`。

### 1.4 错误码

| HTTP | message 示例 | 触发场景 |
|---|---|---|
| 400 | 参数校验失败 | 分页非数字、枚举值非法（`data` 含 `[{field,message}]`） |
| 404 | 课程不存在：id=999 | 资源不存在 / 路由不存在 |
| 409 | 唯一键冲突 | 写入重复数据 |
| 500 | 服务器内部错误 | 未预期异常（不泄露堆栈与 SQL） |
| 503 | 数据库连接不可用 | MySQL 未启动 |

### 1.5 其他

- 每个响应带 `X-Request-Id` 头，便于按请求排查日志。
- 时间字段为字符串：`DATE` → `2026-09-29`，`DATETIME` → `2026-09-29 14:08:02`。
- 响应字段统一 **camelCase**，数据库为 snake_case，由服务层转换。

---

## 二、接口清单

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 1 | GET | `/api/health` | 健康检查（服务 + 数据库 + 默认学生） |
| 2 | GET | `/api` | 接口索引 |
| 3 | GET | `/api/lessons` | 课程列表 |
| 4 | GET | `/api/lessons/all` | 课程全量（不分页，含 `grammarPoint`） |
| 5 | GET | `/api/lessons/latest` | 最近一课 + 下一课号 |
| 6 | GET | `/api/lessons/error-trend` | 错误趋势（最近 N 课） |
| 7 | GET | `/api/lessons/:id` | 课程详情（含小节 + 词汇） |
| 8 | GET | `/api/vocabulary` | 词汇列表 |
| 9 | GET | `/api/vocabulary/stats` | 词汇统计（总数 + 首字母分布） |
| 10 | GET | `/api/vocabulary/:id` | 词汇详情 |
| 11 | GET | `/api/mistakes` | 错词列表 |
| 12 | GET | `/api/mistakes/pending` | 未过关错词（按优先级） |
| 13 | GET | `/api/mistakes/stats` | 错词统计 |
| 14 | GET | `/api/mistakes/:id` | 错词详情 |
| 15 | POST | `/api/mistakes/:id/review` | 复习结果回写（`clientEventId` 幂等） |
| 16 | GET | `/api/study-records` | 学习记录 |
| 17 | GET | `/api/study-records/stats` | 学习记录统计 |
| 18 | POST | `/api/study-records` | 写入学习记录 |
| 19 | GET | `/api/progress` | 学习进度 |
| 20 | POST | `/api/progress/feedback` | 难度反馈（触发升降级） |
| 21 | GET | `/api/agent/snapshot` | 教学快照（9 次请求 → 1 次） |
| 22 | GET | `/api/mistakes/:id/events` | 某错词的复习流水（N2） |
| 23 | GET | `/api/lessons/:id/exercises` | 某课的练习与批改结论（N4） |
| 24 | GET | `/api/readings/stats` | 阅读统计（R1） |
| 25 | GET | `/api/readings` | 阅读日清单（倒序分页） |
| 26 | GET | `/api/readings/:date` | 某天阅读全文（英中对照 + 理解题） |
| 27 | POST | `/api/readings` | 写入当天阅读（`ReadingSet`；同日已存在 → 409，`force=true` 重出） |
| 28 | POST | `/api/lessons` | 新建课程归档（`LessonRecord`；课号已存在 → 409） |
| 29 | PUT | `/api/lessons/:id` | 回填批改与反馈（**部分更新**；`:id` 是主键不是课号） |
| 30 | POST | `/api/mistakes` | 批量写入错词本条目（`wrong-words.md` 8 列；按规范化 `wrongText` 判重、命中即更新） |

---

## 三、接口详情

### 1. GET `/api/health`
```json
{ "code": 200, "message": "success", "data": {
  "service": "english-learning-backend", "version": "0.1.0",
  "database": "up", "dbError": null,
  "defaultStudent": { "id": 1, "name": "Zane", "nickname": "刘凤渝", "target": "能读懂并写出日常句子" },
  "time": "2026-09-29T14:08:00.000Z" } }
```

### 2. GET `/api` — 接口索引
返回 `data.endpoints`（字符串数组），便于快速自查。

### 3. GET `/api/lessons`
**Query**：`page`、`size`、`level`（如 `Level 2`）、`q`（摘要/语法点关键词）、`from`、`to`（日期）、`studentId`

**实测响应**
```json
{ "code": 200, "message": "success", "data": {
  "list": [ { "id": 6, "lessonNo": 6, "lessonDate": "2026-09-29",
              "level": "Level 2",
              "summary": "学会过去时 was / were，能说清「昨天怎么样」",
              "grammarPoint": "一般过去时 was / were",
              "vocabCount": 10, "exerciseCount": 9, "errorCount": 5,
              "feedback": "just_right", "sourceFile": "day-01-07.md",
              "status": "taught", "createdAt": "2026-09-29 14:08:02" } ],
  "total": 6, "page": 1, "size": 1 } }
```
- 排序：`lessonNo` **降序**（最新在前）。
- `feedback` 枚举：`too_easy` / `just_right` / `too_hard`。

### 4. GET `/api/lessons/all`
**Query**：`level`、`q`、`from`、`to`、`studentId`（**无 `page`/`size`**）

**字段与 [`/api/lessons`](#3-get-apilessons) 列表完全一致**（含 `grammarPoint`），仅不分页、不受 `size` 上限约束。`data` 形状同分页结构（`page=1`、`size=total`），保证前端可复用同一渲染函数。

**用途**：替换前端会静默截断的 `?size=100`。**不可精简字段**——首页/看板的客户端搜索依赖 `grammarPoint`，去掉会漏词。

```json
{ "code": 200, "message": "success", "data": {
  "list": [ { "id": 6, "lessonNo": 6, "lessonDate": "2026-09-29", "level": "Level 2",
              "summary": "…", "grammarPoint": "一般过去时 was / were",
              "vocabCount": 10, "exerciseCount": 9, "errorCount": 5,
              "feedback": "just_right", "sourceFile": "day-01-07.md",
              "status": "taught", "createdAt": "2026-09-29 14:08:02" } ],
  "total": 6, "page": 1, "size": 6 } }
```

### 5. GET `/api/lessons/latest`
```json
{ "code": 200, "message": "success", "data": {
  "latest": { "id": 6, "lessonNo": 6, "lessonDate": "2026-09-29", "level": "Level 2",
              "summary": "…", "grammarPoint": "一般过去时 was / were",
              "errorCount": 5, "feedback": "just_right" },
  "nextLessonNo": 7 } }
```
- `nextLessonNo = 最大课号 + 1`（断更不断号）。无课程时返回 `{latest:null, nextLessonNo:1}`。

### 6. GET `/api/lessons/error-trend`
**Query**：`limit`（1—20，默认 5）
```json
{ "code": 200, "message": "success", "data": {
  "windowSize": 5,
  "byLesson": [ { "lessonNo": 2, "lessonDate": "2026-09-26", "errorCount": 4 },
                { "lessonNo": 3, "lessonDate": "2026-09-27", "errorCount": 2 },
                { "lessonNo": 4, "lessonDate": "2026-09-27", "errorCount": 6 },
                { "lessonNo": 5, "lessonDate": "2026-09-28", "errorCount": 2 },
                { "lessonNo": 6, "lessonDate": "2026-09-29", "errorCount": 5 } ] } }
```
- `byLesson` 按课号**升序**，便于直接画趋势线。
- 口径为**错误处数**，不折算百分制。

### 7. GET `/api/lessons/:id`
**路径**：`id` 必须为正整数。
```json
{ "code": 200, "message": "success", "data": {
  "id": 1, "lessonNo": 1, "lessonDate": "2026-09-26", "level": "Level 1",
  "summary": "…", "grammarPoint": "主语 + 谓语 + 宾语",
  "vocabCount": 8, "exerciseCount": 7, "errorCount": 3, "feedback": "too_easy",
  "sections": [
    { "sectionType": "grammar", "content": "英语最基本的句子顺序是：主语 + 谓语 + 宾语。…", "orderIndex": 1 },
    { "sectionType": "feedback", "content": "难度反馈：太简单", "orderIndex": 7 } ],
  "vocabulary": [
    { "id": 1, "word": "like", "phonetic": "/laɪk/", "meaning": "喜欢",
      "example": "I like music.", "isNew": true, "orderIndex": 1 } ] } }
```
- `sections[].sectionType` 枚举：`review` / `grammar` / `vocab_table` / `examples` / `homework` / `my_answer` / `grading` / `feedback`。
- **Error**：404 `课程不存在：id=<id>`

### 8. GET `/api/vocabulary`
**Query**：`page`、`size`（默认 50）、`letter`（单字母 A—Z；`#` 表示非字母开头）、`q`、`lessonId`、`studentId`
```json
{ "code": 200, "message": "success", "data": {
  "list": [ { "id": 1, "word": "like", "phonetic": "/laɪk/", "meaning": "喜欢",
              "example": "I like music.", "firstLessonId": 1, "firstLessonNo": 1 } ],
  "total": 51, "page": 1, "size": 50 } }
```
- 排序：按 `word` 升序（A→Z），便于词汇卡页分组。

### 9. GET `/api/vocabulary/stats`
```json
{ "code": 200, "message": "success", "data": {
  "total": 51,
  "byLetter": { "A": 2, "B": 4, "C": 3, "D": 1, "E": 3, "F": 2, "H": 2,
                "K": 1, "L": 3, "M": 3, "N": 3, "O": 2, "P": 1, "Q": 1,
                "R": 2, "S": 7, "T": 4, "U": 1, "W": 5, "Y": 1 } } }
```

### 10. GET `/api/vocabulary/:id`
单个词条，字段同上。**Error**：404 `词汇不存在：id=<id>`

### 11. GET `/api/mistakes`
**Query**：`page`、`size`、`status`（`pending` / `passed`）、`errorType`、`q`、`studentId`
```json
{ "code": 200, "message": "success", "data": {
  "list": [ { "id": 12, "wrongText": "play game（第 3 次犯…）", "correctText": "play games",
              "errorType": "grammar", "errorReason": "可数名词单数不能裸用…",
              "streak": 0, "wrongCount": 3, "status": "pending", "priority": "high",
              "firstLessonNo": 4, "lastLessonNo": 6,
              "lastReviewedAt": null, "createdAt": "…", "updatedAt": "…" } ],
  "total": 20, "page": 1, "size": 20 } }
```
- 排序：未过关优先 → `wrongCount` 降序 → 最久未复习在前。
- `priority` 由服务端推导：`wrongCount ≥ 2` → `high`；`streak === 1` → `medium`；其余 `low`。
- `errorType` 枚举：`grammar` / `spelling` / `punctuation` / `word_choice` / `capitalization` / `other`。
- **`firstLessonNo` / `lastLessonNo` 语义不同**（`docs/ai-teacher.md` §11.11）：
  `first` ＝**首次**出错课（冻结）；`last` ＝**最近一次**出错课（随复发刷新，`POST /api/mistakes`
  命中时按 `max(现有课号, 本次课号)` 单调前进）。上例 `4 / 6` 即真实形态。
  ⚠️ 2026-10-01 之前两列**恒等**（写路径均不改写）→ `last` 曾是**死列**；
  历史行维持原样（**不回填**，见 §11.11「明确不做」）。

### 12. GET `/api/mistakes/pending`
**Query**：`limit`（1—200，默认 50）
```json
{ "code": 200, "message": "success", "data": {
  "list": [ { "id": 5, "wrongText": "now,liked my teacher",
              "correctText": "and I like my teacher ／ 用句号断开",
              "errorType": "punctuation", "errorReason": "逗号不能连接两个完整句子…",
              "streak": 1, "wrongCount": 3, "status": "pending", "priority": "high",
              "firstLessonNo": 2, "lastLessonNo": 2 } ],
  "total": 15 } }
```
- 等价于 `digest.md` 的「待复习」段，**供 Amy / 出复习题直接取用**。

### 13. GET `/api/mistakes/stats`
```json
{ "code": 200, "message": "success", "data": {
  "total": 20, "pending": 15, "passed": 5,
  "byType": [ { "errorType": "grammar", "count": 9 },
              { "errorType": "word_choice", "count": 4 },
              { "errorType": "capitalization", "count": 3 },
              { "errorType": "punctuation", "count": 2 },
              { "errorType": "spelling", "count": 1 },
              { "errorType": "other", "count": 1 } ] } }
```

### 14. GET `/api/mistakes/:id`
单条错词。**Error**：404 `错词不存在：id=<id>`

### 15. POST `/api/mistakes/:id/review` ★
复习结果回写。**这是学生打卡的写路径**，重复提交会污染过关判定，故必须用 `clientEventId` 幂等。

**Body**
```json
{ "result": "correct", "lessonNo": 7, "answeredAt": "2026-09-30T10:20:00+08:00", "clientEventId": "rev-20260930-001" }
```
- `result`（必填）：`correct` / `wrong`
- `lessonNo`（选填）：用于关联复习发生的课；该课不存在时不报错，仅不建关联
- `answeredAt`（选填）：ISO 或 `YYYY-MM-DD HH:MM:SS`；缺省 = 服务端当前时间
- `clientEventId`（选填）：客户端事件唯一 id；**同一 id 重复提交返回首次结果，不再累加**

**服务端规则**（搬运 `wrong-words.md`，不重设计）
- `wrong` → `wrongCount+1`、`streak=0`、`status='pending'`
- `correct` → `streak+1`；`streak>=2` → `status='passed'`
- 两者都写 `lastReviewedAt`，并在 `mistake_events` 留一条复习流水（`client_event_id` 即幂等键）

**实测响应**
```json
{ "code": 200, "message": "success", "data": {
  "id": 1, "streak": 0, "wrongCount": 2, "status": "pending",
  "priority": "high", "lastReviewedAt": "2026-09-30 10:20:00" } }
```
- `priority` 与错词列表同源推导（`wrongCount>=2` high / `streak===1` medium / 其余 low）
- **Error**：404 `错词不存在：id=<id>`；400（`result` 非法等）

### 16. GET `/api/study-records`
**Query**：`page`、`size`、`type`、`lessonId`、`from`、`to`、`studentId`
```json
{ "code": 200, "message": "success", "data": {
  "list": [ { "id": 18, "recordType": "feedback",
              "summary": "第 6 课反馈：just_right",
              "payload": { "lessonNo": 6, "feedback": "just_right" },
              "lessonId": 6, "lessonNo": 6, "lessonDate": "2026-09-29",
              "createdAt": "2026-09-29 14:08:02" } ],
  "total": 18, "page": 1, "size": 20 } }
```
- `type` 枚举：`attend` / `homework_submit` / `grade` / `review` / `feedback` / `reading`。
- 排序：`createdAt` 降序。

### 17. GET `/api/study-records/stats`
```json
{ "code": 200, "message": "success", "data": {
  "total": 18, "byType": { "attend": 6, "grade": 6, "feedback": 6 } } }
```

### 18. POST `/api/study-records`
写入学习记录（`ATTEND` / 批改 / 反馈等）。**两条写入约定**：
- `grade` 记录带 `payload.byType` → 供 `/api/lessons/error-trend` 与快照 `errorTrend.byLesson[].byType` 读取
- `feedback` 记录带 `payload.nextRecommendation` → 快照 `lastRecommendation` 的**唯一数据来源**

**Body**
```json
{ "recordType": "grade", "lessonNo": 7,
  "payload": { "errorCount": 3, "exerciseCount": 9, "byType": { "grammar": 2, "punctuation": 1 } } }
```
- `recordType`（必填）：`attend` / `homework_submit` / `grade` / `review` / `feedback` / `reading`
- `lessonNo`（选填）：也可只写在 `payload.lessonNo`
- `payload` 键白名单：`lessonNo` / `level` / `feedback` / `errorCount` / `exerciseCount` / `byType` / `nextRecommendation` / `studyMinutes` / `incompleteStep`；**白名单外的键被忽略**
- `nextRecommendation` 也接受 snake_case 别名 `next_recommendation`，落库统一为 camelCase
- `incompleteStep` 也接受 snake_case 别名 `incomplete_step`；经快照投影为 `lastIncomplete.incompleteStep`（见 §21）

**实测响应 201**
```json
{ "code": 201, "message": "created", "data": { "id": 26, "recordType": "grade", "createdAt": "2026-09-29T09:38:38.884Z" } }
```
- **Error**：400（`recordType` 非法 / `payload` 非对象 / `feedback` 非法）

### 19. GET `/api/progress`
```json
{ "code": 200, "message": "success", "data": {
  "studentId": 1, "currentLevel": "Level 2", "currentLevelNumber": 2,
  "currentLessonNo": 6, "nextLessonNo": 7,
  "lastFeedback": "just_right", "easyStreak": 0,
  "upgradeFrozenUntil": 0, "upgradeFrozen": false,
  "lastClassDate": "2026-09-29",
  "note": "第 5、6 课错误未持续下降且老错复发，暂停加速，先做巩固纠错",
  "lessonNoAligned": true } }
```
- `currentLessonNo` 取「进度表值与实际最大课号」的较大者，**以实际课程为准**（断更不断号）。
- `lessonNoAligned`：进度表课号与课程记录是否一致（不一致说明需要修正）。

### 20. POST `/api/progress/feedback` ★
难度反馈，触发级别升降。

**Body**
```json
{ "lessonNo": 7, "feedback": "too_easy", "note": "", "nextRecommendation": "第 8 课：…" }
```
- `lessonNo`（必填）、`feedback`（必填）：`too_easy` / `just_right` / `too_hard`
- `note`（选填）、`nextRecommendation`（选填，同时接受 `next_recommendation`）

**服务端规则**（对齐 `progress.md`；Amy 侧守门规则不在后端实现）
- `too_easy` → `easyStreak+1`；达 2 且未被冻结（`upgradeFrozenUntil < lessonNo`）→ 升 1 级并清零
- `too_hard` → 降 1 级（下限 `Level 1`），`upgradeFrozenUntil = lessonNo + 3`
- `just_right` → `easyStreak` 清零，仅记录

**实测响应**
```json
{ "code": 200, "message": "success", "data": {
  "levelBefore": "Level 2", "levelAfter": "Level 3", "easyStreak": 0,
  "upgradeFrozenUntil": 0, "message": "升 1 级：Level 2 → Level 3" } }
```
- 同时写回 `lessons.feedback`（该课不存在时跳过，不影响反馈生效），并留一条 `feedback` 学习记录
- **Error**：400（`feedback` 非法 / 缺 `lessonNo`）

### 21. GET `/api/agent/snapshot` ★
教学快照：把 Skill 上课所需的 9 次请求降为 1 次。`data` 形状对齐 `docs/schemas/agent-snapshot.schema.json`。

**Query**：`recent`（1—10，默认 3）、`studentId`

**实测响应（节选）**
```json
{ "code": 200, "message": "success", "data": {
  "deploymentMode": "backend",
  "progress": { "currentLevel": "Level 2", "currentCourseNo": 7, "currentLessonNo": 7,
                "nextLessonNo": 8, "lastFeedback": "just_right", "easyStreak": 0,
                "upgradeFrozenUntil": 0, "lastClassDate": "2026-10-01" },
  "courseCatalog": [ { "lessonNo": 7, "lessonDate": "2026-10-01", "levelCode": "Level 2",
                       "summary": "学会规则动词过去式 -ed，能写出 5 句「上周做了什么」" } ],
  "recentLessons": [ { "lessonNo": 7, "lessonDate": "2026-10-01", "levelCode": "Level 2",
                       "summary": "…", "grammarPoint": "规则动词过去式 -ed",
                       "vocabulary": ["played", "worked", "watched", "studied", "cooked",
                                      "cleaned", "visited", "stopped", "last week", "last month"],
                       "feedback": "just_right", "mistakeCount": 3, "errorCount": 2 } ],
  "pendingMistakes": [ { "id": 8, "wrongText": "Do you like coffee.", "correctText": "Do you like coffee?",
                         "errorType": "punctuation", "streak": 0, "wrongCount": 3, "status": "pending",
                         "priority": "high", "lastReviewedAt": null } ],
  "pendingMistakeStats": { "total": 20, "byType": { "grammar": 10, "capitalization": 3,
                                                    "word_choice": 3, "punctuation": 2, "spelling": 2 } },
  "errorTrend": { "windowSize": 6, "byLesson": [ { "lessonNo": 7, "lessonDate": "2026-10-01",
                  "errorCount": 2, "byType": { "grammar": 2 } } ] },
  "readingCatalog": [ { "date": "2026-10-01", "pieceCount": 3,
                        "titles": ["My Last Weekend", "Amy Worked Late", "Tom's Busy Day"] } ],
  "backlog": null,
  "lastRecommendation": { "lessonNo": 7, "text": "第 8 课：常用不规则过去式 go-went / eat-ate / see-saw / have-had…" },
  "lastIncomplete": { "lessonNo": 7, "nextRecommendation": "第 8 课：常用不规则过去式 go-went / eat-ate / see-saw / have-had…" },
  "degradation": { "degraded": true, "reason": "以下字段暂无数据来源，已降级返回：backlog（待 knowledge_points 建表）",
                   "affected": ["backlog"] } } }
```
> 上例为 **2026-10-01 实测原样节选**（含真实课号 7 / 日期 2026-10-01）。
> `pendingMistakes[0]` 的来源课号为脏值（DQ4）时，`firstCourseNo` / `lastCourseNo` **整键省略**（上例即如此）。
**硬约束**
- `pendingMistakes` / `errorTrend` 与 `/api/mistakes/pending`、`/api/lessons/error-trend` **同源复用**（同一 service，不另写排序）
- `pendingMistakeStats` **只统计 `status='pending'`**；`byType` 为 `errorType → count`
- `lastRecommendation` 形状 `{ lessonNo, text }`，取自最近一条 `feedback` 记录的 `payload.nextRecommendation`；无数据为 `null`
- `lastIncomplete` **与 `lastRecommendation` 同源**（G4，供 Skill 断更接续）：形状 `{ lessonNo, nextRecommendation, incompleteStep? }`。
  `incompleteStep` 取自同一条 `feedback` 记录的 `payload.incompleteStep`（未完成的教学动作），**有值才带该键**；
  是 `docs/ai-teacher.md` §11.2 第 5 条「断更补课题量上浮」的判据。无数据时整体为 `null`
- **缺数据一律降级**（`null` / `[]` / 省略键）+ `degradation`，**绝不 500、绝不空串**
- `readingCatalog` 自 2026-09-30 起有真实数据源（`readings` 三表，**倒序、最多 30 天**）。
  **空数组代表「确实还没有阅读」，属于正常数据而非降级**，故不再计入 `degradation.affected`。
  判断「当天是否已生成阅读」用 `readingCatalog[0].date === 今天`
- `errorTrend.byLesson[].byType` 取自对应课 `study_records(record_type='grade').payload.byType`
  （2026-09-30 已回填第 1—6 课）；该课无数据时**省略 `byType` 键**，不编造 `{}`
- `pendingMistakes[].firstCourseNo/lastCourseNo` 用课号；来源课号为脏值（DQ4）时**省略该键**而不是塞 `null`
- 当前仍计入 `degradation.affected` 的**只剩 `backlog`**（待 `knowledge_points` 建表）。
  `errorTrend.byType`（2026-09-30 回填第 1—6 课）与 `lastRecommendation` / `lastIncomplete`
  （2026-10-01 `teach:sync` 回填 `feedback` 记录后已有值）**均已退出降级**。
- **`degradation.reason` 按实际 `affected` 逐项生成**（`snapshot.service.js` 的 `DEGRADE_HINT` 表），
  **不再写死全局结论** —— 旧实现把「待知识库建表」与「待教学侧写 nextRecommendation」写死在同一句里，
  回填后该句即失真（A12）。新增降级字段时**同步补 `DEGRADE_HINT` 条目**即可，勿改回硬编码文案。

### 22. GET `/api/mistakes/:id/events`
某错词的复习流水，**按时间升序**（便于看复发曲线）。`mistake_events` 表 2026-09-29 建。

**Query**：`limit`（1—200，默认 50）、`studentId`
```json
{ "code": 200, "message": "success", "data": {
  "list": [ { "eventId": 1, "result": "wrong", "lessonNo": 6,
              "clientEventId": "dw-e1", "answeredAt": "2026-09-29 18:02:06",
              "createdAt": "2026-09-29 18:02:06" } ],
  "total": 1 } }
```
- **Error**：404 `错词不存在：id=<id>`

### 23. GET `/api/lessons/:id/exercises`
某课的练习明细与批改结论。`lesson_exercises` 表 2026-09-29 建。

**路径**：`id` 必须为正整数；**Query**：`studentId`
```json
{ "code": 200, "message": "success", "data": {
  "list": [ { "blockKind": "homework", "blockNo": 0, "exerciseNo": 1, "exerciseType": "fill_blank", "prompt": "…",
              "selfCheck": "句尾标点", "referenceAnswer": "…", "targetPoint": "规则动词过去式 -ed",
              "userAnswer": "…", "isCorrect": false, "errorType": "grammar",
              "errorNote": "…", "revisedAnswer": null } ],
  "summary": { "exerciseCount": 1, "correctCount": 0, "byType": { "grammar": 1 } } } }
```
- `blockKind`（`homework` / `backfill`）+ `blockNo`（作业恒为 `0`，补漏块为块号 N）区分**同一课的两套题号命名空间**；`exerciseNo` 是**块内**题号，两者合起来才唯一（2026-09-30 加，见 `docs/skills.md` 2.5）
- `isCorrect` 为 `boolean | null`（`null` = 未批改）；批改结论**不新造 `verdict` 字段**
- `selfCheck` 对应 `lesson_exercises.self_check`（2026-09-30 加列），来源为 `exercise-set.schema.json` 的 `ExerciseItem.selfCheck`；无值返回 `null`
- `summary.byType` 只统计「已批改且答错」的题；`errorType` 复用 `mistakes` 同源 ENUM
- **Error**：404 `课程不存在：id=<id>`

### 24. GET `/api/readings/stats` ★
阅读统计（缺口 **R1**）。`readings` / `reading_pieces` / `reading_questions` 三表 2026-09-30 建，数据由 `read/*.md` 回填。

**Query**：`studentId`

**实测响应**
```json
{ "code": 200, "message": "success", "data": {
  "totalDays": 4, "pieceCount": 11, "wordCountTotal": 362,
  "byMonth": { "2026-09": 11 },
  "lastReadDate": "2026-09-29", "currentStreakDays": 4, "today": "2026-09-30" } }
```
- `wordCountTotal` = 各篇 `word_count` 之和（`word_count` 由导出器按**英文词数**统计，不含中文）
- `currentStreakDays` 是**截至 `lastReadDate`** 的连续天数，**不要求 `lastReadDate` 就是今天**。
  「今天有没有读」由调用方比 `lastReadDate === today` 判断——接口不替调用方下结论
- `byMonth` 的键为 `YYYY-MM`，值为该月**篇数**；无阅读时返回 `{ "totalDays": 0, "pieceCount": 0, "wordCountTotal": 0, "byMonth": {}, "lastReadDate": null, "currentStreakDays": 0 }`

### 25. GET `/api/readings`
阅读日清单，**按日期倒序**（便于取首条判断「当天是否已生成」）。

**Query**：`page` / `size`（默认 20，上限 200）/ `from` / `to`（`YYYY-MM-DD`，作用于 `read_date`）、`studentId`
```json
{ "code": 200, "message": "success", "data": {
  "list": [ { "date": "2026-09-29", "sourceFile": "2026-09-29-read.md",
              "pieceCount": 3, "titles": ["Yesterday", "Tom's Bad Day", "Where Were You?"] } ],
  "total": 4, "page": 1, "size": 20 } }
```
- `titles` 按篇号升序；篇标题含逗号也不会切错（内部分隔符用不可见字符）
- `sourceFile` 保留来源 md 文件名，便于回溯迁移

### 26. GET `/api/readings/:date` ★
某一天的阅读全文：篇 + **段落级英中对照** + 理解题。

**路径**：`date` 必须是 `YYYY-MM-DD`　**Query**：`studentId`
```json
{ "code": 200, "message": "success", "data": {
  "date": "2026-09-29", "sourceFile": "2026-09-29-read.md", "pieceCount": 3,
  "pieces": [ { "pieceNo": 1, "title": "Yesterday", "levelCode": "Level 2", "source": "自编",
                "wordCount": 43,
                "paragraphs": [ { "en": "Yesterday was a busy day for me.", "zh": "昨天对我来说是忙碌的一天。" } ],
                "vocabularyNotes": "busy 忙的 / from ... to ... 从……到……",
                "questions": [ { "questionNo": 1, "question": "Where was the writer at night?",
                                 "answer": "He was at home." } ] } ] } }
```
- `paragraphs` 由落库的 `body_md`（英文行 + `> 中文` 行）还原；`zh` 缺失时为 `null`
- `questions[].answer` 无答案时为 `null`；**题干与答案必须成对**——早期解析把 `<details>` 答案行误当新题会让题数翻倍（已修，见 04-migration 五之三）
- **Error**：400 `日期格式必须是 YYYY-MM-DD`；404 `该日期没有阅读：<date>`

### 27. POST `/api/readings` ★
写入**某一天的阅读**。教学侧（Amy）在生成当天阅读后调用；请求体即 `ReadingSet`
（`docs/schemas/reading-set.schema.json`），与 `db:import` 的 md 回填**共用同一套正文渲染实现**
（`renderBodyMd` / `countWords`），保证两条写路径产出格式一致。

**Query**：`studentId`、`force`（可选，`true` / `1`）

**请求体（`ReadingSet`）**
```json
{
  "date": "2026-09-30",
  "levelCode": "Level 2",
  "sourceFile": "2026-09-30-read.md",
  "pieces": [ {
    "pieceNo": 1,
    "levelCode": "Level 2",
    "source": "自编",
    "sourceUrl": null,
    "title": "A Busy Morning",
    "wordCount": 42,
    "vocabularyNotes": "busy 忙的",
    "paragraphs": [ { "en": "I was busy yesterday.", "zh": "我昨天很忙。" },
                    { "en": "I am free today.",   "zh": null } ],
    "questions": [ { "questionNo": 1, "question": "Was the writer busy yesterday?", "answer": "Yes, he was." },
                   { "questionNo": 2, "question": "Is he free today?",                "answer": "Yes, he is." } ]
  } ]
}
```

**成功（201 · created）**
```json
{ "code": 201, "message": "success", "data": {
  "id": 27, "date": "2026-09-30", "pieceCount": 1, "levelCode": "Level 2", "replaced": false } }
```
- 三表一并落库：`readings` 1 行（`uk_reading_day` 保证一天一行）、`reading_pieces` N 行、`reading_questions` 2N 行
- `replaced`：首次写入为 `false`；`force=true` 重出已存在的日期为 `true`（复用原 `readings` 行，`id` 不变）

**校验规则（与 `reading-set.schema.json` 严格一致，不额外发明）**

| 字段 | 约束 | 违反 |
|---|---|---|
| `date` | 必填，**真实存在**的 `YYYY-MM-DD`（`2026-02-31` 这类格式对但不存在的日期被拒） | 400 |
| `levelCode` | 必填，`Level 1`—`Level 5` 之一 | 400 |
| `sourceFile` | 可选，若提供须形如 `2026-09-30-read.md` | 400 |
| `pieces` | 必填，**1—3 篇**；`pieceNo` 为 1—3 的整数且不重复 | 400 |
| `pieces[].source` | 必填非空（自编写「自编」） | 400 |
| `pieces[].title` | 必填非空 | 400 |
| `pieces[].paragraphs` | 必填，≥1 段；每段 `en` 非空 | 400 |
| `pieces[].questions` | 必填，**恰好 2 道**；`question` / `answer` 均非空 | 400 |
| `pieces[].sourceUrl` | 可选，字符串或 `null`；**契约要求来源为新闻时必填**，但服务端只校验类型（无法判定是否新闻，故不强制） | 400（类型不符） |

- 校验失败返回 400，`data` 为**字段级明细数组**（`[{field, message}]`），如 `pieces[0].questions`
- **嵌套结构不由 `validate()` 处理**：`validate()` 只认浅层 `int` / `string` / `object`；
  `pieces` / `paragraphs` / `questions` 的逐层校验在 service 内完成，故错误码同为 400 但来源不同

> ⚠️ **一处刻意比 schema 更严**：`date` 除了匹配 `$defs.DateOnly` 的
> `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`，还额外要求它是**真实存在的日历日**——`2026-02-31` 格式合法但不存在，会被拒（RW16）。
> 这是**有意的数据完整性守卫**（非 schema 派生规则），在此显式声明，避免被当成「静默发明约束」；
> 若教学侧需要放宽，去掉 `reading.service.js` 的 `isRealDate()` 真日历判定即可。

**幂等与并发**
- 判重键 = `readings.uk_reading_day (student_id, read_date)`：「读旧值 → 判重 → 插入」全程在**同一事务**
  （`db.withTransaction` + `*On(conn,…)`），并发提交同一天不会各写一天
- 同一日期**已存在** → **409** `该日期已有阅读：<date> —— 「当天不覆盖」；确需重出请显式传 force=true`
- `force=true` 为该规则的**显式例外**（学生明确要求重出）：同事务内先删该日的 `questions → pieces` 再重建，
  `readings` 行复用；**不传 `force` 时绝不覆盖**

**写路径选型（教学侧参考）**

| 场景 | 用哪条 |
|---|---|
| 批量回填历史 md（第 1—6 课） | `npm run db:export` → `db:import`（离线、幂等、可 `--dry-run`） |
| 当天新生成一篇/一组阅读 | 本接口 `POST /api/readings` |

> 两条路径的正文渲染、词数统计、题数口径**共用同一实现**，故同一份内容经任一路径落库结果一致。

### 28. POST `/api/lessons` ★
把**一节课的归档记录**写入库（新建）。产出者是 Skill 侧 `daily-lesson` 的**归档步**
（`docs/skills.md` §3.1 第 8 步）；请求体即 `LessonRecord`
（`docs/schemas/lesson-record.schema.json`）—— **本接口按契约实现，契约不改**。

**Query**：`studentId`

**请求体（`LessonRecord`）**
```json
{
  "lessonNo": 8,
  "lessonDate": "2026-10-02",
  "levelCode": "Level 2",
  "summary": "学会常用不规则过去式，能说清「昨天做了什么」",
  "grammarPoint": "常用不规则过去式",
  "sourceFile": "day-08-14.md",
  "sections": [
    { "sectionType": "review",   "contentMd": "…", "orderIndex": 0 },
    { "sectionType": "grammar",  "contentMd": "…", "orderIndex": 1 },
    { "sectionType": "homework", "contentMd": "…", "orderIndex": 2 }
  ],
  "vocabulary": [
    { "word": "went", "phonetic": "/went/", "meaning": "去（go 的过去式）",
      "example": "I went home.", "isNew": true, "orderIndex": 0 }
  ],
  "exercises": [
    { "exerciseNo": 1, "exerciseType": "fill_blank", "prompt": "I ___ (go) home yesterday.",
      "selfCheck": "句尾标点", "referenceAnswer": "went", "targetPoint": "irregular-past",
      "userAnswer": "goed", "isCorrect": false, "errorNote": "…" },
    { "exerciseNo": 1, "blockKind": "backfill", "blockNo": 1,
      "exerciseType": "translate", "prompt": "…" }
  ],
  "gradeSummary": { "exerciseCount": 7, "errorCount": 2, "byType": { "grammar": 2 } },
  "feedback": { "feedback": "just_right", "levelBefore": "Level 2", "levelAfter": "Level 2" },
  "nextRecommendation": "下一课继续练不规则过去式"
}
```

**成功（201 · created）**
```json
{ "code": 201, "message": "success", "data": {
  "id": 48, "lessonNo": 8, "levelCode": "Level 2", "status": "taught",
  "sectionCount": 3, "vocabCount": 1, "exerciseCount": 2, "errorCount": 2,
  "warnings": [] } }
```

**落库映射（四表）**

| 表 | 唯一键 | 来源字段 |
|---|---|---|
| `lessons` | `uk_lessons_no (student_id, lesson_no)` | `lessonNo` / `lessonDate` / `levelCode` / `summary` / `grammarPoint` / `feedback.feedback` / `sourceFile` / `status` |
| `lesson_sections` | `uk_section (lesson_id, section_type)` | `sections[]`（`sectionType` → `section_type`、`contentMd` → `content_md`、`orderIndex`） |
| `lesson_exercises` | `uk_exercise (lesson_id, block_kind, block_no, exercise_no)` | `exercises[]`（省略 `blockKind` 视为 `homework`，其 `block_no` **恒为 0**；`backfill` 必带 `blockNo`） |
| `vocabulary` / `lesson_vocabulary` | `uk_vocab_word` / `uk_lesson_vocab` | `vocabulary[]`（已存在的词**只补空字段、不覆盖释义**） |

- `status` 缺省 `taught` —— 与 `db/schema.sql` 的列默认值、以及现有 1—7 课的实际值一致
  （本项目的「归档」**不等于** `status='archived'`）
- 三项计数由 service **派生回写**：`vocab_count` / `exercise_count` = 子表行数；
  `error_count` 取 `gradeSummary.errorCount`（**作业口径、不含补漏块**），缺失则回落为作业块判错题数
  （与 `db:import` 的 `syncLessonCounts` 同一口径）
- ⚠️ **`error_type` 不写**：该列只由 Amy 人工判定（`records/` → `npm run db:apply-error-types`），
  接口**既不接收也不推导**。新建行该列为 `NULL`，回填时保持既有值（LW8 / LW27）

**校验规则（与 `lesson-record.schema.json` 一致，不额外发明）**

| 字段 | 约束 | 违反 |
|---|---|---|
| `lessonNo` | 必填，≥1 整数；**同学生内已存在 → 409** | 400 / 409 |
| `levelCode` | 必填，`Level 1`—`Level 5` 之一 | 400 |
| `summary` | 必填非空，≤255 | 400 |
| `sections` | 必填，≥1 条；`sectionType` 取 `SectionType` 的 11 值且**同课不重复**；`contentMd` 非空 | 400 |
| `exercises[].exerciseNo` | 必填，≥1 整数；**同题块内不重复** | 400 |
| `exercises[].exerciseType` | 必填，6 值之一 | 400 |
| `exercises[].blockKind` / `blockNo` | `homework`（缺省）或 `backfill`；`backfill` 必带 `blockNo ≥ 1`，`homework` 的 `blockNo` 必须为 0 或省略 | 400 |
| `exercises[].prompt` | 必填非空；`selfCheck` ≤128；`isCorrect` 为布尔或 `null` | 400 |
| `vocabulary[].word` / `isNew` | 均必填；`word` ≤64 | 400 |
| `status` / `lessonDate` / `sourceFile` | 可选；分别取 3 值 / 形如 `2026-10-02` / 形如 `day-08-14.md` | 400 |
| `gradeSummary.exerciseCount` / `errorCount` | 若提供则两者必填，且为 ≥0 整数 | 400 |
| `feedback.feedback` / `levelBefore` / `levelAfter` | 若提供则三者必填，取值须合法 | 400 |

- 校验失败返回 400，`data` 为**字段级明细数组**（`[{field, message}]`）
- 深层结构（`sections[]` / `exercises[]` / `vocabulary[]`）与 §27 同理：`validate()` 只认浅层，
  逐层校验在 service 内完成，故错误码同为 400 但来源不同

**⚠️ 契约里没有落库点的字段 —— 不报错，进 `warnings[]`**

| 字段 | 现状 |
|---|---|
| `studyMinutes` | `lessons` 无该列 → **G5 维持降级**（是否加列属 R2 议题） |
| `knowledgePoints` | `knowledge_points` / `lesson_knowledge_points` 尚未建表（P1） |
| `skillRunIds` | `skill_runs` 尚未建表（P2） |

> 契约演进原则是「加字段不升版本、**忽略未知字段**」——但**静默丢弃与硬报错都不合适**。
> 故本接口把这类「收到了但没落库」的字段收进响应的 `warnings[]`，让调用方看得见。

**⚠️ 超出契约的一个可选扩展字段：`grammarPoint`**
`lessons.grammar_point` 是 `/api/lessons` 列表的可见列，但 `LessonRecord` **没有定义该字段**。
本接口按「加字段不升版本」**可选接收**（字符串 ≤128；缺省留 `NULL`）。
契约侧是否补写由 Skill 设计师定 —— **已登记为待确认项**；未定前不静默丢弃也不硬报错。

**写路径边界（两条必须知道）**
- 本接口只写**课程域四表**。`feedback` / `gradeSummary` / `nextRecommendation` 中与学习记录相关的部分
  **不由本接口写 `study_records`** —— 那是 `npm run teach:sync`（消费 `records/*.study-record.json`）
  与 `POST /api/study-records` 的职责，避免再造一条并行写路径。
- 第 8 课起 `db:import` **跳过 `lesson_no >= 8`**（零 DDL 守卫，见 `04-migration-and-roadmap`），
  两条路径不再写同一批表。

**Error**
- 400 `LessonRecord 校验失败`（+ 字段级明细）
- 409 `第 N 课已存在（id=…）—— POST 只新建；回填批改与反馈请用 PUT /api/lessons/<id>`

### 29. PUT `/api/lessons/:id` ★
**回填批改与反馈**（**部分更新**）。`:id` 是 `lessons.id` **主键**、**不是课号**
（第 7 课 `id = 47`）。

**Query**：`studentId`　**请求体**：`LessonRecord` 的**任意子集**（字段规则同 §28）

**成功（200）**
```json
{ "code": 200, "message": "success", "data": {
  "id": 48, "lessonNo": 8, "levelCode": "Level 2", "status": "taught",
  "sectionCount": 0, "vocabCount": 1, "exerciseCount": 2, "errorCount": 3,
  "warnings": [] } }
```

**语义（三条必须知道的）**
1. **部分更新**：只写请求里出现的字段；**未提供的字段保持原值** —— 不会把没传的
   `summary` / `level_code` 抹成 `NULL`（LW24）。
2. **子行只增改、不删**：小节 / 练习 / 词汇按各自唯一键 upsert；请求里没出现的子行
   **不会被删除**（与 `db:import` 同口径，LW28）。
3. **不改 `error_type`**：错误类型只能在 `records/` 与 `npm run db:apply-error-types` 里由 Amy 定，
   回填批改**不会覆盖**已判定的错误类型（LW27）。

**计数回写的阈值（关键）**
- 仅当该课 `lesson_no >= 8` 时回写 `vocab_count` / `exercise_count` / `error_count`；
- `lesson_no < 8` 的课**不动计数**（第 1—6 课是 Amy 手工口径：第 1 课 `exercise_count = 7`
  而 `lesson_exercises` 只有 4 行），并在 `warnings[]` 中说明原因（LW29 / LW30）。

**写路径选型（教学侧参考）**

| 场景 | 用哪条 |
|---|---|
| 批量回填历史 md（第 1—7 课） | `npm run db:export` → `db:import`（离线、幂等、可 `--dry-run`；已跳过 `lesson_no >= 8`） |
| 新一课讲完归档（第 8 课起） | `POST /api/lessons` |
| 批改完 / 收完难度反馈再回填 | `PUT /api/lessons/:id` |

**Error**：400 校验失败（+ 字段级明细）；404 `课程不存在：id=<id>`
（**跨学生同样是 404** —— 查询始终带 `student_id` 过滤）

---

### 30. POST `/api/mistakes` ★

**批量写入错词本条目**（Step 2b）。消费方：`mistake-analysis`（`docs/skills.md` §3.7）。
载荷口径＝ **R3「只喂原始错词条目」**（2026-10-01 负责人照准）：**只传错词本的一行 8 列**，
**不传** `MistakeAnalysisResult` 的 `before/after` 全状态、`patternHits`、`recurrenceWarnings`。

**Query**：`studentId`（默认学生）

**Body**

| 字段 | 必需 | 说明 |
|---|---|---|
| `lessonNo` | | 本批所属课号，作为条目未给 `courseNo` 时的默认值 |
| `items` | ✅ | 错词条目数组，**至少 1 条、最多 200 条** |

**`items[]`（＝`wrong-words.md` 的 8 列，逐列对应）**

| 字段 | 必需 | 对应列 | 说明 |
|---|---|---|---|
| `wrongText` | ✅ | 错误点 | 落库存**原始文本**；判重键由它派生。≤512 字符，**不得含全角括号批注**（见下 DQ1 守卫） |
| `correctText` | ✅ | 正确形式 | ≤512 字符（库内 `NOT NULL`） |
| `errorType` | ✅ | 类型 | `grammar / spelling / punctuation / word_choice / capitalization / other` |
| `wrongCount` | ✅ | 累计犯错 | ≥1，**人工判定值**，服务端**不推导** |
| `errorReason` | | 错因 | ≤512 字符（批注写这里，不写 `wrongText`） |
| `streak` | | 连续答对 | ≥0，默认 `0` |
| `status` | | 状态 | `pending` / `passed`，默认 `pending` |
| `courseNo` | | 课号 | ≥1；默认取 `lessonNo` |

**落库映射**（`mistakes` 表）

| 入参 | 列 | 命中既有行时 |
|---|---|---|
| `wrongText` | `wrong_text` | 覆盖（写本次原文） |
| `correctText` | `correct_text` | 覆盖 |
| `errorType` | `error_type` | 覆盖 |
| `errorReason` | `error_reason` | 覆盖 |
| `streak` | `streak` | 覆盖 |
| `wrongCount` | `wrong_count` | **覆盖（人工值为准）** |
| `status` | `status` | 覆盖 |
| `courseNo` | `first_lesson_id` | **新建时**取课号；**命中时冻结不动**（「首次出错课」是历史事实） |
| `courseNo` | `last_lesson_id` | **新建时**取课号；**命中时按 `max(现有课号, 本次课号)` 单调刷新**（「最近一次出错课」随复发前进，见下语义 9） |

**语义（与 `db:sync-mistakes` 逐列同口径 —— 共用 `normKey` 与列白名单，不是两套实现）**

1. **判重键 = 规范化 `wrongText`**（去全角括号批注 → 折叠空白 → 小写），**只在本人范围内**比对。
   自定义「同键」即视为**同一行**：命中 → 更新；未命中 → 新建。
2. **落库一律写原始文本**，规范化**只用于找行**，绝不把规范化结果写进 `wrong_text`。
   （库唯一键 `uk_mistakes_text(student_id, wrong_text)` 建在**原始列**上，故判重必须在应用层做。）
3. **`error_type` / `wrong_count` / `streak` / `status` 一律取入参、服务端绝不推导**
   （`docs/ai-teacher.md` §11.7：后两列无法从其他列推导）。
4. **人工值为准 + 差异告警**：`wrong_count` 以入参覆盖写；若库内自动累计值 ≠ 人工值，
   在 `warnings` 中**逐条**记明 `库内自动累计值 X ≠ 人工判定值 Y（可能含未留档的复发）→ 已按人工值覆盖`。
   `POST /api/mistakes/:id/review` **只做 `+1` 增量**，不覆盖人工判定。
5. **DQ1 守卫**：`wrongText` 含全角括号批注（`（…）`）→ **400**。
   错词本硬规范是「错误点只写错误形式本身」；若写接口原样落库，批注会进 `wrong_text`，
   将来被唯一键拆成两行 —— 正是 DQ1 的成因。
6. **幂等**：同一 payload 重复提交，第二次起 `created=0` / `unchanged=N`。
7. **单事务**：任一条失败整批回滚（400 时一行不入库）。
8. **批内同键 → 400**（不静默取一条，避免把上游缺陷藏起来）。
9. **课号两列口径（`docs/ai-teacher.md` §11.11）—— 两列语义不同，不是同一件事**：
   - `first_lesson_id`（**首次**出错课）→ **冻结**，命中时永不改写。
     它被快照 `recentLessons[].mistakeCount`（＝本课**新引入**错词数）消费，一改就失真。
   - `last_lesson_id`（**最近一次**出错课）→ 命中时按 `max(现有课号, 本次课号)` **单调刷新**。
     「本次课号」取值优先级：`items[].courseNo` → 顶层 `lessonNo`。
     **刻意不采**错词本 8 列里的「课号」（那是**首次**课号，人工填、已冻结）。
     `max` 守卫是必须的：两条写入路径都可能**重放旧批次**，无守卫会让 `last` **倒退**。
   - 本次课号不大于现有值时定则返回「不改」→ 该行仍计 `unchanged`（**课号刷新同样幂等**）。
   - `first_lesson_id` 为 `NULL` 的行（「诊断」来源）后续命中**也不补填**。
   - 定则唯一实现：`src/utils/mistakeLesson.js`（本接口与 `db:sync-mistakes` 共用）。

**响应 200**

```json
{ "code": 200, "message": "success", "data": {
  "created": 1, "updated": 1, "unchanged": 0, "total": 2,
  "items": [ { "id": 151, "action": "updated",   "wrongText": "MW recieve",
               "status": "pending", "wrongCount": 2, "changed": ["wrong_count"] },
             { "id": 152, "action": "created",   "wrongText": "MW a new one",
               "status": "pending", "wrongCount": 1 } ],
  "warnings": [ "「MW recieve」wrong_count：库内自动累计值 1 ≠ 人工判定值 2（可能含未留档的复发）→ 已按人工值覆盖" ] } }
```
（上例为 **2026-10-01 实测原样**，`test:write` MW 系列产出。）

**Error**
- 400 `批量错词校验失败` + 字段级 `data: [{field, message}]`，`field` 形如 `items[0].wrongText`
- **不返回 404/409**：本接口只增改本人错词，不涉及跨资源寻址

---

## 四、错误路径实测样例

**404 · 资源不存在**
```
GET /api/lessons/999
→ 404  { "code": 404, "message": "课程不存在：id=999", "data": null }
```

**400 · 参数校验失败**
```
GET /api/mistakes?status=xxx
→ 400  { "code": 400, "message": "参数校验失败",
         "data": [ { "field": "status", "message": "取值必须是 pending / passed 之一" } ] }
```

**404 · 路由不存在**
```
GET /api/not-exist
→ 404  { "code": 404, "message": "接口不存在：GET /api/not-exist", "data": null }
```

**409 · 唯一键冲突（「当天不覆盖」）**
```
POST /api/readings?studentId=1   （date 已存在）
→ 409  { "code": 409, "data": null,
         "message": "该日期已有阅读：2026-09-30 —— 「当天不覆盖」；确需重出请显式传 force=true" }
```

**400 · 嵌套结构校验（字段级明细）**
```
POST /api/readings?studentId=1   （levelCode 非法 + pieces 为空）
→ 400  { "code": 400, "message": "ReadingSet 校验失败", "data": [
           { "field": "levelCode", "message": "必填，取值必须是 Level 1 / Level 2 / Level 3 / Level 4 / Level 5 之一" },
           { "field": "pieces",    "message": "必填，至少 1 篇" } ] }
```

**400 · 批量错词：DQ1 守卫（错误点不得夹带括号批注）**
```
POST /api/mistakes?studentId=1   { "items": [ { "wrongText": "MW go to school（批注）",
                                                "correctText": "MW x", "errorType": "grammar", "wrongCount": 1 } ] }
→ 400  { "code": 400, "message": "批量错词校验失败", "data": [
           { "field": "items[0].wrongText",
             "message": "不得夹带全角括号批注（批注请写 errorReason）——「错误点只写错误形式本身」" } ] }
```

---

## 五、与设计稿的差异（需其他 Agent 同步）

`backend/docs/03-api-contract.md`（设计稿）曾定义响应包络为 `{success, data, meta}`。
**本次按项目负责人指定改为 `{code, message, data}`**，以本文档为准。差异：

| 项 | 设计稿 | 已实现 |
|---|---|---|
| 成功包络 | `{success:true, data, meta}` | `{code:200, message:'success', data}` |
| 分页位置 | `meta.{page,size,total}` | `data.{list,total,page,size}` |
| 失败包络 | `{success:false, error:{code,message}}` | `{code, message, data:null}` |
| 路径前缀 | `/api/v1` | `/api`（第一阶段不带版本号） |

> 影响面：前端工程师与 Skill 设计师按**本文档**对接；`03-api-contract.md` 保留作为长期契约参考。

### 5.1 课程写入路径切换（Step 2a · 需 Skill 设计师 / 数据侧同步）

**背景**：课程数据历史上只有一条写入路径 —— 迁移管线 `db:export → db:import`（消费 Skill 侧产出的
`md`）。Step 2a 新增了第二条路径 —— `POST /api/lessons` / `PUT /api/lessons/:id`（消费 `LessonRecord` JSON）。
两条路径写的是**同一批表**（`lessons` / `lesson_sections` / `lesson_exercises` / `lesson_vocabulary`
/ `vocabulary`），若同时活跃会出现「同课两产出者」的双写风险。

**已定口径（项目负责人 2026-10-01 拍板）**：

| 项 | 口径 |
|---|---|
| 切换点 | **第 8 课** |
| 第 1—7 课 | 维持历史路径（`db:import`），已入库不回溯 |
| 第 8 课起（阶段 B） | 写入路径 = **`POST/PUT /api/lessons`**（API） |
| 阶段 B 的 `md` | **仍产出、不入写路径**（保留为人类可读落地形式） |
| `db:import` | 退化为**历史回填 + 只读校验**工具 |

**双写守卫（已落地）**：`db:import` 顶部对 `lesson_no >= WRITE_API_FROM_LESSON_NO (=8)` 的课
**整课跳过**并逐条 `warn()`，避免误用旧管线覆盖 API 写入的数据。

- 常量双份同源：API 侧 `src/services/lesson.service.js` 与导入器侧 `db/migration/import_json.js`
  各持一份 `WRITE_API_FROM_LESSON_NO = 8`，语义同源、改动须成对。
- `db:import --dry-run` 行为零变化（`±0`）；仅当快照真含 `lesson_no >= 8` 时才打印
  `写路径已切 API 跳过 N`。
- **未采纳** `lessons.write_source ENUM('import','api')` 方案（需走 DDL 规程，且 `lessons.status`
  语义是生命周期、不可复用；课号判定已足够，零 DDL）。

> 影响面：**Skill 设计师** —— 归档步产出的 `LessonRecord` 自第 8 课起即为唯一权威写入源；
> **Amy** —— 第 8 课起 `lesson_exercises.self_check` 等字段必须随 `LessonRecord` 一起落库
> （见本文档 §28 落库映射表）。`docs/skills.md` §7.2 已同步本口径。

---

## 六、前端对接确认项（be-dev 答复，2026-09-30）

对应 `docs/plans/frontend-plan.md` §11.3 的 **V1 / C6 / C8 / C9 / C10**。

### V1 · 正常链路真机验证 ✅ 已跑通 26/26

- 方式：启动后端（4000）→ `NODE_PATH=<workspace>/node_modules node .workbuddy/tmp/e2e-reading.js up`
  （Playwright + 本机 Edge，`file://` 直开页面；脚本已由前端备好）。
- 结果：**pass=26 fail=0**（§11.2 写的「约 26 项」吻合）。关键读数：
  - 看板 `阅读篇数 = 11`、`title = 读了 4 天 ｜ 最近 2026-09-29 ｜ 连续 4 天`、无错误横幅
  - 阅读页默认 `2026-09-29`、当天渲染 3 篇、计数 `第 1 / 3 篇`、源文件 `read\2026-09-29-read.md`、
    `无 iframe`、同页目录 4 条 + **唯一** `.on` 高亮、F8 提示可见（未生成分支，因今天 09-30 尚未读）
  - 理解题折叠 + 作答框、作答 localStorage 刷新留存、箭头/键盘翻页与禁用态、`#2026-09-26` 深链 2 篇
  - **逐日遍历 4 天累计 11 篇 = `stats.pieceCount`**（内容零丢失）
- 截图：`.workbuddy/tmp/r1-board.png`、`.workbuddy/tmp/r1-reading.png`。
- 性质说明：**该验证不写库**（仅浏览器 localStorage）；跑完读数仍为 `readings/reading_pieces/reading_questions = 4/11/22`。
- 错误态（后端离线）此前已 13/13。

### C6 · `questions[].answer === null` 时只出题干、不给「看答案」 → **与教学口径一致，确认**

| 层面 | 事实 |
|---|---|
| 契约 | `reading-set.schema.json` 的 `ReadingQuestion.required = [questionNo, question, answer]` 且 `answer.minLength = 1` ⇒ **答案必填非空** |
| 写入 | `POST /api/readings` 遇空/缺 `answer` → **400**（`ReadingSet 校验失败` + 字段级明细） |
| 数据 | 库内实测 **22/22 题均有答案，0 条为空** |

- 结论：`answer === null` 属**绕过契约的脏数据**（人工 SQL 直改等）。前端「只出题干、不给『看答案』」是**正确的防御式渲染**，符合「不伪造数据」原则 → **保持不变**。
- 建议（可选）：把该分支当**异常信号**，文案与正常态区分开（如「本题答案缺失（数据异常）」），便于暴露脏数据。
- **列保持 nullable 是有意的**（读路径优雅降级）；**不建议**改成 `NOT NULL`，以免未来「先答后给答案」的教学形态被表结构卡死。

### C8 · `POST /api/readings` 现已开放（原「未开放」前提作废）

- 2026-09-30 已实现并开放（`f969e9f` / `5932365` / `bbd96b1`），契约见本文档 **§27**。
- 「**本轮前端不需要写入口**」这一结论不受影响；但 §11.3 中 C8 的**理由已失效**，
  状态应由 `⏳ 待定` 改为 `✅ 已开放（前端本轮不接写）`。
- 若后续要接写入口：请求体即 `ReadingSet`；同日已存在返回 **409**，重出需显式 `?force=true`；
  400 的字段级明细可直接交给 `UI.partError` 渲染。

### C9 · 阅读数据 md 与库冲突以哪边为准 → **md 为准；但经 POST 写入的天以库为准**

- **方向单向 `md → DB`**：`read/*.md` 是**作者源**（教学侧产出），库是**服务副本**。
  同一日期冲突 → **以 md 为准**，收敛手段是重跑 `npm run db:export` → `db:import`
  （**幂等**、可 `--dry-run` 预演），**不手改库**。
- **但存在第二条写路径**：`POST /api/readings` **直接写库、不落 md**。对「经 POST 新写、`read/` 无对应文件」的那些天，
  **库是唯一事实**，不存在「与 md 冲突」。
- 判定规则：该日期 `read/*.md` 存在 → md 为准；只在库（POST 写入）→ 库为准。
  两者**不会共存**：写入侧由「当天不覆盖 **409**」与导入器幂等 upsert 挡住。
- **当前实测无冲突**：`npm run db:compare` 对 readings 三项全绿（4 天 / 11 篇 / 22 题与 md 一致）。
- **前端无需处理**：前端只读 API/库、不读 md；这纯粹是**后端 / 教学侧的写入纪律**。

### C10 · 首页取值口径 → **确认，字段语义与文案一致**

| 字段 | 语义 | 实测值 | 前端用法 |
|---|---|---|---|
| `pieceCount` | **总篇数** | 11 | 文案「阅读篇数」✅ |
| `totalDays` | **阅读日数** | 4 | `title`「读了 N 天」✅ |
| `currentStreakDays` | **截至 `lastReadDate`** 的连续天数（**不要求 `lastReadDate` = 今天**） | 4 | `title`「连续 N 天」✅ |
| `lastReadDate` | 最近阅读日 | 2026-09-29 | 「今天是否已读」自判（见 C7） |
| `today` | **服务端**今日（APP 时区） | 2026-09-30 | 「今日」判定**请用这个**，勿用浏览器本地时间 |

- 现状实测：`阅读篇数 = 11`、`title = 读了 4 天 ｜ 最近 2026-09-29 ｜ 连续 4 天` —— **与 D3 暂定一致，确认无误**。
- ⚠️ **唯一提醒**：今天未读时（`lastReadDate !== today`），`currentStreakDays` 仍是「截至最近阅读日」的值，**不会因今天没读而归零**。
  若首页想表达「今天断了」，需另加判断，避免 `连续 N 天` 与「今天未读」并列产生歧义。

### 附：V1 期间后端侧附带发现（2026-09-30 已全部闭环）

V1 联调时，`npm run db:export` 报 `warnings=1`
（`exercises.errorType 需由 records.mistakeCandidates 与错词本对账后回填`），
`db:compare` 计数由 `match=13 diff=1 gap=1` 变为 `match=11 diff=3 gap=1` ——
因 Amy 新增 4 条错词 + 8 条文本改净，使错词本 23 vs 库内 19 同时触发「条数 / status 分布 / `wrong_text` 集合」三条差异（**总项数仍 15**）。

> **追记（2026-09-30）**：上述两项均已收口 —— `npm run db:sync-mistakes`（mistakes 逐字段对齐）
> 与 `npm run db:apply-error-types`（`error_type` **10 填 / 24 NULL**）落地后，
> `db:export` **`warnings=0`**、`db:compare` **`match=15 diff=0 gap=0`**（15 项全绿）。
> 详见 `04-migration-and-roadmap.md §五之三`。
