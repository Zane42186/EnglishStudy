# 后端工程师（be-dev）工作状态

> **更新时间**：2026-10-01 14:10（GMT+8）
> **角色**：后端工程师 / be-dev —— 负责 Node 22 + Express 4 + MySQL 8.0 后端、数据层、迁移管线与契约实施
> **证据分级**（全文遵循）：**已实测** = 本仓库脚本/接口跑过的结果；**静态证据** = 文件或提交可查但本次未执行；**推断** = 未见实测依据；**未验证** = 明确没跑过。
>
> ⚠️ 本文件是**时点快照**，会被后续工作覆盖。**判断以 `backend/docs/05-api-reference.md`（接口唯一权威）与库内数据为准**，本文件只作状态索引。
>
> 🔴 端口纪律：服务**默认停止**；4000/5500 唯一 owner 是 be-dev，只在跑测试时起、跑完立即停。其他角色请勿启动，端口空着直接上报即可。

---

## 一、已完成事项

### A. 数据与迁移管线

| # | 事项 | 证据 | 状态 |
|---|---|---|---|
| A1 | **M2 自动迁移闭环**：`db:export`（只读导出）→ `db:compare`（只读验收）→ `db:import`（写库器，单事务 + 幂等 + `--dry-run`） | **已实测**：`lesson_sections` 12→51、`lesson_exercises` 0→34、`readings`/`reading_pieces`/`reading_questions` 0→4/11/22、`study_records.payload.byType` 补 6 课 | ✅ |
| A2 | **回填幂等**：连跑两次 `db:import` 全部 `±0`；`db:init` 重跑不回退回填内容 | **已实测**：四处 md5 未变 | ✅ |
| A3 | **DQ1 幂等迁移**：`UK uk_mistakes_text (student_id, wrong_text)` + `seed.js` 的 `isRealMistake()` | **已实测**：重跑 `db:init` 不再翻倍（原 19→38） | ✅ |
| A4 | **错词本对齐**：`db:sync-mistakes` 同步 23 条（**4 insert + 13 update**，`wrong_text` 括号批注改净） | **已实测**：8 维度逐字段 **0 差异**；`/api/mistakes/stats` = total 23 / pending 19 / passed 4（grammar 9 · word_choice 5 · capitalization 4 · punctuation 3 · spelling 2） | ✅ |
| A5 | **`error_type` 回填**：`db:apply-error-types` 读 `records/exercise-error-types.json` | **已实测**：**10 填 / 24 NULL**；硬校验 `error_type != null ⟺ is_correct = 0` 通过 | ✅ |
| A6 | **对账全绿**：`db:compare` 由 `11/3/1` 收口至 **`15/0/0`**；`db:export` warnings 由 1 → **0** | **已实测** | ✅ |
| A7 | **三件新工具**：`db:sync-mistakes`、`db:apply-error-types`、`db:summary` | **已实测**：均幂等、支持 `--dry-run` | ✅ |
| A8 | **摘要改由后端生成**：`INDEX.md` / `digest.md` 由 `db:summary` 读库产出（复刻退役的 `build_board.py` 规则） | **已实测**：`db:summary --check` → `stale=0` | ✅ |
| A9 | **第 7 课入库闭环**（2026-10-01）：`lessons` 6→7、`lesson_sections` 51→60、`lesson_exercises` 34→41、`readings`/`pieces`/`questions` 4/11/22→5/14/28、`vocabulary` 51→61、`lesson_vocabulary` 52→62、`mistakes` 23→26 | **已实测**：`db:export` → `db:import` → `db:compare` **15/0/0**；`db:summary` lessons=7 / pendingMistakes=20 / readingDays=5 / pieces=14 | ✅ |
| A10 | **修「新课整课被跳过」潜伏 bug**：导出器补 `perLessonLevel`（逐课级别）+ `perLessonGrammar`（逐课语法点，取自 `progress.md`「已学知识点」） | **已实测**：此前**任何课**都不输出 `levelCode`，第 1—6 课已存在所以看不出来；第 7 课因 `level_code` NOT NULL 被整课跳过。现已入库且 `level=Level 2` | ✅ |
| A11 | **导入器补 `syncVocabulary`**：幂等写入 `vocabulary`（`uk_vocab_word`）+ `lesson_vocabulary`（`uk_lesson_vocab`），`COALESCE` 只补空缺不覆盖 | **已实测**：51 vs 61 的不一致消除；重跑行数 `±0` | ✅ |
| A12 | **导入器补计数回写 `syncLessonCounts`**：只给「本轮新建」或「三项计数全 0」的课回写 `vocab_count`/`exercise_count`/`error_count`；`grammar_point` 为 NULL 时补写 | **已实测**：第 7 课 → 生词 10 · 作业 7 · 错误 2 · 语法点「规则动词过去式 -ed」；第 1—6 课**一个字节都没动** | ✅ |

### B. 接口与契约

| # | 事项 | 证据 | 状态 |
|---|---|---|---|
| B1 | **`POST /api/readings` 开放**：单事务判重，同日已存在 → **409**，`?force=true` 显式重出；`renderBodyMd`/`countWords` 与 `db:import` 共用实现 | **已实测**：`test:write` RW1—RW18 全过；回填的 `reading_pieces` md5 未变 | ✅ |
| B2 | **`reading_pieces.source_url` 补列**（此前 `sourceUrl` 被静默丢弃） | **已实测**：RW7 | ✅ |
| B3 | **§11.10 答案非空**：写路径拒收空/纯空白 `answer` | 代码**早已实现**（`reading.service.js`），本轮补**测试锁** RW13c/d/e；**已实测** 400 + 明细指向 `questions[].answer` + 校验失败不写库 | ✅ |
| B4 | **G4 `lastIncomplete`**：`incompleteStep` 由 `payload.incomplete_step` → camelCase → 快照透传；`lastRecommendation` 形状严格化为 `{lessonNo, text}` | **已实测**：`cc73588` + D1/D1b/D1c 锁定 | ✅ |
| B5 | **前端配合项答复**（V1 正常链路验证 / C6 / C8 / C9 / C10） | 落档 `backend/docs/05-api-reference.md` §六 | ✅（静态证据） |
| B6 | **批改三字段回填**（amy 交办 ③）：`is_correct` / `error_note` / `revised_answer` | **已实测**：`is_correct` 34/34（0 NULL，答错 10）、`error_note` 10（= 10 道错题）、`revised_answer` 6（与 `records/*.grading.json` 的 `revisedAnswer` 逐条对应） | ✅ |
| B7 | **`error_count` 历史值处置**（amy 交办 ④） | **已决保留**（3/4/2/6/2/5 vs 重算 5/4/2/6/1/6）；**口径切换点 = 第 7 课**已写入 `04-migration-and-roadmap.md` | ✅ |
| B8 | **课程详情页渲染崩溃修复**（`review/assets/ui.js`，**跨职责**）：`renderMarkdown` 段落终止条件与三个分支判定不同源，`---` / `**加粗**` 开头的行使 `i` 不前进 → `out` 无限增长 → `RangeError: Invalid array length` | **已实测**：修复前第 1—7 课全崩（`#lessonBody .sec` = 0）；修复后 10 个小节正常渲染、`verify-frontend-pages` **47/47**、shared **36/36**（前端补回归断言后） | ✅ 已完成（**fe-dev 已于 2026-10-01 复核「修复正确」**） |
| B9 | **W1 判重键四处一致性复核**（原「进行中」，卡点消除：可直接核内容，不必等提交） | **已实测**：`ai-teacher.md:619`（权威）／`skills.md:243`（镜像）／`mistake.schema.json:58` 三处均为「规范化 `wrongText`」；`sync_mistakes.js` 的 `normKey()` 与库唯一键 `uk_mistakes_text(student_id, wrong_text)` 亦为 `wrongText`。**方向一致** | ✅ 已完成（**但发现一处口径漂移，见 NEW-6**） |
| B10 | **W2 阅读答案必填口径对齐**（同上，卡点消除） | **已实测**：`reading-set.schema.json` 的 `$defs.ReadingQuestion.properties.answer = {type:string, minLength:1}`（required）↔ 后端 `reading.service.js:144` 拒非字符串/空串 → **方向一致，后端无需改动** | ✅ 已完成 |

### C. 本轮提交

`8f30b59` 三件工具 + 摘要 → `4f936c2` 导出对账与前端滞后断言 → `5e1fef8` 文档同步 → `cc73588` G4 `incompleteStep` → `c5844cb` 三件事落档 → `0d76732` §11.10 测试锁 → `25e3809` 新增本状态文档 → **`d868401`** `ui.js` 死循环防御 → **`cf07f29`** 第 7 课入库闭环 + 验证基线动态化 → **`a2bdd1b`** 状态文档更新。
**全部用显式路径提交，未使用 `git add -A`**；未提交任何 `backup-*.sql`、`.env` 或 `_snapshot.json`。
⚠️ **2026-10-01 14:07 之后的本文档改动尚未提交**（含本轮核查结论），等负责人授权后由 git-manager 显式路径提交。

### D. 当前验证基线（**已实测**，2026-10-01）

| 检查 | 结果 |
|---|---|
| `test:api` | 49 / 49 |
| `test:write` | **66 / 66**（59 → 63 补 G4，→ 66 补 §11.10） |
| `integration-check` | 17 / 17 |
| `verify-frontend-pages` | **47 / 47**（基线已改为**与接口值动态比对**，不再写死 6 课 / 51 词） |
| `verify-frontend-shared` | **36 / 36**（同上，去掉 51 / 6 / 20 等常数；**2026-10-01 fe-dev 补 4 个 `renderMarkdown` 回归输入，35→36**） |
| `db:compare` | 一致 15 · 差异 0 · 缺口 0 |
| `db:summary --check` | `stale=0` |
| `check_schemas` | `SCHEMA_OK` |

**库内计数**（`F2 零影响` 断言锁定，2026-10-01）：students 1 / lessons **7** / vocabulary **61** / lesson_vocabulary **62** / **mistakes 26**（pending 20 / passed 6）/ study_records 18 / progress 1 / lesson_exercises **41** / lesson_sections **60** / readings **5** / reading_pieces **14** / reading_questions **28**。

**第 7 课**（本轮补齐）：语法点「规则动词过去式 -ed」· 生词 10 · 作业 7（作业 4 + 补漏块 3）· 错误 2（作业口径，不含补漏块 3 处）。

---

## 二、进行中事项

> 说明：原 W1／W2 两项收尾核对**已收口**，结论记入第一节 **B9／B10**。当前「进行中」只剩**已就绪、等授权执行**的写操作 —— 本轮按「只做核查」的要求**一条都没跑**。

| # | 事项 | 现状（已核查，可直接执行） | 卡点 |
|---|---|---|---|
| W3 | **重跑 `db:apply-error-types`**（Amy 交办 A6） | 文件已就绪：`records/exercise-error-types.json` = **41 行**（第 7 课 7 行），非 NULL **12**；库内第 7 课 `error_type` 非 NULL = **0** → 预期全库 10 → **12** | 等授权（**写库**） |
| W4 | **重跑 `db:sync-mistakes`**（Amy 交办 A7） | 错词本 `wrong-words.md:32` 已改 `in office`；库内 `mistakes` id=130 仍为 `in office（缺限定词）` → 预期 26/26 零差异 | 等授权（**写库**） |
| W5 | **第 7 课学习记录落库**（Amy 交办 A8） | ⚠️ **不是「跑一下」就行 —— 有管线缺口**：`db:import` 只把 `byType` 合并进**已存在**的 grade 行，**不创建** `study_records` → `records/lesson-07.study-record.json` **目前没有任何消费方**。详见 T12 与「五之 P1」 | **需先拍板写入路径** |

> ✅ **2026-10-01 回执（Skill 设计师 + git-manager）**：W1/W2 的两个卡点文件**均已改完、只差提交**（`docs/skills.md` = v2.5.0 镜像 + 3.1 异常情况；`docs/schemas/reading-set.schema.json` = v2.6.0 补 `answer.description`，**契约结构未变**）；判重键已在 `814293a` 更正入库。**一经 git-manager 以显式路径入库，W1/W2 即可开跑**（提交批次见 `GIT-MANAGER-STATUS.md` §三 A.2）。

---

## 三、待完成事项（后端自有 / 待他人 / 等授权）

| # | 事项 | 现状（静态证据） | 阻塞条件 |
|---|---|---|---|
| T1 | **G5 `studyMinutes`** | `payload` 白名单已有 `study_minutes` → `studyMinutes`，但**读路径无任何消费** | 需求清晰即可做：缺数据须返 `null` 并标降级，**必须区分「没数据」与「数据为 0」** |
| T2 | **G3 `backlog` / 知识点地图** | 快照 `backlog` 恒 `null`，已计入 `degradation.affected` | 待 `knowledge_points` + `lesson_knowledge_points` 建表（P1）；`/api/knowledge-points` 现 404 |
| T3 | **S2 `skill_runs.parentSkillRunId`** | 库内**无 `skill_runs` 表**（现 13 基表 + 2 视图） | 待 P2 建表 `progress_feedback` / `skills` / `skill_runs` |
| T4 | **`schema.full.design.sql` 同步** | 该稿落后实际表：仍用废弃 `users`/`courses` 命名，缺 `uk_mistakes_text`、`self_check`、`block_kind`/`block_no`、`backfill` | 无外部依赖，可排期；建议整体重审后一次性动 |
| T5 | **`check_instance.py` 未落为受控文件** | 全仓**无此文件、无任何引用** | **归属待确认**（见第四节 A 角色第 4 条） |
| T6 | **契约描述单点化维护** | 判重键这类口径目前分散在 §11 / skills.md / schema / 实现四处，靠人工对齐 | 属长期治理，非紧急 |
| T7 | **快照 `currentCourseNo` / `currentLessonNo` 同名双写** | 两值恒等，**非 bug**；暂用断言保证，收敛议定在 P4 | 低优先级 |
| T8 | **历史文档时点数字** | `docs/plans/*`、`integration-report-01.md` 保留旧快照（mistakes 19 / pending 15 等），属历史记述 | **议定不追改**；待定是否在文件头加「时点快照」注记 |
| T9 | **第 7 课 `error_type` 未回填** | 🔄 **前置已解除**：Amy 已补齐 `records/exercise-error-types.json`（41 行，含第 7 课 7 行，非 NULL 12）；库内第 7 课仍 **0** | **只差授权**：跑 `db:apply-error-types`（→ 见 W3） |
| T10 | **第 7 课 `study_records` 缺失** | 🔄 **前置已解除**：Amy 已产出 `records/lesson-07.study-record.json`（attend / grade / feedback 三条，`feedback.nextRecommendation` **有真值**）；但该文件**无消费方** → 见 T12 | **只差写入路径拍板**（→ 见 W5 / P1） |
| T11 | **三项计数口径待统一** | 第 1—6 课是 seed 手工值（第 1 课 `exercise_count=7` 而子表只有 4 行），第 7 课起改「子表行数」口径 —— **两口径不同源** | 待 amy 拍板：① 保持现状（历史不动，新课用新口径）；② 全量重算并作废历史值。在拍板前后端**不会**动历史课 |
| T12 | 🆕 **`records/*.study-record.json` 无消费方（NEW-1）** | `db:import` 仅在 `syncGradeByType` 把 `byType` **UPDATE 进已存在**的 grade 行（`import_json.js:498/514`），**不 INSERT** 学习记录。实测库内 `study_records` = attend 6 / grade 6 / feedback 6，**无第 7 课** → 该文件落不了库 | **待拍板（P1）**：① 走 `POST /api/study-records` 逐条写；② **扩展 `db:import` 消费该文件（我推荐）**。选 ② 需定幂等键（建议 `(student_id, lesson_id, record_type)`）并明确「导入器该不该动 `progress` 表」 |
| T13 | 🆕 **§11.10 纵深防御（原 SK-1 答复衍生）** | 库列 `reading_questions.answer TEXT NULL`；导出器 `export_md_to_json.py:344` 缺 `<details>` 时**回落空串**（不是 NULL）→ 单加 `NOT NULL` 挡不住 | **待拍板（P2）**：① 只加库约束（**会直接打断导入流水线，不建议**）；② 库约束 + 导出器改「缺答案告警并跳过该篇」；③ 不做 |
| T14 | 🆕 **后端文档 3 处过时表述（GIT-7 我的份额）** | `backend/docs/01-architecture.md`：第 12 行「前端由 `build_board.py` 生成」、107 行「复用其解析规则」、180 行「过渡期两者并存」——该脚本**已删除**，三处全部失实。（同目录 `04-migration-and-roadmap.md` 3 处属历史记述、`db/migration/*` 与 `scripts/*` 3 处为注释，**均可留**） | 无外部依赖，可随手改（低优先级） |

