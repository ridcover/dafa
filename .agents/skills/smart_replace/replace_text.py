import os
import sys
import argparse
import re
import shutil
import subprocess
import tempfile
import ast
import difflib
import json
import fnmatch
from datetime import datetime
from pathlib import Path

_WARNED_LIGHT_MODE_PATHS = set()

def is_light_mode(start_dir=None):
    """Memeriksa apakah mode ringan aktif via berkas penanda .agents/mode_ringan.json."""
    if start_dir is None:
        start_dir = os.getcwd()
    current_dir = os.path.abspath(start_dir)
    while True:
        agents_dir = os.path.join(current_dir, '.agents')
        if os.path.isdir(agents_dir):
            marker_path = os.path.join(agents_dir, 'mode_ringan.json')
            if os.path.exists(marker_path):
                try:
                    with open(marker_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    if isinstance(data, dict) and data.get('mode_ringan') is True:
                        return True
                    else:
                        print(f"[WARN] Berkas {marker_path} ditemukan tetapi isinya tidak dikenali (diharapkan {{\"mode_ringan\": true}}). Mode ringan dimatikan.")
                        return False
                except Exception as e:
                    if marker_path not in _WARNED_LIGHT_MODE_PATHS:
                        print(f"[WARN] Berkas {marker_path} ditemukan tetapi format JSON tidak valid ({e}). Mode ringan dimatikan.")
                        _WARNED_LIGHT_MODE_PATHS.add(marker_path)
                    return False
            return False
        parent = os.path.dirname(current_dir)
        if parent == current_dir:
            break
        current_dir = parent
    return False
# Force UTF-8 encoding for Windows terminal
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

DEFAULT_EXCLUDES = {'.git', 'node_modules', '.history', 'vendor', 'dist', 'build', 'quarantine', '.backup_replace', '.agents', '.dart_tool', '.gradle', '.pub-cache', 'Pods'}
MAX_FILE_SIZE = 500 * 1024 # 500 KB

def check_task_state(is_apply=False):
    if is_apply:
        root_dir = os.getcwd()
        paths = [
            os.path.join(root_dir, '.here_we_are', 'role.json'),
            os.path.join(root_dir, '.agents', 'chamber', 'role.json')
        ]
        for p in paths:
            if os.path.exists(p):
                role_data = None
                with open(p, 'rb') as f:
                    raw_bytes = f.read()
                
                err_msg = ""
                for enc in ['utf-8-sig', 'utf-16']:
                    try:
                        role_data = json.loads(raw_bytes.decode(enc))
                        break
                    except Exception as e:
                        err_msg = str(e)
                        
                if role_data is None:
                    print(f"[BLOCKED] Role lock file ada tetapi gagal dibaca (mungkin format rusak atau encoding salah): {err_msg}")
                    sys.exit(1)
                    
                if role_data.get('role') == 'QA':
                    print("[BLOCKED] Akses tulis (--apply) ditolak untuk role QA.")
                    sys.exit(1)

    state_file = os.path.join(os.getcwd(), '.agents', 'task_state.json')
    if not os.path.exists(state_file):
        return
        
    try:
        with open(state_file, 'r', encoding='utf-8') as f:
            state = json.load(f)
    except Exception as e:
        print(f"[BLOCKED] Gagal membaca state file: {e}")
        sys.exit(1)
        
    if state.get('phase') == 'pseudocode_pending':
        print("[BLOCKED] Pseudocode untuk task ini belum disetujui user.")
        print(f"Task: {state.get('task', 'Unknown')}")
        print("Minta user approve pseudocode dulu sebelum --apply bisa dijalankan.")
        sys.exit(1)

def check_scope(pending_writes, light_mode=False):
    """Delegate scope check to scope_guardian.scripts.scope_check."""
    skills_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if skills_dir not in sys.path:
        sys.path.insert(0, skills_dir)
        
    try:
        from scope_guardian.scripts.scope_check import check_scope as external_check_scope
    except ImportError:
        print("[BLOCKED] Failed to import check_scope from scope_guardian")
        print("Pastikan skill scope_guardian terpasang di sebelah smart_replace.")
        sys.exit(1)
        
    for filepath, _, _ in pending_writes:
        external_check_scope(filepath, light_mode=light_mode)

def find_project_root(start_path):
    # Kalau target berupa berkas, naik ke direktorinya dulu — termasuk pada
    # kedua jalur kembali di bawah. Tanpa ini, backup_dir menjadi
    # "<berkas>/.backup_replace" dan SETIAP --apply pada target berkas-tunggal
    # jatuh dengan FileNotFoundError saat mencadangkan, tanpa pesan di stdout.
    awal = os.path.abspath(start_path)
    if os.path.isfile(awal):
        awal = os.path.dirname(awal)
    current = awal
    start_drive = os.path.splitdrive(current)[0]
    while True:
        if os.path.exists(os.path.join(current, 'package.json')) or os.path.exists(os.path.join(current, '.git')):
            return current
        parent = os.path.dirname(current)
        if parent == current:
            return awal
        current_drive = os.path.splitdrive(parent)[0]
        if current_drive != start_drive:
            return awal
        current = parent

def validate_syntax(filepath, content):
    ext = os.path.splitext(filepath)[1].lower()
    
    if ext == '.py':
        try:
            ast.parse(content)
            return True, None
        except SyntaxError as e:
            return False, f"Python Syntax Error: {e.msg} at line {e.lineno}"
            
    elif ext in ['.js', '.jsx', '.ts', '.tsx']:
        def check_brackets(text):
            stack = []
            pairs = {')': '(', '}': '{', ']': '['}
            lines = text.split('\n')
            for i, line in enumerate(lines):
                for char in line:
                    if char in '({[':
                        stack.append((char, i+1))
                    elif char in ')}]':
                        if not stack:
                            return False, f"Unmatched closing bracket '{char}' at line {i+1}"
                        top_char, _ = stack.pop()
                        if top_char != pairs[char]:
                            return False, f"Mismatched bracket '{char}' at line {i+1}, expected closing for '{top_char}'"
            if stack:
                top_char, line = stack.pop()
                return False, f"Unclosed bracket '{top_char}' opened at line {line}"
            return True, None

        # Jangan impor os di sini: itu membuat os jadi variabel lokal untuk
        # seluruh fungsi, sehingga baris ext = os.path.splitext(...) di atas
        # jatuh dengan UnboundLocalError sebelum sampai ke sini.

        if not hasattr(validate_syntax, '_linter_state'):
            # Baris ini diamati oleh test_smart_replace_apply.py untuk memastikan
            # probing hanya terjadi satu kali per proses.
            print("[DEBUG] Melakukan probe linter lokal/npx...")
            linter_available = False
            linter_cmd = []
            
            # 1. Periksa scripts.lint di package.json
            pkg_path = os.path.join(os.getcwd(), 'package.json')
            if os.path.exists(pkg_path):
                try:
                    with open(pkg_path, 'r', encoding='utf-8') as pf:
                        pkg_json = json.load(pf)
                    if isinstance(pkg_json, dict) and 'scripts' in pkg_json and 'lint' in pkg_json['scripts']:
                        npm_bin = 'npm.cmd' if sys.platform == 'win32' else 'npm'
                        if shutil.which(npm_bin) or shutil.which('npm'):
                            linter_available = True
                            linter_cmd = [npm_bin, 'run', 'lint', '--']
                except Exception:
                    pass

            # 2. Prioritaskan linter lokal
            if not linter_available:
                local_eslint = os.path.join(os.getcwd(), 'node_modules', '.bin', 'eslint')
                if sys.platform == 'win32':
                    local_eslint += '.cmd'
                    
                if os.path.exists(local_eslint):
                    try:
                        if subprocess.run([local_eslint, '-v'], capture_output=True).returncode == 0:
                            linter_available = True
                            linter_cmd = [local_eslint, '--quiet']
                    except Exception:
                        pass
            
            # 3. Fallback ke npx jika lokal tidak ditemukan
            if not linter_available:
                try:
                    if subprocess.run(['npx', 'eslint', '-v'], capture_output=True, shell=True).returncode == 0:
                        linter_available = True
                        linter_cmd = ['npx', 'eslint', '--quiet']
                    elif subprocess.run(['npx', 'tsc', '-v'], capture_output=True, shell=True).returncode == 0:
                        linter_available = True
                        linter_cmd = ['npx', 'tsc', '--noEmit']
                except Exception:
                    pass
                    
            validate_syntax._linter_state = (linter_available, linter_cmd)
            
        linter_available, linter_cmd = validate_syntax._linter_state
            
        if linter_available:
            # Tulis berkas sementara di direktori yang sama dengan aslinya. ESLint dan
            # tsc mencari konfigurasi relatif terhadap berkas yang diperiksa; berkas di
            # %TEMP% tidak akan pernah menemukan konfigurasi project.
            induk = os.path.dirname(os.path.abspath(filepath)) or '.'
            temp_path = os.path.join(induk, f".snowline_periksa_{os.getpid()}{ext}")

            try:
                with open(temp_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                # Need shell=True on Windows for npx
                cmd = linter_cmd + [temp_path]
                if sys.platform == 'win32':
                    cmd_str = subprocess.list2cmdline(cmd)
                else:
                    import shlex
                    cmd_str = shlex.join(cmd)
                result = subprocess.run(cmd_str, capture_output=True, text=True, shell=True)
                keluaran = f"{result.stdout.strip()}\n{result.stderr.strip()}".strip()

                if result.returncode != 0:
                    # Linter yang gagal karena konfigurasi tidak sedang menilai kode.
                    # Memperlakukannya sebagai galat sintaks akan memblokir setiap
                    # --apply di project yang tidak memasang ESLint/tsc.
                    tanda_konfigurasi = (
                        'configuration file', 'eslint.config', 'eslintrc',
                        'migration-guide', 'no eslint configuration',
                        'failed to load config', 'cannot read config',
                        'tsconfig', 'ts5057', 'ts5058',
                    )
                    rendah = keluaran.lower()
                    if any(t in rendah for t in tanda_konfigurasi):
                        is_valid, err = check_brackets(content)
                        if not is_valid:
                            return False, err
                        return True, ("[WARN] Linter tidak terkonfigurasi di project ini; "
                                      "validasi turun ke bracket-balancing dasar.")
                    return False, f"Linter Syntax Error:\n{keluaran}"
                return True, None
            except Exception as e:
                return False, f"Failed to run linter: {e}"
            finally:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
        else:
            is_valid, err = check_brackets(content)
            if not is_valid:
                return False, err
            return True, "[WARN] Validasi menggunakan bracket-balancing dasar (Linter scripts.lint/ESLint/TSC tidak ditemukan, validasi dangkal)."
            
    return True, "[WARN] Tipe file tidak dikenali untuk validasi syntax, pengecekan dilewati."

def check_frontend_build(timeout_sec=None):
    """
    Memeriksa hasil build frontend jika proyek mendefinisikan scripts.build di package.json.
    Melaporkan hasil build (bukan memblokir penulisan berkas).
    """
    if timeout_sec is None:
        timeout_sec = int(os.environ.get('SNOWLINE_BUILD_TIMEOUT', 60))

    pkg_path = os.path.join(os.getcwd(), 'package.json')
    if not os.path.exists(pkg_path):
        print("[INFO] package.json tidak ditemukan, pemeriksaan build frontend dilewati.")
        return

    try:
        with open(pkg_path, 'r', encoding='utf-8') as f:
            pkg_data = json.load(f)
    except Exception:
        print("[INFO] package.json tidak dapat dibaca, pemeriksaan build frontend dilewati.")
        return

    scripts = pkg_data.get('scripts')
    if not isinstance(scripts, dict) or 'build' not in scripts:
        print("[INFO] scripts.build tidak ditemukan di package.json, pemeriksaan build frontend dilewati.")
        return

    npm_bin = 'npm.cmd' if sys.platform == 'win32' else 'npm'
    if not shutil.which(npm_bin) and not shutil.which('npm'):
        npm_bin = 'npm'

    print("[INFO] Menjalankan pemeriksaan build frontend (npm run build)...")
    cmd = [npm_bin, 'run', 'build']
    try:
        res = subprocess.run(
            cmd,
            shell=(sys.platform == 'win32'),
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            stdin=subprocess.DEVNULL,
            encoding='utf-8',
            errors='replace'
        )
        if res.returncode == 0:
            print("[BUILD SUCCESS] Pemeriksaan build frontend berhasil (npm run build lulus).")
        else:
            print("[BUILD FAIL] Pemeriksaan build frontend gagal (npm run build mengembalikan error).")
            detail = (res.stderr.strip() or res.stdout.strip())
            if detail:
                print(f"Detail keluaran build:\n{detail[:400]}")
    except subprocess.TimeoutExpired:
        print(f"[BUILD TIMEOUT] Pemeriksaan build frontend dihentikan karena memakan waktu lebih dari 60 detik.")
    except Exception as e:
        print(f"[BUILD ERROR] Gagal menjalankan pemeriksaan build: {e}")

def get_args():
    parser = argparse.ArgumentParser(description="Smart Replace (Pure Python Edition)")
    parser.add_argument("target_dir", help="Target directory or file (absolute path)")
    parser.add_argument("search_string", help="String or pattern to search for")
    parser.add_argument("replace_string", nargs="?", default="", help="String to replace with (or empty if using --replacement-file)")
    parser.add_argument("--search-file", help="Path to file containing search text", default=None)
    parser.add_argument("--replacement-file", help="Path to file containing replacement text", default=None)
    parser.add_argument("--with-build", action="store_true", help="Jalankan pemeriksaan build frontend (npm run build) sesudah menulis berkas")
    parser.add_argument("--ext", help="Comma-separated extensions to include (e.g. .js,.jsx)", default="")
    parser.add_argument("--regex", action="store_true", help="Treat search_string as a regular expression")
    parser.add_argument("--fuzzy", action="store_true", help="Allow flexible whitespace/newlines matching (opt-in)")
    parser.add_argument("--whole-word", action="store_true", help="Match whole words only (now the default)")
    parser.add_argument("--allow-partial-match", action="store_true", help="Allow partial/substring matching (disables word-boundary default)")
    parser.add_argument("--apply", action="store_true", help="Actually modify the files (Low risk only)")
    parser.add_argument("--apply-validated", action="store_true", help="Actually modify the files (Bypass Medium/High risk block)")
    parser.add_argument("--mode-ringan", "--lightweight", "--light", action="store_true", help="Jalankan dalam mode ringan (tanpa keharusan scope_lock.json)")
    return parser.parse_args()

def backup_file(filepath, backup_dir):
    try:
        rel_path = os.path.relpath(filepath, os.getcwd())
    except ValueError:
        rel_path = filepath  # cross-drive path, use absolute
    backup_path = os.path.join(backup_dir, rel_path)
    os.makedirs(os.path.dirname(backup_path), exist_ok=True)
    shutil.copy2(filepath, backup_path)
    return backup_path


def print_diff(filepath, old_content, new_content):
    """Print unified diff for a file change."""
    try:
        rel_path = os.path.relpath(filepath, os.getcwd())
    except ValueError:
        rel_path = filepath  # cross-drive path
    diff_lines = list(difflib.unified_diff(
        old_content.splitlines(keepends=True),
        new_content.splitlines(keepends=True),
        fromfile=f'a/{rel_path}',
        tofile=f'b/{rel_path}'
    ))
    if diff_lines:
        # unified_diff includes --- a/... and +++ b/... headers
        print(''.join(diff_lines))
    else:
        print(f"--- {rel_path} (content changed - diff unavailable)")

def is_inside_string(line, pos):
    """Check if position pos falls inside a String Literal.

    Uses a stateful character-by-character scan: tracks whether we're currently
    inside a string, and only recognizes a quote as a delimiter when it closes
    the matching open string. This correctly handles:
    - Apostrophes in contractions: "It's fine" → apostrophe NOT a delimiter
    - Escaped quotes: "He said \"hi\"" → escaped quotes NOT delimiters
    - Mixed delimiters: "It's 'fine'" → both strings correctly tracked
    """
    if pos > len(line):
        return False

    in_string = False
    string_char = None
    i = 0

    while i < len(line):
        if i == pos:
            return in_string

        ch = line[i]

        if not in_string:
            if ch == '"' or ch == "'":
                # Check for escape before opening
                if i > 0 and line[i - 1] == '\\':
                    i += 1
                    continue
                in_string = True
                string_char = ch
        else:
            if ch == string_char:
                # Count preceding backslashes to determine if this delimiter is escaped
                backslash_count = 0
                j = i - 1
                while j >= 0 and line[j] == '\\':
                    backslash_count += 1
                    j -= 1
                if backslash_count % 2 == 1:
                    # Odd backslashes = escaped delimiter, skip it and stay in string
                    i += 1
                    continue
                # Even (including zero) backslashes = unescaped delimiter, close string
                in_string = False
                string_char = None
            elif ch == '\\':
                # Skip backslash, let next character be processed (may be escaped delimiter)
                i += 1
                continue

        i += 1

    return in_string


def split_code_and_comment(line):
    """Split a line into code and comment parts. Returns (code_part, comment_part).

    - For JS/TS/JSX: splits on first '//' (not inside a string)
    - For Python/Shell: splits on first '#' (not inside a string)
    """
    code_part = line
    comment_part = ""

    # Check for // comment (JS/TS/JSX)
    if '//' in line:
        idx = line.index('//')
        if not is_inside_string(line, idx):
            code_part = line[:idx]
            comment_part = line[idx:]
            return code_part, comment_part

    # Check for # comment (Python/Shell)
    if '#' in line:
        idx = line.index('#')
        if not is_inside_string(line, idx):
            code_part = line[:idx]
            comment_part = line[idx:]
            return code_part, comment_part

    return code_part, comment_part


def safe_substitute_line(regex, replacement, line):
    """Perform regex substitution on a line, skipping matches inside string literals.

    Returns the modified line (with comment part untouched if present).
    """
    if not regex.search(line):
        return line

    code_part, comment_part = split_code_and_comment(line)

    # Find matches inside code_part and filter out those inside strings
    new_code = code_part
    matches = list(regex.finditer(code_part))
    if matches:
        # Iterate in REVERSE order (right-to-left)
        # Since replacements only affect positions to the LEFT (already processed),
        # no offset tracking is needed - is_inside_string() scans the ORIGINAL
        # unmutated code_part, which is never modified until final assembly.
        for m in reversed(matches):
            if is_inside_string(code_part, m.start()):
                continue  # skip match inside string
            # Replace this match
            new_code = new_code[:m.start()] + replacement + new_code[m.end():]

    return new_code + comment_part


def main():
    args = get_args()

    if args.search_file:
        try:
            with open(args.search_file, 'r', encoding='utf-8') as f:
                args.search_string = f.read()
        except Exception as e:
            print(f"[ERROR] Could not read search file: {e}")
            sys.exit(1)

    if args.replacement_file:
        try:
            with open(args.replacement_file, 'r', encoding='utf-8') as f:
                args.replace_string = f.read()
        except Exception as e:
            print(f"[ERROR] Could not read replacement file: {e}")
            sys.exit(1)
    
    if not os.path.exists(args.target_dir):
        print(f"[FAIL] Target not found: {args.target_dir}")
        sys.exit(1)
        
    exts = [e.strip() for e in args.ext.split(',')] if args.ext else []
    
    pattern_str = args.search_string
    if args.fuzzy:
        # Fuzzy mode: escape exact strings but allow any whitespace between words
        words = pattern_str.split()
        escaped_words = [re.escape(w) for w in words]
        pattern_str = r'\s+'.join(escaped_words)
    elif not args.regex:
        pattern_str = re.escape(pattern_str)
        
    if args.whole_word or not args.allow_partial_match:
        pattern_str = r'\b' + pattern_str + r'\b'
        
    try:
        regex = re.compile(pattern_str)
    except re.error as e:
        print(f"[FAIL] Invalid regex: {e}")
        sys.exit(1)
        
    backup_dir = None
    if args.apply or args.apply_validated:
        check_task_state(is_apply=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        project_root = find_project_root(args.target_dir)
        backup_dir = os.path.join(project_root, '.backup_replace', timestamp)

    match_count = 0
    file_count = 0
    scanned_files = 0
    pending_writes = []  # (filepath, old_content, new_content)
    
    # Check if target is a file or directory
    if os.path.isfile(args.target_dir):
        files_to_scan = [(os.path.dirname(args.target_dir), [os.path.basename(args.target_dir)])]
    else:
        files_to_scan = []
        for root, dirs, files in os.walk(args.target_dir):
            dirs[:] = [d for d in dirs if d not in DEFAULT_EXCLUDES]
            files_to_scan.append((root, files))
    
    for root, files in files_to_scan:
        for file in files:
            if exts and not any(file.endswith(e) for e in exts):
                continue
            
            filepath = os.path.join(root, file)
            if os.path.getsize(filepath) > MAX_FILE_SIZE:
                continue
                
            scanned_files += 1
            
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
            except UnicodeDecodeError:
                continue
                
            if regex.search(content):
                # Process line by line, skipping matches inside strings and comments
                new_lines = []
                file_match_count = 0
                for line in content.splitlines(keepends=True):
                    new_line = safe_substitute_line(regex, args.replace_string, line)
                    # Count safe matches (code part only)
                    code_part, comment_part = split_code_and_comment(line)
                    for m in regex.finditer(code_part):
                        if not is_inside_string(code_part, m.start()):
                            file_match_count += 1
                    new_lines.append(new_line)
                new_content = ''.join(new_lines)

                rel_path = os.path.relpath(filepath, args.target_dir if os.path.isdir(args.target_dir) else os.path.dirname(args.target_dir))
                if file_match_count > 0 and new_content != content:
                    file_count += 1
                    match_count += file_match_count
                    print(f"[WARN] Found {file_match_count} matches in {rel_path}")
                    pending_writes.append((filepath, content, new_content))
                else:
                    print(f"[WARN] Found 0 matches in {rel_path}")

    print(f"\n[OK] Scan selesai ({scanned_files} file dipindai). Menemukan {match_count} kecocokan di {file_count} file.")
    
    # Calculate risk
    is_logic = False
    is_widespread = file_count > 3
    risk_level = "Low"
    
    if args.replace_string:
        logic_keywords = ['if', 'for', 'while', 'function', 'class', 'import', 'export', 'return']
        if any(kw in args.replace_string for kw in logic_keywords):
            is_logic = True
            
    if is_widespread and is_logic:
        risk_level = "High"
    elif is_widespread or is_logic:
        risk_level = "Medium"
        
    print(f"[RISK] {risk_level} (Widespread: {is_widespread}, Logic: {is_logic})")
    
    if not pending_writes:
        print("\n[OK] Tidak ada perubahan kode yang perlu diterapkan (0 kecocokan).")
        return

    # Urutkan berkas secara deterministik (lintas platform)
    pending_writes.sort(key=lambda x: x[0].replace(os.sep, "/"))

    # Fail-closed scope enforcement (security gate)
    check_scope(pending_writes, light_mode=getattr(args, 'mode_ringan', False))

    if not (args.apply or args.apply_validated):
        print("\n[DRY RUN] Ini hanya simulasi. Gunakan --apply untuk mengeksekusi.")
        if risk_level in ["Medium", "High"]:
            print(f"[BLOCKED] Karena risiko {risk_level}, Anda HARUS menggunakan --apply-validated setelah memastikan aman.")
        sys.exit(0)
        
    if risk_level in ["Medium", "High"] and not args.apply_validated:
        print(f"\n[BLOCKED] Risiko terdeteksi sebagai {risk_level}.")
        print("Eksekusi dengan --apply DITOLAK secara sistem untuk mencegah kerusakan.")
        print("Anda WAJIB menjalankan linter/syntax check secara lokal terlebih dahulu.")
        print("Jika sudah aman, jalankan ulang menggunakan flag --apply-validated")
        sys.exit(1)
    total_files = len(pending_writes)
    print("\n[INFO] Memvalidasi perubahan...")
    for i, (filepath, old_content, new_content) in enumerate(pending_writes):
        display_name = os.path.basename(filepath) if os.path.isfile(args.target_dir) else os.path.relpath(filepath, args.target_dir)
        is_valid, msg = validate_syntax(filepath, new_content)
        if not is_valid:
            print(f"\n[STOP] Validasi gagal di berkas ke-{i+1} dari {total_files}: {display_name}")
            if msg:
                print(f"       {msg}")
            print("       Tidak ada berkas yang ditulis.")
            sys.exit(1)
        elif msg:
            print(f"  - {display_name}: {msg}")

    # Terapkan perubahan jika seluruh berkas valid
    for filepath, old_content, new_content in pending_writes:
        print_diff(filepath, old_content, new_content)
        backup_path = backup_file(filepath, backup_dir)
        with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
            f.write(new_content)
        try:
            from scope_guardian.scripts.scope_check import record_write, is_file_in_scope
            lock_path = os.path.join(os.getcwd(), '.agents', 'scope_lock.json')
            in_scope = True
            task_name = ""
            if os.path.exists(lock_path):
                try:
                    with open(lock_path, 'r', encoding='utf-8-sig') as lf:
                        s_data = json.load(lf)
                    task_name = s_data.get('task', '')
                    allowed_files = [f.replace('\\', '/') for f in s_data.get('allowed_files', [])]
                    allowed_patterns = s_data.get('allowed_patterns', [])
                    in_scope = is_file_in_scope(filepath, allowed_files, allowed_patterns)
                except Exception:
                    pass
            record_write("smart_replace", filepath, in_scope, task_name)
        except Exception:
            pass

    print(f"\n[SUCCESS] Berhasil memodifikasi {len(pending_writes)} file. Backup tersimpan di {backup_dir}")
    if getattr(args, 'with_build', False):
        check_frontend_build()
    else:
        pkg_path = os.path.join(os.getcwd(), 'package.json')
        has_build = False
        if os.path.exists(pkg_path):
            try:
                with open(pkg_path, 'r', encoding='utf-8') as f:
                    pkg_data = json.load(f)
                if isinstance(pkg_data, dict) and isinstance(pkg_data.get('scripts'), dict) and 'build' in pkg_data['scripts']:
                    has_build = True
            except Exception:
                pass
        if has_build:
            print("[INFO] Pemeriksaan build frontend dilewati (gunakan flag --with-build jika ingin menjalankan build).")

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        import traceback
        print(file=sys.stderr)
        print("[TOOL ERROR - ini bug internal snowline, BUKAN masalah di kode project Anda]", file=sys.stderr)
        print(f"Error: {type(e).__name__}: {e}", file=sys.stderr)
        print(file=sys.stderr)
        print("Traceback (untuk dilaporkan ke developer):", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
