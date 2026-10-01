# Amy 工作状态（英语老师 · AI English Teacher）

> **角色**：Amy —— 本项目的 AI 英语老师（教学决策唯一权威）
> **状态时间**：2026-10-01 13:10　**当前级别**：Level 2　**当前课号**：第 7 课（下一课 = 第 8 课）
> **最近动作**：2026-10-01 完成 `docs/Work Alignment/` 跨角色配合事项核查（13 项点名要 Amy 配合 → 9 项已交付 / 2 项待他人执行 / 1 项前提不成立 / 1 项待拍板），结论见 §1.7；同日与 be-dev 对齐「study-record 消费方」口径（§1.8）—— **接受其 4 处更正（含我 2 处答错）、给出 R1—R3 口径、撤回 P5 追加条**
> **证据标记**：【实】实测（接口 / 只读 SQL / 脚本输出）｜【静】仓库静态证据（文件、grep）｜【推】推理判断｜【未】未验证
> **权威规则出处**：`docs/ai-teacher.md`（第一版教学体系，12 章 + §11.9 / §11.10）

---

## 一、已完成事项

### 1.1 教学工作（第 1—7 课，已上完并归档）【静】

| 课 | 日期 | 级别 | 知识点 | 作业错误数 | 反馈 |
|---|---|---|---|---|---|
| 1 | 2026-09-26 | Level 1 | 主语 + 谓语 + 宾语 | 3 | `too_easy` |
| 2 | 2026-09-26 | Level 1 | be 动词 am / is / are | 4 | `too_easy` |
| 3 | 2026-09-27 | Level 1 | 主格与物主代词 I/my、he/his、she/her | 2 | `too_easy` |
| 4 | 2026-09-27 | Level 2 | 现在进行时 am/is/are + -ing | 6 | `just_right` |
| 5 | 2026-09-28 | Level 2 | 一般现在时 vs 现在进行时 | 2 | `just_right` |
| 6 | 2026-09-29 | Level 2 | 一般过去时 was / were | 5 | `just_right` |
| 7 | 2026-10-01 | Level 2 | 规则动词过去式 -ed + 补漏块 ④ 介词 on/at | 2（补漏块另 3） | `just_right` |

- 累计产出：7 课 / 14 篇阅读（`read/` 5 个文件）/ 词汇 61 条（API 口径，按 word 去重）；错词本 **26** 条【实】
- 第 5 课前做过一次 **Level 1 待补点诊断（10 题）**，结论：6 项免修、3 项转补漏块、1 项待测【静】
- 第 7 课关键进步：**可数名词（`play games` / `short movies`）在作业中全部正确，P0 自查项首次自主达标**【静】

### 1.2 教学体系文档（本次交付）

| 交付物 | 内容 |
|---|---|
| `docs/ai-teacher.md` | 第一版教学体系：学习体系 / 学生状态 / 已有课程 / 错题类型 / 课程结构 / 学习记录结构 / 难度规则 / 下一课规划 / 后端数据需求 / Skill 协作 / **错词复习规则（§11）** / 附录 |
| `docs/amy-session-07-plan.md` | 第 7 课数据驱动教学计划（9 个接口真实数据 + 验证结论） |
| `docs/amy-next-lesson-plan.json` | 结构化 JSON 示例（13 个顶层键，JSON 校验通过） |
| `docs/plans/amy-review-rules-handover.md` | 交 Skill 设计师的 drop-in 变更清单（含 5 项验收） |

### 1.3 错词本治理（配合后端 M2 迁移）【实】

- 补 `类型`（=`error_type`）与 `累计犯错`（=`wrong_count`）两列，19 行全部由 Amy 判定
- 订立 **`wrong_text` 只写错误形式、批注进 `错因`** 的规范，统一 8 条带批注文本
- 补入 4 条原漏登记错词 → 错词池 **19 → 23 条**（pending 19 / passed 4）
- **库内只读实测**（服务未运行，直接 SQL）：`mistakes` 23/19/4 ✅、`wrong_text` 含批注行数 **0** ✅

### 1.4 结构化批改归档（`records/`）

