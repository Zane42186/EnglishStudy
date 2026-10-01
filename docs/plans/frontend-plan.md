# 前端迁移方案：静态页面 → API 驱动

> 作者：fe-dev（前端工程师）
> 日期：2026-09-29
> 状态：**方案稿，未实施**。本文件只做盘点与设计，方案阶段未修改任何页面代码。
> 依据：`PROJECT.md`、`AGENTS.md` §3.1、`docs/architecture.md`、`docs/api.md`、`backend/docs/05-api-reference.md`（唯一有效 API 契约）、`docs/integration-report-01.md`、`docs/schemas/README.md`。

---

## 0. 证据标注约定

本文所有结论按可信度标注，**未执行验证的绝不声明通过**：

| 标记 | 含义 |
|---|---|
| 【实测】 | 本次亲自跑过或在联调报告中有实测记录 |
| 【静态证据】 | 读代码/文档/文件直接得到的事实 |
| 【推断】 | 基于上述事实的判断，尚需确认 |
| 【未验证】 | 明确未做，需要他人或后续阶段确认 |

---

## 1. 现状盘点

### 1.1 页面清单

`review/` 下共 **11 个 HTML 文件**，全部已纳入 Git（`git ls-files` 命中 11 条）【实测】。
全库 98 个受版本控制文件【实测】。

| # | 路径 | 用途 | 当前数据来源 | 已接 API | 迁移难度 | 依据 |
|---|---|---|---|---|---|---|
| 1 | `review/index.html` | 看板首页：5 张统计卡（已上课数/当前级别/累计生词/阅读篇数/未过关错词）+ 课程列表 + 关键词即时过滤 + 错误横幅与重试 | **API**：`/lessons?size=1`、`/progress`、`/vocabulary/stats`、`/mistakes/stats`、`/lessons?size=100` | ✅ 是（唯一一个） | 低（已接；待修 `size=100` 上限与阅读占位） | 【静态证据】全文已读；【实测】联调报告 2.1 节 |
| 2 | `review/words.html` | 词汇卡：52 张卡片，按首字母 A→Z 分组（`<h2 id="letter-X">`），点击翻中文释义与例句 | **硬编码 HTML**，由 `build_board.py` 的 `build_words_page(lessons)` 生成 | ❌ | 中 | 【静态证据】52 个 `.wcard`、20 个 `letter-*` 标题；脚本块只有通用交互，无 `fetch` |
| 3 | `review/wrong.html` | 错词本：单张表格 20 行，列 = 课号 / 错误点 / 正确形式 / 错因 / 连续答对 / 状态 | **硬编码 HTML**，由 `build_wrong_page(wrong_rows)` 从 `wrong-words.md` 生成 | ❌ | 中 | 【静态证据】表格行内为字面值；无 `fetch` |
| 4 | `review/reading.html` | 阅读：4 天 11 篇，左侧 iframe 目录 + 右侧单篇卡片，上下篇按钮 + 键盘 ←→ + `#date` 深链 + `postMessage` 联动 | **硬编码 HTML**，由 `build_reading_page(days)` 从 `read/*.md` 生成 | ❌ | **高（后端无接口，整页阻塞）** | 【静态证据】11 张 `.rcard`，`data-date`/`data-file` 为字面值 |
| 5 | `review/readIndex.html` | 阅读日期目录（4 天），以 iframe 嵌入 `reading.html`，用 `postMessage`（`reading-select` / `reading-active` / `reading-toc-height`）双向通信 | **硬编码 HTML**；**不在 `build_board.py` 的输出列表中**（outputs 只含 index/reading/words/wrong + lesson 页） | ❌ | **高**（同 #4，且 iframe 架构本身需重评） | 【静态证据】脚本 `outputs` 字典无此键；`reading.html:83` iframe `src="readIndex.html"` |
| 6 | `review/lessons/lesson-1..6.html` | 6 个课程详情页，每页 8 个 `<h4>` 小节：复习 / 今日语法 / 词汇 / 例句 / 作业 / 我的作答 / 批改 / 难度反馈 | **硬编码 HTML**，由 `render_lesson_page(lesson)` 从 `notes/` 生成 | ❌ | 中（字段齐全，但要改「每课一个文件」为「一页 + 参数」） | 【静态证据】`lesson-6.html` 的 8 个 `<h4>` 与 `05-api-reference.md` 的 `sections[].sectionType` 8 个枚举一一对应 |

> 本表是**迁移前的审计快照**（保留原样，不改写，以免丢失基线与依据）。**当前实际状态**：`review/` 下全部页面均已 API 驱动（`#4`/`#5` 已于 P4 完成，`#5` 自第二轮起成为孤儿页），详见 §10—§11；`build_board.py` 已于 v2.3.0 删除，不存在生成物覆盖问题。

非页面数据源（当前真相源，迁移期间仍需保留供 Skill 与生成脚本读取）【静态证据】：
`INDEX.md`、`digest.md`、`progress.md`、`wrong-words.md`、`notes/day-01-07.md`、`read/2026-09-26..29-read.md`。

### 1.2 关键结构性事实

**F-A · 生成脚本会整体覆盖页面（最高优先级风险）**
`build_board.py` 的输出映射（位于 `.english-daily-package-yj7kiobf/english-daily/scripts/build_board.py:645-653`）【静态证据】：

```
"INDEX.md"                        → build_index
"digest.md"                       → build_digest
"review/index.html"               → build_board          ← 本次联调成果所在
"review/reading.html"             → build_reading_page
"review/words.html"               → build_words_page
"review/wrong.html"               → build_wrong_page
"review/lessons/lesson-{N}.html"  → render_lesson_page   ← 每课一个
```

即 **11 个页面中的 10 个是生成产物**（`readIndex.html` 不在列表内）。
更麻烦的是：该脚本所在目录 `.english-daily-package-*/` 被 `.gitignore` 忽略，**生成脚本本身不在版本控制内，而它的产物在**【实测：`git ls-files | grep -c english-daily-package` = 0；`git ls-files | grep -c ^review/` = 11】。
→ 这意味着「改页面必须同步改模板」这条约束**在 Git 里不可追踪**，任何前端改造都有被下次 Skill 重建静默冲掉的风险。联调报告已把它记为 F1（🔴 高）。

**F-B · 已知的 CSS 陷阱**
`.hide{display:none}` 与同优先级、后声明的 `.api-error{display:flex}` 冲突，导致错误横幅常驻（联调报告 F5，🔴 高，已修）。
**规则：新增任何自带 `display` 的类，必须补一条 `.<cls>.hide{display:none}`；验证可见性一律用 `getComputedStyle(el).display`，不得只看 `classList`。**【实测：08-03 节】

**F-C · 全站重复的资产**
- 同一段 CSS（约 5 KB，含 `.wrap`/`.card`/`.wcard`/`.reading-layout` 等）在 11 个文件里各内联一份【静态证据】。
- 同一段通用交互脚本（`nav tabs` / `.zhbtn` / `.wcard` / `#q` 搜索过滤，约 35 行）在 6 个文件里逐字重复【静态证据：逐文件 `awk '/<script/,0'` 比对】。
  → 其中 `nav button` 与 `main section` 这两个选择器在现有页面里**并不存在**（页面无 `<nav>` 无 `<main>`），是脚本模板的死代码【推断，未验证是否另有页面用到】。

**F-D · `size=100` 卡上限**
首页用 `/lessons?size=100` 拉全量，后端 `size` 上限恰为 100（联调报告 F2，🟡 中）。当前 6 课无影响，超 100 课会静默截断。

**F-E · API 契约已变更**
`docs/03-api-contract.md` 的 `{success, data, meta}` **已作废**；现行契约是 `{code, message, data}`，分页在 `data={list,total,page,size}`，前缀 `/api`（不带 v1）。前端与 Skill 一律以 `backend/docs/05-api-reference.md` 为准【静态证据：`05-api-reference.md` 五、差异登记】。

**F-G · 前端目前无任何构建工具链**
无 `package.json`、无打包器、无 Vue；用 `python -m http.server` 在 5500 端口托管 `review/`【静态证据：`docs/architecture.md` 二 + 联调报告一】。

---

## 2. 目标架构与技术选型

### 2.1 两个候选

| 方案 | 内容 | 优势 | 代价 |
|---|---|---|---|
| **A. 渐进式改造现有 HTML** | 保持 11 个静态页，抽取共享 `api.js` / `ui.js` / `board.css` 到 `review/assets/`，各页改用共享层取数渲染；同时把改造**下沉进 `build_board.py` 模板** | 改动小、可逐页上线、随时回滚；不动 Skill 流程；不违背 `AGENTS.md` §2.3「禁止因个人偏好更换技术栈/重写项目」 | 仍是字符串拼 HTML，无类型、无组件复用机制；长期维护成本高于框架 |
| **B. 重写为 Vue 3 + Vite** | 按 `PROJECT.md` 推荐技术栈整体重写 | 组件化、状态管理、长期可维护 | 11 个页面 + 生成脚本整体下线；`build_board.py` 需改为「产出 JSON 或调写接口」；需要 Node 构建链与部署方式变更；与 `AGENTS.md` §2.3 的约束相冲突（除非由项目负责人明确要求） |

### 2.2 推荐：先 A，把 B 留作 P5 的可选项

**推荐方案 A（渐进式改造）**，理由：

1. **合规**：`AGENTS.md` §2.3 明确禁止「因为个人偏好直接更换技术栈 / 重写整个项目」。`PROJECT.md` 的 Vue 3 + Vite 是**推荐技术栈（目标态）**，不是对现状的改造命令。没有项目负责人明确指示前，B 属于越权【静态证据】。
2. **对 Skill 流程零影响**：`docs/skills.md:1242` 明确写着「前端从静态 `review/*.html` 迁到 Vue → **零改动**」，`:1297` 写「本轮无需求……切换前端不需要 Skill 配合」。原因是 Skill 只产出 `docs/schemas/` 下的契约对象，由后端或生成脚本翻译成页面。**所以 A 和 B 对 Skill / Amy 的影响都是零，选型的唯一代价落在前端自己和生成脚本上**【静态证据】。
3. **对现有 6 课数据无风险**：课程数据已进 MySQL（lessons=6、vocabulary=51、mistakes=20、study_records=18、progress=1）【实测：`docs/integration-report-01.md` 3.3】。Markdown 仍是 Skill 侧真相源，但前端两条路都不写库、不改表，**不会造成数据丢失**。反而接 API 能消除「库内 20 条 vs md 19 条」的口径漂移（Amy 文档 DQ1）。
4. **A 是 B 的必要前置**：A 阶段产出的 `api.js`（包络封装）与字段映射，在 Vue 化时可原样复用；反过来若直接 B，这些契约经验要重新踩一遍。

