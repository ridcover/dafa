import os
import sys
import re
import shutil
import json
from datetime import datetime

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

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

def check_scope_write(write_target):
    """Enforce scope check using the unified scope_guardian module."""
    skills_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if skills_dir not in sys.path:
        sys.path.insert(0, skills_dir)
    try:
        from scope_guardian.scripts.scope_check import check_scope
        return check_scope(write_target)
    except Exception as e:
        print(f"[BLOCKED] Failed to import check_scope from scope_guardian: {e}")
        print("Pastikan skill scope_guardian terpasang di sebelah skill ini.")
        sys.exit(1)

IGNORE_DIRS = {'.git', 'node_modules', 'vendor', 'dist', 'build', '.history', '.dart_tool', '.gradle', '.pub-cache', 'Pods'}
EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx']

def find_file(filename, root_dir):
    matches = []
    has_ext = any(filename.endswith(ext) for ext in EXTENSIONS)
    search_names = [filename] if has_ext else [filename + ext for ext in EXTENSIONS]
    
    for r, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in files:
            if f in search_names:
                matches.append(os.path.join(r, f))
    return matches

def compute_relative_path(source_file, target_file):
    source_dir = os.path.dirname(os.path.abspath(source_file))
    target_abs = os.path.abspath(target_file)
    rel_path = os.path.relpath(target_abs, source_dir)
    rel_path = rel_path.replace('\\', '/')
    if not rel_path.startswith('.'):
        rel_path = './' + rel_path
    for ext in EXTENSIONS:
        if rel_path.endswith(ext):
            rel_path = rel_path[:-len(ext)]
            break
    return rel_path

def fix_import(source_file, broken_import, apply_mode):
    print("=== SMART IMPORT FIXER ===")
    print("=" * 60)

    # Check scope before writing
    check_scope_write(source_file)

    if not os.path.exists(source_file):
        print(f"[FAIL] Source file not found: {source_file}")
        return
        
    basename = os.path.basename(broken_import)
    print(f"[INFO] Searching for actual location of '{basename}'...")
    
    root_dir = os.getcwd()
    matches = find_file(basename, root_dir)
    
    if not matches:
        print(f"[FAIL] Could not find any file named {basename} in the project.")
        return
        
    if len(matches) > 1:
        source_dir = os.path.dirname(os.path.abspath(source_file))
        def proximity_score(match):
            match_dir = os.path.dirname(match)
            if match_dir == source_dir:
                return 0
            try:
                rel = os.path.relpath(match_dir, source_dir)
                if rel == '.':
                    return 0
                return rel.count('..') + rel.count(os.sep)
            except:
                return 999
        matches.sort(key=proximity_score)
        if proximity_score(matches[0]) < proximity_score(matches[-1]):
            target_file = matches[0]
            print(f"[INFO] Multiple matches found -> using nearest one: {target_file}")
        else:
            print(f"[FAIL] Multiple files found with basename '{basename}':")
            for m in matches:
                print(f"  - {m}")
            print(f"[FAIL] Please provide the full path to the correct file.")
            return
    elif len(matches) == 1:
        target_file = matches[0]

    new_import = compute_relative_path(source_file, target_file)
    print(f"\n[INFO] Broken Import : {broken_import}")
    print(f"[INFO] Correct Import: {new_import}")

    try:
        with open(source_file, 'r', encoding='utf-8') as f:
            content = f.read()

        escaped = re.escape(broken_import)
        pattern = re.compile(r'([\'\"])' + escaped + r'\1')
        if pattern.search(content):
            new_content = pattern.sub(lambda m: m.group(1) + new_import + m.group(1), content)
        elif broken_import in content:
            new_content = content.replace(broken_import, new_import)
        else:
            print(f"[WARN] The import '{broken_import}' was not found in {source_file}.")
            return
        
        if not apply_mode:
            print("\n" + "=" * 60)
            print("[OK] Dry-run complete. Found the correct path.")
            print("\nPROMPT UNTUK AI (Copy-Paste ini):")
            print(f'"Berdasarkan hasil pencarian Smart Import Fixer di atas, jalankan ulang perintah dengan tambahan flag --apply untuk memperbaiki rute secara otomatis."')
        else:
            backup_dir = os.path.join(root_dir, '.backup_replace', datetime.now().strftime("%Y%m%d_%H%M%S"))
            os.makedirs(backup_dir, exist_ok=True)
            backup_path = os.path.join(backup_dir, os.path.basename(source_file) + ".bak")
            shutil.copy2(source_file, backup_path)
            
            with open(source_file, 'w', encoding='utf-8') as f:
                f.write(new_content)
                
            print("\n" + "=" * 60)
            print(f"[OK] Import fixed! Backup saved to {backup_dir}")
            try:
                from scope_guardian.scripts.scope_check import record_write
                record_write("import_fixer", source_file, True)
            except Exception:
                pass
            
    except Exception as e:
        print(f"[FAIL] Error processing file: {e}")

def check_role_permission(is_apply=False):
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

def main():
    if len(sys.argv) < 3:
        print("Usage: python fixer.py <source_file> <broken_import_string> [--apply]")
        sys.exit(1)
        
    apply_mode = "--apply" in sys.argv
    check_role_permission(apply_mode)
    source_file = sys.argv[1]
    broken_import = sys.argv[2]
    
    fix_import(source_file, broken_import, apply_mode)

if __name__ == "__main__":
    main()
