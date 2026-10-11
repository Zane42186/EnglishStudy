# 错词本

> 规则：答错 → 连续答对清零；答对 → 连续答对 +1；连续答对达 2 次 → 标记「已过关」，退出每日复习队列。
> **`错误点` 列只写错误形式本身**（去掉一切括号批注；批注与复发次数写入 `错因` 列）。这条规范 2026-09-30 起执行，目的是让 `wrong_text` 在错词本、`records/*.json`、数据库三处**逐字一致**。
> 列口径：`类型` = mistakes.error_type（6 值枚举，判定规则见 `docs/ai-teacher.md` §11.5）；`累计犯错` = mistakes.wrong_count（累计到 3 次触发下一课强制自查项）。**后两列由 Amy 人工判定，解析器不得推导、不得猜测**。
> 变更记录：2026-09-29 去重（`play game` 重复两行）、删除 1 行非错题记录；2026-09-30 补 `类型`/`累计犯错` 两列、按「只写错误形式」规范重写全部 `错误点`、**补入 4 条原漏登记的错词**；2026-10-01 第 7 课补入 3 条（`getted` / `in office` / `on last Sundays`），第 8 课补入 7 条（`went the park` / `a apple` / `He got to school` / `went a shop` / `vergertable` / `supermark` / `homeworks`），并更新复习的 3 处计数（`play game` 0→1、`Do you like coffee.` 0→1、`Tom play soccer` 清零且累计 1→2）；2026-10-02 第 9 课补入 6 条（`at night yesterday` / `They plays games` / `didn't went` / `Did you see him yesterday.` / `eat banana` / `No, I didn't`），并更新复习的 2 处计数（`play game` 1→2 **且已过关**、`she always is busy` 0→1）；2026-10-03 第 10 课补入 6 条（`shcool` / `Do you see him yesterday?` / `visitted` 来自复习，`get offer` / `next Sunday .` / `on weekend` 来自作业），并更新复习的 3 处计数（`she always is busy` 1→2 **且已过关**、`Tom play soccer` 0→1、`They plays games` 0→1）；2026-10-04 第 11 课复习补入 6 条（`go to trval in Beijing` / `live in home` / `they are watching TV` / `at time` / `She is going to the park` / `She play soccer`），并更新复习的 3 处计数（`Do you like coffee.` 1→2 **且已过关**、`on weekend` 累计 1→2、`shcool` 0→1），作业补入 1 条（`14 o'clock`）；2026-10-09 第 12 课复习补入 **7 条**（`usually` / `He play soccer` / `wasn't eat` / `She is reading` / `He read books` / `She go to school` / `by went`），并更新复习的 3 处计数（`Tom play soccer` **累计 2→3 触发强制自查项**、`those are their bags.` 1→2 **且已过关**、`I am very busy.` 1→2 **且已过关**）；同日该课**补漏块 6 与作业**再补入 **3 条**（`on home weekend` / `go to travel` / `This book more interesting`），并更新 1 处计数（`intrusting` **累计 1→2**，第 3 课老错复发）；2026-10-10 第 13 课复习补入 **7 条**（`She go to work` / `Tom not as taller as than Jack` / `I shorter than her` / `I am going to travel` / `next mouth` / `were not stayed` / `streak`），并更新 2 处计数（`Tom play soccer` 连续答对 0→**1**、`They plays games` 1→**2 且已过关出队**）；同日该课**作业与补漏块 7** 再补入 **4 条**（`the most tall` / `is most delious` / `delious` / `of the there`），并更新 2 处计数（`intrusting` **累计 2→3 触发 §11.6 强制自查项**、`go to travel` **累计 1→2**）。当前 **73 条**：已过关 12、未过关 61。

