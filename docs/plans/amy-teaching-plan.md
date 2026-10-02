# Amy 教学决策规则方案

> **状态：方案（待评审）· 2026-09-29**
> 作者：Amy（AI 英语老师）　收方：team-lead / skill-designer / be-dev / fe-dev
> 性质：**只做教学决策与规则定义**，不改数据库结构、不改 API 契约、不创建第 8 课正式课程文件。
> 规则权威来源：`docs/ai-teacher.md`（教学规则唯一来源）、`docs/skills.md`（3.6 error_type 判定、3.9 next-lesson-planning）、
> `backend/db/schema.sql`（枚举取值边界）、`docs/schemas/*.json`（Skill 契约）。
> 本文与上述文件冲突时，**以本文为准的只有「教学判定」部分**；字段与枚举取值一律不越界。

---

## 〇、读法与口径前置

### 0.1 证据分级（本文每条结论都带标记）

| 标记 | 含义 | 本文中的来源 |
|---|---|---|
| 【实】 | 2026-09-29 实测（接口 / 真机浏览器 / 直连 MySQL） | `docs/integration-report-01.md`、`docs/amy-session-07-plan.md`、`backend/docs/06-api-requirements-amy.md` |
| 【静】 | 静态证据：仓库文件明文，无需运行即可核对 | `progress.md`、`wrong-words.md`、`notes/day-01-07.md`、`read/*.md`、`docs/ai-teacher.md` |
| 【推】 | Amy 的教学推断，尚无数据支撑 | 本文新增的阈值与优先级，需实课校准 |
| 【未】 | 待他人确认后才能落地的事项 | 需 be-dev / skill-designer / fe-dev 处理 |

### 0.2 不改的既有口径（团队已确认，本文沿用）

| 口径 | 内容 |
|---|---|
| 错误处数 | 全系统唯一分数量口径，**不折算百分制**（`lessons.error_count`、`study_records(grade).payload.errorCount`） |
| 过关 | 同一错词连续答对 2 次 → `mistakes.status = 'passed'` |
| 复发 | 同一错词 `wrong_count >= 3` |
| 课号 | N = 实际最大课号 + 1，**断更不断号**；第 1—7 课写 `notes/day-01-07.md`，第 8 课起 `notes/day-08-14.md` |
| 交流语言 | 中文讲解，英语术语保留原文；不使用翻译工具，凭已学词原创句子 |
| 枚举 | `error_type` / `feedback` / `section_type` / `record_type` / `status` 一律沿用 `schema.sql` 现值，本文不新增取值 |

### 0.3 一处必须澄清的事实偏差

- 团队任务书写的是「当前 Level 2 Lesson 5，2026-09-28」；**仓库与数据库的实际状态是：已完成第 1—6 课，最近一课为第 6 课（2026-09-29）**。
  证据：`progress.md`「当前课号：6 / 上次上课 2026-09-29」【静】、`INDEX.md`【静】、`GET /api/progress → nextLessonNo=7`【实】、`GET /api/lessons → total=6`【实】、MySQL `lessons=6`【实】。
- 因此**严格按「N = 最大课号 + 1」的口径，下一课是第 7 课**，内容已在前一轮产出（`docs/amy-session-07-plan.md`：规则动词过去式 -ed + 补漏块 ④ 介词 on/at）。
- 本任务要求给「第 8 课」示范。本文的处理方式：
  - **主场景**：假设第 7 课已按上述计划上完（课号 7 已占用），则下一课 = **第 8 课**，第四章按此走规则；
  - **降级场景**：若第 7 课尚未上，则**把第四章的内容整体顺延为「第 7 课」执行**（课号由规则自动决定，内容不变），见 4.6。
- 库内数据口径（与仓库 md 的已知差异，供对照）：vocabulary 按 word 去重 **51**；mistakes **20**（pending 15 / passed 5），而 `wrong-words.md` 整理后为 **19**（15 / 4）【实，DQ1】。本课规划以 **md 为教学真相源**，差异作为向 be-dev 报的数据问题处理。

---

## 一、教学决策输入清单（Amy 决定「下一课教什么」要读什么）

> 用法：上课第一步按本表取数；「来源」列为 `backend` 模式（后端 API）与 `markdown` 模式（md 适配层）的对照。
> 状态图例：✅ 已可用 ／ ⚠ 只能从 md 读（降级）／ ❌ 缺口（需 be-dev）。

| # | 输入项 | 决定什么决策 | 契约字段 | 现在从哪来 | 由谁提供 | 状态 |
|---|---|---|---|---|---|---|
| I1 | 当前等级 `currentLevel` | 定级别、定知识点水平 | `snapshot.progress.currentLevel` | API `GET /api/progress`；md `progress.md` | be-dev | ✅【实】 |
| I2 | 最大课号 / 下一课号 | 定课号 N（断更不断号） | `snapshot.courseCatalog`、`nextLessonNo` | API `/api/lessons` + `/api/progress`；冲突时以 `notes/` 为准 | be-dev | ✅【实】 |
| I3 | 上次上课日期 → 距今天数 D | 断更衔接强度（见 2.5） | `progress.lastClassDate` | API `/api/progress`（天数由 Amy 计算） | be-dev | ⚠ 期望服务端直接给 `daysSinceLastClass`（便利项，非阻塞） |
| I4 | 最近 3 课明细（语法点 / 词汇 / 批改条数 / 反馈） | 主题衔接、判断旧点是否稳定 | `snapshot.recentLessons[]` | API `/api/lessons?size=3` + `/latest`；md `digest.md` | be-dev | ✅【实】 |
| I5 | 错误趋势（近 6 课 errorCount） | 是否加速 / 是否降难度 | `snapshot.errorTrend.byLesson[]` | API `/api/lessons/error-trend?limit=6` | be-dev | ✅【实】G1 已关闭 |
| I6 | 错误趋势的**类型分布**（每课 byType） | 判断是理解问题还是产出问题 | `errorTrend.byLesson[].byType` | ❌ 无（契约已定义，后端未返回） | be-dev | ❌ **缺**（见 1.1 需求 N1） |
| I7 | 未过关错词池 | 出复习题、定自查项、判断是否复发 | `snapshot.pendingMistakes[]` | API `/api/mistakes/pending?limit=20` | be-dev | ✅【实】（DQ2 `wrong_text` 含批注；DQ5 `lastReviewedAt` 全 null） |
| I8 | 全部错词与类型统计（含已过关） | 错误画像、归类统计 | — | API `/api/mistakes/stats`、`/api/mistakes?status=passed` | be-dev | ⚠【实】与 md 差 1 条（DQ1） |
| I9 | **错词复发明细**（每个错词在哪几课犯过、每次的形式） | 「复发 ≥3」判定是否正确、`wrongCount` 能否回溯 | 无 | ❌ 无（`mistake_events` 无读接口） | be-dev | ❌ **缺**（需求 N2） |
| I10 | 词汇总表与是否曾是错词 | 生词去重、词汇量汇报 | — | API `/api/vocabulary?q=`、`/stats` | be-dev | ✅【实】（两套口径 DQ3：51 vs 52） |
| I11 | 词汇**复现度**（某词出现在几课课文/例句/阅读） | 选材复用比、阅读生词率 | 无 | ❌ 无 | be-dev | ❌ **缺**（P2，需求 N3） |
| I12 | 待补知识点 / 补漏队列 | 取本课 backfill 块 | `snapshot.backlog` | ⚠ md `progress.md`（非 API 数据） | be-dev | ❌ **缺**（R6 / G3） |
| I13 | 上次未完成动作 + 上一课 `nextRecommendation` | 断更后从哪儿接、决策可追溯 | `snapshot.lastIncomplete` | ❌ 无（依赖写接口 R5 才有数据） | be-dev | ❌ **缺**（R5 / G4） |
| I14 | 自评难度历史序列 | 升降级连击、趋势 | `recentLessons[].feedback` | API `/api/lessons` | be-dev | ✅【实】 |
| I15 | `easyStreak` / `upgradeFrozenUntil` | 升级是否可执行 | `snapshot.progress` | API `/api/progress` | be-dev | ✅【实】 |
| I16 | **Amy 的准确度冻结（R1）状态** | 是否允许升级（守门） | 无 | ⚠ 仅 `progress.md` 备注 | Amy 自持 | ⚠ 不落库（有意保持，见风险 O-6） |
| I17 | 阅读目录 & 当天是否已生成 | 是否生成当日阅读（一天一档不覆盖） | `snapshot.readingCatalog` | ⚠ md `read/*.md` | be-dev | ❌ **缺**（R7） |
| I18 | 单课时长 | 汇报与节奏控制 | `lessons.study_minutes` | ❌ 未填（G5） | Amy 归档时传 | ❌（约定 Amy 传，见 R4） |
| I19 | **按题型的正确率**（选择/填空 vs 开放造句） | 区分「理解层」与「产出层」 | 无 | ❌ 无 exercises 接口 | be-dev | ❌ **缺**（需求 N4） |
| I20 | 学生画像与目标 | 选材贴近度、讲解语言 | `students.target` | ⚠ md `PROJECT.md` / `progress.md`；DB `students` | be-dev | ⚠ 无专用接口（不阻塞） |