- `records/README.md` + 7 个作业文件（`lesson-01..07`） + 4 个补漏块文件（`lesson-04..07`） + `exercise-error-types.json` + `lesson-07.study-record.json`（**共 14 个文件**）
- 逐题判定对齐 `docs/schemas/grading-result.schema.json`；内部一致性校验 **ALL_OK**（`errorCount == sum(byType)`、枚举合法）
- `exercise-error-types.json`：**41 题**（作业 29 + 补漏块 12）逐题 `error_type`，**12 题**非 NULL（grammar 6 / punctuation 3 / capitalization 2 / word_choice 1）
- **库内实测**：`lesson_exercises` 41 行、`error_type` 非空 **10** 行（第 1—6 课回填已完成；第 7 课 7 行的 `error_type` 仍为 NULL，**待 A6 重跑 `db:apply-error-types` 后 → 12 行**）【实】
- **第 7 课数据缺口三项已闭环**（2026-10-01）：① `exercise-error-types.json` 补第 7 课 7 行；② 新建 `lesson-07.study-record.json`（`attend` / `grade` / `feedback` 三条 payload，feedback 带 `lessonDate` → 刷新 `lastClassDate`）；③ 笔记「答疑」小节降级为粗体行（不进 `SectionType` 枚举）、错词本 `in office（缺限定词）` 去批注

### 1.5 口径裁定（跨角色提问，均已答复并落文档）

| 问题 | 裁定 | 落点 |
|---|---|---|
| ① `error_type` / `wrong_count` 无法从 md 推导 | 错词本增两列，由 Amy 人工判定，解析器不得推导 | §11.7 |
| ② `is_correct` / `error_note` 无法从散文推导 | 新建 `records/`，后端只读 JSON，**禁止文本匹配** | §11.8 |
| ③ 错词复习规则迁入权威文档 | 新增第十一章（8 小节） | §11 |
| ④ §11.2—§11.5「固化」是镜像还是运行时自动执行 | **镜像 + 运行时最小条文**；`error_type` 仍人工判定，不自动推导 | §11.9 |
| ⑤ 阅读题 `answer` 为 null 时前端行为 | 空答案 = **数据缺陷**，不显示「看答案」+ 上报告警；不用 null 表达开放题 | §11.10 |

### 1.6 文档订正（回应 be-dev 报的过时表述）

- §12.1 / §12.2 / §12.3 改为实测状态与已完成项
- **顺手清掉未报的 4 处同类残留**（§1.1、§2、§10.2、§10.3 的 `build_board.py` 引用）；全文只剩 §12.1 一句「已退役删除」的历史说明

### 1.7 跨角色配合事项核查（`docs/Work Alignment/`，2026-10-01）【实测】

> 项目负责人要求：逐一读取该目录 5 份状态文档，核对「其他 agent 提出、需要 Amy 配合」的事项。**结论：点名要 Amy 配合的 13 项中，9 项已交付、2 项待他人执行后才闭环、1 项前提不成立、1 项待拍板。**

