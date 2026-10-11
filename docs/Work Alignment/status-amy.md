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
| skill | S4 | 33 处 `build_board` 残留（称 `ai-teacher.md` 6 处） | ✅ **我方部分已清**（§12.1 + 本次全文件刷新，保留项仅 `course-template.md` 真实文件名等）；**余下在 `docs/skills.md` / `docs/plans/*.md` / `notes/` 历史记述等他方文档**，见 §3.3 |
| git | G1 | `docs/plans/*.md` 旧数字 `mistakes=20` | 🟡 **半完成**：`docs/ai-teacher.md` 的 6 处旧数字**已随本次刷新清零**（实测 grep 仅剩正当的「第 6 课」历史陈述）；**`docs/plans/amy-teaching-plan.md:42` 仍未动**，见 §3.3 |
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

**✅ 回执（2026-10-01，我方实测；be-dev 已完成 W4 / W5 / `teach:sync`）**：

| 交办 | 我要求的预期 | 实测结果 |
|---|---|---|
| W4 `db:apply-error-types` | `error_type` 非空 **10 → 12**、`db:compare` 回 **15/0/0** | ✅ **一致**：非空 **12/41**（`grammar 6 / punctuation 3 / capitalization 2 / word_choice 1`）；`db:compare` **15/0/0** |
| W5 `db:sync-mistakes` | 仅 `in office` **1 行**：`wrong_text` 去批注 + `error_reason` 补「（第 7 课补漏块第 3 题）」；随后跑 `db:summary` | ✅ **一致**：含括号 `wrong_text` = **0 行**；id 130 `error_reason` 已补；`digest.md:66` 已是新文本 |
| `teach:sync`（附带产出） | `study_records` 落第 7 课三条 | ✅ `study_records` **21 行**；`/api/progress.lastClassDate` 刷新为 **2026-10-01**；G4 `lastIncomplete` 从 `null` → **有值** |
| Step 2a | 可先实现 + 自测 | ✅ **已生效并实测**：be-dev 重启后 `GET /api` 已含两条（§28—29），索引 28 + `GET /api` = 29 接口；`test:write` 99/99。**我曾据「索引里没有」判「待重启」，判断正确**（滞留实例 PID 25088 / 08:55 启动）—— 已在 `ai-teacher.md` §9.2/§9.3/§9.4 同步升级为「已实现并实测」 |
| Step 2b | 先写清 R3 的 `wrong_count` 双源冲突 | ✅ **已实现并实测**（`POST /api/mistakes`，05 §30，**接口总数 30**；`test:write` **123**）。⚠️ 我方文档曾误记接口名为 `POST /mistakes/batch` —— 实际按负责人裁定名＝**`POST /api/mistakes`**（批量语义在同一端点内），已订正 |
| Step 2b 遗留「#3」`first/last_lesson_id` | 需 Amy 先表态 | ✅ **我已裁定并写入 `ai-teacher.md` §11.11**（见 §1.10） |

### 1.10 裁定：错词「课号」两列口径（2026-10-01，回应 skill-designer §五#15 / be-dev §6.12「仍待」#3）【裁定】

**问题**：写接口与迁移器**都不改写** `first_lesson_id` / `last_lesson_id`（命中时只更 7 个内容列）
→ `last_*` **恒等于** `first_*`（死列）；而 `ai-teacher.md` §11.3 细则 G4 要求批改时写「第 N 次犯（**上次在第 k 课**）」，`k` 取不到数。

**裁定（分列两种口径，已全文写入 `ai-teacher.md` §11.11）**

| 列 | 裁定 | 关键理由 |
|---|---|---|
| `first_lesson_id` | 🔴 **冻结 —— 命中时永不改写** | ① 是历史事实；② 已被 `countMistakesByLesson` 用作快照 `recentLessons[].mistakeCount`（＝本课**新引入**错词数）→ 一改写，老错会被重复计入每一课，`mistakeCount` 立即失真（第 6 课=5 这类历史数会漂）；③ 与错词本 md「课号」列（人工、首次课号，26 行逐行核对）保持同口径 |
| `last_lesson_id` | ✅ **随复发刷新** | ① 否则是死列；② 是「上次在第 k 课」、**复发间隔**、「老账 vs 新账」的唯一数据来源 |

**刷新规格**：取值优先级 `items[].courseNo` → 顶层 `lessonNo`（沿用 05 §30 默认）；
**单调守卫 `max(现有, 本次课号)`**（两条路径都可能重放旧批次，无守卫会倒退）；
**两条写入路径同批改**（`db:sync-mistakes` + `POST /api/mistakes`）。
⚠️ **语义要点**：8 列的「课号」＝**首次**课号（人工、冻结），**「本次课号」只能取顶层 `lessonNo`**。

**明确不做**：① **历史行不回填**（第 1—7 课的「最近复发课」只在 `错因` 散文里，md 无此信息，硬编＝编造）；
② **错词本 md 不加列**（`last` 由系统派生；md 保持 8 列，避免「人工值 vs 派生值」两套来源）。

**开放项（等 be-dev 报成本后我拍）**：`POST /mistakes/:id/review` 判错时是否也刷 `last_lesson_id`（取 `progress.current_lesson_no`）。
**倾向应刷** —— 复习答错就是复发，且这是「上次在第 k 课」最真实的来源；否则会出现「第 8 课复习答错、`last` 仍停在旧课」。

**顺带勘误（我方文档）**：`ai-teacher.md` §11.3 的判重键原写「**去标点**、去空格、统一小写」——
实测 `normKey` 是「**去全角括号批注 → 折叠空白 → 转小写**」，**标点参与判重**。
若按原表述，`Do you like coffee.` 与 `Do you like coffee?` 会被并成一条（标点类恰是本生高频错误）→ **已订正**，
并写明「两条写入路径必须共用 `mistakeKey.js` 同一份实现」（be-dev 已上移共享，做对了）。

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
7. **🆕 补 `selfCheck`（前端记为 G-2）**：库内 `lesson_exercises.self_check` **41/41 全空**（我实测）。三层链路（表列 → 契约 → 接口）**已闭合**，缺的是**数据** —— 归档源从未带过自查项。**归属在教学侧**：每课在 `notes/` 与 `records/lesson-NN.grading.json` 的对应题上写 1—2 条自查项（取 §11.6 / `plan.selfChecks`，最多 2 条）；第 8 课起先做到「新产生的题不再为空」，是否回填第 1—7 课待负责人拍板（回填会动 41 行历史数据）

### 3.2 待我确认 / 待他人决定（Amy 不自行改库或改他人文档）

| 事项 | 归属 | 现状 |
|---|---|---|
| **三项计数口径是否统一**（`lessons.vocab_count` / `exercise_count` / `error_count`：第 1—6 课 seed 手工值 vs 第 7 课起子表行数） | **Amy 拍板 → 报负责人** | ⏳ **待拍板**（= be-dev T11）。**Amy 建议保持现状**：历史课一个数字不动（保住错误趋势 3→4→2→6→2→5→2 的连续性），第 7 课起严格按子表行数 |
| **C9 阅读数据权威口径**（`read/*.md` 原文 vs 库内回填） | **be-dev / Amy** | ⏳ **待拍板**。**Amy 提议分阶段**：第 7 课起**库内为准**（与 `deploymentMode: backend` 一致）；第 1—6 课为回填，若不一致以 md 作历史记述、**不改库** |
| 历史 `error_count` 是否按重算值回改（L1 5 vs 3、L5 1 vs 2、L6 6 vs 5） | ~~be-dev 决定~~ | ✅ **be-dev 已决：保留历史值**（`be-dev-status.md` §B7「已决保留」），口径切换点 = 第 7 课 |
| **`self_check` 第 1—7 课是否回填**（库内 41/41 全空） | ~~负责人拍板~~ → **教学侧已定** | ✅ **已定口径：不回填历史**（历史 md 里本就无自查项，硬补＝编造数据）。依据：这属**教学侧数据真实性口径**（「不虚构学生未学过的/未发生的内容」是本文件立文第一原则），不是资源决策，故 **Amy 自行裁定**；be-dev §6.10 A13 已明确「同意、后端不干预」。**第 8 课起新数据必带 1—2 条自查项**（已写入 `ai-teacher.md` §12.2/§12.3） |
| 开放型理解题是否需要 | **Amy 已裁定暂不需要** | 若引入须新增 `answerMode` 字段并升契约版本，不得复用 `answer: null` |
| `docs/plans/*.md` 里 `mistakes=19/20` 等旧数字 | **Amy / Skill 设计师** | ⏳ **未完成**，见 §3.3 |

### 3.3 我方文档遗留（登记待办）

- ✅ **2026-10-01 已完成：`docs/ai-teacher.md` 一次性刷新（回应 be-dev 交办）**。实际范围**大于**点名的「23 行废弃命名 + 6 处旧数字」：
  - **废弃命名**（`courses` / `course_sections` / `exercises` / `course_vocabulary` / `progress_feedback` / `user_progress` / `course_knowledge_points` → `lessons` / `lesson_sections` / `lesson_exercises` / `lesson_vocabulary` / `progress`）—— 覆盖 §5.2 字段映射表、§5.3 标题、§5.4、§6.1、§6.2 时序、§6.4、§9.1、§9.2 共约 20 处；收口 grep 后**仅剩正当保留项**：`currentCourseNo`（真实契约字段）/ `courseCatalog[]`（真实契约字段）/ `firstCourseNo`（快照字段）/ `courses.study_minutes`（标注为「废弃命名、该表不存在」的反例）/ `course-template.md`（真实文件名）。
  - **旧数字**：课数 6→7、词条 51/52→61、阅读 11→14 篇、错词 23→26、`records` 11→14 文件、日期 → `2026-10-01`；并重写 §12.2 数据快照为库内实测。
  - **顺带修掉 5 处「非数字类」陈旧表述**：§1.1 `backend/` 「无可运行代码」→ 可运行服务；§1.2 标题「数据库尚未启用」→ 双轨（补 `records/*.json` 行 + 库已启用说明）；§1.3 / §8.1 流程「重建看板」→ `db:summary`（`build_board.py` 已退役）；§12.2 补 `self_check` 41/41 全空缺口（**前端记为 G-2**，勿与死链 `F-L7` 混记）；§9.2 / §9.3 / §9.4 写接口状态。
  - **状态修正（重要的方向性修正）**：§5.4 原写「需后端确认的 2 项」→ 实测**均已落地**（`section_type` 现 11 值）；G4 从「⏳ 需求」→ **数据已就位、待接口实测**。
- **`docs/plans/amy-teaching-plan.md:42`** 旧快照（vocabulary 51 / mistakes 20 / 19）—— 与 G1 同一事项，建议整批处理并加「历史快照 · 2026-09-30」注记。**（未动）**

---

## 四、需其他 Agent 确认或配合的示意说明

### 4.1 后端工程师（be-dev）

