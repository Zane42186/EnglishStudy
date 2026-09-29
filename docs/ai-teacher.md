# AI 英语老师文档（Amy）

> **状态：第一版（正式正文）· 2026-09-29**
> 数据基准：第 6 课（2026-09-29）下课后的仓库状态。
> 本文所有结论均可在下列文件中定位，**没有推测、没有虚构学生未学过的内容**：
> `progress.md`、`wrong-words.md`、`notes/day-01-07.md`、`read/*.md`、`digest.md`、`INDEX.md`、`review/*.html`。
> 规则权威来源：`PROJECT.md`（理念）、`AGENTS.md`（角色分工）、`backend/docs/03-api-contract.md`（数据契约）。
> 与旧版骨架的关系：本文件替换原 TODO 骨架，原骨架登记的「规则存放位置」并入本文第一章与第十一章。

---

## 一、当前学习体系

### 1.1 角色分工（对齐 `AGENTS.md`）

| 角色 | 在英语学习上负责什么 | 当前落地形态 |
|---|---|---|
| **Amy（本文件）** | 教学决策：学什么、讲多少、怎么批、是否升降级 | 由 Skill `english-daily` 承载执行 |
| **Skill** | 把 Amy 的流程固化为可重复执行的步骤与脚本 | `.workbuddy/skills/english-daily`（**不在版本库内**，见 `docs/skills.md` 风险登记） |
| **Backend** | 学习记忆：只搬运、不重设计教学规则 | `backend/` 仅有设计稿，**无可运行代码** |
| **Frontend** | 学习界面 | `review/*.html`，由 `build_board.py` 静态生成 |
| **Git** | 版本安全 | `main` 单分支，origin → `Zane42186/EnglishStudy` |

### 1.2 数据真相源（Markdown 优先，数据库尚未启用）

| 内容 | 文件 | 性质 |
|---|---|---|
| 级别 / 课号 / 连击 / 反馈 / 待补清单 | `progress.md` | 手工维护（Amy 维护） |
| 错词与掌握度 | `wrong-words.md` | 手工维护（Amy 维护） |
| 课程正文与批改 | `notes/day-01-07.md`（每 7 课一份） | 追加式，不重写 |
| 当日阅读 | `read/YYYY-MM-DD-read.md` | 一天一个文件，当天不覆盖 |
| 上课速读摘要 | `digest.md` | 脚本生成，Amy 上课只读这一份 |
| 索引 / 看板 | `INDEX.md`、`review/*.html` | 脚本生成，禁止手改 |

### 1.3 上课流程（11 步，当前实际执行）

```
读 digest + progress → 定课号 N → 出复习题（等待作答）→ 批改复习
→ 讲新课（等待作答）→ 收作业（等待作答）→ 批改作业 → 收难度反馈（等待作答）
→ 归档到 notes → 生成当日阅读 → 重建看板 → 汇报
```

四条硬规则：

1. **断更不断号**：中断后下次上课仍按课号连续编号（第 6 课即为补课实例）。
2. **未作答不推进**：任何老师环节不得替学生作答或提前给答案。
3. **只追加不覆盖**：笔记只追加；当天阅读已存在则跳过。
4. **难度由学生反馈定，Amy 执行**。

### 1.4 课号与文件规则

- 课号 N = 笔记中实际最大课号 + 1。
- 目标文件：`notes/day-{起始:02d}-{结束:02d}.md`，起始 = ⌊(N-1)/7⌋×7+1，结束 = 起始+6。
- 当天第一次课在标题标日期（`## 第 N 课 · YYYY-MM-DD`），同一天第二次课不标日期。
- 第 1—7 课 → `day-01-07.md`；**第 8 课起写入 `day-08-14.md`**。

---

## 二、当前学生学习状态（截至第 6 课 · 2026-09-29）

> 学生：Zane，软件工程学生，零基础起步，目标为「能读懂并写出日常句子」。
> 学习方式：每天 20—30 分钟，课后作业必做，以中文交流、英文术语保留原文。

### 2.1 已经学过的内容（6 课）

| 课号 | 日期 | 级别 | 新知识点 |
|---|---|---|---|
| 1 | 2026-09-26 | Level 1 | 主语 + 谓语 + 宾语 |
| 2 | 2026-09-26 | Level 1 | be 动词 am / is / are（含否定、疑问） |
| 3 | 2026-09-27 | Level 1 | 主格与形容词性物主代词 I/my、he/his、she/her |
| 4 | 2026-09-27 | Level 2 | 现在进行时 am / is / are + -ing（含 -ing 三条拼写规则） |
| 5 | 2026-09-28 | Level 2 | 一般现在时与现在进行时的区别（标志词 + 状态动词不用进行时） |
| 6 | 2026-09-29 | Level 2 | 一般过去时 was / were（含否定、疑问、时间标志词） |

累计产出：**6 课 · 52 个词条 · 11 篇阅读 · 19 条错词记录**（来源：`build_board.py` 输出 `课程数=6 阅读数=11 词汇数=52`）。

### 2.2 已经掌握（判断依据：作业正确、错词已过关或诊断通过）

| 能力 | 证据 |
|---|---|
| 主谓宾语序 | 第 1 课作业、第 6 课复习均正确 |
| be 动词 am / is / are 与主语匹配 | 第 2 课作业、第 6 课复习正确 |
| 主格 / 物主代词区分（I/my、he/his、her） | 第 3 课作业正确率 3/4，后续复习稳定 |
| 现在进行时结构（am/is/are + -ing） | 第 4 课复习与第 5 课作业正确 |
| -ing 三条拼写规则（去 e、双写、直接加） | 第 4 课作业 `making / running / writing` 全对 |
| 时态标志词判断（every day vs now） | 第 5、6 课选择题均正确 |
| there is / there are、a / an | 第 4 课补漏块全对，错词已过关 |
| this / that / these / those | 第 5 课补漏块基本正确 |
| 疑问词 what / who / where | 第 6 课补漏块全对 |
| 三单 -s、don't / doesn't、can、介词 in、名词复数 | 第 5 课前诊断测试通过（免修） |