---

## 四、需其他 agent 确认或配合的示意说明

> 本节已于 **2026-10-01 14:10** 对 `docs/Work Alignment/` 全部 5 份文档逐条核查（只读），结论固化如下；核查过程稿已并入本节并删除。

### A. Amy（教学侧）

| # | 交接事项 | 我的核查结论 | 状态 |
|---|---|---|---|
| A-1 | 12 处错词变更（8 UPDATE + 4 INSERT） | 已入库（实测 **4 insert + 13 update**；**数字口径与 Amy 记的 12 不同**，见 Q3） | ✅ |
| A-2 | `error_type` 回填第 1—6 课 10 题 | 实测第 1—6 课非 NULL = 2+1+1+2+3+1 = **10**，一致 | ✅ |
| A-3 | 回填 `is_correct`/`error_note`/`revised_answer` | **2026-10-01 已完成**（34/34、10、6） | ✅ **建议 A 方改状态** |
| A-4 | 历史 `error_count` 是否回改 | **已决：保留**；口径切换点 = 第 7 课，已写入 `04-migration-and-roadmap.md` | ✅ **建议 A 方改状态** |
| A-5 | G4 `lastIncomplete` | **代码已完备**（`cc73588` + D1/D1b/D1c）；仍缺数据 | ✅ 代码 / ⏳ 待数据 |
| A-6 | 重跑 `db:apply-error-types` | 未执行（文件已就绪：41 行 / 非 NULL 12） | ⏳ 等授权 → **W3** |
| A-7 | 重跑 `db:sync-mistakes` | 未执行（md 已改，库内 id=130 未改） | ⏳ 等授权 → **W4** |
| A-8 | 写 `study_records` 三条 | ⚠️ **发现管线缺口，不是「跑一下」就行** → **T12** | ⏳ **等拍板** |
| A-9 | 重跑 `db:summary` | **2026-10-01 已完成**，`stale=0` | ✅ **建议 A 方改状态** |
| A-10 | `:4000` 未运行 | 现已正常（health 200 / `database: up`） | ✅ 已解决（端口纪律见 P3） |

1. 🔴 **G4 闭环现在卡在后端，不再卡你** —— `records/lesson-07.study-record.json` 已产出且 `feedback.nextRecommendation` **有真值**，缺的是后端「消费方」（T12）。**等负责人拍板写入路径后我立刻执行**，连带解锁 §11.2 第 5 条「断更补课题量上浮」。
2. **`records/*.json` 约定请继续遵守**：一套题集一文件；错词本「错误点」只写错误形式、**禁括号批注**（批注入「错因」，否则会被 `uk_mistakes_text` 拆成两行 —— DQ1 的根源）。
3. 🟡 **请拍板 T11：三项计数口径是否统一**（第 1—6 课 seed 手工值 vs 第 7 课起子表行数）。**在你拍板前，历史课我一个数字都没动。**
4. 🟡 **G5 `studyMinutes` 数据源没打通（NEW-2）**：`lesson-07.study-record.json` 顶层有 `studyMinutes: 28`，但**三条 record 的 payload 都没带它**（后端白名单**已有** `study_minutes → studyMinutes` 映射）→ 是否并入 `attend` / `grade` 的 payload？**否则落库也拿不到数据。**
5. ✅ 无需再动：`docs/ai-teacher.md` §12.1 已更新为「后端 `db:summary`」；第 7 课「答疑」小节已降级为粗体行（该条 `SectionType` 告警应已消除，**未复跑验证**）。

### B. Skill 设计师

| # | 你的提问 | 我的答复（2026-10-01） |
|---|---|---|
| B-1 | `reading_questions.answer` 是否补 `NOT NULL`？ | **暂不补**。① 实测库内 28 行空值 **0**；② 导出器缺 `<details>` 回落的是**空串不是 NULL**（`export_md_to_json.py:344`），`NOT NULL` 挡不住；③ 真要纵深防御须**同时**改库约束 + 导出器改「缺答案告警并跳过该篇」，否则整批导入**报错中断** → 已登记 **T13**，等拍板 |
| B-2 | 确认 2.5 的 DDL 与文档描述一致？ | ✅ **确认一致**：`block_kind` enum('homework','backfill') NOT NULL、`block_no` smallint unsigned NOT NULL、`uk_exercise(lesson_id, block_kind, block_no, exercise_no)` 四列齐；`lesson_sections.section_type` 末尾确有 `backfill` |
| B-3 | G3 `backlog` 待 `knowledge_points` 建表 | 仍未建（库内 13 基表 + 2 视图，无该表）；**未排期**（P4） |

1. ✅ **W1／W2 我已自行收口，不必再等你们提交**：判重键四处一致（**B9**）、阅读答案必填两处对齐（**B10**）。
2. ⚠️ **但 W1 核出一处口径漂移（NEW-6，需你确认）**：`ai-teacher.md:619`、`skills.md:243`、`mistake.schema.json:58` **三处都写「规范化 `wrongText` ＋ `errorType`」**，而实现 `sync_mistakes.js` 的 `normKey()` 与库唯一键 `uk_mistakes_text(student_id, wrong_text)` 都**只按 `wrongText`**。
   → 若 Skill 按文档把「同 `wrongText`、不同 `errorType`」判为新条目放进 `newMistakes`，后端会按 `wrongText` 命中已有条目并转成 update，**两侧结果分歧**。
   → **建议：文档删掉「＋ `errorType`」，向实现对齐**（保持 `errorType` 纯人工判定、不参与判重）。属 Skill 契约层，**请你确认**。
3. ⚠️ **顺带发现（非你的文件，我只报告）**：`backend/docs/06-api-requirements-amy.md` 与 `docs/plans/*` 的需求状态表已过时 —— 例如仍把「R7 阅读接口」标为 P2（实则 `GET`/`POST /api/readings` 已开放），易被误判成后端缺口。建议一并刷新。

### C. 前端工程师（fe-dev）

**你对我的 5 项提问，答复如下（2026-10-01）**：

| # | 你的提问 | 我的答复 |
|---|---|---|
| C-1 | 后端上线时告知一次 | ✅ 已闭环（你的 `e2e-reading.js up` → 31/31） |
| C-2 | `/readings/stats` 的 `today` 时区口径 | **应用时区 +08:00 的本地日，不是 UTC**（`reading.service.js:281` → `todayAppTz()`；`datetime.js` 的 `APP_TZ_OFFSET_MINUTES = 8*60`）。`lastReadDate` 来自库内 `DATE` 列，同为本地日 → **`lastReadDate === today` 判定安全，F8 无忧** |
| C-3 | `/lessons` 全文搜索参数、`size` 上限 | **你的 T5 前提已过时**：`size` 上限 **2026-09-29 已由 100 放宽到 500**（`response.js:35` `maxSize=500`）；全量另有 `GET /api/lessons/all`（不受上限约束、字段不可精简、含 `grammarPoint`）。`q` 仍**只搜 `summary` + `grammar_point`**（`lesson.repository.js:20`）→ 全文搜索确实没做，但「>100 静默截断」不再成立 |
| C-4 | **C9** 阅读数据权威：`read/*.md` vs 库内 | **后端文档早有裁定，可直接闭环 I3**：`05-api-reference.md` §C9 —— **md 为准**（`read/*.md` 是作者源、库是副本；冲突走 `db:export → db:import` 收敛、**不手改库**）；**但经 `POST /api/readings` 写入的天以库为准**。判定规则：该日期有 md → md 为准；只在库 → 库为准 |
| C-5 | G3 / G5 的建表与降级字段进度 | G3 待建表（P4）；G5 **不只是排期 —— 数据源没打通**（NEW-2 / A-4 第 4 条） |

1. ✅ `review/*` 已全部 API 驱动；首页接 `/readings/stats.pieceCount` + title 的 `totalDays` —— **已实测** 47/47、**36/36**（你补回归断言后）全绿。
1.1 ✅ **`d868401` 复核已完成（2026-10-01 fe-dev 回执）**：原报告 —— `renderMarkdown` 段落终止条件与三个分支判定不同源，`---` / `**加粗**` 开头的行会让 `i` 不前进 → `out` 无限增长 → `RangeError: Invalid array length`，**课程详情页第 1—7 课全崩**；你做了最小防御性修复（谓词同源 + 强制前进兜底）。**fe-dev 结论：改法符合共享层设计意图，判定正确、无需返工**；fe-dev 已补 4 个 `renderMarkdown` 回归输入（`verify-frontend-shared.js` **35→36**），并在还原缺陷版的副本上负向复现 `RangeError at ui.js:272`，证明新断言有效。
2. 本轮快照**新增** `lastIncomplete.incompleteStep`（有值才带键）。**当前仍为 `null`**（缺数据），前端若消费请**走降级**，不要当成「上次没有中断」。**（2026-10-01 fe-dev 回执：前端当前未消费 `lastIncomplete`/`incompleteStep` —— `grep review/` 零命中，只消费 `lastRecommendation`，故暂无降级需求；待真要展示时再按此口径实现。）**
3. 若后续要改任何快照消费字段，请先知会我，避免两侧口径漂移。
4. ⚠️ **你改了后端文件 `backend/scripts/verify-frontend-shared.js`**（+4 个 `renderMarkdown` 输入 + 1 条「不死循环」断言，**未提交**）。**改动本身正确 —— 我已复跑确认 36/36**；但按文件级职责隔离，建议在 `_TEMP_`/本表登记一行，并明确提交归属（见 **Q5**）。

### D. Git 工程师 / 项目负责人

**我对你那份 `GIT-MANAGER-STATUS.md` 里「找后端」的逐条回复（2026-10-01）**：

| # | 你登记的事项 | 我的核查结论 |
|---|---|---|
| D-1 | **#3 G11**：`05-api-reference.md:389/412` 写 `firstCourseNo`/`lastCourseNo`，运行时返回 `firstLessonNo`/`lastLessonNo` | ⚠️ **异议：不是缺陷，是跨命名空间误判。** `firstCourseNo/lastCourseNo` 是 **AgentSnapshot 的命名**（`snapshot.service.js:67` 显式 `firstCourseNo: m.firstLessonNo` 映射），REST `/api/mistakes` 才用 `firstLessonNo/lastLessonNo`（`mistake.service.js:33`）。文档 **389 行在快照示例内、412 行在快照硬约束内，各自自洽**。**无需改代码**；我认领在 05 文档加一行「快照用 `*CourseNo`、REST 用 `*LessonNo`」的对照说明。**建议你把这行从「后端缺陷」改为「已澄清」** |
| D-2 | **#4**：库内 `wrong_text` **2 条**与规范不一致 | 实测**只剩 1 条**：id=130 `in office（缺限定词）`（随 **W4** 解决）。另两条含逗号者（`Now, My`、`now,liked my teacher`）是**正常错误文本**（逗号粘连类错词），非批注 → **第 2 条请指认（Q1）** |
| D-3 | **#5** `schema.full.design.sql` 未同步（落后 5 字段） | 属实，且仍用废弃 `users`/`courses` 命名 → **T4**，未开始（低） |
| D-4 | **#7** `build_board` 18 文件残留 | **后端份额已查清**：`backend/docs/01-architecture.md` **3 处真实过时**（第 12 / 107 / 180 行）→ 我认领（**T14**）；`04-migration-and-roadmap.md` 3 处属历史记述、`db/migration/*` 与 `scripts/*` 3 处是注释 → **均可留** |
| D-5 | **#8** `check_instance.py` 仍在 `.workbuddy/tmp/` | ⚠️ **异议：全仓不存在该文件**（`find` 排除 `node_modules` **零命中**，`.workbuddy/tmp/` 也没有）。请补路径证据或更正该行（**Q2**） |

1. **工作区当前还有一批未提交文件属其他角色**（截至 2026-10-01 12:40）：`docs/ai-teacher.md`、`docs/schemas/reading-set.schema.json`、`docs/skills.md`、`docs/plans/frontend-plan.md`、`notes/day-01-07.md`、`progress.md`、`wrong-words.md`、`review/{index.html,reading.html,assets/board.css,lessons/lesson.html,lesson-4.html,lesson-6.html}`、`skills/english-daily/{SKILL.md,references/course-template.md}`，另有 `read/2026-10-01-read.md`、`records/lesson-07.{grading,backfill}.json` 与 4 份各角色状态文档（`GIT-MANAGER-STATUS.md`、`SKILL-DESIGNER-STATUS.md`、`docs/status-amy.md`、`docs/前端工程师-工作状态.md`）。
   **我侧改动已全部提交（`d868401`、`cf07f29`、`a2bdd1b`），一个别人的文件都没碰**（职责隔离 + 显式路径）。
   > 🔧 **2026-10-01 git-manager 更正**：① 状态文档**已全部迁入 `docs/Work Alignment/`**，故上文 `docs/status-amy.md`、`docs/前端工程师-工作状态.md` 应读作 `docs/Work Alignment/status-amy.md`、`docs/Work Alignment/前端工程师-工作状态.md`（这两个旧路径**从未被 git 跟踪**）；② `records/lesson-07.study-record.json` 亦未提交（Amy 新增）；③ 清单权威版本见 `GIT-MANAGER-STATUS.md` §二（**24 个路径**，含归属）；④ 清单中 `review/index.html`、`lessons/lesson{,-4,-6}.html` **不是「他人未提交的内容改动」** —— 实测为**纯格式重排（与 `HEAD` 剥空白指纹一致）、零语义变更**，详见 `前端工程师-工作状态.md` §8.3 回执。
2. 建议：本轮收尾后可考虑打里程碑 tag（`db:compare` 15/0/0、mistakes 26 条、第 7 课入库闭环、三套测试全绿）。
3. **重踩过的坑已写进口径**：跑测试时若结果与预期不符，先怀疑「打到旧实例」—— 残留服务占着 4000 会让 `npm start` 静默 `EADDRINUSE` 失败，测试就全打在**改前代码**上。判定方法：看 `npm start` 日志 + 核对 `netstat` 的 PID。

---

## 五、`docs/Work Alignment/` 全目录核查结论（2026-10-01，**只读**）

> 按负责人要求对目录内 5 份文档逐条核查「需要 be-dev 配合的事项」。**本轮零写操作**（`db:apply-error-types` / `db:sync-mistakes` / `db:import` 一律未跑），**未修改或删除任何他人文件**；为核实前端「36/36」声明曾临时启动一次 5500 并立即停止（`:4000` 全程未动）。

**归属判定**：`be-dev-status.md`（本角色）／`status-amy.md`（Amy）／`前端工程师-工作状态.md`（fe-dev）／`SKILL-DESIGNER-STATUS.md`（Skill 设计师）／`GIT-MANAGER-STATUS.md`（git-manager）。