| # | 事项 | 状态 |
|---|---|---|
| A1 | 8 条 `wrong_text` UPDATE + 4 条 INSERT（12 处变更） | ✅ 已完成（我实测确认） |
| A2 | `lesson_exercises.error_type` 回填（第 1—6 课 34 题中 10 题） | ✅ 已完成（我实测确认） |
| A3 | 读 `records/*.json` 回填 `is_correct` / `error_note` / `revised_answer`（**勿解析散文**） | ✅ **已完成**（be-dev §B6 实测：`is_correct` 34/34、`error_note` 10、`revised_answer` 6） |
| A4 | 决定历史 `error_count` 是否回改 | ✅ **be-dev 已决：保留历史值**（3/4/2/6/2/5），口径切换点 = 第 7 课 |
| A5 | G4 `lastIncomplete` 实现 | ✅ **已关闭（我 2026-10-01 实测）**：`GET /api/agent/snapshot` 返回 `lastIncomplete = {"lessonNo":7,"nextRecommendation":"第 8 课：常用不规则过去式…"}`，`lastRecommendation` 同值。※ 字段名是 **`lastIncomplete`**（此前记录的 `incompleteStep` 有误），载荷是我写入 `records/lesson-07.study-record.json` 的 `nextRecommendation` |
| A6 | **重跑 `db:apply-error-types`** | ✅ **已执行（我实测确认）**：`lesson_exercises.error_type` 非空 **12/41**（`grammar 6 / punctuation 3 / capitalization 2 / word_choice 1`），`db:compare` **15/0/0** |
| A7 | **重跑 `db:sync-mistakes`** | ✅ **已执行（我实测确认）**：全库 `wrong_text` 含括号批注 = **0 行**；`in office`（id 130）`wrong_text` 已去批注、`error_reason` 已补「（第 7 课补漏块第 3 题）」 |
| A8 | **读 `lesson-07.study-record.json` 写 `study_records`** | ✅ **已执行（我实测确认）**：`study_records` **21 行**（`attend/grade/feedback` 各 7）；`/api/progress.lastClassDate` 已为 **2026-10-01**（不再是 09-29） |
| A9 | **重跑 `db:summary`** | ✅ **已执行（我实测确认）**：`digest.md:65—67` 三条第 7 课错词已是清理后的新文本（`in office → in the office ／ in my office`） |
| A10 | 服务 `:4000` | ✅ **当前在运行**（health 200 / `database: up`，由你方启动，**我未起也未停**）。**只读交叉验证已完成**：`/api/mistakes/stats` 26/20/6 与 md 逐字一致；`/api/agent/snapshot` 200；`/api/progress` `nextLessonNo=8`、`lastClassDate=2026-10-01`；`/api/lessons/47` 无 `studyMinutes` 键（G5 省略键式降级） |
| A11 | **`check_instance.py` 归属**：实测**全仓不存在**（`.workbuddy/tmp/` 亦无，21 个文件逐一核对）→ 不是「待提升为受控文件」，而是**文件缺失**；Amy 判断**非教学侧产物** | ⏳ 待你与 skill-designer 定归属（见 §1.7 异议 1） |
| A12 | **`snapshot.service.js` 两处陈旧注释/文案**（我 18:10 报） | ✅ **已修正并实测**（be-dev §6.10）：`:104` 注释改为「仅在无 `feedback` 记录时才为 null；2026-10-01 回填后已有值」；`:120` 降级文案**改为按 `affected` 逐项生成**（新增 `DEGRADE_HINT` 表，属**可复发缺陷类**的正确修法）。我复核：`reason` 与 `affected` 不再自相矛盾 |
| A13 | **`self_check` 数据回填**（前端代号 **G-2**） | ✅ **口径已定（教学侧裁定，be-dev 无异议）**：**历史 41 行不回填**（历史 md 本无该数据，硬补＝编造）；**第 8 课起新题必带 1—2 条自查项**。已写入 `ai-teacher.md` §12.2 / §12.3。**请你在 `05` 或 `database.md` 加一行「已知数据缺口」**，免得下次被当成接口 bug 重查 |
| A14 | **Step 2a 的「重启实测」信号**（我 18:10 报） | ✅ **已闭环**：be-dev 实测确认「索引不含这两条」**正是重启前实例（PID 25088 / 08:55 启动）所致**，重启后 `GET /api` 含 `POST /api/lessons`、`PUT /api/lessons/:id`，全部实测通过 → **Step 2a 升为「已生效」**。我已据此把 `ai-teacher.md` §9.2/§9.3/§9.4 从「待实测」改为「已实现并实测」 |
| A15 | **§11.11 裁定：`last_lesson_id` 应随复发刷新**（回应 be-dev「仍待」#3） | ✅ **已实现并实测**（be-dev §6.13 / `a863428`，新增 `backend/src/utils/mistakeLesson.js`）。**我方已复核实现语义**：`first` 冻结、`last` 走 `max(现有, 本次)` 且**严格大于才刷**、**按课号比较**（非 `lessons.id`）、`null`＝不改（保幂等）—— 与裁定**逐条一致**。原交办文字如下（已履行）：📌 ~~**请 implement**：`first_lesson_id` **冻结**（命中时永不改写）；`last_lesson_id = max(现有, 本次课号)`，本次课号取 **`items[].courseNo` → 顶层 `lessonNo`**；**`db:sync-mistakes` 与 `POST /api/mistakes` 两条路径同批改**（逐列同口径）。**历史行不回填**（md 无该信息）。另请**报成本**：`POST /mistakes/:id/review` 判错时能否一并刷 `last`（我倾向应刷）。完整论证见 `ai-teacher.md` **§11.11** |
| A16 | **be-dev §6.12「仍待」#3 的原始描述已过时** | ✅ **已闭环**（be-dev §6.13 + `9429c91`）：`05 §30` 已按「first 冻结 / last 单调刷新」**分列改写**并新增语义 9。原诉求：~~同段 `05 §30` 的「命中时不动（课号归属不由写接口改写）」需**分列改写**；`mistake.repository.js:80—84` 注释应收敛为「**不含 `first`**」~~ |
| A17 | **`self_check` 的「载体」问题**（收口 G-2 的实际卡点） | ✅ **已裁定**（依 be-dev §6.13 可行性）：**主通道＝`LessonRecord.exercises[].selfCheck`** —— `POST /api/lessons` 早已支持（校验 ≤128 + 落列，测试 `SC5`/`LW9`）⇒ **第 8 课起零后端改动**；**不做** md `【自查】` 标记（会造第二来源、与「切换点＝第 8 课」冲突）、**不做**独立 json（粒度不符）。已写入 `ai-teacher.md` **§11.6 终稿**。原始核查如下：📌 我复核发现：第 7 课是在 `self_check` 列已建（09-30）**之后**归档的，值**仍为 null** ⇒ 根因不是「落库丢字段」（那已修），而是**题目文本里没有逐题位置承载它**（md 只有「含强制自查项」这种整段描述）。**我的提案**：`notes/*.md` 里在**具体某题**题干末尾加显式标记 `【自查】…`（一条题 ≤1 条、每课 ≤2 条、≤128 字符），导出器**只做标记提取、不做任何推导**。**请报可行性**（① `export_md_to_json.py` 识别标记；② `POST /api/lessons` 的 `exercises[].selfCheck` 同口径）。**备选**：我另出 `records/lesson-NN.self-checks.json`（`{exerciseNo: selfCheck}` 显式映射）。完整说明见 `ai-teacher.md` §11.6 末段。**第 8 课我先按标记写 md（不阻塞教学）**，落库方式待你回执后定终稿 |
| A18 | **🆕 `be-dev-status.md:611` 仍写旧判重键口径** | 📌 该行「落库：**先规范化 `wrongText`**（去标点/去空格/统一小写）」与 `mistakeKey.js` 的 `normKey`（**去全角括号批注 → 折叠空白 → 转小写**）不符。你方 `:734` 已自报「只报不改」，此处仅**登记**；`05 §30` 若同句也请一并改 |
| A19 | **🆕 拍板：`POST /api/mistakes/:id/review` 判错时也刷 `last_lesson_id`** | ✅ **刷**（接受你方 §6.13 报的成本 ≈12 行 + 测试）。语义依你方建议：**仅 `result === 'wrong'` 时刷**（答对不是复发）、课号取**入参 `lessonNo`**（未传则不动）、**同走 `max` 单调守卫**；连同 `05 §6` 的落库列说明 + RW 区段测试一并落地。教学理由：复习答错**就是复发**，否则会出现「第 8 课复习答错、`last` 却仍停在旧课」的失真 || A20 | **🆕🔴 `review` 判错刷 `last` 在真实链路 no-op（我方实测，阻塞级）** | **已拍板，交你落地**。**根因**：全前端**唯一** review 调用方 `review/wrong.html:187` 只传 `{ result, clientEventId }`、**不传 `lessonNo`**（`frontend-plan.md:192` 自己也写「前端可只传 `result`」）⇒ `mistake.service.js:106` 的 `if (Number.isInteger(lessonNo))` 恒 false ⇒ `lessonId = null` ⇒ `shouldAdvanceLast` 首查 `currentLessonNo == null` 即返 false ⇒ **永不刷**。旁证：你方 A19 测试 MW22—MW24b **每一条都显式传了 `lessonNo`** ⇒ **「测试绿 ≠ 链路活」**（属「夹具与真实调用面脱节」，正撞我方铁律 1）。**裁定**：后端**未传 `lessonNo` 时回退 `progress.current_lesson_no`**（＝回归 `ai-teacher.md` §11.11 原文口径），并让 **`mistake_events.lesson_id` 同源回退**（保证「事件流水」与「两列课号」永远一致）。**前端不改**。请报成本 + 落地 |
| A21 | **🆕 ✅ `db:apply-error-types` 已执行（Amy 授权 + 我方实测）** | 依你方 §6.15 §3 的授权请求，**Amy 已批准并当场执行**：`ERROR_TYPES_OK updated=4 unchanged=41 missing=0 warnings=0`。**我方独立复核**（直查库）：`lesson_id=79` 四行 = `grammar / grammar / word_choice / grammar`（`is_correct` 全 0，硬校验 `error_type != null ⟺ is_correct = 0` 通过）；全库 **45 题 / 填 16**（`grammar 9 / punctuation 3 / word_choice 2 / capitalization 2`），与 `records/exercise-error-types.json` **逐题一致**。**`db:compare` 14/1/0 → 15/0/0（缺口 0）** |
| A22 | **🆕 其余两项裁定** | ② **`Tom play soccer`(id=4) 的 `last_lesson_id` 暂不回填**（虽证据现成 `mistake_events.lesson_id=79`）——守「历史行不回填」；A20 修好后机制自会前进。③ **`db:sync-mistakes` 不新增「本次课号」数据源**——写路径已切 API（第 8 课起），让 md 补课号列会造出**第二来源**、违反单向铁律；**维持 no-op + 显式告警** |

### 4.2 Skill 设计师（skill-designer）

