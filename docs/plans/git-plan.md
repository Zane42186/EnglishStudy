# Git 版本管理方案与仓库体检报告

> 编制：Git / 版本管理工程师（git-manager）
> 日期：2026-09-29
> 范围：`E:\English` 仓库体检 + 多 Agent 协作版本策略
> **本文档为体检与方案，编制过程未执行任何写操作**（仅 `status / log / diff / branch / ls-files / remote / check-ignore` 等只读命令）。
> 文中所有「建议执行」的命令均需 team-lead 或用户确认后由人工执行。

---

## 一、仓库体检结果

### 1.1 基本盘

| 项 | 实测 | 说明 |
|---|---|---|
| 仓库根 | `E:\English` | 工作区干净（除 1 个已跟踪文件的修改） |
| 当前分支 | `main`（唯一本地分支） | 无 `develop` / `feature/*` |
| 远端 | `origin → https://github.com/Zane42186/EnglishStudy.git` | 存在，可 fetch/push |
| 提交总数 | 10（`21689ce` … `17af7ab`） | 线性历史，无 merge commit |
| 已跟踪文件 | 98 个 | 全部为 `100644`（普通文件），无子模块/符号链接 |
| tag | **0 个** | 无任何里程碑标记 |
| stash | 0 条 | 无暂存中的工作 |
| 备份分支 | 无 | 仅 `main` 与 `origin/main` |

### 1.2 远端同步状态（重要）

```
git rev-list --left-right --count origin/main...main
→ 0    6
```

- `origin/main` 落后本地 **6 个提交**，本地领先 6 个。
- 远端最新为 `80427d7`（2026-09-27），本地多出的 6 个是 2026-09-29 的「平台化」提交：
  `b25a938`、`b1c20b7`、`4c29813`、`4377603`、`5e96775`、`17af7ab`。
- **风险**：这 6 个提交（含整个 `backend/` 实现、21 个文档的 4321 行新增）只存在于本机磁盘。机器故障 / 误删 `.git` = 全丢失，且无人可恢复。

### 1.3 未提交改动清单

```
git status --short --untracked-files=all
 M review/index.html
```

| 文件 | 改动 | 风险 |
|---|---|---|
| `review/index.html` | +93 / -13（阅读页双栏布局 CSS、词汇卡片、中英切换等） | **中高** |

风险理由：`review/*.html` 是 `build_board.py` 的生成产物。若其他 Agent 或构建脚本再次执行 `build_board.py` 重建看板，这份未提交的手改内容会被**静默覆盖且不可恢复**（没有 commit、没有 stash、没有 diff 备份）。

### 1.4 `.gitignore` 覆盖检查

现有内容（13 行）已正确覆盖：

| 规则 | 实测生效 |
|---|---|
| `.workbuddy/` | ✅ 生效（`check-ignore` 命中第 2 行） |
| `*.zip` | ✅ 生效（根 `english-daily.zip` 被忽略） |
| `.english-daily-package-*/` | ✅ 生效（当前存在 `.english-daily-package-yj7kiobf/`） |
| `node_modules/` | ✅ 生效（`backend/node_modules/` 存在且被忽略） |
| `.env` | ✅ 生效（`backend/.env` 存在且被忽略） |
| `db/_snapshot.json` | ✅ 生效 |

**应加未加的缺口（逐项）**：

| # | 建议新增 | 理由 | 优先级 |
|---|---|---|---|
| G1 | `.env.local`、`.env.*.local` | 当前 `.env` 只匹配**文件名恰为 `.env`** 的文件；`backend/.env.local` 实测 **未被忽略**，一旦创建会带着数据库口令直接入库 | **高** |
| G2 | `__pycache__/`、`*.pyc` | `.workbuddy/skills/english-daily/scripts/__pycache__/` 已存在；Skill 源码入库（7.4）时会把字节码带进仓库 | **高** |
| G3 | `dist/`、`build/`（顶层，排除 `.workbuddy/build` 之外的场景） | 前端迁移到 Vue 后 `vite build` 产物默认落在 `dist/`；当前无任何规则覆盖 | 中 |
| G4 | `*.log`、`logs/`、`npm-debug.log*` | 后端运行日志必然出现（现 `backend/README.md` 未约束日志落盘位置） | 中 |
| G5 | `backend/db/*.sqlite`、`*.sqlite3`、`*.db` | 若后端切换 SQLite 或导出数据文件，会被误提交 | 中 |
| G6 | `.DS_Store`、`Thumbs.db` | Windows/macOS 混用场景常见污染 | 低 |
| G7 | `.idea/`、`.vscode/`（可选） | 编辑器配置是否共享需用户决策；若共享则**不要**加 | 低（待决策） |
| G8 | `*.bak`、`*.orig`、`*.rej` | 手工备份与冲突残留文件 | 低 |
| G9 | `docs/testdata/**/*.tmp`、`docs/testdata/**/*.actual.json` | 黄金样本入库后，测试运行产生的临时/实际产出不应入库（见 6.7） | 中（Skill 建 testdata 后生效） |