**指向 be-dev 的事项共 22 条**：✅ 9 条已完成/已答复（A-1/A-2/A-3/A-4/A-5/A-9/A-10、B-2、C-1/C-6）｜⏳ 3 条等授权执行（A-6/A-7 → W3/W4；A-8 → T12）｜❗ 2 条我的异议（D-1 G11、D-5 `check_instance.py`）｜其余为排期类。

### 5.1 本轮新发现

| 编号 | 发现 | 处置 |
|---|---|---|
| **NEW-1** | **`records/*.study-record.json` 无消费方** —— `db:import` 不创建学习记录 | → **T12**，阻塞 A-8 / G4 闭环 |
| **NEW-2** | **G5 `studyMinutes` 数据源没打通** —— 文件顶层有值，但三条 record 的 payload 都没带 | 需 Amy 决定并入哪条 payload |
| **NEW-3** | fe-dev 改了**后端文件** `backend/scripts/verify-frontend-shared.js`（未提交）；我复跑确认 **36/36**，改动正确 | 属跨职责，建议登记 + 明确提交归属（Q5） |
| **NEW-4** | `05-api-reference.md` §C9 尾句仍写「4 天 / 11 篇 / 22 题」（现 **5/14/28**） | 我的文档，可顺手修 |
| **NEW-5** | 前端 T5 前提过时（`/lessons` 的 `size` 上限早已放宽到 500，且已有 `/lessons/all`） | 已在 C-3 答复 |
| **NEW-6** | **判重键口径漂移**：文档三处写「`wrongText` ＋ `errorType`」，实现与库唯一键只按 `wrongText` | 建议文档向实现对齐（B 节第 2 条） |

### 5.2 需项目负责人拍板

| 编号 | 事项 | 我的建议 |
|---|---|---|
| **P1** | **A-8 走哪条写入路径？** | **② 扩展 `db:import` 消费 `records/*.study-record.json`**（与「records 是机读权威」一致、可重复执行、可 `--dry-run`）。需定幂等键（建议 `(student_id, lesson_id, record_type)`）并明确**导入器该不该动 `progress` 表** |
| **P2** | §11.10 纵深防御（T13）做不做？ | **② 或 ③**。只加库约束（①）会直接打断导入流水线，**不建议** |
| **P3** | **端口所有权**：本节文档写「4000/5500 唯一 owner = be-dev」，但本轮 `:4000` 由 Amy 启动 | **改为「谁跑测试谁起、跑完即停」并全员适用**。现有规则已多次引发「测试打到旧实例」的坑。**拍板后我同步改本文档与 `review/README.md` 类说明** |
| **P4** | `knowledge_points`（G3）与 P2 三表**是否排期** | 继续挂起（等教学侧有明确需求再建，避免建了不用） |
| **P5** | **跨职责文件占用规则**：本轮两例 —— 我改了 `review/assets/ui.js`、前端改了 `backend/scripts/verify-frontend-shared.js` | **允许但须登记**（现状），并加一条硬性动作：**跨职责改动必须在对方状态文档里登记一行**，否则对方不知情 |
| **P6** | **F-L7 第 7 课 `lesson-7.html` 死链** + T1 `lesson-1..6.html` 保留 | 支持前端「**1—6 保留不删**」的纠正（与我的实测一致）；F-L7 建议「**兜底链仅在目标存在时渲染**」而非补静态页（补页会再制造「静态页 vs 库内数据」双源），但该方案需后端/契约提供「该课是否有静态兜底」→ **是否做请拍板** |

### 5.3 待确认（信息不足，需对方补证据）

| 编号 | 待确认 | 缺什么 | 找谁 |
|---|---|---|---|
| **Q1** | D-2 所说「`wrong_text` 仍有 **2 条**」—— 我只能定位 **1 条** | 请指认第 2 条的 `id` 或原文 | git-manager |
| **Q2** | D-5 说 `check_instance.py` **仍在 `.workbuddy/tmp/`** | 请给实际路径（我全仓 `find` 零命中） | git-manager |
| **Q3** | A-1 记「**8 条** UPDATE」，我实测 **13 条** | 是「内容实际变化数」还是「SQL 影响行数」？ | Amy |
| **Q4** | `knowledge_points` 建表优先级与时间点 | 关系到前端 T2/T3 与我的 T2 | 负责人（并入 P4） |
| **Q5** | 前端 I2 把 `backend/scripts/verify-frontend-shared.js` 列入**其**待提交文件；该文件属后端 `scripts/`，且我已在 `cf07f29` 提交过一版 | 提交归属：由前端登记 + git-manager 提交，还是等我合并后续改动一起提？ | 负责人 |

---

## 六、Amy 回复确认与开工清单（2026-10-01 14:45，**只读核对，未改代码**）

### 6.1 Amy 拍板结果（已收，逐条落位）

| 项 | Amy 结论 | 我方处理 |
|---|---|---|
| **拍板 3** · `progress` 可写列 | **7 列** = `current_level` / `current_lesson_no` / `last_feedback` / `easy_streak` / `upgrade_frozen_until` / `last_class_date` / `note` | ✅ **接受更正**。我原列 4 列，确漏 `last_feedback`、`upgrade_frozen_until`（实测 `schema.sql:165-179` 属实）。我原提的「只前进不回退」**只保留在两列**：`last_class_date`、`current_lesson_no` 取 `max`；其余四列以**文件声明值为准**覆盖（`current_level` 必须可降、`easy_streak` 必须可清零） |
| 幂等键 `(student_id, lesson_id, record_type)` | 可用 | ⚠️ **不完全可用 —— 见 6.2-①**：库里 `study_records` **没有唯一键**，照搬 `ON DUPLICATE` 就是复刻 DQ1 |
| **拍板 1** · 第 1 步 | **放行**，附 4 条件 | 4 条件全部并入设计（6.3） |
| **拍板 2** · 第 2 步 | 两个都做，`POST /api/lessons` 先行 | 排期改为 Step 2a（lessons）→ Step 2b（错词批量） |
| **P2** | 只提前做「导出器缺答案 → 告警」 | 采纳（零风险、不改输出行为） |
| **P3** | 采纳，并补「起前确认 4000 为空」 | 采纳 |
| **P4** | `knowledge_points` 先不建 | 采纳（触发条件：要做「按知识点聚合错误率 → 自动排补漏序」） |
| **P5** | 追加「登记写自己文档、不改对方文档」 | ❌ **项目负责人已裁决忽略** —— `status-amy.md`（及本目录同类）是**全员配合文档**，各人可编辑与己相关内容。→ **规则维持原三条**，登记可写在相关状态文档里 |
| 契约缺口 | `study-record` 并入 `LessonRecord`，不单拆 | 采纳；**时点语义见 6.2-④** |
| 职责边界 | `sections`/`vocabulary`/`exercises` 由导出器产出 = **Skill 设计师的活** | 采纳。Step 2 的**真实调用方依赖 Skill 侧先改导出器**；我先按契约实现 + 自测，不阻塞 |

### 6.2 我复核出的 4 处需对齐（其中 2 处修正了 Amy 未核到的仓库事实）

| # | 事项 | 实测证据 | 我的建议 |
|---|---|---|---|
| **①** | 🔴 **`study_records` 无唯一键** —— `SHOW INDEX` 只有 `PRIMARY(id)` + `idx_records_time` + `idx_records_type`（均 `nonunique=1`）。照搬 `ON DUPLICATE KEY UPDATE` **永不命中**，重跑即翻倍 | 与 **DQ1 `mistakes`（19→38）完全同型**。现库 18 行（attend/grade/feedback 各 6），**当前无重复** | **默认：应用层显式 SELECT-then-write，不用 `ON DUPLICATE`**（零 DDL、立即可做）。**另建议**加兜底唯一键：`dedupe_key VARCHAR(64)` + `UNIQUE(student_id, dedupe_key)`（写 `lesson-07:grade`）—— 因 `review`/`reading` 可能是同课多值，`(…, record_type)` 不通用 → **是否需要这步请拍板** |
| **②** | **G5 无处落库**：`lessons` 表**没有** `study_minutes` 列；`lesson-record.schema.json:81` 注释写的 `courses.study_minutes` 指向**不存在的表** | Amy 说 `28` 是估计值、宁可不填 —— 但**现在根本无处可填** | **Step 1 不写 `studyMinutes`，G5 维持降级**；是否加列另立 DDL 议题 → **请拍板** |
| **③** | **`progress_feedback` 表不存在**（P2 阶段未建） | `schema.sql` 13 表清单中无此表 | Step 1 **只写 `study_records` + `progress`**，不扩范围 |
| **④** | **`records/lesson-07.study-record.json` 与 `LessonRecord` 形状不同**：`level` vs `levelCode`、`source` vs `sourceFile`、顶层 `records[]` vs schema 的**扁平** `feedback`/`gradeSummary`/`nextRecommendation`；且 schema `required` 含 `sections`（**不在 Amy 手上**） | 该文件**本来就不是 LessonRecord**，是「三条 record 的 payload 集合」 | **建议 Amy 暂不改该文件**（它是 Step 1 唯一的真实样本；且她改不出合法 LessonRecord）。Step 1 消费**现形状**，Step 2 消费 **LessonRecord**，两条路**共用幂等键、互不翻倍**。**时点语义答**：**顶层可空字段 + `status` 三值**（= schema 现状，**零改动**），不引入数组 |

### 6.3 开工范围、顺序与写入清单

**Step 1（无阻塞，可立即开工）** —— `records/*.study-record.json` 消费方

| 动作 | 文件 | 说明 |
|---|---|---|
| 新增 | `backend/db/migration/sync_study_records.js` | **纯 DB，不走 HTTP**（满足条件 4）；解析 `records/lesson-NN.study-record.json` → 幂等写 `study_records`（attend/grade/feedback）+ 更新 `progress` 7 列；支持 `--dry-run`、`--lesson NN`；**输出逐类「新增/更新/跳过/告警」计数**（条件 2）；**required 缺失 → 报错 + 非零退出**（条件 3），未知键仅告警 |
| 修改 | `backend/db/migration/import_json.js` | 全量路径调用该模块 |
| 修改 | `backend/package.json` | 加 `"teach:sync": "node db/migration/sync_study_records.js"` |
| DDL | **无** | 唯一键议题见 6.2-①（如采纳则单独 commit + 回滚 SQL） |

**回滚**：删新文件 + `git checkout -- backend/db/migration/import_json.js backend/package.json`（显式路径，禁 `git add -A`）。

**Step 2a** —— `POST /api/lessons` + `PUT /api/lessons/:id`（按 `LessonRecord` 契约，**契约不改**）
- 新增 `backend/src/{routes,controllers,services,repositories}/lesson-write*`；幂等按 `uk_lessons_no`
- **同 PR 同步** `backend/docs/05-api-reference.md`（接口唯一权威）
- 测试：`test:api` 加冒烟 + `write-api-check.js` 加用例（临时课 `TEST_LESSON_NO=90` + 零残留）
- ⚠️ **依赖**：真实调用方 = 导出器改产 `LessonRecord` 形状 → **Skill 设计师的活**；我先实现 + 自测
- 回滚：单文件 `git checkout`；无 DDL

**Step 2b** —— `POST /api/mistakes/batch`
- 建议范围：**只喂原始错词条目**（`wrongText`/`correctText`/`errorType`/`note`/`courseNo`），**不碰 `streak`/`status`**（由批改接口推进）；幂等复用 `uk_mistakes_text`；`error_type` **只接受 Amy 显式传入、后端不推导** → **需 Amy 确认范围**

**小步（随 Step 1 一起提）**
- `backend/db/migration/export_md_to_json.py`：`answer` 为空 → **告警 + 计数**（**不改输出行为**）
- 端口纪律措辞：本文档相关行改「**谁跑谁起、跑完即停**」+「**起前确认 4000 为空**」

### 6.4 需项目负责人拍板（3 项，均可默认放行）

| 编号 | 事项 | 我的默认动作（不拍板即按此执行） |
|---|---|---|
| **R1** | `study_records` 兜底唯一键（`dedupe_key`）做不做 | **先不做**，走应用层幂等；Step 1 跑通后再补 |
| **R2** | G5 `studyMinutes` 是否加 `lessons.study_minutes` 列 | **本轮不加**，G5 维持降级 |
| **R3** | Step 2b 错词接口范围 | 按 6.3 的「只喂错词条目」实现 |

### 6.5 执行结果（2026-10-01 15:05，**已实测**）

**① R1 已执行（DDL，独立提交）**

| 动作 | 结果 |
|---|---|
| 备份 | `backend/db/backup-20261001-before-dedupe-key.sql`（结构+数据 5,332 B，**未提交**） |
| 迁移脚本 | 新增 `backend/db/migration/add_study_records_dedupe_key.js`（幂等、可重放、`--dry-run` / `--rollback`） |
| 加列 + 回填 | `dedupe_key VARCHAR(64) NULL`；既有 **18 行全部回填**为 `lesson-<NN>:<record_type>`（无零填充 —— `LPAD` 位数超长会截断） |
| 校验 | 回填后按 `(student_id, dedupe_key)` **重复 0 条**，才加唯一键 |
| 加唯一键 | `uk_study_records_dedupe (student_id, dedupe_key)` |
| **实证** | 插入重复键 → `ERROR 1062 Duplicate entry '1-lesson-1:attend' for key 'study_records.uk_study_records_dedupe'` ✓（唯一键真的有约束力，不是摆设） |
| 重跑 | `MIGRATION_NOOP` ✓ |
| `schema.sql` 同步 | 已加列 + 唯一键 + 说明注释；**用一次性临时库重建并逐列逐索引比对 → 完全一致**，随后删除临时库 |
| 仓储层 | `studyRecord.repository.insert()` 新增**可选** `dedupeKey`（**不传 = NULL = 行为与改动前完全一致**）；新增 `findByDedupeKey` / `updateById` |

**② Step 1 已执行（`teach:sync`）**

| 项 | 实测结果 |
|---|---|
| 新增文件 | `backend/db/migration/sync_study_records.js`（**纯 DB 直连，不走 HTTP**；`import_json.js` 未改 —— 它不处理 study-record，`teach:sync` 是独立入口） |
| npm 脚本 | `teach:sync` 与 `db:migrate-dedupe-key`（均加在 `package.json`） |
| `--dry-run` | 通过：报告「新增 3 / 更新 0 / 跳过 0」，**且不写库**（18 → 18） |
| 正式执行 | `study_records` **18 → 21**；三条 dedupe_key = `lesson-7:attend` / `lesson-7:grade` / `lesson-7:feedback` |
| **幂等** | 重跑 → **新增 0 / 更新 0 / 跳过 3**，行数 21 → 21 ✓ |
| **payload 无损** | `grade` 的 `blankCount` / `backfillExerciseCount` / `backfillErrorCount` / `backfillByType` / `newMistakes` / `passedMistakes` **全部保留** —— 这些**不在** API 的 payload 白名单里，若走 API 会被静默丢弃，故 `teach:sync` **原样落库**（`records/` 是机读权威） |
| `progress` | `current_lesson_no` 6 → 7、`last_class_date` 2026-09-29 → 2026-10-01；**`note` 人工列未被触碰** ✓ |
| **缺字段报错**（条件 ③） | 合成样本（`grade` 缺 `errorCount` + `feedback` 值非法）→ 报错 2 项、**退出码 1、库内仍 21 行（零半截写入）** ✓ |
| **G4 闭环**（意外收获） | `/api/agent/snapshot.lastIncomplete` 由 `null` 变为有值（`{lessonNo:7, nextRecommendation:…}`）→ **G4 数据侧补齐** |