### 1.1 缺什么、向谁要（发给 be-dev 的需求，编号接续 `06-api-requirements-amy.md` 的 R1—R7）

| 编号 | 需求 | 优先级 | 为什么教学必须它 | 阻塞的决策 |
|---|---|---|---|---|
| **N1** | `GET /api/lessons/error-trend` 的 `byLesson[]` 补 `byType`（`{grammar:2,punctuation:1}`），契约已定义 | P1 | 只看错误总数会把「不懂」和「写错」混为一谈（`ai-teacher.md` 2.5 的核心结论） | 2.2 是否降级、3.2 归因 |
| **N2** | 错词复发明细：`GET /api/mistakes/:id/events`，或 `pendingMistakes[]` 增 `events: [{lessonNo, wrongText, verdict}]` | P1 | 现在 `wrongCount` 是黑盒数字，无法核对「第 3 次」到底记了哪三次 | 2.3 自查触发、3.1 复发判定 |
| **N3** | 词汇复现：`GET /api/vocabulary/:id/usages` 或 `stats` 增 `byLessonCount` | P2 | 没有它，「复用 ≥ 新词」只能靠 Amy 翻笔记 | 2.4 选材比例 |
| **N4** | `GET /api/lessons/:id/exercises`（含 `exerciseType` / `userAnswer` / `verdict` / `errorType`） | P1 | 「选择题全对、写句子出错」是本学生最关键的教学结论，目前无法用数据证明 | 2.2 双轨判定（理解 vs 产出） |
| **N5** | 重申 R6 `GET /api/knowledge-points`（含 `status` / `role`，需覆盖 Level 1 欠账与 Level 2 主线） | P0 | 补漏队列与 level-map 目前只存在于 md，一旦 md 丢写，教学顺序就断 | 2.1 选点、2.1 欠账优先 |
| **N6** | 重申 R1 `GET /api/agent/snapshot`（聚合）+ R5 `POST /api/study-records` 带 `payload.next_recommendation` | P0 | 决策可追溯性：没有它，「为什么这一课教这个」无法回看 | 全部决策复盘 |
| **N7** | 重申 R7 `GET /api/readings`、并补 `GET /api/readings/:date`（含理解题与作答） | P1 | 判断「当天阅读已存在」目前靠扫目录；理解题正确率无处可记 | 2.4 阅读、I17 |
| **N8** | 数据修复：DQ1（20 vs 19）、DQ2（`wrong_text` 含批注）、DQ5（`lastReviewedAt` 全 null） | P0 | DQ1 直接导致 Amy 的错词计数与教学记录不一致 | I7 / I8 |
| **N9** | `GET /api/progress` 增 `daysSinceLastClass`（可由 `lastClassDate` 现算） | P2 | 省一次手算，降低出勤类决策出错概率 | 2.5 断更衔接 |

> 边界声明：以上全部是**教学侧读取需求**。是否新增字段/表、如何命名，由 be-dev 定，Amy 不介入数据模型。

---

## 二、决策规则（可执行判定表）

> 统一记号：`E_k` = 第 k 课作业错误处数；`F_k` = 第 k 课反馈（`too_easy`/`just_right`/`too_hard`）；
> `R = 本课复习/作业中「复发项」（wrongCount>=3）再次出现的个数`；`D` = 距上次上课天数。

### 2.1 下一课主题 / 语法点怎么选（优先级链，逐条判定，命中即停）

| 优先级 | 条件 | 选点动作 | 依据 / 证据 |
|---|---|---|---|
| **P0** | 学生指定主题（`topicOverride`） | 用该主题，**但 backfill 与 selfChecks 不变**，且本课仍须保留 1 条可判定的 objective | `docs/skills.md` 3.9「学生主题优先」【静】 |
| **P1 复发阻断** | 存在错词 `wrongCount >= 4`（即复发后又再犯一次），且其错误类型为 `grammar` | **本课不讲新语法点**，改为「巩固产出课」：只练 1 个已学知识点的产出（3—5 道写句题）+ 复习 6—8 题 + 1 篇综合阅读 | 【推】由 `play game` 3 次仍未过关反推；第 4/6 课新点首课错误冲高（6 / 5）【实】说明「理解已够、产出不稳」，此时再堆新点只会增加错词本增速 |
| **P2 欠账前置** | 新点存在未修的前置欠账（如未学 did 就要学过去时疑问） | 先补前置：把该欠账提升为**本课 new point**，原新点顺延 | 【推】教学常识 + R2「升级不豁免欠账」【静】 |
| **P3 主线推进（默认）** | 其余情况 | 取当前级别 level-map 中**下一个未学知识点**（每次 1 个，同一家族一次讲全：肯定 / 否定 / 疑问 / 拼写规则） | `progress.md`「新语法点仍为每课 1 个，家族一次讲全」【静】 |
| **P4 降级回补** | 上一课触发降级（2.2 的 D 类） | new point 取**降级后级别**中最近一个未覆盖点；已完成 backfill 不重排 | `docs/skills.md` 3.9「刚降级」【静】 |

**当前 Level 2 level-map（主线顺序，取自 `ai-teacher.md` 2.6 + 第 7 课计划）**【静 + 推断】

```
L2-01 主谓宾语序(已学,第1课) → L2-02 be动词(第2课) → L2-03 物主代词(第3课)
→ L2-04 现在进行时(第4课) → L2-05 时态辨析(第5课) → L2-06 过去时 was/were(第6课)
→ L2-07 规则动词过去式 -ed(第7课·计划) → L2-08 常用不规则过去式 ← 第 8 课
→ L2-09 过去时否定/疑问 did → L2-10 will / be going to → …（Level 3 起：比较级、从句，暂缓）
```

**衔接约束（防止跳跃）**：新语法点必须与最近 3 课中**至少一课**存在直接依赖（如 `-ed` → `不规则过去式` 同属过去时；`was/were` → `-ed` 互补）。不满足则插入一节「衔接课」取两者中间的依赖点【推】。
**暂缓清单**：比较级 / 最高级 / 从句类 —— 明确不出现在 Level 2 主线内【静，`ai-teacher.md` 2.6】。

### 2.2 难度升降级：判定表（按行从上往下首次命中即执行）

判定顺序：先看反馈，再看错误处数，最后看是否复发。

| # | 条件 | 动作 | 落库 |
|---|---|---|---|
| A1 | `F_N = too_easy` 且 `E_N <= 2` 且 `R = 0` 且 `easyStreak` 达到 2 | **升 1 级**，连击清零；上级未学点转 backfill（R2，不回头成课） | `POST /progress/feedback`（R3） |
| A2 | `F_N = too_easy` 且 `E_N <= 2` 且 `R = 0` 且 `easyStreak` 为 0 | 维持级别，`easyStreak = 1`，写解锁条件（下次仍须 `E<=2 且无复发`） | 同上 |
| A3 | `F_N = too_easy` 但 `E_N >= 3` 或 `R >= 1` | **维持级别，`easyStreak` 归零**，冻结升级（R1 准确度守门）并写明解锁条件 | ⚠ 只在 `progress.md`；**不复用 `upgrade_frozen_until`**（语义不同，`ai-teacher.md` 7.3） |
| B1 | `F_N = just_right` 且 `E_N <= 2` 且连续 2 课满足 | 维持级别；登记为「加速候选」，允许出现第 2 个知识点的**试探**（R3） | 同上 |
| B2 | `F_N = just_right` 且 `3 <= E_N <= 4` | 维持级别，常规推进（目标带） | 同上 |
| B3 | `F_N = just_right` 且 `E_N >= 5` | 维持级别，**不降级**；转为「巩固模式」：下一课词汇量降档、去掉试探第二点、必带自查项 | 同上 |
| C1 | `F_N = too_hard` 且 `E_N <= 5` | **降 1 级**，`upgrade_frozen_until = N+3`（3 课内不升） | R3 已定义【静】 |
| C2 | `F_N = too_hard` 且 `E_N >= 6` | 降 1 级 + 冻结至 N+3 + **下一课不讲 new point**（只复习 + 重讲 + 一篇短阅读），词汇降到 5—8 | 【推】 |
| C3 | 连续 2 次 `too_hard` | 降 1 级 + 触发一次 **10 题诊断**（`exerciseSet.kind='diagnostic'`），按诊断结果重排 backfill 队列（同第 5 课前做法） | 【静】第 5 课前诊断实例【实】 |
| D1 | 新语法点首课 `E_N >= 6`，但反馈非 `too_hard` | **不降级**，归因新知识点；下一课用「同点变式」复练（换题材不换点），不算新点 | 第 4 课 E=6 但第 5 课回落到 2【实】 |
| E1 | `E_{N-1} <= 2` 且 `E_N <= 2` 且最近反馈 `too_easy` | 允许**一课 2 个知识点**的试探（R3）；若该课 `E >= 5` 立即回退到 1 点并暂停 3 课 | 【静】R3 原规则 + 【推】回退条件 |

**错误处数的阈值带（Level 2）**【推，待实课校准】：