| # | 事项 | 状态 |
|---|---|---|
| B1 | **执行 drop-in 清单**：`docs/skills.md` 3.2（修「展示排序 ≠ 出题排序」漂移）、3.6（增 G1/G4/G5/G6）、3.7（加指针）、`SKILL.md`（运行时 5 条） | ✅ **按你方 §1.3 #8 记已完成**（B1=v2.5.0）。⚠️ **我方尚未逐条复核**三层一致性（权威 §11 / 镜像 3.2·3.6·3.7 / 运行时 `SKILL.md` 第七章）—— 需要我复核请直接点我 |
| B2 | `SKILL.md` 错词本表结构补两列 + 写入「`错误点` 只写错误形式」规范 | ✅ **已完成**（v2.4.0） |
| B3 | `daily-lesson` 批改步骤增加「产出 `records/*.json`」 | ✅ **已完成**（v2.4.0；我已按此产出第 7 课三件 `records/`） |
| B4 | 阅读生成规则补「答案必填，缺则该篇重写，不产 null」 | ✅ **核对通过**：与 `ai-teacher.md` §11.10 逐字一致（v2.6.0 落地正确） |
| B5 | **`check_instance.py` 副本是否曾存在** | ⏳ 待确认：你方 §3.2.4 称「仍在 `.workbuddy/tmp/`」，Amy 实测该目录无此文件；请确认是否另有副本，或该文件从未落盘（见 §1.7 异议 1） |
| B6 | **🆕 你方 §五#15（Step 2b 转呈）里挂给我的 #3：`first/last_lesson_id` 是否随复发刷新** | ✅ **已裁定，无需再挂账** → `ai-teacher.md` **§11.11** + 本文件 **§1.10**：`first` 冻结、`last` 随复发刷新（`max` 守卫、两条路径同批改、历史不回填、md 不加列）。**已同时登记为 be-dev A15/A16**，请你在 `mistake.schema.json` / `skills.md` 镜像侧**视需要**同步一句（判重键已由你订正；本裁定**不改契约字段、不升版本**，仅改语义说明） |
| B7 | **🆕 源头侧判重键已全清（回应你 §五#2 的镜像订正）** | ✅ 我方已把 `ai-teacher.md` §11.3 的判重键从「去标点、去空格、统一小写」订正为「**去全角括号批注 → 折叠空白 → 转小写**」（＝`mistakeKey.js` 的 `normKey`）。**注意：原表述「去标点」是错的**（会把 `Do you like coffee.` / `Do you like coffee?` 并成一条），你方镜像侧的 `normKey` 三步才是对的 —— 现**镜像与源头已四方一致**（含 `common.schema.json` / 库唯一键） |
| B8 | **`selfCheck` 的载体（收口 G-2）** | ✅ **已裁定**（be-dev §6.13 报可行性 + 我方拍板，见 `ai-teacher.md` **§11.6 终稿**）：**主通道＝`LessonRecord.exercises[].selfCheck`**（契约字段已有，`POST /api/lessons` 早已支持 ⇒ **零后端改动**）；**不做** md `【自查】` 标记（与「切换点＝第 8 课」冲突、收益≈0）。⇒ **你方无需改 schema**。**请修运行时 `SKILL.md` 两处**：① 第 8 步「归档产出 `LessonRecord`」需**明确写出必带 `exercises[].selfCheck`（1—2 条）**；② `:78—79` 的 `deploymentMode` 说明仍写「**markdown（当前）**→ 落盘 `records/lesson-NN.record.json`」—— **实际已切 `backend`**（`GET /api/agent/snapshot` 实测 `deploymentMode=backend`），属**过期**，请一并更正 |
| B9 | **🆕 运行时 `SKILL.md` 判重键仍是旧口径「去标点」（漏网的第 3 层）** | 📌 `skills/english-daily/SKILL.md` **:158**（运行时必做第 3 条）+ **:208**（records 侧判重）仍写「去标点、去空格、统一小写」；镜像 `.workbuddy/skills/english-daily/SKILL.md` **同两行同措辞**。你方第十轮已修 `docs/skills.md` 的 4 处，但**运行时 `SKILL.md` 第七章**不在清单内。**请随你方待办 ③（镜像 §11.2—§11.5）一并订正**，按规程先备份 + 版本自增。我方 3 处文档已自行订正（见 D6）。 **② 附带**：`db/migration/export_md_to_json.py:91-95` 的 `norm_key` **仍真的去标点**（be-dev §6.13 已报「只报不改」）—— 只用于**错词对账**、**不参与落库**，后果＝**对账漏报**（`Do you like coffee.` / `?` 被判成同条）。因历史不回填、旁路不改 ⇒ **我倾向不修**；若你评估要修，请与 ① 一并做 |

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
| D3 | ⚠️ `docs/Work Alignment/` 下 5 份角色状态文档已被负责人集中迁移，**是否入库请确认**；若入库，**`_TEMP-*` 类临时草稿不得提交** —— 本篇对应的 `_TEMP-Amy-配合事项核查.md` 已按要求删除。**（✅ 已由你入库：`25fc26f`）** |
| D4 | **我方未提交增量（等你归档）**：现在**只剩 `docs/ai-teacher.md` 一份**（本轮共 3 批改动）：① 写接口状态纠正（§1.1/§9.2/§9.3/§9.4/§12.3 —— 26→**30 接口**、`POST /mistakes` **批量**并订正错名）、② 双轨口径与流程刷新（§1.2/§1.3/§8.1）、③ **新增 §11.11 裁定** + §11.3 判重键订正 + §11.7 课号列指向。⚠️ 注意：前两批已分别随 **`2df2e02`** 与 **`2af4af5`**（git-manager 并发提交）入库，**请勿把已入库内容当未提交重复处理**；`docs/Work Alignment/` 5 份状态文档已由你入库 |
| D5 | **🆕 提请归档时注意**：`docs/ai-teacher.md` 里 §11.11 是**新裁定**，与本轮 `docs/skills.md`（skill-designer 第十轮）/ `docs/schemas/mistake.schema.json` 属**同一议题族**（错词判重与课号口径）。建议**同一批提交或在 commit message 里互相引用**，便于日后回溯 |
| D6 | **🆕 本轮新增未提交增量（判重键漏网副本订正）**：`records/README.md:74`（§四「Amy 的承诺」）、`docs/plans/amy-review-rules-handover.md:69`（skill-designer 的 drop-in 源）、`docs/plans/amy-teaching-plan.md:279`（§2.9 G3 行）—— 三处旧口径「去标点」已订正为「**去全角括号批注 → 折叠空白 → 转小写**」。与 `docs/ai-teacher.md` §11.11 同议题族，建议同批提交 |

---

## 五、一句话结论

> **第 8 课已闭环**（教学 + 归档 + 对账）：错词本 **33 条**、`db:compare` **15/0/0（缺口 0）**、`db:summary --check` **stale=0**。
> **A15/A16/A17/A19 已全部闭环**（be-dev `a863428` / `9429c91` / `61f3d14` + 工作区 A19 代码）；`ai-teacher.md` §11.6 自查项载体**已定终稿**（主通道＝`LessonRecord.exercises[].selfCheck`，零后端改动）。
> ✅ **`db:apply-error-types` 已执行**（Amy 授权 + 我方实测）：`updated=4`、对账 **14/1/0 → 15/0/0**；库内 45 题填 **16**，与 `records/exercise-error-types.json` 逐题一致。
> 🔴 **本轮新发现 A20（阻塞级）**：`review` 判错刷 `last` **在真实链路 no-op**——唯一调用方 `wrong.html:187` 不传 `lessonNo`；**已拍板：后端未传时回退 `progress.current_lesson_no`**（回归 §11.11 原文），交 be-dev 落地，**前端不改**。
> **另两项裁定**：`Tom play soccer`(id=4) 的 `last` **暂不回填**（A22②）；`db:sync-mistakes` **不新增**课号源（A22③）。
> Be-dev 侧**「仍待 Amy 一句话」的项已清零**；我方**当前阻塞为零**。
> 教学侧下一动作：**第 9 课**（过去时的否定与疑问 `did` + 补漏块 5「a/an 与可数名词」），写 `notes/day-08-14.md`。
> ⚠️ **陈旧快照提示**：本节以上 A1—A19 与 §1.7／§1.8 含**第 7 课期**时点数字，**作历史证据保留**；现状以 **A20—A23** 与本节为准。

#### A23 · A20 已落地；本轮实跑踩到「顺序缺口」（🟡 需后端/契约侧补一条）

- ✅ **A20 已由 be-dev 落地**（`05` 第十批，2026-10-02）：`review` 未传 `lessonNo` → 回退 `progress.current_lesson_no`；`mistake_events.lesson_id` 与 `mistakes.last_lesson_id` 同源；`test:write 134 → 138`（MW25—MW27，夹具刻意不传课号）。**我方复核通过**。
- 🟡 **本轮第 9 课落库实测暴露一个隐含前提**：A20 的回退值取决于 `teach:sync` 是否已跑。而 `teach:sync`（更新 `progress.current_lesson_no`）在**归档之后**，`review` 在 `skills.md` §3.1 **第 3—4 步** ⇒ **新课首课**（`current_lesson_no` 仍是 N-1）时，复习流水会被**挂到上一课**。
  - 实证：第 9 课 2 条复习流水初写为 `mistake_events.lesson_id=79`（第 8 课），应为 `92`（第 9 课）。已按授权修正（见下）。
  - **不受影响的项**：`last_lesson_id` 不受影响 —— 本轮两次复习均为 `correct`，按 §15「`correct` 不刷」故 `last` 未动（`play game` 仍 first=4/last=6）。
- 🔴→✅ **技能侧根因（已定位，且已由 skill-designer 闭环 —— 第十二轮 v2.8.1，复核见下 A24）**：`skills/english-daily/SKILL.md`（**v2.8.0**，受控源；运行时副本 `.workbuddy/skills/english-daily/SKILL.md` 同）**第 4 步**（`:65`）原文只有「新课的课前复习由写接口直接落库，不产出 `records/lesson-NN.review.json`」，**未指明端点、未要求显式带 `lessonNo=N`**；全文只在 `:77`（`LessonRecord`）与 `:162`（`POST /mistakes`）提 `lessonNo`，**对 `review` 回写无任何课号要求**。
  - ⇒ **修法（建议 ①，二选一）**：① 第 4 步补一句「复习回写走 `POST /api/mistakes/:id/review`，**须显式带 `lessonNo=N`**（A20 的 `current_lesson_no` 回退是给**真实前端**兜底用的，Skill 明知课号 N，不该依赖回退）」；或 ② 在 `docs/skills.md` §3.1 第 8 步注明同一句。**前端仍不改**（与 A20 裁定一致）。
  - ⚠️ **订正我方笔误（skill-designer §1.3 X 指出，属实）**：上句修法 ② 的「§3.1 **第 8 步**」应为「**第 4 步**」—— 复习回写是第 4 步，第 8 步才是归档。对方**已按正确位置（第 4 行）落地**，感谢纠偏；此处保留原文 + 订正注，供后人识别。
  - 📌 **负责人裁定（2026-10-02）**：**只登记、交 skill-designer 执行**（Amy 不改受控文件，尊重职责隔离）。执行时按规程：先备份 `.workbuddy/skill-backups/english-daily-v2.8.0-<日期>/` → 改受控源 → 版本自增（建议 **PATCH 2.8.0 → 2.8.1**，属行为说明补全、非契约变更）→ `cp` 同步运行时 → 更新引用面（`docs/skills.md:107`；本文件 `MEMORY.md` §四亦记「Skill 版本 2.8.0」）→ 请我方复核。
  - ℹ️ **受限影响面（本课实测）**：`last_lesson_id` **未受影响**（两次复习均 `correct`，§15「`correct` 不刷」）；受影响的只有 `mistake_events.lesson_id`（已修正）。

#### A24 · 第十二轮（v2.8.1）复核结论 + 四项裁定（2026-10-02 18:15）

**复核对象**：`skills/english-daily/SKILL.md` **v2.8.1**（第十二轮）+ `docs/skills.md` 镜像。
**结论：✅ 复核通过**（技术可执行性**实测**，非仅静态）。

| 项 | 复核 |
|---|---|
| 第 4 步「调用面」子条（`:66—68`） | ✅ 已落。**可执行性已实证**：`GET /api/mistakes/pending`（`05` **#12**）**实测存在且每行都带 `id`**（32 条 / `total=32`）；body `{ result, lessonNo, clientEventId }` 与 `05 §15` 逐字一致 |
| 第七章 #6（`:165`） | ✅ 已扩为「**两条写端点都必须显式带**」，并补了因果（review 不传 → 回退 → 挂上一课） |
| 版本与同步 | ✅ 受控源与运行时**两侧均 `2.8.1`**；`diff -r` **无输出**；备份 `.workbuddy/skill-backups/english-daily-v2.8.0-20261002/{controlled,runtime}` 在 |
| `docs/skills.md` 镜像 | ✅ §3.1 **第 4 行**（正确位置）、三处版本号 `:107`/`:260`/`:1329` → `v2.8.1`、§1.2「**9 课实证**」、§7.3 链、附录 A 第十二轮 |
| 残留 v2.8.0（「当前版本」义） | ✅ 对方自有文件已清；**仅剩他域** `项目书.md`（be-dev，已列精确行号 —— 见 §1.3 W 与附录 A (E)） |

**两处「超出我方建议」的补充 —— 照准**：
1. **`id` 来源**：我方原建议只说「必须带 `lessonNo`」而没说 `:id` 从哪来 ⇒ 指令**确实不可执行**；`digest.md` 待复习段无 `id` ⇒ 补 `GET /api/mistakes/pending` **必要**。✅
2. **`clientEventId` 按「必须」落地**：Skill 能确定性生成（`rev-<课号>-<错词id>`）、真实前端不能 ⇒ **分层要求合理**。✅

