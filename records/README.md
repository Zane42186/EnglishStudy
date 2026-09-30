# records/ · 结构化批改归档（Amy 产出，后端消费）

> **状态：新增目录约定 · 2026-09-30**
> 提出方：Amy（应后端工程师请求）。用途：解决「`is_correct` / `error_note` 无法从批改散文推导」与「`error_type` / `wrong_count` 无法从错词本推导」两个缺口。
> 契约来源：`docs/schemas/grading-result.schema.json`（`GradingResult`）、`docs/schemas/common.schema.json`（`ErrorType` / `ExerciseType` / `ExerciseSetKind`）。
> **本目录是机器数据；`notes/*.md` 的「批改」段是人读数据。二者内容同源，但后端只准读本目录，禁止解析散文。**

---

## 一、文件命名与产出时机

| 文件 | 内容 | 产出时机 |
|---|---|---|
| `lesson-NN.grading.json` | 本课**作业**逐题判定（`kind: homework`） | 每次作业批改完成后 |
| `lesson-NN.backfill.json` | 本课**补漏块**逐题判定（`kind: backfill`） | 补漏块做完后（无补漏块则不产出） |
| `lesson-NN.review.json` | 本课**课前复习**判定（`kind: review`，含 `reviewOutcomes`） | 旧课回填用；新课由写接口直接落库，可不产出 |
| `exercise-error-types.json` | **第 1—6 课 34 道题的 `error_type` 逐题映射**（供 `lesson_exercises.error_type` 回填） | 一次性回填；此后随每日 records 同步 |

- `NN` 为两位课号（`lesson-01`…`lesson-99`），与 `notes` 中的课号一致。
- 一套题集一个文件：**作业与补漏块必须分开**（`kind` 不同，错误计数口径也不同）。
- 文件只增不改；同一课需要修正时重写该文件并在对话里说明（本目录无追加语义）。

---

## 二、后端怎么用（三条硬规则）

1. **只读本目录的 JSON**，不要从 `### 批改` 文字里做文本匹配提取 `isCorrect` / `errorNote`。文字匹不出一处错误对应哪一题，也判不出「用词 vs 语法」。
2. **字段映射**
   - `items[].verdict` → `lesson_exercises.is_correct`：`correct` / `correct_with_note` → `true`；`wrong` → `false`；`blank` → `null`（同时 `user_answer = null`）
   - `items[].errorNote` → `lesson_exercises.error_note`
   - `items[].revisedAnswer` → `lesson_exercises.revised_answer`（仅开放题）
   - `items[].userAnswer` → `lesson_exercises.user_answer`
   - `mistakeCandidates[]` → `mistakes`（判重键：规范化后的 `wrongText` + `errorType`；命中则 `wrong_count + 1`、`streak = 0`，不新建）
   - `summary` → `study_records(record_type='grade').payload`：`exerciseCount` / `errorCount` / `byType`
3. **错词本两列以 `wrong-words.md` 为准**：`类型`（= `error_type`）、`累计犯错`（= `wrong_count`）由 Amy 人工判定后写在错词本表里；本目录 `mistakeCandidates[].errorType` 必须与之逐条一致（同一错误两个来源给不同类型即为 bug）。

---

## 三、错误计数口径（与 `docs/ai-teacher.md` §11.4 一致）

- 单位：**一处 = 一个可独立改正的点**；填空题每个空算一处。
- 计入：选错词、语法形态、语序、大小写、标点、拼写。
- **不计入**：空题（`blank`）、正确但有更优表达（`correct_with_note`）、任务完成度问题（如「要求 1 句否定没写」）—— 只写进 `errorNote` 或 `note`。
- **补漏块错误单列**（`kind: backfill` 的 `summary.backfillErrorCount`），不计入作业 `errorCount`。
- 同一句同一处重复 → 计 1 处；同一错误出现在不同句子 → 分别计数。

### 历史回填的 `historicalErrorCount`（重要）

第 1—6 课是**回填数据**。原始 `notes` 的批改段只有文字（如「三处错误」），无法逐处复算，
因此本目录每个文件都带 `historicalErrorCount` = 库内 `lessons.error_count` 原值，
与按 §11.4 重算的 `errorCount` 并列保留：

| 课 | 重算 `errorCount` | 历史值 | 差异原因 |
|---|---|---|---|
| 1 | 5 | 3 | 原文只报「3 处」（按类型计数），本目录按「可独立改正的点」计 |
| 2 | 4 | 4 | 一致 |
| 3 | 2 | 2 | 一致 |
| 4 | 6 | 6 | 一致 |
| 5 | 1 | 2 | 历史值把补漏块错误并入作业；按现口径补漏块单列（见 `lesson-05.backfill.json`） |
| 6 | 6 | 5 | 历史值把 `at yesterday` 的两次出现合并计 1 处；按现口径跨句重复计 2 处 |

**处置建议（待 be-dev 决定）**：趋势判断（`error-trend`）目前依赖历史值 3/4/2/6/2/5。
若按重算值回改，趋势线会变成 5/4/2/6/1/6，可能影响「是否加速」的历史判定。
Amy 的建议是**保留历史值、从第 7 课起按现口径严格计数**，并在 API 上标注第 1—6 课为回填口径。
回改与否由 be-dev 评估，Amy 不自行改库。

---

