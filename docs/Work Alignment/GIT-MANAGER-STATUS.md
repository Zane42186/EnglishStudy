# GIT-MANAGER-STATUS.md — 版本管理工作状态

> 角色：Git / 版本管理工程师（`AGENTS.md` §3.5）
> 更新时间：**2026-10-01 18:06**（第二轮变更集已按角色分批提交，共 **7** 个提交；累计本地领先 **57**）
> 数据来源：`git status / log / rev-list` 实测（2026-10-01 12:28 / 13:14 / 17:40 / 18:06）＋ 共享日志
> 可信度标注：**【实测】**= git 命令当场得出；**【记录】**= 他人文档/日志记载，未经本人复验；**【推断】**= 依据现状推测
>
> 边界声明：本角色**不做业务开发、不改他人内容、不擅自推远端**。所有提交只做版本归档，
> 提交信息内如实标注验证来源；他人草稿与 in-flight 改动不代提交。

---

## 〇、版本基线速查（【实测】）

| 项 | 值 |
|---|---|
| 分支 | `main`（唯一工作分支）+ `backup/2026-09-29-before-push` |
| 远端 | `origin` = `https://github.com/Zane42186/EnglishStudy.git` |
| 同步状态 | **本地领先 57 个提交，落后 0**（未推送）。其中 2026-10-01 两轮共 **20** 个：`4e2fc46` … `69c5de1` + 本状态文档提交 |
| 远端已含 | `main` = `87ee73e`；`backup/2026-09-29-before-push` = `54f8330` |
| 本地标签 | `pre-push-20260929`→`c792b03`、`stage-02-backend-api`→`87ee73e`、<br>`skill-english-daily-v2.2.0/2.2.1/2.2.2`（均已推远端）；**尚无里程碑 tag** |
| 工作区 | ⚠️ **2 个新 in-flight**（`backend/docs/05-api-reference.md`、`backend/src/services/snapshot.service.js`，18:05 起由 be-dev 在改 A12 修复）→ **已按纪律搁置、未提交**；其余干净 |
| 未跟踪/被忽略 | `backend/.env`、`node_modules/`、`backend/db/backup-*.sql`、`backend/db/migration/_snapshot.json`、`.workbuddy/`、`*.zip` 均已被 `.gitignore` 覆盖，无遗漏入库风险 |

---

## 一、已完成事项 ✅

### 1. 项目版本基线（2026-09-29）

| Commit | 内容 |
|---|---|
| `b25a938` | `chore: establish project baseline` —— 纳入 `PROJECT.md`/`AGENTS.md`/`backend/`/`digest.md`/`review/` 等 27 文件 |
| `b1c20b7` | 建立 `docs/` 六件套骨架（`architecture`/`api`/`database`/`ai-teacher`/`skills`/`changelog`） |

### 2. 后端落地 + 前后端联调批次

| Commit | 内容 |
|---|---|
| `4c29813` | `feat(backend)` 分层后端实现（47 文件） |
| `4377603` | `feat(frontend)` 看板首页接入 API |
| `5e96775` | `docs` 12 个 JSON Schema + 联调报告 + 第 7 课计划 |
| `17af7ab` | `docs` changelog 同步 |

### 3. 首次全量推送（2026-09-29 19:20）

- `main` 快进推送 `c792b03..87ee73e`（23 个提交），**5 个标签全部上线**
- 建立回滚锚点 `pre-push-20260929` 与里程碑 `stage-02-backend-api`
- 排障结论写入用户级记忆：**推送必须用系统 Git**（PortableGit 的 `helper-selector` 无凭据，报 `could not read Username` 并非网络问题）

### 4. DQ1 幂等迁移批次（2026-09-30 上午）

| Commit | 内容 | 备注 |
|---|---|---|
| `01906af` | `feat(db)` `mistakes` 加 `uk_mistakes_text` **（DDL 独立提交）** | message 内含回滚 SQL `ALTER TABLE mistakes DROP INDEX uk_mistakes_text;` |
| `439ca25` | `feat(backend)` `seed.js` 过滤非错题 + 新增 `write-api-check.js` + `npm run test:write` | 实测 31/31，真实数据零影响 |
| `b76edde` | `docs` `database.md` / `integration-report-01.md` 同步 | mistakes 20 → 19 |

### 5. selfCheck 补链 + M2 工具批次