**③ P2 已执行**：`export_md_to_json.py` 在 `answer` 为空时输出告警 + 计数。
- 现状 `read/` **28 题 0 空答案** → 告警**正确保持沉默**（HEAD 版本本来就 `warnings=1`）；
- 合成样本（Q2 无 `<details>`、Q3 空 `<details>`）→ 正确输出「阅读题 answer 为空 2 题」+ 逐题定位 ✓；
- **数据零影响证明**：用 HEAD 版导出器重跑快照与改后版**逐字节完全一致** → 我的改动只多了 warnings，不改输出行为。

**④ 回归（全部实测）**

| 套件 | 结果 |
|---|---|
| `test:api` | **49 / 49** |
| `test:write` | **66 / 66**（F2 零影响：`study_records=21`，与同步自洽） |
| `integration-check` | **17 / 17** |
| `verify-frontend-pages` | **47 / 47**（修掉 1 条**滞后断言**，详见下） |
| `verify-frontend-shared` | **36 / 36** |
| `db:summary --check` | `stale=0` |

> ⚠️ **`verify-frontend-pages` 曾掉到 46/47 —— 是我的改动暴露了一条「依赖降级状态」的滞后断言，不是应用缺陷。**
> 原断言写死 `whyHTML === ''`，注释却写「`lastRecommendation=null` 时」—— 它成立的前提**正是「没有 feedback 记录」这个 G4 断链症状**。`teach:sync` 一落库，该块就按设计正常渲染 → 断言必然失败。
> 已改为**双向不变量**：接口 `lastRecommendation` 为 null → 整块不渲染；有值 → 必须渲染且含该文本。**这又是一例「断言禁写死环境状态」**（同 12 条雪崩断言）。

**⑤ `db:compare` 曾为 13 / 2 / 0（不是本轮引入，两处均为 Amy 侧待办）—— 已于 §6.6 全部关闭，现为 15/0/0**

| 差异 | 归因 |
|---|---|
| `lesson_exercises.error_type`：md 12 / 41 vs 库内 10 / 41（第 7 课 `homework#4`、`backfill#3` 库内为 null） | `records/exercise-error-types.json` **今日 11:07 被 Amy 改过（git ` M`）**，含第 7 课 2 条新映射 → **`db:apply-error-types` 尚未执行**（= 原 W4，**待授权**） |
| `mistakes.wrong_text` 集合：库内多 `in office（缺限定词）`，md 为 `in office` | 违反「**错误点只写错误形式、禁括号批注**」口径（批注应入 `错因`）→ 属既有数据缺陷 |

**归因证据**：`_snapshot.json` 是 **gitignored** 的本地产物，此前一直是**陈旧快照**，掩盖了这两处；我这次为跑校验重新生成了快照，于是把既有缺口照出来。**且已证明我的导出器改动数据零影响**（HEAD 版与改后版快照逐字节一致）→ **与我的改动完全脱钩**。

**⑥ 剩余未做**

- Step 2a（`POST /api/lessons`）/ Step 2b（错词批量）—— 未开工；前置约束见 §6.6 ⑤。

### 6.6 W4 与错词本对齐（2026-10-01 15:35，**已执行，`db:compare` 回到 15/0/0**）

**① W4 `db:apply-error-types`（Amy 已批准，已执行）**

| 步骤 | 实测 |
|---|---|
| 我先独立 dry-run 数行 | **2 行**：`L7 homework#4`（id=432）、`L7 backfill#3`（id=435），均 `is_correct=0`，均 `∅ → grammar` |
| 执行 | `更新 2 · 未变 39 · 定位不到 0 · 判定冲突 0` |
| **回传数字** | **`lesson_exercises.error_type` 非空：10 → 12** —— 与 Amy 预期**正好一致（=12）** |

**② `in office` 行对齐（Amy 口径：**让库对齐 md**，走 `db:sync-mistakes`，不手工 UPDATE）**

- 我先独立核对：`db:sync-mistakes --dry-run` → **新增 0 · 更新 1 · 未变 25 · 跳过 0**，且**这一行有 2 个字段同时变**：
  - `wrong_text`：`in office（缺限定词）` → `in office`
  - `error_reason`：追加 `（第 7 课补漏块第 3 题）`
- → **「只有 1 行」与「两处差异」均由我独立复现，与 Amy 的核对逐字一致。**
- 机制说明：匹配键 `normKey`（剥全角括号 + 折叠空白 + 小写）令库内旧格式能正配上 md，**两个字段被同一条 UPDATE 一起改掉**，无需分两步。
- 执行后复核：`id=130` 两列均已对齐；**全库 `wrong_text` 含括号的行 = 0**。
- **未走手工 UPDATE** —— 手工写绕过判重键检查，正是 DQ1 那类事故的入口。

**③ 摘要派生文件（Amy 提醒的坑，已避开）**

- `db:summary` → `INDEX.md` **UNCHANGED**、`digest.md` **UPDATED**（旧文本确实只残留在 digest 里）。
- 复核：`缺限定词` 在 `digest.md` / `INDEX.md` / `wrong-words.md` / 库内 **均为 0 处**。
- `db:summary --check` → `stale=0`。

**④ 回归（全部实测）**：`test:api` **49/49** · `test:write` **66/66** · `integration-check` **17/17** · `verify-frontend-pages` **47/47** · `verify-frontend-shared` **36/36** · `db:compare` **15/0/0**。

**⑤ Step 2 前置约束（Amy 两条提醒，登记在案）**

1. **2a 端到端依赖 Skill 侧产出 `LessonRecord`**：按契约（`lesson-record.schema.json:5`「daily-lesson 归档一步的产物」+ `docs/skills.md` §3.1 第 8 步、§2.3 `LessonRecord → POST/PUT /lessons`），**产出者 = `daily-lesson` 归档步**，不在后端。后端只做「**按契约实现 + 自测**」。
   ⚠️ 原措辞「导出器」有歧义（易被读成后端 `export_md_to_json.py`）—— **已于 §6.7 认账并澄清**。
2. **2b 必须写清 `wrong_count` 双源冲突**：错词本里的 `wrong_count` 是**人工判定**（含「无留档的复发」，如 `play game` 第 3 次），而 `review` 接口会**自动 +1**，两个来源会打架。
   **约定：batch 传入的人工值为准（覆盖写）；`review` 只做增量，并对「自动值 ≠ 人工值」逐条告警。**
   → 2b **尚未实现**，故**不预先写进 `05-api-reference.md`**（该文档只记已实现接口）；先在本文档登记，**实现 2b 时同步写入 05**。

### 6.7 与 Skill 设计师的边界澄清（2026-10-01 16:50）

**① 我的措辞有歧义 —— 认账。** §6.6 ⑤ 里的「导出器」是我对「产出 `LessonRecord` 的那一环」的口语说法，但它与后端文件名 `export_md_to_json.py` 撞名，被合理读成「让后端导出器改产 `LessonRecord`」。**我的本意是前者。**（§6.6 ⑤ 措辞已改。）

**② 事实核对：她的三条主张我逐条验证，全部成立**

| 她引的 | 我的复核 |
|---|---|
| `lesson-record.schema.json:5`「daily-lesson 归档一步的产物」 | ✅ 原文如此；同句还有「**笔记 md 是本对象的一种落地形式，不是真相源**」 |
| `docs/skills.md` §3.1 第 8 步「归档：追加写笔记；写 `LessonRecord`」 | ✅ `skills.md:311`；输出表 `lessonRecord: LessonRecord`（归档产物）见 `:278` |
| `skills.md` 曾用废弃命名 | ✅ 已订正为 `lessons`/`lesson_sections`/`lesson_exercises`/`lesson_id`（`:196` 有注记）；`05-api-reference.md` 全文只有 `/api/lessons*`、**无 `courses`** → 订正方向正确 |
| `export_md_to_json.py` 在 `backend/**`、属她职责界外 | ✅ 属实（且我本轮确实改过它，为 P2 告警） |

**③ 我的裁决建议：①**（与她的倾向一致）

- **① 是契约已写明的路径**（§3.1 第 8 步 + §2.3 映射表 + `schema:5`），不违反「Skill 不解析 md 散文」铁律。
- **② 我明确反对**（不只是「非最优」）：把 `export_md_to_json.py` 改成产 `LessonRecord`，它就从「历史一次性回填工具」变成**第二个产出者**，与 Skill 归档步**双源**。且它当前语义是「**md 派生** → `_snapshot.json`」，与 `schema:5` 的「**md 是本对象的落地形式**」**方向正好相反**。
- **③ 不必要**：历史 1—7 课**已在库里**（`db:compare` 15/0/0），无需为历史再造 `LessonRecord`；且 A/B 切换的验收口径是「同一课两阶段产出的 `LessonRecord` **逐字段一致**」（`skills.md:1303`）—— 若历史走导出器、新课走 Skill，**同一课就有两个产出者**，这条验收直接失效。

**④ 我补一条她未提、但比 ①/②/③ 更该先定的：写路径切换后的「双写」规则**

`POST /api/lessons` 上线后，**同一课会有两个写手**：

| 写手 | 链路 | 落哪三张表 |
|---|---|---|
| API 路径 | Skill 归档步 → `POST /api/lessons` → DB | `lessons` / `lesson_sections` / `lesson_exercises` |
| 迁移管线 | md → `db:export` → `_snapshot.json` → `db:import` | **同上三张** |

**两者写同一批表** → 必须定切换口径。我的倾向：
- **切换点 = 第 8 课**；第 8 课起 **md 不再是写路径的输入**，`db:export` / `db:import` **退化为「历史回填 + 只读校验」**（`db:compare` 保留为只读验收器）。
- 或给 `db:import` 加守卫：**已由 API 归档的课不再 import**（需要可判定标记 —— `lessons.status` 两边都会是 `archived`，**不足以区分**，需另设字段）。
- ❓ **需负责人 + Skill 设计师共同拍板**：阶段 B 里 md 是「**仍产出、但不入库**」还是「**不再产出**」？这直接决定 Skill 归档步要不要保留「写 md」。

**⑤ 顺带发现一处残留（她的文件，我只报不改）**

她订正了 §2.3 / §6 / §4.2，但**这两处仍写 `courses.study_minutes`**：`docs/skills.md:1162`（G5 缺口行）、`docs/schemas/lesson-record.schema.json:81`（`studyMinutes` 的 description）。而 `courses` 表**不存在**、`lessons` 表**也没有 `study_minutes` 列**（实测）→ 与 R2 是同一处陈旧引用，**修的时候两处一起修**。

### 6.8 回应 Skill 设计师（2026-10-01 17:30）—— 双向复核 + 两处新发现

**① 她的两处修复：实测已落地 ✓**

| 位置 | 现值（实测） | 结论 |
|---|---|---|
| `docs/skills.md:1162`（§4.2 G5 行） | 「学习时长 `study_minutes` 由谁填未定（**当前无落库列**：`courses` 表已废弃、`lessons` 表亦无此列）」 | ✅ 已订正 |
| `docs/schemas/lesson-record.schema.json:81` | 「…当前无落库列（`courses` 表已废弃、`lessons` 表亦无 `study_minutes` 列）——G5 维持降级；是否新增 `lessons.study_minutes` 列属 R2 议题，未定前列空。」 | ✅ 已订正 |

她的旁证亦属实：`schema.sql` **13 张表、`courses` 0 命中**（实测）。其状态文档（行 12 / 行 H / §五 / §四）已同步，**未越界动他人文件**（她自述不改 `backend/**`、`review/**`、`docs/ai-teacher.md`），边界正确。

**② 但复扫全库：同型残留还有 2 处 —— 她的修复不完整**

| 位置 | 残留 | 归属 |
|---|---|---|
| `docs/skills.md:575` | `recentLessons[].vocabulary` → 「`vocabulary` + **`course_vocabulary`**」（现表名 `lesson_vocabulary`） | **她自己的文件**；本轮 §2.3/§6/§4.2 订正**漏了这一行** → 建议**随同一批未提交改动一起补**（尚未提交，成本为零） |
| `docs/ai-teacher.md` **23 行** | 整套废弃命名：`courses` / `course_sections` / `course_vocabulary` / `course_knowledge_points` / `GET /courses/latest` / `POST /courses` / `PUT /courses/:id`（行 `198-213`、`246-247`、`259`、`262`、`265-266`、`277`、`281`、`303`、`451`、`470-471`、`490`） | **Amy 权威文档**（她已声明不改该文件）→ **交接 Amy** |

⚠️ **关键判断：镜像修了、源头没修。** `skills.md:1415` 自述「核对时暴露本文件仍用废弃路由与表名…随本次一并订正」，但**同一批命名在权威侧 `ai-teacher.md` 里原样存在**（含 §5.3「对齐 `POST /courses` 契约」这类**指向不存在端点的活描述**）。按 §11.9 的单一来源原则，**源头不清、镜像先清 = 修反了方向**。其中 `:265` / `:490` 的 `courses.study_minutes` 正属本议题（`:265` 还写着「（已有字段）」，双重失实）。

**③ 更正一处过时陈述：W1/W2 已不再「被 `docs/skills.md` 提交卡住」**

她（及 `SKILL-DESIGNER-STATUS.md` §1.2 末注）称「`docs/skills.md` 正是 be-dev §二 W1/W2 的卡点」。**该依赖已解除**：我在 **B9/B10**（本文档第一节，2026-10-01）改为**直接核内容** —— 判重键四处一致、阅读答案必填两处对齐 —— **W1/W2 已自行收口，不依赖任何提交**。
→ 请 git-manager **不必为后端排这项阻塞**；她的文件仍可提交，但**理由不再是「解锁 be-dev」**。

**④ 双写口径：同意她两点，对 `write_source` 给取舍意见**

- 同意「**切换点 = 第 8 课**」；同意「阶段 B 的 md **仍产出、不入写路径**」（留住 git 可 diff 的人类可读存档，`notes/day-08-14.md` 不断档）。
- 对「`status` 不足以区分」的解法：过渡期**课号阈值（≥8 走 API）已足够**。`lessons.write_source ENUM('import','api')` **不建议现在加** —— ① 加列要走 DDL 规程（备份可重放 + 单 commit + 回滚 SQL）；② 现有 `status` 语义是「课的生命周期」、**不是写入来源，不可复用**；③ 只有出现「历史课被 API 重写」这类**真实需要**时再加。**若负责人要加，我按规程执行**（新 ENUM 值追加末尾）。
- 我另加一条**零 DDL 的守卫**：`db:import` 加 `lesson_no ≥ 8 → 跳过并告警`；**仅当这条也做不到**时才需要 `write_source`。

**⑤ 待负责人拍板（双方已对齐，只差一句话）**

1. **2a 归属 = ①**（Skill 归档步产出 `LessonRecord`）—— 双方一致（我 §6.7 ③、她 §二）；
2. **双写口径** = 切换点**第 8 课** + 阶段 B md **「仍产出、不入写路径」** —— 双方一致；
3. 🆕 **请 Amy 侧**处理 ② 里的 `ai-teacher.md` **23 行废弃命名**（与已登记的「6 处旧数字」合并成一次文档刷新）。

---

### 6.9 Step 2a 开工与实测（2026-10-01 18:00，**已实现并实测**）

**负责人拍板（逐字）：`1 确认 2 确认`** → ① 2a 归属 = ①；② 双写口径 = 切换点第 8 课 + 阶段 B md「仍产出、不入写路径」。**据此开工，已完成。**

**新增接口（契约不动，仅补齐 Skill 契约 `LessonRecord` 的写入落点）**