| 来源 | # | 事项 | 核查结论 |
|---|---|---|---|
| be-dev | B1 | 写 feedback 记录带 `next_recommendation`（G4 `lastIncomplete` 唯一缺的数据） | ✅ **已交付**（`records/lesson-07.study-record.json` 的 `feedback` payload）；⚠️ 未入库 |
| be-dev | B2 | 第 7 课起批改 payload 带 `byType` | ✅ **已交付**（`lesson-07.grading.json` + study-record 的 `grade` payload） |
| be-dev | B3 | `records/*.json` 约定（一套题集一文件、错误点只写错误形式） | ✅ **已遵守**（本轮修掉 `in office（缺限定词）` 批注） |
| be-dev | B4 | 第 7 课数据缺口（`error_type` 映射 + grade 记录） | ✅ **已完成**（34 → 41 行；新建 study-record） |
| be-dev | B5 | 导出器 2 条告警（`### 答疑` 不在枚举 / `in office` 未入册） | ✅ **已完成** |
| be-dev | B6 | `check_instance.py` 归属待 Amy 确认 | ❌ **前提不成立**（见下方异议 1）；且判断**非教学侧产物** |
| be-dev | B7 | 三项计数口径拍板（T11） | ⏳ **待拍板** → 见 §3.2 |
| be-dev | B8 | `docs/ai-teacher.md` §12.1 已更新 | ✅ 确认 |
| skill | S1 | v2.6.0「答案必填、缺则该篇重写、不产 null」是否符合 §11.10 | ✅ **符合（逐字一致）** —— §11.10 原文：「题数 ≥2 且每题 `answer` 非空；不达标则重写该篇，不产 null」 |
| skill | S2 | 写记录带 `next_recommendation` | 同 B1 |
| skill | S3 | `lesson_exercises.error_type` 人工判定回填 | ✅ **41 题映射已出**（12 非 NULL）；第 7 课 7 行待 be-dev 重跑 |
| skill | S4 | 33 处 `build_board` 残留（称 `ai-teacher.md` 6 处） | ⏳ 见 §3.3（我方 §12.1 已清，其余为历史记述/他方文档） |
| git | G1 | `docs/plans/*.md` 旧数字 `mistakes=20` | ⏳ **未完成** —— `amy-teaching-plan.md:42` + `ai-teacher.md` 自身 6 处，见 §3.3 |
| git | G2 | 8 个 in-flight 文件何时定稿 | ✅ 我方对 `docs/ai-teacher.md` 的修改**已完成**，未提交属 git 归档问题 |
| git | G3 | `check_instance.py` 待提升为受控文件并入门禁 | ❌ 同 B6 |
| fe | F1—F3 | 阅读裁定四条 / §11.10 / 新裁定写进 §11.x | ✅ 确认，我方无需动作 |
| fe | F4 | C9 阅读数据权威口径 | ⏳ **待拍板** → 见 §3.2 |

**🔴 异议（记录与实测不符之处）**

1. **`check_instance.py` 的位置描述不成立**：`SKILL-DESIGNER-STATUS.md` §3.2.4 与 `GIT-MANAGER-STATUS.md` §四.8 均称该文件「仍在 `.workbuddy/tmp/`」。**实测该目录 21 个文件中无此文件**（Glob 逐一列出核对），全仓 grep 仅命中 3 份状态文档自身。**be-dev 的「全仓无此文件、也无任何引用」与实测一致**，以其为准。
2. **前端文档引用的后端基线偏旧**：`前端工程师-工作状态.md` §一.6 引 `test:write` **59/59**（自标「他方提供，未复跑」），`be-dev-status.md` 现为 **66/66**。
3. **Git 文档版本基线是时点快照、已过时**：`GIT-MANAGER-STATUS.md` §〇「领先 33 个提交 / 8 个 in-flight」为 **2026-09-30 19:36** 观察值；be-dev 其后又提交多条（`d868401`、`cf07f29`）。

**🔍 待确认（信息不足，无法判完成与否）**

- **C9 口径归属表述互相矛盾**：前端 §4.1 把 C9 列在「需 be-dev 配合」，其 I3 又写「需 be-dev / **amy** 定口径」——待明确谁主责。
- **`check_instance.py` 副本是否存在**：需 skill-designer 确认该文件是否真曾落盘（或另有副本）。

### 1.8 与 be-dev 「study-record 消费方」口径对齐（2026-10-01）【实测】

> be-dev 复核后提出 4 处对齐 + 3 项待拍板（R1/R2/R3）。**我方已逐条复核 `schema.sql`（只读），接受全部 4 处更正，其中 2 处是我先前答复有误。**

**A. 我方主动更正 2 处（我先前答错）**

| # | 我先前的说法 | 实测（`backend/db/schema.sql`） | 更正 |
|---|---|---|---|
| 1 | 「幂等键 `(student_id, lesson_id, record_type)` 可用」 | `147-160` 行：`study_records` **只有 `PRIMARY(id)` + 2 个普通索引，无唯一键** | 我只验了**逻辑键**、没验**物理唯一索引**。无唯一键时 `ON DUPLICATE KEY UPDATE` 会**静默退化成普通 INSERT**（DQ1 同型，错词本曾 19→38）。→ **接受 be-dev 方案：走应用层 SELECT-then-write** |
| 2 | 「`studyMinutes` 是估计值、宁可不填」 | `39-59` 行：`lessons` 共 14 列，**无 `study_minutes`** | **前提不成立** —— 现在**无处可填**。同意本轮不加列、G5 维持降级 |