| Commit | 内容 | 备注 |
|---|---|---|
| `e8b190c` | `feat(db)` `lesson_exercises.self_check` **（DDL 独立提交）** | 回滚 SQL `ALTER TABLE lesson_exercises DROP COLUMN self_check;` |
| `c735bbd` | `feat(backend)` selfCheck 三层闭合（表→契约→接口）+ 验证 SC1—SC4 | 35/35【记录】 |
| `28e4aa7` | `feat(backend)` M2 只读导出/比对工具 + 路线文档 | |
| `e99b616` | `feat(frontend)` 阅读目录页重做 | |

### 6. Skill v2.3.0 / 阅读 API 化 / 数据归档批次

| Commit | 内容 |
|---|---|
| `fe24d2a` | 删除 `skills/english-daily/scripts/build_board.py`（-1030 行）+ 5 处残留引用清理，版本 2.2.2 → 2.3.0 |
| `18749e1` | 阅读板块改 API 驱动、目录同页渲染去 iframe、样式抽到共享层 |
| `4ebd4fc` | `docs` schemas + ai-teacher + skills.md 口径同步 |
| `1009704` | 归档 `records/`（11 文件）+ 错词本升级 8 列、23 条 |

### 7. 孤儿页删除

| Commit | 内容 |
|---|---|
| `d468fbd` | `chore(review)` 删除 `review/readIndex.html`——删除前核验 **`review/` 下引用数 0 处**，message 内写明恢复命令 |

### 8. Skill v2.5.0 / 阅读页修正 / §11.9 批次

| Commit | 内容 |
|---|---|
| `dd38b34` | Skill 2.3.0 → **2.5.0**：错词本 8 列模板、`records/*.json` 定为硬性产物、新增运行时必做条文 |
| `f417712` | **修复**阅读页过滤键 `data-date` → `data-idx`（真正「一次只显示一篇」）+ 底部翻篇栏 |
| `814293a` | `ai-teacher.md` §11.9 单一来源三层裁定；`mistake.schema.json` 判重键改 **wrongText**；新增 Amy 交办文件 |

> 说明：`8f30b59` / `4f936c2` / `5e1fef8` / `3cf6a13` / `cc73588` / `c5844cb` / `0d76732` 等提交由 be-dev / 其他角色自行完成，
> 我未参与，仅在此登记为「已入库」。

### 9. 本轮变更集提交（2026-10-01 17:40）—— 共 13 个提交

**原则**：按角色分批、**显式路径**、禁 `git add -A`；**DDL 独立成提交并写明回滚 SQL**；
敏感文件（`backup-*.sql` / `_snapshot.json` / `.env`）用 `check-ignore` 确认已忽略后才提交。

| # | Commit | 内容 | 角色归属 |
|---|---|---|---|
| 1 | `4e2fc46` | **〔DDL 独立提交〕** `study_records` 加 `dedupe_key` + `UNIQUE(student_id,dedupe_key)` + 迁移脚本；message 内含回滚 SQL | 后端 |
| 2 | `27d81c0` | `teach:sync` 学习记录同步（幂等）+ 仓储 dedupe 支持 + `EXERCISE_TYPE` 枚举同源 | 后端 |
| 3 | `b60a2f7` | 导出器对「阅读题 answer 为空」输出告警（不改输出行为） | 后端 |
| 4 | `073c371` | `verify-frontend-pages` 去掉「依赖降级状态」的写死断言，改双向不变量 | 后端（跨职责） |
| 5 | `01e3f46` | 阅读页 §11.10「空答案 = 数据缺陷」口径落地 + 第 9 行星号修复 | 前端 |
| 6 | `b364e4f` | `verify-frontend-shared` 补 `renderMarkdown` 死循环回归输入（35 → 36） | 前端（跨职责） |
| 7 | `9ff55d6` | `frontend-plan` 补阅读模块实施记录 | 前端 |
| 8 | `14718d6` | **`english-daily` 升 v2.6.0**（阅读答案必填）+ `skills.md` 契约同步 ← **解 be-dev W1/W2 卡点** | Skill 设计师 |
| 9 | `0e2d3fa` | 订正两处指向废弃表/不存在列的陈旧引用（`KnowledgeRole` / `studyMinutes`） | 契约 |
| 10 | `2df2e02` | 第 7 课学习数据落地 + `ai-teacher.md` 教学体系文档刷新（**源头侧**废弃命名订正） | Amy |
| 11 | `4a3c404` | 第 7 课批改归档（grading / backfill / study-record）+ 逐题 `error_type` 扩到 41 | Amy |
| 12 | `e1b9684` | **〔style 独立提交〕** 4 个页面 HTML 缩进统一（**剥空白指纹完全一致 = 零语义变更**） | 前端区（非 fe-dev 所为，已登记） |
| 13 | 本提交 | 各角色工作状态文档入库（`docs/Work Alignment/`）＋ `docs/be-dev-status.md` 迁移 | 全员 |

