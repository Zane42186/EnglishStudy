#!/usr/bin/env python3
r"""只读检查英语每日课的运行环境，不修改任何配置，不读取任何凭据。

用法：python check_environment.py --root E:\English
输出：ENV_STATUS=ready|partial|needs_setup|unavailable，随后逐项列出结果。
退出码：0 = ready/partial，1 = needs_setup，2 = unavailable。
"""

from __future__ import annotations

import argparse
import os
import sys
import urllib.request
from pathlib import Path

MIN_PYTHON = (3, 10)
PROBE_URL = "https://www.bbc.co.uk/learningenglish"
PROBE_TIMEOUT = 5


def check_python() -> tuple[bool, str]:
    version = sys.version_info
    ok = (version.major, version.minor) >= MIN_PYTHON
    text = f"{version.major}.{version.minor}.{version.micro}"
    return ok, ("就绪（" + text + "）" if ok else f"版本过低（{text}，需要 3.10 及以上）")


def check_root(root: Path) -> tuple[str, str]:
    if not root.exists():
        return "needs_setup", f"目录不存在（{root}），运行 init_workspace.py 创建"
    if not root.is_dir():
        return "needs_setup", f"路径不是目录（{root}）"
    if not os.access(root, os.W_OK):
        return "needs_setup", f"目录不可写（{root}），换一个目录或修复权限"
    return "ready", f"就绪（{root}）"


def check_network() -> tuple[bool, str]:
    request = urllib.request.Request(PROBE_URL, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(request, timeout=PROBE_TIMEOUT) as response:
            return True, f"就绪（{PROBE_URL} 返回 {response.status}）"
    except Exception as exc:
        return False, f"不可用（{type(exc).__name__}）；Level 4-5 的新闻阅读会降级为自编短文"


def main() -> int:
    parser = argparse.ArgumentParser(description="检查运行环境")
    parser.add_argument("--root", required=True, help="学习目录，例如 E:\\English")
    args = parser.parse_args()

    try:
        root = Path(args.root).expanduser().resolve()
        python_ok, python_text = check_python()
        root_status, root_text = check_root(root)
        network_ok, network_text = check_network()
    except Exception as exc:
        print("ENV_STATUS=unavailable")
        print(f"- 环境检查异常：{exc}")
        return 2

    required_ok = python_ok and root_status == "ready"
    if not required_ok:
        status = "needs_setup"
    elif not network_ok:
        status = "partial"
    else:
        status = "ready"

    print(f"ENV_STATUS={status}")
    print(f"- Python：{python_text}")
    print(f"- 目录写权限：{root_text}")
    print(f"- 网络（Level 4-5 新闻阅读）：{network_text}")
    if status == "needs_setup":
        print("- 处理：只补上面标为缺失的必需项，补完重新运行本脚本")
    return {"ready": 0, "partial": 0, "needs_setup": 1, "unavailable": 2}[status]


if __name__ == "__main__":
    sys.exit(main())
