# 错词本

> 规则：答错 → 连续答对清零；答对 → 连续答对 +1；连续答对达 2 次 → 标记「已过关」，退出每日复习队列。
> **`错误点` 列只写错误形式本身**（去掉一切括号批注；批注与复发次数写入 `错因` 列）。这条规范 2026-09-30 起执行，目的是让 `wrong_text` 在错词本、`records/*.json`、数据库三处**逐字一致**。
> 列口径：`类型` = mistakes.error_type（6 值枚举，判定规则见 `docs/ai-teacher.md` §11.5）；`累计犯错` = mistakes.wrong_count（累计到 3 次触发下一课强制自查项）。**后两列由 Amy 人工判定，解析器不得推导、不得猜测**。
> 变更记录：2026-09-29 去重（`play game` 重复两行）、删除 1 行非错题记录；2026-09-30 补 `类型`/`累计犯错` 两列、按「只写错误形式」规范重写全部 `错误点`、**补入 4 条原漏登记的错词**；2026-10-01 第 7 课补入 3 条（`getted` / `in office` / `on last Sundays`），第 8 课补入 7 条（`went the park` / `a apple` / `He got to school` / `went a shop` / `vergertable` / `supermark` / `homeworks`），并更新复习的 3 处计数（`play game` 0→1、`Do you like coffee.` 0→1、`Tom play soccer` 清零且累计 1→2）；2026-10-02 第 9 课补入 6 条（`at night yesterday` / `They plays games` / `didn't went` / `Did you see him yesterday.` / `eat banana` / `No, I didn't`），并更新复习的 2 处计数（`play game` 1→2 **且已过关**、`she always is busy` 0→1）。当前 **39 条**：已过关 7、未过关 32。

