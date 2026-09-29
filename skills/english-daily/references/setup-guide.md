# 环境说明

这个 Skill 不需要登录、不需要 API Key、不需要任何账号，也不读取任何凭据。它只依赖三件事：Python、目录写权限、网络（可选）。

| 依赖编号 | 对应环境 | 必需 | 影响的功能 |
|---|---|---|---|
| python-runtime | Python 3.10 及以上 | 必需 | 总目录重建、复习看板生成、错词复习 |
| web-search | 网络（读公开页面） | 可选 | 当日新闻改写阅读 |

目录写权限由 `check_environment.py` 一并检查，不需要额外安装任何东西。

## 1. Python 3.10 及以上（必需）

用途：重建总目录 INDEX.md 与复习看板 review\index.html。三个脚本只用 Python 标准库，不需要 pip 安装任何包。

- 官方下载：https://www.python.org/downloads/
- 官方文档：https://docs.python.org/zh-cn/3/
- 检查：`python --version`，输出 3.10 及以上即可
- Windows 安装时勾选 Add Python to PATH；已安装但命令找不到时，用终端查出的完整解释器路径调用，不加 PATH 也能跑

## 2. 学习目录写权限（必需）

用途：写入笔记、总目录和看板。

- 默认目录：`E:\English`
- 换目录：所有脚本加 `--root <目录>`，例如 `python scripts\build_board.py --root D:\Study\English`
- 检查：运行 `python scripts\check_environment.py --root E:\English`，看「目录写权限」一项
- 目录被误删或首次使用：运行 `python scripts\init_workspace.py --root E:\English` 重建

## 3. 网络（可选，仅 Level 4—5 需要）

用途：搜索当日英文新闻，改写成对应级别的阅读材料。

- 不需要任何站点账号，读公开页面即可
- 推荐入口：BBC Learning English（https://www.bbc.co.uk/learningenglish）、VOA Learning English（https://learningenglish.voanews.com）。这两个入口在制作环境中未能连通验证，请以你本机的实际访问为准；任何可访问的英文新闻站点都可以替代
- 检查：运行 check_environment.py，看「网络」一项
- 不通时的表现：Level 4—5 的阅读自动改为自编同级短文，来源标「自编（当日新闻获取失败）」。Level 1—3 的阅读本来就是自编的，不受影响

## 环境状态怎么读

运行 `python scripts\check_environment.py --root E:\English`，看第一行 `ENV_STATUS=`：

| 状态 | 含义 | 该做什么 |
|---|---|---|
| ready | 全部就绪 | 直接上课 |
| partial | 可选项缺失（通常是网络） | 正常上课，新闻类阅读降级为自编短文 |
| needs_setup | 必需项缺失 | 只补提示出来的那一项，补完重跑 |
| unavailable | 必需项不可用且无法绕过 | 按脚本给出的提示修复，修复前不生成看板 |

## 降级矩阵

| 能力 | 依赖 | 不可用时 | 限制 |
|---|---|---|---|
| 上课、讲语法、出作业 | 无 | 不受影响 | 无 |
| 写入笔记 | 目录写权限 | 提示用户换目录或修复权限 | 修复前不写文件 |
| 重建总目录与复习看板 | Python 3.10+ | 由模型直接维护 INDEX.md，不出看板 | 无交互复习，无点击翻词卡 |
| Level 1—3 阅读 | 无 | 不受影响（本来就是自编） | 无 |
| Level 4—5 当日新闻阅读 | 网络 | 改为自编同级短文并标注来源 | 无时效性，不是真实新闻 |

## 恢复步骤

- Python 版本过低：升级到 3.10 以上，或用完整路径调用已达标的解释器
- 目录无写权限：换一个可写目录并把 `--root` 统一改过去，不要沿用旧路径
- 网络恢复后：无需任何配置，下次上课时 Level 4—5 的阅读自动恢复为当日新闻改写