**B. be-dev 另 2 处对齐 —— 我方接受**

- **③ `progress_feedback` 表不存在** → Step 1 **只写 `study_records` + `progress`**，不扩范围。
- **④ `records/lesson-07.study-record.json` 的形状 ≠ `LessonRecord`**（`level` vs `levelCode`、`source` vs `sourceFile`、顶层 `records[]` vs 扁平字段）。
  **接受「我不改这个文件」**：Step 1 消费其**现形状**，Step 2 消费 `LessonRecord`，两路**共用幂等键、互不翻倍**。
  **时点语义**（be-dev 定）：顶层可空字段 + `status` 三值 —— 与 `schema.sql:52` 的 `lessons.status ENUM('planned','taught','archived')` **现成一致**，我方确认可用，且与我的流程对得上（`planned` = 计划已出 / `taught` = 上完课 / `archived` = 归档完成）。

**C. R1—R3 我方口径**

| | 事项 | 我方结论 |
|---|---|---|
| **R1** | `study_records` 兜底唯一键（`dedupe_key` + `UNIQUE(student_id, dedupe_key)`） | **建议做，不推迟。** 理由：① 当前 0 重复 → 加约束**代价为零**；② 我方教学口径依赖这些计数准确，**一条重复 `grade` 会让 `errorTrend` 翻倍**；③ `record_type` 枚举实为 **6 值**（含 `homework_submit` / `review` / `reading`），`(…, record_type)` 会**锁死未来**，只有 `dedupe_key` 通用；④ DQ1 的根因正是「以为幂等、库层没支撑」。**若你坚持先跑通**：可接受「Step 1 先上 + 约束紧随」，但 `teach:sync` 的「已存在即跳过」必须**逐条打日志**、报告里能看到 skip 计数 |
| **R2** | G5 加 `lessons.study_minutes` 列 | **同意默认：本轮不加。** 我的 28 分钟是**估计不是实测**，落库会变成「假精确」；且有列就会被消费，反而制造不可信指标。**在「谁计时、怎么计时」定义清楚前，我不提供 `studyMinutes`** —— 该文件里那 28 请视为**非权威字段、消费方不得使用**（如需彻底消除误用，我可删该键） |
| **R3** | Step 2b 错词接口范围 | **同意「只喂原始错词条目」**，但请明确两条边界：① **条目维护**（`wrongText`/`correctText`/`errorReason`/`errorType`）走 batch，**全部由我显式传入、后端不推导**；② **复习结果**（`streak` / `passed` 出队）走既有 `POST /api/mistakes/:id/review`。⚠️ **冲突点**：`wrong_count` 在我错词本是**人工判定**的（要含「无留档的复发」，如 `play game` 第 3 次来自更早未留档），而 review 会自动 +1 → **两个来源会打架**。建议：**batch 的人工值为准（覆盖写）；review 只做增量，并对「自动值 ≠ 人工值」逐条告警** |

**D. P5 撤回**

- 项目负责人已裁定：`status-amy.md` 是**全员配合文档**，各人可编辑与己相关内容。**我方撤回上一版追加的「登记写自己文档、不改对方文档」一条**，规则维持原三条。

### 1.9 答复 be-dev 的三项交办（2026-10-01）【实测】

| # | be-dev 提问 | 我方答复 |
|---|---|---|
| **W4** | `db:apply-error-types` 要不要现在执行（它写的是 Amy 的判定数据，属独立项） | ✅ **批准执行**。`records/exercise-error-types.json` 已定稿（41 行 / 12 非 NULL），第 7 课 2 道错题（作业第 4 题、补漏块第 3 题，均 `grammar`）待补。**预期结果**：`error_type` 非空 **10 → 12**、`db:compare` 回 **15/0/0**。请回传实测数字 |
| **W5** | 库内 `in office（缺限定词）` 的括号批注：**改库还是改 md** | ✅ **口径 = 让库对齐 md**（md 是教学真相源；「错误点只写错误形式」的规范早已订立）。**md 上一轮已改好、无需再动** → **重跑 `db:sync-mistakes`** 即可；**不要手工 UPDATE**（绕过判重键易砸出 DQ1）。⚠️ 该行有**两处**差异：`wrong_text` 去批注 + `error_reason` 补「（第 7 课补漏块第 3 题）」。**实测范围只有这 1 行** —— 第 7 课另两行 `getted` / `on last Sundays` 库内与 md **逐字一致** |
| **Step 2a / 2b** | 未开工 | 已了解。**2a 可先实现 + 自测**，但**端到端依赖 Skill 侧导出器改产 `LessonRecord`**（属 Skill 设计师职责，非后端）；**2b 请先把 R3 的 `wrong_count` 双源冲突写进接口说明**（人工值 vs `review` 自动 +1，见 §1.8 C） |