| 课号 | 错误点 | 正确形式 | 错因 | 连续答对 | 状态 | 类型 | 累计犯错 |
|---|---|---|---|---|---|---|---|
| 1 | We see movie | We watch movies | 「看电视/电影」用 watch 不用 see；movie 是可数名词，单数不能裸用 | 2 | 已过关 | word_choice | 1 |
| 1 | ask for my teacher | ask my teacher for help | ask for 表示「要某物」，向人请教要说 ask sb (for help) | 2 | 已过关 | word_choice | 1 |
| 1 | Tv | TV | 缩写词两个字母都要大写 | 2 | 已过关 | capitalization | 1 |
| 1 | work.So | work, so（或改用句号断开） | 句号后必须空一格再写下一个词（同类第 2 次：第 2 课 zane.I） | 0 | 未过关 | punctuation | 1 |
| 诊断 | An book on the table. | There is a book on the table. | 「某处有某物」要用 there is / there are；an 只用于元音音素开头的词，book 用 a | 2 | 已过关 | grammar | 2 |
| 2 | Tom play soccer | Tom plays soccer | 主语是第三人称单数时一般现在时动词要加 -s（第 2 次犯：第 8 课复习写成 Tom play games，漏 -s） | 0 | 未过关 | grammar | 2 |
| 2 | now,liked my teacher | …now, and I like my teacher. ／ 用句号断开 | 逗号不能连接两个完整句子；「现在喜欢」用原形 like | 2 | 已过关 | punctuation | 3 |
| 2 | she always is busy | she is always busy | 频度副词要放在 be 动词之后（第 3 次错：第 7 课复习写成 She is always is busy；第 9 课复习答对，1/2） | 1 | 未过关 | grammar | 3 |
| 2 | zane | Zane | 人名、地名首字母一律大写 | 0 | 未过关 | capitalization | 1 |
| 诊断 | Do you like coffee. | Do you like coffee? | 疑问句结尾必须用问号（第 8 课复习答对，1/2） | 1 | 未过关 | punctuation | 3 |
| 3 | intrusting | interesting | 拼写：interesting（有趣的），重音在首，拼作 inter-est-ing | 0 | 未过关 | spelling | 1 |
| 3 | Our teacher is Amy together. | Tom and I are students. Our teacher is Amy. | together 表示「一起做某事」，不能用来描述身份归属 | 0 | 未过关 | word_choice | 1 |
| 4 | I reading a book. | I am reading a book. | 现在进行时必须有 be 动词 am / is / are | 2 | 已过关 | grammar | 1 |
| 4 | my grandpa and me | my grandpa and I | 作主语用主格 I，me 是宾格；别人在前，I 在后 | 0 | 未过关 | grammar | 1 |
| 4 | play game | play games | 可数名词单数不能裸用，用复数或 a + 单数（第 7 课作业达标、第 8 课复习答对、第 9 课复习答对 → **已过关**） | 2 | 已过关 | grammar | 3 |
| 4 | what do you do? | What are you doing? | 疑问词没选错，错在用一般现在时结构去问此刻正在做的事（与 I reading a book. 同属结构缺失） | 0 | 未过关 | grammar | 1 |
| 4 | Now, My | Now, my | 非句首的词不需要大写（同类：第 5 课 those are their bags.） | 0 | 未过关 | capitalization | 1 |
| 5 | those are their bags. | Those are their bags. | 句首单词首字母必须大写 | 1 | 未过关 | capitalization | 2 |
| 5 | I am very busy. | We are busy. | 错在主格代词选择：中文「我们」写成 I；am → are 是连带修正 | 1 | 未过关 | word_choice | 1 |
| 6 | Theri school is very big | Their school is very big | 拼写：their 的字母顺序写反成 theri | 0 | 未过关 | spelling | 1 |
| 6 | at yesterday | yesterday（不加 at） | yesterday / today / tomorrow 前面不加介词 | 0 | 未过关 | grammar | 2 |
| 7 | getted | got（想说「学到」则用 learned） | get 是不规则动词，过去式是 got，不能加 -ed；「学知识」英语常说 learned | 0 | 未过关 | grammar | 1 |
| 7 | in office | in the office ／ in my office | 单数可数名词前必须有 a / the / my 之类的限定词（第 7 课补漏块第 3 题） | 0 | 未过关 | grammar | 1 |
| 7 | on last Sundays | last Sunday | last / next / this 前不加介词；「上周日」是单数，不是 Sundays | 0 | 未过关 | grammar | 1 |
| 6 | What were you yesterday. | How were you yesterday? | 问「状态怎么样」用 how 不用 what；句尾必须用问号（标点部分并入本条） | 0 | 未过关 | word_choice | 1 |
| 6 | I teached my friend to use AI | I taught my friend to use AI | teach 是不规则动词，过去式是 taught 不是加 -ed（第 7 课开放题第 2 次犯） | 0 | 未过关 | grammar | 2 |
| 8 | went the park | went to the park | go 到某地要用 go to + 地点，漏了介词 to（第 8 课作业第 1 题） | 0 | 未过关 | grammar | 1 |
| 8 | a apple | an apple | apple 以元音音素 /æ/ 开头，前面要用 an 不用 a（第 8 课作业第 2 题） | 0 | 未过关 | grammar | 1 |
| 8 | He got to school | He went to school | 改错改错了动词：go 的过去式是 went，不是 got（got 是 get 的过去式）（第 8 课作业第 3 题） | 0 | 未过关 | word_choice | 1 |
| 8 | went a shop | went to a shop | 同「went the park」：go 到某地漏介词 to（第 8 课开放题，本课第 2 次） | 0 | 未过关 | grammar | 1 |
| 8 | vergertable | vegetables | 拼写：vegetable（蔬菜），拼作 veg-e-ta-ble；且 some 后面可数名词要用复数（第 8 课开放题） | 0 | 未过关 | spelling | 1 |
| 8 | supermark | supermarket | 拼写：supermarket（超市），结尾是 -market（第 8 课开放题） | 0 | 未过关 | spelling | 1 |
| 8 | homeworks | homework | homework 是不可数名词，不能加 -s（第 8 课开放题） | 0 | 未过关 | grammar | 1 |
| 9 | at night yesterday | last night | 「昨晚」的固定说法是 last night；at night（夜间）与 yesterday 不能这样拼（第 9 课复习第 2 题） | 0 | 未过关 | word_choice | 1 |
| 9 | They plays games | They play games | 主语是复数时动词用原形；-s 只跟 he / she / it（第 9 课复习第 4 题，与 Tom play soccer 同一根线、方向相反） | 0 | 未过关 | grammar | 1 |
| 9 | didn't went | didn't go | did / didn't 后面的动词必须用原形（第 9 课作业第 1 题，改错题被原样抄回未改） | 0 | 未过关 | grammar | 1 |
| 9 | Did you see him yesterday. | Did you see him yesterday? | 疑问句结尾必须用问号（与 Do you like coffee. 同类；第 9 课作业第 2 题） | 0 | 未过关 | punctuation | 1 |
| 9 | eat banana | eat a banana | 可数名词单数不能裸用（与 play game 同源）；泛指「吃香蕉」用 eat bananas（第 9 课开放题） | 0 | 未过关 | grammar | 1 |
| 9 | No, I didn't | No, I didn't. | 句子结尾必须用句号（第 9 课开放题第 3 句） | 0 | 未过关 | punctuation | 1 |

---

## 类型分布（39 条 · 未过关 32 / 已过关 7）

| 类型 | 条数 | 未过关 |
|---|---|---|
| grammar | 19 | 16 |
| word_choice | 7 | 5 |
| capitalization | 4 | 3 |
| punctuation | 5 | 4 |
| spelling | 4 | 4 |
| other | 0 | 0 |

> 两条归属裁定（`what do you do?` → grammar、`I am very busy` → word_choice）按 `docs/plans/amy-teaching-plan.md` §3.3 执行。
> **2026-09-30 新增 4 条**（`work.So` / `intrusting` / `Our teacher is Amy together.` / `Now, My`）：这 4 处当时已判错但未登记进错词本，属漏登记，本次补入。
> 与 `GET /api/mistakes/stats` 的差异属预期：库内为**上一轮落库后**的条数，本文件已含本课新增行；新课新错词经 `POST /api/mistakes` 落库后两处即对齐（另见 DQ1）。
> **2026-10-02 新增 6 条**（第 9 课）：`at night yesterday`、`They plays games`（复习）+ `didn't went`、`Did you see him yesterday.`、`eat banana`、`No, I didn't`（作业）。复习类错词不在 `records/*.grading.json` 覆盖范围内（见 `records/README.md` §五 5.1），只出现在本文件与库内。