### 2.3 掌握不稳定（准确度问题，非理解问题）

| 项 | 表现 | 次数 |
|---|---|---|
| `play game`（可数名词裸用） | 第 4 课、第 6 课作业，累计 **3 次** | 3 |
| 疑问句结尾漏问号 / 问号前留空格 | 多次，含 `Do you like coffee.`、`What were you yesterday.` | ≥3 |
| 句首字母不大写 | `those are their bags.`、`Now, My grandpa` | 2 |
| 拼写（their / teach / busy / interesting） | `Theri`、`teached`、`bush`、`intrusting` | 4 |
| 产出型第三人称单数 -s | 第 6 课复习仍写 `Tom play soccer` | 1（未过关） |

### 2.4 出现过错误的完整清单

见 `wrong-words.md`（19 条：**已过关 4 条、未过关 15 条**），类型分布见本文第四章。

### 2.5 当前学习阶段判断

- **理解层面：已达到 Level 2 中段** —— 三个时态（一般现在 / 现在进行 / 一般过去）的辨认与结构选择正确率稳定。
- **产出层面：仍是 Level 1 末段** —— 简单句能写，但「限定词 / 标点 / 不规则形态」三类细节错误反复出现。
- **瓶颈定位：不是「没学过」，而是「没形成自检习惯」**。证据：同一批题目口头判断正确、书面产出出错；第 3 课书写规范达标时错误数立刻降到 2。
- 综合评语（非官方测评）：**理解 ≈ Level 2，产出 ≈ Level 1 末段**；这正是第 4—6 课维持 Level 2 而不加速的原因。

### 2.6 下一阶段适合学什么（学员级结论）

1. **主线（Level 2 顺序）**：规则动词过去式 -ed → 不规则过去式 → 过去时否定与疑问 did → will / be going to。
2. **补漏（并行）**：介词 on / at（补漏块 4，待做）；祈使句与 Let's（未测）。
3. **习惯（贯穿）**：书写与形态自检 —— 句尾标点、可数名词复数、不规则动词形态。
4. **不学（暂缓）**：比较级、最高级、从句类内容（Level 2 后半段及 Level 3）。

---

## 三、已有课程

### 3.1 课程清单（真实数据）

| 课号 | 日期 | 级别 | 知识点 | 生词 | 当日阅读 | 反馈 | 作业错误数 |
|---|---|---|---|---|---|---|---|
| 1 | 2026-09-26 | Level 1 | 主谓宾语序 | 8 | My Day | 太简单 | 3 |
| 2 | 2026-09-26 | Level 1 | be 动词 am/is/are | 7 | My Teacher and I | 太简单 | 4 |
| 3 | 2026-09-27 | Level 1 | 主格 / 物主代词 | 7 | My Friend Tom | 太简单 | 2 |
| 4 | 2026-09-27 | Level 2 | 现在进行时 | 10 | My Room、My Work Day | 刚好 | 6 |
| 5 | 2026-09-28 | Level 2 | 两种时态辨析 | 10 | My Day My Way、Amy Is Busy、Weekend and Now | 刚好 | 2 |
| 6 | 2026-09-29 | Level 2 | 过去时 was / were | 10 | Yesterday、Tom's Bad Day、Where Were You? | 刚好 | 5 |

补充事实：

- 第 3、4 课同一天（2026-09-27），第 1、2 课同一天（2026-09-26）；第 3 课当天追加生成 2 篇阅读（学生要求）。
- 第 6 课为中断一天后补课，按「断更不断号」处理。
- 词汇总数 52 = 六课词汇表去重累计；阅读 11 篇 = 2+3+3+3（按日归档在 `read/`）。
- 第 5 课前做过一次 **Level 1 待补点诊断（10 题）**，结果为 6 项免修、3 项转补漏块、1 项待测（见 `progress.md`）。

### 3.2 课程数据位置

| 内容 | 位置 |
|---|---|
| 课程正文（语法 / 词汇 / 例句 / 作业 / 作答 / 批改 / 反馈） | `notes/day-01-07.md` 的 `## 第 N 课` 段 |
| 当日阅读（含生词注释、理解题） | `read/YYYY-MM-DD-read.md` |
| 一句话摘要、词汇卡、错词表 | `digest.md`、`review/words.html`、`review/wrong.html` |
| 人读版课程页 | `review/lessons/lesson-N.html` |

---

## 四、错题类型

### 4.1 类型分布（19 条错词记录，按 `mistakes.error_type` 枚举归口）

| 类型（DB 枚举） | 条数 | 占比 | 典型条目 |
|---|---|---|---|
| `grammar` 语法 | 9 | 47% | `play game`、`I reading a book`、`my grandpa and me`、`at yesterday`、`Tom play soccer`、`I teached` |
| `word_choice` 用词 | 4 | 21% | `We see movie`（watch/see）、`ask for my teacher`、`what do you do?`、`What were you yesterday`（how） |
| `capitalization` 大小写 | 3 | 16% | `zane`、`Tv`、`those are their bags.` |
| `punctuation` 标点 | 2 | 11% | `Do you like coffee.`（缺问号）、`now,liked my teacher`（逗号连句） |
| `spelling` 拼写 | 1 | 5% | `Theri`（their） |
| `other` | 0 | — | — |

