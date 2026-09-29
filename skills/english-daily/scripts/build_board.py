r"""扫描 notes 与 read 目录，重建总目录、学习摘要、看板与各专题页面。

用法：python build_board.py --root E:\English
成功：BOARD_OK 课程数=<n> 阅读数=<n> 词汇数=<n> 摘要字节=<n>
失败：BOARD_FAIL 原因=<原因>，且不改动任何已有文件。

产物（全部在 --root 下）：
- INDEX.md                       总目录
- digest.md                      学习摘要，供上课时读取，不必读 notes 全文
- review/index.html              看板首页（统计与课程卡改为前端实时调用后端 API，脚本不再写入课程正文）
- review/reading.html            阅读页（左侧目录 + 右侧卡片，默认显示最新一天）
- review/readIndex.html          阅读目录页，被 reading.html 左侧以 iframe 嵌入
- review/words.html              词汇卡页
- review/wrong.html              错词本页
- review/lessons/lesson-N.html   每课详情页，脚本每次重建时重新生成
"""

from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

LESSON_RE = re.compile(r"^##\s+第\s*(\d+)\s*课(?:\s*·\s*(\S+))?\s*$")
SUMMARY_RE = re.compile(r"^>\s*一句话[:：]\s*(.+?)\s*$")
SECTION_RE = re.compile(r"^###\s+(.+?)\s*$")
META_RE = re.compile(r"^(级别|来源|标题)[:：]\s*(.+?)\s*$")
NOTE_FILE_RE = re.compile(r"^day-(\d{2})-(\d{2})\.md$")
READ_FILE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})-read\.md$")
PIECE_RE = re.compile(r"^##\s+第\s*(\d+)\s*篇(?:\s*·\s*(.+?))?\s*$")
LEVEL_RE = re.compile(r"当前级别[:：]\s*(.+?)\s*$", re.M)
UNSAFE_RE = re.compile(r"(?i)<\s*script|javascript:|on[a-z]+\s*=")
BLOCK_START_RE = re.compile(r"^(\||>|-|\*|\d+[.、]\s|<details)")

SECTION_ORDER = ["复习", "今日语法", "词汇", "例句", "作业", "我的作答", "批改", "难度反馈"]


def esc(text: str) -> str:
    return html.escape(text, quote=False)


def inline(text: str) -> str:
    out = esc(text)
    out = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"`(.+?)`", r"<code>\1</code>", out)
    out = re.sub(r"\[(.+?)\]\((https?://[^)\s]+)\)", r'<a href="\2" target="_blank" rel="noopener">\1</a>', out)
    return out


def render_table(rows: list[str]) -> str:
    cells = []
    for row in rows:
        parts = [c.strip() for c in row.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{2,}:?", p) for p in parts if p):
            continue
        cells.append(parts)
    if not cells:
        return ""
    head, body = cells[0], cells[1:]
    out = ["<table>", "<thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead>", "<tbody>"]
    for row in body:
        out.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in row) + "</tr>")
    out.append("</tbody></table>")
    return "".join(out)


def sanitize_details(block: str) -> str:
    if UNSAFE_RE.search(block):
        return "<p>答案已省略：内容包含不支持的脚本片段。</p>"
    return block


def render_blocks(lines: list[str]) -> str:
    out: list[str] = []
    i, n = 0, len(lines)
    while i < n:
        stripped = lines[i].lstrip()
        if not stripped.strip():
            i += 1
            continue
        if stripped.startswith("<details"):
            buf = []
            while i < n and not lines[i].lstrip().startswith("</details>"):
                buf.append(lines[i])
                i += 1
            if i < n:
                buf.append(lines[i])
                i += 1
            out.append(sanitize_details("\n".join(buf)))
            continue
        if stripped.startswith("|"):
            rows = []
            while i < n and lines[i].lstrip().startswith("|"):
                rows.append(lines[i])
                i += 1
            out.append(render_table(rows))
            continue
        if re.match(r"^[-*]\s+", stripped):
            items = []
            while i < n and re.match(r"^[-*]\s+", lines[i].lstrip()):
                items.append(inline(re.sub(r"^[-*]\s+", "", lines[i].lstrip())))
                i += 1
            out.append("<ul>" + "".join(f"<li>{t}</li>" for t in items) + "</ul>")
            continue
        if re.match(r"^\d+[.、]\s", stripped):
            items = []
            while i < n and re.match(r"^\d+[.、]\s", lines[i].lstrip()):
                items.append(inline(re.sub(r"^\d+[.、]\s*", "", lines[i].lstrip())))
                i += 1
            out.append("<ol>" + "".join(f"<li>{t}</li>" for t in items) + "</ol>")
            continue
        if stripped.startswith(">"):
            buf = []
            while i < n and lines[i].lstrip().startswith(">"):
                buf.append(inline(re.sub(r"^>\s?", "", lines[i].lstrip())))
                i += 1
            out.append("<blockquote>" + "<br>".join(buf) + "</blockquote>")
            continue
        para = []
        while i < n and lines[i].strip() and not BLOCK_START_RE.match(lines[i].lstrip()):
            para.append(inline(lines[i].strip()))
            i += 1
        if para:
            out.append("<p>" + "<br>".join(para) + "</p>")
        else:
            i += 1
    return "\n".join(out)