| 区间 | 含义 | 处置 |
|---|---|---|
| `E <= 2` | 达标 | 可推进 / 可考虑加速 |
| `3 <= E <= 4` | 目标带 | 常规推进 |
| `E >= 5` | 超阈 | 巩固优先：降词汇量、禁第二点、必带自查项 |
| `E >= 7` | 异常 | 须复核是否为「新点首课」（D1）或断更后夹带（见 2.5），否则触发 C 类 |

**双轨禁令（防误判，重要）**：`E` 里**只由书写规范类**（`punctuation` / `capitalization` / `spelling`）构成的部分，**不得单独触发降级**；它触发的是「自查项 + 每课开场五条」。升降级只看整体性的理解错误（选择题/填空题的 `grammar` / `word_choice` 错）。【推】依据：本学生「理解 ≈ Level 2、产出 ≈ Level 1 末段」【静，`ai-teacher.md` 2.5】。
> ⚠ 该规则目前**只能靠题型拆分来判定**，而题型拆分依赖缺项 I19/N4；在 N4 未实现前，Amy 按批改正文人工区分并记录在 `grading` 段。

### 2.3 强制自查项（selfChecks）触发与退出规则

| 规则 | 内容 | 依据 |
|---|---|---|
| **触发 T1（复发）** | 错词 `wrongCount >= 3` 且 `status = pending` → 生成对应自查项 | 口径已定【静】；`play game` 3 次【实】 |
| **触发 T2（类型复发）** | 同一 `error_type` 在**近 3 课**累计 ≥ 3 处 → 生成类型级自查（例：疑问句结尾问号） | 问号类 ≥3 次【实】 |
| **触发 T3（新形态规则）** | 本课新讲了形态规则（-ing / -ed / 复数 / 三单 / 不规则）→ 本课及**其后 1 课**自动带对应自查 | 第 4 课 `-ing` 后仍反复漏 be【实】 |
| **排序上限** | 候选 > 2 条时，**按 `wrongCount` 降序取前 2**（复发类优先于类型类） | 与 `docs/skills.md` 3.9 一致（最多保留 2 条最重要的）【静】 |
| **退场 X1** | 已进入「每课开场五条」的固定项（句尾标点属此类）不占 selfChecks 名额，除非其类型级复发在近 2 课 ≥ 2 次再次出现 | 【推】避免名额被常驻项长期占用 |
| **退场 X2** | 触发它的错词 `status = passed` **且**后续 1 课未再犯 → 退出；否则保留 | 【推】防止「一答对就撤」导致回弹 |
| **呈现** | 逐条写在作业说明里；前端须做成**提交前的勾选闸门**（见第五章 F4） | 【推】依据「瓶颈不是没学过，是写时不自查」【静】 |

### 2.4 词汇与阅读材料选取规则

**词汇量**（默认按 progress.md 的过渡期方案，与 schema 描述的差异见第六章 O-2）

| 情形 | 本课生词数 | 依据 |
|---|---|---|
| Level 2 常规 | 10（区间 8—12） | 过渡期方案【静】 |
| 上一课 `E >= 5` / `too_hard` / `D >= 3` | 降到 6—8 | 【推】降载 |
| 试探第二个知识点（E1） | 不超过 8 | 【推】给策略空间让路 |

**选材规则**

| 规则 | 内容 |
|---|---|
| V1 复用下限 | 例句与作业语境中，**已学词复用量 ≥ 新词数**；目标：句子里 ≥70% 的词来自已有词表（或 `lesson_vocabulary` 可查词）【推】 |
| V2 生词优先级 | ① 本课语法点必需的词（如不规则过去式本身）→ ② 高频功能词 / 时间词 → ③ 学生生活相关词（软件工程、课业、家庭） |
| V3 例句约束 | 每个新词的例句**只允许出现「该词 + 已学词」**，不得引入第二个未学词【静，现行做法】 |
| V4 去重 | 上课当天用 `GET /api/vocabulary?q=<word>` 核重；已存在的词以「形态」入词表（复用），不重复计数【推】 |
| V5 同源提醒 | 新词若与学生的历史错词同源（例如第 8 课的 `see→saw` 与第 1 课 `We see movie`），必须在课上**显式点破**，否则会诱发旧错【推】 |

**阅读选取规则**

| 规则 | 内容 |
|---|---|
| R1 长度 | Level 2 自编 **60—90 词/篇**（30—60 词属 Level 1）【静】 |
| R2 生词率 | ≤ **10%**（90 词内未学词 ≤ 9 个），且未学词以本课新词为主 |
| R3 语法覆盖 | 每篇必含 **≥3 处本课语法点实例**；第 2 篇允许出现「上一课 vs 本课」的对比句 |
| R4 篇数与时机 | 每天 1—3 篇，课后生成到 `read/YYYY-MM-DD-read.md`；**当天文件已存在则跳过，不覆盖**（唯一例外：学生明确要求追加）【静，硬规则】 |
| R5 理解题 | 每篇 2 题：1 道细节 + 1 道本课语法点识别；**理解题作答错误单独记 `comprehensionErrorCount`，不计入作业错误处数**（口径见 3.1）【推】 |

### 2.5 断更后如何衔接（断更不断号）

| 距今天数 D | 复习题量 | 新知识点 | 词汇 | 阅读 | 依据 |
|---|---|---|---|---|---|
| `D <= 2`（正常） | 5 题 | 按 2.1 取新的 next point | 常规 10 | 1—3 篇 | 现行做法【静】 |
| `3 <= D <= 6` | 7 题（N-1 / N-2 / N-3 / N-5 + 错词 3） | **保留 1 个 new point**，但家族只讲「肯定 + 否定」，疑问句留到下一课 | 降到 8 | 1 篇（只用旧词旧语法的「复习型」） | 【推】 |
| `D >= 7` | 8—10 题覆盖最近 3 课 + 全部 `priority=high` 错词 | **推迟 new point**，本课为「综合复习课」：重课件 + 重做高频错 + 1 篇综合阅读 | 0 新词（全复用） | 1 篇综合 | 【推】待实测校准 |
| 任意 D 且存在 `lastIncomplete` | 先读 `lastIncomplete.nextRecommendation`，从中断的教学动作续讲，**不重讲已完成环节** | — | — | — | 【静】G4 定义 |
| 跨关系 | 课号一律 `max(lessonNo)+1`，不因断更回退、不补号 | — | — | — | 硬规则【静】 |

### 2.6 复习取题规则（决定「先考哪些」）

1. **强制位**：所有 `wrongCount >= 3` 的未过关错词，**每课至少占 1 题**（防止连 2 课不露面导致估计失真）【推】
2. **结构位**：N-1 / N-3 / N-7 各 1 题（课号 ≤ 0 跳过）
3. **边际收益位**：`streak == 1` 的错词优先（再答对一次就出队）—— 这是服务端 `priority=medium` 的那一批，教学上它们的出队收益最高
4. **兜底位**：其余按 `wrongCount` 降序 → `lastReviewedAt` 最久优先（DQ5 修复前用 `createdAt` 近似）
5. **总量**：正常 5 题，断更按 2.5 上浮；批改变用到：`wrong → wrongCount+1, streak=0`；`correct → streak+1`，`streak>=2 → passed`【静，口径】

> 服务端 `priority` 用于默认排序展示；Amy 的出题排序是上面的 1→4，**两者允许不同**（一个是展示排序，一个是教学排序）【推】。

### 2.7 降载触发阈值与退出条件（可执行判据，供 skill-designer 落地）

> 本节把「生词量 × 练习量 × 错误率」三维度固化为**可执行判据**，`next-lesson-planning` 可直接实现。
> **降载 ≠ 降级**：降级（Level 2 → Level 1）只在 `too_hard`（2.2 C 类）触发；**降载是保持级别、只减本课负荷**。

**触发：下列任一命中即降载，命中多档时取最高档**

| 判据 | 触发条件（针对上一课 `N-1` 或错词池） | 依据 |
|---|---|---|
| **T-1 单课超阈** | `E_{N-1} >= 5` | 2.2 B3 |
| **T-2 连续超阈** | 最近 2 课均 `E >= 5` | 【推】新增 |
| **T-3 反馈过难** | `F_{N-1} = too_hard` | 2.2 C 类 |
| **T-4 断更** | `D >= 7`（断更专用档见 2.5） | 2.5 |
| **T-5 复发阻断** | 存在 `wrongCount >= 4` 且 `error_type ∈ {grammar, word_choice}` 的未过关错词 | 2.1 P1 |
| **T-6 超载上限** | 拟排生词 > 12（绝对上限，=`lesson-plan.schema.json` 的 `maximum`） | schema 边界 |

**档位表（命中多档取最高；一次降载最多下调 1 档）**