> 未过关 15 条的分布：语法 8、标点 2、大小写 2、用词 2、拼写 1。
> 说明：`error_type` 字段当前由人工判定；枚举值与 `schema.sql` 完全一致，**无需改表**。

### 4.2 三种可控的错误模式（Amy 的处置策略）

| 模式 | 特征 | 处置策略 | 依据 |
|---|---|---|---|
| **A. 形态/限定类**（可数名词裸用、漏 be 动词、不规则过去式、第三人称单数） | 反复出错、每次都能改对 | 错词本 2 次过关制 + 作业强制自查「可数名词有没有加 s」 | `play game` 3 次、`I reading` 1 次 |
| **B. 书写规范类**（问号、句首大写、逗号连句、空格） | 集中爆发后能整批修正 | 每课开场固定 5 条自查 + 作业前提示 | 第 3 课规范达标后错误数 4 → 2 |
| **C. 用词/搭配类**（watch/see、ask for、how/what） | 一次性为主，讲解后不再犯 | 讲清「为什么不能用另一个」+ 当场同类型验证题 | `watch`、`ask for` 已过关 |

### 4.3 高频错误的量化观察

- **产出型错误 > 理解型错误**：19 条中，理解层面误判仅 4 条（用词类），其余 15 条都是「知道规则但写错」。
- **同一错误重复率**：`play game` 出现 3 次、问号类 ≥3 次、句首大写 2 次、`their` 拼写 2 次 —— 说明「讲解已足够，缺的是产出环节的强制检查」。
- **新知识点首课错误率显著更高**：第 4 课（新语法点进行时）6 处 vs 第 3 课 2 处，这是拒绝「每课 2 个知识点」的实证依据。

---

## 五、课程结构（lesson 数据结构）

### 5.1 设计原则

1. **优先兼容现有结构**：以 `notes/*.md` 的小节为唯一真相源，数据库字段由 `backend/docs/02-data-model.md` 既有设计承载。
2. **不新增表、不改字段类型**：本节只提出 **2 个 `section_type` 枚举值扩展申请**，其余全部落在既有表中。
3. 任何与 `schema.sql` 冲突之处，**先记录、不实施**（见 5.4）。

### 5.2 字段映射（需求 → 现有落点）

| 需求字段 | 现有落点 | 说明 |
|---|---|---|
| `lesson_id` | `courses.id`（自增） | 数据库内部主键；md 侧用 `notes/day-01-07.md` + 课号定位 |
| `title` | `courses.lesson_no` + `courses.summary` | 标题由课号生成；一句话摘要即标题的语义内容 |
| `level` | `courses.level_code` | 上课时级别，如 `Level 2` |
| `objectives` | **`course_sections` 新增 `section_type='objectives'`（待确认）** | 本课目标，1—3 条；md 侧写进 `> 一句话：` 之外的目标行 |
| `review` | `course_sections.section_type='review'` | 已有枚举，直接复用 |
| `new_knowledge` | `course_sections.section_type='grammar'` + `course_knowledge_points(role='new')` | 语法正文入 section，知识点入关联表 |
| `vocabulary` | `vocabulary` + `course_vocabulary` | 已有表，词表 + 例句（`vocab_table` section 保留原文） |
| `grammar` | 同 `new_knowledge` | 与知识点表一一对应 |
| `examples` | `course_sections.section_type='examples'` | 已有枚举 |
| `exercises` | `exercises` 表（`exercise_no` / `exercise_type` / `prompt` / `reference_answer` / `user_answer` / `is_correct` / `error_note`） | 已有表，**每题一行**，批改回填 |
| `expected_mistakes` | **`course_sections` 新增 `section_type='expected_mistakes'`（2026-09-29 已批准，见团队总纲 D-10）** | 备课时预判的易错点，用于批改时的「为什么不是 Y」；**不对学生展示**（它是答案清单，学生端的提交前自检只给 `selfChecks` 规则，规则可给、答案不可给） |
| `homework` | `course_sections.section_type='homework'` + `exercises` | 题干入 section，题目入 exercises |

补漏块（backfill）不入 `course_sections`，走 `course_knowledge_points(role='backfill')` —— **该枚举值已在 schema 中存在，无需扩展**。

### 5.3 一课数据的 JSON 视图（对齐 `POST /courses` 契约）

```json
{
  "lessonNo": 7,
  "lessonDate": "2026-09-30",
  "levelCode": "Level 2",
  "summary": "学会规则动词过去式 -ed，能说清「上周做了什么」",
  "objectives": [
    "能写出规则动词的 -ed 形式（play→played、study→studied）",
    "能用过去式写 5 句关于上周的句子"
  ],
  "sections": {
    "review": "第 6 课 was/were 一题 + 错词 play games、问号两条",
    "grammar": "规则动词过去式：一般加 -ed；辅音字母+y 结尾改 y 为 i 加 ed……",
    "examples": "I played football yesterday. / She studied English last night.",
    "homework": "3 道小题 + 1 道开放题（含强制自查项）",
    "expected_mistakes": [
      { "wrong": "I studyed English.", "correct": "I studied English.", "reason": "辅音字母 + y 结尾要改 y 为 i 再加 -ed" },
      { "wrong": "We played game.", "correct": "We played games.", "reason": "可数名词不能裸用（历史高频错，累计 3 次）" }
    ]
  },
  "vocabulary": [
    { "word": "played", "phonetic": "/pleɪd/", "meaning": "玩（过去式）", "example": "I played games yesterday." }
  ],
  "knowledgePoints": [ { "code": "L2-04", "name": "规则动词过去式", "role": "new" } ]
}
```