def parse_vocab(lines: list[str]) -> list[dict]:
    words = []
    for row in lines:
        s = row.strip()
        if not s.startswith("|"):
            continue
        parts = [c.strip() for c in s.strip("|").split("|")]
        if all(re.fullmatch(r":?-{2,}:?", p) for p in parts if p):
            continue
        if len(parts) < 3 or parts[0] == "单词":
            continue
        words.append(
            {
                "word": parts[0],
                "phonetic": parts[1],
                "cn": parts[2],
                "example": parts[3] if len(parts) > 3 else "",
            }
        )
    return words


def parse_piece(lines: list[str], default_title: str = "") -> dict:
    piece = {"level": "", "source": "", "title": default_title, "paragraphs": [], "words": "", "questions": []}
    body: list[str] = []
    for line in lines:
        meta = META_RE.match(line.strip())
        if meta:
            piece[{"级别": "level", "来源": "source", "标题": "title"}[meta.group(1)]] = meta.group(2).strip()
            continue
        body.append(line)
    i, n = 0, len(body)
    while i < n:
        line = body[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith("生词注释"):
            piece["words"] = line.split("：", 1)[-1].split(":", 1)[-1].strip()
            i += 1
            continue
        if line.startswith("理解题"):
            piece["questions"] = [x for x in body[i:] if x.strip() and not x.strip().startswith("理解题")]
            break
        if line.startswith(">"):
            zh = re.sub(r"^>\s?", "", line)
            if piece["paragraphs"]:
                piece["paragraphs"][-1]["zh"] = zh
            i += 1
            continue
        piece["paragraphs"].append({"en": line, "zh": ""})
        i += 1
    return piece


def parse_notes(notes_dir: Path) -> list[dict]:
    lessons: list[dict] = []
    for path in sorted(
        notes_dir.glob("*.md"),
        key=lambda p: (NOTE_FILE_RE.match(p.name).group(1) if NOTE_FILE_RE.match(p.name) else p.name),
    ):
        if not NOTE_FILE_RE.match(path.name):
            raise ValueError(f"笔记文件名不符合 day-XX-YY.md 规范：{path.name}")
        current: dict | None = None
        section = ""
        for raw in path.read_text(encoding="utf-8").splitlines():
            lesson_match = LESSON_RE.match(raw)
            if lesson_match:
                current = {
                    "no": int(lesson_match.group(1)),
                    "date": lesson_match.group(2) or "",
                    "summary": "",
                    "file": path.name,
                    "sections": {name: [] for name in SECTION_ORDER},
                }
                lessons.append(current)
                section = ""
                continue
            if current is None:
                continue
            summary_match = SUMMARY_RE.match(raw)
            if summary_match and not current["summary"]:
                current["summary"] = summary_match.group(1).strip()
                continue
            section_match = SECTION_RE.match(raw)
            if section_match:
                name = section_match.group(1).strip()
                section = name if name in current["sections"] else ""
                continue
            if section:
                current["sections"][section].append(raw)
    for lesson in lessons:
        lesson["vocab"] = parse_vocab(lesson["sections"]["词汇"])
    lessons.sort(key=lambda x: x["no"])
    numbers = [x["no"] for x in lessons]
    if len(numbers) != len(set(numbers)):
        dup = sorted({x for x in numbers if numbers.count(x) > 1})
        raise ValueError(f"课号重复：{dup}")
    return lessons


def parse_read_dir(read_dir: Path) -> list[dict]:
    if not read_dir.is_dir():
        raise ValueError("read 目录不存在，先运行 init_workspace.py")
    days: list[dict] = []
    for path in sorted(read_dir.glob("*.md"), key=lambda p: p.name):
        match = READ_FILE_RE.match(path.name)
        if not match:
            raise ValueError(f"阅读文件名不符合 YYYY-MM-DD-read.md 规范：{path.name}")
        raw_pieces: list[dict] = []
        current: dict | None = None
        for raw in path.read_text(encoding="utf-8").splitlines():
            piece_match = PIECE_RE.match(raw)
            if piece_match:
                current = {"lines": [], "title": piece_match.group(2) or ""}
                raw_pieces.append(current)
                continue
            if current is not None:
                current["lines"].append(raw)
        pieces = []
        for index, item in enumerate(raw_pieces, start=1):
            piece = parse_piece(item["lines"], item["title"])
            piece["no"] = index
            pieces.append(piece)
        days.append({"date": match.group(1), "file": path.name, "pieces": pieces})
    days.sort(key=lambda x: x["date"], reverse=True)
    return days


def parse_wrong_words(path: Path) -> list[list[str]]:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s.startswith("|"):
            continue
        parts = [c.strip() for c in s.strip("|").split("|")]
        if all(re.fullmatch(r":?-{2,}:?", p) for p in parts if p):
            continue
        if parts and parts[0] == "课号":
            continue
        rows.append(parts)
    return rows


def read_level(root: Path) -> str:
    progress = root / "progress.md"
    if not progress.exists():
        return "未初始化"
    match = LEVEL_RE.search(progress.read_text(encoding="utf-8"))
    return match.group(1).strip() if match else "未记录"


def build_index(lessons: list[dict], level: str, days: list[dict]) -> str:
    lines = [
        "# 英语学习总目录",
        "",
        "> 由 build_board.py 自动生成，手工修改会在下次重建时被覆盖。",
        "",
        f"- 课程总数：{len(lessons)}",
        f"- 当前级别：{level}",
        f"- 阅读文件：{len(days)} 天，共 {sum(len(d['pieces']) for d in days)} 篇",
    ]
    if lessons:
        last = lessons[-1]
        tail = f"（{last['date']}）" if last["date"] else ""
        lines.append(f"- 最近一课：第 {last['no']} 课{tail} {last['summary']}")
    lines.append("")
    if not lessons:
        lines.append("还没有课程记录。上一次课后本文件会自动生成目录。")
        return "\n".join(lines) + "\n"
    groups: dict[str, list[dict]] = {}
    for lesson in lessons:
        groups.setdefault(lesson["file"], []).append(lesson)
    for file_name in sorted(groups, key=lambda f: int(NOTE_FILE_RE.match(f).group(1))):
        match = NOTE_FILE_RE.match(file_name)
        lines.append(f"## 第 {int(match.group(1))}-{int(match.group(2))} 课（{file_name}）")
        lines.append("")
        lines.append("————————————")
        lines.append("")
        for lesson in groups[file_name]:
            date = f" · {lesson['date']}" if lesson["date"] else ""
            lines.append(f"第 {lesson['no']} 课{date}：{lesson['summary'] or '（缺一句话摘要）'}")
        lines.append("")
    lines.append("## 阅读文件")
    lines.append("")
    lines.append("————————————")
    lines.append("")
    if days:
        for day in days:
            titles = "、".join(p["title"] or f"第 {p['no']} 篇" for p in day["pieces"])
            lines.append(f"{day['date']}：{len(day['pieces'])} 篇（{titles}） → read\\{day['file']}")
    else:
        lines.append("还没有阅读文件。每次课后会自动生成当天的 read\\YYYY-MM-DD-read.md。")
    lines.append("")
    return "\n".join(lines) + "\n"


CSS = """
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; padding: 24px; background: #f7f7f5; color: #2c2c2a;
  font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.7; }
.wrap { max-width: 900px; margin: 0 auto; }
h1 { font-size: 20px; font-weight: 600; margin: 0 0 4px; }
h2 { font-size: 16px; font-weight: 600; margin: 24px 0 8px; }
h3 { font-size: 15px; font-weight: 600; margin: 0; }
h4 { font-size: 13px; font-weight: 600; color: #6b6b66; margin: 14px 0 4px; }
.sub { color: #6b6b66; font-size: 13px; margin: 0 0 16px; }
.stats { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; }
.stat { background: #fff; border: 1px solid #e3e2dc; border-radius: 10px; padding: 10px 14px; min-width: 110px; }
.stat b { display: block; font-size: 18px; font-weight: 600; }
.stat span { color: #6b6b66; font-size: 12px; }
.entries { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin: 16px 0 4px; }
a.entry { display: block; background: #fff; border: 1px solid #d9d8d2; border-radius: 10px;
  padding: 10px 14px; text-decoration: none; color: #2c2c2a; }
a.entry:hover { border-color: #185fa5; }
a.entry b { display: block; font-size: 15px; font-weight: 500; }
a.entry span { color: #6b6b66; font-size: 12px; }
#q { width: 100%; padding: 8px 12px; border: 1px solid #d9d8d2; border-radius: 8px; font-size: 14px; margin-bottom: 12px; }
.card { background: #fff; border: 1px solid #e3e2dc; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; }
.card .meta { color: #6b6b66; font-size: 12px; margin: 4px 0 8px; }
.sum { color: #3d3d38; margin: 4px 0 8px; font-size: 14px; }
a.btn { display: inline-block; background: #eef4fb; border: 1px solid #c9dcef; color: #185fa5;
  border-radius: 8px; padding: 4px 12px; font-size: 13px; text-decoration: none; }
a.btn:hover { background: #e0ecfa; }
a.plain { color: #185fa5; }
details summary { cursor: pointer; color: #185fa5; font-size: 14px; }
details { margin-top: 8px; }
table { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 14px; }
th, td { border: 1px solid #e3e2dc; padding: 6px 8px; text-align: left; }
th { background: #f1efe8; font-weight: 600; }
blockquote { margin: 0; padding-left: 10px; border-left: 3px solid #d9d8d2; color: #4a4a45; }
.en { margin: 0 0 2px; }
.zh { margin: 0 0 12px; color: #4a4a45; }
.zh[hidden] { display: none; }
button.zhbtn { background: #eef4fb; border: 1px solid #c9dcef; border-radius: 6px; padding: 2px 10px;
  font-size: 12px; cursor: pointer; color: #185fa5; margin-bottom: 8px; }
.words { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.idx { display: flex; flex-wrap: wrap; gap: 4px; margin: 12px 0 4px; }
.idx a { display: inline-block; min-width: 24px; text-align: center; background: #fff; border: 1px solid #d9d8d2;
  border-radius: 6px; padding: 2px 6px; font-size: 13px; color: #185fa5; text-decoration: none; }
.idx a:hover { border-color: #185fa5; }
h2 .count { color: #6b6b66; font-size: 12px; font-weight: 400; margin-left: 8px; }
.wcard { background: #fff; border: 1px solid #e3e2dc; border-radius: 10px; padding: 10px 12px; cursor: pointer; }
.wcard .w { font-weight: 600; }
.wcard .p { color: #6b6b66; font-size: 12px; }
.wcard .c, .wcard .e { display: none; font-size: 13px; margin-top: 4px; }
.wcard.show .c, .wcard.show .e { display: block; }
.wcard .e { color: #4a4a45; }
.hide { display: none; }
/* 阅读页双栏布局：左侧目录 + 右侧单篇卡片 */
.reading-layout { display: flex; gap: 16px; align-items: flex-start; }
.reading-toc { flex: 0 0 190px; position: sticky; top: 16px; background: #fff;
  border: 1px solid #e3e2dc; border-radius: 12px; overflow: hidden; }
.reading-toc iframe { display: block; width: 100%; height: 260px; border: 0; }
.reading-stage { flex: 1 1 auto; min-width: 0; }
.stage-head { display: flex; align-items: baseline; gap: 10px; margin: 4px 0 2px; }
.stage-head h2 { margin: 0; }
.stage-count { color: #6b6b66; font-size: 13px; }
.stage-file { color: #88877f; font-size: 12px; margin: 0 0 10px; }
.stage-body { display: flex; align-items: center; gap: 10px; }
.navbtn { flex: 0 0 36px; height: 36px; border-radius: 50%; border: 1px solid #d9d8d2;
  background: #fff; color: #185fa5; font-size: 16px; cursor: pointer; line-height: 1; }
.navbtn:hover:not(:disabled) { border-color: #185fa5; background: #eef4fb; }
.navbtn:disabled { opacity: .35; cursor: default; }
.stage-viewport { flex: 1 1 auto; min-width: 0; }
.rcard { margin-bottom: 0; animation: cardin .18s ease; }
.rcard h3 { margin: 0 0 2px; font-size: 17px; }
@keyframes cardin { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@media (max-width: 720px) {
  .reading-layout { flex-direction: column; }
  .reading-toc { position: static; flex: none; width: 100%; }
  .reading-toc iframe { height: 150px; }
}
footer { color: #88877f; font-size: 12px; margin: 24px 0; }
"""

JS = """
var tabs = document.querySelectorAll('nav button');
tabs.forEach(function (btn) {
  btn.addEventListener('click', function () {
    tabs.forEach(function (b) { b.classList.remove('on'); });
    btn.classList.add('on');
    document.querySelectorAll('main section').forEach(function (s) { s.classList.add('hide'); });
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hide');
  });
});
document.querySelectorAll('.zhbtn').forEach(function (b) {
  b.addEventListener('click', function () {
    var scope = b.parentElement;
    var blocks = scope.querySelectorAll('.zh');
    var hidden = 0;
    blocks.forEach(function (z) { if (z.hasAttribute('hidden')) { hidden += 1; } });
    blocks.forEach(function (z) {
      if (hidden > 0) { z.removeAttribute('hidden'); } else { z.setAttribute('hidden', ''); }
    });
    b.textContent = hidden > 0 ? '收起中文' : '整篇看中文';
  });
});
document.querySelectorAll('.wcard').forEach(function (c) {
  c.addEventListener('click', function () { c.classList.toggle('show'); });
});
var q = document.getElementById('q');
if (q) {
  q.addEventListener('input', function () {
    var v = q.value.trim().toLowerCase();
    document.querySelectorAll('.lesson').forEach(function (card) {
      card.classList.toggle('hide', v !== '' && card.dataset.text.indexOf(v) === -1);
    });
  });
}
"""


def page(title: str, body: str, extra_css: str = "", extra_js: str = "") -> str:
    return (
        '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f"<title>{esc(title)}</title><style>{CSS}</style>{extra_css}</head>"
        f'<body><div class="wrap">{body}</div><script>{JS}</script>{extra_js}</body></html>'
    )


def render_lesson_card(lesson: dict) -> str:
    sections = lesson["sections"]
    searchable = " ".join([lesson["summary"]] + [" ".join(v) for v in sections.values()]).lower()
    date = f" · {lesson['date']}" if lesson["date"] else ""
    return "\n".join(
        [
            f'<article class="card lesson" data-text="{esc(searchable)}">',
            f"<h3>第 {lesson['no']} 课{esc(date)}</h3>",
            f'<p class="sum">{inline(lesson["summary"] or "（缺一句话摘要）")}</p>',
            f'<p class="meta">生词 {len(lesson["vocab"])} 个 ｜ 作业 {len([x for x in sections["作业"] if x.strip()])} 项</p>',
            f'<a class="btn" href="lessons/lesson-{lesson["no"]}.html">查看全文</a>',
            "</article>",
        ]
    )


def render_lesson_page(lesson: dict) -> str:
    sections = lesson["sections"]
    date = f" · {lesson['date']}" if lesson["date"] else ""
    body = [
        f'<h1>第 {lesson["no"]} 课{esc(date)}</h1>',
        f'<p class="sub">{inline(lesson["summary"] or "（缺一句话摘要）")}</p>',
        '<p><a class="plain" href="../index.html">← 返回看板</a></p>',
    ]
    for name in SECTION_ORDER:
        lines = sections.get(name, [])
        if not [x for x in lines if x.strip()]:
            continue
        body.append(f"<h4>{name}</h4>")
        body.append(render_blocks(lines))
    return page(f"第 {lesson['no']} 课", "\n".join(body))


def render_piece(piece: dict) -> str:
    out = [
        f'<h3>第 {piece["no"]} 篇 · {esc(piece["title"] or "未命名")}</h3>',
        f'<p class="meta">级别：{esc(piece["level"] or "未标注")} ｜ 来源：{esc(piece["source"] or "未标注")}</p>',
    ]
    has_zh = any(para["zh"] for para in piece["paragraphs"])
    if has_zh:
        out.append('<button class="zhbtn">整篇看中文</button>')
    out.append('<div class="pairs">')
    for para in piece["paragraphs"]:
        out.append(f'<p class="en">{inline(para["en"])}</p>')
        if para["zh"]:
            out.append(f'<p class="zh" hidden>{inline(para["zh"])}</p>')
    out.append("</div>")
    if piece["words"]:
        out.append("<h4>生词注释</h4>")
        out.append(f"<p>{inline(piece['words'])}</p>")
    if piece["questions"]:
        out.append("<h4>理解题</h4>")
        out.append(render_blocks(piece["questions"]))
    return "\n".join(out)


def render_reading(days: list[dict]) -> str:
    if not days:
        return '<p class="sub">还没有阅读文件。每次课后会自动生成 read\\YYYY-MM-DD-read.md。</p>'
    out = ['<div class="reading-layout">']
    out.append(
        '<aside class="reading-toc"><iframe id="readingToc" src="readIndex.html" title="阅读目录"></iframe></aside>'
    )
    out.append('<section class="reading-stage">')
    out.append('<div class="stage-head"><h2 id="stageDate"></h2><span class="stage-count" id="stageCount"></span></div>')
    out.append('<p class="stage-file" id="stageFile"></p>')
    out.append('<div class="stage-body">')
    out.append('<button class="navbtn" id="navPrev" aria-label="上一篇">&#8592;</button>')
    out.append('<div class="stage-viewport">')
    for day in days:
        for piece in day["pieces"]:
            out.append(
                f'<article class="card rcard" data-date="{esc(day["date"])}" data-file="read\\{esc(day["file"])}">'
            )
            out.append(render_piece(piece))
            out.append("</article>")
    out.append("</div>")
    out.append('<button class="navbtn" id="navNext" aria-label="下一篇">&#8594;</button>')
    out.append("</div>")
    out.append("</section>")
    out.append("</div>")
    return "\n".join(out)


def render_wrong_table(wrong_rows: list[list[str]]) -> str:
    if not wrong_rows:
        return '<p class="sub">还没有错词记录。</p>'
    out = [
        "<table><thead><tr><th>课号</th><th>错误点</th><th>正确形式</th><th>错因</th><th>连续答对</th><th>状态</th></tr></thead><tbody>"
    ]
    for row in wrong_rows:
        out.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in row[:6]) + "</tr>")
    out.append("</tbody></table>")
    return "".join(out)