| 档 | 名称 | 命中条件 | 生词数 | 练习量 | 新知识点 | 阅读 |
|---|---|---|---|---|---|---|
| **L0 常规** | — | 无 T-1…T-6 | 10（区间 8—12） | 新课 3 小题 + 1 开放题；复习 5 题 | 1 个新点，家族一次讲全 | 1—3 篇 |
| **L1 轻度降载** | 巩固模式 | **T-1**（`E = 5—6`）／**T-3**（`too_hard` 且 `E <= 5`）／**T-4**（`D = 3—6`） | **6—8** | 新课 3 小题 + 1 开放题（开放题限 3 句）；复习 **5—7 题**（巩固加量时取上限） | 保留，但「家族一次讲全」降为**只讲肯定 + 否定** | 1 篇 |
| **L2 中度降载** | 复现课 | **T-1**（`E >= 7` 且非 2.2 D1 新点首课）／**T-2**／**T-4**（`D >= 7`） | **0—6**（以复现旧词为主） | 新课小题 2 道 + 开放题 3 句；复习 8—10 题 | **不讲新点**，改「同点变式」重讲 1 个已学点 | 1 篇短（旧词旧语法） |
| **LX 阻断降载** | 产出专项 | **T-5** | **0 新词**（全复用） | 产出型 3—5 道写句题 + 复习 6—8 题 | **不讲新点**，专项攻该错点 | 1 篇 |

> **上限保护**：已在 L2 / LX 且仍 `E >= 5` 时**不再继续降载**，转 2.2 C3 的诊断 / 降级评估，避免无限降载把课变成纯复习。

**退出条件（回到 L0）**

1. 降载后**连续 2 课**同时满足 `E <= 2` 且 `R = 0`（无复发项）且 `F ∈ {too_easy, just_right}` → 退出降载，生词恢复 10。
2. 第 1 课先升半档（L2→L1、LX→L1），第 2 课满足后再回 L0；任一课 `E >= 5` → 回退一档并重新累计。
3. 退出/降载状态写入下一课 `next_recommendation`（附录 A.3 同格式），保证可复盘。

> 阈值采样仅第 1—6 课（见 `O-9`），建议第 12 课用第 7—11 课数据回看一次。

---

## 三、批改与错误分析口径

### 3.1 错误处数怎么数（唯一分数量口径的计法）

| 规则 | 内容 | 证据 |
|---|---|---|
| 计数单位 | **一处 = 一个可独立改正的点**；填空题每个空算一处 | 【推】 |
| 同句多错 | 分别计数；合计后 `errorNote` 一并列出 | 第 6 课开放题计数【静】 |
| 跨句重复 | 同一个错在两句出现 → **计 2 处** | 第 6 课 `at yesterday` 连用两次，计 2 处，`E_6 = 5` 对得上【静】 |
| **不计入** | ① 空题（`blank`）② 正确但有更优表达（`correct_with_note`）③ **补漏块作答错误**（单列 `backfillErrorCount`）④ **阅读理解题作答**（单列 `comprehensionErrorCount`）⑤ 任务完成度问题（如「要求 1 句否定没写」）——只做提示，不计数 | 第 6 课：9 题错 5 处；开放题外唯一的标点提醒（补漏块第 3 题）确未计入 `E_6=5`【静】 |
| 上界复核 | 若 `E > 作业题数 × 2`，须复核是否把一处拆碎 | 【推】 |
| 汇总口径 | `study_records(grade).payload = { exerciseCount, errorCount, byType{...}, newMistakes, passedMistakes }`，**不折算百分制** | 【静，`ai-teacher.md` 6.3】 |

> 口径补丁：③④ 两条是本文新增的细分。若 be-dev / skill-designer 认为这两类应计入总量，请回消息，由 Amy 最终裁定并在 `ai-teacher.md` 6.3 同步。

### 3.2 error_type 判定（沿用 3.6 三步判定，不另起炉灶）

```
第一步 单一差异：只差一类 → spelling（同一词同一形态字母错） / capitalization（统一大小写后相同） / punctuation（去标点空格后相同）
                 注意：studyed→studied、teached→taught 属形态变化 → 走第二步 grammar
第二步 多处差异：按「错误主体」判 → word_choice（选错了词/疑问词/搭配） / grammar（动词形态、时态、语序、结构、主谓一致、虚词增减）
                 标点与大小写不参与归口，只写进 errorNote
第三步 判不出 → other，标「待人工复核」，不猜
```

**Amy 的实操细则（老师层面补充，不改变三步框架）**

| # | 细则 |
|---|---|
| G1 | 批改前先确定**学生想表达什么**（尤其开放题）；意图不明时判 `correct_with_note` 并说明歧义，**不得直接判错**【静，3.6 异常表】 |
| G2 | `correctText` 一律**最小修正**，不重写整句；只有开放题总结时才给「完整改后版」作为示范 |
| G3 | 判重：**先查错词池**（判重键 = **去全角括号批注 → 折叠空白 → 转小写**后的 `wrongText`；**非「去标点」**，标点参与判重，见 `docs/ai-teacher.md` §11.3）。命中 → `wrongCount+1`、`streak=0`、**不新建条目**；未命中 → 新建【推】目标：修掉 DQ1 那类「同一错变 2 条」 |
| G4 | 复发必须在 `errorNote` 里写明「第 N 次犯（上次在第 k 课）」—— 学生对「第几次犯」最敏感，这是把复发变成习惯 Prompt 的关键信息 |
| G5 | 判错的题**必须有为什么**（一句中文讲解，术语保留英文），禁止只给结论 |
| G6 | 同一处错误只记一次，不因跨题重复而重复计数（跨句按 3.1 计，此处指同一句同一处） |

### 3.3 分歧条目裁定（Amy 是教学决策权威，`docs/skills.md` 3.6 明确要求裁定）

| 条目 | 现有记录 | 3.6 规则判定 | **Amy 裁定** | 理由 | 影响 |
|---|---|---|---|---|---|
| `what do you do?` → `What are you doing?` | `word_choice` | `grammar` | **`grammar`** | 学生的疑问词没选错，错在**用了一般现在时结构去问此刻正在做的事**；它与已归 `grammar` 的 `I reading a book.`（漏进行时的 be）属同一类「结构缺失」，合并统计才利于做时态强化 |
| `I am very busy.` → `We are busy.` | `grammar` | `word_choice` | **`word_choice`** | 触发点是中文「我们」被写成 I，**错在主格代词选择**；`am → are` 是代词的连带修正，写进 `errorNote`（「we 配 are」）即可 |

> 两条互换归属，`grammar` 9 / `word_choice` 4 的**数量不变**，趋势统计不受影响【静，3.6 已算过】。
> **本次不改写历史数据**：裁定结论交给 skill-designer 写进规则、由后续批处理统一执行（改数据需 be-dev 评估，不由 Amy 执行）【未】。

### 3.4 反馈怎么写（学生偏好：直接纠错、中文讲解、术语保留英文）

固定五段式，逐条批改都按此写：

```
① 结论：✅正确 / ❌错误（先给，不绕弯）
② 最小修正：`错误形式 → 正确形式`
③ 为什么：一句中文讲解，术语原文保留（如「现在进行时必须有 be 动词 am / is / are」）
④ 复发提醒（如有）：「这是第 N 次犯，上次在第 k 课」
⑤ 开放题专属：全部点评后给「完整改后版」示范
```

禁止：只说「不对」/ 用「差不多」等模糊表述 / 用未学过的词改写学生的句子 / 替学生作答（硬规则：未作答不推进）。

---

## 四、第 7 课示范决策（走一遍规则，用真实数据）

> **主次已按 D-6 更正（2026-09-29）**：主场景 = **第 7 课**（仓库真实下一课，**尚未上**；`GET /api/progress → nextLessonNo=7` 已复测【实】）。
> 原以「第 8 课」为主场景、把第 7 课当降级分支的写法**作废**。原第 8 课（常用不规则过去式）的详细规划**整段保留为 4.6 的「主推分支」**，待第 7 课实际数据触发后执行。
> 数据基准：第 1—6 课已上完（`progress.md` + API 实测），本节**不引入任何假设值**（原 `E_7 = 3` 的假设已删除）。

### 4.1 输入（全部为真实数据）

| 项 | 值 | 分级 |
|---|---|---|
| 当前等级 | Level 2 | 【实】 |
| 最大课号 | 6 → **N = 7** | 【实】 |
| 源文件 | `notes/day-01-07.md`（第 7 课是该校**最后一课**） | 【静】规则 |
| 最近日期 / 距今天数 | 2026-09-29 / 按 2026-09-30 上课计 D ≤ 2 | 【实】+【推】 |
| 错误趋势 | `E_1..E_6 = 3, 4, 2, 6, 2, 5` | 【实】 |
| 反馈序列 | too_easy ×3（第 1—3 课）+ just_right ×3（第 4—6 课） | 【实】 |
| `easyStreak` | 0（第 4 课后归零） | 【实】 |
| 未过关错词 | 15 条（`wrong-words.md`），最高复发项 `play games` wrongCount=3 / streak=0 | 【实】 |
| 错词类型分布 | grammar 9 / word_choice 4 / capitalization 3 / punctuation 2 / spelling 1（`other=1` 为 DQ1 待删残留，不计） | 【实】 |
| 词汇 | 51（去重口径，C3 已定） | 【实】 |
| 补漏队列 | ①②③ 已出队；**队首 = ④ 介词 on / at**（`progress.md:104`） | 【静】 |