### 5.4 需要后端确认的 2 项（不擅自改表）

| 项 | 现状 | 建议 | 影响 |
|---|---|---|---|
| `course_sections.section_type` 增 `objectives`、`expected_mistakes` | 现枚举为 8 值，无这两项 | 建议 `ALTER TABLE` 扩枚举（仅加值，不改类型、不动存量数据） | 影响迁移脚本；**需后端工程师评估后实施** |
| `courses` 缺 `objectives` 结构化字段 | 只有 `summary` | 若后端不愿扩枚举，可退化为：objectives / expected_mistakes 只写进 `course_sections.content_md`（用 `grammar` 段落前缀标记），**不改表** | 零风险，但结构化查询能力下降 |

> 若两者都不做，Amy 侧仍可照常上课（md 为真相源），只是平台化后无法按「目标 / 预判错误」做统计。

---

## 六、学习记录结构

### 6.1 一课结束后应保存的 9 类信息（需求 → 落点）

| 需求字段 | 落点 | 落点说明 |
|---|---|---|
| `lesson` | `courses`（+ `exercises`） | 课基本信息 |
| `score` | `study_records.record_type='grade'` 的 `payload` | **口径：作业错误处数**（现有唯一可复算口径），不折算百分制 |
| `mistakes` | `mistakes` + `mistake_events` | 错词本条目 + 每次犯错的流水 |
| `knowledge mastery` | `course_knowledge_points` + `mistakes` 关联 | 用「该知识点相关错词是否过关」近似掌握度 |
| `vocabulary mastery` | `vocabulary` + `mistakes` | 词是否有错记录 / 是否出现在错词本 |
| `grammar mastery` | `knowledge_points` + `mistakes.error_type='grammar'` | 语法错误的次数与过关状态 |
| `study time` | `courses.study_minutes`（已有字段） | 单课时长，手工填或按上下课时间差估算 |
| `feedback` | `progress_feedback` + `user_progress` | 难度反馈与升降级结果 |
| `next recommendation` | `study_records.record_type='feedback'` 的 `payload.next_recommendation` | 下一课计划文本（否则每天的教学决策无法回溯） |

> `record_type` 枚举为 `('attend','homework_submit','grade','review','feedback','reading')`，**现有 6 值已够用**，无需扩展。

### 6.2 一课的记录时序（建议）

```
课开始   → study_records(attend)                      {lessonNo, level}
复习批改 → mistake_events(wrong|correct, mistake_id)  逐条
         → mistakes.streak / status 更新
新课归档 → courses + course_sections + exercises + vocabulary
作业批改 → exercises.is_correct / error_note
         → 新错词 → mistakes（error_type + reason）
         → study_records(grade)   {errorCount, exerciseCount, byType{}}
收反馈   → progress_feedback + user_progress（含 easy_streak / frozen）
下课前   → study_records(feedback) {next_recommendation}
```

### 6.3 示例 payload（对齐现有口径）

```json
// study_records(record_type='grade')
{ "exerciseCount": 9, "errorCount": 5, "byType": { "grammar": 3, "punctuation": 1, "spelling": 1 },
  "newMistakes": 4, "passedMistakes": 0 }

// study_records(record_type='feedback')
{ "feedback": "just_right", "levelBefore": "Level 2", "levelAfter": "Level 2",
  "nextRecommendation": "第 7 课：规则动词过去式 -ed + 补漏块 4（介词 on/at）；复习优先 play games 与问号" }
```

### 6.4 掌握度定义（建议，取现有数据可算的口径）

| 维度 | 定义 | 现有数据可算性 |
|---|---|---|
| 词汇掌握 | 未出现在错词本 → 初识；出现且未过关 → 不稳定；已过关 → 会用 | ✅ 可算 |
| 语法掌握 | 关联错词全部过关且连续 2 课无同类新错 → 稳定 | ✅ 可算 |
| 综合阶段 | 由 `user_progress.current_level` + 错误趋势共同判断（理解与产出分开评估，见 2.5） | ⚠️ 错误趋势需按课统计，后端契约暂缺 |

### 6.5 「错误处数」的不计入项与两个单列计数（2026-09-29 定形，关闭缺口 G10）

`E_N`（唯一分数量口径）= **本课作业（`kind='homework'`）** 中 `verdict=wrong` 的错误处数。以下**不计入 `E_N`，但单独计数**：

| 项 | 单列计数 | 承载位置 |
|---|---|---|
| 补漏块作答错误 | `backfillErrorCount` | `kind='backfill'` 那套 `GradingResult.summary.errorCount` |
| 阅读理解题作答错误 | `comprehensionErrorCount` | 阅读模块（`readings` / 阅读理解作答记录），**不进 `GradingResult`** |
| 空题 `blank`、正确但有更优表达 `correct_with_note`、任务完成度问题 | — | 不计错也不计对，仅在批改文案里提示 |

**G10 结论（正式）**：`grading-result.schema.json` **无需新增字段** —— 不采用「逐题 `sourceScope`」方案。前提约束：

1. **补漏块永远独立成一套 `kind='backfill'`**，不与今日语法作业混排；故 `backfillErrorCount` 由该套的 `kind` 区分即可得出，无需逐题标注来源，也无需在 `summary` 里重复加计数。
2. **阅读理解题不属于 `GradingResult`**（走阅读模块），故 `comprehensionErrorCount` 不在本契约。
3. 若将来出现「一套里混多来源」的真实需求，再评估新增 `sourceScope`；在此之前不加字段。