补充提示：`*.zip` 是**全局**规则，将来若需要把发布包纳入版本管理（不推荐）会被误伤；现阶段利大于弊，建议保留。

### 1.5 已入库文件异常检查

- `git ls-files | grep node_modules` → **无命中**，未误入依赖包。
- `git ls-files | grep '\.env'` → 仅 `backend/.env.example`（模板文件，入库正确）。
- 无 `.zip` / 打包产物 / `__pycache__` / 日志文件入库。
- 全部文件为 `100644`，无可执行位敏感问题、无超大二进制：最大入库文件为 `docs/skills.md`（75 KB）、`backend/package-lock.json`（38 KB），均在合理范围。

**结论：当前入库范围是干净的，无敏感文件泄漏、无产物污染。**

### 1.6 可回滚性评估

| 维度 | 状态 | 说明 |
|---|---|---|
| 回到历史提交是否安全 | **基本安全，但代价高** | 历史线性、无 merge，任意提交都可 `git checkout <sha>` 重建；但**回到 2026-09-27 之前的任一提交，会连带丢弃 `backend/` 全部实现与 21 个文档**——因为它们只在工作区与本地 `.git` 里 |
| 未被版本控制的关键资产 | **有** | ① `.workbuddy/skills/english-daily/`（Skill 源码 v2.2.0，8 个文件）；② `backend/.env`（数据库口令，仅本地）；③ `.workbuddy/skill-backups/*.zip`（v1.0.0/v2.0.0/v2.1.0 三个历史包） |
| 本地独有提交的持久化 | **无保障** | 6 个提交未 push，无远端副本，无第二块磁盘备份 |
| 未提交改动的可恢复性 | **无** | `review/index.html` 的 93 行新增没有 commit / stash / 补丁备份 |
| 里程碑可锚定性 | **无** | 0 个 tag，无法用 `git describe` 或按里程碑回滚，只能靠哈希 |

**总体可回滚性评级：C（能回滚，但关键资产有不可恢复缺口）**

---

## 二、多 Agent 协作的分支策略

### 2.1 现实约束（决定方案取舍的前提）

1. **只有 1 个人类用户**，5 个 Agent 是同一会话下的并行角色，不是 5 台开发机。
2. 仓库规模小（98 个文件、10 个提交），单体结构，无并行发布需求。
3. 多分支意味着：切分支 → 工作区文件整体替换。而 Agent 的编辑工具是**基于磁盘绝对路径**的，切分支可能让另一个 Agent 正在写的文件瞬间变成旧版本——**这恰恰是最大的覆盖风险源**，不是解药。
4. 各 Agent 的改动天然按目录隔离：`review/`、`docs/`、`backend/`、`skills/`、`read|notes|digest.md`。

### 2.2 方案对比

| 方案 | 描述 | 适配度 |
|---|---|---|
| A. `main` 保护 + `feat/<role>-<topic>` 短分支 + PR 合并 | 标准开源流程 | ✗ 过度设计。单人 + 同工作区，切分支会互相打断；无 CI/PR 评审环节，PR 形同虚设 |
| B. Git Flow（develop/release/hotfix） | 重量级 | ✗ 完全不适合 |
| C. **全员在 `main` 上小步提交 + 文件级职责隔离 + 提交前自检** | 单分支主干开发 | ✓ 推荐 |
| D. 每 Agent 一个长分支 | 各自独立 | ✗ 合并时冲突集中爆发，且切分支风险同上 |

### 2.3 推荐方案：C（主干小步提交 + 文件级职责隔离）

**核心规则：**

1. **唯一工作分支 `main`**，不创建并行分支；所有 Agent 在同一工作树上改文件。
2. **文件级职责隔离（硬约束，写入 AGENTS.md）**：

   | 角色 | 独占目录/文件 | 说明 |
   |---|---|---|
   | fe-dev | `review/**`、`digest.md`、`wrong-words.md`、将来的 `frontend/**` | 看板与静态页 |
   | be-dev | `backend/**`、`docs/api.md`、`docs/database.md`、`docs/backend-analysis.md` | 后端与数据 |
   | skill-designer | `skills/**`、`docs/skills.md`、`docs/schemas/**`、`.workbuddy/skills/**` | Skill 与契约 |
   | amy | `read/**`、`notes/**`、`progress.md`、`docs/ai-teacher.md`、`docs/amy-*.md` | 教学数据与规则 |
   | git-manager | `.gitignore`、`docs/changelog.md`、`docs/plans/git-plan.md` | 版本管理 |

   **跨目录修改必须先在群里声明**（例：fe-dev 要改 `docs/api.md` → 先 @be-dev，改完由 be-dev 复核）。