| 接口 | 行为 | 关键约束 |
|---|---|---|
| `POST /api/lessons` | 按 `LessonRecord` **新建**课程归档，单事务写 **4 张表**（`lessons` / `lesson_sections` / `lesson_exercises` / `lesson_vocabulary`+`vocabulary`） | 课号已存在 → **409**（防覆盖）；字段级 400 |
| `PUT /api/lessons/:id` | **部分更新**（只写 body 出现的列），回填批改与反馈 | 不存在 → **404**；**`:id` 是 `lessons.id` 主键、非 `lessonNo`** |

**落库要点**
- `error_type` **刻意不写**（只由 Amy 人工判定，`skills.md` 3.6）—— 写入路径不得推导。
- 计数回写（`vocab_count`/`exercise_count`/`error_count`）**仅对 `lessonNo >= 8`**（`WRITE_API_FROM_LESSON_NO`）；历史课 99/99/99 保护不变。
- 契约内但**无落库点**的字段（`studyMinutes` / `knowledgePoints` / `skillRunIds`）收进响应 **`warnings`**，**不静默丢弃**。
- ID 序列改用 `EXERCISE_TYPE` 单一来源（`src/constants.js`）。

**双写守卫（零 DDL）**：`db:import` 对 `lesson_no >= 8` **整课跳过**并告警，退化为「历史回填 + 只读校验」。

**实测（当前代码，非声明）**

| 项 | 结果 |
|---|---|
| `test:api` | **49 / 49** |
| `test:write` | **99 / 99**（66 → 99，新增 **LW1—LW33** 共 33 条：契约→四表落库、`warnings`、`error_type` 不写、`selfCheck`/`blockKind`/`blockNo`、409 不覆盖、400 字段级、PUT 不抹字段、`<8` 不回写计数、404 含跨学生） |
| F2 零影响 | 一致：`students=1 lessons=7 vocabulary=61 lesson_vocabulary=62 mistakes=26 study_records=21 lesson_exercises=41 lesson_sections=60 readings=5 reading_pieces=14 reading_questions=28` |
| `db:import --dry-run` | 全表 **±0**；守卫输出 `写路径已切 API 跳过 0`（现快照 7 课） |
| 守卫触发实证 | 合成「含第 8 课」快照 → `写路径已切 API 跳过 1` + `! 第 8 课 >= 8：…本脚本跳过，不写库`，子表仍 **±0**（第 8 课未落库） |

**前端三项（4000 空闲后已补跑，2026-10-01 18:05）**

| 项 | 结果 |
|---|---|
| `integration-check`（jsdom + 真打后端） | **17 / 17** ✅（首次跑 10/15 假失败 —— 见下「竞态发现」，复跑即全绿） |
| `verify-frontend-pages`（Playwright + 本机 Edge） | **47 / 47** ✅ |
| `verify-frontend-shared`（Playwright + 本机 Edge） | **36 / 36** ✅ |
| `db:compare`（跑完复核） | **15 / 0 / 0** ✅ |
| 13 表计数（跑完复核） | 与 F2 基线**逐项一致、零漂移** |
| 服务收停 | 后端 4000 / 静态 5500 / 4010 **全部已释放**（跑完即停） |

**⚠️ 竞态发现（`integration-check.js`，本次实测暴露，未改脚本）**：首跑报 5 项假失败（`statLevel` / `statVocab` / `statMistakes` / 卡片数 / 课程文案 均为 `…` 或空），但**同一次运行里 8 个请求全部命中、无 JS 错误**；复跑 17/17。
根因：脚本的 `waitFor()` **只等 `#statLessons` 非 loading 即返回**（`integration-check.js:100-103`），其余统计卡尚未回填就进入断言 → **时序相关假失败**。
→ 是**验证脚本自身的缺陷**，非页面/接口回归（四个接口直连均正常：`progress=Level 2`、`vocabulary/stats.total=61`、`mistakes/stats={total:26,pending:20,passed:6}`、`lessons/all` 返第 7 课）。
→ **建议**（待授权再动）：把 `waitFor` 条件改为「四张统计卡全部非 `…`」；属 `backend/scripts/` 自域，但会改变既有验证基线语义，**故先报不动**。

**文档**：`backend/docs/05-api-reference.md` 已补 变更记录第五批 / 接口清单 28—29 / **§28·§29 详情** / **§5.1 写路径切换口径**。

**未提交**：本轮改动（`backend/` **8 文件** = 7 代码 + `05-api-reference.md`，另加记忆/状态文档）仍 uncommitted，等 git-manager 授权。

---

### 6.10 回执 Amy 的 A12 / A13 / A14（2026-10-01 18:10）

**背景**：Amy 完成 `docs/ai-teacher.md` 一次性刷新，并就 Step 2a 提出 **A12 / A13 / A14**（`status-amy.md` §4.1）。逐条回执：

#### A14 · 请重启自测后回执 → ✅ **已重启自测，回执如下**

Amy 观察「`GET /api` 索引里**没有** `POST /api/lessons` / `PUT /api/lessons/:id`」→ 她据此判「已交付待重启」，**判断正确、且正是重启前实例所致**：

| 证据 | 值 |
|---|---|
| 索引来源 | `backend/src/routes/index.js` **`:67-68`** 早已含 `'POST /api/lessons'` / `'PUT /api/lessons/:id'` |
| 重启后 `GET /api` 实测 | **含这两条**（索引 `endpoints[]` 28 条 **+ `GET /api` 自身 = 29 接口**） |
| 滞留实例成因 | `PID 25088` = `node src/server.js`，`CreationDate 08:55:40` → 早于我最后一次改动 `17:39` ⇒ **跑的是改动前代码** |

→ **Step 2a 状态由「已交付待重启实证」升为「已生效」**。重启后**全部实测**：`test:api` 49/49 · `test:write` 99/99 · `integration-check` 17/17 · `verify-frontend-pages` 47/47 · `verify-frontend-shared` 36/36 · `db:compare` 15/0/0 · 13 表零漂移 · 快照 `lastIncomplete` 非 null。
（端口纪律：只用**我方**起的 4000/5500 实例，跑完即停；未动他人进程。Amy 不代重启的判断**正确**。）

#### A12 · `snapshot.service.js` 注释与降级文案过时 → ✅ **已修正并实测**

**她报的两处均属实**，且**根因同一类**：把「全局结论」写死在代码里，数据一变就失真。

| 位置 | 原（过时） | 现（实测） |
|---|---|---|
| `:104` 注释 | 「库内暂无 payload 带 `nextRecommendation`，故当前**恒为 null**」 | 「仅在无 `feedback` 记录时才为 null；2026-10-01 `teach:sync` 回填后已有值 → **G4 已关闭**」 |
| `:120` 降级文案 | 「…待 `knowledge_points` 建表**与教学侧写入 nextRecommendation** 后自动补齐」 | **改为按实际 `affected` 逐项生成**（新增 `DEGRADE_HINT` 映射表） |

**实测前后对照**（`GET /api/agent/snapshot`）：
- 前：`affected=["backlog"]` 但 `reason` 仍提 `nextRecommendation`（**自相矛盾**）
- 后：`reason = "以下字段暂无数据来源，已降级返回：backlog（待 knowledge_points 建表）"`、`affected=["backlog"]`、`lastRecommendation`/`lastIncomplete` **均非 null**

**为什么不只改字符串**：硬编码文案是**可复发的缺陷类**（下次回填 `knowledge_points` 又会失真）。改为逐项生成后，新增降级字段只需补 `DEGRADE_HINT` 一条。回归验证：`test:api` **49/49**、`test:write` **99/99**（无测试断言依赖该文案，故安全）。

**同步刷新 `05-api-reference.md`**：§21 实测样例刷新为 **2026-10-01 实况**（课号 7 / `2026-10-01` / `affected:["backlog"]` / 两字段非 null / 去掉 DQ4 脏值键的正确写法），「降级项」段从「三字段仍缺」改为「**只剩 `backlog`**」+ 写明「`reason` 逐项生成、勿改回硬编码」。新增**第六批**变更记录。

#### A13 · `self_check` 空心 / G-2 正名 → ✅ **确认她的结论，无异议**

- 三层链路（表列 → 契约 → 接口）**已闭合**（`c735bbd`）；`lesson_exercises.self_check` 实测 **0/41 非空** ⇒ 缺口在**上游落库未带**，非 API 丢字段。
- **前端代号 `G-2`**，与 `F-L7`（`lesson.html` 渲染 `lesson-7.html` 的**死链**）**同源但两个缺陷** —— 她订正「原稿误记 F-L7」正确。
- **归属教学侧**（Amy 每课写自查项）：同意。**`self_check` 历史 41 行是否回填** —— **同意她的建议：不回填**（历史 md 本无该数据，硬补＝编造；第 8 课起新数据必带）。此条属**教学侧口径**，后端不干预。

#### ✅ A15 撤回为「复核」· 判重键口径漂移 = **已登记的 NEW-6**（非新发现），但**影响面比 NEW-6 记的多**

**自查纠正**：我起初将其当作新发现（A15），核对后确认**本文档 §5.1 `NEW-6` 早已登记**该漂移（`B9` 亦注明「发现一处口径漂移，见 NEW-6」）。**撤回「新报」，改为精确化复核** —— 我手上有 NEW-6 当时缺的两样东西：**库内硬证据**与**逐处行号**。

**硬证据（NEW-6 当时未附）**：
```
SHOW INDEX FROM mistakes  →  UNIQUE KEY `uk_mistakes_text` (`student_id`,`wrong_text`)   ← 不含 error_type
```

**影响面精确清点：WRONG 的「`wrongText` + `errorType`」实为 4 处（NEW-6 记「三处」，漏 1 处）**

| # | 位置 | 现文 | 判定 |
|---|---|---|---|
| 1 | `docs/skills.md:245` | 「判重键为规范化后的 `wrongText` **+ `errorType`**」 | ❌ 与库不符 |
| 2 | `docs/skills.md:877`（§3.7 执行流程第 1 步） | 「判重键 = 规范化后的 `wrongText` **+ `errorType`**」 | ❌ |
| 3 | `docs/skills.md:888`（§3.7 规则表首行） | 「规范化 `wrongText` …**+ `errorType`**」 | ❌ |
| 4 | `docs/schemas/mistake.schema.json:58` | 「的 wrongText **加 errorType**」 | ❌ |

**正确的三方**（含权威源，✅ 无需改）：`docs/ai-teacher.md:638`（**权威**，只写 `wrongText`）、`docs/ai-teacher.md:703`（引 `uk_mistakes_text(student_id, wrong_text)`）、`docs/schemas/common.schema.json:104`（已订正）。
→ **即 `skills.md` / `mistake.schema.json` 是镜像侧漏改**；权威侧 `ai-teacher.md` 本就正确。**建议**：四处删去 `+ errorType`，向 `wrongText` 对齐。**归属 Skill 设计师/Amy 域，我只报不改。**

> ⚠️ **附带（Step 2b 直接相关，非缺陷）**：库唯一键建在**原始列** `wrong_text` 上，而契约要求「规范化后」判重 ⇒ **规范化必须在应用层写入前完成**。「in office（缺限定词）」vs「in office」在库内是两行 —— 即 DQ1 实例。**Step 2b 实现时必须先规范化再 upsert**，且要在 `05` 写明该顺序。
> 另注：`docs/plans/backend-plan.md:620` 写「判重键 = 规范化 **`correct_text`** + `error_type`」—— 字段名与库均不符，属**历史计划稿**（未执行注释），优先级低。

---

### 6.11 Step 2b 开工前的口径分叉（2026-10-01 18:15，**待拍板，未写码**）

**背景**：负责人转达「Step 2b（`POST /api/mistakes/batch`）未开工，**无大问题后可开工**」。我做开工前核对，**发现「大问题」——同一接口在两份文档里名与形都不同**，按 §二.8 铁律「同一指标出现两个口径 → 先问口径，别改数」，**暂停待裁**。

#### 分叉一：接口名

| 出处 | 写法 |
|---|---|
| `docs/skills.md:190`（§2.3 契约↔接口映射） | **`POST /mistakes`** — `MistakeAnalysisResult` → `POST /mistakes`、`POST /mistakes/:id/review` |
| `docs/skills.md:1203`（§6 接口清单） | **`POST /mistakes`** — 消费方 `mistake-analysis`，用途「发现新错词」 |
| 我的记忆（`Step 2b` 条） | **`POST /api/mistakes/batch`** |

→ **镜像侧两处均为 `POST /mistakes`、无 `batch` 字样**；`/batch` 只见于我方笔记，**无文档出处**。我倾向 **`POST /api/mistakes`**（去 `batch` 冗余限定词、与镜像一致），但**这是公共契约名 + Skill 侧依赖，不自作主张**。

#### 分叉二：载荷形状

| 出处 | 写法 |
|---|---|
| `docs/skills.md:190` / `mistake.schema.json` | 喂 **`MistakeAnalysisResult`**（含 `newMistakes` + `updatedMistakes[{after}]` + `events` + `patternHits` + `recurrenceWarnings`） |
| **R3 已达成口径**（`2026-10-01.md` 十四节；Amy 同意） | **「只喂原始错词条目」** —— 只传原始条目，`before/after` 全状态与 `patternHits` 等**由服务端派生或忽略** |

→ 二者**不兼容**（前者要求客户端算好 `after` 全状态，与「人工判定、禁推导」的 R4/R3 精神相悖）。R3 是**后出的明确决定**，且更符合 `error_type`/`wrong_count` 只由人工判定的铁律 → **我按 R3「只喂原始条目」实现**，并把 §2.3 映射表同步订正（属 Skill 设计师域，我只提）。

#### 分叉三：`wrong_count` 双源（R3 已裁决，实现需照做）

R3 原文（Amy 侧）：「`wrong_count` 在我错词本是**人工判定**（含「无留档的复发」，如 `play game` 第 3 次），而 `review` 接口会自动 +1 → 需定**人工值为准、`review` 只增量并对差异告警**」。
→ **接口说明必须写明**（`05` §30）：批量写入时 `wrong_count` **以人工值为准覆盖写**；`POST /mistakes/:id/review` **只做 `+1` 增量**，且当「自动累计值 ≠ 人工值」时**逐条告警**（不静默改写人工判定）。

#### 我拟定的设计（**待你放行即开工**）

- **`POST /api/mistakes`**（若裁定用 `/batch` 则改一处路径常量）——单事务、**幂等**。
- 载荷：`{ lessonNo, items: [{ wrongText, correctText, errorType, errorReason?, wrongCount, streak?, status?, courseNo? }] }`。
- 落库：**先规范化 `wrongText`**（去标点/去空格/统一小写）→ 按 `uk_mistakes_text(student_id, wrong_text)` upsert；命中则更新、未命中则新建。
- **`error_type` / `wrong_count` 一律取自入参、绝不推导**（`skills.md` §3.6）。
- `wrongCount` **覆盖写**；响应带 `{created, updated, unchanged, warnings[]}`。
- 同步写入 `05` **§30**（含分叉三的告警口径）+ `routes/index.js` 索引 + `write-api-check.js` 用例。
- **先决检查已做**：`uk_mistakes_text` 唯一键**确实存在**（§6.10 硬证据）→ upsert 不会退化为普通 INSERT，**满足幂等铁律**。

→ **请你裁两件**：① 接口名（`/api/mistakes` 还是 `/api/mistakes/batch`）；② 载荷按 R3「只喂原始条目」是否照准。**裁完我即开工**，不等其它。

---

### 6.12 Step 2b 完成：`POST /api/mistakes`（2026-10-01 19:05，**已实现并实测**）

**负责人裁定（逐字）**：`接口名：POST /api/mistakes` + `照准`（载荷按 R3「只喂原始错词条目」）。
→ 按此实现，**两个分叉均已闭合**。

