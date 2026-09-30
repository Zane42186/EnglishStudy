# 后端工程师（be-dev）工作状态

> **更新时间**：2026-09-30 19:35（GMT+8）
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

### C. 本轮提交

`8f30b59` 三件工具 + 摘要 → `4f936c2` 导出对账与前端滞后断言 → `5e1fef8` 文档同步 → `cc73588` G4 `incompleteStep` → `c5844cb` 三件事落档 → `0d76732` §11.10 测试锁。
**全部用显式路径提交，未使用 `git add -A`**；未提交任何 `backup-*.sql`、`.env` 或 `_snapshot.json`。

### D. 当前验证基线（**已实测**，2026-09-30）

| 检查 | 结果 |
|---|---|
| `test:api` | 49 / 49 |
| `test:write` | **66 / 66**（59 → 63 补 G4，→ 66 补 §11.10） |
| `integration-check` | 17 / 17 |
| `verify-frontend-pages` | 47 / 47 |
| `verify-frontend-shared` | 35 / 35 |
| `db:compare` | 一致 15 · 差异 0 · 缺口 0 |
| `db:summary --check` | `stale=0` |
| `check_schemas` | `SCHEMA_OK` |

**库内计数**（`F2 零影响` 断言锁定）：students 1 / lessons 6 / vocabulary 51 / lesson_vocabulary 52 / **mistakes 23** / study_records 18 / progress 1 / lesson_exercises 34 / lesson_sections 51 / readings 4 / reading_pieces 11 / reading_questions 22。

---

## 二、进行中事项

> 说明：**当前无进行中的代码编写任务**。以下两项是「已启动、但依赖他人先提交」的收尾核对。

| # | 事项 | 卡点 | 下一步 |
|---|---|---|---|
| W1 | **判重键引用一致性复查** —— 判重键应为规范化 `wrongText`（**非 `correctText`**） | `docs/skills.md` 工作区有 Skill 设计师未提交改动 | 等其提交后核对：`§11`（权威）／`skills.md` 3.6（镜像）／`mistake.schema.json`（`814293a` 已更正）／`sync_mistakes.js` 的 `normKey`（实现）四处一致 |
| W2 | **阅读答案必填口径对齐** —— schema（required + minLength 1）vs 后端校验（拒空）方向一致 | `docs/schemas/reading-set.schema.json` 未提交 | 等提交后核对是否有后端需跟进的字段/语义变更；**目前推断**无需改代码 |

---

## 三、待完成事项（后端自有，未开工）

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

---

## 四、需其他 agent 确认或配合的示意说明

### A. Amy（教学侧）—— **最高优先级只有 1 条**

1. 🔴 **写 feedback 记录时带上 `next_recommendation`（可选再加 `incomplete_step`）**
   G4 `lastIncomplete` 的**代码链路已完整**，唯一缺的是数据：**库内 6 条 `feedback` 记录，0 条带 `nextRecommendation`**
   → 因此快照里 `lastIncomplete` 与 `lastRecommendation` 恒为 `null` 并计入 `degradation`。
   **你下次写记录带上，立刻生效 —— 上线速度取决于你何时写记录，不取决于后端排期。**
   连带解锁：`ai-teacher.md` §11.2 第 5 条「断更补课题量上浮」（未落地前按常规 5 题）。
2. **第 7 课起批改 payload 带 `byType`** → 喂 `errorTrend.byType`（历史第 1—6 课已由 `db:import` 回填）。
3. **`records/*.json` 保持既有约定**：一套题集一文件；错词本「错误点」只写错误形式、**禁括号批注**（批注入「错因」，否则会被 `uk_mistakes_text` 拆成两行 —— 这是当初 DQ1 的根源）。
4. **`check_instance.py` 归属待你确认**：全仓无此文件也无引用，不知它应是教学侧产物还是归档在哪。
5. ✅ 已完成无需再动：`docs/ai-teacher.md` §12.1 已由你更新为「后端 `db:summary`」（`build_board.py` 已退役）。

### B. Skill 设计师

1. **`docs/skills.md` 提交后通知我** → 我做 W1 的判重键一致性复查。
2. **`docs/schemas/reading-set.schema.json` 提交后通知我** → 我做 W2 的对齐核对。
3. ⚠️ **顺带发现（非你的文件，我只报告）**：`backend/docs/06-api-requirements-amy.md` 与 `docs/plans/*` 的需求状态表已过时 —— 例如仍把「R7 阅读接口」标为 P2（实则 `GET`/`POST /api/readings` 已开放），易被误判成后端缺口。建议一并刷新。

### C. 前端工程师（fe-dev）

1. ✅ `review/*` 已全部 API 驱动；首页接 `/readings/stats.pieceCount` + title 的 `totalDays` —— **已实测** 47/47、35/35 全绿。
2. 本轮快照**新增** `lastIncomplete.incompleteStep`（有值才带键）。**当前仍为 `null`**（缺数据），前端若消费请**走降级**，不要当成「上次没有中断」。
3. 若后续要改任何快照消费字段，请先知会我，避免两侧口径漂移。

### D. Git 工程师 / 项目负责人

1. **工作区当前尚有 8 个未提交文件属其他角色**（`docs/ai-teacher.md`、`docs/plans/frontend-plan.md`、`docs/schemas/reading-set.schema.json`、`docs/skills.md`、`review/assets/board.css`、`review/reading.html`、`skills/english-daily/SKILL.md`、`skills/english-daily/references/course-template.md`）。
   **我侧改动已全部提交，一个别人的文件都没碰**（职责隔离 + 显式路径）。
2. 建议：本轮 6 个提交收尾后可考虑打里程碑 tag（`db:compare` 全绿、mistakes 23 条、G4 代码完备）。
3. **重踩过的坑已写进口径**：跑测试时若结果与预期不符，先怀疑「打到旧实例」—— 残留服务占着 4000 会让 `npm start` 静默 `EADDRINUSE` 失败，测试就全打在**改前代码**上。判定方法：看 `npm start` 日志 + 核对 `netstat` 的 PID。

---

## 附：常用验证命令（均在 `backend/` 下）

```bash
npm run db:export            # 只读导出 _snapshot.json
npm run db:compare           # 只读验收（期望 match=15 diff=0 gap=0）
npm run db:import            # 写库（幂等，支持 --dry-run）
npm run db:sync-mistakes     # 错词本一次性同步（幂等，--dry-run）
npm run db:apply-error-types # error_type 回填（幂等，--dry-run）
npm run db:summary           # 生成 INDEX.md / digest.md（--check / --dry-run）
npm run test:api             # 49 项
npm run test:write           # 66 项
```

> `test:*` 与 `integration-check` / `verify-frontend-*` 需要后端服务在线；
> 依赖装在 `C:\Users\lenovo\.workbuddy\binaries\node\workspace`，**必须带 `NODE_PATH`**。
