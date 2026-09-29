# 第 7 课教学计划（Amy · 数据驱动）

> **状态：待上课执行 · 生成时间 2026-09-29 15:05**
> **数据模式：`backend`** —— 本文件的全部输入都来自正在运行的后端 API（`http://localhost:4000`），非人工抄录。
> 结构化版本：`docs/amy-next-lesson-plan.json`（本文件为其人读版）
> 本文件只做教学决策，**未修改任何数据库、未改任何代码**。

---

## 一、数据来源（本次实际调用的接口）

| # | 接口 | 取到什么 | 用于哪个决策 |
|---|---|---|---|
| 1 | `GET /api/health` | 数据库 up；学生 Zane，目标「能读懂并写出日常句子」 | 前置校验 |
| 2 | `GET /api/progress` | Level 2 / 第 6 课 / 下一课 7 / `just_right` / `easyStreak=0` / 未冻结 / `lessonNoAligned=true` | 定级别、定课号 |
| 3 | `GET /api/lessons?size=6` | 6 课清单 + 每课 `errorCount` / `feedback` | 已完成课程 |
| 4 | `GET /api/lessons/latest` | 最近一课 = 第 6 课；`nextLessonNo=7` | 定课号（断更不断号） |
| 5 | `GET /api/lessons/error-trend?limit=6` | 3, 4, 2, 6, 2, 5 | 是否加速 |
| 6 | `GET /api/mistakes/pending?limit=20` | 15 条未过关错词 + `priority` | 出复习题 |
| 7 | `GET /api/mistakes/stats` | grammar 9 / word_choice 4 / capitalization 3 / punctuation 2 / spelling 1 / other 1 | 错误画像 |
| 8 | `GET /api/vocabulary/stats` | total 51 | 词汇量汇报 |
| 9 | `GET /api/study-records?size=6` | 第 6 课 attend + grade(errorCount 5) + feedback | 最近学习记录 |

**缺口（已实测为 404）**：`/api/agent/snapshot`、`/api/knowledge-points`、`/api/readings`、全部写接口。
本次用上表 9 个 GET 接口**手工拼接**替代了 snapshot；待补知识点沿用 `progress.md`（非 API 数据，已在报告中标注）。

---

## 二、学生历史学习数据分析

### 2.1 已完成课程（API：`/api/lessons`）

| 课 | 日期 | 级别 | 语法点 | 错误数 | 反馈 |
|---|---|---|---|---|---|
| 1 | 2026-09-26 | Level 1 | 主语 + 谓语 + 宾语 | 3 | `too_easy` |
| 2 | 2026-09-26 | Level 1 | be 动词 am / is / are | 4 | `too_easy` |
| 3 | 2026-09-27 | Level 1 | 主格与物主代词 | 2 | `too_easy` |
| 4 | 2026-09-27 | Level 2 | 现在进行时 | 6 | `just_right` |
| 5 | 2026-09-28 | Level 2 | 一般现在时 vs 现在进行时 | 2 | `just_right` |
| 6 | 2026-09-29 | Level 2 | 一般过去时 was / were | 5 | `just_right` |

### 2.2 错误趋势（API：`/api/lessons/error-trend`）

```
3 → 4 → 2 → 6 → 2 → 5   （第 1—6 课）
```

- 第 4 课冲高（6）可解释：**新语法点首次出现**（进行时）。
- 第 5 课回落到 2，第 6 课又升到 5 —— **没有形成下降趋势，且第 6 课的老错复发**。
- **决策：维持「巩固优先」，不启用每课 2 个知识点。** 判据即 `progress.md` 中记录的复议条件（连续 2 课错误 ≤2 且反馈简单），当前不满足。

### 2.3 错题分类（API：`/api/mistakes/stats`）

| 类型 | 条数 | 占比 |
|---|---|---|
| grammar | 9 | 45% |
| word_choice | 4 | 20% |
| capitalization | 3 | 15% |
| punctuation | 2 | 10% |
| spelling | 1 | 5% |
| other | 1 | 5%（**数据问题，见 4.1**） |

**解读：约 70% 的错误是「规则形态 + 书写规范」，不是「不懂意思」。** 教学重心应放在产出环节的检查，而不是再讲一遍语法。

### 2.4 单词与语法掌握（API：`/api/mistakes/pending` + `/api/vocabulary/stats`）

- 累计词汇 **51 条**（按 word 去重口径）。
- **语法掌握稳定**：主谓宾语序、be 动词、物主代词、进行时结构、时态标志词判断 —— 对应错词均已过关或未再犯。
- **语法掌握不稳定**：可数名词复数（`play game`，3 次）、不规则过去式（`teached`）、频度副词位置（`always`）。
- **书写规范不稳定**：问号（≥3 次）、句首大写（2 次）、物主代词拼写（`Theri`）。

