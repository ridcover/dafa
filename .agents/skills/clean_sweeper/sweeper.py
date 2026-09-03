import os
import re
import sys
import json
import hashlib
import argparse

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

MAX_FILE_SIZE = 500 * 1024
ignore_dirs = {'node_modules', '.git', 'build', 'dist', 'uploads', 'public', '.vscode', '.history', 'quarantine', '.native_browser', '.exambro_android', '.plan', '.skills', '.backup_replace', '.agents', '.dart_tool', '.gradle', '.pub-cache', 'Pods'}

def clean_cache(cache_data):
    """Remove entries where scanned folder no longer exists or too old."""
    import time
    MAX_AGE_DAYS = 7
    before = len(cache_data)
    now = time.time()
    removed = []
    for key, entry in list(cache_data.items()):
        target = entry.get('target', '')
        mtime = entry.get('mtime', 0)
        if target and not os.path.exists(target):
            removed.append(key)
        elif mtime and float(mtime) > 0:
            age_days = (now - float(mtime)) / 86400
            if age_days > MAX_AGE_DAYS:
                removed.append(key)
    for k in removed:
        del cache_data[k]
    return len(removed)

def get_dir_signature(target):
    mtimes = []
    for root, dirs, files in os.walk(target):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        for f in files:
            filepath = os.path.join(root, f)
            try:
                if os.path.getsize(filepath) <= MAX_FILE_SIZE:
                    mtimes.append(str(os.path.getmtime(filepath)))
            except Exception:
                pass
    try:
        tool_hash = hashlib.md5(open(__file__, 'rb').read()).hexdigest()
        mtimes.append(f"tool_hash:{tool_hash}")
    except Exception:
        pass
    return hashlib.md5("".join(sorted(mtimes)).encode()).hexdigest()

def sweep(target):
    residue_files = []
    todo_count = 0
    comment_blocks = []
    scanned_files = 0
    skipped_files = {'too_large': 0, 'unsupported_ext': 0}

    for root, dirs, files in os.walk(target):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]

        for d in dirs:
            if d.lower() in ['aa', 'arsip', 'temp', 'backup', 'old', 'scratch']:
                residue_files.append({
                    'path': os.path.join(root, d),
                    'type': 'backup_folder',
                    'description': 'Suspected Backup/Temp Folder'
                })

        for f in files:
            filepath = os.path.join(root, f)
            try:
                if os.path.getsize(filepath) > MAX_FILE_SIZE:
                    skipped_files['too_large'] += 1
                    continue
            except Exception:
                continue

            f_lower = f.lower()
            if not f_lower.endswith(('.js', '.jsx', '.php', '.html', '.py', '.bak', '.old', '.log', '.db', '.sqlite', '.tmp')) and f != 'database.db' and not re.search(r'(?<=[_\- /])copy(?=[_\-. /])', f_lower, re.IGNORECASE):
                skipped_files['unsupported_ext'] += 1
                continue

            scanned_files += 1

            if f_lower.endswith(('.bak', '.old', '.log', '.db', '.sqlite', '.tmp')) or re.search(r'(?<=[_\- /])copy(?=[_\-. /])', f_lower, re.IGNORECASE):
                if f_lower not in ['database.db'] and not f_lower.endswith('.test.js'):
                    residue_files.append({
                        'path': filepath,
                        'type': 'leftover_file',
                        'description': 'Suspected Leftover File'
                    })

            if f == 'database.db' and root == target:
                residue_files.append({
                    'path': filepath,
                    'type': 'local_sqlite',
                    'description': 'Local SQLite DB in MySQL project'
                })

            if f_lower.endswith(('.js', '.jsx', '.php', '.html', '.py')):
                try:
                    with open(filepath, 'r', encoding='utf-8') as file:
                        content = file.read()
                        todos = re.findall(r'(?i)\b(TODO|FIXME)\b', content)
                        todo_count += len(todos)

                        lines = content.split('\n')
                        consecutive_comments = 0
                        for i, line in enumerate(lines):
                            if line.strip().startswith(('//', '#')):
                                consecutive_comments += 1
                            else:
                                if consecutive_comments >= 7:
                                    comment_blocks.append({
                                        'path': filepath,
                                        'start_line': i - consecutive_comments + 1,
                                        'end_line': i,
                                        'count': consecutive_comments,
                                        'description': 'Large commented block'
                                    })
                                consecutive_comments = 0
                except Exception:
                    pass

    return residue_files, todo_count, comment_blocks, scanned_files, skipped_files