---

## 七、难度调整规则

### 7.1 基线规则（对齐 `progress.md`，后端已设计搬运，已入库 3 条）

| 反馈 | 动作 | 后端落点 |
|---|---|---|
| `too_easy` 连续 2 次 | 升 1 级，连击清零（受冻结约束） | `POST /progress/feedback` |
| `too_hard` 任意 1 次 | 降 1 级，且 3 课内不再升级 | `upgrade_frozen_until = 当前课号 + 3` |
| `just_right` | 维持级别，仅记录 | `POST /progress/feedback` |

### 7.2 Amy 在执行中加入的 4 条守门规则（当前仅在 `progress.md`，**尚未进入后端契约**）

| 规则 | 内容 | 真实案例 |
|---|---|---|
| **R1 准确度守门** | 即使连击满 2 次，若作业仍有同类老错误反复出现，则**冻结升级**并写明解锁条件 | 第 2 课连击满 2 但错误 4 处 → 冻结；第 3 课规范达标 → 第 3 课后解冻升 Level 2 |
| **R2 升级不豁免欠账** | 升级后未学的低级别知识点转为「待补清单 + 补漏块」，不回头单独成课 | Level 1 剩余 11 点 → 诊断筛出 3 项需补，其余免修 |
| **R3 加速复议条件** | 只有「连续 2—3 课作业错误 ≤2 处 **且** 反馈简单」才考虑一课 2 个知识点 | 第 5 课错误 2 处但反馈「刚好」→ 不触发；第 6 课错误 5 处 → **暂停加速** |
| **R4 暂停加速的触发** | 错误数未持续下降或出现老错复发 → 转巩固纠错，并在作业加强制自查项 | 第 6 课 `play game` 第 3 次 → 第 7 课起作业强制自查句尾标点与可数名词 |

> 这 4 条是 **Amy 的教学判断**，属于「教学策略」范畴。按 `AGENTS.md`，后端只搬运不重设计 —— 是否写入后端服务层，需三方（Amy / 后端 / Skill 设计师）确认；在确认前，它们只存在于 `progress.md`，不影响后端契约。

### 7.3 与后端契约的差异登记

| 差异 | 说明 | 处理建议 |
|---|---|---|
| `upgrade_frozen_until` 语义 | 契约定义为「太难触发冻结 3 课」；R1 的冻结是「准确度触发、无固定期限」 | 建议后端不要复用该字段表达 R1；R1 暂留在 `progress.md` 备注 |
| `easy_streak` 语义 | 契约只统计反馈次数；R3 还要求错误数条件 | 建议保持后端单一职责（只数反馈），错误数条件由 Amy 上课时判断 |

### 7.4 降载规则（Level 保持、只减负荷；2026-09-29 新增）

> **降载 ≠ 降级**。降级（7.1 / 7.2 的 C 类）才改级别；**降载是保持级别、只减本课负荷**。
> 本节为降载机制的**长期生效正式版**；方案文档 `docs/plans/amy-teaching-plan.md` §2.7 为同一规则的过程稿，**两者冲突时以本节为准**（方案会归档，本节不会）。

**触发**（针对上一课 `N-1` 或错词池，任一命中即降载，命中多档取最高）

| 判据 | 条件 | 数据来源（后端就绪后） |
|---|---|---|
| **T-1 单课超阈** | `E_{N-1} >= 5` | `lessons.error_count` / `study_records(grade).payload.errorCount` |
| **T-2 连续超阈** | 最近 2 课均 `E >= 5` | 同上（取近 2 课） |
| **T-3 反馈过难** | `F_{N-1} = too_hard` | `lessons.feedback` |
| **T-4 断更** | `D >= 7` | `progress.lastClassDate` 现算 |
| **T-5 复发阻断** | 存在 `wrongCount >= 4` 且 `error_type ∈ {grammar, word_choice}` 的未过关错词 | `/api/mistakes/pending` |
| **T-6 超载上限** | 拟排生词 > 12 | `LessonPlan.vocabularySize`（schema `maximum:12`） |

**档位表**（命中多档取最高；一次降载最多下调 1 档）

| 档 | 名称 | 命中 | 生词数 | 练习量 | 新知识点 | 阅读 |
|---|---|---|---|---|---|---|
| **L0 常规** | — | 无触发 | 10（8—12） | 新课 3 小题 + 1 开放题；复习 5 题 | 1 个新点，家族一次讲全 | 1—3 篇 |
| **L1 轻度** | 巩固模式 | T-1（E=5—6） / T-3（too_hard 且 E≤5） / T-4（D=3—6） | 6—8 | 新课 3 小题 + 1 开放题（开放题限 3 句）；复习 5—7 题 | 保留，但只讲「肯定 + 否定」 | 1 篇 |
| **L2 中度** | 复现课 | T-1（E≥7 且非新点首课） / T-2 / T-4（D≥7） | 0—6 | 新课小题 2 道 + 开放题 3 句；复习 8—10 题 | 不讲新点，改「同点变式」 | 1 篇短（旧词旧语法） |
| **LX 阻断** | 产出专项 | T-5 | 0（全复用） | 产出型 3—5 写句 + 复习 6—8 题 | 不讲新点，专项攻该错点 | 1 篇 |

