#!/usr/bin/env python3
"""M2 迁移第一步（只读）：把 md 真相源导出为结构化 JSON。

设计约束（见 backend/docs/04-migration-and-roadmap.md）：
1. **只读**：绝不修改 notes/ read/ wrong-words.md progress.md 任何文件。
2. **不重写解析器**：复用 build_board.py 的 parse_notes / parse_read_dir /
   parse_wrong_words / read_level（同一套正则，避免两处规则漂移）。
3. **不静默丢数据**：凡「md 里有、契约要求、但当前无法可靠推导」的字段，
   一律写进 warnings，而不是塞默认值。

用法：
    python export_md_to_json.py --root E:\\English [--out db/_snapshot.json]
    python export_md_to_json.py --root E:\\English --stdout

成功：M2_EXPORT_OK lessons=<n> vocab=<n> mistakes=<n> readings=<n> warnings=<n>
失败：M2_EXPORT_FAIL 原因=<原因>（非零退出）
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------- 常量

# md 小节名 → common.schema.json 的 SectionType 枚举（唯一权威）
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
FEEDBACK_MAP = {
    "太简单": "too_easy",
    "刚好": "just_right",
    "太难": "too_hard",
}

# wrong-words.md 的「状态」列 → mistakes.status
STATUS_MAP = {"已过关": "passed", "未过关": "pending"}

EX_NO_RE = re.compile(r"^(\d+)\s*[.、]\s*(.+)$")
DETAIL_RE = re.compile(r"<details><summary>.*?</summary>(.*?)</details>", re.S)
BACKFILL_HEAD_RE = re.compile(r"^补漏块\s*(\d+)")
LEVEL_NO_RE = re.compile(r"^Level\s*(\d+)$")

# 题型启发式（md 里没有题型列，只能按题干特征推断，故一律标 inferred）
EXERCISE_TYPE_RULES = [
    (("翻译",), "translate"),
    (("排成", "语序", "连词成句"), "reorder"),
    (("改错", "找出错误", "改成", "纠正"), "error_correction"),
    (("开放题", "造句"), "open"),
    (("选择",), "choice"),
]


# ---------------------------------------------------------------- 加载 build_board

def load_build_board(script_dir: Path):
    """从指定目录加载 build_board.py（不执行其 main）。"""
    target = script_dir / "build_board.py"
    if not target.exists():
        raise FileNotFoundError(
            f"找不到 build_board.py：{target}\n"
            "用 --build-board 指定其所在目录（默认 .workbuddy/skills/english-daily/scripts）"
        )
    spec = importlib.util.spec_from_file_location("build_board_m2", target)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # 有 __main__ 守卫，import 无副作用
    return module


# ---------------------------------------------------------------- 解析辅助

def infer_exercise_type(prompt: str) -> tuple[str, bool]:
    for keys, value in EXERCISE_TYPE_RULES:
        if any(k in prompt for k in keys):
            return value, True
    return "fill_blank", True


def parse_numbered(items: list[str]) -> dict[int, str]:
    """把 ['1. xxx', '续行', '2. yyy'] 解析成 {1: 'xxx 续行', 2: 'yyy'}。"""
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


def split_prompt_answer(text: str) -> tuple[str, str | None]:
    """从题干里拆出 <details> 参考答案，并把 details 从题干中移除。"""
    answers = DETAIL_RE.findall(text)
    prompt = DETAIL_RE.sub("", text).strip()
    return prompt, (answers[0].strip() if answers else None)


def sections_of(lesson: dict, warnings: list[str]) -> list[dict]:
    """把 build_board 的 sections（原始行）转成 SectionContent[]。"""
    out: list[dict] = []
    order = 0
    for name, lines in lesson["sections"].items():
        body = "\n".join(lines).strip()
        if not body:
            continue
        section_type = SECTION_TYPE_MAP.get(name)
        if section_type is None:
            warnings.append(
                f"第 {lesson['no']} 课：小节「{name}」不在 SectionType 枚举内，已跳过（内容 {len(body)} 字符）"
            )
            continue
        out.append({"sectionType": section_type, "contentMd": body, "orderIndex": order})
        order += 1
    return out


def split_lesson_chunks(raw_text: str) -> dict[int, str]:
    """按 '## 第 N 课' 把整份笔记切成 {课号: 该课原文}，供取 SECTION_ORDER 之外的小节。"""
    lesson_head_re = re.compile(r"^##\s+第\s*(\d+)\s*课(?:\s*·\s*(\S+))?\s*$")
    chunks: dict[int, list[str]] = {}
    current: int | None = None
    for line in raw_text.splitlines():
        match = lesson_head_re.match(line)
        if match:
            current = int(match.group(1))
            chunks[current] = []
            continue
        if current is not None:
            chunks[current].append(line)
    return {no: "\n".join(lines) for no, lines in chunks.items()}


def backfill_blocks(raw_text: str, warnings: list[str]) -> list[dict]:
    """抓出 ### 补漏块 N ... 整段（会被 SECTION_ORDER 白名单丢弃，单独留证）。"""
    blocks: list[dict] = []
    lines = raw_text.splitlines()
    current: dict | None = None
    for line in lines:
        head = re.match(r"^###\s+(.+?)\s*$", line)
        if head:
            title = head.group(1)
            match = BACKFILL_HEAD_RE.match(title)
            if match:
                current = {"seq": int(match.group(1)), "title": title, "lines": []}
                blocks.append(current)
            else:
                current = None
            continue
        if current is not None:
            current["lines"].append(line)
    for block in blocks:
        block["contentMd"] = "\n".join(block["lines"]).strip()
        del block["lines"]
        if not block["contentMd"]:
            warnings.append(f"补漏块 {block['seq']}「{block['title']}」正文为空")
    return blocks