3. **提交前自检（每个 Agent 提交前必做）**：
   ```
   git status --short                 # 确认只看到自己的文件
   git diff --stat                    # 确认改动范围
   git diff -- <自己负责的路径>        # 逐文件确认是自己的改动
   ```
   只 `git add` 自己负责路径下的文件，**禁止 `git add -A` / `git add .`**——这是防止把别人未提交的工作一并卷入的最有效手段。

4. **小步提交**：一个逻辑变更一提交，单次提交涉及文件尽量 ≤ 10 个。同一 Agent 连续多轮对话形成的一个完整功能，及时提交，不要攒着。

5. **冲突兜底（万一多人改了同一文件）**：后提交者先 `git diff HEAD -- <文件>` 看自己的改动，与对方确认后再决定保留顺序；**绝不直接用 `git checkout -- <文件>` 丢弃**。

### 2.4 例外：何时允许开分支

仅以下场景开短分支（命名 `wip/<role>-<topic>`，完成即合并回 `main` 并删除）：

- 大规模重构（如静态看板整体迁移 Vue）；
- 数据库结构迁移（`backend/db/schema.sql` 变更）；
- 需要同时保留「能跑的旧版」和「改到一半的新版」。

且**开分支前必须先确保 `main` 已提交干净**（`git status` 无输出）。

---

## 三、commit 规范

### 3.1 格式

```
<type>(<scope>): <中文或英文简述，祈使句，≤ 50 字>

<body：为什么改、影响范围、对其他 Agent 的要求（可选）>
```

### 3.2 type 约定

| type | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修 bug |
| `docs` | 文档（docs/、README、changelog、schema 说明） |
| `refactor` | 重构（不改变外部行为） |
| `perf` | 性能优化 |
| `test` | 测试脚本（smoke-test / integration-check） |
| `chore` | 构建/依赖/配置/`.gitignore`/版本管理 |
| `style` | 格式（不影响逻辑的 CSS/空格） |
| `revert` | 回滚某次提交 |

### 3.3 scope 建议

`frontend`、`backend`、`skill`、`docs`、`db`、`schemas`、`review`（静态看板）、`git`、`amy`（教学数据）

示例：
```
feat(backend): 新增 GET /agent/snapshot 接口
docs(schemas): 补充 mistake.schema.json 的 errorType 枚举
fix(frontend): 阅读页双栏布局在窄屏下错位
chore(git): .gitignore 补充 .env.local 与 __pycache__
```

### 3.4 提交粒度

- **一个逻辑变更 = 一次提交**。不要「改 5 个功能后一次提交」，也不要「一个功能拆 20 次提交」。
- 提交内容必须**自洽**：提交后项目应处于可运行 / 可理解的状态（不要求必须能跑通测试，但不能是删了一半的中间态）。
- 不相关改动**绝不混在一次提交里**（例：改了 CSS 又顺手改了数据库 schema → 拆两次）。

### 3.5 必须提交的时机（提交检查点）

以下操作**之前**，必须先确保相关改动已提交（对应 `AGENTS.md` 3.5 与第 8 节）：

1. **大规模重构前**（换目录结构、换技术栈、重写模块）
2. **数据库迁移 / schema 变更前**（`backend/db/schema.sql`、seed 数据）
3. **删除文件前**（任何 `rm` / 批量删除）
4. **执行 `build_board.py` 重建看板前**（它会覆盖 `review/*.html`，会吃掉未提交的手改）
5. **切换分支 / 拉取远端 / 合并前**
6. **一个 Agent 把工作交接给另一个 Agent 时**
7. **本轮任务结束、工作区即将闲置时**
8. **执行任何被标记为「危险」的 git 命令前**

### 3.6 changelog 纪律

`docs/changelog.md` 由 git-manager 维护：每次提交后追加一行 `- <日期> · <短哈希> · <提交信息>`。非 git-manager 的 Agent **不要直接改 changelog**，避免与提交记录对不上。

---

## 四、危险操作护栏

### 4.1 禁止自动执行（需人工二次确认，且必须有备份）

