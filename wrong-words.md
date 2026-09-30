# 错词本

> 规则：答错 → 连续答对清零；答对 → 连续答对 +1；连续答对达 2 次 → 标记「已过关」，退出每日复习队列。
> **`错误点` 列只写错误形式本身**（去掉一切括号批注；批注与复发次数写入 `错因` 列）。这条规范 2026-09-30 起执行，目的是让 `wrong_text` 在错词本、`records/*.json`、数据库三处**逐字一致**。
> 列口径：`类型` = mistakes.error_type（6 值枚举，判定规则见 `docs/ai-teacher.md` §11.5）；`累计犯错` = mistakes.wrong_count（累计到 3 次触发下一课强制自查项）。**后两列由 Amy 人工判定，解析器不得推导、不得猜测**。
> 变更记录：2026-09-29 去重（`play game` 重复两行）、删除 1 行非错题记录；2026-09-30 补 `类型`/`累计犯错` 两列、按「只写错误形式」规范重写全部 `错误点`、**补入 4 条原漏登记的错词**。当前 23 条：已过关 4、未过关 19。

| 课号 | 错误点 | 正确形式 | 错因 | 连续答对 | 状态 | 类型 | 累计犯错 |
|---|---|---|---|---|---|---|---|
| 1 | We see movie | We watch movies | 「看电视/电影」用 watch 不用 see；movie 是可数名词，单数不能裸用 | 2 | 已过关 | word_choice | 1 |
| 1 | ask for my teacher | ask my teacher for help | ask for 表示「要某物」，向人请教要说 ask sb (for help) | 2 | 已过关 | word_choice | 1 |
| 1 | Tv | TV | 缩写词两个字母都要大写 | 2 | 已过关 | capitalization | 1 |
| 1 | work.So | work, so（或改用句号断开） | 句号后必须空一格再写下一个词（同类第 2 次：第 2 课 zane.I） | 0 | 未过关 | punctuation | 1 |
| 诊断 | An book on the table. | There is a book on the table. | 「某处有某物」要用 there is / there are；an 只用于元音音素开头的词，book 用 a | 2 | 已过关 | grammar | 2 |
| 2 | Tom play soccer | Tom plays soccer | 主语是第三人称单数时一般现在时动词要加 -s | 1 | 未过关 | grammar | 1 |
| 2 | now,liked my teacher | …now, and I like my teacher. ／ 用句号断开 | 逗号不能连接两个完整句子；「现在喜欢」用原形 like | 1 | 未过关 | punctuation | 3 |
| 2 | she always is busy | she is always busy | 频度副词要放在 be 动词之后（第 2 次错时把 busy 拼成 bush） | 1 | 未过关 | grammar | 2 |
| 2 | zane | Zane | 人名、地名首字母一律大写 | 0 | 未过关 | capitalization | 1 |
| 诊断 | Do you like coffee. | Do you like coffee? | 疑问句结尾必须用问号 | 0 | 未过关 | punctuation | 3 |
| 3 | intrusting | interesting | 拼写：interesting（有趣的），重音在首，拼作 inter-est-ing | 0 | 未过关 | spelling | 1 |
| 3 | Our teacher is Amy together. | Tom and I are students. Our teacher is Amy. | together 表示「一起做某事」，不能用来描述身份归属 | 0 | 未过关 | word_choice | 1 |
| 4 | I reading a book. | I am reading a book. | 现在进行时必须有 be 动词 am / is / are | 1 | 未过关 | grammar | 1 |
| 4 | my grandpa and me | my grandpa and I | 作主语用主格 I，me 是宾格；别人在前，I 在后 | 0 | 未过关 | grammar | 1 |
| 4 | play game | play games | 可数名词单数不能裸用，用复数或 a + 单数 | 0 | 未过关 | grammar | 3 |
| 4 | what do you do? | What are you doing? | 疑问词没选错，错在用一般现在时结构去问此刻正在做的事（与 I reading a book. 同属结构缺失） | 0 | 未过关 | grammar | 1 |
| 4 | Now, My | Now, my | 非句首的词不需要大写（同类：第 5 课 those are their bags.） | 0 | 未过关 | capitalization | 1 |
| 5 | those are their bags. | Those are their bags. | 句首单词首字母必须大写 | 1 | 未过关 | capitalization | 2 |
| 5 | I am very busy. | We are busy. | 错在主格代词选择：中文「我们」写成 I；am → are 是连带修正 | 1 | 未过关 | word_choice | 1 |
| 6 | Theri school is very big | Their school is very big | 拼写：their 的字母顺序写反成 theri | 0 | 未过关 | spelling | 1 |
| 6 | at yesterday | yesterday（不加 at） | yesterday / today / tomorrow 前面不加介词 | 0 | 未过关 | grammar | 2 |
| 6 | What were you yesterday. | How were you yesterday? | 问「状态怎么样」用 how 不用 what；句尾必须用问号（标点部分并入本条） | 0 | 未过关 | word_choice | 1 |
| 6 | I teached my friend to use AI | I taught my friend to use AI | teach 是不规则动词，过去式是 taught 不是加 -ed | 0 | 未过关 | grammar | 1 |

---

## 类型分布（23 条 · 未过关 19）

| 类型 | 条数 | 未过关 |
|---|---|---|
| grammar | 9 | 8 |
| word_choice | 5 | 3 |
| capitalization | 4 | 3 |
| punctuation | 3 | 3 |
| spelling | 2 | 2 |
| other | 0 | 0 |

> 两条归属裁定（`what do you do?` → grammar、`I am very busy` → word_choice）按 `docs/plans/amy-teaching-plan.md` §3.3 执行。
> **2026-09-30 新增 4 条**（`work.So` / `intrusting` / `Our teacher is Amy together.` / `Now, My`）：这 4 处当时已判错但未登记进错词本，属漏登记，本次补入。
> 与 `GET /api/mistakes/stats` 的差异属预期：接口当前反映的是 19 条时的库内状态，需重跑迁移后才会变成 23（另见 DQ1）。