**提交前静态校验（本人执行）**：`node --check` 7 个 JS 全过；`JSON.parse` 8 个 JSON 全过；
`check-ignore` 确认 3 类敏感文件被忽略；4 个纯格式文件**提交前二次复验指纹未变**。

**未做**：未打 tag、未推送（等待授权）。

### 10. 第二轮变更集提交（2026-10-01 18:06）—— 共 7 个提交

**背景**：第一轮 13 个提交后，Step 2a（写接口）在途批次**落定**（负责人再次下令「提交本轮变更集」）。
提交前逐一核对 `mtime` vs `date`：10 个文件均 ≥4 分钟未动、无并发写入，遂入库。

| # | Commit | 内容 | 角色归属 |
|---|---|---|---|
| 1 | `570111d` | **Step 2a 写接口** `POST /api/lessons`（课号重复→409）+ `PUT /api/lessons/:id`（部分更新→404）；`services`/`repositories`/`controllers`/`routes` 5 文件 | 后端 |
| 2 | `c4bc8a6` | `write-api-check` 增 **LW1—LW33** 覆盖 Step 2a（`test:write` 66 → **99**） | 后端 |
| 3 | `78bf8cb` | `db:import` **零 DDL 写路径守卫**（跳过 `lesson_no ≥ 8`）+ 枚举/词汇落库收归单一来源 | 后端 |
| 4 | `9a66dc6` | 契约描述订正 **7 处**（废弃/未建表名 + G1 已闭环）+ `skills.md` 附录 A 第九轮 | 契约 |
| 5 | `2af4af5` | `ai-teacher.md` 数据真相源切后端 + 缺口清单 G1—G7 状态刷新 | Amy |
| 6 | `9ee3833` | `05-api-reference` 增 **§28/§29**（Step 2a）+ **§5.1** 写路径切换口径 | 后端 |
| 7 | `69c5de1` | 本轮各角色状态回写（be-dev §6.9 / SKILL-DESIGNER §1.2—§1.3 / status-amy §1.9 等） | 全员 |

**本批无 DDL** → 无需独立 DDL 提交（Step 2a 的 `dedupe_key` DDL 已在第一轮 `4e2fc46`）。

**提交前静态校验（本人执行）**：`node --check` 7 个 JS 全过（含 `import_json.js`）；`JSON.parse` 3 个 schema 全过。

**⚠️ 搁置（未提交，非本人职责）**：`backend/docs/05-api-reference.md`、`backend/src/services/snapshot.service.js`
于 **18:04—18:05 又被 be-dev 改动**（正在修 Amy 登记的 **A12**：快照降级 `reason` 由「写死全局结论」改为
按 `affected` 逐项生成 + 两处陈旧注释）。改动时点距提交点仅 **31 秒** → 判定**在飞**，按纪律搁置，待其定稿后另批。

**待办（本角色）**：① 打里程碑 tag 并推送（领先 57，待授权）；② `docs/changelog.md` 补记
**09-30 + 10-01 两日**（含 v2.3.0—v2.7.0，**注意 `14718d6` 内已含 v2.7.0 但题名只写 v2.6.0**）；
③ 交接单模板。

---

## 二、归属索引（12:28 快照 → **同日 17:40 已全部提交**）

> ✅ **本节的 24 个路径已于 2026-10-01 17:40 全部分批入库**（见第一部分第 9 条，13 个提交）。
> 本节保留为**归属索引 + 历史快照**，便于回溯「当时归谁 / 后来落在哪个提交」。

**该快照为 24 个路径**（【实测】2026-10-01 12:28 `git status --porcelain`）：
> 旧记「8 个 in-flight 文件」（09-30 19:31 观察）**已作废** —— 该结论经 fe-dev / Skill 设计师 / Amy **三方独立**指出，故当日重跑刷新如下。