| 命令 | 危害 | 前置条件 |
|---|---|---|
| `git reset --hard` | 丢弃全部未提交改动，不可恢复 | 必须先 `git stash` 或建备份分支 |
| `git push --force` / `--force-with-lease` | 覆盖远端历史 | 本项目单人多 Agent，**默认禁用** |
| `git clean -fd` / `-fdx` | 删除所有未跟踪文件（含 `backend/.env`、Skill 备份 zip） | 必须先 `git clean -ndx` 预览并人工核对清单 |
| `git checkout -- <file>` / `git restore <file>` | 丢弃指定文件未提交改动 | 先 `git diff -- <file>` 确认内容已无用 |
| `git branch -D` / `git tag -d` | 删除分支/tag | 确认该分支内容已合并或已备份 |
| `git rebase -i` / `filter-branch` / `rebase --onto` | 改写历史 | 先在备份分支打 tag |
| `git rm -r` 批量删除 | 误删业务代码 | 先确认文件清单，且已提交 |
| `rm -rf` 任何项目目录 | 同上 | 同上 |
| 直接编辑 `.git/` 下文件 | 仓库损坏 | 禁止 |

### 4.2 执行危险操作前的标准动作（三步）

1. **备份**：
   ```
   git branch backup/<yyyymmdd>-<原因>      # 备份分支（最轻量，推荐）
   git stash push -m "<描述>"               # 未提交改动入栈
   git tag pre-op/<yyyymmdd>-<操作名>       # 里程碑锚点
   ```
   三者至少做其一；涉及历史改写时三者都做。
2. **确认清单**：把即将受影响的提交/文件列表打印出来（`git log --oneline -n`、`git diff --stat`、`git clean -ndx`），逐条核对。
3. **二次确认**：由 team-lead 或用户明确回复「同意执行」后才执行；Agent 不得自行判断「应该没问题」。

### 4.3 安全替代方案

| 想要的效果 | 危险做法 | 安全做法 |
|---|---|---|
| 撤销未提交改动 | `git checkout -- .` | `git stash push -m` 保留可恢复 |
| 回到某个历史版本看一眼 | `git reset --hard <sha>` | `git checkout <sha>`（detached）看完 `git checkout main` |
| 撤销某次已提交的错误改动 | `git reset --hard` | `git revert <sha>`（保留历史，可再 revert） |
| 清理未跟踪文件 | `git clean -fdx` | `git clean -ndx` 预览 → 人工挑出要删的 → 单条 `rm` |

### 4.4 回滚演练（建议）

每次打 tag 后，用 `git stash list` 与 `git tag -l` 各确认一次快照存在；重大变更前创建 `backup/*` 分支，变更稳定后（`>7 天` 无问题）再删除。

---

## 五、tag / release 节奏

### 5.1 何时打 tag

| 触发条件 | tag 命名 | 示例 |
|---|---|---|
| 后端一个数据域完整可用（课程/词汇/错题/进度/学习记录之一闭环） | `backend-v<MAJOR>.<MINOR>.<PATCH>` | `backend-v0.1.0` |
| 前后端联调闭环（联调报告产出时） | `integration-v<n>` | `integration-v1` |
| Skill 版本发布（与 `SKILL.md` 的 `version` 对齐） | `skill-<skill-name>-v<version>` | `skill-english-daily-v2.2.0` |
| 看板（静态前端）改造闭环 | `review-v<n>` | `review-v1` |
| 数据库 schema 变更 | `db-schema-v<n>` | `db-schema-v1` |
| Amy 一个学习阶段归档（如级别晋升） | `learning-level-<n>` | `learning-level-2` |

### 5.2 版本规则

- Skill 版本号与 `SKILL.md` 的 `version` 字段**严格一致**，禁止一个改一个不改。
- 后端在 1.0.0 之前用 `0.x.y`：新增接口 `+MINOR`，修复 `+PATCH`，破坏性变更 `+MAJOR`。
- Skill tag 采用 `skill-<skill-name>-v<version>`（**已启用，回应 skill-designer Q8**）。带 skill 名而非统一 `skill-v<x.y.z>`，是因为后续会有 `daily-lesson`、`grammar-teaching`、`mistake-analysis` 等多个 Skill，单靠版本号无法区分。将来 `english-daily` 改名为 `daily-lesson` 后，新 tag 用新名，历史 tag **不改写**。
- tag 用**附注 tag**（`-a`）并写一行说明：`git tag -a <name> -m "<说明>"`。
- **tag 打完即 push**（`git push origin <tag>`），否则仍是本地单点。

### 5.3 release 节奏建议