def back_link() -> str:
    return '<p><a class="plain" href="index.html">← 返回看板</a></p>'


BOARD_API_CSS = """
/* ---- API 联调状态样式（Loading / Error / Empty） ---- */
.api-error { background: #fdf1f0; border: 1px solid #f0c8c5; color: #a5392f;
  border-radius: 10px; padding: 10px 14px; margin: 16px 0; font-size: 14px;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.api-error.hide { display: none; }
.api-error button { background: #fff; border: 1px solid #e0aca7; color: #a5392f;
  border-radius: 8px; padding: 4px 14px; font-size: 13px; cursor: pointer; }
.api-error button:hover { background: #fbe9e7; }
.state { color: #88877f; font-size: 14px; margin: 16px 0; }
.state.loading::after { content: ""; display: inline-block; width: 12px; height: 12px;
  margin-left: 8px; border: 2px solid #d9d8d2; border-top-color: #185fa5; border-radius: 50%;
  vertical-align: -2px; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.stat b.pending { color: #c9c8c1; }
"""

BOARD_API_JS = r"""
<script>
/* 数据来源：后端 API（Frontend → GET /api/* → MySQL）。
   构建期不再把课程内容写进 HTML，页面在浏览器里实时取数。 */
var API_BASE = 'http://localhost:4000/api';

function apiGet(path) {
  return fetch(API_BASE + path)
    .then(function (res) {
      return res.json().catch(function () {
        throw new Error('服务返回异常（HTTP ' + res.status + '）');
      });
    })
    .then(function (body) {
      if (!body || body.code !== 200) {
        throw new Error((body && body.message) || '请求失败（HTTP ' + (body ? body.code : '未知') + '）');
      }
      return body.data;
    });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function setText(id, text) {
  var el = document.getElementById(id);
  if (el) { el.textContent = text; el.classList.remove('pending'); }
}

/* ---- 统计卡 ---- */
function loadStats() {
  var jobs = [
    apiGet('/lessons?size=1').then(function (d) { setText('statLessons', d.total); }),
    apiGet('/progress').then(function (d) { setText('statLevel', d.currentLevel || '—'); }),
    apiGet('/vocabulary/stats').then(function (d) { setText('statVocab', d.total); }),
    apiGet('/mistakes/stats').then(function (d) { setText('statMistakes', d.pending); })
  ];
  // 阅读篇数：后端暂无阅读统计接口（API 缺口 R1），显示占位而不是报错
  setText('statReading', '—');
  document.getElementById('statReading').title = '后端暂未提供阅读统计接口（API 缺口 R1）';
  return Promise.all(jobs);
}

/* ---- 课程列表 ---- */
function lessonCard(l) {
  var title = '第 ' + l.lessonNo + ' 课' + (l.lessonDate ? ' · ' + l.lessonDate : '');
  var searchText = [title, l.summary, l.grammarPoint].join('  ').toLowerCase();
  return '<article class="card lesson" data-text="' + esc(searchText) + '">'
    + '<h3>' + esc(title) + '</h3>'
    + '<p class="sum">' + esc(l.summary || '') + '</p>'
    + '<p class="meta">生词 ' + (l.vocabCount || 0) + ' 个 ｜ 作业 ' + (l.exerciseCount || 0) + ' 项</p>'
    + '<a class="btn" href="lessons/lesson-' + l.lessonNo + '.html">查看全文</a>'
    + '</article>';
}

function renderLessons(list) {
  var box = document.getElementById('lessonList');
  if (!list.length) {
    box.innerHTML = '<p class="state">暂无课程记录</p>';
    document.getElementById('lessonCount').textContent = '';
    return;
  }
  box.innerHTML = list.map(lessonCard).join('');
  document.getElementById('lessonCount').textContent = '共 ' + list.length + ' 课';
  applyFilter();
}

function loadLessons() {
  var box = document.getElementById('lessonList');
  box.innerHTML = '<p class="state loading">正在加载课程…</p>';
  return apiGet('/lessons?size=100').then(function (d) { renderLessons(d.list); });
}

/* ---- 错误与重试 ---- */
function showError(msg) {
  document.getElementById('apiErrorMsg').textContent = '加载失败：' + msg + '（请确认后端服务是否在运行）';
  document.getElementById('apiError').classList.remove('hide');
}

function hideError() {
  document.getElementById('apiError').classList.add('hide');
}

function loadAll() {
  hideError();
  var statsReady = loadStats().catch(function (err) { throw { part: '统计卡', err: err }; });
  var lessonsReady = loadLessons().catch(function (err) { throw { part: '课程列表', err: err }; });
  return Promise.all([statsReady, lessonsReady]).catch(function (e) {
    var msg = e && e.err ? (e.part ? e.part + '：' + e.err.message : e.err.message) : String(e);
    showError(msg);
  });
}

/* ---- 搜索过滤（保留原有交互） ---- */
function applyFilter() {
  var input = document.getElementById('q');
  if (!input) { return; }
  var v = input.value.trim().toLowerCase();
  document.querySelectorAll('.lesson').forEach(function (card) {
    card.classList.toggle('hide', v !== '' && card.dataset.text.indexOf(v) === -1);
  });
  var visible = document.querySelectorAll('.lesson:not(.hide)').length;
  var total = document.querySelectorAll('.lesson').length;
  var count = document.getElementById('lessonCount');
  if (count) {
    count.textContent = (visible < total) ? ('匹配 ' + visible + ' 课') : (total ? '共 ' + total + ' 课' : '');
  }
  var box = document.getElementById('lessonList');
  var emptyTip = box.querySelector('.state');
  if (visible === 0 && total > 0) {
    if (!emptyTip) { box.insertAdjacentHTML('beforeend', '<p class="state" id="filterEmpty">没有匹配的课程，换个关键词试试</p>'); }
  } else if (emptyTip && emptyTip.id === 'filterEmpty') {
    emptyTip.remove();
  }
}

document.getElementById('q').addEventListener('input', applyFilter);
document.getElementById('apiRetry').addEventListener('click', loadAll);
loadAll();
</script>
"""


