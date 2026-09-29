# 03 · API 契约

> 状态：**设计稿**，尚未实现。所有接口遵循下方通用约定。
> Base URL：`http://localhost:4000/api/v1`

---

## 一、通用约定

| 项 | 约定 |
|---|---|
| 版本 | 路径带 `/api/v1`，破坏性变更升 v2 |
| 方法 | 查询 `GET`、新增 `POST`、整体更新 `PUT`、部分更新 `PATCH`、删除 `DELETE` |
| 认证 | 当前单用户：默认用户由服务端判定；请求头可选 `X-User-Id`。未来切换 Bearer Token，**接口签名不变** |
| 请求体 | `Content-Type: application/json`，UTF-8 |
| 时间 | ISO 8601，如 `2026-09-29`、`2026-09-29T13:27:39+08:00` |
| 分页 | `?page=1&size=20`（size ≤ 100），响应带 `meta.{page,size,total}` |
| 成功包络 | `{ "success": true, "data": …, "meta": {…} }` |
| 失败包络 | `{ "success": false, "error": { "code", "message", "details" } }` |

### 错误码表

| HTTP | code | 含义 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 入参校验失败，`details` 给字段级原因 |
| 400 | `INVALID_REFERENCE` | 引用了不存在的关联对象 |
| 400 | `INVALID_LEVEL` / `INVALID_FEEDBACK` | 枚举值非法 |
| 404 | `*_NOT_FOUND` | 资源不存在（如 `MISTAKE_NOT_FOUND`） |
| 409 | `CONFLICT` | 唯一键冲突（课号/单词/日期重复） |
| 500 | `DB_ERROR` | 数据库错误（对外不暴露 SQL） |
| 500 | `INTERNAL_ERROR` | 未预期异常 |

---

## 二、课程 Courses

### GET `/courses` — 课程列表
- **Query**：`level`、`q`（摘要关键词）、`from`/`to`（日期）、`page`、`size`
- **Response 200**
```json
{
  "success": true,
  "data": [
    { "id": 6, "lessonNo": 6, "lessonDate": "2026-09-29", "levelCode": "Level 2",
      "summary": "学会过去时 was / were，能说清「昨天怎么样」",
      "vocabCount": 10, "exerciseCount": 9 }
  ],
  "meta": { "page": 1, "size": 20, "total": 6 }
}
```

### GET `/courses/:id` — 课程详情
- **Response 200**：含 `sections`（按类型）、`vocabulary[]`、`exercises[]`、`mistakes[]`（本课相关）
- **Error**：404 `COURSE_NOT_FOUND`

### GET `/courses/latest` — 最近一课（等价「上次学到哪了」）
- **Response 200**：`{ "id", "lessonNo", "lessonDate", "levelCode", "summary" }`

### POST `/courses` — 新建课（归档一课时调用）
- **Request**
```json
{ "lessonNo": 7, "lessonDate": "2026-09-30", "levelCode": "Level 2",
  "summary": "规则动词过去式 -ed",
  "sections": { "review": "…md…", "grammar": "…md…" },
  "vocabulary": [ { "word": "worked", "phonetic": "/wɜːrkt/", "meaning": "工作（过去式）", "example": "I worked yesterday." } ] }
```
- **Response 201**：`{ "id": 7, "lessonNo": 7 }`
- **Error**：400 `VALIDATION_ERROR` / 409 `CONFLICT`（课号已存在）

### PUT `/courses/:id` — 更新课（含回填批改）
- **Error**：404 / 400 / 409

---

## 三、词汇 Vocabulary

| 接口 | 说明 |
|---|---|
| `GET /vocabulary?letter=A&q=&page=&size=` | 词汇卡列表（**按首字母分组所需**，对应 `words.html`） |
| `GET /vocabulary/:id` | 单词详情 |
| `POST /vocabulary` | 新增单词（`{word,phonetic,meaning,example}`） |
| `GET /vocabulary/stats` | `{ "total": 52, "byLetter": {"A": 3, "B": 5} }` |

- **Error**：404 `VOCABULARY_NOT_FOUND`、409 `CONFLICT`（同用户下单词重复）

---

## 四、阅读 Reading

| 接口 | 说明 |
|---|---|
| `GET /readings` | 阅读日列表（倒序），对应 `reading.html` 左侧目录 |
| `GET /readings/:date` | 某天全部篇目（含段落英中对照、生词注释、理解题） |
| `GET /reading-pieces/:id` | 单篇详情（对应卡片翻页） |
| `POST /readings` | 新增当天阅读（已存在 → 409，**与「当天不覆盖」规则一致**） |

- **Error**：404 `READING_NOT_FOUND` / `PIECE_NOT_FOUND`、409 `CONFLICT`

---

## 五、错词本 Mistakes（Amy 核心数据）

### GET `/mistakes` — 错词列表
- **Query**：`status=pending|passed`、`errorType`、`page`、`size`
```json
{ "success": true,
  "data": [ { "id": 12, "wrongText": "play game", "correctText": "play games",
              "errorType": "grammar", "errorReason": "可数名词单数不能裸用",
              "streak": 0, "wrongCount": 3, "status": "pending",
              "firstCourseNo": 4, "lastCourseNo": 6, "lastReviewedAt": null } ],
  "meta": { "page": 1, "size": 20, "total": 16 } }
```

### GET `/mistakes/pending` — 未过关错词（等价 `digest.md` 待复习段，直接供出题）
- **Response 200**：数组，按 `wrongCount DESC` 排序