| 课号 | 错误点 | 正确形式 | 错因 | 连续答对 | 状态 | 类型 | 累计犯错 |
|---|---|---|---|---|---|---|---|
| 1 | We see movie | We watch movies | 「看电视/电影」用 watch 不用 see；movie 是可数名词，单数不能裸用 | 2 | 已过关 | word_choice | 1 |
| 1 | ask for my teacher | ask my teacher for help | ask for 表示「要某物」，向人请教要说 ask sb (for help) | 2 | 已过关 | word_choice | 1 |
| 1 | Tv | TV | 缩写词两个字母都要大写 | 2 | 已过关 | capitalization | 1 |
| 1 | work.So | work, so（或改用句号断开） | 句号后必须空一格再写下一个词（同类第 2 次：第 2 课 zane.I） | 0 | 未过关 | punctuation | 1 |
| 诊断 | An book on the table. | There is a book on the table. | 「某处有某物」要用 there is / there are；an 只用于元音音素开头的词，book 用 a | 2 | 已过关 | grammar | 2 |
| 2 | Tom play soccer | Tom plays soccer | 主语是第三人称单数时一般现在时动词要加 -s（第 2 次犯：第 8 课复习写成 Tom play games 漏 -s；第 10 课复习答对 1/2；第 12 课复习再犯 → 累计 3、触发强制自查项；**第 13 课复习答对 → 1/2**） | 1 | 未过关 | grammar | 3 |
| 2 | now,liked my teacher | …now, and I like my teacher. ／ 用句号断开 | 逗号不能连接两个完整句子；「现在喜欢」用原形 like | 2 | 已过关 | punctuation | 3 |
| 2 | she always is busy | she is always busy | 频度副词要放在 be 动词之后（第 3 次错：第 7 课复习写成 She is always is busy；第 9 课复习答对 1/2；第 10 课复习答对 → **已过关出队**） | 2 | 已过关 | grammar | 3 |
| 2 | zane | Zane | 人名、地名首字母一律大写 | 0 | 未过关 | capitalization | 1 |
| 诊断 | Do you like coffee. | Do you like coffee? | 疑问句结尾必须用问号（第 8 课复习答对 1/2；第 11 课复习答对 → **已过关出队**） | 2 | 已过关 | punctuation | 3 |
| 3 | intrusting | interesting | 拼写：interesting（有趣的），重音在首，拼作 in-ter-est-ing（第 12 课作业第 2 题再犯 → 累计 2；**第 13 课作业第 2 题第 3 次犯 → 累计 3，触发 §11.6 强制自查项**） | 0 | 未过关 | spelling | 3 |
| 3 | Our teacher is Amy together. | Tom and I are students. Our teacher is Amy. | together 表示「一起做某事」，不能用来描述身份归属 | 0 | 未过关 | word_choice | 1 |
| 4 | I reading a book. | I am reading a book. | 现在进行时必须有 be 动词 am / is / are | 2 | 已过关 | grammar | 1 |
| 4 | my grandpa and me | my grandpa and I | 作主语用主格 I，me 是宾格；别人在前，I 在后 | 0 | 未过关 | grammar | 1 |
| 4 | play game | play games | 可数名词单数不能裸用，用复数或 a + 单数（第 7 课作业达标、第 8 课复习答对、第 9 课复习答对 → **已过关**） | 2 | 已过关 | grammar | 3 |
| 4 | what do you do? | What are you doing? | 疑问词没选错，错在用一般现在时结构去问此刻正在做的事（与 I reading a book. 同属结构缺失） | 0 | 未过关 | grammar | 1 |
| 4 | Now, My | Now, my | 非句首的词不需要大写（同类：第 5 课 those are their bags.） | 0 | 未过关 | capitalization | 1 |
| 5 | those are their bags. | Those are their bags. | 句首单词首字母必须大写（第 12 课复习答对 → **已过关出队**） | 2 | 已过关 | capitalization | 2 |
| 5 | I am very busy. | We are busy. | 错在主格代词选择：中文「我们」写成 I；am → are 是连带修正（第 12 课复习答对 → **已过关出队**） | 2 | 已过关 | word_choice | 1 |
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
| 9 | They plays games | They play games | 主语是复数时动词用原形；-s 只跟 he / she / it（第 9 课复习第 4 题，与 Tom play soccer 同一根线、方向相反；第 10 课复习答对 1/2；**第 13 课复习答对 → 2/2 过关出队**） | 2 | 已过关 | grammar | 1 |
| 9 | didn't went | didn't go | did / didn't 后面的动词必须用原形（第 9 课作业第 1 题，改错题被原样抄回未改） | 0 | 未过关 | grammar | 1 |
| 9 | Did you see him yesterday. | Did you see him yesterday? | 疑问句结尾必须用问号（与 Do you like coffee. 同类；第 9 课作业第 2 题） | 0 | 未过关 | punctuation | 1 |
| 9 | eat banana | eat a banana | 可数名词单数不能裸用（与 play game 同源）；泛指「吃香蕉」用 eat bananas（第 9 课开放题） | 0 | 未过关 | grammar | 1 |
| 9 | No, I didn't | No, I didn't. | 句子结尾必须用句号（第 9 课开放题第 3 句） | 0 | 未过关 | punctuation | 1 |
| 10 | shcool | school | 拼写：school，拼作 s-ch-oo-l，别把 ch 和 oo 写反（第 10 课第 2 次犯：复习第 1 题 + 作业第 1 题；第 11 课复习答对，1/2） | 1 | 未过关 | spelling | 2 |
| 10 | Do you see him yesterday? | Did you see him yesterday? | 过去时疑问要用 Did 引导，Do 只用于一般现在时；问「昨天」必须用 Did + 主语 + 原形（第 10 课复习第 1 题） | 0 | 未过关 | grammar | 1 |
| 10 | visitted | visited | -ed 拼写规则：visit 重音在首音节、不是重读闭音节，不双写 t，直接加 -ed → visited（第 10 课复习第 2 题） | 0 | 未过关 | grammar | 1 |
| 10 | get offer | get an offer | offer 是可数名词，单数不能裸用，前面要加 an（与 play game / eat banana 同源；第 10 课作业开放题第 1 句） | 0 | 未过关 | grammar | 1 |
| 10 | next Sunday . | next Sunday. | 句号必须紧跟最后一个词，前面不留空格（第 10 课作业开放题第 2 句；与 work.So「句号后必须空一格」互补成一对） | 0 | 未过关 | punctuation | 1 |
| 10 | on weekend | on the weekend ／ this weekend | 「在周末」要说 on the weekend（或 this weekend），weekend 前不能没有 the（第 10 课作业开放题第 3 句；第 11 课复习又犯，累计 1→2） | 0 | 未过关 | grammar | 2 |
| 11 | go to trval in Beijing | travel to Beijing | 「去某地旅行」直接说 travel to + 地点；go to 后面接**地点**、不接动词；地点用 to 不用 in；且 trval 拼写应为 travel（第 11 课复习第 1 题） | 0 | 未过关 | word_choice | 1 |
| 11 | live in home | stay at home | 「待在家里」是 stay at home；live 是「长期居住」；home 前用 at 不用 in（第 11 课复习第 1 题） | 0 | 未过关 | word_choice | 1 |
| 11 | they are watching TV | They are watching TV | 句首单词首字母必须大写（与 those are their bags. 同类；第 11 课复习第 3 题） | 0 | 未过关 | capitalization | 1 |
| 11 | at time | now | 「此刻」是 now（或 at this time）；at time 不是英语说法（第 11 课复习第 3 题） | 0 | 未过关 | word_choice | 1 |
| 11 | She is going to the park | I am going to the park | 主格代词选错：中文「我」写成 She，且 be 随之变 → I am；（与 I am very busy. 同源；第 11 课复习第 5 题） | 0 | 未过关 | word_choice | 1 |
| 11 | She play soccer | She plays soccer | 主语是第三人称单数时一般现在时动词要加 -s（与 Tom play soccer 同一根线；第 11 课复习第 5 题） | 0 | 未过关 | grammar | 1 |
| 11 | 14 o'clock | 2 p.m. | o'clock 只用于 1—12 点；下午两点说 2 p.m.（或 two in the afternoon），不能说 14 o'clock（与 on weekend 同为「中文直译」类搭配错；第 11 课作业开放题第 2 句） | 0 | 未过关 | word_choice | 1 |
| 12 | usually | often | 「经常」用 often，不用 usually（usually = 通常）；频度副词词义要精确（第 12 课复习第 1 题） | 0 | 未过关 | word_choice | 1 |
| 12 | He play soccer | He plays soccer | 主语 he 是第三人称单数，一般现在时动词要加 -s（与 Tom play soccer 同一根线；第 12 课复习第 1 题） | 0 | 未过关 | grammar | 1 |
| 12 | wasn't eat | didn't eat | 实义动词的否定用 didn't + 原形；wasn't 只能否定 be 动词（与 didn't went 同属「did 类助动词」轴线、方向不同；第 12 课复习第 2 题） | 0 | 未过关 | grammar | 1 |
| 12 | She is reading | He is reading | 主格代词选错：中文「他」写成 She（与 She is going to the park → I am going to the park 同源；第 12 课复习第 3 题） | 0 | 未过关 | word_choice | 1 |
| 12 | He read books | He reads books | 主语 he 是第三人称单数，一般现在时动词要加 -s（与 Tom play soccer 同一根线；第 12 课复习第 3 题） | 0 | 未过关 | grammar | 1 |
| 12 | She go to school | She goes to school | 主语 she 是第三人称单数，一般现在时动词要加 -s（与 Tom play soccer 同一根线；第 12 课复习第 5 题） | 0 | 未过关 | grammar | 1 |
| 12 | by went | on foot ／ walk | 「步行」用 walk（动词）或 on foot；by 后面只能接交通工具名词（by bus / by car），不能接动词过去式（第 12 课复习第 5 题） | 0 | 未过关 | word_choice | 1 |
| 12 | on home weekend | at home on the weekend | 两处虚词错：「在家」是 at home（home 前用 at 不用 on/in）；「在周末」是 on the weekend（on 与 the 都不能省）（第 12 课补漏块 6 第 1 题） | 0 | 未过关 | grammar | 1 |
| 12 | go to travel | travel | 「去某地旅行」直接用 travel to + 地点；go to 后接地点、不接动词（与第 11 课 go to trval in Beijing 同类；第 12 课补漏块 6 第 2 题；**第 13 课补漏块 7 第 2 题再犯、仍只把 in 改成 to → 累计 1→2**，本类第 3 次犯） | 0 | 未过关 | word_choice | 2 |
| 12 | This book more interesting | This book is more interesting | 比较级是形容词、不能单独作谓语，句子里必须有 be 动词（结构缺失；第 12 课作业第 2 题） | 0 | 未过关 | grammar | 1 |
| 13 | She go to work | She goes to work | 主语 she 是第三人称单数，一般现在时动词要加 -s（与 Tom play soccer 同一根线；第 13 课复习第 1 题） | 0 | 未过关 | grammar | 1 |
| 13 | Tom not as taller as than Jack | Tom is not as tall as Jack. | 两处结构错：① `not as … as` 中间用**原级** tall，不能用比较级 taller；② `not as…as` 与 `than` **是两个结构、不能叠用**（要 `than` 就说 `Tom is shorter than Jack.`）——顺带漏了 be 动词 is（第 13 课复习第 2 题） | 0 | 未过关 | grammar | 1 |
| 13 | I shorter than her | I am shorter than her | 形容词比较级不能单独作谓语，句子里必须有 be 动词（与 This book more interesting 同一根线；第 13 课复习第 2 题）✅ than 后用宾格 her 是对的 | 0 | 未过关 | grammar | 1 |
| 13 | I am going to travel | She is going to travel | 主格代词选错：中文「她」写成 I，be 随之变 → She is（与 She is reading / She is going to the park 同源；第 13 课复习第 3 题） | 0 | 未过关 | word_choice | 1 |
| 13 | next mouth | next month | 拼写：month（月）是 m-o-n-t-h，别写成 mouth（嘴）——两个词只差一个字母、读音也不同（第 13 课复习第 3 题） | 0 | 未过关 | spelling | 1 |
| 13 | were not stayed | were not at home ／ didn't stay at home | be 动词的否定（were not）后面不能再接过去式 stayed；「他们不在家」= `They were not at home last Sunday.`（要「没待在家」则用 didn't stay home）（与 wasn't eat 同源：be 否定与实义否定混用；第 13 课复习第 4 题） | 0 | 未过关 | grammar | 1 |
| 13 | streak | walk | 用词：「步行」是 walk（动词）或 on foot；streak 不是这个意思（与 by went 同一根线：都是「步行」表达踩空；第 13 课复习第 5 题） | 0 | 未过关 | word_choice | 1 |
| 13 | the most tall | the tallest | 改错题改反了方向：原句 `the most tallest` 的错在**两个最高级形式叠用**，该删的是 most、保留 -est（短形容词用 -est）；把 -est 删掉留下 `the most tall` 仍是错的（第 13 课作业第 3 题） | 0 | 未过关 | grammar | 1 |
| 13 | is most delious | is the most delicious | 最高级前面**必须有 the**（本课开放题句 2、句 3 连犯 2 次）；句 3 `is most love in fruits` 是同一规则的另一次犯，且 `love` 是动词、不能当形容词（应说 `the most loved`），范围要用 `of all the fruits` 不用 `in`（第 13 课作业第 4 题） | 0 | 未过关 | grammar | 1 |
| 13 | delious | delicious | 拼写：delicious（美味的），拼作 de-li-cious（第 13 课作业第 4 题句 2） | 0 | 未过关 | spelling | 1 |
| 13 | of the there | of the three | 拼写/用词混淆：three（三）≠ there（那里）——只差一个字母、完全不同的词（第 13 课作业第 4 题句 1） | 0 | 未过关 | spelling | 1 |

