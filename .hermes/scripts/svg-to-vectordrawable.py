#!/usr/bin/env python3
"""
Convert simple-icons SVGs to Android VectorDrawable XML.
- 24x24 viewport
- All paths preserved with fillColor
"""
import re
import os
import sys
from pathlib import Path

DRAWABLE_DIR = Path(__file__).parent.parent.parent / "android" / "app" / "src" / "main" / "res" / "drawable"

def convert_svg_to_vectordrawable(svg_path: Path) -> str:
    """Convert SVG file content to Android VectorDrawable XML."""
    content = svg_path.read_text(encoding='utf-8')

    # Extract viewBox
    vb_match = re.search(r'viewBox="([\d.\s\-]+)"', content)
    if vb_match:
        vb = vb_match.group(1).split()
    else:
        vb = ['0', '0', '24', '24']

    # Extract <path> elements (with self-closing)
    path_pattern = r'<path\s+([^/]+?)/>'
    paths = re.findall(path_pattern, content, re.DOTALL)

    # Extract <ellipse> elements
    ellipse_pattern = r'<ellipse\s+([^/]+?)/>'
    ellipses = re.findall(ellipse_pattern, content, re.DOTALL)

    # Extract <circle> elements
    circle_pattern = r'<circle\s+([^/]+?)/>'
    circles = re.findall(circle_pattern, content, re.DOTALL)

    # Build attributes for a single path
    def parse_attrs(attr_str: str) -> dict:
        attrs = {}
        for m in re.finditer(r'([a-zA-Z\-:]+)="([^"]*)"', attr_str):
            key = m.group(1)
            val = m.group(2)
            # Map SVG attrs to Android
            if key == 'fill' and val != 'none':
                attrs['android:fillColor'] = val
            elif key == 'd':
                attrs['android:pathData'] = val
            elif key == 'fill-rule':
                attrs['android:fillType'] = 'evenOdd' if val == 'evenodd' else 'nonZero'
        return attrs

    # Build XML
    lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
        '    android:width="24dp"',
        '    android:height="24dp"',
        f'    android:viewportWidth="{vb[2]}"',
        f'    android:viewportHeight="{vb[3]}">',
    ]

    for path_attrs in paths:
        attrs = parse_attrs(path_attrs)
        if 'android:pathData' not in attrs:
            continue
        attr_str = ' '.join(f'{k}="{v}"' for k, v in attrs.items())
        lines.append(f'    <path {attr_str}/>')

    for ellipse_attrs in ellipses:
        # ellipses: cx, cy, rx, ry
        attrs = {}
        for m in re.finditer(r'([a-zA-Z\-:]+)="([^"]*)"', ellipse_attrs):
            key = m.group(1)
            val = m.group(2)
            if key == 'fill' and val != 'none':
                attrs['android:fillColor'] = val
            elif key in ('cx', 'cy', 'rx', 'ry'):
                attrs[f'android:{key}'] = val
        attr_str = ' '.join(f'{k}="{v}"' for k, v in attrs.items())
        lines.append(f'    <path {attr_str}/>')

    for circle_attrs in circles:
        attrs = {}
        for m in re.finditer(r'([a-zA-Z\-:]+)="([^"]*)"', circle_attrs):
            key = m.group(1)
            val = m.group(2)
            if key == 'fill' and val != 'none':
                attrs['android:fillColor'] = val
            elif key in ('cx', 'cy', 'r'):
                attrs[f'android:{key}'] = val
        attr_str = ' '.join(f'{k}="{v}"' for k, v in attrs.items())
        lines.append(f'    <path {attr_str}/>')

    lines.append('</vector>')
    return '\n'.join(lines)


def main():
    svg_files = sorted(DRAWABLE_DIR.glob("*.svg"))
    for svg_path in svg_files:
        xml_path = svg_path.with_suffix('.xml')
        try:
            xml_content = convert_svg_to_vectordrawable(svg_path)
            xml_path.write_text(xml_content, encoding='utf-8')
            print(f"✓ {svg_path.name} → {xml_path.name}")
        except Exception as e:
            print(f"✗ {svg_path.name}: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