- 不做固定周期 release，采用「**里程碑驱动**」：达到 5.1 任一条件即打 tag。
- 每个里程碑同步更新 `docs/changelog.md` 与（如涉及）`progress.md`。
- 建议节奏：每完成一个后端数据域 / 一次 Skill 大改 / 一次看板改造 → 打 tag + push。

---

## 六、Skill 源码与打包产物的版本策略

### 6.1 结论：Skill 源码**必须入库**（支持 `docs/skills.md` 7.4 的决策）

理由：`.gitignore` 第 2 行排除整个 `.workbuddy/`，而权威副本 `.workbuddy/skills/english-daily/`（SKILL.md v2.2.0、`skill-dependencies.json`、`references/` 3 个、`scripts/` 3 个 .py，共 8 个文件）正在其中 → 工作区丢失即永久丢失，与 `AGENTS.md` 第 8 节「在没有检查 Git 状态的情况下执行危险操作」的禁令精神冲突。

### 6.2 定稿：`skills/` 独立目录入库（方案 A / skill-designer 编号 C）

对比两种实现：

| 方案 | 优点 | 缺点 |
|---|---|---|
| **A（采用）** 建 `skills/english-daily/`，`.workbuddy/` 保持整体忽略 | 职责清晰；不会误带 `build/`、`_tmpx/`、`tmp/`、`memory/` 等私有目录；权威唯一 | 需维护「两份副本」的同步 |
| B. 改 `.gitignore` 为 `.workbuddy/*` + `!.workbuddy/skills/` | 原地入库，无需复制 | `.workbuddy/` 下其他内容易被带进仓库；运行副本与版本副本同体，构建流程可能直接改写版本文件 |

**同时更正 `docs/skills.md` 7.4 的一处技术错误**（由 skill-designer 实测发现）：
> 「在 `.gitignore` 中为 `.workbuddy/` 增加例外 `!.workbuddy/skills/`」是**无效写法**。git 不允许父目录被整体排除后再重新包含其子内容（`git check-ignore -v` 仍命中 `.gitignore:2:.workbuddy/`）。要生效必须写成 `.workbuddy/*` + `!.workbuddy/skills/`。
> 这进一步支持采用方案 A：**不动 `.gitignore`，直接新建 `skills/` 入库。**

目录结构：

```
skills/english-daily/          ← 入库（唯一版本化源码）
  SKILL.md
  skill-dependencies.json
  references/{course-template,level-map,setup-guide}.md
  scripts/{build_board,check_environment,init_workspace}.py
```

### 6.3 `build_board.py` 5 份副本的处置

实测副本列表：

| 路径 | 大小 / 行数 / md5 | 角色 | 处置 |
|---|---|---|---|
| `.workbuddy/skills/english-daily/scripts/build_board.py` | 44415 B / 1040 行 / `50aca14b…` | **权威**（含阅读页改造） | 复制到 `skills/` 入库 |
| `.workbuddy/build/output/english-daily/scripts/build_board.py` | 30349 B / 711 行 / `486cd289…` | 构建产物（旧版） | 忽略 → 重命名观察 → 再删 |
| `.workbuddy/build/resources/scripts/build_board.py` | 30349 B / 711 行 / `486cd289…` | 构建资源（旧版） | 同上 |
| `.workbuddy/_tmpx/english-daily/scripts/build_board.py` | 30349 B / 711 行 / `486cd289…` | 临时解包（旧版） | 同上 |
| `.english-daily-package-yj7kiobf/english-daily/scripts/build_board.py` | 28980 B / 681 行 / `101d1df7…` | 打包中间物（更旧） | 同上 |
| `skills/english-daily/scripts/build_board.py`（入库后） | 与权威一致 | **版本副本** | 唯一可回滚副本 |

**注意**：3 份 30 KB 副本与权威副本差异巨大（711 行 vs 1040 行），说明 build 流程持有的是**旧版**脚本。这正是「打包流程反向覆盖权威副本」风险的证据，故 6.3 第 3 条改为重命名而非删除。

**处置原则（已与 skill-designer 达成一致）**：
1. **入库前不要删任何副本**——先确认 `skills/` 里的副本与权威副本 `diff` 一致，再清理。
2. 清理限定在 `.workbuddy/build/`、`_tmpx/`、`tmp/`、`.english-daily-package-*/` 四个**已忽略**目录内，绝不动 `.workbuddy/skills/` 与 `skills/`。
3. **先重命名、后删除**（skill-designer 建议，采纳）：因为存在「打包流程把 30 KB 旧版反向覆盖权威副本」的疑似风险且触发条件未复现，删除是不可逆的。改为：
   ```bash
   mv .workbuddy/build .workbuddy/build.bak-20260929
   mv .workbuddy/_tmpx  .workbuddy/_tmpx.bak-20260929
   mv .english-daily-package-yj7kiobf .english-daily-package-yj7kiobf.bak-20260929
   ```
   静置观察（建议 ≥ 1 个完整打包周期或 7 天），确认无任何流程依赖后再删。
