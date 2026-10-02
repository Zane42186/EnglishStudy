#!/usr/bin/env python3
"""契约自检（只读，零第三方依赖）。

检查项：
1. docs/schemas/*.schema.json 全部可解析为 JSON 对象。
2. 所有 $ref 都能解析到「存在的文件 + 存在的 JSON Pointer」。
3. 每个对象的 required 字段都在 properties 中有定义。
4. 关键枚举与字段的存在性（防回归）。

本脚本是**两版能力的合并版**（2026-10-02 裁定 A25）。合并前存在两个同名副本：
  - 受控版 `docs/schemas/check_schemas.py`（objects = 语义计数 71）
  - `.workbuddy/build/check_schemas.py` （objects = 原始计数 535）
两版**各有一项对方没有的校验**，删任一份都会丢检查，故合并：

  - 受控版独有：`required ⊆ properties` 校验 → 已并入（见下第 3 项）。
  - build 版独有：自定位 SCHEMA_DIR、`*.schema.json` 精确 glob、
    枚举/字段防回归守卫（SectionType / ExerciseBlockKind / blockNo / blockKind）
    → 已并入（见下方「关键枚举与字段防回归」段）。

**两个计数量均输出**，定义见本目录 `README.md` 第五节：
  objects = 「type == "object" 或含 properties」的节点数（语义计数，当前 71）
  nodes   = 全部 dict 节点数（原始计数，当前 535）
两者都对，只是口径不同；历史文档里报出的 `objects=535` / `objects=536`
属于**原始计数**口径，与今日的 `nodes` 等价。

退出码 0 = SCHEMA_OK，1 = SCHEMA_FAIL。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# 自定位：脚本自身所在目录即受控契约目录（不依赖 CWD）；仍允许 argv[1] 显式覆盖。
SCHEMA_DIR = (
    Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent
)


def resolve_pointer(doc, ptr: str):
    """解析 JSON Pointer；任何一步失配都返回 None（不抛异常）。"""
    if ptr in ("", "/"):
        return doc
    cur = doc
    for raw in ptr.lstrip("/").split("/"):
        token = raw.replace("~1", "/").replace("~0", "~")
        if isinstance(cur, list):
            if not token.isdigit() or int(token) >= len(cur):
                return None
            cur = cur[int(token)]
        elif isinstance(cur, dict) and token in cur:
            cur = cur[token]
        else:
            return None
    return cur


def main() -> int:
    files = sorted(SCHEMA_DIR.glob("*.schema.json"))
    if not files:
        print(f"SCHEMA_FAIL 原因=在 {SCHEMA_DIR} 下没找到 *.schema.json")
        return 1

    docs: dict[str, dict] = {}
    for f in files:
        try:
            docs[f.name] = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            print(f"SCHEMA_FAIL 文件={f.name} 原因=JSON 解析失败 {exc}")
            return 1

    refs = 0
    objects = 0  # 语义计数：type == "object" 或含 properties
    nodes = 0  # 原始计数：全部 dict 节点
    problems: list[str] = []

    def walk(node, path: str, file_name: str) -> None:
        nonlocal refs, objects, nodes
        if isinstance(node, dict):
            nodes += 1

            ref = node.get("$ref")
            if isinstance(ref, str):
                refs += 1
                if ref.startswith("#"):
                    target_file, pointer = file_name, ref[1:]
                else:
                    target_file, _, pointer = ref.partition("#")
                    pointer = pointer or "/"
                if target_file not in docs:
                    problems.append(f"{file_name}{path}: $ref 指向不存在的文件 {target_file}")
                elif resolve_pointer(docs[target_file], pointer) is None:
                    problems.append(f"{file_name}{path}: $ref 目标无法解析 {ref}")

            # 受控版独有能力：required ⊆ properties
            if node.get("type") == "object" or "properties" in node:
                objects += 1
                props = node.get("properties", {})
                for key in node.get("required", []):
                    if key not in props:
                        problems.append(
                            f"{file_name}{path}: required 字段 '{key}' 未在 properties 中定义"
                        )

            for key, value in node.items():
                walk(value, f"{path}/{key}", file_name)
        elif isinstance(node, list):
            for index, value in enumerate(node):
                walk(value, f"{path}/{index}", file_name)

    for name, doc in docs.items():
        walk(doc, "", name)

    # ---- 关键枚举与字段防回归（build 版能力） ----
    common = docs.get("common.schema.json", {})
    defs = common.get("$defs", {})

    section_enum = defs.get("SectionType", {}).get("enum", [])
    if "backfill" not in section_enum:
        problems.append("common.SectionType 缺少 backfill")
    elif section_enum[-1] != "backfill":
        problems.append(f"common.SectionType 的 backfill 不在末尾：{section_enum}")

    if "ExerciseBlockKind" not in defs:
        problems.append("common 缺少 $defs.ExerciseBlockKind")
    elif defs["ExerciseBlockKind"].get("enum") != ["homework", "backfill"]:
        problems.append(f"ExerciseBlockKind 枚举异常：{defs['ExerciseBlockKind'].get('enum')}")

    for fname, defname, fields in (
        ("exercise-set.schema.json", "ExerciseItem", ("blockNo",)),
        ("lesson-record.schema.json", "ExerciseRecord", ("blockKind", "blockNo")),
    ):
        props = docs.get(fname, {}).get("$defs", {}).get(defname, {}).get("properties", {})
        for field in fields:
            if field not in props:
                problems.append(f"{fname}.{defname} 缺少 {field}")

    print(f"SCHEMA_CHECK files={len(docs)} refs={refs} objects={objects} nodes={nodes}")
    if problems:
        for p in problems:
            print(f"  ⛔ {p}")
        print(f"SCHEMA_FAIL 问题数={len(problems)}")
        return 1
    print("SCHEMA_OK 全部 $ref 可解析，required 字段定义完整，枚举与字段防回归通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