---

## 类型分布（73 条 · 未过关 61 / 已过关 12）

| 类型 | 条数 | 未过关 |
|---|---|---|
| grammar | 36 | 31 |
| word_choice | 18 | 15 |
| capitalization | 5 | 3 |
| punctuation | 6 | 4 |
| spelling | 8 | 8 |
| other | 0 | 0 |

> 两条归属裁定（`what do you do?` → grammar、`I am very busy` → word_choice）按 `docs/plans/amy-teaching-plan.md` §3.3 执行。
> **2026-09-30 新增 4 条**（`work.So` / `intrusting` / `Our teacher is Amy together.` / `Now, My`）：这 4 处当时已判错但未登记进错词本，属漏登记，本次补入。
> 与 `GET /api/mistakes/stats` 的差异属预期：库内为**上一轮落库后**的条数，本文件已含本课新增行；新课新错词经 `POST /api/mistakes` 落库后两处即对齐（另见 DQ1）。
> **2026-10-02 新增 6 条**（第 9 课）：`at night yesterday`、`They plays games`（复习）+ `didn't went`、`Did you see him yesterday.`、`eat banana`、`No, I didn't`（作业）。复习类错词不在 `records/*.grading.json` 覆盖范围内（见 `records/README.md` §五 5.1），只出现在本文件与库内。
> **2026-10-03 新增 6 条**（第 10 课）：`shcool`、`Do you see him yesterday?`、`visitted`（复习）+ `get offer`、`next Sunday .`、`on weekend`（作业）。`shcool` 一课两犯（复习 + 作业），按判重键命中同一行、`累计犯错` 1→2，**不拆两条**（§11.3 判重键口径）。复习流水与复习新错词的落库课号修复见 `docs/Work Alignment/status-amy.md` A26（第 8 步建行后定向 UPDATE 6 行）。
> **2026-10-04 新增 7 条**（第 11 课）：**6 条来自课前复习** —— `go to trval in Beijing`、`live in home`、`they are watching TV`、`at time`、`She is going to the park`、`She play soccer`；**1 条来自作业** —— `14 o'clock`。⚠️ 本次复习错了 4 题 / 6 处，**明显高于前几课（上次 2 处）**，集中在**用词搭配**（`go to travel` / `live in home` / `at time`，新增 4 条 word_choice）+ 两个老毛病（句首小写、第三人称 -s）；**不规则过去式（第 8 课）复习全对**；作业仅 1 处错（**11 课以来最低**）。`on weekend` 再次命中同一行（累计 1→2），`shcool` 答对 1/2，`Do you like coffee.` 累计 3 次后**过关出队**。
> ⚠️ **流程变更（skill-designer 第十七轮）**：第 4 步起**只判定 + 更新本文件，不调写接口**；错词与复习流水统一在**第 8 步**（`POST /api/lessons` 建行之后）落库 —— 根因见 §上文 A26（第 4 步时第 N 课 `lessons` 行尚不存在，写库会静默留空课号）。
> **2026-10-09 新增 7 条**（第 12 课·**全部来自课前复习**）：`usually`、`He play soccer`、`wasn't eat`、`She is reading`、`He read books`、`She go to school`、`by went`。⚠️ **断更 5 天后复习 8 处错（12 课以来最多）**，其中 **4 处是同一个病根：第三人称单数 -s**（`He play` / `He read` / `She go` + 命中既有的 `Tom play soccer`）⇒ `Tom play soccer` **累计 2→3，触发 §11.6 强制自查项**，第 12 课作业须加 -s 自查。**2 条过关出队**：`those are their bags.`（句首大写）、`I am very busy.`（主格代词）。
> ⚠️ **-s 轴线已在册内按字符串分裂成多条**（`Tom play soccer` / `She play soccer` / `He play soccer` / `He read books` / `She go to school`）—— 这是**判重键在原始文本列**（§11.3）的必然结果，**不是重复录入**；教学上它们是**同一条规则**，故各条 `错因` 互相点名，并以 §11.6 强制自查项做整体收口。
> ✅ **既有 md↔库课号不一致 —— 已查实（2026-10-09）**：`I am very busy.`（DB id **13**）本文件「课号」列记 **5**，库内 `first_lesson_id` 指向 **第 6 课**。**机器证据**：`notes/day-01-07.md:395`（属 **`## 第 5 课 · 2026-09-28`** 段）写「第 2 课 be 动词（翻译：我们很忙）：作答 I am very busy. … → 新入错词本」；`:517`（第 6 课段）才是「第 1 次答对」。⇒ **md 的 5 正确，库内 6 是错值**（该行很可能是在第 6 课处理时才 INSERT，`courseNo` 取了 6）。
> 🔴 **修复待授权**（改真实数据，我未动）：`UPDATE mistakes SET first_lesson_id = 5 WHERE id = 13;`（第 5 课的 `lessons.id` = 5）。影响面：错误会让快照 `recentLessons[].mistakeCount`（＝本课**新引入**错词数）在第 5 课少计 1、第 6 课多计 1 —— 与 §11.11 给 `first` 定「冻结」的理由**同一条**，属首次值本身写错、不是「命中改写」，故不与该条裁定冲突。回滚：`UPDATE mistakes SET first_lesson_id = 6 WHERE id = 13;`
> **2026-10-09 第 12 课作业 + 补漏块 6 补入 3 条**：`on home weekend`、`go to travel`（补漏块 6 第 1、2 题）+ `This book more interesting`（作业第 2 题）；另 `intrusting` 判重命中既有行、**累计 1→2**（第 3 课老错复发）。⇒ 两份契约共 **4 条候选**（`lesson-12.grading.json` 2 条 ＋ `lesson-12.backfill.json` 2 条）→ **3 新建 + 1 命中**，与本表逐条对齐。
> ⚠️ **两项判错不入册（有意）**：① 作业第 2 题的「句尾缺句号」—— 同类已有 3 行在册（`No, I didn't` / `next Sunday .` / `Did you see him yesterday.`），且该处无可独立成串的错误形式；② 作业第 4 题的 `desousic`（**不是英语单词**、无法确定正确形式）⇒ 按 §11.5 第三步归 `other`、标「待人工复核」，**不猜**。两者均**计入错误处数**（作业 `errorCount` 含此项）、只是不进错词本 —— 依 §七「候选 ≠ 入册行，是否入册由人工决定」。