def build_board(lessons: list[dict], level: str, days: list[dict], wrong_rows: list[list[str]]) -> str:
    """看板首页：只产出骨架与交互，统计数据与课程卡由前端调后端 API 实时获取。

    lessons / level / days / wrong_rows 保留形参以兼容既有调用方，
    页面本身不再使用它们（数据源已切换到 backend API）。
    """
    body = [
        "<h1>英语复习看板</h1>",
        '<p class="sub">数据由后端 API（localhost:4000）实时加载。首页只放总结，正文、阅读、词汇都在各自页面。</p>',
        '<div id="apiError" class="api-error hide"><span id="apiErrorMsg"></span>'
        '<button id="apiRetry" type="button">重试</button></div>',
        '<div class="stats">',
        '<div class="stat"><b id="statLessons" class="pending">…</b><span>已上课数</span></div>',
        '<div class="stat"><b id="statLevel" class="pending">…</b><span>当前级别</span></div>',
        '<div class="stat"><b id="statVocab" class="pending">…</b><span>累计生词</span></div>',
        '<div class="stat"><b id="statReading" class="pending">…</b><span>阅读篇数</span></div>',
        '<div class="stat"><b id="statMistakes" class="pending">…</b><span>未过关错词</span></div>',
        "</div>",
        '<div class="entries">',
        '<a class="entry" href="reading.html"><b>阅读</b><span>按天查看，点击看中文</span></a>',
        '<a class="entry" href="words.html"><b>词汇卡</b><span>点击翻中文与例句</span></a>',
        '<a class="entry" href="wrong.html"><b>错词本</b><span>已过关与待复习</span></a>',
        "</div>",
        '<h2>课程<span class="count" id="lessonCount"></span></h2>',
        '<input id="q" placeholder="搜索课程总结与语法点，输入关键词即时过滤">',
        '<div id="lessonList"><p class="state loading">正在加载课程…</p></div>',
        '<footer>提示：先看总结回想，再点「查看全文」核对。</footer>',
    ]
    return page(
        "英语复习看板",
        "\n".join(body),
        extra_css=f"<style>{BOARD_API_CSS}</style>",
        extra_js=BOARD_API_JS,
    )


