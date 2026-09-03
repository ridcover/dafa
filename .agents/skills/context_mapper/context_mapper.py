import os
import sys
import re
import json
import time
import subprocess
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
if sys.stdout.encoding is None or sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

KNOWLEDGE_DIR = '.agents/knowledge'

JS_PATTERNS = [
    re.compile(r"import\s+(?:\{[^}]*\}|[^{};\n]+)\s+from\s+['\"]([^'\"]+)['\"]"),
    re.compile(r"import\s+\{[^}]*\}\s+from\s+['\"]([^'\"]+)['\"]"),
    re.compile(r"require\s*\(\s*['\"]([^'\"]+)['\"]"),
    re.compile(r"import\s*\(\s*['\"]([^'\"]+)['\"]"),
    re.compile(r"export\s+.*?\s+from\s+['\"]([^'\"]+)['\"]"),
    re.compile(r"import\s+['\"]([^'\"]+)['\"]")
]
PY_PATTERN = re.compile(r"(?:^|\n)\s*(?:from|import|use|include(?:_once)?|require(?:_once)?)\b(.*)")
WORD_PATTERN = re.compile(r'\b\w+\b')

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

def extract_dependencies(content, target_names_set):
    found = set()
    for pat in JS_PATTERNS:
        for match in pat.finditer(content):
            path_str = match.group(1)
            base = path_str.split('/')[-1].split('.')[0]
            if base in target_names_set:
                found.add(base)
                
    for match in PY_PATTERN.finditer(content):
        line_remainder = match.group(1)
        words = set(WORD_PATTERN.findall(line_remainder))
        found.update(words.intersection(target_names_set))
        
    return found

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
    apply_mode = "--apply" in sys.argv
    check_role_permission(apply_mode)
    project_root = os.getcwd()
    knowledge_path = os.path.join(project_root, KNOWLEDGE_DIR)
    map_file = os.path.join(knowledge_path, 'DEPENDENCY_MAP.md')
    patterns_file = os.path.join(knowledge_path, 'COMMON_PATTERNS.md')

    exclude_dirs = {'.git', 'node_modules', 'dist', 'build', '.agents', 'vendor', '.history', 'quarantine', '.backup_replace', '.venv', 'venv', 'env', '.env', '.dart_tool', '.gradle', '.pub-cache', 'Pods'}
    
    start_time = time.time()
    
    all_files = []
    base_to_files = {}
    
    t0 = time.time()
    for root, dirs, files in os.walk(project_root):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if file.endswith(('.js', '.jsx', '.ts', '.tsx', '.py', '.php')):
                filepath = os.path.join(root, file)
                all_files.append(filepath)
                
                base, _ = os.path.splitext(file)
                if base.lower() == 'index':
                    base = os.path.basename(root)
                
                if base not in base_to_files:
                    base_to_files[base] = []
                base_to_files[base].append(filepath)
    t1 = time.time()
    # print(f"Walk time: {t1-t0}")
                
    target_names = list(base_to_files.keys())
    if not target_names:
        print("No source files found.")
        sys.exit(0)
        
    target_names_set = set(target_names)
    
    incoming = {f: set() for f in all_files}
    outgoing = {f: set() for f in all_files}
    
    t2 = time.time()
    for filepath in all_files:
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                
                deps = extract_dependencies(content, target_names_set)
                for match in deps:
                    for target_file in base_to_files[match]:
                        if target_file != filepath:
                            outgoing[filepath].add(target_file)
                            incoming[target_file].add(filepath)
        except Exception:
            pass
    t3 = time.time()
    # print(f"Extract time: {t3-t2}")
    # Load config mentions
    config_mentions = set()
    for config_file in ['hooks.json', 'package.json', 'pyproject.toml']:
        config_path = os.path.join(project_root, config_file)
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    config_content = f.read()
                    config_mentions.update(WORD_PATTERN.findall(config_content))
            except Exception:
                pass

    # Find Entry Points and Orphans
    entry_points = set()
    orphans = set()
    
    for f in all_files:
        if len(incoming[f]) > 0:
            continue
            
        is_entry = len(outgoing[f]) > 0
        
        # Check CLI / Config definitions
        if not is_entry:
            base = os.path.basename(f).split('.')[0]
            if base in config_mentions:
                is_entry = True
            elif f.endswith('.py'):
                try:
                    with open(f, 'r', encoding='utf-8', errors='ignore') as pfile:
                        pcontent = pfile.read()
                        if '__main__' in pcontent or 'argparse' in pcontent:
                            is_entry = True
                except Exception:
                    pass
                    
        if is_entry:
            entry_points.add(f)
        else:
            orphans.add(f)
    end_time = time.time()
    
    # Build Markdown Content
    try:
        commit_hash = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], stderr=subprocess.DEVNULL).decode('utf-8').strip()
    except Exception:
        commit_hash = "unknown"
        
    date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    map_content = "# 🗺️ Project Dependency Map\n\n"
    map_content += f"**Generated At:** {date_str}\n"
    map_content += f"**Commit Hash:** `{commit_hash}`\n"
    map_content += "**To Regenerate:** `python .agents/skills/context_mapper/context_mapper.py --apply`\n\n"
    
    map_content += f"**Scan Stats:** {len(all_files)} files scanned in {end_time - start_time:.2f} seconds.\n\n"
    
    map_content += "## 🌟 Entry Points (Akar Fitur)\n"
    map_content += "Berkas yang tidak diimpor siapa pun, tetapi mengimpor berkas lain.\n"
    for ep in sorted(entry_points):
        rel_path = os.path.relpath(ep, project_root).replace(os.sep, '/')
        map_content += f"- `{rel_path}` (imports {len(outgoing[ep])} files)\n"
    if not entry_points:
        map_content += "- *None found.*\n"
        
    map_content += "\n## 👻 Orphans (Kandidat Kode Mati)\n"
    map_content += "Berkas yang tidak diimpor siapa pun dan tidak dipakai.\n"
    for orphan in sorted(orphans):
        rel_path = os.path.relpath(orphan, project_root).replace(os.sep, '/')
        map_content += f"- `{rel_path}`\n"
    if not orphans:
        map_content += "- *None found.*\n"
        
    patterns_path = os.path.join(knowledge_path, 'COMMON_PATTERNS.md')
    patterns_content = ""
    if not os.path.exists(patterns_path):
        patterns_content = "# 🧩 Common Patterns & Conventions\n\n"
        patterns_content += "This file contains the fundamental rules of the project. The AI MUST read this file before writing code.\n\n"
        patterns_content += "## 1. Core Logic\n"
        patterns_content += "- Document logic conventions here.\n\n"
        patterns_content += "## 2. Code Style\n"
        patterns_content += "- Document styling rules here (e.g. no Tailwind, use Vanilla CSS).\n\n"
        patterns_content += "## 3. Security\n"
        patterns_content += "- Never store credentials in code. Always use `.env`.\n"
        
    if not apply_mode:
        print("[DRY-RUN MODE] Context Mapper Preview")
        print("=" * 50)
        print(f"Target File: {map_file}")
        print("--- Content Preview ---")
        print(map_content[:800] + "\n... (truncated)")
        print("=" * 50)
        print("\n💡 PROMPT UNTUK AI (Copy-Paste ini):")
        print('"Pratinjau berhasil. Silakan jalankan ulang perintah dengan tambahan flag --apply untuk menyimpan perubahan ini ke dalam disk."')
    else:
        check_scope_write(map_file)
        check_scope_write(patterns_file)
        os.makedirs(knowledge_path, exist_ok=True)
        with open(map_file, 'w', encoding='utf-8') as f:
            f.write(map_content)
        try:
            from scope_guardian.scripts.scope_check import record_write
            record_write("context_mapper", map_file, True)
        except Exception:
            pass
            
        if patterns_content:
            with open(patterns_path, 'w', encoding='utf-8') as f:
                f.write(patterns_content)
                
        print(f"[OK] Dependency Map berhasil dibuat/diperbarui di folder `{KNOWLEDGE_DIR}/`.")
        print("\n💡 PROMPT UNTUK AI (Copy-Paste ini):")
        print('"Mulai sekarang, setiap kali Anda menangani proyek ini, tolong panggil view_file pada .agents/knowledge/DEPENDENCY_MAP.md dan .agents/knowledge/COMMON_PATTERNS.md terlebih dahulu sebelum melakukan pencarian atau menulis kode."')

if __name__ == "__main__":
    main()
