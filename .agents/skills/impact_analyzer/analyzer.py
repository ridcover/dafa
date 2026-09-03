import os
import sys
import re
import json
import argparse

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

def find_usages(project_root, target_name):
    """Scan all files to find import/require usages of target_name (no false positives from comments/strings)."""
    usages = set()
    exclude_dirs = {'.git', 'node_modules', 'dist', 'build', '.agents', 'vendor', '.history', 'quarantine', '.backup_replace', '.dart_tool', '.gradle', '.pub-cache', 'Pods'}

    escaped = re.escape(target_name)
    # Suffix pattern: target name can appear after ./ ../ or folder/ prefixes in quoted paths.
    # e.g. './Button', '../components/Button', 'utils/Button'
    quoted_suffix = rf"['\"](?:\.\/|\.\.\/|[^'\"]*/)?{escaped}['\"]"

    patterns = [
        # ES module named import (exact + suffix): import { Foo } from 'Foo' or import Foo from './Foo'
        re.compile(rf"import\s+(?:\{{[^}}]*}}|[^{{}};\n]+)\s+from\s+{quoted_suffix}"),
        re.compile(rf"import\s+{{[^}}]*}}\s+from\s+{quoted_suffix}"),
        # CommonJS require (exact + suffix): require('./Foo') or require('Foo')
        re.compile(rf"require\s*\(\s*{quoted_suffix}"),
        # Dynamic import (exact + suffix): import('./Foo') or import('Foo')
        re.compile(rf"import\s*\(\s*{quoted_suffix}"),
        # Export from (exact + suffix)
        re.compile(rf"export\s+.*?\s+from\s+{quoted_suffix}"),
        # Direct bareword import (exact + suffix): import 'Foo' or import './Foo'
        re.compile(rf"import\s+{quoted_suffix}"),
        # Python/PHP unquoted imports (e.g. from scope_guardian... import scope_check)
        re.compile(rf"(?:^|\n)\s*(?:from|import|use|include(?:_once)?|require(?:_once)?)\s+.*?\b{escaped}\b")
    ]

    for root, dirs, files in os.walk(project_root):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if not file.endswith(('.js', '.jsx', '.ts', '.tsx', '.py', '.php')):
                continue

            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if any(p.search(content) for p in patterns):
                        usages.add(filepath)
            except Exception:
                pass
    return usages

def analyze_impact(target_path, project_root, max_depth=2):
    target_filename = os.path.basename(target_path)
    target_base, _ = os.path.splitext(target_filename)

    if target_base.lower() == 'index':
        target_base = os.path.basename(os.path.dirname(target_path))

    levels = []
    current_level_files = set([target_path])
    all_found = set([target_path])
    stats = {}
    total_impacted = 0

    for depth_idx in range(max_depth):
        next_level = set()
        for f in current_level_files:
            base, _ = os.path.splitext(os.path.basename(f))
            if base.lower() == 'index':
                base = os.path.basename(os.path.dirname(f))
            usages = find_usages(project_root, base)
            next_level.update(usages - all_found)
            
        if not next_level:
            break
            
        levels.append(list(next_level))
        all_found.update(next_level)
        current_level_files = next_level
        
        stats[f"level_{depth_idx+1}_count"] = len(next_level)
        total_impacted += len(next_level)

    stats["total_impacted"] = total_impacted

    return {
        'target': target_filename,
        'target_path': target_path,
        'levels': levels,
        'stats': stats
    }

def print_human(result, project_root):
    print(f"Analyzing Impact for: {result['target']}")
    print(f"Project Root: {project_root}")
    print("-" * 50)

    for i, level_files in enumerate(result['levels']):
        label = "Direct" if i == 0 else "Indirect"
        print(f"\n[Level {i+1}] {label} Dependents:")
        for f in level_files:
            print(f"  - {os.path.relpath(f, project_root)}")

    if not result['levels']:
        print("\n[Level 1] Direct Dependents:")
        print("  No dependents found. Safe to modify/delete.")

    print("\n" + "=" * 50)
    summary_parts = []
    for i in range(len(result['levels'])):
        label = "direct" if i == 0 else "indirect"
        summary_parts.append(f"{result['stats'][f'level_{i+1}_count']} {label}")
    
    if not summary_parts:
        summary_parts = ["0 direct", "0 indirect"]
    elif len(summary_parts) == 1:
        summary_parts.append("0 indirect")
        
    print(f"Impact Summary: {', '.join(summary_parts)}")

def main():
    parser = argparse.ArgumentParser(description="Impact Analyzer - Dependency Graph")
    parser.add_argument("target", help="Target file path")
    parser.add_argument("project_root", help="Project root directory")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--depth", type=int, default=2, help="Maximum depth to trace dependencies")
    args = parser.parse_args()

    if not os.path.exists(args.target):
        print(f"[ERROR] Target file not found: {args.target}")
        sys.exit(1)

    result = analyze_impact(args.target, args.project_root, args.depth)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print_human(result, args.project_root)

if __name__ == '__main__':
    main()