> 提醒：`digest.md` 是 `db:summary` 的**派生文件** —— 跑完 `db:sync-mistakes` 后需**再跑 `db:summary`**，否则摘要里仍是旧的 `in office（缺限定词）`。

---

## 二、进行中事项

| 事项 | 状态 | 下一步 |
|---|---|---|
| **第 7 课（规则动词过去式 -ed + 补漏块 ④ 介词 on/at）** | ✅ **已完成**（2026-10-01，反馈 `just_right`）；笔记 / `records/lesson-07.{grading,backfill,study-record}.json` / `read/2026-10-01-read.md` 均已产出 | 等后端写接口落地后落库 |
| **P0 强化项**：可数名词（累计 3 次）、疑问句问号与句首大写 | 每课复习 + 作业强制自查；第 7 课可数名词**首次作业全对** | 连续 2 课不犯才降级 |
| **P1 强化项**：不规则过去式（`teach → taught`、`get → got`）、`at yesterday` 类介词冗余 | 第 7 课作业复发 `teached` / `getted`，已升为第 8 课主讲 | 第 8 课专讲不规则过去式 |
| **暂停加速**（错误趋势 3→4→2→6→2→5→2 仍未稳定下降） | 维持 1 个新语法点 / 课 | 连续 2 课错误 ≤ 2 处且反馈简单 → 复议 |

> 第 8 课复习题来源已定：错词 `play game`（P0，累计 3）、`she always is busy`、`getted`、`in office`、`on last Sundays`（均为第 7 课新入 / 复发）。

---

## 三、待完成事项

### 3.1 教学（Amy 主责）

1. **上第 8 课**：常用不规则过去式（go-went / eat-ate / see-saw / have-had）+ 补漏块 ⑤；**文件切换** → `notes/day-08-14.md`（当前只有 `day-01-07.md`）【实】
2. **第 8 课当日阅读**：生成 `read/2026-10-02-read.md`（1—3 篇，Level 2，主题「不规则过去式」）
3. **Level 2 后续知识点**（按 `level-map` 顺序）：过去时否定与疑问 did → will / be going to → 频度副词 → 比较级 → 最高级 → must/have to → should → 连词 because/so/but → when 从句
4. **Level 1 欠账**：祈使句与 Let's（未测，待补漏块）；介词 on/at（补漏块 ④，第 7 课已完成）
5. **错词池 20 条未过关项**的复习排程（每课 3—5 题，按 §11.2 出题排序）
6. 每课批改后同步产出 `records/lesson-NN.grading.json` + `lesson-NN.study-record.json`（第 7 课起执行）

### 3.2 待我确认 / 待他人决定（Amy 不自行改库或改他人文档）

| 事项 | 归属 | 现状 |
|---|---|---|
| **三项计数口径是否统一**（`lessons.vocab_count` / `exercise_count` / `error_count`：第 1—6 课 seed 手工值 vs 第 7 课起子表行数） | **Amy 拍板 → 报负责人** | ⏳ **待拍板**（= be-dev T11）。**Amy 建议保持现状**：历史课一个数字不动（保住错误趋势 3→4→2→6→2→5→2 的连续性），第 7 课起严格按子表行数 |
| **C9 阅读数据权威口径**（`read/*.md` 原文 vs 库内回填） | **be-dev / Amy** | ⏳ **待拍板**。**Amy 提议分阶段**：第 7 课起**库内为准**（与 `deploymentMode: backend` 一致）；第 1—6 课为回填，若不一致以 md 作历史记述、**不改库** |
| 历史 `error_count` 是否按重算值回改（L1 5 vs 3、L5 1 vs 2、L6 6 vs 5） | ~~be-dev 决定~~ | ✅ **be-dev 已决：保留历史值**（`be-dev-status.md` §B7「已决保留」），口径切换点 = 第 7 课 |
| 开放型理解题是否需要 | **Amy 已裁定暂不需要** | 若引入须新增 `answerMode` 字段并升契约版本，不得复用 `answer: null` |
| `docs/plans/*.md` 里 `mistakes=19/20` 等旧数字 | **Amy / Skill 设计师** | ⏳ **未完成**，见 §3.3 |