| 归属 | 文件 | 计数 |
|---|---|---|
| **前端工程师** | `review/reading.html`、`review/assets/board.css`、`docs/plans/frontend-plan.md`、`backend/scripts/verify-frontend-shared.js`、`docs/Work Alignment/前端工程师-工作状态.md`（未跟踪） | 5 |
| **Skill 设计师** | `skills/english-daily/SKILL.md`、`skills/english-daily/references/course-template.md`、`docs/schemas/reading-set.schema.json`、`docs/skills.md` | 4 |
| **Amy** | `docs/ai-teacher.md`、`notes/day-01-07.md`、`progress.md`、`wrong-words.md`、`read/2026-10-01-read.md`、`records/README.md`、`records/exercise-error-types.json`、`records/lesson-07.{grading,backfill,study-record}.json` | 10 |
| **后端（迁移动作）** | `D docs/be-dev-status.md`（旧位置删除，内容已移入本目录） | 1 |
| **各角色状态文档** | `?? docs/Work Alignment/`（整目录未跟踪，现含 5 份共享状态文档） | 1 目录 |
| **待裁决**（原「归属未知」） | `review/index.html`、`review/lessons/lesson.html`、`review/lessons/lesson-4.html`、`review/lessons/lesson-6.html` | 4 |

**关于最后 4 个文件 —— 已查明性质（2026-10-01）【实测】**：
剥离全部空白后比对内容指纹（`tr -d '[:space:]' | md5sum`），**4 个文件与 `HEAD` 完全一致** → 属**纯格式重排（HTML 美化）、零语义变更**，**并非**在途的内容重写。指纹：
`review/index.html`=`e15ea85fe67b`、`lessons/lesson.html`=`fdb80bf3e368`、`lesson-4.html`=`f365adf0a3a2`、`lesson-6.html`=`a7aed637eff3`。
（对照：确属真实改动的 `review/reading.html`、`review/assets/board.css` 指纹**确有差异**。）
→ **无归属风险、无内容丢失风险**；**处置方式（保留格式化 / 还原 / 暂不动）待拍板**。

**处理原则（已执行）**：不做判断、不代提交、不代改内容。本目录 5 份共享状态文档中，各角色已分别确认**「自己那部分已定稿」**（fe-dev §I2、Skill 设计师 4 文件、Amy 侧 10 项）；我待授权后**按角色分批、显式路径**提交。

---

## 三、待完成事项 ⏳

### A. 我可直接执行（仅需你一句话授权 / 或下次批量处理）

1. **推送 50 个未推送提交** —— 含 **5 条 DDL 提交**（`01906af`、`e8b190c`、`f969e9f`、`4e2fc46` 及阅读相关），
   目前回滚点只在本地。推送前我会：fetch 核对远端 → 打 `pre-push-20261001` 回滚标签 → 快进推送 → 打 `stage-03-lesson07-import` 里程碑标签。
2. ✅ **已完成（2026-10-01 17:40）**：~~提交 24 个路径~~ → 已**按角色分 13 批、显式路径**全部入库（清单见第一部分第 9 条）。
   批次顺序：① DDL → ② 后端 teach:sync → ③ 导出器告警 → ④ 断言修复 → ⑤ 前端阅读页 → ⑥ 共享层回归 → ⑦ 前端台账 → ⑧ Skill v2.6.0 → ⑨ 契约订正 → ⑩ Amy 内容 → ⑪ records 归档 → ⑫ style 格式 → ⑬ 状态文档。
3. **更新 `docs/changelog.md`** —— 该文件由我维护，**最后一条停在 2026-09-29（阶段二）** → 实际缺口为 **09-30 与 10-01 两天**，其中 10-01 又分上下午两批（上午至 `a2bdd1b`，下午为第一部分第 9 条的 13 个提交）。**须一个提交一条补全，含 5 条 DDL。**
4. **建立交接单模板** —— 上一轮提议、尚未落地的 `handoff-to-git` 格式（谁→谁 / 提交范围 / 有无 DDL+回滚 SQL / 验证状态），
   落地后你一句「XX 需要你配合」我即可自行执行。

### B. 需他人先动，我再归档（见第四部分）

