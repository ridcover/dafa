import os
import sys
import argparse
import json
import hashlib
import time
import ast
import re

# Ensure UTF-8 stdout on Windows (guards against UnicodeEncodeError on emoji/non-ASCII)
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass  # Some streams don't support reconfigure

MAX_FILE_SIZE = 500 * 1024
MAX_AGE_DAYS = 7
# Jenis berkas yang bukan kode. Dilewati sebelum dibuka, bukan sesudah gagal
# dibaca. Di proyek dengan folder unggahan, ini bedanya 21 detik dan 1144 baris
# keluaran melawan pencarian yang selesai seketika.
NON_CODE_EXTS = {
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff', '.avif',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.gz', '.tar', '.rar', '.7z', '.bz2', '.xz',
    '.mp3', '.mp4', '.avi', '.mov', '.mkv', '.wav', '.ogg', '.webm',
    '.woff', '.woff2', '.ttf', '.otf', '.eot',
    '.exe', '.dll', '.so', '.dylib', '.bin', '.pyc', '.class', '.jar',
    '.db', '.sqlite', '.sqlite3', '.mdb', '.lock',
    '.psd', '.ai', '.sketch', '.fig', '.blend',
}

DEFAULT_EXCLUDES = {'node_modules', '.git', 'vendor', 'build', 'dist', '.idea', '.vscode', '.history', '.backup_replace', '.agents', '.dart_tool', '.gradle', '.pub-cache', 'Pods'}

JS_PATTERNS = [
    r'(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(',
    r'(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>',
    r'class\s+\w+',
]

def get_python_ranges(content):
    try:
        tree = ast.parse(content)
        ranges = {}
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                ranges[node.name] = (node.lineno, node.end_lineno)
        return ranges, None
    except SyntaxError:
        return {}, 'error'

def find_js_line(content, keyword):
    """
    Find the line number where a JS function/class with the keyword starts.
    Uses simple state machine to skip strings and comments.
    """
    lines = content.split('\n')
    for i, line in enumerate(lines):
        # Parse line character by character to handle strings/comments
        j = 0
        in_string = None  # None, '"', or "'"
        while j < len(line):
            ch = line[j]
            # Skip escaped characters
            if j > 0 and line[j-1] == '\\':
                j += 1
                continue
            # Handle string delimiters
            if ch == '"' or ch == "'":
                if in_string == ch:
                    in_string = None
                elif in_string is None:
                    in_string = ch
                j += 1
                continue
            # If we're in a string, just continue
            if in_string is not None:
                j += 1
                continue
            # Skip line comments
            if ch == '/' and j + 1 < len(line) and line[j+1] == '/':
                break  # Rest of line is comment
            # Check if keyword is present (before any comment)
            if keyword in line[:j]:
                # We found keyword before any comment, now check for JS pattern
                code_part = line[:j]
                for pat in JS_PATTERNS:
                    if re.search(pat, code_part):
                        return i
            j += 1
    return None

def extract_js_body(content, start_idx):
    """
    Extract function/class body using brace-counting state machine.

    BAIL-OUT STRATEGY:
    - Returns None immediately when encountering:
      - Backtick (`) - template literal (can't track ${} interpolation safely)
      - Forward slash (/) in ambiguous context - can't distinguish from regex/division
    - Falls back to line-context behavior in caller.

    PAREN-DEPTH TRACKING:
    - Tracks paren depth ( ) alongside brace depth
    - Only starts counting braces toward function-body depth AFTER
      the parameter list's parentheses have fully closed (paren_depth = 0)
    - This correctly handles destructured params like function({ items }) { }
    """
    lines = content.split('\n')
    depth = 0          # Brace depth (for function body)
    paren_depth = 0    # Paren depth (for parameter list)
    body_started = False  # Set to True after first ')' closes param list
    found = False
    i = start_idx
    while True:
        if i >= len(lines):
            return None  # EOF with depth > 0
        line = lines[i]
        j = 0
        in_string = None  # None, '"', or "'"
        while j < len(line):
            ch = line[j]

            # Handle escape characters INSIDE strings only
            if in_string and j > 0 and line[j-1] == '\\':
                j += 1
                continue

            # Handle string delimiters
            if ch == '"' or ch == "'":
                if in_string == ch:
                    in_string = None
                elif in_string is None:
                    in_string = ch
                j += 1
                continue

            # Skip rest of line if in string
            if in_string is not None:
                j += 1
                continue

            # Handle comments FIRST (before slash bail-out)
            if ch == '/':
                if j + 1 < len(line) and line[j+1] == '/':
                    # Line comment - safe, skip to end of line
                    break
                elif j + 1 < len(line) and line[j+1] == '*':
                    # Block comment - safe, skip the block
                    end = line.find('*/', j+2)
                    if end >= 0:
                        lines[i] = line[:j] + line[end+2:]
                        # After splicing, break to next line to avoid
                        # reprocessing the remaining '/' from '/*'
                        break
                    else:
                        i += 1
                        while i < len(lines):
                            end = lines[i].find('*/')
                            if end >= 0:
                                lines[i] = lines[i][end+2:]
                                break
                            i += 1
                        else:
                            return None
                        # After processing multi-line block comment, move to next line
                        break
                else:
                    # Ambiguous slash - could be regex or division
                    return None  # BAIL-OUT

            # BAIL-OUT: Template literal start
            if ch == '`':
                return None  # Template literal - can't track safely

            # Track parentheses first (before braces)
            if ch == '(':
                paren_depth += 1
            elif ch == ')':
                paren_depth -= 1
                if paren_depth == 0 and not body_started:
                    # First closing paren after opening - param list is done
                    body_started = True

            # Track braces (only after param list is closed)
            if ch == '{':
                if body_started:
                    depth += 1
                    found = True
            elif ch == '}':
                if body_started:
                    depth -= 1
                    if depth < 0:
                        return None  # Excess closing brace
                    if depth == 0 and found:
                        return (start_idx, i)
            j += 1
        i += 1
    return None