### 4.2 走判定链（2.1 → 2.5，逐条）

| 步骤 | 判定 | 结果 |
|---|---|---|
| 2.1 P0 学生指定 | 无 `topicOverride` | 跳过 |
| 2.1 P1 复发阻断 | 最高 `wrongCount = 3`（`play games`），**未达到 4** | 不阻断，可讲新点 |
| 2.1 P2 欠账前置 | 规则动词 `-ed` 的前置是「已建立过去式概念」——第 6 课 `was/were` 已学 | 已满足，跳过 |
| 2.1 P3 主线 | level-map 下一个未学点 = **L2-07 规则动词过去式 -ed** | ✅ 定为 new point |
| 2.1 衔接约束 | 与第 6 课同属「过去时家族」（`be` 走 was/were、实义动词走 -ed 的互补） | ✅ 成立 |
| 2.2 难度 | `F_6 = just_right`、`E_6 = 5` → 命中 **B3 巩固模式**（`E_N >= 5`）：维持 Level 2、**不降级** | 维持 Level 2 |
| 2.2 E1 加速 | 需连续 2 课 `E <= 2` 且反馈 `too_easy`；实际 `E_5 = 2, E_6 = 5`、`just_right` | **不加速**，保持 1 个知识点 |
| 2.3 自查 T1/T2/T3 | T1：`play games`（3 次）✔；T3：本课新讲 `-ed` 形态规则 ✔；T2：标点类复发，但已在「开场五条」→ X1 让位 | 取 **2 条**（见 4.5） |
| 2.4 词汇 | `E_6 = 5 >= 5` → **触发轻度降载（2.7 档 L1）→ 6—8 个**（不是常规 10） | **6—8** |
| 2.5 断更 | D ≤ 2 → 常规 5 题复习、1—2 篇阅读 | 常规 |

> ⚠ **与 `amy-session-07-plan.md` 的一处冲突**：那份计划（2026-09-29 15:05 生成）写「词汇 10 个」。按本节 2.4 的阈值，`E_6 = 5` 已触发轻度降载，第 7 课生词应为 **6—8**。**以本节为准**（session-07 文件早于降载规则落笔），4.3 的词汇表已按 8 个定稿。

### 4.3 第 7 课规划（默认分支：E6=5、just_right）

| 项 | 内容 |
|---|---|
| **课号 / 文件** | 第 7 课 → `notes/day-01-07.md`（**最后一课**，标题 `## 第 7 课 · YYYY-MM-DD`；第 8 课起转 `day-08-14.md`） |
| **级别** | Level 2 |
| **一句话摘要** | 学会规则动词过去式 `-ed`，分清「be 走 was/were、实义动词走 -ed」 |
| **新语法点** | 规则动词过去式 `-ed`：① 一般加 `-ed`（worked / watched）② 以 e 结尾只加 `-d`（liked）③ 辅音 + y 改 i 加 ed（studied）④ 重读闭音节双写（stopped）；并对比第 6 课：**`was/were` 与 `-ed` 不能叠加**（不写 `I was studied`） |
| **Objectives（3 条，可判定）** | ① 能按四条拼写规则写出给定动词的过去式；② 能用 `-ed` 写 5 句「昨天/上周末做了什么」，含 1 句否定；③ 能判断句中该用 `was/were` 还是实义动词过去式 |
| **目标词汇（8，轻度降载档）** | 六个 `-ed` 例词：`played / watched / studied / cooked / cleaned / stopped`（新课前用 `GET /api/vocabulary?q=` 核重，已存在标 `isNew=false` 复用）+ 两个时间短语：`last week` / `last month`（复用为主）。**相比 `amy-session-07-plan.md` 的 10 个，砍掉 `worked`、`visited` 2 个** |
| **例句（5）** | ① I watched TV last night. ② She studied English yesterday.（顺带压 `study→studied` 拼写） ③ We played games last Sunday.（覆盖高频错词 `play games`） ④ I didn't cook dinner yesterday.（只作输入式呈现否定，不考 `did` 规则） ⑤ He was busy last week.（对照 `was/were` 与 `-ed` 的分工） |
| **练习（3 小题 + 补漏块 3 题）** | 见 4.4 |
| **作业** | 3 小题 + 1 开放题 + 强制自查 2 条（见 4.4 / 4.5） |
| **补漏块** | ④ 介词 `on / at`（3 题）：`at seven o'clock` / `on Sundays` / 「我上周日在办公室」→ `I was in the office on Sunday.`。出队规则：3 题全对 → 免修出队；错 ≥2 → 第 8 课再排 1 次（上限 2 次，之后转诊断） |
| **当日阅读** | `read/YYYY-MM-DD-read.md` 生成 **1—2 篇** Level 2、60—90 词；拟题 `Last Weekend`、`A Busy Sunday`；每篇 ≥3 处 `-ed` 实例；生词率 ≤10%；当天文件已存在则跳过 |
| **预计时长** | 复习 6′ + 新课 12′ + 补漏块 6′ + 作业与反馈 4′ ≈ 28′（降载档控制在 30′ 内） |

### 4.4 第 7 课练习与作业

| # | 类型 | 题目 | 参考答案 |
|---|---|---|---|
| 1 | `fill_blank` | 写出过去式：watch / study / stop（3 空） | watched / studied / stopped |
| 2 | `choice` | We ___ football last Sunday.（play / played） | played |
| 3 | `error_correction` | 改错：`I studyed English yesterday.` | I studied English yesterday. |
| 4 | `open` | 写 5 句讲上周末做了什么，每句用 `-ed`，至少 1 句否定 | 示范：I cleaned my room. I watched a movie. … |
| B1 | backfill ④ | 翻译：我上周日在办公室。 | I was in the office on Sunday. |
| B2 | backfill ④ | 填空：I get up ___ seven o'clock. | at |
| B3 | backfill ④ | 填空：We have English class ___ Mondays. | on |

**复习题（5 题，按 2.6 与 `amy-session-07-plan.md` 3.1）**

| # | 来源 | 题 |
|---|---|---|
| 1 | N-1 第 6 课（was/were） | 翻译：他们昨天在办公室。 |
| 2 | N-3 第 4 课（现在进行时） | 改错：`He reading a book now.` |
| 3 | 错词强制位（`play games`，wrongCount=3，且可覆盖今日 `-ed`） | 翻译：我们昨天打游戏。→ **We played games yesterday.**（复发项每课必露面，错了即累计 4 次 → 触发 2.1 P1 阻断） |
| 4 | 边际收益位（`streak==1`：`and I like my teacher` 逗号连句） | 改错逗号连句（再答对一次即出队） |
| 5 | 边际收益位（`streak==1`：`she always is busy`） | 改错：`She always is busy.` → `She is always busy.` |

### 4.5 第 7 课强制自查项与本课预期错误

**selfChecks（2 条，按 2.3 排序）**

1. **可数名词有没有加 s 或 a**（`play games` 累计 ≥3 次，仍未过关 → T1 复发位）
2. **动词过去式先看拼写规则** —— `-ed` 四条：一般加 ed / e 结尾加 d / 辅音 + y 改 ied / 重读闭音节双写（T3 新形态规则）

> 说明：句尾标点按 X1 让位（它已在「每课开场五条」常驻）；若学生在第 7、8 课的标点类错误再犯 ≥2 次，X1 的例外条款生效，标点项取代上述第 2 条进入 selfChecks。

**expectedMistakes（预判易错点，批改时用于「为什么不是 Y」；⚠ 仅内部使用、不对学生展示 —— 见附录 B.1）**

| wrong | correct | reason | fromMistakeId |
|---|---|---|---|
| I studyed English. | I studied English. | 辅音字母 + y 结尾要改 y 为 i 再加 -ed | — |
| He stoped to rest. | He stopped to rest. | 重读闭音节（辅-元-辅）要双写末尾字母再加 -ed | — |
| I was studied English. | I studied English. | `was/were` 与实义动词 `-ed` **不能叠加**：有实义动词就只用过去式 | — |
| We played game yesterday. | We played games yesterday. | 可数名词单数不能裸用（**第 4 次高危**） | 12 |
| She studyed very hard. | She studied very hard. | 同上拼写规则；注意 `study` 与 `stop` 规则不同 | — |
| I teached my friend. | I taught my friend. | `teach` 是不规则动词（第 6 课新错）；**本课只建立意识，专门讲在第 8 课** | — |

**预期错误画像**（推测，用于课后复盘）：`E_7` 目标 ≤ 4；组成预测 `grammar 2—3`（`-ed` 拼写 + `was/were` 混用）+ `punctuation 1`；若 `E_7 >= 6` → 归因新点首课（2.2 D1），第 8 课同点变式复练，不降级。

### 4.6 第 8 课预案（原「第 8 课示范」内容整段降为条件分支）