**对现有 7 课数据 / Skill 流程的影响（明确回答）**：
- 7 课数据（实际已上 6 课）：不受影响。A 只改读取路径（HTML 字面值 → API），不写库。
- Skill 流程：不受影响。Skill 不读 `review/*.html`（`docs/skills.md:83` 明令禁止），只产出契约对象。
- **唯一受影响的是生成脚本链路**：`build_board.py` 的模板函数必须同步改造，否则任何前端改动都会被下次重建覆盖（见 F-A / §7 未决问题 Q1）。

---

## 3. 分阶段迁移路线

> 通用规则（每阶段都适用）：
> - **前置**：每个阶段开工前，先由 git-manager 打一次提交/基线，确保可回滚。当前 `review/index.html` 有未提交改动（`git status` 显示 ` M review/index.html`）【实测】，**P0 开工前必须先落盘**。
> - **验证**：① jsdom 脚本（`backend/scripts/integration-check.js` 现有模式）② 真机浏览器（`playwright-core` + `channel:'msedge'`，复现联调报告 8.1 的方式）③ 断言用 `getComputedStyle().display`（见 F-B）。
> - **回滚**：单阶段改动保持在一个提交内，回滚 = `git revert <commit>`，页面回退到静态版本；由于页面间无运行时耦合，回滚不影响其他页。

### P0 · 共享层与四态基建（**不依赖后端**）
- **改什么**：新建 `review/assets/api.js`（包络封装，见 §5）、`review/assets/ui.js`（组件渲染函数，见 §6）、`review/assets/board.css`（从 11 份内联 CSS 抽出公共部分，并统一补 `.hide` 规则）。`index.html` 改为引用共享层，删除内联重复代码。同时把 `/lessons?size=100` 换掉（见下）。
- **依赖 API**：无新增，沿用现有 5 个只读接口。
- **F-D 的修法（已按 be-dev 回复确定）**：`?size=100` → `GET /api/lessons/all`（be-dev 排 P1-4）。**前置条件：D2 解决**（`/all` 必须含 `grammarPoint`，否则首页搜索会漏关键词）。若 `/all` 尚未就绪或 D2 未解决，先用 `apiGetPage` 分页拉取兜底，**不引入新的静默截断**。
- **验证**：首页改造后，jsdom 16 项 + 真机 13 项全部仍通过（对齐联调报告基线）；截图确认四态。
- **回滚**：`git revert`，首页退回当前版本。
- **阻塞**：无。可立即开工（但需先提交现有未提交改动）。

### P1 · 词汇卡 / 错词本 只读化（**不依赖后端新增接口**）
- **改什么**：`words.html` → `GET /api/vocabulary?size=100` + `/vocabulary/stats`（按 `byLetter` 分组渲染）；`wrong.html` → `GET /api/mistakes?size=100` + `/mistakes/stats`（保留表格，加状态/类型筛选）。两页都接入共享四态。
- **顺带落地 Amy 的 F2 与 F6**（数据全部已有，见 §8.2）：错词卡补齐 `wrongCount` / `streak` 0→2 进度条 / `priority` / `errorType` / 来源课号；首页加近 6 课错误趋势迷你图（`/lessons/error-trend?limit=6` + 目标带 2—4 标注）。
- **依赖 API**：全部**已有**（`/vocabulary`、`/vocabulary/stats`、`/mistakes`、`/mistakes/stats`）。
- **验证**：卡片/行数与 API `total` 一致；分组与搜索行为与静态版一致；空态/错误态可见。
- **阻塞**：**C3 词汇口径**（51 vs 52）需 be-dev 定夺后再渲染，否则会出现「少 1 张卡」的困惑。不影响开发，只影响验收数字。
- **回滚**：`git revert`，页面退回静态版。

### P2 · 课程详情页参数化（**可被 C2 阻塞，但有不阻塞的兜底方案**）
- **改什么**：6 个 `lesson-N.html` → 单个 `review/lessons/lesson.html?no=N`（旧 URL 保留为跳转或保留静态副本），由 `GET /api/lessons/:id` 渲染 8 个 section。
- **依赖 API**：`GET /api/lessons/:id`（**已有**，字段齐全）。缺口是 `:id` 为主键、URL 用 `lessonNo`：
  - 兜底方案③（**不阻塞**）：拿全量列表在前端按 `lessonNo` 找到 `id` 再查详情 —— 多一次请求，但今天就能做。be-dev 承诺的 `GET /api/lessons/all` 正好提供 `lessonNo`↔`id` 全量映射，**用它做映射比用分页列表更干净**。
  - 方案①/②（需 be-dev）：`GET /api/lessons/no/:lessonNo` 或 `/lessons?lessonNo=N` 返回详情 —— be-dev **未回复**，已二次追问。
- **验证**：6 课逐课对比静态版与 API 版内容一致（8 个小节文本逐段 diff）；不存在的课号显示空态而非报错。
- **阻塞**：**不阻塞**，按方案③（`/all` 映射）开发。

### P3 · 错词复习打卡（写交互，**依赖新增接口 + Amy 定规则**）
- **改什么**：`wrong.html` 增加「我答对了 / 又错了」按钮，调用写接口，本地更新 `streak` / `status` / `wrongCount` 并给出反馈。
- **依赖 API**：**N2 `POST /api/mistakes/:id/review`**（新增，与 Amy 的 R2 同源）。
- **依赖 Amy**：一次会话出几题、`errorReason` 默认展开还是折叠、答后反馈文案、「诊断」来源错词如何排序（已发消息问 Amy）。
- **验证**：打卡后刷新页面，状态持久化（与 `/mistakes/:id` 返回值一致）；连续答对 2 次后变「已过关」。
- **回滚**：关掉按钮（可加开关）即退回只读；或 `git revert`。
- **阻塞**：**强阻塞**，N2 与 Amy 规则齐了才开工。

### P4 · 阅读模块 API 化（**完全依赖新增接口**）
- **改什么**：`reading.html` + `readIndex.html` 改为读阅读接口；同时重评 iframe + postMessage 架构（改为同页渲染左侧目录，去掉 iframe，能省掉一套跨域 postMessage 和高度同步逻辑），**此项需 Q4 决策**。
- **依赖 API**（be-dev 已承诺，排 **P1-2**，先建 `readings`/`reading_pieces`/`reading_questions` 三表）：
  - `GET /api/readings?page/size/from/to` → `{list:[{date, pieceCount, titles[]}], total}`，按日期倒序 → 喂 `readIndex` 目录
  - `GET /api/readings/:date`（路径 `YYYY-MM-DD`）→ 篇目 + `paragraphs[{en,zh}]` + `questions[]` → 喂右侧单篇卡片
  - `GET /api/readings/stats` → `{totalDays, pieceCount, wordCountTotal, byMonth, lastReadDate, currentStreakDays}` → 喂首页统计卡
  - 字段命名以 `paragraphs` 为准（我原提案的 `sentences` 作废）。
- **依赖 Amy**：中文默认是否隐藏、理解题是否改「先答再看答案」、生词注释是否跳转词汇页（已发消息问 Amy）。
- **验证**：4 天 11 篇逐篇比对；`←/→` 与 `#date` 深链行为不变；首页「阅读篇数」由 `—` 变真值（取 `pieceCount`，见 D3）。
- **阻塞**：**强阻塞**（等 P1-2 建表 + 接口）。落地前该页维持静态，并在页面上明确标注「数据未接 API」，不伪造来源。

### P5 ·（可选）Vue 化评估
- 触发条件：P0—P4 完成、页面数继续增长、或项目负责人明确要求。
- 前置：需先解决 F-A（生成脚本的去留），否则 Vue 化后仍然会被 `build_board.py` 的旧产物逻辑干扰。
- **不在本方案承诺范围内**，需项目负责人决策（§7 Q2）。

### 阶段依赖总览

| 阶段 | 是否依赖后端新增 | 是否依赖 Amy | be-dev 排期 | 可开工性 |
|---|---|---|---|---|
| P0 共享层（含 `/lessons/all` 替换） | 否（`/all` 为加速项） | 否 | `/all` = P1-4 | ✅ 立即可做（`/all` 就绪前用分页兜底） |
| P1 词汇/错词只读 | 否 | 否 | — | ✅ 立即可做（C3 已定：对齐 51） |
| P2 课程详情 | 否（走 `/all` 映射） | 否 | — | ✅ 立即可做 |
| P3 错词打卡 | **是（N2）** | **是** | **P0-1** | ⛔ 阻塞（等接口 + Amy 规则） |
| P4 阅读 | **是（N1）** | 是 | **P1-2** | ⛔ 阻塞（等建表 + 接口） |
| P5 Vue | 否 | 否 | — | ⛔ 需负责人决策 |

> be-dev 侧的 P0-1/P1-2/P1-4 是他自己的优先级编号（见 `docs/plans/backend-plan.md`），与本文的 P0—P5 阶段编号**不是同一套**，勿混用。

---

## 4. API 需求清单（已发给 be-dev，回复记录在下表末列）

> 标记：**已有** = 现成可用；**改造** = 接口在但需改字段/参数/上限；**新增** = 后端还没有。