READ_INDEX_CSS = """
body { padding: 12px; background: #fbfbf9; }
.wrap { max-width: none; }
.rtoc-title { font-size: 12px; color: #6b6b66; margin: 2px 4px 8px; font-weight: 600; }
.rtoc-item { display: block; width: 100%; text-align: left; background: transparent; border: 0;
  border-radius: 8px; padding: 8px 10px; cursor: pointer; font: inherit; color: #2c2c2a; }
.rtoc-item b { display: block; font-size: 14px; font-weight: 600; }
.rtoc-item span { display: block; color: #6b6b66; font-size: 12px; }
.rtoc-item:hover { background: #f1efe8; }
.rtoc-item.on { background: #eef4fb; }
.rtoc-item.on b { color: #185fa5; }
"""

READ_INDEX_JS = """
(function () {
  var items = Array.prototype.slice.call(document.querySelectorAll('.rtoc-item'));
  function activate(date) {
    items.forEach(function (b) { b.classList.toggle('on', b.dataset.date === date); });
  }
  items.forEach(function (b) {
    b.addEventListener('click', function () {
      var date = b.dataset.date;
      activate(date);
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'reading-select', date: date }, '*');
      } else {
        location.href = 'reading.html#' + date;
      }
    });
  });
  window.addEventListener('message', function (event) {
    var data = event.data || {};
    if (data.type === 'reading-active') { activate(data.date); }
  });
  function reportHeight() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: 'reading-toc-height', height: document.documentElement.scrollHeight }, '*'
      );
    }
  }
  reportHeight();
  window.addEventListener('load', reportHeight);
})();
"""