> 原 §四 的 4.1—4.7 是按「第 7 课已上、`E_7 = 3`」构建的第 8 课规划，现**整体改为第 8 课预案**，触发条件是第 7 课的**实际**结果。
> **主推分支**（下表第 1 行命中）时，第 8 课即执行原稿内容：**常用不规则过去式**（`go→went / eat→ate / see→saw / have→had / do→did / come→came`，只讲肯定式；否定与 `did` 疑问留第 9 课）+ 补漏块 ⑤ 祈使句与 Let's，文件 `notes/day-08-14.md`。

| 若第 7 课实际数据是… | 4.2 命中 | 第 8 课改为什么 |
|---|---|---|
| `E_7 <= 4` 且 `F_7 = just_right` | **B3 / B2**（主推分支） | **常用不规则过去式**（原稿）：`go/eat/see/have/do/come` 6 组 + 补漏块 ⑤；词汇按档（`E_7 <= 2` 用 8—10，`E_7 = 3..4` 用 6—8） |
| `E_7 <= 2` 且 `F_7 = too_easy` 且第 7 课无复发 | A2 / 接近 E1 | 维持 Level 2，可带**试探性的第 2 个知识点**（过去时否定 `didn't`），词汇 ≤ 8 |
| `E_7 = 5..6`，`F_7 = just_right` | B3 巩固（降载延续） | 新点仍讲，但只讲 **4 组**（go/eat/see/have），词汇 6，阅读减为 1 篇 |
| `E_7 >= 6` 或 `F_7 = too_hard` | B3 / C2 | 第 8 课**不讲新点**，改巩固产出课：重讲 `-ed` + 综合复习 8 题 + 1 篇短阅读；不规则推到第 9 课 |
| 第 7 课 `play games` 又犯一次（`wrongCount = 4`） | **P1 复发阻断** | 停止推进新点，第 8 课为「可数名词产出专项」+ 复习 8 题 |

**主推分支的定稿（第 8 课，待第 7 课数据确认后落库）**

| 项 | 内容 |
|---|---|
| **课号 / 文件** | 第 8 课 → `notes/day-08-14.md`（**首个 8—14 文件**，标题 `## 第 8 课 · YYYY-MM-DD`） |
| **新语法点** | 常用不规则过去式 `go→went / eat→ate / see→saw / have→had / do→did / come→came`（只讲肯定形式） |
| **Objectives（3 条）** | ① 能写出上述 6 组过去式；② 能用它们写 5 句昨天/上周的事，含 1 句否定、1 句疑问；③ 能判断该加 -ed 还是用不规则形式（不写 `goed` / `eated`） |
| **目标词汇** | 形态词 6（`went/ate/saw/had/did/came`）+ 情境词（`park` / `restaurant` / `breakfast`，按核重替换）+ 复用（`yesterday` / `last night` / `dinner` / `weekend`）；数量按上表档位定 |
| **例句（5）** | ① I went to the park yesterday. ② He ate dinner at home last night. ③ We saw a movie two days ago. ④ Tom had a busy weekend. ⑤ Did you come to school yesterday?（只作输入式呈现） |
| **练习（3 小题 + 补漏块 3 题）** | ① 写出过去式 go/eat/see/have/do/come；② 选择 We ___ a movie last night.（see/saw/seed）；③ 改错 I goed to the park yesterday.；开放题：写 5 句昨天做了什么 |
| **补漏块** | ⑤ 祈使句与 Let's（3 题）：翻译「请关上门」/ 选择 Let's / 改错 Not run in the classroom. |
| **selfChecks** | ① 可数名词有没有加 s / a；② 动词过去式先查是不是不规则（不写 `goed` / `eated` / `seed`） |
| **expectedMistakes**（仅内部） | I goed→went；He eated→ate；We seed→saw；We played game→games（第 4 次高危, `fromMistakeId=12`）；I was go→went（was/were 不叠加）；Tom and I comed→came |
| **当日阅读** | 2 篇 60—90 词：`A Busy Weekend`、`Tom Went to the Park`；每篇 ≥3 处不规则过去式；生词率 ≤10% |
| **预计时长** | 复习 6′ + 新课 14′ + 补漏块 6′ + 作业与反馈 4′ ≈ 30′ |

### 4.7 第 7 课的 LessonPlan JSON（对齐 `docs/schemas/lesson-plan.schema.json`）

```json
{
  "lessonNo": 7,
  "lessonDate": null,
  "levelCode": "Level 2",
  "sourceFile": "day-01-07.md",
  "summary": "学会规则动词过去式 -ed，分清「be 走 was/were、实义动词走 -ed」",
  "objectives": [
    "能按四条拼写规则写出给定动词的过去式（worked / liked / studied / stopped）",
    "能用 -ed 写 5 句关于昨天/上周末的事，含 1 句否定",
    "能判断句中该用 was/were 还是实义动词过去式（不写 I was studied）"
  ],
  "grammarPoint": { "code": "L2-07", "title": "规则动词过去式 -ed", "role": "new" },
  "backfill": { "seq": 4, "title": "介词 on / at" },
  "vocabularySize": 8,
  "reviewSources": [
    { "source": "N-1", "detail": "第 6 课 was/were：翻译「他们昨天在办公室」", "count": 1 },
    { "source": "N-3", "detail": "第 4 课现在进行时：改错 He reading a book now.", "count": 1 },
    { "source": "mistake", "detail": "play games（wrongCount=3，强制位，覆盖今日 -ed）", "count": 1 },
    { "source": "mistake", "detail": "streak==1 边际收益位：and I like my teacher（逗号连句）", "count": 1 },
    { "source": "mistake", "detail": "streak==1 边际收益位：she always is busy", "count": 1 }
  ],
  "selfChecks": ["可数名词有没有加 s 或 a", "动词过去式先看 -ed 四条拼写规则"],
  "expectedMistakes": [
    { "wrong": "I studyed English.", "correct": "I studied English.", "reason": "辅音字母 + y 结尾改 y 为 i 再加 -ed" },
    { "wrong": "We played game yesterday.", "correct": "We played games yesterday.", "reason": "可数名词单数不能裸用（第 4 次高危）", "fromMistakeId": 12 }
  ],
  "degradation": { "degraded": true, "reason": "GET /api/agent/snapshot、knowledge-points、readings 未实现；backlog 从 progress.md 读取",
                   "affected": ["backlog.backfillQueue", "lastIncomplete", "readingCatalog"] }
}
```

> `objectives` / `expected_mistakes` 两个 `section_type` **已获批准**（总纲 D-10）：按枚举同源顺序落库（`schema.sql` → `constants.js` → schema JSON）。`expectedMistakes` **仅内部使用、不对学生展示**（附录 B.1）。

---

## 五、Amy 需要的前端呈现（发给 fe-dev）

> 全部用中文界面，英语术语保留原文（PROJECT.md 既有约定）。以下为「教学要能正常发生」所必需，按优先级排序。

| # | 必须有的内容 | 为什么教学需要它 | 优先级 |
|---|---|---|---|
| F1 | **今日决策卡**：级别 / 课号 / 上一课日期与距今天数 / 本课语法点 / 目标 3 条 / 新词数 / 补漏块 | 让学生知道今天为什么学这个（决策透明 = 信任基础） | P0 |
| F2 | **错词本的四项硬指标**：`wrongCount`（第几次犯）、`streak`（0/2 过关进度）、`priority`、`errorType`、`firstLessonNo` / `lastLessonNo` | 「还有几次能出队」是学生能看见的唯一进展指标；缺了它学生不知道自己离过关多远 | P0 |
| F3 | **每天的复习队列 Top-N**（按 API 默认排序即可），一键进入作答 | 复习是上课第一步，必须一眼可见 | P0 |
| F4 | **作业提交前的「自查闸门」**：本课 `selfChecks` 逐条列出，勾选后才允许提交 | 本学生的核心瓶颈就是「写时不自查」（理解 Level 2 / 产出 Level 1）；闸门是把规则变成习惯的唯一手段 | P0 |
| F5 | **批改视图**：逐题显示 学生作答 / 最小修正后的正确形式 / errorType / 为什么；开放题显示「完整改后版」；复发项打「第 N 次犯」标签 | 学生偏好直接纠错；批改上下文必须可回看，否则同一错会一直重犯 | P0 |
| F6 | **错误趋势迷你图**（近 6 课 `errorCount` 柱状 + 目标带 2—4 的标注）与反馈序列 | 让「我在进步还是退步」变成可视事实，减少主观挫败 | P1 |
| F7 | **词汇卡**：词 / 音标 / 释义 / 例句 / 首次出现课 / 是否曾是错词 | 支撑 V4 核重与 V1 复用；学生自查生词 | P1 |
| F8 | **阅读列表**：按日归档；显示当天是否已生成（防重复）、篇目与理解题 | 「当天不覆盖」是硬规则，界面必须能看出来 | P1 |
| F9 | **上节课的 Amy 决策回执**：上一课 `nextRecommendation` + 本课实际是否按它执行 | 决策可追溯；也是学生复盘材料 | P2 |
| F10 | 本节课的 **expectedMistakes 预警条**（提交作业前可见） | 让学生先自检再提交，可直接降低 E。属增强项，不计分 | P2 |

**给 fe-dev 的提醒（已知约束）**