### 3.3 我方文档遗留（登记待办）

- **`docs/ai-teacher.md` 有 6 处旧数字**未随第 7 课入库刷新：第 `75` / `155` / `180` / `686` / `787` / `801` 行（`6 课 → 7`、`51/52 词 → 61`、`11 篇 → 14`、`23 条错词 → 26`、`records 11 文件 → 14`）。属我方权威文档，**待排期统一刷新**（避免与并发编辑冲突，本轮未动）。
- **`docs/plans/amy-teaching-plan.md:42`** 旧快照（vocabulary 51 / mistakes 20 / 19）—— 与 G1 同一事项，建议整批处理并加「历史快照 · 2026-09-30」注记。
- **`docs/ai-teacher.md:801`** 的「Git 工程师」交接段仍写 `records/`（11 个文件），刷新时一并改。

---

## 四、需其他 Agent 确认或配合的示意说明

### 4.1 后端工程师（be-dev）

| # | 事项 | 状态 |
|---|---|---|
| A1 | 8 条 `wrong_text` UPDATE + 4 条 INSERT（12 处变更） | ✅ 已完成（我实测确认） |
| A2 | `lesson_exercises.error_type` 回填（第 1—6 课 34 题中 10 题） | ✅ 已完成（我实测确认） |
| A3 | 读 `records/*.json` 回填 `is_correct` / `error_note` / `revised_answer`（**勿解析散文**） | ✅ **已完成**（be-dev §B6 实测：`is_correct` 34/34、`error_note` 10、`revised_answer` 6） |
| A4 | 决定历史 `error_count` 是否回改 | ✅ **be-dev 已决：保留历史值**（3/4/2/6/2/5），口径切换点 = 第 7 课 |
| A5 | G4 `lastIncomplete` 实现 | ✅ **代码链路已完成**（`cc73588`，快照新增 `incompleteStep`）；**只差数据** —— 我已写进 `records/lesson-07.study-record.json`，落库即生效（见 A8） |
| A6 | **重跑 `db:apply-error-types`** | ✅ **已批准执行**（2026-10-01，见 §1.9 W4）；预期 `error_type` 非空 **10 → 12**、`db:compare` 回 **15/0/0** |
| A7 | **重跑 `db:sync-mistakes`** | ✅ **已定口径：让库对齐 md**（见 §1.9 W5）；实测范围**只有 `in office` 1 行**（`wrong_text` 去批注 + `error_reason` 补「（第 7 课补漏块第 3 题）」）；**跑后须再跑 `db:summary`** |
| A8 | **读 `lesson-07.study-record.json` 写 `study_records`**：`attend` / `grade` / `feedback` 三条；feedback 带 `lessonDate=2026-10-01` → **`/api/progress.lastClassDate` 自动刷新为 10-01**（当前仍是 09-29） | ⏳ 待办（写接口可用后执行） |
| A9 | **重跑 `db:summary`**：错词本已 23 → **26**（新增 `getted` / `in office` / `on last Sundays`，出队 2 条） | ⏳ 建议执行 |
| A10 | 服务 `:4000` 当前**未运行**（health 502 / 直连被拒） | ⚠️ 请按端口所有权约定由你启动后，我再交叉验证 `/api/mistakes/stats`、`/api/lessons/:id/exercises` |
| A11 | **`check_instance.py` 归属**：实测**全仓不存在**（`.workbuddy/tmp/` 亦无，21 个文件逐一核对）→ 不是「待提升为受控文件」，而是**文件缺失**；Amy 判断**非教学侧产物** | ⏳ 待你与 skill-designer 定归属（见 §1.7 异议 1） |