| 页面 | 需要的字段 / 接口 | 状态 | 阻塞阶段 | be-dev 回复（2026-09-29） |
|---|---|---|---|---|
| `index.html` | `/lessons?size=1`（取 total）、`/progress`、`/vocabulary/stats`、`/mistakes/stats` | **已有** | — | ✅ 已有，不用改 |
| `index.html` | `GET /api/lessons/all`（精简字段全量，不受 100 限制） | **新增** | P0（替换 `?size=100`） | ✅ **承诺做**，排 P1-4；字段 `{list:[{id,lessonNo,lessonDate,levelCode,summary,vocabCount,exerciseCount,errorCount}], total}` ⚠️ 见 4.1 的 D1/D2 |
| `index.html` | `maxSize` 从 100 放宽到 500 | **改造** | P0 | ✅ **承诺做**（只让原 400 变 200，不破坏现有）；`/api/lessons` 签名与分页字段不变 |
| `index.html` | 阅读篇数统计 → `GET /api/readings/stats` | **新增**（N1） | P4（首页那一格先留 `—`） | ✅ **承诺做**，排 P1-2；字段 `{totalDays, pieceCount, wordCountTotal, byMonth, lastReadDate, currentStreakDays}`；⚠️ 见 4.1 的 D3 |
| `words.html` | `/api/vocabulary`（`word/phonetic/meaning/example/firstLessonNo`）、`/vocabulary/stats.byLetter` | **已有** | P1 | ✅ 已有 |
| `words.html` | 词汇口径：API 51（word 去重）vs 页面 52（按课累计） | **确认**（C3） | P1 验收 | ✅ **定了**：两边都没错，是口径不同；`/vocabulary/stats.total` 保持 51（去重词条数）。**前端对齐到 51**，若要显示 52 必须标注为「课次累计」 |
| `words.html` | 列表补 `isNew`（标记本课新词） | **改造**（C5，低优先） | P1（可选） | ⏳ 未回复 |
| `wrong.html` | `/api/mistakes`、`/mistakes/stats`、`/mistakes/pending` | **已有** | P1 | ✅ 已有 |
| `wrong.html` | `POST /api/mistakes/:id/review` | **新增**（N2，P0 级） | **P3** | ✅ **承诺做**，排 **P0-1**（他方案里的 Top1）；入参 `{result:'correct'\|'wrong', lessonNo?, answeredAt?, clientEventId?}`（比我要的多 3 个可选字段，前端可只传 `result`）；另有 `POST /api/mistakes/review-batch` |
| `wrong.html` | `/api/mistakes` 支持 `?lessonNo=`；`firstLessonNo` 为 null 时如何展示 | **改造/确认**（C4） | P1（增强项） | ⏳ 未回复 |
| `lessons/lesson-*.html` | `GET /api/lessons/:id` → `sections[]`（8 类）+ `vocabulary[]` | **已有** | P2 | ✅ 已有 |
| `lessons/lesson-*.html` | 按 `lessonNo` 取详情 | **改造/确认**（C2） | P2 | ⏳ 未直接回复；但 `/api/lessons/all` 返回 `lessonNo`↔`id` 全量映射，**可用它做前端映射（兜底方案③ 的改良版，仍不阻塞）** |
| `reading.html` / `readIndex.html` | `GET /api/readings`（列表，按日期倒序）+ `GET /api/readings/:date`（篇目 + 段落英中对照 + 理解题）+ `GET /api/readings/stats` | **新增**（N1） | **P4** | ✅ **承诺做**，排 **P1-2**，先建 `readings`/`reading_pieces`/`reading_questions` 三表（不做简化版）；`/readings` → `{list:[{date, pieceCount, titles[]}], total}`，`/readings/:date` → 篇目 + `paragraphs[{en,zh}]` + `questions[]` |
| 全局 | 写接口鉴权（N2 上线后前端是否带 token / studentId） | **决策** | P3 | ⏳ 未回复 |
| 全局 | `GET /api/agent/snapshot` 是否含首页所需统计 | **待定** | P0 之后优化 | ✅ **承诺做**，排 **P0-4**；`data` 对齐 `docs/schemas/agent-snapshot.schema.json`；缺字段返回 `null`/空数组并带 `degradation`，**不返回 500**。⚠️ 见 4.1 的 D4 |

**已发出的消息**：2026-09-29 向 be-dev 发送 N1/N2/C1—C5 + 通用 2 项；向 Amy 发送 4 组教学呈现问题。be-dev 已于同日回复（见下 4.1），Amy 待回复。

### 4.1 be-dev 回复记录与由此发现的差异（2026-09-29）

来源：be-dev 消息 + `docs/plans/backend-plan.md`。**以下 4 条是需要再确认的差异，不是结论**：

| # | 差异 | 为什么前端在意 | 我的处理 |
|---|---|---|---|
| **D1** | `/api/lessons/all` 返回 `levelCode`，而现有 `/api/lessons` 与 `/api/progress` 返回 `level`（形如 `"Level 2"`） | 同一概念两个名字，前端要写两套取值；且首页「当前级别」用的是 `/progress.currentLevel`。**`levelCode` 的值域是 `"Level 2"` 还是 `2` 未标明**【未验证】 | 已发消息问 be-dev；在答复前，首页继续用 `/progress.currentLevel`，课程卡不显示级别 |
| **D2** | `/api/lessons/all` 的精简字段**不含 `grammarPoint`** | 首页搜索是对 `标题 + summary + grammarPoint` 做即时过滤（联调报告实测有「搜索 was 命中过滤」）。换成 `/all` 后**搜索会漏掉语法点关键词** | 已发消息请求补 `grammarPoint`（或接受 `/all` 只做展示、搜索另走 `/api/lessons?q=`）。**这是 `/all` 替换 `?size=100` 的硬前置** |
| **D3** | `/api/readings/stats` 同时有 `totalDays`（4）与 `pieceCount`（11） | 首页卡片标签是「阅读篇数」，历史静态页 INDEX.md 写「4 天，共 11 篇」。取哪个要和文案对齐 | 暂定用 `pieceCount` 作为「阅读篇数」，`totalDays` 放 title 提示；已请 be-dev 确认 |
| **D4** | 快照 `data` 对齐 `agent-snapshot.schema.json`，但其 `readingCatalog` 目前**缺表会返回 `[]`**；且首页需要的「阅读篇数」在快照里可能拿不到 | 决定首页是走「1 次快照」还是「4 次分散接口」 | 快照落地后再评估；**P0 阶段不动首页取数策略** |

**be-dev 未回复的 4 项**（已二次发出）：C2（lessonNo 查详情，虽可用 `/all` 映射绕过）、C4（`/mistakes?lessonNo=`）、C5（`/vocabulary` 补 `isNew`）、写接口鉴权。这 4 项**均不阻塞 P0/P1/P2**。

**后端提醒同步**：`docs/backend-analysis.md` 里仍是旧包络 `{success,data,meta}` 与 `/api/v1` 前缀，**已作废**；前端一律以 `backend/docs/05-api-reference.md` 的 `{code,message,data}` + `/api` 为准（与本方案 §1 的 F-E 一致）。

---

## 5. 前端数据契约落地

### 5.1 统一封装层 `review/assets/api.js`

目标：全站只有这一处知道 `{code,message,data}` 长什么样。

```js
var API_BASE = 'http://localhost:4000/api';   // 换环境只改这一处

function request(path, options) {
  var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 10000);   // 10s 超时
  return fetch(API_BASE + path, Object.assign({ signal: ctrl && ctrl.signal }, options))
    .then(function (res) {
      return res.json().catch(function () {
        throw new ApiError(0, '服务返回异常（HTTP ' + res.status + '）', null);
      });
    })
    .then(function (body) {
      // 唯一成败判定点：只看 code
      if (!body || body.code !== 200) {
        var msg = (body && body.message) || '请求失败';
        // 400 参数校验：data 是 [{field,message}]，拼成可读文案
        if (body && body.code === 400 && Array.isArray(body.data)) {
          msg += '：' + body.data.map(function (e) { return e.field + ' ' + e.message; }).join('；');
        }
        throw new ApiError(body ? body.code : 0, msg, body ? body.data : null);
      }
      return body.data;                       // 成功只吐 data
    })
    .finally(function () { if (timer) { clearTimeout(timer); } });
}

function apiGet(path) { return request(path); }
function apiGetPage(path, page, size) { /* 统一拼 ?page=&size= 并返回 {list,total,page,size} */ }
function apiPost(path, payload) { /* POST，payload → JSON body + Content-Type */ }
```

**约定**：
- `code === 200` 是唯一成功判定；`data` 在失败时为 `null`（400 时为字段明细数组）。
- 分页统一走 `apiGetPage`，返回 `{list,total,page,size}`，禁止各处手写 `?size=100`（F-D 的根源）。
- 时间字段为字符串（`2026-09-29` / `2026-09-29 14:08:02`），前端不 `new Date()` 解析，只做格式化显示【静态证据：`05-api-reference.md` 1.5】。
- 字段一律 camelCase，前端不再做 snake→camel 转换。

### 5.2 四态（Loading / Error / Empty / 正常）

每个取数区块固定四态，不写第五种：

| 态 | 呈现 | 实现要点 |
|---|---|---|
| Loading | 骨架/占位 + 转圈 | 首屏写死占位（不等 JS），避免白屏闪动 |
| Error | 顶部横幅 `加载失败：{message}（请确认后端服务是否在运行）` + 「重试」按钮 | 重试 = 重跑该区块的 `load()`，不是整页刷新 |
| Empty | 「暂无 XX 记录」 | `list.length === 0` 且**非**搜索态；搜索无结果显示「没有匹配的 XX，换个关键词试试」（首页已实现，抽成公共函数） |
| 正常 | 真值渲染，`pending` 类移除 | — |

**降级策略（API 挂了怎么办）**：
1. **局部降级**：首页现在是一次失败就整页报错；改为**按区块降级** —— 统计卡失败只让对应卡显示 `—`，课程列表失败只在该区块显示错误条，其余照常。
2. **无静默失败**：任何失败都必须有可见文案，绝不留下「正在加载…」转圈不停或空白区块。
3. **不伪造数据**：不缓存旧数据冒充实时数据；若后续要离线可用，必须显式标注「离线快照 · 时间」【推断：当前无此需求，未在方案中设计】。
4. **错误归因**：区分 `code=0`（网络/超时 → 提示后端是否在跑）、`4xx`（参数/资源问题）、`5xx`（服务异常），文案不同。