- ~~`review/index.html` 是 `build_board.py` 的生成产物，**改它会被下次重建覆盖**（联调报告 F1【实】）；本次的任何 API 改造都要同步进生成脚本或调整生成范围——请与 skill-designer 确认归属后再动手。~~ → ✅ **F1 已关闭（2026-10-02 更新）**：`build_board.py` 已于 v2.3.0 删除、原生站 `review/` 亦已退役删除（`2e91345`），现为 `frontend/`（Vue 3），**不存在生成物覆盖问题**，本条「同步进生成脚本」的要求随之作废。
- 后端当前无 `/api/readings`、`/api/knowledge-points`、`/api/agent/snapshot`（【实】已测 404）；F1/F8/F9 的数据源在后端补齐前只能读 md，前端请保留占位而非报错（现有 index.html 的「—」做法是对的）。
- 「错误处数」是唯一分数量口径，**不要显示百分制分数**，避免口径分裂。

---

## 六、风险与未决问题

| # | 风险 / 未决 | 影响 | 处置建议 | 对象 |
|---|---|---|---|---|
| **O-1** | ~~**第 7 课 vs 第 8 课的入口分歧**~~ | ✅ **已关闭（D-6）** | 主场景已更正为第 7 课；`GET /api/progress → nextLessonNo=7` 复测通过 | — |
| **O-2** | **词汇量口径冲突**：`SKILL.md` 第 5 步写死「5—8」、`progress.md` 过渡期方案为 8—12、`level-map.md` Level 2 写 6—8 | 同一份计划在三个文档里给出不同值，Skill 实现时会随机取值 | **裁定见附录 B.2**：Level 2 以「常规 10（8—12）、降载 6—8」为准。schema 已改；**剩 `SKILL.md` 第 5 步与 `level-map.md` Level 2 行待 skill-designer 改** | skill-designer |
| **O-3** | 缺 `errorTrend.byType` 与 `exercises` 接口（N1 / N4） | 「理解 vs 产出」双轨判定（2.2）只能靠人工读批改正文，无法自动化 | 排 P1；未实现前 Amy 在 `grading` 段人工标注双轨归属 | be-dev |
| **O-4** | 全部**写接口未实现**（`mistakes/:id/review`、`progress/feedback`、`lessons` 归档）【实】 | 闭环断裂：`streak` / `status` / `lastReviewedAt` 永不变化 → 「连续答对 2 次过关」在 DB 里无法成立；2.3 的退场规则 X2 无法自动化 | P0，优先级高于任何读接口增强 | be-dev |
| **O-5** | **DQ1**：md 19 条 vs DB 20 条 | Amy 的错词计数与库不一致，影响复习强制位与复发判定 | 幂等重跑迁移（`ON DUPLICATE KEY UPDATE`）+ 导入后跑口径校验 | be-dev |
| **O-6** | Amy 的 4 条守门规则（R1 准确度冻结等）**刻意不落库** | 好：后端不承担教学策略；坏：无法被前端/接口消费，跨会话只能靠 `progress.md` | 维持现状，但要求 `progress.md` 的冻结/解锁条件必须写成机器可解析的一行；长期随 N5 `knowledge-points` 一并结构化 | be-dev / skill-designer |
| **O-7** | level-map（Level 2 之后的知识点顺序）**没有权威数据源**，只在 `ai-teacher.md` 2.6 与本文以文字形式存在 | 一旦 Amy 的会话上下文丢失，接任者会重新发明教学顺序 | 依赖 N5；在此之前本文的 level-map 段落作为临时权威 | be-dev |
| **O-8** | ~~第 8 课规划建立在「第 7 课已上、`E_7 = 3`」的假设之上~~ | ✅ **已消除** | §四已整体重写：主场景 = 第 7 课（真实数据、无假设）；第 8 课改为 4.6 的条件分支 | — |
| **O-9** | 阈值多为【推】：目标带 2—4、`>=5` 巩固、`D>=7` 复习课等，样本只有 6 课 | 阈值可能过紧或过松 | 建议每 5 课校准一次（第 12 课时用第 7—11 课数据回看），并把结论写回本文 | Amy（周期性） |
| **O-10** | 2 条分歧错词的裁定**尚未写入数据** | 分类规则与历史数据暂时不一致 | skill-designer 写进 Skill 规则新数据生效；历史数据由 be-dev 评估是否批处理 | skill-designer / be-dev |

---

## 七、本次交付对其他 Agent 的影响

| Agent | 需要你做什么 |
|---|---|
| **be-dev** | 见第一章 1.1 的 N1—N9（P0：N5/N6/N8 + 已有的写接口 R2—R5；P1：N1/N2/N4/N7） |
| **fe-dev** | 见第五章 F1—F10（P0：F1—F5）；~~并注意 `review/index.html` 会被 `build_board.py` 覆盖（F1【实】）~~ → ✅ **F1 已关闭（2026-10-02）**：`build_board.py` 与原生站 `review/` 均已退役删除 |
| **skill-designer** | ① 3.6 的两条分歧按 3.3 的裁定统一；② `lesson-plan.schema.json` 的词汇量描述已对齐，**剩 `SKILL.md` 第 5 步与 `level-map.md` Level 2 行按附录 B.2 的替换文案改**；③ 把第二章判定表固化为 `next-lesson-planning` 的可执行规则（尤其 P1 复发阻断、**2.7 降载体档**、2.3 上限与退场、2.6 出题排序）；④ 3.1 的「错误处数不计入项」如与你们的 `grading-result.schema.json` 冲突，回消息由 Amy 裁定；⑤ **`expectedMistakes` 入库但学生端不展示**（附录 B.1） |
| **team-lead** | O-1 已关闭（主场景=第 7 课，已复测 `nextLessonNo=7`），无需再裁定 |
| **Git** | 新增本文（1 个文件）：`docs/plans/amy-teaching-plan.md`；未改动任何数据与代码 |

---

## 附录 A · 与 be-dev 的对接结论（2026-09-29 后续）

### A.1 Amy 侧的写入承诺（N1 / N6 的数据来源）

| 承诺 | 内容 | 生效时间 |
|---|---|---|
| 批改后写 `byType` | 每课 `POST /api/study-records`(grade) 的 payload 必带 `{ errorCount, exerciseCount, byType{...} }`，字段放 `LessonRecord.gradeSummary.byType` | 下一次批改起 |
| 反馈写 `next_recommendation` | 每课 `POST /api/study-records`(feedback) 的 payload 必带 `payload.next_recommendation` 文本 | 下一次下课起 |

### A.2 历史 6 课的 `byType` 重建（供后端回填，【静】由 `notes/day-01-07.md` 批改段重算）

> 约束：每课各类型之和必须等于该课已记录的 `errorCount`（3/4/2/6/2/5）。

| 课 | errorCount | grammar | word_choice | punctuation | capitalization | spelling | 备注 |
|---|---|---|---|---|---|---|---|
| 1 | 3 | 0 | 2 | 0 | 1 | 0 | see→watch、ask for（word_choice）；Tv（capitalization） |
| 2 | 4 | 1 | 0 | 2 | 1 | 0 | always 位置（grammar）；缺空格 + 逗号连句（punctuation）；zane（capitalization） |
| 3 | 2 | 1 | 0 | 0 | 0 | 1 | intrusting（spelling）；together 冗余按「虚词增减」（grammar） |
| 4 | 6 | 3 | 1 | 1 | 1 | 0 | are sitting / me→I / play games（grammar）；what do you do?（word_choice）；句首小写与问号前空格（punctuation）；Now, My（capitalization） |
| 5 | 2 | — | — | — | — | — | ⚠ **存疑不回填**：候选读法① 逗号连句(punctuation 1)+大写 1；候选读法② 补漏块句首大写 2。两种都能凑成 2，需以后 existing 记录为准 |
| 6 | 5 | 4 | 1 | 0 | 0 | 0 | play games / at yesterday ×2 / teached（grammar）；What were you → How were you（word_choice） |

> 口径提醒：`byType` 是**错误处数按类型分布**（每次出现都计），与 `mistakes` 表按「错词条目」统计的分布不是同一单位，两者不必相等。

### A.3 历史 6 课的 `next_recommendation` 回填文本（摘录自 `notes/day-01-07.md` 难度反馈备注，【静】）

| 课 | next_recommendation |
|---|---|
| 1 | 第 2 课继续 Level 1，本次仍有 3 处错误，准确度未达标，暂不升级 |
| 2 | 第 3 课继续 Level 1；句号后缺空格第 2 次犯 → 准确度不达标暂缓升级；把书写规范四条作为每课开场固定检查项 |
| 3 | 书写规范全达标 → 解除冻结，第 4 课起升 Level 2；Level 1 未学知识点列入待补清单，靠错词本与后续穿插练习补 |
| 4 | 第 5 课继续 Level 2；补漏块推进到 this / that / these / those |
| 5 | 第 6 课继续 Level 2（错误回落到 2 处但未满足翻倍复议）；补漏块推进到疑问词 what / who / where |
| 6 | 第 7 课：Level 2 规则动词过去式 -ed + 补漏块 ④（介词 on / at）；第 7 课是 `day-01-07.md` 最后一课，之后开 `day-08-14.md` |