### 2.5 最近练习结果（API：`/api/study-records`）

- 第 6 课：`attend` → `grade{errorCount:5, exerciseCount:9}` → `feedback{just_right}`。
- 换算：9 题错 5 处（口径为**错误处数**，不折算百分制）。

### 2.6 结论：学生当前真实阶段

> **理解 ≈ Level 2 中段，产出 ≈ Level 1 末段。**
> 瓶颈不是「没学过」，而是「写的时候不做检查」。证据：同一批规则做选择题全对、写句子时出错。

---

## 三、今天的教学决策

### 3.1 今天复习什么（5 题，6 分钟）

| # | 来源 | 题目 | 为什么排它 |
|---|---|---|---|
| 1 | N-1 = 第 6 课（was / were） | 翻译：他们昨天在办公室。 | 上一课知识点，间隔 1 天 |
| 2 | N-3 = 第 4 课（现在进行时） | 改错 `He reading a book now.` | 对应错词 id10（漏 be 动词），间隔 3 天 |
| 3 | 错词 id12（`priority=high`） | 翻译：我们昨天打游戏。 | **累计 3 次**的高频错；且能同时覆盖今日新语法 -ed |
| 4 | 错词 id5（`priority=high`, streak=1） | 改错逗号连句 | **再答对一次即过关**，边际收益最高 |
| 5 | 错词 id6（`priority=high`, streak=1） | 改错 `She always is busy.` | 同上，已错 2 次，再答对即出队 |

> 取题规则：N-1 / N-3 / N-7（≤0 跳过）各一题，其余按 `priority` + `streak`（接近过关优先）补足。

### 3.2 今天学习什么

- **新知识点（1 个）**：规则动词过去式 **-ed**
  - 一般加 `-ed`：worked / watched
  - 以 e 结尾只加 `-d`：liked
  - 辅音 + y 改 i 加 ed：studied
  - 重读闭音节双写：stopped
  - 对比第 6 课：be 动词走 was / were，实义动词走 -ed，**两套不能混**
- **词汇 8 个**：played / watched / studied / cooked / cleaned / stopped + last week / last month
- **预计 28 分钟**（复习 6 + 新课 12 + 补漏块 6 + 收尾 4）

> **⚠ 订正（2026-09-29 本轮收尾）**：本文件原写「词汇 10 个」（played / worked / watched / studied / cooked / cleaned / **visited** / stopped + last week / last month）。第 6 课 `E_6 = 5` 命中 `docs/plans/amy-teaching-plan.md` §2.7 的 **T-1 单课超阈（`E_{N-1} >= 5`）→ 轻度降载档 L1**，生词应降为 **6—8**，故第 7 课取 **8**，砍掉 `worked`、`visited` 2 个。**原计划 10 个的痕迹保留在此行，不删除**（便于课后复盘降载的实际效果）。依据：`amy-teaching-plan.md` §2.7、§四 4.2；第 7 课最终以 §四 4.3 / 4.7 为准。

### 3.3 练习什么

| # | 题型 | 题目 |
|---|---|---|
| 1 | fill_blank | 写出过去式：watch / study / stop |
| 2 | choice | We ___ football last Sunday.（play / played） |
| 3 | error_correction | 改错：`I studyed English yesterday.` |
| 4 | open | 写 5 句讲上周末做了什么，每句用 -ed，至少 1 句否定 |

### 3.4 哪些知识需要强化（按优先级）

| 优先级 | 项 | 依据 | 强化方式 |
|---|---|---|---|
| **P0** | 可数名词单数裸用 | 累计 3 次，4—6 课连续出现 | 作业强制自查 + 复习题覆盖 |
| **P0** | 疑问句问号 / 句首大写 | 问号类 ≥3 次、大小写 2 次 | 每课开场 5 条自查，批改逐条点名 |
| **P1** | 不规则过去式（teach → taught） | 第 6 课新错，今日只讲规则动词易误推 | 第 8 课专讲；本课先建立意识 |
| **P1** | 时间状语前不加介词（at yesterday） | 第 6 课同一作业犯 2 次 | 并入补漏块 ④（on / at） |
| **P2** | 物主代词拼写（their） | 低频 1 次 | 随词汇卡抽查 |

### 3.5 补漏块 ④（Level 1 欠账，10 分钟以内）

介词 **on / at**：`at seven o'clock` / `on Sundays` / 「我上周日在办公室」→ `I was in the office on Sunday.`

### 3.6 下一课学什么（第 8 课预告）