- ~~`reading.html:9` 的 `**` 星号瑕疵（fe-dev）~~ ✅ **已修复（2026-10-01 fe-dev 回执）**：改用全站既有「」强调；残留 `**` 5 处全在 JS 块注释内不渲染，无测试断言依赖该文案
- ~~G11 快照字段名不一致（be-dev）~~ ✅ **2026-10-01 复核：非缺陷** —— `snapshot.service.js:67-70` 已显式映射两层字段名（API 层 `…LessonNo` / 快照层 `…CourseNo`），仅待 be-dev 一句确认
- `wrong_text` 库内 2 条与 `records/` 规范不一致（be-dev）
- `schema.full.design.sql` 落后实际表 5 个字段（be-dev）
- `docs/plans/*.md` 仍写 `mistakes=20`（amy / skill-designer）—— be-dev 已议定「不追改」（其 §三 T8）
- ~~`check_instance.py` 未入门禁（skill-designer）~~ ❌ **该文件全仓不存在**（2026-10-01 三方独立实测）→ 改为「待负责人决定撤销或新建」

### C. 长期项（不紧急，但建议排期）

- **备份策略未定义**：学习数据是长期资产，目前只有「DDL 前手动 dump」，无定期备份与恢复演练。
- **无 CI 门禁**：契约一致性检查（`check_schemas.py`；`check_instance.py` **实测不存在**，见第四部分 #8）尚未纳入任何自动流程。
- **单点分支** `main` 无 PR / 无保护规则（个人项目可暂缓）。

---

## 四、需其他 Agent 确认或配合的事项 📮

> 说明：我**没有与其他 Agent 的私信通道**。我只能看到磁盘文件、git 状态与共享日志。
> 因此下列事项需要他们**写进日志/文档**，或由你转达一句要点。

