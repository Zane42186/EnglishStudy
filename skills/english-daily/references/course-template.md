# 笔记与阅读模板

课程笔记写在 `notes\day-起始-结束.md`，阅读写在 `read\YYYY-MM-DD-read.md`，两者分开。小节标题文字必须与本模板一致，脚本按标题解析，改一个字就看板解析不出来。

## 一、课程笔记模板（第 1 课，Level 1 示例）

```markdown
## 第 1 课 · 2026-09-26

> 一句话：学会「主语 + 谓语 + 宾语」的语序，能写出 I like music 这类最简单的句子

### 复习

首次上课，无复习内容。

### 今日语法

英语最基本的句子顺序是：**主语 + 谓语 + 宾语**。

- 主语：做这件事的人（I / you / Tom）
- 谓语：这个动作（like / study / need）
- 宾语：动作的对象（music / English / help）

中文说「我 喜欢 音乐」，英文也是同样的顺序：I like music.

### 词汇

| 单词 | 音标 | 中文 | 例句 |
|---|---|---|---|
| like | /laɪk/ | 喜欢 | I like music. |
| study | /ˈstʌdi/ | 学习 | I study English. |
| need | /niːd/ | 需要 | We need help. |
| music | /ˈmjuːzɪk/ | 音乐 | I like music. |
| English | /ˈɪŋɡlɪʃ/ | 英语 | She studies English. |

### 例句

1. I like music.
2. She studies English.
3. Tom plays football.
4. They watch movies.
5. We need help.

### 作业

1. 翻译：我喜欢英语。
<details><summary>看答案</summary>I like English.</details>

2. 翻译：他学习音乐。
<details><summary>看答案</summary>He studies music.</details>

3. 用 like / study / need 各造一个句子。

### 我的作答

1. I like English.
2. He study music.
3. I like games. I study English. I need help.

### 批改

1. 正确。
2. 语法错误：主语 he 是第三人称单数，一般现在时的动词要加 -s。正确句：He studies music.
3. 正确。三个句子都用了「主语 + 谓语 + 宾语」的语序。

### 难度反馈

刚好
```

各小节写法要求：

- `## 第 N 课 · YYYY-MM-DD`：N 用阿拉伯数字，不加前导零。日期只在当天第一次课时标出。
- `> 一句话：…`：整课的一句话摘要，总目录和看板都取这一行，控制在 40 字以内。
- `### 复习`：记录本次复习的题与结果。首次上课写「首次上课，无复习内容。」
- `### 今日语法`：只讲 1 个语法点，配中文解释和 2—3 个例子。
- `### 词汇`：md 表格，四列固定为 单词 / 音标 / 中文 / 例句，每课 5—8 行。看板会把这张表变成点击翻中文的词卡。
- `### 例句`：编号列表，3—5 句。
- `### 作业`：编号列表，3 道小题 + 1 道开放题。答案一律用 `<details><summary>看答案</summary>…</details>` 包起来。
- `### 我的作答`：原样记录用户提交的内容，不修饰、不改正。
- `### 批改`：每题一行，格式为「结论 + 错误类型 + 正确句 + 一句解释」。
- `### 难度反馈`：只写 太简单 / 刚好 / 太难 中的一个词。
- 课程笔记里**不写阅读**，阅读一律进 `read\YYYY-MM-DD-read.md`。

## 二、阅读文件模板

文件名 `read\YYYY-MM-DD-read.md`，一天一个文件，当天 1—3 篇。

```markdown
# 2026-09-26 阅读

> 课后自动生成，同一天只生成一次；手工修改后再次上课不会被覆盖。

## 第 1 篇 · My Day

级别：Level 1
来源：自编

I like music. I study English every day.
> 我喜欢音乐。我每天学英语。

I work in a small company. I play games after work.
> 我在一家小公司上班。下班后我打游戏。

生词注释：every day 每天 / company 公司 / after work 下班后

理解题：
1. What does the writer study every day?
<details><summary>看答案</summary>English.</details>

2. What does the writer do after work?
<details><summary>看答案</summary>He plays games.</details>

## 第 2 篇 · My Teacher

级别：Level 1
来源：自编

My teacher is Amy. She is kind and patient.
> 我的老师是 Amy。她又和蔼又有耐心。

I am a student. I am happy in her class.
> 我是学生。我在她的课上很开心。

生词注释：kind 和蔼的 / patient 有耐心的 / class 课

理解题：
1. What is Amy like?
<details><summary>看答案</summary>She is kind and patient.</details>
```

规则：

- 篇标题写 `## 第 N 篇 · 标题`，脚本按它切分；标题可以省略，只写 `## 第 N 篇`。
- 每篇内部先写 `级别：`、`来源：` 两行，可选再写 `标题：`（写在篇标题里时可不写）。
- 英文段落与中文翻译成对出现：先写英文行（可多行），紧接一行以 `>` 开头的中文。看板会做成「点击看中文」。
- `生词注释：` 一行写完，词与释义之间用空格分隔，多个词之间用 `/` 分隔。
- 每篇至少 2 道理解题，答案用 `<details>` 折叠。