## 四、Amy 的承诺

1. 从第 7 课起，**每课批改完成即产出本目录对应文件**，不再让后端从散文里猜。
2. `error_type` 判定严格按 `docs/ai-teacher.md` §11.5 的三步判定；判不出的一律 `other` 并标注「待人工复核」，**不猜**。
3. 判重先查错词本（判重键 = 去标点、去空格、统一小写后的 `wrongText`），命中则累加 `wrong_count`、不新建条目。
4. 本目录的数据与我写在 `notes` 里的批改必须同源；不一致时以**本目录**为准（因为它是机器契约）。

---

## 五、`wrong_text` 统一规范（2026-09-30 起）

**规范：`错误点` / `wrongText` 只写错误形式本身，不带任何括号批注。** 批注（复发次数、出现场景）写入 `错因` / `errorReason`。

原因：批注会让同一个错误在两个来源里长得不一样，迁移时按判重键 `uk_mistakes_text(student_id, wrong_text)` 会**把同一条错拆成两行**（DQ1 类问题的根源）。

### 5.1 本轮对账结果（records 18 条候选 vs 错词本 23 行）

| 项 | 数量 | 说明 |
|---|---|---|
| 逐字一致 | 18 | 候选 18 条全部能在错词本中找到同文本同类型的行（含跨课复发的 `play game`，第 4、6 课各一次） |
| 文本不一致 | 0 | 已全部统一（本轮修掉 8 条带批注的文本） |
| records 有、错词本无 | 0 | 无（4 条原属「候选但未入册」的错词已由错词本补入） |
| 错词本有、候选无 | 5 | 来自**课前复习/诊断**（`ReviewSession` 与诊断测试不在本目录覆盖范围），属正常 |

> **候选 ≠ 入册行**：`mistakeCandidates[]` 是「判错证据」，是否进错词本由 Amy 决定；两者文本必须一致，但数量可以不等（复习类错误只在错词本里）。

### 5.2 需后端执行的数据变更（第 1—6 课回填，共 12 处）

> **执行结果（2026-09-30，后端）**：12 处已全部落地；执行中另发现 **9 处**与错词本不一致
> （8 条 `error_reason` + 1 条 `correct_text`），经确认后一并同步 —— **实际共 21 处**，
> 由 `npm run db:sync-mistakes` 一次性写入（**4 条新增 + 13 条更新**）。
> 详见 `04-migration-and-roadmap.md` §五之三与 `docs/database.md` §九。

**A. UPDATE `wrong_text`（8 条，去批注）**

| DB id | 现值（带批注） | 改为 |
|---|---|---|
| 7 | `zane（人名小写）` | `zane` |
| 8 | `Do you like coffee.（句号结尾）` | `Do you like coffee.` |
| 12 | `play game（第 3 次犯：第 6 课写 were playing game）` | `play game` |
| 13 | `I am very busy.（题目要求「我们很忙」）` | `I am very busy.` |
| 14 | `those are their bags.（句首小写）` | `those are their bags.` |
| 16 | `at yesterday（I was busy at yesterday）` | `at yesterday` |
| 17 | `What were you yesterday.（问「昨天怎么样」）` | `What were you yesterday.` |
| 20 | `what do you do?（问「正在做什么」时）` | `what do you do?` |

> 后端此前只报了 2 条不对齐（id12、id17），实际同类问题是 **8 条**；建议一并修，否则每次重跑迁移都会新增行。

**B. INSERT（4 条新增，均已写入错词本）**

| 课号 | 错误点 | 正确形式 | 类型 | 累计犯错 |
|---|---|---|---|---|
| 1 | `work.So` | `work, so` | punctuation | 1 |
| 3 | `intrusting` | `interesting` | spelling | 1 |
| 3 | `Our teacher is Amy together.` | `Tom and I are students. Our teacher is Amy.` | word_choice | 1 |
| 4 | `Now, My` | `Now, my` | capitalization | 1 |

> 这 4 处当时已判错但**未登记进错词本**（漏登记），Amy 于 2026-09-30 补入。补入后错词本 19 → **23 条**（已过关 4 / 未过关 19），各类型分布变为 grammar 9 / word_choice 5 / capitalization 4 / punctuation 3 / spelling 2。

**C. 无需改动**：其余 11 条文本已与错词本逐字一致。

> ⚠️ `play game` 的 `wrong_count = 3` 中，records 只能追溯到 2 次（第 4、6 课作业）；第 3 次来自更早的未留档复发。按「以教学记录为准」保留 3，不因可追溯性下调。

### 5.3 `error_type` 逐题回填

`lesson_exercises.error_type` 已由 `npm run db:apply-error-types` 回填（2026-09-30）：**10 题有值 / 24 题 NULL**。
逐题值见 `exercise-error-types.json`：34 题中 10 题判错有类型（grammar 4 / punctuation 3 / capitalization 2 / word_choice 1），其余 24 题按口径保持 NULL。

判定规则（文件内 `rule` 字段同源）：
- `verdict` 为 `correct` / `correct_with_note` / `blank` → `null`
- `verdict` 为 `wrong` → 取该题**处数最多**的错误类型；并列时按 `grammar > word_choice > punctuation > spelling > capitalization` 取前者
- 一题只落一个 `error_type`；同题的其他类型写在 `error_note` 里，不落库