> **2026-10-10 第 13 课复习补入 7 条**（5 题 / 10 个作答点：对 4、错 6 ⇒ **8 处错**）：`She go to work`、`Tom not as taller as than Jack`、`I shorter than her`、`I am going to travel`、`next mouth`、`were not stayed`、`streak`。计数变动 2 处：`Tom play soccer` 连续答对 0→**1**（累计仍 3）、`They plays games` 1→**2 过关出队**。
> ⚠️ **-s 轴线仍不稳定、且这次是「同一题里一对一错」**：题 1(1) `Tom plays soccer` **答对**（该行 1/2），紧接着题 1(2) `She go to work` 又漏 -s ⇒ **不是「不会」，是「没形成稳定习惯」**；在册 -s 条目已增至 **6 条**（`Tom play soccer` / `She play soccer` / `He play soccer` / `He read books` / `She go to school` / `She go to work`）。第 13 课新课已把 -s 列为**第一条强制自查项**并做专门例题。
> ⚠️ **一处「判错但目标行不推进」的有意裁定**：题 5(1) 考的是「步行」表达（目标行 id 217 `by went`，`by` 后接动词过去式）。学生写的是 `streak to school` —— **该行对应的错误形式并未出现**（只是换了个错词）⇒ 按 §11.3 该行**既不 +1 也不判错**，只**新增** `streak` 一行。理由：给「未复发的错误」判错＝制造**假的复发信号**（会推高 `wrong_count` → 误触发 §11.6 强制自查）。
> **两条继续观察**：`intrusting`（累计 2，第 3 课老错；本课复习未考到）、`go to travel`（搭配类，本课第 5 题正是同轴线、学生**没再犯 `go to + 动词`**）。

