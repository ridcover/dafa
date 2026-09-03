import os
import sys
import json
import argparse

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

def _read_gitignore(project_root):
    """Read directory patterns from project's .gitignore."""
    gitignore_path = os.path.join(project_root, '.gitignore')
    patterns = []
    if os.path.exists(gitignore_path):
        with open(gitignore_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    # Strip trailing slash from dir patterns (e.g. .next/ -> .next)
                    if line.endswith('/'):
                        line = line[:-1]
                    patterns.append(line)
    return patterns

def analyze_project(target_dir):
    result = {
        'tech_stack': [],
        'scripts': {},
        'dependencies': {'runtime': 0, 'dev': 0, 'top': []},
        'file_stats': {
            'total_files': 0,
            'total_size_mb': 0,
            'by_extension': {}
        }
    }

    # 1. Tech Stack Detection
    if os.path.exists(os.path.join(target_dir, 'package.json')):
        result['tech_stack'].append("Node.js")
    if os.path.exists(os.path.join(target_dir, 'requirements.txt')) or os.path.exists(os.path.join(target_dir, 'Pipfile')):
        result['tech_stack'].append("Python")
    if os.path.exists(os.path.join(target_dir, 'vite.config.js')) or os.path.exists(os.path.join(target_dir, 'vite.config.ts')):
        result['tech_stack'].append("Vite (React/Vue)")
    if os.path.exists(os.path.join(target_dir, 'next.config.js')):
        result['tech_stack'].append("Next.js")
    if os.path.exists(os.path.join(target_dir, 'composer.json')):
        result['tech_stack'].append("PHP/Laravel")

    # 2. Package.json Parsing
    pkg_path = os.path.join(target_dir, 'package.json')
    if os.path.exists(pkg_path):
        try:
            with open(pkg_path, 'r', encoding='utf-8') as f:
                pkg = json.load(f)

            result['scripts'] = pkg.get('scripts', {})
            deps = pkg.get('dependencies', {})
            dev_deps = pkg.get('devDependencies', {})
            result['dependencies']['runtime'] = len(deps)
            result['dependencies']['dev'] = len(dev_deps)
            result['dependencies']['top'] = list(deps.keys())[:10]
        except Exception as e:
            pass

    # 3. Directory Stats
    hardcoded_ignore = {'.git', 'node_modules', 'vendor', 'dist', 'build', '.history', 'quarantine', '.dart_tool', '.gradle', '.pub-cache', 'Pods'}
    ignore_dirs = set(hardcoded_ignore)
    ignore_dirs.update(_read_gitignore(target_dir))
    total_files = 0
    total_size = 0
    file_counts = {}

    for root, dirs, files in os.walk(target_dir):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        for file in files:
            total_files += 1
            filepath = os.path.join(root, file)
            try:
                total_size += os.path.getsize(filepath)
            except: pass

            ext = os.path.splitext(file)[1].lower() or 'no_ext'
            file_counts[ext] = file_counts.get(ext, 0) + 1

    result['file_stats']['total_files'] = total_files
    result['file_stats']['total_size_mb'] = round(total_size / (1024 * 1024), 2)
    result['file_stats']['by_extension'] = file_counts

    return result

def print_human(result, target_dir):
    print("\nDEEP ANALYZER: Project Profiler")
    print("=" * 60)

    stack_str = ", ".join(result['tech_stack']) if result['tech_stack'] else "Unknown"
    print(f"[{'OK' if result['tech_stack'] else 'WARN'}] Tech Stack Detected: {stack_str}")

    if result['scripts']:
        print("\n[INFO] Available npm/yarn Commands:")
        for name, cmd in result['scripts'].items():
            print(f"  - npm run {name:<12} : {cmd}")

    print(f"\n[INFO] Dependencies: {result['dependencies']['runtime']} runtime, {result['dependencies']['dev']} dev")
    if result['dependencies']['top']:
        print(f"  - Key libraries: {', '.join(result['dependencies']['top'][:5])}...")

    print("\n[INFO] Directory Statistics:")
    print(f"  - Total Files: {result['file_stats']['total_files']} ({result['file_stats']['total_size_mb']} MB)")

    active_exts = {k: v for k, v in result['file_stats']['by_extension'].items() if v > 0}
    ext_str = ", ".join([f"{k} ({v})" for k, v in active_exts.items()])
    if ext_str:
        print(f"  - Source Files: {ext_str}")

def main():
    parser = argparse.ArgumentParser(description="Deep Analyzer - Project Profiler")
    parser.add_argument("target", nargs="?", default=os.getcwd(), help="Target directory to analyze")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    if not os.path.isdir(args.target):
        print(f"[FAIL] Target is not a directory: {args.target}")
        sys.exit(1)

    result = analyze_project(args.target)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print_human(result, args.target)
        print("\n" + "=" * 60)
        print("[OK] Analisis selesai.")
        print("\n💡 PROMPT:")
        print('"Gunakan hasil Deep Analyzer di atas untuk memahami struktur project."')

if __name__ == "__main__":
    main()