**证据链（「显式带课号」确有效 —— 一正一反两条实证）**：
- 正：第 8 课 3 条流水（`184/185/186`，2026-10-01）落为 `lesson_id=79`＝**第 8 课**，而当时 `current_lesson_no` 仍是 **7** —— 若走回退应为 `47` ⇒ **反证当时显式传了 `lessonNo=8`，且显式路径落库正确**（当时的代码路径与现在不同，但「显式传 ⇒ 落对课」这一定性一致）。
- 反：本轮第 9 课**未传**即踩坑（写成 `79` 而非 `92`）。
- ⇒ 该修法**有直接实证支撑**，非纸面推断。

**💡 一处可选收紧（非缺陷）**：`:66` 的「逐条调 `POST /api/mistakes/:id/review`」紧邻第 3 步（出 3—5 题）后，可被读成「把 32 条 pending 全回写」。建议补半句「**本课复习了哪几题就回写哪几条**」，与第 3 步题量绑定。

**四项裁定（我方口径）**

| # | 议题 | 裁定 |
|---|---|---|
| **T** | `records/lesson-NN.study-record.json` 是否补为「四件产出」 | ✅ **补**。「三件产出」与事实不符：`study-record.json` 是 `teach:sync` 的**唯一输入**，缺它 `progress` 7 教学列与 `study_records` **全不动**（第 9 课实测：`24→27`、`8→9`、`lastClassDate` 才更新）。落点＝`SKILL.md` 第 8 步 + `docs/skills.md` §3.1 输出表各 **+1 行**。**版本建议另起一轮 PATCH `2.8.2`**，**不并入已定稿的 2.8.1**（避免动已封版文件、便于 git-manager 分批提交） |
| **U** | §4.4 `POST /study-records` 与 `teach:sync` 谁为准 | ✅ **现状唯一路径＝`records/*.study-record.json` → `teach:sync`**；`POST /api/study-records`（`05` **#18**，**确实已实现**）降为**未被 Skill 使用**的备用路径。建议 §4.4 该行：① 补 `/api` 前缀；② 注「现状：Skill 侧经 `teach:sync`；本端点未被 Skill 调用」。**证据**：`05:757` 明写 `POST /lessons` **不**写 `study_records`（那是 `teach:sync` 与 `#18` 的职责）⇒ **双路并存**；本课 `teach:sync` 实测写入 3 条；`review/` 前端 `grep study-records` **零命中** |
| **⑦** | `export_md_to_json.py` 的 `norm_key` 去标点，谁改 | ✅ **交 be-dev 改**（`backend/**` 非我域；对方「倾向我方改」不成立 —— 我方亦不改 `backend/**`）。**理由**：同一「判重键」在系统里存在**两套实现**（`mistakeKey.js` 落库用 `normKey` 三步／此脚本对账用去标点）＝**隐患**；第 9 课新增 `Did you see him yesterday.` 后，一旦出现 `?` 变体，去标点会**并成一条 → 对账漏报（假绿）**。成本 3 行；**当前 md 与库 `wrong_text` 集合 39/39 逐字相同 ⇒ 收紧后仍 1:1、对账仍绿**。**优先级低**（不落库、不阻塞，可随后端批次走） |
| **⑧** | `05 §15` `clientEventId`「必须 vs 选填」 | ✅ **参数表保持「选填」，改抬头**：抬头改为「**建议**用 `clientEventId` 幂等；**Skill 侧必须传**（Skill 能确定性生成、前端不能）」。**理由**：区隔「API 契约的必填性」与「调用方纪律」—— 若为让 Skill 传就写成 API 必填，会把**现有真实前端调用变成非法**。交 be-dev 定稿 |

**(E) `项目书.md` 5 处「当前版本」v2.8.0**：非我域，**转 be-dev**（对方已列精确行号）。

**A23 → A24 关联**：A23 的「技能侧根因」至此**闭环**。**我方当前阻塞＝零**。

---

#### A25 · 对 skill-designer §4.1 责任表（O/P/R/T/U/S/V/W）的裁定（2026-10-02 18:25）

> 回应 `SKILL-DESIGNER-STATUS.md` **§4.1 `:132`** 的责任表。**T/U/S 已在 A24 裁定**，此处重申以对齐编号；**O/R② 为本轮新裁**；**P 属纯事实更新、已授权直接做**。

| 项 | 裁定 | 依据 / 备注 |
|---|---|---|
| **O** `check_schemas.py` 双副本 | ✅ **收敛 + 合并能力**（负责人 2026-10-02 拍板） | **我方新增发现（对方未提）**：两版**能力互补**，**删任何一份都会丢校验** —— 受控版独有 `required ⊆ properties` 校验；build 版独有「自定位 `SCHEMA_DIR`（`__file__.parents[2]`）+ `*.schema.json` 精确 glob + 4 类枚举/字段防回归守卫」。**裁法**：以 build 版为基底 → **补回** `required ⊆ properties` 检查（约 8 行）→ 落到受控路径 `docs/schemas/check_schemas.py`；`.workbuddy/build/` 那份降为废止。**`objects` 语义歧义从根上消除**：合并版**同时输出两个量**（`objects`＝object 型节点数＝71；`nodes`＝全部 dict 节点数＝535），README 写明定义 —— 这样两处既有引用都能对号入座（对应铁律「同一指标两个数时先查口径」）。**⚠️ 删 `.workbuddy/build/` 副本另需负责人一句显式授权**（删文件属提交边界外），**授权前保留原地不动** |
| **P** `refs=84` 陈旧（现 85，**3 处**） | ✅ **不需拍板，授权直接做** | 纯事实更新。3 处：`docs/schemas/README.md:100`、`docs/plans/skill-plan.md:15`、**`:639`（更陈旧：`refs=84 objects=68`）**。与 O 的 2 处引用点（`skill-plan.md:261`/`:639`）**同一文件，建议一并做**，避免重复触同一文件 |
| **R②** §4.2 缺口表补登 G6/G7 | ✅ **补 G6/G7 两行**（负责人 2026-10-02 拍板） | 与权威 `ai-teacher.md` §9.3（G1—G7）对齐；两行均标**「已关闭」**（G7 仅余 `POST /api/skill-runs` 未实现）；**同时撤掉**现行「本表是否补登 G6/G7 属结构调整，待拍板」的注（`skills.md:1169`）——注与行不应并存 |
| **T** `records/lesson-NN.study-record.json` 补四件产出 | ✅ **补为「四件产出」**（Amy 域，见 **A24**） | `study-record.json` 是 `teach:sync` 的**唯一输入**；缺它 `progress` 7 教学列与 `study_records` 全不动（第 9 课实测）。落点＝`SKILL.md` 第 8 步 + `skills.md` §3.1 输出表 **各 +1 行** |
| **U** 学习记录机制以哪条为准 | ✅ **现状唯一路径＝`records/*.study-record.json` → `teach:sync`**（见 **A24**） | `POST /api/study-records`（`05` #18，**确实已实现**）降为**未被 Skill 调用**的备用路径；§4.4 该行补 `/api` 前缀 + 加现状注 |
| **S** `export_md_to_json.py` `norm_key` 去标点 | ✅ **交 be-dev 改**（见 **A24 ⑦**） | `backend/**` 非你我两方之域；**「倾向 Amy 改」不成立**（我方亦不改 `backend/**`）。两套判重实现＝隐患（`.`/`?` 并条 → 对账假绿）；当前 39/39 逐字相同 ⇒ 收紧后仍 1:1。**优先级低** |
| **V** `05 §15`「必须 vs 选填」 | ➡️ **交 be-dev 定稿**（见 **A24 ⑧**） | 我方口径：**参数表保持「选填」、改抬头**为「建议用；**Skill 侧必须传**」—— 区隔「API 契约必填性」与「调用方纪律」 |
| **W** `项目书.md` 5 处 `v2.8.0` | ➡️ **交 be-dev**（其主责） | 对方已列精确行号，直接转达即可 |

**版本与批次建议（供对方排期）**：
- **T（四件产出）** → 另起 **PATCH `2.8.2`**，**不并入已定稿的 2.8.1**（避免动已封版文件、便于 git-manager 分批提交）。
- **R②/O/P** 属 `docs/skills.md` §4.2 + `docs/schemas/README.md` + `docs/plans/skill-plan.md` 的**文档批次**，可随第十一+十二轮那批**一并提交**（对方已定 2 份待提交，加这几处即同批；`skill-plan.md` 本就挂账待办）。

**请对方动作**：把 §4.1 责任表按本表**回填「裁定」列**（注明出处 `status-amy.md` A24/A25），并把 O/P/R② 排期回执。**我方阻塞＝零。**

---

#### 第 9 课闭环（2026-10-02）

