# 05 · API 参考（第一版 · 已实测）

> 状态：**已实现并实测**（2026-09-29）。本文档描述的是**可运行的真实接口**，非设计稿。
> 服务地址：`http://localhost:4000`　接口前缀：`/api`
> 冒烟测试：`npm run test:api`（**49 项全部通过**）；写接口正向验证：`npm run test:write`（**59 项全部通过**）
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
  "progress": { "currentLevel": "Level 2", "currentCourseNo": 6, "currentLessonNo": 6,
                "nextLessonNo": 7, "lastFeedback": "just_right", "easyStreak": 0,
                "upgradeFrozenUntil": 0, "lastClassDate": "2026-09-29" },
  "courseCatalog": [ { "lessonNo": 6, "lessonDate": "2026-09-29", "levelCode": "Level 2", "summary": "…" } ],
  "recentLessons": [ { "lessonNo": 6, "lessonDate": "2026-09-29", "levelCode": "Level 2",
                       "summary": "…", "grammarPoint": "一般过去时 was / were",
                       "vocabulary": ["yesterday", "last night"],
                       "feedback": "just_right", "mistakeCount": 6, "errorCount": 5 } ],
  "pendingMistakes": [ { "id": 5, "wrongText": "…", "correctText": "…", "errorType": "punctuation",
                         "streak": 1, "wrongCount": 3, "status": "pending", "priority": "high",
                         "firstCourseNo": 2, "lastCourseNo": 2, "lastReviewedAt": null } ],
  "pendingMistakeStats": { "total": 15, "byType": { "grammar": 8, "punctuation": 2 } },
  "errorTrend": { "windowSize": 6, "byLesson": [ { "lessonNo": 6, "errorCount": 5,
                  "byType": { "grammar": 4, "punctuation": 1, "word_choice": 1 } } ] },
  "readingCatalog": [ { "date": "2026-09-29", "pieceCount": 3,
                        "titles": ["Yesterday", "Tom's Bad Day", "Where Were You?"] } ],
  "backlog": null,
  "lastRecommendation": null, "lastIncomplete": null,
  "degradation": { "degraded": true, "reason": "…", "affected": ["backlog", "lastRecommendation", "lastIncomplete"] } } }
```
**硬约束**
- `pendingMistakes` / `errorTrend` 与 `/api/mistakes/pending`、`/api/lessons/error-trend` **同源复用**（同一 service，不另写排序）
- `pendingMistakeStats` **只统计 `status='pending'`**；`byType` 为 `errorType → count`
- `lastRecommendation` 形状 `{ lessonNo, text }`，取自最近一条 `feedback` 记录的 `payload.nextRecommendation`；无数据为 `null`
- **缺数据一律降级**（`null` / `[]` / 省略键）+ `degradation`，**绝不 500、绝不空串**
- `readingCatalog` 自 2026-09-30 起有真实数据源（`readings` 三表，**倒序、最多 30 天**）。
  **空数组代表「确实还没有阅读」，属于正常数据而非降级**，故不再计入 `degradation.affected`。
  判断「当天是否已生成阅读」用 `readingCatalog[0].date === 今天`
- `errorTrend.byLesson[].byType` 取自对应课 `study_records(record_type='grade').payload.byType`
  （2026-09-30 已回填第 1—6 课）；该课无数据时**省略 `byType` 键**，不编造 `{}`
- `pendingMistakes[].firstCourseNo/lastCourseNo` 用课号；来源课号为脏值（DQ4）时**省略该键**而不是塞 `null`
- 当前仍计入 `degradation.affected` 的只剩：`backlog`（待 `knowledge_points` 建表）、
  `lastRecommendation` / `lastIncomplete`（待教学侧在 feedback payload 写 `nextRecommendation`）

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
| `pieces[].sourceUrl` | 可选，字符串或 `null`；来源为新闻时填写 | 400（类型不符） |

- 校验失败返回 400，`data` 为**字段级明细数组**（`[{field, message}]`），如 `pieces[0].questions`
- **嵌套结构不由 `validate()` 处理**：`validate()` 只认浅层 `int` / `string` / `object`；
  `pieces` / `paragraphs` / `questions` 的逐层校验在 service 内完成，故错误码同为 400 但来源不同

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
