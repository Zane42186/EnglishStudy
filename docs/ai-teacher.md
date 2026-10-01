# AI 英语老师文档（Amy）

> **状态：第一版（正式正文）· 2026-09-29**
> 数据基准：第 7 课（2026-10-01）下课后的仓库状态。
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
| **Backend** | 学习记忆：只搬运、不重设计教学规则 | `backend/` 已是**可运行服务**：`localhost:4000/api`，**29 个接口已登记**（含 6 条写链路与聚合快照，见 `backend/docs/05-api-reference.md` §28—29 为最新批次） |
| **Frontend** | 学习界面 | `review/*.html`，纯 API 驱动的静态页（不再由脚本生成） |
| **Git** | 版本安全 | `main` 单分支，origin → `Zane42186/EnglishStudy` |

### 1.2 数据真相源（双轨：md 手工源 + MySQL 运行库）

| 内容 | 文件 | 性质 |
|---|---|---|
| 级别 / 课号 / 连击 / 反馈 / 待补清单 | `progress.md` | 手工维护（Amy 维护） |
| 错词与掌握度 | `wrong-words.md` | 手工维护（Amy 维护） |
| 课程正文与批改 | `notes/day-01-07.md`（每 7 课一份） | 追加式，不重写 |
| 当日阅读 | `read/YYYY-MM-DD-read.md` | 一天一个文件，当天不覆盖 |
| 批改 / 补漏 / 学习记录（机器契约） | `records/*.json` | **Amy 产出、后端只读消费**（2026-09-30 新增） |
| 上课速读摘要 | `digest.md` | 后端 `db:summary` 生成，Amy 上课只读这一份 |
| 索引 / 看板 | `INDEX.md`（后端 `db:summary`）、`review/*.html`（前端维护） | 生成物，禁止手改 |

> **2026-10-01 更新 —— 库已启用**：MySQL `english_platform` 已建成并完成回填（**13 表 2 视图**，`db:compare` **15/0/0**）。
> 真相源分两层：**教学内容**仍以 md 为手工真相源（`records/*.json` 是 md → 库的机器契约中间层）；
> **运行态数据**（课表 / 错词 / 学习记录 / 进度）**以库内为准**。写路径口径与切换点见 `docs/skills.md` §7.2。

### 1.3 上课流程（11 步，当前实际执行）