def print_human(residue_files, todo_count, comment_blocks, scanned_files, skipped_files, from_cache=False, max_display=10, base_dir=None):
    print("CLEAN SWEEPER REPORT")
    print("=" * 50)

    base = base_dir or os.getcwd()

    def get_rel(p):
        try:
            return os.path.relpath(p, base)
        except Exception:
            return p

    if residue_files:
        limit = max_display
        for r in residue_files[:limit]:
            rel = get_rel(r['path'])
            print(f"[FAIL] {rel} [{r['description']}]")
        if len(residue_files) > limit:
            sisa = len(residue_files) - limit
            print(f"... dan {sisa} lainnya")

    if todo_count > 0:
        print(f"[WARN] Found {todo_count} TODO/FIXME tags in the code.")

    if comment_blocks:
        limit = max_display
        for c in comment_blocks[:limit]:
            rel = get_rel(c['path'])
            print(f"[WARN] {rel} (Lines {c['start_line']}-{c['end_line']}): {c['count']} consecutive commented lines")
        if len(comment_blocks) > limit:
            sisa = len(comment_blocks) - limit
            print(f"... dan {sisa} lainnya")

    print("\n" + "=" * 50)
    
    total_skipped = skipped_files['too_large'] + skipped_files['unsupported_ext']
    if total_skipped > 0:
        print(f"[INFO] Dilewati: {total_skipped} file ({skipped_files['too_large']} terlalu besar, {skipped_files['unsupported_ext']} ekstensi tidak dipindai)")

    total_issues = len(residue_files) + (1 if todo_count > 0 else 0) + len(comment_blocks)
    if total_issues == 0:
        print(f"[OK] Proyek bersih! {scanned_files} file dipindai tanpa ada temuan residu.")
    else:
        print(f"[OK] Selesai memindai {scanned_files} file.")
        print("\n💡 PROMPT:")
        print('"Periksa temuan [FAIL] dan hapus file residu HANYA jika Anda yakin file tersebut tidak diperlukan lagi. Ingat bahwa pindaian ini hanya sebagian, file yang dilewati tidak termasuk di sini. Untuk [WARN], periksa apakah komentar/tag bisa dihapus."')

    if from_cache:
        print("\n[INFO] Hasil di atas diambil dari cache (session_cache.json). Gunakan --no-cache untuk memindai ulang.")

def print_json(residue_files, todo_count, comment_blocks, scanned_files, skipped_files, from_cache=False):
    result = {
        'status': 'CLEAN' if len(residue_files) == 0 and todo_count == 0 and len(comment_blocks) == 0 else 'NEEDS_CLEANUP',
        'stats': {
            'scanned_files': scanned_files,
            'residue_files': len(residue_files),
            'todo_count': todo_count,
            'large_comment_blocks': len(comment_blocks),
            'total_issues': len(residue_files) + (1 if todo_count > 0 else 0) + len(comment_blocks)
        },
        'issues': {
            'residue_files': residue_files,
            'todo_tags': todo_count,
            'large_comment_blocks': comment_blocks
        }
    }
    print(json.dumps(result, indent=2))

def main():
    parser = argparse.ArgumentParser(description="Clean Sweeper - Project Health Scanner")
    parser.add_argument("target", help="Target directory to scan")
    parser.add_argument("--json", action="store_true", help="Output as JSON (machine-readable)")
    parser.add_argument("--no-cache", action="store_true", help="Paksa pemindaian ulang tanpa membaca cache")
    args = parser.parse_args()

    target = os.path.abspath(args.target)
    cache_file = os.path.join(target, '.agents', 'session_cache.json')
    dir_sig = get_dir_signature(target)
    cache_key = f"sweeper_{hashlib.md5(target.encode()).hexdigest()}"

    cache_data = {}
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
        except: pass

    clean_cache(cache_data)
    from_cache = False
    if not args.no_cache and cache_key in cache_data and cache_data[cache_key].get('signature') == dir_sig:
        from_cache = True
        print("[INFO] Menggunakan hasil cache dari session_cache.json (tidak ada file yang berubah)")
        cached = cache_data[cache_key]
        residue_files = cached['residue_files']
        todo_count = cached['todo_count']
        comment_blocks = cached['comment_blocks']
        scanned_files = cached['scanned_files']
        skipped_files = cached.get('skipped_files', {'too_large': 0, 'unsupported_ext': 0})
    else:
        residue_files, todo_count, comment_blocks, scanned_files, skipped_files = sweep(target)
        cache_data[cache_key] = {
            'signature': dir_sig,
            'residue_files': residue_files,
            'todo_count': todo_count,
            'comment_blocks': comment_blocks,
            'scanned_files': scanned_files,
            'skipped_files': skipped_files
        }
        try:
            os.makedirs(os.path.dirname(cache_file), exist_ok=True)
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, indent=2)
        except: pass

    if args.json:
        print_json(residue_files, todo_count, comment_blocks, scanned_files, skipped_files, from_cache=from_cache)
    else:
        print_human(residue_files, todo_count, comment_blocks, scanned_files, skipped_files, from_cache=from_cache, base_dir=target)

if __name__ == "__main__":
    main()