def parse_exercises(lesson: dict, warnings: list[str]) -> list[dict]:
    """作业 → exercises[]。批改是自由文本，**不在此处判定对错**（需 amy 判定）。"""
    homework = parse_numbered(lesson["sections"].get("作业", []))
    my_answer = parse_numbered(lesson["sections"].get("我的作答", []))
    out: list[dict] = []
    for no in sorted(homework):
        prompt, reference = split_prompt_answer(homework[no])
        ex_type, inferred = infer_exercise_type(prompt)
        item = {
            "exerciseNo": no,
            "exerciseType": ex_type,
            "exerciseTypeInferred": inferred,
            "prompt": prompt,
            "referenceAnswer": reference,
            "userAnswer": my_answer.get(no),
            "isCorrect": None,          # ← 需 amy 判定（md「批改」是散文）
            "errorType": None,          # ← 需 amy 判定
            "errorNote": None,          # ← 需 amy 判定
            "selfCheck": None,          # ← 需 amy 判定（且表结构待补列）
        }
        out.append(item)
        if reference is None:
            warnings.append(f"第 {lesson['no']} 课第 {no} 题：无 <details> 参考答案")
        if no not in my_answer:
            warnings.append(f"第 {lesson['no']} 课第 {no} 题：我的作答缺失")
    extra = sorted(set(my_answer) - set(homework))
    if extra:
        warnings.append(f"第 {lesson['no']} 课：作答里有作业未编号的题 {extra}")
    return out


def parse_feedback(lesson: dict, warnings: list[str]) -> str | None:
    lines = [x.strip() for x in lesson["sections"].get("难度反馈", []) if x.strip()]
    for line in lines:
        if not line.startswith(">"):
            return FEEDBACK_MAP.get(line)
    warnings.append(f"第 {lesson['no']} 课：难度反馈小节无有效取值")
    return None


def parse_mistakes(rows: list[list[str]], warnings: list[str]) -> list[dict]:
    out: list[dict] = []
    for row in rows:
        if len(row) < 6:
            warnings.append(f"错词本行字段不足 6 列，已跳过：{row}")
            continue
        lesson_raw, wrong_text, correct_text, reason, streak_raw, status_raw = row[:6]
        first_no = int(lesson_raw) if lesson_raw.isdigit() else None
        status = STATUS_MAP.get(status_raw)
        if status is None:
            warnings.append(f"错词「{wrong_text}」状态取值未知：{status_raw}")
        out.append(
            {
                "wrongText": wrong_text,
                "correctText": correct_text,
                "errorReason": reason,
                "streak": int(streak_raw) if streak_raw.isdigit() else None,
                "status": status,
                "firstLessonNo": first_no,
                "sourceLessonRaw": lesson_raw,
                # ↓ 两个字段 md 里没有，且属语义判定，必须由 amy 给
                "errorType": None,
                "wrongCount": None,
            }
        )
    return out


def parse_progress_md(root: Path) -> dict:
    path = root / "progress.md"
    text = path.read_text(encoding="utf-8") if path.exists() else ""

    def grab(pattern: str):
        match = re.search(pattern, text, re.M)
        return match.group(1).strip() if match else None

    level = grab(r"当前级别[:：]\s*(.+?)\s*$")
    level_no = None
    if level:
        m = LEVEL_NO_RE.match(level)
        level_no = int(m.group(1)) if m else None
    current_no = grab(r"当前课号[:：]\s*(\d+)")
    return {
        "levelCode": level,
        "levelNo": level_no,
        "currentLessonNo": int(current_no) if current_no else None,
        "lastFeedbackRaw": grab(r"最近反馈[:：]\s*(.+?)\s*$"),
        "lastClassDate": grab(r"上次上课[:：]\s*(\d{4}-\d{2}-\d{2})"),
        "easyStreakRaw": grab(r"太简单连击计数[:：]\s*(\d+)\s*/\s*(\d+)"),
    }


# ---------------------------------------------------------------- 主流程

