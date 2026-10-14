# -*- coding: utf-8 -*-
"""
Hermes oneshot 文件传参包装器（从参考项目 asset_model_analysis 复用）
用途：让 Node 以「文件」而非「命令行参数」把中文 prompt 交给 Hermes，
彻底绕开 Windows 下 Node -> 子进程 argv 的中文乱码问题。

调用方式：
    python hermes_oneshot.py <prompt_file_utf8> [usage_file]
"""
import sys
import os

from hermes_cli.oneshot import run_oneshot


def main():
    if len(sys.argv) < 2:
        sys.stderr.write("用法: python hermes_oneshot.py <prompt_file> [usage_file]\n")
        return 2

    prompt_path = sys.argv[1]
    usage_file = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        with open(prompt_path, "r", encoding="utf-8") as f:
            prompt = f.read()
    except Exception as exc:
        sys.stderr.write(f"读取 prompt 文件失败: {exc}\n")
        return 2

    if not prompt.strip():
        sys.stderr.write("prompt 文件为空\n")
        return 2

    return run_oneshot(prompt, usage_file=usage_file)


if __name__ == "__main__":
    sys.exit(main())