| # | 事项 | 找谁 | 需要对方做什么 | 现有证据 | 优先级 |
|---|---|---|---|---|---|
| 1 | ~~`review/reading.html:9` 说明文字残留 Markdown 星号 `**一次只显示一篇**`，浏览器会原样显示~~ ✅ **已修复（2026-10-01 fe-dev 回执）** | **前端工程师** | ~~改掉星号~~ 已改用「一次只显示一篇」（「」强调，与同句「下一篇」「上一篇」一致） | 【实测·fe-dev】修复前 grep 命中第 9 行；修复后残留 `**` 5 处全在 JS 块注释（46/47/52/122/194 行）；`backend/scripts/*.js` 无断言依赖该文案 | ✅ 关闭 |
| 2 | 8 个 in-flight 文件何时定稿（实为 **24 个路径**） | **前端 / Skill 设计师 / Amy** | 写完告知，或由你授权我提交 | 【实测】19:31 仍在变动。**2026-10-01 fe-dev 回执**：fe-dev 侧文件（`review/reading.html`、`review/assets/board.css`、`docs/plans/frontend-plan.md`、`backend/scripts/verify-frontend-shared.js`、`docs/Work Alignment/前端工程师-工作状态.md`）**已定稿，可提交**；Skill 设计师 4 文件、Amy 侧 10 项亦已确认定稿（见 §二）。**2026-10-01 git-manager 核查回执**：另有 4 个 `review/` 改动（`index.html`、`lessons/lesson{,-4,-6}.html`）已用「**剥离全部空白比对内容指纹**」法查明 —— 与 `HEAD` 指纹**完全一致**（`e15ea85fe67b` / `fdb80bf3e368` / `f365adf0a3a2` / `a7aed637eff3`）→ **纯格式重排（HTML 美化）、零语义变更**，非内容重写；**无归属风险、无内容丢失风险**，处置方式待拍板 | 高（阻塞提交） |
| 3 | **G11**：`05-api-reference.md:389/412` 写 `firstCourseNo`/`lastCourseNo`，而运行时返回 `firstLessonNo`/`lastLessonNo` | **后端工程师** | 仅需一句确认：这是**有意设计**（API 层 `…LessonNo` / 快照层 `…CourseNo`） | 【实测·2026-10-01 复核】**非缺陷**：`backend/src/services/snapshot.service.js:67-70` 已显式映射 `{firstCourseNo: m.firstLessonNo, lastCourseNo: m.lastLessonNo}`，脏值时 `delete` 该键 —— 与文档 §389/§412 语义一致 | ✅ 建议关闭 |
| 4 | ✅ **已关闭，且我原报数字有误**：库内 `mistakes.wrong_text`「**2 条**手工归一化文本」实为 **1 条** | **后端工程师** | 已由 `db:sync-mistakes` 对齐（**非手工 UPDATE** —— 手工写会绕过判重键检查，正是 DQ1 类事故的入口） | 【实测】be-dev `--dry-run`：「新增 0 · 更新 1 · 未变 25」；该行**两列同改**（`wrong_text` → `in office`；`error_reason` 追加「（第 7 课补漏块第 3 题）」）；执行后全库 `wrong_text` 含括号行 = **0**。**→ 回应 be-dev Q1：我原「2 条」系转述 `04-migration-and-roadmap.md` 的【记录】条目、未复验，现更正为 1 条（`id=130`）** | ✅ 关闭 |
| 5 | `schema.full.design.sql` 未同步 `uk_mistakes_text`、`self_check`，且仍用已废弃 `courses`/`user_*` 命名 | **后端工程师** | 整体重审后再改（该设计稿已落后实际表 5 个字段） | 【记录】`docs/database.md` TODO | 低 |
| 6 | `docs/plans/*.md` 与历史报告仍写 `mistakes=20`（现为 **26**） | **Amy / Skill 设计师** | 补一行更正或标注「历史快照」；be-dev 已议定「**不追改**」（其 §三 T8） | 【实测】grep 命中多处；字面命中 3 份 plans（backend / frontend / integration）**均非本角色文件** | 低 |
| 7 | `build_board` 残留 —— **统计口径已自测**（同一事实三个数，需统一） | **Skill 设计师 / 后端** | 区分「历史记录（可留）」与「真实依赖（需替换）」；已核实 `skills/` 与消费方 grep **零命中** → 无真实依赖 | 【实测·2026-10-01】全仓（含 `.workbuddy/`）**85 文件 / 407 行**；**排除 `.workbuddy/` 为 31 文件 / 148 行**（建议以此为准）；仅 `skills/`+`docs/skills.md` 为 2 文件 / 17 行。旧记「18 文件」与 Skill 设计师「23 文件 / 110 行」口径不同 | 低 |
| 8 | ❌ **原描述有误 → 已更正**：`check_instance.py` **全仓不存在**（我早前误记「仍在 `.workbuddy/tmp/`」，溯源为共享日志的【记录】条目、未复验）**→ 回应 be-dev Q2：实测路径不存在，全仓 `find` 零命中，你的判断正确** | **待你指定**（我原指 Skill 设计师；be-dev 指 Amy；Amy 指 Skill 设计师 / 后端） | 决定：**撤销该条**（建议）还是**新建**（须给出校验目标与归属） | 【实测·2026-10-01】`find -iname "check_instance*"` **零结果**；全仓 grep 仅命中文档自身；`.workbuddy/tmp/` 21 个条目无此文件 —— Amy / Skill 设计师 / be-dev **三方独立复验一致** | 中 |
| 9 | **推送授权** | **你（项目负责人）** | 一句「推送」即可；我不会替任何人决定推远端 | 【实测】ahead **50** | 高 |
| 10 | ✅ **已答复**：be-dev **Q5** —— `backend/scripts/verify-frontend-shared.js` 的提交归属（前端列为其待提交项、be-dev 称已在 `cf07f29` 提交过一版） | **be-dev / fe-dev** | 已按「跨职责改动登记」处理：归于前端批次（`b364e4f`），commit message 内写明归属与理由 | 【实测】该文件本次改动 = 前端补的 4 个 `renderMarkdown` 回归输入（+14 行，35→36） | ✅ 关闭 |

---

## 五、工作约定（本角色遵守）

1. 提交一律用**显式路径**，不用 `git add -A`。
2. **DDL 变更独立成提交**，commit message 必须写明：DDL 语句、根因、备份文件名、**回滚 SQL**、验证状态。
3. `backup-*.sql`、`_snapshot.json`、`.env`、`node_modules/` 等运行时产物不入库。
4. 不 `reset --hard`、不 force push、不删历史、不改业务代码。
5. 他人 in-flight 改动与草稿不代提交；发现内容瑕疵只**标注**不代改。
6. 验证结论区分「已实测 / 他人实测 / 推断」，未执行的验证不声明通过。