4. 清理属「删除文件」操作，适用 3.5 第 3 条：**先提交，再重命名/删除**，且操作前 `ls` 列清单确认。
5. **权威副本防覆盖校验**（新增建议）：每次跑打包/构建前后各记录一次权威副本校验和，一旦变化立即从 `skills/` 恢复：
   ```bash
   md5sum .workbuddy/skills/english-daily/scripts/build_board.py   # 期望 50aca14b1edf40cb20404a088e4e3d14
   ```

### 6.4 同步纪律（待 skill-designer 确认方向后固化）

建议：**`.workbuddy/skills/` 为运行副本，`skills/` 为版本副本**。
- 改 Skill 时在 `.workbuddy/skills/` 改并实测；
- 提交前由 skill-designer 同步到 `skills/`（`cp -r`），git-manager 校验 `diff -r` 无差异后提交打 tag。
- 或者反向（以 `skills/` 为权威再拷回 `.workbuddy/`）——由 skill-designer 定。**无论哪种，提交时两份必须一致。**

### 6.5 其他产物

| 目录/文件 | 状态 | 建议 |
|---|---|---|
| `.workbuddy/build/`、`_tmpx/`、`tmp/`、`memory/` | 已忽略 | 保持忽略，不入库 |
| `.english-daily-package-*/` | 已忽略 | 保持忽略；用完可删 |
| `english-daily.zip`、`.workbuddy/skill-backups/*.zip`（v1.0.0/v2.0.0/v2.1.0） | 已忽略 | 保留作**离线备份**；但版本标记以 **git tag** 为准，不要只靠文件名 |
| `backend/node_modules/` | 已忽略 | 不入库 |
| `backend/.env` | 已忽略 | **不入库**；但需单独记录口令来源（见 7.2） |

### 6.6 入库后 Skill 的变更流程（补充到 `docs/skills.md`）

改 Skill → 实测通过 → 同步到 `skills/` → 更新 `SKILL.md` 的 `version` → 提交（`feat(skill)` / `fix(skill)`）→ 打 `skill-english-daily-v<version>` tag → push → 更新 `docs/changelog.md`。

### 6.7 `docs/testdata/`（适配层黄金样本）是否入库（回应 skill-designer Q9）

**结论：入库，但设体积闸门。**

理由：黄金样本是「阶段 A / 阶段 B 产出逐字段一致」这一验收标准的唯一判据（见 `docs/skills.md` 7.2 切换点验证方式）。样本不在版本库 = 验收标准不可复现。

约束：

| 项 | 规则 |
|---|---|
| 单文件大小 | **≤ 200 KB**（skill-designer 建议，采纳） |
| 目录总量 | **≤ 1 MB**，超出则改为「种子文件 + 生成脚本」，只入库种子与脚本 |
| 内容要求 | 只放**输入样本**与**期望输出样本**，不放运行日志、临时导出、真实大量学习数据 |
| 命名 | `<契约对象>.<场景>.json`，例：`agent-snapshot.basic.json`、`lesson-record.session-07.json` |
| 排除 | `docs/testdata/**/*.tmp`、`*.actual.json`（实际产出，用于比对，不入库）→ 需加进 `.gitignore` |
| 更新纪律 | 契约（`docs/schemas/*.schema.json`）变更时**同一次提交**内同步更新样本，否则样本即失效 |

Git 侧动作：`.gitignore` 追加 `docs/testdata/**/*.tmp` 与 `docs/testdata/**/*.actual.json`（对应第二章缺口表，编号 G9）。

---

## 七、建议执行的操作清单（**需 team-lead / 用户确认后由人工执行，本次未执行**）

按优先级排序。每条都给出具体命令与回退方式。

### 7.1 P0 — 消除「本地 6 个提交 + Skill 源码」无备份风险