### 4.2 Skill 设计师（skill-designer）

| # | 事项 | 状态 |
|---|---|---|
| B1 | **执行 drop-in 清单**：`docs/skills.md` 3.2（修「展示排序 ≠ 出题排序」漂移）、3.6（增 G1/G4/G5/G6）、3.7（加指针）、`SKILL.md`（运行时 5 条） | ⏳ 待办（清单已给，可直接粘贴；Amy 不越界改你的文档） |
| B2 | `SKILL.md` 错词本表结构补两列 + 写入「`错误点` 只写错误形式」规范 | ⏳ 待办 |
| B3 | `daily-lesson` 批改步骤增加「产出 `records/*.json`」 | ⏳ 待办 |
| B4 | 阅读生成规则补「答案必填，缺则该篇重写，不产 null」 | ✅ **核对通过**：与 `ai-teacher.md` §11.10 逐字一致（v2.6.0 落地正确） |
| B5 | **`check_instance.py` 副本是否曾存在** | ⏳ 待确认：你方 §3.2.4 称「仍在 `.workbuddy/tmp/`」，Amy 实测该目录无此文件；请确认是否另有副本，或该文件从未落盘（见 §1.7 异议 1） |

### 4.3 前端工程师（fe-dev）

| # | 事项 | 状态 |
|---|---|---|
| C1 | `review/reading.html` 空答案分支：去按钮 + 换文案「参考答案缺失（数据异常，已记录）」+ `console.warn` 上报；不计入「看答案」统计 | ✅ **已完成（2026-09-30 第四轮落地；2026-10-01 fe-dev 回执）**：无答案题不出「看答案」折叠（`hasAnswer` 把空串/纯空白一并按缺陷处理）、文案严格用中性缺陷提示、`console.warn`（一次会话去重）+ 登记 `window.__readingDefects`；前端无「看答案」统计故天然不计入。mock 断言 32/32；真实数据 `missingTotal=0` |
| C2 | 错词页类型分布口径 | 数量已生效为 **26**（未过关 20 / 已过关 6），无需改代码【实】 |

### 4.4 Git / 版本管理工程师（git-manager）

| # | 事项 |
|---|---|
| D1 | 待提交变更：`records/`（**14 个文件**，含 `lesson-07.study-record.json`）、`wrong-words.md`（26 条）、`notes/day-01-07.md`（第 7 课 + 答疑降级）、`read/2026-10-01-read.md`、`progress.md`、`digest.md` / `INDEX.md`（如已重生成）、`docs/ai-teacher.md`、**`docs/Work Alignment/status-amy.md`** |
| D2 | 建议记入 `docs/changelog.md` 并打里程碑 tag（第 7 课入库 + `records/` 目录约定） |
| D3 | ⚠️ `docs/Work Alignment/` 下 5 份角色状态文档已被负责人集中迁移，**是否入库请确认**；若入库，**`_TEMP-*` 类临时草稿不得提交** —— 本篇对应的 `_TEMP-Amy-配合事项核查.md` 已按要求删除 |

---

## 五、一句话结论

> **第 7 课已闭环**（教学 + 归档 + 3 项数据缺口回填文件），**错词本 26 条 / 41 题 `error_type` 文件已就绪**。Amy 侧已无阻塞；剩下的全是后端执行项（A6—A9 四条重跑 + A8 写记录），其中 **A8 一落库，`lastClassDate` 与 `byType` 两个缺口即同时消失**。
> **跨角色核查**：13 项点名要 Amy 配合的事项已核完（§1.7）—— **9 项已交付、2 项待他人落库、1 项前提不成立（`check_instance.py` 文件不存在）、1 项待拍板（三项计数口径）**。
> **与 be-dev 对齐**（§1.8）：Step 1（`teach:sync` 补 study-record 消费方）**我方 4 条件全被满足，零阻塞**；**R1 建议做唯一键、R2 同意不加列、R3 同意但需定义 `wrong_count` 双源冲突口径**。**我方不再需要改 `records/lesson-07.study-record.json`**。
> 下一步教学：**第 8 课不规则过去式**（含 `notes/` 文件切换）。