### POST `/mistakes` — 新增错词
```json
{ "courseId": 6, "wrongText": "at yesterday", "correctText": "yesterday",
  "errorType": "grammar", "errorReason": "yesterday 前不加介词" }
```

### POST `/mistakes/:id/review` — 提交一次复习结果 ★
- **Request**：`{ "result": "correct" | "wrong", "courseId": 7 }`
- **服务端规则**：`wrong` → `wrongCount+1, streak=0, status=pending`；`correct` → `streak+1`，`streak≥2` → `status=passed`
- **Response 200**：`{ "id": 12, "streak": 2, "status": "passed" }`
- **Error**：404 `MISTAKE_NOT_FOUND`

---

## 六、进度 Progress

| 接口 | 说明 |
|---|---|
| `GET /progress` | `{ currentLevel, currentCourseNo, lastFeedback, easyStreak, upgradeFrozenUntil, lastClassDate }` |
| PUT `/progress` | 更新级别/课号（管理员式直改） |
| **POST `/progress/feedback`** ★ | 提交难度反馈并触发升降级 |

### POST `/progress/feedback`
- **Request**：`{ "courseId": 6, "feedback": "just_right", "note": "" }`
- **服务端规则**（对齐 `progress.md`）：
  - `too_easy`：`easyStreak+1`；若 `easyStreak==2` → 升 1 级并清零（受 `upgradeFrozenUntil` 约束）
  - `too_hard`：降 1 级，`upgradeFrozenUntil = 当前课号 + 3`
  - `just_right`：仅记录
- **Response 200**
```json
{ "levelBefore": "Level 2", "levelAfter": "Level 2",
  "easyStreak": 0, "upgradeFrozenUntil": 0, "message": "维持 Level 2" }
```
- **Error**：400 `INVALID_FEEDBACK` / `INVALID_LEVEL`、404 `COURSE_NOT_FOUND`

---

## 七、学习记录 Study Records

| 接口 | 说明 |
|---|---|
| `GET /study-records?from=&to=&type=` | 行为时间线 |
| `POST /study-records` | 写入一条（`{recordType, courseId, payload}`） |

---

## 八、看板 Dashboard

### GET `/dashboard/summary` — 等价 `review/index.html` 顶部 5 个统计卡
```json
{ "success": true, "data": {
  "courseCount": 6, "currentLevel": "Level 2", "vocabTotal": 52,
  "readingPieceCount": 11, "pendingMistakeCount": 16 } }
```

---

## 九、★ 给 Amy / Skill 的快照接口 Agent Snapshot

> 这是后端与 AI 侧最重要的契约：把当前人可读的 `digest.md` 变成**机器可读 JSON**，让 Amy 一次拿到「学过什么 / 错过什么 / 掌握什么」。

### GET `/agent/snapshot?recent=3`
**Response 200**
```json
{
  "success": true,
  "data": {
    "progress": {
      "currentLevel": "Level 2",
      "currentCourseNo": 6,
      "lastFeedback": "just_right",
      "easyStreak": 0,
      "upgradeFrozenUntil": 0,
      "lastClassDate": "2026-09-29"
    },
    "courseCatalog": [
      { "lessonNo": 4, "summary": "现在进行时 am/is/are + -ing" },
      { "lessonNo": 5, "summary": "一般现在时 vs 现在进行时" },
      { "lessonNo": 6, "summary": "过去时 was / were" }
    ],
    "recentLessons": [
      { "lessonNo": 6, "lessonDate": "2026-09-29", "summary": "…",
        "grammarPoint": "was / were 肯定、否定、疑问",
        "vocabulary": ["yesterday","last night","ago"],
        "feedback": "just_right", "mistakeCount": 5 }
    ],
    "pendingMistakes": [
      { "id": 12, "wrongText": "play game", "correctText": "play games",
        "errorType": "grammar", "errorReason": "可数名词单数不能裸用",
        "streak": 0, "wrongCount": 3, "priority": "high" }
    ],
    "readingCatalog": [ { "date": "2026-09-29", "pieceCount": 3, "titles": ["Yesterday","Tom's Bad Day","Where Were You?"] } ]
  }
}
```
- `recent` 控制 `recentLessons` 返回最近几课（默认 3）。
- 该接口把「取未过关错词并给优先级」的逻辑收敛到服务端，**Skill 无需自己解析 Markdown**。

### Skill 数据接口
| 接口 | 说明 |
|---|---|
| `GET /skills` | Skill 注册列表 |
| `POST /skill-runs` | 记录一次 Skill 执行（`{skillName, courseId, input, output, status}`） |
| `GET /skill-runs?skillName=&from=&to=` | 执行历史 |

---

## 十、接口 — 前端页面对照表

| 现有页面 | 迁移后调用的接口 |
|---|---|
| `review/index.html`（统计+课程卡） | `GET /dashboard/summary`、`GET /courses` |
| `review/reading.html` + `readIndex.html` | `GET /readings`、`GET /readings/:date`、`GET /reading-pieces/:id` |
| `review/words.html` | `GET /vocabulary/stats`、`GET /vocabulary?letter=` |
| `review/wrong.html` | `GET /mistakes`、`POST /mistakes/:id/review` |
| `lessons/lesson-N.html` | `GET /courses/:id` |
| `digest.md`（AI 读） | `GET /agent/snapshot` |