### 5.3 安全

所有拼接进 HTML 的动态文本统一走 `esc()`（首页已有，抽到 `ui.js` 共享）。**新增渲染代码禁止直接 `innerHTML +=` 原始 API 字段**。

---

## 6. 统一性设计（消除 11 份重复）

### 6.1 共享资产

```
review/assets/board.css    ← 从 11 份内联 CSS 抽公共部分（.wrap/.card/.stat/.wcard/.state/.api-error…）
review/assets/api.js       ← §5 封装层
review/assets/ui.js        ← 组件渲染函数 + esc + 四态原语
```

**迁移期的兼容做法**：页面 `<head>` 改为 `<link rel="stylesheet" href="../assets/board.css">`，保留各自特有样式在页面内联小块里；先做增量抽取，不做一次性大替换（降低回滚成本）。

### 6.2 公共组件（渲染函数）

| 组件 | 用于 | 说明 |
|---|---|---|
| `statCard(value, label, opts)` | 首页统计卡 | 统一 `pending` 态与 `—` 占位 |
| `lessonCard(lesson)` | 首页课程列表 | 内置 `data-text` 供搜索过滤 |
| `wordCard(word)` | 词汇页 | 点击翻中文+例句，复用 `.wcard.show` |
| `mistakeRow(mistake)` | 错词本 | 表格行 / 卡片两形态共用同一数据源 |
| `progressBar(done, total)` | 连续答对进度、课程进度 | 统一「X / Y」视觉 |
| `stateBlock(type, text)` | 四态占位 | Loading / Empty / Error 统一出口 |

### 6.3 CSS 硬规则（防 F-B 复发）

```
新增任何自带 display 的类 → 必须同时写 .<cls>.hide { display: none; }
验证可见性 → getComputedStyle(el).display === 'none'，不得断言 classList
```
写入 `review/assets/board.css` 顶部注释，并在真机断言脚本里固定加这条检查。

### 6.4 顺带清理

F-C 提到的死代码（`nav button` / `main section` 相关 tabs 逻辑）在抽取共享脚本时确认后删除；**删除前需确认无其他页面依赖**（已标注【推断，未验证】）。

---

## 7. 风险与未决问题（**需团队/用户决策，我不自行拍板**）

| # | 问题 | 影响 | 需要谁决定 |
|---|---|---|---|
| **Q1** | `build_board.py` 会整体覆盖 11 个页面中的 10 个，而该脚本位于被 `.gitignore` 忽略的打包目录、**不在版本控制内**。前端改造必须同步改模板，否则下次 Skill 重建即归零（联调报告 F1，🔴 高）。三条路：① 把改造下沉进脚本模板；② 让这些页面移出生成集（改为 API 驱动后脚本不再产出 HTML）；③ 把 `build_board.py` 纳入版本控制。选哪条？ | 决定本次及后续所有前端改造能否存活 | **项目负责人 + skill-designer + git-manager** |
| **Q2** | 是否要走向 Vue 3 + Vite（P5）？`PROJECT.md` 推荐但 `AGENTS.md` §2.3 禁止擅自换栈。我的推荐是先 A 后议。 | 决定长期投入方向 | **项目负责人** |
| **Q3** | 页面打开方式：现在是 `python -m http.server`（5500）直接打开 `review/*.html`。若抽共享 `assets/`，`file://` 直开会被 CORS 拦（fetch 相对路径 + 本地文件）。是否要求前端一律通过本地静态服务访问？ | 影响使用习惯与文档 | **项目负责人 + 用户** |
| **Q4** | 阅读模块的 iframe + postMessage 架构（F-A 旁支）：P4 我倾向去掉 iframe 改成同页渲染。是否接受？ | 影响 P4 工作量与阅读页交互 | **项目负责人 + amy** |
| **Q5** | 旧 URL 兼容：P2 若把 `lesson-6.html` 换成 `lesson.html?no=6`，旧链接（可能存在于 digest / 聊天记录）会失效。保留静态副本还是做跳转页？ | 影响 P2 方案 | **项目负责人** |
| **Q6** | 写接口（N2）上线后的鉴权：单用户场景下前端是否要带凭证？ | 影响 P3 实现 | **be-dev** |
| **Q7** | 首页是否展示 `progress.note`（当前是写给 Amy 的决策记录，如「暂停加速，先做巩固纠错」）？若要给学生看，需 Amy 出学生向文案规则。 | 影响首页信息设计 | **amy** |
| **Q8** | 词汇口径 51 vs 52（be-dev 已定：API 保持 51 去重词条数、前端对齐 51）。**但用户可见数字会从 52 变 51**，是否需要保留「课次累计 52」的显示？另错词 20 vs 19（Amy 文档 DQ1）仍未定 | 影响 P1 验收与用户观感 | **项目负责人**（后端口径已给，剩展示策略） |
| **Q9** | **Amy 的 F4（作业提交前自查闸门）要不要纳入本次范围？** 它是 F1—F10 里唯一的新功能：现有 11 个页面里没有作业提交页、也没有作业写接口，`selfChecks` 目前只存在于 `LessonPlan` 里没有存储与接口。我的建议是拆 F4-a（只读自查清单，可随 P1 做）/ F4-b（真正的勾选闸门，等依赖齐） | 决定要不要新建页面 + 拉 be-dev/skill-designer 一起做 | **项目负责人 + amy** |

### 其他风险登记

| 风险 | 级别 | 应对 |
|---|---|---|
| R-1 生成脚本覆盖（= Q1） | 🔴 高 | P0 开工前必须先有 Q1 结论，否则我不动任何页面 |
| R-2 `size=100` 静默截断（F-D） | 🟡 中 | P0 起统一走 `apiGetPage` 分页；待 C1 确认上限 |
| R-3 CSS 优先级覆盖（F-B） | 🟡 中 | §6.3 硬规则 + 真机 `getComputedStyle` 断言 |
| R-4 阅读模块长期阻塞 | 🟡 中 | P4 完全依赖 N1；在 N1 落地前该页维持静态并明确标注「数据未接 API」 |
| R-5 死代码清理误删 | 🟢 低 | 删除前逐页 grep 确认无依赖（F-C） |
| R-6 无本地构建/测试链 | 🟢 低 | 复用 `backend/scripts/integration-check.js`（jsdom）+ `playwright-core + msedge` 真机模式，二者已在联调中验证可用【实测：联调报告 8.1】 |

---

## 8. Amy 教学呈现需求（F1—F10）落地映射

> 来源：`docs/plans/amy-teaching-plan.md` 第五章（2026-09-29 收到）。Amy 明确「教学呈现以她的判断为准」，本节不推翻她的任何一条，只做**可行性分层 + 缺口登记**。
> 编号沿用她的 F1—F10；后端缺口编号沿用她的 N1—N9 与 `06-api-requirements-amy.md` 的 R1—R7。

### 8.1 可行性分层（这是本节的核心结论）

| 分层 | 条目 | 说明 |
|---|---|---|
| **A · 今天就能做**（数据已全部在现有 API 里） | **F2**、**F6** | 不需要等任何新接口，可并入本文 P1 |
| **B · 展示可做、交互要等写接口** | **F3** | 列表用 `/mistakes/pending` 已有；「一键作答并回写结果」等 N2（`POST /mistakes/:id/review`，be-dev 排 P0-1） |
| **C · 被后端缺口阻塞，先占位** | **F1**、**F5**、**F7**（部分）、**F8**、**F9**、**F10** | 数据源不在库里或没有接口，按 Amy 约束 3 保留占位，不报错 |
| **D · 超出「页面迁移」范围，属新功能** | **F4** | 见 8.3，需项目负责人决定范围 |

### 8.2 逐条映射

| # | Amy 要求 | 落哪个页面 | 需要的数据 | 数据源现状 | 归属 |
|---|---|---|---|---|---|
| **F1** | 今日决策卡：级别 / 课号 / 上一课日期与距今天数 / 本课语法点 / 目标 3 条 / 新词数 / 补漏块 | 首页（新增卡片区） | `level`、`lessonNo`、`lastClassDate`、`grammarPoint`、**objectives 3 条**、新词数、**补漏块** | 前四项**已有**（`/progress` + `/lessons`）；「距今天数」**前端可由 `lastClassDate` 现算，不必等 Amy 的 N9**；目标 3 条 = `LessonPlan.objectives`（`docs/schemas/lesson-plan.schema.json`）、补漏块 = `knowledge_points`（Amy 的 N5，无接口） | **C**（已有部分先做，目标/补漏占位） |
| **F2** | 错词四项硬指标：`wrongCount` / `streak`（0→2 进度条）/ `priority` / `errorType` + 来源课号 | `wrong.html` | 同名字段 | **全部已有**（`/api/mistakes`、`/mistakes/pending` 已含全部 6 个字段） | **A**（并入 P1） |
| **F3** | 每日复习队列 Top-N，一键进入作答 | `wrong.html`（或首页入口） | `/mistakes/pending?limit=N`（默认排序即优先级序）+ 写接口 | 列表**已有**；作答回写等 **N2** | **B** |
| **F4** | 作业提交前自查闸门：本课 `selfChecks` 逐条列出、勾选后才允许提交 | **当前 11 个页面里没有作业提交页**（需新建） | `selfChecks` 数据 + 作业提交写接口 | `selfChecks` 由 Amy 规则产出、落在 `LessonPlan`，**库里没有、也没有接口**；作业提交写接口不存在 | **D**（见 8.3） |
| **F5** | 批改视图：逐题 作答 / 最小修正后正确形式 / errorType / 一句为什么；开放题完整改后版；复发项「第 N 次犯」 | `lessons/lesson-N.html` | `GET /api/lessons/:id/exercises`（Amy 的 **N4**） | **无接口**；现有只有 `sections` 里 `sectionType=grading` / `my_answer` 的两段文本 | **C**（降级：先渲染现有 grading/my_answer 文本；结构化逐题等 N4） |
| **F6** | 近 6 课错误趋势迷你图（errorCount 柱状 + 目标带 2—4 标注） | 首页 | `/api/lessons/error-trend?limit=6` | **已有**（`byLesson` 按课号升序，可直接画） | **A**（并入 P1）。目标带 2—4 是教学阈值常量，前端暂硬编码并注明出处；`byType` 增强等 Amy 的 N1 |
| **F7** | 词汇卡：词 / 音标 / 释义 / 例句 / 首次出现课 / **是否曾是错词** | `words.html` | `/api/vocabulary`（前 5 项**已有**）+ 错词关联 | 前 5 项已有；「是否曾是错词」需 vocabulary↔mistakes 关联，**无接口** | **A⁻**（先做前 5 项；错词标记留占位，有接口再补） |
| **F8** | 阅读列表：按日归档，显示当天是否已生成 + 篇目 + 理解题 | `reading.html` / `readIndex.html` | `/api/readings`（`{date, pieceCount, titles[]}`）+ `/readings/:date` | be-dev 已承诺，排 **P1-2**；「当天是否已生成」可由列表里该 date 是否存在直接判断，另有 `POST /readings` 同日 409 兜底 | **C**（= 本文 P4） |
| **F9** | 上节课 Amy 决策回执：`nextRecommendation` + 本课是否按它执行 | 首页 / 课程详情 | `nextRecommendation` | Amy 的 **N6**：需 `POST /study-records` 带 `payload.nextRecommendation` + 快照；后端方案里明确「现有 payload 无任何一条含该字段，只能返回 null」 | **C**（占位） |
| **F10** | 本课 `expectedMistakes` 预警条（提交前可见） | 作业页（同 F4，当前不存在） | `LessonPlan.expectedMistakes` | 同 F4，库里没有 | **D** |