- **课号 8，文件切换**：`notes/day-08-14.md`（第 1—7 课所在文件到此结束）
- **知识点**：常用不规则过去式 `go-went / eat-ate / see-saw / have-had`
- **依赖**：第 7 课的规则动词 -ed（先建立「过去式」概念，再学例外）

### 3.7 当日阅读

`read/2026-09-30-read.md` 生成 1—3 篇（Level 2，主题「上周做了什么」）；若当天文件已存在则跳过，不覆盖。

---

## 四、数据质量问题（需后端处理）

| # | 问题 | 证据 | 影响 |
|---|---|---|---|
| **DQ1** | **库内与本地不同步**：`/api/mistakes/stats` 返回 `total=20 / pending=15 / passed=5`，而错词本 Markdown 为 19 条（15 / 4），`byType` 多出 `other=1` | 迁移快照时间为 2026-09-29 14:08，晚于快照之后的错词本整理 | **Amy 的错词计数会与 md 不一致**，需后端重跑幂等迁移 |
| DQ2 | `mistakes.wrong_text` 混入人工批注：id12「play game（第 3 次犯：…）」、id8「Do you like coffee.（句号结尾）」、id16「at yesterday（I was busy at yesterday）」 | `/api/mistakes/pending` 实测 | 字段语义被污染，出题面会带上批注文字 |
| DQ3 | 词汇口径两套：API `total=51`（按 word 去重）vs 静态看板 52（按课累计） | `/api/vocabulary/stats` vs `review/index.html` | 汇报数字易混淆 |
| DQ4 | `firstLessonNo` / `lastLessonNo` 为 `null`（id8、id9 来源课号是「诊断」，非课程） | `/api/mistakes?status=passed` 实测 | 无法按课定位错词来源 |
| DQ5 | `lastReviewedAt` 全为 null | `/api/mistakes/pending` 实测 | 「最久未复习优先」的排序规则暂时失效 |

> DQ1 是**唯一影响本次教学准确性**的问题；其余为字段语义与口径问题。

---

## 五、本阶段验证结论

**验证问题：Amy 能否根据学生历史学习数据生成合理的下一课？**

| 验证项 | 结果 | 说明 |
|---|---|---|
| 能否从 API 取到「已完成课程」 | ✅ | `/api/lessons` 返回 6 课含 `errorCount` / `feedback` |
| 能否取到「最近学习记录」 | ✅ | `/api/study-records` 返回 attend / grade / feedback 三类 |
| 能否取到「错题与优先级」 | ✅ | `/api/mistakes/pending` 返回 15 条含 `priority`、`streak`、`wrongCount` |
| 能否取到「学习等级 / 进度」 | ✅ | `/api/progress` 含 `nextLessonNo`、`easyStreak`、`upgradeFrozen` |
| 能否取到「错误趋势」 | ✅ | `/api/lessons/error-trend` 直接给出 6 课错误数 —— **原设计缺口 G1 已由后端补齐** |
| 能否一次拿到全部上下文 | ⚠️ 部分 | `/api/agent/snapshot` 未实现，Amy 需并发 9 个接口再自行聚合 |
| 能否取到「待补知识点 / 补漏队列」 | ❌ | `/api/knowledge-points` 未实现，本次沿用 `progress.md` |
| 能否把结果回写 | ❌ | 写接口全部未实现（复习判定、反馈、课件归档） |
| **下一课生成是否合理** | ✅ | 复习题 5 题全部来自真实错词与 N-1/N-3；新知识点严格按 Level 2 顺序取下一个；强化项由错误统计推导 |

**结论：Amy 已具备「读真实数据 → 出下一课」的能力，链路跑通；缺口集中在「一次取全上下文」与「回写」两端。**

---

## 六、下一步

1. **后端工程师**：按 `backend/docs/06-api-requirements-amy.md` 实现 `GET /api/agent/snapshot`（P0）、`POST /api/mistakes/:id/review`（P0）、`POST /api/progress/feedback`（P0）、`GET /api/knowledge-points`（P1）、`GET /api/readings`（P1）；并处理 DQ1（重跑迁移）。
2. **Amy**：第 7 课按本计划上课（当前无阻塞，读接口已够用）；第 8 课切换 `notes/day-08-14.md`。
3. **Skill 设计师**：`daily-lesson` 的输入由「读 digest.md」改为「调 snapshot」后，需要同步更新 SKILL.md 的第一步。
4. **Git 工程师**：本次新增 3 个文件（本文件、`docs/amy-next-lesson-plan.json`、`backend/docs/06-api-requirements-amy.md`），建议记入 `docs/changelog.md`。