> **2026-10-10 第 13 课作业 + 补漏块 7 补入 4 条**：`the most tall`（作业第 3 题，**改错题改反了方向**）、`is most delious`（作业第 4 题句 2，**最高级缺 the**）、`delious`（同句拼写）、`of the there`（作业第 4 题句 1 拼写）。计数变动 2 处：**`intrusting` 累计 2→3 → 触发 §11.6 强制自查项**（第 14 课起做题须逐词拼读 interesting）；`go to travel` **累计 1→2**（本类第 3 次犯，**连续两课同一题、同一病根**：只改表面 in→to、不改 `go to + 动词`）。⇒ 两份契约共 **5 条候选**（`lesson-13.grading.json` 4 条 ＋ `lesson-13.backfill.json` 1 条）→ **4 新建 + 1 命中**（`go to travel`），与本表逐条对齐。
> ⚠️ **两项判错不入册（有意）**：① 作业第 2 题的 `th`（漏字母，**疑手误**，且同句已有主错 intrusting）；② 作业第 4 题句 2 的 `in the dinner`（搭配别扭，作**提示**处理、未计为独立处数）。两者均**计入错误处数**或已在批改中提示，只是不进错词本 —— 依 §七「候选 ≠ 入册行，是否入册由人工决定」。
> 🔴 **本课新点「最高级」不是零错误**：打破了第 8—11 课「新语法点零错误」的势头（结构 `the + -est/most + in/of` 会用，但**最高级前漏 the 连犯 2 次** + 改错题改反 + 拼写 3 处）。教学处置：第 14 课把 **①「最高级前必须有 the」② 改错题先找「哪一处错」** 列为自查项。