- **上限保护**：已在 L2 / LX 仍 `E >= 5` → **不再继续降载**，转 7.2 的诊断 / 降级评估（避免无限降载把课变成纯复习）。
- **D1 例外（防误伤）**：新语法点首课 `E >= 6` 属「新点首课冲高」，**归因新点、不降载**，下一课用同点变式复练（第 4 课 E=6 → 第 5 课回落 2 即此例）。
- **退出条件**：降载后**连续 2 课**同时满足 `E <= 2` 且 `R = 0`（无复发项）且 `F ∈ {too_easy, just_right}` → 退出降载、生词恢复 10；第 1 课先升半档，任一课 `E >= 5` 回退一档重算。降载 / 退出状态写入下一课 `next_recommendation`。

**执行分工（Skill 可自动算 vs Amy 判断 —— 供 Skill 设计师落地，勿漏实现）**

| 环节 | 谁做 | 说明 |
|---|---|---|
| T-1…T-6 的数值比较、档位与生词数查表、是否「新点首课」（看 `grammarPoint.role='new'`） | **Skill 直接算** | 输入全部来自 `snapshot` / `/progress` / `/lessons` / `/mistakes`，无需教学判断 |
| `R`（本课复发项个数）的认定 | **Amy** | 依赖批改结果，Skill 备课时算不出 |
| 「同点变式」的具体题目设计（L2 / LX） | **Amy** | 教学判断 |
| L1 复习题量是否加上限（5→7） | **Amy** | 按当课巩固需要定 |
| 双轨禁令的题型拆分（书写规范类错误不单独触发降级 / 降载） | **Amy（N4 接口未实现前人工）** | 依赖逐题题型数据 |
| 退出条件的判定 | **Skill 算 + Amy 复核** | `E` / `F` 可自动算，`R` 需 Amy |

---

## 八、下一课规划规则

### 8.1 决策算法（每次上课执行）

```
1. 读 digest.md（级别 / 课号 / 最近三课 / 错词待复习）+ progress.md（连击、待补清单）
2. N = notes 中实际最大课号 + 1（与 progress.md 不一致时以 notes 为准，并在回复里说明）
3. 出复习题 3—5 题：
   N-1 一题、N-3 一题、N-7 一题（课号 ≤0 跳过），其余从未过关错词取
   取词优先级：wrong_count 高 → streak 低 → 最近犯错
4. 批改复习：答对 streak+1，答错 wrong_count+1 且 streak=0；streak ≥2 → 已过关
5. 讲新课：**先按 7.4 判定本课是否降载**（定生词数、是否讲新点）；取 level-map 当前级别的下一个知识点；1 个语法点 / 生词按 7.4 档位（Level 2 常规 10，区间 8—12，降载 6—8；Level 1 为 5—8）/ 3—5 例句
   （同一语法「家族」一次讲全，如进行时的肯定 + 否定 + 疑问）
6. 补漏块：从补漏队列取 1 块（3 题，5—8 分钟），不计新语法点
7. 作业：3 小题 + 1 道开放题 + 强制自查项（第 7 课起：句尾标点 + 可数名词）
8. 当日阅读：1—3 篇，Level 1—2 为自编 60—90 词（过渡期加长）
9. 收反馈 → 按第七章规则调整级别 → 归档 → 重建看板
```

### 8.2 补漏队列（当前）

| 序 | 补漏点 | 状态 |
|---|---|---|
| 1 | there is / there are + a / an | ✅ 第 4 课完成，已出队 |
| 2 | this / that / these / those | ✅ 第 5 课完成，已出队 |
| 3 | 疑问词 what / who / where | ✅ 第 6 课完成，已出队 |
| 4 | 介词 on / at | ⏭ 第 7 课 |
| 5 | 祈使句与 Let's（未测） | 待排 |

### 8.3 第 7 课规划推演（样例，可直接执行）

| 项 | 内容 |
|---|---|
| 课号 / 文件 | 第 7 课 → `notes/day-01-07.md` 的最后一课（**第 8 课起开 `day-08-14.md`**） |
| 级别 | Level 2 |
| 新知识点 | 规则动词过去式 -ed（`play→played`、`study→studied`、`stop→stopped`） |
| 词汇 | **8 个**（`E_6 = 5` 命中 7.4 的 **T-1 → 轻度降载 L1**，取 6—8；原写 8—12 已按 7.4 下调）：played / watched / studied / cooked / cleaned / stopped + last week / last month |
| 补漏块 | ④ 介词 on / at |
| 复习题来源 | 第 6 课一题 + 第 4 课一题 + 错词 `play games`、`Do you like coffee?`、`at yesterday` |
| 作业强制自查 | 句尾标点（`.` / `?`）+ 可数名词是否加 s |
| 阅读 | `read/2026-09-30-read.md` 生成 1—3 篇（若当天已有则跳过） |

### 8.4 停止条件（禁止越界）

- 学生未作答 → 不推进下一环节，不替学生写答案。
- 当天阅读已存在 → 不覆盖（除学生明确要求重出）。
- 脚本返回 `BOARD_FAIL` → 先修格式再重跑，不手改生成物。
- 不删除、不重命名、不移动任何已有笔记与阅读文件。

---

## 九、Amy 与后端需要的数据

### 9.1 Amy 读取（读接口）

| 接口 | Amy 用它做什么 | 对应现有 md |
|---|---|---|
| `GET /agent/snapshot?recent=3` | **上课第一步**：级别、课号、最近三课、未过关错词（含 priority）、阅读目录 | `digest.md` |
| `GET /courses/latest` | 「上次学到哪了」的快速回答 | `notes/` 末课摘要 |
| `GET /mistakes?status=pending` | 出复习题、批改后回写 | `wrong-words.md` |
| `GET /vocabulary/stats` | 词汇量汇报 | `review/words.html` 顶部 |

**`digest.md` → `snapshot` 字段对照**