def build_snapshot(root: Path, bb) -> dict:
    warnings: list[str] = []

    lessons = bb.parse_notes(root / "notes")
    days = bb.parse_read_dir(root / "read")
    wrong_rows = bb.parse_wrong_words(root / "wrong-words.md")
    level = bb.read_level(root)
    notes_files = sorted((root / "notes").glob("*.md"))

    out_lessons = []
    lesson_chunks: dict[int, str] = {}
    for lesson in lessons:
        source_file = lesson["file"]
        raw_text = (root / "notes" / source_file).read_text(encoding="utf-8")
        chunks = split_lesson_chunks(raw_text)
        for no, text in chunks.items():
            lesson_chunks.setdefault(no, text)
        out_lessons.append(
            {
                "lessonNo": lesson["no"],
                "lessonDate": lesson["date"] or None,
                "levelCode": None,       # md 只在 progress.md 记级别，逐课级别不可靠推导
                "summary": lesson["summary"],
                "sourceFile": source_file,
                "sections": sections_of(lesson, warnings),
                "vocabulary": [
                    {
                        "word": v["word"],
                        "phonetic": v["phonetic"] or None,
                        "meaning": v["cn"] or None,
                        "example": v["example"] or None,
                        "isNew": None,   # 需按「首次出现」跨课推导，本轮留空
                    }
                    for v in lesson["vocab"]
                ],
                "exercises": parse_exercises(lesson, warnings),
                "feedback": parse_feedback(lesson, warnings),
                "backfillBlocks": backfill_blocks(lesson_chunks.get(lesson["no"], ""), warnings),
            }
        )

    readings = [
        {
            "date": day["date"],
            "sourceFile": day["file"],
            "pieces": [
                {
                    "pieceNo": p["no"],
                    "title": p["title"] or None,
                    "levelCode": p["level"] or None,
                    "source": p["source"] or None,
                    "paragraphs": p["paragraphs"],
                    "wordNotes": p["words"] or None,
                    "questions": p["questions"],
                }
                for p in day["pieces"]
            ],
        }
        for day in days
    ]

    mistakes = parse_mistakes(wrong_rows, warnings)

    if any(l["feedback"] is None for l in out_lessons):
        warnings.append("存在无难度反馈取值的课次")
    warnings.append(
        "mistakes.errorType / mistakes.wrongCount 无法从 wrong-words.md 推导"
        "（表中无该列，仅在「错因」散文里偶现）——需 amy 判定"
    )
    warnings.append(
        "exercises.isCorrect / errorType / errorNote / selfCheck 无法从「批改」散文推导——需 amy 判定"
    )
    warnings.append("exercises.exerciseType 由题干关键词启发式推断，非权威，需复核")
    warnings.append("lesson_sections 的 uk_section 是 (lesson_id, section_type)，补漏块无对应 SectionType，须先定归置口径")

    return {
        "generatedFrom": {
            "notes": [p.name for p in notes_files],
            "read": [d["file"] for d in days],
            "wrongWords": "wrong-words.md",
            "progress": "progress.md",
        },
        "levelCode": level,
        "progress": parse_progress_md(root),
        "lessons": out_lessons,
        "mistakes": mistakes,
        "readings": readings,
        "warnings": warnings,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="M2 只读导出：md → 结构化 JSON")
    parser.add_argument("--root", required=True, help="学习目录，例如 E:\\English")
    parser.add_argument("--build-board", default=None, help="build_board.py 所在目录")
    parser.add_argument("--out", default=None, help="输出文件（默认不写文件，仅打印统计）")
    parser.add_argument("--stdout", action="store_true", help="把 JSON 打到 stdout")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    script_dir = (
        Path(args.build_board).expanduser().resolve()
        if args.build_board
        else root / ".workbuddy" / "skills" / "english-daily" / "scripts"
    )

    if not (root / "notes").is_dir():
        print("M2_EXPORT_FAIL 原因=notes 目录不存在")
        return 1

    try:
        bb = load_build_board(script_dir)
        snapshot = build_snapshot(root, bb)
    except Exception as exc:  # noqa: BLE001 — CLI 需要可读诊断
        print(f"M2_EXPORT_FAIL 原因={exc}")
        return 1

    payload = json.dumps(snapshot, ensure_ascii=False, indent=2)
    if args.stdout:
        print(payload)
    if args.out:
        out_path = (root / args.out) if not Path(args.out).is_absolute() else Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(payload + "\n", encoding="utf-8")
        print(f"M2_EXPORT_WROTE {out_path}")

    vocab = sum(len(l["vocabulary"]) for l in snapshot["lessons"])
    ex = sum(len(l["exercises"]) for l in snapshot["lessons"])
    pieces = sum(len(r["pieces"]) for r in snapshot["readings"])
    print(
        f"M2_EXPORT_OK lessons={len(snapshot['lessons'])} vocab={vocab} exercises={ex} "
        f"mistakes={len(snapshot['mistakes'])} readings={len(snapshot['readings'])}"
        f"(pieces={pieces}) warnings={len(snapshot['warnings'])}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