### 8.3 F4 需要单独决策（我不自行拍板）

F4 是 F1—F10 里**唯一不属于「把现有页面改成 API 驱动」**的一条：现在的 11 个页面里**没有作业提交页**，也没有任何作业/练习的写路径。要做成「勾选后才允许提交」，前端需要三件都齐：

1. `selfChecks` 有地方存、有接口取 —— 现在它由 Amy 的规则产出、落在 `LessonPlan`（`docs/schemas/lesson-plan.schema.json`），**Skill 产物 → 后端 → 前端**这条链还没通（skill-designer 产出 + be-dev 建接口）。
2. 作业提交动作存在 —— 需要写接口（作业作答/批改回写），目前只有 `POST /api/lessons` 归档在 be-dev 的 P1。
3. 一个新页面（作业作答页），属新增页面而非迁移。

**我的建议（分两步，请 Amy 与项目负责人认可）**：
- **F4-a（可随 P1 做）**：在课程详情页把本课 `selfChecks` **逐条列出作为「提交前自查清单」**（只读展示，学生照着检查），数据有接口后接、无接口时读 `sections` 里的 `homework` 段文本降级。
- **F4-b（等依赖齐）**：真正的「闸门」—— 有提交动作可拦时才做勾选校验。

### 8.4 对 Amy 三条约束的回应

1. **不显示百分制分数** —— 完全接受。前端本来就没有百分制数据源（唯一分数量口径是错误处数，与后端一致），会在组件层统一：分数类展示只接受「错误处数」输入。
2. **`review/index.html` 会被 `build_board.py` 覆盖** —— 与我方案的 **Q1** 是同一件事（§7）。已按 Amy 要求去信 skill-designer 确认归属；**在归属确定前不动任何页面**（含 `index.html` 的未提交改动）。
3. **缺接口处保留占位而非报错** —— 与本文 §5.2 四态设计一致，`index.html` 现有的「阅读篇数 = `—` + title 说明」正是标准做法，会抽成公共组件供 F1/F5/F8/F9/F10 复用。

### 8.5 由 F1—F10 新增出来的后端需求（已发给 be-dev）

| 编号 | 需求 | 对应 Amy 条目 | 与已有需求的关系 |
|---|---|---|---|
| **FE-1** | `GET /api/lessons/:id/exercises`（`exerciseType` / `userAnswer` / `verdict` / `errorType` / 开放题 `revisedFull`） | F5 | = Amy 的 **N4**（P1），我确认前端要，请排进去 |
| **FE-2** | `selfChecks` 与 `expectedMistakes` 的存储与读取位置（建议挂在 `lessons` 或 `lesson_sections` 上，或随快照返回） | F4、F10 | 新提出；Amy 的 N5/N6 未覆盖 |
| **FE-3** | `/api/vocabulary` 增 `wasMistake`（是否曾是错词）或返回错词词表供前端关联 | F7 | 新提出，低优先 |
| **FE-4** | 确认 `/api/readings` 列表能否用于判断「当天是否已生成」（列表按日期倒序，取首条 date 比对今天） | F8 | 与 be-dev 已承诺的 readings 接口同源，只需确认语义 |

**前端可自行消化、无需后端配合的两项**：距今天数（由 `lastClassDate` 现算，Amy 的 N9 可不必做）、目标带 2—4（前端常量 + 注明出处）。

---

## 9. 本方案的边界声明

- 本文件为**方案**，截至成稿未修改 `review/` 下任何文件；`review/index.html` 的未提交改动保持原样。
- §8 为收到 Amy 的 F1—F10 后补写（2026-09-29），同样未动代码；F4 因属新增功能，已单独提请决策，未纳入 P0—P4。
- 第 1 节的页面数据来源结论来自**逐文件读代码**（`fetch` 全库检索仅 `index.html` 命中），非抽样推断。
- 第 4 节中标注 ⏳ 的条目**尚无后端答复**，P3/P4 在答复到达前不得开工。
- 第 3 节的验证方式沿用联调报告已验证可用的两套手段；**尚未为本方案新建任何测试脚本**【未验证】。

---

## 10. 实施记录（2026-09-29，P1/P2 落地）

> 本节记录**已实施**的内容与**已裁决**的决策，作为 §9 的后续。证据标注沿用第 0 节。

### 10.1 已交付（真机验证通过）

共享层与四个页面已落地，并用 `playwright-core + msedge headless` 真机断言：
`backend/scripts/verify-frontend-shared.js` **35/35 通过**、`backend/scripts/verify-frontend-pages.js` **47/47 通过**（可见性一律 `getComputedStyle(el).display`，含 F5 陷阱复现测试）【实测；数字以 2026-09-29 18:47 team-lead 独立复跑为准，本轮因新增 P3 题量/答对/答错文案断言由 43 增至 47】。

| 项 | 文件 | 说明 |
|---|---|---|
| 共享层 | `review/assets/{api.js,ui.js,board.css}` | `api.js` 增 `lessonIndex()`（优先 `/lessons/all`，失败回退分页全量）；`ui.js` 错词卡来源 null 显示 `—`（不再打「诊断」标记，Amy 裁定）|
| P1 词汇 | `review/words.html` | API 驱动，口径 **51**（顶部标注「按单词去重」），byLetter 分组 |
| P1 错词 | `review/wrong.html` | F2 四项硬指标 + 状态/类型筛选；**P3 复习打卡**（`/mistakes/pending` 默认序、`POST /mistakes/:id/review` 带 `clientEventId`）|
| F6 | `review/index.html` | `/lessons/error-trend?limit=6` 迷你图 + 目标带 2—4 |
| P2 | `review/lessons/lesson.html`（新增） | `?no=N` 参数化；8 节按契约顺序渲染；折叠按 Amy（桌面展开 语法/例句/作业/批改，移动端只展开批改；一键全展开 + `#sec-*`/`?open=all` 深链）；**F10 `expected_mistakes` 不渲染、不留不可见占位** |

### 10.2 Q5 裁决：旧 URL 保留静态兜底，不收成跳转【已裁决，team-lead 批准】

`lesson-1..6.html` **保持静态页，不改成跳转**。理由【推断，基于实测】：
- 库内 `lesson_sections` 目前只有 `grammar`+`feedback` 两类（缺口 G-2），`lesson.html` 其余 6 节渲染为 `.missing` 占位，占位内提供「查看静态版全文」链回 `lesson-N.html` 兜底。
- 若把 `lesson-N.html` 改成跳转，该兜底链会**指回自身形成死循环**，且 6 节正文（复习/词汇/例句/作业/我的作答/批改）**彻底不可达**。
- 待 be-dev 回填 `lesson_sections` 正文后，再决定是否收成一行跳转（届时改动极小）。

> **2026-10-01 复议（第五轮）**：项目负责人据「6 个孤儿静态页」的转述拍板删除，但前端实测证明**前提不成立** —— `lesson.html:143/174` 运行时拼接 `href="lesson-<lessonNo>.html"`（literal grep 查不到），且因 `selfChecks` 全缺（G-2），**7 课每课都渲染该兜底链**。1—6 课目标文件均 EXISTS → **删除会产生 6 个 404，故不删**；第 7 课目标 `lesson-7.html` 不存在 → **死链缺陷 F-L7**。详见 §11.9.3。

### 10.3 已修正的错误前提：F4-a 的数据源

原方案 §8.3 认为 F4-a 可走「现有 `GET /api/lessons/:id` 的 `exercises[].selfCheck`，不需要新接口」。**该前提实测不成立**【实测】：
- `GET /api/lessons/:id` 返回字段不含 `exercises`（仅 `sections` + `vocabulary`）；
- `GET /api/lessons/1/exercises` 返回 404；
- `backend/docs/05-api-reference.md` 全文无 `selfCheck`。

**正确落点**：`selfCheck` 属 `lesson_exercises.self_check`（be-dev 方案的 P0 表）。故 F4-a 的真实阻塞是**建表 + M2 数据导入**，不是缺接口。
**处置**：`lesson.html` 的「提交前自查清单」区块**保留并显式标注**「自查清单数据未入库」，**不编造数据、不隐藏**（Amy 约束 3 与 §5.2 无静默失败）。

