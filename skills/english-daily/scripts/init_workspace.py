#!/usr/bin/env python3
r"""创建英语每日课的目录结构与初始文件。已存在的文件一律不覆盖。

用法：python init_workspace.py --root E:\English
成功：INIT_OK 新建=<n> 已存在=<n>
失败：INIT_FAIL 原因=<原因>
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROGRESS = """# 学习进度

- 当前级别：Level 1
- 当前课号：0
- 最近反馈：无
- 上次上课：无
- 已学知识点：无

## 反馈记录

| 课号 | 日期 | 反馈 | 级别变化 |
|---|---|---|---|
"""

WRONG_WORDS = """# 错词本

| 课号 | 错误点 | 正确形式 | 错因 | 连续答对 | 状态 |
|---|---|---|---|---|---|
"""

INDEX = """# 英语学习总目录

> 由 build_board.py 自动生成，手工修改会在下次重建时被覆盖。

还没有课程记录。上完第一次课后运行 build_board.py，这里会自动生成目录。
"""

FILES = {"progress.md": PROGRESS, "wrong-words.md": WRONG_WORDS, "INDEX.md": INDEX}


def main() -> int:
    parser = argparse.ArgumentParser(description="初始化学习目录")
    parser.add_argument("--root", required=True, help="学习目录，例如 E:\\English")
    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()

    try:
        root.mkdir(parents=True, exist_ok=True)
        (root / "notes").mkdir(exist_ok=True)
        (root / "read").mkdir(exist_ok=True)
        (root / "review").mkdir(exist_ok=True)
        created, existing = 0, 0
        for name, content in FILES.items():
            target = root / name
            if target.exists():
                existing += 1
                continue
            target.write_text(content, encoding="utf-8")
            created += 1
    except Exception as exc:
        print(f"INIT_FAIL 原因={exc}")
        return 1

    print(f"INIT_OK 新建={created} 已存在={existing}")
    print(f"目录：{root}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