def build_read_index_page(days: list[dict]) -> str:
    items = []
    for day in days:
        items.append(
            f'<button type="button" class="rtoc-item" data-date="{esc(day["date"])}">'
            f"<b>{esc(day['date'])}</b><span>{len(day['pieces'])} 篇</span></button>"
        )
    body = [
        '<nav class="rtoc">',
        '<p class="rtoc-title">阅读目录</p>',
        *items,
        "</nav>",
    ]
    return page("阅读目录", "\n".join(body), extra_css=f"<style>{READ_INDEX_CSS}</style>", extra_js=f"<script>{READ_INDEX_JS}</script>")


READING_PAGE_JS = """
<script>
(function () {
  var frame = document.getElementById('readingToc');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.rcard'));
  var elDate = document.getElementById('stageDate');
  var elCount = document.getElementById('stageCount');
  var elFile = document.getElementById('stageFile');
  var btnPrev = document.getElementById('navPrev');
  var btnNext = document.getElementById('navNext');
  var dates = [];
  var byDate = {};
  cards.forEach(function (c) {
    var d = c.dataset.date;
    if (!byDate[d]) { byDate[d] = []; dates.push(d); }
    byDate[d].push(c);
  });
  var curDate = '', curIdx = 0;
  function render() {
    var list = byDate[curDate] || [];
    cards.forEach(function (c) { c.classList.toggle('hide', c.dataset.date !== curDate); });
    elDate.textContent = curDate;
    elCount.textContent = list.length ? '第 ' + (curIdx + 1) + ' / ' + list.length + ' 篇' : '';
    elFile.textContent = list[0] ? (list[0].dataset.file || '') : '';
    btnPrev.disabled = curIdx <= 0;
    btnNext.disabled = curIdx >= list.length - 1;
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: 'reading-active', date: curDate }, '*');
    }
  }
  function showDay(date) {
    if (dates.indexOf(date) === -1) { date = dates[0]; }
    if (!date) { return; }
    curDate = date;
    curIdx = 0;
    if (history.replaceState) { history.replaceState(null, '', '#' + encodeURIComponent(date)); }
    render();
  }
  function step(delta) {
    var list = byDate[curDate] || [];
    var next = curIdx + delta;
    if (next < 0 || next > list.length - 1) { return; }
    curIdx = next;
    render();
  }
  btnPrev.addEventListener('click', function () { step(-1); });
  btnNext.addEventListener('click', function () { step(1); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { step(-1); }
    if (e.key === 'ArrowRight') { step(1); }
  });
  window.addEventListener('message', function (event) {
    var data = event.data || {};
    if (data.type === 'reading-select' && data.date) { showDay(data.date); }
    if (data.type === 'reading-toc-height' && frame && data.height) {
      frame.style.height = data.height + 'px';
    }
  });
  window.addEventListener('hashchange', function () {
    var want = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    if (want && want !== curDate) { showDay(want); }
  });
  if (frame) { frame.addEventListener('load', render); }
  var want = decodeURIComponent((location.hash || '').replace(/^#/, ''));
  showDay(dates.indexOf(want) !== -1 ? want : dates[0]);
})();
</script>
"""