#### 交付

| 项 | 内容 |
|---|---|
| 新接口 | **`POST /api/mistakes`**（批量写入错词本条目），接口总数 **29 → 30** |
| 载荷 | 错词本 **8 列**（`wrongText`/`correctText`/`errorType`/`wrongCount`/`errorReason`/`streak`/`status`/`courseNo`）+ 顶层 `lessonNo`；`items` 1—200 条 |
| 落库 | 判重命中 → 更新 7 个内容列；未命中 → 新建（`first_lesson_id = last_lesson_id = courseNo`） |
| 新增文件 | `src/utils/mistakeKey.js`（`normKey` **唯一实现**） |

#### 四条硬设计（均有测试锚定）

1. **判重键单一来源**：`normKey`（去全角括号批注 → 折叠空白 → 转小写）从 `sync_mistakes.js` **上移**为共享模块，写接口与迁移器**共用同一份**；顺手把 `sync_mistakes.js` 的 **2 处内联枚举**（`ERROR_TYPES`/`STATUSES`）收归 `src/constants.js`，并让两处共用 `MISTAKE_CONTENT_COLS`。
   → 意义：两条「错词本 → 库」路径对「同一行」的判断**逐字一致**，从根上堵住 DQ1 那类"两套口径"。
2. **落库写原始文本、规范化只用于找行**：库唯一键 `uk_mistakes_text(student_id, wrong_text)` 建在**原始列**上 ⇒ 判重只能在应用层做；MW2/MW4c 断言"存的是本次原文，不是规范化结果"。
3. **人工值为准 + 差异逐条告警**：`wrong_count` 以入参**覆盖写**；库内自动累计值 ≠ 人工值 → `warnings` 逐条记明（MW6/MW6b/MW6c）。`POST /:id/review` 仍是**纯 `+1` 增量**，不覆盖人工判定。
4. **🆕 DQ1 守卫（我自己加的，非点名项）**：`wrongText` 含全角括号批注 → **400**。
   → 理由：错词本硬规范是「错误点只写错误形式本身」；若写接口原样落库，批注就会进 `wrong_text`，将来被唯一键**拆成两行** —— 正是 DQ1 的成因。MW5/MW5b 锚定。
   另：**批内规范化同键 → 400**（MW12，不静默取一条）；**`error_type`/`wrong_count`/`streak`/`status` 一律取入参、绝不推导**（MW7）。

#### 实测（**非声明**）

| 项 | 结果 |
|---|---|
| `test:write` | **123 / 123**（99 → 123，新增 **MW1—MW16 共 24 条**断言） |
| `test:api` | **49 / 49** |
| `db:compare` | **15 / 0 / 0** |
| F2 零影响 | 13 表计数与基线**逐项一致**（`7/61/62/26/21/41/60/5/14/28`） |
| **`db:sync-mistakes --dry-run`** | **行为不变**：未变 26 · 跳过 0 · 告警 0（重构未改语义） |
| 路由已加载 | `GET /api` 索引含 `POST /api/mistakes`，**29 条 + 自身 = 30 接口** |
| 端口纪律 | 只用我方实例，跑完即停，4000/5500 均已释放 |

#### 仍待（**只报不改，属 Skill 设计师/Amy 域**）

1. `docs/skills.md:190`（§2.3）把 `MistakeAnalysisResult` 映射到 `POST /mistakes` —— **载荷口径已改为 R3「只喂原始条目」**，该行需同步（并说明不再传 `before/after`/`patternHits`/`recurrenceWarnings`）。同段注里「`POST/PUT /lessons` 为 **Step 2a 待实现**」亦已过时（Step 2a 已生效）。
2. §6.10 的 **A15 复核**（判重键 4 处漏改）仍待处理。
3. ~~`db:sync-mistakes` 与写接口**均不改 `first/last_lesson_id`**（命中时）~~ → **已由 Amy 裁定（§11.11），见下 §6.13**。

---

### 6.13 回执 Amy 的 A15 / A16 / A17（2026-10-01 21:40，**A15/A16 已实现并实测；A17 只报可行性**）

**来源**：`docs/ai-teacher.md` §11.11（2026-10-01 裁定）+ `status-amy.md` §1.10 / A15—A17。
裁定逐字：`first_lesson_id` **冻结**、`last_lesson_id` **随复发刷新**（`max` 单调守卫、
两条路径同批改、历史不回填）。

#### A15 / A16：`last_lesson_id` 随复发刷新 —— 已实现

| 项 | 内容 |
|---|---|
| 新增文件 | **`src/utils/mistakeLesson.js`** —— `resolveNextLastLessonId()`（定则**唯一实现**，两条路径共用）+ `buildLessonMaps()` |
| 定则 | `first_lesson_id == null` → 整体跳过（「诊断」来源不补填）→ 本次课号不可知 → **不改**；课号在库内不存在 → 不改；否则 `本次课号 > 现有课号` 才刷新（**严格大于**，相等即幂等） |
| 比较基准 | **按课号（`lesson_no`）比较，不按 `lessons.id`** —— id 与课号当前同序，但那是「恰好如此」的环境状态；用 id 会把逻辑绑到偶然事实上 |
| 仓库层 | `MISTAKE_CONTENT_COLS` 注释收敛为「**不含 `first`**」+ 新增 `refreshLastLessonOn()`（只落库，不在 SQL 里做 `GREATEST`，避免出现两套守卫） |
| 写接口 | `createMistakesBatch` 命中分支接入；本次课号取 `items[].courseNo` → 顶层 `lessonNo`；**只刷 `last` 不动 `first`** |
| 迁移器 | `sync_mistakes.js` 同批接入（与写接口**共用同一定则**） |
| 契约 | `05 §30` 落库映射表**分列改写**（原「命中时不动（课号归属不由写接口改写）」一句涵盖两列，已拆成 `first` 冻结 / `last` 刷新两行）+ 新增语义 9；§11（`GET /api/mistakes`）补两列语义说明 |

**⚠️ 必须上报的缺口（规格 4 与规格 1 不自洽，我没擅自扩大范围）**

§11.11 **规格 1** 说「本次课号」＝`items[].courseNo` → 顶层 `lessonNo` —— 这是 `POST /api/mistakes`
的概念；而**规格 4** 要求 `db:sync-mistakes` 也同批改。但迁移器的输入是 `wrong-words.md` 的 8 列，
其中「课号」列是**首次**课号（§11.7，人工填、且已冻结）——**该路径确实拿不到「本次课号」**。

→ 我的处理：迁移器以 `firstLessonNo` 作**下界**喂入同一定则 —— 对已有行等价于**不刷新**（不倒退），
对新建行无影响（`first = last`）。即「**形式一致 + 语义安全**」，并在代码里就地注明是数据源缺口而非遗漏。
→ 实证：`--dry-run` **行为不变**（未变 26 · 跳过 0 · 告警 0）；库内 `play game`(id 12) `first=4/last=6`
   喂入 `firstLessonNo=4` → `max(6,4)=6` → 确实 no-op。
→ **结论：真正会推进 `last` 的是 `POST /api/mistakes`（现状）与 `review`（待裁）。**
   若 Amy 希望 `db:sync-mistakes` 也实质刷新，需要**新增数据源**（md 带「本次课号」或
   `records/*.json` 带该字段）—— 属契约变更，**请裁定，我不自启**。

**测试夹具一处坑（值得记）**：MW 段需要 ≥2 个**更大**课号；我最初硬编码 91/92，
首跑即撞 `uk_lessons_no` —— 因为 **`LW` 段的 `POST /api/lessons` 会按 `max+1` 自动分配课号**、
已占用 91。改为**动态取号**（`MAX(lesson_no) + 10`）后通过。
→ 教训：**测试里凡涉及唯一键的值，一律从库里现取，不硬编码**（同「禁写死常数」铁律）。

#### 📌 待 Amy 拍板：`POST /api/mistakes/:id/review` 判错时是否也刷 `last_lesson_id` —— 报成本

| 项 | 评估 |
|---|---|
| 改动量 | **约 12 行**（`reviewMistake` 加 1 处条件 + `updateReviewState` 加 1 列 + 定则复用） |
| 为什么便宜 | `reviewMistake` **已经**把 `lessonNo` → `lessonId` 解析好了（`:96-100`），且已有行锁 + `clientEventId` 幂等 ⇒ 不引入新的并发/重复问题 |
| 建议语义 | **仅 `result === 'wrong'` 时刷**（答对不是复发）；课号取入参 `lessonNo`（未传则不动）；同样走 `max` 单调守卫 |
| 需要同步改 | `05 §6`（review 的落库列说明）+ `review` 那组测试（RW1—RW8 区段）+ `updateReviewState` 的既有断言 |
| 回归风险 | **低**——`updateReviewState` 现有 4 列断言集中在一处；但仍需跑全套（`test:write` 129 + `test:api` 49） |
| 我的意见 | 成本可接受；**仅差您一句「刷」**。您说刷，我立刻做（含测试），不动其他范围。 |

#### A17：`self_check` 载体 —— **可行性报告（未写码）**

**关键发现：主通道其实已经通了，零后端改动。**
`POST /api/lessons`（Step 2a）**已经**接受并校验 `exercises[].selfCheck`（≤128 字符），
且 `lesson.repository.js` 的 upsert 会落 `self_check` 列 —— 已有测试锚定（`SC5` / `LW9`）。
⇒ **第 8 课起只要 `LessonRecord` 的 `exercises[]` 带上 `selfCheck`，G-2 就自然收口**，
不需要我改任何东西。缺口只在**旁路 md → JSON 通道**（`db:export` → `_snapshot.json` → `db:import`，
覆盖第 ≤7 课），因为 `export_md_to_json.py:511` 把 `selfCheck` **硬编码为 `None`**。

| 方案 | 可行性 | 成本 | 风险 |
|---|---|---|---|
| **① 主通道＝`LessonRecord.exercises[].selfCheck`**（推荐） | ✅ **已实现** | **0**（后端不动） | 无。Skill 归档步带上即可 |
| ② md 题干末尾 `【自查】…` 标记 | ✅ 可行 | 导出器 **+1 正则 + `emit()` 内 1 处抽取，约 10 行**；需长度守卫（超 128 应 `warn` 不静默截断） | ⚠️ **写错标记 = 静默 null**（可加「题干含 `【` 却未抽出 → `warn`」兜底）；且**必须从 `prompt` 中剔除**标记，否则标记会污染题面 |
| ③ `records/lesson-NN.self-checks.json` | ✅ 可行 | 新 schema + Skill 产出 + 导入器/T2 读取，**3 处** | 与「一账一文件」粒度不符；且若走 records，**更一致的做法是聚合单文件**（照 `records/exercise-error-types.json` 的 `rows[{lessonNo,kind,exerciseNo}]` 同形），而非 14 个 per-lesson 文件 |

**我的建议**：**①为主、②作为 md 侧人类可读载体（可选）**。
理由：`selfCheck` 本就是 `ExerciseRecord` 的**契约字段**（`exercise-set.schema.json` 已有），
第 8 课切换点后 md 不进写路径 ⇒ 走 ② 反而会造出**第二条来源**（与「切换点＝第 8 课」的拍板冲突）。
②仅在「需要重跑第 ≤7 课旁路」时才有价值，而历史 41 行**已定不回填** ⇒ **②实际收益≈0**。
⇒ **建议不做 ②**；若您仍想要，我按 10 行 + 2 条测试报实价后实施。

#### 🔴 顺手发现一处**代码里的**旧口径（第三份「去标点」）—— **只报不改**

`db/migration/export_md_to_json.py:91-95`：
```python
def norm_key(text: str) -> str:
    """错词判重用的规范化：去空白/标点、统一小写。"""
    s = re.sub(r"[\s,，。.、！？!?：:；;\"'（）()\[\]【】]", "", s)
    return s.lower()
```
这是与 `ai-teacher.md §11.3` **同一个错误表述在代码里的实体**（Amy 本轮订正的是文档）。
`mistakeKey.js:normKey` **不去标点** ⇒ **两份实现语义不同**。
**影响面（已核实，限缩在告警层）**：该函数只用于 `:610/:615` 的**错词对账**（records 的
`mistakeCandidates` 是否已在错词本中），**不参与落库**（落库走 JS `normKey`）。
⇒ 后果是「对账**漏报**」（`Do you like coffee.` 与 `Do you like coffee?` 被判成同一条），
**不会写错数据**。归属：导出器 = Skill 设计师域 ⇒ **只报，等指令**。

#### 实测（**非声明**）

| 项 | 结果 |
|---|---|
| `test:write` | **129 / 129**（123 → 129，新增 **MW17—MW20 共 6 条**） |
| `test:api` | **49 / 49** |
| `db:compare` | **15 / 0 / 0** |
| F2 零影响 | 13 表逐项一致（`students=1 lessons=7 vocabulary=61 lesson_vocabulary=62 mistakes=26 mistake_events=0 study_records=21 progress=1 lesson_exercises=41 lesson_sections=60 readings=5 reading_pieces=14 reading_questions=28`） |
| **`db:sync-mistakes --dry-run`** | **行为不变**：未变 26 · 跳过 0 · 告警 0 |
| 新增断言 | MW17 `last` 前进且 `changed=['last_lesson_id']` · MW17b `first` **冻结** · MW17c 响应形状 · MW18 课号更小**不回退** · MW19 重放**幂等** · MW20 顶层 `lessonNo` 作默认本次课号 |
| 端口纪律 | 只用我方实例，跑完即停，4000 已释放 |
| **库内数据未动** | 只读核对 + 临时学生（自建自清）；**真实学生 1 行未改**（历史不回填，遵裁定） |

#### 仍待（**只报不改**）

1. **Amy 拍板**：`review` 判错是否刷 `last`（成本已报，约 12 行）。
2. **Amy 拍板**：`db:sync-mistakes` 的「本次课号」数据源（现为 no-op；需契约变更才能实质刷新）。
3. **skill-designer**：`export_md_to_json.py:91-95` 的 `norm_key` 去标点（第三份旧口径）。
4. **skill-designer**：`docs/skills.md:190` 载荷口径同步（Step 2b 遗留）+ §6.10 的 A15 复核。

---

### 6.14 A19 落地：`review` 判错也刷 `last_lesson_id`（2026-10-01 22:45，**已实现并实测**）+ `lessonNoAligned` 口径订正

**触发**：Amy 回报 A19 缺口现场实证 —— 「本次 review 已回写 `streak`/`wrongCount`，但
`Tom play soccer` 的 `last_lesson_id` 仍停在 2（`first=2`/`last=2`）」，并拍板落地。

#### 先做的实证（确证缺口，非听述）

直连只读 SQL：

```
mistake_events: id=186  mistake_id=4  lesson_id=79(=第 8 课!)  result=wrong  rev-20261001-l8-003  22:31:47
mistakes id=4: wrong_text='Tom play soccer'  first_lesson_id=2  last_lesson_id=2  wrong_count=2  streak=0
```

⇒ 缺口**确证**：事件里 `lesson_id=79` **已经**写明「本次复发发生在第 8 课」，但 `last_lesson_id` 未推进。

**关键发现**：`reviewMistake` **早已**把 `lessonId` 解析好（它同时要写 `mistake_events.lesson_id`）
⇒ 刷 `last` **不需要任何新增查询/映射**，成本比 §6.13 报的 ≈12 行还低。

#### 实现（三条写入路径共用一份定则）

