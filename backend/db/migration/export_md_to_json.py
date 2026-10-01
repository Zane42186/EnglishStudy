#!/usr/bin/env python3
"""M2 历史回填 · 第一步（只读）：把 md 与 records/ 合并导出为结构化 JSON。

定位变更（2026-09-30）
----------------------
本脚本已从「常设迁移管道」改为**一次性历史回填工具**（第 1—6 课）。
第 7 课起数据由 后端 → 前端 → amy 教学 → amy 产出 `records/*.json` → 回传后端，
不再经过 md。`build_board.py` 已退役，其删除前置条件就是「本脚本不再 import 它」，
因此本脚本**内联所需解析、零外部依赖**。

两个数据源的分工（不可混淆）
----------------------------
- `notes/*.md`     —— 提供**题面**（题干 / 参考答案 / 题型）与**小节正文**、词汇表。
                      历史题面只存在于 md，records 里没有 prompt。
- `records/*.json` —— 提供**判定**（verdict / errorNote / revisedAnswer / targetPoint）。
                      **禁止**从 md 的「批改」散文里做文本匹配判对错。
- `wrong-words.md` —— **错词本的权威来源**（含 `类型` / `累计犯错` 两列）。
- `read/*.md`      —— 阅读三张表的数据源。

用法：
    python export_md_to_json.py --root E:\\English [--out db/_snapshot.json]
    python export_md_to_json.py --root E:\\English --stdout

成功：M2_EXPORT_OK lessons=<n> exercises=<n>(matched/mdOnly/recordsOnly) mistakes=<n> readings=<n> warnings=<n>
失败：M2_EXPORT_FAIL 原因=<原因>（非零退出）
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------- 正则（内联，不再依赖 build_board.py）

LESSON_RE = re.compile(r"^##\s+第\s*(\d+)\s*课(?:\s*·\s*(\S+))?\s*$")
SECTION_RE = re.compile(r"^###\s+(.+?)\s*$")
SUMMARY_RE = re.compile(r"^>\s*一句话[:：]\s*(.+?)\s*$")
NOTE_FILE_RE = re.compile(r"^day-(\d{2})-(\d{2})\.md$")
READ_FILE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})-read\.md$")
PIECE_RE = re.compile(r"^##\s+第\s*(\d+)\s*篇(?:\s*·\s*(.+?))?\s*$")
META_RE = re.compile(r"^(级别|来源|标题)[:：]\s*(.+?)\s*$")
LEVEL_RE = re.compile(r"当前级别[:：]\s*(.+?)\s*$", re.M)

EX_NO_RE = re.compile(r"^(\d+)\s*[.、]\s*(.+)$")
DETAIL_RE = re.compile(r"<details><summary>.*?</summary>(.*?)</details>", re.S)
BACKFILL_HEAD_RE = re.compile(r"^补漏块\s*(\d+)")
BACKFILL_LABEL_RE = re.compile(r"^补漏块\s*(\d+)\s*[:：]\s*$")
MD_TABLE_SEP_RE = re.compile(r"^:?-{2,}:?$")

# md 小节名 → common.schema.json 的 SectionType（唯一权威）
SECTION_TYPE_MAP = {
    "复习": "review",
    "今日语法": "grammar",
    "词汇": "vocab_table",
    "例句": "examples",
    "作业": "homework",
    "我的作答": "my_answer",
    "批改": "grading",
    "难度反馈": "feedback",
}

# progress.md / 难度反馈小节 → Feedback 枚举
FEEDBACK_MAP = {"太简单": "too_easy", "刚好": "just_right", "太难": "too_hard"}

# wrong-words.md 的「状态」列 → mistakes.status
STATUS_MAP = {"已过关": "passed", "未过关": "pending"}

# grading-result.schema.json 的 GradedItem.verdict → lesson_exercises.is_correct
VERDICT_MAP = {
    "correct": True,
    "correct_with_note": True,
    "wrong": False,
    "blank": None,
}

# 题型启发式（md 无题型列，按题干特征推断；一律标 inferred=true 供复核）
EXERCISE_TYPE_RULES = [
    (("翻译",), "translate"),
    (("排成", "语序", "连词成句"), "reorder"),
    (("改错", "找出错误", "改成", "纠正"), "error_correction"),
    (("开放题", "造句"), "open"),
    (("选择",), "choice"),
]


# ---------------------------------------------------------------- 通用工具

def norm_key(text: str) -> str:
    """错词判重用的规范化：去空白/标点、统一小写。"""
    s = str(text)
    s = re.sub(r"[\s,，。.、！？!?：:；;\"'（）()\[\]【】]", "", s)
    return s.lower()


def infer_exercise_type(prompt: str) -> str:
    for keys, value in EXERCISE_TYPE_RULES:
        if any(k in prompt for k in keys):
            return value
    return "fill_blank"


def split_prompt_answer(text: str) -> tuple[str, str | None]:
    answers = DETAIL_RE.findall(text)
    return DETAIL_RE.sub("", text).strip(), (answers[0].strip() if answers else None)


def parse_numbered(items: list[str]) -> dict[int, str]:
    """['1. xxx', '续行', '2. yyy'] → {1: 'xxx 续行', 2: 'yyy'}"""
    out: dict[int, str] = {}
    current: int | None = None
    for raw in items:
        line = raw.strip()
        if not line:
            continue
        match = EX_NO_RE.match(line)
        if match:
            current = int(match.group(1))
            out[current] = match.group(2).strip()
        elif current is not None:
            out[current] = (out[current] + " " + line).strip()
    return out


def parse_md_table(lines: list[str]) -> list[list[str]]:
    rows = []
    for line in lines:
        s = line.strip()
        if not s.startswith("|"):
            continue
        parts = [c.strip() for c in s.strip("|").split("|")]
        if parts and all(MD_TABLE_SEP_RE.fullmatch(p) for p in parts if p):
            continue
        rows.append(parts)
    return rows


# ---------------------------------------------------------------- 解析 notes

def split_lesson_chunks(raw: str) -> dict[int, tuple[str, str]]:
    """按 '## 第 N 课' 切片 → {课号: (日期, 该课原文)}"""
    chunks: dict[int, tuple[str, list[str]]] = {}
    current: int | None = None
    for line in raw.splitlines():
        match = LESSON_RE.match(line)
        if match:
            current = int(match.group(1))
            chunks[current] = (match.group(2) or "", [])
            continue
        if current is not None:
            chunks[current][1].append(line)
    return {no: (date, "\n".join(body)) for no, (date, body) in chunks.items()}


def split_blocks(text: str) -> tuple[dict[str, list[str]], list[dict], list[str]]:
    """把一课切成 {SectionType: lines} + [补漏块] + [未映射小节名]"""
    sections: dict[str, list[str]] = {}
    backfills: list[dict] = []
    unmapped: list[str] = []
    current: tuple[str, object] | None = None

    for line in text.splitlines():
        head = SECTION_RE.match(line)
        if head:
            name = head.group(1).strip()
            if name in SECTION_TYPE_MAP:
                current = ("section", SECTION_TYPE_MAP[name])
                sections.setdefault(SECTION_TYPE_MAP[name], [])
            elif BACKFILL_HEAD_RE.match(name):
                current = ("backfill", int(BACKFILL_HEAD_RE.match(name).group(1)))
                backfills.append({"seq": int(BACKFILL_HEAD_RE.match(name).group(1)),
                                  "title": name, "lines": []})
            else:
                current = None
                unmapped.append(name)
            continue
        if current is None:
            continue
        kind, key = current
        if kind == "section":
            sections[key].append(line)
        else:
            backfills[-1]["lines"].append(line)
    return sections, backfills, unmapped


def parse_vocab(lines: list[str]) -> list[dict]:
    words = []
    for parts in parse_md_table(lines):
        if len(parts) < 3 or parts[0] == "单词":
            continue
        words.append({
            "word": parts[0],
            "phonetic": parts[1] or None,
            "meaning": parts[2] or None,
            "example": (parts[3] if len(parts) > 3 else "") or None,
        })
    return words


def parse_my_answer(lines: list[str]) -> tuple[dict[int, str], dict[int, dict[int, str]]]:
    """我的作答 → (作业作答, {补漏块序号: 作答})，因为两者共用 1..n 题号。"""
    homework_lines: list[str] = []
    backfill_map: dict[int, list[str]] = {}
    current_bf: int | None = None
    for line in lines:
        label = BACKFILL_LABEL_RE.match(line.strip())
        if label:
            current_bf = int(label.group(1))
            backfill_map.setdefault(current_bf, [])
            continue
        if current_bf is None:
            homework_lines.append(line)
        else:
            backfill_map[current_bf].append(line)
    return (
        parse_numbered(homework_lines),
        {no: parse_numbered(ls) for no, ls in backfill_map.items()},
    )


def parse_notes(root: Path) -> tuple[list[dict], list[str]]:
    warnings: list[str] = []
    lessons: list[dict] = []
    for path in sorted((root / "notes").glob("*.md")):
        if not NOTE_FILE_RE.match(path.name):
            warnings.append(f"笔记文件名不符合 day-XX-YY.md 规范，已跳过：{path.name}")
            continue
        raw = path.read_text(encoding="utf-8")
        for no, (date, body) in sorted(split_lesson_chunks(raw).items()):
            summary = next(
                (SUMMARY_RE.match(l).group(1).strip() for l in body.splitlines() if SUMMARY_RE.match(l)),
                None,
            )
            sections, backfills, unmapped = split_blocks(body)
            for name in unmapped:
                warnings.append(f"第 {no} 课：小节「{name}」不在 SectionType 枚举内（历史回填需定归置口径）")
            feedback_raw = next(
                (x.strip() for x in sections.get("feedback", []) if x.strip() and not x.strip().startswith(">")),
                None,
            )
            lessons.append({
                "lessonNo": no,
                "lessonDate": date or None,
                "summary": summary,
                "sourceFile": path.name,
                "sections": sections,
                "backfills": backfills,
                "vocab": parse_vocab(sections.get("vocab_table", [])),
                "feedbackRaw": feedback_raw,
            })
    lessons.sort(key=lambda x: x["lessonNo"])
    return lessons, warnings


# ---------------------------------------------------------------- 解析 records

def parse_records(root: Path) -> tuple[dict[tuple[int, str], dict], list[str]]:
    """records/lesson-NN.<kind>.json → {(课号, kind): 文件内容}"""
    warnings: list[str] = []
    out: dict[tuple[int, str], dict] = {}
    records_dir = root / "records"
    if not records_dir.is_dir():
        warnings.append("records/ 目录不存在，判定数据将全部缺失")
        return out, warnings
    for path in sorted(records_dir.glob("lesson-*.json")):
        match = re.match(r"^lesson-(\d+)\.([a-z]+)\.json$", path.name)
        if not match:
            warnings.append(f"records 文件名不符合规范，已跳过：{path.name}")
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        # 以文件**内部的 kind 字段**为准：lesson-01.grading.json 的 kind 是 homework
        kind = data.get("kind") or match.group(2)
        out[(int(match.group(1)), kind)] = data
    return out, warnings


# ---------------------------------------------------------------- 解析阅读 / 错词 / 进度

def parse_read_dir(root: Path) -> tuple[list[dict], list[str]]:
    warnings: list[str] = []
    days: list[dict] = []
    empty_answers: list[str] = []   # §11.10：answer 为空的数据缺陷（逐题记录）
    read_dir = root / "read"
    if not read_dir.is_dir():
        warnings.append("read/ 目录不存在")
        return days, warnings
    for path in sorted(read_dir.glob("*.md")):
        match = READ_FILE_RE.match(path.name)
        if not match:
            warnings.append(f"阅读文件名不符合规范，已跳过：{path.name}")
            continue
        pieces: list[dict] = []
        current: dict | None = None
        for line in path.read_text(encoding="utf-8").splitlines():
            head = PIECE_RE.match(line)
            if head:
                current = {"pieceNo": int(head.group(1)), "title": head.group(2) or None, "lines": []}
                pieces.append(current)
                continue
            if current is not None:
                current["lines"].append(line)
        for piece in pieces:
            meta: dict[str, str] = {}
            body: list[str] = []
            for line in piece.pop("lines"):
                m = META_RE.match(line.strip())
                if m:
                    meta[{"级别": "levelCode", "来源": "source", "标题": "title"}[m.group(1)]] = m.group(2).strip()
                    continue
                body.append(line)
            paragraphs: list[dict] = []
            notes, questions = None, []
            idx, n = 0, len(body)
            while idx < n:
                line = body[idx].strip()
                idx += 1
                if not line:
                    continue
                if line.startswith("生词注释"):
                    notes = re.split(r"[:：]", line, maxsplit=1)[-1].strip()
                    continue
                if line.startswith("理解题"):
                    # 每题的「题干行 + <details> 答案行」成对：答案行并入上一题，
                    # 不得把答案行当成一道新题（否则题数翻倍、题干为空）。
                    for raw in body[idx:]:
                        text = raw.strip()
                        if not text:
                            continue
                        ans = DETAIL_RE.search(text)
                        stem = re.sub(r"^\d+\s*[.、]\s*", "", DETAIL_RE.sub("", text)).strip()
                        numbered = bool(re.match(r"^\d+\s*[.、]", text))
                        if ans and not stem:
                            if questions:
                                questions[-1]["answer"] = ans.group(1).strip()
                            continue
                        if not numbered and questions and not ans:
                            questions[-1]["question"] += " " + stem
                            continue
                        questions.append({
                            "questionNo": len(questions) + 1,
                            "question": stem,
                            "answer": (ans.group(1).strip() if ans else ""),
                        })
                    break
                if line.startswith(">"):
                    if paragraphs:
                        paragraphs[-1]["zh"] = re.sub(r"^>\s?", "", line)
                    continue
                paragraphs.append({"en": line, "zh": None})
            piece.update({
                "levelCode": meta.get("levelCode"),
                "source": meta.get("source"),
                "title": meta.get("title") or piece.get("title"),
                "paragraphs": paragraphs,
                "vocabularyNotes": notes,
                "questions": questions,
            })
            # §11.10：阅读题 answer 为空 = **数据缺陷**（schema 里 answer 是 required string）。
            # 这里改前是**静默填空串** —— 空串进库后看起来就是一条正常数据，与 §11.10
            # 「让缺陷可见」的裁定方向正好相反，故改为显式告警 + 计数。
            # ⚠️ 只加告警，**不改输出行为**（仍按原值导出）；「跳过该篇」与库约束留待后续一起上。
            for q in questions:
                if not (q.get("answer") or "").strip():
                    empty_answers.append(
                        f"{match.group(1)} 第 {piece.get('pieceNo')} 篇 第 {q.get('questionNo')} 题"
                    )
        days.append({"date": match.group(1), "sourceFile": path.name, "pieces": pieces})
    if empty_answers:
        warnings.append(
            f"阅读题 answer 为空 {len(empty_answers)} 题（§11.10 数据缺陷，已按缺陷导出，"
            f"前端不得渲染成功能）：{'；'.join(empty_answers)}"
        )
    days.sort(key=lambda x: x["date"])
    return days, warnings


def parse_wrong_words(root: Path) -> tuple[list[dict], list[str]]:
    """错词本 = 权威来源；含 `类型` / `累计犯错` 两列。"""
    warnings: list[str] = []
    out: list[dict] = []
    path = root / "wrong-words.md"
    if not path.exists():
        warnings.append("wrong-words.md 不存在")
        return out, warnings
    for parts in parse_md_table(path.read_text(encoding="utf-8").splitlines()):
        if len(parts) < 8 or parts[0] == "课号":
            continue
        lesson_raw, wrong, correct, reason, streak, status, etype, wcount = parts[:8]
        out.append({
            "wrongText": wrong,
            "correctText": correct,
            "errorReason": reason or None,
            "streak": int(streak) if streak.isdigit() else None,
            "status": STATUS_MAP.get(status),
            "statusRaw": status,
            "errorType": etype or None,
            "wrongCount": int(wcount) if wcount.isdigit() else None,
            "sourceLessonRaw": lesson_raw,
            "firstLessonNo": int(lesson_raw) if lesson_raw.isdigit() else None,
        })
    return out, warnings


def parse_exercise_error_types(root: Path) -> tuple[dict[tuple[int, str, int], str], list[str]]:
    """逐题 `error_type` 映射 = `records/exercise-error-types.json`（Amy 产出）。

    `error_type` 一题只有一个值，且**只能由教学侧判定**（用词 vs 语法判不出靠文本匹配），
    故它不是能从 md 推出来的派生字段 —— 必须由本文件显式给出。
    键 = (课号, block_kind, 题号)；`kind` 与库内 `block_kind` 同值。
    """
    warnings: list[str] = []
    out: dict[tuple[int, str, int], str] = {}
    path = root / "records" / "exercise-error-types.json"
    if not path.exists():
        warnings.append("records/exercise-error-types.json 不存在，exercise.errorType 将全部为 null")
        return out, warnings
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"records/exercise-error-types.json 解析失败，已忽略：{exc}")
        return out, warnings
    for row in doc.get("rows") or []:
        no = row.get("lessonNo")
        kind = row.get("kind")
        ex_no = row.get("exerciseNo")
        etype = row.get("errorType")
        if no is None or kind is None or ex_no is None:
            warnings.append(f"exercise-error-types 有一行缺 lessonNo/kind/exerciseNo，已跳过：{row}")
            continue
        if etype:  # 判对 / 有备注 / 空题 → 不落类型，保持 null
            out[(int(no), str(kind), int(ex_no))] = str(etype)
    return out, warnings


def parse_progress_md(root: Path) -> dict:
    path = root / "progress.md"
    text = path.read_text(encoding="utf-8") if path.exists() else ""

    def grab(pattern: str):
        m = re.search(pattern, text, re.M)
        return m.group(1).strip() if m else None

    current_no = grab(r"当前课号[:：]\s*(\d+)")

    # 逐课级别：progress.md 的「已学完清单」形如 `- 第 7 课（Level 2）规则动词过去式 -ed …`
    # 这是 Amy 维护的**逐课权威声明**（第 1—3 课是 Level 1，与「当前级别」不同，不可替换）。
    # lessons.level_code 是 NOT NULL：已存在的课由写库器只更新、无需该值；
    # 但**首次入库的新课**必须带上，否则写库器会「无法凭空造行」而整课跳过。
    per_lesson_level = {
        int(no): f"Level {int(lv)}"
        for no, lv in re.findall(r"第\s*(\d+)\s*课\s*[（(]\s*Level\s*(\d+)\s*[）)]", text)
    }

    # 逐课语法点：同一行「第 N 课（Level X）<语法点>（补充说明）」。
    # lessons.grammar_point 用于课程卡/详情页展示；第 1—6 课的值历史上由 seed 写死，
    # 首次入库的新课（如第 7 课）若无此值会留 NULL，故在此解析。
    per_lesson_grammar = {}
    for line in text.splitlines():
        m = re.match(r"^\s*-\s*第\s*(\d+)\s*课\s*[（(]\s*Level\s*\d+\s*[）)]\s*(.+?)\s*$", line)
        if not m:
            continue
        no, rest = int(m.group(1)), m.group(2)
        # 去掉行尾括号补充说明，只留语法点本体
        rest = re.split(r"[（(]", rest)[0].strip()
        if rest:
            per_lesson_grammar[no] = rest

    return {
        "levelCode": grab(r"当前级别[:：]\s*(.+?)\s*$"),
        "currentLessonNo": int(current_no) if current_no else None,
        "lastClassDate": grab(r"上次上课[:：]\s*(\d{4}-\d{2}-\d{2})"),
        "perLessonLevel": per_lesson_level,
        "perLessonGrammar": per_lesson_grammar,
    }


# ---------------------------------------------------------------- 合并

def build_exercises(lesson: dict, records: dict, error_types: dict, warnings: list[str]) -> tuple[list[dict], dict]:
    """md 提供题面，records 提供判定，`exercise-error-types.json` 提供逐题 `error_type`。

    逐题按 (blockKind, blockNo, exerciseNo) 对齐。
    题号是**块内**的：作业与补漏块各自从 1 开始，因此必须带 blockKind / blockNo
    才构成唯一键（lesson_exercises.uk_exercise）。作业 blockNo=0（非补漏块）。
    """
    hw_answers, bf_answers = parse_my_answer(lesson["sections"].get("my_answer", []))
    out: list[dict] = []
    stats = {"md": 0, "records": 0, "matched": 0, "mdOnly": 0, "recordsOnly": 0}

    def emit(block_kind: str, block_no: int, no: int, prompt_raw: str, fallback_answer: str | None):
        prompt, ref = split_prompt_answer(prompt_raw)
        rec_items = {i["exerciseNo"]: i for i in (records.get((lesson["lessonNo"], block_kind), {}).get("items") or [])}
        r = rec_items.get(no)
        if r:
            stats["matched"] += 1
            stats["records"] += 1
        else:
            stats["mdOnly"] += 1
            warnings.append(f"第 {lesson['lessonNo']} 课 blockKind={block_kind} 第 {no} 题：md 有题面但 records 无判定")
        stats["md"] += 1
        out.append({
            "blockKind": block_kind,
            "blockNo": block_no,
            "exerciseNo": no,
            "exerciseType": infer_exercise_type(prompt),
            "exerciseTypeInferred": True,
            "prompt": prompt,
            "selfCheck": None,                 # md / records 均无，待 amy
            "referenceAnswer": ref,
            "userAnswer": (r.get("userAnswer") if r else fallback_answer),
            "isCorrect": VERDICT_MAP.get(r["verdict"]) if r else None,
            "errorType": error_types.get((lesson["lessonNo"], block_kind, no)),  # 来自 exercise-error-types.json；判对/空题保持 None
            "errorNote": r.get("errorNote") if r else None,
            "revisedAnswer": r.get("revisedAnswer") if r else None,
            "targetPoint": r.get("targetPoint") if r else None,
            "verdictRaw": r.get("verdict") if r else None,
            "source": "md+records" if r else "md-only",
            "recordsNote": r.get("note") if r else None,
        })

    for no, raw in sorted(parse_numbered(lesson["sections"].get("homework", [])).items()):
        emit("homework", 0, no, raw, hw_answers.get(no))

    for block in lesson["backfills"]:
        answers = bf_answers.get(block["seq"], {})
        for no, raw in sorted(parse_numbered(block["lines"]).items()):
            emit("backfill", block["seq"], no, raw, answers.get(no))

    # records 有判定、md 无题面
    for block_kind in ("homework", "backfill"):
        seen = {(i["blockNo"], i["exerciseNo"]) for i in out if i["blockKind"] == block_kind}
        for i in records.get((lesson["lessonNo"], block_kind), {}).get("items") or []:
            block_no = 0 if block_kind == "homework" else next(
                (b["seq"] for b in lesson["backfills"] if b["seq"]), 0
            )
            if (block_no, i["exerciseNo"]) not in seen:
                stats["recordsOnly"] += 1
                warnings.append(
                    f"第 {lesson['lessonNo']} 课 blockKind={block_kind} 第 {i['exerciseNo']} 题：records 有判定但 md 无题面"
                )
    return out, stats


def build_snapshot(root: Path) -> dict:
    warnings: list[str] = []
    lessons, w = parse_notes(root)
    warnings += w
    records, w = parse_records(root)
    warnings += w
    readings, w = parse_read_dir(root)
    warnings += w
    mistakes, w = parse_wrong_words(root)
    warnings += w
    error_types, w = parse_exercise_error_types(root)
    warnings += w

    progress = parse_progress_md(root)
    # 逐课级别优先于「当前级别」：第 1—3 课是 Level 1，用当前级别会全部错标成 Level 2
    per_lesson_level = progress.get("perLessonLevel") or {}

    out_lessons = []
    totals = {"md": 0, "records": 0, "matched": 0, "mdOnly": 0, "recordsOnly": 0}
    for lesson in lessons:
        exercises, s = build_exercises(lesson, records, error_types, warnings)
        for k in totals:
            totals[k] += s[k]
        sections = [
            {"sectionType": name, "contentMd": "\n".join(lines).strip(), "orderIndex": idx}
            for idx, (name, lines) in enumerate(lesson["sections"].items())
            if "\n".join(lines).strip()
        ]
        # 补漏块整段原文 → 单独一个 section_type='backfill'（每课次最多一条，见 docs/skills.md 2.5）
        if lesson["backfills"]:
            merged = "\n\n".join(
                f"### {b['title']}\n\n{b['contentMd']}".strip()
                for b in (
                    {"title": b["title"], "contentMd": "\n".join(b["lines"]).strip()}
                    for b in lesson["backfills"]
                )
                if b["contentMd"]
            )
            if merged:
                sections.append({"sectionType": "backfill", "contentMd": merged, "orderIndex": len(sections)})
        out_lessons.append({
            "lessonNo": lesson["lessonNo"],
            "lessonDate": lesson["lessonDate"],
            "levelCode": per_lesson_level.get(lesson["lessonNo"]) or progress.get("levelCode"),
            "grammarPoint": (progress.get("perLessonGrammar") or {}).get(lesson["lessonNo"]),
            "summary": lesson["summary"],
            "sourceFile": lesson["sourceFile"],
            "feedback": FEEDBACK_MAP.get(lesson["feedbackRaw"] or ""),
            "feedbackRaw": lesson["feedbackRaw"],
            "sections": sections,
            "backfillBlocks": [{"seq": b["seq"], "title": b["title"],
                                "contentMd": "\n".join(b["lines"]).strip()} for b in lesson["backfills"]],
            "vocabulary": lesson["vocab"],
            "exercises": exercises,
            # records 侧的汇总（byType / historicalErrorCount / backfillErrorCount）——
            # 写库器据此回填 study_records(grade).payload.byType，无需再读 records/ 目录。
            "recordsSummary": {
                kind: (records.get((lesson["lessonNo"], kind)) or {}).get("summary")
                for kind in ("homework", "backfill")
            },
        })

    # 错词对账：以错词本为准，records 只做交叉校验
    ww_keys = {norm_key(m["wrongText"]): m for m in mistakes}
    cand_total, cand_new = 0, []
    for (lesson_no, kind), rec in records.items():
        for c in rec.get("mistakeCandidates") or []:
            cand_total += 1
            if norm_key(c["wrongText"]) not in ww_keys:
                cand_new.append({"lessonNo": lesson_no, "kind": kind,
                                 "wrongText": c["wrongText"], "errorType": c.get("errorType")})
    if cand_new:
        warnings.append(
            f"records 有 {len(cand_new)} 条错词候选不在错词本中（按『以错词本为准』口径**不得新建**，需 amy 复核）："
            + "、".join(x["wrongText"] for x in cand_new)
        )
    if not mistakes:
        warnings.append("错词本为空，mistakes 回填将无数据")

    if not error_types:
        warnings.append(
            "exercises.errorType 全部为 null：缺少 records/exercise-error-types.json 的逐题回填"
        )

    return {
        "generatedFrom": {
            "notes": sorted({l["sourceFile"] for l in lessons}),
            "records": [f"lesson-{k[0]:02d}.{k[1]}.json" for k in sorted(records)],
            "read": [d["sourceFile"] for d in readings],
            "wrongWords": "wrong-words.md",
            "progress": "progress.md",
        },
        "degraded": not records,
        "progress": progress,
        "lessons": out_lessons,
        "mistakes": mistakes,
        "readings": readings,
        "reconciliation": {
            "exercises": totals,
            "recordsFiles": len(records),
            "mistakeCandidates": cand_total,
            "mistakeCandidatesNotInBook": len(cand_new),
            "exerciseErrorTypes": len(error_types),
        },
        "warnings": warnings,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="M2 只读导出：md + records → 结构化 JSON")
    parser.add_argument("--root", required=True, help="学习目录，例如 E:\\English")
    parser.add_argument("--out", default=None, help="输出文件路径")
    parser.add_argument("--stdout", action="store_true", help="把 JSON 打到 stdout")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    if not (root / "notes").is_dir():
        print("M2_EXPORT_FAIL 原因=notes 目录不存在")
        return 1

    try:
        snapshot = build_snapshot(root)
    except Exception as exc:  # noqa: BLE001 — CLI 需可读诊断
        print(f"M2_EXPORT_FAIL 原因={exc}")
        return 1

    payload = json.dumps(snapshot, ensure_ascii=False, indent=2)
    if args.stdout:
        print(payload)
    if args.out:
        out_path = Path(args.out)
        if not out_path.is_absolute():
            out_path = root / out_path
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(payload + "\n", encoding="utf-8")
        print(f"M2_EXPORT_WROTE {out_path}")

    ex = sum(len(l["exercises"]) for l in snapshot["lessons"])
    pieces = sum(len(r["pieces"]) for r in snapshot["readings"])
    rec = snapshot["reconciliation"]
    print(
        f"M2_EXPORT_OK lessons={len(snapshot['lessons'])} exercises={ex} "
        f"(matched={rec['exercises']['matched']} mdOnly={rec['exercises']['mdOnly']} "
        f"recordsOnly={rec['exercises']['recordsOnly']}) mistakes={len(snapshot['mistakes'])} "
        f"readings={len(snapshot['readings'])}(pieces={pieces}) "
        f"errorTypes={rec.get('exerciseErrorTypes', 0)} "
        f"candNotInBook={rec['mistakeCandidatesNotInBook']} warnings={len(snapshot['warnings'])}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