def search_files(directory, keyword, extensions):
    results = []
    scanned = 0
    skipped_files = []
    non_code = 0
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in DEFAULT_EXCLUDES]
        for fname in files:
            if extensions and not any(fname.endswith(ext) for ext in extensions):
                continue
            if os.path.splitext(fname)[1].lower() in NON_CODE_EXTS:
                non_code += 1
                continue
            fpath = os.path.join(root, fname)
            if os.path.getsize(fpath) > MAX_FILE_SIZE:
                skipped_files.append(fpath)
                continue
            scanned += 1
            try:
                with open(fpath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.splitlines(keepends=True)
            except:
                skipped_files.append(fpath)
                scanned -= 1
                continue
            if fpath.endswith('.py'):
                rngs, err = get_python_ranges(content)
                if err is None and keyword in rngs:
                    s, e = rngs[keyword]
                    results.append({
                        'file': fpath,
                        'blocks': [{'start': s-1, 'end': e, 'matches': [s-1]}],
                        'lines': lines
                    })
                    continue
            if fpath.endswith(('.js', '.jsx', '.ts', '.tsx')):
                idx = find_js_line(content, keyword)
                if idx is not None:
                    body = extract_js_body(content, idx)
                    if body:
                        s, e = body
                        results.append({
                            'file': fpath,
                            'blocks': [{'start': s, 'end': e, 'matches': [s]}],
                            'lines': lines
                        })
                        continue
                    else:
                        # Bail-out: template literal or ambiguous slash detected
                        # Fall through to line-context below
                        pass
            matches = []
            for i, line in enumerate(lines):
                if keyword in line:
                    matches.append(i)
            if matches:
                ctx = 5
                blocks = []
                cur = None
                for m in matches:
                    s = max(0, m - ctx)
                    e = min(len(lines), m + ctx + 1)
                    if cur and s <= cur['end']:
                        cur['end'] = max(cur['end'], e)
                        cur['matches'].append(m)
                    else:
                        if cur:
                            blocks.append(cur)
                        cur = {'start': s, 'end': e, 'matches': [m]}
                if cur:
                    blocks.append(cur)
                results.append({'file': fpath, 'blocks': blocks, 'lines': lines})
    return results, scanned, skipped_files, non_code

def get_project_root(start_path):
    curr = os.path.abspath(start_path)
    while True:
        if os.path.exists(os.path.join(curr, 'package.json')) or os.path.exists(os.path.join(curr, '.git')):
            return curr
        parent = os.path.dirname(curr)
        if parent == curr:
            return os.path.abspath(start_path)
        curr = parent

def load_cache(f):
    if os.path.exists(f):
        try:
            with open(f, 'r', encoding='utf-8') as fp:
                return json.load(fp)
        except:
            pass
    return {}

def clean_cache(data, root):
    cleaned = []
    now = time.time()
    for k, v in list(data.items()):
        if 'results' not in v:
            continue
        res = v.get('results', [])
        if not res:
            cleaned.append(k)
            continue
        if not os.path.exists(res[0].get('file', '')):
            cleaned.append(k)
            continue
        mt = v.get('mtime', 0)
        if mt and float(mt) > 0:
            if (now - float(mt)) / 86400 > MAX_AGE_DAYS:
                cleaned.append(k)
    for k in cleaned:
        del data[k]
    return len(cleaned), len(data)

def save_cache(f, data):
    try:
        d = os.path.dirname(f)
        if d:
            os.makedirs(d, exist_ok=True)
        with open(f, 'w', encoding='utf-8') as fp:
            json.dump(data, fp, indent=2)
    except:
        pass

def get_dir_sig(directory, exts):
    parts = []
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in DEFAULT_EXCLUDES]
        for f in files:
            if exts and not any(f.endswith(e) for e in exts):
                continue
            fp = os.path.join(root, f)
            try:
                if os.path.getsize(fp) <= MAX_FILE_SIZE:
                    rel = os.path.relpath(fp, directory).replace(os.sep, '/')
                    parts.append(f"{rel}:{os.path.getsize(fp)}")
            except:
                pass
    try:
        tool_hash = hashlib.md5(open(__file__, 'rb').read()).hexdigest()
        parts.append(f"tool_hash:{tool_hash}")
    except Exception:
        pass
    return hashlib.md5("".join(sorted(parts)).encode()).hexdigest()