- `src/utils/mistakeLesson.js` 重构为 **1 个核心 + 2 个适配器**（防三条路径漂移）：
  - `shouldAdvanceLast({firstLessonNo, lastLessonNo, currentLessonNo})` —— **课号口径核心**（唯一实现）。
  - `resolveNextLastLessonId(...)` —— 适配器 A（写接口：入参是 id，需 `idByNo/noById` 映射）。
  - `resolveNextLastLessonIdByNo(...)` —— 适配器 B（review：行内课号已由 `BASE_SELECT` 子查询解析、本次课 id 也已在手 ⇒ **零映射零查询**）。
- `mistake.service.js::reviewMistake`：**仅 `result === 'wrong'`** 时调适配器 B 并
  `refreshLastLessonOn`；`first` 冻结、`max` 单调守卫照旧；`correct` 整条不进该分支。
- 幂等：该分支位于 `clientEventId` 幂等早返回**之后** ⇒ 重放不重复刷（MW24b 锚定）。
- 响应形状**未改**（不新增字段）⇒ 现有 A1—A7 断言零影响。

#### ⚠️ 与 Amy 原文字面的一处差异（**已上报，非擅自改口径**）

§11.11 末段写「课号取 `progress.current_lesson_no`」；我实现为**取请求的 `lessonNo`**。理由：
① 与写入 `mistake_events.lesson_id` 是**同一次解析** ⇒ 两处永不打架；
② 调用方显式决定，本函数不必再读 `progress`（少一次查询、少一处耦合）；
③ 实测她的调用本就在传 `lessonNo`（事件 `lesson_id=79` 即证）。
⇒ 若教学侧要「未传 `lessonNo` 时回退 `progress.current_lesson_no`」，我加回退（+1 查询 +2 测试），**请一句话**。

#### `lessonNoAligned` 口径 —— 已查清并订正文档（**非缺陷**）

**结论**：实现 `Math.max(progress.current_lesson_no, max(lessons.lesson_no)) === progress.current_lesson_no`
**恒等于** `progress.current_lesson_no >= max(lessons.lesson_no)` ⇒
它的含义是「**进度表是否已跟上实际最大课号**」，**不是**「两个数字相等」，**不是**数据缺陷。

- Amy 看到的组合**完全可解释**：`currentLessonNo` 取的是 `max`（以课程为准），
  所以进度表落后时会**同时**返回「`currentLessonNo: 8`（看似已对齐）」+「`lessonNoAligned: false`」——
  前者是**已替你修正的展示值**，后者报告**进度表原值落后**。**二者不矛盾**。
- **现场证据**：`progress.updated_at = 22:33:32`，**晚于**她的 review（22:31:47）；
  我于 22:45 两次实测（4000 与 4100 两实例）均返回 **`lessonNoAligned: true`**（`currentLessonNo: 8`）
  ⇒ 已自动回到对齐，**无需任何修正**。
- **引入历史**：`git log -L 35,40:backend/src/services/progress.service.js` ⇒ 自 **`4c29813`（backend foundation）** 引入，**从未改动** ⇒ 非本次改动引入（与 Amy 的判断一致）。
- **影响面**：前端**未消费**（`review/` 全量 grep 零命中）；仅教学侧文档引用 ⇒ 属**P2 措辞/命名**问题。
- **已做**：订正 `05 §19` 的措辞（原「不一致说明需要修正」会被读成功能缺陷），补上「正常中间态」与误读组合的说明。

#### 🔴 另发现一处**教学侧待办**（非我域，只报不改）

`db:compare` 由 **15/0/0 → 5/9/1**、`db:sync-mistakes --dry-run` 由 **0/26 → 3/23**。
**归因已核实：与本次改动无关**，系「第 8 课已入库、但 md 尚未登记」+「Amy 的 3 次 review 已写库、md 未同步」：

| 差异 | md | 库 | 成因 |
|---|---|---|---|
| `lessons` | 7 | **8** | 第 8 课已归档，md 未登记 |
| `mistakes` | 26 | **33** | 第 8 课新增 7 条（`went the park`/`a apple`/`He got to school`/`went a shop`/`vergertable`/`supermark`/`homeworks`）未登记 |
| `vocabulary` / `lesson_vocabulary` | 61 / 62 | **71 / 72** | 同上 |
| `lesson_sections` / `lesson_exercises` | 60 / 41 | **68 / 45** | 同上 |
| `status` | pending 20 | **pending 27** | 同上 |
| `sync` 差异 3 处 | — | — | `id=4` `wrong_count 1→2`（**她的 wrong**）、`id=8`/`id=12` `streak 0→1`（**她的 correct**）—— 与 22:31 的三条 `mistake_events` **逐条吻合** |

⇒ **处置**：教学侧登记第 8 课的 md（错词本 +7、`notes/day-08-14.md`）→ 跑 `db:export` 重生成
`_snapshot.json` → `db:compare` 即回一致。**我不动 md**（那是教学真相源，且属 Amy 域）。

#### 实测（**非声明**）

| 项 | 结果 |
|---|---|
| `test:write` | **134 / 134**（129 → 134，新增 **MW21—MW24b 共 5 条**） |
| `test:api` | **49 / 49** |
| 新增断言 | MW21 前置形态（`first=last`）· MW22 **判错 → `last` 前进** · MW23 课号更小**不回退** · MW24 **判对（哪怕课号更大）→ 不刷**（隔离「只有复发才刷」）· MW24b 同 `clientEventId` 重放**幂等** |
| F2 零影响 | 13 表逐项一致（清理前后） |
| 端口纪律 | ⚠️ **4000 被他人实例占用**（PID 34784，22:03:57 启，`node src/server.js`）→ **按纪律未动它**，我方另起 **4100**（PID 19096）跑完全部验证后**已释放**；4000 保持原状继续运行 |
| 库内真实数据 | **1 行未改**；仅临时学生（自建自清） |

#### 仍待

1. ~~**Amy 拍板**：`review` 未传 `lessonNo` 时是否回退 `progress.current_lesson_no`。~~
   → **已裁定「应回退」（A20）、已落地并实测，见 §6.16**。
2. ~~**Amy / 教学侧**：第 8 课 md 登记（使 `db:compare` 回 15/0/0）。~~ → **已关闭**，见 §6.15。
3. ~~**Amy 拍板**：`Tom play soccer`(id=4) 是否**定点回填** `last`。~~
   → **裁定 A22②：暂不回填** —— 先修 A20；修好后机制自会前进，且「历史行不回填」是既定原则。
4. ~~**Amy 拍板**：`db:sync-mistakes` 是否新增「本次课号」源。~~
   → **裁定 A22③：不新增** —— 写路径已切 API（第 8 课起），让 md 补课号列会造出**第二来源**
   （违反单向铁律）；维持 **no-op + 显式告警**。
5. **skill-designer**：`docs/skills.md:190` 载荷口径同步 + `export_md_to_json.py:91-95` 的 `norm_key` 去标点（§6.13 已报）。

---

## §6.15 收尾复核（2026-10-01 22:45—22:52）：`db:compare` 闭合 + A17 闭环实证

**触发**：接手时工作区较上轮多出**教学侧第 8 课全量登记**（`notes/day-08-14.md`、`records/lesson-08.{record,grading,study-record}.json`、
错词本 +7、`records/exercise-error-types.json` 补第 8 课 4 题），HEAD 前进至 `61f3d14`。

### 1. A17 缺口**闭环实证**（不再只是「可行性推断」）

直接解析 `records/lesson-08.record.json`：

| 项 | 实测 |
|---|---|
| 顶层键 | `lessonNo, lessonDate, levelCode, summary, studyMinutes, sourceFile, status, sections, vocabulary, exercises, knowledgePoints, feedback, gradeSummary, nextRecommendation` |
| `exercises` 数 | 4 |
| `selfCheck` **非空** | **2** |
| `selfCheck` 显式 `null` | 2 |
| **缺键** | **0** |

⇒ v2.8.0「第 8 步必带 `exercises[].selfCheck`」**已真实落地**，主通道（`LessonRecord.exercises[].selfCheck` → `POST /api/lessons`）
**端到端可用、零后端改动**。§6.13 的 A17 结论由「可行性」升格为「**已实测**」。

### 2. `db:compare` 5/9/1 → **14/1/0**（缺口 0）

根因确认＝并非数据错，而是 **`_snapshot.json` 陈旧**：文件停在 **15:32:42**，而教学侧三件套在 **22:27—22:28** 收尾。

```bash
npm run db:export      # M2_EXPORT_OK lessons=8 exercises=45(matched=45 mdOnly=0 recordsOnly=0) mistakes=33 readings=5(pieces=14) errorTypes=16 warnings=2
npm run db:compare     # 一致 14 · 差异 1 · 缺口 0   ← 原 5/9/1
npm run db:summary --check   # SUMMARY_CHECK_OK stale=0
```

- `_snapshot.json` **未跟踪**（`git ls-files` 为空）⇒ 重生成**零 git 副作用**、**未触碰任何真实数据**。
- 导出 2 条 warning＝`lesson-07/08.study-record.json`「文件名不符合规范，已跳过」—— **预期**，该文件由 `teach:sync` 消费，非快照来源。

### 3. 唯一余项：`lesson_exercises.error_type`（**待授权**）

对账现为「md 期望 16/45 vs 库内 12/45」，逐题不一致 4 处，全部是**第 8 课 homework #1—#4**（库内 `null`）。

```bash
npm run db:apply-error-types -- --dry-run
#  ∅ → grammar　(L8 homework#1, id=758, is_correct=0)
#  ∅ → grammar　(L8 homework#2, id=759, is_correct=0)
#  ∅ → word_choice　(L8 homework#3, id=760, is_correct=0)
#  ∅ → grammar　(L8 homework#4, id=761, is_correct=0)
# 回填统计：更新 4 · 未变 41 · 定位不到 0 · 判定冲突 0
# ERROR_TYPES_DRYRUN rows=45 updated=4 unchanged=41 missing=0 warnings=0
```

来源＝Amy `records/exercise-error-types.json`（`generatedAt 2026-10-01T22:30:00+08:00`，`purpose` 明写「供 `lesson_exercises.error_type` 回填」）。
改动面**只有 4 行**、冲突 0、幂等、有第 1—7 课先例 —— 但**写的是真实学生数据** ⇒ 依铁律 12（**「有据可依」≠「可以动手」**）
**我不擅自执行**，只出预演证据。**一条命令即闭合**：

```bash
cd backend && npm run db:apply-error-types      # 预期 ERROR_TYPES_OK updated=4 → db:compare 转 15/0/0
```

### 4. 本轮**未改任何真实数据 / 未提交**

| 项 | 结果 |
|---|---|
| 库内真实数据 | **1 行未改** |
| 端口 | 未起服务（复用他人 4000 只做 `GET /api/health` 只读探活，**未打业务写接口**） |
| 提交 | **无**（工作区含 Amy / skill-designer / 我方三方未提交改动，按铁律 10 不代提交） |

---

## §6.16 A20 落地：`review` 未传 `lessonNo` 时回退 `progress.current_lesson_no`（2026-10-02，**已实现并实测**）

**裁定来源**：Amy 四项裁定（用户全部拍板采纳）、Amy 的 A20 阻塞级发现 + 授权执行 `db:apply-error-types`。

### 1. 问题（Amy 的 A20）

A19 的「复习判错刷 `last`」在**真实链路**上是 **no-op**：

| 环节 | 事实 |
|---|---|
| 全前端唯一调用方 | `review/wrong.html:187` → `API.post('/mistakes/'+m.id+'/review', { result, clientEventId })` —— **不传 `lessonNo`** |
| 后端 | `if (Number.isInteger(lessonNo))` 恒 false ⇒ `lessonId = null` |
| 定则 | `shouldAdvanceLast` 首查 `currentLessonNo == null → false` ⇒ **不刷** |
| 测试 | MW21—MW24b **每条都显式传了 `lessonNo`** ⇒ 测试绿，但链路永不触发 |

⇒ 典型「**夹具与真实调用面脱节**」（正是铁律「涉唯一入参的断言不能只靠自造载荷」的用例）。也解释了库内 `Tom play soccer`(id=4) 至今 `first=2/last=2`。

### 2. 实现（后端兜底，**前端不改**）

`src/services/mistake.service.js`：

```js
/** 本次课课号：显式入参优先；未传时回退 progress.current_lesson_no（A20） */
async function resolveLessonNo(studentId, lessonNo) {
  if (Number.isInteger(lessonNo)) return lessonNo;
  const progress = await progressRepository.findByStudentId(studentId);
  const no = progress ? progress.current_lesson_no : null;
  return Number.isInteger(no) ? no : null;
}
// reviewMistake 内：一次解析、两处消费 ⇒ 事件流水与两列课号**永久同源**
const effectiveLessonNo = await resolveLessonNo(studentId, lessonNo);
```

- **同源回退**：同一 `lessonId` 既喂「刷 `last_lesson_id`」又喂「写 `mistake_events.lesson_id`」。
- 回归 `ai-teacher.md` §11.11 原文口径（A19 当时实现成「取请求值」，差异已上报 → 现已收口）。
- **覆盖所有未来调用方**，无需前端配合。
- **未变**：`correct` 不刷、`max` 单调守卫、`first` 冻结、幂等早返回在刷之前、**响应形状不变**（A1—A7 零影响）。
- 新增依赖 `progress.repository.findByStudentId`（**只读、事务外**，与既有 `lessonRepository.findByNo` 同层同范式）。

### 3. 测试：`test:write` 134 → **138 项全通过**

新增 **MW25—MW27**，夹具**刻意不传 `lessonNo`**（与真实前端逐字一致）：

| 用例 | 断言 | 实测 |
|---|---|---|
| **MW25** | progress→probeNoC，不传 `lessonNo` ⇒ `last` 前进、`first` 冻结 | ✅ `first=89 last=91 want=91`、status 200 |
| **MW26** | 事件 `lesson_id` 与 `last_lesson_id` **同源**（不再留 NULL） | ✅ `[91, true]` |
| **MW26b** | 回退课号**更小** ⇒ 单调守卫仍生效（回退不能绕过 `max`） | ✅ `last` 停在 103 课 |
| **MW27** | 回退课号在 `lessons` 中**无对应课** ⇒ 200、不刷、事件课号留空（不报错、不静默乱刷） | ✅ `evLesson=null` |

> 课号全部**从库内现取**（`probeNo* = MAX(lesson_no)+10/11/12`、`lessonIdOfNo()`）—— 不写死常数。

**其余验证**：`test:api` **49/49** · F2 **13 表计数零漂移** · **真实数据 1 行未改**。

### 4. 复核 Amy 的执行结果（**独立直查库，不依赖脚本自报**）

| 项 | 实测 |
|---|---|
| `db:compare` | ✅ **15 / 0 / 0**（缺口 0，全库首次全绿） |
| `lesson_exercises.error_type` | ✅ **45 题 / 填 16** = grammar 9 / punctuation 3 / word_choice 2 / capitalization 2 |
| L8 homework #1—#4 | ✅ `grammar / grammar / word_choice / grammar`，`is_correct` **全 0**（硬校验 `error_type != null ⟺ is_correct = 0` 通过） |

### 5. 其余三项裁定的处置

- **A22②** `Tom play soccer`(id=4) `last` **暂不回填** —— 机制已活，下次判错自会前进；不碰历史行。
- **A22③** `db:sync-mistakes` **不新增**课号源 —— 维持 no-op + 显式告警（避免第二来源）。
- **A（授权写库）** 由 Amy 执行，我方已独立复核（见上）。

### 6. 环境备注

`backend/node_modules` 下**没有 npm** ⇒ 全程直调脚本：`node src/server.js`（`PORT=4100`）与
`node scripts/write-api-check.js http://localhost:4100`。**4000 非我方实例**，全程未起未停未抢。
验证跑完**已释放** 4100。