```
读 digest + progress → 定课号 N → 出复习题（等待作答）→ 批改复习
→ 讲新课（等待作答）→ 收作业（等待作答）→ 批改作业 → 收难度反馈（等待作答）
→ 归档到 notes + `records/*.json` → 生成当日阅读 → 跑 `db:summary` 重建 `digest.md`/`INDEX.md` → 汇报
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

## 二、当前学生学习状态（截至第 7 课 · 2026-10-01）

> 学生：Zane，软件工程学生，零基础起步，目标为「能读懂并写出日常句子」。
> 学习方式：每天 20—30 分钟，课后作业必做，以中文交流、英文术语保留原文。

### 2.1 已经学过的内容（7 课）

| 课号 | 日期 | 级别 | 新知识点 |
|---|---|---|---|
| 1 | 2026-09-26 | Level 1 | 主语 + 谓语 + 宾语 |
| 2 | 2026-09-26 | Level 1 | be 动词 am / is / are（含否定、疑问） |
| 3 | 2026-09-27 | Level 1 | 主格与形容词性物主代词 I/my、he/his、she/her |
| 4 | 2026-09-27 | Level 2 | 现在进行时 am / is / are + -ing（含 -ing 三条拼写规则） |
| 5 | 2026-09-28 | Level 2 | 一般现在时与现在进行时的区别（标志词 + 状态动词不用进行时） |
| 6 | 2026-09-29 | Level 2 | 一般过去时 was / were（含否定、疑问、时间标志词） |
| 7 | 2026-10-01 | Level 2 | 规则动词过去式 -ed（含 -y 变 i、双写规则）+ 补漏块 ④ 介词 on / at |

累计产出：**7 课 · 61 个词条 · 14 篇阅读 · 26 条错词记录**（来源：库内实测 —— `mistakes` 26 条、`lesson_exercises` 41 条；词汇/阅读数以 md 与 API 一致口径计）。

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

见 `wrong-words.md`（26 条：**已过关 6 条、未过关 20 条**），类型分布见本文第四章。

### 2.5 当前学习阶段判断

- **理解层面：已达到 Level 2 中段** —— 三个时态（一般现在 / 现在进行 / 一般过去）的辨认与结构选择正确率稳定。
- **产出层面：仍是 Level 1 末段** —— 简单句能写，但「限定词 / 标点 / 不规则形态」三类细节错误反复出现。
- **瓶颈定位：不是「没学过」，而是「没形成自检习惯」**。证据：同一批题目口头判断正确、书面产出出错；第 3 课书写规范达标时错误数立刻降到 2。
- 综合评语（非官方测评）：**理解 ≈ Level 2，产出 ≈ Level 1 末段**；这正是第 4—7 课维持 Level 2 而不加速的原因。

### 2.6 下一阶段适合学什么（学员级结论）

1. **主线（Level 2 顺序）**：~~规则动词过去式 -ed~~（第 7 课已完成）→ **不规则过去式**（第 8 课）→ 过去时否定与疑问 did → will / be going to。
2. **补漏（并行）**：~~介词 on / at（补漏块 4）~~（第 7 课已完成）；**祈使句与 Let's（未测，待补漏块 5）**。
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
| 7 | 2026-10-01 | Level 2 | 规则动词过去式 -ed | 10 | My Last Weekend、Amy Worked Late、Tom's Busy Day | 刚好 | 2（补漏块另 3 处） |

补充事实：

- 第 3、4 课同一天（2026-09-27），第 1、2 课同一天（2026-09-26）；第 3 课当天追加生成 2 篇阅读（学生要求）。
- 第 6 课为中断一天后补课，按「断更不断号」处理。
- 词汇总数 61 = 七课词汇表去重累计；阅读 14 篇 = 2+3+3+3+3（按日归档在 `read/`）。
- 第 7 课为 `records/` 归档口径切换点：作业 4 题（2 处错）+ 补漏块 3 题（3 处错），补漏块错误**单列不计入作业错误数**（见 §6.5）。
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

### 4.1 类型分布（26 条错词记录 · 2026-10-01，按 `mistakes.error_type` 枚举归口）

| 类型（DB 枚举） | 条数 | 占比 | 典型条目 |
|---|---|---|---|
| `grammar` 语法 | 12 | 46% | `play game`、`I reading a book.`、`my grandpa and me`、`at yesterday`、`Tom play soccer`、`I teached`、`getted`、`in office`、`on last Sundays` |
| `word_choice` 用词 | 5 | 19% | `We see movie`（watch/see）、`ask for my teacher`、`what do you do?`、`What were you yesterday`（how）、`Our teacher is Amy together.` |
| `capitalization` 大小写 | 4 | 15% | `zane`、`Tv`、`those are their bags.`、`Now, My` |
| `punctuation` 标点 | 3 | 12% | `Do you like coffee.`（缺问号）、`now,liked my teacher`（逗号连句）、`work.So`（句号后缺空格） |
| `spelling` 拼写 | 2 | 8% | `Theri`（their）、`intrusting`（interesting） |
| `other` | 0 | — | — |

> 未过关 20 条的分布：语法 10、大小写 3、标点 2、用词 3、拼写 2。
> 说明：`error_type` 由 Amy 人工判定（规则见 §11.5），枚举值与 `schema.sql` 完全一致，**无需改表**。
> 库内 `/api/mistakes/stats` 已同步为 **26 条**（2026-10-01）：`grammar 12 / word_choice 5 / capitalization 4 / punctuation 3 / spelling 2`，与错词本表**逐类一致**。

### 4.2 三种可控的错误模式（Amy 的处置策略）

| 模式 | 特征 | 处置策略 | 依据 |
|---|---|---|---|
| **A. 形态/限定类**（可数名词裸用、漏 be 动词、不规则过去式、第三人称单数） | 反复出错、每次都能改对 | 错词本 2 次过关制 + 作业强制自查「可数名词有没有加 s」 | `play game` 3 次、`I reading` 1 次 |
| **B. 书写规范类**（问号、句首大写、逗号连句、空格） | 集中爆发后能整批修正 | 每课开场固定 5 条自查 + 作业前提示 | 第 3 课规范达标后错误数 4 → 2 |
| **C. 用词/搭配类**（watch/see、ask for、how/what） | 一次性为主，讲解后不再犯 | 讲清「为什么不能用另一个」+ 当场同类型验证题 | `watch`、`ask for` 已过关 |

### 4.3 高频错误的量化观察

- **产出型错误 > 理解型错误**：26 条中，理解层面误判仅 5 条（用词类），其余 21 条都是「知道规则但写错」。
- **同一错误重复率**：`play game` 出现 3 次、问号类 ≥3 次、句首/非句首大写 3 次、句号后缺空格 2 次、`their` 与 `interesting` 拼写各 1 次 —— 说明「讲解已足够，缺的是产出环节的强制检查」。
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
| `lesson_id` | `lessons.id`（自增） | 数据库内部主键；md 侧用 `notes/day-01-07.md` + 课号定位 |
| `title` | `lessons.lesson_no` + `lessons.summary` | 标题由课号生成；一句话摘要即标题的语义内容 |
| `level` | `lessons.level_code` | 上课时级别，如 `Level 2` |
| `objectives` | `lesson_sections.section_type='objectives'`（**2026-09-29 已落地**） | 本课目标，1—3 条；md 侧写进 `> 一句话：` 之外的目标行 |
| `review` | `lesson_sections.section_type='review'` | 已有枚举，直接复用 |
| `new_knowledge` | `lesson_sections.section_type='grammar'` + `knowledge_points`（**该表暂不建**，见 §5.4） | 语法正文入 section；知识点暂无结构化落点 |
| `vocabulary` | `vocabulary` + `lesson_vocabulary` | 已有表，词表 + 例句（`vocab_table` section 保留原文） |
| `grammar` | 同 `new_knowledge` | 与知识点一一对应（知识点表未建时只落 section） |
| `examples` | `lesson_sections.section_type='examples'` | 已有枚举 |
| `exercises` | `lesson_exercises` 表（`block_kind` / `block_no` / `exercise_no` / `exercise_type` / `prompt` / `reference_answer` / `user_answer` / `is_correct` / `error_note` / `error_type` / `revised_answer` / `self_check`） | 已有表，**每题一行**，批改回填 |
| `expected_mistakes` | `lesson_sections.section_type='expected_mistakes'`（**2026-09-29 已落地**，批准见团队总纲 D-10） | 备课时预判的易错点，用于批改时的「为什么不是 Y」；**不对学生展示**（它是答案清单，学生端的提交前自检只给 `selfChecks` 规则，规则可给、答案不可给） |
| `homework` | `lesson_sections.section_type='homework'` + `lesson_exercises` | 题干入 section，题目入 `lesson_exercises` |

补漏块（backfill）：**正文入** `lesson_sections.section_type='backfill'`（该枚举值已于 2026-09-30 追加到末尾），**题目入** `lesson_exercises.block_kind='backfill'` + `block_no` —— 与作业（`block_kind='homework'`）**分开计数**，见 §6.5。

### 5.3 一课数据的 JSON 视图（对齐 `POST /api/lessons` 契约）

```json
{
  "lessonNo": 7,
  "lessonDate": "2026-10-01",
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

### 5.4 原「需后端确认的 2 项」—— 均已落地（2026-10-01 复核）

| 项 | 结果 |
|---|---|
| `lesson_sections.section_type` 增 `objectives`、`expected_mistakes` | ✅ **已落地**。`schema.sql` 现枚举共 **11 值**（末尾追加 `objectives` / `expected_mistakes` / `backfill`），未改类型、未动存量数据 |
| `lessons` 增 `objectives` 结构化字段 | ⏸ **决定不做**。objectives 走 `lesson_sections`（`section_type='objectives'`），不新增列；`summary` 仍只承载一句话摘要 |

> 另：`knowledge_points` / `lesson_knowledge_points` **不建**（Amy 明确教学侧暂不需要；若为产品展示需求另议）—— 故「知识点掌握度」暂只落 `lesson_sections` 正文，不做聚合统计。
> 将来若要按「目标 / 预判错误」做统计，直接查 `lesson_sections.section_type` 即可，**无需改表**。

---

## 六、学习记录结构

### 6.1 一课结束后应保存的 9 类信息（需求 → 落点）

| 需求字段 | 落点 | 落点说明 |
|---|---|---|
| `lesson` | `lessons`（+ `lesson_exercises`） | 课基本信息 |
| `score` | `study_records.record_type='grade'` 的 `payload` | **口径：作业错误处数**（现有唯一可复算口径），不折算百分制 |
| `mistakes` | `mistakes` + `mistake_events` | 错词本条目 + 每次犯错的流水 |
| `knowledge mastery` | `knowledge_points`（**暂不建**）+ `mistakes` 关联 | 用「该知识点相关错词是否过关」近似掌握度；知识点表未建前只能靠错词本人工判断 |
| `vocabulary mastery` | `vocabulary` + `mistakes` | 词是否有错记录 / 是否出现在错词本 |
| `grammar mastery` | `knowledge_points` + `mistakes.error_type='grammar'` | 语法错误的次数与过关状态 |
| `study time` | ⚠️ **无落库位置** —— `lessons` 表**没有** `study_minutes` 列（`lesson-record.schema.json:81` 注释指向的 `courses.study_minutes` 是废弃命名，该表不存在） | G5 因此**维持降级**：接口返 `null` 并标注，**不得用 0 冒充「没数据」** |
| `feedback` | `progress`（**`progress_feedback` 表尚未建**） | 难度反馈与升降级结果；现落在 `progress` 的 7 个教学列上（`current_level` / `current_lesson_no` / `last_feedback` / `easy_streak` / `upgrade_frozen_until` / `last_class_date` / `note`） |
| `next recommendation` | `study_records.record_type='feedback'` 的 `payload.next_recommendation` | 下一课计划文本（否则每天的教学决策无法回溯） |

> `record_type` 枚举为 `('attend','homework_submit','grade','review','feedback','reading')`，**现有 6 值已够用**，无需扩展。

### 6.2 一课的记录时序（建议）

```
课开始   → study_records(attend)                      {lessonNo, level}
复习批改 → mistake_events(wrong|correct, mistake_id)  逐条
         → mistakes.streak / status 更新
新课归档 → lessons + lesson_sections + lesson_exercises + vocabulary
作业批改 → lesson_exercises.is_correct / error_note
         → 新错词 → mistakes（error_type + reason）
         → study_records(grade)   {errorCount, exerciseCount, byType{}}
收反馈   → progress（含 easy_streak / upgrade_frozen_until）
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
| 综合阶段 | 由 `progress.current_level` + 错误趋势共同判断（理解与产出分开评估，见 2.5） | ✅ 错误趋势已由 `GET /api/lessons/error-trend` 提供 |

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
9. 收反馈 → 按第七章规则调整级别 → 归档（`notes/` + `records/*.json`）→ 跑 `db:summary` 刷新 `digest.md`/`INDEX.md`
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
| `GET /agent/snapshot?recent=3` | **上课第一步**：级别、课号、最近三课、未过关错词（含 priority）、阅读目录 | `digest.md`（**实测 200，已可替代**） |
| `GET /lessons` | 「上次学到哪了」的快速回答（最新一课 = 课号最大项） | `notes/` 末课摘要 |
| `GET /mistakes?status=pending` | 出复习题、批改后回写 | `wrong-words.md` |
| `GET /vocabulary/stats` | 词汇量汇报 | `review/words.html` 顶部 |

**`digest.md` → `snapshot` 字段对照**

| digest 段落 | snapshot 字段 | 现状 |
|---|---|---|
| 当前级别 / 已上课数 | `progress.currentLevel` / `currentCourseNo` | ✅ 契约已覆盖 |
| 最近三课（含语法要点、词汇、反馈、批改条数） | `recentLessons[]` | ✅ 契约已覆盖 |
| 全部课号一览 | `courseCatalog[]` | ✅ 契约已覆盖 |
| 错词本待复习项（含「第 3 次犯」等文字） | `pendingMistakes[]`（含 `wrongCount` / `priority`） | ✅ `priority` 规则已落地（G2 已关闭） |
| 阅读文件清单 | `readingCatalog[]` | ✅ 契约已覆盖（实测 5 天） |
| 错误趋势表 | `errorTrend`（`windowSize` + `byLesson[]`） | ✅ 已覆盖（G1 已关闭） |
| 待补清单 / 补漏队列 | `backlog` | 🟡 键已占位、值 `null` + `degradation` 标注（G3，待 `knowledge_points`） |

### 9.2 Amy 写入（写接口）

| 接口 | 触发时机 | 状态（以 `backend/docs/05-api-reference.md` 为唯一权威） |
|---|---|---|
| `POST /lessons` | 新课归档（讲完 + 批改完） | 🟡 **Step 2a：已交付、待重启实测**。契约＝`LessonRecord`；**05 已同步为 §28—29（第五批）**；**唯一缺口 = 运行中的 `:4000` 仍是重启前进程**（`GET /api` 索引里**尚无**这两条，故不可判「已生效」）。**切换点＝第 8 课**（拍板），`db:import` 同步加**零 DDL 守卫**（跳过 `lesson_no ≥ 8`） |
| `PUT /lessons/:id` | 回填作业批改与难度反馈 | 🟡 同上（Step 2a 一并交付）。**口径未变**：Amy 侧仍产出 `records/*.json`，**不直接调写接口**（切换点是第 8 课） |
| `POST /mistakes` | 批改时发现新错词 | ❌ **未实现**（改由 Step 2b 的批量接口覆盖） |
| `POST /mistakes/batch` | 批量补录历史错词 | ❌ **未实现 / Step 2b 未开工**：只喂原始错词条目；`wrong_count` 以人工值为准**覆盖写**；`review` 只做增量并对「自动值 ≠ 人工值」逐条告警 |
| `POST /mistakes/:id/review` ★ | 每次复习判对错 | ✅ **已实现并实测**（05 §15；`clientEventId` 幂等） |
| `POST /progress/feedback` ★ | 收难度反馈时 | ✅ **已实现并实测**（05 §20；升降级与冻结在服务端判定） |
| `POST /study-records` | 下课时 | ✅ **已实现并实测**（05 §18；`grade` / `feedback` 两类 payload） |
| `POST /readings` | 生成当日阅读后 | ✅ **已实现**（05 §27；`ReadingSet` 契约，同日已存在 → 409，`force=true` 重出） |
| `POST /skill-runs` | 每次执行 `english-daily` | ❌ **未实现**（无对应路由，S2 待办） |

> 本节路由均以 `/api` 为前缀（此处沿用无前缀写法）。
> ⚠️ **口径纠正（2026-10-01 实测）**：本节旧版写「全部写接口未实现」**已失效**。
> 现状：**复习判定 / 难度反馈 / 学习记录 / 阅读写入 / 课程归档 共 6 条写链路均已交付**（`npm run test:write`，
> 见 05 头部）；**归档两条虽已交付，但运行中的实例尚未重启**，故按「待实测」记。仍缺：`mistakes` 单条/批量（Step 2b）与 `skill-runs`。

### 9.3 契约缺口清单（请后端评估，不在本次实施范围）

> **2026-10-01 实测后的状态更新**：G1、G2、**G4、G6 已关闭**；G3 降级占位；G5 维持降级（不加列）；**G7 大部分已关闭**（详见下表）。
> 原始需求单见 `backend/docs/06-api-requirements-amy.md`（R1—R7）。

| # | 缺口 | 状态 | 说明 |
|---|---|---|---|
| G1 | `snapshot` 无「错误趋势」字段 | ✅ 已关闭 | `/api/lessons/error-trend` 已实现并实测 |
| G2 | `pendingMistakes[].priority` 未定义 | ✅ 已关闭 | 服务端规则：`wrongCount ≥2` → high；`streak ==1` → medium；其余 low |
| G3 | 无「待补知识点 / 补漏队列」字段 | 🟡 已占位、值降级 | `snapshot.backlog` **键已存在**（实测），值 `null` 并在 `degradation.affected` 里列出 → 待 `knowledge_points` 建表（教学侧暂不建） |
| G4 | 无「上次未完成的教学动作」 | ✅ **已关闭（实测通过）** | `GET /api/agent/snapshot` 实测返回 `lastIncomplete = {lessonNo:7, nextRecommendation:"第 8 课：常用不规则过去式…"}`；`lastRecommendation` 同值。注：第 1—6 课 `feedback` payload 历史仅 `{feedback, lessonNo}`、无此键（G4 读最新一条，不阻塞） |
| G5 | `studyMinutes` **无落库位置**（`lessons` 无 `study_minutes` 列；契约注释里的 `courses.study_minutes` 是废弃命名、该表不存在） | ⏳ 维持降级 | **本轮不加列**；实测 `/api/lessons/:id` 为**省略键**式降级（响应里**没有该键**），按快照服务约定「`null` / `[]` / 省略键」均可，**不得用 0 冒充「没数据」** |
| G6 | 无聚合快照接口 | ✅ **已关闭（实测）** | `GET /api/agent/snapshot` 实测 **200**（旧记录「404」已失效）：一次返回 `progress / courseCatalog / recentLessons / pendingMistakes / pendingMistakeStats / errorTrend / readingCatalog / backlog / lastIncomplete / lastRecommendation / degradation`，**9 次请求 → 1 次** |
| G7 | 无写接口（复习判定 / 反馈 / 归档） | 🟡 基本关闭 | ✅ 已有 6 条：`POST /api/mistakes/:id/review`、`/progress/feedback`、`/study-records`、`/readings`（05 §15/§18/§20/§27）+ **归档两条 `POST/PUT /api/lessons`（05 §28—29，Step 2a 已交付、运行实例待重启）**。❌ 仍缺：`POST /api/mistakes`（单条/批量，Step 2b 未开工）、`POST /api/skill-runs`（S2） |

### 9.4 降级方案（2026-10-01 实测后的状态）

**2026-10-01 实测更新**：`backend/docs/05-api-reference.md` 现列 **29 个接口**（含 6 条写链路 + 聚合快照；§28—29 为 Step 2a 批次）；
`GET /api/agent/snapshot` 实测 **200**，且返回 `deploymentMode = "backend"` —— **真相源已按约定切到后端**。
因此降级面**大幅收窄**：仅「**归档写路径**」与「**待补知识点**」两项仍以 md 为准。

| 数据 | 当前来源 | 说明 |
|---|---|---|
| 级别 / 课号 / 反馈 / 连击 | `GET /api/progress` ✅ 已切换 | 实测 `lastClassDate = 2026-10-01`、`nextLessonNo = 8` |
| 已完成课程 / 错误趋势 | `GET /api/lessons`、`/api/lessons/error-trend` ✅ 已切换 | — |
| 错词与优先级 | `GET /api/mistakes/pending`、`/api/mistakes/stats` ✅ 已切换 | 实测 `total 26 / pending 20 / passed 6`，与 md 逐字一致（DQ1 已消） |
| 词汇量 | `GET /api/vocabulary/stats` ✅ 已切换 | — |
| 学习记录 | `GET /api/study-records` ✅ 已切换 | 库内 21 行 |
| **一次取全上下文** | `GET /api/agent/snapshot` ✅ **已切换** | 9 次请求 → 1 次；含 `lastIncomplete` / `lastRecommendation` / `errorTrend` |
| 阅读目录与全文 | `GET /api/readings`、`/api/readings/:date` ✅ 已切换 | 5 天 / 14 篇 / 28 题 |
| 待补知识点 / 补漏队列 | `progress.md`（md） | ⏳ `snapshot.backlog` 键已占位但值为 `null`，待 `knowledge_points` 建表（教学侧暂不建） |
| 复习结果 / 反馈 / 学习记录写入 | 接口 ✅ 已可用 | `POST /mistakes/:id/review`、`/progress/feedback`、`/study-records`。Amy 侧**当前仍走** `records/*.json`（Skill 归档产物），改调接口待 Skill 侧改造 |
| 课件归档回写 | `records/*.json`（md 派生） | 🟡 **Step 2a 已交付**（05 §28—29，`POST/PUT /api/lessons`），**切换点＝第 8 课**；运行中的实例尚未重启，故本轮不判「已生效」 |

> 完整需求与验收标准见 `backend/docs/06-api-requirements-amy.md`。
> **降级面收窄后的剩余条件**：Step 2a（`POST/PUT /api/lessons`）**重启实测通过**、且**第 8 课归档改走 API** → `digest.md` 即可降级为**纯人读副本**。

### 9.5 已实测的数据质量问题（2026-09-29）

| # | 问题 | 证据 |
|---|---|---|
| DQ1 | 库内 mistakes `total=20 / pending=15 / passed=5`，与 `wrong-words.md` 的 19 条（15 / 4）不一致，`byType` 多出 `other=1` | `GET /api/mistakes/stats` vs md |
| DQ2 | `wrong_text` 混入人工批注（id12、id8、id14、id16 等） | `GET /api/mistakes/pending` |
| DQ3 | 词汇口径两套：API 51（按词去重）vs 看板 52（按课累计） | `/api/vocabulary/stats` |
| DQ4 | 来源课号为「诊断」的错词，`firstLessonNo` 为 null | `GET /api/mistakes?status=passed` |
| DQ5 | `lastReviewedAt` 全为 null（写接口缺失所致） | `GET /api/mistakes/pending` |

> 其中 **DQ1 影响教学准确性**（错词计数与教师记录不一致），其余为字段语义与口径问题。
>
> **2026-10-01 复核**：**DQ1—DQ5 全部已关闭**。DQ1/DQ2 经 `db:sync-mistakes` 与错词本对齐（现 26 条，库内与 md 逐字一致）；DQ3 的「API 按词去重 / 看板按课累计」**保留为两套并行口径、非缺陷**；DQ4 对「诊断」来源返回 `firstLessonNo = null` 属预期；DQ5 `lastReviewedAt` 待写接口落地后自动有值。

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
  3. 若涉及流程步骤 → 交 Skill 设计师更新 SKILL.md 与脚本；改脚本需按 `skills/english-daily/references/setup-guide.md` 的方式自检
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
| `learning-progress-analysis` | ⚠️ 统计改由后端接口（`/api/lessons/error-trend`、`/api/mistakes/stats`、`/api/dashboard/summary`）提供，趋势判断仍靠 Amy 阅读 | 待拆分（依赖 G6 快照） |
| `next-lesson-planning` | ✅ 有明确规则（本文第八章），未独立成 Skill | 可保持内嵌 |

### 10.4 需要 Skill 设计师处理的事项

1. **Skill 源码入库决策**（`docs/skills.md` 已登记风险）：目前 `.workbuddy/skills/english-daily/` 不在版本库，仓库丢失即无法恢复。
2. **`daily-lesson` 的输入输出格式固化**：建议按 `GET /agent/snapshot` 定义输入 JSON、按本文 6.3 定义输出 JSON。
3. **`mistake-analysis` 的 `error_type` 判定规则**：把 Amy 的人工判定（第四章的 5 类）写成可执行规则，避免因模型判断波动导致分类漂移。
4. **阅读文件的批量生成约束**：当天已有文件不得覆盖（现有脚本已保证），Skill 侧需在文档中明确「学生要求追加篇目」是唯一例外。

---

## 十一、错词复习规则（错词本机制）

> 本章是错词本机制的**唯一权威版本**（由 `docs/plans/amy-teaching-plan.md` §2.6 / §3.1 / §3.2 / §3.3 整理迁入，过程稿与本章冲突时以本章为准）。
> 数据落点：`wrong-words.md`（人读）+ `records/*.json`（机器读）+ `mistakes` / `mistake_events`（库）。

### 11.1 机制总览

```
批改判错 → 写入错词本（新建或累加 wrong_count，streak 清零）
   ↓
每日复习取题 → 学生作答 → 判定 correct / wrong
   ↓
correct：streak + 1；streak ≥ 2 → status='passed'（出队，不再进每日复习队列）
wrong  ：wrong_count + 1，streak = 0（回队，且优先级提升）
   ↓
wrong_count ≥ 3 → 下一课强制自查项（让学生自己找这类错）
```

- 出队（`passed`）不是「永久删除」，而是**退出每日队列**；复发时新建条目或按判重键命中后重新累加。
- 「识别（看得懂）」与「产出（写得对）」分开记分：错词本只记录**产出错误**，选择题选对不计入 streak。

### 11.2 复习取题规则（决定「先考哪些」）

按下列优先级取 3—5 题，逐条取满为止：

| 序 | 位置 | 规则 |
|---|---|---|
| 1 | **强制位** | 所有 `wrongCount ≥ 3` 的未过关错词，**每课至少占 1 题**（防止连着两课不露面导致掌握度估计失真） |
| 2 | **结构位** | N-1 / N-3 / N-7 各 1 题（课号 ≤ 0 跳过），取该课新知识点 |
| 3 | **边际收益位** | `streak == 1` 的错词优先（再答对一次即出队，出队收益最高） |
| 4 | **兜底位** | 其余按 `wrongCount` 降序 → `lastReviewedAt` 最久优先（该字段未落地前用 `createdAt` 近似） |
| 5 | **总量** | 常规 5 题；断更补课时上浮（见 §8） |

> 服务端 `priority`（`wrongCount ≥2` → high、`streak ==1` → medium、其余 low）用于**展示排序**；Amy 的出题排序是上表 1→4，两者允许不同。

### 11.3 判对错与状态更新（口径固定，只搬运不重设计）

| 作答 | 更新 |
|---|---|
| 答对 | `streak + 1`；`streak ≥ 2` → `status = 'passed'`；写 `last_reviewed_at`，插入一条 `mistake_events(result='correct')` |
| 答错 | `wrong_count + 1`；`streak = 0`；`status = 'pending'`；插入 `mistake_events(result='wrong')` |

**判重键**：去标点、去空格、统一小写后的 `wrongText`（先查错词本，命中则累加，**不新建条目**）——目的是杜绝「同一错变两条」。

**Amy 的批改细则**（不改上表框架）：

| # | 细则 |
|---|---|
| G1 | 批改前先确定学生**想表达什么**；意图不明时判 `correct_with_note` 并说明歧义，**不得直接判错** |
| G2 | `correctText` 一律**最小修正**（只改错处），不重写整句；开放题另给「完整改后版」（`revisedAnswer`）作示范 |
| G4 | 复发必须在 `errorNote` 写明「第 N 次犯（上次在第 k 课）」——学生对「第几次犯」最敏感 |
| G5 | 判错的题**必须给为什么**（一句中文讲解，术语保留英文），禁止只给结论 |
| G6 | 同一句同一处只计一次；跨句出现才分别计数 |

### 11.4 错误处数口径（唯一分数量口径）

- 单位：**一处 = 一个可独立改正的点**；填空题每个空算一处。
- **计入**：选错词、动词形态、时态、语序、结构缺失、主谓一致、虚词增减、大小写、标点、拼写。
- **不计入**（只写进 `errorNote` / `note`）：空题（`blank`）、正确但有更优表达（`correct_with_note`）、任务完成度问题（如「要求 1 句否定没写」）、**补漏块作答错误**（单列 `backfillErrorCount`）、阅读理解题作答（走阅读模块）。
- 口头复核上界：若 `errorCount > 题数 × 2`，须回看是否把一处拆碎。
- 汇总落点：`study_records(record_type='grade').payload = { exerciseCount, errorCount, byType{…}, newMistakes, passedMistakes }`，**不折算百分制**。

### 11.5 `error_type` 三步判定（Amy 人工判定，禁止文本匹配推导）

```
第一步 单一差异：只差一类
        → spelling（同一词同一形态字母错）
        → capitalization（统一大小写后完全相同）
        → punctuation（去掉标点与空格后完全相同）
        注意：studyed→studied、teached→taught 属形态变化 → 走第二步 grammar
第二步 多处差异：按「错误主体」判
        → word_choice（选错了词 / 疑问词 / 搭配）
        → grammar（动词形态、时态、语序、结构、主谓一致、虚词增减）
        标点与大小写不参与归口，只写进 errorNote
第三步 判不出 → other，标注「待人工复核」，不猜
```

**已裁定条目**（防止同类争执反复出现）：

| 条目 | 曾出现类型 | 裁定 | 理由 |
|---|---|---|---|
| `what do you do?` → `What are you doing?` | word_choice | **grammar** | 疑问词没选错，错在用一般现在时结构问此刻的事，与 `I reading a book.` 同属结构缺失 |
| `I am very busy.` → `We are busy.` | grammar | **word_choice** | 错在主格代词选择；`am → are` 是连带修正，写进 `errorNote` |

> 两条互换归属，各类型总数不变（grammar 9 / word_choice 4）。

### 11.6 复发阈值与强制自查项

- `wrong_count ≥ 3` → **下一课作业里加一条强制自查项**（让学生自己回看这类错），并在批改里点名「第 N 次犯」。
- 复发项同时进「强化清单」（见 `docs/amy-next-lesson-plan.json` 的 `strengthen[]`），优先级 `P0`。
- 退出条件：连续 2 课该类错误不再出现 → 自查项降级，从强化清单移除。

### 11.7 错词本字段口径（`wrong-words.md` 8 列）

| 列 | 对应字段 | 谁填 | 说明 |
|---|---|---|---|
| 课号 | `firstCourseNo` 线索 | Amy | 首次出现的课号；诊断来源写「诊断」 |
| 错误点 | `wrong_text` | Amy | **只写错误形式本身，不带任何括号批注**（规范见下） |
| 正确形式 | `correct_text` | Amy | 最小修正形式 |
| 错因 | `error_reason` | Amy | 一句中文，含复发次数与场景说明 |
| 连续答对 | `streak` | Amy / 写接口 | 达 2 即过关 |
| 状态 | `status` | Amy / 写接口 | `未过关` / `已过关` |
| **类型** | `error_type` | **Amy（2026-09-30 新增列）** | 6 值枚举，判定规则见 §11.5 |
| **累计犯错** | `wrong_count` | **Amy（2026-09-30 新增列）** | 累计次数，≥3 触发自查项 |

> 后两列**无法从其他列推导**，只能由 Amy 判定后写入；解析器（含 `export_md_to_json.py`）应直接读取，**不得用规则或文本匹配猜测**。

**`wrong_text` 规范（2026-09-30 起）**：只写错误形式本身。批注混入会让同一错误在错词本与 `records/` 两个来源里长得不一样，迁移时按判重键 `uk_mistakes_text(student_id, wrong_text)` **会把一条错拆成两行**（DQ1 的根源）。本轮已统一 8 条带批注文本，并对账确认 records 18 条候选与错词本逐字一致；变更清单见 `records/README.md` §5.2。

**错词池规模（2026-10-01）**：**26 条（已过关 6 / 未过关 20）** —— 2026-09-30 由 19 → 23（补入 4 条原漏登记错词 `work.So`、`intrusting`、`Our teacher is Amy together.`、`Now, My`）；2026-10-01 第 7 课新增 3 条（`getted`、`in office`、`on last Sundays`），另出队 2 条。

### 11.8 结构化归档（机器契约）

批改与错词判定同时产出**机器可读文件**，后端只读这些文件、禁止解析散文：

| 文件 | 内容 |
|---|---|
| `records/lesson-NN.grading.json` | 作业逐题判定（`isCorrect` / `errorNote` / `revisedAnswer`）+ 错词候选 |
| `records/lesson-NN.backfill.json` | 补漏块逐题判定 |
| `wrong-words.md` 的 `类型` / `累计犯错` 两列 | 错词池的 `error_type` / `wrong_count` 权威值 |

契约与用法见 `records/README.md`；schema 为 `docs/schemas/grading-result.schema.json`。
**硬规则：后端不得从「### 批改」散文做文本匹配提取判定结论。** 散文中「两处错误。用词：…；语法：…」这类写法无法可靠映射到题号与错误类型，文本匹配必然产出假数据。

### 11.9 落地边界、镜像规则与未落地项（2026-09-30 裁定）

本条回答「§11.2—§11.5 固化到底指什么」，用于终结语义歧义。

**一、权威与镜像（单一来源，三层落地）**

| 层 | 载体 | 写什么 | 谁维护 |
|---|---|---|---|
| 权威 | **本节所在的 `docs/ai-teacher.md` §11** | 规则的完整正文与理由 | Amy |
| 镜像 | `docs/skills.md` 的 3.2 / 3.6 / 3.7 判断规则段 | **引用式镜像**：只写可执行条目 + 指回本节，不复制正文 | Skill 设计师 |
| 运行时 | `skills/english-daily/SKILL.md` | **最小可执行条文**（5 条以内）+ 指针 | Skill 设计师 |

**「固化」的目标形态 = 文档镜像 + 运行时最小条文，不是「让 Skill 自动推导」。** 尤其是 `error_type`：§11.5 三步判定由 Amy 人工执行，**运行时不接受文本匹配，也不接受规则推导**（那会复活「文本匹配产假数据」的反面案例）。三个 Skill 的规则只约束「Amy 怎么判、判完写哪」，不声称机器能判。

**二、排序口径（消除既有漂移）**

- 服务端 `mistakes.priority`（`wrongCount ≥2` → high、`streak ==1` → medium、其余 low）= **展示排序**
- Amy 出题顺序 = §11.2 的四位制（强制位 → 结构位 → 边际收益位 → 兜底位）= **教学排序**
- **两者允许不同，且不得互相替代。** 镜像时必须把这句一并写进 `docs/skills.md` 3.2 的取题优先级行，否则会继续被误读为「按 priority 出题」。

**三、未落地项（不阻塞镜像，但必须标注）**

| 项 | 依赖 | 未落地时的降级口径 |
|---|---|---|
| ~~§11.2 第 5 条「断更补课时题量上浮」~~ | 后端 `lastIncomplete`（G4 ✅ **已实测通过**，2026-10-01） | **本项已退出未落地清单** —— 降级口径「按常规 5 题」随之失效；**第 8 课起按 §11.2 原规则**执行（该课若属断更补课则题量上浮） |

> 镜像时请照抄上表的降级口径，避免写成空文。

### 11.10 阅读理解题「答案为空」口径（2026-09-30 裁定，回应前端提问）

**结论：`answer` 为空不是合法状态，属数据缺陷，前端不得把它渲染成一种正常功能。**

依据（均已在仓库内核实）：

1. `docs/schemas/reading-set.schema.json` 中，题目的 `answer` 为 **`type: string` 且 `required`** —— 契约层面**不允许 null / 缺省**。
2. 生成规则（`skills/english-daily/SKILL.md` 与 `references/course-template.md`）要求每篇阅读**必须**附 2 道理解题，**答案用 `<details>` 折叠**。
3. 实测第 1—7 课共 14 篇、28 道理解题的 `answer` 全部有值，`null` 分支**只存在于 mock**。

#### 前端行为（三条，可直接实现）

| 场景 | 应该怎么做 |
|---|---|
| `answer` 为非空字符串 | 正常渲染「看答案」折叠 |
| `answer` 为 `null` / 空串 | **不显示「看答案」按钮**（该题仍显示题干，学生可自己想）；同时 `console.warn` 记录 `{date, pieceNo, questionNo}` 并向上报缺陷 |
| 若产品上必须有提示 | 文案用**中性缺陷提示**，如「参考答案缺失（数据异常，已记录）」，**不要**写成像功能名的「暂无答案」——那会把缺陷正常化，掩盖真实问题 |

- 现有实现 `review/reading.html` 的 `qnoans` 分支**保留兜底**（避免白屏），但按上表第 2、3 行调整：**去掉按钮 + 改文案 + 加告警**。
- 该题**不计入**任何「看答案」交互统计（避免缺陷数据污染指标）。

#### Amy 侧的配套承诺（从源头堵住）

- 生成阅读时，**每道理解题必须有可判定答案**；无法判定对错的问题**不写成理解题**。
- 需要练开放表达 → 放**作业的开放题**（`kind=homework` 的开放题），不进阅读模块。
- 阅读归档前自检：题数 ≥2 且每题 `answer` 非空；不达标则重写该篇，不产 null。

#### 为什么不用 `answer: null` 表达「开放型理解题」

`null` 会同时代表两件事 ——「数据缺失」与「设计如此」，**语义二义**，前端无法区分该报警还是该静默。
将来若真要引入开放型理解题，必须**新增判别字段**（如 `answerMode: 'reference' | 'open'`）并**升契约版本**，不得复用 `answer: null`。

> 本条不改变现有契约（`answer` 本来就是必填），**前端无需改 schema**，只需按上表调整渲染与告警。

---

## 十二、附录

### 12.1 数据文件清单（真相源与生成物）

| 文件 | 类型 | 维护者 |
|---|---|---|
| `PROJECT.md` / `AGENTS.md` | 权威规范 | 全项目 |
| `progress.md` / `wrong-words.md` | 手工真相源 | Amy |
| `notes/*.md` | 手工真相源（追加） | Amy |
| `read/*.md` | 手工真相源（一天一档） | Amy |
| `records/*.json` | **手工真相源（机器契约，2026-09-30 新增）** | Amy 产出、后端消费 |
| `docs/schemas/*.json` | 契约定义 | Skill 设计师 + 后端 |
| `digest.md` / `INDEX.md` | 生成物 | **后端 `db:summary`**（`build_board.py` 已于 2026-09-30 退役删除） |
| `review/*.html` | 生成物 | **前端工程师**（纯 API 驱动静态页，不再由脚本生成） |
| `skills/english-daily/` | Skill 源码（已入库） | Skill 设计师 |

### 12.2 本文件引用的真实数据快照（2026-10-01 · 已实测）

- **库内实测（2026-10-01；`db:compare` 15/0/0）**：
  - `lessons` **7** · `lesson_sections` **60** · `lesson_exercises` **41**（`error_type` 非空 **12**，值域 `grammar / punctuation / word_choice / capitalization`）
  - `mistakes` **26 行（pending 20 / passed 6）** · `study_records` **21**（attend/grade/feedback 各 7） · `progress` 1
  - `readings` **5** / `reading_pieces` **14** / `reading_questions` **28** · `vocabulary` **61** / `lesson_vocabulary` **62**
  - `wrong_text` 含中文括号批注的行数 = **0**（第 7 课 `in office` 的批注已由 `db:sync-mistakes` 清理）
- 错词本 md 与库内一致：**26 条（已过关 6 / 未过关 20）**，类型分布 `grammar 12 / word_choice 5 / capitalization 4 / punctuation 3 / spelling 2`
- `records/`：**14 个文件** —— 第 1—7 课作业 7 + 第 4—7 课补漏块 4 + `exercise-error-types.json` + `lesson-07.study-record.json`；内部一致性校验 `ALL_OK`
- 学生状态：`Level 2`、当前课号 **7**、`easy_streak = 0/2`、最近反馈 `just_right`、上次上课 **`2026-10-01`**

> **已闭环（原「待后端执行」项）**：① 8 条 `wrong_text` UPDATE + 4 条 INSERT ✅；② `lesson_exercises.error_type` 回填（第 1—6 课）✅；③ 第 7 课入库 + `db:summary` 重算 ✅；④ 第 7 课 `error_type` 落库（`db:apply-error-types`，非空 **10 → 12**）✅；⑤ `records/lesson-07.study-record.json` 落库（`teach:sync`，`study_records` **18 → 21**）✅。
> **仍待执行**：写路径两项 —— `POST/PUT /api/lessons`（Step 2a）与 `POST /api/mistakes/batch`（Step 2b），归属与口径见 `Work Alignment/status-amy.md` §1.9。
> **口径提示**：本表以**库内实测**为准；`:4000` 未运行时用只读 SQL 核对 —— 仍属实测，但非 API 响应。本轮核对手段：`db:compare`（只读）**15/0/0** + 直连 MySQL 只读 SQL。
> ⚠️ **`self_check` 数据缺口仍在（实测，前端记为 G-2）**：库内 `lesson_exercises.self_check` **41/41 全空**；`GET /api/lessons/47/exercises` 实测 **`selfCheck` 键在、7 题全 `null`**。
> 三层（表 `self_check` 列 → 契约 `ExerciseRecord.selfCheck` → 接口 SELECT）**已于 2026-09-30 闭合**（`docs/database.md` §六 / `c735bbd`），
> 缺的是**数据**：归档源（md → `records/*`）从未带过 `selfCheck` 值 → 历史 7 课全空。
> **修复归属 = 教学侧（Amy 每课写死 1—2 条自查项）+ 后端回填**，**不是**前端、**也不是**接口丢字段。
> ⚠️ **勿与 `F-L7` 混记**：`F-L7` 是 `lesson.html` 对第 7 课渲染 `lesson-7.html` 的**死链**（`frontend-plan.md` §10.2），二者同源（都因兜底链被渲染）但**是两个缺陷**。

### 12.3 待办（按角色）

- **Amy**：~~第 7 课（规则动词过去式 -ed）+ 补漏块 4~~ **已完成**；下一课 **第 8 课 = 常用不规则过去式**，开 `notes/day-08-14.md`；此后每课产出 `records/lesson-NN.grading.json` + `lesson-NN.study-record.json`。
- **后端工程师**：① ~~12 处变更~~ ✅；② ~~`error_type` 回填~~ ✅；③ ~~读 `records/*.json` 回填 `is_correct` / `error_note` / `revised_answer`~~ ✅；④ ~~历史 `error_count`~~ ✅ **已决保留历史值**；⑤ ~~评估 §5.4 的 2 项枚举扩展~~ ✅ **已落地**；⑥ ~~G4 `lastIncomplete`~~ ✅ **已实测通过**（快照实返 `{lessonNo:7, nextRecommendation}`）；⑦ ~~`teach:sync`~~ ✅ **已落地**（`study_records` 21 行，`progress.lastClassDate` 已刷 2026-10-01）；⑧ **剩余**：Step 2a（`POST/PUT /api/lessons`）**已交付、待重启实测**（05 已同步 §28—29）、Step 2b（`POST /api/mistakes/batch`）未开工、`self_check` **数据**缺口（前端代号 **G-2**，归属**教学侧**，见 §12.2）。
- **Skill 设计师**：① `SKILL.md` 错词本表结构补两列并写入「`错误点` 只写错误形式」规范；② `daily-lesson` 批改步骤增加「产出 `records/*.json`」；③ 按 `docs/plans/amy-review-rules-handover.md` 的 drop-in 清单镜像 §11.2—§11.5（含修掉 3.2 的「展示排序 ≠ 出题排序」漂移）；④ **新增**：导出器改产 `LessonRecord`（`POST /api/lessons` 的真实调用方）。
- **前端工程师**：错词页类型分布口径见 §4.1（数量已生效为 **26**，无需改代码）；阅读理解题「答案为空」行为见 §11.10。
- **Git 工程师**：`records/`（**14 个文件**）、`wrong-words.md`、`notes/day-01-07.md`、`read/2026-10-01-read.md`、`progress.md`、`docs/ai-teacher.md` 等变更，建议记入 `docs/changelog.md` 并打里程碑 tag。
