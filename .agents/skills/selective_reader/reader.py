import os
import sys
import re
import json
import hashlib
import argparse
import ast

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

MAX_FILE_SIZE = 500 * 1024 # 500 KB

def parse_js(content):
    toc = []
    class_pattern = re.compile(r'^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z0-9_]+)', re.MULTILINE)
    func_pattern = re.compile(r'^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)', re.MULTILINE)
    arrow_pattern = re.compile(r'^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s+)?(?:\(([^)]*)\)|([A-Za-z0-9_]+))\s*=>', re.MULTILINE)
    interface_pattern = re.compile(r'^\s*(?:export\s+)?interface\s+([A-Za-z0-9_]+)', re.MULTILINE)
    type_pattern = re.compile(r'^\s*(?:export\s+)?type\s+([A-Za-z0-9_]+)\s*[=({]', re.MULTILINE)
    enum_pattern = re.compile(r'^\s*(?:export\s+)?enum\s+([A-Za-z0-9_]+)', re.MULTILINE)

    import_pattern = re.compile(r'^\s*import\s+(.*?from\s+[\'"][^\'"]+[\'"]|.*?[\'"][^\'"]+[\'"])', re.MULTILINE)
    usestate_pattern = re.compile(r'^\s*(?:const|let|var)\s+(\[[^\]]+\]|\w+)\s*=\s*useState', re.MULTILINE)
    useeffect_pattern = re.compile(r'^\s*useEffect\s*\(', re.MULTILINE)
    export_pattern = re.compile(r'^\s*export\s+(?:default\s+)?(?:const|function|class)\s+([A-Za-z0-9_]+)', re.MULTILINE)

    for match in import_pattern.finditer(content):
        line = content.count('\n', 0, match.start()) + 1
        val = match.group(0).strip()
        if len(val) > 60: val = val[:57] + '...'
        toc.append({'line': line, 'type': 'Import', 'name': val})

    for match in usestate_pattern.finditer(content):
        line = content.count('\n', 0, match.start()) + 1
        toc.append({'line': line, 'type': 'State', 'name': match.group(1)})

    for match in useeffect_pattern.finditer(content):
        line = content.count('\n', 0, match.start()) + 1
        toc.append({'line': line, 'type': 'Effect', 'name': 'useEffect'})

    for match in export_pattern.finditer(content):
        line = content.count('\n', 0, match.start()) + 1
        toc.append({'line': line, 'type': 'Export', 'name': match.group(1)})

    for match in class_pattern.finditer(content):
        line = content.count('\n', 0, match.start()) + 1
        toc.append({'line': line, 'type': 'Class', 'name': match.group(1)})

    for match in func_pattern.finditer(content):
        line = content.count('\n', 0, match.start()) + 1
        toc.append({'line': line, 'type': 'Function', 'name': match.group(1)})

    for match in arrow_pattern.finditer(content):
        line = content.count('\n', 0, match.start()) + 1
        args = match.group(2) if match.group(2) is not None else match.group(3)
        args = args.strip().replace('\n', ' ') if args else ""
        if len(args) > 40: args = args[:37] + '...'
        toc.append({'line': line, 'type': 'Arrow Function', 'name': f"{match.group(1)}({args})"})

    for match in interface_pattern.finditer(content):
        line = content.count('\n', 0, match.start()) + 1
        toc.append({'line': line, 'type': 'Interface', 'name': match.group(1)})

    for match in type_pattern.finditer(content):
        line = content.count('\n', 0, match.start()) + 1
        toc.append({'line': line, 'type': 'Type', 'name': match.group(1)})

    for match in enum_pattern.finditer(content):
        line = content.count('\n', 0, match.start()) + 1
        toc.append({'line': line, 'type': 'Enum', 'name': match.group(1)})

    toc.sort(key=lambda x: x['line'])
    
    # PM requested output to be under ~60 lines. 
    # If it's too large, we should maybe truncate imports?
    # Actually, we shouldn't arbitrarily truncate. We'll return them all.
    return toc