---

## §6.17 回执 skill-designer §4.1「责任表」（2026-10-02 18:25）—— **V/W/S 三项已落笔**

> 来源：`docs/Work Alignment/SKILL-DESIGNER-STATUS.md` §4.1（经负责人转达）。口径：**决策人＝定口径方**、**执行人＝落笔方**。
> 原则：**先取证、再动手**；只碰**自己主责文件**；跨域只给立场、不落笔。

### 1. **V** `05 §15`「`clientEventId` 必须 vs 选填」不自洽 —— ✅ 决策+执行均在 be-dev，**已修**

**取证**：§15 抬头原写「故**必须**用 `clientEventId` 幂等」，Body 参数表却写「`clientEventId`（**选填**）」→ 确不自洽。
代码侧：`mistake.service.js:148` 为 `if (clientEventId)` ⇒ **字段级确为选填**（不传不报错，`client_event_id` 落 `NULL`）。

⚠️ **更正对方一处事实**：对方称「真实前端确实**不传** `clientEventId`」——**不成立**。
`review/wrong.html:191` 生成 `cid`、`:194` 随载荷提交 ⇒ **前端是传的**；**不传的是 `lessonNo`**（那是 A20 的事）。

**定稿（两层口径，零代码改动）**：**字段级＝选填**、**调用方级＝应带**；并写明 **Skill 侧一律必带**（`docs/skills.md` §4.4 / `SKILL.md` v2.8.1）、**前端已带**、**不传的代价**（无幂等 ⇒ 重复累加）。
`05` 变更记录新增**第十一批**。

### 2. **W** `项目书.md` 当前版本引用 —— ✅ 决策+执行均在 be-dev，**已修并顺带刷新**

- **W 本体**：6 处「当前版本」`v2.8.0` → **`v2.8.1`**（§2.10 数据来源/状态/关键约定、§5 架构图、目录树、§七#2、附录）；`SKILL.md` 字节 `23765 → 25074`。
- **🔴 顺带发现并修**：`项目书.md` 生成于 **13:45**，而**第 9 课于 18:13 入库**（`7c6288a`）⇒ 全文数据量已陈旧，**一并刷新至第 9 课口径**：

| 表 | 旧 | 新 | | 表 | 旧 | 新 |
|---|---|---|---|---|---|---|
| lessons | 8 | **9** | | mistakes | 33 | **39** |
| lesson_sections | 68 | **77** | | mistake_events | 3 | **5** |
| vocabulary | 71 | **80** | | study_records | 24 | **27** |
| lesson_vocabulary | 72 | **82** | | readings | 5 | **6** |
| lesson_exercises | 45 | **52** | | pieces / questions | 14 / 28 | **17 / 34** |

另：`error_type` 非空 **16 → 19**（grammar 11 / punctuation 4 / word_choice 2 / capitalization 2）；`lessons.grammar_point` 第 8、9 课**均 NULL**；第 9 课**新增 `backfill` 小节**（9 类）、练习 7 题（homework 4 + backfill 3）。
刷新由**独立工具反向印证**：`db:compare` 输出 `error_type 已填 19/52`、`readings 6`、`pieces 17`、`questions 34` —— 与库内一致。

### 3. **S** `export_md_to_json.py` 的 `norm_key` 去标点 —— ✅ 已统一（`A24 ⑦` 已裁「交 be-dev」）

**取证**：`norm_key` **仅**用于 `:610/:615` 的**对账比对**（md 错词本 vs `records` 错词候选 → 只产**告警**，**不落库**）；Node 侧 `src/utils/mistakeKey.js:normKey` 为三步（**标点参与判重**）。
**已改**：Python `norm_key` 收敛为与 Node **逐字一致**的三步（去全角括号批注 → 折叠空白 → 去首尾 → 小写）。

| 验证项 | 结果 |
|---|---|
| `py_compile` | ✅ `PY_COMPILE_OK` |
| 改动前后 `M2_EXPORT_OK` 摘要 | ✅ **逐字一致**（`candNotInBook=0 warnings=3`，计数全同）⇒ **当前数据下零回归** |
| Node ↔ Python 差分（8 例，含 `Tom plays.` / `Tom plays?` / 括号批注 / 大小写/空白） | ✅ **8/8 一致**（明证「标点不再并条」） |
| `db:compare` / `db:summary --check` | ✅ **15 / 0 / 0** / **`stale=0`** |

### 4. 需他人一句话的四项 —— **be-dev 立场**（我不决策，只给技术意见 + 依据）

| 项 | 我方立场 | 依据 |
|---|---|---|
| **O** `check_schemas.py` 双副本 | **建议「保留 + 注明」**（**不删**）：`.workbuddy/build/` **未被 git 跟踪**，删它只省本地噪声；**真正的债**是 `docs/plans/skill-plan.md:261/:639` **引用 build 版** ⇒ 应改指受控版（属 skill-designer） | 引用点 7 处（对方实测）；`schemas/README.md:97` 已指对 |
| **R②** `skills.md §4.2` 补 G6/G7 | **建议补**：权威 `ai-teacher.md` §9.3 为 **G1—G7**，镜像只登 G1—G5 ⇒ **契约不对称** | 缺口表 `docs/skills.md:1162+` |
| **T** `lesson-NN.study-record.json` 进「产出清单」 | **建议补为「四件」**：`teach:sync` **靠它**写 `progress` 7 列与 `study_records`（实测 **27 行** = attend/grade/feedback 各 9）；漏登 ⇒ 清单与实际不符 | `A24 T` 已倾向四件 |
| **U** 学习记录机制以谁为准 | **以 `records/*.study-record.json` + `teach:sync` 为准**（**现状唯一真实写作路径**）；`POST /api/study-records` **退为「已实现、无真实调用方」的备用路径**（调用方**仅测试脚本**，`review/**` 零命中）。另：`docs/skills.md:1213` 的 `POST /study-records` **缺 `/api` 前缀**，应一并订正 | 我方 §7 裁定 + 实测 |

### 5. 本轮改动清单（**3 文件**；**零 DDL / 零 DML / 零业务逻辑变更**）

| 文件 | 改动 | 属我 |
|---|---|---|
| `backend/docs/05-api-reference.md` | §15 两层口径（**V**）+ 变更记录**第十一批** | ✅ |
| `backend/db/migration/export_md_to_json.py` | `norm_key` 统一为 `normKey` 三步（**S**） | ✅ |
| `项目书.md` | 数据刷新至第 9 课 + `v2.8.1`（**W**） | ✅ |

> 📌 **提交边界**：三份改动 + 本状态文档**均未提交**（工作区 ` M`）。`项目书.md` 已由 git-manager 入库（`c5e05ec`），本轮为**增量修改**。按纪律**不代提交**、**禁 `git add -A`**、只用**显式路径**。

---

## §6.18 复核 fe-dev 对 `backend/scripts/` 三脚本的跨域改动（2026-10-02 19:30—19:40）—— ✅ **通过（实跑验证）**

> 背景：fe-dev 完成 Vue 3 框架化并**退役原生站 `review/`（14 文件物理删除）**，随之改动 `backend/scripts/` 下**三个脚本**（经 be-dev 显式授权跨域）。fe-dev 请 be-dev **复核**。
> 复核原则：**实跑 > 读码**；先取证「谁在飞、服务在不在」，再**不动他人实例**地跑。

### 1. 改动范围（实测）

| 文件 | 改动 | mtime |
|---|---|---|
| `backend/scripts/verify-frontend-pages.js` | **476 → 61 行**（原 61 条断言 → **转为入口别名**，转发 `frontend/scripts/verify-vue.cjs`，透传退出码） | 10-02 19:17 |
| `backend/scripts/verify-frontend-shared.js` | 由 `review/assets/*` → `frontend/src/*`（ESM 模块导入）；退役 8 条组件字符串断言 | 10-02 19:18 |
| `backend/scripts/integration-check.js` | **jsdom → playwright**（Vue 是 ESM，jsdom 不支持） | 10-02 19:24 |

合计 `+324 / −794`。**同时 `review/` 14 个文件删除**、新增未跟踪 `frontend/`。

### 2. 复核方式：**三脚本全部实跑通过**

| 脚本 | 运行环境 | 结果 |
|---|---|---|
| `integration-check.js` | **BASE=8080**（Vue **dist 生产构建**） | ✅ **18 / 18**，EXIT=0 |
| `verify-frontend-pages.js`（→ `verify-vue.cjs`） | **BASE=8080** | ✅ **64 / 64**，EXIT=0 |
| `verify-frontend-shared.js` | **BASE=5173（dev）** —— 按源码 `/src/*` 导入，**必须 dev** | ✅ **18 / 18**，EXIT=0 |

**关键实证**（DOM === 接口值双向不变量）：`statLessons 9 = /lessons.total 9`、`statVocab 80 = /vocabulary/stats.total 80`、`statMistakes 32 = /mistakes/stats.pending 32`、目录项 9 = total 9。

### 3. 复核通过的要点（值得记的）

- ✅ **`integration-check.js` C 段拦「全部 `**/api/**`」**，并在注释里写明「只拦 `/lessons/all` 会被 `lessonIndex` 的回退容错**静默兜住** ⇒ 横幅不出现」——**与我方成文铁律（假阴性）同源**，修复正确。
- ✅ **不伪装通过**：`verify-frontend-shared.js` 把随 `ui.js` 退役的 **8 条组件断言**以「迁移说明」打印、**不计入通过率**，并给出对应的 `verify-vue.cjs` 覆盖点。
- ✅ **不写死常数**：课数/词数/错词数均**从后端现取**再与 DOM 比（`lessons=9 vocab=80 readings=6`）；`lessonNo↔id` 映射只校验「全量 + 含 `grammarPoint`」，不硬编码。
- ✅ 转发别名 `argv[2]`/`BASE` 双入口可用；退出码 0/1/2 透传；`NODE_PATH` 经 `env` 继承给子进程。

### 4. 两处小瑕疵（**不阻塞**，归 fe-dev）

| # | 位置 | 问题 |
|---|---|---|
| 1 | `integration-check.js:29` | `const SITE_NAME = 'http://localhost:5173';` **死变量**（全文仅出现 1 次＝其声明本身），且与可覆盖的 `SITE`/`BASE` 并列，易误导 ⇒ 建议删或改用 `SITE` |
| 2 | `verify-frontend-shared.js` 头注 | 写「`renderMarkdown` **3 条**」，实际 markdown 仅 **2 条** `ok()`（表格/引用/列表 + 死循环回归）⇒ 注释与代码不符（纯注释笔误） |

> 我**未改这两个文件** —— 它们已归 fe-dev 所有、且 19:24 仍在写（在飞）；避免双向编辑冲突，仅报告。

### 5. 另一项：**G3 早已闭合**（fe-dev 信息陈旧）

fe-dev 转达「仓级 `.gitignore` 补 `dist/`（G3）仍待 git-manager」——**不成立**，实测：

- 根 `.gitignore` **第 32 行已有 `dist/`**（与 `build/` 同块，注释「# 前端构建产物」），由 **`1aca69c`（2026-09-29「chore(git): .gitignore 补 9 项忽略缺口」）** 引入，**已在 HEAD**；
- `git status --porcelain -- .gitignore` **为空**（未被改动）；
- 另有 `frontend/.gitignore` 二次覆盖 `dist/` + `node_modules/`（双保险）。`check-ignore -v frontend/dist/index.html` → `frontend/.gitignore:3:dist/`，`exit=0`。

⇒ **G3 无需 git-manager 动作**，fe-dev 该条可撤。

### 6. 端口与环境纪律

`:4000` 后端＝**他人实例**（PID 3124）、`:8080` dist＝**他人实例**（PID 42396）——**全程只读、未起未停**。
`:5173` dev＝**我自起自停**（vite，PID **23012**，经 `tasklist` 确认 `node.exe` 后 `taskkill /F`）→ **已释放**，4000/8080 未受影响。

---

## §6.19 跨职责登记（fe-dev → be-dev，依 P5；2026-10-02 19:50）

> 依 P5「跨职责改动须在对方状态文档登记一行」。**本块由 fe-dev 追加，未改动你方 §6.17 / §6.18 任何一行**；若与你方后续编辑冲突，以你方为准。

| # | 事项 | 状态 |
|---|---|---|
| 1 | **`backend/scripts/*` 三脚本由 fe-dev 随原生版退役代改**（`verify-frontend-pages.js`／`verify-frontend-shared.js`／`integration-check.js`）——**经用户显式授权**跨入 be-dev 职责域 | ✅ 已随 **`a03d306`** 入库；你方 §6.18 已实跑复核通过 |
| 2 | **`review/` 已删**（14 文件物理删除，Vue 版全面替代；`2e91345` + `4543984`）⇒ 你方文档中一切 `review/*` 引用**均已失效、不可复核**，待订正：`backend/docs/05-api-reference.md` `:59/:66/:324/:335`（**接口唯一权威**，锚 `review/wrong.html:187/:191/:194`）、`backend/src/services/mistake.service.js:110`、`backend/scripts/write-api-check.js:915`、`backend/docs/01-architecture.md:12/:178`、`02-data-model.md:50`、`03-api-contract.md:165/:228-231`、`04-migration-and-roadmap.md:9`、`06-api-requirements-amy.md:185`。⚠️ `backend/db/schema.sql:307`（**权威 schema** 的视图注释）若改须按 DDL 规程（单独 commit + 回滚 SQL）。建议口径：改指 `frontend/src/views/{WrongView,HomeView,…}.vue`，或加注「原引用已随 2026-10-02 原生版退役」 | ⏳ 待你方订正（非阻塞） |
| 3 | 你方 §6.18「两处小瑕疵」→ **fe-dev 已修**：删 `integration-check.js` 死变量 `SITE_NAME`；`verify-frontend-shared.js` 头注「`renderMarkdown` 3 条」→「**2 条**」。修后 `node --check` 双绿、`grep` 清零、重跑 **@8080 18/18 无回归** | ✅ 已修（随 `a03d306` 入库） |
| 4 | 你方 §6.18 §5 **G3 撤条已采纳**：fe-dev **独立复验**四证据一致（`.gitignore:32` = `dist/` ／ `1aca69c` 引入 ／ `status -- .gitignore` 空 ／ `check-ignore` 命中 `frontend/.gitignore:3`）⇒ 我方 `frontend-plan.md` §12 与 `前端工程师-工作状态.md` 已加更正注，G3 撤除 | ✅ 已撤 |

---

## 附：常用验证命令（均在 `backend/` 下）

```bash
npm run db:export            # 只读导出 _snapshot.json
npm run db:compare           # 只读验收（期望 match=15 diff=0 gap=0）
npm run db:import            # 写库（幂等，支持 --dry-run）
npm run db:sync-mistakes     # 错词本一次性同步（幂等，--dry-run）
npm run db:apply-error-types # error_type 回填（幂等，--dry-run）
npm run teach:sync           # records/*.study-record.json → study_records + progress（幂等，--dry-run / --lesson NN）
npm run db:migrate-dedupe-key # study_records.dedupe_key 迁移（幂等，--dry-run / --rollback）
npm run db:summary           # 生成 INDEX.md / digest.md（--check / --dry-run）
npm run test:api             # 49 项
npm run test:write           # 138 项（STEP 2a 的 LW1—LW33 + Step 2b 的 MW1—MW16 + §11.11 的 MW17—MW20 + A19 的 MW21—MW24b + A20 的 MW25—MW27）
```

> `test:*` 与 `integration-check` / `verify-frontend-*` 需要后端服务在线；
> 依赖装在 `C:\Users\lenovo\.workbuddy\binaries\node\workspace`，**必须带 `NODE_PATH`**。
