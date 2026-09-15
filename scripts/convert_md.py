#!/usr/bin/env python3
import sys
import os
import markdown
from pathlib import Path

TEMPLATE = """<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="index,follow">
  <title>{title}</title>
  <meta name="description" content="{description}">
</head>
<body>
<article>
{content}
</article>
</body>
</html>
"""


def convert(md_path, out_dir):
    md_path = Path(md_path)
    if not md_path.exists():
        print(f"Error: {md_path} not found", file=sys.stderr)
        sys.exit(1)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    text = md_path.read_text(encoding='utf-8')
    html = markdown.markdown(text, extensions=["fenced_code", "tables", "toc"])

    title = md_path.stem
    description = ''

    out_name = md_path.stem + '.html'
    out_path = out_dir / out_name
    out_path.write_text(TEMPLATE.format(title=title, description=description, content=html), encoding='utf-8')
    print(f"Wrote {out_path}")


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: convert_md.py <markdown-file> <output-dir>")
        sys.exit(1)
    convert(sys.argv[1], sys.argv[2])