def print_human(results, kw, scanned, skipped_files, non_code=0):
    total = 0
    for r in results:
        rel = os.path.relpath(r['file'], os.getcwd())
        print(f"\n[WARN] Found in: {rel}")
        print("-" * 60)
        for block in r['blocks']:
            for i in range(block['start'], block['end'] + 1):
                ln = r['lines'][i].rstrip() if i < len(r['lines']) else ''
                pref = ">>" if i in block['matches'] else "  "
                print(f"{i+1:5d} | {pref} {ln}")
                if i in block['matches']:
                    total += 1
            print("-" * 30)
    print("\n" + "=" * 60)
    print(f"[OK] Selesai: {total} kecocokan di {len(results)} file (dari {scanned} dipindai, {len(skipped_files)} dilewati)")
    if non_code:
        print(f"[INFO] {non_code} berkas bukan-kode dilewati (gambar, arsip, biner).")
    if skipped_files:
        print(f"[WARN] {len(skipped_files)} berkas teks dilewati (terlalu besar atau bukan UTF-8):")
        for sf in skipped_files[:5]:
            print(f"  - {sf}")
        if len(skipped_files) > 5:
            print(f"  ... dan {len(skipped_files) - 5} lainnya")

def print_json(results, kw, scanned, skipped_files, non_code=0):
    out = {'status': 'FOUND' if results else 'NOT_FOUND', 'keyword': kw, 'stats': {'total': sum(len(b['matches']) for r in results for b in r['blocks']), 'files': len(results), 'scanned': scanned, 'skipped': len(skipped_files)}, 'results': []}
    for r in results:
        rel = os.path.relpath(r['file'], os.getcwd())
        fr = {'file': rel, 'absolute': r['file'], 'matches': []}
        for block in r['blocks']:
            for i in range(block['start'], block['end'] + 1):
                ln = r['lines'][i].rstrip() if i < len(r['lines']) else ''
                ism = i in block['matches']
                fr['matches'].append({'line': i+1, 'content': ln, 'match': ism})
                if ism:
                    out['stats']['total'] += 1
        out['results'].append(fr)
    print(json.dumps(out, indent=2))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target")
    ap.add_argument("keyword")
    ap.add_argument("--ext", default="")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    exts = [e.strip() for e in args.ext.split(",")] if args.ext else []
    root = get_project_root(args.target)
    cf = os.path.join(root, '.agents', 'session_cache.json')
    data = load_cache(cf)
    clean_cache(data, root)
    save_cache(cf, data)
    sig = get_dir_sig(args.target, exts)
    key = f"search_{hashlib.md5((args.target + args.keyword + ''.join(exts)).encode()).hexdigest()}"
    if key in data and data[key].get('sig') == sig:
        print("[INFO] Cache hit")
        results = data[key]['results']
        scanned = data[key]['scanned']
        skipped_files = data[key].get('skipped_files', [])
        non_code = data[key].get('non_code', 0)
    else:
        results, scanned, skipped_files, non_code = search_files(args.target, args.keyword, exts)
        data[key] = {'sig': sig, 'mtime': str(time.time()), 'results': results, 'scanned': scanned, 'skipped_files': skipped_files, 'non_code': non_code}
        save_cache(cf, data)
    if not results:
        if args.json:
            print(json.dumps({'status': 'NOT_FOUND', 'keyword': args.keyword, 'stats': {'scanned': scanned, 'skipped': len(skipped_files)}}))
        else:
            print(f"[OK] Keyword '{args.keyword}' not found in {scanned} files (skipped {len(skipped_files)} files)")
            if non_code:
                print(f"[INFO] {non_code} berkas bukan-kode dilewati (gambar, arsip, biner).")
            if skipped_files:
                print(f"[WARN] {len(skipped_files)} berkas teks dilewati (terlalu besar atau bukan UTF-8):")
                for sf in skipped_files[:5]:
                    print(f"  - {sf}")
                if len(skipped_files) > 5:
                    print(f"  ... dan {len(skipped_files) - 5} lainnya")
        return
    if args.json:
        print_json(results, args.keyword, scanned, skipped_files, non_code)
    else:
        print(f"SEARCH: '{args.keyword}'")
        print("=" * 60)
        print_human(results, args.keyword, scanned, skipped_files, non_code)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        print(f"[ERROR] {type(e).__name__}: {e}")
        traceback.print_exc()
        sys.exit(1)