def build_reading_page(days: list[dict]) -> str:
    body = [
        "<h1>阅读</h1>",
        back_link(),
        '<p class="sub">左侧选择日期，中间每次显示一篇；用左右箭头按钮或键盘 ←/→ 在当天文章间翻页。</p>',
        render_reading(days),
    ]
    extra_css = "<style>.wrap { max-width: 1080px; }</style>"
    return page("阅读", "\n".join(body), extra_css=extra_css, extra_js=READING_PAGE_JS)


def build_words_page(lessons: list[dict]) -> str:
    vocab = [w for lesson in lessons for w in lesson["vocab"]]
    groups: dict[str, list[dict]] = {}
    for w in vocab:
        key = (w["word"][:1] or "#").upper()
        if not key.isalpha():
            key = "#"
        groups.setdefault(key, []).append(w)
    letters = sorted(groups, key=lambda k: (k == "#", k))
    body = [
        "<h1>词汇卡</h1>",
        back_link(),
        '<p class="sub">按首字母分组，点击卡片翻出中文与例句。</p>',
        '<div class="idx">',
    ]
    for letter in letters:
        body.append(f'<a href="#letter-{esc(letter)}">{esc(letter)}</a>')
    body.append("</div>")
    for letter in letters:
        body.append(f'<h2 id="letter-{esc(letter)}">{esc(letter)}<span class="count">{len(groups[letter])} 个</span></h2>')
        body.append('<div class="words">')
        for w in sorted(groups[letter], key=lambda x: x["word"].lower()):
            body.append(
                f'<div class="wcard"><div class="w">{inline(w["word"])}</div>'
                f'<div class="p">{inline(w["phonetic"])}</div>'
                f'<div class="c">{inline(w["cn"])}</div>'
                f'<div class="e">{inline(w["example"])}</div></div>'
            )
        body.append("</div>")
    return page("词汇卡", "\n".join(body))