```bash
# 1) 备份当前工作区状态（未提交的 review/index.html）
git -C E:/English stash push -m "fe-dev: review/index.html 阅读页双栏改造（2026-09-29）"
#    确认 stash 成功：git stash list  应看到 1 条
#    之后由 fe-dev 决定是否 pop 回来再正式提交；本条本身即回滚手段

# 2) 提交未提交改动（与 1 二选一：若确认改动无误，直接提交更干净）
git -C E:/English add review/index.html
git -C E:/English commit -m "feat(frontend): 阅读页双栏布局与词汇卡片交互"

# 3) 建备份分支（在 push 前给本地独有提交一个本地锚点）
git -C E:/English branch backup/2026-09-29-before-push

# 4) push 到远端（6 个本地提交落地远端，消除单点）
git -C E:/English push origin main

# 5) Skill 源码入库（方案 A，已与 skill-designer 定稿：只入库 8 个文件，不含 __pycache__）
mkdir -p E:/English/skills
cp -r E:/English/.workbuddy/skills/english-daily E:/English/skills/
rm -rf E:/English/skills/english-daily/scripts/__pycache__    # 仅删新建副本里的，不动 .workbuddy/
#    先补 .gitignore 的 G2 再 add，双保险
git -C E:/English add skills/
git -C E:/English commit -m "chore(skill): Skill 源码入库（english-daily v2.2.0，8 个文件）"

# 6) 打首个里程碑 tag
git -C E:/English tag -a skill-english-daily-v2.2.0 -m "english-daily Skill 源码入库，版本 2.2.0"
git -C E:/English push origin skill-english-daily-v2.2.0

# 7) 提交本轮四份方案文档（当前均未跟踪）
git -C E:/English add docs/plans/frontend-plan.md docs/plans/backend-plan.md \
                        docs/plans/skill-plan.md docs/plans/git-plan.md
git -C E:/English commit -m "docs(plans): 前端/后端/Skill/Git 四份方案文档"
```

**当前未跟踪文件清单（`git status --short -uall` 实测）**：
```
 M review/index.html
?? docs/plans/backend-plan.md
?? docs/plans/frontend-plan.md
?? docs/plans/git-plan.md
?? docs/plans/skill-plan.md
```

**回退**：`git reset --soft HEAD~1`（仅撤销提交保留文件）；`git branch -D backup/...`（删除备份分支）；`git tag -d <tag>`（删本地 tag）。

### 7.2 P1 — `.gitignore` 补缺口（G1、G2 优先）

建议追加内容（需用户确认 G7 是否共享编辑器配置）：

```gitignore
# 环境变量（.env 只匹配同名文件，需显式覆盖变体）
.env.local
.env.*.local

# Python 字节码（Skill 脚本执行产生）
__pycache__/
*.pyc

# 前端构建产物
dist/
build/

# 运行日志
*.log
logs/
npm-debug.log*

# 数据库本地文件
*.sqlite
*.sqlite3

# 系统/编辑器/备份残留
.DS_Store
Thumbs.db
*.bak
*.orig
*.rej

# 测试临时产出（黄金本体 docs/testdata/**/*.json 仍入库）
docs/testdata/**/*.tmp
docs/testdata/**/*.actual.json
```

`build/` 需确认不会误伤 `.workbuddy/build/`（该目录已被 `.workbuddy/` 整体忽略，规则顺序上仍安全）。

### 7.3 P2 — 处置 `build_board.py` 的 4 份旧副本（**重命名观察，不直接删**）

**前置条件**：7.1 第 5 步已完成，且 `diff -r E:/English/skills/english-daily/scripts E:/English/.workbuddy/skills/english-daily/scripts` 确认一致。

```bash
# 1) 记录权威副本校验和（事后比对是否被反向覆盖）
md5sum E:/English/.workbuddy/skills/english-daily/scripts/build_board.py
#    期望 50aca14b1edf40cb20404a088e4e3d14

# 2) 预览（不动）
ls E:/English/.workbuddy/build E:/English/.workbuddy/_tmpx E:/English/.english-daily-package-yj7kiobf

# 3) 重命名（可逆），而非删除
mv E:/English/.workbuddy/build              E:/English/.workbuddy/build.bak-20260929
mv E:/English/.workbuddy/_tmpx              E:/English/.workbuddy/_tmpx.bak-20260929
mv E:/English/.english-daily-package-yj7kiobf E:/English/.english-daily-package-yj7kiobf.bak-20260929

# 4) 观察 ≥ 1 个完整打包周期（或 7 天），确认无流程依赖后再删
#    回滚：把 .bak-20260929 后缀去掉即可
```

### 7.4 P2 — 把职责隔离写进 `AGENTS.md`

建议在 `AGENTS.md` 第 3 节各角色下补「独占目录」，并新增第 10 节「Git 提交纪律」（对应本方案 2.3、3.4、3.5、4.1）。需 team-lead 批准后由我起草。

---

## 八、未决问题（需用户 / team-lead 决策）