def parse_py(content):
    """Extract classes and functions from Python source using AST."""
    toc = []
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return []
    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            toc.append({'line': node.lineno, 'type': 'Class', 'name': node.name})
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            toc.append({'line': node.lineno, 'type': 'Function', 'name': node.name})
    toc.sort(key=lambda x: x['line'])
    return toc

def get_project_root(start_path):
    current = os.path.abspath(start_path)
    while True:
        if os.path.exists(os.path.join(current, 'package.json')) or os.path.exists(os.path.join(current, '.git')):
            return current
        parent = os.path.dirname(current)
        if parent == current:
            return os.path.abspath(start_path)
        current = parent

def load_cache(cache_file):
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_cache(cache_file, data):
    try:
        os.makedirs(os.path.dirname(cache_file), exist_ok=True)
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass

def print_human(filepath, toc):
    print(f"📄 TABLE OF CONTENTS: {os.path.basename(filepath)}")
    print("-" * 50)
    if not toc:
        print("[INFO] No primary class or function declarations found.")
    else:
        for item in toc:
            print(f"<spotlight>Line {item['line']:<5}: {item['type']}: {item['name']}</spotlight>")
    print("-" * 50)
    print("\n💡 PROMPT:")
    print(f'"Berdasarkan TOC di atas, tolong gunakan tool view_file untuk membaca hanya baris yang relevan."')

def print_json(filepath, toc, file_mtime):
    result = {
        'file': os.path.basename(filepath),
        'absolute_path': filepath,
        'mtime': file_mtime,
        'stats': {
            'total_items': len(toc),
            'classes': len([t for t in toc if t['type'] == 'Class']),
            'functions': len([t for t in toc if t['type'] == 'Function']),
            'arrow_functions': len([t for t in toc if t['type'] == 'Arrow Function'])
        },
        'toc': toc
    }
    print(json.dumps(result, indent=2))

def main():
    parser = argparse.ArgumentParser(description="Selective Reader - TOC Extractor for Large Files")
    parser.add_argument("filepath", help="Path to file to analyze")
    parser.add_argument("--json", action="store_true", help="Output as JSON (machine-readable)")
    args = parser.parse_args()

    filepath = args.filepath

    if not os.path.exists(filepath):
        if args.json:
            print(json.dumps({'status': 'ERROR', 'message': f'File not found: {filepath}'}))
        else:
            print(f"[FAIL] File not found: {filepath}")
        sys.exit(1)

    if os.path.getsize(filepath) > MAX_FILE_SIZE:
        if args.json:
            print(json.dumps({'status': 'ERROR', 'message': f'File too large (>500KB): {filepath}'}))
        else:
            print(f"[FAIL] File too large (>500KB): {filepath}")
        sys.exit(1)

    project_root = get_project_root(filepath)
    cache_file = os.path.join(project_root, '.agents', 'session_cache.json')
    cache_data = load_cache(cache_file)

    file_mtime = str(os.path.getmtime(filepath))
    try:
        reader_hash = hashlib.md5(open(__file__, 'rb').read()).hexdigest()
    except Exception:
        reader_hash = "unknown"
    cache_key = f"reader_{hashlib.md5((filepath + reader_hash).encode()).hexdigest()}"

    if cache_key in cache_data:
        cached_entry = cache_data[cache_key]
        if cached_entry.get('mtime') == file_mtime and cached_entry.get('file') == filepath:
            print("[INFO] Menggunakan hasil cache dari session_cache.json (file belum berubah)")
            toc = cached_entry['toc']
            if args.json:
                print_json(filepath, toc, file_mtime)
            else:
                print_human(filepath, toc)
            sys.exit(0)

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        if args.json:
            print(json.dumps({'status': 'ERROR', 'message': f'Failed to read file: {e}'}))
        else:
            print(f"[FAIL] Failed to read file: {e}")
        sys.exit(1)

    if filepath.endswith('.py'):
        toc = parse_py(content)
    else:
        toc = parse_js(content)

    cache_data[cache_key] = {
        'file': filepath,
        'mtime': file_mtime,
        'toc': toc
    }
    save_cache(cache_file, cache_data)

    if args.json:
        print_json(filepath, toc, file_mtime)
    else:
        print_human(filepath, toc)

if __name__ == '__main__':
    main()