def build_wrong_page(wrong_rows: list[list[str]]) -> str:
    body = ["<h1>错词本</h1>", back_link(), render_wrong_table(wrong_rows)]
    return page("错词本", "\n".join(body))


def build_digest(lessons: list[dict], level: str, days: list[dict], wrong_rows: list[list[str]]) -> str:
    pending = [row for row in wrong_rows if len(row) >= 6 and row[5] != "已过关"]
    recent = lessons[-3:]
    lines = [
        "# 学习摘要",
        "",
        "> 由 build_board.py 自动生成，每次重建时整体覆盖。手工修改会被冲掉。",
        "> 上课时只读这一份即可，不需要读 notes 全文。",
        "",
        f"- 当前级别：{level}",
        f"- 已上课数：{len(lessons)}",
        "",
    ]
    if lessons:
        last = lessons[-1]
        when = last["date"] or "日期未标注"
        lines.append(f"- 上次上课：第 {last['no']} 课（{when}）")
    else:
        lines.append("- 上次上课：还没有课程")
    lines += [
        "",
        "## 最近三课（写作业、讲新课时参考）",
        "",
    ]
    if not recent:
        lines.append("还没有课程记录。这是第一课。")
        lines.append("")
    for lesson in reversed(recent):
        date = f" · {lesson['date']}" if lesson["date"] else ""
        lines.append(f"### 第 {lesson['no']} 课{date}")
        lines.append("")
        lines.append(f"- 一句话：{lesson['summary'] or '（缺一句话摘要）'}")
        for item in lesson["sections"]["今日语法"]:
            text = item.strip().rstrip("：:，,。.")
            if len(text) >= 8 and not text.startswith(("|", ">", "-", "*", "<", "1.", "2.", "3.")):
                lines.append(f"- 语法要点：{text[:80]}")
                break
        if lesson["vocab"]:
            lines.append("- 词汇：" + "、".join(w["word"] for w in lesson["vocab"]))
        feedback = [x.strip() for x in lesson["sections"]["难度反馈"] if x.strip()]
        if feedback:
            lines.append(f"- 难度反馈：{feedback[0]}")
        graded = [x.strip() for x in lesson["sections"]["批改"] if x.strip()]
        lines.append(f"- 批改记录：{len(graded)} 条（详见 notes\\{lesson['file']} 或看板详情页）")
        lines.append("")
    lines.append("## 全部课号一览")
    lines.append("")
    if lessons:
        for lesson in lessons:
            lines.append(f"第 {lesson['no']} 课：{lesson['summary'] or '（缺一句话摘要）'}")
    else:
        lines.append("（空）")
    lines.append("")
    lines.append("## 错词本待复习项（出复习题时取用）")
    lines.append("")
    if pending:
        for row in pending:
            cells = row + [""] * (6 - len(row))
            lines.append(f"- 第 {cells[0]} 课 ｜ {cells[1]} → {cells[2]} ｜ 错因：{cells[3]} ｜ 连续答对 {cells[4]}")
    else:
        lines.append("（无未过关项）")
    lines.append("")
    lines.append("## 阅读文件")
    lines.append("")
    if days:
        for day in days:
            titles = "、".join(p["title"] or f"第 {p['no']} 篇" for p in day["pieces"])
            lines.append(f"- {day['date']}：{len(day['pieces'])} 篇（{titles}）")
    else:
        lines.append("（还没有阅读文件）")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="重建总目录与复习看板")
    parser.add_argument("--root", required=True, help="学习目录，例如 E:\\English")
    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()
    notes_dir = root / "notes"
    if not notes_dir.is_dir():
        print("BOARD_FAIL 原因=notes 目录不存在，先运行 init_workspace.py")
        return 1
    try:
        lessons = parse_notes(notes_dir)
        days = parse_read_dir(root / "read")
        level = read_level(root)
        wrong_rows = parse_wrong_words(root / "wrong-words.md")
        outputs = {
            "INDEX.md": build_index(lessons, level, days),
            "digest.md": build_digest(lessons, level, days, wrong_rows),
            "review/index.html": build_board(lessons, level, days, wrong_rows),
            "review/reading.html": build_reading_page(days),
            "review/readIndex.html": build_read_index_page(days),
            "review/words.html": build_words_page(lessons),
            "review/wrong.html": build_wrong_page(wrong_rows),
        }
        pages = {f"review/lessons/lesson-{lesson['no']}.html": render_lesson_page(lesson) for lesson in lessons}
    except Exception as exc:
        print(f"BOARD_FAIL 原因={exc}")
        return 1
    try:
        for relative, text in outputs.items():
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text, encoding="utf-8")
        lessons_dir = root / "review" / "lessons"
        lessons_dir.mkdir(parents=True, exist_ok=True)
        for old in lessons_dir.glob("lesson-*.html"):
            old.unlink()
        for relative, text in pages.items():
            (root / relative).write_text(text, encoding="utf-8")
    except Exception as exc:
        print(f"BOARD_FAIL 原因=写入失败：{exc}")
        return 1
    vocab_count = sum(len(l["vocab"]) for l in lessons)
    digest_size = len((root / "digest.md").read_text(encoding="utf-8"))
    print(
        f"BOARD_OK 课程数={len(lessons)} 阅读数={sum(len(d['pieces']) for d in days)} "
        f"词汇数={vocab_count} 摘要字节={digest_size}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