| # | 问题 | 选项 | 我的建议 |
|---|---|---|---|
| Q1 | 是否立即把 6 个本地提交 push 到 GitHub？ | ①立即 push ②先本地整理再 push ③永不 push | **①**。`origin` 已存在且空转，push 是消除单点风险成本最低的手段；push 前先建 `backup/` 分支 |
| Q2 | 是否需要额外远端备份（第二个 remote / 本地裸仓库 / 网盘）？ | ①仅 GitHub ②加本地裸仓库镜像 ③加网盘同步 | **②**（`git clone --mirror` 到另一块盘或目录，成本近乎为零，防 GitHub 不可用） |
| Q3 | Skill 源码入库采用方案 A（`skills/`）还是 B（`.workbuddy/skills/` 例外）？ | A / B | **A** —— ✅ 已与 skill-designer 定稿（他编号 C）。且他实测证明 7.4 的 `!.workbuddy/skills/` 写法无效，进一步锁定 A。见 6.2 |
| Q4 | `.workbuddy/skills/` 与 `skills/` 哪个是权威？ | ①`.workbuddy/` 权威 ②`skills/` 权威 | 待 skill-designer 定；若选 ②，运行前需一条复制命令，稍麻烦但版本更可靠 |
| Q5 | `backend/.env`（含数据库口令）如何处理？ | ①仅本地不入库（现状）②入口令管理器并文档化 ③入库 `.env.example` 以外不做处理 | **① + 补一份口令来源说明**（如写在 `backend/README.md`，不含明文）；**绝不入库明文** |
| Q6 | 编辑器配置 `.vscode/` / `.idea/` 是否入库？ | ①忽略 ②共享 | 由用户定；单人项目建议 **①忽略**，避免 IDE 私有路径污染 |
| Q7 | 是否需要为「多 Agent 并行」引入分支（方案 A/D）？ | ①不用（方案 C）②用 | **①**。当前规模下切分支的风险大于收益 |
| Q8 | `docs/plans/` 下各 Agent 的方案文档是否全部入库？ | ①全入库 ②仅最终版 | **①**。方案文档是决策留痕，入库才有追溯价值 |
| Q9 | `.workbuddy/build/`、`_tmpx/`、`.english-daily-package-*/` 能否清理？ | ①直接删 ②重命名观察再删 ③不动 | ✅ 已定：**②**。3 份 30 KB 副本是旧版（711 行，权威 1040 行），存在反向覆盖嫌疑且触发条件未复现，删除不可逆。见 6.3 |
| Q10 | Skill tag 命名与是否启用？ | ①`skill-v<x.y.z>` ②`skill-<name>-v<x.y.z>` ③不启用 | ✅ 已定：**② 启用**。后续会有多个 Skill，版本号不足以区分。见 5.2 |
| Q11 | `docs/testdata/`（适配层黄金样本）是否入库、体积上限？ | ①入库 ②不入库（.gitignore 排除） | ✅ 已定：**入库**，单文件 ≤ 200 KB、目录总量 ≤ 1 MB，排除 `*.tmp` / `*.actual.json`。见 6.7 |
| Q12 | `docs/skills.md` 7.4 的无效 gitignore 写法是否更正？ | ①更正 ②保留 | **①更正**（改由 skill-designer 在其文档内修订，我不改他的文件）。见 6.2 |

---

## 附录 A：体检所用命令（全部只读）

```bash
git -C E:/English status --short
git -C E:/English status --short --untracked-files=all
git -C E:/English branch -a
git -C E:/English remote -v
git -C E:/English log --oneline -15
git -C E:/English log --stat -3
git -C E:/English ls-files | head -80
git -C E:/English ls-files | wc -l
git -C E:/English stash list
git -C E:/English tag -l
git -C E:/English rev-list --left-right --count origin/main...main
git -C E:/English diff --stat
git -C E:/English check-ignore -v <path>
git -C E:/English for-each-ref --format="%(refname:short)"
```

## 附录 B：体检结论速览

| 项 | 结论 |
|---|---|
| 分支 | 仅 `main`，无并行分支 |
| remote | `origin`（GitHub）存在，本地领先 6 个提交未 push |
| 未提交改动 | `review/index.html`（+93/-13），**有被 `build_board.py` 覆盖丢失的风险** |
| `.gitignore` 缺口 | 8 项（G1 `.env.local`、G2 `__pycache__` 为高优先级） |
| 入库异常 | 无（无 node_modules / 无明文 .env / 无产物） |
| 可回滚性 | **C 级**：可回滚，但 Skill 源码与 6 个本地提交无第二副本 |
| 推荐分支策略 | **方案 C**：main 单分支 + 文件级职责隔离 + 小步提交 + 禁止 `git add -A` |
| 最紧急动作 | 提交/备份 `review/index.html` → 建备份分支 → push → Skill 源码入库 |