**⚠️ 复核实测（2026-09-29 第二批 DDL 落地后）：`selfCheck` 目前仍无持久化路径。**
- Skill 契约 `docs/schemas/exercise-set.schema.json`：每题带 `selfCheck`（string）【实测】。
- 落库契约 `docs/schemas/lesson-record.schema.json` 的 `ExerciseRecord`：**无 `selfCheck`**（properties 仅 exerciseNo/exerciseType/prompt/referenceAnswer/userAnswer/isCorrect/revisedAnswer/errorNote/targetPoint）【实测】。
- DB `backend/db/schema.sql` 的 `lesson_exercises`：**无 `self_check` 列**；`GET /api/lessons/:id/exercises` 的 SELECT 亦不含该列【实测】。
- 结论：`selfCheck` 只在 Skill 侧 `ExerciseSet` 中存活，**转成 `LessonRecord` 落库时被丢弃**，库里存不下、接口取不到 → F4-a 链路在「产出 → 落库」之间断裂。
- 需补：① skill-designer 给 `ExerciseRecord` 增 `selfCheck`（optional，按「加 optional 不升版本」）；② be-dev 给 `lesson_exercises` 增 `self_check` 列（DDL 顺序 `schema.sql`→`constants.js`→schema JSON）+ 接口 SELECT 补列 + M2 导入写入。
- 前端已**前瞻适配**：`lesson.html` 会顺带请求 `/lessons/:id/exercises`，一旦该字段落库即自动渲染真实自查清单，无需再改前端【实测：当前返回空 `list`，仍走占位】。

### 10.4 已接入：`lastRecommendation`（替代 `progress.note`）

`review/index.html` 的「为什么今天学这个」改读 `GET /api/agent/snapshot` 的 `lastRecommendation`（形状 `{lessonNo, text}` 或 `null`）：
- 文案标注「出自第 N 课的课后反馈（当时的建议，非当前实时判断）」——该字段是**快照语义**（缺口 G4），不得当作当前建议；
- **无数据（`null`）或请求失败时整块不渲染，不留空白框**（不打扰主流程）【实测：当前 `lastRecommendation` 恒为 `null`，故 `#whyBlock` 为空】；
- 不再展示 `progress.note` 原文（符合 Amy 裁定）。

### 10.5 P3 复议文案与题量：已按 Amy 原文实现【已办，实测】

文案取自 `docs/plans/amy-teaching-plan.md §B.3.1 L616—618`（非我自拟），已在 `review/wrong.html` 落地并真机断言（用 `page.route` 打桩拦截 `POST /mistakes/:id/review`，**不触碰数据库**）：

- 答对：`✅ 答对了 · 连续答对 {streak}/2`；`streak ≥ 2` 追加 `—— 已过关，退出复习队列`。
- 答错：`❌ 又错了 · 连续答对清零`；必须追加 `这是第 {wrongCount} 次犯，上次在第 {lastLessonNo} 课`。
- 题量（§B.3.1 / §2.5）：`D = 距上次上课天数`（由 `/progress.lastClassDate` 现算）；`D ≤ 2 → 5 题`、`D = 3—6 → 7 题`、`D ≥ 7 → 8—10 题`。**`D ≥ 7` 是区间，前端暂取区间下限 8**，待 Amy 定死具体值。

**⚠️ 一处需团队核对的口径冲突（已上报）**：
team-lead 转述为「**不展示「是否有诊断」标记**」，而 Amy 原文 `§B.3.1 L619` 明确「展示『来源』时为空显示 **`诊断`**，不显示 `—`」。二者对「来源为空时如何显示」冲突。
**处置**：按「教学呈现以 Amy 判断为准」（§8 前言），`ui.js` 回到 **null → `诊断`**（`来源 诊断`），并已请 team-lead 复核。

### 10.5.1 后端进展（本轮实测复核）

- `/mistakes/stats` 已为 **19/15/4**（D-7 删 `id=19` 已执行，且我此前的探针事件已回滚）【实测】。
- `/lessons/:id/exercises` **已上线（200）**，但当前返回空 `list`（表已建、M2 数据未导入）【实测】—— F4-a 仍无数据，占位保留。
- `lesson_sections` 仍只有 `grammar`+`feedback`（G-2 未回填）【实测】。

### 10.6 生成脚本处置（§D-1 落地）

`build_board.py` **退役 HTML 生成**：`main()` 的 `outputs` 只保留 `INDEX.md` / `digest.md`，删除 `review/*.html` 输出与「unlink 后重写 lesson-N」逻辑（否则下次 Skill 重建会静默覆盖前端改造，即 §1 F-A / R-1）。
两份副本已同步且 md5 一致（`07db49fd082212734ce5d4f22441f385`）：运行时 `.workbuddy/skills/english-daily/scripts/` 与受控 `skills/english-daily/scripts/`。

### 10.7 本轮未做（明确声明）

- `reading.html` / `readIndex.html` **未迁移**：`GET /api/readings` 仍 404（P4 阻塞）；Amy 关于阅读的裁定（去掉 iframe、中文默认隐藏、先答再看答案、生词注释不跳转）**尚未实施**。
- 课程详情 6 节正文仍为占位（G-2）。
- F4-a 真实数据（待建表 + M2 导入）。

---

## 11. 实施记录（2026-09-30，P4 阅读模块迁移）

> 背景：be-dev 已交付 `GET /api/readings`、`/readings/stats`、`/readings/:date`（`05-api-reference.md` §24—26），并宣布 **R1 可接**（`docs/skills.md` §8.2）。本节记录前端已落地内容、**待验证项**与需后端配合项。

### 11.1 已交付

| 文件 | 动作 | 说明 |
|---|---|---|
| `review/reading.html` | 重写 | 改为 API 驱动：日期清单 `/readings`（倒序）→ 默认最新一天；当天全文 `/readings/:date` 渲染卡片。**保留**左目录 iframe、左右箭头 + 键盘 ←→、`#date` 深链、`postMessage` 联动、整篇看中文、生词注释、理解题折叠 |
| `review/readIndex.html` | 重写 | 目录改为 `/readings` 驱动（日期 + 篇数 + 篇名 tooltip）；保留 `reading-select` / `reading-active` / `reading-toc-height` 三通道；独立打开仍跳 `reading.html#日期`；**删除**从旧看板脚本抄来的死代码（`nav button` / `main section` / `.wcard` / `#q` 段）|
| `review/assets/board.css` | 追加 | 阅读板块样式（`.reading-layout` / `.stage-*` / `.navbtn` / `.rcard` / `.rtoc-item` / `body.rtoc-embed`）；按 §6.3 硬规则显式声明 `.rcard.hide` |
| `review/index.html` | 改 1 处 | 「阅读篇数」由占位 `—` 改为 `/readings/stats` 的 `pieceCount`；`title` 附带「读了 N 天 ｜ 最近日期 ｜ 连续天数 ｜ 今天已读」 |

实现要点（与共享层约定一致）：
- 取数只经 `API.getPage` / `API.get`；渲染走 `UI.esc` / `UI.stateHTML` / `UI.partError` / `UI.onRetry`，无新增内联样式与重复封装。
- 四态齐全：Loading / Error（横幅 + 重试，局部降级不整页报错）/ Empty（还没有阅读、这一天没有内容）/ 正常。
- 按日期缓存（`cache[date]`），目录来回切换不重复请求；「整篇看中文」改**事件委托**（旧版逐卡绑定，卡片动态渲染后会失效）。
- 卡片结构沿用静态版（`第 N 篇 · 标题` / 级别 ｜ 来源 ｜ 词数 / `.pairs` 英中对照 / 生词注释 / 理解题 `<details>`）。

**错误态实测：10/10 通过**【实测】——后端未启动（端口 4000 空）时：三个页面均无 JS 运行时错误；阅读页横幅显示「阅读加载失败：Failed to fetch（请确认后端服务是否在运行）」、正文区给失败提示且**不残留假卡片**；目录页给失败提示 + 重试按钮；首页「阅读篇数」降级为 `—` 且 `title` 说明原因，其余统计卡不受影响。截图：`.workbuddy/tmp/r1-error-state.png`。

### 11.2 ⏳ → ✅ 正常链路真机验证（2026-09-30 第三轮已执行，29/29）

**状态：已闭环。** 后端 4000 在线（`curl /api/health` = 200，按端口所有权约定**未启动/未停止任何服务进程**，测试为纯 GET 只读），`.workbuddy/tmp/e2e-reading.js up` → **29/29 通过**。错误态另新增 `--fail` 模式（`page.route('**/api/**', r => r.abort())` 主动断网模拟，**不再依赖端口恰好为空**，后端在跑时也可随时复跑）→ **11/11 通过**。

- 真实数据核对：看板阅读篇数=11、title「读了 4 天 ｜ 最近 2026-09-29 ｜ 连续 4 天」；首篇「第 1 篇 · Yesterday」Level 2 / 自编 / 43 词 / 3 段英中对照（zh 默认隐藏）/ 生词注释内联 / 2 道理解题均带答案折叠；同页目录 4 天 + `.on` 高亮唯一；逐日遍历 4 天累计 **11 篇 = `stats.pieceCount`**（内容零丢失）；`#2026-09-26` 深链命中 2 篇；作答 localStorage 刷新后仍在。
- F8 真实分支：today（09-30）≠ lastReadDate（09-29）→ 正确显示「今日阅读尚未生成，最近一次：2026-09-29」。

### 11.3 需后端配合 / 确认（本轮新增，编号接 §4.1）