### A.4 DQ1 / DQ2 处置确认

| 项 | Amy 决定 |
|---|---|
| **DQ1** | **确认删除 `mistakes.id=19`**（be-dev 查明：`correct_text='—'`、`wrong_count=0`，即 md 中已被 Amy 删除的那行非错题记录）。删除后应为 `total=19 / pending=15 / passed=4`，与 `wrong-words.md` 完全一致。判定标准建议写成通用规则：`wrong_count=0` 或 `correct_text` 为空/占位符的记录一律不导入。 |
| **DQ2** | `wrong_text` 只留错误形式，批注移到新列 `note`（列名由 be-dev 定）。已知三条的清洗文案：id12 → `play game`，批注「累计第 3 次：第 4 课作业、第 6 课作业（were playing game）」；id8 → `Do you like coffee.`，批注「诊断题：疑问句结尾用了句号」；id16 → `at yesterday`，批注「第 6 课作业同一份里连用两次」。其余疑似行（含括号或整句的 `wrong_text`）请 be-dev 列清单回我，我逐条给文案后再批量执行。 |

---

## 附录 B · 本轮教学裁定（2026-09-29）

### B.1 `expectedMistakes` 学生端是否展示 → **不展示**

**裁定：`expectedMistakes` 是备课 / 批改的内部对象，学生端完全不展示（原 F10「预警条」取消）。**

理由：

1. **语义**：它是「备课时预判学生会犯的错」，本质是 `wrong → correct` 成对的**答案清单**，不是教学要求。
2. **提交前展示 = 提前给答案**，违反 `ai-teacher.md` 1.3 硬规则第 2 条（未作答不推进、不提前给答案），并削弱练习的诊断价值。
3. **提交后展示也无必要**：学生实际犯的错已在批改视图（F5）逐条给出 `wrong → correct`；再单列「预判清单」既重复，又会让**未发生的预判错误以错误形态反向出现**（负向记忆），弊大于利。
4. **真正的自检工具是 `selfChecks`（F4）**：它给的是**规则**（「句尾打问号」「可数名词加 s」），不是答案，可以、也应该在提交前作为闸门展示。**分界线：规则可给，答案不可给。**

若前端已按 F10 预留展示位：**改为不渲染**（不要用不可见占位，避免误接数据后意外外露）。`expectedMistakes` 仍按 D-10 入库，供 Amy 批改时生成「为什么不是 Y」文案与课后复盘。

### B.2 生词量口径裁定 → 以「Level 2 常规 10（8—12）、降载 6—8」为准

| 文档 | 现文案 | 裁定 |
|---|---|---|
| `progress.md` 过渡期方案（第 98 行） | Level 2：8—12 | ✅ **权威**（实课正在执行，用户提议加速后生效） |
| `docs/schemas/lesson-plan.schema.json` | 「Level 2 常规 10（8—12）；降载 6—8」 | ✅ 已对齐，无需改 |
| `.workbuddy/skills/english-daily/SKILL.md` 第 5 步 | 「5—8 个生词」写死 | ❌ **作废**，按下方文案改 |
| `.workbuddy/skills/english-daily/references/level-map.md` | Level 1：5—8；**Level 2：6—8** | ⚠ **Level 2 行需改**（否则 Skill 读 level-map 时又取到 6—8） |

**给 skill-designer 的 SKILL.md 第 5 步替换文案**（去掉写死的「5—8」）：

> 5. 讲新课（等待作答）：按 `references/level-map.md` 取当前级别的下一个知识点。固定内容量——1 个语法点 + **生词数量按当前级别口径取：Level 1 为 5—8 个；Level 2 常规 10 个（区间 8—12），触发降载时 6—8 个（降载判据见教学方案 §2.7）**（含音标和中文）+ 3—5 个例句 + 3 道小题 + 1 道开放题（造句或写 5 句左右的小段）。总量控制在 20—30 分钟，不允许一课塞进两个语法点。

**level-map.md 的 Level 2「每课词汇」行替换文案**：

> 每课词汇：8—12 个（常规 10）；触发降载时 6—8 个。

> 边界：`lesson-plan.schema.json` 的绝对范围仍为 `3—12`（不动）；「5—8」仅在 Level 1 成立。

### B.3 给 fe-dev 的 4 组教学裁定

#### B.3.1 错词复习规则（对应 FE P3）

- **一次会话出 5 题**（与上课复习一致）；断更时按 2.5 上浮（`D = 3—6` → 7 题，`D >= 7` → 8—10 题）。**复习题量与上课流程共用一套，不做两套。**
- **前端不做教学排序**：`wrong.html` 的「今日队列 Top-N」直接用服务端 `/mistakes/pending` 的默认顺序；2.6 的教学排序（强制位 → N-1/N-3/N-7 → `streak==1` 边际收益位 → 兜底）只在课前由 Amy 取题时用。前端复刻 2.6 会与服务端口径打架。
- **`errorReason`（错因）默认展开**，不折叠。依据 3.4：学生偏好直接纠错，瓶颈是「写时不自查」，错因必须一眼可见才有提示效果。同一条目重复出现不必重复展开。
- **答后反馈文案**（固定三句式，不用百分制）：
  - 答对：`✅ 答对了 · 连续答对 {streak}/2`；`streak >= 2` 追加 `—— 已过关，退出复习队列`。
  - 答错：`❌ 又错了 · 连续答对清零`；**必须**追加 `这是第 {wrongCount} 次犯，上次在第 {lastLessonNo} 课`（G4）。
- **「诊断」来源错词**（`firstLessonNo/lastLessonNo` 为 null，DQ4）的排序：**不参与 N-1/N-3/N-7 结构位**，只按 `wrongCount` / `streak` 参与边际收益位与兜底位，并排在课程来源错词**之前**（诊断项多为基础欠账，早出队收益高）。展示「来源」时为空显示 `诊断`，不显示 `—`。

#### B.3.2 课程详情页折叠策略（对应 FE P2）

| 小节 | 默认 | 理由 |
|---|---|---|
| `今日语法` / `例句` / `作业` / `批改` | **展开** | 构成一课的可复盘主线：「讲了什么 + 要做什么 + 我错在哪」 |
| `复习` | **折叠** | 复习题只在对话里出现过，详情页是文字留档，价值低于新课 |
| `词汇` | **折叠** | 已有独立词汇页（`words.html`），详情页展开会重复 |
| `我的作答` | **折叠** | 与 `批改` 内容高度重合（批改已逐题引用作答），避免滚两遍 |
| `难度反馈` | **折叠** | 元信息（`too_easy / just_right / too_hard`），非教学内容 |

- 提供「全部展开 / 全部折叠」一键切换；支持 URL 深链直接展开某一节（复用现有 `#date` 深链做法，如 `?expand=grading`）。
- **移动端**默认只展开 `批改`。
- 折叠是「延后一层」，不是隐藏——任何小节都不得因折叠而取不到数据或测不到内容。

#### B.3.3 首页是否展示 `progress.note`（对应 FE Q7）→ **不展示原文**

- `note` 现在是**写给 Amy 的决策记录**（如「第 5、6 课错误未持续下降且老错复发，暂停加速，先做巩固纠错」），措辞是内部诊断，直接给学生看会带来「被评判」的负面效果（看到「未持续下降」易挫败）。
- 但「决策透明 = 信任」的教学价值成立（F1 今日决策卡）。处置：**首页不显示 `note` 原文**；要展示「为什么今天学这个」时，用 **`nextRecommendation`（学生向文案）**，不用 `note`。
- 建议后端若要给学生看，新增一个 `studentNote`（学生向措辞）字段、由 Amy 撰写；在此之前 `note` 保留在接口里、前端忽略。

#### B.3.4 阅读页交互（对应 FE P4）

- **中文翻译默认隐藏**：点击「看中文」逐段展开（沿用现有 `.zhbtn`）。依据：本学生「理解 ≈ Level 2 / 产出 ≈ Level 1」，阅读目的是英文直读，中文默认露出会退化成翻译练习；生词率 ≤10% 的保证下随时可查即可。`Paragraph.zh` 可为 null，为空时按钮禁用。
- **理解题改为「先答再看答案」**：答案默认折叠（`<details>`），学生先作答、再展开对照。依据：直接给答案 = 提前给答案（违反硬规则）；且 R5 要求理解题错误单独记 `comprehensionErrorCount`，不先答就无法记录。**本阶段无阅读写接口**（P4 阻塞），故作答**仅前端本地留存、暂不落库**，落库等 be-dev 的 readings 接口。
- **生词注释不跳转词汇页**：跳转会打断阅读流；`vocabularyNotes` 已内联给中文，够用。若某词已在词汇库中，注释行末尾可给一个**新标签**打开的「在词汇卡查看」次按钮（`target=_blank`），主行为仍是看内联注释。
- **iframe 架构**：教学侧同意去掉 iframe 改同页渲染（FE Q4），此为前端决策；教育侧只提两条硬要求：① 「当天不覆盖」的可见性（F8）必须保留；② `←/→` 与 `#date` 深链行为不得退化。
