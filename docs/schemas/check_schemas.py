"""只读校验 docs/schemas 下的契约文件。

检查项：
1. 每个 .json 文件可被 json.load 解析
2. 每个 $ref 的目标文件与 JSON Pointer 真实存在
3. 每个对象的 required 字段都在 properties 中有定义
4. 输出统计与问题清单，不做任何写入
"""

import json
import sys
from pathlib import Path

SCHEMA_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("docs/schemas")

problems = []
stats = {"files": 0, "refs": 0, "objects": 0}


def resolve_pointer(doc, pointer: str):
    if pointer in ("", "/"):
        return doc
    cur = doc
    for raw in pointer.lstrip("/").split("/"):
        token = raw.replace("~1", "/").replace("~0", "~")
        if isinstance(cur, dict) and token in cur:
            cur = cur[token]
        elif isinstance(cur, list) and token.isdigit() and int(token) < len(cur):
            cur = cur[int(token)]
        else:
            return None
    return cur


def walk(node, path, file_name, docs):
    if isinstance(node, dict):
        if "$ref" in node:
            stats["refs"] += 1
            ref = node["$ref"]
            if ref.startswith("#"):
                target_file, pointer = file_name, ref[1:]
            else:
                target_file, _, pointer = ref.partition("#")
                pointer = pointer if pointer else "/"
            if target_file not in docs:
                problems.append(f"{file_name}{path}: $ref 指向不存在的文件 {target_file}")
            else:
                if resolve_pointer(docs[target_file], pointer) is None:
                    problems.append(f"{file_name}{path}: $ref 目标无法解析 {ref}")
        if node.get("type") == "object" or "properties" in node:
            stats["objects"] += 1
            props = node.get("properties", {})
            for key in node.get("required", []):
                if key not in props:
                    problems.append(f"{file_name}{path}: required 字段 '{key}' 未在 properties 中定义")
        for key, value in node.items():
            walk(value, f"{path}/{key}", file_name, docs)
    elif isinstance(node, list):
        for index, value in enumerate(node):
            walk(value, f"{path}/{index}", file_name, docs)


docs = {}
for path in sorted(SCHEMA_DIR.glob("*.json")):
    stats["files"] += 1
    try:
        docs[path.name] = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        problems.append(f"{path.name}: JSON 解析失败 -> {exc}")

for name, doc in docs.items():
    walk(doc, "", name, docs)

print(f"SCHEMA_CHECK files={stats['files']} refs={stats['refs']} objects={stats['objects']}")
if problems:
    print(f"SCHEMA_PROBLEMS count={len(problems)}")
    for item in problems:
        print("  -", item)
    sys.exit(1)
print("SCHEMA_OK 全部 $ref 可解析，required 字段定义完整")