| # | 事项 | 需要谁 | 状态 |
|---|---|---|---|
| **V1** | 后端启动后跑一次 §11.2 的正常链路验证 | be-dev → **已由前端 2026-09-30 第三轮执行**：后端 4000 在线（`health=200`，未动服务进程，纯 GET 只读），`.workbuddy/tmp/e2e-reading.js up` → **29/29 通过**【实测】。真实数据要点：首篇「Yesterday」Level 2 / 自编 / 43 词 / 3 段英中 / 2 道理解题均带答案；F8 走「尚未生成」分支（today=09-30 > lastReadDate=09-29）；逐日遍历 4 天累计 11 篇 = `stats.pieceCount`；`#2026-09-26` 深链命中 2 篇 | ✅ 已闭环 |
| **C6** | ~~`questions[].answer` 为 `null` 时只渲染题干、「暂无答案」~~ → **amy 已裁定（`docs/ai-teacher.md` §11.10，2026-09-30）**：`answer` 为空**不是合法状态、属数据缺陷**，前端不得渲染成功能。已按裁定改造：不出「看答案」按钮 + 文案改中性缺陷提示「参考答案缺失（数据异常，已记录）」+ `console.warn` + 登记 `window.__readingDefects`【实测见 §11.8】 | amy ✅ / 前端已实现 | ✅ **已闭环** |
| **C7** | 「今天是否已读」前端按 `lastReadDate === today` 自判（契约 §24 明确接口不下结论），已按契约实现 | be-dev | ✅ 按契约实现，仅备案 |
| **C8** | ~~`POST /api/readings` 未开放 → 前端无阅读写入口~~ → **be-dev 已于 2026-09-30 下午开放**（`05-api-reference.md` §27，201 / 409 / `?force=true`）。前端本轮**仍不做写入口**（阅读由教学侧产出，属 amy→后端链路），如后续需要再议 | be-dev ✅ / 前端待议 | ✅ 接口已开放 |
| **C9** | 阅读数据是 `read/*.md` 回填结果；若与 md 原文出现不一致，以哪边为准需明确（前端只读 API） | be-dev / amy | ⏳ 待确认 |
| **C10** | 首页取值口径：用 `pieceCount` 作文案「阅读篇数」、`totalDays` 与 `currentStreakDays` 放 `title`（对齐 §4.1 的 D3） | be-dev | ✅ 已按 D3 暂定实现，待最终确认 |

### 11.4 与 Amy 裁定的关系（**已按裁定落地**，2026-09-30 第二轮）

`§10.7` / `amy-teaching-plan.md §B.3.4` 记录 Amy 的阅读裁定四条：① 去掉 iframe 改同页渲染；② 中文翻译默认隐藏、某篇无中文时按钮**置灰**（非消失）；③ 理解题「先答再看答案」，作答仅前端本地留存、**暂不落库**；④ 生词注释内联、不跳词汇页。

**本轮已全部落地**（详见 §11.6）。此前项目负责人要求保留 iframe 的「伪前后端关联」结构，与裁定① 冲突；本轮**按裁定① 去掉 iframe**。

> 副作用：`review/readIndex.html` 自第二轮起不再被任何页面引用（孤儿页）。**2026-09-30 第三轮：项目负责人确认「如果确认无用的话，就删除」，已删除该文件**（删除前备份 `.workbuddy/tmp/deleted-20260930/readIndex.html`，git 回滚点 `18749e1`）。同批清理 `board.css` 的 `body.rtoc-embed*` 死样式；`.rtoc-item` / `.rtoc-title` 仍被同页目录复用，未动。历史文档（`03-api-contract.md` / `backend-analysis.md` / `changelog.md` / `skill-plan.md` 等）中的 `readIndex.html` 引用属历史记录，未逐一改写。

### 11.5 本轮未做（明确声明）

- 其余页面（`words` / `wrong` / `lessons`）本轮无改动。

### 11.6 amy 裁定落地（2026-09-30 第二轮，前端）

> ⚠️ **§11.6 的「可见 3 篇」描述已被第三轮推翻**：第二轮把 `render()` 的过滤键写成了 **日期**，导致选定某天后当天全部堆叠显示。第三轮已改为按 **篇序号** 过滤（见 §11.7），mock 与真机断言同步更正。

| 文件 | 动作 | 说明 |
|---|---|---|
| `review/reading.html` | 重写 | **去掉 iframe**，左侧目录改为同页渲染（`<nav class="rtoc-list" id="tocList">`，`/readings` 驱动，点击切日期 + `.on` 高亮跟随）；删除全部 `postMessage` 收发与高度同步代码 |
| — | 新增 | 裁定②：`paragraphs` 全无 `zh` 时渲染 `<button class="zhbtn" disabled title="本篇没有中文对照">`（**置灰可见**，非隐藏） |
| — | 新增 | 裁定③：理解题题干下加 `<textarea class="qans" data-key="date#pieceNo#questionNo">`（先作答），答案仍走 `<details class="qbox">`；作答存 `localStorage['reading-answers']`，**不写库**；`answer` 为 `null` 时只渲染题干 + `暂无答案`，不给折叠 |
| — | 保留 | `postMessage` 之外的硬要求：F8「今日是否已生成」提示（`#todayNote`，按 `/readings/stats` 的 `lastReadDate === today` 分 `ok` / `miss` 两态）、键盘 ←→、`#date` 深链与 `hashchange` |
| `review/assets/board.css` | 追加 | `.rtoc-list`、`.f8note`（含显式 `.f8note.hide{display:none}` 兜底，遵 §6.3 硬规则）、`button.zhbtn:disabled`、`.vnotes`、`.qitem` / `.qtext` / `.qans` / `.qfoot` / `.qbox` / `.qansbox` / `.qnoans` / `.qhint`；删除失效的 `.reading-toc iframe` 规则 |

**验证**【实测 + 静态证据】：
- 错误态真机（后端离线）：`.workbuddy/tmp/e2e-reading.js down` → **13/13 通过**（第二轮口径；第三轮起 readIndex 断言随文件删除移除，改为 `--fail` 路由 abort 模式 11/11）。
- 渲染层等价验证（**路由拦截喂假数据**，不依赖后端）：`.workbuddy/tmp/e2e-reading-mock.js`（第三轮重写为 **28 项**断言，含「一次只显示一篇」核心口径）→ **28/28 通过**。
- **修正**：早期 `--up` 脚本断言「DOM 内 11 篇」有误——页面**按天懒加载**，DOM 只含当天卡片；已改为「当天 3 篇 + 逐日遍历累计 11 篇」。
- ⏳ ~~仍缺：后端在线后的真机正常链路~~ → 已在第三轮闭环（§11.2，29/29）。

### 11.7 第三轮：单篇翻页口径修正 + 删除 readIndex.html（2026-09-30，前端）

**触发**：用户实测反馈两点 —— ①「readIndex.html 如果确认无用的话，就删除」；②「我指的左右切换你没有实现……你现在的页面是一整个页面显示当日全部的阅读了」。

**根因（前端实现错误）**：第二轮 `render()` 的 `.hide` 过滤键写成了 **`data-date`（日期）**，`curIdx` 只驱动计数与按钮禁用态，不驱动可见性 → 选定某天后当天 3 篇全部堆叠显示。正确口径是**按篇序号过滤**。

| # | 改动 | 说明 |
|---|---|---|
| 1 | `render()` 过滤键 `data-date` → **`data-idx`** | `pieceHTML(p, date, idx)` 增第三参并写 `data-idx`；可见性 = `Number(c.dataset.idx) !== curIdx` → **一次只显示一篇**；`curIdx` 由侧边箭头 / 底部按钮 / 键盘 ←→ 共同驱动 |
| 2 | 新增**底部翻篇栏** `.stage-foot` | 用户提议「下方插入一个下一篇的按钮更好一点的话可以插入」→ 采纳：`← 上一篇 ｜ 第 N / M 篇 ｜ 篇名 ｜ 下一篇 →`，与侧边箭头、键盘三路同步禁用态；长文章滚出视野时仍可翻页 |
| 3 | 切篇后 `scrollToStage()` | 文章长时翻页后回到正文顶部（`scrollIntoView({block:'start'})`）；目录点击切日期同样触发 |
| 4 | **删除 `review/readIndex.html`** | 用户确认后执行；备份 `.workbuddy/tmp/deleted-20260930/`，git 回滚点 `18749e1`；同批清掉 `board.css` 的 `body.rtoc-embed*` 死样式 |
| 5 | `.stage-body` 改 `align-items: flex-start` | 侧边箭头固定在卡片顶部附近（原 `center` 在长文时箭头落在屏外）；`navbtn` 加 `margin-top:10px` |
| 6 | 选中日期重置 `curIdx = 0` | 目录点击 / hash 深链 → 都从该天第 1 篇开始 |

**验证**【实测，三级全绿】：
- 渲染层 mock（离线）：`.workbuddy/tmp/e2e-reading-mock.js` → **32/32**，核心断言 =「DOM 3 篇 / 可见 1 篇」「默认第 1 篇」「右箭头 → 只显示第 2 篇」「底部『下一篇』→ 只显示第 3 篇且禁用」「键盘 ← 切回第 2 篇（不是回第 1 篇）」「第 1 篇再按 ← 不越界」「目录点击切日期回到第 1 篇」「每天恰好 1 篇可见 + 卡片累计 11」+ §11.10 四项（无按钮 / 中性文案 / console.warn / 缺陷登记）。
- **真机正常链路**（后端在线，纯 GET 只读）：`.workbuddy/tmp/e2e-reading.js up` → **29/29**（§11.2，V1 闭环）。真实数据：第 2 篇「Tom's Bad Day」26 词 / 2 道理解题；底部计数「第 2 / 3 篇 ｜ Tom's Bad Day」。
- 错误态（`--fail` 路由 abort，后端在跑也可复跑）→ **11/11**（readIndex 断言随删除移除）。
- 截图：`.workbuddy/tmp/r1-reading.png`（第 2 篇单卡 + 底部翻篇栏，真实数据）。

### 11.8 阅读理解题「答案为空」口径落地（2026-09-30 第四轮，前端）

**依据**：`docs/ai-teacher.md` §11.10（amy 裁定：「`answer` 为空不是合法状态，属数据缺陷，前端不得把它渲染成一种正常功能」）。**amy 明确「口径已写在 §11.10，不用再来回确认」→ 本轮不再回问，直接落地。**

| # | 改动 | 说明 |
|---|---|---|
| 1 | **去掉空答案时的按钮** | `hasAnswer(q)` = `typeof q.answer === 'string' && q.answer.trim() !== ''`（顺带把**空串/纯空白**也纳入缺陷分支，原 `if (q.answer)` 会把 `'  '` 当有答案）；无答案题**不渲染 `<details class="qbox">`**，只留提示 |
| 2 | **换文案** | 「暂无答案」→ **「参考答案缺失（数据异常，已记录）」**。§11.10 明确「不要写成像功能名的『暂无答案』——那会把缺陷正常化」 |
| 3 | **加 `console.warn`** | `console.warn('[reading] 理解题参考答案缺失（数据缺陷，非功能）', {date, pieceNo, questionNo})`；同一缺陷在一次页面会话内只报一次（`seenMissing` 去重，避免切日期来回刷屏） |
| 4 | **向上报缺陷** | 除 `console.warn` 外另登记到 `window.__readingDefects`（结构 `[{date,pieceNo,questionNo}]`），给上报/自动化排查一个可观测出口 |
| 5 | CSS | `.qnoans` 由灰色小字改为**中性缺陷 chip**（`#8a6d1f` / `#fdf8ec` / `#ecd9a6`，与 `.f8note.miss` 同调），克制但可见 |