| digest 段落 | snapshot 字段 | 现状 |
|---|---|---|
| 当前级别 / 已上课数 | `progress.currentLevel` / `currentCourseNo` | ✅ 契约已覆盖 |
| 最近三课（含语法要点、词汇、反馈、批改条数） | `recentLessons[]` | ✅ 契约已覆盖 |
| 全部课号一览 | `courseCatalog[]` | ✅ 契约已覆盖 |
| 错词本待复习项（含「第 3 次犯」等文字） | `pendingMistakes[]`（含 `wrongCount` / `priority`） | ⚠️ `priority` 规则未定义，见 9.3 |
| 阅读文件清单 | `readingCatalog[]` | ✅ 契约已覆盖 |
| 错误趋势表、待补清单、补漏队列 | **无对应字段** | ❌ **契约缺口**（见 9.3） |

### 9.2 Amy 写入（写接口）

| 接口 | 触发时机 | 备注 |
|---|---|---|
| `POST /courses` | 新课归档（讲完 + 批改完） | 含 sections 与 vocabulary |
| `PUT /courses/:id` | 回填作业批改与难度反馈 | |
| `POST /mistakes` | 批改时发现新错词 | 需带 `error_type` + `error_reason` |
| `POST /mistakes/:id/review` ★ | 每次复习判对错 | 连击与过关在服务端判定 |
| `POST /progress/feedback` ★ | 收难度反馈时 | 升降级与冻结在服务端判定 |
| `POST /study-records` | 下课时 | `grade` / `feedback` 两类 payload |
| `POST /skill-runs` | 每次执行 `english-daily` | 便于回溯 Skill 侧决策 |

### 9.3 契约缺口清单（请后端评估，不在本次实施范围）

> **2026-09-29 实测后的状态更新**：G1 **已关闭**（`GET /api/lessons/error-trend` 已实现）；
> G2 **已关闭**（`mistakes.priority` 已由服务端推导）；
> G4、G5 与新增需求合并为正式需求单，见 `backend/docs/06-api-requirements-amy.md`（R1—R7）。

| # | 缺口 | 状态 | 说明 |
|---|---|---|---|
| G1 | `snapshot` 无「错误趋势」字段 | ✅ 已关闭 | `/api/lessons/error-trend` 已实现并实测 |
| G2 | `pendingMistakes[].priority` 未定义 | ✅ 已关闭 | 服务端规则：`wrongCount ≥2` → high；`streak ==1` → medium；其余 low |
| G3 | 无「待补知识点 / 补漏队列」字段 | ⏳ 需求 R6 | `/api/knowledge-points` 待实现 |
| G4 | 无「上次未完成的教学动作」 | ⏳ 需求 R5 + R1 | 需 `study_records(feedback).payload.nextRecommendation` 并在快照回传 |
| G5 | `courses.study_minutes` 由谁填未定 | ⏳ 需求 R4 | 建议 Amy 归档时传入 |
| G6 | 无聚合快照接口 | ⏳ 需求 R1（P0） | `/api/agent/snapshot` 实测 404，Amy 现需并发 9 个接口 |
| G7 | 无写接口（复习判定 / 反馈 / 归档） | ⏳ 需求 R2—R5（P0/P1） | 闭环断裂：`streak` / `status` / `lastReviewedAt` 永不变化 |

### 9.4 后端未就绪期间的降级方案（当前生效）

**更新（2026-09-29 实测）**：后端第一版只读 API 已上线可用（16 个 GET 接口，见 `backend/docs/05-api-reference.md`）。
Amy 已实测用 9 个 GET 接口拼出第 7 课计划（`docs/amy-session-07-plan.md`），
但 **聚合快照 `/api/agent/snapshot` 与全部写接口仍未实现**。因此当前为**双轨**状态：

| 数据 | 当前来源 | 切换到 API 的条件 |
|---|---|---|
| 级别 / 课号 / 反馈 / 连击 | `GET /api/progress` ✅ 已切换 | — |
| 已完成课程 / 错误趋势 | `GET /api/lessons`、`/api/lessons/error-trend` ✅ 已切换 | — |
| 错词与优先级 | `GET /api/mistakes/pending` ✅ 已切换 | — |
| 词汇量 | `GET /api/vocabulary/stats` ✅ 已切换 | — |
| 学习记录 | `GET /api/study-records` ✅ 已切换 | — |
| 一次取全上下文 | `digest.md`（md） | 等 `GET /api/agent/snapshot`（需求 R1） |
| 待补知识点 / 补漏队列 | `progress.md`（md） | 等 `GET /api/knowledge-points`（R6） |
| 阅读目录 | `read/*.md`（md） | 等 `GET /api/readings`（R7） |
| 复习结果 / 反馈 / 课件回写 | 手工改 md | 等写接口 R2—R5 |

> 完整需求与验收标准见 `backend/docs/06-api-requirements-amy.md`。
> **可关闭降级方案的条件**：R1 + R2 + R3 实现且 DQ1 数据同步修复后，`digest.md` 降级为人读副本。

### 9.5 已实测的数据质量问题（2026-09-29）

| # | 问题 | 证据 |
|---|---|---|
| DQ1 | 库内 mistakes `total=20 / pending=15 / passed=5`，与 `wrong-words.md` 的 19 条（15 / 4）不一致，`byType` 多出 `other=1` | `GET /api/mistakes/stats` vs md |
| DQ2 | `wrong_text` 混入人工批注（id12、id8、id14、id16 等） | `GET /api/mistakes/pending` |
| DQ3 | 词汇口径两套：API 51（按词去重）vs 看板 52（按课累计） | `/api/vocabulary/stats` |
| DQ4 | 来源课号为「诊断」的错词，`firstLessonNo` 为 null | `GET /api/mistakes?status=passed` |
| DQ5 | `lastReviewedAt` 全为 null（写接口缺失所致） | `GET /api/mistakes/pending` |