- **教学**：`did` 否定/疑问结构全对；错处 4（标点 2 / 名词裸用 1 / `did` 后过去式 1）；降载判定 **L0 常规**（新点首课触发 §7.4 **D1 例外**）。`play game` 连对 2 次 → **已过关出队** 🎉。
- **归档落库（后端路径，全绿）**：
  - `POST /api/lessons` → **id=92**（9 sections / 10 词 / 7 题 / `errorCount=4`；唯一 warning＝`knowledgePoints` 未建表）。
  - `POST /api/mistakes` → **6 created**（id 192—197；`first=last=9`）。
  - `review` ×2 → `play game` streak 2/**passed**、`she always is busy` streak 1/pending。
  - `teach:sync` → `study_records` **24→27**、`progress.current_lesson_no` **8→9**、`lastClassDate` **2026-10-02**。
  - `db:export → db:import` → readings **5→6 天 / 14→17 篇 / 28→34 题**（`mistakes md5 未变`）。
  - `db:apply-error-types` → **updated=3**（L9 hw#1 grammar / hw#2 punctuation / hw#4 grammar）。
- **对账**：`db:compare` **15 / 0 / 0（缺口 0）**；`db:summary --check` **stale=0**；API 错词 **39 / 未过关 32 / 已过关 7**；阅读 6 天 / 17 篇 / 669 词。
- ⚠️ **授权修正 2 处真实数据**（回滚锚点）：`mistake_events` 208/209 `lesson_id 79 → 92`；`lessons(第8课) status 'archived' → 'taught'`（对齐 `05 §28` 与 1—7／9 课口径，现 9 课全 `taught`）。

---

#### 🆕 D2 · 第 8/9 课 `grammar_point` 补值（skill-designer 登记，2026-10-03）—— **契约已改完，补值请你执行**

**背景**：`lessons.grammar_point` 第 8 课（id **79**）/ 第 9 课（id **92**）为空，前端课程卡与详情页语法点整片空白。**根因＝契约缺口、非你漏写**：`docs/schemas/lesson-record.schema.json` 的 `properties` **原先根本没有 `grammarPoint` 这个字段**（`lesson-plan.schema.json:7` 却把它列为 `required` ⇒ 你备课时一直有值），第 8 课起走 `POST /api/lessons`（切换点）便一直没带。第 1—7 课有值，是因为那批走 **md 导入**路径（`export_md_to_json.py:599` 本来就产出该字段）。

**① 契约侧已由我方改完（无需你动作）**：`properties` 增 `grammarPoint`（`["string","null"]` / `maxLength:128`；**加字段不升版本** —— 按 `docs/schemas/README.md` §三 规则 4/5，`required` **不允许新增**，故为可选）。`SKILL.md` 第 8 步字段清单 + §九 自查清单 + `docs/skills.md` §3.1 均已写明**归档必带**（取值＝`plan.grammarPoint.title`；⚠️ **别把 `{code,title,role}` 对象整个塞进去**，后端对非字符串直接 400）。⇒ **第 10 课起不会再漏。**

**② 补值措辞 —— 已定口径（负责人 2026-10-03 裁定）＝取 `progress.md` 解析值**

⚠️ **请注意一个坑**：`lessons.grammar_point` 的**既有口径**不是随手写，而是 `progress.md`「已学完清单」行**去掉括号批注后的正文**（`export_md_to_json.py:471-479`；**第 7 课已实证**：`progress.md:15`「规则动词过去式 -ed（四条拼写规则…）」→ 库内正是 `规则动词过去式 -ed`）。**只读复演**该规则得：

| 课 | `progress.md:16/:17` 解析值（＝应补的值） |
|---|---|
| 第 8 课（id 79） | **`常用不规则过去式`** |
| 第 9 课（id 92） | **`过去时的否定与疑问 did`** |

（若改用手写措辞如「不规则动词过去式 go / eat / see / have」，`db:export` 会**产出与库内不同的值** —— 同一课两个语法点。故裁定取解析值，零漂移、与第 7 课同构。你**无需改 `progress.md`**。）

**③ 执行（`PUT /api/lessons/:id`，后端早已支持 ⇒ be-dev 零改动；请求体可只送该字段）**

```bash
curl --noproxy '*' -sS -X PUT http://localhost:4000/api/lessons/79 \
  -H 'Content-Type: application/json' -d '{"grammarPoint":"常用不规则过去式"}'
curl --noproxy '*' -sS -X PUT http://localhost:4000/api/lessons/92 \
  -H 'Content-Type: application/json' -d '{"grammarPoint":"过去时的否定与疑问 did"}'
```

**校验（写后立刻做）**

```bash
"/d/MySQL Server 8.0/bin/mysql.exe" -h127.0.0.1 -P3306 -uroot -p123456 -N \
  -e "USE english_platform; SELECT lesson_no, grammar_point FROM lessons WHERE lesson_no IN (8,9);"
curl --noproxy '*' -sS http://localhost:4000/api/lessons/all   # 前端同源取值，确认两课不再为空
```
预期：`8 → 常用不规则过去式`、`9 → 过去时的否定与疑问 did`，且 `/lessons/all` 两课 `grammarPoint` 非空 → 前端课程卡与详情页语法点不再空白。

**回滚**（任意时刻可原样退回 NULL）：同一端点送 `{"grammarPoint": null}` —— 服务端 `lesson.service.js:541` 对 `null` 放行并写 NULL。

**注意**：`4000` 属 be-dev 实例 —— 若未在运行，**请勿抢/杀**，由其按「谁跑谁起、跑完即停」起服；若 4000 已被占用，走 4100（`npm run start:test`）仅可测、**不可写生产**。

---

#### 🆕 D3 · 第 8/9 课 `grammar_point` 补值 **已执行完毕**（Amy，2026-10-03 11:25）

**结论：✅ 补值达成，且过程中查出并处置 1 处连带改动 + 1 项后端缺陷。**

**① 独立复核（不采信转述，全自行复现）**
- `progress.md:16` = `常用不规则过去式（go-went / eat-ate / see-saw / have-had；…）`；`:17` = `过去时的否定与疑问 did（didn't + 动词原形；…）`
- `export_md_to_json.py:470` 正则 `^\s*-\s*第 N 课（Level X）<语法点>` + `:475` `re.split(r"[（(]", rest)[0].strip()` ⇒ 解析值＝**`常用不规则过去式`** / **`过去时的否定与疑问 did`**
- **基线佐证**：第 7 课库内 `规则动词过去式 -ed` 恰为同规则解析值 ⇒ **口径实证**
- ⇒ skill-designer 的裁定取值**正确**；be-dev 建议的「不规则动词过去式 go / eat / see / have」会让 `db:export` 产出**第二个值**，**不可采用**

**② 执行（`PUT /api/lessons/:id`，生产库 4000）**
- **端口纪律**：4000 起始**未运行**（health=000）、无 node 进程 ⇒ 按「**谁跑谁起**」由我启动，`.env` 实证 `DB_NAME=english_platform`、启动日志 `[db] 已连接 127.0.0.1:3306/english_platform`（**确认是生产、非 4100 测试库**）；**用完即停**（TaskStop，4000 已回 000）
- `PUT /api/lessons/79` `{"grammarPoint":"常用不规则过去式"}` → 200；`PUT /api/lessons/92` `{"grammarPoint":"过去时的否定与疑问 did"}` → 200
- **校验**：`/lessons/all` **9 课 `grammarPoint` 全部非空**（空值课数 0）；`db:compare` **15/0/0**、`summary --check` **stale=0**

**③ 🔴 连带改动（我的 PUT 造成）—— 已按授权恢复**
- **现象**：`lessons.error_count` 被改 —— 第 8 课 **8→4**、第 9 课 **4→3**
- **根因**（`lesson.service.js:454-467`）：`refreshLessonCounts` 的 `error_count` **优先取 `gradeSummary.errorCount`（错误处数），缺失时回落 `countHomeworkErrors`（判错题数）**。我的 PUT 只送 `grammarPoint`、**未带 `gradeSummary`** ⇒ 触发回落 ⇒ **口径静默降级**（处数 → 题数）
- **性质**：`05 §29` 明写「仅当 `lesson_no >= 8` 时回写三项计数」⇒ **回写是文档行为**；但「回落口径 ≠ 传入口径」属**未预期副作用**
- **处置（负责人 2026-10-03 授权）**：**恢复原值** `UPDATE lessons SET error_count=8 WHERE id=79; …=4 WHERE id=92;`（回滚锚点＝恢复前的回落值 4 / 3）→ 复核 79→8、92→4 ✅
- **⚠️ 对账抓不到**：`db:compare` **不比对 `error_count`** ⇒ 此类漂移是**静默**的（15/0/0 全程为真）—— 值得记入「对账覆盖边界」

**④ 缺陷登记（交 be-dev）**
- `PUT /api/lessons/:id` **不带 `gradeSummary` 时**，`error_count` 会被以「作业块**判错题数**」**覆盖**已存的「`gradeSummary` 错误**处数**」⇒ 一次只改 `summary`/`grammarPoint` 的部分更新，会**静默改变该列口径**
- 且 `lesson.service.js:452` 的注释自称「缺失时回落『作业块判错题数』——**与 `import_json.syncLessonCounts` 同一口径**」，**与实际不符**：两者对第 8 课给出 8（处数）vs 4（题数）
- **建议**：① 可只对「本次未触达统计」的情形**跳过回写**；或 ② 回落值改从最近一次 `gradeSummary` 取；并订正 `:452` 注释。**属 `backend/**`，我不动，仅登记。**

**⑤ 回滚锚点汇总**：`grammar_point` → 送 `{"grammarPoint": null}` 可退回 NULL；`error_count` → 若日后确认应取「题数」，送 `UPDATE lessons SET error_count=4 WHERE id=79; …=3 WHERE id=92;`。

---

## A26 · 第 10 课课前复习的**课号解析顺序缺口**（2026-10-03 · Amy 新发现）

**现象（第 10 课第 4 步实测）**：`lessonNo = 10` 在两条写路径上**全部解析失败**——
- `POST /api/mistakes`（3 条复习新错词）→ `warnings`：「**找不到第 10 课**，已写入但 `first/last_lesson_id` 为空」（库内 id **198 / 199 / 200**）
- `POST /api/mistakes/:id/review`（3 条复习流水）→ `mistake_events.lessonNo = **null**`（eventId **210 / 211 / 212**）

**根因（顺序约束，非缺陷代码）**：`lessons` 行由**第 8 步** `POST /api/lessons` 创建；而复习写库发生在**第 4 步** ⇒ 写库时**第 N 课的 `lessons` 行尚不存在** ⇒ `mistakeLesson.buildLessonMaps` 的 `idByNo.get(N)` 落空 ⇒ `resolveNextLastLessonId` 按 `mistakeLesson.js:76-77` 返回 `null`（源码注释原话：「本次课号不可知 / 课号在库内不存在 —— 调用方负责告警，此处不猜」）。`review` 侧同理（05 §15「进度表课号在 `lessons` 中无对应课 ⇒ 同样不刷」）。

**为什么第 9 课没踩到（反证）**：第 9 课的实际执行顺序是 `POST /api/lessons`(92) → `POST /api/mistakes`(192—197) → `review` ⇒ **lesson 行先存在**，故 `at night yesterday` / `They plays games` 的 `first/last` 正常落 **9**；但当时 review **未传 `lessonNo`**、回退 `current_lesson_no`=8 ⇒ 事件落 **79**（＝ A20 已记录的那次）。
⇒ **A20 与 A26 是同一根因（lesson N 尚未/刚建立）的两个面**：A20 是「回退到 N-1」，A26 是「解析不到 N」。

**影响面（当前 6 行待修）**

| 表 | id | 现状 | 应落 |
|---|---|---|---|
| `mistakes` | 198 `shcool` | `first/last` = NULL | 10 |
| `mistakes` | 199 `Do you see him yesterday?` | `first/last` = NULL | 10 |
| `mistakes` | 200 `visitted` | `first/last` = NULL | 10 |
| `mistake_events` | 210（错词 6） | `lesson_id` = NULL | 10 |
| `mistake_events` | 211（错词 4） | `lesson_id` = NULL | 10 |
| `mistake_events` | 212（错词 193） | `lesson_id` = NULL | 10 |

⚠️ **不能靠重放修**：① 重发 `POST /api/mistakes` 命中已有行 ⇒ `first` 冻结、且 `first_lesson_no` 仍为 null ⇒ `shouldAdvanceLast` 直接 `return false`（`mistakeLesson.js:57`），`last` 也不补；② 重发 `review` 带同 `clientEventId` ⇒ 幂等整条跳过，不补 `lesson_id`；换 id 则会**重复累加** streak。⇒ **唯一修法＝定向 SQL UPDATE（6 行）**。

**我给的裁定建议（自评 4 分，**须负责人拍板后再动**）**

| 方案 | 做法 | 代价 |
|---|---|---|
| **A（推荐）· 修 6 行 + 改流程** | 第 8 步 `POST /api/lessons` 拿到 `lesson10.id` 后，`UPDATE mistake_events SET lesson_id=<id> WHERE event_id IN (210,211,212)` + `UPDATE mistakes SET first_lesson_id=<id>, last_lesson_id=<id> WHERE id IN (198,199,200)`；**并把「第 4 步复习写库」整体延后到第 8 步之后执行** | 动真实数据 6 行（须授权）；Skill 第 4 步的调用时机要改（跨 skill-designer） |
| B · 只修不回改 | 同上修 6 行，流程不改 | 下一次新课**必然复发**（每课都踩） |
| C · 什么都不做 | 6 行维持 NULL | `wrong-words.md` 记「课号 10」而库内 NULL ⇒ **md↔库不一致**；且 NULL 行按 §11.11 会被当「**诊断**」来源、**后续命中也不补填** ⇒ 永久丢失课号 |

**为什么方案 A 的「延后写」是正解**：`review` 与 `POST /api/mistakes` 的课号解析**都依赖 `lessons` 行存在**，这是**契约级**前置条件（`05 §30` 语义 9 + `mistakeLesson.js:77`）；第 4 步时该前置**结构性地**不可能满足 ⇒ 不是「调用方式错」，而是**步骤顺序与契约前置条件不匹配**。

**移交（跨职责，仅登记、我不改他人文件）**
- **skill-designer**：`SKILL.md` 第 4 步「调用面」需补「**写库时机**」约束——判对错可在第 4 步做，但**落库须等第 N 课的 `lessons` 行建立之后**（或明确改为第 8 步统一补写）；`docs/skills.md` §3.1 同步。
- **be-dev**：请评估是否要在 `POST /api/mistakes` / `review` 的响应里把「课号无法解析」从 **warning** 升级为**更强的信号**（现为 `warnings[]` 一行字符串，Skill 侧极易忽略——本次就是这样漏看的）；同时请裁定**是否允许 `courseNo` 指向尚未建行的课**（若允许，则需在 `lessons` 建行时回填——属更大改动，建议不做）。
- **git-manager**：本 A26 段落与 `status-amy.md` 一并待提交。

### A26 · 执行记录（2026-10-03 · 第 10 课第 8 步归档时落地）

**授权（负责人 2026-10-03 明确批准，三条）**
1. ✅ **方案 A**：修 6 行 + 复习写库改由第 8 步统一执行
2. ✅ **删除** `E:\English\review\` 空目录（0 文件、git 未跟踪）
3. ❌ **不补建** `records\`（维持 `init_workspace.py` 现状，与 SKILL.md 第一章明文一致）

**be-dev 回执（已收到，未代改其文件）**：支持方案 A；反对 B/C。**Q1 裁定＝升级信号但用「加字段」不改 HTTP 码**（`POST /api/mistakes` 加 `unresolvedLessonNos[]` + `items[].lessonResolved`；`review` 加 `lessonResolved`）——理由：写已成功，返 4xx 会把 Skill 推进「失败→重试」分支反而制造重复累加；**并指出 review 路径当前是「零信号」**（其响应无 `warnings` 字段，比 `POST /api/mistakes` 更弱）。**Q2 裁定＝不做**（回填在 `mistake_events` 上是**不适定问题**：事件行不存「当时想挂哪课」，只能靠时间邻近度猜 → 违反「不猜」）。**方案①的配套（成败关键）＝Skill 侧自查动作**，已由 skill-designer 第十七轮一并落地。

**执行的写库顺序（第 8 步三步，最终值）**

| 步 | 动作 | 结果 |
|---|---|---|
| ① | `POST /api/lessons`（LessonRecord 全量） | **201 created，`id=93`**；sectionCount 8 / vocabCount 10 / exerciseCount 4 / errorCount 4 / warnings `[]` |
| ② | `POST /api/mistakes`（`lessonNo=10`，4 条：`shcool` wc1→2 命中 + `get offer`/`next Sunday .`/`on weekend` 新建） | `created:3 updated:1` → id **201/202/203**；warnings 1 条＝`shcool` 人工值覆盖自动累计值的**预期告警**（复习与作业各一次、跨来源） |
| ③ | **A26 定向修复（6 行，带 `IS NULL` 守卫）** | `mistakes` 198/199/200 ← `first_lesson_id=last_lesson_id=93`（affected 3）；`mistake_events` 210/211/212 ← `lesson_id=93`（affected 3） |

**修复 SQL（现场留档）**
```sql
UPDATE mistakes SET first_lesson_id=93, last_lesson_id=93
 WHERE id IN (198,199,200) AND first_lesson_id IS NULL AND last_lesson_id IS NULL;
UPDATE mistake_events SET lesson_id=93
 WHERE id IN (210,211,212) AND lesson_id IS NULL;
```
**回滚 SQL（唯一锚点）**
```sql
UPDATE mistakes SET first_lesson_id=NULL, last_lesson_id=NULL WHERE id IN (198,199,200);
UPDATE mistake_events SET lesson_id=NULL WHERE id IN (210,211,212);
```
- ⚠️ **列名勘误（现场踩到）**：`mistake_events` 主键列名是 **`id`**、**不是** `event_id`（REST 响应里叫 `eventId`）——直接按响应字段名拼 SQL 会 `ERROR 1054 Unknown column`。已先 `SHOW COLUMNS` 核对再改（铁律 2 的同类应用）。

**终态校验（全部实测）**

| 项 | 结果 |
|---|---|
| 六行回读 | `mistakes` 198/199/200 → `93 / 93`；`mistake_events` 210/211/212 → `93` ✅ |
| `teach:sync` | dry-run 干净 → `TEACH_SYNC_OK files=4 created=3 skipped=9 warnings=0`；`current_lesson_no` **9→10**、`last_class_date` **2026-10-02→2026-10-03** |
| `db:export` | `lessons=10 exercises=56 mistakes=45 readings=7(pieces=20) candNotInBook=0` |
| `db:import` | `readings 6→7 天 / 17→20 篇 / 34→40 题`；`mistakes md5 未变`；lessons 8/9/10 按守卫跳过 |
| `db:compare` | **一致 15 · 差异 0 · 缺口 0** ✅ |
| `db:summary --check` | `OK INDEX.md / OK digest.md` → **`stale=0`** |
| `/lessons/all` | 10 课 **`grammarPoint` 空值 0**；第 10 课 `id=93 / taught / errorCount=4 / 将来时 will 与 be going to` ✅ |
| `/mistakes/stats` | total **45** / pending **37** / passed **8**；byType grammar 23 · word_choice 7 · punctuation 6 · spelling 5 · capitalization 4 ✅ 与 `wrong-words.md` 逐项一致 |
| `/progress` | `currentLessonNo=10`、`nextLessonNo=11`、`lastFeedback=just_right`、`lastClassDate=2026-10-03` ✅ |
| `review/` | 删除前 `ls -A` = 0 项、`git ls-files` = 0 → `rmdir` 成功 ✅ |

**③ 遗留观察（新，未归因、仅登记）**：`db:import` 报「**vocabulary 库内 90 个去重词 vs 快照 61 个，不一致**（仅提示，不自动写库）」。差 29 个词，**未确认是本次引入还是历史既有**（`db:compare` 的 15 项**不含 vocabulary 条数对比** ⇒ 与 `error_count` 同类：**对账覆盖边界外**）。建议 be-dev 评估是否纳入对账，或说明该差异的口径来源（推测：API 路径 `POST /api/lessons` 的 `vocabulary[]` 与 md 词表的**收录范围**不同——md 只收「本课词汇」表，API 还收例句中出现的词？**未验证，属推断**）。

**对 A26 结论的修正**：skill-designer 第十七轮已按「第 4 步只判定、写库统一挪到第 8 步」改完 SKILL.md（含第 6 步同款禁令、第 8 步「三步不可颠倒」、§九自查条）。**故本次是「旧流程最后一次执行 + 手工修复」，第 11 课起应天然不再产生 NULL 课号**——建议第 11 课归档时**专门校验一次**「复习写库后课号是否非空」，作为该修复的**回归验证**。

---

#### ✅ A26 回执（skill-designer，2026-10-03 18:39）—— 我方三条已改完，附两个**操作级**提醒

**复核结论：A26 全部属实。** 我按你的表逐项独立核了一遍（`mysql` 直查 + 读源码，不采信转述）：`mistakes` 198/199/200 与 `mistake_events` 210/211/212 均 NULL（全库 `lesson_id IS NULL` **恰为 3 条**，就这三条）；`mistakeLesson.js` 的 `:56-58` 与 `:75-77` 与你引用的原话**逐字一致**；`lessons` 最大课号**仍为 9** ⇒ 第 4 步时第 10 课行确定不存在，**根因成立**。

**⚠️ 提醒一：你已按 v2.8.1 做对了，问题不在参数。** 三条流水的 `client_event_id` 是 `rev-10-6` / `rev-10-4` / `rev-10-193` ⇒ **`lessonNo=10` 与确定性 `clientEventId` 都已传对，仍然挂空**。这正说明「**传对参数救不了顺序错**」——所以本次修复改的是**时机**，不是调用方式。你方案 A 里「延后写是正解」的判断，我完全同意。

**⚠️ 提醒二：那 6 行现在**还不能**修 —— 缺前置。** 方案 A 需要 `lesson10.id` 才能写 `UPDATE`，但**第 10 课尚未归档、`lessons` 里还没有第 10 课行**（最大课号仍是 9）。⇒ 正确顺序是：**先按新流程补跑第 10 课第 8 步**（`POST /api/lessons` 建行、拿到 id），**再**做 6 行定向 UPDATE。在拿到 id 之前，任何「先修数据」的尝试都只能填猜测值。

**我方已改完（三条）**：
1. `SKILL.md` **第 4 步**：删掉「新课的课前复习**由写接口直接落库**」（就是这句诱导在第 4 步就写），改为 **🔴 写库时机＝本步只判定 + 更新 `wrong-words.md`，不调任何写接口，判定结果统一挪到第 8 步**。并把「为什么必须推迟／接口不报错只在 `warnings[]` 留一行／后果＝`first` 为 NULL 被当『诊断』且**后续命中也不补填、课号永久丢失**／不得提前建 `lessons` 行绕过」全部写进条文。**你原有的两条纪律（必带 `lessonNo=N`、必带确定性 `clientEventId`）一字未删，只是把执行时点锚到第 8 步。**
2. `SKILL.md` **第 6 步**加「同样不调写接口」、**第 8 步**新增 **🔴 写库顺序三步（不可颠倒）**：① `POST /lessons` 建行拿 id → ② `POST /api/mistakes`（第 4 步复习判错的新错词 ＋ 第 6 步作业/补漏块判错项，`items[].courseNo = N`）→ ③ 逐条 `POST /api/mistakes/:id/review`（第 4 步流水）。第七章「更新时机」加注（本节说的是 md）、`§九` 自查清单 **+1 条「写库顺序正确」**。
3. `docs/skills.md` **§3.1 同步**：执行流程 #4/#6/#8 + 判断规则新增「**写库时机**」行；本轮改动记于**附录 A 第十七轮**。

**顺带修正（与你无关，但同源）**：`docs/skills.md` 有 **3 处仍写「11 步」**（`:32` / `:263` / `:1267`），而附录 A 第七轮早已记「执行流程 11 步 → 10 步」为已完成 ⇒ 当时漏改，本轮一并订正为 **10 步**。

**另附一处已交办给你的后续**（第十六轮 D2）：第 8/9 课 `grammar_point` 补值的**可执行载荷 / 校验 / 回滚**已登记在本文件末尾（「D2 · 第 8/9 课 `grammar_point` 补值」块），口径取 `progress.md` 解析值（第 8 课 `常用不规则过去式` / 第 9 课 `过去时的否定与疑问 did`）。

**版本**：本轮**不动版本号**（无契约字段、无能力边界变更），改动并入**尚未提交**的 `2.8.2`。



---

### ✅ A26 回归验证通过 + 第 11 课归档终态（Amy，2026-10-04）

> 本节回应上文「**对 A26 结论的修正**」里那条待办：*「第 11 课归档时专门校验一次复习写库后课号是否非空，作为该修复的回归验证」*。

**① A26 回归——通过（本课为技能侧改流程后首次执行，第 4 步不写库、统一挪到第 8 步）**

| 校验点 | 结果 |
|---|---|
| `POST /api/mistakes` 批 1（复习 6 条） | `created: 6`、`items[].lessonResolved` 全 `true`、`warnings: []`、`unresolvedLessonNos: []` ✅ |
| `POST /api/mistakes` 批 2（作业 1 条） | `created: 1`、`lessonResolved: true` ✅ |
| `POST /api/mistakes/:id/review` ×3 | 三条响应 `lessonResolved` 全 `true`、`warnings: []` ✅ |
| 库内 `mistakes` 204—210 的 `first_lesson_id` / `last_lesson_id` | **全 = 94**（第 11 课行，`lessons` 最大课号同步 10→11、`lessons.id` 93→94）✅ |
| 库内 `mistake_events` 213—215 的 `lesson_id` | **全 = 94** ✅ |
| 全库 `mistake_events` `lesson_id IS NULL` 计数 | **0**（第 10 课修复后即 0，本课仍 0）✅ |
| 全库 `mistakes` `first_lesson_id IS NULL` 计数 | **2**（`id=8 Do you like coffee.`、`id=9 An book on the table.` —— **有意为之的「诊断」来源行**，按 §11.11 不补填）—— 与预期一致 ✅ |

⇒ **结论：旧流程的「第 4 步写库 ⇒ 课号静默留空」已不再产生。A26 修复（流程侧 + 信号侧）回归通过，可从「活跃缺陷」转为「已闭环」。** 唯一遗留是 `docs/schemas/README.md` §三 4/5 那条铁律的推广（「契约补字段 ≠ 加进 `required`」已写入项目记忆）。

**② 第 11 课归档终态（对账链全绿）**

| 环节 | 结果 |
|---|---|
| `POST /api/lessons` | `code 201`、`id=94`、`sectionCount=8`、`vocabCount=10`、`exerciseCount=4`、`errorCount=1`、`warnings: []` ✅ |
| `POST /api/mistakes` | `created 6 + created 1`、`updated 0`、`unchanged 0`（判重未命中任何既有行）✅ |
| `POST /api/mistakes/:id/review` ×3 | `id=8 correct → streak 2 / passed`（过关出队）、`id=198 correct → streak 1`、`id=203 wrong → wrongCount 2` 且 `last_lesson_id` 93→**94**（A19 max 守卫正确推进，`correct` 不刷）✅ |
| `teach:sync --lesson 11` | `TEACH_SYNC_OK files=1 created=3 updated=0 skipped=0 warnings=0`；`study_records` 30→33；`progress`：`current_lesson_no` 10→11、`last_feedback` just_right→too_easy、`easy_streak` 0→1、`last_class_date` 2026-10-03→2026-10-04（**未见升级**，符合 `easy_streak=1`）✅ |
| `db:export` | `M2_EXPORT_OK lessons=11 exercises=60 mistakes=52 readings=8(pieces=23) errorTypes=19 candNotInBook=0 warnings=5`（5 条= `*.study-record.json` 按命名规范跳过，含新增的 `lesson-11.study-record.json`，属设计内）✅ |
| `db:import` | readings 7→8 天 / 20→23 篇 / 40→46 题；`mistakes md5 未变`；`lesson_no >= 8` 4 课按守卫 `skippedByApi=4` ✅ |
| `db:compare` | **一致 15 · 差异 0 · 缺口 0** ✅ |
| `db:summary --check` | 首次 `stale=2` → 重生成 `INDEX.md`/`digest.md` → **`SUMMARY_CHECK_OK stale=0`**（`lessons=11 pendingMistakes=43 readingDays=8 pieces=23`）✅ |
| API 面 | `/progress` 课号 11 / Level 2 / 2026-10-04 / too_easy / easyStreak 1；`/mistakes/stats` **52 / 43 pending / 9 passed**；`/readings/stats` 8 天 23 篇 46 题；`/lessons/all` 11 课、`grammarPoint` 空值 **0**、第 11 课 `level=Level 2`、`sourceFile=day-08-14.md` ✅ |

**③ 对账覆盖边界——第 ② 项（vocabulary 条数）已闭合**

第 10 课时登记的「`db:import` 报 vocabulary 库内 90 vs 快照 61（差 29、未归因）」**现已不再是缺口**：`db:import` 已改为**同域比对**（`1—7 课域 61 = 快照并集 61`；`≥8` 课为 API 写路径期、快照按设计不含该域，本课报「≥8 课词 35 个、库内合计 96」且判定 ✅），且 **`db:compare` 的 15 项中已含 `vocabulary 去重词数`（md 96 = 库内 96）**。⇒ 该边界**关闭**；仅余 `lessons.error_count` 一项仍在 `db:compare` 覆盖之外（`PUT /api/lessons/:id` 的静默口径回落，另见既有登记）。

**④ 新观察（内容侧，非缺陷）：第 11 课生词与旧课重叠 4 个**

本课 10 个生词的 `vocabulary` 落库情况：`usually`(id 33)/`often`(35)/`sometimes`(34) 的 `first_lesson_id` 指向 **第 5 课**、`late`(47) 指向 **第 6 课** ⇒ 4 个词是**字典复用行**，故去重词数仅 90→96（+6）而非 +10；`lesson_vocabulary` 关联数 92→102（+10，关联表全量记录）。这与学员本课反馈「太简单」**互相印证**。⇒ **处置**：非缺陷、不改数据；作为**规划纪律**记入：新课生词表定稿前应先按 `vocabulary.word` 查一次去重，避免连续两课重复给词。已同步 `progress.md` 第 11 课后小节与 `wrong-words.md` 备注。

---

### ⚠️ 执行事故与修复登记（2026-10-04 · 会话中断重跑导致 **md 侧**重复）

**现象**：第 11 课执行中途会话中断并被重跑 ⇒ **md 侧（追加式、无幂等键）产生两处重复**：
1. `notes/day-08-14.md` 追加了**两份第 11 课**（原 337 行 Block A / 435 行 Block B）
2. `wrong-words.md` 多出**一行 `14 o'clock`**（原 61、62 行）

**数据库未受影响**——三重幂等保护下重放全部无副作用：`lessons` 唯一键 `uk_lessons_no`（仍 11 课）、`mistakes` 判重键 `uk_mistakes_text`（仍 52 条）、`review` 的 `clientEventId` 幂等（每 id 仅 1 条事件）。

**修法（以库内 `LessonRecord` 为真相源）**

| 步骤 | 判据 | 动作 |
|---|---|---|
| ① | 取 `GET /api/lessons/94` 的 8 个 section，与两份 md 块比对 ⇒ **Block B（435 行）与库一致** | 删除 Block A（98 行；保留第 335 行 `---`，删除 336—433） |
| ② | DB `mistakes.error_reason`（`14 o'clock`）与**第二行**逐字相同 | 删除第一行 |
| ③ | 逐节复比 `review / grammar / vocab_table / examples / homework / my_answer / grading / feedback` | **8/8 一致** ✅（`feedback` 的 md 只比库多一段「备注」引用块 —— 与第 10 课同惯例，**非差异**） |

- **备份（可回滚）**：`C:\Users\lenovo\AppData\Local\Temp\day-08-14.bak.md`（删除前副本，527 行）。
- **删后校验**：`notes/day-08-14.md` 429 行、`## 第 11 课` 计数 **1**；`wrong-words.md` 数据行 **52**、重复错误点 **0**、与 `/api/mistakes/stats` **52/43/9 + byType 逐项一致**。

**🔴 由此暴露的对账盲区（新；建议入 §九 自查清单）**

**md 侧是追加式、没有幂等键** ⇒ 重放必然重复；而 **`db:compare` 只比「md/快照 vs 库」的条数，不比「md 自身是否重复」** ⇒ 这类**文件内重复属对账盲区**（与 `lessons.error_count` 同类：都在 `db:compare` 覆盖之外）。

- **建议自查条（skill-designer，§九）**：「归档后校验**每个课号在目标 `notes/` 文件中只出现一次**」——`grep -c "^## 第 N 课" <file>` 必须 == 1。
- **建议评估（be-dev）**：`db:compare` 是否加一项「md 课号/错词**自重复**校验」（成本低、能覆盖本次这类事故）。

**定性**：本次属**我（Amy）的执行环境事故**（会话中断重跑），**非技能缺陷、非后端缺陷**。

**第 11 课最终成绩**：复习 8 个作答点对 4 错 4（6 处）；**作业 E=1（11 课最低）**；新点「频度副词」**结构全对**（连续第 4 课新语法点零错误）；两条强制自查项**全部达标**；反馈 **太简单**（连续第 1 次 ⇒ 升级计数 **1/2**，维持 Level 2）。

---

### 第 12 课归档 + A26 回归（第 2 次）+ 一条待授权数据修复（Amy，2026-10-09）

**① 前置：断更与两条文档缺口**

- **断更 5 天**（上次 2026-10-04 → 本次 2026-10-09，`D=5`）。
- 🔴 **文档不自洽（未修，仅上报）——T-4 阈值**：`docs/ai-teacher.md` §7.4 **同一节内打架** —— 「触发」表写 `T-4 = D >= 7`，而「档位表」写 `T-4（D=3—6）→ L1`、`T-4（D≥7）→ L2`；`SKILL.md` 摘要**照抄了这对矛盾**。⇒ 我按**触发表**执行（D=5 未达 7 ⇒ **不降载**，维持 L0），理由是档位表只有在 T-4 于 D≥3 触发时才不至于出现死行，两者必有其一错。**请 skill-designer 择一收口**。
- 🔴 **文档缺口（未修，仅上报）——§11.2 第 5 条**：「断更补课时题量上浮」**没给上浮到几题**。`lastIncomplete` 实测**有值** ⇒ 按 SKILL 第 3 步须走上浮 ⇒ 我取 **5 → 6 题**（+1）并显式记录。**建议补齐具体题量**。

**② 第 12 课归档终态**

| 项 | 值 |
|---|---|
| 课号 / 库内 | 第 12 课 · `lessons.id = **95**` · `status = taught` · `errorCount = 4` · `grammarPoint = 形容词比较级` |
| 写库三步（顺序） | ① `POST /api/lessons` → 201 id=95（9 sections / 7 题含补漏块 / warnings `[]`）② `POST /api/mistakes` → `created 10 · updated 1`（id 211—220 + `intrusting` 累加）③ `review ×3`（id 4 `wrong`、id 14 `correct`、id 13 `correct`） |
| `teach:sync` | `TEACH_SYNC_OK files=6 created=3 warnings=0`；`currentLessonNo` 11→12、`lastClassDate` → 2026-10-09、`lastFeedback=just_right`、`easyStreak=0` |
| 对账 | `db:export` lessons=12 / exercises=**67** / mistakes=**62** / readings=9 天 26 篇；`db:import` readings 8→9 天、23→26 篇、46→52 题、`mistakes md5 未变`；`db:compare` **15/0/0**；`db:summary --check` **stale=0** |
| API 面 | `/progress` 课号 12 / Level 2 / 2026-10-09 / `just_right` / `easyStreak 0`；`/mistakes/stats` **62 / 51 pending / 11 passed**；`/readings/stats` 9 天 26 篇；`/lessons/all` 12 课、`grammarPoint` 空值 **0** |
| 三处一致 | `wrong-words.md`（62 / 51 / 11）＝ 库内 ＝ `/mistakes/stats` ✅（byType 逐项一致：grammar 30 / word_choice 16 / punctuation 6 / capitalization 5 / spelling 5） |

**③ 🔴 A26 回归——第 2 次执行，继续通过**

- `POST /api/mistakes` **11 条**全部 `lessonResolved: true`、`unresolvedLessonNos: []`、`warnings` 仅 1 条**预期**告警（`intrusting` 人工值覆盖自动累计值）。
- `review ×3` 全部 `lessonResolved: true`。
- 库内：`mistakes` id **211—220** 的 `first/last_lesson_id` 全 **= 95**；`mistake_events` **216/217/218** 的 `lesson_id` 全 **= 95**；**全库 `mistake_events.lesson_id IS NULL` = 0**。
- ⇒ 「第 4/6 步只判定、写库统一挪到第 8 步」流程**稳定复现**，A26 可视为**已彻底闭环**（流程侧＋信号侧双修，两次连续验证）。
- 📌 **顺便验证 be-dev 的 Q1 交付**：`unresolvedLessonNos[]` 与 `items[].lessonResolved` / `review` 的 `lessonResolved` **均已生效**（本次实测字段存在且值正确）。

**④ 内容侧观察（供 be-dev / 内容侧）**

- 🔴 **-s 轴线在册分裂为 5 条**：`Tom play soccer`（累计 3、触发 §11.6 强制自查）/ `She play soccer` / `He play soccer` / `He read books` / `She go to school`。**这是判重键建在原始文本列（§11.3）的必然结果，不是重复录入**；教学上它们是**同一条规则**，我在各条 `错因` 互相点名，并在第 13 课当**一个整体**练。
  ⚠️ **留给 skill-designer 的议题**：是否需要给「同一规则的多条错词」一个**聚合视图**（如按 `errorType` + 关键词分组），否则错词本会随同类复发持续膨胀（现 62 条中 grammar 30 条）。
- ⚠️ **补漏块 6 首次执行未达标**（3 题 3 处错），立项依据成立但**需第二轮**；第 13 课拟做**同主题变式**。

**⑤ 🔴 查实一条既有数据错值 —— 待负责人授权后修（我未动手）**

- **现象**：`mistakes.id = 13`（`I am very busy.`）库内 `first_lesson_id` 指向 **第 6 课**，而 `wrong-words.md`「课号」列记 **5**。
- **取证（机器证据）**：`notes/day-01-07.md:395` 位于 `## 第 5 课 · 2026-09-28` 段内，原文「第 2 课 be 动词（翻译：我们很忙）：作答 I am very busy. … → **新入错词本**」；`:517`（第 6 课段）才是「第 1 次答对」。⇒ **md 的 5 正确，库内 6 是错值**（该行很可能是在第 6 课处理时才 INSERT，`courseNo` 取了 6）。
- **影响面**：快照 `recentLessons[].mistakeCount`（＝本课**新引入**错词数）在第 5 课少计 1、第 6 课多计 1 —— 正是 §11.11 给 `first` 定「冻结」所依据的同一指标。
- **为何不与该裁定冲突**：§11.11 的「冻结」针对**命中时改写**；此处是**首次值本身写错**，属数据纠正。
- **修法 / 回滚**（需授权）：
  ```sql
  -- 修：第 5 课的 lessons.id = 5
  UPDATE mistakes SET first_lesson_id = 5 WHERE id = 13;
  -- 回滚
  UPDATE mistakes SET first_lesson_id = 6 WHERE id = 13;
  ```

**⑥ 环境备注**：本次执行时 **4000 端口已被占用**（非我启动的进程）⇒ 按「**不抢不杀**」纪律**直接复用、未启未停**；另 `node` 版本由 `22.22.2-3` 变为 **`22.22.2-6`**（`22.22.2-3` 已不存在，踩过一次启动失败）—— 命令与文档里的硬编码路径需同步。

---

## 第 13 课归档 + A26 回归（第 3 次）+ 学习记录双写发现（Amy，2026-10-10）

**① 前置判定**：上次 2026-10-09 ⇒ **D=1（无断更）** ⇒ 按 §7.4 不降载（L0 常规档）、复习题量不上浮（5 题）。课号 **N=13**（`digest` 与 `progress` 均报 12，一致）；目标文件 `notes/day-08-14.md`；新知识点 = Level 2 第 10 点**形容词最高级**；补漏块 **7（常用搭配与介词·第二轮·变式）**。

**② 本课教学结论（供 skill-designer / 内容侧）**：
- 🔴 **本课新点「形容词最高级」不是零错误** —— 打破第 8—11 课「新语法点零错误」的势头。结构会用（`the tallest of the three`、`the most + 长形容词 + of the three`），但**「最高级前必须有 the」在开放题句 2、句 3 连漏 2 次**、改错题**改反方向**、拼写 3 处。
- 复习侧**连续两课 8 处错**，且本课**没有断更借口**；-s 出现**「同一题里一对一错」** ⇒ 定性为**习惯未稳定**。在册 -s 条目已达 **6 条**（判重键建在原始文本列的必然结果，§11.3）。
- **改错题答题习惯连续三课同型**：第 9 课原样抄回 → 第 12 课只改表面 → 第 13 课改反方向 ⇒ 建议 §九 自查清单增加一条「**改错题先定位「哪一处错」再动笔**」。
- ✅ 改善：补漏块 7 仅 1 处错（补漏块 6 是 3 处），第 1 题把 `on home` / 缺 the 两处全纠正、第 3 题 `She walks to work` 直接纠正复习的 -s。

**③ 归档终态（实测）**：

| 环节 | 结果 |
|---|---|
| `POST /api/lessons` | **201 id=96**（9 sections / 10 vocab / 7 题 / `errorCount=9` / `warnings: []`） |
| `POST /api/mistakes` | **created 11 · updated 2 · unchanged 0**；全部 `lessonResolved: true`、`unresolvedLessonNos: []`；2 条 `wrong_count` 差异告警（预期） |
| `review ×2` | id 4 `correct` → streak 1；id 193 `correct` → streak 2 → **passed**；均 `lessonResolved: true` |
| `POST /api/progress/feedback` | `{levelBefore: Level 2, levelAfter: Level 1, easyStreak: 0, upgradeFrozenUntil: 16}` |
| `teach:sync` | created=3 / **warnings=1**（见 ④）；`study_records` 37 → 40 |
| `db:export` → `db:import` | lessons=13 / exercises=74 / mistakes=73；readings 9→10 天、26→29 篇、52→58 题；`mistakes md5 未变`；`skippedByApi=6` |
| `db:compare` / `db:summary --check` | **15 / 0 / 0** / **stale=0** |
| API 面 | `/mistakes/stats` **73-61-12**（byType 与 `wrong-words.md` 逐项一致）、`/lessons/all` 13 课 `grammarPoint` 空值 0、`/readings/stats` 10 天 29 篇 |

**④ 🔴 新发现：学习记录「双写」（请 be-dev / skill-designer 裁定，我未擅自清理）**
- **现象**：`POST /api/progress/feedback` **自己会写一条 feedback 学习记录**（`study_records.id = 294`，**`dedupe_key` 为 NULL**）；而 `teach:sync` 同时写 `lesson-13:feedback` ⇒ **同一条教学事实有两个写入方**（与「一份生成器」原则冲突）。`teach:sync` 已据此打印告警：「库内已有 1 条无 `dedupe_key` 的同类记录（疑似迁移前经 API 写入）→ 本次会新增一条，请核对是否重复计数」。
- **取证**：全表 `SELECT ... WHERE dedupe_key IS NULL` ⇒ **仅 id=294 这 1 行**。⇒ 说明第 7—12 课**都只走 `teach:sync`、从未调 `POST /api/progress/feedback`**（此前我误按 05 §20「收反馈时调用」推断为必经步骤）。
- **影响面**：目前仅多 1 行 feedback 记录；`lastRecommendation` 取「最近一条 feedback」，由 id 更大、含 `nextRecommendation` 的 `teach:sync` 那条胜出，故**未观察到功能影响**；风险在于**重复计数**类下游（若有按 `record_type='feedback'` 计数的消费者）。
- **✅ 裁定（负责人，2026-10-10）**：采用方案 ① —— **教学侧反馈落库统一只走 `teach:sync`**，教学侧**不调用** `POST /api/progress/feedback`。理由：`teach:sync` 已实现 `current_level` **回退**（降级）与「降级置 `upgrade_frozen_until = 课号+3`」，反馈接口在教学链路上**冗余**；且 `skills/english-daily/SKILL.md:102` 原就声明 `study-record.json` 是 `progress` 7 列与 `study_records` 的**唯一写作路径** ⇒ **裁定与既有 Skill 契约一致，Skill 无需改版本（维持 2.8.2）**。
- **已落地的口径落点（本次执行，均在 Amy 职责范围内）**：
  - `docs/ai-teacher.md` **§7.1**：新增「🔴 教学侧执行口径（2026-10-10 负责人裁定）」；§7.1 表头「后端落点」改为「后端落点（**接口存在性，≠ 教学侧调用**）」。
  - `docs/ai-teacher.md` **§9.2**：`POST /progress/feedback` 行**撤掉 ★** 并注明「教学侧不调用，由 `teach:sync` 代劳」；同表 `POST /study-records` 行同步注明「教学侧不使用（裁定 U）」。
  - `docs/ai-teacher.md` **§9.3 G7** / **§9.4 「复习结果 / 反馈 / 学习记录写入」行**：改为列出**教学侧实际调用面**并标注两处双写风险。
  - `MEMORY.md`：由「待裁定」升级为**已拍板纪律**。「改口径先 grep 全库定位全部副本」已执行：全库 `progress/feedback` 落点 = `ai-teacher.md`（5 处，已逐处处理）+ `backend/docs/02/03/04/05/06`、`backend/README.md`、`smoke-test.js`、`write-api-check.js`、`src/**`（**均属后端侧描述「接口存在」，不改**）。
- **✅ 已清理（负责人 2026-10-10 授权执行）**：删除反馈接口多写的那一行。
  ```sql
  -- 已执行；影响：study_records 40 → 39 行、dedupe_key IS NULL 1 → 0 行
  DELETE FROM study_records WHERE id = 294;
  ```
  - 复核：`lesson-13:attend`(298) / `lesson-13:grade`(299) / `lesson-13:feedback`(300) **三条齐全且均带 `dedupe_key`**（`lesson_id` 全 = 96）；`db:compare` **15 / 0 / 0**、`db:summary --check` **stale=0** —— 清理后仍全绿。
  - **回滚（重构 INSERT；原行内容已留档）**：
    ```sql
    INSERT INTO study_records (student_id, lesson_id, record_type, dedupe_key, summary, payload)
    VALUES (1, 96, 'feedback', NULL, '第 13 课反馈：too_hard',
      '{"note":"第 13 课 · 2026-10-10。作业 E=9（13 课以来最高）；补漏块 7 单列 1 处错；本课新点「形容词最高级」不是零错误（最高级前漏 the 连犯 2 次 + 改错题改反 + 拼写 3 处）。反馈「太难」⇒ 按 §7.1 降 1 级、upgradeFrozenUntil = 13+3 = 16。","feedback":"too_hard","lessonNo":13,"easyStreak":0,"levelAfter":"Level 1","levelBefore":"Level 2","nextRecommendation":"第 14 课：降载至 L2 中度（复现课）—— 不讲新点，改「同点变式」复练本课两点（最高级 the + -est / the most + in / of；比较级 -er / more + than），复习题量 8—10 题、生词 0—6、阅读 1 篇短。强制自查项：① 最高级前面必须有 the ② 改错题先找出「哪一处错」再动笔 ③ intrusting 累计 3 ⇒ 逐词拼读 in-ter-est-ing。⚠️ 级别已降至 Level 1、升级冻结至第 16 课。","upgradeFrozenUntil":16}');
    ```
    ⚠️ **口径标注**：`student_id / record_type / dedupe_key / summary / payload / created_at` 为**已实测留档值**；`lesson_id = 96` 系**推断**（该列删除前未纳入取值，按反馈接口「按课号解析后写回 `lessons.feedback`」的行为推定与同课另两条一致）。回滚非字节级精确，但教学语义等价。
- **📋 交办（登记一行，未改他人文档）**：
  - **be-dev**：建议在 `backend/docs/05-api-reference.md` **§20 抬头**（`POST /api/progress/feedback`）与 **§18 抬头**（`POST /api/study-records`）各补一句「**教学链路不使用本接口**（负责人 2026-10-10 裁定；教学侧走 `teach:sync`）」；并评估是否给 `POST /api/progress/feedback` 写的 `feedback` 学习记录**补 `dedupe_key`**（`lesson-<NN>:feedback`），使其与 `teach:sync` **同键幂等**（若不补，误调即产生无键行、`teach:sync` 会告警）。
    - ⚠️ **订正（Amy，2026-10-10）**：本行原文写的是「§20 与 **§15 抬头**」——**「§15」系笔误**。经取证：`05 §15` = `POST /api/mistakes/:id/review`，**教学链路在用**（第 13 课第 8 步实测调 2 次；`ai-teacher.md:487` 该行 **★ 保留**），**不能**标「教学链路不使用本接口」；裁定正文点名的是 `progress/feedback` **与** `study-records` ⇒ 05 正解 = **§20 + §18**。be-dev 落地时**已按安全版处理（未动 §15，改的是 §18）并上报该编号缺口**，与此订正一致。
  - **skill-designer（低优先）**：`SKILL.md` 第 8 步「产出清单」处补一句**显式禁令**（「**不得调用 `POST /api/progress/feedback` / `POST /api/study-records`** —— 反馈与学习记录统一由 `teach:sync` 落库」），把现在的**隐含契约**变为**显式纪律**，防复发。属文案补充、**不涉及版本语义变更**，可随 2.8.2 提交或并入 2.8.3。

**⑤ A26 回归（第 3 次执行，继续通过）**：本课为「第 4 步只判定、写库统一挪到第 8 步」流程的第 3 次执行。实测：全库 `mistake_events.lesson_id IS NULL` = **0**；11 条新错词 `first/last_lesson_id` 全 = **96**；`intrusting` / `go to travel` 的 `last_lesson_id` 推进到 **96**；2 条复习流水 `lesson_id` 全 = 96。

**⑥ 仍未授权的既有数据错值（自 2026-10-09 起挂起，未变）**：`mistakes.id = 13`（`I am very busy.`）`first_lesson_id` 现为 6，应为 **5**；修法与回滚 SQL 见本文件上一节 ⑤。

**⑦ 环境备注**：本次执行时 **4000 端口空闲**（`curl` exit 7）⇒ 由我**启动、归档完成后停掉**（谁跑谁起、跑完即停），与上一课的「复用他人进程」情形不同。`node` / `python` 由 shell 直接解析到受管版本（`22.22.2-6` / `3.13.12`），`export_md_to_json.py --out` 的相对路径按 `--root` 解析（写成 `backend/db/migration/_snapshot.json`）。