> §11.10 另要求「该题**不计入**任何『看答案』交互统计」——当前前端**无此类统计**，天然满足（如将来引入，需排除 `.qnoans` 所在题）。

**验证**【实测 + 静态证据】：
- 渲染层 mock → **32/32**，新增 4 项：无答案题**无** `details.qbox`（两题中仅第 1 题有）；文案严格匹配「参考答案缺失（数据异常，已记录）」且**不含**「暂无答案」；`console.warn` 捕获到含 `2026-09-29` 的记录；`window.__readingDefects` = `[{date:'2026-09-29', pieceNo:1, questionNo:2}]`。
- 错误态 → **11/11**（无回归）。
- **真实数据无缺陷（静态证据）**：`read/*.md` 的 `<details>` 折叠数 = 4/6/6/6 = **22**，与库内 `reading_questions` **22 题**逐一对齐 → 源数据每道理解题都有答案。真机 `.up` 脚本已加断言「真实数据无 `.qnoans`、无告警」。
- ✅ **真机已闭环（2026-10-01 第五轮）**：后端上线后跑 `e2e-reading.js up` → **31/31**（脚本已改数据驱动，见 §11.9）；§11.10 断言「全部 5 天 14 篇内无 `.qnoans`」通过，`missingTotal=0`（真实数据无缺陷）。

### 11.9 第五轮：E2E 数据驱动化 + `lesson-1..6.html` 删除决策纠正（2026-10-01，前端）

**触发**：① be-dev 请求复核 `d868401`（其最小防御性修复动了 fe-dev 的共享层 `ui.js`）；② 项目负责人转述「`lessons/lesson-1..6.html` 是 6 个孤儿静态页，建议删除」并拍板「删除」。

#### 11.9.1 `d868401` 复核（`review/assets/ui.js` · `renderMarkdown` 死循环修复）→ **修复正确**

| 项 | 结论 |
|---|---|
| 缺陷 | 段落终止条件正则 `/^\s*(\||>\|-|\*)/` 比三个分支判定**宽**，`---` / `**加粗**` 行命中段落分支却被挡下 → `i` 不前进 → `out` 无限增长 → `RangeError: Invalid array length`（课程详情页 1—7 课整页崩）|
| 修复（`d868401`） | 谓词抽成单一来源 `isTable/isQuote/isList`，段落终止改用同一组谓词；并加「`para` 为空则**强制前进一格**」兜底 |
| 复核结论 | ✅ 正确。根因是「判定谓词两套不一致」，修复做法（同源 + 必定前进兜底）与既有立下的「任何 while 解析循环都要有『必定前进』兜底」一致 |
| 我补的回归测试 | `backend/scripts/verify-frontend-shared.js` 新增 4 个 `renderMarkdown` 回归输入（`---` 独占行 / `**加粗**` 开头 / `-没有空格` / 混合），套件 **35/35 → 36/36** |
| 负向验证 | 在把 `renderMarkdown` 还原成缺陷版的前端副本上，同一套件正是以 `RangeError: Invalid array length at renderMarkdown (ui.js:272)` 崩掉 → 证明新断言能抓住该缺陷 | 
| 基线独立复跑 | `verify-frontend-shared.js` 35/35→**36/36**（改后）、`verify-frontend-pages.js` **47/47**（未动），均**未启动/未停止任何服务进程**（纯 file:// + 只读）|

#### 11.9.2 `e2e-reading.js` 数据驱动化（去掉写死常数）

**教训（与 2026-10-01 MEMORY 记录一致）**：断言里写死「4 天 / 11 篇 / 2026-09-29」这类数据常数，**数据一更新就雪崩式失败，且失败全是测试滞后、零应用缺陷**。本轮全部改为「**DOM/前端 === 接口值**」：脚本先直连 `/readings` 与 `/readings/stats` 取期望值（含各天全文用于逐日比对），再按实际日期列表遍历断言，不再抄任何数字。

| 项 | 旧（写死常数） | 新（数据驱动） |
|---|---|---|
| 看板篇数 | `=== '11'` | `=== String(stats.pieceCount)`（当前 14）|
| 看板 title | `/读了 4 天/` | `new RegExp('读了 ' + stats.totalDays + ' 天')`（当前 5）|
| 首篇/段落/题量 | 交替硬编码 | 从 `/readings/:date` 的 `pieces[0]` 逐字段比对（`pieceNo`/`title`/`levelCode`/`paragraphs.length`/`zh` 数/`questions` 数）|
| F8 分支 | 假定「未生成」 | 按 `stats.today === stats.lastReadDate` 判定走哪个分支文案 |
| 逐日累计 | `=== 11` | `=== stats.pieceCount` |
| §11.10 | `qnoans===0` | `qnoansTotal === missingTotal`（由各天全文算出的期望缺陷数）|

**结果**【实测，后端在线、纯 GET 只读，未动 4000 服务进程】：
- `.workbuddy/tmp/e2e-reading.js up` → **31/31 通过**。真实数据：5 天 / 14 篇 / 最新 `2026-10-01`（首篇「My Last Weekend」Level 2 / 自编 / 38 词 / 3 段英中 / 2 道理解题均有答案）；F8 走「**已生成**」分支（`today === lastReadDate === 2026-10-01`）；逐日遍历 5 天累计 14 篇 = `stats.pieceCount`；`#2026-09-26` 深链命中 2 篇。
- `.workbuddy/tmp/e2e-reading.js fail`（路由 abort 模拟断网）→ **11/11 通过**（无回归）。

#### 11.9.3 `lessons/lesson-1..6.html` 删除决策 → **纠正为「不删」，并上报第 7 课死链**

**我此前的侦察错误（须留存为戒）**：曾用 `grep -rn "lesson-[1-6]\.html" review/` 得零命中 → 判为孤儿页并建议删除。**该判定错误**：`review/lessons/lesson.html` 第 **143 / 174 行**是**运行时拼接**（`href="lesson-' + lesson.lessonNo + '.html"`），literal grep 天然查不到。

**决定性实测**（`playwright-core` 渲染 1—7 课详情页，读 `#lessonBody a.plain` 的 `href` 并校验磁盘存在性）：

| no | 渲染出的 href | 目标文件 | 结论 |
|---|---|---|---|
| 1—6 | `lesson-1..6.html` | **EXISTS** | **链接真实生效，不可删** |
| 7 | `lesson-7.html` | **MISSING(404)** | **死链缺陷，需修复** |

**为什么 7 课**都会渲染该链接**：`renderSections` 在任一 `ORDER` 小节缺失时给静态版入口；更关键的是 `renderSelfCheck` —— 库内 `selfChecks` **7 课全为 0**（缺口 G-2：`selfCheck` 在 `lesson_record` 落库时被丢弃），故**每一课的「提交前自查清单」区块都渲染「查看静态版全文」**。第 7 课无 `lesson-7.html` → 该链接 404。

**处置**：
- **不删除 `lesson-1..6.html`** —— 它们是课程详情页「查看静态版全文」兜底的**真实目标**，删除会造成 6 个 404；删除前提（「孤儿页」）**不成立**。已向项目负责人回报证据并请复议。
- **新增缺陷 `F-L7`**：`lesson.html` 对第 7 课渲染 `lesson-7.html` 死链。修法二选一（待拍板）：① 补 `lesson-7.html`（与 1—6 同构，从 `notes/` 生成）；② 让兜底链**仅在目标存在时渲染**（前端无法探测 `file://` 存在性，需改契约或后端提供 `hasStaticFallback`）。**未擅自改动**。

#### 11.9.4 2026-10-01 复核补记（D1 / D2 / D3）

- **D3 已复核定案（项目负责人指派 fe-dev 接手）**：`review/` 下 4 个「大改动」（`index.html`、`lessons/lesson.html`、`lesson-4.html`、`lesson-6.html`）经**剥空白指纹法**比对，与 `HEAD` **4/4 完全一致** → **纯格式重排（HTML 美化）、零语义变更**。
  - ⚠️ **我最初的判断有误，已更正**：起初用 `git diff --ignore-cr-at-eol` 看到 144/130、237/176、648/155、666/154 的大差异便判为「内容重写」—— 该法只忽略**行尾符**，对「重排缩进 / 拆行」照样报全文件差异。**格式噪声 vs 语义改动只能用剥空白指纹法判定**（此法在 `MEMORY.md` 已有记录，此次是我未先查口径就下判断）。详见 `docs/Work Alignment/前端工程师-工作状态.md` §8.3。
- **D1 / D2 备注**：详见 `docs/Work Alignment/前端工程师-工作状态.md` §8.4。要点：**后端从未告知「这些静态页是残留垃圾」**；相反，`be-dev-status.md` §5.2 **P6** 与本节 **§10.2（team-lead 批准的 Q5 裁决）** 双双裁定「**保留 1—6 静态页**」。根因是**后端数据缺口 G-2**（`selfCheck` 落库被丢、`lesson_sections` 曾不全）→ 兜底链一直被渲染。**删除的正确前置是「补齐 G-2」，而非现在删。**
- **第 7 课实测（复核负责人观察）**：`review/index.html` 课程卡 → `lessons/lesson.html?no=7`（API 驱动）→ 渲染 **10 个小节**、标题「第 7 课 · 2026-10-01」、**0 个 JS 错误** → **内容完整可看**；唯一缺陷是 `.missing` 自查块内的 `lesson-7.html` 死链。故 **D2 建议采纳 ②（去掉/条件化兜底链），不补 `lesson-7.html`**。