> 其中 **DQ1 影响教学准确性**（错词计数与教师记录不一致），其余为字段语义与口径问题。

---

## 十、Amy 与 Skill 设计师的协作方式

### 10.1 分工与边界

| 事项 | 谁定 | 产物 |
|---|---|---|
| 教学策略（讲什么、讲多少、怎么批、升降级） | **Amy（唯一决策者）** | `docs/ai-teacher.md`、`progress.md` |
| 流程固化（步骤、脚本、输入输出格式、JSON Schema） | Skill 设计师 | `.workbuddy/skills/english-daily/`、`docs/skills.md` |
| 数据落库与接口 | 后端工程师 | `backend/` |
| 界面呈现 | 前端工程师 | `review/*.html` → 未来 Vue |
| 版本与基线 | Git 工程师 | `docs/changelog.md` |

**协作链**（`AGENTS.md` 第 4 条）：Amy → Skill 设计师 → 后端工程师 → 前端工程师，Git 贯穿全程。

### 10.2 变更流程（避免两套规则）

```
教学规则变更（改级别策略 / 加补漏块 / 改复习取题法）
  1. Amy 先在 progress.md 落地并记录原因（真相源）
  2. 同步更新 docs/ai-teacher.md（本文）
  3. 若涉及流程步骤 → 交 Skill 设计师更新 SKILL.md 与脚本；改脚本需重跑 build_board 验证
  4. 若涉及数据结构 → 交后端工程师评估契约影响（见 5.4 / 9.3）
  5. Git 工程师记录 changelog
禁止：绕过真相源直接改 Skill；或改了 Skill 不更新本文档。
```

### 10.3 能力拆分对照（`AGENTS.md` 列出的 8 项 Agent 能力 vs 现状）

| 能力 | 当前状态 | 承载者 |
|---|---|---|
| `daily-lesson` | ✅ 运行中 | Skill `english-daily`（v2.2.0），11 步流程 |
| `grammar-teaching` | ✅ 内嵌在 daily-lesson 第 5 步 | 同上 |
| `vocabulary-teaching` | ✅ 内嵌（词汇表 + 音标 + 例句） | 同上 |
| `exercise-generation` | ✅ 内嵌（3 小题 + 1 开放题 + 补漏块） | 同上 |
| `answer-grading` | ✅ 内嵌（错误类型 + 正确句 + 解释） | 同上 |
| `mistake-analysis` | ⚠️ 半自动：分类与归口由 Amy 人工判定 | 待拆分独立 Skill（含 `error_type` 判定规则） |
| `learning-progress-analysis` | ⚠️ 由 `build_board.py` 出统计，趋势判断靠 Amy 阅读 | 待拆分（依赖 G1） |
| `next-lesson-planning` | ✅ 有明确规则（本文第八章），未独立成 Skill | 可保持内嵌 |

### 10.4 需要 Skill 设计师处理的事项

1. **Skill 源码入库决策**（`docs/skills.md` 已登记风险）：目前 `.workbuddy/skills/english-daily/` 不在版本库，仓库丢失即无法恢复。
2. **`daily-lesson` 的输入输出格式固化**：建议按 `GET /agent/snapshot` 定义输入 JSON、按本文 6.3 定义输出 JSON。
3. **`mistake-analysis` 的 `error_type` 判定规则**：把 Amy 的人工判定（第四章的 5 类）写成可执行规则，避免因模型判断波动导致分类漂移。
4. **阅读文件的批量生成约束**：当天已有文件不得覆盖（现有脚本已保证），Skill 侧需在文档中明确「学生要求追加篇目」是唯一例外。

---

## 十一、附录

### 11.1 数据文件清单（真相源与生成物）

| 文件 | 类型 | 维护者 |
|---|---|---|
| `PROJECT.md` / `AGENTS.md` | 权威规范 | 全项目 |
| `progress.md` / `wrong-words.md` | 手工真相源 | Amy |
| `notes/*.md` | 手工真相源（追加） | Amy |
| `read/*.md` | 手工真相源（一天一档） | Amy |
| `digest.md` / `INDEX.md` / `review/*` | 生成物 | `build_board.py` |
| `.workbuddy/skills/english-daily/` | Skill 源码 | Skill 设计师（**未入库**） |

### 11.2 本文件引用的真实数据快照（2026-09-29）

- `build_board.py` 输出：`BOARD_OK 课程数=6 阅读数=11 词汇数=52 摘要字节=2807`
- 错词本：19 条（已过关 4 / 未过关 15），本次已去重 `play game` 重复行并删除 1 行非错题记录
- 学生状态：`Level 2`、当前课号 6、`easy_streak = 0/2`、最近反馈 `just_right`、上次上课 `2026-09-29`

### 11.3 待办（按角色）

- **Amy**：第 7 课（规则动词过去式 -ed）+ 补漏块 4；第 8 课开 `notes/day-08-14.md`。
- **Skill 设计师**：Skill 源码入库决策；固化 `daily-lesson` 输入输出；`mistake-analysis` 规则化。
- **后端工程师**：评估 G1—G5 与 5.4 的 2 项枚举扩展；`snapshot` 增补 errorCount / priority 定义。
- **前端工程师**：本次无需求（`review/*.html` 保持不动）。
- **Git 工程师**：本次新增 `docs/ai-teacher.md`、修订 `wrong-words.md`，建议记录到 `docs/changelog.md`。
